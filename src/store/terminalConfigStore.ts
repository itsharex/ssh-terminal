import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TerminalConfig, TerminalTheme } from '@/types/terminal';
import { DEFAULT_TERMINAL_CONFIG, TERMINAL_THEMES } from '@/config/themes';

interface TerminalConfigStore {
  config: TerminalConfig;

  // 操作
  setConfig: (config: Partial<TerminalConfig>) => void;
  setTheme: (themeId: string) => void;
  resetConfig: () => void;

  // 查询
  getCurrentTheme: () => TerminalTheme;
}

export const useTerminalConfigStore = create<TerminalConfigStore>()(
  persist(
    (set, get) => ({
      config: DEFAULT_TERMINAL_CONFIG,

      setConfig: (partialConfig) => {
        set((state) => ({
          config: { ...state.config, ...partialConfig },
        }));
      },

      setTheme: (themeId) => {
        set((state) => ({
          config: { ...state.config, themeId },
        }));
      },

      resetConfig: () => {
        set({ config: DEFAULT_TERMINAL_CONFIG });
      },

      getCurrentTheme: () => {
        const { config } = get();
        return TERMINAL_THEMES[config.themeId] || TERMINAL_THEMES['one-dark'];
      },
    }),
    {
      name: 'terminal-config',
    }
  )
);
