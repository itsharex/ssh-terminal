import { create } from 'zustand';

export interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
  isActive: boolean;
  isDirty: boolean;
}

interface TerminalStore {
  tabs: TerminalTab[];

  // 标签页操作
  addTab: (sessionId: string, title: string) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  clearTabs: () => void;

  // 查询
  getActiveTab: () => TerminalTab | undefined;
  getTabsBySession: (sessionId: string) => TerminalTab[];
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],

  addTab: (sessionId, title) => {
    const id = crypto.randomUUID();
    set((state) => ({
      tabs: [
        ...state.tabs.map((t) => ({ ...t, isActive: false })),
        {
          id,
          sessionId,
          title,
          isActive: true,
          isDirty: false,
        },
      ],
    }));
    return id;
  },

  removeTab: (tabId) => {
    const isActive = get().tabs.find((t) => t.id === tabId)?.isActive;
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId);

      // 如果移除的是活动标签页，激活最后一个标签页
      if (isActive && newTabs.length > 0) {
        newTabs[newTabs.length - 1].isActive = true;
      }

      return { tabs: newTabs };
    });
  },

  setActiveTab: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((t) => ({
        ...t,
        isActive: t.id === tabId,
      })),
    }));
  },

  updateTabTitle: (tabId, title) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
    }));
  },

  clearTabs: () => {
    set({ tabs: [] });
  },

  getActiveTab: () => {
    return get().tabs.find((t) => t.isActive);
  },

  getTabsBySession: (sessionId) => {
    return get().tabs.filter((t) => t.sessionId === sessionId);
  },
}));
