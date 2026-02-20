use crate::database::DbPool;
use crate::database::repositories::{UserAuthRepository, SshSessionRepository};
use crate::models::ssh_session::{SshSession, AuthMethod};
use crate::services::CryptoService;
use tauri::State;

/// 未登录用户的固定用户ID
const ANONYMOUS_USER_ID: &str = "anonymous_local";

/// 未登录用户的固定 device_id（用于本地加密）
const ANONYMOUS_DEVICE_ID: &str = "ssh-terminal-local-device-v1";

/// 当前用户信息
struct CurrentUserInfo {
    user_id: String,
    device_id: String,
}

/// 获取当前用户信息
fn get_current_user_info(pool: &DbPool) -> CurrentUserInfo {
    let auth_repo = UserAuthRepository::new(pool.clone());

    match auth_repo.find_current() {
        Ok(Some(user)) => CurrentUserInfo {
            user_id: user.user_id,
            device_id: user.device_id,
        },
        _ => {
            tracing::info!("No current user found, using anonymous user");
            CurrentUserInfo {
                user_id: ANONYMOUS_USER_ID.to_string(),
                device_id: ANONYMOUS_DEVICE_ID.to_string(),
            }
        }
    }
}

/// 将前端的 AuthMethod 转换为内部的 AuthMethod 枚举
fn convert_front_end_auth_method(auth_method: &serde_json::Value) -> Result<AuthMethod, String> {
    if let Some(password_obj) = auth_method.get("Password") {
        if let Some(password) = password_obj.get("password") {
            match password.as_str() {
                Some(pwd_str) => return Ok(AuthMethod::Password { password: pwd_str.to_string() }),
                None => return Err("Password value is not a string".to_string()),
            }
        }
        return Err("Password field not found in Password auth method".to_string());
    }

    if let Some(public_key_obj) = auth_method.get("PublicKey") {
        let private_key_path = public_key_obj
            .get("privateKeyPath")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "privateKeyPath field not found".to_string())?
            .to_string();

        let passphrase = public_key_obj
            .get("passphrase")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        return Ok(AuthMethod::PrivateKey {
            private_key_path: private_key_path,
            passphrase,
            key_data: None,
        });
    }

    Err("Invalid auth method format".to_string())
}

/// 将内部的 AuthMethod 转回前端格式（用于返回可解密的数据）
fn auth_method_to_frontend(auth_method: &AuthMethod) -> serde_json::Value {
    match auth_method {
        AuthMethod::Password { password } => {
            serde_json::json!({
                "Password": {
                    "password": password
                }
            })
        }
        AuthMethod::PrivateKey {
            private_key_path,
            passphrase,
            key_data: _,
        } => {
            if let Some(pass) = passphrase {
                serde_json::json!({
                    "PublicKey": {
                        "privateKeyPath": private_key_path,
                        "passphrase": pass
                    }
                })
            } else {
                serde_json::json!({
                    "PublicKey": {
                        "privateKeyPath": private_key_path
                    }
                })
            }
        }
    }
}

