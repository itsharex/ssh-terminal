use tauri::State;

use crate::database::DbPool;
use crate::models::user_profile::*;
use crate::services::{UserProfileService, SyncService};
use crate::commands::auth::ApiClientStateWrapper;
use crate::types::response::ApiResponse;

/// 获取当前用户资料
#[tauri::command]
pub async fn user_profile_get(
    pool: State<'_, DbPool>,
    api_client: State<'_, ApiClientStateWrapper>,
) -> Result<ApiResponse<UserProfile>, String> {
    let service = UserProfileService::new(pool.inner().clone(), Some(api_client.inner().clone()));

    match service.get_profile().await {
        Ok((profile, code, message)) => {
            Ok(ApiResponse {
                code,
                message,
                data: Some(profile),
            })
        }
        Err(e) => {
            // 尝试从错误中提取服务器返回的 code 和 message
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

/// 更新用户资料（只保存到本地数据库）
#[tauri::command]
pub async fn user_profile_update(
    req: UpdateProfileRequest,
    pool: State<'_, DbPool>,
    api_client: State<'_, ApiClientStateWrapper>,
) -> Result<ApiResponse<UserProfile>, String> {
    let service = UserProfileService::new(pool.inner().clone(), Some(api_client.inner().clone()));

    match service.update_profile(req).await {
        Ok(profile) => {
            tracing::info!("[commands::user_profile_update] 更新成功");
            Ok(ApiResponse {
                code: 200,
                message: "Update profile successfully".to_string(),
                data: Some(profile),
            })
        }
        Err(e) => {
            tracing::error!("[commands::user_profile_update] 更新失败: {}", e);
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

/// 同步用户资料到服务器
#[tauri::command]
pub async fn user_profile_sync(
    pool: State<'_, DbPool>,
    api_client: State<'_, ApiClientStateWrapper>,
) -> Result<ApiResponse<UserProfile>, String> {
    tracing::info!("[commands::user_profile_sync] 开始同步用户资料到服务器");

    let sync_service = SyncService::new(pool.inner().clone(), Some(api_client.inner().clone()));

    match sync_service.sync_profile().await {
        Ok((_report, code, message)) => {
            tracing::info!("[commands::user_profile_sync] 同步成功: {}", message);
            // 返回同步后的用户资料
            let profile_service = UserProfileService::new(pool.inner().clone(), Some(api_client.inner().clone()));
            match profile_service.get_profile().await {
                Ok((profile, _, _msg)) => {
                    Ok(ApiResponse {
                        code,
                        message,
                        data: Some(profile),
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
        Err(e) => {
            tracing::error!("[commands::user_profile_sync] 同步失败: {}", e);
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
