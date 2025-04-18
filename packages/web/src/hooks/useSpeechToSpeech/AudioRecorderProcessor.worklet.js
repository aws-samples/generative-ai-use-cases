class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.port.onmessage = (event) => {
      if (event.data.type === 'start') {
        this.isRecording = true;
      } else if (event.data.type === 'stop') {
        this.isRecording = false;
      }
    };
  }

  process(inputs, outputs, parameters) {
    if (!this.isRecording || !inputs[0] || !inputs[0][0]) {
      return true;
    }

    const input = inputs[0][0];

    // Send the audio data to the main thread
    this.port.postMessage({
      type: 'audio',
      audioData: input.slice(),
    });

    return true;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
