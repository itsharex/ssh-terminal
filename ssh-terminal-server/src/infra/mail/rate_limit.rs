use crate::infra::redis::{redis_client::RedisClient, redis_key::BusinessType, redis_key::RedisKey};
use anyhow::Result;

/// 邮件发送限频管理器
pub struct MailRateLimit {
    redis_client: RedisClient,
}

impl MailRateLimit {
    pub fn new(redis_client: RedisClient) -> Self {
        Self { redis_client }
    }

    /// 获取用户限频的 Redis Key
    fn get_user_rate_key(user_id: &str) -> RedisKey {
        RedisKey::new(BusinessType::RateLimit)
            .add_identifier("mail")
            .add_identifier("user")
            .add_identifier(user_id)
    }

    /// 获取用户每日限频的 Redis Key
    fn get_user_daily_key(user_id: &str) -> RedisKey {
        let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
        RedisKey::new(BusinessType::RateLimit)
            .add_identifier("mail")
            .add_identifier("daily")
            .add_identifier(user_id)
            .add_identifier(date)
    }

    /// 检查用户是否可以发送邮件（60秒限频）
    pub async fn check_rate_limit(&self, user_id: &str) -> Result<bool> {
        let key = Self::get_user_rate_key(user_id);
        
        // 先获取当前计数（不增加）
        let count_str = self.redis_client.get_key(&key).await
            .map_err(|e| anyhow::anyhow!("Redis error: {}", e))?;
        let count = count_str.unwrap_or_default().parse::<u64>().unwrap_or(0);

        // 检查是否有限频（计数 > 0 表示还在 60 秒限频期内）
        if count > 0 {
            return Ok(false);
        }

        // 没有限频，增加计数
        let _new_count = self.redis_client.incr_key(&key).await
            .map_err(|e| anyhow::anyhow!("Redis error: {}", e))?;

        // 设置 60 秒过期
        self.redis_client.expire_key(&key, 60).await
            .map_err(|e| anyhow::anyhow!("Redis error: {}", e))?;

        Ok(true)
    }

    /// 检查用户每日发送次数限制（每日 10 次）
    pub async fn check_daily_limit(&self, user_id: &str) -> Result<bool> {
        let key = Self::get_user_daily_key(user_id);
        
        // 先获取当前计数（不增加）
        let count_str = self.redis_client.get_key(&key).await
            .map_err(|e| anyhow::anyhow!("Redis error: {}", e))?;
        let count = count_str.unwrap_or_default().parse::<u64>().unwrap_or(0);

        // 检查是否超过限制
        if count >= 10 {
            return Ok(false);
        }

        // 未超过限制，增加计数
        let new_count = self.redis_client.incr_key(&key).await
            .map_err(|e| anyhow::anyhow!("Redis error: {}", e))?;

        if new_count == 1 {
            // 第一次请求，设置 24 小时过期（86400 秒）
            self.redis_client.expire_key(&key, 86400).await
                .map_err(|e| anyhow::anyhow!("Redis error: {}", e))?;
        }

        Ok(true)
    }

    /// 获取用户当前限频剩余时间（秒）
    pub async fn get_rate_ttl(&self, user_id: &str) -> Result<i64> {
        let key = Self::get_user_rate_key(user_id);
        self.redis_client.ttl_key(&key).await
            .map_err(|e| anyhow::anyhow!("Redis error: {}", e))
    }

    /// 获取用户今日已发送次数
    pub async fn get_daily_count(&self, user_id: &str) -> Result<u64> {
        let key = Self::get_user_daily_key(user_id);
        let count_str = self.redis_client.get_key(&key).await
            .map_err(|e| anyhow::anyhow!("Redis error: {}", e))?;
        Ok(count_str.unwrap_or_default().parse().unwrap_or(0))
    }
}