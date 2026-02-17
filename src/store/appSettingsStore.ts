import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface AppSettings {
  serverUrl: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  theme: string;
  language: string;
  updatedAt: number;
}

interface AppSettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;

  loadSettings: () => Promise<AppSettings>;
  updateServerUrl: (url: string) => Promise<void>;
  updateAutoSync: (enabled: boolean) => Promise<void>;
  updateSyncInterval: (interval: number) => Promise<void>;
  updateLanguage: (language: string) => Promise<void>;
  clearError: () => void;
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await invoke<AppSettings>('app_settings_get_all');
      set({ settings, isLoading: false });
      return settings;
    } catch (error) {
      const errorMessage = error as string;
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateServerUrl: async (url: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('app_settings_set_server_url', { serverUrl: url });
      const settings = await get().loadSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      const errorMessage = error as string;
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateAutoSync: async (enabled: boolean) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('app_settings_set_auto_sync_enabled', { enabled });
      const settings = await get().loadSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      const errorMessage = error as string;
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateSyncInterval: async (interval: number) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('app_settings_set_sync_interval', { interval });
      const settings = await get().loadSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      const errorMessage = error as string;
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateLanguage: async (language: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('app_settings_set_language', { language });
      const settings = await get().loadSettings();
      set({ settings, isLoading: false });
    } catch (error) {
      const errorMessage = error as string;
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
