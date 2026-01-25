/**
 * SFTP 文件管理器主页面
 *
 * 提供双面板文件管理界面
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/sessionStore';
import { toast } from 'sonner';
import { DualPane } from '@/components/sftp/DualPane';

export function SftpManager() {
  const navigate = useNavigate();
  const { sessions } = useSessionStore();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 获取可用的 SSH 连接，根据 id 去重
  const availableConnections = (sessions || [])
    .filter((conn) => conn.status === 'connected')
    .filter((conn, index, self) =>
      index === self.findIndex((c) => c.id === conn.id)
    );

  useEffect(() => {
    // 如果有连接且未选择，自动选择第一个
    if (availableConnections.length > 0 && !selectedConnectionId) {
      setSelectedConnectionId(availableConnections[0].id);
    }
  }, [availableConnections, selectedConnectionId]);

  const handleConnect = async (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    const connection = availableConnections.find(c => c.id === connectionId);
    toast.success(`已切换到: ${connection?.name || connectionId} (${connection?.host})`);
  };

  const handleRefresh = async () => {
    if (!selectedConnectionId) {
      toast.error('请先选择一个连接');
      return;
    }
    setIsLoading(true);
    try {
      // TODO: 刷新文件列表
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success('刷新成功');
    } catch (error) {
      toast.error('刷新失败', { description: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  if (availableConnections.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">SFTP 文件管理器</h2>
          <p className="text-muted-foreground mb-6">
            没有可用的 SSH 连接
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            请先在终端页面连接到 SSH 服务器
          </p>
          <Button onClick={() => navigate('/terminal')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            前往终端
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部工具栏 */}
      <div className="border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/terminal')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="text-lg font-semibold">SFTP 文件管理器</h1>
              <p className="text-xs text-muted-foreground">
                管理远程文件
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 连接选择器 */}
            <select
              value={selectedConnectionId || ''}
              onChange={(e) => handleConnect(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background text-sm min-w-[200px]"
              disabled={availableConnections.length === 0}
            >
              {availableConnections.length === 0 ? (
                <option value="">无可用连接</option>
              ) : (
                availableConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} - {conn.username}@{conn.host}:{conn.port}
                  </option>
                ))
              )}
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || !selectedConnectionId}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!selectedConnectionId}
            >
              <Upload className="h-4 w-4 mr-2" />
              上传
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!selectedConnectionId}
            >
              <Download className="h-4 w-4 mr-2" />
              下载
            </Button>
          </div>
        </div>
      </div>

      {/* 双面板文件管理器 */}
      {selectedConnectionId ? (
        <div className="flex-1 overflow-hidden">
          <DualPane connectionId={selectedConnectionId} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">请选择一个 SSH 连接</p>
        </div>
      )}
    </div>
  );
}
