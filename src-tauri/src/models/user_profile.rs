use serde::{Deserialize, Serialize};

// ==================== Tauri 命令类型（内部使用 snake_case，与前端通信时自动转换为 camelCase）====================

/// 用户资料（Tauri 内部使用 snake_case）
/// 通过 serde(rename_all = "camelCase") 与前端 TypeScript 类型（camelCase）自动转换
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: i64,
    pub user_id: String,
    pub username: Option<String>,
    pub phone: Option<String>,
    pub qq: Option<String>,
    pub wechat: Option<String>,
    pub avatar_data: Option<String>,
    pub avatar_mime_type: Option<String>,
    pub bio: Option<String>,
    pub server_ver: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 用户资料更新请求（Tauri 内部使用 snake_case）
/// 通过 serde(rename_all = "camelCase") 与前端 TypeScript 类型（camelCase）自动转换
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub phone: Option<String>,
    pub qq: Option<String>,
    pub wechat: Option<String>,
    pub avatar_data: Option<String>,
    pub avatar_mime_type: Option<String>,
    pub bio: Option<String>,
}

// ==================== 服务器 API 类型（snake_case，与服务器实际返回格式一致）====================

/// 服务器用户资料（服务器返回的格式，snake_case）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerUserProfile {
    pub id: i64,
    pub user_id: String,
    pub username: Option<String>,
    pub phone: Option<String>,
    pub qq: Option<String>,
    pub wechat: Option<String>,
    pub avatar_data: Option<String>,
    pub avatar_mime_type: Option<String>,
    pub bio: Option<String>,
    pub server_ver: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 服务器用户资料更新请求（发送给服务器的格式，snake_case）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerUpdateProfileRequest {
    pub username: Option<String>,
    pub phone: Option<String>,
    pub qq: Option<String>,
    pub wechat: Option<String>,
    pub avatar_data: Option<String>,
    pub avatar_mime_type: Option<String>,
    pub bio: Option<String>,
}

// ==================== 类型转换 ====================

impl From<ServerUserProfile> for UserProfile {
    fn from(server: ServerUserProfile) -> Self {
        Self {
            id: server.id,
            user_id: server.user_id,
            username: server.username,
            phone: server.phone,
            qq: server.qq,
            wechat: server.wechat,
            avatar_data: server.avatar_data,
            avatar_mime_type: server.avatar_mime_type,
            bio: server.bio,
            server_ver: server.server_ver,
            created_at: server.created_at,
            updated_at: server.updated_at,
        }
    }
}

impl From<UserProfile> for ServerUserProfile {
    fn from(profile: UserProfile) -> Self {
        Self {
            id: profile.id,
            user_id: profile.user_id,
            username: profile.username,
            phone: profile.phone,
            qq: profile.qq,
            wechat: profile.wechat,
            avatar_data: profile.avatar_data,
            avatar_mime_type: profile.avatar_mime_type,
            bio: profile.bio,
            server_ver: profile.server_ver,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
        }
    }
}

impl From<UpdateProfileRequest> for ServerUpdateProfileRequest {
    fn from(req: UpdateProfileRequest) -> Self {
        Self {
            username: req.username,
            phone: req.phone,
            qq: req.qq,
            wechat: req.wechat,
            avatar_data: req.avatar_data,
            avatar_mime_type: req.avatar_mime_type,
            bio: req.bio,
        }
    }
}

// ==================== 本地数据库类型（i64 时间戳）====================

/// 本地用户资料（用于本地 SQLite 存储）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalUserProfile {
    pub id: i64,
    pub user_id: String,
    pub username: Option<String>,
    pub phone: Option<String>,
    pub qq: Option<String>,
    pub wechat: Option<String>,
    pub avatar_data: Option<String>,
    pub avatar_mime_type: Option<String>,
    pub bio: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

// ==================== 类型转换 ====================

impl From<UserProfile> for LocalUserProfile {
    fn from(profile: UserProfile) -> Self {
        Self {
            id: profile.id,
            user_id: profile.user_id,
            username: profile.username,
            phone: profile.phone,
            qq: profile.qq,
            wechat: profile.wechat,
            avatar_data: profile.avatar_data,
            avatar_mime_type: profile.avatar_mime_type,
            bio: profile.bio,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
        }
    }
}

