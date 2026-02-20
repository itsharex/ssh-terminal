use anyhow::Result;
use r2d2::PooledConnection;
use r2d2_sqlite::SqliteConnectionManager;

use crate::database::DbPool;
use crate::models::sync::*;

/// 同步状态 Repository
pub struct SyncStateRepository {
    pool: DbPool,
}

impl SyncStateRepository {
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

    /// 获取指定用户的同步状态
    pub fn get(&self, user_id: &str) -> Result<SyncStatus> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            "SELECT user_id, last_sync_at, pending_count, conflict_count, last_error FROM sync_state WHERE user_id = ?1"
        )?;

        let mut rows = stmt.query([user_id])?;

        if let Some(row) = rows.next()? {
            Ok(SyncStatus {
                user_id: row.get(0)?,
                last_sync_at: row.get(1)?,
                pending_count: row.get(2)?,
                conflict_count: row.get(3)?,
                last_error: row.get(4)?,
            })
        } else {
            // 返回默认状态
            Ok(SyncStatus {
                user_id: user_id.to_string(),
                last_sync_at: None,
                pending_count: 0,
                conflict_count: 0,
                last_error: None,
            })
        }
    }

    /// 更新同步状态
    pub fn update(&self, status: &SyncStatus) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO sync_state (user_id, last_sync_at, pending_count, conflict_count, last_error, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(user_id) DO UPDATE SET
                last_sync_at = excluded.last_sync_at,
                pending_count = excluded.pending_count,
                conflict_count = excluded.conflict_count,
                last_error = excluded.last_error,
                updated_at = excluded.updated_at",
            (
                &status.user_id,
                &status.last_sync_at,
                status.pending_count,
                status.conflict_count,
                &status.last_error,
                now,
                now,
            ),
        )?;

        Ok(())
    }

    /// 更新最后同步时间
    pub fn update_last_sync(&self, user_id: &str, last_sync_at: i64) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO sync_state (user_id, last_sync_at, pending_count, conflict_count, last_error, created_at, updated_at)
            VALUES (?1, ?2, 0, 0, NULL, ?3, ?3)
            ON CONFLICT(user_id) DO UPDATE SET
                last_sync_at = excluded.last_sync_at,
                updated_at = excluded.updated_at",
            (user_id, last_sync_at, now),
        )?;
        Ok(())
    }

    /// 更新待同步数量
    pub fn update_pending_count(&self, user_id: &str, count: i32) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO sync_state (user_id, last_sync_at, pending_count, conflict_count, last_error, created_at, updated_at)
            VALUES (?1, NULL, ?2, 0, NULL, ?3, ?3)
            ON CONFLICT(user_id) DO UPDATE SET
                pending_count = excluded.pending_count,
                updated_at = excluded.updated_at",
            (user_id, count, now),
        )?;
        Ok(())
    }

    /// 更新冲突数量
    pub fn update_conflict_count(&self, user_id: &str, count: i32) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO sync_state (user_id, last_sync_at, pending_count, conflict_count, last_error, created_at, updated_at)
            VALUES (?1, NULL, 0, ?2, NULL, ?3, ?3)
            ON CONFLICT(user_id) DO UPDATE SET
                conflict_count = excluded.conflict_count,
                updated_at = excluded.updated_at",
            (user_id, count, now),
        )?;
        Ok(())
    }

    /// 更新最后错误
    pub fn update_last_error(&self, user_id: &str, error: Option<String>) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO sync_state (user_id, last_sync_at, pending_count, conflict_count, last_error, created_at, updated_at)
            VALUES (?1, NULL, 0, 0, ?2, ?3, ?3)
            ON CONFLICT(user_id) DO UPDATE SET
                last_error = excluded.last_error,
                updated_at = excluded.updated_at",
            (user_id, &error, now),
        )?;
        Ok(())
    }

    /// 增加待同步数量
    pub fn increment_pending(&self, user_id: &str) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO sync_state (user_id, last_sync_at, pending_count, conflict_count, last_error, created_at, updated_at)
            VALUES (?1, NULL, 1, 0, NULL, ?2, ?2)
            ON CONFLICT(user_id) DO UPDATE SET
                pending_count = pending_count + 1,
                updated_at = excluded.updated_at",
            (user_id, now),
        )?;
        Ok(())
    }

    /// 减少待同步数量
    pub fn decrement_pending(&self, user_id: &str) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT INTO sync_state (user_id, last_sync_at, pending_count, conflict_count, last_error, created_at, updated_at)
            VALUES (?1, NULL, 0, 0, NULL, ?2, ?2)
            ON CONFLICT(user_id) DO UPDATE SET
                pending_count = MAX(0, pending_count - 1),
                updated_at = excluded.updated_at",
            (user_id, now),
        )?;
        Ok(())
    }
}

