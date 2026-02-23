use super::redis_key::RedisKey;
use redis::aio::{ConnectionManager, MultiplexedConnection};
use redis::{AsyncCommands, Client, cmd};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::warn;

/// Redis 客户端（双连接架构）
/// - main: ConnectionManager 处理普通操作（GET/SET/INCR/EXPIRE 等）
/// - worker: MultiplexedConnection 专门用于 BRPOP 阻塞操作
#[derive(Clone)]
pub struct RedisClient {
    /// 主连接：ConnectionManager 处理所有普通操作
    /// 自动管理连接池和重连，支持并发操作
    main: ConnectionManager,

    /// Worker 连接：独立的 MultiplexedConnection 专门用于 BRPOP
    worker: Arc<Mutex<MultiplexedConnection>>,

    /// Redis Client 实例（用于创建新的连接）
    client: Client,
}

impl RedisClient {
    /// 创建新的 Redis 客户端
    pub async fn new(url: &str) -> redis::RedisResult<Self> {
        let client = Client::open(url)?;

        // 初始化 main 连接（ConnectionManager）
        // ConnectionManager 自动管理连接池和重连
        let main = ConnectionManager::new(client.clone()).await?;

        // 初始化 worker 连接（MultiplexedConnection）
        // 使用独立的连接用于 BRPOP 阻塞操作
        let conn = client.get_multiplexed_async_connection().await?;
        let worker = Arc::new(Mutex::new(conn));

        Ok(Self { main, worker, client })
    }

    /// 设置字符串值
    pub async fn set(&self, k: &str, v: &str) -> redis::RedisResult<()> {
        let mut main = self.main.clone();
        main.set(k, v).await
    }

    /// 获取字符串值
    pub async fn get(&self, k: &str) -> redis::RedisResult<Option<String>> {
        let mut main = self.main.clone();
        main.get(k).await
    }

    /// 设置字符串值并指定过期时间（秒）
    pub async fn set_ex(&self, k: &str, v: &str, seconds: u64) -> redis::RedisResult<()> {
        let mut main = self.main.clone();
        main.set_ex(k, v, seconds).await
    }

    /// 删除键
    pub async fn del(&self, k: &str) -> redis::RedisResult<()> {
        let mut main = self.main.clone();
        main.del(k).await
    }

    /// 设置键的过期时间（秒）
    pub async fn expire(&self, k: &str, seconds: u64) -> redis::RedisResult<()> {
        let mut main = self.main.clone();
        main.expire(k, seconds as i64).await
    }

    /// 使用 RedisKey 设置 JSON 值
    pub async fn set_key<T: Serialize>(
        &self,
        key: &RedisKey,
        value: &T,
    ) -> redis::RedisResult<()> {
        let json = serde_json::to_string(value).map_err(|e| {
            redis::RedisError::from((
                redis::ErrorKind::TypeError,
                "JSON serialization failed",
                e.to_string(),
            ))
        })?;
        let key_str = key.build();
        let mut main = self.main.clone();
        main.set(key_str, json).await
    }

    /// 使用 RedisKey 设置 JSON 值并指定过期时间（秒）
    pub async fn set_key_ex<T: Serialize>(
        &self,
        key: &RedisKey,
        value: &T,
        expiration_seconds: u64,
    ) -> redis::RedisResult<()> {
        let json = serde_json::to_string(value).map_err(|e| {
            redis::RedisError::from((
                redis::ErrorKind::TypeError,
                "JSON serialization failed",
                e.to_string(),
            ))
        })?;
        let key_str = key.build();
        let mut main = self.main.clone();
        main.set_ex(key_str, json, expiration_seconds).await
    }

    /// 使用 RedisKey 获取字符串值
    pub async fn get_key(&self, key: &RedisKey) -> redis::RedisResult<Option<String>> {
        let key_str = key.build();
        let mut main = self.main.clone();
        main.get(key_str).await
    }

