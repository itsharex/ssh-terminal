use tauri::State;

use crate::database::DbPool;
use crate::models::user_profile::*;
use crate::services::{UserProfileService, SyncService};
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

/// 更新用户资料（只保存到本地数据库）
#[tauri::command]
pub async fn user_profile_update(
    req: UpdateProfileRequest,
    pool: State<'_, DbPool>,
    api_client: State<'_, ApiClientStateWrapper>,
) -> Result<UserProfile, String> {
    let service = UserProfileService::new(pool.inner().clone(), Some(api_client.inner().clone()));

    match service.update_profile(req).await {
        Ok(profile) => {
            tracing::info!("[commands::user_profile_update] 更新成功");
            Ok(profile)
        }
        Err(e) => {
            tracing::error!("[commands::user_profile_update] 更新失败: {}", e);
            Err(e.to_string())
        }
    }
}

/// 同步用户资料到服务器
#[tauri::command]
pub async fn user_profile_sync(
    pool: State<'_, DbPool>,
    api_client: State<'_, ApiClientStateWrapper>,
) -> Result<UserProfile, String> {
    tracing::info!("[commands::user_profile_sync] 开始同步用户资料到服务器");

    let sync_service = SyncService::new(pool.inner().clone(), Some(api_client.inner().clone()));

    match sync_service.sync_profile().await {
            Ok(_report) => {
              tracing::info!("[commands::user_profile_sync] 同步成功");            // 返回同步后的用户资料
            let profile_service = UserProfileService::new(pool.inner().clone(), Some(api_client.inner().clone()));
            profile_service.get_profile().await.map_err(|e| e.to_string())
        }
        Err(e) => {
            tracing::error!("[commands::user_profile_sync] 同步失败: {}", e);
            Err(e.to_string())
        }
    }
}
