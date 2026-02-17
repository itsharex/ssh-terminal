use anyhow::Result;
use reqwest::{Client, header};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::{Arc, Mutex};

use crate::models::user_auth::*;
use crate::models::user_profile::*;
use crate::models::sync::{
    SyncRequest, ResolveConflictRequest,
    ServerPullResponse, ServerPushResponse, ServerResolveConflictResponse,
};
use crate::types::response::ServerApiResponse;

/// HTTP API 客户端
/// 用于与服务器进行通信
#[derive(Clone)]
pub struct ApiClient {
    client: Client,
    server_url: String,
    access_token: Arc<Mutex<Option<String>>>,
}

impl ApiClient {
    /// 创建新的 API 客户端实例
    pub fn new(server_url: String) -> Result<Self> {
        // 规范化服务器 URL（去除末尾斜杠）
        let server_url = server_url.trim_end_matches('/').to_string();

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        Ok(Self {
            client,
            server_url,
            access_token: Arc::new(Mutex::new(None)),
        })
    }

    /// 设置访问令牌
    pub fn set_token(&self, token: String) {
        let mut guard = self.access_token.lock()
            .expect("Failed to acquire token lock");
        *guard = Some(token);
    }

    /// 清除访问令牌
    pub fn clear_token(&self) {
        let mut guard = self.access_token.lock()
            .expect("Failed to acquire token lock");
        *guard = None;
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
    async fn get_auth<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = self.build_url(path);
        let token = self.get_token()
            .ok_or_else(|| anyhow::anyhow!("No access token available"))?;

        let response = self.client
            .get(&url)
            .header(header::AUTHORIZATION, format!("Bearer {}", token))
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// 发送 POST 请求（带认证）
    async fn post_auth<T: Serialize, R: DeserializeOwned>(&self, path: &str, body: &T) -> Result<R> {
        let url = self.build_url(path);
        let token = self.get_token()
            .ok_or_else(|| anyhow::anyhow!("No access token available"))?;

        let response = self.client
            .post(&url)
            .header(header::AUTHORIZATION, format!("Bearer {}", token))
            .header(header::CONTENT_TYPE, "application/json")
            .json(body)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// 发送 PUT 请求（带认证）
    async fn put_auth<T: Serialize, R: DeserializeOwned>(&self, path: &str, body: &T) -> Result<R> {
        let url = self.build_url(path);
        let token = self.get_token()
            .ok_or_else(|| anyhow::anyhow!("No access token available"))?;

        let response = self.client
            .put(&url)
            .header(header::AUTHORIZATION, format!("Bearer {}", token))
            .header(header::CONTENT_TYPE, "application/json")
            .json(body)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// 发送 DELETE 请求（带认证）
    async fn delete_auth<R: DeserializeOwned>(&self, path: &str) -> Result<R> {
        let url = self.build_url(path);
        let token = self.get_token()
            .ok_or_else(|| anyhow::anyhow!("No access token available"))?;

        let response = self.client
            .delete(&url)
            .header(header::AUTHORIZATION, format!("Bearer {}", token))
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// 发送 POST 请求（不带认证）
    async fn post_public<T: Serialize, R: DeserializeOwned>(&self, path: &str, body: &T) -> Result<R> {
        let url = self.build_url(path);

        let response = self.client
            .post(&url)
            .header(header::CONTENT_TYPE, "application/json")
            .json(body)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// 处理 HTTP 响应
    async fn handle_response<T: DeserializeOwned>(&self, response: reqwest::Response) -> Result<T> {
        let status = response.status();

        if status.is_success() {
            let text = response.text().await?;
            tracing::debug!("API response: {}", text);

            // 解析服务器响应格式: { "code": 200, "message": "...", "data": {...} }
            let server_response: ServerApiResponse<T> = serde_json::from_str(&text)
                .map_err(|e| anyhow::anyhow!("Failed to parse JSON: {}", e))?;

            if server_response.is_success() {
                server_response.data()
                    .ok_or_else(|| anyhow::anyhow!("Server response missing data"))
            } else {
                Err(anyhow::anyhow!("Server returned error: {}", server_response.message))
            }
        } else if status.as_u16() == 401 {
            Err(anyhow::anyhow!("Authentication failed: Invalid or expired token"))
        } else {
            let text = response.text().await.unwrap_or_else(|_| String::from("Failed to read error body"));
            tracing::error!("API error ({}): {}", status, text);
            Err(anyhow::anyhow!("API error ({}): {}", status, text))
        }
    }

    // ==================== 认证 API ====================

    /// 用户登录（返回服务器格式）
    pub async fn login(&self, req: &ServerLoginRequest) -> Result<ServerLoginResult> {
        tracing::info!("API: login for {}", req.email);
        self.post_public("auth/login", req).await
    }

    /// 用户注册（返回服务器格式）
    pub async fn register(&self, req: &ServerRegisterRequest) -> Result<ServerRegisterResult> {
        tracing::info!("API: register for {}", req.email);
        self.post_public("auth/register", req).await
    }

    /// 刷新访问令牌（返回服务器格式）
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<ServerRefreshResult> {
        tracing::info!("API: refresh_token");
        self.post_public("auth/refresh", &serde_json::json!({
            "refresh_token": refresh_token
        })).await
    }

    // ==================== 用户资料 API ====================

    /// 获取用户资料
    pub async fn get_profile(&self) -> Result<UserProfile> {
        tracing::info!("API: get_profile");
        self.get_auth("api/user/profile").await
    }

    /// 更新用户资料
    pub async fn update_profile(&self, req: &UpdateProfileRequest) -> Result<UserProfile> {
        tracing::info!("API: update_profile");
        self.put_auth("api/user/profile", req).await
    }

    /// 删除用户资料（软删除）
    pub async fn delete_profile(&self) -> Result<()> {
        tracing::info!("API: delete_profile");
        self.delete_auth("api/user/profile").await
    }

    // ==================== 同步 API ====================

    /// 拉取服务器数据
    pub async fn sync_pull(&self, req: &SyncRequest) -> Result<ServerPullResponse> {
        tracing::info!("API: sync_pull");
        self.post_auth("api/sync/pull", req).await
    }

    /// 推送本地更改到服务器
    pub async fn sync_push(&self, req: &SyncRequest) -> Result<ServerPushResponse> {
        tracing::info!("API: sync_push");
        self.post_auth("api/sync/push", req).await
    }

    /// 解决冲突
    pub async fn resolve_conflict(&self, req: &ResolveConflictRequest) -> Result<ServerResolveConflictResponse> {
        tracing::info!("API: resolve_conflict for {:?}", req);
        self.post_auth("api/sync/resolve-conflict", req).await
    }
}
