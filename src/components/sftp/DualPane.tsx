/**
 * 双面板文件管理器组件
 *
 * 显示本地和远程文件面板
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FilePane } from './FilePane';
import { useSftpStore } from '@/store/sftpStore';
import { ChevronRight, X, Upload, File, Folder, Download, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DualPaneProps {
  connectionId: string;
  remoteRefreshKey?: number;
  localRefreshKey?: number;
  onRemoteRefresh?: () => void;
  onLocalRefresh?: () => void;
}

export function DualPane({ 
  connectionId, 
  remoteRefreshKey = 0, 
  localRefreshKey = 0,
  onRemoteRefresh,
  onLocalRefresh,
}: DualPaneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    localPath,
    remotePath,
    setLocalPath,
    setRemotePath,
    selectedLocalFiles,
    selectedRemoteFiles,
    setSelectedLocalFiles,
    setSelectedRemoteFiles,
    activeUploadTasks,
    activeDownloadTasks,
    removeActiveUploadTask,
    removeActiveDownloadTask,
  } = useSftpStore();

  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // 优化：使用 CSS transition 来平滑隐藏/显示，而不是完全卸载组件
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);
  
  // 上传面板拖动状态
  const [isUploadDragging, setIsUploadDragging] = useState(false);
  const uploadPanelRef = useRef<HTMLDivElement>(null);
  const uploadDragStartRef = useRef({ x: 0, y: 0 });
  const uploadPanelPositionRef = useRef({ x: 0, y: 0 });
  
  // 下载面板拖动状态
  const [isDownloadDragging, setIsDownloadDragging] = useState(false);
  const downloadPanelRef = useRef<HTMLDivElement>(null);
  const downloadDragStartRef = useRef({ x: 0, y: 0 });
  const downloadPanelPositionRef = useRef({ x: 0, y: 0 });

  const handleLocalPathChange = (path: string) => {
    setLocalPath(path);
  };

  const handleRemotePathChange = (path: string) => {
    setRemotePath(path);
  };

  // 处理上传面板拖动 - 直接操作 DOM，完全避免 React 状态更新
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isUploadDragging || !uploadPanelRef.current) return;

      // 直接更新 DOM style，不经过 React
      const deltaX = e.clientX - uploadDragStartRef.current.x;
      const deltaY = e.clientY - uploadDragStartRef.current.y;
      
      const newX = uploadPanelPositionRef.current.x + deltaX;
      const newY = uploadPanelPositionRef.current.y + deltaY;

      uploadPanelRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const handleMouseUp = () => {
      if (uploadPanelRef.current) {
        // 更新 ref 值以备下次拖动
        const transform = uploadPanelRef.current.style.transform;
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (match) {
          uploadPanelPositionRef.current = {
            x: parseFloat(match[1]),
            y: parseFloat(match[2])
          };
        }
      }
      setIsUploadDragging(false);
    };

    if (isUploadDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isUploadDragging]);
  
  // 处理下载面板拖动 - 直接操作 DOM，完全避免 React 状态更新
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDownloadDragging || !downloadPanelRef.current) return;

      // 直接更新 DOM style，不经过 React
      const deltaX = e.clientX - downloadDragStartRef.current.x;
      const deltaY = e.clientY - downloadDragStartRef.current.y;
      
      const newX = downloadPanelPositionRef.current.x + deltaX;
      const newY = downloadPanelPositionRef.current.y + deltaY;

      downloadPanelRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const handleMouseUp = () => {
      if (downloadPanelRef.current) {
        // 更新 ref 值以备下次拖动
        const transform = downloadPanelRef.current.style.transform;
        const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (match) {
          downloadPanelPositionRef.current = {
            x: parseFloat(match[1]),
            y: parseFloat(match[2])
          };
        }
      }
      setIsDownloadDragging(false);
    };

    if (isDownloadDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDownloadDragging]);

  const handleCancelUpload = async () => {
    try {
      // 获取所有活跃的上传任务
      const tasks = Array.from(activeUploadTasks.values());

      if (tasks.length === 0) {
        toast.info(t('sftp.noUploadTasks'));
        return;
      }

      // 并发取消所有任务
      await Promise.all(
        tasks.map(task =>
          invoke('sftp_cancel_upload', {
            taskId: task.taskId,  // ✅ 使用正确的 taskId
          })
        )
      );

      // 清理任务状态
      tasks.forEach(task => removeActiveUploadTask(task.taskId));

      toast.success(t('sftp.uploadCancelled'));
    } catch (error) {
      console.error('Cancel upload failed:', error);
      toast.error(t('sftp.cancelUploadFailed'));
    }
  };

  const handleCancelSingleUpload = async (taskId: string) => {
    try {
      await invoke('sftp_cancel_upload', {
        taskId,  // ✅ 使用正确的 taskId
      });

      // 清理任务状态
      removeActiveUploadTask(taskId);

      toast.success(t('sftp.uploadCancelled'));
    } catch (error) {
      console.error('Cancel single upload failed:', error);
      toast.error(t('sftp.cancelUploadFailed'));
    }
  };

  const handleCancelDownload = async () => {
    try {
      // 获取所有活跃的下载任务
      const tasks = Array.from(activeDownloadTasks.values());

      if (tasks.length === 0) {
        toast.info(t('sftp.noDownloadTasks'));
        return;
      }

      // 并发取消所有任务
      await Promise.all(
        tasks.map(task =>
          invoke('sftp_cancel_download', {
            taskId: task.taskId,  // ✅ 使用正确的 taskId
          })
        )
      );

      // 清理任务状态
      tasks.forEach(task => removeActiveDownloadTask(task.taskId));

      toast.success(t('sftp.downloadCancelled'));
    } catch (error) {
      console.error('Cancel download failed:', error);
      toast.error(t('sftp.cancelDownloadFailed'));
    }
  };

  const handleCancelSingleDownload = async (taskId: string) => {
    try {
      await invoke('sftp_cancel_download', {
        taskId,  // ✅ 使用正确的 taskId
      });

      // 清理任务状态
      removeActiveDownloadTask(taskId);

      toast.success(t('sftp.downloadCancelled'));
    } catch (error) {
      console.error('Cancel single download failed:', error);
      toast.error(t('sftp.cancelDownloadFailed'));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec: number): string => {
    return `${formatFileSize(bytesPerSec)}/s`;
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatElapsedTime = (startTime: number, completedTime: number): string => {
    if (completedTime === 0) {
      // 任务进行中，显示当前用时
      const elapsed = Date.now() - startTime;
      return formatTime(elapsed);
    } else {
      // 任务完成，显示总用时
      const elapsed = completedTime - startTime;
      return formatTime(elapsed);
    }
  };

const handleUploadMouseDown = (e: React.MouseEvent) => {
    // 只在拖动区域响应
    const target = e.target as HTMLElement;
    if (!target.closest('.drag-area')) return;

    e.preventDefault();
    setIsUploadDragging(true);
    uploadDragStartRef.current = { x: e.clientX, y: e.clientY };
    // 读取当前 transform 值
    if (uploadPanelRef.current) {
      const transform = uploadPanelRef.current.style.transform;
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (match) {
        uploadPanelPositionRef.current = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2])
        };
      }
    }
  };
  
  const handleDownloadMouseDown = (e: React.MouseEvent) => {
    // 只在拖动区域响应
    const target = e.target as HTMLElement;
    if (!target.closest('.drag-area')) return;

    e.preventDefault();
    setIsDownloadDragging(true);
    downloadDragStartRef.current = { x: e.clientX, y: e.clientY };
    // 读取当前 transform 值
    if (downloadPanelRef.current) {
      const transform = downloadPanelRef.current.style.transform;
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (match) {
        downloadPanelPositionRef.current = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2])
        };
      }
    }
  };

  const handleTransferToRemote = async () => {
    if (selectedLocalFiles.length === 0) {
      toast.error(t('sftp.error.noFileSelected'));
      return;
    }

    setUploading(true);
    setShowUploadPanel(true); // 自动打开上传悬浮面板
    try {
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

      // 上传文件
      const window = getCurrentWindow();
      for (const file of files) {
        const remoteFilePath = remotePath.endsWith('/')
          ? `${remotePath}${file.name}`
          : `${remotePath}/${file.name}`;

        await invoke('sftp_upload_file', {
          connectionId,
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

        // 调用目录上传命令，获取返回结果
        const result = await invoke<{
          totalFiles: number;
          totalDirs: number;
          totalSize: number;
          elapsedTimeMs: number;
        }>('sftp_upload_directory', {
          connectionId,
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
      setSelectedLocalFiles([]);

      // 刷新远程面板
      onRemoteRefresh?.();
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
    setShowDownloadPanel(true); // 自动打开下载悬浮面板
    try {
      for (const file of selectedRemoteFiles) {
        const localFilePath = localPath.endsWith('/')
          ? `${localPath}${file.name}`
          : `${localPath}/${file.name}`;

        if (file.isDir) {
          // 目录下载
          const taskId = `download-dir-${connectionId}-${Date.now()}`;
          await invoke('sftp_download_directory', {
            connectionId,
            remoteDirPath: file.path,
            localDirPath: localFilePath,
            taskId,
          });
        } else {
          // 单文件下载
          await invoke('sftp_download_file', {
            connectionId,
            remotePath: file.path,
            localPath: localFilePath,
            window: getCurrentWindow(),
          });
        }
      }

      toast.success(t('sftp.success.downloadSuccess', { count: selectedRemoteFiles.length }));
      setSelectedRemoteFiles([]);

      // 刷新本地面板
      onLocalRefresh?.();
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(t('sftp.error.downloadFailed', { error }));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="h-full flex relative">
      {/* 上传进度悬浮面板 - 即时显示/隐藏 */}
        <div
          ref={uploadPanelRef}
          className={`fixed z-[9999] w-96 max-h-96 overflow-y-auto ${
            showUploadPanel ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            top: `${64}px`,
            left: `calc(100% - 400px)`,
            transform: `translate(${uploadPanelPositionRef.current.x}px, ${uploadPanelPositionRef.current.y}px)`
          }}
          onMouseDown={handleUploadMouseDown}
        >
          <Card className="shadow-2xl shadow-black/20 border-2 border-primary/40 backdrop-blur-sm bg-background/95">
            {/* 可拖动的标题栏 */}
            <div className="drag-area p-4 pb-3 border-b select-none bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{t('sftp.uploadProgress')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/sftp/upload-records')}
                    className="h-7 px-2 text-xs"
                    title={t('sftp.viewUploadRecords')}
                  >
                    {t('sftp.viewRecords')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUploadPanel(false)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t('sftp.dragToMove')}
              </div>
            </div>

            {/* 面板内容 */}
            <div className="p-4">
              {(() => {
                return null;
              })()}
              {activeUploadTasks.size > 0 ? (
                Array.from(activeUploadTasks.values()).map((task) => {
                  const progress = (task.bytesTransferred / task.totalBytes) * 100;
                  const isCompleted = task.status === 'completed';

                  // 计算用时时间
                  const displayTime = formatElapsedTime(task.startTime, task.completedTime);

                  return (
                    <div key={task.taskId} className="group mb-3 last:mb-0 relative">
                      {/* 文件计数进度 */}
                      <Progress
                        value={progress}
                        className="h-2 mb-2"
                      />

                      {/* 当前上传的文件 */}
                      <div className="flex items-start gap-2 text-xs mb-2">
                        <File className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0 pr-8">
                          <div className="font-mono truncate" title={task.filePath}>
                            {isCompleted ? task.uploadName : task.fileName}
                          </div>
                        </div>
                      </div>

                      {/* 传输速度和统计信息 */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>{formatFileSize(task.bytesTransferred)} / {formatFileSize(task.totalBytes)}</span>
                          {task.speed > 0 && !isCompleted && (
                            <span className="text-primary">• {formatSpeed(task.speed)}</span>
                          )}
                        </div>
                        <span>{progress.toFixed(1)}%</span>
                      </div>

                      {task.filesCompleted > 0 && task.totalFiles > 1 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Folder className="h-3 w-3" />
                          <span>
                            {task.filesCompleted} / {task.totalFiles} {t('sftp.files')}
                          </span>
                        </div>
                      )}

                      {/* 时间和取消按钮行 */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{displayTime}</span>
                        </div>
                        
                        {/* 取消按钮（悬停显示） */}
                        {!isCompleted && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelSingleUpload(task.taskId)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title={t('sftp.cancelUpload')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <Upload className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>{t('sftp.noUploadTasks')}</p>
                </div>
              )}

              {/* 取消按钮 */}
              {activeUploadTasks.size > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelUpload}
                    className="w-full"
                  >
                    <X className="h-3 w-3 mr-2" />
                    {t('sftp.cancelAllUploads')}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 下载进度悬浮面板 - 即时显示/隐藏 */}
        <div
          ref={downloadPanelRef}
          className={`fixed z-[9999] w-96 max-h-96 overflow-y-auto ${
            showDownloadPanel ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            top: `${64}px`,
            left: '20px',
            transform: `translate(${downloadPanelPositionRef.current.x}px, ${downloadPanelPositionRef.current.y}px)`
          }}
          onMouseDown={handleDownloadMouseDown}
        >
          <Card className="shadow-2xl shadow-black/20 border-2 border-primary/40 backdrop-blur-sm bg-background/95">
            {/* 可拖动的标题栏 */}
            <div className="drag-area p-4 pb-3 border-b select-none bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{t('sftp.downloadProgress')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/sftp/download-records')}
                    className="h-7 px-2 text-xs"
                    title={t('sftp.viewDownloadRecords')}
                  >
                    {t('sftp.viewRecords')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDownloadPanel(false)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t('sftp.dragToMove')}
              </div>
            </div>

