use anyhow::Result;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::database::DbPool;
use crate::models::user_auth::*;
use crate::services::{AuthService, ApiClient};
use crate::types::response::ApiResponse;

/// 全局 API Client 状态
#[derive(Clone)]
pub struct ApiClientState {
    client: Arc<Mutex<Option<ApiClient>>>,
}

impl ApiClientState {
    pub fn new() -> Self {
        Self {
            client: Arc::new(Mutex::new(None)),
        }
    }

    /// 设置 API Client
    pub fn set_client(&self, client: ApiClient) {
        let mut guard = self.client.lock()
            .expect("Failed to acquire api_client lock");
        *guard = Some(client);
    }

    /// 获取 API Client
    pub fn get_client(&self) -> Result<ApiClient> {
        let guard = self.client.lock()
            .expect("Failed to acquire api_client lock");
        guard.as_ref()
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("API client not initialized"))
    }

    /// 清除 API Client
    pub fn clear(&self) {
        let mut guard = self.client.lock()
            .expect("Failed to acquire api_client lock");
        *guard = None;
    }

    /// 设置 token
    pub fn set_token(&self, token: String) {
        if let Ok(client) = self.get_client() {
            client.set_token(token);
        }
    }
}

/// Tauri State 类型别名
pub type ApiClientStateWrapper = Arc<ApiClientState>;

/// 用户登录
#[tauri::command]
pub async fn auth_login(
    req: LoginRequest,
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<ApiResponse<AuthResponse>, String> {
    let service = AuthService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    match service.login(req).await {
        Ok((auth_response, code, message)) => {
            Ok(ApiResponse {
                code,
                message,
                data: Some(auth_response),
            })
        }
        Err(e) => {
            let error_message = e.to_string();
            let (code, message) = extract_server_error(&error_message);
            Ok(ApiResponse {
                code,
                message,
                data: None,
            })
        }
    }
}

/// 用户注册
#[tauri::command]
pub async fn auth_register(
    req: RegisterRequest,
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<ApiResponse<AuthResponse>, String> {
    let service = AuthService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    match service.register(req).await {
        Ok((auth_response, code, message)) => {
            Ok(ApiResponse {
                code,
                message,
                data: Some(auth_response),
            })
        }
        Err(e) => {
            let error_message = e.to_string();
            let (code, message) = extract_server_error(&error_message);
            Ok(ApiResponse {
                code,
                message,
                data: None,
            })
        }
    }
}

/// 用户登出
#[tauri::command]
pub async fn auth_logout(
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<(), String> {
    let service = AuthService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    service.logout().map_err(|e| e.to_string())
}

/// 获取当前登录用户
#[tauri::command]
pub async fn auth_get_current_user(
    pool: State<'_, DbPool>,
) -> Result<Option<UserAuth>, String> {
    let service = AuthService::new(pool.inner().clone(), None);
    service.get_current_user().map_err(|e| e.to_string())
}

/// 获取所有账号列表
#[tauri::command]
pub async fn auth_list_accounts(
    pool: State<'_, DbPool>,
) -> Result<Vec<UserAuth>, String> {
    let service = AuthService::new(pool.inner().clone(), None);
    service.list_accounts().map_err(|e| e.to_string())
}

/// 切换账号
#[tauri::command]
pub async fn auth_switch_account(
    user_id: String,
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<(), String> {
    let service = AuthService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    service
        .switch_account(&user_id)
        .map_err(|e| e.to_string())
}

/// 刷新访问令牌
#[tauri::command]
pub async fn auth_refresh_token(
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<(), String> {
    let service = AuthService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    service
        .refresh_access_token()
        .await
        .map_err(|e| e.to_string())
}

/// 自动登录（启动时调用）
#[tauri::command]
pub async fn auth_auto_login(
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<AuthResponse, String> {
    let service = AuthService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    service
        .auto_login()
        .await
        .map_err(|e| e.to_string())
}

/// 检查是否有当前用户（用于判断是否需要显示登录界面）
#[tauri::command]
pub async fn auth_has_current_user(
    pool: State<'_, DbPool>,
) -> Result<bool, String> {
    let service = AuthService::new(pool.inner().clone(), None);
    Ok(service.has_current_user())
}

/// 删除账号
#[tauri::command]
pub async fn auth_delete_account(
    user_id: String,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    let service = AuthService::new(pool.inner().clone(), None);
    service
        .delete_account(&user_id)
        .map_err(|e| e.to_string())
}

/// 发送验证码到邮箱
/// 直接返回服务器的原始响应 {code, message, data}
#[tauri::command]
pub async fn auth_send_verify_code(
    email: String,
    pool: State<'_, DbPool>,
) -> Result<crate::types::response::ApiResponse<EmailResult>, String> {
    let service = AuthService::new(pool.inner().clone(), None);
    match service.send_verify_code(email).await {
        Ok((result, code, message)) => {
            Ok(crate::types::response::ApiResponse {
                code,
                message,
                data: Some(result),
            })
        }
        Err(e) => {
            // 尝试从错误中提取服务器返回的 message
            let error_message = e.to_string();
            let (code, message) = extract_server_error(&error_message);
            Ok(crate::types::response::ApiResponse {
                code,
                message,
                data: None,
            })
        }
    }
}

/// 辅助函数：从错误消息中提取服务器返回的 code 和 message
fn extract_server_error(error_str: &str) -> (u16, String) {
    // 匹配格式: API error (400 Bad Request): {"code":400,"message":"邮箱已注册","data":null}
    if let Some(json_str) = error_str.split_once(':').and_then(|(_, rest)| {
        rest.trim().strip_prefix('{').and_then(|s| s.strip_suffix('}'))
    }) {
        let json_str = format!("{{{}}}", json_str);
        if let Ok(server_response) = serde_json::from_str::<serde_json::Value>(&json_str) {
            let code = server_response.get("code")
                .and_then(|c| c.as_u64())
                .unwrap_or(500) as u16;
            let message = server_response.get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Unknown error");
            return (code, message.to_string());
        }
    }
    // 如果无法提取，返回通用错误
    (500, error_str.to_string())
}
