// AI 状态管理

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage } from '@/types/ai';
import { AIClient } from '@/lib/ai/aiClient';

interface AIStore {
  // 配置
  config: any | null;
  isLoading: boolean;
  error: string | null;

  // 对话历史
  conversations: Map<string, ChatMessage[]>;
  currentConnectionId: string | null;

  // UI 状态
  isChatOpen: boolean;

  // ========== 配置管理 ==========

  /**
   * 加载 AI 配置
   */
  loadConfig: () => Promise<void>;

  /**
   * 保存 AI 配置
   */
  saveConfig: (config: any) => Promise<void>;

  /**
   * 获取默认配置
   */
  getDefaultConfig: () => Promise<any>;

  // ========== AI 操作 ==========

  /**
   * 发送聊天消息
   */
  sendMessage: (connectionId: string, message: string) => Promise<string>;

  /**
   * 解释命令
   */
  explainCommand: (command: string) => Promise<string>;

  /**
   * 自然语言转命令
   */
  naturalLanguageToCommand: (input: string) => Promise<string>;

  /**
   * 分析错误
   */
  analyzeError: (error: string) => Promise<string>;

  /**
   * 测试连接
   */
  testConnection: (providerId: string) => Promise<boolean>;

  // ========== 对话历史管理 ==========

  /**
   * 获取对话历史
   */
  getConversationHistory: (connectionId: string) => ChatMessage[];

  /**
   * 清空对话历史
   */
  clearConversation: (connectionId: string) => void;

  // ========== UI 控制 ==========

  /**
   * 切换聊天面板
   */
  toggleChat: () => void;

  /**
   * 打开聊天面板
   */
  openChat: () => void;

  /**
   * 关闭聊天面板
   */
  closeChat: () => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
  // 初始状态
  config: null,
  isLoading: false,
  error: null,
  conversations: new Map(),
  currentConnectionId: null,
  isChatOpen: false,

  // ========== 配置管理 ==========

  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await invoke<any>('storage_ai_config_load');
      set({ config, isLoading: false });
    } catch (error) {
      console.error('[AIStore] Failed to load config:', error);
      set({ isLoading: false, error: (error as Error).message });
    }
  },

  saveConfig: async (config) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('storage_ai_config_save', { config });
      set({ config, isLoading: false });
    } catch (error) {
      const errorMsg = `保存配置失败: ${error}`;
      console.error('[AIStore] Failed to save config:', error);
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  getDefaultConfig: async () => {
    try {
      return await invoke<any>('storage_ai_config_get_default');
    } catch (error) {
      console.error('[AIStore] Failed to get default config:', error);
      throw error;
    }
  },

  // ========== AI 操作 ==========

  sendMessage: async (connectionId: string, message: string) => {
    const { config, conversations } = get();

    if (!config) {
      throw new Error('AI 配置未初始化');
    }

    const provider = config.providers.find((p: any) => p.id === config.defaultProvider && p.enabled);
    if (!provider) {
      throw new Error('没有可用的 AI Provider');
    }

    // 添加用户消息到历史
    const userMessage: ChatMessage = { role: 'user', content: message };
    const history = conversations.get(connectionId) || [];
    const newHistory = [...history, userMessage];

    set({ isLoading: true, error: null });

    try {
      // 调用 AI API（包含最近 20 条消息作为上下文）
      const contextMessages = newHistory.slice(-20);
      const response = await AIClient.chat(provider, contextMessages);

      // 添加助手回复到历史
      const assistantMessage: ChatMessage = { role: 'assistant', content: response };
      const updatedHistory = [...newHistory, assistantMessage];

      // 更新对话历史
      const newConversations = new Map(conversations);
      newConversations.set(connectionId, updatedHistory);

      set({ conversations: newConversations, isLoading: false });
      return response;
    } catch (error) {
      const errorMsg = `发送消息失败: ${error}`;
      console.error('[AIStore] Send message failed:', error);
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  explainCommand: async (command: string) => {
    const { config } = get();

    if (!config) {
      throw new Error('AI 配置未初始化');
    }

    const provider = config.providers.find((p: any) => p.id === config.defaultProvider && p.enabled);
    if (!provider) {
      throw new Error('没有可用的 AI Provider');
    }

    set({ isLoading: true, error: null });

    try {
      const response = await AIClient.explainCommand(provider, command);
      set({ isLoading: false });
      return response;
    } catch (error) {
      const errorMsg = `命令解释失败: ${error}`;
      console.error('[AIStore] Explain command failed:', error);
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  naturalLanguageToCommand: async (input: string) => {
    const { config } = get();

    if (!config) {
      throw new Error('AI 配置未初始化');
    }

    const provider = config.providers.find((p: any) => p.id === config.defaultProvider && p.enabled);
    if (!provider) {
      throw new Error('没有可用的 AI Provider');
    }

    set({ isLoading: true, error: null });

    try {
      const command = await AIClient.generateCommand(provider, input);
      set({ isLoading: false });
      return command;
    } catch (error) {
      const errorMsg = `命令生成失败: ${error}`;
      console.error('[AIStore] Generate command failed:', error);
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  analyzeError: async (error: string) => {
    const { config } = get();

    if (!config) {
      throw new Error('AI 配置未初始化');
    }

    const provider = config.providers.find((p: any) => p.id === config.defaultProvider && p.enabled);
    if (!provider) {
      throw new Error('没有可用的 AI Provider');
    }

    set({ isLoading: true, error: null });

    try {
      const analysis = await AIClient.analyzeError(provider, error);
      set({ isLoading: false });
      return analysis;
    } catch (error) {
      const errorMsg = `错误分析失败: ${error}`;
      console.error('[AIStore] Analyze error failed:', error);
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  testConnection: async (providerId: string) => {
    const { config } = get();

    if (!config) {
      throw new Error('AI 配置未初始化');
    }

    const provider = config.providers.find((p: any) => p.id === providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    set({ isLoading: true, error: null });

    try {
      const result = await AIClient.testConnection(provider);
      set({ isLoading: false });
      return result;
    } catch (error) {
      const errorMsg = `测试连接失败: ${error}`;
      console.error('[AIStore] Test connection failed:', error);
      set({ error: errorMsg, isLoading: false });
      return false;
    }
  },

  // ========== 对话历史管理 ==========

  getConversationHistory: (connectionId: string) => {
    const { conversations } = get();
    return conversations.get(connectionId) || [];
  },

  clearConversation: (connectionId: string) => {
    const { conversations } = get();
    const newConversations = new Map(conversations);
    newConversations.delete(connectionId);
    set({ conversations: newConversations });
  },

  // ========== UI 控制 ==========

  toggleChat: () => {
    const { isChatOpen } = get();
    set({ isChatOpen: !isChatOpen });
  },

  openChat: () => {
    set({ isChatOpen: true });
  },

  closeChat: () => {
    set({ isChatOpen: false });
  },
}));
