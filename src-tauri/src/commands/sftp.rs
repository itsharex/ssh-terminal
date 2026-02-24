//! SFTP Tauri Commands
//!
//! 前端调用的 SFTP 操作命令

use crate::database::repositories::UserAuthRepository;
use crate::database::DbPool;
use crate::error::Result;
use crate::sftp::{SftpFileInfo, SftpManager, UploadDirectoryResult};
use std::sync::Arc;
use std::path::Path;
use tauri::{State, Emitter};

/// SFTP Manager 状态
pub type SftpManagerState = Arc<SftpManager>;

/// 匿名用户的固定用户ID
const ANONYMOUS_USER_ID: &str = "anonymous_local";

/// 获取当前用户的 user_id
/// 如果没有登录用户，返回匿名用户ID
fn get_current_user_id(pool: &DbPool) -> String {
    let auth_repo = UserAuthRepository::new(pool.clone());
    match auth_repo.find_current() {
        Ok(Some(user)) => user.user_id,
        _ => ANONYMOUS_USER_ID.to_string(),
    }
}

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

/// 列出本地目录内容
///
/// # 参数
/// - `path`: 目录路径
///
/// # 返回
/// 目录中的文件和子目录列表
#[tauri::command]
pub async fn local_list_dir(path: String) -> Result<Vec<SftpFileInfo>> {
    tracing::info!("Listing local directory: {}", path);

    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err(crate::error::SSHError::NotFound(format!("路径不存在: {}", path)));
    }

    if !path_obj.is_dir() {
        return Err(crate::error::SSHError::Io(format!("不是目录: {}", path)));
    }

    let mut entries = Vec::new();

    let mut dir = tokio::fs::read_dir(&path).await
        .map_err(|e| crate::error::SSHError::Io(format!("无法读取目录: {}", e)))?;

    while let Some(entry) = dir.next_entry().await
        .map_err(|e| crate::error::SSHError::Io(format!("读取目录项失败: {}", e)))?
    {
        let metadata = entry.metadata().await
            .map_err(|e| crate::error::SSHError::Io(format!("获取文件元数据失败: {}", e)))?;

        let file_name = entry.file_name()
            .into_string()
            .map_err(|_| crate::error::SSHError::Io("文件名包含无效字符".to_string()))?;

        // 构建文件路径，规范化路径分隔符
        let file_path = if path.ends_with('/') || path.ends_with('\\') {
            format!("{}{}", path, file_name)
        } else {
            format!("{}{}{}", path, std::path::MAIN_SEPARATOR, file_name)
        };

        let file_info = SftpFileInfo {
            name: file_name.clone(),
            path: file_path,
            size: metadata.len(),
            is_dir: metadata.is_dir(),
            is_symlink: metadata.is_symlink(),
            modified: metadata.modified()
                .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
                .unwrap_or(0),
            mode: {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    metadata.permissions().mode()
                }
                #[cfg(windows)]
                {
                    0o644 // Windows 上无法获取 Unix 权限
                }
            },
            owner: None,
            group: None,
        };

        entries.push(file_info);
    }

    tracing::info!("Listed {} entries in local directory {}", entries.len(), path);
    Ok(entries)
}

/// 获取用户家目录
///
/// # 返回
/// 用户家目录的路径
#[tauri::command]
pub async fn local_home_dir() -> Result<String> {
    let home_dir = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| crate::error::SSHError::Io("无法获取用户家目录".to_string()))?;

    tracing::info!("Home directory: {}", home_dir);
    Ok(home_dir)
}

