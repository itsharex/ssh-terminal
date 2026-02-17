use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ==================== 客户端类型（用于 Tauri 命令） ====================

/// 同步请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRequest {
    pub sessions: Option<Vec<crate::models::SshSession>>,
    pub last_sync_at: Option<i64>,
    pub device_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_profile: Option<crate::models::UserProfile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_session_ids: Option<Vec<String>>,
    /// 指定需要同步的实体类型（用于服务器端 sync/pull 请求）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity_types: Option<Vec<String>>,
}

/// 同步报告
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub success: bool,
    pub last_sync_at: i64,
    pub pushed_sessions: usize,
    pub pulled_sessions: usize,
    pub conflict_count: usize,
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_session_ids: Option<Vec<String>>,
}

/// 同步状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub last_sync_at: Option<i64>,
    pub pending_count: i32,
    pub conflict_count: i32,
    pub last_error: Option<String>,
}

/// 冲突信息（客户端格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictInfo {
    pub id: String,
    pub entity_type: String,
    pub local_version: i32,
    pub server_version: i32,
    pub message: String,
}

/// 冲突解决策略
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConflictStrategy {
    KeepBoth,   // 保留两个版本
    KeepServer, // 保留服务器版本
    KeepLocal,  // 保留本地版本
}

impl Default for ConflictStrategy {
    fn default() -> Self {
        ConflictStrategy::KeepBoth
    }
}

/// 冲突解决请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveConflictRequest {
    pub conflict_id: String,
    pub strategy: ConflictStrategy,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_data: Option<serde_json::Value>,
}

// ==================== 服务器返回类型（服务器使用 camelCase 序列化）====================

/// 服务器 Pull 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerPullResponse {
    pub server_time: i64,
    pub last_sync_at: i64,
    pub user_profile: Option<crate::models::UserProfile>,
    pub ssh_sessions: Vec<crate::models::ServerSshSession>,
    pub deleted_session_ids: Vec<String>,
    pub conflicts: Vec<ServerConflictInfo>,
}

/// 服务器 Push 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerPushResponse {
    pub updated_session_ids: Vec<String>,
    pub deleted_session_ids: Vec<String>,
    pub server_versions: HashMap<String, i32>,
    pub conflicts: Vec<ServerConflictInfo>,
    pub last_sync_at: i64,
}

/// 服务器冲突信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConflictInfo {
    pub id: String,
    pub entity_type: String,
    pub client_ver: i32,
    pub server_ver: i32,
    pub client_data: Option<serde_json::Value>,
    pub server_data: Option<serde_json::Value>,
    pub message: String,
}

/// 服务器解决冲突响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerResolveConflictResponse {
    pub conflict_id: String,
    pub resolved: bool,
    pub new_id: Option<String>,
    pub message: String,
}

// ==================== 内部同步响应（合并服务端结果）====================

/// 内部同步响应（用于合并 pull 和 push 的结果）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponse {
    pub status: String,
    pub server_time: i64,
    pub last_sync_at: i64,

    // 更新的数据
    pub upserted_sessions: Vec<crate::models::SshSession>,

    // 删除的 ID
    pub deleted_session_ids: Vec<String>,

    // 推送统计
    pub pushed_sessions: usize,
    pub pushed_total: usize,

    // 拉取统计
    pub pulled_sessions: usize,
    pub pulled_total: usize,

    // 冲突信息
    pub conflicts: Vec<ConflictInfo>,
}
