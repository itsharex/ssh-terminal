/**
 * 音效管理器
 * 提供操作反馈音效播放功能
 */

export enum SoundEffect {
  // 连接相关
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CONNECT_ERROR = 'connect_error',

  // 操作相关
  TAB_OPEN = 'tab_open',
  TAB_CLOSE = 'tab_close',
  TAB_SWITCH = 'tab_switch',

  // 复制相关
  COPY = 'copy',
  PASTE = 'paste',

  // UI 交互
  BUTTON_CLICK = 'button_click',
  TOGGLE_SWITCH = 'toggle_switch',
  SUCCESS = 'success',
  ERROR = 'error',
}

class SoundManager {
  private enabled: boolean = false;
  private audioContext: AudioContext | null = null;

  constructor() {
    // 从 localStorage 读取音效设置
    const saved = localStorage.getItem('sound-effects-enabled');
    this.enabled = saved === 'true';
  }

  /**
   * 初始化音频上下文
   */
  private initAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * 生成简单的蜂鸣音（使用 Web Audio API）
   */
  private playTone(frequency: number, duration: number, volume: number = 0.3): void {
    if (!this.enabled || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.error('Error playing tone:', error);
    }
  }

  /**
   * 播放指定音效
   */
  play(effect: SoundEffect): void {
    if (!this.enabled) return;

    this.initAudioContext();

    // 恢复 AudioContext（如果被暂停）
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    switch (effect) {
      // 连接相关音效
      case SoundEffect.CONNECT:
        // 成功的三声上升音
        setTimeout(() => this.playTone(523.25, 0.1, 0.2), 0);
        setTimeout(() => this.playTone(659.25, 0.1, 0.2), 100);
        setTimeout(() => this.playTone(783.99, 0.15, 0.2), 200);
        break;

      case SoundEffect.DISCONNECT:
        // 下降音
        this.playTone(440, 0.2, 0.2);
        setTimeout(() => this.playTone(330, 0.2, 0.15), 100);
        break;

      case SoundEffect.CONNECT_ERROR:
        // 错误的低频音
        this.playTone(200, 0.3, 0.3);
        setTimeout(() => this.playTone(150, 0.3, 0.2), 150);
        break;

      // 操作相关音效
      case SoundEffect.TAB_OPEN:
        // 清脆的高音
        this.playTone(880, 0.05, 0.15);
        break;

      case SoundEffect.TAB_CLOSE:
        // 短促的中音
        this.playTone(660, 0.05, 0.15);
        break;

      case SoundEffect.TAB_SWITCH:
        // 轻微的点击声
        this.playTone(1000, 0.03, 0.1);
        break;

      // 复制相关音效
      case SoundEffect.COPY:
        // 确认音
        this.playTone(1046.50, 0.08, 0.2);
        break;

      case SoundEffect.PASTE:
        // 较低的确认音
        this.playTone(783.99, 0.08, 0.2);
        break;

      // UI 交互音效
      case SoundEffect.BUTTON_CLICK:
        // 轻微的点击声
        this.playTone(1200, 0.03, 0.1);
        break;

      case SoundEffect.TOGGLE_SWITCH:
        // 切换音
        this.playTone(900, 0.04, 0.12);
        break;

      case SoundEffect.SUCCESS:
        // 成功的和弦
        this.playTone(523.25, 0.1, 0.15);
        setTimeout(() => this.playTone(659.25, 0.1, 0.15), 80);
        setTimeout(() => this.playTone(783.99, 0.15, 0.15), 160);
        break;

      case SoundEffect.ERROR:
        // 错误音
        this.playTone(200, 0.2, 0.25);
        setTimeout(() => this.playTone(180, 0.2, 0.2), 100);
        setTimeout(() => this.playTone(160, 0.2, 0.15), 200);
        break;
    }
  }

  /**
   * 启用音效
   */
  enable(): void {
    this.enabled = true;
    localStorage.setItem('sound-effects-enabled', 'true');
    this.initAudioContext();

    // 播放启用确认音
    this.play(SoundEffect.SUCCESS);
  }

  /**
   * 禁用音效
   */
  disable(): void {
    this.enabled = false;
    localStorage.setItem('sound-effects-enabled', 'false');
  }

  /**
   * 切换音效状态
   */
  toggle(): boolean {
    if (this.enabled) {
      this.disable();
      return false;
    } else {
      this.enable();
      return true;
    }
  }

  /**
   * 检查音效是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 设置音效状态
   */
  setEnabled(enabled: boolean): void {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
}

// 导出单例
export const soundManager = new SoundManager();

// 便捷函数
export const playSound = (effect: SoundEffect) => {
  soundManager.play(effect);
};
