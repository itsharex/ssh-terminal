use anyhow::Result;
use anyhow::anyhow;

use crate::database::repositories::{SshSessionRepository, SyncStateRepository, UserAuthRepository};
use crate::database::DbPool;
use crate::models::sync::*;
use crate::services::api_client::ApiClient;
use crate::commands::auth::ApiClientStateWrapper;

/// 同步服务
pub struct SyncService {
    pool: DbPool,
    api_client_state: Option<ApiClientStateWrapper>,
}

impl SyncService {
    /// 创建新的同步服务实例
    pub fn new(pool: DbPool, api_client_state: Option<ApiClientStateWrapper>) -> Self {
        Self {
            pool,
            api_client_state,
        }
    }

    /// 获取 API 客户端
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

    /// 完整同步（推送 + 拉取）
    pub async fn full_sync(&self) -> Result<SyncReport> {
        tracing::info!("Starting full sync");

        // 1. 检查是否有用户登录
        let auth_repo = UserAuthRepository::new(self.pool.clone());
        let current_user = auth_repo.find_current()?
            .ok_or_else(|| anyhow::anyhow!("No user logged in"))?;

        // 2. 构建同步请求
        let request = self.build_sync_request(&current_user.user_id)?;

        // 3. 发送同步请求（stub 实现）
        let response = self.send_sync_request(&request).await?;

        // 4. 应用服务器响应
        self.apply_sync_response(&response, &current_user.user_id)?;

        // 5. 清理脏标记
        let sync_time = response.last_sync_at;
        self.clear_dirty_markers(&request, sync_time, &current_user.user_id)?;

        // 6. 更新同步状态
        let state_repo = SyncStateRepository::new(self.pool.clone());
        state_repo.update_last_sync(sync_time)?;
        state_repo.update_pending_count(0)?;
        state_repo.update_conflict_count(response.conflicts.len() as i32)?;
        state_repo.update_last_error(None)?;

        tracing::info!("Sync completed successfully");

        Ok(SyncReport {
            success: true,
            last_sync_at: sync_time,
            pushed_sessions: request.sessions.as_ref().map(|s| s.len()).unwrap_or(0),
            pulled_sessions: response.upserted_sessions.len(),
            conflict_count: response.conflicts.len(),
            error: None,
            updated_session_ids: None,
        })
    }

    /// 构建同步请求
    fn build_sync_request(&self, user_id: &str) -> Result<SyncRequest> {
        let session_repo = SshSessionRepository::new(self.pool.clone());
        let state_repo = SyncStateRepository::new(self.pool.clone());

        // 获取所有脏数据
        let dirty_sessions = session_repo.get_dirty_sessions(user_id)?;

        // 获取最后同步时间
        let sync_state = state_repo.get()?;
        let last_sync_at = sync_state.last_sync_at;

        // 获取设备 ID
        let auth_repo = UserAuthRepository::new(self.pool.clone());
        let device_id = auth_repo.find_current()?
            .map(|u| u.device_id)
            .ok_or_else(|| anyhow::anyhow!("No user logged in"))?;

        Ok(SyncRequest {
            sessions: if dirty_sessions.is_empty() { None } else { Some(dirty_sessions) },
            last_sync_at,
            device_id: Some(device_id),
            user_profile: None,
            deleted_session_ids: None,
            entity_types: None, // entity_types 只用于 pull 请求，不在 build_sync_request 中设置
        })
    }

