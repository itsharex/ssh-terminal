/**
 * 文件面板组件
 *
 * 显示本地或远程文件列表
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
// import { openPath } from '@tauri-apps/plugin-opener';
import { FileList } from './FileList';
import { ArrowUp, Home, RefreshCw, FolderPlus, Trash2, Edit2, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { SftpFileInfo } from '@/types/sftp';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';

interface FilePaneProps {
  type: 'local' | 'remote';
  path: string;
  connectionId?: string; // 用于远程文件
  onPathChange: (path: string) => void;
  selectedFiles: SftpFileInfo[];
  onSelectedFilesChange: (files: SftpFileInfo[]) => void;
  isLoading?: boolean;
  refreshKey?: number;
}

export function FilePane({
  type,
  path,
  connectionId,
  onPathChange,
  selectedFiles,
  onSelectedFilesChange,
  isLoading = false,
  refreshKey = 0,
}: FilePaneProps) {
  const { t } = useTranslation();
  const [inputPath, setInputPath] = useState(path);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  const [availableDrives, setAvailableDrives] = useState<string[]>([]);

  // 同步外部 path 变化到 inputPath
  useEffect(() => {
    setInputPath(path);
  }, [path]);

  // 监听外部的 refreshKey 变化
  useEffect(() => {
    // 只在 refreshKey 变化且大于当前内部 key 时才刷新
    if (refreshKey > 0 && refreshKey !== internalRefreshKey) {
      setInternalRefreshKey(refreshKey);
    }
  }, [refreshKey, internalRefreshKey]);
  const joinPath = (basePath: string, fileName: string): string => {
    if (type === 'local') {
      // Windows 本地路径使用反斜杠
      if (basePath.endsWith('\\') || basePath.endsWith('/')) {
        return `${basePath}${fileName}`;
      }
      return `${basePath}\\${fileName}`;
    } else {
      // 远程 Unix 路径使用正斜杠
      if (basePath === '/') {
        return `/${fileName}`;
      }
      if (basePath.endsWith('/')) {
        return `${basePath}${fileName}`;
      }
      return `${basePath}/${fileName}`;
    }
  };

  // 获取父目录路径
  const getParentPath = (filePath: string): string => {
    if (type === 'local') {
      // Windows 路径
      const lastBackslash = filePath.lastIndexOf('\\');
      const lastSlash = filePath.lastIndexOf('/');
      const lastSeparator = Math.max(lastBackslash, lastSlash);
      
      if (lastSeparator > 0) {
        const parentPath = filePath.substring(0, lastSeparator);
        // 检查是否是盘符根目录（如 D:、C:）
        const driveMatch = parentPath.match(/^([A-Z]):$/);
        if (driveMatch) {
          // 如果是盘符根目录，返回盘符加反斜杠（D:\）
          return parentPath + '\\';
        }
        return parentPath;
      }
      
      // 如果是根目录（如 D:\），返回原路径
      return filePath;
    } else {
      // Unix 路径
      const lastSlash = filePath.lastIndexOf('/');
      if (lastSlash > 0) {
        return filePath.substring(0, lastSlash);
      }
      return '/';
    }
  };

  // 同步外部 path 变化到 inputPath
  useEffect(() => {
    setInputPath(path);
  }, [path]);

  // 加载可用盘符（仅本地文件系统）
  useEffect(() => {
    if (type === 'local') {
      const loadDrives = async () => {
        try {
          const drives = await invoke<string[]>('local_available_drives');
          setAvailableDrives(drives);
        } catch (error) {
          console.error('Failed to load drives:', error);
        }
      };
      loadDrives();
    }
  }, [type]); // 只依赖 type，不依赖 refreshKey（盘符在运行期间不会改变）

  const handleGoToParent = () => {
    playSound(SoundEffect.BUTTON_CLICK);
    const parentPath = getParentPath(path);
    onPathChange(parentPath);

    // 仅对远程文件操作显示提示
    if (type === 'remote') {
      toast.success(t('sftp.success.enteredParent'));
    }
    // 本地文件不显示提示
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      if (type === 'remote' && connectionId) {
        const folderPath = joinPath(path, newFolderName);

        // 调用后端创建文件夹API
        await invoke('sftp_create_dir', {
          connectionId,
          path: folderPath,
          recursive: false,
        });
        toast.success(t('sftp.success.folderCreated', { name: newFolderName }));
        playSound(SoundEffect.SUCCESS);
      }
      setShowNewFolderDialog(false);
      setNewFolderName('');
      // 刷新列表
      setInternalRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to create folder:', error);
      const errorMsg = String(error);
      if (errorMsg.includes('Permission denied')) {
        toast.error(t('sftp.error.createPermissionDenied'));
      } else if (errorMsg.includes('exists') || errorMsg.includes('already exists')) {
        toast.error(t('sftp.error.folderExists', { name: newFolderName }));
      } else if (errorMsg.includes('No such file')) {
        toast.error(t('sftp.error.parentPathNotExists'));
      } else {
        toast.error(t('sftp.error.createFailed', { error: errorMsg }));
      }
      playSound(SoundEffect.ERROR);
    }
  };

  const handleDelete = async () => {
    try {
      if (type === 'remote' && connectionId) {
        // 调用后端删除API
        for (const file of selectedFiles) {
          if (file.isDir) {
            await invoke('sftp_remove_dir', {
              connectionId,
              path: file.path,
              recursive: true, // 递归删除，可以删除包含子目录和文件的目录
            });
          } else {
            await invoke('sftp_remove_file', {
              connectionId,
              path: file.path,
            });
          }
        }
        toast.success(t('sftp.success.deleteSuccess', { count: selectedFiles.length }));
        playSound(SoundEffect.SUCCESS);
      }
      setShowDeleteDialog(false);
      onSelectedFilesChange([]);
      // 刷新列表
      setInternalRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to delete:', error);
      const errorMsg = String(error);
      if (errorMsg.includes('Permission denied')) {
        toast.error(t('sftp.error.deletePermissionDenied'));
      } else if (errorMsg.includes('No such file')) {
        toast.error(t('sftp.error.fileNotExists'));
      } else if (errorMsg.includes('Directory not empty')) {
        toast.error(t('sftp.error.directoryNotEmpty'));
      } else {
        toast.error(t('sftp.error.deleteFailed', { error: errorMsg }));
      }
      playSound(SoundEffect.ERROR);
    }
  };

  const handleRename = async () => {
    if (!renameValue.trim() || selectedFiles.length !== 1) return;

    try {
      if (type === 'remote' && connectionId) {
        const file = selectedFiles[0];
        const parentPath = getParentPath(file.path);
        const newPath = joinPath(parentPath, renameValue);

        await invoke('sftp_rename', {
          connectionId,
          oldPath: file.path,
          newPath: newPath,
        });
        toast.success(t('sftp.success.renameSuccess', { old: file.name, new: renameValue }));
        playSound(SoundEffect.SUCCESS);
      }
      setShowRenameDialog(false);
      setRenameValue('');
      onSelectedFilesChange([]);
      // 刷新列表
      setInternalRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Failed to rename:', error);
      const errorMsg = String(error);
      if (errorMsg.includes('Permission denied')) {
        toast.error(t('sftp.error.renamePermissionDenied'));
      } else if (errorMsg.includes('No such file')) {
        toast.error(t('sftp.error.fileNotExists'));
      } else if (errorMsg.includes('exists') || errorMsg.includes('already exists')) {
        toast.error(t('sftp.error.fileExists', { name: renameValue }));
      } else {
        toast.error(t('sftp.error.renameFailed', { error: errorMsg }));
      }
      playSound(SoundEffect.ERROR);
    }
  };

  const handleGoToRoot = async () => {
    playSound(SoundEffect.BUTTON_CLICK);
    if (type === 'local') {
      // 本地文件：根据当前盘符判断
      const currentDrive = getCurrentDrive();
      if (currentDrive === 'C:') {
        // C盘：进入用户家目录
        try {
          const homeDir = await invoke<string>('local_home_dir');
          onPathChange(homeDir);
        } catch (error) {
          console.error('Failed to get home directory:', error);
        }
      } else if (currentDrive) {
        // 其他盘符：进入对应盘符的根目录
        const rootPath = await invoke<string>('local_drive_root', { drive: currentDrive });
        onPathChange(rootPath);
      } else {
        // 无法识别盘符，默认进入家目录
        try {
          const homeDir = await invoke<string>('local_home_dir');
          onPathChange(homeDir);
        } catch (error) {
          console.error('Failed to get home directory:', error);
        }
      }
    } else {
      // 远程文件：进入根目录
      onPathChange('/');
      toast.success(t('sftp.success.switchedToRoot'));
    }
  };

  const handleRefresh = () => {
    playSound(SoundEffect.BUTTON_CLICK);
    // 触发重新加载
    setInternalRefreshKey(prev => prev + 1);

    // 清除选中状态
    onSelectedFilesChange([]);

    // 仅对远程文件操作显示提示
    if (type === 'remote') {
      toast.success(t('sftp.success.refreshed'));
    }
    // 本地文件不显示提示
  };

  // 处理盘符切换
  const handleDriveChange = async (drive: string) => {
    console.log('Switching to drive:', drive);

    if (drive === 'C:') {
      // C盘特殊处理：切换到用户家目录
      try {
        const homeDir = await invoke<string>('local_home_dir');
        onPathChange(homeDir);
      } catch (error) {
        console.error('Failed to get home directory:', error);
        toast.error(t('sftp.error.cannotGetHomeDir'));
      }
    } else {
      // 其他盘符：切换到盘符根目录
      try {
        const rootPath = await invoke<string>('local_drive_root', { drive });
        onPathChange(rootPath);
      } catch (error) {
        console.error('Failed to get drive root:', error);
        toast.error(t('sftp.error.cannotAccessDrive', { drive }));
      }
    }
  };

  // 提取当前盘符（Windows路径）
  const getCurrentDrive = () => {
    if (type !== 'local') return null;
    const match = path.match(/^([A-Z]):/);
    return match ? match[1] + ':' : null;
  };

  // 提交路径验证和跳转
  const handleSubmitPath = async (e: React.FormEvent) => {
    e.preventDefault();

    // 规范化路径
    let normalizedPath = inputPath.trim();
    if (!normalizedPath) {
      normalizedPath = type === 'local' ? '\\' : '/';
    }

    // 对于远程文件，确保路径以 / 开头
    if (type === 'remote' && !normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }

    // 对于远程文件，尝试验证路径是否存在
    if (type === 'remote' && connectionId) {
      try {
        // 尝试列出目录来验证路径
        await invoke('sftp_list_dir', {
          connectionId,
          path: normalizedPath,
        });
        // 路径有效，更新路径
        onPathChange(normalizedPath);
        toast.success(t('sftp.success.navigatedTo', { path: normalizedPath }));
      } catch (error) {
        console.error('Invalid path:', error);
        // 判断错误类型并显示相应的提示
        const errorMsg = String(error);
        if (errorMsg.includes('No such file') || errorMsg.includes('not found')) {
          toast.error(t('sftp.error.pathNotExists', { path: normalizedPath }));
        } else if (errorMsg.includes('Not a directory') || errorMsg.includes('not a directory')) {
          toast.error(t('sftp.error.notDirectory', { path: normalizedPath }));
        } else if (errorMsg.includes('Permission denied')) {
          toast.error(t('sftp.error.permissionDenied', { path: normalizedPath }));
        } else {
          toast.error(t('sftp.error.cannotAccess', { path: normalizedPath }));
        }
        // 重置输入为当前有效路径
        setInputPath(path);
      }
    } else {
      // 本地文件直接更新路径，不显示提示
      onPathChange(normalizedPath);
    }
  };

  const handleFileDoubleClick = async (file: SftpFileInfo) => {
    if (file.isDir) {
      // 进入目录
      const newPath = joinPath(path, file.name);

      // 验证路径是否可访问
      if (type === 'remote' && connectionId) {
        try {
          await invoke('sftp_list_dir', {
            connectionId,
            path: newPath,
          });
          onPathChange(newPath);
        } catch (error) {
          console.error('Failed to open directory:', error);
          const errorMsg = String(error);
          if (errorMsg.includes('Permission denied')) {
            toast.error(t('sftp.error.noPermission'));
          } else if (errorMsg.includes('No such file')) {
            toast.error(t('sftp.error.directoryNotExists'));
          } else if (errorMsg.includes('Not a directory')) {
            toast.error(t('sftp.error.notDirectoryShort'));
          } else {
            toast.error(t('sftp.error.cannotOpenDirectory', { error: errorMsg }));
          }
        }
      } else {
        // 本地文件直接进入目录，不显示提示
        onPathChange(newPath);
      }
    }
    // else if (type === 'local') {
    //   // 本地文件，打开
    //   // 构建完整路径
    //   let fullPath: string;
    //   if (path.endsWith('/') || path.endsWith('\\')) {
    //     fullPath = `${path}${file.name}`;
    //   } else {
    //     // 在 Windows 上使用反斜杠，在 Unix 上使用正斜杠
    //     const separator = path.includes('\\') ? '\\' : '/';
    //     fullPath = `${path}${separator}${file.name}`;
    //   }

    //   // 使用 Tauri 的 opener API 打开文件
    //   openPath(fullPath).catch((error: Error) => {
    //     console.error('Failed to open file:', fullPath, error);
    //     
    //     // 检查错误类型，提供更友好的提示
    //     const errorMessage = error?.message || String(error);
    //     if (errorMessage.includes('Not allowed')) {
    //       toast.error(t('sftp.error.fileNotAllowed', { path: file.name }));
    //     } else {
    //       toast.error(t('sftp.error.failedToOpenFile', { path: file.name }));
    //     }
    //   });
    // }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 面板头部 */}
      <div className="border-b bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">
            {type === 'local' ? t('sftp.pane.local') : t('sftp.pane.remote')}
          </span>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleGoToRoot}
              title={t('sftp.action.goToRoot')}
            >
              <Home className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleGoToParent}
              title={t('sftp.action.goToParent')}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleRefresh}
              title={t('sftp.action.refresh')}
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            {type === 'remote' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowNewFolderDialog(true)}
                  title={t('sftp.action.newFolder')}
                >
                  <FolderPlus className="h-3 w-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowDeleteDialog(true)}
                  title={t('sftp.action.delete')}
                  disabled={selectedFiles.length === 0}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    if (selectedFiles.length === 1) {
                      setRenameValue(selectedFiles[0].name);
                      setShowRenameDialog(true);
                    }
                  }}
                  title={t('sftp.action.rename')}
                  disabled={selectedFiles.length !== 1}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 路径输入 */}
        <div className="flex items-center gap-2">
          {/* 盘符选择器（仅本地） */}
          {type === 'local' && availableDrives.length > 0 && (
            <Select
              value={getCurrentDrive() || ''}
              onValueChange={handleDriveChange}
            >
              <SelectTrigger className="w-[70px] h-8">
                <HardDrive className="h-3 w-3 mr-1 opacity-50" />
                <SelectValue placeholder={t('sftp.path.drive')} />
              </SelectTrigger>
              <SelectContent>
                {availableDrives.map((drive) => (
                  <SelectItem key={drive} value={drive}>
                    {drive}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <form onSubmit={handleSubmitPath} className="flex-1 flex items-center gap-2">
            <Input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              className="h-8 text-sm"
              placeholder={t('sftp.path.placeholder')}
            />
          </form>
        </div>
      </div>

      {/* 文件列表 */}
      <div className="flex-1 overflow-auto">
        <FileList
          type={type}
          path={path}
          connectionId={connectionId}
          selectedFiles={selectedFiles}
          onSelectedFilesChange={onSelectedFilesChange}
          onFileDoubleClick={handleFileDoubleClick}
          isLoading={isLoading}
          refreshKey={internalRefreshKey}
        />
      </div>

      {/* 状态栏 */}
      <div className="border-t bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        {selectedFiles.length > 0
          ? t('sftp.status.selected', { count: selectedFiles.length })
          : type === 'local' ? t('sftp.status.localFileSystem') : t('sftp.status.remoteFileSystem')}
      </div>

      {/* 新建文件夹对话框 */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sftp.dialog.newFolder.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">{t('sftp.dialog.newFolder.label')}</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t('sftp.dialog.newFolder.placeholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              playSound(SoundEffect.BUTTON_CLICK);
              setShowNewFolderDialog(false);
            }}>
              {t('dialog.cancel')}
            </Button>
            <Button onClick={handleCreateFolder}>
              {t('sftp.dialog.newFolder.actionCreate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sftp.dialog.confirmDelete.title')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{t('sftp.dialog.confirmDelete.message', { count: selectedFiles.length })}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {t('sftp.dialog.confirmDelete.warning')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              playSound(SoundEffect.BUTTON_CLICK);
              setShowDeleteDialog(false);
            }}>
              {t('dialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('sftp.action.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名对话框 */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sftp.dialog.rename.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename">{t('sftp.dialog.rename.label')}</Label>
              <Input
                id="rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={t('sftp.dialog.rename.placeholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              playSound(SoundEffect.BUTTON_CLICK);
              setShowRenameDialog(false);
            }}>
              {t('dialog.cancel')}
            </Button>
            <Button onClick={handleRename}>
              {t('sftp.dialog.rename.actionConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
