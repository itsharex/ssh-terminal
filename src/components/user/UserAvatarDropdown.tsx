import { LogOut, User, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/authStore';
import { useState } from 'react';

export function UserAvatarDropdown() {
  const { currentUser, logout } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // 获取邮箱首字母作为头像
  const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 w-full justify-start gap-2 px-2 hover:bg-accent/50"
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(currentUser?.email)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium truncate flex-1 text-left">
            {currentUser?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <div className="px-3 py-2 text-sm font-medium">
          {currentUser?.email}
        </div>
        <Separator className="my-1" />
        <DropdownMenuItem asChild className="gap-2">
          <Link to="/user-profile">
            <User className="h-4 w-4" />
            个人资料
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <Link to="/settings">
            <Settings className="h-4 w-4" />
            设置
          </Link>
        </DropdownMenuItem>
        <Separator className="my-1" />
        <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          登出
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
