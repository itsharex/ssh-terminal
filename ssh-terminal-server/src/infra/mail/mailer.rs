use crate::domain::dto::mail::MailTaskDto;
use anyhow::{Context, Result};
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use std::sync::Arc;
use tokio::sync::Semaphore;

/// SMTP 配置
#[derive(Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from_name: String,
    pub from_email: String,
}

/// 邮件发送器（支持连接池）
pub struct Mailer {
    config: Arc<SmtpConfig>,
    semaphore: Arc<Semaphore>,
}

impl Mailer {
    pub fn new(config: SmtpConfig, max_connections: usize) -> Self {
        Self {
            config: Arc::new(config),
            semaphore: Arc::new(Semaphore::new(max_connections)),
        }
    }

    /// 发送邮件
    pub async fn send(&self, task: &MailTaskDto, subject: &str, html_body: &str) -> Result<()> {
        // 获取连接池许可
        let _permit = self.semaphore.acquire().await;

        // 构建 SMTP 传输器
        let creds = Credentials::new(
            self.config.username.clone(),
            self.config.password.clone(),
        );

        let mailer = SmtpTransport::relay(&self.config.host)
            .context("Failed to create SMTP relay")?
            .port(self.config.port)
            .credentials(creds)
            .build();

        // 构建邮件消息
        let email = Message::builder()
            .from(format!("{} <{}>", self.config.from_name, self.config.from_email)
                .parse()
                .context("Invalid from address")?)
            .to(task.to.parse().context("Invalid to address")?)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(html_body.to_string())
            .context("Failed to build email body")?;

        // 发送邮件
        mailer
            .send(&email)
            .context("Failed to send email via SMTP")?;

        Ok(())
    }
}