{/* 面板内容 */}
            <div className="p-4">
              {(() => {
                return null;
              })()}
              {activeDownloadTasks.size > 0 ? (
                Array.from(activeDownloadTasks.values()).map((task) => {
                  const progress = (task.bytesTransferred / task.totalBytes) * 100;
                  const isCompleted = task.status === 'completed';

                  // 计算用时时间
                  const displayTime = formatElapsedTime(task.startTime, task.completedTime);

                  return (
                    <div key={task.taskId} className="group mb-3 last:mb-0 relative">
                      {/* 文件计数进度 */}
                      <Progress
                        value={progress}
                        className="h-2 mb-2"
                      />

                      {/* 当前下载的文件 */}
                      <div className="flex items-start gap-2 text-xs mb-2">
                        <File className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0 pr-8">
                          <div className="font-mono truncate" title={task.filePath}>
                            {task.fileName}
                          </div>
                        </div>
                      </div>

                      {/* 传输速度和统计信息 */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>{formatFileSize(task.bytesTransferred)} / {formatFileSize(task.totalBytes)}</span>
                          {task.speed > 0 && !isCompleted && (
                            <span className="text-primary">• {formatSpeed(task.speed)}</span>
                          )}
                        </div>
                        <span>{progress.toFixed(1)}%</span>
                      </div>

                      {task.filesCompleted > 0 && task.totalFiles > 1 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Folder className="h-3 w-3" />
                          <span>
                            {task.filesCompleted} / {task.totalFiles} {t('sftp.files')}
                          </span>
                        </div>
                      )}

                      {/* 时间和取消按钮行 */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{displayTime}</span>
                        </div>
                        
                        {/* 取消按钮（悬停显示） */}
                        {!isCompleted && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelSingleDownload(task.taskId)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title={t('sftp.cancelDownload')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <Download className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>{t('sftp.noDownloadTasks')}</p>
                </div>
              )}

              {/* 取消按钮 */}
              {activeDownloadTasks.size > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelDownload}
                    className="w-full"
                  >
                    <X className="h-3 w-3 mr-2" />
                    {t('sftp.cancelAllDownloads')}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

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
        />
      </div>

      {/* 中间操作栏 */}
      <div className="w-12 border-l border-r flex flex-col items-center py-4 gap-2 bg-muted/20">
        {/* 上传进度按钮 */}
        <button
          onClick={() => setShowUploadPanel(!showUploadPanel)}
          className={`
            p-2 rounded transition-all duration-200 relative
            ${showUploadPanel
              ? 'bg-foreground text-background hover:bg-foreground/90 shadow-md'
              : 'bg-background text-foreground hover:bg-muted'
            }
          `}
          title="查看上传进度"
        >
          <Upload className={`h-4 w-4 ${uploading ? 'animate-pulse' : ''}`} />
          {activeUploadTasks.size > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
              {activeUploadTasks.size}
            </span>
          )}
        </button>

        <div className="h-px w-6 bg-border my-1"></div>

        {/* 下载进度按钮 */}
        <button
          onClick={() => setShowDownloadPanel(!showDownloadPanel)}
          className={`
            p-2 rounded transition-all duration-200 relative
            ${showDownloadPanel
              ? 'bg-foreground text-background hover:bg-foreground/90 shadow-md'
              : 'bg-background text-foreground hover:bg-muted'
            }
          `}
          title="查看下载进度"
        >
          <Download className={`h-4 w-4 ${downloading ? 'animate-pulse' : ''}`} />
          {activeDownloadTasks.size > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
              {activeDownloadTasks.size}
            </span>
          )}
        </button>

        <div className="h-px w-6 bg-border my-1"></div>

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
        />
      </div>
    </div>
  );
}
