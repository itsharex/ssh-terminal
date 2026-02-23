use crate::AppState;
use crate::repositories::user_repository::UserRepository;
use crate::error::ErrorResponse;
use crate::infra::middleware::{UserId, Language, logging::{RequestId, log_info}};
use crate::utils::i18n::{t, MessageKey, ZH_CN};
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
    // 提取 language
    let language = req
        .extensions()
        .get::<Language>()
        .map(|lang| lang.0.as_str())
        .unwrap_or(ZH_CN);

    // 1. 提取 Authorization header
    let headers = req.headers();
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| ErrorResponse::unauthorized(t(Some(language), MessageKey::ErrorMissingAuthHeader)))?;

    if !auth_header.starts_with("Bearer ") {
        return Err(ErrorResponse::unauthorized(t(Some(language), MessageKey::ErrorInvalidAuthFormat)));
    }

    let token = &auth_header[7..];

    // 2. 验证 JWT
    let jwt_secret = &state.config.auth.jwt_secret;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|_| ErrorResponse::unauthorized(t(Some(language), MessageKey::ErrorInvalidToken)))?;

    let user_id = &token_data.claims.sub;

    // 3. 检查用户是否已被软删除
    let user_repo = UserRepository::new(state.pool.clone());
    let user = user_repo
        .find_by_id_raw(user_id)
        .await
        .map_err(|_| ErrorResponse::internal(t(Some(language), MessageKey::ErrorVerifyUserFailed)))?;

    if user.map(|u| u.deleted_at.is_some()).unwrap_or(true) {
        // 用户不存在或已被删除
        return Err(ErrorResponse::unauthorized(t(Some(language), MessageKey::ErrorUserNotFoundOrDeleted)));
    }

    // 4. 使用 log_info 打印 user_id
    let request_id = req
        .extensions()
        .get::<RequestId>()
        .cloned()
        .unwrap_or_else(|| RequestId("unknown".to_string()));

    log_info(&request_id, "UserId", user_id);

    // 5. 将 user_id 添加到请求扩展
    req.extensions_mut().insert(UserId(user_id.clone()));

    Ok(next.run(req).await)
}
