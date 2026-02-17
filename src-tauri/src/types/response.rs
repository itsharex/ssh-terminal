use serde::{Deserialize, Serialize};

// ==================== Tauri 后端返回给前端的响应（camelCase 格式）====================

/// 统一的 API 响应结构（Tauri 后端返回给前端）
///
/// 用于 Tauri 命令返回统一格式的响应给前端，使用 camelCase 命名规范。
///
/// # 示例
/// ```rust
/// let response = ApiResponse::success(data);
/// // JSON: { "success": true, "data": {...}, "message": "Success" }
///
/// let response = ApiResponse::error("操作失败");
/// // JSON: { "success": false, "data": null, "message": "操作失败" }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse<T> {
    /// 是否成功
    pub success: bool,
    /// 响应消息
    pub message: String,
    /// 响应数据
    pub data: Option<T>,
}

impl<T: Serialize> ApiResponse<T> {
    /// 成功响应
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            message: "Success".to_string(),
            data: Some(data),
        }
    }

    /// 成功响应（自定义消息）
    pub fn success_with_message(data: T, message: &str) -> Self {
        Self {
            success: true,
            message: message.to_string(),
            data: Some(data),
        }
    }

    /// 成功响应（无数据）
    pub fn success_without_data() -> Self {
        Self {
            success: true,
            message: "Success".to_string(),
            data: None,
        }
    }

    /// 成功响应（无数据，自定义消息）
    pub fn success_without_data_with_message(message: &str) -> Self {
        Self {
            success: true,
            message: message.to_string(),
            data: None,
        }
    }
}

impl ApiResponse<()> {
    /// 错误响应
    pub fn error(message: &str) -> Self {
        Self {
            success: false,
            message: message.to_string(),
            data: None,
        }
    }
}

// ==================== 服务器返回的响应（snake_case 格式）====================

/// 服务器 API 响应结构（服务器返回，snake_case 格式）
///
/// 用于解析服务器返回的 JSON 响应。
/// 服务器响应格式: `{ "code": 200, "message": "...", "data": {...} }`
///
/// # 注意
/// 此类型仅用于 `api_client.rs` 解析服务器响应，不要用于 Tauri 命令返回值。
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
