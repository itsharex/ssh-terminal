import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types/auth';
import i18n from '@/i18n/config';

interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (req: LoginRequest) => Promise<void>;
  register: (req: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  hasCurrentUser: () => Promise<boolean>;
  autoLogin: () => Promise<void>;
  getCurrentUser: () => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

// 辅助函数：从本地 app_settings 获取 serverUrl
const getServerUrl = async (): Promise<string> => {
  try {
    return await invoke<string>('app_settings_get_server_url');
  } catch (error) {
    console.error('Failed to get server url:', error);
    return ''; // 默认返回空字符串
  }
};

const createUserWithServerUrl = async (res: AuthResponse): Promise<User> => {
  const serverUrl = await getServerUrl();
  return {
    id: res.userId,
    email: res.email,
    serverUrl,
    deviceId: res.deviceId,
    lastSyncAt: undefined,
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  currentUser: null,
  isLoading: false,
  error: null,

  login: async (req) => {
    set({ isLoading: true, error: null });
    try {
      // 检查 server_url 是否已配置
      const serverUrl = await getServerUrl();
      if (!serverUrl || serverUrl.trim() === '') {
        throw new Error(i18n.t('auth.error.serverUrlNotSet'));
      }

      const res = await invoke<AuthResponse>('auth_login', { req });
      const user: User = await createUserWithServerUrl(res);
      set({ isAuthenticated: true, currentUser: user, isLoading: false });

      // 登录成功后自动同步服务器数据
      try {
        const { useSyncStore } = await import('./syncStore');
        const { useSessionStore } = await import('./sessionStore');
        const syncStore = useSyncStore.getState();
        const sessionStore = useSessionStore.getState();
        const authStore = get();

        await syncStore.syncNow();
        await sessionStore.reloadSessions();
        await authStore.getCurrentUser();
        console.log('[authStore] Login sync completed');
      } catch (syncError) {
        console.error('[authStore] Failed to sync after login:', syncError);
        // 同步失败不影响登录成功
      }
    } catch (error) {
      const errorString = error as string;
      // 尝试从 API 错误响应中提取 message 字段
      let errorMessage = errorString;
      try {
        // 匹配 API error (400 Bad Request): {"code":400,"message":"邮箱已注册","data":null} 格式
        const match = errorString.match(/API error \(\d+ [^\)]+\): (\{.+\})/);
        if (match && match[1]) {
          const errorJson = JSON.parse(match[1]);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        }
      } catch (parseError) {
        // 如果解析失败，使用原始错误消息
        console.error('[authStore] Failed to parse error message:', parseError);
      }
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  register: async (req) => {
    set({ isLoading: true, error: null });
    try {
      // 检查 server_url 是否已配置
      const serverUrl = await getServerUrl();
      if (!serverUrl || serverUrl.trim() === '') {
        throw new Error(i18n.t('auth.error.serverUrlNotSet'));
      }

      const res = await invoke<AuthResponse>('auth_register', { req });
      const user: User = await createUserWithServerUrl(res);
      set({ isAuthenticated: true, currentUser: user, isLoading: false });

      // 注册成功后只加载本地用户资料，不同步服务器
      try {
        const { useUserProfileStore } = await import('./userProfileStore');
        const userProfileStore = useUserProfileStore.getState();
        const authStore = get();

        await userProfileStore.loadProfile();
        await authStore.getCurrentUser();
        console.log('[authStore] Register user profile loaded');
      } catch (profileError) {
        console.error('[authStore] Failed to load profile after register:', profileError);
        // 加载用户资料失败不影响注册成功
      }
    } catch (error) {
      const errorString = error as string;
      // 尝试从 API 错误响应中提取 message 字段
      let errorMessage = errorString;
      try {
        // 匹配 API error (400 Bad Request): {"code":400,"message":"邮箱已注册","data":null} 格式
        const match = errorString.match(/API error \(\d+ [^\)]+\): (\{.+\})/);
        if (match && match[1]) {
          const errorJson = JSON.parse(match[1]);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        }
      } catch (parseError) {
        // 如果解析失败，使用原始错误消息
        console.error('[authStore] Failed to parse error message:', parseError);
      }
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke('auth_logout');
      set({ isAuthenticated: false, currentUser: null, isLoading: false });

      // 清除用户资料和会话数据
      try {
        const { useSessionStore } = await import('./sessionStore');
        const { useUserProfileStore } = await import('./userProfileStore');
        const sessionStore = useSessionStore.getState();
        const userProfileStore = useUserProfileStore.getState();

        sessionStore.clearSessions();
        userProfileStore.clearProfile();
      } catch (clearError) {
        console.error('[authStore] Failed to clear data after logout:', clearError);
      }
    } catch (error) {
      const errorMessage = error as string;
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  hasCurrentUser: async () => {
    try {
      const user = await invoke<User | null>('auth_get_current_user');
      return user !== null;
    } catch {
      return false;
    }
  },

  autoLogin: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await invoke<User | null>('auth_get_current_user');
      if (user) {
        // 如果有用户数据，也补充 serverUrl
        const serverUrl = await getServerUrl();
        user.serverUrl = serverUrl;
        set({ isAuthenticated: true, currentUser: user, isLoading: false });

        // 自动登录后尝试同步
        try {
          const { useSyncStore } = await import('./syncStore');
          const { useSessionStore } = await import('./sessionStore');
          const syncStore = useSyncStore.getState();
          const sessionStore = useSessionStore.getState();
          const authStore = get();

          await syncStore.syncNow();
          await sessionStore.reloadSessions();
          await authStore.getCurrentUser();
          console.log('[authStore] Auto-login sync completed');
        } catch (syncError) {
          console.error('[authStore] Failed to sync after auto-login:', syncError);
        }
      } else {
        set({ isAuthenticated: false, currentUser: null, isLoading: false });
      }
    } catch (error) {
      console.error('[authStore] Auto-login failed:', error);
      set({ isAuthenticated: false, currentUser: null, isLoading: false });
    }
  },

  getCurrentUser: async () => {
    try {
      const user = await invoke<User | null>('auth_get_current_user');
      if (user) {
        const serverUrl = await getServerUrl();
        user.serverUrl = serverUrl;
        set({ currentUser: user });
      }
    } catch (error) {
      console.error('[authStore] Failed to get current user:', error);
    }
  },

  switchAccount: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('auth_switch_account', { userId });
      const user = await invoke<User | null>('auth_get_current_user');
      if (user) {
        const serverUrl = await getServerUrl();
        user.serverUrl = serverUrl;
        set({ isAuthenticated: true, currentUser: user, isLoading: false });

        // 切换账号后重新同步
        try {
          const { useSyncStore } = await import('./syncStore');
          const { useSessionStore } = await import('./sessionStore');
          const syncStore = useSyncStore.getState();
          const sessionStore = useSessionStore.getState();

          await syncStore.syncNow();
          await sessionStore.reloadSessions();
          console.log('[authStore] Account switch sync completed');
        } catch (syncError) {
          console.error('[authStore] Failed to sync after account switch:', syncError);
        }
      } else {
        set({ isAuthenticated: false, currentUser: null, isLoading: false });
      }
    } catch (error) {
      const errorMessage = error as string;
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  refreshToken: async () => {
    try {
      await invoke('auth_refresh_token');
      const user = await invoke<User | null>('auth_get_current_user');
      if (user) {
        const serverUrl = await getServerUrl();
        user.serverUrl = serverUrl;
        set({ currentUser: user });
      }
    } catch (error) {
      console.error('[authStore] Failed to refresh token:', error);
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));