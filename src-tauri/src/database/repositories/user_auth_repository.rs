use anyhow::Result;
use r2d2::PooledConnection;
use r2d2_sqlite::{rusqlite, SqliteConnectionManager};

use crate::database::DbPool;
use crate::models::user_auth::*;

/// 用户认证 Repository
pub struct UserAuthRepository {
    pool: DbPool,
}

impl UserAuthRepository {
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

    /// 保存用户认证信息（包括加密密码）
    pub fn save(&self, auth: &UserAuth) -> Result<UserAuth> {
        let conn = self.get_conn()?;

        conn.execute(
            "INSERT INTO user_auth (
                user_id, server_url, email, password_encrypted, password_nonce,
                access_token_encrypted, refresh_token_encrypted, token_expires_at, device_id,
                last_sync_at, is_current, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            ON CONFLICT(user_id) DO UPDATE SET
                server_url = excluded.server_url,
                email = excluded.email,
                password_encrypted = excluded.password_encrypted,
                password_nonce = excluded.password_nonce,
                access_token_encrypted = excluded.access_token_encrypted,
                refresh_token_encrypted = excluded.refresh_token_encrypted,
                token_expires_at = excluded.token_expires_at,
                device_id = excluded.device_id,
                last_sync_at = excluded.last_sync_at,
                is_current = excluded.is_current,
                updated_at = excluded.updated_at",
            (
                &auth.user_id,
                &auth.server_url,
                &auth.email,
                &auth.password_encrypted,
                &auth.password_nonce,
                &auth.access_token_encrypted,
                &auth.refresh_token_encrypted,
                auth.token_expires_at,
                &auth.device_id,
                auth.last_sync_at,
                auth.is_current as i32,
                auth.created_at,
                auth.updated_at,
            ),
        )?;

        Ok(auth.clone())
    }

