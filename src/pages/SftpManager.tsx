/**
 * SFTP 文件管理器主页面
 *
 * 提供双面板文件管理界面
 */

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Upload, Download, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSessionStore } from '@/store/sessionStore';
import { useSftpStore } from '@/store/sftpStore';
import { toast } from 'sonner';
import { DualPane } from '@/components/sftp/DualPane';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';

// 上传进度事件类型
interface UploadProgressEvent {
  taskId: string; // 上传任务的唯一 ID
  connectionId: string;
  currentFile: string;
  currentDir: string;
  filesCompleted: number;
  totalFiles: number;
  bytesTransferred: number;
  totalBytes: number;
  speedBytesPerSec: number;
  startTime: number; // 任务开始时间（Unix 时间戳，毫秒）
  completedTime: number; // 当前时间（Unix 时间戳，毫秒），用于计算任务用时
  uploadName: string; // 上传任务名称（单文件时是文件名，目录时是目录名）
}

// 下载进度事件类型
interface DownloadProgressEvent {
  taskId: string;
  connectionId: string;
  currentFile: string;
  currentDir: string;
  filesCompleted: number;
  totalFiles: number;
  bytesTransferred: number;
  totalBytes: number;
  speedBytesPerSec: number;
  startTime: number; // 任务开始时间（Unix 时间戳，毫秒）
  completedTime: number; // 当前时间（Unix 时间戳，毫秒），用于计算任务用时
}

