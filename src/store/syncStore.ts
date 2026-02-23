import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { SyncStatus, SyncReport, ConflictInfo, ConflictStrategy } from '@/types/sync';
import type { ApiResponse } from '@/types/auth';

interface SyncState {
  lastSyncAt: number | null;
  pendingCount: number;
  conflictCount: number;
  conflicts: ConflictInfo[];
  isSyncing: boolean;
  isResolving: boolean;
  error: string | null;

  // Actions
  syncNow: () => Promise<SyncReport>;
  getStatus: () => Promise<void>;
  resolveConflict: (conflictId: string, strategy: ConflictStrategy) => Promise<void>;
  clearError: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  lastSyncAt: null,
  pendingCount: 0,
  conflictCount: 0,
  conflicts: [],
  isSyncing: false,
  isResolving: false,
  error: null,

  syncNow: async () => {
    set({ isSyncing: true, error: null });
    try {
      const response = await invoke<ApiResponse<SyncReport>>('sync_now');

      // 检查响应状态码
      if (response.code !== 200 || !response.data) {
        throw new Error(response.message);
      }

      const report = response.data;

      set({
        lastSyncAt: report.lastSyncAt,
        pendingCount: 0, // 同步完成后清零
        conflictCount: report.conflictCount,
        error: report.error || null,
      });

      // 只记录日志，不显示 toast，由调用者决定如何显示消息
      if (report.conflictCount > 0) {
        console.warn('同步冲突:', report.message);
      } else if (report.message) {
        console.log('同步成功:', report.message);
      }

      return report;
    } catch (error) {
      const errorMessage = error as string;
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isSyncing: false });
    }
  },
  getStatus: async () => {
    try {
      const response = await invoke<ApiResponse<SyncStatus>>('sync_get_status');

      // 检查响应状态码
      if (response.code !== 200 || !response.data) {
        throw new Error(response.message);
      }

      const status = response.data;
      set(status);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  },

  resolveConflict: async (conflictId: string, strategy: ConflictStrategy) => {
    set({ isResolving: true, error: null });
    try {
      const response = await invoke<ApiResponse<SyncReport>>('sync_resolve_conflict', { conflictId, strategy });

      // 检查响应状态码
      if (response.code !== 200 || !response.data) {
        throw new Error(response.message);
      }

      const report = response.data;

      set({
        lastSyncAt: report.lastSyncAt,
        conflictCount: report.conflictCount,
        // 从 conflicts 中移除已解决的冲突
        conflicts: get().conflicts.filter(c => c.id !== conflictId),
        error: null,
      });
    } catch (error) {
      const errorMessage = error as string;
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isResolving: false });
    }
  },

  clearError: () => set({ error: null }),
}));
