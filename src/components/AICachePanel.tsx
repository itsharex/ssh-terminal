/**
 * AI 缓存管理面板 - React 组件
 *
 * 提供可视化的缓存管理界面
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import {
  Database,
  RefreshCw,
  Zap,
  Trash2,
  Info,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import './AICachePanel.css';

// ==================== 类型定义 ====================

interface CacheInfo {
  cache_size: number;
  cached_providers: string[];
}

interface HotReloadResult {
  success: boolean;
  removedCount: number;
  message: string;
}

// ==================== 工具函数 ====================

/**
 * 播放提示音
 */
function playSound(type: 'success' | 'error' | 'info') {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 不同类型的声音频率
    const frequencies = {
      success: [800, 1000], // 高频成功音
      error: [300, 200],    // 低频错误音
      info: [600, 700]      // 中频提示音
    };

    const [startFreq, endFreq] = frequencies[type];

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(startFreq, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      endFreq,
      audioContext.currentTime + 0.1
    );

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    // 静默失败，不影响用户体验
    console.debug('Failed to play sound:', error);
  }
}

// ==================== 组件定义 ====================

/**
 * AI 缓存管理面板组件
 *
 * 功能：
 * - 显示缓存统计信息
 * - 列出所有缓存的 Provider
 * - 手动清除缓存（带确认对话框）
 * - 触发热重载
 * - 实时监控缓存状态
 * - 声音反馈
 * - Toast 消息提示
 */
