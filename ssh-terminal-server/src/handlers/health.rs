use crate::AppState;
use crate::db;
use crate::domain::vo::{ApiResponse, health::*};
use axum::{
    extract::State,
    response::{IntoResponse, Json},
};
use crate::infra::middleware::Language;
use crate::utils::i18n::{t, MessageKey};

/// 健康检查端点
pub async fn health_check(
    State(state): State<AppState>,
    Language(language): Language,
) -> impl IntoResponse {
    match db::health_check(&state.pool).await {
        Ok(_) => {
            let message = t(Some(language.as_str()), MessageKey::SuccessHealthCheck);
            Json(ApiResponse::success_with_message(HealthCheckResult::ok(), &message))
        },
        Err(_) => {
            let message = t(Some(language.as_str()), MessageKey::SuccessHealthCheck);
            Json(ApiResponse::success_with_message(HealthCheckResult::unavailable(), &message))
        },
    }
}

/// 获取服务器信息
pub async fn server_info(Language(language): Language) -> impl IntoResponse {
    let message = t(Some(language.as_str()), MessageKey::SuccessServerInfo);
    Json(ApiResponse::success_with_message(ServerInfoResult::new(), &message))
}
