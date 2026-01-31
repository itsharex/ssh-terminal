/**
 * 音频捕获管理器
 * 负责麦克风和系统音频的捕获、混合和处理
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export class AudioCaptureManager {
  private microphoneStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private destinationStream: MediaStream | null = null;
  private isInitialized: boolean = false;

  // 音频配置
  private _recordMicrophone: boolean = false;
  private _recordSpeaker: boolean = false;
  private audioQuality: 'low' | 'medium' | 'high' = 'medium';
  private sampleRate: number = 48000;

  // 扬声器捕获状态
  private speakerCapturingActive: boolean = false;
  private speakerWorkletNode: AudioWorkletNode | null = null;
  private speakerUnlisten: (() => void) | null = null;

  // 性能监控
  private lastAudioPacketTime: number = 0;
  private audioPacketCount: number = 0;
  private audioPacketHealthCheckInterval: number | null = null;

  /**
   * 初始化音频捕获管理器
   */
  async initialize(
    recordMicrophone: boolean,
    recordSpeaker: boolean,
    audioQuality: 'low' | 'medium' | 'high',
    sampleRate: number
  ): Promise<void> {
    this._recordMicrophone = recordMicrophone;
    this._recordSpeaker = recordSpeaker;
    this.audioQuality = audioQuality;
    this.sampleRate = sampleRate;

    // 如果两种音频都关闭，直接返回
    if (!recordMicrophone && !recordSpeaker) {
      console.log('[AudioCapture] Audio recording disabled');
      return;
    }

    try {
      // 创建 AudioContext
      this.audioContext = new AudioContext({
        sampleRate: this.sampleRate,
      });

      // 获取麦克风流 (如果启用)
      if (this._recordMicrophone) {
        await this.initializeMicrophone();
      }

      // 初始化扬声器捕获 (使用 Tauri 后端)
      if (this._recordSpeaker) {
        await this.initializeSpeaker();
      }

      this.isInitialized = true;
      console.log('[AudioCapture] Initialized successfully', {
        microphone: recordMicrophone,
        speaker: recordSpeaker,
        quality: audioQuality,
        sampleRate,
      });
    } catch (error) {
      console.error('[AudioCapture] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * 初始化麦克风捕获
   */
  private async initializeMicrophone(): Promise<void> {
    try {
      console.log('[AudioCapture] Requesting microphone access...');

      // 首先枚举所有音频输入设备，找到真正的麦克风设备
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');

      console.log('[AudioCapture] Found', audioInputs.length, 'audio input devices:');
      audioInputs.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.label} (ID: ${device.deviceId})`);
      });

      // 扩展的系统音频混音设备关键词列表
      // 这些设备会捕获系统输出音频，而不是麦克风输入
      const systemAudioKeywords = [
        // 英文关键词
        'stereo mix',
        'stereomix',
        'wave out mix',
        'waveout',
        'loopback',
        'what you hear',
        'what u hear',
        'recording playback',
        'mixed output',
        'virtual audio',
        'vb-audio',
        'voicemeeter',
        'audio repeater',
        'cable output',
        'cable input',
        // 中文关键词
        '立体声混音',
        '混音',
        '录制混音',
        '虚拟音频',
        '立体声',
        '输出混音',
        // 德语、法语等其他语言
        'stereomischpult',
        'mixage stéréo',
        // 品牌特定的虚拟音频设备
        'audiorelay',
        'soundflower',
        'blackhole',
        'loopback',
        'audio bus',
      ];

      // 明确的麦克风设备关键词（高优先级）
      const microphoneKeywords = [
        'microphone',
        'mic',
        '麦克风',
        '内置麦克风',
        '外置麦克风',
        'internal mic',
        'external mic',
        'realtek high definition audio', // 常见的物理麦克风设备
        'realtek usb audio',
        'usb audio device',
      ];

      // 第一步：识别并排除所有系统音频混音设备
      const validMicrophoneDevices = audioInputs.filter(device => {
        const labelLower = device.label.toLowerCase();

        // 检查是否是系统音频混音设备
        const isSystemAudioDevice = systemAudioKeywords.some(keyword =>
          labelLower.includes(keyword.toLowerCase())
        );

        if (isSystemAudioDevice) {
          console.warn(`[AudioCapture] ⚠️ EXCLUDED system audio mix device: "${device.label}"`);
          console.warn(`[AudioCapture] This device would record system audio instead of microphone input!`);
          return false;
        }

        return true;
      });

      console.log(`[AudioCapture] After filtering system audio devices: ${validMicrophoneDevices.length} valid microphone device(s) remaining`);

      if (validMicrophoneDevices.length === 0) {
        throw new Error('未找到有效的麦克风设备（所有设备都是系统音频混音设备）');
      }

      // 第二步：优先选择明确标记为麦克风的设备，并且优先使用具体设备ID（而非 default/communications）
      // 首先收集所有包含麦克风关键词的设备
      const microphoneDevices = validMicrophoneDevices.filter(device => {
        const labelLower = device.label.toLowerCase();
        return microphoneKeywords.some(keyword =>
          labelLower.includes(keyword.toLowerCase())
        );
      });

      // 在麦克风设备中，优先选择有具体ID的设备（非 default/communications）
      let microphoneDevice: MediaDeviceInfo | undefined;

      const explicitMicrophoneDevice = microphoneDevices.find(device =>
        device.deviceId !== 'default' && device.deviceId !== 'communications'
      );

      if (explicitMicrophoneDevice) {
        microphoneDevice = explicitMicrophoneDevice;
        console.log(`[AudioCapture] ✓ Found explicit microphone device with specific ID: "${microphoneDevice.label}"`);
      } else if (microphoneDevices.length > 0) {
        // 如果没有具体ID的设备，使用第一个麦克风设备（可能是 default）
        microphoneDevice = microphoneDevices[0];
        console.log(`[AudioCapture] ✓ Found microphone device (may have special ID): "${microphoneDevice.label}"`);
      }

      // 第三步：如果没有找到明确的麦克风，使用第一个有效设备作为备选
      if (!microphoneDevice) {
        microphoneDevice = validMicrophoneDevices[0];
        console.warn(`[AudioCapture] ⚠️ No explicit microphone device found, using: "${microphoneDevice.label}"`);
        console.warn(`[AudioCapture] Please verify this is your actual microphone in system settings`);
      }

      // 验证：确保不使用 'default' 或 'communications' 设备 ID
      // 这些特殊 ID 可能会指向错误的系统音频设备
      if (microphoneDevice.deviceId === 'default' || microphoneDevice.deviceId === 'communications') {
        console.warn(`[AudioCapture] ⚠️ WARNING: Selected device has special ID: "${microphoneDevice.deviceId}"`);
        console.warn(`[AudioCapture] This may cause recording system audio instead of microphone!`);

        // 尝试找到一个非特殊 ID 的同类设备（寻找相同名称的设备）
        // 提取设备名称的核心部分（去掉前缀如"默认值"、"通信"等）
        const deviceNameParts = microphoneDevice.label.split('-');
        const coreDeviceName = deviceNameParts.length > 1
          ? deviceNameParts.slice(1).join('-').trim()
          : microphoneDevice.label;

        console.log(`[AudioCapture] Looking for alternative device with core name: "${coreDeviceName}"`);

        const alternativeDevice = validMicrophoneDevices.find(d =>
          d.deviceId !== 'default' &&
          d.deviceId !== 'communications' &&
          d.label.includes(coreDeviceName)
        );

        if (alternativeDevice) {
          microphoneDevice = alternativeDevice;
          console.log(`[AudioCapture] ✓ Switched to alternative device: "${microphoneDevice.label}" (ID: ${microphoneDevice.deviceId})`);
        } else {
          console.error(`[AudioCapture] ✗ ERROR: No alternative device found. Recording system audio may occur!`);
          console.error(`[AudioCapture] Please check Windows Sound Settings and verify the default recording device.`);
        }
      }

      // 构建音频约束，指定具体设备
      const audioConstraints: any = {
        deviceId: { exact: microphoneDevice.deviceId },
        channelCount: 1, // 单声道
        sampleRate: this.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      console.log('[AudioCapture] ✓ Using device:', microphoneDevice.label);
      console.log('[AudioCapture] Device ID:', microphoneDevice.deviceId);

      // 请求麦克风权限
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      console.log('[AudioCapture] ✓ Microphone access granted');

      // 创建音频源节点
      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }

      this.microphoneSource = this.audioContext.createMediaStreamSource(
        this.microphoneStream
      );

      console.log('[AudioCapture] ✓ Microphone source node created successfully');
    } catch (error) {
      console.error('[AudioCapture] ✗ Failed to get microphone access:', error);
      throw new Error(`麦克风访问失败: ${error}`);
    }
  }

  /**
   * 初始化扬声器捕获（使用 Tauri 后端 + AudioWorklet）
   */
  private async initializeSpeaker(): Promise<void> {
    try {
      console.log('[AudioCapture] Starting speaker audio capture via Tauri...');

      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }

      // 加载 AudioWorklet - 使用 Blob URL 方式（兼容生产构建）
      const workletCode = `
        // RingBuffer 大小（48kHz * 2 通道 * 3秒 = 288000 个样本）
        const DEFAULT_BUFFER_SIZE = 288000;
        const REPORT_INTERVAL_SAMPLES = 240000;

        class PCMProcessor extends AudioWorkletProcessor {
          constructor(options) {
            super();
            const bufferSizeOption = options?.processorOptions?.['bufferSize'];
            this.bufferSize = typeof bufferSizeOption === 'number' && bufferSizeOption > 0
              ? bufferSizeOption
              : DEFAULT_BUFFER_SIZE;
            this.buffer = new Float32Array(this.bufferSize);
            this.writeIndex = 0;
            this.readIndex = 0;
            this.totalSamplesReceived = 0;
            this.totalSamplesProcessed = 0;
            this.samplesSinceLastReport = 0;

            console.log('[PCMProcessor] Initialized with buffer size:', this.bufferSize);

            this.port.onmessage = (event) => {
              const pcmData = event.data;
              if (!(pcmData instanceof Float32Array)) return;
              if (pcmData.length === 0) return;

              this.totalSamplesReceived += pcmData.length;
              for (let i = 0; i < pcmData.length; i++) {
                const nextWriteIndex = (this.writeIndex + 1) % this.bufferSize;
                if (nextWriteIndex === this.readIndex) {
                  this.readIndex = (this.readIndex + 1) % this.bufferSize;
                }
                this.buffer[this.writeIndex] = pcmData[i];
                this.writeIndex = nextWriteIndex;
              }
            };
          }

          process(inputs, outputs, parameters) {
            const output = outputs[0];
            if (!output || output.length === 0) return true;

            const outputChannel = output[0];
            const samplesProcessed = outputChannel.length;
            let underflowCount = 0;

            for (let i = 0; i < samplesProcessed; i++) {
              if (this.readIndex !== this.writeIndex) {
                outputChannel[i] = this.buffer[this.readIndex];
                this.readIndex = (this.readIndex + 1) % this.bufferSize;
                this.totalSamplesProcessed++;
              } else {
                outputChannel[i] = 0;
                underflowCount++;
              }
            }

            if (output.length > 1) {
              output[1].set(output[0]);
            }

            this.samplesSinceLastReport += samplesProcessed;

            if (this.samplesSinceLastReport >= REPORT_INTERVAL_SAMPLES) {
              const bufferUsage = this.getBufferUsage();
              const underflowPercentage = (underflowCount / samplesProcessed) * 100;

              console.log('[PCMProcessor] Buffer stats:', {
                usage: \`\${bufferUsage.toFixed(1)}%\`,
                samplesReceived: this.totalSamplesReceived,
                samplesProcessed: this.totalSamplesProcessed,
                underflowSamples: underflowCount,
                underflowPercentage: \`\${underflowPercentage.toFixed(2)}%\`,
              });

              this.samplesSinceLastReport = 0;
            }

            return true;
          }

          getBufferUsage() {
            if (this.writeIndex >= this.readIndex) {
              return ((this.writeIndex - this.readIndex) / this.bufferSize) * 100;
            } else {
              return ((this.writeIndex + this.bufferSize - this.readIndex) / this.bufferSize) * 100;
            }
          }
        }

        registerProcessor('pcm-processor', PCMProcessor);
      `;

      // 创建 Blob URL
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      try {
        await this.audioContext.audioWorklet.addModule(workletUrl);
        console.log('[AudioCapture] AudioWorklet module loaded via Blob URL');
        URL.revokeObjectURL(workletUrl); // 释放 Blob URL
      } catch (error) {
        URL.revokeObjectURL(workletUrl);
        throw error;
      }

      // 创建 WorkletNode
      this.speakerWorkletNode = new AudioWorkletNode(
        this.audioContext,
        'pcm-processor'
      );

      // 调用 Tauri 后端命令开始捕获，传递采样率和通道数配置
      await invoke('audio_start_capturing', {
        sampleRate: this.sampleRate,
        channels: 1, // 始终使用单声道（与麦克风一致）
      });

      // 监听来自后端的音频数据
      // 注意：事件名称需要与 Rust 后端发送的事件名称一致
      this.speakerUnlisten = await listen<Float32Array>('audio-packet', (event) => {
        // 性能监控：记录接收时间
        this.lastAudioPacketTime = Date.now();
        this.audioPacketCount++;

        // 每100个包输出一次日志（避免日志过多）
        if (this.audioPacketCount % 100 === 0) {
          const sampleCount = event.payload.length;
          console.log(`[AudioCapture] Received audio packet #${this.audioPacketCount}, ${sampleCount} samples`);
        }

        // 将接收到的 PCM 数据转发到 Worklet
        if (this.speakerWorkletNode) {
          this.speakerWorkletNode.port.postMessage(event.payload);
        }
      });

      // 启动音频健康检查（每 3 秒检查一次）
      this.startAudioHealthCheck();

      this.speakerCapturingActive = true;
      console.log('[AudioCapture] Speaker audio capture started with AudioWorklet');
    } catch (error) {
      console.error('[AudioCapture] Failed to start speaker capture:', error);
      throw new Error(`扬声器捕获启动失败: ${error}`);
    }
  }

  /**
   * 启动音频健康检查
   * 定期检查音频数据包是否正常到达
   */
  private startAudioHealthCheck(): void {
    this.audioPacketHealthCheckInterval = window.setInterval(() => {
      // 如果从未收到过任何音频包，不发出警告
      if (this.lastAudioPacketTime === 0) {
        return;
      }

      const timeSinceLastPacket = Date.now() - this.lastAudioPacketTime;

      // 如果超过 5 秒没有收到音频数据包，发出警告
      if (timeSinceLastPacket > 5000 && this.speakerCapturingActive) {
        console.warn(
          `[AudioCapture] No audio packets received in last ${Math.floor(timeSinceLastPacket / 1000)} seconds - ` +
          `Backend may have stopped or connection issue. ` +
          `Total packets received: ${this.audioPacketCount}`
        );

        // 重置计数器避免重复警告
        this.lastAudioPacketTime = Date.now();
      }
    }, 3000);
  }

  /**
   * 停止音频健康检查
   */
  private stopAudioHealthCheck(): void {
    if (this.audioPacketHealthCheckInterval !== null) {
      clearInterval(this.audioPacketHealthCheckInterval);
      this.audioPacketHealthCheckInterval = null;
    }
  }

  /**
   * 停止扬声器捕获
   */
  private async stopSpeaker(): Promise<void> {
    if (!this.speakerCapturingActive) {
      return;
    }

    try {
      console.log('[AudioCapture] Stopping speaker audio capture...');

      // 停止音频健康检查
      this.stopAudioHealthCheck();

      // 输出统计信息
      console.log('[AudioCapture] Speaker capture statistics:', {
        totalPackets: this.audioPacketCount,
        duration: this.lastAudioPacketTime ? `${Date.now() - this.lastAudioPacketTime}ms since last packet` : 'N/A',
      });

      // 取消事件监听
      if (this.speakerUnlisten) {
        this.speakerUnlisten();
        this.speakerUnlisten = null;
      }

      // 断开 WorkletNode 连接
      if (this.speakerWorkletNode) {
        this.speakerWorkletNode.disconnect();
        this.speakerWorkletNode = null;
      }

      // 调用 Tauri 后端命令停止捕获
      await invoke('audio_stop_capturing');

      // 重置统计信息
      this.lastAudioPacketTime = 0;
      this.audioPacketCount = 0;

      this.speakerCapturingActive = false;
      console.log('[AudioCapture] Speaker audio capture stopped');
    } catch (error) {
      console.error('[AudioCapture] Failed to stop speaker capture:', error);
      // 不抛出错误，避免影响其他清理操作
    }
  }

  /**
   * 获取混合后的音频流 (用于添加到 MediaRecorder)
   */
  getAudioStream(): MediaStream | null {
    if (!this.isInitialized) {
      return null;
    }

    if (!this.audioContext) {
      console.warn('[AudioCapture] AudioContext not available');
      return null;
    }

    // 创建目标流
    const destination = this.audioContext.createMediaStreamDestination();

    // 连接麦克风流 (如果有)
    if (this.microphoneSource) {
      this.microphoneSource.connect(destination);
      console.log('[AudioCapture] Microphone connected to destination');
    }

    // 连接扬声器 WorkletNode (如果有)
    if (this.speakerWorkletNode) {
      this.speakerWorkletNode.connect(destination);
      console.log('[AudioCapture] Speaker WorkletNode connected to destination');
    }

    this.destinationStream = destination.stream;

    const audioTracks = this.destinationStream.getAudioTracks();
    console.log('[AudioCapture] Returning audio stream with', audioTracks.length, 'track(s)');

    return this.destinationStream;
  }

  /**
   * 获取音频比特率配置
   */
  getAudioBitrate(): number {
    const bitrates = {
      low: 64000,     // 64 kbps
      medium: 128000, // 128 kbps
      high: 256000,   // 256 kbps
    };
    return bitrates[this.audioQuality];
  }

  /**
   * 停止音频捕获
   */
  async stop(): Promise<void> {
    console.log('[AudioCapture] Stopping audio capture...');

    // 停止扬声器捕获
    await this.stopSpeaker();

    // 停止麦克风流
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => {
        track.stop();
        console.log('[AudioCapture] Microphone track stopped');
      });
      this.microphoneStream = null;
    }

    // 关闭音频上下文
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      console.log('[AudioCapture] AudioContext closed');
    }

    this.microphoneSource = null;
    this.destinationStream = null;
    this.isInitialized = false;

    console.log('[AudioCapture] Stopped');
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // 停止扬声器捕获（异步但不等待完成）
    this.stopSpeaker().catch(console.error);

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => track.stop());
      this.microphoneStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }

    this.microphoneSource = null;
    this.destinationStream = null;
    this.isInitialized = false;
  }
}
