use axum::{
    extract::FromRequestParts,
};
use async_trait::async_trait;
use crate::error::ErrorResponse;
use crate::utils::i18n::{t, MessageKey, ZH_CN};
use super::Language;

/// 用户 ID extractor
/// 从请求扩展中提取 user_id（由认证中间件设置）
#[derive(Debug, Clone)]
pub struct UserId(pub String);

#[async_trait]
impl<S> FromRequestParts<S> for UserId
where
    S: Send + Sync,
{
    type Rejection = ErrorResponse;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        // 提取 language
        let language = parts
            .extensions
            .get::<Language>()
            .map(|lang| lang.0.as_str())
            .unwrap_or(ZH_CN);

        // 从请求扩展中获取 UserId 类型
        parts
            .extensions
            .get::<UserId>()
            .cloned()
            .ok_or_else(|| ErrorResponse::unauthorized(t(Some(language), MessageKey::ErrorUserIdNotFound)))
    }
}
