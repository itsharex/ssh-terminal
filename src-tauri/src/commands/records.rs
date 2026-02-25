//! 记录管理命令
//!
//! 提供上传/下载记录的查询和管理功能

use crate::database::DbPool;
use crate::database::repositories::{
    PaginatedDownloadRecords, PaginatedUploadRecords, UploadRecordsRepository, DownloadRecordsRepository, UserAuthRepository
};
use crate::error::Result;
use tauri::State;

/// 匿名用户的固定用户ID
const ANONYMOUS_USER_ID: &str = "anonymous_local";

/// 分页查询上传记录
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `user_id`: 用户 ID
/// - `page`: 页码（从 1 开始）
/// - `page_size`: 每页数量
///
/// # 返回
/// 分页的上传记录
#[tauri::command]
pub async fn list_upload_records(pool: State<'_, DbPool>, user_id: String, page: u32, page_size: u32) -> Result<PaginatedUploadRecords> {
    let conn = pool.get()
        .map_err(|e| crate::error::SSHError::Io(format!("获取数据库连接失败: {}", e)))?;
    UploadRecordsRepository::list_paginated(&conn, &user_id, page, page_size)
        .map_err(|e| crate::error::SSHError::Io(format!("查询上传记录失败: {}", e)))
}

/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 记录 ID
#[tauri::command]
pub async fn delete_upload_record(pool: State<'_, DbPool>, id: i64) -> Result<()> {
    let conn = pool.get()
        .map_err(|e| crate::error::SSHError::Io(format!("获取数据库连接失败: {}", e)))?;
    UploadRecordsRepository::delete(&conn, id)
        .map_err(|e| crate::error::SSHError::Io(format!("删除上传记录失败: {}", e)))
}

/// 清空所有上传记录
#[tauri::command]
pub async fn clear_upload_records(pool: State<'_, DbPool>) -> Result<()> {
    let conn = pool.get()
        .map_err(|e| crate::error::SSHError::Io(format!("获取数据库连接失败: {}", e)))?;
    UploadRecordsRepository::clear_all(&conn)
        .map_err(|e| crate::error::SSHError::Io(format!("清空上传记录失败: {}", e)))
}

/// 分页查询下载记录
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `user_id`: 用户 ID
/// - `page`: 页码（从 1 开始）
/// - `page_size`: 每页数量
///
/// # 返回
/// 分页的下载记录
#[tauri::command]
pub async fn list_download_records(pool: State<'_, DbPool>, user_id: String, page: u32, page_size: u32) -> Result<PaginatedDownloadRecords> {
    let conn = pool.get()
        .map_err(|e| crate::error::SSHError::Io(format!("获取数据库连接失败: {}", e)))?;
    DownloadRecordsRepository::list_paginated(&conn, &user_id, page, page_size)
        .map_err(|e| crate::error::SSHError::Io(format!("查询下载记录失败: {}", e)))
}

/// 删除下载记录
///
/// # 参数
/// - `pool`: 数据库连接池
/// - `id`: 记录 ID
#[tauri::command]
pub async fn delete_download_record(pool: State<'_, DbPool>, id: i64) -> Result<()> {
    let conn = pool.get()
        .map_err(|e| crate::error::SSHError::Io(format!("获取数据库连接失败: {}", e)))?;
    DownloadRecordsRepository::delete(&conn, id)
        .map_err(|e| crate::error::SSHError::Io(format!("删除下载记录失败: {}", e)))
}

/// 清空所有下载记录
#[tauri::command]
pub async fn clear_download_records(pool: State<'_, DbPool>) -> Result<()> {
    let conn = pool.get()
        .map_err(|e| crate::error::SSHError::Io(format!("获取数据库连接失败: {}", e)))?;
    DownloadRecordsRepository::clear_all(&conn)
        .map_err(|e| crate::error::SSHError::Io(format!("清空下载记录失败: {}", e)))
}

/// 将匿名用户的下载记录迁移到当前登录用户
/// 此命令应该在注册或登录成功后调用（非 auto-login）
#[tauri::command]
pub async fn db_download_records_migrate_to_user(pool: State<'_, DbPool>) -> std::result::Result<usize, String> {
    let conn = pool.get()
        .map_err(|e| format!("Failed to get database connection: {}", e))?;

    let auth_repo = UserAuthRepository::new(pool.inner().clone());

    // 获取当前登录用户信息
    let current_user = match auth_repo.find_current()
        .map_err(|e| format!("Failed to get current user: {}", e))?
    {
        Some(user) => user,
        None => return Err("No current user found".to_string()),
    };

    // 如果当前用户本身就是匿名用户，不需要迁移
    if current_user.user_id == ANONYMOUS_USER_ID {
        tracing::info!("Current user is anonymous, no migration needed");
        return Ok(0);
    }

    // 执行迁移
    let migrated_count = DownloadRecordsRepository::batch_update_user_id(
        &conn,
        ANONYMOUS_USER_ID,
        &current_user.user_id,
    )
        .map_err(|e| format!("Failed to migrate download records: {}", e))?;

    if migrated_count > 0 {
        tracing::info!(
            "Successfully migrated {} download records from anonymous to user {}",
            migrated_count,
            current_user.user_id
        );
    }

    Ok(migrated_count)
}

/// 将匿名用户的上传记录迁移到当前登录用户
/// 此命令应该在注册或登录成功后调用（非 auto-login）
#[tauri::command]
pub async fn db_upload_records_migrate_to_user(pool: State<'_, DbPool>) -> std::result::Result<usize, String> {
    let conn = pool.get()
        .map_err(|e| format!("Failed to get database connection: {}", e))?;

    let auth_repo = UserAuthRepository::new(pool.inner().clone());

    // 获取当前登录用户信息
    let current_user = match auth_repo.find_current()
        .map_err(|e| format!("Failed to get current user: {}", e))?
    {
        Some(user) => user,
        None => return Err("No current user found".to_string()),
    };

    // 如果当前用户本身就是匿名用户，不需要迁移
    if current_user.user_id == ANONYMOUS_USER_ID {
        tracing::info!("Current user is anonymous, no migration needed");
        return Ok(0);
    }

    // 执行迁移
    let migrated_count = UploadRecordsRepository::batch_update_user_id(
        &conn,
        ANONYMOUS_USER_ID,
        &current_user.user_id,
    )
        .map_err(|e| format!("Failed to migrate upload records: {}", e))?;

    if migrated_count > 0 {
        tracing::info!(
            "Successfully migrated {} upload records from anonymous to user {}",
            migrated_count,
            current_user.user_id
        );
    }

    Ok(migrated_count)
}