/// 创建 SSH 会话并保存到数据库
#[tauri::command]
pub async fn db_ssh_session_create(
    pool: State<'_, DbPool>,
    config: serde_json::Value,
) -> Result<String, String> {
    let current_user = get_current_user_info(&pool);

    let session_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // 提取基本信息
    let name = config.get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "name field is required".to_string())?
        .to_string();

    let host = config.get("host")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "host field is required".to_string())?
        .to_string();

    let port = config.get("port")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "port field is required".to_string())?
        as u16;

    let username = config.get("username")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "username field is required".to_string())?
        .to_string();

    let group_name = config.get("group")
        .and_then(|v| v.as_str())
        .unwrap_or("默认分组")
        .to_string();

    let terminal_type = config.get("terminalType")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let columns = config.get("columns")
        .and_then(|v| v.as_u64())
        .map(|c| c as u16);

    let rows = config.get("rows")
        .and_then(|v| v.as_u64())
        .map(|r| r as u16);

    // 提取并加密认证信息
    let auth_method_value = config.get("authMethod")
        .ok_or_else(|| "authMethod field is required".to_string())?;

    let auth_method = convert_front_end_auth_method(auth_method_value)?;

    // 使用 device_id 加密认证信息（对登录用户和匿名用户都使用相同方法）
    let (auth_method_encrypted, auth_nonce) = CryptoService::encrypt_password(
        &serde_json::to_string(&auth_method).unwrap(),
        &current_user.device_id,
    )
        .map_err(|e| format!("Failed to encrypt auth method: {}", e))?;

    let session = SshSession {
        id: session_id.clone(),
        user_id: current_user.user_id.clone(),
        name,
        host,
        port,
        username,
        group_name,
        terminal_type,
        columns,
        rows,
        auth_method_encrypted,
        auth_nonce,
        auth_key_salt: None,
        server_ver: 0,
        client_ver: 1,
        is_dirty: true, // 标记为需要同步
        last_synced_at: None,
        is_deleted: false,
        deleted_at: None,
        created_at: now,
        updated_at: now,
    };

    let repo = SshSessionRepository::new(pool.inner().clone());
    repo.create(&session)
        .map_err(|e| format!("Failed to create session: {}", e))?;

    tracing::info!("Created SSH session: {} (user: {})", session_id, current_user.user_id);

    Ok(session_id)
}

/// 更新 SSH 会话
#[tauri::command]
pub async fn db_ssh_session_update(
    pool: State<'_, DbPool>,
    session_id: String,
    updates: serde_json::Value,
) -> Result<(), String> {
    let current_user = get_current_user_info(&pool);
    let repo = SshSessionRepository::new(pool.inner().clone());

    // 查找现有会话
    let mut session = repo.find_by_id(&session_id)
        .map_err(|e| format!("Failed to find session: {}", e))?
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    // 检查会话是否属于当前用户
    if session.user_id != current_user.user_id {
        return Err("Session belongs to different user".to_string());
    }

    // 更新字段
    if let Some(name) = updates.get("name").and_then(|v| v.as_str()) {
        session.name = name.to_string();
    }
    if let Some(host) = updates.get("host").and_then(|v| v.as_str()) {
        session.host = host.to_string();
    }
    if let Some(port) = updates.get("port").and_then(|v| v.as_u64()) {
        session.port = port as u16;
    }
    if let Some(username) = updates.get("username").and_then(|v| v.as_str()) {
        session.username = username.to_string();
    }
    if let Some(group_name) = updates.get("group").and_then(|v| v.as_str()) {
        session.group_name = group_name.to_string();
    }
    if let Some(terminal_type) = updates.get("terminalType").and_then(|v| v.as_str()) {
        session.terminal_type = Some(terminal_type.to_string());
    }
    if let Some(columns) = updates.get("columns").and_then(|v| v.as_u64()) {
        session.columns = Some(columns as u16);
    }
    if let Some(rows) = updates.get("rows").and_then(|v| v.as_u64()) {
        session.rows = Some(rows as u16);
    }

    // 更新认证信息（如果提供）
    if let Some(auth_method_value) = updates.get("authMethod") {
        let auth_method = convert_front_end_auth_method(auth_method_value)?;

        let (auth_method_encrypted, auth_nonce) = CryptoService::encrypt_password(
            &serde_json::to_string(&auth_method).unwrap(),
            &current_user.device_id,
        )
            .map_err(|e| format!("Failed to encrypt auth method: {}", e))?;

        session.auth_method_encrypted = auth_method_encrypted;
        session.auth_nonce = auth_nonce;
    }

    // 标记为已更新且需要同步
    session.updated_at = chrono::Utc::now().timestamp();
    session.client_ver += 1;
    session.is_dirty = true;

    repo.update(&session)
        .map_err(|e| format!("Failed to update session: {}", e))?;

    tracing::info!("Updated SSH session: {}", session_id);

    Ok(())
}

