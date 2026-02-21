use anyhow::Result;
use serde::{Deserialize, Serialize};
use r2d2::PooledConnection;
use r2d2_sqlite::SqliteConnectionManager;

use crate::database::DbPool;

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub server_url: String,
    pub auto_sync_enabled: bool,
    pub sync_interval_minutes: i64,
    pub theme: String,
    pub language: String,
    pub updated_at: i64,
}

/// 应用配置 Repository
pub struct AppSettingsRepository {
    pool: DbPool,
}

impl AppSettingsRepository {
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

    /// 获取默认服务器地址
    pub fn get_server_url(&self) -> Result<String> {
        let conn = self.get_conn()?;

        let server_url: Option<String> = conn.query_row(
            "SELECT default_server_url FROM app_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )?;

        server_url.ok_or_else(|| anyhow::anyhow!("Server URL not configured"))
    }

    /// 更新默认服务器地址
    pub fn set_server_url(&self, server_url: &str) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp().to_string();

        conn.execute(
            "UPDATE app_settings SET default_server_url = ?1, updated_at = ?2 WHERE id = 1",
            [server_url, now.as_str()],
        )?;

        Ok(())
    }

    /// 获取自动同步是否启用
    pub fn get_auto_sync_enabled(&self) -> Result<bool> {
        let conn = self.get_conn()?;

        let enabled: i64 = conn.query_row(
            "SELECT auto_sync_enabled FROM app_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )?;

        Ok(enabled == 1)
    }

    /// 设置自动同步是否启用
    pub fn set_auto_sync_enabled(&self, enabled: bool) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp().to_string();
        let value = if enabled { 1 } else { 0 };

        conn.execute(
            "UPDATE app_settings SET auto_sync_enabled = ?1, updated_at = ?2 WHERE id = 1",
            [value.to_string().as_str(), now.as_str()],
        )?;

        Ok(())
    }

    /// 获取同步间隔（分钟）
    pub fn get_sync_interval(&self) -> Result<i64> {
        let conn = self.get_conn()?;

        let interval: i64 = conn.query_row(
            "SELECT sync_interval_minutes FROM app_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )?;

        Ok(interval)
    }

    /// 设置同步间隔（分钟）
    pub fn set_sync_interval(&self, interval: i64) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp().to_string();

        conn.execute(
            "UPDATE app_settings SET sync_interval_minutes = ?1, updated_at = ?2 WHERE id = 1",
            [interval.to_string().as_str(), now.as_str()],
        )?;

        Ok(())
    }

    /// 获取语言设置
    pub fn get_language(&self) -> Result<String> {
        let conn = self.get_conn()?;

        let language: String = conn.query_row(
            "SELECT language FROM app_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )?;

        Ok(language)
    }

    /// 设置语言
    pub fn set_language(&self, language: &str) -> Result<()> {
        let conn = self.get_conn()?;
        let now = chrono::Utc::now().timestamp().to_string();

        conn.execute(
            "UPDATE app_settings SET language = ?1, updated_at = ?2 WHERE id = 1",
            [language, now.as_str()],
        )?;

        Ok(())
    }

    /// 获取所有应用设置
    pub fn get_all(&self) -> Result<AppSettings> {
        let conn = self.get_conn()?;

        let settings = conn.query_row(
            r#"
            SELECT default_server_url, auto_sync_enabled, sync_interval_minutes, theme, language, updated_at
            FROM app_settings WHERE id = 1
            "#,
            [],
            |row| {
                let server_url: Option<String> = row.get(0)?;
                Ok(AppSettings {
                    server_url: server_url.unwrap_or_default(),
                    auto_sync_enabled: row.get::<_, i64>(1)? == 1,
                    sync_interval_minutes: row.get(2)?,
                    theme: row.get(3)?,
                    language: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )?;

        Ok(settings)
    }
}
