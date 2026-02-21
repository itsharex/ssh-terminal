use axum::{
    extract::{FromRequestParts, Request},
    http::{StatusCode, request::Parts},
    middleware::Next,
    response::Response,
};
use async_trait::async_trait;
use std::ops::Deref;

use crate::utils::i18n::{ZH_CN, EN};

/// 语言提取器（用于 handler 参数）
#[derive(Debug, Clone)]
pub struct Language(pub String);

impl Deref for Language {
    type Target = String;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for Language
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<Language>()
            .cloned()
            .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Language not set by middleware"))
    }
}

/// 语言中间件 - 从 Accept-Language header 提取语言参数
pub async fn language_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let language = req
        .headers()
        .get("Accept-Language")
        .and_then(|h| h.to_str().ok())
        .map(|s| {
            s.split(',').next().unwrap_or(ZH_CN).trim().to_string()
        })
        .filter(|lang| *lang == ZH_CN || *lang == EN)
        .unwrap_or_else(|| ZH_CN.to_string());

    req.extensions_mut().insert(Language(language));

    Ok(next.run(req).await)
}