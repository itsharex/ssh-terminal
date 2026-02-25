//! 下载记录 Repository
//!
//! 管理下载记录的数据库操作

use anyhow::Result;
use r2d2_sqlite::rusqlite::{self, Connection};
use serde::{Deserialize, Serialize};

/// 下载记录状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Completed,
    Failed,
    Cancelled,
}

impl From<&str> for DownloadStatus {
    fn from(s: &str) -> Self {
        match s {
            "pending" => DownloadStatus::Pending,
            "downloading" => DownloadStatus::Downloading,
            "completed" => DownloadStatus::Completed,
            "failed" => DownloadStatus::Failed,
            "cancelled" => DownloadStatus::Cancelled,
            _ => DownloadStatus::Pending,
        }
    }
}

impl DownloadStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            DownloadStatus::Pending => "pending",
            DownloadStatus::Downloading => "downloading",
            DownloadStatus::Completed => "completed",
            DownloadStatus::Failed => "failed",
            DownloadStatus::Cancelled => "cancelled",
        }
    }
}

/// 下载记录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRecord {
    pub id: i64,
    pub task_id: String,
    pub connection_id: String,
    pub user_id: String,
    pub remote_path: String,
    pub local_path: String,
    pub total_files: i64,
    pub total_dirs: i64,
    pub total_size: i64,
    pub status: String,
    pub bytes_transferred: i64,
    pub files_completed: i64,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub elapsed_ms: Option<i64>,
    pub error_message: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 分页结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedDownloadRecords {
    pub records: Vec<DownloadRecord>,
    pub total: u64,
    pub page: u32,
    pub page_size: u32,
}

/// 下载记录 Repository
pub struct DownloadRecordsRepository {
    // 这里暂时不使用连接池，直接使用 Connection
    // 如果需要连接池，可以修改为使用 Arc<r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>>
}

