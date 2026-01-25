/**
 * 双面板文件管理器组件
 *
 * 显示本地和远程文件面板
 */

import { useEffect, useState } from 'react';
import { FilePane } from './FilePane';
import { useSftpStore } from '@/store/sftpStore';
import { ChevronRight } from 'lucide-react';

interface DualPaneProps {
  connectionId: string;
}

export function DualPane({ connectionId }: DualPaneProps) {
  const {
    localPath,
    remotePath,
    setLocalPath,
    setRemotePath,
    selectedLocalFiles,
    selectedRemoteFiles,
    setSelectedLocalFiles,
    setSelectedRemoteFiles,
    listDir,
  } = useSftpStore();

  const [localLoading] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);

  // 加载远程目录
  useEffect(() => {
    if (connectionId && remotePath) {
      loadRemoteDir();
    }
  }, [connectionId, remotePath]);

  const loadRemoteDir = async () => {
    setRemoteLoading(true);
    try {
      const files = await listDir(connectionId, remotePath);
      console.log('Remote files loaded:', files.length);
    } catch (error) {
      console.error('Failed to load remote directory:', error);
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleLocalPathChange = (path: string) => {
    setLocalPath(path);
  };

  const handleRemotePathChange = (path: string) => {
    setRemotePath(path);
  };

  const handleTransferToRemote = async () => {
    // TODO: 实现从本地上传到远程
    console.log('Transfer to remote:', selectedLocalFiles);
  };

  const handleTransferToLocal = async () => {
    // TODO: 实现从远程下载到本地
    console.log('Transfer to local:', selectedRemoteFiles);
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
          isLoading={localLoading}
        />
      </div>

      {/* 中间操作栏 */}
      <div className="w-12 border-l border-r flex flex-col items-center py-4 gap-2 bg-muted/20">
        <button
          onClick={handleTransferToRemote}
          disabled={selectedLocalFiles.length === 0}
          className="p-2 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          title="上传到远程"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={handleTransferToLocal}
          disabled={selectedRemoteFiles.length === 0}
          className="p-2 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          title="下载到本地"
        >
          <ChevronRight className="h-4 w-4 transform rotate-180" />
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
          isLoading={remoteLoading}
        />
      </div>
    </div>
  );
}
