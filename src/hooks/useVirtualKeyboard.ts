import { useState, useEffect } from 'react';

interface VirtualKeyboardState {
  isOpen: boolean;
  height: number;
  viewportHeight: number;
}

export function useVirtualKeyboard() {
  const [keyboard, setKeyboard] = useState<VirtualKeyboardState>({
    isOpen: false,
    height: 0,
    viewportHeight: window.innerHeight,
  });

  useEffect(() => {
    // 检查是否支持VisualViewport API
    if (!('visualViewport' in window) || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;

    const handleResize = () => {
      const currentHeight = viewport.height;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - currentHeight;
      const isOpen = keyboardHeight > 150; // 阈值，避免误判

      setKeyboard({
        isOpen,
        height: isOpen ? keyboardHeight : 0,
        viewportHeight: currentHeight,
      });
    };

    // 监听visualViewport变化
    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);

    // 初始化
    handleResize();

    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, []);

  return keyboard;
}
