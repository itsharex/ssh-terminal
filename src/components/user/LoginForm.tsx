import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { toast } from 'sonner';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';

interface LoginFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginForm({ isOpen, onClose }: LoginFormProps) {
  const { t } = useTranslation();
  const { login, register, isLoading, clearError } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (mode === 'login') {
        await login({ email, password });
        playSound(SoundEffect.SUCCESS);
        toast.success(t('auth.login.success'), {
          description: t('auth.login.successDescription'),
        });
      } else {
        await register({ email, password });
        playSound(SoundEffect.SUCCESS);
        toast.success(t('auth.register.success'), {
          description: t('auth.register.successDescription'),
        });
      }
      onClose();
      // 清空表单
      setEmail('');
      setPassword('');
      mode === 'register' && setMode('login');
    } catch (error) {
      // 错误已经在 store 中设置了，这里显示 toast
      playSound(SoundEffect.ERROR);
      const errorMessage = error instanceof Error ? error.message : t('auth.error.unknownError');
      toast.error(mode === 'login' ? t('auth.login.failed') : t('auth.register.failed'), {
        description: errorMessage,
      });
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
          <DialogTitle>{mode === 'login' ? t('auth.login.title') : t('auth.register.title')}</DialogTitle>
          <DialogDescription>
            {mode === 'login' ? t('auth.login.description') : t('auth.register.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t(`auth.${mode}.fields.email`)}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t(`auth.${mode}.fields.emailPlaceholder`)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t(`auth.${mode}.fields.password`)}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t(`auth.${mode}.fields.passwordPlaceholder`)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSwitchMode}
              className="text-sm"
            >
              {mode === 'login' ? t('auth.switch.toRegister') : t('auth.switch.toLogin')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('auth.actions.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? t(`auth.${mode}.loading`)
                  : t(`auth.${mode}.button`)}
              </Button>
            </div>
          </div>
        </form>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          {t('auth.hints.serverUrlConfig')}
        </div>
      </DialogContent>
    </Dialog>
  );
}
