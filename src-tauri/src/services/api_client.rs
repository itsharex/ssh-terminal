use anyhow::Result;
use anyhow::anyhow;
use reqwest::{Client, header};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::{Arc, Mutex};

use crate::models::user_auth::*;
use crate::models::user_profile::*;
use crate::models::sync::{
    SyncRequest, ResolveConflictRequest,
    ServerSyncResponse, ServerResolveConflictResponse,
};
use crate::types::response::ServerApiResponse;
use crate::database::repositories::UserAuthRepository;
use crate::services::CryptoService;
use crate::database::DbPool;

/// Token 更新回调类型：接收新token、新refresh_token和过期时间
type TokenUpdateCallback = Arc<Mutex<Option<Box<dyn Fn(String, String, Option<i64>) + Send + Sync>>>>;

/// Token 刷新失败的特殊错误码
pub const TOKEN_REFRESH_FAILED: &str = "TOKEN_REFRESH_FAILED";

/// 网络连接失败的错误码
pub const NETWORK_ERROR: &str = "NETWORK_ERROR";

/// 连接超时的错误码
pub const TIMEOUT_ERROR: &str = "TIMEOUT_ERROR";

/// HTTP API 客户端
/// 用于与服务器进行通信
#[derive(Clone)]
pub struct ApiClient {
    client: Client,
    server_url: String,
    access_token: Arc<Mutex<Option<String>>>,
    refresh_token_encrypted: Arc<Mutex<Option<String>>>,
    device_id: Arc<Mutex<Option<String>>>,
    token_update_callback: TokenUpdateCallback,
    language: Arc<Mutex<Option<String>>>,
}

impl ApiClient {
    /// 创建新的 API 客户端实例
    pub fn new(server_url: String, language: Option<String>) -> Result<Self> {
        // 规范化服务器 URL（去除末尾斜杠）
        let server_url = server_url.trim_end_matches('/').to_string();

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        Ok(Self {
            client,
            server_url,
            access_token: Arc::new(Mutex::new(None)),
            refresh_token_encrypted: Arc::new(Mutex::new(None)),
            device_id: Arc::new(Mutex::new(None)),
            token_update_callback: Arc::new(Mutex::new(None)),
            language: Arc::new(Mutex::new(language)),
        })
    }

    /// 设置访问令牌
    pub fn set_token(&self, token: String) {
        let mut guard = self.access_token.lock()
            .expect("Failed to acquire token lock");
        *guard = Some(token);
    }

    /// 设置刷新令牌（明文存储，服务器返回的 refresh_token 本身已加密）
    pub fn set_refresh_token(&self, refresh_token: String) {
        let mut guard = self.refresh_token_encrypted.lock().unwrap();
        *guard = Some(refresh_token);
    }

    /// 设置设备 ID
    pub fn set_device_id(&self, device_id: String) {
        let mut guard = self.device_id.lock().unwrap();
        *guard = Some(device_id);
    }

