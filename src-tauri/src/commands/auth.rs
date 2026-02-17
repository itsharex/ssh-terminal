use anyhow::Result;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::database::DbPool;
use crate::models::user_auth::*;
use crate::services::{AuthService, ApiClient};

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
) -> Result<AuthResponse, String> {
    let service = AuthService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    service
        .login(req)
        .await
        .map_err(|e| e.to_string())
}

/// 用户注册
#[tauri::command]
pub async fn auth_register(
    req: RegisterRequest,
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<AuthResponse, String> {
    let service = AuthService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    service
        .register(req)
        .await
        .map_err(|e| e.to_string())
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
