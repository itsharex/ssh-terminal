use serde::{Deserialize, Serialize};

// ==================== 服务器返回类型（snake_case 格式）====================

/// 服务器 SSH 会话（用于与服务器通信，snake_case 格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerSshSession {
    pub id: String,
    pub user_id: String,

    // 基本信息
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub group_name: String,
    pub terminal_type: Option<String>,
    pub columns: Option<u16>,
    pub rows: Option<u16>,

    // 认证信息（加密存储）
    pub auth_method_encrypted: String,
    pub auth_nonce: String,
    pub auth_key_salt: Option<String>,

    // 同步字段
    pub server_ver: i32,
    pub client_ver: i32,
    pub last_synced_at: Option<i64>,

    // 时间戳（i64 unix 时间戳，来自服务器）
    pub created_at: i64,
    pub updated_at: i64,
}

// ==================== 本地类型（用于数据库）====================

/// SSH 认证方法
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthMethod {
    /// 密码认证
    Password { password: String },
    /// 私钥认证
    PrivateKey {
        private_key_path: String,
        passphrase: Option<String>,
        key_data: Option<String>,
    },
}

/// SSH 会话配置（用于本地数据库）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshSession {
    pub id: String,
    pub user_id: String,

    // 基本信息
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub group_name: String,
    pub terminal_type: Option<String>,
    pub columns: Option<u16>,
    pub rows: Option<u16>,

    // 认证信息（加密存储）
    pub auth_method_encrypted: String,
    pub auth_nonce: String,  // 服务器返回的是非空字符串
    pub auth_key_salt: Option<String>,

    // 同步字段
    pub server_ver: i32,
    pub client_ver: i32,  // 客户端版本号
    pub is_dirty: bool,
    pub last_synced_at: Option<i64>,

    // 时间戳
    pub is_deleted: bool,
    pub deleted_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// SSH 会话创建请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSshSessionRequest {
    pub user_id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default = "default_group_name")]
    pub group_name: String,
    pub terminal_type: Option<String>,
    pub columns: Option<u16>,
    pub rows: Option<u16>,
    pub auth_method: AuthMethod,
}

/// SSH 会话更新请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSshSessionRequest {
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub group_name: Option<String>,
    pub terminal_type: Option<String>,
    pub columns: Option<u16>,
    pub rows: Option<u16>,
    pub auth_method: Option<AuthMethod>,
}

fn default_group_name() -> String {
    "默认分组".to_string()
}

// ==================== 类型转换 ====================

impl From<ServerSshSession> for SshSession {
    fn from(server: ServerSshSession) -> Self {
        Self {
            id: server.id,
            user_id: server.user_id,
            name: server.name,
            host: server.host,
            port: server.port,
            username: server.username,
            group_name: server.group_name,
            terminal_type: server.terminal_type,
            columns: server.columns,
            rows: server.rows,
            auth_method_encrypted: server.auth_method_encrypted,
            auth_nonce: server.auth_nonce,
            auth_key_salt: server.auth_key_salt,
            server_ver: server.server_ver,
            client_ver: server.client_ver,
            is_dirty: false,
            last_synced_at: server.last_synced_at,
            is_deleted: false,
            deleted_at: None,
            created_at: server.created_at,
            updated_at: server.updated_at,
        }
    }
}
