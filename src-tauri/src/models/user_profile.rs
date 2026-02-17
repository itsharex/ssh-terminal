use serde::{Deserialize, Serialize};

// ==================== 服务端返回类型（实际返回 snake_case）====================

/// 用户资料 VO（来自服务器的响应，snake_case 格式）
/// 对应 ApiResponse<UserProfileVO> 中的 data 字段
#[derive(Debug, Clone, Serialize, Deserialize)]
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

// ==================== 请求类型（发送给服务端）====================

/// 用户资料更新请求（camelCase 格式）
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

