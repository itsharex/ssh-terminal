use tauri::State;

use crate::database::DbPool;
use crate::models::sync::*;
use crate::services::SyncService;
use crate::commands::auth::ApiClientStateWrapper;

/// 立即执行同步（默认同步所有内容）
#[tauri::command]
pub async fn sync_now(
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<SyncReport, String> {
    let service = SyncService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    service
        .sync_all()
        .await
        .map_err(|e| e.to_string())
}

/// 获取同步状态
#[tauri::command]
pub async fn sync_get_status(
    pool: State<'_, DbPool>,
) -> Result<SyncStatus, String> {
    let service = SyncService::new(pool.inner().clone(), None);
    service.get_sync_status().map_err(|e| e.to_string())
}

/// 解决冲突
#[tauri::command]
pub async fn sync_resolve_conflict(
    conflict_id: String,
    strategy: ConflictStrategy,
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<SyncReport, String> {
    let service = SyncService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    service
        .resolve_conflict_api(conflict_id, strategy)
        .await
        .map_err(|e| e.to_string())
}

