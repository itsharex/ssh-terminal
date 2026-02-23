import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { LoginForm } from './LoginForm';
import { UserAvatarDropdown } from './UserAvatarDropdown';

export function UserArea() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [showLogin, setShowLogin] = useState(false);

  const handleLoginClick = () => {
    setShowLogin(true);
  };

  const handleLoginClose = () => {
    setShowLogin(false);
  };

  // 已登录显示用户头像下拉菜单
  if (isAuthenticated) {
    return <UserAvatarDropdown />;
  }

  // 未登录显示登录按钮
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleLoginClick}
        title={t('userMenu.login')}
      >
        <UserIcon className="h-4 w-4" />
      </Button>

      {showLogin && (
        <LoginForm
          isOpen={showLogin}
          onClose={handleLoginClose}
        />
      )}
    </>
  );
}
