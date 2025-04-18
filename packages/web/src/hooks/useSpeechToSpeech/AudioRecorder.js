import { ObjectExt } from './ObjectsExt.js';
const AudioRecorderWorkletUrl = new URL(
  './AudioRecorderProcessor.worklet.js',
  import.meta.url
).toString();

export class AudioRecorder {
  constructor() {
    this.onAudioRecordedListeners = [];
    this.onErrorListeners = [];
    this.initialized = false;
  }

  addEventListener(event, callback) {
    switch (event) {
      case 'onAudioRecorded':
        this.onAudioRecordedListeners.push(callback);
        break;
      case 'onError':
        this.onErrorListeners.push(callback);
        break;
      default:
        console.error(
          'Listener registered for event type: ' +
            JSON.stringify(event) +
            ' which is not supported'
        );
    }
  }

  async start() {
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Get user media stream
      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (error) {
        // Handle permission denied or device not available errors
        const errorType = error.name || 'UnknownError';
        const errorMessage = error.message || 'Failed to access microphone';

        // Notify error listeners
        this.onErrorListeners.forEach((listener) =>
          listener({
            type: errorType,
            message: errorMessage,
            originalError: error,
          })
        );

        // Don't throw, just return false to indicate failure
        console.error('Microphone access error:', errorType, errorMessage);
        return false;
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(
        this.audioStream
      );

      // Add the audio worklet module
      try {
        await this.audioContext.audioWorklet.addModule(AudioRecorderWorkletUrl);
      } catch (error) {
        this.onErrorListeners.forEach((listener) =>
          listener({
            type: 'WorkletError',
            message: 'Failed to load audio worklet',
            originalError: error,
          })
        );
        this.cleanup();
        return false;
      }

      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'audio-recorder-processor'
      );

      // Connect the source to the worklet
      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

      // Listen for audio data from the worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          const audioData = event.data.audioData;
          // Notify listeners that audio was recorded
          this.onAudioRecordedListeners.forEach((listener) =>
            listener(audioData)
          );
        }
      };

      // Start recording
      this.workletNode.port.postMessage({
        type: 'start',
      });

      this.initialized = true;
      return true;
    } catch (error) {
      // Catch any other unexpected errors
      this.onErrorListeners.forEach((listener) =>
        listener({
          type: 'InitializationError',
          message: 'Failed to initialize audio recorder',
          originalError: error,
        })
      );
      this.cleanup();
      return false;
    }
  }

  cleanup() {
    if (ObjectExt.exists(this.workletNode)) {
      try {
        this.workletNode.disconnect();
      } catch (e) {
        console.error('Error disconnecting worklet node:', e);
      }
    }

    if (ObjectExt.exists(this.sourceNode)) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {
        console.error('Error disconnecting source node:', e);
      }
    }

    if (ObjectExt.exists(this.audioStream)) {
      try {
        this.audioStream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.error('Error stopping audio tracks:', e);
      }
    }

    if (ObjectExt.exists(this.audioContext)) {
      try {
        this.audioContext.close();
      } catch (e) {
        console.error('Error closing audio context:', e);
      }
    }

    this.initialized = false;
    this.audioContext = null;
    this.audioStream = null;
    this.sourceNode = null;
    this.workletNode = null;
  }

  stop() {
    if (this.initialized) {
      // Stop recording
      if (ObjectExt.exists(this.workletNode)) {
        this.workletNode.port.postMessage({
          type: 'stop',
        });
      }

      this.cleanup();
    }
  }
}
