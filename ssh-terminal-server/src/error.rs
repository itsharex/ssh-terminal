use crate::domain::vo::ApiResponse;
use crate::utils::i18n::t_error_default;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

/// 统一的 API 错误响应结构
#[derive(Debug)]
pub struct ErrorResponse {
    pub status: StatusCode,
    pub message: String,
}

impl ErrorResponse {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: format!("{}: {}", t_error_default(None), message.into()),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: message.into(),
        }
    }
}

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> Response {
        let body = ApiResponse::<()> {
            code: self.status.as_u16(),
            message: self.message,
            data: None,
        };

        (self.status, Json(body)).into_response()
    }
}