export function SftpManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessions } = useSessionStore();
  const {
    initializeLocalPath,
    selectedLocalFiles,
    selectedRemoteFiles,
    localPath,
    remotePath,
    setSelectedLocalFiles,
    setSelectedRemoteFiles,
    activeUploadTasks,
    activeDownloadTasks,
    addActiveUploadTask,
    updateActiveUploadTask,
    removeActiveUploadTask,
    addActiveDownloadTask,
    updateActiveDownloadTask,
    removeActiveDownloadTask,
    listenUploadStatusChange,
    listenDownloadStatusChange,
  } = useSftpStore();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [remoteRefreshKey, setRemoteRefreshKey] = useState(0);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  // @ts-ignore - Used in useEffect closures
  const [uploadProgressMap, setUploadProgressMap] = useState<Map<string, UploadProgressEvent>>(new Map());
  // @ts-ignore - Used in useEffect closures
  const [downloadProgressMap, setDownloadProgressMap] = useState<Map<string, DownloadProgressEvent>>(new Map());
  // @ts-ignore - Used in useEffect closures
  const [uploadCancellable, setUploadCancellable] = useState(false);
  // @ts-ignore - Used in useEffect closures
  const [downloadCancellable, setDownloadCancellable] = useState(false);
  



  // 使用 ref 跟踪是否已经初始化过，避免重复初始化
  const isInitialized = useRef(false);

  // 获取可用的 SSH 连接，根据 id 去重
  const availableConnections = (sessions || [])
    .filter((conn) => conn.status === 'connected')
    .filter((conn, index, self) =>
      index === self.findIndex((c) => c.id === conn.id)
    );

  // 初始化本地路径（只执行一次）
  useEffect(() => {
    if (!isInitialized.current) {
      initializeLocalPath();
      isInitialized.current = true;
    }
  }, []);

  useEffect(() => {
    // 如果有连接且未选择，自动选择第一个
    if (availableConnections.length > 0 && !selectedConnectionId) {
      setSelectedConnectionId(availableConnections[0].id);
    }
  }, [availableConnections, selectedConnectionId]);

  // 监听快捷键事件
  useEffect(() => {
    const handleUploadShortcut = () => {
      console.log('[SftpManager] Upload shortcut triggered');
      handleUpload();
    };

    const handleDownloadShortcut = () => {
      console.log('[SftpManager] Download shortcut triggered');
      handleDownload();
    };

    const handleRefreshShortcut = () => {
      console.log('[SftpManager] Refresh shortcut triggered');
      handleRefresh();
    };

    window.addEventListener('keybinding-sftp-upload', handleUploadShortcut);
    window.addEventListener('keybinding-sftp-download', handleDownloadShortcut);
    window.addEventListener('keybinding-sftp-refresh', handleRefreshShortcut);

    return () => {
      window.removeEventListener('keybinding-sftp-upload', handleUploadShortcut);
      window.removeEventListener('keybinding-sftp-download', handleDownloadShortcut);
      window.removeEventListener('keybinding-sftp-refresh', handleRefreshShortcut);
    };
  }, [selectedConnectionId, selectedLocalFiles, selectedRemoteFiles, localPath, remotePath]);

  // 监听上传进度事件
  useEffect(() => {
    console.log('[SftpManager] Setting up upload progress listener for connection:', selectedConnectionId);
    const unlisten = listen<UploadProgressEvent>('sftp-upload-progress', (event) => {
      const progress = event.payload;
      console.log('[SftpManager] Upload progress event received:', progress);
      console.log('[SftpManager] Event connectionId:', progress.connectionId, 'Selected connection_id:', selectedConnectionId);

      if (progress.connectionId === selectedConnectionId) {
        console.log('[SftpManager] Connection ID matches, updating progress map');
        setUploadProgressMap(prev => new Map(prev).set(progress.taskId, progress));
        setUploadCancellable(true);

        // 更新临时任务存储
        const existingTask = activeUploadTasks.get(progress.taskId);
        console.log('[SftpManager] Existing task:', existingTask ? 'Yes' : 'No');

        if (!existingTask) {
          // 新任务，添加到临时存储
          console.log('[SftpManager] Adding new upload task:', progress.taskId);
          const fileName = progress.currentFile ? progress.currentFile.split(/[/\\]/).pop() || progress.currentFile : progress.currentDir.split(/[/\\]/).pop() || 'Unknown';
          const filePath = progress.currentFile || progress.currentDir;

          addActiveUploadTask({
            taskId: progress.taskId,
            fileName,
            filePath,
            bytesTransferred: progress.bytesTransferred,
            totalBytes: progress.totalBytes,
            speed: progress.speedBytesPerSec,
            status: 'uploading',
            startTime: progress.startTime,
            completedTime: progress.completedTime,
            filesCompleted: progress.filesCompleted,
            totalFiles: progress.totalFiles,
            uploadName: progress.uploadName || fileName,
          });
        } else {
          // 更新现有任务
          console.log('[SftpManager] Updating existing upload task:', progress.taskId);

          updateActiveUploadTask(progress.taskId, {
            bytesTransferred: progress.bytesTransferred,
            speed: progress.speedBytesPerSec,
            filesCompleted: progress.filesCompleted,
            totalFiles: progress.totalFiles,
            startTime: progress.startTime,
            completedTime: progress.completedTime,
          });
        }
      } else {
        console.log('[SftpManager] Connection ID mismatch, ignoring event');
      }
    });

    return () => {
      console.log('[SftpManager] Cleaning up upload progress listener');
      unlisten.then(fn => fn());
    };
  }, [selectedConnectionId, addActiveUploadTask, updateActiveUploadTask, removeActiveUploadTask]);

  // 监听下载进度事件
  useEffect(() => {
    console.log('[SftpManager] Setting up download progress listener for connection:', selectedConnectionId);
    const unlisten = listen<DownloadProgressEvent>('sftp-download-progress', (event) => {
      const progress = event.payload;
      console.log('[SftpManager] Download progress event received:', progress);
            console.log('[SftpManager] Event connectionId:', progress.connectionId, 'Selected connection_id:', selectedConnectionId);
      
            if (progress.connectionId === selectedConnectionId) {
              console.log('[SftpManager] Connection ID matches, updating progress map');
              setDownloadProgressMap(prev => new Map(prev).set(progress.taskId, progress));
              setDownloadCancellable(true);
      
              // 更新临时任务存储
              const existingTask = activeDownloadTasks.get(progress.taskId);
              console.log('[SftpManager] Existing task:', existingTask ? 'Yes' : 'No');
      
              if (!existingTask) {
                              // 新任务，添加到临时存储
                              console.log('[SftpManager] Adding new download task:', progress.taskId);
                              const fileName = progress.currentFile ? progress.currentFile.split(/[/\\]/).pop() || progress.currentFile : progress.currentDir.split(/[/\\]/).pop() || 'Unknown';
                              const filePath = progress.currentFile || progress.currentDir;
              
                              addActiveDownloadTask({
                                taskId: progress.taskId,
                                fileName,
                                filePath,
                                bytesTransferred: progress.bytesTransferred,
                                totalBytes: progress.totalBytes,
                                speed: progress.speedBytesPerSec,
                                status: 'downloading',
                                startTime: progress.startTime,
                                completedTime: progress.completedTime,
                                filesCompleted: progress.filesCompleted,
                                totalFiles: progress.totalFiles,
                                uploadName: fileName, // 下载任务使用文件名作为 uploadName
                              });
                            } else {
                              // 更新现有任务
                              console.log('[SftpManager] Updating existing download task:', progress.taskId);
              
                              updateActiveDownloadTask(progress.taskId, {
                                bytesTransferred: progress.bytesTransferred,
                                speed: progress.speedBytesPerSec,
                                filesCompleted: progress.filesCompleted,
                                totalFiles: progress.totalFiles,
                                startTime: progress.startTime,
                                completedTime: progress.completedTime,
                              });
                            }            } else {
              console.log('[SftpManager] Connection ID mismatch, ignoring event');
            }    });

    return () => {
      console.log('[SftpManager] Cleaning up download progress listener');
      unlisten.then(fn => fn());
    };
  }, [selectedConnectionId, addActiveDownloadTask, updateActiveDownloadTask, removeActiveDownloadTask]);

  // 监听上传状态变更事件
  useEffect(() => {
    if (!selectedConnectionId) return;

    console.log('[SftpManager] Setting up upload status change listener for connection:', selectedConnectionId);

    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlistenFn = await listenUploadStatusChange(selectedConnectionId, () => {
          // 上传完成或取消时，刷新远程面板
          console.log('[SftpManager] Upload completed/cancelled, refreshing remote panel');
          setRemoteRefreshKey(prev => prev + 1);
        });
      } catch (error) {
        console.error('[SftpManager] Failed to setup upload status change listener:', error);
      }
    };

    setupListener();

    return () => {
      console.log('[SftpManager] Cleaning up upload status change listener');
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [selectedConnectionId, listenUploadStatusChange]);

  // 监听下载状态变更事件
  useEffect(() => {
    if (!selectedConnectionId) return;

    console.log('[SftpManager] Setting up download status change listener for connection:', selectedConnectionId);

    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlistenFn = await listenDownloadStatusChange(selectedConnectionId, () => {
          // 下载完成或取消时，刷新本地面板
          console.log('[SftpManager] Download completed/cancelled, refreshing local panel');
          setLocalRefreshKey(prev => prev + 1);
        });
      } catch (error) {
        console.error('[SftpManager] Failed to setup download status change listener:', error);
      }
    };

    setupListener();

    return () => {
      console.log('[SftpManager] Cleaning up download status change listener');
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [selectedConnectionId, listenDownloadStatusChange]);

  const handleConnect = async (connectionId: string) => {
    playSound(SoundEffect.BUTTON_CLICK);
    setSelectedConnectionId(connectionId);
    const connection = availableConnections.find(c => c.id === connectionId);
    toast.success(t('sftp.success.switchedToConnection', { name: connection?.name || connectionId, host: connection?.host }));
  };

  const handleRefresh = async () => {
    playSound(SoundEffect.BUTTON_CLICK);
    if (!selectedConnectionId) {
      toast.error(t('sftp.error.noConnectionSelected'));
      return;
    }
    setIsLoading(true);
    try {
      // 刷新远程文件列表
      setRemoteRefreshKey(prev => prev + 1);

      // 刷新本地文件列表
      setLocalRefreshKey(prev => prev + 1);

      // 取消所有选中状态
      setSelectedLocalFiles([]);
      setSelectedRemoteFiles([]);

      // 等待一下让刷新生效
      await new Promise((resolve) => setTimeout(resolve, 300));

      toast.success(t('sftp.success.refreshSuccess'));
      playSound(SoundEffect.SUCCESS);
    } catch (error) {
      toast.error(t('sftp.error.refreshFailed'), { description: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoteRefresh = () => {
    setRemoteRefreshKey(prev => prev + 1);
  };

  const handleLocalRefresh = () => {
    setLocalRefreshKey(prev => prev + 1);
  };

  const handleUpload = async () => {
    playSound(SoundEffect.BUTTON_CLICK);
    if (!selectedConnectionId) {
      toast.error(t('sftp.error.noConnectionSelected'));
      return;
    }

    if (selectedLocalFiles.length === 0) {
      toast.error(t('sftp.error.noFileSelected'));
      return;
    }

    console.log('Upload button clicked');
    console.log('Selected local files:', selectedLocalFiles);
    console.log('Remote path:', remotePath);
    console.log('Connection ID:', selectedConnectionId);

    // 分离文件和目录
    const files: typeof selectedLocalFiles = [];
    const directories: typeof selectedLocalFiles = [];

    selectedLocalFiles.forEach(file => {
      if (file.isDir) {
        directories.push(file);
      } else {
        files.push(file);
      }
    });

    console.log(`Found ${files.length} files and ${directories.length} directories to upload`);

    setUploading(true);
    setUploadProgressMap(new Map());
    setUploadCancellable(directories.length > 0);

    try {
      const window = getCurrentWindow();
      // 上传文件
      for (const file of files) {
        // 构建远程文件路径
        let remoteFilePath: string;
        if (remotePath === '/') {
          remoteFilePath = `/${file.name}`;
        } else if (remotePath.endsWith('/')) {
          remoteFilePath = `${remotePath}${file.name}`;
        } else {
          remoteFilePath = `${remotePath}/${file.name}`;
        }

        console.log('Uploading file:', file.path, '->', remoteFilePath);

        await invoke('sftp_upload_file', {
          connectionId: selectedConnectionId,
          localPath: file.path,
          remotePath: remoteFilePath,
          window: window,
        });
      }

      // 上传目录并收集实际文件和目录数量
      let totalFilesInDirectories = 0;
      let totalDirsInDirectories = 0;
      for (const dir of directories) {
        let remoteDirPath: string;
        if (remotePath === '/') {
          remoteDirPath = `/${dir.name}`;
        } else if (remotePath.endsWith('/')) {
          remoteDirPath = `${remotePath}${dir.name}`;
        } else {
          remoteDirPath = `${remotePath}/${dir.name}`;
        }

        // 为每个目录生成唯一的 task_id
        const taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        console.log('Uploading directory:', dir.path, '->', remoteDirPath, 'task_id:', taskId);

        // 调用目录上传命令，获取返回结果
        const result = await invoke<{
          totalFiles: number;
          totalDirs: number;
          totalSize: number;
          elapsedTimeMs: number;
        }>('sftp_upload_directory', {
          connectionId: selectedConnectionId,
          localDirPath: dir.path,
          remoteDirPath: remoteDirPath,
          taskId: taskId,
        });

        totalFilesInDirectories += result.totalFiles;
        totalDirsInDirectories += result.totalDirs;
      }

      // 计算实际上传的文件和目录总数
      const totalFiles = files.length + totalFilesInDirectories;
      const totalDirs = directories.length + totalDirsInDirectories;
      toast.success(`上传成功：${totalFiles} 个文件, ${totalDirs} 个目录`);
      playSound(SoundEffect.SUCCESS);
      setSelectedLocalFiles([]);

      // 刷新远程面板
      setRemoteRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(t('sftp.error.uploadFailed', { error }));
      playSound(SoundEffect.ERROR);
    } finally {
      setUploading(false);
      setUploadProgressMap(new Map());
      setUploadCancellable(false);
    }
  };
  
    const handleDownload = async () => {    playSound(SoundEffect.BUTTON_CLICK);
    if (!selectedConnectionId) {
      toast.error(t('sftp.error.noConnectionSelected'));
      return;
    }

    if (selectedRemoteFiles.length === 0) {
      toast.error(t('sftp.error.noFileSelected'));
      return;
    }

    setDownloading(true);
    try {
      // 分离文件和目录
      const files: typeof selectedRemoteFiles = [];
      const directories: typeof selectedRemoteFiles = [];

      selectedRemoteFiles.forEach(file => {
        if (file.isDir) {
          directories.push(file);
        } else {
          files.push(file);
        }
      });

      // 下载文件
      for (const file of files) {
        const localFilePath = localPath.endsWith('\\')
          ? `${localPath}${file.name}`
          : `${localPath}\\${file.name}`;

        await invoke('sftp_download_file', {
          connectionId: selectedConnectionId,
          remotePath: file.path,
          localPath: localFilePath,
        });
      }

      // 下载目录
      let totalFilesInDirectories = 0;
      let totalDirsInDirectories = 0;
      for (const dir of directories) {
        let localDirPath = localPath.endsWith('\\')
          ? `${localPath}${dir.name}`
          : `${localPath}\\${dir.name}`;

        // 为每个目录生成唯一的 task_id
        const taskId = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        console.log('Downloading directory:', dir.path, '->', localDirPath, 'task_id:', taskId);

        // 调用目录下载命令，获取返回结果
        const result = await invoke<{
          totalFiles: number;
          totalDirs: number;
          totalSize: number;
          elapsedTimeMs: number;
        }>('sftp_download_directory', {
          connectionId: selectedConnectionId,
          remoteDirPath: dir.path,
          localDirPath: localDirPath,
          taskId: taskId,
        });

        totalFilesInDirectories += result.totalFiles;
        totalDirsInDirectories += result.totalDirs;
      }

      // 计算实际下载的文件和目录总数
      const totalFiles = files.length + totalFilesInDirectories;
      const totalDirs = directories.length + totalDirsInDirectories;
      toast.success(`下载成功：${totalFiles} 个文件, ${totalDirs} 个目录`);
      playSound(SoundEffect.SUCCESS);
      setSelectedRemoteFiles([]);

      // 刷新本地面板
      setLocalRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(t('sftp.error.downloadFailed', { error }));
      playSound(SoundEffect.ERROR);
    } finally {
      setDownloading(false);
      setDownloadProgressMap(new Map());
      setDownloadCancellable(false);
    }
  };

  // 检查是否有子路由（上传记录或下载记录页面）
  const hasChildRoute = location.pathname.includes('/upload-records') || location.pathname.includes('/download-records');

  if (availableConnections.length === 0) {
    return (
      <div className="flex-1 flex items-start justify-center pt-32 bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{t('sftp.title')}</h2>
          <p className="text-muted-foreground mb-6">
            {t('sftp.error.noConnectionsAvailable')}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {t('sftp.error.connectFirst')}
          </p>
          <Button onClick={() => {
            playSound(SoundEffect.BUTTON_CLICK);
            navigate('/terminal');
          }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('sftp.action.goToTerminal')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 子路由内容（上传记录或下载记录页面） */}
      <div className={hasChildRoute ? 'block' : 'hidden'}>
        <Outlet />
      </div>

      {/* SFTP 主界面 */}
      <div className={hasChildRoute ? 'hidden' : 'block h-screen flex flex-col bg-background'}>
        {/* 顶部工具栏 */}
        <div className="border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                playSound(SoundEffect.BUTTON_CLICK);
                navigate('/terminal');
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-lg font-semibold">{t('sftp.title')}</h1>
              <p className="text-xs text-muted-foreground">
                {t('sftp.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 连接选择器 */}
            <Select
              value={selectedConnectionId || ''}
              onValueChange={handleConnect}
              disabled={availableConnections.length === 0}
            >
              <SelectTrigger className="w-[200px]">
                <HardDrive className="h-4 w-4 mr-2 opacity-50" />
                <SelectValue placeholder={t('sftp.action.selectConnection')} />
              </SelectTrigger>
              <SelectContent>
                {availableConnections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.name} - {conn.username}@{conn.host}:{conn.port}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || !selectedConnectionId}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleUpload}
              disabled={!selectedConnectionId || uploading || selectedLocalFiles.length === 0}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? t('sftp.status.uploading') : t('sftp.action.upload')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!selectedConnectionId || downloading || selectedRemoteFiles.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading ? t('sftp.status.downloading') : t('sftp.action.download')}
            </Button>
          </div>
        </div>
      </div>

      {/* 双面板文件管理器 */}
      {selectedConnectionId ? (
        <div className="flex-1 overflow-hidden">
          <DualPane
            connectionId={selectedConnectionId}
            remoteRefreshKey={remoteRefreshKey}
            localRefreshKey={localRefreshKey}
            onRemoteRefresh={handleRemoteRefresh}
            onLocalRefresh={handleLocalRefresh}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">{t('sftp.error.selectConnectionFirst')}</p>
        </div>
      )}
      </div>
    </>
  );
}
