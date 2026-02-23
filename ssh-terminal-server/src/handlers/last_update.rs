use axum::{extract::State, Json};
use crate::{
    domain::vo::{ApiResponse, last_update::LastUpdateResponse},
    infra::middleware::{Language, UserId},
    repositories::ssh_session_repository::SshSessionRepository,
    repositories::user_profile_repository::UserProfileRepository,
    AppState,
    utils::i18n::{t, MessageKey},
};

/// 获取最近更新时间
pub async fn get_last_update(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Language(language): Language,
) -> Result<Json<ApiResponse<LastUpdateResponse>>, axum::http::StatusCode> {
    // 获取 SSH 会话最新更新时间
    let ssh_repo = SshSessionRepository::new(state.pool.clone());
    let ssh_last_updated = match ssh_repo.find_last_updated_at(&user_id).await {
        Ok(updated) => updated,
        Err(e) => {
            tracing::error!("Failed to get SSH session last updated: {}", e);
            return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 获取用户资料更新时间
    let profile_repo = UserProfileRepository::new(state.pool.clone());
    let profile_updated = match profile_repo.get_updated_at(&user_id).await {
        Ok(updated) => updated,
        Err(e) => {
            tracing::error!("Failed to get user profile last updated: {}", e);
            return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 取最大的更新时间
    let last_updated_at = match (ssh_last_updated, profile_updated) {
        (Some(ssh), Some(profile)) => ssh.max(profile),
        (Some(ssh), None) => ssh,
        (None, Some(profile)) => profile,
        (None, None) => 0, // 没有任何数据
    };

    let has_data = last_updated_at > 0;

    // 使用国际化消息
    let message = t(Some(language.as_str()), MessageKey::SuccessGetLastUpdate);

    Ok(Json(ApiResponse::success_with_message(
        LastUpdateResponse {
            last_updated_at,
            has_data,
        },
        &message,
    )))
}