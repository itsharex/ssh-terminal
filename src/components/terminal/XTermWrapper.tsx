import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useTerminalConfigStore } from '@/store/terminalConfigStore';
import { HostKeyConfirmDialog } from '@/components/ssh/HostKeyConfirmDialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuLabel, ContextMenuSeparator } from '@/components/ui/context-menu';
import '@xterm/xterm/css/xterm.css';

interface XTermWrapperProps {
  sessionId: string;
  onData?: (data: string) => void;
  onTitleChange?: (title: string) => void;
}

export function XTermWrapper({ sessionId, onData }: XTermWrapperProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalRefInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const isInitializedRef = useRef(false);
  const dialogShownRef = useRef(false);
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

  // 从 store 获取配置
  const { config, getCurrentTheme } = useTerminalConfigStore();
  const theme = getCurrentTheme();

  // 初始化终端（只执行一次）
  useEffect(() => {
    if (!terminalRef.current || isInitializedRef.current) return;

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

    // 标记终端已准备好
    setIsReady(true);

    // 处理用户输入
    terminal.onData((data) => {
      invoke('ssh_write', {
        sessionId,
        data: new TextEncoder().encode(data),
      });
      onData?.(data);
    });

    // 监听来自Rust的SSH输出
    let unlisten: UnlistenFn | null = null;
    let outputBuffer = '';
    let dialogShown = false; // 防止重复弹出对话框

    const setupOutputListener = async () => {
      try {
        const eventName = `ssh-output-${sessionId}`;
        unlisten = await listen<number[]>(
          eventName,
          (event) => {
            const data = new Uint8Array(event.payload);
            const text = new TextDecoder().decode(data);

            // 写入终端
            terminal.write(data);

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
      } catch (error) {
        console.error('Failed to setup SSH output listener:', error);
      }
    };

    setupOutputListener();

    // 窗口大小调整（防抖处理）
    let resizeTimer: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (fitAddonRef.current && terminalRefInstance.current) {
          fitAddonRef.current.fit();
          const { cols, rows } = terminalRefInstance.current;
          invoke('ssh_resize_pty', { sessionId, rows, cols }).catch(console.error);
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    // 初始调整大小
    setTimeout(handleResize, 100);

    return () => {
      setIsReady(false);
      isInitializedRef.current = false;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (unlisten) {
        unlisten();
      }
      window.removeEventListener('resize', handleResize);
      if (webglAddonRef.current) {
        webglAddonRef.current.dispose();
        webglAddonRef.current = null;
      }
      if (terminalRefInstance.current) {
        terminalRefInstance.current.dispose();
        terminalRefInstance.current = null;
      }
      if (fitAddonRef.current) {
        fitAddonRef.current = null;
      }
    };
  }, [sessionId]);

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
    } catch (e) {
      // 忽略刷新错误，主题已通过 options 更新
    }
  }, [config, theme, isReady]);

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
          sessionId,
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
      // 先断开连接
      await invoke('ssh_disconnect', { sessionId });
      // 短暂延迟后重新连接
      setTimeout(async () => {
        await invoke('ssh_connect', { sessionId });
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
        const { join } = await import('@tauri-apps/api/path');

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
            sessionId,
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
