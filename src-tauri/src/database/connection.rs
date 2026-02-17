use anyhow::Result;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::PathBuf;

/// 数据库连接池类型
pub type DbPool = Pool<SqliteConnectionManager>;

/// 初始化数据库连接池
pub fn init_db_pool() -> Result<DbPool> {
    // 获取数据库文件路径
    let db_path = get_db_path()?;

    // 确保父目录存在
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    tracing::info!("Initializing database at: {}", db_path.display());

    // 创建连接管理器
    let manager = SqliteConnectionManager::file(&db_path);

    // 创建连接池
    let pool = Pool::builder()
        .max_size(15)
        .build(manager)
        .map_err(|e| anyhow::anyhow!("Failed to create connection pool: {}", e))?;

    // 初始化表结构
    {
        let conn = pool
            .get()
            .map_err(|e| anyhow::anyhow!("Failed to get connection: {}", e))?;

        crate::database::schema::init_schema(&conn)?;
    }

    tracing::info!("Database initialized successfully");

    Ok(pool)
}

/// 获取数据库文件路径
fn get_db_path() -> Result<PathBuf> {
    // 获取家目录下的 .tauri-terminal 文件夹
    let storage_dir = dirs::home_dir()
        .map(|dir| dir.join(".tauri-terminal"))
        .unwrap_or_else(|| {
            std::env::current_dir()
                .unwrap()
                .join(".tauri-terminal-data")
        });

    Ok(storage_dir.join("ssh_terminal.db"))
}
