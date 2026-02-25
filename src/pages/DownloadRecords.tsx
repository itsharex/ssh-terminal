/**
 * 下载记录页面
 *
 * 显示所有下载记录，支持分页、删除、清空
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, RefreshCw, Folder, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { playSound, SoundEffect } from '@/lib/sounds';
import { useTranslation } from 'react-i18next';
import type { DownloadStatusChangeEvent } from '@/store/sftpStore';

interface DownloadRecord {
  id: number;
  taskId: string;
  connectionId: string;
  userId: string;
  remotePath: string;
  localPath: string;
  totalFiles: number;
  totalDirs: number;
  totalSize: number;
  status: string;
  bytesTransferred: number;
  filesCompleted: number;
  startedAt: number;
  completedAt: number | null;
  elapsedMs: number | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

interface PaginatedDownloadRecords {
  records: DownloadRecord[];
  total: number;
  page: number;
  page_size: number;
}

export function DownloadRecords() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const totalPages = Math.ceil(total / pageSize);

  // 获取当前用户 ID
  const getCurrentUserId = async (): Promise<string> => {
    try {
      const result = await invoke<{ id: string; userId: string; email: string } | null>('auth_get_current_user');
      return result?.userId || 'anonymous_local';
    } catch (error) {
      console.error('Failed to get current user:', error);
      return 'anonymous_local';
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const userId = await getCurrentUserId();
      const result = await invoke<PaginatedDownloadRecords>('list_download_records', {
        userId,
        page,
        pageSize,
      });
      setRecords(result.records);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load download records:', error);
      toast.error(t('sftp.records.downloadLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [page]);

  // 监听下载状态变更事件，自动刷新列表
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    
    const setupListener = async () => {
      try {
        unlistenFn = await listen<DownloadStatusChangeEvent>('sftp-download-status-change', () => {
          console.log('[DownloadRecords] Download status changed, refreshing records');
          loadRecords();
        });
      } catch (error) {
        console.error('[DownloadRecords] Failed to setup status change listener:', error);
      }
    };
    
    setupListener();
    
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [page]);

  const handleDelete = async (id: number) => {
    playSound(SoundEffect.BUTTON_CLICK);
    try {
      await invoke('delete_download_record', { id });
      toast.success(t('sftp.records.deleteSuccess'));
      playSound(SoundEffect.SUCCESS);
      loadRecords();
    } catch (error) {
      console.error('Failed to delete record:', error);
      toast.error(t('sftp.records.deleteFailed'));
    }
  };

  const handleClearAll = async () => {
    playSound(SoundEffect.BUTTON_CLICK);

    try {
      await invoke('clear_download_records');
      toast.success(t('sftp.records.clearSuccess'));
      playSound(SoundEffect.SUCCESS);
      loadRecords();
    } catch (error) {
      console.error('Failed to clear records:', error);
      toast.error(t('sftp.records.clearFailed'));
    }
  };

  const handleDeleteSelected = async () => {
    playSound(SoundEffect.BUTTON_CLICK);
    if (selectedIds.length === 0) {
      toast.warning(t('sftp.records.selectToDelete'));
      return;
    }

    try {
      for (const id of selectedIds) {
        await invoke('delete_download_record', { id });
      }
      toast.success(t('sftp.records.deleteSelectedSuccess', { count: selectedIds.length }));
      playSound(SoundEffect.SUCCESS);
      setSelectedIds([]);
      loadRecords();
    } catch (error) {
      console.error('Failed to delete records:', error);
      toast.error(t('sftp.records.deleteFailed'));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; className: string }> = {
      pending: { text: t('sftp.records.statusBadge.pending'), className: 'bg-yellow-100 text-yellow-800' },
      downloading: { text: t('sftp.records.statusBadge.downloading'), className: 'bg-blue-100 text-blue-800' },
      completed: { text: t('sftp.records.statusBadge.completed'), className: 'bg-green-100 text-green-800' },
      failed: { text: t('sftp.records.statusBadge.failed'), className: 'bg-red-100 text-red-800' },
      cancelled: { text: t('sftp.records.statusBadge.cancelled'), className: 'bg-gray-100 text-gray-800' },
    };
    const s = statusMap[status] || { text: status, className: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-1 rounded-full text-xs ${s.className}`}>{s.text}</span>;
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map(r => r.id));
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部工具栏 */}
      <div className="border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                playSound(SoundEffect.BUTTON_CLICK);
                navigate('/sftp');
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-lg font-semibold">{t('sftp.records.downloadTitle')}</h1>
              <p className="text-xs text-muted-foreground">
                {t('sftp.records.totalRecords', { count: total })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('sftp.records.deleteSelected', { count: selectedIds.length })}
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAll}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('sftp.records.clearAll')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                playSound(SoundEffect.BUTTON_CLICK);
                loadRecords();
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('sftp.records.refresh')}
            </Button>
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="flex-1 overflow-auto p-4">
        <Card>
          {loading && records.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Folder className="h-16 w-16 mb-4 opacity-50" />
              <p>{t('sftp.records.noDownloadRecords')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* 表头 */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 font-medium text-sm">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === records.length && records.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </div>
                <div className="col-span-2">{t('sftp.records.taskId')}</div>
                <div className="col-span-2">{t('sftp.records.remotePath')}</div>
                <div className="col-span-2">{t('sftp.records.localPath')}</div>
                <div className="col-span-1">{t('sftp.records.status')}</div>
                <div className="col-span-1 text-right">{t('sftp.records.totalFiles')}</div>
                <div className="col-span-1 text-right">{t('sftp.records.totalSize')}</div>
                <div className="col-span-1 text-right">{t('sftp.records.createdAt')}</div>
                <div className="col-span-1"></div>
              </div>

              {/* 记录列表 */}
              {records.map((record) => (
                <div
                  key={record.id}
                  className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-muted/50 items-center text-sm"
                >
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(record.id)}
                      onChange={() => toggleSelect(record.id)}
                      className="rounded"
                    />
                  </div>
                  <div className="col-span-2 truncate" title={record.taskId}>
                    {record.taskId}
                  </div>
                  <div className="col-span-2 truncate" title={record.remotePath}>
                    {record.remotePath}
                  </div>
                  <div className="col-span-2 truncate" title={record.localPath}>
                    {record.localPath}
                  </div>
                  <div className="col-span-1">
                    {getStatusBadge(record.status)}
                  </div>
                  <div className="col-span-1 text-right">
                    {record.filesCompleted}/{record.totalFiles}
                  </div>
                  <div className="col-span-1 text-right">
                    {formatFileSize(record.totalSize)}
                  </div>
                  <div className="col-span-1 text-right text-muted-foreground">
                    {formatDate(record.startedAt)}
                  </div>
                  <div className="col-span-1 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(record.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {t('sftp.records.pageInfo', { current: page, total: totalPages })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {t('dialog.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                {t('dialog.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}