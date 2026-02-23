import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, Trash2, Play, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionStatusBadge } from '@/components/ssh/ConnectionStatusBadge';
import type { SessionInfo } from '@/types/ssh';
import { useSessionStore } from '@/store/sessionStore';
import { useTerminalStore } from '@/store/terminalStore';
import { useNavigate } from 'react-router-dom';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';
import { toast } from 'sonner';

interface SessionCardProps {
  sessionId: string;
  onEdit?: (session: SessionInfo) => void;
}

export function SessionCard({ sessionId, onEdit }: SessionCardProps) {
  const [connecting, setConnecting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { connectSession, disconnectSession, deleteSession, sessions, createConnection } = useSessionStore();
  const { addTab, removeTab, getTabsByConnection } = useTerminalStore();

  // 从 store 中动态获取会话信息
  const session = sessions.find(s => s.id === sessionId);

  if (!session) {
    return null;
  }

  // 计算实际的连接状态：查找关联的连接实例
  const getDisplayStatus = () => {
    // 如果是连接实例本身，直接返回其状态
    if (session.connectionSessionId) {
      return session.status;
    }
    // 如果是会话配置，查找是否有活跃的连接实例
    const connections = sessions.filter(s => s.connectionSessionId === sessionId && s.status === 'connected');
    return connections.length > 0 ? 'connected' : 'disconnected';
  };

  const displayStatus = getDisplayStatus();

  const handleConnect = async () => {
    if (displayStatus === 'connected') {
      // 已连接，创建一个新的连接实例（独立的SSH会话）
      setConnecting(true);
      try {
        const connectionId = await createConnection(session.id);
        playSound(SoundEffect.SUCCESS);
        // 添加新标签页并跳转
        playSound(SoundEffect.TAB_OPEN);
        addTab(connectionId, session.name || `${session.username}@${session.host}`);
        navigate('/terminal');
      } catch (error) {
        playSound(SoundEffect.ERROR);
        console.error('Failed to create connection:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(t('session.error.createConnectionFailed'), {
          description: errorMessage,
        });
      } finally {
        setConnecting(false);
      }
    } else {
      // 未连接，先连接（现在返回connectionId）
      setConnecting(true);
      try {
        const connectionId = await connectSession(session.id);
        playSound(SoundEffect.SUCCESS);
        // 连接成功后添加标签页并跳转
        playSound(SoundEffect.TAB_OPEN);
        addTab(connectionId, session.name || `${session.username}@${session.host}`);
        navigate('/terminal');
      } catch (error) {
        playSound(SoundEffect.ERROR);
        console.error('Failed to connect:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(t('session.error.connectionFailed'), {
          description: errorMessage,
        });
      } finally {
        setConnecting(false);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      // 获取该会话配置的所有活跃连接实例
      const activeConnections = sessions.filter(
        s => s.connectionSessionId === session.id && s.status === 'connected'
      );

      // 断开所有连接实例
      for (const connection of activeConnections) {
        await disconnectSession(connection.id);
        
        // 关闭对应的标签页
        const tabs = getTabsByConnection(connection.id);
        tabs.forEach(tab => {
          removeTab(tab.id);
        });
      }

      playSound(SoundEffect.SUCCESS);
      toast.success(t('session.success.disconnected'));
    } catch (error) {
      playSound(SoundEffect.ERROR);
      console.error('Failed to disconnect:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(t('session.error.disconnectFailed'), {
        description: errorMessage,
      });
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);

    // 检查是否有活跃连接
    const hasActiveConnection = sessions.some(
      s => s.connectionSessionId === session.id && s.status === 'connected'
    );

    if (hasActiveConnection) {
      playSound(SoundEffect.ERROR);
      toast.error(t('session.error.cannotDelete'), {
        description: t('session.error.hasActiveConnections'),
      });
      return;
    }

    try {
      console.log(`正在删除会话: ${session.name} (${session.id})`);
      await deleteSession(session.id);
      playSound(SoundEffect.SUCCESS);
      toast.success(t('session.success.deleted'));
      console.log(`会话删除成功: ${session.name}`);
    } catch (error) {
      playSound(SoundEffect.ERROR);
      console.error('删除会话失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(t('session.error.deleteFailed'), {
        description: errorMessage,
      });
    }
  };

  // 检查是否有活跃连接
  const hasActiveConnection = sessions.some(
    s => s.connectionSessionId === session.id && s.status === 'connected'
  );

  const handleEdit = () => {
    playSound(SoundEffect.BUTTON_CLICK);
    onEdit?.(session);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{session.name}</CardTitle>
          </div>
          <ConnectionStatusBadge status={displayStatus} />
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          <div>{session.username}@{session.host}:{session.port}</div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {session.error && (
          <div className="text-sm text-destructive mt-2">
            {session.error}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 pt-3 flex-wrap">
        {displayStatus === 'connected' ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              className="flex-1 min-w-[80px]"
            >
              {t('session.action.disconnect')}
            </Button>
            <Button
              size="sm"
              onClick={handleConnect}
              className="flex-1 min-w-[80px]"
            >
              <Terminal className="h-4 w-4 mr-1" />
              {t('session.action.openTerminal')}
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEdit}
              className="min-w-[80px]"
            >
              <Edit className="h-4 w-4 mr-1" />
              {t('session.action.edit')}
            </Button>
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="flex-1 min-w-[80px]"
            >
              {connecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  {t('session.status.connecting')}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  {t('session.action.connect')}
                </>
              )}
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant={hasActiveConnection ? "outline" : "destructive"}
          onClick={() => {
            if (hasActiveConnection) {
              playSound(SoundEffect.ERROR);
              toast.error(t('session.error.cannotDelete'), {
                description: t('session.error.hasActiveConnections'),
              });
            } else {
              setShowDeleteConfirm(true);
            }
          }}
          disabled={hasActiveConnection}
          title={hasActiveConnection ? t('session.error.hasActiveConnections') : t('session.action.delete')}
          className={hasActiveConnection ? "opacity-50 cursor-not-allowed min-w-[40px]" : "min-w-[40px]"}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">{t('dialog.confirmDelete.title')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('dialog.confirmDelete.message', { name: session.name })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t('dialog.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                {t('dialog.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
