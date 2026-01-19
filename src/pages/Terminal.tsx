import { useEffect, useState } from 'react';
import { Terminal as TerminalIcon, Plus, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TabBar } from '@/components/terminal/TabBar';
import { XTermWrapper } from '@/components/terminal/XTermWrapper';
import { QuickConnectDialog } from '@/components/session/QuickConnectDialog';
import { ConnectionStatusBadge } from '@/components/ssh/ConnectionStatusBadge';
import { useSessionStore } from '@/store/sessionStore';
import { useTerminalStore } from '@/store/terminalStore';

export function Terminal() {
  const navigate = useNavigate();
  const [quickConnectOpen, setQuickConnectOpen] = useState(false);
  const { sessions, activeSessionId, loadSessions, loadSessionsFromStorage, addSession } = useSessionStore();
  const { tabs, addTab, getActiveTab } = useTerminalStore();

  useEffect(() => {
    // 先从存储加载已保存的会话，然后加载当前内存中的会话
    loadSessionsFromStorage();
    loadSessions();
  }, [loadSessions, loadSessionsFromStorage]);

  const handleNewTab = () => {
    setQuickConnectOpen(true);
  };

  const handleSessionManager = () => {
    navigate('/sessions');
  };

  const handleQuickConnect = async (config: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
  }) => {
    // 创建临时会话配置（不保存）
    const sessionConfig = {
      name: `${config.username}@${config.host}`, // 临时名称
      host: config.host,
      port: config.port,
      username: config.username,
      auth_method: config.password ? ('password' as const) : ('publicKey' as const),
      password: config.password,
      privateKeyPath: config.privateKeyPath,
      passphrase: config.passphrase,
    };

    // 添加临时会话并创建标签页
    const sessionId = await addSession(sessionConfig);
    addTab(sessionId, sessionConfig.name);
  };

  const activeTab = getActiveTab();
  const activeSession = activeTab
    ? sessions.find((s) => s.id === activeTab.sessionId)
    : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 标签页栏 */}
      <TabBar />

      {/* 工具栏 */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/40 border-b border-border">
        <Button size="sm" variant="outline" onClick={handleNewTab} className="gap-1.5">
          <Plus className="h-4 w-4" />
          新建连接
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <Button size="sm" variant="ghost" onClick={handleSessionManager} className="gap-1.5">
          <FolderOpen className="h-4 w-4" />
          会话管理
        </Button>

        <div className="flex-1" />

        {/* 显示当前连接信息 */}
        {activeSession && (
          <div className="flex items-center gap-3 text-sm">
            <ConnectionStatusBadge status={activeSession.status} />
            <span className="text-muted-foreground font-mono">
              {activeSession.username}@{activeSession.host}:{activeSession.port}
            </span>
          </div>
        )}
      </div>

      {/* 终端内容区域 */}
      <div className="flex-1 overflow-hidden">
        {tabs.length === 0 ? (
          // 空状态
          <div className="flex flex-col items-center justify-center h-full bg-muted/10">
            <div className="flex flex-col items-center text-center max-w-md px-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <TerminalIcon className="h-10 w-10 text-primary/60" />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-foreground">没有活动的 SSH 会话</h2>
              <p className="text-sm text-muted-foreground mb-6">
                点击下方按钮创建新的 SSH 连接，或从侧边栏选择其他功能
              </p>
              <Button onClick={handleNewTab} size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                新建连接
              </Button>
            </div>
          </div>
        ) : activeTab && activeSession ? (
          // 显示活动终端
          <XTermWrapper
            key={activeTab.id}
            sessionId={activeTab.sessionId}
            onTitleChange={(title) => {
              // TODO: 更新标签页标题
            }}
          />
        ) : (
          // 没有活动标签页
          <div className="flex items-center justify-center h-full bg-muted/10">
            <div className="text-center">
              <p className="text-muted-foreground">选择或创建一个标签页开始使用</p>
            </div>
          </div>
        )}
      </div>

      {/* 快速连接对话框 */}
      <QuickConnectDialog
        open={quickConnectOpen}
        onOpenChange={setQuickConnectOpen}
        onConnect={handleQuickConnect}
      />
    </div>
  );
}
