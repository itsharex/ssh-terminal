// AI 模块 - 支持多种 AI 服务提供商

pub mod provider;
pub mod openai;
pub mod ollama;

pub use provider::{AIProvider, ChatMessage};
pub use openai::OpenAIProvider;
pub use ollama::OllamaProvider;
