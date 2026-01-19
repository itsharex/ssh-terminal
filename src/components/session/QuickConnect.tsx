import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSessionStore } from '@/store/sessionStore';

interface QuickConnectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect?: (sessionId: string) => void;
}

export function QuickConnect({ open, onOpenChange, onConnect }: QuickConnectProps) {
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { addSession } = useSessionStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 创建会话配置（格式需要匹配 Rust 后端的 AuthMethod enum）
      const config = {
        name: `${username}@${host}`,
        host,
        port: parseInt(port),
        username,
        auth_method: {
          Password: {
            password,
          },
        },
        terminal_type: 'xterm-256color',
        columns: 80,
        rows: 24,
      };

      console.log('Creating session with config:', config);

      // 1. 先创建会话
      const sessionId = await addSession(config);
      console.log('Session created with ID:', sessionId);

      // 2. 等待一小段时间确保 session 被添加到 store
      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. 尝试连接
      try {
        await invoke('ssh_connect', { sessionId });
        console.log('SSH connected successfully');

        // 连接成功，关闭对话框并通知
        onOpenChange(false);
        onConnect?.(sessionId);

        // 重置表单
        setHost('localhost');
        setPort('22');
        setUsername('');
        setPassword('');
      } catch (connectErr) {
        // 连接失败，但会话已创建，仍然添加标签让用户看到错误
        console.error('SSH connection failed:', connectErr);
        setError(`连接失败: ${connectErr}`);

        // 添加标签页但保持对话框打开
        onConnect?.(sessionId);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
      setError(`创建会话失败: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>快速连接 SSH</DialogTitle>
          <DialogDescription>
            输入 SSH 服务器信息以建立连接
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="host">主机</Label>
              <Input
                id="host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost 或 IP 地址"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">端口</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                min="1"
                max="65535"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '连接中...' : '连接'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
