use serde::{Deserialize, Serialize};
use std::fmt;

/// 邮件任务数据传输对象
/// 用于在 Redis 队列中传输邮件任务
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailTaskDto {
    /// 收件人邮箱地址
    pub to: String,
    /// 邮件模板名称（如：verify_code、welcome）
    pub template: String,
    /// 语言代码（zh-CN 或 en）
    pub lang: String,
    /// 模板变量数据
    pub data: serde_json::Value,
    /// 当前重试次数
    pub retry: u8,
}

impl fmt::Display for MailTaskDto {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "MailTaskDto {{ to: {}, template: {}, lang: {}, retry: {} }}",
            self.to, self.template, self.lang, self.retry
        )
    }
}

/// 发送验证码请求
#[derive(Deserialize)]
pub struct SendVerifyCodeRequest {
    /// 邮箱地址
    pub email: String,
}

impl fmt::Debug for SendVerifyCodeRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SendVerifyCodeRequest {{ email: {} }}", self.email)
    }
}

/// 查询最新邮件日志请求
#[derive(Deserialize)]
pub struct GetLatestEmailLogRequest {
    /// 邮箱地址
    pub email: String,
}

impl fmt::Debug for GetLatestEmailLogRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "GetLatestEmailLogRequest {{ email: {} }}", self.email)
    }
}