/// 删除 SSH 会话（软删除）
#[tauri::command]
pub async fn db_ssh_session_delete(
    pool: State<'_, DbPool>,
    session_id: String,
) -> Result<(), String> {
    let current_user = get_current_user_info(&pool);
    let repo = SshSessionRepository::new(pool.inner().clone());

    // 查找会话以验证所有权
    if let Some(session) = repo.find_by_id(&session_id)
        .map_err(|e| format!("Failed to find session: {}", e))?
    {
        if session.user_id != current_user.user_id {
            return Err("Session belongs to different user".to_string());
        }
    }

    repo.delete(&session_id)
        .map_err(|e| format!("Failed to delete session: {}", e))?;

    tracing::info!("Deleted SSH session: {}", session_id);

    Ok(())
}

/// 列出当前用户的所有 SSH 会话
#[tauri::command]
pub async fn db_ssh_session_list(
    pool: State<'_, DbPool>,
) -> Result<Vec<serde_json::Value>, String> {
    let current_user = get_current_user_info(&pool);
    tracing::info!("[db_ssh_session_list] Current user_id: {}", current_user.user_id);

    let repo = SshSessionRepository::new(pool.inner().clone());

    let sessions = repo.find_by_user_id(&current_user.user_id)
        .map_err(|e| format!("Failed to list sessions: {}", e))?;

    tracing::info!("[db_ssh_session_list] Found {} sessions for user {}", sessions.len(), current_user.user_id);

    // 转换为前端友好的格式
    let result: Vec<serde_json::Value> = sessions
        .iter()
        .map(|session| {
            serde_json::json!({
                "id": session.id,
                "userId": session.user_id,
                "name": session.name,
                "host": session.host,
                "port": session.port,
                "username": session.username,
                "groupName": session.group_name,
                "terminalType": session.terminal_type,
                "columns": session.columns,
                "rows": session.rows,
                "createdAt": session.created_at,
                "updatedAt": session.updated_at,
            })
        })
        .collect();

    tracing::info!("Listed {} SSH sessions for user {}", result.len(), current_user.user_id);

    Ok(result)
}

/// 根据 ID 获取 SSH 会话（包含加密的认证信息）
#[tauri::command]
pub async fn db_ssh_session_get_by_id(
    pool: State<'_, DbPool>,
    session_id: String,
) -> Result<Option<serde_json::Value>, String> {
    let current_user = get_current_user_info(&pool);
    let repo = SshSessionRepository::new(pool.inner().clone());

    let session = match repo.find_by_id(&session_id)
        .map_err(|e| format!("Failed to find session: {}", e))?
    {
        Some(s) => s,
        None => return Ok(None),
    };

    // 检查所有权
    if session.user_id != current_user.user_id {
        return Err("Session belongs to different user".to_string());
    }

    // 解密认证信息
    let auth_method_json = CryptoService::decrypt_password(
        &session.auth_method_encrypted,
        &session.auth_nonce,
        &current_user.device_id,
    )
        .map_err(|e| format!("Failed to decrypt auth method: {}", e))?;

    let auth_method: AuthMethod = serde_json::from_str(&auth_method_json)
        .map_err(|e| format!("Failed to parse auth method: {}", e))?;

    let result = serde_json::json!({
        "id": session.id,
        "userId": session.user_id,
        "name": session.name,
        "host": session.host,
        "port": session.port,
        "username": session.username,
        "groupName": session.group_name,
        "terminalType": session.terminal_type,
        "columns": session.columns,
        "rows": session.rows,
        "authMethod": auth_method_to_frontend(&auth_method),
        "strictHostKeyChecking": true,
        "keepAliveInterval": 30,
        "createdAt": session.created_at,
        "updatedAt": session.updated_at,
    });

    Ok(Some(result))
}
