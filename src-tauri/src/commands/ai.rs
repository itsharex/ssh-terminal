// AI 相关 Tauri 命令

use crate::ai::{AIProvider, OpenAIProvider, OllamaProvider, ChatMessage};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// AI Provider 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIProviderConfig {
    #[serde(rename = "type")]
    pub provider_type: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: String,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

/// AI Manager 状态
pub struct AIManagerState {
    // 这里可以缓存 provider 实例
    providers: Arc<Mutex<Vec<String>>>,
}

impl AIManagerState {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

/// AI 聊天命令（流式）
#[tauri::command]
pub async fn ai_chat_stream(
    app: AppHandle,
    config: AIProviderConfig,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    // 创建 provider 实例
    let provider = match config.provider_type.as_str() {
        "ollama" => {
            // Ollama 暂不支持流式
            return Err("Ollama streaming not supported yet".to_string());
        }
        _ => {
            // OpenAI 兼容接口
            let api_key = config.api_key.ok_or("API key is required".to_string())?;
            OpenAIProvider::new(
                api_key,
                config.base_url,
                config.model,
                config.temperature,
                config.max_tokens,
            )
        }
    };

    // 使用流式方法，通过事件发送数据块
    provider.chat_stream(messages, |chunk| {
        // 发送流式数据块到前端
        let _ = app.emit("ai-chat-chunk", chunk);
    }).await.map_err(|e| e.to_string())
}

/// AI 聊天命令（非流式，保持兼容）
#[tauri::command]
pub async fn ai_chat(
    config: AIProviderConfig,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    // 创建 provider 实例
    let provider: Box<dyn AIProvider> = match config.provider_type.as_str() {
        "ollama" => {
            Box::new(OllamaProvider::new(
                config.base_url,
                config.model,
                config.temperature,
                config.max_tokens,
            ))
        }
        _ => {
            // 默认使用 OpenAI 兼容接口（适用于大多数 AI 服务）
            let api_key = config.api_key.ok_or("API key is required".to_string())?;
            Box::new(OpenAIProvider::new(
                api_key,
                config.base_url,
                config.model,
                config.temperature,
                config.max_tokens,
            ))
        }
    };

    // 调用 chat 方法
    provider.chat(messages).await.map_err(|e| e.to_string())
}

/// AI 命令解释
#[tauri::command]
pub async fn ai_explain_command(
    command: String,
    config: AIProviderConfig,
) -> Result<String, String> {
    let system_prompt = "你是 Linux/Unix 命令行专家。用最简洁的语言解释命令。

**输出格式**（严格遵循）：
```
功能：[一句话]
参数：[关键参数，用|分隔，无参数则写\"无\"]
示例：[一个实际用法示例]
风险：[有风险写具体风险，无风险写\"无\"]
```

**要求**：
- 功能不超过15字
- 参数只说最关键的2-3个
- 示例必须是可执行的真实命令
- 总字数不超过80字";

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: format!("命令: {}", command),
        },
    ];

    ai_chat(config, messages).await
}

/// AI 自然语言转命令
#[tauri::command]
pub async fn ai_generate_command(
    input: String,
    config: AIProviderConfig,
) -> Result<String, String> {
    let system_prompt = "你是 Linux 命令生成器。根据描述生成 Shell 命令。

**规则**：
1. 只输出命令，不解释
2. 需求不明确返回：\"？请明确需求\"
3. 危险操作在命令前加：\"⚠️ \"
4. 优先常用命令，避免复杂参数

**示例**：
\"看所有文件\" → ls -la
\"查log文件\" → find . -name \"*.log\"
\"停止nginx\" → systemctl stop nginx";

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: format!("用户需求: {}", input),
        },
    ];

    ai_chat(config, messages).await
}

/// AI 错误分析
#[tauri::command]
pub async fn ai_analyze_error(
    error: String,
    config: AIProviderConfig,
) -> Result<String, String> {
    let system_prompt = "你是 Linux 故障排查专家。快速诊断错误。

**输出格式**（严格遵循）：
```
原因：[1句话，最多30字]
解决：
1. [方案1，最多30字]
2. [方案2，最多30字]
预防：[1句话，最多25字]
```

**要求**：
- 直接给解决方案，不说废话
- 按成功率排序方案
- 总字数不超过120字";

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: format!("错误信息:\n{}", error),
        },
    ];

    ai_chat(config, messages).await
}

/// 测试 AI 连接
#[tauri::command]
pub async fn ai_test_connection(
    config: AIProviderConfig,
) -> Result<bool, String> {
    tracing::info!("[AI] Testing connection for provider type: {}", config.provider_type);
    tracing::info!("[AI] Provider config - model: {}, base_url: {:?}",
        config.model, config.base_url);
    tracing::info!("[AI] Provider config - temperature: {:?}, max_tokens: {:?}",
        config.temperature, config.max_tokens);

    let provider: Box<dyn AIProvider> = match config.provider_type.as_str() {
        "ollama" => {
            tracing::info!("[AI] Creating Ollama provider");
            Box::new(OllamaProvider::new(
                config.base_url,
                config.model,
                config.temperature,
                config.max_tokens,
            ))
        }
        _ => {
            tracing::info!("[AI] Creating OpenAI-compatible provider for type: {}", config.provider_type);
            let api_key = config.api_key.ok_or("API key is required".to_string())?;
            Box::new(OpenAIProvider::new(
                api_key,
                config.base_url,
                config.model,
                config.temperature,
                config.max_tokens,
            ))
        }
    };

    tracing::info!("[AI] Calling provider test_connection");
    let result = provider.test_connection().await.map_err(|e| {
        tracing::error!("[AI] Test connection error: {}", e);
        e.to_string()
    })?;

    tracing::info!("[AI] Test connection result: {}", result);
    Ok(result)
}
