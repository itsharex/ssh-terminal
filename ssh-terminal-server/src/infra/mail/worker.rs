use crate::config::email::EmailConfig;
use crate::domain::dto::mail::MailTaskDto;
use crate::domain::entities::email_logs;
use crate::infra::mail::mailer::{Mailer, SmtpConfig};
use crate::infra::mail::queue::MailQueue;
use crate::infra::redis::redis_client::RedisClient;
use anyhow::{Context, Result};
use sea_orm::{DatabaseConnection, EntityTrait, Set, ColumnTrait, QueryFilter, QueryOrder};
use tracing::{error, info, warn};

/// 启动邮件 Worker 池（多个并发 Worker）
pub async fn start_mail_workers(
    redis_client: RedisClient,
    config: EmailConfig,
    db: DatabaseConnection,
) {
    let worker_count = config.worker_pool_size;

    // 为每个 Worker 创建独立的连接
    let mut worker_handles = vec![];

    for worker_id in 0..worker_count {
        // 每个 Worker 需要独立的 Redis 连接
        // 但当前架构是共享 main 连接，worker 连接仍然有 Mutex
        // 所以实际上 Worker 之间还是串行的
        // TODO: 完全实现需要为每个 Worker 创建独立的 RedisClient

        let redis_client_clone = redis_client.clone();
        let config_clone = config.clone();
        let db_clone = db.clone();

        let handle = tokio::spawn(async move {
            info!("📧 Mail Worker {} started", worker_id);

            let queue = MailQueue::new(redis_client_clone.clone());
            let smtp_config = SmtpConfig {
                host: config_clone.smtp_host.clone(),
                port: config_clone.smtp_port,
                username: config_clone.smtp_username.clone(),
                password: config_clone.smtp_password.clone(),
                from_name: config_clone.from_name.clone(),
                from_email: config_clone.from_email.clone(),
            };
            let mailer = Mailer::new(smtp_config, 1); // 每个 Worker 只需要 1 个线程

            loop {
                // 从队列中阻塞获取任务
                match queue.pop(config_clone.worker_timeout_seconds).await {
                    Ok(Some(task)) => {
                        if let Err(e) = process_mail_task(&task, &mailer, &db_clone, &queue).await {
                            error!("Worker {}: Failed to process mail task: {}", worker_id, e);
                        }
                    }
                    Ok(None) => {
                        // 超时，继续等待
                        continue;
                    }
                    Err(e) => {
                        error!("Worker {}: Failed to pop from mail queue: {}", worker_id, e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    }
                }
            }
        });

        worker_handles.push(handle);
    }

    info!("📧 Started {} mail workers", worker_count);
}

/// 处理邮件任务
async fn process_mail_task(
    task: &MailTaskDto,
    mailer: &Mailer,
    db: &DatabaseConnection,
    queue: &MailQueue,
) -> Result<()> {
    // 查找日志记录（按 email 查询）
    let _log = email_logs::Entity::find()
        .filter(email_logs::Column::Email.eq(&task.to))
        .filter(email_logs::Column::Status.eq(email_logs::Model::STATUS_PENDING))
        .order_by_desc(email_logs::Column::CreatedAt)
        .one(db)
        .await
        .context("Failed to query email log")?;

    // 渲染邮件内容
    let (subject, html_body) = crate::utils::mail_template::render_mail(
        &task.template,
        &task.lang,
        &task.data,
    )
    .context("Failed to render mail template")?;

    // 发送邮件

        match mailer.send(task, &subject, &html_body).await {

            Ok(_) => {

                info!("✅ Email sent successfully to {}", task.to);

                update_email_log(db, &task.to, email_logs::Model::STATUS_SENT, None).await?;

                Ok(())

            }

            Err(e) => {

                warn!("❌ Failed to send email to {}: {}", task.to, e);

    

                // 检查是否需要重试

                if task.retry < 3 {

                    // 指数退避：2^retry 秒

                    let delay = 2u64.pow(task.retry as u32);

                    info!("⏳ Retrying in {} seconds...", delay);

                    tokio::time::sleep(tokio::time::Duration::from_secs(delay)).await;

    

                    // 增加重试次数并重新入队

                    let mut retry_task = task.clone();

                    retry_task.retry += 1;

                    queue.push(&retry_task).await?;

                    update_email_log_retry(db, &task.to, task.retry + 1).await?;

                } else {

                    // 超过最大重试次数，推入死信队列

                    error!("💀 Email task exceeded max retries, moving to dead letter queue");

                    queue.push_dead_letter(task).await?;

                    update_email_log(

                        db,

                        &task.to,

                        email_logs::Model::STATUS_FAILED,

                        Some(e.to_string()),

                    ).await?;

                }

                Err(e)
        }
    }
}

/// 更新邮件日志状态
async fn update_email_log(
    db: &DatabaseConnection,
    email: &str,
    status: &str,
    error_message: Option<String>,
) -> Result<()> {
    if let Some(log) = email_logs::Entity::find()
        .filter(email_logs::Column::Email.eq(email))
        .filter(email_logs::Column::Status.eq(email_logs::Model::STATUS_PENDING))
        .order_by_desc(email_logs::Column::CreatedAt)
        .one(db)
        .await?
    {
        use sea_orm::ActiveModelTrait;
        let mut log_active: email_logs::ActiveModel = log.into();
        log_active.status = Set(status.to_string());
        log_active.error_message = Set(error_message);
        log_active.update(db).await?;
    }
    Ok(())
}

/// 更新邮件日志重试次数
async fn update_email_log_retry(
    db: &DatabaseConnection,
    email: &str,
    retry_count: u8,
) -> Result<()> {
    if let Some(log) = email_logs::Entity::find()
        .filter(email_logs::Column::Email.eq(email))
        .filter(email_logs::Column::Status.eq(email_logs::Model::STATUS_PENDING))
        .order_by_desc(email_logs::Column::CreatedAt)
        .one(db)
        .await?
    {
        use sea_orm::ActiveModelTrait;
        let mut log_active: email_logs::ActiveModel = log.into();
        log_active.retry_count = Set(retry_count);
        log_active.update(db).await?;
    }
    Ok(())
}