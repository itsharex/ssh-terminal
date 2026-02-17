import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';

interface LoginFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginForm({ isOpen, onClose }: LoginFormProps) {
  const { login, register, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, password });
      }
      onClose();
      // 清空表单
      setEmail('');
      setPassword('');
      mode === 'register' && setMode('login');
    } catch (error) {
      // 错误已经在 store 中设置了
      console.error('Auth failed:', error);
    }
  };

  const handleClose = () => {
    clearError();
    setMode('login');
    setEmail('');
    setPassword('');
    onClose();
  };

  const handleSwitchMode = () => {
    clearError();
    setEmail('');
    setPassword('');
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'login' ? '登录账号' : '注册新账号'}</DialogTitle>
          <DialogDescription>
            {mode === 'login'
              ? '登录以启用 SSH 会话云同步功能'
              : '注册账号以使用 SSH 会话云同步功能'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="your-email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {mode === 'login' ? '密码' : '设置密码'}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="•••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSwitchMode}
              className="text-sm"
            >
              {mode === 'login'
                ? '没有账号？去注册'
                : '已有账号？去登录'}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? (mode === 'login' ? '登录中...' : '注册中...')
                  : (mode === 'login' ? '登录' : '注册')}
              </Button>
            </div>
          </div>
        </form>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          服务器地址可在设置中配置
        </div>
      </DialogContent>
    </Dialog>
  );
}
