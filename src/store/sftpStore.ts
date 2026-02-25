/**
 * SFTP 状态管理
 *
 * 使用 Zustand 管理 SFTP 文件管理器状态
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type {
  SftpFileInfo,
} from '@/types/sftp';

// 临时任务数据结构（应用退出后消失）
export interface ActiveTask {
  taskId: string;
  fileName: string;
  filePath: string;
  bytesTransferred: number;
  totalBytes: number;
  speed: number; // bytes/sec
  status: 'uploading' | 'downloading' | 'completed';
  startTime: number;
  completedTime: number; // 当前时间（Unix 时间戳，毫秒），用于计算任务用时
  filesCompleted: number;
  totalFiles: number;
  uploadName: string; // 上传任务名称（单文件时是文件名，目录时是目录名）
}

// 上传状态变更事件类型
export interface UploadStatusChangeEvent {
  taskId: string;
  connectionId: string;
  status: string; // 'pending', 'uploading', 'completed', 'failed', 'cancelled'
  bytesTransferred: number;
  filesCompleted: number;
  totalFiles: number;
  errorMessage?: string;
  completedAt?: number;
}

// 下载状态变更事件类型
export interface DownloadStatusChangeEvent {
  taskId: string;
  connectionId: string;
  status: string; // 'pending', 'downloading', 'completed', 'failed', 'cancelled'
  bytesTransferred: number;
  filesCompleted: number;
  totalFiles: number;
  errorMessage?: string;
  completedAt?: number;
}

interface SftpStore {
  // 本地面板
  localPath: string;
  setLocalPath: (path: string) => void;
  localFiles: SftpFileInfo[];
  setLocalFiles: (files: SftpFileInfo[]) => void;

  // 远程面板
  remotePath: string;
  setRemotePath: (path: string) => void;
  remoteFiles: SftpFileInfo[];
  setRemoteFiles: (files: SftpFileInfo[]) => void;

  // 选中的文件
  selectedLocalFiles: SftpFileInfo[];
  setSelectedLocalFiles: (files: SftpFileInfo[]) => void;
  selectedRemoteFiles: SftpFileInfo[];
  setSelectedRemoteFiles: (files: SftpFileInfo[]) => void;

  // 初始化本地路径
  initializeLocalPath: () => Promise<void>;

  // 上传文件
  uploadFile: (
    connectionId: string,
    localPath: string,
    remotePath: string
  ) => Promise<string>;

  // 下载文件
  downloadFile: (
    connectionId: string,
    remotePath: string,
    localPath: string
  ) => Promise<string>;

  // 临时任务存储（应用退出后消失）
  activeUploadTasks: Map<string, ActiveTask>;
  activeDownloadTasks: Map<string, ActiveTask>;

  // 上传任务管理
  addActiveUploadTask: (task: ActiveTask) => void;
  updateActiveUploadTask: (taskId: string, updates: Partial<ActiveTask>) => void;
  removeActiveUploadTask: (taskId: string) => void;
  clearActiveUploadTasks: () => void;

  // 下载任务管理
  addActiveDownloadTask: (task: ActiveTask) => void;
  updateActiveDownloadTask: (taskId: string, updates: Partial<ActiveTask>) => void;
  removeActiveDownloadTask: (taskId: string) => void;
  clearActiveDownloadTasks: () => void;

  // 清理所有临时任务
  clearActiveTasks: () => void;

  // 监听上传状态变更事件
  listenUploadStatusChange: (connectionId: string, onCompletedOrCancelled?: () => void) => Promise<() => void>;

  // 监听下载状态变更事件
  listenDownloadStatusChange: (connectionId: string, onCompletedOrCancelled?: () => void) => Promise<() => void>;
}

// 创建持久化的 store
export const useSftpStore = create<SftpStore>()(
  persist(
    (set) => ({
      // 本地面板
      localPath: '',
      setLocalPath: (path: string) => set({ localPath: path }),
      localFiles: [],
      setLocalFiles: (files: SftpFileInfo[]) => set({ localFiles: files }),

      // 远程面板
      remotePath: '/',
      setRemotePath: (path: string) => set({ remotePath: path }),
      remoteFiles: [],
      setRemoteFiles: (files: SftpFileInfo[]) => set({ remoteFiles: files }),

      // 选中的文件
      selectedLocalFiles: [],
      setSelectedLocalFiles: (files: SftpFileInfo[]) => set({ selectedLocalFiles: files }),
      selectedRemoteFiles: [],
      setSelectedRemoteFiles: (files: SftpFileInfo[]) => set({ selectedRemoteFiles: files }),

      // 初始化本地路径
      initializeLocalPath: async () => {
        try {
          const homeDir = await invoke<string>('local_home_dir');
          set({ localPath: homeDir });
          console.log('Local home directory initialized:', homeDir);
        } catch (error) {
          console.error('Failed to get home directory:', error);
        }
      },

      // 上传文件
      uploadFile: async (connectionId, localPath, remotePath) => {
        try {
          const transferId: string = await invoke('sftp_upload_file', {
            connectionId,
            localPath,
            remotePath,
          });

          return transferId;
        } catch (error) {
          console.error('Failed to upload file:', error);
          throw error;
        }
      },

      // 下载文件
      downloadFile: async (connectionId, remotePath, localPath) => {
        try {
          const transferId: string = await invoke('sftp_download_file', {
            connectionId,
            remotePath,
            localPath,
          });

          return transferId;
        } catch (error) {
          console.error('Failed to download file:', error);
          throw error;
        }
      },

      // 临时任务存储初始化
      activeUploadTasks: new Map(),
      activeDownloadTasks: new Map(),

      // 上传任务管理
      addActiveUploadTask: (task: ActiveTask) => {
        set((state) => {
          const newMap = new Map(state.activeUploadTasks);
          newMap.set(task.taskId, task);
          return { activeUploadTasks: newMap };
        });
      },

      updateActiveUploadTask: (taskId: string, updates: Partial<ActiveTask>) => {
        console.log('[sftpStore] updateActiveUploadTask called:', { taskId, updates });
        set((state) => {
          const newMap = new Map(state.activeUploadTasks);
          const existingTask = newMap.get(taskId);
          if (existingTask) {
            const updatedTask = { ...existingTask, ...updates };
            console.log('[sftpStore] Task updated:', {
              taskId,
              before: existingTask,
              updates,
              after: updatedTask
            });
            newMap.set(taskId, updatedTask);
          } else {
            console.log('[sftpStore] Task not found:', taskId);
          }
          return { activeUploadTasks: newMap };
        });
      },

      removeActiveUploadTask: (taskId: string) => {
        set((state) => {
          const newMap = new Map(state.activeUploadTasks);
          newMap.delete(taskId);
          return { activeUploadTasks: newMap };
        });
      },

      clearActiveUploadTasks: () => {
        set({ activeUploadTasks: new Map() });
      },

      // 下载任务管理
      addActiveDownloadTask: (task: ActiveTask) => {
        set((state) => {
          const newMap = new Map(state.activeDownloadTasks);
          newMap.set(task.taskId, task);
          return { activeDownloadTasks: newMap };
        });
      },

      updateActiveDownloadTask: (taskId: string, updates: Partial<ActiveTask>) => {
        console.log('[sftpStore] updateActiveDownloadTask called:', { taskId, updates });
        set((state) => {
          const newMap = new Map(state.activeDownloadTasks);
          const existingTask = newMap.get(taskId);
          if (existingTask) {
            const updatedTask = { ...existingTask, ...updates };
            console.log('[sftpStore] Task updated:', {
              taskId,
              before: existingTask,
              updates,
              after: updatedTask
            });
            newMap.set(taskId, updatedTask);
          } else {
            console.log('[sftpStore] Task not found:', taskId);
          }
          return { activeDownloadTasks: newMap };
        });
      },

      removeActiveDownloadTask: (taskId: string) => {
        set((state) => {
          const newMap = new Map(state.activeDownloadTasks);
          newMap.delete(taskId);
          return { activeDownloadTasks: newMap };
        });
      },

      clearActiveDownloadTasks: () => {
        set({ activeDownloadTasks: new Map() });
      },

      // 清理所有临时任务
      clearActiveTasks: () => {
        set({
          activeUploadTasks: new Map(),
          activeDownloadTasks: new Map(),
        });
      },

      // 监听上传状态变更事件
      listenUploadStatusChange: async (_connectionId: string, onCompletedOrCancelled?: () => void) => {
        console.log('[sftpStore] Setting up upload status change listener for connection:', _connectionId);
        const { listen } = await import('@tauri-apps/api/event');

        const unlisten = await listen<UploadStatusChangeEvent>(
          'sftp-upload-status-change',
          (event) => {
            console.log('[sftpStore] Upload status change event received:', event);
            console.log('[sftpStore] Event payload:', event.payload);

            const { taskId, status, completedAt } = event.payload;

            // 更新临时任务状态
            const currentTask = useSftpStore.getState().activeUploadTasks.get(taskId);
            console.log('[sftpStore] Current task found:', currentTask ? 'Yes' : 'No');

            if (currentTask) {
              console.log('[sftpStore] Updating task status:', taskId, 'to:', status);
              useSftpStore.getState().updateActiveUploadTask(taskId, {
                status: status as any,
                completedTime: completedAt || 0, // completedAt 是完成时间戳，0 表示未完成
              });

              // 如果任务完成或失败，3秒后移除
              if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                console.log('[sftpStore] Task', taskId, 'is', status + ', removing in 3 seconds');
                setTimeout(() => {
                  useSftpStore.getState().removeActiveUploadTask(taskId);
                }, 3000);

                // 触发回调（用于刷新远程面板）
                if (onCompletedOrCancelled) {
                  console.log('[sftpStore] Calling onCompletedOrCancelled callback');
                  onCompletedOrCancelled();
                }
              }
            } else {
              console.log('[sftpStore] Task not found in activeUploadTasks:', taskId);
              console.log('[sftpStore] Current activeUploadTasks:', Array.from(useSftpStore.getState().activeUploadTasks.keys()));
            }
          }
        );

        console.log('[sftpStore] Upload status change listener setup complete');
        return unlisten;
      },

      // 监听下载状态变更事件
      listenDownloadStatusChange: async (_connectionId: string, onCompletedOrCancelled?: () => void) => {
        console.log('[sftpStore] Setting up download status change listener for connection:', _connectionId);
        const { listen } = await import('@tauri-apps/api/event');

        const unlisten = await listen<DownloadStatusChangeEvent>(
          'sftp-download-status-change',
          (event) => {
            console.log('[sftpStore] Download status change event received:', event);
            console.log('[sftpStore] Event payload:', event.payload);

            const { taskId, status, completedAt } = event.payload;

            // 更新临时任务状态
            const currentTask = useSftpStore.getState().activeDownloadTasks.get(taskId);
            console.log('[sftpStore] Current task found:', currentTask ? 'Yes' : 'No');

            if (currentTask) {
              console.log('[sftpStore] Updating task status:', taskId, 'to:', status);
              useSftpStore.getState().updateActiveDownloadTask(taskId, {
                status: status as any,
                completedTime: completedAt || 0, // completedAt 是完成时间戳，0 表示未完成
              });

              // 如果任务完成或失败，3秒后移除
              if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                console.log('[sftpStore] Task', taskId, 'is', status + ', removing in 3 seconds');
                setTimeout(() => {
                  useSftpStore.getState().removeActiveDownloadTask(taskId);
                }, 3000);

                // 触发回调（用于刷新本地面板）
                if (onCompletedOrCancelled) {
                  console.log('[sftpStore] Calling onCompletedOrCancelled callback');
                  onCompletedOrCancelled();
                }
              }
            } else {
              console.log('[sftpStore] Task not found in activeDownloadTasks:', taskId);
              console.log('[sftpStore] Current activeDownloadTasks:', Array.from(useSftpStore.getState().activeDownloadTasks.keys()));
            }
          }
        );

        console.log('[sftpStore] Download status change listener setup complete');
        return unlisten;
      },
    }),
    {
      name: 'sftp-storage',
      partialize: (state) => ({
        localPath: state.localPath,
        remotePath: state.remotePath,
      }),
    }
  )
);