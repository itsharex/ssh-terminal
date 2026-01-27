/**
 * 视频录制器
 * 在录制终端会话的同时，后台同步录制视频
 */

import '@xterm/xterm/css/xterm.css';
import type { TerminalConfig } from '@/types/terminal';
import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { TERMINAL_THEMES } from '@/config/themes';
import { AudioCaptureManager } from '@/lib/audio/AudioCaptureManager';

export class VideoRecorder {
  private terminal: Terminal | null = null;
  private webglAddon: WebglAddon | null = null;
  private container: HTMLElement | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  private videoQuality: 'low' | 'medium' | 'high' = 'medium';
  private videoFormat: 'webm' | 'mp4' = 'webm';

  // 音频录制相关
  private audioCaptureManager: AudioCaptureManager | null = null;
  private recordMicrophone: boolean = false;
  private recordSpeaker: boolean = false;
  private audioQuality: 'low' | 'medium' | 'high' = 'medium';
  private audioSampleRate: number = 48000;

  constructor() {
    // 创建隐藏的容器
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.left = '0';
    this.container.style.top = '0';
    this.container.style.zIndex = '-9999';
    this.container.style.opacity = '0';
    this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }

  /**
   * 初始化视频录制
   */
  async initialize(
    _sessionName: string,
    terminalSize: { cols: number; rows: number },
    terminalConfig?: TerminalConfig
  ): Promise<void> {

    // 保存视频质量和格式设置
    this.videoQuality = terminalConfig?.videoQuality || 'medium';
    this.videoFormat = terminalConfig?.videoFormat || 'webm';

    // 保存音频配置
    this.recordMicrophone = terminalConfig?.recordMicrophone || false;
    this.recordSpeaker = terminalConfig?.recordSpeaker || false;
    this.audioQuality = terminalConfig?.audioQuality || 'medium';
    this.audioSampleRate = terminalConfig?.audioSampleRate || 48000;

    // 初始化音频捕获管理器
    if (this.recordMicrophone || this.recordSpeaker) {
      try {
        this.audioCaptureManager = new AudioCaptureManager();
        await this.audioCaptureManager.initialize(
          this.recordMicrophone,
          this.recordSpeaker,
          this.audioQuality,
          this.audioSampleRate
        );
        console.log('[VideoRecorder] Audio capture initialized');
      } catch (error) {
        console.error('[VideoRecorder] Failed to initialize audio capture:', error);
        // 音频初始化失败不影响视频录制
        this.audioCaptureManager = null;
      }
    }

    // 创建 xterm.js 实例
    const fontSize = terminalConfig?.fontSize || 14;
    const fontFamily = terminalConfig?.fontFamily || 'Consolas, "Courier New", monospace';
    const fontWeight = terminalConfig?.fontWeight || 400;
    const lineHeight = terminalConfig?.lineHeight || 1.0;
    const letterSpacing = terminalConfig?.letterSpacing || 0;
    const cursorBlink = terminalConfig?.cursorBlink || false;
    const cursorStyle = terminalConfig?.cursorStyle || 'block';

    // 从主题 ID 获取完整的主题配置
    let theme: { [key: string]: string } = {
      background: '#1e1e1e',
      foreground: '#ffffff',
      cursor: '#ffffff',
    };

    if (terminalConfig?.themeId) {
      const themeData = TERMINAL_THEMES[terminalConfig.themeId];
      if (themeData) {
        theme = {
          background: themeData.background,
          foreground: themeData.foreground,
          cursor: themeData.cursor,
          selectionBackground: themeData.selectionBackground,
          black: themeData.black,
          red: themeData.red,
          green: themeData.green,
          yellow: themeData.yellow,
          blue: themeData.blue,
          magenta: themeData.magenta,
          cyan: themeData.cyan,
          white: themeData.white,
          brightBlack: themeData.brightBlack,
          brightRed: themeData.brightRed,
          brightGreen: themeData.brightGreen,
          brightYellow: themeData.brightYellow,
          brightBlue: themeData.brightBlue,
          brightMagenta: themeData.brightMagenta,
          brightCyan: themeData.brightCyan,
          brightWhite: themeData.brightWhite,
        };
      }
    }

    this.terminal = new Terminal({
      cursorBlink,
      cursorStyle,
      fontSize,
      fontFamily,
      fontWeight,
      lineHeight,
      letterSpacing,
      theme,
      rows: terminalSize.rows || 24,
      cols: terminalSize.cols || 80,
      allowProposedApi: true,
    });

    // 打开终端
    if (!this.container) {
      throw new Error('Container not initialized');
    }
    this.terminal.open(this.container);

    // 启用 WebGL 渲染器
    try {
      this.webglAddon = new WebglAddon();
      this.terminal.loadAddon(this.webglAddon);
    } catch (e) {
      console.warn('[VideoRecorder] Failed to enable WebGL renderer:', e);
    }

    // 等待 Canvas 渲染并确保其尺寸稳定
    await new Promise<void>((resolve) => {
      let lastWidth = 0;
      let lastHeight = 0;
      let stableCount = 0;
      const maxStableCount = 3; // 需要连续3次检查尺寸都相同才认为稳定

      const checkCanvas = () => {
        const canvasElement = this.container?.querySelector('canvas:not(.xterm-link-layer)') as HTMLCanvasElement;

        if (!canvasElement) {
          setTimeout(checkCanvas, 50);
          return;
        }

        const currentWidth = canvasElement.width;
        const currentHeight = canvasElement.height;

        // 检查Canvas尺寸是否稳定
        if (currentWidth === lastWidth && currentHeight === lastHeight) {
          stableCount++;
          if (stableCount >= maxStableCount) {
            console.log('[VideoRecorder] Canvas stabilized at', currentWidth, 'x', currentHeight);
            resolve();
            return;
          }
        } else {
          stableCount = 0;
          lastWidth = currentWidth;
          lastHeight = currentHeight;
        }

        setTimeout(checkCanvas, 50);
      };
      checkCanvas();
    });

    // 设置 MediaRecorder
    const canvasElement = this.container?.querySelector('canvas:not(.xterm-link-layer)') as HTMLCanvasElement;
    if (!canvasElement) {
      throw new Error('Failed to get canvas element');
    }

    // 根据质量设置比特率
    const bitrates = {
      low: 500000,    // 500 kbps
      medium: 2000000, // 2 Mbps
      high: 5000000,   // 5 Mbps
    };
    const bitrate = bitrates[this.videoQuality] || bitrates.medium;

    // 根据格式选择 mimeType
    const getMimeType = (): string => {
      if (this.videoFormat === 'mp4') {
        // MP4 格式（浏览器支持有限）
        const mp4H264 = 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"';
        const mp4 = 'video/mp4';
        if (MediaRecorder.isTypeSupported(mp4H264)) {
          return mp4H264;
        } else if (MediaRecorder.isTypeSupported(mp4)) {
          return mp4;
        } else {
          console.warn('[VideoRecorder] MP4 not supported, falling back to WebM');
          return 'video/webm;codecs=vp9';
        }
      } else {
        // WebM 格式（默认，支持最好）
        const webmVp9 = 'video/webm;codecs=vp9';
        const webmVp8 = 'video/webm;codecs=vp8';
        const webm = 'video/webm';

        if (MediaRecorder.isTypeSupported(webmVp9)) {
          return webmVp9;
        } else if (MediaRecorder.isTypeSupported(webmVp8)) {
          return webmVp8;
        } else if (MediaRecorder.isTypeSupported(webm)) {
          return webm;
        } else {
          console.warn('[VideoRecorder] WebM not supported, using default format');
          return '';
        }
      }
    };

    const mimeType = getMimeType();

    // 获取视频流
    const canvasStream = canvasElement.captureStream(30); // 30 FPS

    // 获取音频流并合并
    let finalStream: MediaStream;
    const audioStream = this.audioCaptureManager?.getAudioStream();

    if (audioStream && audioStream.getAudioTracks().length > 0) {
      // 合并视频和音频轨道
      const videoTracks = canvasStream.getVideoTracks();
      const audioTracks = audioStream.getAudioTracks();
      finalStream = new MediaStream([...videoTracks, ...audioTracks]);
      console.log('[VideoRecorder] Audio tracks added to stream:', audioTracks.length, 'track(s)');
    } else {
      // 只有视频
      finalStream = canvasStream;
      console.log('[VideoRecorder] No audio tracks, video only');
    }

    // 获取音频比特率
    const audioBitrate = this.audioCaptureManager?.getAudioBitrate() || 128000;

    this.mediaRecorder = new MediaRecorder(finalStream, {
      mimeType,
      videoBitsPerSecond: bitrate,
      audioBitsPerSecond: audioBitrate,
    });

    // 设置数据收集
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    // 打印录制配置信息
    const bitrateLabels: Record<string, string> = {
      low: '500 Kbps',
      medium: '2 Mbps',
      high: '5 Mbps',
    };

    const audioBitrateLabels: Record<string, string> = {
      low: '64 Kbps',
      medium: '128 Kbps',
      high: '256 Kbps',
    };

    const hasAudio = audioStream && audioStream.getAudioTracks().length > 0;

    console.log(
      `[VideoRecorder] 录制配置 - ` +
      `格式: ${this.videoFormat.toUpperCase()}, ` +
      `MIME: ${mimeType}, ` +
      `视频质量: ${this.videoQuality} (${bitrateLabels[this.videoQuality]}), ` +
      `音频: ${hasAudio ? '启用' : '禁用'}${hasAudio ? ` (${this.audioQuality} - ${audioBitrateLabels[this.audioQuality]})` : ''}`
    );
  }

