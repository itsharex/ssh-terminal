use crate::domain::dto::mail::MailTaskDto;
use crate::infra::redis::{redis_client::RedisClient, redis_key::BusinessType, redis_key::RedisKey};
use anyhow::Result;

/// 邮件队列管理器
pub struct MailQueue {
    redis_client: RedisClient,
}

impl MailQueue {
    pub fn new(redis_client: RedisClient) -> Self {
        Self { redis_client }
    }

    /// 获取邮件队列的 Redis Key
    fn get_queue_key() -> RedisKey {
        RedisKey::new(BusinessType::Auth)
            .add_identifier("mail")
            .add_identifier("queue")
    }

    /// 获取死信队列的 Redis Key
    fn get_dead_letter_key() -> RedisKey {
        RedisKey::new(BusinessType::Auth)
            .add_identifier("mail")
            .add_identifier("dead_letter")
    }

    /// 将邮件任务推入队列
    pub async fn push(&self, task: &MailTaskDto) -> Result<()> {
        let json = serde_json::to_string(task)?;
        self.redis_client
            .lpush_key(&Self::get_queue_key(), &json)
            .await?;
        Ok(())
    }

    /// 从队列中阻塞弹出邮件任务
    pub async fn pop(&self, timeout_seconds: u64) -> Result<Option<MailTaskDto>> {
        let json = self
            .redis_client
            .brpop_key(&Self::get_queue_key(), timeout_seconds)
            .await?;

        if let Some(json_str) = json {
            let task: MailTaskDto = serde_json::from_str(&json_str)?;
            Ok(Some(task))
        } else {
            Ok(None)
        }
    }

    /// 将任务推入死信队列
    pub async fn push_dead_letter(&self, task: &MailTaskDto) -> Result<()> {
        let json = serde_json::to_string(task)?;
        self.redis_client
            .lpush_key(&Self::get_dead_letter_key(), &json)
            .await?;
        Ok(())
    }

    /// 获取队列长度
    pub async fn queue_len(&self) -> Result<u64> {
        self.redis_client.llen_key(&Self::get_queue_key()).await
            .map_err(|e| anyhow::anyhow!("Redis error: {}", e))
    }

    /// 获取死信队列长度
    pub async fn dead_letter_len(&self) -> Result<u64> {
        self.redis_client
            .llen_key(&Self::get_dead_letter_key())
            .await
            .map_err(|e| anyhow::anyhow!("Redis error: {}", e))
    }
}