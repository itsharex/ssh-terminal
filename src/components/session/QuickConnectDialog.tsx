import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

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
      toast.error(t('session.error.quickConnectFailed'), {
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
            {t('session.quickConnect.title')}
          </DialogTitle>
          <DialogDescription>
            {t('session.quickConnect.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 主机地址 */}
          <div className="space-y-2">
            <Label htmlFor="quick-host">
              {t('session.field.host')} <span className="text-destructive">*</span>
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
                {t('session.field.port')} <span className="text-destructive">*</span>
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
                {t('session.field.username')} <span className="text-destructive">*</span>
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
            <Label htmlFor="quick-auth">{t('session.field.authMethod')}</Label>
            <Select
              value={formData.authMethod}
              onValueChange={(value) => setFormData({ ...formData, authMethod: value })}
            >
              <SelectTrigger id="quick-auth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">{t('session.auth.password')}</SelectItem>
                <SelectItem value="publicKey">{t('session.auth.publicKey')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 密码认证 */}
          {formData.authMethod === 'password' && (
            <div className="space-y-2">
              <Label htmlFor="quick-password">
                {t('session.field.password')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-password"
                type="password"
                placeholder={t('session.field.passwordPlaceholder')}
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
                  {t('session.field.privateKeyPath')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quick-key"
                  placeholder={t('session.field.privateKeyPathPlaceholder')}
                  value={formData.privateKeyPath}
                  onChange={(e) => setFormData({ ...formData, privateKeyPath: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quick-passphrase">{t('session.field.passphrase')}</Label>
                <Input
                  id="quick-passphrase"
                  type="password"
                  placeholder={t('session.field.passphrasePlaceholder')}
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
              {t('dialog.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('session.status.connecting')}
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  {t('session.action.connectNow')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
