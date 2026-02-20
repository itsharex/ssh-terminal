/**
 * 双面板文件管理器组件
 *
 * 显示本地和远程文件面板
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { FilePane } from './FilePane';
import { useSftpStore } from '@/store/sftpStore';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface DualPaneProps {
  connectionId: string;
  remoteRefreshKey?: number;
  localRefreshKey?: number;
}

export function DualPane({ connectionId, remoteRefreshKey = 0, localRefreshKey = 0 }: DualPaneProps) {
  const { t } = useTranslation();
  const {
    localPath,
    remotePath,
    setLocalPath,
    setRemotePath,
    selectedLocalFiles,
    selectedRemoteFiles,
    setSelectedLocalFiles,
    setSelectedRemoteFiles,
  } = useSftpStore();

  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [localRefreshTimestamp, setLocalRefreshTimestamp] = useState(Date.now());
  const [remoteRefreshTimestamp, setRemoteRefreshTimestamp] = useState(Date.now());

  const handleLocalPathChange = (path: string) => {
    setLocalPath(path);
  };

  const handleRemotePathChange = (path: string) => {
    setRemotePath(path);
  };

  const handleTransferToRemote = async () => {
    console.log('Upload button clicked');
    console.log('Selected local files:', selectedLocalFiles);
    console.log('Remote path:', remotePath);
    console.log('Connection ID:', connectionId);

    if (selectedLocalFiles.length === 0) {
      toast.error(t('sftp.error.noFileSelected'));
      return;
    }

    setUploading(true);
    try {
      for (const file of selectedLocalFiles) {
        // 跳过目录
        if (file.isDir) {
          toast.warning(t('sftp.error.skipDirectory', { name: file.name }));
          continue;
        }

        const remoteFilePath = remotePath.endsWith('/')
          ? `${remotePath}${file.name}`
          : `${remotePath}/${file.name}`;

        console.log('Uploading:', file.path, '->', remoteFilePath);

        await invoke('sftp_upload_file', {
          connectionId,
          localPath: file.path,
          remotePath: remoteFilePath,
        });
      }

      toast.success(t('sftp.success.uploadSuccess', { count: selectedLocalFiles.length }));
      setSelectedLocalFiles([]);

      // 只刷新远程面板
      setRemoteRefreshTimestamp(Date.now());
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(t('sftp.error.uploadFailed', { error }));
    } finally {
      setUploading(false);
    }
  };

  const handleTransferToLocal = async () => {
    if (selectedRemoteFiles.length === 0) return;

    setDownloading(true);
    try {
      for (const file of selectedRemoteFiles) {
        // 跳过目录
        if (file.isDir) {
          toast.warning(t('sftp.error.skipDirectory', { name: file.name }));
          continue;
        }

        const localFilePath = localPath.endsWith('/')
          ? `${localPath}${file.name}`
          : `${localPath}/${file.name}`;

        await invoke('sftp_download_file', {
          connectionId,
          remotePath: file.path,
          localPath: localFilePath,
        });
      }

      toast.success(t('sftp.success.downloadSuccess', { count: selectedRemoteFiles.length }));
      setSelectedRemoteFiles([]);

      // 只刷新本地面板
      setLocalRefreshTimestamp(Date.now());
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(t('sftp.error.downloadFailed', { error }));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="h-full flex">
      {/* 本地文件面板 */}
      <div className="flex-1 flex flex-col border-r">
        <FilePane
          type="local"
          path={localPath}
          onPathChange={handleLocalPathChange}
          selectedFiles={selectedLocalFiles}
          onSelectedFilesChange={setSelectedLocalFiles}
          isLoading={false}
          refreshKey={localRefreshKey}
          extraRefreshKey={localRefreshTimestamp}
        />
      </div>

      {/* 中间操作栏 */}
      <div className="w-12 border-l border-r flex flex-col items-center py-4 gap-2 bg-muted/20">
        <button
          onClick={handleTransferToRemote}
          disabled={selectedLocalFiles.length === 0 || uploading}
          className={`
            p-2 rounded transition-all duration-200
            ${selectedLocalFiles.length > 0 && !uploading
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110 shadow-md'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed'
            }
          `}
          title={uploading ? t('sftp.status.uploading') : t('sftp.action.upload')}
        >
          <ChevronRight className={`h-4 w-4 ${uploading ? 'animate-pulse' : ''}`} />
        </button>

        <button
          onClick={handleTransferToLocal}
          disabled={selectedRemoteFiles.length === 0 || downloading}
          className={`
            p-2 rounded transition-all duration-200
            ${selectedRemoteFiles.length > 0 && !downloading
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110 shadow-md'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed'
            }
          `}
          title={downloading ? t('sftp.status.downloading') : t('sftp.action.download')}
        >
          <ChevronRight className={`h-4 w-4 transform rotate-180 ${downloading ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      {/* 远程文件面板 */}
      <div className="flex-1 flex flex-col">
        <FilePane
          type="remote"
          path={remotePath}
          connectionId={connectionId}
          onPathChange={handleRemotePathChange}
          selectedFiles={selectedRemoteFiles}
          onSelectedFilesChange={setSelectedRemoteFiles}
          isLoading={false}
          refreshKey={remoteRefreshKey}
          extraRefreshKey={remoteRefreshTimestamp}
        />
      </div>
    </div>
  );
}
