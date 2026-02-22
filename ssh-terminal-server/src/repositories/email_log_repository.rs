use crate::domain::entities::email_logs;
use crate::utils::i18n::{MessageKey, t};
use anyhow::Result;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set};

/// 邮件日志仓库
pub struct EmailLogRepository {
    pub(crate) db: DatabaseConnection,
}

impl EmailLogRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// 创建邮件日志记录
    pub async fn create(
        &self,
        user_id: &str,
        email: &str,
        template: &str,
    ) -> Result<email_logs::Model> {
        let now = chrono::Utc::now().timestamp();
        let id = uuid::Uuid::new_v4().to_string();

        let log = email_logs::ActiveModel {
            id: Set(id.clone()),
            user_id: Set(user_id.to_string()),
            email: Set(email.to_string()),
            template: Set(template.to_string()),
            status: Set(email_logs::Model::STATUS_PENDING.to_string()),
            error_message: Set(None),
            retry_count: Set(0),
            created_at: Set(now),
            updated_at: Set(now),
        };

        let result = log.insert(&self.db).await
            .map_err(|e| anyhow::anyhow!("{}, {}", t(None, MessageKey::ErrorQueryFailed), e))?;

        Ok(result)
    }

    /// 根据邮箱查找最近的日志记录
    pub async fn find_latest_by_email(&self, email: &str) -> Result<Option<email_logs::Model>> {
        let log = email_logs::Entity::find()
            .filter(email_logs::Column::Email.eq(email))
            .order_by_desc(email_logs::Column::CreatedAt)
            .one(&self.db)
            .await
            .map_err(|e| anyhow::anyhow!("{}, {}", t(None, MessageKey::ErrorQueryFailed), e))?;

        Ok(log)
    }
}