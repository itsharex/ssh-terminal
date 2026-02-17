use anyhow::Result;
use r2d2::PooledConnection;
use r2d2_sqlite::{rusqlite, SqliteConnectionManager};
use chrono::TimeZone;

use crate::database::DbPool;
use crate::models::user_profile::{UserProfile, LocalUserProfile, UpdateProfileRequest};

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

    /// 保存或更新用户资料（接收服务器返回的 UserProfile）
    pub fn save(&self, profile: &UserProfile) -> Result<UserProfile> {
        // 转换为 LocalUserProfile 保存到数据库
        let local: LocalUserProfile = profile.clone().into();
        self.save_local(&local)?;
        Ok(profile.clone())
    }

    /// 保存或更新本地用户资料
    pub fn save_local(&self, profile: &LocalUserProfile) -> Result<LocalUserProfile> {
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

    /// 根据 user_id 获取本地用户资料
    pub fn find_by_user_id_local(&self, user_id: &str) -> Result<Option<LocalUserProfile>> {
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
            Ok(Some(self.row_to_local_profile(row)?))
        } else {
            Ok(None)
        }
    }

    /// 根据 user_id 获取用户资料（返回服务器格式，模拟）
    pub fn find_by_user_id(&self, user_id: &str) -> Result<Option<UserProfile>> {
        // 从数据库获取本地格式
        if let Some(local) = self.find_by_user_id_local(user_id)? {
            // 转换为服务器格式
            Ok(Some(UserProfile {
                id: local.id,
                user_id: local.user_id,
                username: local.username,
                phone: local.phone,
                qq: local.qq,
                wechat: local.wechat,
                avatar_data: local.avatar_data,
                avatar_mime_type: local.avatar_mime_type,
                bio: local.bio,
                server_ver: 0,  // 本地数据没有 server_ver，默认为 0
                created_at: local.created_at,
                updated_at: local.updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    /// 更新用户资料
    pub fn update(&self, user_id: &str, req: &UpdateProfileRequest) -> Result<UserProfile> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        // 先获取现有资料
        let existing = self.find_by_user_id_local(user_id)?;
        let created_at = existing.as_ref().map(|p| p.created_at).unwrap_or(now);
        let id = existing.as_ref().map(|p| p.id).unwrap_or(0);

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

    /// 将数据库行转换为 LocalUserProfile
    fn row_to_local_profile(&self, row: &rusqlite::Row) -> Result<LocalUserProfile> {
        Ok(LocalUserProfile {
            id: row.get(0)?,
            user_id: row.get(1)?,
            username: row.get(2)?,
            phone: row.get(3)?,
            qq: row.get(4)?,
            wechat: row.get(5)?,
            avatar_data: row.get(6)?,
            avatar_mime_type: row.get(7)?,
            bio: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    }
}
