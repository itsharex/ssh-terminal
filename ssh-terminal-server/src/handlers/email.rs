use crate::domain::dto::mail::{SendVerifyCodeRequest, GetLatestEmailLogRequest};
use crate::domain::vo::mail::{EmailResult, EmailStatusVO, EmailQueueStatusVO};
use crate::domain::vo::ApiResponse;
use crate::infra::middleware::language::Language;
use crate::infra::middleware::logging::RequestId;
use crate::infra::middleware::user_id::UserId;
use crate::infra::mail::queue::MailQueue;
use crate::repositories::email_log_repository::EmailLogRepository;
use crate::services::mail_service::MailService;
use crate::utils::i18n::{t, MessageKey};
use axum::{extract::{Extension, State}, Json};
use tracing::info;

/// 发送验证码邮件（公开 API，无需认证）
pub async fn send_verify_code_handler(
    Extension(request_id): Extension<RequestId>,
    Language(language): Language,
    State(state): State<crate::AppState>,
    Json(payload): Json<SendVerifyCodeRequest>,
) -> Result<Json<ApiResponse<EmailResult>>, crate::error::ErrorResponse> {
    info!("[{}] 发送验证码邮件请求: email={}", request_id.0, payload.email);

    // 检查邮件功能是否启用
    if !state.config.email.enabled {
        let message = t(Some(language.as_str()), MessageKey::ErrorEmailDisabled);
        return Err(crate::error::ErrorResponse::new(message));
    }

    // 创建 Repository
    let email_log_repo = EmailLogRepository::new(state.pool.clone());

    // 创建 Service
    let mail_service = MailService::new(state.redis_client.clone(), email_log_repo);

    // 使用 email 作为临时 user_id（因为用户还未注册）
    let temp_user_id = &payload.email;

    // 调用 Service
    match mail_service
        .send_verify_code(temp_user_id, &payload.email, &language)
        .await
    {
        Ok(result) => {
            let message = t(Some(language.as_str()), MessageKey::SuccessEmailQueued);
            let response = ApiResponse::success_with_message(result, &message);
            info!("[{}] 验证码邮件已加入队列: {}", request_id.0, payload.email);
            Ok(Json(response))
        }
        Err(e) => {
            info!("[{}] 发送验证码邮件失败: {}", request_id.0, e.to_string());
            Err(crate::error::ErrorResponse::new(e.to_string()))
        }
    }
}

/// 获取最新邮件日志状态（需要认证）
pub async fn get_latest_email_log_handler(
    Extension(request_id): Extension<RequestId>,
    Language(language): Language,
    UserId(user_id): UserId,
    State(state): State<crate::AppState>,
    Json(payload): Json<GetLatestEmailLogRequest>,
) -> Result<Json<ApiResponse<Option<EmailStatusVO>>>, crate::error::ErrorResponse> {
    info!("[{}] 查询最新邮件日志: user_id={}, email={}", request_id.0, user_id, payload.email);

    // 检查邮件功能是否启用
    if !state.config.email.enabled {
        let message = t(Some(language.as_str()), MessageKey::ErrorEmailDisabled);
        return Err(crate::error::ErrorResponse::new(message));
    }

    let email_log_repo = EmailLogRepository::new(state.pool.clone());
    match email_log_repo.find_latest_by_email(&payload.email).await {
        Ok(Some(log)) => {
            let vo = EmailStatusVO {
                id: log.id,
                user_id: log.user_id,
                email: log.email,
                template: log.template,
                status: log.status,
                error_message: log.error_message,
                retry_count: log.retry_count,
                created_at: log.created_at,
                updated_at: log.updated_at,
            };
            let message = "获取邮件日志成功".to_string();
            let response = ApiResponse::success_with_message(Some(vo), &message);
            Ok(Json(response))
        }
        Ok(None) => {
            let message = "未找到邮件日志".to_string();
            let response = ApiResponse::success_with_message(None::<EmailStatusVO>, &message);
            Ok(Json(response))
        }
        Err(e) => {
            info!("[{}] 查询邮件日志失败: {}", request_id.0, e.to_string());
            Err(crate::error::ErrorResponse::new(e.to_string()))
        }
    }
}

/// 获取邮件队列状态（需要认证）
pub async fn get_queue_status_handler(
    Extension(request_id): Extension<RequestId>,
    Language(language): Language,
    UserId(_user_id): UserId,
    State(state): State<crate::AppState>,
) -> Result<Json<ApiResponse<EmailQueueStatusVO>>, crate::error::ErrorResponse> {
    info!("[{}] 查询邮件队列状态", request_id.0);

    // 检查邮件功能是否启用
    if !state.config.email.enabled {
        let message = t(Some(language.as_str()), MessageKey::ErrorEmailDisabled);
        return Err(crate::error::ErrorResponse::new(message));
    }

    let mail_queue = MailQueue::new(state.redis_client.clone());
    
    // 获取队列长度
    let queue_len = mail_queue.queue_len().await
        .unwrap_or(0);
    
    // 获取死信队列长度
    let dead_letter_len = mail_queue.dead_letter_len().await
        .unwrap_or(0);

    let status = EmailQueueStatusVO {
        queue_length: queue_len,
        dead_letter_length: dead_letter_len,
        enabled: state.config.email.enabled,
    };

    let message = "获取队列状态成功".to_string();
    let response = ApiResponse::success_with_message(status, &message);
    Ok(Json(response))
}