    /// 获取当前用户认证信息（不包含密码加密字段，用于前端）
    pub fn find_current(&self) -> Result<Option<UserAuth>> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            "SELECT
                id, user_id, server_url, email, password_encrypted, password_nonce,
                access_token_encrypted, refresh_token_encrypted, token_expires_at, device_id,
                last_sync_at, is_current, created_at, updated_at
            FROM user_auth
            WHERE is_current = 1
            LIMIT 1"
        )?;

        let mut rows = stmt.query([])?;

        if let Some(row) = rows.next()? {
            Ok(Some(self.row_to_auth(row)?))
        } else {
            Ok(None)
        }
    }

    /// 获取当前用户的加密密码和 nonce（用于内部登录使用）
    pub fn find_current_credentials(&self) -> Result<Option<(String, String)>> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            "SELECT password_encrypted, password_nonce
            FROM user_auth
            WHERE is_current = 1
            LIMIT 1"
        )?;

        let mut rows = stmt.query([])?;

        if let Some(row) = rows.next()? {
            Ok(Some((row.get(0)?, row.get(1)?)))
        } else {
            Ok(None)
        }
    }

    /// 根据 user_id 获取用户认证信息
    pub fn find_by_user_id(&self, user_id: &str) -> Result<Option<UserAuth>> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            "SELECT
                id, user_id, server_url, email, password_encrypted, password_nonce,
                access_token_encrypted, refresh_token_encrypted, token_expires_at, device_id,
                last_sync_at, is_current, created_at, updated_at
            FROM user_auth
            WHERE user_id = ?1"
        )?;

        let mut rows = stmt.query([user_id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(self.row_to_auth(row)?))
        } else {
            Ok(None)
        }
    }

    /// 根据 user_id 和邮箱获取用户认证信息（用于登录验证）
    pub fn find_by_email(&self, email: &str) -> Result<Option<UserAuth>> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            "SELECT
                id, user_id, server_url, email, password_encrypted, password_nonce,
                access_token_encrypted, refresh_token_encrypted, token_expires_at, device_id,
                last_sync_at, is_current, created_at, updated_at
            FROM user_auth
            WHERE email = ?1"
        )?;

        let mut rows = stmt.query([email])?;

        if let Some(row) = rows.next()? {
            Ok(Some(self.row_to_auth(row)?))
        } else {
            Ok(None)
        }
    }

    /// 获取所有用户账号
    pub fn find_all(&self) -> Result<Vec<UserAuth>> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            "SELECT
                id, user_id, server_url, email, password_encrypted, password_nonce,
                access_token_encrypted, refresh_token_encrypted, token_expires_at, device_id,
                last_sync_at, is_current, created_at, updated_at
            FROM user_auth
            ORDER BY created_at DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<i64>>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, Option<i64>>(10)?,
                row.get::<_, i32>(11)?,
                row.get::<_, i64>(12)?,
                row.get::<_, i64>(13)?,
            ))
        })?;

        let mut auths = Vec::new();
        for row in rows {
            let (
                id, user_id, server_url, email, password_encrypted, password_nonce,
                access_token_encrypted, refresh_token_encrypted, token_expires_at, device_id,
                last_sync_at, is_current, created_at, updated_at,
            ) = row?;

            auths.push(UserAuth {
                id,
                user_id,
                server_url,
                email,
                password_encrypted,
                password_nonce,
                access_token_encrypted,
                refresh_token_encrypted,
                token_expires_at,
                device_id,
                last_sync_at,
                is_current: is_current != 0,
                created_at,
                updated_at,
            });
        }

        Ok(auths)
    }

    /// 切换当前账号
    pub fn switch_account(&self, user_id: &str) -> Result<()> {
        let conn = self.get_conn()?;

        // 清除所有 is_current 标记
        conn.execute("UPDATE user_auth SET is_current = 0", [])?;

        // 设置新的当前账号
        conn.execute(
            "UPDATE user_auth SET is_current = 1 WHERE user_id = ?1",
            [user_id],
        )?;

        Ok(())
    }

    /// 清除当前账号状态（登出）
    pub fn clear_current(&self) -> Result<()> {
        let conn = self.get_conn()?;

        conn.execute("UPDATE user_auth SET is_current = 0", [])?;

        Ok(())
    }

    /// 删除用户认证信息
    pub fn delete(&self, user_id: &str) -> Result<()> {
        let conn = self.get_conn()?;

        conn.execute("DELETE FROM user_auth WHERE user_id = ?1", [user_id])?;

        Ok(())
    }

    /// 更新 Token
    pub fn update_token(
        &self,
        user_id: &str,
        access_token_encrypted: &str,
        refresh_token_encrypted: Option<&str>,
        expires_at: i64,
    ) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE user_auth SET
                access_token_encrypted = ?1,
                refresh_token_encrypted = ?2,
                token_expires_at = ?3,
                updated_at = ?4
            WHERE user_id = ?5",
            (
                access_token_encrypted,
                refresh_token_encrypted,
                expires_at,
                now,
                user_id,
            ),
        )?;

        Ok(())
    }

    /// 更新最后同步时间
    pub fn update_last_sync(&self, user_id: &str, sync_time: i64) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "UPDATE user_auth SET last_sync_at = ?1, updated_at = ?2 WHERE user_id = ?3",
            (sync_time, now, user_id),
        )?;

        Ok(())
    }

    /// 将数据库行转换为 UserAuth
    fn row_to_auth(&self, row: &rusqlite::Row) -> Result<UserAuth> {
        Ok(UserAuth {
            id: row.get(0)?,
            user_id: row.get(1)?,
            server_url: row.get(2)?,
            email: row.get(3)?,
            password_encrypted: row.get(4)?,
            password_nonce: row.get(5)?,
            access_token_encrypted: row.get(6)?,
            refresh_token_encrypted: row.get(7)?,
            token_expires_at: row.get(8)?,
            device_id: row.get(9)?,
            last_sync_at: row.get(10)?,
            is_current: row.get::<_, i32>(11)? != 0,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    }
}
