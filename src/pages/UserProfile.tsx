import { useEffect, useState } from 'react';
import { User, Mail, Trash2, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useAuthStore } from '@/store/authStore';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';

export function UserProfile() {
  const { profile, isLoading, error, loadProfile, updateProfile, deleteProfile, clearError } = useUserProfileStore();
  const { currentUser } = useAuthStore();

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    phone: '',
    qq: '',
    wechat: '',
    bio: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        phone: profile.phone || '',
        qq: profile.qq || '',
        wechat: profile.wechat || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  const handleEdit = () => {
    playSound(SoundEffect.BUTTON_CLICK);
    setEditMode(true);
  };

  const handleCancel = () => {
    playSound(SoundEffect.BUTTON_CLICK);
    setEditMode(false);
    clearError();
  };

  const handleSave = async () => {
    setIsUpdating(true);
    clearError();
    try {
      await updateProfile(formData);
      playSound(SoundEffect.SUCCESS);
      setEditMode(false);
    } catch (error) {
      playSound(SoundEffect.ERROR);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProfile();
      playSound(SoundEffect.SUCCESS);
      setDeleteDialogOpen(false);
      // 删除后重新加载profile
      await loadProfile();
    } catch (error) {
      playSound(SoundEffect.ERROR);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAvatarClick = () => {
    // TODO: 实现头像上传功能
    playSound(SoundEffect.BUTTON_CLICK);
    alert('头像上传功能开发中...');
  };

  const getInitials = (username?: string, email?: string) => {
    if (username) {
      return username.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            个人资料
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 头像部分 */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 sm:h-28 sm:w-28">
                {profile?.avatarData && profile?.avatarMimeType ? (
                  <AvatarImage
                    src={`data:${profile.avatarMimeType};base64,${profile.avatarData}`}
                    alt={profile.username || 'User'}
                  />
                ) : null}
                <AvatarFallback className="text-xl sm:text-2xl">
                  {getInitials(profile?.username, currentUser?.email)}
                </AvatarFallback>
              </Avatar>
              {editMode && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleAvatarClick}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="text-center sm:text-left space-y-1">
              <h3 className="text-xl font-semibold">
                {profile?.username || currentUser?.email || '未登录'}
              </h3>
              <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-2">
                <Mail className="h-4 w-4" />
                {currentUser?.email || '未登录'}
              </p>
            </div>
          </div>

          <Separator />

          {/* 表单部分 */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!editMode}
                  placeholder="输入用户名"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!editMode}
                  placeholder="输入手机号"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qq">QQ</Label>
                <Input
                  id="qq"
                  value={formData.qq}
                  onChange={(e) => setFormData({ ...formData, qq: e.target.value })}
                  disabled={!editMode}
                  placeholder="输入QQ号"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wechat">微信</Label>
                <Input
                  id="wechat"
                  value={formData.wechat}
                  onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
                  disabled={!editMode}
                  placeholder="输入微信号"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">简介</Label>
              <Input
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!editMode}
                placeholder="介绍一下自己..."
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between pt-2">
            <div className="flex gap-2">
              {editMode ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isUpdating}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="min-w-[80px]"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        保存中
                      </>
                    ) : (
                      '保存'
                    )}
                  </Button>
                </>
              ) : (
                <Button onClick={handleEdit}>
                  编辑资料
                </Button>
              )}
            </div>

            {profile && !editMode && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  playSound(SoundEffect.BUTTON_CLICK);
                  setDeleteDialogOpen(true);
                }}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                删除资料
              </Button>
            )}
          </div>

          {/* 更新时间 */}
          {profile && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <p>创建时间: {new Date(profile.createdAt).toLocaleString('zh-CN')}</p>
              <p>更新时间: {new Date(profile.updatedAt).toLocaleString('zh-CN')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除个人资料？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除您的个人资料信息，包括头像、联系方式等。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={playSound.bind(null, SoundEffect.BUTTON_CLICK)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中
                </>
              ) : (
                '确认删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
