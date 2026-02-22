use crate::AppState;
use crate::repositories::user_repository::UserRepository;
use crate::error::ErrorResponse;
use crate::infra::middleware::UserId;
use crate::utils::i18n::{t, MessageKey};
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    #[allow(dead_code)]
    pub exp: usize,
}

/// JWT 认证中间件
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, ErrorResponse> {
    // 1. 提取 Authorization header
    let headers = req.headers();
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| ErrorResponse::unauthorized(t(None, MessageKey::ErrorMissingAuthHeader)))?;

    if !auth_header.starts_with("Bearer ") {
        return Err(ErrorResponse::unauthorized(t(None, MessageKey::ErrorInvalidAuthFormat)));
    }

    let token = &auth_header[7..];

    // 2. 验证 JWT
    let jwt_secret = &state.config.auth.jwt_secret;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|_| ErrorResponse::unauthorized(t(None, MessageKey::ErrorInvalidToken)))?;

    let user_id = &token_data.claims.sub;

    // 3. 检查用户是否已被软删除
    let user_repo = UserRepository::new(state.pool.clone());
    let user = user_repo
        .find_by_id_raw(user_id)
        .await
        .map_err(|_| ErrorResponse::internal(t(None, MessageKey::ErrorVerifyUserFailed)))?;

    if user.map(|u| u.deleted_at.is_some()).unwrap_or(true) {
        // 用户不存在或已被删除
        return Err(ErrorResponse::unauthorized(t(None, MessageKey::ErrorUserNotFoundOrDeleted)));
    }

    // 4. 将 user_id 添加到请求扩展
    req.extensions_mut().insert(UserId(user_id.clone()));

    Ok(next.run(req).await)
}
