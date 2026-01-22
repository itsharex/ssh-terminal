import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useTerminalConfigStore } from '@/store/terminalConfigStore';
import { useTerminalStore } from '@/store/terminalStore';
import { HostKeyConfirmDialog } from '@/components/ssh/HostKeyConfirmDialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import '@xterm/xterm/css/xterm.css';

interface XTermWrapperProps {
  // 每个终端标签页对应一个 connectionId（SSH 连接实例的 ID）和一个 sessionId（会话配置 ID）
  connectionId: string;
  onData?: (data: string) => void;
  onTitleChange?: (title: string) => void;
}

export function XTermWrapper({ connectionId, onData }: XTermWrapperProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalRefInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const isInitializedRef = useRef(false);
  const dialogShownRef = useRef(false);
  const unlistenRef = useRef<UnlistenFn | null>(null); // 保存 unlisten 函数
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDataHandlerRef = useRef<((data: string) => void) | null>(null); // 保存 onData 处理器引用
  const onDataPropRef = useRef(onData); // 保存 onData prop 的引用
  const [isReady, setIsReady] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [tempFontSize, setTempFontSize] = useState<number | null>(null);

  // 主机密钥确认对话框状态
  const [hostKeyDialog, setHostKeyDialog] = useState({
    open: false,
    host: '',
    fingerprint: '',
    keyType: '',
  });

  // 从 store 获取配置和终端实例
  const { config, getCurrentTheme } = useTerminalConfigStore();
  const { getTerminalInstance, setTerminalInstance } = useTerminalStore();
  const theme = getCurrentTheme();

  // 初始化终端（从 store 获取或创建）
  useEffect(() => {
    if (!terminalRef.current) return;

    const currentConnectionId = connectionId;

    // 检查 store 中是否已有该 connectionId 的终端实例
    const existingInstance = getTerminalInstance(currentConnectionId);
    
    // 如果已有实例，复用它（无论是否初始化过）
    if (existingInstance && existingInstance.terminal) {
      const terminal = existingInstance.terminal;
      terminalRefInstance.current = terminal;
      
      // 从 store 中获取 addon 引用
      if (existingInstance.fitAddon) {
        fitAddonRef.current = existingInstance.fitAddon;
      }
      if (existingInstance.searchAddon) {
        searchAddonRef.current = existingInstance.searchAddon;
      }
      if (existingInstance.webglAddon) {
        webglAddonRef.current = existingInstance.webglAddon;
      }
      
      // 检查终端是否已经绑定到 DOM
      const terminalElement = (terminal as unknown as { element?: HTMLElement }).element;
      const currentContainer = terminalRef.current;
      
      // 如果终端已经打开且绑定到不同的容器，需要移动 DOM（不调用 open，避免清空内容）
      if (terminalElement && terminalElement.parentNode !== currentContainer) {
        // 将终端元素移动到新容器（不调用 open，避免清空内容）
        currentContainer.innerHTML = '';
        currentContainer.appendChild(terminalElement);
        
        // 更新 store 中的容器引用
        setTerminalInstance(currentConnectionId, {
          ...existingInstance,
          containerElement: currentContainer,
        });
        
        // 重新调整大小
        if (existingInstance.fitAddon) {
          setTimeout(() => {
            existingInstance.fitAddon?.fit();
          }, 50);
        }
      } else if (!terminalElement) {
        // 终端未打开（这种情况不应该发生，但为了安全）
        console.warn('[XTermWrapper] Terminal instance exists but not opened, reopening...');
        currentContainer.innerHTML = '';
        terminal.open(currentContainer);
        
        // 更新 store 中的容器引用
        setTerminalInstance(currentConnectionId, {
          ...existingInstance,
          containerElement: currentContainer,
        });
      } else {
        // 终端已经绑定到正确的容器，只需要调整大小
        if (existingInstance.fitAddon) {
          setTimeout(() => {
            existingInstance.fitAddon?.fit();
          }, 50);
        }
      }
      
      // 重新设置事件监听器（确保使用正确的 connectionId）
      // 注意：xterm.js 的 onSelectionChange 和 onData 会替换之前的监听器
      terminal.onSelectionChange(() => {
        setHasSelection(terminal.hasSelection());
      });
      
      // 注意：onData 监听器会在单独的 useEffect 中统一设置（对所有实例），避免重复绑定
      
      setIsReady(true);
      isInitializedRef.current = true;
      
      // 注意：输出监听器和窗口大小调整会在后面统一设置（对所有实例）
    } else {
      // 创建新实例
      isInitializedRef.current = true;

      // 初始化终端
      const terminal = new Terminal({
      cursorBlink: config.cursorBlink,
      cursorStyle: config.cursorStyle,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      fontWeight: config.fontWeight,
      lineHeight: config.lineHeight,
      letterSpacing: config.letterSpacing,
      scrollback: config.scrollback,
      theme: {
        foreground: theme.foreground,
        background: theme.background,
        cursor: theme.cursor,
        cursorAccent: theme.cursorAccent,
        selectionBackground: theme.selectionBackground,
        black: theme.black,
        red: theme.red,
        green: theme.green,
        yellow: theme.yellow,
        blue: theme.blue,
        magenta: theme.magenta,
        cyan: theme.cyan,
        white: theme.white,
        brightBlack: theme.brightBlack,
        brightRed: theme.brightRed,
        brightGreen: theme.brightGreen,
        brightYellow: theme.brightYellow,
        brightBlue: theme.brightBlue,
        brightMagenta: theme.brightMagenta,
        brightCyan: theme.brightCyan,
        brightWhite: theme.brightWhite,
      },
      allowProposedApi: true,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(terminalRef.current);

    // 监听选中状态变化
    terminal.onSelectionChange(() => {
      setHasSelection(terminal.hasSelection());
    });

    // 加载搜索插件
    const searchAddon = new SearchAddon();
    terminal.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    // 尝试加载 WebGL 渲染器
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddonRef.current?.dispose();
        if (terminalRefInstance.current) {
          terminalRefInstance.current.loadAddon(new WebglAddon());
        }
      });
      terminal.loadAddon(webglAddon);
      webglAddonRef.current = webglAddon;
    } catch (e) {
      console.warn('WebGL addon failed to load, falling back to canvas renderer:', e);
    }

      terminalRefInstance.current = terminal;
      fitAddonRef.current = fitAddon;

      // 保存终端实例到 store（包括 addon 引用，使用 connectionId 作为键）
      setTerminalInstance(currentConnectionId, {
        terminal,
        containerElement: terminalRef.current,
        fitAddon,
        searchAddon,
        webglAddon: webglAddonRef.current || undefined,
      });

      // 标记终端已准备好
      setIsReady(true);
    }

    // 注意：onData 监听器和输出监听器会在单独的 useEffect 中统一设置，避免重复绑定

    // 窗口大小调整（防抖处理）
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        if (fitAddonRef.current && terminalRefInstance.current) {
          fitAddonRef.current.fit();
          const { cols, rows } = terminalRefInstance.current;
          // 后端 API 使用 connectionId
          invoke('ssh_resize_pty', { sessionId: currentConnectionId, rows, cols }).catch(console.error);
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    // 初始调整大小
    setTimeout(handleResize, 100);

    return () => {
      setIsReady(false);
      // 关键：不要重置 isInitializedRef，这样下次复用实例时不会重新初始化
      // isInitializedRef.current = false;

      // 清理定时器
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }

      // 注意：输出监听器会在独立的 useEffect 中清理，这里不需要清理
      window.removeEventListener('resize', handleResize);

      // 关键：不在这里销毁终端实例，也不调用 terminal.dispose()
      // 终端实例和 DOM 元素都保留，只是组件卸载
      // 只有当标签页被关闭时，store 才会销毁实例
      console.log(`[XTermWrapper] Cleanup complete for connection: ${currentConnectionId} (instance and DOM preserved)`);
    };
  }, [connectionId, config, theme, getTerminalInstance, setTerminalInstance]);

  // 动态更新主题和配置
  useEffect(() => {
    if (!terminalRefInstance.current || !isReady) return;

    const terminal = terminalRefInstance.current;

    // 更新终端主题
    terminal.options.theme = {
      foreground: theme.foreground,
      background: theme.background,
      cursor: theme.cursor,
      cursorAccent: theme.cursorAccent,
      selectionBackground: theme.selectionBackground,
      black: theme.black,
      red: theme.red,
      green: theme.green,
      yellow: theme.yellow,
      blue: theme.blue,
      magenta: theme.magenta,
      cyan: theme.cyan,
      white: theme.white,
      brightBlack: theme.brightBlack,
      brightRed: theme.brightRed,
      brightGreen: theme.brightGreen,
      brightYellow: theme.brightYellow,
      brightBlue: theme.brightBlue,
      brightMagenta: theme.brightMagenta,
      brightCyan: theme.brightCyan,
      brightWhite: theme.brightWhite,
    };

    // 更新其他配置
    terminal.options.cursorBlink = config.cursorBlink;
    terminal.options.cursorStyle = config.cursorStyle;
    terminal.options.fontSize = config.fontSize;
    terminal.options.fontFamily = config.fontFamily;
    terminal.options.fontWeight = config.fontWeight;
    terminal.options.lineHeight = config.lineHeight;
    terminal.options.letterSpacing = config.letterSpacing;

    // 刷新终端以应用更改
    try {
      terminal.refresh(0, terminal.rows - 1);
    } catch {
      // 忽略刷新错误，主题已通过 options 更新
    }
  }, [config, theme, isReady]);

  // 更新 onData prop 的引用
  useEffect(() => {
    onDataPropRef.current = onData;
  }, [onData]);

  // 单独设置 onData 监听器（统一处理新实例和复用实例，避免重复绑定）
  useEffect(() => {
    // 确保终端实例已准备好
    if (!isReady) return;

    // 从 store 中获取终端实例（确保使用正确的 connectionId）
    const instance = getTerminalInstance(connectionId);
    const terminal = instance?.terminal;
    if (!terminal) {
      console.warn(`[XTermWrapper] Terminal instance not found for connectionId: ${connectionId}`);
      return;
    }

    // 确保 terminalRefInstance.current 指向正确的实例
    terminalRefInstance.current = terminal;

    // 检查是否已经有 onData 处理器（避免重复绑定）
    // 如果已经有处理器且是当前组件设置的，就不需要重新设置
    if (instance.onDataHandler && instance.onDataHandler === onDataHandlerRef.current) {
      console.log(`[XTermWrapper] onData listener already set for connection: ${connectionId}, skipping...`);
      return;
    }

    // 创建新的 onData 处理器（每次 connectionId 变化时都更新，确保使用正确的 connectionId）
    const currentConnectionId = connectionId; // 捕获当前的 connectionId
    const onDataHandler = (data: string) => {
      // 确保当前终端实例匹配，并且 connectionId 没有变化
      const currentTerminal = terminalRefInstance.current;
      const currentInstance = getTerminalInstance(currentConnectionId);
      
      // 双重检查：确保终端实例和 connectionId 都匹配，并且处理器仍然有效
      if (currentTerminal === terminal && 
          currentInstance?.terminal === terminal &&
          currentInstance?.onDataHandler === onDataHandler) {
        console.log(`[XTermWrapper] Writing data to connection: ${currentConnectionId}, length: ${data.length}, data: ${JSON.stringify(data)}`);
        invoke('ssh_write', {
          sessionId: currentConnectionId, // 后端 API 参数名是 sessionId，但值是 connectionId
          data: new TextEncoder().encode(data),
        }).catch((error) => {
          console.error(`[XTermWrapper] Failed to write data to connection ${currentConnectionId}:`, error);
        });
        // 使用 ref 中的 onData，避免闭包问题
        onDataPropRef.current?.(data);
      } else {
        console.warn(`[XTermWrapper] Terminal instance or handler mismatch, ignoring data for connection: ${currentConnectionId}`);
      }
    };
    
    // 保存处理器引用，并设置监听器（xterm.js 的 onData 会替换之前的监听器）
    onDataHandlerRef.current = onDataHandler;
    terminal.onData(onDataHandler);
    
    // 将处理器保存到 store 中，以便其他组件可以检查
    setTerminalInstance(connectionId, {
      ...instance,
      onDataHandler: onDataHandler,
    });
    
    console.log(`[XTermWrapper] onData listener set for connection: ${connectionId}`);

    // cleanup: 注意不清除监听器，因为终端实例仍然存在
    // 只有当标签页被关闭时，store 才会销毁实例
    return () => {
      // 不在这里清除 onData，因为终端实例仍然存在
      // xterm.js 的 onData 会替换之前的监听器，所以不会有重复
      console.log(`[XTermWrapper] onData listener cleanup for connection: ${connectionId}`);
    };
  }, [connectionId, isReady, getTerminalInstance, setTerminalInstance]); // 添加 setTerminalInstance 依赖

  // 单独设置 SSH 输出监听器（统一处理新实例和复用实例，避免重复绑定）
  useEffect(() => {
    if (!isReady) return;

    const currentConnectionId = connectionId;
    let outputBuffer = '';
    let dialogShown = false; // 防止重复弹出对话框
    
    // 从 store 中获取终端实例（确保使用正确的 connectionId）
    const instance = getTerminalInstance(currentConnectionId);
    const currentTerminal = instance?.terminal;
    if (!currentTerminal) {
      console.warn(`[XTermWrapper] Terminal instance not found for connectionId: ${currentConnectionId}`);
      return;
    }

    // 确保 terminalRefInstance.current 指向正确的实例
    terminalRefInstance.current = currentTerminal;

    const setupOutputListener = async () => {
      try {
        // 先清理旧的监听器（如果存在）
        if (unlistenRef.current) {
          console.log(`[XTermWrapper] Cleaning up old listener for: ${currentConnectionId}`);
          unlistenRef.current();
          unlistenRef.current = null;
        }

        // 后端事件使用 connectionId 作为标识符：ssh-output-{connectionId}
        const eventName = `ssh-output-${currentConnectionId}`;
        console.log(`[XTermWrapper] Setting up listener for event: ${eventName}`);
        const unlisten = await listen<number[]>(
          eventName,
          (event) => {
            const data = new Uint8Array(event.payload);
            const text = new TextDecoder().decode(data);
            console.log(`[XTermWrapper] Received ${data.length} bytes for ${currentConnectionId}: ${text.substring(0, 50)}...`);

            // 写入终端（确保使用正确的终端实例和 connectionId）
            const instance = getTerminalInstance(currentConnectionId);
            const terminal = instance?.terminal;
            if (terminal === currentTerminal && terminal) {
              terminal.write(data);
            } else {
              console.warn(`[XTermWrapper] Terminal instance mismatch, ignoring output for ${currentConnectionId}`);
            }

            // 更新缓冲区用于检测
            outputBuffer += text;
            if (outputBuffer.length > 2000) {
              outputBuffer = outputBuffer.slice(-2000);
            }

            // 检测主机密钥确认提示（使用缓冲区检测）
            if (!dialogShown && outputBuffer.includes("The authenticity of host") && outputBuffer.includes("can't be established")) {
              // 提取主机信息
              const hostMatch = outputBuffer.match(/The authenticity of host '([^']+)'/);
              const fingerprintMatch = outputBuffer.match(/fingerprint is (SHA256:[^\s]+)/);
              const keyTypeMatch = outputBuffer.match(/(ED25519|RSA|ECDSA) key fingerprint/);

              if (hostMatch && fingerprintMatch && keyTypeMatch) {
                dialogShown = true;
                setHostKeyDialog({
                  open: true,
                  host: hostMatch[1],
                  fingerprint: fingerprintMatch[1],
                  keyType: keyTypeMatch[1],
                });
                dialogShownRef.current = true;
              }
            }
          }
        );
        // 保存到 ref 中，确保 cleanup 可以访问
        unlistenRef.current = unlisten;
        console.log(`[XTermWrapper] Listener setup complete for: ${eventName}`);
      } catch (error) {
        console.error('[XTermWrapper] Failed to setup SSH output listener:', error);
      }
    };

    setupOutputListener();

    // cleanup: 清理监听器
    return () => {
      if (unlistenRef.current) {
        console.log(`[XTermWrapper] Cleaning up listener for: ${currentConnectionId}`);
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [connectionId, isReady, getTerminalInstance]);

  // 处理复制操作
  const handleCopy = async () => {
    if (terminalRefInstance.current && terminalRefInstance.current.hasSelection()) {
      const selection = terminalRefInstance.current.getSelection();
      try {
        await navigator.clipboard.writeText(selection);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  // 处理粘贴操作
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && terminalRefInstance.current) {
        await invoke('ssh_write', {
          sessionId: connectionId, // 后端 API 参数名是 sessionId，但值是 connectionId
          data: new TextEncoder().encode(text),
        });
        onData?.(text);
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  // 清屏功能
  const handleClear = () => {
    if (terminalRefInstance.current) {
      terminalRefInstance.current.clear();
    }
  };

  // 重置终端功能
  const handleReset = () => {
    if (terminalRefInstance.current) {
      terminalRefInstance.current.reset();
    }
  };

  // 增大字号
  const handleZoomIn = () => {
    if (terminalRefInstance.current) {
      const currentSize = tempFontSize || config.fontSize;
      const newSize = Math.min(currentSize + 2, 32);
      setTempFontSize(newSize);
      terminalRefInstance.current.options.fontSize = newSize;
    }
  };

  // 减小字号
  const handleZoomOut = () => {
    if (terminalRefInstance.current) {
      const currentSize = tempFontSize || config.fontSize;
      const newSize = Math.max(currentSize - 2, 8);
      setTempFontSize(newSize);
      terminalRefInstance.current.options.fontSize = newSize;
    }
  };

  // 查找功能
  const handleFind = () => {
    if (searchAddonRef.current) {
      const searchTerm = prompt('请输入要查找的文本:');
      if (searchTerm) {
        searchAddonRef.current.findNext(searchTerm);
      }
    }
  };

  // 重启会话功能
  const handleRestartSession = async () => {
    try {
      // 先断开连接（使用 connectionId）
      await invoke('ssh_disconnect', { sessionId: connectionId }); // 后端 API 参数名是 sessionId，但值是 connectionId
      // 短暂延迟后重新连接
      // 注意：重新连接需要使用原始的 sessionId（会话配置 ID），而不是 connectionId
      // 这里需要从 session store 中获取对应的 sessionId
      setTimeout(async () => {
        // TODO: 需要从 session store 获取对应的 sessionId（会话配置 ID）
        // 当前实现假设使用 connectionId，可能需要调整
        await invoke('ssh_connect', { sessionId: connectionId });
      }, 500);
    } catch (err) {
      console.error('Failed to restart session:', err);
    }
  };

  // 导出日志功能
  const handleExportLog = async () => {
    if (terminalRefInstance.current) {
      try {
        const lines: string[] = [];
        for (let i = 0; i < terminalRefInstance.current.buffer.active.length; i++) {
          const line = terminalRefInstance.current.buffer.active.getLine(i);
          if (line) {
            lines.push(line.translateToString(true));
          }
        }
        const content = lines.join('\n');

        // 使用 Tauri 的文件对话框 API
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const filePath = await save({
          filters: [
            {
              name: 'Log Files',
              extensions: ['log', 'txt']
            }
          ],
          defaultPath: `terminal-log-${new Date().toISOString().slice(0, 10)}.log`
        });

        if (filePath) {
          await writeTextFile(filePath, content);
        }
      } catch (err) {
        console.error('Failed to export log:', err);
        // 如果 Tauri API 不可用，回退到浏览器方式
        try {
          const lines: string[] = [];
          for (let i = 0; i < terminalRefInstance.current.buffer.active.length; i++) {
            const line = terminalRefInstance.current.buffer.active.getLine(i);
            if (line) {
              lines.push(line.translateToString(true));
            }
          }
          const content = lines.join('\n');
          const blob = new Blob([content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `terminal-log-${new Date().toISOString().slice(0, 10)}.log`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (fallbackErr) {
          console.error('Fallback export also failed:', fallbackErr);
        }
      }
    }
  };

  // 使用动态样式，支持 padding
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={terminalRef}
            className="w-full h-full"
            style={{
              padding: `${config.padding}px`,
            }}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled={!hasSelection} onClick={handleCopy}>
            复制
          </ContextMenuItem>
          <ContextMenuItem onClick={handlePaste}>
            粘贴
          </ContextMenuItem>
          <ContextMenuItem onClick={handleFind}>
            查找...
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={handleClear}>
            清屏
          </ContextMenuItem>
          <ContextMenuItem onClick={handleReset}>
            重置终端
          </ContextMenuItem>
          <ContextMenuItem onClick={handleZoomIn}>
            放大
          </ContextMenuItem>
          <ContextMenuItem onClick={handleZoomOut}>
            缩小
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={handleRestartSession}>
            重启会话
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={handleExportLog}>
            导出日志
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 主机密钥确认对话框 */}
      <HostKeyConfirmDialog
        open={hostKeyDialog.open}
        onOpenChange={(open) => setHostKeyDialog({ ...hostKeyDialog, open })}
        host={hostKeyDialog.host}
        fingerprint={hostKeyDialog.fingerprint}
        keyType={hostKeyDialog.keyType}
        onConfirm={async () => {
          // 发送 "yes" 命令
          await invoke('ssh_write', {
            sessionId: connectionId, // 后端 API 参数名是 sessionId，但值是 connectionId
            data: new TextEncoder().encode('yes\n'),
          });
          setHostKeyDialog({ ...hostKeyDialog, open: false });
          // 重置标志，允许下次连接时再次检测
          dialogShownRef.current = false;
        }}
        onCancel={() => {
          setHostKeyDialog({ ...hostKeyDialog, open: false });
          // 重置标志
          dialogShownRef.current = false;
        }}
      />
    </>
  );
}