    /// 使用 RedisKey 获取并反序列化 JSON 值
    pub async fn get_key_json<T: for<'de> serde::Deserialize<'de>>(
        &self,
        key: &RedisKey,
    ) -> redis::RedisResult<Option<T>> {
        let key_str = key.build();
        let mut main = self.main.clone();
        let json: Option<String> = main.get(key_str).await?;
        match json {
            Some(data) => {
                let value = serde_json::from_str(&data).map_err(|e| {
                    redis::RedisError::from((
                        redis::ErrorKind::TypeError,
                        "JSON deserialization failed",
                        e.to_string(),
                    ))
                })?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    /// 使用 RedisKey 删除键
    pub async fn delete_key(&self, key: &RedisKey) -> redis::RedisResult<()> {
        let key_str = key.build();
        let mut main = self.main.clone();
        main.del(key_str).await
    }

    /// 使用 RedisKey 检查键是否存在
    pub async fn exists_key(&self, key: &RedisKey) -> redis::RedisResult<bool> {
        let key_str = key.build();
        let mut main = self.main.clone();
        main.exists(key_str).await
    }

    /// 使用 RedisKey 设置键的过期时间（秒）
    pub async fn expire_key(&self, key: &RedisKey, seconds: u64) -> redis::RedisResult<()> {
        let key_str = key.build();
        let mut main = self.main.clone();
        main.expire(key_str, seconds as i64).await
    }

    // ==================== Redis Set 操作 ====================

    /// 向 Set 中添加一个或多个成员
    pub async fn sadd(&self, k: &str, v: &str) -> redis::RedisResult<()> {
        let mut main = self.main.clone();
        main.sadd(k, v).await
    }

    /// 从 Set 中移除一个或多个成员
    pub async fn srem(&self, k: &str, v: &str) -> redis::RedisResult<()> {
        let mut main = self.main.clone();
        main.srem(k, v).await
    }

    /// 获取 Set 中的所有成员
    pub async fn smembers(&self, k: &str) -> redis::RedisResult<Vec<String>> {
        let mut main = self.main.clone();
        main.smembers(k).await
    }

    /// 检查成员是否在 Set 中
    pub async fn sismember(&self, k: &str, v: &str) -> redis::RedisResult<bool> {
        let mut main = self.main.clone();
        main.sismember(k, v).await
    }

    /// 使用 RedisKey 向 Set 中添加成员
    pub async fn sadd_key(&self, key: &RedisKey, value: &str) -> redis::RedisResult<()> {
        let key_str = key.build();
        self.sadd(&key_str, value).await
    }

    /// 使用 RedisKey 从 Set 中移除成员
    pub async fn srem_key(&self, key: &RedisKey, value: &str) -> redis::RedisResult<()> {
        let key_str = key.build();
        self.srem(&key_str, value).await
    }

    /// 使用 RedisKey 获取 Set 中的所有成员
    pub async fn smembers_key(&self, key: &RedisKey) -> redis::RedisResult<Vec<String>> {
        let key_str = key.build();
        self.smembers(&key_str).await
    }

    /// 使用 RedisKey 检查成员是否在 Set 中
    pub async fn sismember_key(&self, key: &RedisKey, value: &str) -> redis::RedisResult<bool> {
        let key_str = key.build();
        self.sismember(&key_str, value).await
    }

    // ==================== 计数器操作 ====================

    /// 原子递增键值并返回新值
    pub async fn incr(&self, k: &str) -> redis::RedisResult<u64> {
        let mut main = self.main.clone();
        main.incr(k, 1).await
    }

    /// 获取键的剩余生存时间（秒）
    pub async fn ttl(&self, k: &str) -> redis::RedisResult<i64> {
        let mut main = self.main.clone();
        main.ttl(k).await
    }

    /// 使用 RedisKey 原子递增键值并返回新值
    pub async fn incr_key(&self, key: &RedisKey) -> redis::RedisResult<u64> {
        let key_str = key.build();
        self.incr(&key_str).await
    }

    /// 使用 RedisKey 获取剩余生存时间
    pub async fn ttl_key(&self, key: &RedisKey) -> redis::RedisResult<i64> {
        let key_str = key.build();
        self.ttl(&key_str).await
    }

    // ==================== List 操作 ====================

    /// 向列表左侧推入值
    pub async fn lpush(&self, k: &str, v: &str) -> redis::RedisResult<()> {
        let mut main = self.main.clone();
        main.lpush(k, v).await
    }

    /// 从列表右侧阻塞弹出值（使用 worker 连接）
    pub async fn brpop(&self, k: &str, timeout: u64) -> redis::RedisResult<Option<String>> {
        let mut worker = self.worker.lock().await;
        // 使用 cmd 接口直接发送 BRPOP 命令，确保 timeout 作为整数发送
        let result: redis::RedisResult<Option<(String, String)>> =
            cmd("BRPOP").arg(k).arg(timeout).query_async(&mut *worker).await;
        match result {
            Ok(Some((_, value))) => Ok(Some(value)),
            Ok(None) => Ok(None),
            Err(e) => {
                // 检查是否是连接错误
                if e.kind() == redis::ErrorKind::IoError {
                    warn!("BRPOP 连接错误: {}", e);
                    // 可以选择重新创建 worker 连接
                    match self.client.get_multiplexed_async_connection().await {
                        Ok(new_conn) => {
                            *worker = new_conn;
                            // 重试一次
                            let retry_result: redis::RedisResult<Option<(String, String)>> =
                                cmd("BRPOP").arg(k).arg(timeout).query_async(&mut *worker).await;
                            match retry_result {
                                Ok(Some((_, value))) => Ok(Some(value)),
                                Ok(None) => Ok(None),
                                Err(e) => Err(e),
                            }
                        }
                        Err(e) => Err(e),
                    }
                } else {
                    Err(e)
                }
            }
        }
    }

    /// 获取列表长度
    pub async fn llen(&self, k: &str) -> redis::RedisResult<u64> {
        let mut main = self.main.clone();
        main.llen(k).await
    }

    /// 使用 RedisKey 向列表左侧推入值
    pub async fn lpush_key(&self, key: &RedisKey, value: &str) -> redis::RedisResult<()> {
        let key_str = key.build();
        self.lpush(&key_str, value).await
    }

    /// 使用 RedisKey 从列表右侧阻塞弹出值
    pub async fn brpop_key(&self, key: &RedisKey, timeout: u64) -> redis::RedisResult<Option<String>> {
        let key_str = key.build();
        self.brpop(&key_str, timeout).await
    }

    /// 使用 RedisKey 获取列表长度
    pub async fn llen_key(&self, key: &RedisKey) -> redis::RedisResult<u64> {
        let key_str = key.build();
        self.llen(&key_str).await
    }
}