import { useState } from 'react';
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
        toast.error('创建新连接失败', {
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
    
    // 检查是否有活跃连接
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

      <CardFooter className="gap-2 pt-3">
        {displayStatus === 'connected' ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              className="flex-1"
            >
              断开
            </Button>
            <Button
              size="sm"
              onClick={handleConnect}
              className="flex-1"
            >
              <Terminal className="h-4 w-4 mr-1" />
              打开终端
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEdit}
            >
              <Edit className="h-4 w-4 mr-1" />
              编辑
            </Button>
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="flex-1"
            >
              {connecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  连接中
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  连接
                </>
              )}
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">确认删除</h3>
            <p className="text-muted-foreground mb-4">
              确定要删除会话 "{session.name}" 吗？此操作无法撤销。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
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
