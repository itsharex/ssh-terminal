use crate::error::Result;
use crate::ssh::manager::SSHManager;
use crate::ssh::session::{SessionConfig, SessionConfigUpdate, AuthMethod};
use crate::database::repositories::{SshSessionRepository, UserAuthRepository};
use crate::services::CryptoService;
use crate::models::ssh_session::AuthMethod as DbAuthMethod;
use std::sync::Arc;
use tauri::State;

// 全局SSH管理器状态
pub type SSHManagerState = Arc<SSHManager>;

/// 当前用户信息（用于加解密）
fn get_current_user_info(pool: &crate::database::DbPool) -> std::result::Result<(String, String), String> {
    const ANONYMOUS_USER_ID: &str = "anonymous_local";
    const ANONYMOUS_DEVICE_ID: &str = "ssh-terminal-local-device-v1";

    let auth_repo = UserAuthRepository::new(pool.clone());

    match auth_repo.find_current().map_err(|e| e.to_string()) {
        Ok(Some(user)) => Ok((user.user_id, user.device_id)),
        _ => Ok((ANONYMOUS_USER_ID.to_string(), ANONYMOUS_DEVICE_ID.to_string())),
    }
}

/// 将数据库的 AuthMethod 转换为 SessionConfig 的 AuthMethod
fn convert_db_auth_method(db_auth: &DbAuthMethod) -> AuthMethod {
    match db_auth {
        DbAuthMethod::Password { password } => {
            AuthMethod::Password {
                password: password.clone(),
            }
        }
        DbAuthMethod::PrivateKey {
            private_key_path,
            passphrase,
            key_data: _,
        } => {
            AuthMethod::PublicKey {
                private_key_path: private_key_path.clone(),
                passphrase: passphrase.clone(),
            }
        }
    }
}

/// 从数据库加载会话配置到内存
async fn load_session_from_db(
    pool: &crate::database::DbPool,
    session_id: &str,
) -> std::result::Result<Option<SessionConfig>, String> {
    let repo = SshSessionRepository::new(pool.clone());

    let session = match repo.find_by_id(session_id) {
        Ok(Some(s)) => s,
        Ok(None) => return Ok(None),
        Err(e) => return Err(format!("Failed to find session: {}", e)),
    };

    // 解密认证信息
    let (_, device_id) = get_current_user_info(pool)?;
    let auth_method_json = CryptoService::decrypt_password(
        &session.auth_method_encrypted,
        &session.auth_nonce,
        &device_id,
    )
        .map_err(|e| format!("Failed to decrypt auth method: {}", e))?;

    let db_auth_method: DbAuthMethod = serde_json::from_str(&auth_method_json)
        .map_err(|e| format!("Failed to parse auth method: {}", e))?;

    Ok(Some(SessionConfig {
        name: session.name,
        host: session.host,
        port: session.port,
        username: session.username,
        group: session.group_name,
        auth_method: convert_db_auth_method(&db_auth_method),
        terminal_type: session.terminal_type,
        columns: session.columns,
        rows: session.rows,
        strict_host_key_checking: true,
        keep_alive_interval: 30,
    }))
}

/// 创建会话配置
#[tauri::command]
pub async fn session_create(
    manager: State<'_, SSHManagerState>,
    config: SessionConfig,
) -> Result<String> {
    manager.create_session(config).await
}

/// 创建会话配置（指定ID）
/// 用于从存储加载时使用已保存的ID
#[tauri::command]
pub async fn session_create_with_id(
    manager: State<'_, SSHManagerState>,
    id: String,
    config: SessionConfig,
) -> Result<String> {
    manager.create_session_with_id(Some(id), config).await
}

/// 创建临时会话
#[tauri::command]
pub async fn session_create_temp(
    manager: State<'_, SSHManagerState>,
    config: SessionConfig,
) -> Result<String> {
    manager.create_temporary_connection(config).await
}

/// 连接会话
#[tauri::command]
pub async fn session_connect(
    manager: State<'_, SSHManagerState>,
    pool: State<'_, crate::database::DbPool>,
    session_id: String,
) -> Result<String> {
    // 检查是否是已存在的连接实例
    let is_connection = manager.get_connection(&session_id).await.is_ok();

    if !is_connection {
        // 不是连接实例，检查会话配置是否在内存中
        let session_exists = manager.get_session_config(&session_id).await.is_ok();

        if !session_exists {
            // 不在内存中，尝试从数据库加载
            match load_session_from_db(&pool, &session_id).await {
                Ok(Some(config)) => {
                    // 创建内存会话配置
                    manager.create_session_with_id(Some(session_id.clone()), config).await?;
                }
                Ok(None) => {
                    // 会话在数据库中也不存在
                    return Err(crate::error::SSHError::SessionNotFound(session_id));
                }
                Err(e) => {
                    return Err(crate::error::SSHError::Storage(format!("Failed to load session from database: {}", e)));
                }
            }
        }
    }

    manager.connect_session(&session_id).await
}

/// 断开会话
#[tauri::command]
pub async fn session_disconnect(
    manager: State<'_, SSHManagerState>,
    session_id: String,
) -> Result<()> {
    manager.disconnect_session(&session_id).await
}

/// 列出所有会话
#[tauri::command]
pub async fn session_list(
    manager: State<'_, SSHManagerState>,
) -> Result<Vec<crate::ssh::session::SessionInfo>> {
    Ok(manager.list_sessions().await)
}

/// 获取单个会话
#[tauri::command]
pub async fn session_get(
    manager: State<'_, SSHManagerState>,
    session_id: String,
) -> Result<crate::ssh::session::SessionInfo> {
    let session = manager.get_session(&session_id).await?;
    Ok(session.session_info().await)
}

/// 删除会话
#[tauri::command]
pub async fn session_delete(
    manager: State<'_, SSHManagerState>,
    session_id: String,
) -> Result<()> {
    manager.delete_session(&session_id).await
}

/// 更新会话
#[tauri::command]
pub async fn session_update(
    manager: State<'_, SSHManagerState>,
    session_id: String,
    updates: SessionConfigUpdate,
) -> Result<()> {
    manager.update_session(&session_id, updates).await
}
