use tauri::State;

use crate::database::DbPool;
use crate::models::user_profile::*;
use crate::services::UserProfileService;
use crate::commands::auth::ApiClientStateWrapper;

/// 获取当前用户资料
#[tauri::command]
pub async fn user_profile_get(
    pool: State<'_, DbPool>,
    api_client: State<'_, ApiClientStateWrapper>,
) -> Result<UserProfile, String> {
    let service = UserProfileService::new(pool.inner().clone(), Some(api_client.inner().clone()));
    service
        .get_profile()
        .await
        .map_err(|e| e.to_string())
}

/// 更新用户资料
#[tauri::command]
pub async fn user_profile_update(
    req: UpdateProfileRequest,
    pool: State<'_, DbPool>,
    api_client: State<'_, ApiClientStateWrapper>,
) -> Result<UserProfile, String> {
    let service = UserProfileService::new(pool.inner().clone(), Some(api_client.inner().clone()));
    service
        .update_profile(req)
        .await
        .map_err(|e| e.to_string())
}

/// 删除用户资料（软删除）
#[tauri::command]
pub async fn user_profile_delete(
    pool: State<'_, DbPool>,
    api_client: State<'_, ApiClientStateWrapper>,
) -> Result<(), String> {
    let service = UserProfileService::new(pool.inner().clone(), Some(api_client.inner().clone()));
    service
        .delete_profile()
        .await
        .map_err(|e| e.to_string())
}
