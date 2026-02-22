use sea_orm::entity::prelude::*;
use sea_orm::Set;
use serde::{Deserialize, Serialize};

/// 邮件发送日志实体
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "email_logs")]
pub struct Model {
    /// 邮件日志 ID
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    /// 用户 ID
    pub user_id: String,
    /// 收件人邮箱地址
    pub email: String,
    /// 邮件模板名称
    pub template: String,
    /// 邮件状态：pending、sent、failed
    pub status: String,
    /// 错误消息（如果失败）
    pub error_message: Option<String>,
    /// 重试次数
    pub retry_count: u8,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

#[async_trait::async_trait]
impl ActiveModelBehavior for ActiveModel {
    /// 在保存前自动设置时间戳
    async fn before_save<C>(self, _db: &C, _insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        let mut this = self;
        let now = chrono::Utc::now().timestamp();
        this.updated_at = Set(now);
        Ok(this)
    }
}

/// 邮件状态常量
impl Model {
    pub const STATUS_PENDING: &'static str = "pending";
    pub const STATUS_SENT: &'static str = "sent";
    pub const STATUS_FAILED: &'static str = "failed";
}