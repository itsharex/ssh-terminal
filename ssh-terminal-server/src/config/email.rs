use serde::Deserialize;

/// 邮件配置
#[derive(Debug, Deserialize, Clone)]
pub struct EmailConfig {
    /// 是否启用邮件功能
    #[serde(default = "default_enabled")]
    pub enabled: bool,

    /// SMTP 服务器地址
    pub smtp_host: String,

    /// SMTP 服务器端口
    pub smtp_port: u16,

    /// SMTP 用户名
    pub smtp_username: String,

    /// SMTP 密码
    pub smtp_password: String,

    /// 发件人名称
    pub from_name: String,

    /// 发件人邮箱地址
    pub from_email: String,

    /// Worker 连接池大小
    #[serde(default = "default_worker_pool_size")]
    pub worker_pool_size: usize,

    /// Worker 阻塞超时时间（秒）
    #[serde(default = "default_worker_timeout")]
    pub worker_timeout_seconds: u64,
}

fn default_enabled() -> bool {
    false
}

fn default_worker_pool_size() -> usize {
    5
}

fn default_worker_timeout() -> u64 {
    10
}