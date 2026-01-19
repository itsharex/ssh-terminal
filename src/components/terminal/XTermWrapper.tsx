import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

interface XTermWrapperProps {
  sessionId: string;
  onData?: (data: string) => void;
  onTitleChange?: (title: string) => void;
}

export function XTermWrapper({ sessionId, onData, onTitleChange }: XTermWrapperProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalRefInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!terminalRef.current || isInitializedRef.current) return;

    isInitializedRef.current = true;

    // 初始化终端
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(terminalRef.current);

    terminalRefInstance.current = terminal;
    fitAddonRef.current = fitAddon;

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

    const setupOutputListener = async () => {
      try {
        const eventName = `ssh-output-${sessionId}`;
        unlisten = await listen<number[]>(
          eventName,
          (event) => {
            if (terminal._core._renderService) {
              const data = new Uint8Array(event.payload);
              terminal.write(data);
            }
          }
        );
      } catch (error) {
        console.error('Failed to setup SSH output listener:', error);
      }
    };

    setupOutputListener();

    // 窗口大小调整
    const handleResize = () => {
      if (fitAddonRef.current && terminalRefInstance.current && terminalRefInstance.current._core) {
        fitAddonRef.current.fit();
        const { cols, rows } = terminalRefInstance.current;
        invoke('ssh_resize_pty', { sessionId, rows, cols }).catch(console.error);
      }
    };

    window.addEventListener('resize', handleResize);

    // 初始调整大小
    setTimeout(handleResize, 100);

    return () => {
      isInitializedRef.current = false;
      if (unlisten) {
        unlisten();
      }
      window.removeEventListener('resize', handleResize);
      if (terminalRefInstance.current) {
        terminalRefInstance.current.dispose();
        terminalRefInstance.current = null;
      }
      if (fitAddonRef.current) {
        fitAddonRef.current = null;
      }
    };
  }, [sessionId]);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full bg-background"
      style={{ padding: '8px' }}
    />
  );
}
