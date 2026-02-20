import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Palette,
  Terminal,
  Keyboard,
  Info,
  Mic,
  Volume2,
  Github,
  RotateCcw,
  Bot,
  Cloud,
  Globe
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModeToggle } from '@/components/mode-toggle';
import { useTheme } from '@/components/theme-provider';
import { TerminalSettings } from '@/components/settings/TerminalSettings';
import { KeybindingsSettings } from '@/components/keybindings/KeybindingsSettings';
import { AISettings } from '@/components/settings/AISettings';
import { soundManager, playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';
import { useTerminalConfigStore } from '@/store/terminalConfigStore';
import { useAIStore } from '@/store/aiStore';
import { useAppSettingsStore } from '@/store/appSettingsStore';
import { useLanguageStore } from '@/store/languageStore';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import type { TerminalConfig } from '@/types/terminal';

export function Settings() {
  const { t } = useTranslation();
  const { config, setConfig, loadConfig } = useTerminalConfigStore();
  const { loadConfig: loadAIConfig } = useAIStore();
  const { setTheme } = useTheme();
  const {
    settings: appSettings,
    // isLoading: appSettingsLoading,
    loadSettings: loadAppSettings,
    updateServerUrl,
    updateAutoSync,
    updateSyncInterval,
    // updateLanguage,
    clearError: clearAppSettingsError
  } = useAppSettingsStore();
  const { language, setLanguage } = useLanguageStore();

  const [serverUrlInput, setServerUrlInput] = useState('');
  const [isSavingServerUrl, setIsSavingServerUrl] = useState(false);

  // 加载配置
  useEffect(() => {
    loadConfig();
    loadAIConfig();
    loadAppSettings();
  }, [loadConfig, loadAIConfig, loadAppSettings]);

  // 当 appSettings 加载完成后，更新 serverUrlInput
  useEffect(() => {
    if (appSettings) {
      setServerUrlInput(appSettings.serverUrl);
    }
  }, [appSettings]);

  const handleSwitchChange = async (key: string, value: boolean) => {
    // 如果是音效设置，更新音效管理器
    if (key === 'soundEffects') {
      soundManager.setEnabled(value);
      if (value) {
        playSound(SoundEffect.SUCCESS);
      }
    } else if (value) {
      // 其他开关打开时播放轻微点击音
      playSound(SoundEffect.TOGGLE_SWITCH);
    }

    // 持久化到后端
    try {
      if (key === 'notifications') {
        await setConfig({ notificationsEnabled: value });
      } else if (key === 'soundEffects') {
        await setConfig({ soundEffectsEnabled: value });
      }
    } catch (error) {
      console.error('Failed to save setting:', error);
    }
  };

  const handleSaveServerUrl = async () => {
    setIsSavingServerUrl(true);
    clearAppSettingsError();
    try {
      await updateServerUrl(serverUrlInput.trim());
      playSound(SoundEffect.SUCCESS);
    } catch (error) {
      playSound(SoundEffect.ERROR);
    } finally {
      setIsSavingServerUrl(false);
    }
  };

  const handleAutoSyncChange = async (enabled: boolean) => {
    playSound(SoundEffect.TOGGLE_SWITCH);
    try {
      await updateAutoSync(enabled);
      playSound(SoundEffect.SUCCESS);
    } catch (error) {
      playSound(SoundEffect.ERROR);
    }
  };

  const handleSyncIntervalChange = async (interval: number) => {
    playSound(SoundEffect.BUTTON_CLICK);
    try {
      await updateSyncInterval(interval);
      playSound(SoundEffect.SUCCESS);
    } catch (error) {
      playSound(SoundEffect.ERROR);
    }
  };

  const handleLanguageChange = async (language: string) => {
    playSound(SoundEffect.BUTTON_CLICK);
    try {
      setLanguage(language as any);
      playSound(SoundEffect.SUCCESS);
    } catch (error) {
      playSound(SoundEffect.ERROR);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* 设置选项卡 */}
      <Tabs defaultValue="appearance" className="space-y-4 sm:space-y-6">
        <TabsList className="flex flex-wrap w-full h-auto gap-1">
          <TabsTrigger value="account" className="gap-2 min-w-fit flex-1">
            <Cloud className="h-4 w-4" />
            {t('settings.tabs.account')}
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2 min-w-fit flex-1">
            <Palette className="h-4 w-4" />
            {t('settings.tabs.appearance')}
          </TabsTrigger>
          <TabsTrigger value="terminal" className="gap-2 min-w-fit flex-1">
            <Terminal className="h-4 w-4" />
            {t('settings.tabs.terminal')}
          </TabsTrigger>
          <TabsTrigger value="recording" className="gap-2 min-w-fit flex-1">
            <Mic className="h-4 w-4" />
            {t('settings.tabs.recording')}
          </TabsTrigger>
          <TabsTrigger value="keybindings" className="gap-2 min-w-fit flex-1">
            <Keyboard className="h-4 w-4" />
            {t('settings.tabs.keybindings')}
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2 min-w-fit flex-1">
            <Bot className="h-4 w-4" />
            {t('settings.tabs.ai')}
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-2 min-w-fit flex-1">
            <Info className="h-4 w-4" />
            {t('settings.tabs.about')}
          </TabsTrigger>
        </TabsList>

        {/* {t('settings.tabs.account')}设置 */}
        <TabsContent value="account" className="space-y-6">
          <h2 className="text-xl font-semibold">{t('settings.tabs.account')}</h2>
          <div className="space-y-4">
            {/* 服务器地址 */}
            <div className="space-y-2">
              <Label htmlFor="server-url">{t("settings.account.serverUrl.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.account.serverUrl.description")}
              </p>
              <div className="flex gap-2">
                <Input
                  id="server-url"
                  type="url"
                  placeholder={t("settings.account.serverUrl.placeholder")}
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  disabled={isSavingServerUrl}
                />
                <Button
                  onClick={handleSaveServerUrl}
                  disabled={isSavingServerUrl || !serverUrlInput.trim()}
                  size="sm"
                >
                  {isSavingServerUrl ? t('settings.account.serverUrl.saving') : t('settings.account.serverUrl.save')}
                </Button>
              </div>
            </div>

            <Separator />

            {/* 自动同步 */}
            <div className="flex items-center justify-between opacity-50">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">{t("settings.account.autoSync.label")}</Label>
                <p className="text-sm text-muted-foreground">
                {t("settings.account.autoSync.description")}
              </p>
              </div>
              <Switch
                id="auto-sync"
                checked={appSettings?.autoSyncEnabled || false}
                onCheckedChange={handleAutoSyncChange}
                disabled={true}
              />
            </div>

            <Separator />

            {/* 同步间隔 */}
            <div className="space-y-2 opacity-50">
              <Label>{t("settings.account.syncInterval.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.account.syncInterval.description")}
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 5, 10, 30, 60].map((interval) => (
                  <Button
                    key={interval}
                    variant={appSettings?.syncIntervalMinutes === interval ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSyncIntervalChange(interval)}
                    disabled={true}
                  >
                    {t('settings.account.syncInterval.minutes', { interval })}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* 语言设置 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t("settings.account.language.label")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.account.language.description")}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'zh-CN', label: '简体中文' },
                  { value: 'en-US', label: 'English' },
                  { value: 'ja-JP', label: '日本語' },
                ].map((lang) => (
                  <Button
                    key={lang.value}
                    variant={language === lang.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleLanguageChange(lang.value)}
                    disabled={false}
                  >
                    {lang.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* {t('settings.appearance.title')} */}
        <TabsContent value="appearance" className="space-y-6">
          {/* 顶部标题和重置按钮 */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t('settings.appearance.title')}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  const defaultConfig = await invoke<TerminalConfig>('storage_config_get_default');
                  // 使用 setTheme 方法确保 appTheme 正确设置
                  setTheme(defaultConfig.appTheme || 'system');
                  playSound(SoundEffect.SUCCESS);
                } catch (error) {
                  console.error('Failed to reset appearance config:', error);
                  playSound(SoundEffect.ERROR);
                }
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t('settings.terminal.reset')}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme">{t("settings.appearance.theme.label")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.appearance.theme.description')}
                </p>
              </div>
              <ModeToggle />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">{t("settings.appearance.notifications.label")}</Label>
                <p className="text-sm text-muted-foreground">
                {t("settings.appearance.notifications.description")}
              </p>
              </div>
              <Switch
                id="notifications"
                checked={config.notificationsEnabled}
                onCheckedChange={(checked) => handleSwitchChange('notifications', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sound">{t("settings.appearance.sound.label")}</Label>
                <p className="text-sm text-muted-foreground">
                {t("settings.appearance.sound.description")}
              </p>
              </div>
              <Switch
                id="sound"
                checked={config.soundEffectsEnabled}
                onCheckedChange={(checked) => handleSwitchChange('soundEffects', checked)}
              />
            </div>
          </div>
        </TabsContent>

        {/* {t('settings.tabs.terminal')}设置 */}
        <TabsContent value="terminal" className="space-y-6">
          <TerminalSettings />
        </TabsContent>

        {/* {t('settings.recording.title')} */}
        <TabsContent value="recording" className="space-y-6">
          {/* 顶部标题和重置按钮 */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t('settings.recording.title')}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  const defaultConfig = await invoke<TerminalConfig>('storage_config_get_default');
                  await setConfig(defaultConfig);
                  playSound(SoundEffect.SUCCESS);
                } catch (error) {
                  console.error('Failed to reset config:', error);
                  playSound(SoundEffect.ERROR);
                }
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t('settings.terminal.reset')}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="videoQuality">{t('settings.recording.videoQuality.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.recording.videoQuality.description')}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant={config.videoQuality === 'low' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => setConfig({ videoQuality: 'low' })}
                >
                  {t('settings.recording.videoQuality.low')}
                </Button>
                <Button
                  variant={config.videoQuality === 'medium' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => setConfig({ videoQuality: 'medium' })}
                >
                  {t('settings.recording.videoQuality.medium')}
                </Button>
                <Button
                  variant={config.videoQuality === 'high' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => setConfig({ videoQuality: 'high' })}
                >
                  {t('settings.recording.videoQuality.high')}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="videoFormat">{t('settings.recording.videoFormat.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.recording.videoFormat.description')}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant={config.videoFormat === 'webm' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => setConfig({ videoFormat: 'webm' })}
                >
                  {t('settings.recording.videoFormat.webm')}
                </Button>
                <Button
                  variant={config.videoFormat === 'mp4' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => setConfig({ videoFormat: 'mp4' })}
                >
                  {t('settings.recording.videoFormat.mp4')}
                </Button>
              </div>
            </div>

            <Separator />

            {/* 音频{t('settings.recording.title')} */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                {t('settings.recording.recordMicrophone.label')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.recording.recordMicrophone.description')}
              </p>
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">{t('settings.recording.recordMicrophone.warning')}</p>
              </div>
              <Switch
                checked={config.recordMicrophone}
                onCheckedChange={(checked) => {
                  setConfig({ recordMicrophone: checked });
                  playSound(SoundEffect.TOGGLE_SWITCH);
                }}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                {t('settings.recording.recordSpeaker.label')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.recording.recordSpeaker.description')}
              </p>
              <Switch
                checked={config.recordSpeaker}
                onCheckedChange={(checked) => {
                  setConfig({ recordSpeaker: checked });
                  playSound(SoundEffect.TOGGLE_SWITCH);
                }}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t('settings.recording.audioQuality.label')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.recording.audioQuality.description')}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant={config.audioQuality === 'low' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => {
                    setConfig({ audioQuality: 'low' });
                    playSound(SoundEffect.BUTTON_CLICK);
                  }}
                  disabled={!config.recordMicrophone && !config.recordSpeaker}
                >
                  {t('settings.recording.audioQuality.low')}
                </Button>
                <Button
                  variant={config.audioQuality === 'medium' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => {
                    setConfig({ audioQuality: 'medium' });
                    playSound(SoundEffect.BUTTON_CLICK);
                  }}
                  disabled={!config.recordMicrophone && !config.recordSpeaker}
                >
                  {t('settings.recording.audioQuality.medium')}
                </Button>
                <Button
                  variant={config.audioQuality === 'high' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => {
                    setConfig({ audioQuality: 'high' });
                    playSound(SoundEffect.BUTTON_CLICK);
                  }}
                  disabled={!config.recordMicrophone && !config.recordSpeaker}
                >
                  {t('settings.recording.audioQuality.high')}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t("settings.recording.audioSampleRate.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.recording.audioSampleRate.description', { rate: config.audioSampleRate })}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant={config.audioSampleRate === 44100 ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => {
                    setConfig({ audioSampleRate: 44100 });
                    playSound(SoundEffect.BUTTON_CLICK);
                  }}
                  disabled={!config.recordMicrophone && !config.recordSpeaker}
                >
                  {t('settings.recording.audioSampleRate.44100')}
                </Button>
                <Button
                  variant={config.audioSampleRate === 48000 ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => {
                    setConfig({ audioSampleRate: 48000 });
                    playSound(SoundEffect.BUTTON_CLICK);
                  }}
                  disabled={!config.recordMicrophone && !config.recordSpeaker}
                >
                  {t('settings.recording.audioSampleRate.48000')}
                </Button>
                <Button
                  variant={config.audioSampleRate === 96000 ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-24 touch-manipulation"
                  onClick={() => {
                    setConfig({ audioSampleRate: 96000 });
                    playSound(SoundEffect.BUTTON_CLICK);
                  }}
                  disabled={!config.recordMicrophone && !config.recordSpeaker}
                >
                  {t('settings.recording.audioSampleRate.96000')}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="rounded-lg border p-4 bg-muted/20">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                {t('settings.recording.tips.title')}
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>{t('settings.recording.tips.tip1')}</li>
                <li>{t('settings.recording.tips.tip2')}</li>
                <li>{t('settings.recording.tips.tip3')}</li>
                <li>{t("settings.recording.tips.tip4")}</li>
              </ul>
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                
                {t('settings.recording.tips.micCheck')}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* {t('settings.tabs.keybindings')}设置 */}
        <TabsContent value="keybindings" className="space-y-6">
          <KeybindingsSettings />
        </TabsContent>

        {/* {t('settings.tabs.ai')} 设置 */}
        <TabsContent value="ai" className="space-y-6">
          <AISettings />
        </TabsContent>

        {/* {t('settings.tabs.about')} */}
        <TabsContent value="about" className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-lg border p-6 bg-muted/20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Terminal className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">{t("settings.about.title")}</h2>
              <p className="text-muted-foreground mt-1">{t("settings.about.version")}</p>
              <p className="text-sm text-muted-foreground mt-4 max-w-md mx-auto">
                {t('settings.about.description')}
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold">{t("settings.about.techStack.title")}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 text-sm">
                <div className="rounded border p-3 bg-muted/20">
                  <p className="font-medium">{t("settings.about.techStack.frontend")}</p>
                  <p className="text-muted-foreground text-xs">React 19</p>
                </div>
                <div className="rounded border p-3 bg-muted/20">
                  <p className="font-medium">{t("settings.about.techStack.backend")}</p>
                  <p className="text-muted-foreground text-xs">Tauri 2.0</p>
                </div>
                <div className="rounded border p-3 bg-muted/20">
                  <p className="font-medium">{t("settings.about.techStack.ui")}</p>
                  <p className="text-muted-foreground text-xs">shadcn/ui</p>
                </div>
                <div className="rounded border p-3 bg-muted/20">
                  <p className="font-medium">{t('settings.tabs.terminal')}</p>
                  <p className="text-muted-foreground text-xs">xterm.js</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold">{t("settings.about.repository.title")}</h3>
              <div className="rounded-lg border p-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Github className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{t("settings.about.repository.github")}</p>
                      <p className="text-sm text-muted-foreground">{t("settings.about.repository.repoName")}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openUrl('https://github.com/shenjianZ/ssh-terminal')}
                    className="gap-2"
                  >
                    <Github className="h-4 w-4" />
                    {t('settings.about.repository.visit')}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  {t("settings.about.repository.description")}
                </p>
              </div>
            </div>

            <Separator />

            <div className="text-center text-sm text-muted-foreground">
              <p>{t("settings.about.copyright")}</p>
              <p className="mt-1">
                {t("settings.about.madeWith")}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
























