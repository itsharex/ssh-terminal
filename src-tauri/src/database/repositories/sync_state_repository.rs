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

    /// 获取同步状态
    pub fn get(&self) -> Result<SyncStatus> {
        let conn = self.get_conn()?;

        let mut stmt = conn.prepare(
            "SELECT last_sync_at, pending_count, conflict_count, last_error FROM sync_state WHERE id = 1"
        )?;

        let mut rows = stmt.query([])?;

        if let Some(row) = rows.next()? {
            Ok(SyncStatus {
                last_sync_at: row.get(0)?,
                pending_count: row.get(1)?,
                conflict_count: row.get(2)?,
                last_error: row.get(3)?,
            })
        } else {
            // 返回默认状态
            Ok(SyncStatus {
                last_sync_at: None,
                pending_count: 0,
                conflict_count: 0,
                last_error: None,
            })
        }
    }

    /// 确保记录存在（如果不存在则插入默认记录）
    fn ensure_record_exists(&self) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "INSERT INTO sync_state (id, last_sync_at, pending_count, conflict_count, last_error)
            SELECT 1, NULL, 0, 0, NULL
            WHERE NOT EXISTS (SELECT 1 FROM sync_state WHERE id = 1)",
            [],
        )?;
        Ok(())
    }

    /// 更新同步状态
    pub fn update(&self, status: &SyncStatus) -> Result<()> {
        let conn = self.get_conn()?;

        conn.execute(
            "INSERT OR REPLACE INTO sync_state (id, last_sync_at, pending_count, conflict_count, last_error)
            VALUES (1, ?1, ?2, ?3, ?4)",
            (&status.last_sync_at, &status.pending_count, &status.conflict_count, &status.last_error),
        )?;

        Ok(())
    }

    /// 更新最后同步时间
    pub fn update_last_sync(&self, last_sync_at: i64) -> Result<()> {
        // 先确保记录存在
        self.ensure_record_exists()?;
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE sync_state SET last_sync_at = ?1 WHERE id = 1",
            [last_sync_at],
        )?;
        Ok(())
    }

    /// 更新待同步数量
    pub fn update_pending_count(&self, count: i32) -> Result<()> {
        self.ensure_record_exists()?;
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE sync_state SET pending_count = ?1 WHERE id = 1",
            [count],
        )?;
        Ok(())
    }

    /// 更新冲突数量
    pub fn update_conflict_count(&self, count: i32) -> Result<()> {
        self.ensure_record_exists()?;
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE sync_state SET conflict_count = ?1 WHERE id = 1",
            [count],
        )?;
        Ok(())
    }

    /// 更新最后错误
    pub fn update_last_error(&self, error: Option<String>) -> Result<()> {
        self.ensure_record_exists()?;
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE sync_state SET last_error = ?1 WHERE id = 1",
            [&error],
        )?;
        Ok(())
    }

    /// 增加待同步数量
    pub fn increment_pending(&self) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE sync_state SET pending_count = pending_count + 1 WHERE id = 1",
            [],
        )?;
        Ok(())
    }

    /// 减少待同步数量
    pub fn decrement_pending(&self) -> Result<()> {
        let conn = self.get_conn()?;
        conn.execute(
            "UPDATE sync_state SET pending_count = MAX(0, pending_count - 1) WHERE id = 1",
            [],
        )?;
        Ok(())
    }
}

