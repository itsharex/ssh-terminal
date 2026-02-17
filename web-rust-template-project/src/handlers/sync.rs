use axum::{extract::State, Json};
use validator::Validate;
use crate::domain::dto::sync::*;
use crate::domain::vo::{ApiResponse, sync::*};
use crate::services::sync_service::SyncService;
use crate::infra::middleware::UserId;
use crate::AppState;

/// Pull - 拉取服务器数据
pub async fn pull_handler(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Json(request): Json<PullRequest>,
) -> Result<Json<ApiResponse<PullResponse>>, axum::http::StatusCode> {
    // 验证请求
    if let Err(_) = request.validate() {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }

    let service = SyncService::new(state.pool);

    match service.pull(request, &user_id).await {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(e) => {
            tracing::error!("Pull failed: {}", e);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Push - 推送本地更改
pub async fn push_handler(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Json(request): Json<PushRequest>,
) -> Result<Json<ApiResponse<PushResponse>>, axum::http::StatusCode> {
    // 验证请求
    if let Err(_) = request.validate() {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }

    let service = SyncService::new(state.pool);

    match service.push(request, &user_id).await {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(e) => {
            tracing::error!("Push failed: {}", e);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Resolve Conflict - 解决冲突
pub async fn resolve_conflict_handler(
    State(state): State<AppState>,
    Json(request): Json<ResolveConflictRequest>,
) -> Result<Json<ApiResponse<ResolveConflictResponse>>, axum::http::StatusCode> {
    // 验证请求
    if let Err(_) = request.validate() {
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }

    let service = SyncService::new(state.pool);

    match service.resolve_conflict(request).await {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(e) => {
            tracing::error!("Resolve conflict failed: {}", e);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
