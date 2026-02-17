use anyhow::Result;
use anyhow::anyhow;

use crate::database::repositories::{UserProfileRepository, UserAuthRepository};
use crate::database::DbPool;
use crate::models::user_profile::*;
use crate::services::api_client::ApiClient;
use crate::commands::auth::ApiClientStateWrapper;

/// 用户资料服务
pub struct UserProfileService {
    pool: DbPool,
    api_client_state: Option<ApiClientStateWrapper>,
}

impl UserProfileService {
    /// 创建新的用户资料服务实例
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

    /// 从全局状态获取或创建 API 客户端
    fn get_api_client(&self) -> Result<ApiClient> {
        // 如果有全局状态，优先使用
        if let Some(state) = &self.api_client_state {
            return state.get_client();
        }

        // 没有全局状态，返回错误（调用方应根据需要创建临时客户端）
        Err(anyhow!("API client state not available"))
    }

    /// 获取当前用户信息
    fn get_current_user(&self) -> Result<crate::models::user_auth::UserAuth> {
        let auth_repo = UserAuthRepository::new(self.pool.clone());
        auth_repo.find_current()?
            .ok_or_else(|| anyhow::anyhow!("No user logged in"))
    }

    /// 创建临时 API 客户端（带 token）
    fn create_temp_client(&self, user: &crate::models::user_auth::UserAuth) -> Result<ApiClient> {
        let client = ApiClient::new(user.server_url.clone())?;
        let token = crate::services::CryptoService::decrypt_token(
            &user.access_token_encrypted,
            &user.device_id
        )?;
        client.set_token(token);
        Ok(client)
    }

    /// 获取用户资料
    /// 优先从本地数据库获取，然后从服务器同步
    pub async fn get_profile(&self) -> Result<UserProfile> {
        let current_user = self.get_current_user()?;
        let profile_repo = UserProfileRepository::new(self.pool.clone());

        // 先尝试从本地数据库获取
        if let Some(local_profile) = profile_repo.find_by_user_id(&current_user.user_id)? {
            return Ok(local_profile);
        }

        // 本地不存在，从服务器获取
        let api_client = match self.get_api_client() {
            Ok(client) => client,
            Err(_) => self.create_temp_client(&current_user)?,
        };

        let server_profile = api_client.get_profile().await?;

        // 保存到本地数据库
        profile_repo.save(&server_profile)?;

        Ok(server_profile)
    }

    /// 更新用户资料
    /// 同步到服务器
    pub async fn update_profile(&self, req: UpdateProfileRequest) -> Result<UserProfile> {
        let current_user = self.get_current_user()?;

        let api_client = match self.get_api_client() {
            Ok(client) => client,
            Err(_) => self.create_temp_client(&current_user)?,
        };

        let server_profile = api_client.update_profile(&req).await?;

        // 更新本地数据库
        let profile_repo = UserProfileRepository::new(self.pool.clone());
        profile_repo.update(&current_user.user_id, &req)?;

        Ok(server_profile)
    }

    /// 删除用户资料
    /// 同步到服务器（软删除）
    pub async fn delete_profile(&self) -> Result<()> {
        let current_user = self.get_current_user()?;

        let api_client = match self.get_api_client() {
            Ok(client) => client,
            Err(_) => self.create_temp_client(&current_user)?,
        };

        api_client.delete_profile().await?;

        // 删除本地数据库记录
        let profile_repo = UserProfileRepository::new(self.pool.clone());
        profile_repo.delete(&current_user.user_id)?;

        Ok(())
    }
}
