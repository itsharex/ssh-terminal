use anyhow::Result;
use anyhow::anyhow;
use uuid::Uuid;

use crate::database::repositories::{UserAuthRepository, UserProfileRepository, AppSettingsRepository};
use crate::database::DbPool;
use crate::models::user_auth::*;
use crate::services::CryptoService;
use crate::services::api_client::ApiClient;
use crate::commands::auth::ApiClientStateWrapper;

/// 认证服务
pub struct AuthService {
    pool: DbPool,
    api_client_state: Option<ApiClientStateWrapper>,
}

impl AuthService {
    /// 创建新的认证服务实例
    ///
    /// # 参数
    /// * `pool` - 数据库连接池
    /// * `api_client_state` - 可选的全局 API Client 状态
    pub fn new(pool: DbPool, api_client_state: Option<ApiClientStateWrapper>) -> Self {
        Self {
            pool,
            api_client_state,
        }
    }

    /// 从全局状态获取 API 客户端
    fn get_api_client(&self) -> Result<ApiClient> {
        match &self.api_client_state {
            Some(state) => {
                state.get_client()
            }
            None => {
                Err(anyhow!("API client state not available - missing from service initialization"))
            }
        }
    }

    /// 更新全局 API 客户端的 token
    fn update_client_token(&self, token: String) {
        if let Some(state) = &self.api_client_state {
            state.set_token(token);
        }
    }

    /// 登录
    pub async fn login(&self, req: LoginRequest) -> Result<AuthResponse> {
        tracing::info!("Login request for: {}", req.email);

        // 从 app_settings 获取服务器地址
        let settings_repo = AppSettingsRepository::new(self.pool.clone());
        let server_url = settings_repo.get_server_url()?;

        // 创建 API 客户端
        let api_client = ApiClient::new(server_url.clone())?;

        // 设置到全局状态（如果有）
        if let Some(state) = &self.api_client_state {
            state.set_client(api_client.clone());
        }


        // 构建服务器 API 所需的请求（不需要 server_url）
        let api_req = crate::models::user_auth::ServerLoginRequest {
            email: req.email.clone(),
            password: req.password.clone(),
        };

        // 调用服务器登录 API
        let server_result = api_client.login(&api_req).await?;

        // 获取用户资料以获取 user_id
        let user_id = match api_client.get_profile().await {
            Ok(profile) => profile.user_id,
            Err(e) => {
                tracing::warn!("Failed to get user profile: {}, using email as fallback user_id", e);
                req.email.clone()
            }
        };

        // 生成设备 ID（本地生成，固定在设备上）
        let device_id = Uuid::new_v4().to_string();

        // 计算 token 过期时间（24小时后）
        let now = chrono::Utc::now().timestamp();
        let expires_at = now + 24 * 60 * 60;

        // 设置 token 到 API 客户端（server_result.access_token 是服务端返回的字段名）
        self.update_client_token(server_result.access_token.clone());

        // 加密 token
        let token_encrypted = CryptoService::encrypt_token(&server_result.access_token, &device_id)?;
        let refresh_token_encrypted = CryptoService::encrypt_token(&server_result.refresh_token, &device_id)?;

        // 加密用户密码（使用 device_id 作为密钥，固定在设备上）
        let password_encrypted = CryptoService::encrypt_password(&req.password, &device_id)?;

        // 保存用户认证信息
        let auth = UserAuth {
            id: 0,
            user_id: user_id.clone(),
            server_url: server_url.clone(),
            email: req.email.clone(),
            password_encrypted: password_encrypted.0,
            password_nonce: password_encrypted.1,
            access_token_encrypted: token_encrypted,
            refresh_token_encrypted: Some(refresh_token_encrypted),
            token_expires_at: Some(expires_at),
            device_id: device_id.clone(),
            last_sync_at: None,
            is_current: true,
            created_at: now,
            updated_at: now,
        };

        let repo = UserAuthRepository::new(self.pool.clone());
        repo.save(&auth)?;

        // 设置为当前账号
        repo.switch_account(&user_id)?;

        // 同步用户资料
        self.sync_user_profile(api_client.clone()).await?;

        // 构建客户端期望的 AuthResponse
        let auth_response = AuthResponse {
            token: server_result.access_token,
            refresh_token: server_result.refresh_token,
            user_id,
            email: req.email.clone(),
            device_id,
            server_url,
            expires_at,
        };

        Ok(auth_response)
    }

