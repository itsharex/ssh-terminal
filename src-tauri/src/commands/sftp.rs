//! SFTP Tauri Commands
//!
//! 前端调用的 SFTP 操作命令

use crate::error::Result;
use crate::sftp::{SftpFileInfo, SftpManager};
use std::sync::Arc;
use tauri::{AppHandle, State};

/// SFTP Manager 状态
pub type SftpManagerState = Arc<SftpManager>;

/// 列出目录内容
///
/// # 参数
/// - `manager`: SFTP Manager
/// - `connection_id`: SSH 连接 ID
/// - `path`: 目录路径
///
/// # 返回
/// 目录中的文件和子目录列表
#[tauri::command]
pub async fn sftp_list_dir(
    manager: State<'_, SftpManagerState>,
    connection_id: String,
    path: String,
) -> Result<Vec<SftpFileInfo>> {
    tracing::info!("Listing directory: {} on connection {}", path, connection_id);

    let entries = manager.list_dir(&connection_id, &path).await?;

    Ok(entries)
}

/// 创建目录
#[tauri::command]
pub async fn sftp_create_dir(
    manager: State<'_, SftpManagerState>,
    connection_id: String,
    path: String,
    recursive: bool,
) -> Result<()> {
    manager.create_dir(&connection_id, &path, recursive).await
}

/// 删除文件
///
/// # 参数
/// - `connection_id`: SSH 连接 ID
/// - `path`: 文件路径
#[tauri::command]
pub async fn sftp_remove_file(
    manager: State<'_, SftpManagerState>,
    connection_id: String,
    path: String,
) -> Result<()> {
    tracing::info!("Removing file: {} on connection {}", path, connection_id);
    manager.remove_file(&connection_id, &path).await
}

/// 删除目录
///
/// # 参数
/// - `connection_id`: SSH 连接 ID
/// - `path`: 目录路径
/// - `recursive`: 是否递归删除
#[tauri::command]
pub async fn sftp_remove_dir(
    manager: State<'_, SftpManagerState>,
    connection_id: String,
    path: String,
    recursive: bool,
) -> Result<()> {
    tracing::info!("Removing directory: {} (recursive: {}) on connection {}", path, recursive, connection_id);
    manager.remove_dir(&connection_id, &path, recursive).await
}

/// 重命名文件或目录
///
/// # 参数
/// - `connection_id`: SSH 连接 ID
/// - `old_path`: 原路径
/// - `new_path`: 新路径
#[tauri::command]
pub async fn sftp_rename(
    manager: State<'_, SftpManagerState>,
    connection_id: String,
    old_path: String,
    new_path: String,
) -> Result<()> {
    tracing::info!("Renaming: {} -> {} on connection {}", old_path, new_path, connection_id);
    manager.rename(&connection_id, &old_path, &new_path).await
}

/// 修改文件权限
///
/// # 参数
/// - `connection_id`: SSH 连接 ID
/// - `path`: 文件路径
/// - `mode`: 权限模式（Unix 风格，如 0o755）
#[tauri::command]
pub async fn sftp_chmod(
    manager: State<'_, SftpManagerState>,
    connection_id: String,
    path: String,
    mode: u32,
) -> Result<()> {
    tracing::info!("Changing permissions of {} to {:o} on connection {}", path, mode, connection_id);
    manager.chmod(&connection_id, &path, mode).await
}

/// 读取文件内容
///
/// # 参数
/// - `connection_id`: SSH 连接 ID
/// - `path`: 文件路径
///
/// # 返回
/// 文件内容的字节数组
#[tauri::command]
pub async fn sftp_read_file(
    manager: State<'_, SftpManagerState>,
    connection_id: String,
    path: String,
) -> Result<Vec<u8>> {
    tracing::info!("Reading file: {} on connection {}", path, connection_id);
    manager.read_file(&connection_id, &path).await
}

/// 写入文件内容
///
/// # 参数
/// - `connection_id`: SSH 连接 ID
/// - `path`: 文件路径
/// - `content`: 文件内容
#[tauri::command]
pub async fn sftp_write_file(
    manager: State<'_, SftpManagerState>,
    connection_id: String,
    path: String,
    content: Vec<u8>,
) -> Result<()> {
    tracing::info!("Writing {} bytes to {} on connection {}", content.len(), path, connection_id);
    manager.write_file(&connection_id, &path, content).await
}

/// 下载文件
///
/// # 参数
/// - `app`: Tauri AppHandle
/// - `manager`: SFTP Manager
/// - `connection_id`: SSH 连接 ID
/// - `remote_path`: 远程文件路径
/// - `local_path`: 本地保存路径
///
/// # 返回
/// 传输 ID（用于跟踪进度）
#[tauri::command]
pub async fn sftp_download_file(
    _app: AppHandle,
    _manager: State<'_, SftpManagerState>,
    connection_id: String,
    remote_path: String,
    local_path: String,
) -> Result<String> {
    tracing::info!("Downloading {} from connection {} to {}", remote_path, connection_id, local_path);

    // TODO: 实现实际的下载逻辑
    // 需要在后台任务中执行下载并报告进度
    Err(crate::error::SSHError::NotSupported("Download not yet implemented".to_string()))
}

/// 上传文件
///
/// # 参数
/// - `app`: Tauri AppHandle
/// - `manager`: SFTP Manager
/// - `connection_id`: SSH 连接 ID
/// - `local_path`: 本地文件路径
/// - `remote_path`: 远程保存路径
///
/// # 返回
/// 传输 ID（用于跟踪进度）
#[tauri::command]
pub async fn sftp_upload_file(
    _app: AppHandle,
    _manager: State<'_, SftpManagerState>,
    connection_id: String,
    local_path: String,
    remote_path: String,
) -> Result<String> {
    tracing::info!("Uploading {} to {} on connection {}", local_path, remote_path, connection_id);

    // TODO: 实现实际的上传逻辑
    // 需要在后台任务中执行上传并报告进度
    Err(crate::error::SSHError::NotSupported("Upload not yet implemented".to_string()))
}