/// 获取可用的盘符列表
///
/// # 返回
/// 盘符列表，Windows上例如 ["C:", "D:", "E:"]，Linux上例如 ["/"]
#[tauri::command]
pub async fn local_available_drives() -> Result<Vec<String>> {
    use sysinfo::Disks;

    // 获取并刷新磁盘列表
    let disks = Disks::new_with_refreshed_list();

    let mut drives = Vec::new();

    #[cfg(windows)]
    {
        // Windows: 提取盘符（如 "C:\", "D:\"）
        for disk in &disks {
            let mount_point = disk.mount_point();
            if let Some(path_str) = mount_point.to_str() {
                // 提取盘符，如 "C:" 而不是 "C:\"
                if path_str.len() >= 2 && path_str.chars().nth(1) == Some(':') {
                    drives.push(format!("{}:", path_str.chars().next().unwrap()));
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        // Linux/Unix: 返回根目录
        drives.push("/".to_string());
    }

    tracing::info!("Available drives: {:?}", drives);
    Ok(drives)
}

/// 获取盘符的根目录
///
/// # 参数
/// - `drive`: 盘符，例如 "C:"
///
/// # 返回
/// 该盘符的根目录路径
#[tauri::command]
pub async fn local_drive_root(drive: String) -> Result<String> {
    #[cfg(windows)]
    {
        if drive.ends_with(':') {
            Ok(format!("{}\\", drive))
        } else {
            Ok(format!("{}:", drive))
        }
    }

    #[cfg(not(windows))]
    {
        Ok("/".to_string())
    }
}

/// 上传文件（完整实现）
///
/// # 参数
/// - `manager`: SFTP Manager
/// - `pool`: 数据库连接池
/// - `connection_id`: SSH 连接 ID
/// - `local_path`: 本地文件路径
/// - `remote_path`: 远程保存路径
/// - `window`: Tauri 窗口实例（用于发送进度事件）
///
/// # 返回
/// 传输的字节数
#[tauri::command]
pub async fn sftp_upload_file(
    manager: State<'_, SftpManagerState>,
    pool: State<'_, DbPool>,
    connection_id: String,
    local_path: String,
    remote_path: String,
    window: tauri::Window,
) -> Result<u64> {
    tracing::info!("=== Upload File Start ===");
    tracing::info!("Connection ID: {}", connection_id);
    tracing::info!("Local path: {}", local_path);
    tracing::info!("Remote path: {}", remote_path);

    // 检查本地文件是否存在
    let local_path_obj = std::path::Path::new(&local_path);
    tracing::info!("Local file exists: {}", local_path_obj.exists());

    if !local_path_obj.exists() {
        tracing::error!("Local file does not exist: {}", local_path);
        return Err(crate::error::SSHError::NotFound(format!("本地文件不存在: {}", local_path)));
    }

    // 获取当前用户 ID
    let user_id = get_current_user_id(&pool);

    // 生成任务 ID
    let task_id = format!("upload-file-{}-{}", connection_id, uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or(""));

    // 获取文件大小
    let file_size = local_path_obj.metadata()
        .map_err(|e| crate::error::SSHError::Io(format!("无法获取文件元数据: {}", e)))?
        .len();

    // 创建上传记录
    let now = chrono::Utc::now().timestamp();
    let upload_record = crate::database::repositories::UploadRecord {
        id: 0, // 数据库会自动生成
        task_id: task_id.clone(),
        connection_id: connection_id.clone(),
        user_id: user_id.clone(),
        local_path: local_path.clone(),
        remote_path: remote_path.clone(),
        total_files: 1,
        total_dirs: 0,
        total_size: file_size as i64,
        status: "pending".to_string(),
        bytes_transferred: 0,
        files_completed: 0,
        started_at: now,
        completed_at: None,
        elapsed_ms: None,
        error_message: None,
        created_at: now,
        updated_at: now,
    };

    if let Ok(conn) = pool.get() {
        let _ = crate::database::repositories::UploadRecordsRepository::create(&conn, &upload_record);
    }

    // 更新状态为 uploading
    if let Ok(conn) = pool.get() {
        let _ = crate::database::repositories::UploadRecordsRepository::update_status(
            &conn,
            &task_id,
            crate::database::repositories::UploadStatus::Uploading,
            None,
        );
    }

    // 获取取消令牌
    let cancellation_token = manager.get_cancellation_token(&task_id).await;

    // 🔥 为任务创建独立的 SFTP Client
    let sftp_client = manager.create_task_client(&connection_id, &task_id).await?;
    let mut client_guard = sftp_client.lock().await;

    // 获取文件大小
    let file_size = local_path_obj.metadata()
        .map_err(|e| crate::error::SSHError::Io(format!("无法获取文件元数据: {}", e)))?
        .len();

    // 发送开始进度事件
    let start_event = crate::sftp::UploadProgressEvent {
        task_id: task_id.clone(),
        connection_id: connection_id.clone(),
        current_file: local_path.clone(),
        current_dir: local_path_obj.parent()
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_string(),
        files_completed: 0,
        total_files: 1,
        bytes_transferred: 0,
        total_bytes: file_size,
        speed_bytes_per_sec: 0,
    };
    let _ = window.emit("sftp-upload-progress", &start_event);

    // 流式上传文件
    let task_id_for_callback = task_id.clone();
    let connection_id_for_callback = connection_id.clone();
    let local_path_for_callback = local_path.clone();
    let local_dir = local_path_obj.parent()
        .and_then(|p| p.to_str())
        .unwrap_or("")
        .to_string();

    let result = client_guard.upload_file_stream(
        &local_path,
        &remote_path,
        &cancellation_token,
        move |transferred, total| {
            // 发送进度事件（前端显示用）
            let progress_event = crate::sftp::UploadProgressEvent {
                task_id: task_id_for_callback.clone(),
                connection_id: connection_id_for_callback.clone(),
                current_file: local_path_for_callback.clone(),
                current_dir: local_dir.clone(),
                files_completed: if transferred >= total { 1 } else { 0 },
                total_files: 1,
                bytes_transferred: transferred,
                total_bytes: total,
                speed_bytes_per_sec: 0,
            };
            let _ = window.emit("sftp-upload-progress", &progress_event);
        },
        false,
    ).await;

    // 🔥 清理任务 SFTP Client 和取消令牌（无论成功或失败）
    manager.cleanup_task_client(&task_id).await;
    manager.cleanup_cancellation_token(&task_id).await;

    // 返回上传结果
    match result {
        Ok(transferred) => {
            tracing::info!("Upload completed: {} bytes", transferred);

            // 标记上传完成
            let elapsed = chrono::Utc::now().timestamp() - now;
            if let Ok(conn) = pool.get() {
                let _ = crate::database::repositories::UploadRecordsRepository::mark_completed(
                    &conn,
                    &task_id,
                    elapsed * 1000, // 转换为毫秒
                    transferred as i64,
                    1, // 单文件上传，files_completed = 1
                );
            }

            Ok(transferred)
        }
        Err(e) => {
            tracing::error!("Upload failed: {}", e);

            // 标记上传失败
            if let Ok(conn) = pool.get() {
                let _ = crate::database::repositories::UploadRecordsRepository::update_status(
                    &conn,
                    &task_id,
                    crate::database::repositories::UploadStatus::Failed,
                    Some(e.to_string()),
                );
            }

            Err(e)
        }
    }
}

/// 下载文件（完整实现）
///
/// # 参数
/// - `manager`: SFTP Manager
/// - `pool`: 数据库连接池
/// - `connection_id`: SSH 连接 ID
/// - `remote_path`: 远程文件路径
/// - `local_path`: 本地保存路径
/// - `window`: Tauri 窗口实例（用于发送进度事件）
///
/// # 返回
/// 传输的字节数
#[tauri::command]
pub async fn sftp_download_file(
    manager: State<'_, SftpManagerState>,
    pool: State<'_, DbPool>,
    connection_id: String,
    remote_path: String,
    local_path: String,
    window: tauri::Window,
) -> Result<u64> {
    tracing::info!("=== Download File Start ===");
    tracing::info!("Connection ID: {}", connection_id);
    tracing::info!("Remote path: {}", remote_path);
    tracing::info!("Local path: {}", local_path);

    // 检查本地目录是否存在
    let local_path_obj = std::path::Path::new(&local_path);
    if let Some(parent_dir) = local_path_obj.parent() {
        if !parent_dir.exists() {
            // 尝试创建父目录
            tokio::fs::create_dir_all(parent_dir).await
                .map_err(|e| crate::error::SSHError::Io(format!("无法创建本地目录: {}", e)))?;
        }
    }

    // 获取当前用户 ID
    let user_id = get_current_user_id(&pool);

    // 生成任务 ID
    let task_id = format!("download-file-{}-{}", connection_id, uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or(""));

    // 创建下载记录
    let now = chrono::Utc::now().timestamp();
    let download_record = crate::database::repositories::DownloadRecord {
        id: 0, // 数据库会自动生成
        task_id: task_id.clone(),
        connection_id: connection_id.clone(),
        user_id: user_id.clone(),
        remote_path: remote_path.clone(),
        local_path: local_path.clone(),
        total_files: 1,
        total_dirs: 0,
        total_size: 0, // 下载前不知道大小
        status: "pending".to_string(),
        bytes_transferred: 0,
        files_completed: 0,
        started_at: now,
        completed_at: None,
        elapsed_ms: None,
        error_message: None,
        created_at: now,
        updated_at: now,
    };

    if let Ok(conn) = pool.get() {
        let _ = crate::database::repositories::DownloadRecordsRepository::create(&conn, &download_record);
    }

    // 更新状态为 downloading
    if let Ok(conn) = pool.get() {
        let _ = crate::database::repositories::DownloadRecordsRepository::update_status(
            &conn,
            &task_id,
            crate::database::repositories::DownloadStatus::Downloading,
            None,
        );
    }

    // 获取取消令牌
    let cancellation_token = manager.get_cancellation_token(&task_id).await;

    // 🔥 为任务创建独立的 SFTP Client
    let sftp_client = manager.create_task_client(&connection_id, &task_id).await?;
    let client_guard = sftp_client.lock().await;

    // 提取文件名和目录信息
    let file_name = remote_path.rsplit('/').next().unwrap_or(&remote_path).to_string();
    let current_dir = remote_path.rsplit('/')
        .skip(1)
        .next()
        .unwrap_or("")
        .to_string();

    // 发送开始进度事件
    let start_event = crate::sftp::DownloadProgressEvent {
        task_id: task_id.clone(),
        connection_id: connection_id.clone(),
        current_file: file_name.clone(),
        current_dir: current_dir.clone(),
        files_completed: 0,
        total_files: 1,
        bytes_transferred: 0,
        total_bytes: 0, // 初始为0，会在第一次进度回调时更新
        speed_bytes_per_sec: 0,
    };
    let _ = window.emit("sftp-download-progress", &start_event);

    // 流式下载文件
    let task_id_for_callback = task_id.clone();
    let connection_id_for_callback = connection_id.clone();
    let file_name_for_callback = file_name.clone();
    let current_dir_for_callback = current_dir.clone();

    let result = client_guard.download_file_stream(
        &remote_path,
        &local_path,
        &cancellation_token,
        move |transferred, total| {
            // 发送进度事件（前端显示用）
            let progress_event = crate::sftp::DownloadProgressEvent {
                task_id: task_id_for_callback.clone(),
                connection_id: connection_id_for_callback.clone(),
                current_file: file_name_for_callback.clone(),
                current_dir: current_dir_for_callback.clone(),
                files_completed: if transferred >= total { 1 } else { 0 },
                total_files: 1,
                bytes_transferred: transferred,
                total_bytes: total,
                speed_bytes_per_sec: 0,
            };
            let _ = window.emit("sftp-download-progress", &progress_event);
        }
    ).await;

    // 🔥 清理任务 SFTP Client 和取消令牌（无论成功或失败）
    manager.cleanup_task_client(&task_id).await;
    manager.cleanup_cancellation_token(&task_id).await;

    // 返回下载结果
    match result {
        Ok(transferred) => {
            tracing::info!("Download completed: {} bytes", transferred);

            // 标记下载完成
            let elapsed = chrono::Utc::now().timestamp() - now;
            if let Ok(conn) = pool.get() {
                let _ = crate::database::repositories::DownloadRecordsRepository::mark_completed(
                    &conn,
                    &task_id,
                    elapsed * 1000, // 转换为毫秒
                    transferred as i64,
                    1, // 单文件下载，files_completed = 1
                );
            }

            Ok(transferred)
        }
        Err(e) => {
            tracing::error!("Download failed: {}", e);

            // 标记下载失败
            if let Ok(conn) = pool.get() {
                let _ = crate::database::repositories::DownloadRecordsRepository::update_status(
                    &conn,
                    &task_id,
                    crate::database::repositories::DownloadStatus::Failed,
                    Some(e.to_string()),
                );
            }

            Err(e)
        }
    }
}

/// 上传目录及其所有子目录和文件
///
/// # 参数
/// - `manager`: SFTP Manager
/// - `pool`: 数据库连接池
/// - `connection_id`: SSH 连接 ID
/// - `local_dir_path`: 本地目录路径
/// - `remote_dir_path`: 远程目录路径
/// - `task_id`: 上传任务的唯一 ID
/// - `window`: Tauri 窗口实例（用于发送进度事件）
///
/// # 返回
/// 上传结果统计信息
#[tauri::command]
pub async fn sftp_upload_directory(
    manager: State<'_, SftpManagerState>,
    pool: State<'_, DbPool>,
    connection_id: String,
    local_dir_path: String,
    remote_dir_path: String,
    task_id: String,
    window: tauri::Window,
) -> Result<UploadDirectoryResult> {
    tracing::info!("=== Upload Directory Start ===");
    tracing::info!("Task ID: {}", task_id);
    tracing::info!("Connection ID: {}", connection_id);
    tracing::info!("Local directory: {}", local_dir_path);
    tracing::info!("Remote directory: {}", remote_dir_path);

    // 验证本地目录是否存在
    let local_path = Path::new(&local_dir_path);
    if !local_path.exists() {
        return Err(crate::error::SSHError::NotFound(
            format!("本地目录不存在: {}", local_dir_path)
        ));
    }

    if !local_path.is_dir() {
        return Err(crate::error::SSHError::Io(
            format!("路径不是目录: {}", local_dir_path)
        ));
    }

    // 获取当前用户 ID
    let user_id = get_current_user_id(&pool);

    // 创建上传记录
    let now = chrono::Utc::now().timestamp();
    let upload_record = crate::database::repositories::UploadRecord {
        id: 0,
        task_id: task_id.clone(),
        connection_id: connection_id.clone(),
        user_id: user_id.clone(),
        local_path: local_dir_path.clone(),
        remote_path: remote_dir_path.clone(),
        total_files: 0,
        total_dirs: 0,
        total_size: 0,
        status: "pending".to_string(),
        bytes_transferred: 0,
        files_completed: 0,
        started_at: now,
        completed_at: None,
        elapsed_ms: None,
        error_message: None,
        created_at: now,
        updated_at: now,
    };

    if let Ok(conn) = pool.get() {
        let _ = crate::database::repositories::UploadRecordsRepository::create(&conn, &upload_record);
    }

    // 更新状态为 uploading
    if let Ok(conn) = pool.get() {
        let _ = crate::database::repositories::UploadRecordsRepository::update_status(
            &conn,
            &task_id,
            crate::database::repositories::UploadStatus::Uploading,
            None,
        );
    }

    // 获取取消令牌（基于 task_id）
    let cancellation_token = manager.get_cancellation_token(&task_id).await;

    // 🔥 为任务创建独立的 SFTP Client
    let sftp_client = manager.create_task_client(&connection_id, &task_id).await?;
    let mut client_guard = sftp_client.lock().await;

    // 执行上传操作
    let result = client_guard.upload_directory_recursive(
        &local_dir_path,
        &remote_dir_path,
        &window,
        &connection_id,
        &task_id,
        &cancellation_token
    ).await;

    // 🔥 清理任务 SFTP Client 和取消令牌
    manager.cleanup_task_client(&task_id).await;
    manager.cleanup_cancellation_token(&task_id).await;

    // 处理上传结果
    match result {
        Ok(upload_result) => {
            tracing::info!("Upload directory completed: {:?}", upload_result);

            // 标记上传完成（包含统计信息）
            let elapsed = chrono::Utc::now().timestamp() - now;
            if let Ok(conn) = pool.get() {
                let _ = crate::database::repositories::UploadRecordsRepository::mark_completed_with_stats(
                    &conn,
                    &task_id,
                    elapsed * 1000,
                    upload_result.total_size as i64,
                    upload_result.total_files as i64,
                    upload_result.total_files as i64,
                    upload_result.total_dirs as i64,
                    upload_result.total_size as i64,
                );
            }

            Ok(upload_result)
        }
        Err(e) => {
            tracing::error!("Upload directory failed: {}", e);

            // 标记上传失败
            if let Ok(conn) = pool.get() {
                let _ = crate::database::repositories::UploadRecordsRepository::update_status(
                    &conn,
                    &task_id,
                    crate::database::repositories::UploadStatus::Failed,
                    Some(e.to_string()),
                );
            }

            Err(e)
        }
    }
}

/// 取消上传操作
///
/// # 参数
/// - `task_id`: 任务 ID
#[tauri::command]
pub async fn sftp_cancel_upload(
    manager: State<'_, SftpManagerState>,
    task_id: String,
) -> Result<()> {
    tracing::info!("Cancelling upload for task {}", task_id);
    manager.cancel_task(&task_id).await
}

/// 下载目录及其所有子目录和文件
///
/// # 参数
/// - `manager`: SFTP Manager
/// - `pool`: 数据库连接池
/// - `connection_id`: SSH 连接 ID
/// - `remote_dir_path`: 远程目录路径
/// - `local_dir_path`: 本地保存路径
/// - `task_id`: 下载任务的唯一 ID
/// - `window`: Tauri 窗口实例（用于发送进度事件）
///
/// # 返回
/// 下载结果统计信息
#[tauri::command]
pub async fn sftp_download_directory(
    manager: State<'_, SftpManagerState>,
    pool: State<'_, DbPool>,
    connection_id: String,
    remote_dir_path: String,
    local_dir_path: String,
    task_id: String,
    window: tauri::Window,
) -> Result<crate::sftp::DownloadDirectoryResult> {
    tracing::info!("=== Download Directory Start ===");
    tracing::info!("Task ID: {}", task_id);
    tracing::info!("Connection ID: {}", connection_id);
    tracing::info!("Remote directory: {}", remote_dir_path);
    tracing::info!("Local directory: {}", local_dir_path);

    // 验证本地目录父路径
    let local_path = Path::new(&local_dir_path);
    if let Some(parent) = local_path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| crate::error::SSHError::Io(format!("创建本地父目录失败: {}", e)))?;
        }
    }

    // 获取当前用户 ID
    let user_id = get_current_user_id(&pool);

    // 创建下载记录
    let now = chrono::Utc::now().timestamp();
    let download_record = crate::database::repositories::DownloadRecord {
        id: 0,
        task_id: task_id.clone(),
        connection_id: connection_id.clone(),
        user_id: user_id.clone(),
        remote_path: remote_dir_path.clone(),
        local_path: local_dir_path.clone(),
        total_files: 0,
        total_dirs: 0,
        total_size: 0,
        status: "pending".to_string(),
        bytes_transferred: 0,
        files_completed: 0,
        started_at: now,
        completed_at: None,
        elapsed_ms: None,
        error_message: None,
        created_at: now,
        updated_at: now,
    };

    if let Ok(conn) = pool.get() {
        let _ = crate::database::repositories::DownloadRecordsRepository::create(&conn, &download_record);
    }

    // 更新状态为 downloading
    if let Ok(conn) = pool.get() {
        let _ = crate::database::repositories::DownloadRecordsRepository::update_status(
            &conn,
            &task_id,
            crate::database::repositories::DownloadStatus::Downloading,
            None,
        );
    }

    // 获取取消令牌（基于 task_id）
    let cancellation_token = manager.get_cancellation_token(&task_id).await;

    // 🔥 为任务创建独立的 SFTP Client
    let sftp_client = manager.create_task_client(&connection_id, &task_id).await?;
    let mut client_guard = sftp_client.lock().await;

    // 执行下载操作
    let result = client_guard.download_directory_recursive(
        &remote_dir_path,
        &local_dir_path,
        &window,
        &connection_id,
        &task_id,
        &cancellation_token,
        |_transferred, _total| {
            // 进度回调，暂不使用
        }
    ).await;

    // 🔥 清理任务 SFTP Client 和取消令牌
    manager.cleanup_task_client(&task_id).await;
    manager.cleanup_cancellation_token(&task_id).await;

    // 处理下载结果
    match result {
        Ok(download_result) => {
            tracing::info!("Download directory completed: {:?}", download_result);

            // 标记下载完成（包含统计信息）
            let elapsed = chrono::Utc::now().timestamp() - now;
            if let Ok(conn) = pool.get() {
                let _ = crate::database::repositories::DownloadRecordsRepository::mark_completed_with_stats(
                    &conn,
                    &task_id,
                    elapsed * 1000,
                    download_result.total_size as i64,
                    download_result.total_files as i64,
                    download_result.total_files as i64,
                    download_result.total_dirs as i64,
                    download_result.total_size as i64,
                );
            }

            Ok(download_result)
        }
        Err(e) => {
            tracing::error!("Download directory failed: {}", e);

            // 标记下载失败
            if let Ok(conn) = pool.get() {
                let _ = crate::database::repositories::DownloadRecordsRepository::update_status(
                    &conn,
                    &task_id,
                    crate::database::repositories::DownloadStatus::Failed,
                    Some(e.to_string()),
                );
            }

            Err(e)
        }
    }
}

/// 取消下载操作
///
/// # 参数
/// - `task_id`: 任务 ID
#[tauri::command]
pub async fn sftp_cancel_download(
    manager: State<'_, SftpManagerState>,
    task_id: String,
) -> Result<()> {
    tracing::info!("Cancelling download for task {}", task_id);
    manager.cancel_task(&task_id).await
}