impl DownloadRecordsRepository {
    /// 创建新的下载记录
    pub fn create(conn: &Connection, record: &DownloadRecord) -> Result<i64> {
        conn.execute(
            "INSERT INTO download_records (
                task_id, connection_id, user_id, remote_path, local_path,
                total_files, total_dirs, total_size, status,
                bytes_transferred, files_completed, started_at,
                completed_at, elapsed_ms, error_message,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            rusqlite::params![
                &record.task_id,
                &record.connection_id,
                &record.user_id,
                &record.remote_path,
                &record.local_path,
                record.total_files,
                record.total_dirs,
                record.total_size,
                &record.status,
                record.bytes_transferred,
                record.files_completed,
                record.started_at,
                record.completed_at,
                record.elapsed_ms,
                record.error_message.as_ref().map(|s| s.as_str()),
                record.created_at,
                record.updated_at,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    /// 更新状态
    pub fn update_status(conn: &Connection, task_id: &str, status: DownloadStatus, error_message: Option<String>) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE download_records SET status = ?1, error_message = ?2, updated_at = ?3 WHERE task_id = ?4",
            rusqlite::params![status.as_str(), error_message.as_ref().map(|s| s.as_str()), now, task_id],
        )?;
        Ok(())
    }

    /// 更新进度
    pub fn update_progress(conn: &Connection, task_id: &str, bytes_transferred: i64, files_completed: i64) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE download_records SET bytes_transferred = ?1, files_completed = ?2, updated_at = ?3 WHERE task_id = ?4",
            rusqlite::params![bytes_transferred, files_completed, now, task_id],
        )?;
        Ok(())
    }

    /// 标记完成
    pub fn mark_completed(conn: &Connection, task_id: &str, elapsed_ms: i64, bytes_transferred: i64, files_completed: i64) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE download_records SET status = 'completed', completed_at = ?1, elapsed_ms = ?2, bytes_transferred = ?3, files_completed = ?4, updated_at = ?5 WHERE task_id = ?6",
            rusqlite::params![now, elapsed_ms, bytes_transferred, files_completed, now, task_id],
        )?;
        Ok(())
    }

    /// 标记完成（带统计信息）
    pub fn mark_completed_with_stats(conn: &Connection, task_id: &str, elapsed_ms: i64, bytes_transferred: i64, files_completed: i64, total_files: i64, total_dirs: i64, total_size: i64) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE download_records SET status = 'completed', completed_at = ?1, elapsed_ms = ?2, bytes_transferred = ?3, files_completed = ?4, total_files = ?5, total_dirs = ?6, total_size = ?7, updated_at = ?8 WHERE task_id = ?9",
            rusqlite::params![now, elapsed_ms, bytes_transferred, files_completed, total_files, total_dirs, total_size, now, task_id],
        )?;
        Ok(())
    }

    /// 分页查询
    pub fn list_paginated(conn: &Connection, user_id: &str, page: u32, page_size: u32) -> Result<PaginatedDownloadRecords> {
        let offset = (page - 1) * page_size;

        // 查询总数
        let total: u64 = conn.query_row(
            "SELECT COUNT(*) FROM download_records WHERE user_id = ?1",
            [user_id],
            |row| row.get::<_, i64>(0).map(|v| v as u64),
        )?;

        // 查询记录
        let mut stmt = conn.prepare(
            "SELECT * FROM download_records
             WHERE user_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2 OFFSET ?3"
        )?;

        let records: Result<Vec<DownloadRecord>, _> = stmt.query_map(
            rusqlite::params![user_id, page_size as i64, offset as i64],
        |row| {
            Ok(DownloadRecord {
                id: row.get(0)?,
                task_id: row.get(1)?,
                connection_id: row.get(2)?,
                user_id: row.get(3)?,
                remote_path: row.get(4)?,
                local_path: row.get(5)?,
                total_files: row.get(6)?,
                total_dirs: row.get(7)?,
                total_size: row.get(8)?,
                status: row.get(9)?,
                bytes_transferred: row.get(10)?,
                files_completed: row.get(11)?,
                started_at: row.get(12)?,
                completed_at: row.get(13)?,
                elapsed_ms: row.get(14)?,
                error_message: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            })
        })?.collect();

        Ok(PaginatedDownloadRecords {
            records: records?,
            total,
            page,
            page_size,
        })
    }

    /// 删除记录
    pub fn delete(conn: &Connection, id: i64) -> Result<()> {
        conn.execute("DELETE FROM download_records WHERE id = ?1", [id])?;
        Ok(())
    }

    /// 根据 task_id 删除记录
    pub fn delete_by_task_id(conn: &Connection, task_id: &str) -> Result<()> {
        conn.execute("DELETE FROM download_records WHERE task_id = ?1", [task_id])?;
        Ok(())
    }

    /// 清空所有记录
    pub fn clear_all(conn: &Connection) -> Result<()> {
        conn.execute("DELETE FROM download_records", [])?;
        Ok(())
    }

    /// 批量更新下载记录的 user_id（用于从匿名用户迁移到登录用户）
    /// 这个方法会：
    /// 1. 查找所有属于 old_user_id 的下载记录
    /// 2. 更新 user_id 和时间戳
    /// 3. 标记为需要同步（如果表有 is_dirty 字段）
    pub fn batch_update_user_id(conn: &Connection, old_user_id: &str, new_user_id: &str) -> Result<usize> {
        let now = chrono::Utc::now().timestamp();

        // 获取所有需要迁移的下载记录数量
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM download_records WHERE user_id = ?1",
            [old_user_id],
            |row| row.get(0),
        )?;

        if count == 0 {
            tracing::info!("No download records found for user_id: {}", old_user_id);
            return Ok(0);
        }

        tracing::info!("Migrating {} download records from {} to {}", count, old_user_id, new_user_id);

        // 批量更新所有记录
        let updated_count = conn.execute(
            "UPDATE download_records SET
                user_id = ?1,
                updated_at = ?2
            WHERE user_id = ?3",
            (new_user_id, now, old_user_id),
        )
        .map_err(|e| {
            anyhow::anyhow!(
                "Failed to update download records in database: {}",
                e
            )
        })?;

        tracing::info!("Successfully migrated {} download records", updated_count);
        Ok(updated_count)
    }
}