import { create } from 'zustand';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';

export interface TerminalTab {
  id: string;
  // 每个标签页对应一个 connectionId（SSH 连接实例的 ID）
  // 每个 connectionId 对应一个 SSH 连接实例和一个 sessionId（会话配置 ID）
  connectionId: string;
  title: string;
  isActive: boolean;
  isDirty: boolean;
}

interface TerminalInstance {
  terminal: Terminal;
  containerElement: HTMLElement | null;
  fitAddon?: FitAddon;
  searchAddon?: SearchAddon;
  webglAddon?: WebglAddon;
  onDataHandler?: (data: string) => void; // 存储当前的 onData 处理器
}

interface TerminalStore {
  tabs: TerminalTab[];
  // 存储每个 connectionId 对应的终端实例
  // 注意：虽然参数名是 sessionId，但实际存储的是 connectionId
  terminalInstances: Map<string, TerminalInstance>;

  // 标签页操作
  addTab: (connectionId: string, title: string) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  clearTabs: () => void;

  // 查询
  getActiveTab: () => TerminalTab | undefined;
  getTabsByConnection: (connectionId: string) => TerminalTab[];

  // 终端实例管理
  getTerminalInstance: (connectionId: string) => TerminalInstance | undefined;
  setTerminalInstance: (connectionId: string, instance: TerminalInstance) => void;
  removeTerminalInstance: (connectionId: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  terminalInstances: new Map(),

  addTab: (connectionId, title) => {
    const id = crypto.randomUUID();
    set((state) => ({
      tabs: [
        ...state.tabs.map((t) => ({ ...t, isActive: false })),
        {
          id,
          connectionId,
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

    // 检查该连接是否还有其他标签页
    if (removedTab) {
      const remainingTabs = get().getTabsByConnection(removedTab.connectionId);
      if (remainingTabs.length === 0) {
        // 没有其他标签页了，销毁终端实例并触发断开连接事件
        get().removeTerminalInstance(removedTab.connectionId);
        const event = new CustomEvent('tab-closed-for-session', {
          detail: { connectionId: removedTab.connectionId }
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

  getTabsByConnection: (connectionId) => {
    return get().tabs.filter((t) => t.connectionId === connectionId);
  },

  getTerminalInstance: (connectionId) => {
    return get().terminalInstances.get(connectionId);
  },

  setTerminalInstance: (connectionId, instance) => {
    const newInstances = new Map(get().terminalInstances);
    newInstances.set(connectionId, instance);
    set({ terminalInstances: newInstances });
  },

  removeTerminalInstance: (connectionId) => {
    const instance = get().terminalInstances.get(connectionId);
    if (instance) {
      try {
        // 销毁终端实例
        instance.terminal.dispose();
      } catch (e) {
        console.warn('[TerminalStore] Error disposing terminal:', e);
      }
      const newInstances = new Map(get().terminalInstances);
      newInstances.delete(connectionId);
      set({ terminalInstances: newInstances });
    }
  },
}));