    /// 发送同步请求（stub 实现，预留服务器接口）
    async fn send_sync_request(&self, request: &SyncRequest) -> Result<SyncResponse> {
        // 获取 API 客户端
        let api_client = self.get_api_client()?;

        // 构建 pull 请求（添加 entity_types 字段）
        let pull_request = SyncRequest {
            sessions: None,
            last_sync_at: request.last_sync_at,
            device_id: request.device_id.clone(),
            user_profile: request.user_profile.clone(),
            deleted_session_ids: None,
            entity_types: Some(vec!["userProfile".to_string(), "sshSession".to_string()]),
        };

        // 先执行 pull
        let pull_response = api_client.sync_pull(&pull_request).await?;

        // 获取会话数量
        let ssh_sessions_len = pull_response.ssh_sessions.len();

        // 转换为内部 SyncResponse（ServerSshSession -> SshSession）
        let mut response = SyncResponse {
            status: "ok".to_string(),
            server_time: pull_response.server_time,
            last_sync_at: pull_response.last_sync_at,
            upserted_sessions: pull_response.ssh_sessions.into_iter().map(|s| s.into()).collect(),  // 转换 ServerSshSession -> SshSession
            deleted_session_ids: pull_response.deleted_session_ids,
            pushed_sessions: 0,
            pushed_total: 0,
            pulled_sessions: ssh_sessions_len,
            pulled_total: ssh_sessions_len,
            conflicts: pull_response.conflicts.into_iter().map(|c| ConflictInfo {
                id: c.id,
                entity_type: c.entity_type,
                local_version: c.client_ver,
                server_version: c.server_ver,
                message: c.message,
            }).collect(),
        };

        // 如果有本地数据需要推送，执行 push
        if request.sessions.is_some() {
            let push_response = api_client.sync_push(request).await?;

            // 合并响应
            response.deleted_session_ids.extend(push_response.deleted_session_ids);
            response.conflicts.extend(push_response.conflicts.into_iter().map(|c| ConflictInfo {
                id: c.id,
                entity_type: c.entity_type,
                local_version: c.client_ver,
                server_version: c.server_ver,
                message: c.message,
            }));
            response.pushed_sessions = push_response.updated_session_ids.len();
            response.pushed_total = push_response.updated_session_ids.len();
        }

        Ok(response)
    }

    /// 应用服务器响应
    fn apply_sync_response(&self, response: &SyncResponse, user_id: &str) -> Result<()> {
        let session_repo = SshSessionRepository::new(self.pool.clone());

        // 1. 应用 upserted 数据
        for server_session in &response.upserted_sessions {
            // 检查本地版本
            if let Some(local_session) = session_repo.find_by_id(&server_session.id)? {
                // 版本冲突检测
                if local_session.server_ver >= server_session.server_ver {
                    tracing::info!("Skipping server session (local version is newer or same)");
                    continue;
                }
            }

            // 应用服务器版本
            session_repo.update(server_session)?;
        }

        // 2. 应用删除（软删除）
        for session_id in &response.deleted_session_ids {
            session_repo.delete(session_id)?;
        }

        // 3. 处理冲突（stub 实现，创建冲突副本）
        for conflict in &response.conflicts {
            self.resolve_conflict(conflict, user_id)?;
        }

        Ok(())
    }

    /// 清理脏标记
    fn clear_dirty_markers(
        &self,
        request: &SyncRequest,
        sync_time: i64,
        user_id: &str,
    ) -> Result<()> {
        let session_repo = SshSessionRepository::new(self.pool.clone());

        if let Some(sessions) = &request.sessions {
            for session in sessions {
                session_repo.clear_dirty_marker(&session.id, sync_time)?;
            }
        }

        // 更新用户的最后同步时间
        let auth_repo = UserAuthRepository::new(self.pool.clone());
        auth_repo.update_last_sync(user_id, sync_time)?;

        Ok(())
    }

    /// 解决冲突（内部实现）
    fn resolve_conflict(&self, conflict: &ConflictInfo, user_id: &str) -> Result<()> {
        tracing::warn!(
            "Conflict detected for {}: {} (local: v{}, server: v{})",
            conflict.entity_type, conflict.id, conflict.local_version, conflict.server_version
        );

        // TODO: 实现冲突解决策略
        // 当前为 stub 实现，记录冲突但不处理

        Ok(())
    }

