import { useRef, useEffect } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeGestureOptions {
  threshold?: number; // 滑动阈值（像素）
  restraint?: number; // 约束（垂直/水平滑动比例）
  allowedTime?: number; // 允许的时间（毫秒）
}

export function useSwipeGesture(
  handlers: SwipeHandlers,
  options: SwipeGestureOptions = {}
) {
  const {
    threshold = 50,
    restraint = 100,
    allowedTime = 300,
  } = options;

  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      touchStartRef.current = {
        x: touch.pageX,
        y: touch.pageY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const { x: startX, y: startY, time: startTime } = touchStartRef.current;

      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > allowedTime) return;

      const distX = touch.pageX - startX;
      const distY = touch.pageY - startY;

      // 水平滑动
      if (Math.abs(distX) > Math.abs(distY)) {
        if (Math.abs(distX) > threshold && Math.abs(distY) < restraint) {
          if (distX > 0 && handlers.onSwipeRight) {
            handlers.onSwipeRight();
          } else if (distX < 0 && handlers.onSwipeLeft) {
            handlers.onSwipeLeft();
          }
        }
      }
      // 垂直滑动
      else {
        if (Math.abs(distY) > threshold && Math.abs(distX) < restraint) {
          if (distY > 0 && handlers.onSwipeDown) {
            handlers.onSwipeDown();
          } else if (distY < 0 && handlers.onSwipeUp) {
            handlers.onSwipeUp();
          }
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handlers, threshold, restraint, allowedTime]);

  return elementRef;
}
