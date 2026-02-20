import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { Bell, Plus, FolderOpen, RotateCcw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { TerminalConfig } from "@/types/terminal";
import { useTerminalConfigStore } from "@/store/terminalConfigStore";
import { useKeybindingStore } from "@/store/keybindingStore";
import { useAIStore } from "@/store/aiStore";
import { playSound } from "@/lib/sounds";
import { SoundEffect } from "@/lib/sounds";
import { useTranslation } from 'react-i18next';

const getPageTitle = (pathname: string): string => {
  const titles: Record<string, string> = {
    '/': 'page.terminal',
    '/terminal': 'page.terminal',
    '/sessions': 'page.sessions',
    '/settings': 'page.settings',
    '/sftp': 'page.sftp',
  };
  return titles[pathname] || 'app.name';
};

export function TopBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = t(getPageTitle(location.pathname));
  const isSessionPage = location.pathname === '/sessions';
  const isSettingsPage = location.pathname === '/settings';
  const { setConfig } = useTerminalConfigStore();
  const keybindingStore = useKeybindingStore();
  const aiStore = useAIStore();

  const handleNewSession = () => {
    window.dispatchEvent(new CustomEvent('topbar-new-session'));
  };

  const handleResetAll = async () => {
    playSound(SoundEffect.BUTTON_CLICK);
    try {
      // 1. 防嶇疆缁堢鐮/褰曞埗閰嶇疆
      const defaultConfig = await invoke<TerminalConfig>('storage_config_get_default');
      await setConfig(defaultConfig);

      // 2. 防嶇疆蹇呴€闿?
      await invoke('storage_keybindings_reset');
      await keybindingStore.loadFromStorage();

      // 3. 防嶇疆 AI 閰嶇疆
      const defaultAIConfig = await aiStore.getDefaultConfig();
      await aiStore.saveConfig(defaultAIConfig);

      playSound(SoundEffect.SUCCESS);
    } catch (error) {
      console.error('Failed to reset all configs:', error);
      playSound(SoundEffect.ERROR);
    }
  };

  return (
    <header className="h-16 bg-background border-b border-border px-6 flex items-center justify-between">
      {/* Page Title */}
      <h1 className="text-xl font-semibold">{pageTitle}</h1>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* 浼氳瘽绠＄悊椤甸潰涓撳睘鎸夐挳 */}
        {isSessionPage && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/terminal')}
              className="touch-manipulation"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('action.openTerminal')}</span>
              <span className="sm:hidden">{t('page.terminal')}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleNewSession}
              className="touch-manipulation"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('action.newSession')}</span>
              <span className="sm:hidden">{t('dialog.create')}</span>
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
          </>
        )}

        {/* 璁剧疆椤甸潰涓撳睘鎸夐挳 */}
        {isSettingsPage && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetAll}
              className="gap-2 touch-manipulation"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">{t('action.resetAll')}</span>
              <span className="sm:hidden">{t('dialog.reset')}</span>
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
          </>
        )}

        <Button size="sm" variant="ghost">
          <Bell className="h-4 w-4" />
        </Button>
        <ModeToggle />
      </div>
    </header>
  );
}

export default TopBar;
