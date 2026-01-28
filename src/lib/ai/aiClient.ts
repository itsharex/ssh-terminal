// AI API 客户端封装

import { invoke } from '@tauri-apps/api/core';
import type { AIProviderConfig, ChatMessage } from '@/types/ai';

/**
 * AI 客户端类
 */
export class AIClient {
  /**
   * 发送聊天请求
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
