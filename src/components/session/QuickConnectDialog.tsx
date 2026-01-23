import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Zap } from 'lucide-react';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';
import { toast } from 'sonner';

interface QuickConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (config: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
  }) => void;
}

export function QuickConnectDialog({
  open,
  onOpenChange,
  onConnect,
}: QuickConnectDialogProps) {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    host: '',
    port: '22',
    username: '',
    authMethod: 'password',
    password: '',
    privateKeyPath: '',
    passphrase: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 基础验证
    if (!formData.host || !formData.username) {
      playSound(SoundEffect.ERROR);
      return;
    }

    if (formData.authMethod === 'password' && !formData.password) {
      playSound(SoundEffect.ERROR);
      return;
    }

    if (formData.authMethod === 'publicKey' && !formData.privateKeyPath) {
      playSound(SoundEffect.ERROR);
      return;
    }

    setLoading(true);

    try {
      await onConnect({
        host: formData.host,
        port: parseInt(formData.port),
        username: formData.username,
        password: formData.authMethod === 'password' ? formData.password : undefined,
        privateKeyPath: formData.authMethod === 'publicKey' ? formData.privateKeyPath : undefined,
        passphrase: formData.authMethod === 'publicKey' ? formData.passphrase : undefined,
      });

      // 连接成功后关闭对话框
      onOpenChange(false);
      playSound(SoundEffect.BUTTON_CLICK);

      // 重置表单
      setFormData({
        host: '',
        port: '22',
        username: '',
        authMethod: 'password',
        password: '',
        privateKeyPath: '',
        passphrase: '',
      });
    } catch (error) {
      playSound(SoundEffect.ERROR);
      console.error('Failed to connect:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error('快速连接失败', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} closeOnClickOutside={false}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            快速连接
          </DialogTitle>
          <DialogDescription>
            快速建立 SSH 连接，不保存配置信息
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 主机地址 */}
          <div className="space-y-2">
            <Label htmlFor="quick-host">
              主机地址 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quick-host"
              placeholder="192.168.1.100"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              required
              autoFocus
            />
          </div>

          {/* 端口和用户名 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick-port">
                端口 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-port"
                type="number"
                min="1"
                max="65535"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-username">
                用户名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-username"
                placeholder="root"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
          </div>

          {/* 认证方式 */}
          <div className="space-y-2">
            <Label htmlFor="quick-auth">认证方式</Label>
            <Select
              value={formData.authMethod}
              onValueChange={(value) => setFormData({ ...formData, authMethod: value })}
            >
              <SelectTrigger id="quick-auth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">密码</SelectItem>
                <SelectItem value="publicKey">公钥</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 密码认证 */}
          {formData.authMethod === 'password' && (
            <div className="space-y-2">
              <Label htmlFor="quick-password">
                密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-password"
                type="password"
                placeholder="输入 SSH 密码"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          )}

          {/* 公钥认证 */}
          {formData.authMethod === 'publicKey' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="quick-key">
                  私钥路径 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quick-key"
                  placeholder="~/.ssh/id_rsa"
                  value={formData.privateKeyPath}
                  onChange={(e) => setFormData({ ...formData, privateKeyPath: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quick-passphrase">私钥密码（可选）</Label>
                <Input
                  id="quick-passphrase"
                  type="password"
                  placeholder="如果私钥有密码保护"
                  value={formData.passphrase}
                  onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                />
              </div>
            </>
          )}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  连接中...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  立即连接
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
