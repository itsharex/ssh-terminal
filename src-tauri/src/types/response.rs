use serde::{Deserialize, Serialize};

// ==================== Tauri 后端返回给前端的响应（服务器原始格式）====================

/// 统一的 API 响应结构（直接使用服务器返回的格式）
///
/// 服务器响应格式: `{ "code": 200, "message": "...", "data": {...} }`
///
/// # 注意
/// 此结构与服务器返回的格式完全一致，不做任何转换。
/// - code: HTTP 状态码（200 表示成功，其他表示失败）
/// - message: 服务器返回的消息
/// - data: 响应数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse<T> {
    /// HTTP 状态码
    pub code: u16,
    /// 响应消息（来自服务器）
    pub message: String,
    /// 响应数据
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    /// 检查是否成功（code == 200）
    pub fn is_success(&self) -> bool {
        self.code == 200
    }

    /// 从服务器的 ServerApiResponse 创建 ApiResponse
    pub fn from_server_response(server_response: ServerApiResponse<T>) -> Self {
        Self {
            code: server_response.code,
            message: server_response.message,
            data: server_response.data,
        }
    }
}

// ==================== 服务器返回的响应（snake_case 格式）====================

/// 服务器 API 响应结构（服务器返回，snake_case 格式）
///
/// 用于解析服务器返回的 JSON 响应。
/// 服务器响应格式: `{ "code": 200, "message": "...", "data": {...} }`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerApiResponse<T> {
    /// HTTP 状态码
    pub code: u16,
    /// 响应消息
    pub message: String,
    /// 响应数据
    pub data: Option<T>,
}

impl<T> ServerApiResponse<T> {
    /// 检查是否成功（code == 200）
    pub fn is_success(&self) -> bool {
        self.code == 200
    }

    /// 提取数据
    pub fn data(self) -> Option<T> {
        self.data
    }
}