    /// 注册
    pub async fn register(&self, req: RegisterRequest) -> Result<AuthResponse> {
        tracing::info!("Register request for: {}", req.email);

        // 从 app_settings 获取服务器地址
        let settings_repo = AppSettingsRepository::new(self.pool.clone());
        let server_url = settings_repo.get_server_url()?;

        // 创建 API 客户端
        let api_client = ApiClient::new(server_url.clone())?;

        // 设置到全局状态（如果有）
        if let Some(state) = &self.api_client_state {
            state.set_client(api_client.clone());
        }


        // 构建服务器 API 所需的请求（不需要 server_url）
        let api_req = crate::models::user_auth::ServerRegisterRequest {
            email: req.email.clone(),
            password: req.password.clone(),
        };

        // 调用服务器注册 API（返回 ServerRegisterResult）
        let server_result = api_client.register(&api_req).await?;

        // 设置 token 到 API 客户端（server_result.access_token 是服务端返回的字段名）
        self.update_client_token(server_result.access_token.clone());

        // 生成设备 ID（本地生成，固定在设备上）
        let device_id = Uuid::new_v4().to_string();

        // 计算 token 过期时间（24小时后）
        let now = chrono::Utc::now().timestamp();
        let expires_at = now + 24 * 60 * 60;

        // 加密 token
        let token_encrypted = CryptoService::encrypt_token(&server_result.access_token, &device_id)?;
        let refresh_token_encrypted = CryptoService::encrypt_token(&server_result.refresh_token, &device_id)?;

        // 加密用户密码
        let password_encrypted = CryptoService::encrypt_password(&req.password, &device_id)?;

        // 保存用户认证信息（使用服务器返回的 user_id）
        let auth = UserAuth {
            id: 0,
            user_id: server_result.user_id.clone(),
            server_url: server_url.clone(),
            email: req.email.clone(),
            password_encrypted: password_encrypted.0,
            password_nonce: password_encrypted.1,
            access_token_encrypted: token_encrypted,
            refresh_token_encrypted: Some(refresh_token_encrypted),
            token_expires_at: Some(expires_at),
            device_id: device_id.clone(),
            last_sync_at: None,
            is_current: true,
            created_at: now,
            updated_at: now,
        };

        let repo = UserAuthRepository::new(self.pool.clone());
        repo.save(&auth)?;

        // 设置为当前账号
        repo.switch_account(&server_result.user_id)?;

        // 同步用户资料
        self.sync_user_profile(api_client.clone()).await?;

        // 构建客户端期望的 AuthResponse
        let auth_response = AuthResponse {
            token: server_result.access_token,
            refresh_token: server_result.refresh_token,
            user_id: server_result.user_id.clone(),
            email: server_result.email.clone(),
            device_id,
            server_url,
            expires_at,
        };

        Ok(auth_response)
    }

    /// 自动登录（启动时调用，使用数据库保存的加密密码）
    pub async fn auto_login(&self) -> Result<AuthResponse> {
        tracing::info!("Attempting auto login");

        let auth_repo = UserAuthRepository::new(self.pool.clone());

        // 获取当前用户认证信息
        let auth = auth_repo.find_current()?
            .ok_or_else(|| anyhow!("No current user found in database"))?;

        // 解密用户密码
        let password = CryptoService::decrypt_password(&auth.password_encrypted, &auth.password_nonce, &auth.device_id)?;

        // 创建 API 客户端
        let api_client = ApiClient::new(auth.server_url.clone())?;

        // 设置到全局状态（如果有）
        if let Some(state) = &self.api_client_state {
            state.set_client(api_client.clone());
        }


        // 构建服务器 API 所需的请求
        let api_req = crate::models::user_auth::ServerLoginRequest {
            email: auth.email.clone(),
            password: password.clone(),
        };

        // 调用服务器登录 API（返回 ServerLoginResult）
        let server_result = api_client.login(&api_req).await?;

        // 设置 token 到 API 客户端（server_result.access_token 是服务端返回的字段名）
        self.update_client_token(server_result.access_token.clone());

        // 使用数据库中存储的 device_id（保持一致）
        let device_id = auth.device_id.clone();

        // 计算 token 过期时间（24小时后）
        let now = chrono::Utc::now().timestamp();
        let expires_at = now + 24 * 60 * 60;

        // 加密新 token
        let token_encrypted = CryptoService::encrypt_token(&server_result.access_token, &device_id)?;
        let refresh_token_encrypted = CryptoService::encrypt_token(&server_result.refresh_token, &device_id)?;

        // 更新 token
        auth_repo.update_token(&auth.user_id, &token_encrypted, Some(&refresh_token_encrypted), expires_at)?;

        // 同步用户资料
        self.sync_user_profile(api_client.clone()).await?;

        // 重要：密码只在这次登录过程中使用，之后立即从内存中清除
        drop(password);

        // 构建客户端期望的 AuthResponse
        let auth_response = AuthResponse {
            token: server_result.access_token,
            refresh_token: server_result.refresh_token,
            user_id: auth.user_id.clone(),
            email: auth.email.clone(),
            device_id,
            server_url: auth.server_url.clone(),
            expires_at,
        };

        Ok(auth_response)
    }