  /**
   * 开始录制视频
   */
  async start(): Promise<void> {
    if (!this.mediaRecorder || this.isRecording) {
      return;
    }

    // 额外等待200ms确保Canvas完全渲染
    await new Promise(resolve => setTimeout(resolve, 200));

    this.recordedChunks = [];
    this.mediaRecorder.start(100); // 每 100ms 生成一个数据块
    this.isRecording = true;
    console.log('[VideoRecorder] Recording started');
  }

  /**
   * 写入数据到终端（同时显示在后台终端）
   */
  write(data: string | Uint8Array): void {
    if (this.terminal) {
      this.terminal.write(data);
    }
  }

  /**
   * 调整终端大小
   */
  resize(cols: number, rows: number): void {
    if (this.terminal) {
      this.terminal.resize(cols, rows);
    }
  }

  /**
   * 停止录制并获取视频 Blob
   */
  async stop(): Promise<Blob | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      return null;
    }

    return new Promise<Blob | null>((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        // 使用与录制时相同的 MIME 类型
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder!.mimeType || 'video/webm' });
        console.log('[VideoRecorder] Stopped. Blob size:', blob.size, 'bytes', 'type:', blob.type);
        this.recordedChunks = [];
        this.isRecording = false;
        resolve(blob);
      };

      // 停止录制
      this.mediaRecorder.stop();
    });
  }

  /**
   * 销毁
   */
  dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    // 清理音频捕获资源
    if (this.audioCaptureManager) {
      this.audioCaptureManager.dispose();
      this.audioCaptureManager = null;
      console.log('[VideoRecorder] Audio capture disposed');
    }

    if (this.webglAddon) {
      this.webglAddon.dispose();
    }

    if (this.terminal) {
      this.terminal.dispose();
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.terminal = null;
    this.webglAddon = null;
    this.mediaRecorder = null;
    this.container = null;
  }
}
