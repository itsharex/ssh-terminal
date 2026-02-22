use serde::{Deserialize, Serialize};

/// 邮件发送结果
#[derive(Debug, Serialize, Deserialize)]
pub struct EmailResult {
    /// 是否成功入队
    pub queued: bool,
}

impl EmailResult {
    pub fn success() -> Self {
        Self {
            queued: true,
        }
    }
}

/// 邮件状态视图对象
#[derive(Debug, Serialize, Deserialize)]
pub struct EmailStatusVO {
    /// 邮件日志 ID
    pub id: String,
    /// 用户 ID
    pub user_id: String,
    /// 收件人邮箱地址
    pub email: String,
    /// 邮件模板名称
    pub template: String,
    /// 邮件状态
    pub status: String,
    /// 错误消息
    pub error_message: Option<String>,
    /// 重试次数
    pub retry_count: u8,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

/// 邮件队列状态视图对象
#[derive(Debug, Serialize, Deserialize)]
pub struct EmailQueueStatusVO {
    /// 待发送队列长度
    pub queue_length: u64,
    /// 死信队列长度
    pub dead_letter_length: u64,
    /// 是否启用邮件功能
    pub enabled: bool,
}