    /// 检查是否有当前用户（用于前端判断是否显示登录界面）
    pub fn has_current_user(&self) -> bool {
        let auth_repo = UserAuthRepository::new(self.pool.clone());
        auth_repo.find_current().ok()
            .flatten()
            .is_some()
    }

    /// 登出（只清除 is_current 标记，不删除用户数据）
    pub fn logout(&self) -> Result<()> {
        tracing::info!("Logout request");

        // 清除全局 API Client
        if let Some(state) = &self.api_client_state {
            state.clear();
        }

        // 清除当前账号状态（不删除用户数据，只清除 is_current 标记）
        let auth_repo = UserAuthRepository::new(self.pool.clone());
        auth_repo.clear_current()?;

        Ok(())
    }

    /// 获取当前登录用户
    pub fn get_current_user(&self) -> Result<Option<UserAuth>> {
        let repo = UserAuthRepository::new(self.pool.clone());
        repo.find_current()
    }

    /// 获取所有账号
    pub fn list_accounts(&self) -> Result<Vec<UserAuth>> {
        let repo = UserAuthRepository::new(self.pool.clone());
        repo.find_all()
    }

    /// 切换账号
    /// 切换到指定账号并初始化 API Client（使用已保存的加密 token）
    pub fn switch_account(&self, user_id: &str) -> Result<()> {
        // 清除当前 API Client
        if let Some(state) = &self.api_client_state {
            state.clear();
        }

        // 切换数据库中的当前账号标记
        let repo = UserAuthRepository::new(self.pool.clone());
        repo.switch_account(user_id)?;

        // 获取新的当前用户
        let auth = repo.find_current()?
            .ok_or_else(|| anyhow!("Failed to find current user after switch"))?;

        // 创建并初始化 ApiClient
        let api_client = ApiClient::new(auth.server_url.clone())?;

        // 解密并设置 token
        let token = CryptoService::decrypt_token(&auth.access_token_encrypted, &auth.device_id)?;
        api_client.set_token(token);

        // 设置到全局状态
        if let Some(state) = &self.api_client_state {
            state.set_client(api_client);
        }

        tracing::info!("Switched to account: {} and API client initialized", auth.user_id);
        Ok(())
    }

    /// 删除账号（删除本地认证信息）
    pub fn delete_account(&self, user_id: &str) -> Result<()> {
        let repo = UserAuthRepository::new(self.pool.clone());
        repo.delete(user_id)?;
        Ok(())
    }

    /// 刷新访问令牌
    pub async fn refresh_access_token(&self) -> Result<()> {
        let repo = UserAuthRepository::new(self.pool.clone());

        let auth = repo.find_current()?
            .ok_or_else(|| anyhow!("No current user logged in"))?;

        tracing::info!("Refreshing token for user: {}", auth.user_id);

        // 解密 refresh token
        let refresh_token = CryptoService::decrypt_token(
            &auth.refresh_token_encrypted.ok_or_else(|| anyhow!("No refresh token"))?,
            &auth.device_id
        )?;

        // 获取 API 客户端
        let api_client = self.get_api_client()?;

        // 调用服务器刷新 token API（返回 ServerRefreshResult: access_token, refresh_token）
        let server_result = api_client.refresh_token(&refresh_token).await?;

        // 更新全局和本地 API 客户端的 token
        self.update_client_token(server_result.access_token.clone());

        // 加密新 token
        let token_encrypted = CryptoService::encrypt_token(&server_result.access_token, &auth.device_id)?;
        let refresh_token_encrypted =
            CryptoService::encrypt_token(&server_result.refresh_token, &auth.device_id)?;

        // 计算 token 过期时间（24小时后）
        let now = chrono::Utc::now().timestamp();
        let expires_at = now + 24 * 60 * 60;

        repo.update_token(&auth.user_id, &token_encrypted, Some(&refresh_token_encrypted), expires_at)?;
        tracing::info!("Token refreshed successfully");

        Ok(())
    }

    /// 同步用户资料
    /// 返回用户资料（以便获取 user_id）
    async fn sync_user_profile(&self, api_client: ApiClient) -> Result<Option<crate::models::user_profile::UserProfile>> {
        match api_client.get_profile().await {
            Ok(profile) => {
                let repo = UserProfileRepository::new(self.pool.clone());
                // 保存或更新用户资料到本地数据库
                let _ = repo.save(&profile);
                tracing::info!("User profile synced from server");
                Ok(Some(profile))
            }
            Err(e) => {
                tracing::warn!("Failed to sync user profile: {}", e);
                Ok(None)
            }
        }
    }

    /// 获取访问令牌
    pub fn get_access_token(&self) -> Result<String> {
        let repo = UserAuthRepository::new(self.pool.clone());

        if let Some(auth) = repo.find_current()? {
            CryptoService::decrypt_token(&auth.access_token_encrypted, &auth.device_id)
        } else {
            Err(anyhow::anyhow!("No user logged in"))
        }
    }
}
