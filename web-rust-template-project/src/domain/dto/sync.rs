use serde::{Deserialize, Serialize};
use validator::Validate;

/// Pull 请求
#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct PullRequest {
    /// 最后同步时间（Unix 时间戳，秒）
    pub last_sync_at: Option<i64>,
    
    /// 设备 ID
    #[validate(length(min = 1))]
    pub device_id: String,
    
    /// 指定需要拉取的实体类型
    pub entity_types: Vec<String>,
}

/// Push 请求
#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct PushRequest {
    /// 设备 ID
    #[validate(length(min = 1))]
    pub device_id: String,
    
    /// 用户资料更新（可选）
    pub user_profile: Option<UpdateProfileRequest>,
    
    /// SSH 会话更新
    pub ssh_sessions: Vec<SshSessionPushItem>,
    
    /// 删除的会话 ID
    pub deleted_session_ids: Vec<String>,
}

/// SSH 会话推送项
#[derive(Debug, Deserialize, Validate, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SshSessionPushItem {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub group_name: String,
    pub terminal_type: Option<String>,
    pub columns: Option<u16>,
    pub rows: Option<u16>,
    pub auth_method_encrypted: String,
    pub auth_nonce: String,
    pub auth_key_salt: Option<String>,
    pub client_ver: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 更新用户资料请求
#[derive(Debug, Deserialize, Validate, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub phone: Option<String>,
    pub qq: Option<String>,
    pub wechat: Option<String>,
    pub bio: Option<String>,
    pub avatar_data: Option<String>,
    pub avatar_mime_type: Option<String>,
}

/// 解决冲突请求
#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct ResolveConflictRequest {
    /// 冲突 ID
    #[validate(length(min = 1))]
    pub conflict_id: String,
    
    /// 解决策略
    pub strategy: ConflictStrategy,
    
    /// 仅在 KeepLocal 时使用：客户端数据
    pub client_data: Option<serde_json::Value>,
}

/// 冲突解决策略
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictStrategy {
    KeepServer,  // 保留服务器版本
    KeepLocal,   // 保留客户端版本
    KeepBoth,    // 保留两个版本（创建副本）
}
