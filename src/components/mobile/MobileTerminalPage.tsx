import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, MoreVertical, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { XTermWrapper } from '@/components/terminal/XTermWrapper';
import { useTerminalStore } from '@/store/terminalStore';
import { useSessionStore } from '@/store/sessionStore';
import { useNavigate } from 'react-router-dom';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';
import { toast } from 'sonner';
import { useVirtualKeyboard } from '@/hooks/useVirtualKeyboard';

export function MobileTerminalPage() {
  const navigate = useNavigate();
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const { tabs, removeTab, setActiveTab } = useTerminalStore();
  const { sessions, disconnectSession } = useSessionStore();

  // 虚拟键盘适配
  const keyboard = useVirtualKeyboard();

  // 获取当前激活的标签页
  const activeTab = tabs.find(t => t.isActive);

  // 设置默认激活标签页
  useEffect(() => {
    if (tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id);
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTab, setActiveTab]);

  // 更新激活标签页
  useEffect(() => {
    if (activeTab) {
      setActiveTabId(activeTab.id);
    }
  }, [activeTab]);

  const handleBack = () => {
    playSound(SoundEffect.BUTTON_CLICK);
    navigate('/');
  };

  const handleAddTab = () => {
    // 在移动端，我们可能想要显示一个会话选择器而不是直接添加空白标签页
    playSound(SoundEffect.BUTTON_CLICK);
    navigate('/');
  };

  const handleRemoveTab = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      // 查找关联的连接会话
      const connectionSessions = sessions.filter(
        s => s.connectionSessionId === tab.connectionId && s.status === 'connected'
      );
      
      // 断开所有关联的连接
      for (const session of connectionSessions) {
        await disconnectSession(session.id);
      }

      removeTab(tabId);
      playSound(SoundEffect.TAB_CLOSE);
      
      // 如果关闭的是当前激活的标签页，激活下一个或前一个
      if (activeTabId === tabId) {
        const currentIndex = tabs.findIndex(t => t.id === tabId);
        if (tabs.length > 1) {
          const nextIndex = currentIndex === 0 ? 0 : currentIndex - 1;
          const nextTab = tabs[nextIndex];
          setActiveTab(nextTab.id);
          setActiveTabId(nextTab.id);
        } else {
          setActiveTabId(null);
          navigate('/');
        }
      }
    } catch (error) {
      playSound(SoundEffect.ERROR);
      console.error('Failed to close tab:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('关闭标签页失败', {
        description: errorMessage,
      });
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setActiveTabId(tabId);
    playSound(SoundEffect.TAB_SWITCH);
  };

  const getSessionInfo = (connectionId: string) => {
    // connectionId 是连接实例的ID，直接查找
    const connection = sessions.find(s => s.id === connectionId);
    if (!connection) return null;

    // 如果是连接实例，查找对应的会话配置以获取更友好的名称
    if (connection.connectionSessionId) {
      const sessionConfig = sessions.find(s => s.id === connection.connectionSessionId);
      // 返回会话配置（如果有），否则返回连接实例
      return sessionConfig || connection;
    }

    return connection;
  };

  return (
    <div
      className="flex flex-col bg-background"
      style={{
        height: keyboard.isOpen ? `${keyboard.viewportHeight}px` : '100vh'
      }}
    >
      {/* 顶部导航栏 */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-10 w-10 touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <h1 className="text-lg font-semibold truncate px-2">
            {activeTab ? getSessionInfo(activeTab.connectionId)?.name || '终端' : '终端'}
          </h1>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 touch-manipulation"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleAddTab}>
                <Plus className="h-4 w-4 mr-2" />
                新建连接
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => window.location.reload()}
                disabled={!activeTab}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                重新连接
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 标签页导航 - 移动端简化版 */}
        {tabs.length > 0 && (
          <div className="flex overflow-x-auto px-3 pb-2 hide-scrollbar">
            <div className="flex gap-2 min-w-max">
              {tabs.map((tab) => {
                const isActive = activeTabId === tab.id;
                const sessionInfo = getSessionInfo(tab.connectionId);
                
                return (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all touch-manipulation ${
                      isActive 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-muted/50 border-border hover:bg-muted'
                    }`}
                    onClick={() => handleTabClick(tab.id)}
                  >
                    <span className="text-sm font-medium truncate max-w-24">
                      {sessionInfo?.name || tab.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 opacity-70 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTab(tab.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 终端内容区域 */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <XTermWrapper
            connectionId={activeTab.connectionId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="bg-muted rounded-full p-6 mb-4">
              <TerminalIcon className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">暂无活动终端</h2>
            <p className="text-muted-foreground mb-6">
              点击左上角返回会话列表，选择一个会话开始连接
            </p>
            <Button
              size="lg"
              onClick={handleBack}
              className="h-12 px-6 touch-manipulation"
            >
              返回会话列表
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// 终端图标组件
function TerminalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4,17 10,11 4,5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}