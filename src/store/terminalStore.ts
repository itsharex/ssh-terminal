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
    const removedTab = get().tabs.find((t) => t.id === tabId);
    const isActive = removedTab?.isActive;

    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId);

      // 如果移除的是活动标签页，激活最后一个标签页
      if (isActive && newTabs.length > 0) {
        newTabs[newTabs.length - 1].isActive = true;
      }

      return { tabs: newTabs };
    });

    // 检查该会话是否还有其他标签页
    if (removedTab) {
      const remainingTabs = get().getTabsBySession(removedTab.sessionId);
      if (remainingTabs.length === 0) {
        // 没有其他标签页了，触发断开连接事件
        // 通过自定义事件通知Terminal页面
        const event = new CustomEvent('tab-closed-for-session', {
          detail: { sessionId: removedTab.sessionId }
        });
        window.dispatchEvent(event);
      }
    }
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
