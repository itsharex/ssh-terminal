import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSyncStore } from '@/store/syncStore';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';

export function SyncButton() {
  const { isAuthenticated } = useAuthStore();
  const { syncNow, getStatus, lastSyncAt, isSyncing, error, pendingCount } = useSyncStore();

  // 定期更新同步状态
  useEffect(() => {
    if (isAuthenticated) {
      getStatus();
      // 每 30 秒更新一次状态
      const interval = setInterval(getStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, getStatus]);

  if (!isAuthenticated) {
    return null; // 未登录不显示同步按钮
  }

  const handleSync = async () => {
    try {
      await syncNow();
      playSound(SoundEffect.SUCCESS);
      toast.success('同步成功', {
        description: '所有数据已同步到服务器',
      });
    } catch (error) {
      playSound(SoundEffect.ERROR);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('同步失败', {
        description: errorMessage,
      });
      console.error('Sync failed:', error);
    }
  };

  // 计算最后同步时间的显示
  const formatLastSync = () => {
    if (!lastSyncAt) return '未同步';
    const now = Date.now() / 1000;
    const diff = Math.floor((now - lastSyncAt) / 60); // 分钟

    if (diff < 1) return '刚刚';
    if (diff < 60) return `${diff} 分钟前`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  };

  const getStatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    if (error) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (lastSyncAt) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getTooltipText = () => {
    if (isSyncing) return '正在同步...';
    if (error) return '同步失败';
    return `上次同步: ${formatLastSync()}`;
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 relative"
      onClick={handleSync}
      disabled={isSyncing}
      title={getTooltipText()}
    >
      {getStatusIcon()}
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </Button>
  );
}
