/**
 * AI 响应缓存和防抖工具
 */

// 简单的内存缓存
class ResponseCache {
  private cache = new Map<string, { data: string; timestamp: number }>();
  private ttl: number; // 缓存过期时间（毫秒）

  constructor(ttl: number = 30 * 60 * 1000) {
    // 默认 30 分钟
    this.ttl = ttl;
  }

  /**
   * 生成缓存键
   */
  private generateKey(type: string, input: string): string {
    // 简单的哈希函数
    let hash = 0;
    const str = `${type}:${input}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${type}_${Math.abs(hash)}`;
  }

  /**
   * 获取缓存
   */
  get(type: string, input: string): string | null {
    const key = this.generateKey(type, input);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * 设置缓存
   */
  set(type: string, input: string, data: string): void {
    const key = this.generateKey(type, input);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 清除过期缓存
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    this.clearExpired();
    return this.cache.size;
  }
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(this, args);
      timeout = null;
    }, wait);
  };
}

// 导出缓存实例（单例）
export const aiCache = new ResponseCache(30 * 60 * 1000); // 30 分钟 TTL

// 定期清理过期缓存（每 5 分钟）
if (typeof window !== 'undefined') {
  setInterval(() => {
    aiCache.clearExpired();
  }, 5 * 60 * 1000);
}