export function AICachePanel() {
  const { t } = useTranslation();
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // 加载缓存信息
  const loadCacheInfo = async () => {
    try {
      setLoading(true);
      const info = await invoke<CacheInfo>('ai_get_cache_info');
      setCacheInfo(info);
    } catch (error) {
      console.error('Failed to load cache info:', error);
      toast.error(t('ai.cache.errorLoadFailed'), {
        description: String(error),
        icon: <XCircle className="h-4 w-4" />
      });
    } finally {
      setLoading(false);
    }
  };

  // 清除缓存
  const handleClearCache = async () => {
    setShowClearDialog(false);

    try {
      setLoading(true);
      await invoke('ai_clear_cache');
      await loadCacheInfo();

      playSound('success');
      toast.success(t('ai.cache.clearSuccess'), {
        description: t('ai.cache.clearSuccessDescription'),
        icon: <CheckCircle2 className="h-4 w-4" />
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);

      playSound('error');
      toast.error(t('ai.cache.errorClearFailed'), {
        description: String(error),
        icon: <XCircle className="h-4 w-4" />
      });
    } finally {
      setLoading(false);
    }
  };

  // 触发热重载
  const handleHotReload = async () => {
    try {
      setLoading(true);
      const result = await invoke<HotReloadResult>('ai_hot_reload');
      await loadCacheInfo();

      if (result.success) {
        playSound('success');
        toast.success(t('ai.cache.hotReloadSuccess'), {
          description: `${result.message}（移除 ${result.removedCount} 个 Provider）`,
          icon: <CheckCircle2 className="h-4 w-4" />
        });
      } else {
        playSound('info');
        toast.info(t('ai.cache.hotReloadCompleted'), {
          description: result.message,
          icon: <AlertCircle className="h-4 w-4" />
        });
      }
    } catch (error) {
      console.error('Failed to hot reload:', error);

      playSound('error');
      toast.error(t('ai.cache.errorHotReloadFailed'), {
        description: String(error),
        icon: <XCircle className="h-4 w-4" />
      });
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载缓存信息
  useEffect(() => {
    loadCacheInfo();

    // 每 5 秒自动刷新缓存信息
    const interval = setInterval(loadCacheInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="ai-cache-panel">
        <div className="ai-cache-panel__header">
          <div className="header-title">
            <Database className="title-icon" />
            <h2>{t('ai.cache.title')}</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadCacheInfo}
            disabled={loading}
            title={t('ai.cache.actionRefresh')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-2">{t('ai.cache.actionRefresh')}</span>
          </Button>
        </div>

        {/* 缓存统计 */}
        <div className="ai-cache-panel__stats">
          <div className="stat-card">
            <div className="stat-card__icon">
              <Database className="h-5 w-5" />
            </div>
            <div className="stat-card__content">
              <div className="stat-card__label">{t('ai.cache.statsCount')}</div>
              <div className="stat-card__value">{cacheInfo?.cache_size ?? 0}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon">
              <Zap className="h-5 w-5" />
            </div>
            <div className="stat-card__content">
              <div className="stat-card__label">{t('ai.cache.statsStatus')}</div>
              <div className="stat-card__value">
                {cacheInfo && cacheInfo.cache_size > 0 ? (
                  <span className="status-active">{t('ai.cache.statusActive')}</span>
                ) : (
                  <span className="status-empty">{t('ai.cache.statusEmpty')}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 缓存的 Provider 列表 */}
        <div className="ai-cache-panel__providers">
          <h3>{t('ai.cache.providersTitle')}</h3>
          {!cacheInfo ? (
            <div className="empty-state">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <p>{t('ai.cache.loading')}</p>
            </div>
          ) : cacheInfo.cached_providers.length > 0 ? (
            <ul className="provider-list">
              {cacheInfo.cached_providers.map((providerKey, index) => (
                <li key={index} className="provider-item">
                  <Database className="provider-icon" />
                  <code title={providerKey}>
                    {providerKey.length > 60 ? `${providerKey.substring(0, 60)}...` : providerKey}
                  </code>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <Database className="h-8 w-8" />
              <p>{t('ai.cache.emptyTitle')}</p>
              <p className="empty-state__hint">{t('ai.cache.emptyMessage')}</p>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="ai-cache-panel__actions">
          <Button
            className="btn-reload"
            onClick={handleHotReload}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('ai.cache.actionHotReload')}
          </Button>
          <Button
            className="btn-clear"
            variant="destructive"
            onClick={() => setShowClearDialog(true)}
            disabled={loading || !cacheInfo || cacheInfo.cache_size === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('ai.cache.actionClear')}
          </Button>
        </div>

        {/* 使用说明 */}
        <div className="ai-cache-panel__info">
          <div className="info-header">
            <Info className="h-4 w-4" />
            <span>{t('ai.cache.infoTitle')}</span>
          </div>
          <ul className="info-list">
            <li>
              <strong>{t('ai.cache.infoCacheMechanism').split('：')[0]}</strong>：{t('ai.cache.infoCacheMechanism').split('：')[1]}
            </li>
            <li>
              <strong>{t('ai.cache.infoHotReload').split('：')[0]}</strong>：{t('ai.cache.infoHotReload').split('：')[1]}
            </li>
            <li>
              <strong>{t('ai.cache.infoClearCache').split('：')[0]}</strong>：{t('ai.cache.infoClearCache').split('：')[1]}
            </li>
            <li>
              <strong>{t('ai.cache.infoAutoManagement').split('：')[0]}</strong>：{t('ai.cache.infoAutoManagement').split('：')[1]}
            </li>
          </ul>
        </div>
      </div>

      {/* 清除缓存确认对话框 */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t('ai.cache.confirmClearTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('ai.cache.confirmClearMessage')}
              <br /><br />
              {t('ai.cache.confirmClearConfirmation')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ai.cache.confirmClearActionCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearCache}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('ai.cache.confirmClearActionConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * 简化版缓存指示器组件
 *
 * 用于在状态栏或工具栏中显示缓存状态
 */
export function AICacheIndicator() {
  const { t } = useTranslation();
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    const updateCacheSize = async () => {
      try {
        const info = await invoke<CacheInfo>('ai_get_cache_info');
        setCacheSize(info.cache_size);
      } catch (error) {
        console.error('Failed to load cache info:', error);
      }
    };

    updateCacheSize();
    const interval = setInterval(updateCacheSize, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="ai-cache-indicator"
      title={`${t('ai.cache.title')}: ${cacheSize} 个 Provider${cacheSize > 0 ? '\n已启用缓存加速' : '\n暂无缓存'}`}
    >
      <Database className="h-4 w-4" />
      {cacheSize > 0 && (
        <span className="indicator-badge">{cacheSize}</span>
      )}
    </div>
  );
}

export default AICachePanel;
