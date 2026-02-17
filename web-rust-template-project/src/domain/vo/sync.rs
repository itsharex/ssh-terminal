use serde::{Deserialize, Serialize};

/// Pull 响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullResponse {
    /// 服务器时间（Unix 时间戳，秒）
    pub server_time: i64,
    
    /// 最后同步时间
    pub last_sync_at: i64,
    
    /// 用户资料（如果有）
    pub user_profile: Option<super::user::UserProfileVO>,
    
    /// SSH 会话列表
    pub ssh_sessions: Vec<super::ssh::SshSessionVO>,
    
    /// 删除的会话 ID
    pub deleted_session_ids: Vec<String>,
    
    /// 需要解决的冲突
    pub conflicts: Vec<ConflictInfo>,
}

/// Push 响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushResponse {
    /// 成功更新的会话 ID
    pub updated_session_ids: Vec<String>,
    
    /// 成功删除的会话 ID
    pub deleted_session_ids: Vec<String>,
    
    /// 服务器版本号映射（id -> server_ver）
    pub server_versions: std::collections::HashMap<String, i32>,
    
    /// 冲突信息
    pub conflicts: Vec<ConflictInfo>,
    
    /// 最后同步时间
    pub last_sync_at: i64,
}

/// 冲突信息
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConflictInfo {
    pub id: String,
    pub entity_type: String,  // "user_profile", "ssh_session"
    pub client_ver: i32,
    pub server_ver: i32,
    pub client_data: Option<serde_json::Value>,
    pub server_data: Option<serde_json::Value>,
    pub message: String,
}

/// 解决冲突响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveConflictResponse {
    pub conflict_id: String,
    pub resolved: bool,
    pub new_id: Option<String>,
    pub message: String,
}
