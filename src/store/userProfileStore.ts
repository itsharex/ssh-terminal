import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { UserProfile, UpdateProfileRequest } from '@/types/userProfile';
import type { ApiResponse } from '@/types/auth';

interface UserProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  loadProfile: () => Promise<void>;
  updateProfile: (req: UpdateProfileRequest) => Promise<UserProfile>;
  syncProfile: () => Promise<{ profile: UserProfile; message: string }>;
  clearProfile: () => void; // 清除用户资料
  clearError: () => void;
}

export const useUserProfileStore = create<UserProfileState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,

  loadProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await invoke<ApiResponse<UserProfile>>('user_profile_get');

      // 检查响应状态码
      if (response.code !== 200 || !response.data) {
        throw new Error(response.message);
      }

      const profile = response.data;
      set({ profile, isLoading: false });
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : '获取资料失败';
      console.error('[userProfileStore] 获取资料失败:', error);
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateProfile: async (req) => {
    set({ isLoading: true, error: null });
    try {
      const response = await invoke<{ code: number; message: string; data: UserProfile }>('user_profile_update', { req });
      set({ profile: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : '更新资料失败';
      console.error('[userProfileStore] 更新资料失败:', error);
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  syncProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await invoke<{ code: number; message: string; data: UserProfile }>('user_profile_sync');
      set({ profile: response.data, isLoading: false });
      return { profile: response.data, message: response.message };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : '同步资料失败';
      console.error('[userProfileStore] 同步资料失败:', error);
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  clearProfile: () => set({ profile: null }),
}));
