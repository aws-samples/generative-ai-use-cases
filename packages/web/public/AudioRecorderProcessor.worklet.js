const DEFAULT_BUFFER_SIZE = 512; // 512 samples / 16 kHz = 32 ms

class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.samplingRatio = 1;
    // Converting array and sending data on every frame causes significant overhead.
    // Batching multiple frames reduces this overhead and provides a smoother user experience.
    this.bufferSize = DEFAULT_BUFFER_SIZE;
    this.buffer = [];

    this.port.onmessage = (event) => {
      if (event.data.type === 'start') {
        this.isRecording = true;
        this.samplingRatio =
          (event.data.sourceSampleRate || 16000) /
          (event.data.targetSampleRate || 16000);
        this.bufferSize = event.data.bufferSize || DEFAULT_BUFFER_SIZE;
        this.buffer = [];
      } else if (event.data.type === 'stop') {
        this.isRecording = false;
        if (this.buffer.length > 0) {
          this.sendBuffer();
        }
      }
    };
  }

  sendBuffer() {
    if (this.buffer.length > 0) {
      this.port.postMessage({
        type: 'audio',
        audioData: new Int16Array(this.buffer),
      });
      this.buffer = [];
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.isRecording || !inputs[0] || !inputs[0][0]) {
      return true;
    }
    const input = inputs[0][0];

    // When using Firefox, audio must be manually downsampled to 16 kHz (e.g., 48 kHz to 16 kHz)
    // Currently, this is done by simply skipping samples (this may be not sufficient for some cases)
    const numSamples = Math.floor(input.length / this.samplingRatio);
    for (let i = 0; i < numSamples; i++) {
      // Get the value at the sampled index
      const f32 = input[Math.floor(i * this.samplingRatio)];
      // Convert float32 to int16 (actual type conversion happens in sendBuffer method)
      const i16 = Math.max(-1, Math.min(1, f32)) * 0x7fff;
      // Push to the buffer
      this.buffer.push(i16);
    }

    // Send the audio data to the main thread when the buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.sendBuffer();
    }
    return true;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
