// AI API 客户端封装

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AIProviderConfig, ChatMessage } from '@/types/ai';

/**
 * AI 客户端类
 */
export class AIClient {
  /**
   * 发送聊天请求（非流式）
   */
  static async chat(config: AIProviderConfig, messages: ChatMessage[]): Promise<string> {
    return await invoke<string>('ai_chat', {
      config: {
        type: config.type,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 2000,
      },
      messages,
    });
  }

  /**
   * 发送流式聊天请求
   * @param onChunk 接收流式数据块的回调函数
   * @returns 完整的响应内容
   */
  static async chatStream(
    config: AIProviderConfig,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<string> {
    // 先调用流式命令
    const promise = invoke<string>('ai_chat_stream', {
      config: {
        type: config.type,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 2000,
      },
      messages,
    });

    // 监听流式数据块事件
    const unlisten = await listen<string>('ai-chat-chunk', (event) => {
      onChunk(event.payload);
    });

    try {
      // 等待命令完成
      const result = await promise;
      unlisten();
      return result;
    } catch (error) {
      unlisten();
      throw error;
    }
  }

  /**
   * 解释命令
   */
  static async explainCommand(config: AIProviderConfig, command: string): Promise<string> {
    return await invoke<string>('ai_explain_command', {
      config: {
        type: config.type,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 2000,
      },
      command,
    });
  }

  /**
   * 自然语言转命令
   */
  static async generateCommand(config: AIProviderConfig, input: string): Promise<string> {
    return await invoke<string>('ai_generate_command', {
      config: {
        type: config.type,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 2000,
      },
      input,
    });
  }

  /**
   * 分析错误
   */
  static async analyzeError(config: AIProviderConfig, error: string): Promise<string> {
    return await invoke<string>('ai_analyze_error', {
      config: {
        type: config.type,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 2000,
      },
      error,
    });
  }

  /**
   * 测试连接
   */
  static async testConnection(config: AIProviderConfig): Promise<boolean> {
    try {
      return await invoke<boolean>('ai_test_connection', {
        config: {
          type: config.type,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 2000,
        },
      });
    } catch (error) {
      console.error('[AIClient] Test connection failed:', error);
      return false;
    }
  }
}
