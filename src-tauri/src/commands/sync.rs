use tauri::State;

use crate::database::DbPool;
use crate::models::sync::*;
use crate::services::SyncService;
use crate::commands::auth::ApiClientStateWrapper;
use crate::types::response::ApiResponse;

/// 立即执行同步（默认同步所有内容）
#[tauri::command]
pub async fn sync_now(
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<ApiResponse<SyncReport>, String> {
    let service = SyncService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    match service.sync_all().await {
        Ok((report, code, message)) => {
            Ok(ApiResponse {
                code,
                message,
                data: Some(report),
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

/// 获取同步状态
#[tauri::command]
pub async fn sync_get_status(
    pool: State<'_, DbPool>,
) -> Result<ApiResponse<SyncStatus>, String> {
    let service = SyncService::new(pool.inner().clone(), None);
    match service.get_sync_status() {
        Ok(status) => {
            Ok(ApiResponse {
                code: 200,
                message: "Get sync status successfully".to_string(),
                data: Some(status),
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

/// 解决冲突
#[tauri::command]
pub async fn sync_resolve_conflict(
    conflict_id: String,
    strategy: ConflictStrategy,
    pool: State<'_, DbPool>,
    api_client_state: State<'_, ApiClientStateWrapper>,
) -> Result<ApiResponse<SyncReport>, String> {
    let service = SyncService::new(pool.inner().clone(), Some(api_client_state.inner().clone()));
    match service.resolve_conflict_api(conflict_id, strategy).await {
        Ok((report, code, message)) => {
            Ok(ApiResponse {
                code,
                message,
                data: Some(report),
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

