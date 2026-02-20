use anyhow::Result;
use r2d2::PooledConnection;
use r2d2_sqlite::{rusqlite, SqliteConnectionManager};

use crate::database::DbPool;
use crate::models::user_profile::{UserProfile, UpdateProfileRequest};

/// 用户资料 Repository
pub struct UserProfileRepository {
    pool: DbPool,
}

impl UserProfileRepository {
    /// 创建新的 Repository 实例
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// 获取数据库连接
    fn get_conn(&self) -> Result<PooledConnection<SqliteConnectionManager>> {
        self.pool
            .get()
            .map_err(|e| anyhow::anyhow!("Failed to get database connection: {}", e))
    }

    /// 保存或更新用户资料
    pub fn save(&self, profile: &UserProfile) -> Result<UserProfile> {
        let conn = self.get_conn()?;

        conn.execute(
            "INSERT INTO user_profiles (
                user_id, username, phone, qq, wechat,
                avatar_data, avatar_mime_type, bio, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                phone = excluded.phone,
                qq = excluded.qq,
                wechat = excluded.wechat,
                avatar_data = excluded.avatar_data,
                avatar_mime_type = excluded.avatar_mime_type,
                bio = excluded.bio,
                updated_at = excluded.updated_at",
            (
                &profile.user_id,
                &profile.username,
                &profile.phone,
                &profile.qq,
                &profile.wechat,
                &profile.avatar_data,
                &profile.avatar_mime_type,
                &profile.bio,
                profile.created_at,
                profile.updated_at,
            ),
        )?;

        Ok(profile.clone())
    }

    /// 根据 user_id 获取用户资料
    pub fn find_by_user_id(&self, user_id: &str) -> Result<Option<UserProfile>> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            "SELECT
                id, user_id, username, phone, qq, wechat,
                avatar_data, avatar_mime_type, bio, created_at, updated_at
            FROM user_profiles
            WHERE user_id = ?1"
        )?;

        let mut rows = stmt.query([user_id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(UserProfile {
                id: row.get(0)?,
                user_id: row.get(1)?,
                username: row.get(2)?,
                phone: row.get(3)?,
                qq: row.get(4)?,
                wechat: row.get(5)?,
                avatar_data: row.get(6)?,
                avatar_mime_type: row.get(7)?,
                bio: row.get(8)?,
                server_ver: 0,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// 更新用户资料
    pub fn update(&self, user_id: &str, req: &UpdateProfileRequest) -> Result<UserProfile> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        tracing::info!("[UserProfileRepository] 开始更新用户资料: user_id={}", user_id);

        // 先获取现有资料
        let existing = self.find_by_user_id(user_id)?;
        let created_at = existing.as_ref().map(|p| p.created_at).unwrap_or(now);

        conn.execute(
            "INSERT INTO user_profiles (
                user_id, username, phone, qq, wechat,
                avatar_data, avatar_mime_type, bio, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(user_id) DO UPDATE SET
                username = COALESCE(excluded.username, username),
                phone = COALESCE(excluded.phone, phone),
                qq = COALESCE(excluded.qq, qq),
                wechat = COALESCE(excluded.wechat, wechat),
                avatar_data = COALESCE(excluded.avatar_data, avatar_data),
                avatar_mime_type = COALESCE(excluded.avatar_mime_type, avatar_mime_type),
                bio = COALESCE(excluded.bio, bio),
                updated_at = excluded.updated_at",
            (
                user_id,
                &req.username,
                &req.phone,
                &req.qq,
                &req.wechat,
                &req.avatar_data,
                &req.avatar_mime_type,
                &req.bio,
                created_at,
                now,
            ),
        )?;

        tracing::info!("[UserProfileRepository] 数据库更新成功");

        // 返回更新后的资料
        self.find_by_user_id(user_id)?
            .ok_or_else(|| anyhow::anyhow!("Failed to retrieve updated profile"))
    }

    /// 删除用户资料
    pub fn delete(&self, user_id: &str) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute("DELETE FROM user_profiles WHERE user_id = ?1", [user_id])?;
        Ok(())
    }
}
