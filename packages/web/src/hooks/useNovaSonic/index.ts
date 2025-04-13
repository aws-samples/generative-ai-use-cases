import { useRef, useCallback } from 'react';
import { events } from 'aws-amplify/data';
import { AudioPlayer } from './AudioPlayer';

// TODO
const MAX_AUDIO_CHUNKS_PER_BATCH = 1;

const arrayBufferToBase64 = (buffer: any) => {
  const binary = [];
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary.push(String.fromCharCode(bytes[i]));
  }
  return btoa(binary.join(''));
};

const float32ArrayToInt16Array = (float32Array: Float32Array): Int16Array => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Float32を-32768から32767の範囲にスケーリング
    // const s = Math.max(-1, Math.min(1, float32Array[i]));
    // int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7FFF;
  }
  return int16Array;
};

const base64ToFloat32Array = (base64String: string) => {
  try {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    return float32Array;
  } catch (error) {
    console.error('Error in base64ToFloat32Array:', error);
    throw error;
  }
};

export const useNovaSonic = () => {
  const isRecording = useRef(false);
  const audioPlayerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const audioContextRef = useRef<any>(null);
  const audioStreamRef = useRef<any>(null);
  const sourceNodeRef = useRef<any>(null);
  const processorRef = useRef<any>(null);
  const audioInputQueue = useRef<Float32Array[]>([]);

  const dispatchEvent = async (event: string, data: any = undefined) => {
    if (channelRef.current) {
      await channelRef.current.publish({
        direction: 'ctob', // client to bedrock
        event,
        data,
      });
    }
  };

  const initAudio = async () => {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const audioContext = new AudioContext({
      sampleRate: 16000
    });

    audioStreamRef.current = audioStream;
    audioContextRef.current = audioContext;

    const audioPlayer = new AudioPlayer();
    await audioPlayer.start();

    audioPlayerRef.current = audioPlayer;
  };

  const processAudioInput = useCallback(async () => {
    if (isRecording.current) {
      let processedChunks = 0;
      let combinedLength = 0;

      const chunksToProcess: Float32Array[] = [];

      while (audioInputQueue.current.length > 0 && processedChunks < MAX_AUDIO_CHUNKS_PER_BATCH) {
        const chunk = audioInputQueue.current.shift();

        if (chunk) {
          chunksToProcess.push(chunk);
          combinedLength += chunk.length;
          processedChunks += 1;
        }
      }

      if (chunksToProcess.length > 0) {
        let offset = 0;

        const combinedBuffer = new Float32Array(combinedLength);

        for (const chunk of chunksToProcess) {
          combinedBuffer.set(chunk, offset);
          offset += chunk.length;
        }

        const int16Array = float32ArrayToInt16Array(combinedBuffer);
        const base64Data = arrayBufferToBase64(int16Array.buffer);

        dispatchEvent('audioInput', base64Data);
      }

      setTimeout(() => processAudioInput(), 0);
    }
  }, [isRecording]);

  const connectToAppSync = async () => {
    audioInputQueue.current = [];

    const channel = await events.connect('/default/dummy-session');
    channelRef.current = channel;

    channel.subscribe({
      next: (data: any) => {
        const event = data?.event;
        if (event && event.direction === 'btoc') {
          console.log(event);
          if (event.event === 'audioOutput') {
            const audioData = base64ToFloat32Array(event.data.content);
            audioPlayerRef.current.playAudio(audioData);
          }
        }
      },
      error: (e: any) => {
        console.error(e);
      },
    });
  };

  const startSession = async () => {
    await initAudio();
    await connectToAppSync();
  };

  const startRecording = async () => {
    await dispatchEvent('audioStart');

    const sourceNode = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);

    if (audioContextRef.current.createScriptProcessor) {
      const processor = audioContextRef.current.createScriptProcessor(512, 1, 1);

      processor.onaudioprocess = (e: any) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // const pcmData = new Int16Array(inputData.length);
        // for (let i = 0; i < inputData.length; i++) {
        //   pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        // }
        // const base64Data = arrayBufferToBase64(pcmData.buffer);
        // dispatchEvent('audioInput', base64Data);
        audioInputQueue.current.push(inputData);
      };

      sourceNode.connect(processor);
      processor.connect(audioContextRef.current.destination);

      sourceNodeRef.current = sourceNode;
      processorRef.current = processor;
    }

    isRecording.current = true;
    processAudioInput();
  };

  const stopRecording = async () => {
    isRecording.current = false;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track: any) => track.stop());
      audioStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    await dispatchEvent('audioStop');
  };

  return {
    isRecording: isRecording.current,
    startSession,
    startRecording,
    stopRecording,
  }
};