    /// 解决冲突（API 调用）
    pub async fn resolve_conflict_api(&self, conflict_id: String, strategy: ConflictStrategy) -> Result<SyncReport> {
        tracing::info!("Resolving conflict {} with strategy {:?}", conflict_id, strategy);

        // 获取 API 客户端
        let api_client = self.get_api_client()?;

        // 调用服务器 resolve-conflict API
        let request = ResolveConflictRequest {
            conflict_id: conflict_id.clone(),
            strategy,
            client_data: None,
        };

        let resolve_response = api_client.resolve_conflict(&request).await?;

        // 如果有新创建的 ID 或者需要获取更新后的数据，需要重新拉取
        let mut report = SyncReport {
            success: resolve_response.resolved,
            last_sync_at: chrono::Utc::now().timestamp(),
            pushed_sessions: 0,
            pulled_sessions: 0,
            conflict_count: 0,
            error: Some(resolve_response.message.clone()),
            updated_session_ids: None,
        };

        // 获取当前用户 ID
        let auth_repo = UserAuthRepository::new(self.pool.clone());
        let current_user = auth_repo.find_current()?
            .ok_or_else(|| anyhow::anyhow!("No user logged in"))?;

        // 如果冲突已解决，重新拉取数据
        if resolve_response.resolved {
            // 构建一个简单的 pull 请求
            // 获取设备 ID
            let auth_repo2 = UserAuthRepository::new(self.pool.clone());
            let device_id = auth_repo2.find_current()?
                .map(|u| u.device_id);

            let pull_request = SyncRequest {
                sessions: None,
                last_sync_at: None,
                device_id,
                user_profile: None,
                deleted_session_ids: None,
                entity_types: Some(vec!["userProfile".to_string(), "sshSession".to_string()]),
            };

            let pull_response = api_client.sync_pull(&pull_request).await?;

            // 应用拉取的数据（转换 ServerSshSession -> SshSession）
            let ssh_sessions_len = pull_response.ssh_sessions.len();
            let sync_response = SyncResponse {
                status: "ok".to_string(),
                server_time: pull_response.server_time,
                last_sync_at: pull_response.last_sync_at,
                upserted_sessions: pull_response.ssh_sessions.into_iter().map(|s| s.into()).collect(),
                deleted_session_ids: pull_response.deleted_session_ids,
                pushed_sessions: 0,
                pushed_total: 0,
                pulled_sessions: ssh_sessions_len,
                pulled_total: ssh_sessions_len,
                conflicts: Vec::new(),
            };

            self.apply_sync_response(&sync_response, &current_user.user_id)?;

            // 更新同步状态
            let state_repo = SyncStateRepository::new(self.pool.clone());
            state_repo.update_last_sync(pull_response.last_sync_at)?;
            state_repo.update_conflict_count(pull_response.conflicts.len() as i32)?;
            state_repo.update_last_error(None)?;

            report = SyncReport {
                success: true,
                last_sync_at: pull_response.last_sync_at,
                pushed_sessions: 0,
                pulled_sessions: ssh_sessions_len,
                conflict_count: pull_response.conflicts.len(),
                error: None,
                updated_session_ids: resolve_response.new_id.map(|id| vec![id]),
            };
        }

        Ok(report)
    }

    /// 获取同步状态
    pub fn get_sync_status(&self) -> Result<SyncStatus> {
        let state_repo = SyncStateRepository::new(self.pool.clone());
        state_repo.get()
    }

    /// 手动触发同步（返回 Future）
    pub fn sync_now(&self) -> Result<SyncReport> {
        // 注意：由于 async，实际使用时需要在 async 上下文中调用
        // 这里提供一个同步的 stub 版本
        Ok(SyncReport {
            success: false,
            last_sync_at: 0,
            pushed_sessions: 0,
            pulled_sessions: 0,
            conflict_count: 0,
            error: Some("Use async full_sync instead".to_string()),
            updated_session_ids: None,
        })
    }
}
