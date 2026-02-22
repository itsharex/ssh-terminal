use crate::domain::dto::mail::MailTaskDto;
use crate::domain::vo::mail::EmailResult;
use crate::infra::mail::queue::MailQueue;
use crate::infra::mail::rate_limit::MailRateLimit;
use crate::infra::redis::redis_client::RedisClient;
use crate::infra::redis::redis_key::{BusinessType, RedisKey};
use crate::repositories::email_log_repository::EmailLogRepository;
use crate::utils::i18n::{self, MessageKey};
use anyhow::{Context, Result};
use rand::Rng;

/// 邮件服务
pub struct MailService {
    redis_client: RedisClient,
    email_log_repo: EmailLogRepository,
}

impl MailService {
    pub fn new(redis_client: RedisClient, email_log_repo: EmailLogRepository) -> Self {
        Self {
            redis_client,
            email_log_repo,
        }
    }

    /// 发送验证码邮件
    /// - user_id: 用户 ID
    /// - email: 收件人邮箱
    /// - lang: 语言代码（zh-CN 或 en）
    pub async fn send_verify_code(
        &self,
        user_id: &str,
        email: &str,
        lang: &str,
    ) -> Result<EmailResult> {
        // 0. 检查邮件功能是否启用
        // 注意：这个检查应该由调用者（Handler）完成，这里只做业务逻辑
        // 如果需要在 Service 层检查，需要传入 enabled 参数

        let rate_limit = MailRateLimit::new(self.redis_client.clone());
        let queue = MailQueue::new(self.redis_client.clone());

        // 1. 检查限频（60秒内只能发送一次）
        let can_send = rate_limit.check_rate_limit(user_id).await
            .context("Failed to check rate limit")?;

        if !can_send {
            let ttl = rate_limit.get_rate_ttl(user_id).await.unwrap_or(60);
            let message = i18n::t(
                Some(lang),
                MessageKey::ErrorEmailRateLimit,
            );
            return Ok(EmailResult::failed(format!("{} ({})", message, ttl)));
        }

        // 2. 检查每日限制（每天最多发送 10 次）
        let can_send_daily = rate_limit.check_daily_limit(user_id).await
            .context("Failed to check daily limit")?;

        if !can_send_daily {
            let daily_count = rate_limit.get_daily_count(user_id).await.unwrap_or(10);
            let message = i18n::t(
                Some(lang),
                MessageKey::ErrorEmailDailyLimit,
            );
            return Ok(EmailResult::failed(format!("{} ({}/10)", message, daily_count)));
        }

        // 3. 生成 6 位数字验证码
        let code = self.generate_verify_code();

        // 4. 将验证码保存到 Redis（5分钟有效期）
        let verify_key = RedisKey::new(BusinessType::Auth)
            .add_identifier("verify_code")
            .add_identifier(email);
        self.redis_client
            .set(&verify_key.to_string(), &code)
            .await
            .context("Failed to save verify code to Redis")?;
        self.redis_client
            .expire(&verify_key.to_string(), 300) // 5分钟 = 300秒
            .await
            .context("Failed to set verify code expiration")?;

        // 5. 创建邮件日志记录
        self.email_log_repo.create(user_id, email, "verify_code").await
            .context("Failed to create email log")?;

        // 6. 构建邮件任务
        let task = MailTaskDto {
            to: email.to_string(),
            template: "verify_code".to_string(),
            lang: lang.to_string(),
            data: serde_json::json!({ "code": code }),
            retry: 0,
        };

        // 6. 推入队列
        queue.push(&task).await
            .context("Failed to push mail task to queue")?;

        // 7. 返回成功结果
        let _message = i18n::t(
            Some(lang),
            MessageKey::SuccessEmailQueued,
        );
        Ok(EmailResult::success())
    }

    /// 生成 6 位数字验证码
    fn generate_verify_code(&self) -> String {
        let mut rng = rand::thread_rng();
        (0..6)
            .map(|_| rng.gen_range(0..10).to_string())
            .collect()
    }
}