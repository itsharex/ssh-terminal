// 平台检测工具
let cachedPlatform: string | null = null;

export type Platform = 'android' | 'ios' | 'windows' | 'linux' | 'macos' | 'unknown';

/**
 * 获取当前平台
 */
export function getPlatform(): Platform {
  if (cachedPlatform) {
    return cachedPlatform as Platform;
  }

  try {
    // 尝试使用 Tauri 插件
    // @ts-ignore
    if (typeof window !== 'undefined' && window.__TAURI__) {
      // @ts-ignore
      const os = window.__TAURI__.os;
      if (os) {
        // 这里需要根据实际的 Tauri API 调整
        cachedPlatform = 'unknown'; // 默认值
        return cachedPlatform as Platform;
      }
    }
  } catch (error) {
    console.warn('Failed to detect platform via Tauri:', error);
  }

  // 回退到浏览器检测
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    if (/android/i.test(userAgent)) {
      cachedPlatform = 'android';
    } else if (/iPad|iPhone|iPod/.test(userAgent)) {
      cachedPlatform = 'ios';
    } else if (/Win/.test(userAgent)) {
      cachedPlatform = 'windows';
    } else if (/Mac/.test(userAgent)) {
      cachedPlatform = 'macos';
    } else if (/Linux/.test(userAgent)) {
      cachedPlatform = 'linux';
    } else {
      cachedPlatform = 'unknown';
    }
  } else {
    cachedPlatform = 'unknown';
  }

  return cachedPlatform as Platform;
}

/**
 * 检查是否为移动平台
 */
export function isMobile(): boolean {
  const platform = getPlatform();
  return platform === 'android' || platform === 'ios';
}

/**
 * 检查是否为桌面平台
 */
export function isDesktop(): boolean {
  const platform = getPlatform();
  return platform === 'windows' || platform === 'linux' || platform === 'macos';
}

/**
 * 检查是否为 Android 平台
 */
export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

/**
 * 检查是否为 iOS 平台
 */
export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

/**
 * 检查是否为 Windows 平台
 */
export function isWindows(): boolean {
  return getPlatform() === 'windows';
}

/**
 * 检查是否为 macOS 平台
 */
export function isMacOS(): boolean {
  return getPlatform() === 'macos';
}

/**
 * 检查是否为 Linux 平台
 */
export function isLinux(): boolean {
  return getPlatform() === 'linux';
}

/**
 * 获取平台相关信息
 */
export function getPlatformInfo() {
  return {
    platform: getPlatform(),
    isMobile: isMobile(),
    isDesktop: isDesktop(),
    isAndroid: isAndroid(),
    isIOS: isIOS(),
    isWindows: isWindows(),
    isMacOS: isMacOS(),
    isLinux: isLinux(),
  };
}