    /// 设置 token 更新回调函数
    /// 当 token 刷新成功时，会调用此回调更新数据库
    pub fn set_token_update_callback<F: Fn(String, String, Option<i64>) + Send + Sync + 'static>(
        &self,
        callback: F,
    ) {
        let mut guard = self.token_update_callback.lock().unwrap();
        *guard = Some(Box::new(callback));
    }

    /// 初始化 token 刷新回调（更新数据库和 ApiClient 的 refresh_token）
    ///
    /// # 参数
    /// * `pool` - 数据库连接池
    /// * `user_id` - 用户 ID
    /// * `device_id` - 设备 ID（用于加密 access_token）
    /// * `get_client` - 获取 ApiClient 的闭包（用于更新 refresh_token）
    pub fn init_token_refresh_callback<F: Fn() -> Result<ApiClient> + Clone + Send + Sync + 'static>(
        &self,
        pool: DbPool,
        user_id: String,
        device_id: String,
        get_client: F,
    ) {
        let pool_for_callback = pool;
        let user_id_for_callback = user_id;
        let device_id_for_callback = device_id;
        let get_client_for_callback = get_client;

        self.set_token_update_callback(move |access_token, refresh_token, expires_at| {
            let pool = pool_for_callback.clone();
            let user_id = user_id_for_callback.clone();
            let device_id = device_id_for_callback.clone();
            let get_client = get_client_for_callback.clone();

            tokio::spawn(async move {
                // 1. 更新数据库
                let repo = UserAuthRepository::new(pool.clone());
                let token_encrypted = match CryptoService::encrypt_token(&access_token, &device_id) {
                    Ok(encrypted) => encrypted,
                    Err(e) => {
                        tracing::error!("Failed to encrypt access_token: {}", e);
                        return;
                    }
                };

                let now = chrono::Utc::now().timestamp();
                let expires = expires_at.unwrap_or(now + 24 * 60 * 60);

                if let Err(e) = repo.update_token(&user_id, &token_encrypted, Some(&refresh_token), expires) {
                    tracing::error!("Failed to update tokens in db: {}", e);
                } else {
                    // 2. 更新 ApiClient 的 refresh_token
                    if let Ok(client) = get_client() {
                        client.set_refresh_token(refresh_token);
                        tracing::info!("Refresh token updated in ApiClient");
                    }
                }
            });
        });
    }

    /// 清除访问令牌
    pub fn clear_token(&self) {
        let mut guard = self.access_token.lock()
            .expect("Failed to acquire token lock");
        *guard = None;
    }

    /// 清除刷新令牌
    pub fn clear_refresh_token(&self) {
        let mut guard = self.refresh_token_encrypted.lock().unwrap();
        *guard = None;
    }

    /// 获取当前语言
    pub fn get_language(&self) -> Option<String> {
        let guard = self.language.lock().unwrap();
        guard.clone()
    }

    /// 设置语言
    pub fn set_language(&self, language: String) {
        let mut guard = self.language.lock().unwrap();
        *guard = Some(language);
    }

    /// 判断错误是否是 token 刷新失败（refresh_token 也失效）
    pub fn is_refresh_failure(error: &anyhow::Error) -> bool {
        let error_str = error.to_string();
        error_str.contains("Token 解码失败")
            || error_str.contains("InvalidToken")
            || error_str.contains("Token refresh failed (400")
            || error_str.contains(TOKEN_REFRESH_FAILED)
    }

    /// 判断是否是网络连接错误
    pub fn is_network_error(error: &anyhow::Error) -> bool {
        let error_str = error.to_string().to_lowercase();
        error_str.contains("network_error")
            || error_str.contains("timeout_error")
            || error_str.contains("connection refused")
            || error_str.contains("timeout")
            || error_str.contains("no route to host")
            || error_str.contains("dns error")
    }

    /// 获取当前令牌
    fn get_token(&self) -> Option<String> {
        let guard = self.access_token.lock()
            .expect("Failed to acquire token lock");
        guard.clone()
    }

    /// 构建完整 URL
    fn build_url(&self, path: &str) -> String {
        format!("{}/{}", self.server_url, path.trim_start_matches('/'))
    }

    /// 发送 GET 请求（带认证）
    async fn get_auth<T: DeserializeOwned>(&self, path: &str) -> Result<(T, u16, String)> {
        let url = self.build_url(path);
        let token = self.get_token()
            .ok_or_else(|| anyhow::anyhow!("No access token available"))?;
        let language = self.get_language();

        let mut request = self.client
            .get(&url)
            .header(header::AUTHORIZATION, format!("Bearer {}", token));

        if let Some(lang) = language {
            request = request.header("Accept-Language", lang);
        }

        match request.send().await
        {
            Ok(response) => {
                match self.handle_response(response).await {
                    Ok(result) => Ok(result),
                    Err(e) if e.to_string().contains("Token refreshed, please retry") => {
                        // Token 刷新成功，重试请求
                        tracing::info!("Retrying request with new token: GET {}", path);
                        let new_token = self.get_token()
                            .ok_or_else(|| anyhow::anyhow!("No access token available after refresh"))?;
                        let language = self.get_language();

                        let mut request = self.client
                            .get(&url)
                            .header(header::AUTHORIZATION, format!("Bearer {}", new_token));

                        if let Some(lang) = language {
                            request = request.header("Accept-Language", lang);
                        }

                        let response = request.send().await?;

                        self.handle_response(response).await
                    }
                    Err(e) => Err(e),
                }
            }
            Err(err) => {
                // 使用 reqwest 的错误判断方法
                if err.is_timeout() {
                    return Err(anyhow!("{}: 请求超时，请检查网络连接", TIMEOUT_ERROR));
                } else if err.is_connect() {
                    let err_str = err.to_string().to_lowercase();
                    if err_str.contains("connection refused") {
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行", NETWORK_ERROR));
                    } else if err_str.contains("no route to host") {
                        return Err(anyhow!("{}: 无法访问服务器，请检查网络连接和服务器地址", NETWORK_ERROR));
                    } else if err_str.contains("dns") {
                        return Err(anyhow!("{}: DNS 解析失败，请检查服务器地址是否正确", NETWORK_ERROR));
                    } else if err_str.contains("connection reset") || err_str.contains("reset by peer") {
                        return Err(anyhow!("{}: 连接被重置，服务器可能已关闭", NETWORK_ERROR));
                    } else {
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行或网络连接", NETWORK_ERROR));
                    }
                } else {
                    return Err(anyhow!("API error: {}", err));
                }
            }
        }
    }

    /// 发送 POST 请求（带认证）
    async fn post_auth<T: Serialize, R: DeserializeOwned>(&self, path: &str, body: &T) -> Result<(R, u16, String)> {
        let url = self.build_url(path);
        let token = self.get_token()
            .ok_or_else(|| anyhow::anyhow!("No access token available"))?;
        let language = self.get_language();

        let mut request = self.client
            .post(&url)
            .header(header::AUTHORIZATION, format!("Bearer {}", token))
            .header(header::CONTENT_TYPE, "application/json");

        if let Some(lang) = language {
            request = request.header("Accept-Language", lang);
        }

        match request.json(body).send().await
        {
            Ok(response) => {
                match self.handle_response(response).await {
                    Ok(result) => Ok(result),
                    Err(e) if e.to_string().contains("Token refreshed, please retry") => {
                        // Token 刷新成功，重试请求
                        tracing::info!("Retrying request with new token: POST {}", path);
                        let new_token = self.get_token()
                            .ok_or_else(|| anyhow::anyhow!("No access token available after refresh"))?;
                        let language = self.get_language();

                        let mut request = self.client
                            .post(&url)
                            .header(header::AUTHORIZATION, format!("Bearer {}", new_token))
                            .header(header::CONTENT_TYPE, "application/json");

                        if let Some(lang) = language {
                            request = request.header("Accept-Language", lang);
                        }

                        let response = request.json(body).send().await?;

                        self.handle_response(response).await
                    }
                    Err(e) => Err(e),
                }
            }
            Err(err) => {
                // 使用 reqwest 的错误判断方法
                if err.is_timeout() {
                    return Err(anyhow!("{}: 请求超时，请检查网络连接", TIMEOUT_ERROR));
                } else if err.is_connect() {
                    let err_str = err.to_string().to_lowercase();
                    if err_str.contains("connection refused") {
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行", NETWORK_ERROR));
                    } else if err_str.contains("no route to host") {
                        return Err(anyhow!("{}: 无法访问服务器，请检查网络连接和服务器地址", NETWORK_ERROR));
                    } else if err_str.contains("dns") {
                        return Err(anyhow!("{}: DNS 解析失败，请检查服务器地址是否正确", NETWORK_ERROR));
                    } else if err_str.contains("connection reset") || err_str.contains("reset by peer") {
                        return Err(anyhow!("{}: 连接被重置，服务器可能已关闭", NETWORK_ERROR));
                    } else {
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行或网络连接", NETWORK_ERROR));
                    }
                } else {
                    return Err(anyhow!("API error: {}", err));
                }
            }
        }
    }

    /// 发送 PUT 请求（带认证）
    async fn put_auth<T: Serialize, R: DeserializeOwned>(&self, path: &str, body: &T) -> Result<(R, u16, String)> {
        let url = self.build_url(path);
        let token = self.get_token()
            .ok_or_else(|| anyhow::anyhow!("No access token available"))?;
        let language = self.get_language();

        let mut request = self.client
            .put(&url)
            .header(header::AUTHORIZATION, format!("Bearer {}", token))
            .header(header::CONTENT_TYPE, "application/json");

        if let Some(lang) = language {
            request = request.header("Accept-Language", lang);
        }

        match request.json(body).send().await
        {
            Ok(response) => {
                match self.handle_response(response).await {
                    Ok(result) => Ok(result),
                    Err(e) if e.to_string().contains("Token refreshed, please retry") => {
                        // Token 刷新成功，重试请求
                        tracing::info!("Retrying request with new token: PUT {}", path);
                        let new_token = self.get_token()
                            .ok_or_else(|| anyhow::anyhow!("No access token available after refresh"))?;
                        let language = self.get_language();

                        let mut request = self.client
                            .put(&url)
                            .header(header::AUTHORIZATION, format!("Bearer {}", new_token))
                            .header(header::CONTENT_TYPE, "application/json");

                        if let Some(lang) = language {
                            request = request.header("Accept-Language", lang);
                        }

                        let response = request.json(body).send().await?;

                        self.handle_response(response).await
                    }
                    Err(e) => Err(e),
                }
            }
            Err(err) => {
                // 使用 reqwest 的错误判断方法
                if err.is_timeout() {
                    return Err(anyhow!("{}: 请求超时，请检查网络连接", TIMEOUT_ERROR));
                } else if err.is_connect() {
                    let err_str = err.to_string().to_lowercase();
                    if err_str.contains("connection refused") {
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行", NETWORK_ERROR));
                    } else if err_str.contains("no route to host") {
                        return Err(anyhow!("{}: 无法访问服务器，请检查网络连接和服务器地址", NETWORK_ERROR));
                    } else if err_str.contains("dns") {
                        return Err(anyhow!("{}: DNS 解析失败，请检查服务器地址是否正确", NETWORK_ERROR));
                    } else if err_str.contains("connection reset") || err_str.contains("reset by peer") {
                        return Err(anyhow!("{}: 连接被重置，服务器可能已关闭", NETWORK_ERROR));
                    } else {
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行或网络连接", NETWORK_ERROR));
                    }
                } else {
                    return Err(anyhow!("API error: {}", err));
                }
            }
        }
    }

    /// 发送 DELETE 请求（带认证）
    async fn delete_auth<R: DeserializeOwned>(&self, path: &str) -> Result<(R, u16, String)> {
        let url = self.build_url(path);
        let token = self.get_token()
            .ok_or_else(|| anyhow::anyhow!("No access token available"))?;
        let language = self.get_language();

        let mut request = self.client
            .delete(&url)
            .header(header::AUTHORIZATION, format!("Bearer {}", token));

        if let Some(lang) = language {
            request = request.header("Accept-Language", lang);
        }

        match request.send().await
        {
            Ok(response) => {
                match self.handle_response(response).await {
                    Ok(result) => Ok(result),
                    Err(e) if e.to_string().contains("Token refreshed, please retry") => {
                        // Token 刷新成功，重试请求
                        tracing::info!("Retrying request with new token: DELETE {}", path);
                        let new_token = self.get_token()
                            .ok_or_else(|| anyhow::anyhow!("No access token available after refresh"))?;
                        let language = self.get_language();

                        let mut request = self.client
                            .delete(&url)
                            .header(header::AUTHORIZATION, format!("Bearer {}", new_token));

                        if let Some(lang) = language {
                            request = request.header("Accept-Language", lang);
                        }

                        let response = request.send().await?;

                        self.handle_response(response).await
                    }
                    Err(e) => Err(e),
                }
            }
            Err(err) => {
                // 使用 reqwest 的错误判断方法
                if err.is_timeout() {
                    return Err(anyhow!("{}: 请求超时，请检查网络连接", TIMEOUT_ERROR));
                } else if err.is_connect() {
                    let err_str = err.to_string().to_lowercase();
                    if err_str.contains("connection refused") {
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行", NETWORK_ERROR));
                    } else if err_str.contains("no route to host") {
                        return Err(anyhow!("{}: 无法访问服务器，请检查网络连接和服务器地址", NETWORK_ERROR));
                    } else if err_str.contains("dns") {
                        return Err(anyhow!("{}: DNS 解析失败，请检查服务器地址是否正确", NETWORK_ERROR));
                    } else if err_str.contains("connection reset") || err_str.contains("reset by peer") {
                        return Err(anyhow!("{}: 连接被重置，服务器可能已关闭", NETWORK_ERROR));
                    } else {
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行或网络连接", NETWORK_ERROR));
                    }
                } else {
                    return Err(anyhow!("API error: {}", err));
                }
            }
        }
    }

    /// 发送 POST 请求（不带认证）
    async fn post_public<T: Serialize, R: DeserializeOwned>(&self, path: &str, body: &T) -> Result<(R, u16, String)> {
        let url = self.build_url(path);

        match self.client
            .post(&url)
            .header(header::CONTENT_TYPE, "application/json")
            .json(body)
            .send()
            .await
        {
            Ok(response) => self.handle_response(response).await,
            Err(err) => {
                // 使用 reqwest 的错误判断方法
                if err.is_timeout() {
                    return Err(anyhow!("{}: 请求超时，请检查网络连接", TIMEOUT_ERROR));
                } else if err.is_connect() {
                    let err_str = err.to_string().to_lowercase();
                    if err_str.contains("connection refused") {
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行", NETWORK_ERROR));
                    } else if err_str.contains("no route to host") {
                        return Err(anyhow!("{}: 无法访问服务器，请检查网络连接和服务器地址", NETWORK_ERROR));
                    } else if err_str.contains("dns") {
                        return Err(anyhow!("{}: DNS 解析失败，请检查服务器地址是否正确", NETWORK_ERROR));
                    } else if err_str.contains("connection reset") || err_str.contains("reset by peer") {
                        return Err(anyhow!("{}: 连接被重置，服务器可能已关闭", NETWORK_ERROR));
                    } else {
                        // 其他连接错误，可能是服务器未运行或网络问题
                        return Err(anyhow!("{}: 无法连接到服务器，请检查服务器是否运行或网络连接", NETWORK_ERROR));
                    }
                } else {
                    return Err(anyhow!("API error: {}", err));
                }
            }
        }
    }

    /// 处理 HTTP 响应（带 token 自动刷新）
    async fn handle_response<T: DeserializeOwned>(&self, response: reqwest::Response) -> Result<(T, u16, String)> {
        let status = response.status();

        if status.is_success() {
            // 尝试解析响应
            match self.parse_success_response(response).await {
                Ok(result) => Ok(result),
                Err(e) => {
                    // 检查是否需要刷新 token
                    if e.to_string().starts_with("TOKEN_NEED_REFRESH") {
                        tracing::warn!("Token expired (server returned 401), attempting to refresh");

                        if let Err(refresh_err) = self.try_refresh_token().await {
                            tracing::error!("Token refresh failed: {}", refresh_err);

                            // 如果是 refresh_token 失效，清除 token 并返回服务器消息
                            if Self::is_refresh_failure(&refresh_err) {
                                self.clear_token();
                                self.clear_refresh_token();
                                return Err(refresh_err);
                            }

                            return Err(anyhow!("Authentication failed: Token refresh failed - {}", refresh_err));
                        }

                        // 刷新成功，返回重试信号
                        Err(anyhow!("Token refreshed, please retry the request"))
                    } else {
                        Err(e)
                    }
                }
            }
        } else if status.as_u16() == 401 {
            // HTTP 401 错误，尝试自动刷新
            tracing::warn!("HTTP 401 error, attempting to refresh");

            if let Err(e) = self.try_refresh_token().await {
                tracing::error!("Token refresh failed: {}", e);

                if Self::is_refresh_failure(&e) {
                    self.clear_token();
                    self.clear_refresh_token();
                    return Err(e);
                }

                Err(anyhow!("Authentication failed: Token refresh failed - {}", e))
            } else {
                Err(anyhow!("Token refreshed, please retry the request"))
            }
        } else {
            let text = response.text().await.unwrap_or_else(|_| String::from("Failed to read error body"));
            tracing::error!("API error ({}): {}", status, text);
            Err(anyhow!("API error ({}): {}", status, text))
        }
    }

    /// 解析成功的 HTTP 响应
    async fn parse_success_response<T: DeserializeOwned>(&self, response: reqwest::Response) -> Result<(T, u16, String)> {
        let text = response.text().await?;
        tracing::debug!("API response: {}", text);

        // 解析服务器响应格式: { "code": 200, "message": "...", "data": {...} }
        let server_response: ServerApiResponse<T> = serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse JSON: {}", e))?;

        if server_response.is_success() {
            let code = server_response.code;
            let message = server_response.message.clone();
            server_response.data()
                .map(|data| (data, code, message))
                .ok_or_else(|| anyhow!("Server response missing data"))
        } else if server_response.code == 401 {
            // 服务器返回 401，需要刷新 token
            Err(anyhow!("TOKEN_NEED_REFRESH: {}", server_response.message))
        } else {
            Err(anyhow!("Server returned error: {}", server_response.message))
        }
    }

    /// 尝试刷新 token
    async fn try_refresh_token(&self) -> Result<()> {
        let refresh_token = self.refresh_token_encrypted.lock()
            .expect("Failed to acquire refresh_token lock")
            .as_ref()
            .ok_or_else(|| anyhow!("No refresh token available"))?
            .clone();

        let _device_id = self.device_id.lock()
            .expect("Failed to acquire device_id lock")
            .as_ref()
            .ok_or_else(|| anyhow!("No device_id available"))?
            .clone();

        // 调用刷新接口（公开接口，不需要 token）
        let url = self.build_url("auth/refresh");

        let response = self.client
            .post(&url)
            .header(header::CONTENT_TYPE, "application/json")
            .json(&serde_json::json!({ "refresh_token": refresh_token }))
            .send()
            .await?;

        if response.status().is_success() {
            let text = response.text().await?;
            let server_response: ServerApiResponse<ServerRefreshResult> = serde_json::from_str(&text)
                .map_err(|e| anyhow::anyhow!("Failed to parse refresh response: {}", e))?;

            if server_response.is_success() {
                if let Some(result) = server_response.data() {
                    // 更新 access_token
                    if let Ok(mut guard) = self.access_token.lock() {
                        *guard = Some(result.access_token.clone());
                    }

                    // 调用回调更新数据库
                    if let Some(guard) = self.token_update_callback.lock().ok() {
                        if let Some(callback) = guard.as_ref() {
                            let now = chrono::Utc::now().timestamp();
                            let expires_at = now + 24 * 60 * 60;
                            callback(result.access_token.clone(), result.refresh_token.clone(), Some(expires_at));
                        }
                    }

                    tracing::info!("Token refreshed successfully");
                    Ok(())
                } else {
                    Err(anyhow!("Server returned invalid data"))
                }
            } else {
                // 检查是否是刷新令牌失效
                if server_response.code == 400 && server_response.message.contains("刷新令牌") {
                    return Err(anyhow!("{}: {}", TOKEN_REFRESH_FAILED, server_response.message));
                }
                Err(anyhow!("Token refresh failed: {}", server_response.message))
            }
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(anyhow!("Token refresh failed ({}): {}", status, text))
        }
    }

    // ==================== 认证 API ====================

    /// 用户登录（返回服务器格式）
    pub async fn login(&self, req: &ServerLoginRequest) -> Result<(ServerLoginResult, u16, String)> {
        tracing::info!("API: login for {}", req.email);
        self.post_public("auth/login", req).await
    }

    /// 用户注册（返回服务器格式）
    pub async fn register(&self, req: &ServerRegisterRequest) -> Result<(ServerRegisterResult, u16, String)> {
        tracing::info!("API: register for {}", req.email);
        self.post_public("auth/register", req).await
    }

    /// 发送验证码（返回服务器格式）
    pub async fn send_verify_code(&self, req: &SendVerifyCodeRequest) -> Result<(EmailResult, u16, String)> {
        tracing::info!("API: send_verify_code for {}", req.email);
        self.post_public("auth/send-verify-code", req).await
    }

    /// 刷新访问令牌（返回服务器格式）
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<(ServerRefreshResult, u16, String)> {
        tracing::info!("API: refresh_token");
        self.post_public("auth/refresh", &serde_json::json!({
            "refresh_token": refresh_token
        })).await
    }

    // ==================== 用户资料 API ====================

    /// 获取用户资料
    pub async fn get_profile(&self) -> Result<(ServerUserProfile, u16, String)> {
        tracing::info!("API: get_profile");
        self.get_auth("api/user/profile").await
    }

    /// 更新用户资料
    pub async fn update_profile(&self, req: &ServerUpdateProfileRequest) -> Result<(ServerUserProfile, u16, String)> {
        tracing::info!("API: update_profile");
        self.put_auth("api/user/profile", req).await
    }

    /// 删除用户资料（软删除）
    pub async fn delete_profile(&self) -> Result<((), u16, String)> {
        tracing::info!("API: delete_profile");
        self.delete_auth("api/user/profile").await
    }

    // ==================== 同步 API ====================

    /// 统一同步
    pub async fn sync(&self, req: &SyncRequest) -> Result<(ServerSyncResponse, u16, String)> {
        tracing::info!("API: sync");
        self.post_auth("api/sync", req).await
    }

    /// 解决冲突
    pub async fn resolve_conflict(&self, req: &ResolveConflictRequest) -> Result<(ServerResolveConflictResponse, u16, String)> {
        tracing::info!("API: resolve_conflict for {:?}", req);
        self.post_auth("api/sync/resolve-conflict", req).await
    }
}
