class PCMDownsampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chunkSize = options?.processorOptions?.chunkSize ?? 2048;
    this.buffer = [];
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
      this.port.postMessage(merged.buffer, [merged.buffer]);
      this.buffer = [];
    }

    return true;
  }
}

registerProcessor("pcm-downsampler", PCMDownsampler);
