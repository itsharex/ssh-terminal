import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Loader2, Upload, Phone, MessageCircle, Save, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

import { toast } from 'sonner';
import { useUserProfileStore } from '@/store/userProfileStore';
import { useAuthStore } from '@/store/authStore';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';
import { extractMessageFromError } from '@/utils/network';

// 最大头像大小：5MB
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
// 支持的图片格式
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];

/**
 * 将文件转换为 Base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:image/xxx;base64, 前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 验证图片文件
 */
function validateImageFile(file: File): { valid: boolean; errorKey?: string; errorParams?: Record<string, any> } {
  // 检查文件类型
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      errorKey: 'user.profile.validation.unsupportedFormat',
      errorParams: { format: file.type },
    };
  }

  // 检查文件大小
  if (file.size > MAX_AVATAR_SIZE) {
    return {
      valid: false,
      errorKey: 'user.profile.validation.imageTooLarge',
      errorParams: { size: (file.size / 1024 / 1024).toFixed(2) },
    };
  }

  return { valid: true };
}

export function UserProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, isLoading, loadProfile, updateProfile, syncProfile, clearError } = useUserProfileStore();
  const { currentUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    phone: '',
    qq: '',
    wechat: '',
    bio: '',
    avatarData: '' as string | undefined,
    avatarMimeType: '' as string | undefined,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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
        avatarData: profile.avatarData,
        avatarMimeType: profile.avatarMimeType,
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
    // 重置表单为当前 profile
    if (profile) {
      setFormData({
        username: profile.username || '',
        phone: profile.phone || '',
        qq: profile.qq || '',
        wechat: profile.wechat || '',
        bio: profile.bio || '',
        avatarData: profile.avatarData,
        avatarMimeType: profile.avatarMimeType,
      });
    }
  };

  const handleSave = async () => {
    setIsUpdating(true);
    clearError();

    try {
      // 过滤掉空字符串的头像字段
      const submitData = {
        username: formData.username || undefined,
        phone: formData.phone || undefined,
        qq: formData.qq || undefined,
        wechat: formData.wechat || undefined,
        bio: formData.bio || undefined,
        avatarData: formData.avatarData || undefined,
        avatarMimeType: formData.avatarMimeType || undefined,
      };

      await updateProfile(submitData);
      playSound(SoundEffect.SUCCESS);
      toast.success(t('user.profile.toast.saveSuccess'), {
        description: t('user.profile.toast.saveSuccessDescription'),
      });
      setEditMode(false);
    } catch (error) {
      playSound(SoundEffect.ERROR);
      toast.error(t('user.profile.toast.saveFailed'), {
        description: error instanceof Error ? error.message : t('common.unknownError'),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncProfile();
      playSound(SoundEffect.SUCCESS);
      toast.success(t('user.profile.toast.syncSuccess'), {
        description: t('user.profile.toast.syncSuccessDescription'),
      });
    } catch (error) {
      playSound(SoundEffect.ERROR);
      const errorMessage = typeof error === 'string' 
        ? extractMessageFromError(error).message 
        : (error instanceof Error ? error.message : t('common.unknownError'));
      toast.error(t('user.profile.toast.syncFailed'), {
        description: errorMessage,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(t('user.profile.validation.imageValidationFailed'), {
        description: validation.errorKey ? t(validation.errorKey, validation.errorParams) : undefined,
      });
      return;
    }

    try {
      // 转换为 Base64
      const base64 = await fileToBase64(file);

      setFormData(prev => ({
        ...prev,
        avatarData: base64,
        avatarMimeType: file.type,
      }));

      toast.success(t('user.profile.toast.imageSelected'), {
        description: t('user.profile.toast.imageSelectedDescription'),
      });
    } catch (error) {
      console.error('[UserProfile.tsx] 图片处理失败:', error);
      toast.error(t('user.profile.toast.imageProcessingFailed'), {
        description: error instanceof Error ? error.message : t('common.unknownError'),
      });
    }

    // 清空 input，允许重复选择同一文件
    e.target.value = '';
  };

  const getAvatarSrc = () => {
    if (formData.avatarData && formData.avatarMimeType) {
      return `data:${formData.avatarMimeType};base64,${formData.avatarData}`;
    }
    return undefined;
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

  const displayName = formData.username || currentUser?.email?.split('@')[0] || 'User';

  if (isLoading && !profile) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('user.profile.title')}
              </CardTitle>
            </div>
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={isSyncing || isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? t('user.profile.syncing') : t('user.profile.syncToServer')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 头像区域 */}
          <div className="flex items-center gap-6 p-6 rounded-lg border bg-muted/20">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
              <AvatarImage src={getAvatarSrc()} />
              <AvatarFallback className="text-xl sm:text-2xl font-medium">
                {getInitials(formData.username, currentUser?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-2xl font-semibold">{displayName}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {currentUser?.email || t('user.profile.avatarSection.notLoggedIn')}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />
            {editMode && (
              <Button variant="outline" type="button" onClick={handleAvatarClick}>
                <Upload className="mr-2 h-4 w-4" />
                {t('user.profile.avatarSection.changeAvatar')}
              </Button>
            )}
          </div>

          <Separator />

          {/* 表单部分 */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{t('user.profile.basicInfo.title')}</h3>

              <div className="space-y-2">
                <Label htmlFor="username">{t('user.profile.basicInfo.username')}</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!editMode}
                  placeholder={t('user.profile.basicInfo.usernamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('user.profile.basicInfo.email')}</Label>
                <Input
                  id="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {t('user.profile.basicInfo.emailLocked')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">{t('user.profile.basicInfo.bio')}</Label>
                <Input
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  disabled={!editMode}
                  placeholder={t('user.profile.basicInfo.bioPlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{t('user.profile.contactInfo.title')}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="inline mr-2 h-4 w-4" />
                    {t('user.profile.contactInfo.phone')}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!editMode}
                    placeholder={t('user.profile.contactInfo.phonePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qq">{t('user.profile.contactInfo.qq')}</Label>
                  <Input
                    id="qq"
                    value={formData.qq}
                    onChange={(e) => setFormData({ ...formData, qq: e.target.value })}
                    disabled={!editMode}
                    placeholder={t('user.profile.contactInfo.qqPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wechat">
                    <MessageCircle className="inline mr-2 h-4 w-4" />
                    {t('user.profile.contactInfo.wechat')}
                  </Label>
                  <Input
                    id="wechat"
                    value={formData.wechat}
                    onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
                    disabled={!editMode}
                    placeholder={t('user.profile.contactInfo.wechatPlaceholder')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end pt-2">
            <div className="flex gap-2">
              {editMode ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isUpdating}
                  >
                    {t('user.profile.actions.cancel')}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="min-w-[80px]"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('user.profile.actions.saving')}
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {t('user.profile.actions.save')}
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button onClick={handleEdit}>
                  {t('user.profile.actions.edit')}
                </Button>
              )}
            </div>
          </div>

          {/* 更新时间 */}
          {profile && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <p>{t('user.profile.timestamps.createdAt')}: {new Date(profile.createdAt * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
              <p>{t('user.profile.timestamps.updatedAt')}: {new Date(profile.updatedAt * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}