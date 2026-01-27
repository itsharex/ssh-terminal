/**
 * PCM Audio Processor
 *
 * 这是一个 AudioWorkletProcessor，运行在独立的音频处理线程中
 * 负责接收来自 Rust 后端的 PCM 音频数据，并输出到 Web Audio API
 *
 * 主要功能：
 * - 维护 RingBuffer 缓冲区
 * - 从主线程接收 PCM 数据（通过 port.postMessage）
 * - 在 process() 回调中填充音频输出
 * - 处理缓冲区下溢（填充静音）
 */

// @ts-ignore - AudioWorkletProcessor 是全局对象
interface AudioWorkletProcessor {
  readonly port: MessagePort;
}

// @ts-ignore
interface AudioWorkletProcessorConstructor {
  new (options?: { processorOptions?: Record<string, unknown> }): AudioWorkletProcessor;
}

// RingBuffer 大小（48kHz * 2 通道 * 1秒 = 96000 个样本）
const BUFFER_SIZE = 96000;

class PCMProcessor implements AudioWorkletProcessor {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private readIndex: number = 0;
  private readonly bufferSize: number;
  readonly port: MessagePort;

  constructor() {
    this.bufferSize = BUFFER_SIZE;
    this.buffer = new Float32Array(this.bufferSize);
    this.port = (self as unknown as { port: MessagePort }).port;

    // 监听来自主线程的 PCM 数据
    this.port.onmessage = (event: MessageEvent) => {
      const pcmData = event.data as Float32Array;
      this.writeToBuffer(pcmData);
    };
  }

  /**
   * 将 PCM 数据写入 RingBuffer
   */
  private writeToBuffer(data: Float32Array): void {
    for (let i = 0; i < data.length; i++) {
      // 检查缓冲区是否已满
      const nextWriteIndex = (this.writeIndex + 1) % this.bufferSize;
      if (nextWriteIndex === this.readIndex) {
        // 缓冲区已满，丢弃最旧的数据
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      }

      this.buffer[this.writeIndex] = data[i];
      this.writeIndex = nextWriteIndex;
    }
  }

  /**
   * AudioWorklet 的 process 回调
   *
   * @param _inputs - 输入音频流（本例中不使用）
   * @param outputs - 输出音频流
   * @param _parameters - 音频参数（本例中不使用）
   * @returns boolean - true 表示继续处理
   */
  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const output = outputs[0];

    // 如果没有输出通道，直接返回
    if (!output || output.length === 0) {
      return true;
    }

    const outputChannel = output[0];

    // 从 buffer 读取数据填充到输出
    for (let i = 0; i < outputChannel.length; i++) {
      if (this.readIndex !== this.writeIndex) {
        // 缓冲区有数据，读取
        outputChannel[i] = this.buffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      } else {
        // 缓冲区空，填充静音
        outputChannel[i] = 0;
      }
    }

    // 如果是立体声输出，复制到第二个声道
    if (output.length > 1) {
      output[1].set(output[0]);
    }

    return true;
  }
}

// 注册 Processor
// @ts-ignore
registerProcessor('pcm-processor', PCMProcessor);
