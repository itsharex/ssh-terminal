use serde::{Deserialize, Serialize};

/// 最近更新时间响应
#[derive(Debug, Serialize, Deserialize)]
pub struct LastUpdateResponse {
    /// 最后更新时间戳（毫秒）
    pub last_updated_at: i64,
    /// 是否有任何数据
    pub has_data: bool,
}