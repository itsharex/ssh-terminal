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
  TransferProgress,
} from '@/types/sftp';

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
}

// 创建持久化的 store
export const useSftpStore = create<SftpStore>()(
  persist(
    (set, get) => ({
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