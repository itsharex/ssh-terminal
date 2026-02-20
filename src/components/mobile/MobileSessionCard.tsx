import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, Trash2, Play, Edit, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SessionInfo } from '@/types/ssh';
import { useSessionStore } from '@/store/sessionStore';
import { useTerminalStore } from '@/store/terminalStore';
import { useNavigate } from 'react-router-dom';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';
import { toast } from 'sonner';

interface MobileSessionCardProps {
  sessionId: string;
  onEdit?: (session: SessionInfo) => void;
}

export function MobileSessionCard({ sessionId, onEdit }: MobileSessionCardProps) {
  const { t } = useTranslation();
  const [connecting, setConnecting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const { connectSession, disconnectSession, deleteSession, sessions } = useSessionStore();
  const { addTab, removeTab, getTabsByConnection } = useTerminalStore();

  // 从 store 中动态获取会话信息
  const session = sessions.find(s => s.id === sessionId);

  if (!session) {
    return null;
  }

  // 计算实际的连接状态
  const getDisplayStatus = () => {
    if (session.connectionSessionId) {
      return session.status;
    }
    const connections = sessions.filter(s => s.connectionSessionId === sessionId && s.status === 'connected');
    return connections.length > 0 ? 'connected' : 'disconnected';
  };

  const displayStatus = getDisplayStatus();
  const isConnected = displayStatus === 'connected';

  const handleConnect = async () => {
    // 已连接时，直接打开已有连接
    if (isConnected) {
      try {
        // 查找现有的连接实例
        const existingConnection = sessions.find(
          s => s.connectionSessionId === session.id && s.status === 'connected'
        );

        if (existingConnection) {
          playSound(SoundEffect.SUCCESS);
          addTab(existingConnection.id, session.name || `${session.username}@${session.host}`);
          navigate('/terminal');
        } else {
          // 虽然显示已连接，但找不到连接实例，重新连接
          setConnecting(true);
          const connectionId = await connectSession(session.id);
          playSound(SoundEffect.SUCCESS);
          addTab(connectionId, session.name || `${session.username}@${session.host}`);
          navigate('/terminal');
          setConnecting(false);
        }
      } catch (error) {
        playSound(SoundEffect.ERROR);
        console.error('Failed to open existing connection:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error('打开连接失败', {
          description: errorMessage,
        });
      }
    } else {
      // 未连接时，创建新连接
      setConnecting(true);
      try {
        const connectionId = await connectSession(session.id);
        playSound(SoundEffect.SUCCESS);
        addTab(connectionId, session.name || `${session.username}@${session.host}`);
        navigate('/terminal');
      } catch (error) {
        playSound(SoundEffect.ERROR);
        console.error('Failed to connect:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error('连接失败', {
          description: errorMessage,
        });
      } finally {
        setConnecting(false);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      const activeConnections = sessions.filter(
        s => s.connectionSessionId === session.id && s.status === 'connected'
      );

      for (const connection of activeConnections) {
        await disconnectSession(connection.id);
        const tabs = getTabsByConnection(connection.id);
        tabs.forEach(tab => {
          removeTab(tab.id);
        });
      }

      playSound(SoundEffect.SUCCESS);
      toast.success('断开连接成功');
    } catch (error) {
      playSound(SoundEffect.ERROR);
      console.error('Failed to disconnect:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('断开连接失败', {
        description: errorMessage,
      });
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    
    const hasActiveConnection = sessions.some(
      s => s.connectionSessionId === session.id && s.status === 'connected'
    );

    if (hasActiveConnection) {
      playSound(SoundEffect.ERROR);
      toast.error('无法删除会话', {
        description: '该会话存在活跃连接，请先断开所有连接后再删除',
      });
      return;
    }

    try {
      console.log(`正在删除会话: ${session.name} (${session.id})`);
      await deleteSession(session.id);
      playSound(SoundEffect.SUCCESS);
      toast.success('删除会话成功');
      console.log(`会话删除成功: ${session.name}`);
    } catch (error) {
      playSound(SoundEffect.ERROR);
      console.error('删除会话失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('删除会话失败', {
        description: errorMessage,
      });
    }
  };

  const handleEdit = () => {
    playSound(SoundEffect.BUTTON_CLICK);
    onEdit?.(session);
  };

  return (
    <Card className="w-full hover:shadow-md transition-shadow touch-manipulation">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <Terminal className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate">{session.name}</CardTitle>
              <div className="text-sm text-muted-foreground mt-1 truncate">
                {session.username}@{session.host}:{session.port}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 ml-2">
            {isConnected ? (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                <Wifi className="h-3 w-3 mr-1" />
                {t('session.status.connected')}
              </Badge>
            ) : (
              <Badge variant="secondary" className="opacity-70">
                <WifiOff className="h-3 w-3 mr-1" />
                {t('session.status.disconnected')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {session.error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            {session.error}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 pt-3">
        {isConnected ? (
          <div className="flex gap-2 w-full">
            <Button
              size="lg"
              variant="outline"
              onClick={handleDisconnect}
              className="flex-1 h-12 touch-manipulation"
            >
              <WifiOff className="h-5 w-5 mr-2" />
              断开
            </Button>
            <Button
              size="lg"
              onClick={handleConnect}
              className="flex-1 h-12 touch-manipulation"
            >
              <Terminal className="h-5 w-5 mr-2" />
              新终端
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 w-full">
            <Button
              size="lg"
              variant="outline"
              onClick={handleEdit}
              className="h-12 px-4 touch-manipulation"
            >
              <Edit className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              onClick={handleConnect}
              disabled={connecting}
              className="flex-1 h-12 touch-manipulation"
            >
              {connecting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2" />
                  连接中...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  连接
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-12 px-4 touch-manipulation"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        )}
      </CardFooter>

      {/* 删除确认对话框 - 移动端优化 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="mx-auto bg-destructive/10 text-destructive rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">确认删除</h3>
              <p className="text-muted-foreground">
                确定要删除会话 "{session.name}" 吗？
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-12 touch-manipulation"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="flex-1 h-12 touch-manipulation"
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}