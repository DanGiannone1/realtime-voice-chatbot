class PCMDownsampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chunkSize = options?.processorOptions?.chunkSize ?? 2048;
    this.buffer = [];
    this.processedCount = 0;
  }

  downsample(input) {
    // Downsample from 48kHz to 24kHz by taking every other sample.
    const outputLength = Math.floor(input.length / 2);
    const downsampled = new Float32Array(outputLength);
    for (let i = 0, j = 0; j < outputLength; j += 1, i += 2) {
      downsampled[j] = input[i];
    }
    return downsampled;
  }

  float32ToPCM16(float32Array) {
    // Convert Float32 samples to PCM16 format
    const pcm16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and scale to 16-bit integer range
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16Array[i] = sample * 0x7FFF;
    }
    return pcm16Array;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelData = input[0];
    if (!channelData) {
      return true;
    }

    const samples = this.downsample(channelData);
    this.buffer.push(samples);

    const bufferedLength = this.buffer.reduce((acc, arr) => acc + arr.length, 0);

    if (bufferedLength >= this.chunkSize) {
      const merged = new Float32Array(bufferedLength);
      let offset = 0;
      for (const chunk of this.buffer) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Convert Float32 to PCM16 before sending
      const pcm16Array = this.float32ToPCM16(merged);
      this.port.postMessage(pcm16Array.buffer, [pcm16Array.buffer]);
      this.buffer = [];
      
      // Debug logging (only log occasionally to avoid spam)
      this.processedCount++;
      if (this.processedCount % 10 === 0) {
        console.log(`Audio processor: sent chunk ${this.processedCount}, PCM16 bytes:`, pcm16Array.byteLength);
      }
    }

    return true;
  }
}

registerProcessor("pcm-downsampler", PCMDownsampler);
