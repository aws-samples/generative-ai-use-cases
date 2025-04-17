import { useRef, useState } from 'react';
import { events, EventsChannel } from 'aws-amplify/data';
import { AudioPlayer } from './AudioPlayer';
import { v4 as uuid } from 'uuid';
import useHttp from '../../hooks/useHttp';
import useChatHistory from './useChatHistory';
import {
  SpeechToSpeechEventType,
  SpeechToSpeechEvent,
} from 'generative-ai-use-cases';

const NAMESPACE = import.meta.env.VITE_APP_SPEECH_TO_SPEECH_NAMESPACE!;
const MIN_AUDIO_CHUNKS_PER_BATCH = 10;
const MAX_AUDIO_CHUNKS_PER_BATCH = 20;

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
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
    int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7fff;
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

export const useSpeechToSpeech = () => {
  const api = useHttp();
  const {
    clear,
    messages,
    setupSystemPrompt,
    onTextStart,
    onTextOutput,
    onTextStop,
    isAssistantSpeeching,
  } = useChatHistory();
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const systemPromptRef = useRef<string>('');
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const channelRef = useRef<EventsChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioInputQueue = useRef<string[]>([]);

  const dispatchEvent = async (
    event: SpeechToSpeechEventType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any = undefined
  ) => {
    if (channelRef.current) {
      await channelRef.current.publish({
        direction: 'ctob',
        event,
        data,
      } as SpeechToSpeechEvent);
    }
  };

  const initAudio = async () => {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const audioContext = new AudioContext({
      sampleRate: 16000,
    });

    audioStreamRef.current = audioStream;
    audioContextRef.current = audioContext;

    const audioPlayer = new AudioPlayer();
    await audioPlayer.start();

    audioPlayerRef.current = audioPlayer;
  };

  const processAudioInput = async () => {
    if (audioInputQueue.current.length > MIN_AUDIO_CHUNKS_PER_BATCH) {
      const chunksToProcess: string[] = [];

      let processedChunks = 0;

      while (
        audioInputQueue.current.length > 0 &&
        processedChunks < MAX_AUDIO_CHUNKS_PER_BATCH
      ) {
        const chunk = audioInputQueue.current.shift();

        if (chunk) {
          chunksToProcess.push(chunk);
          processedChunks += 1;
        }
      }

      await dispatchEvent('audioInput', chunksToProcess);
    }

    setTimeout(() => processAudioInput(), 0);
  };

  const connectToAppSync = async () => {
    audioInputQueue.current = [];

    const channelId = uuid();
    console.log(`/${NAMESPACE}/${channelId}`);
    const channel = await events.connect(`/${NAMESPACE}/${channelId}`);
    channelRef.current = channel;

    channel.subscribe({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: (data: any) => {
        const event = data?.event;
        if (event && event.direction === 'btoc') {
          if (event.event === 'ready') {
            startRecording().then(() => {
              setIsLoading(false);
            });
          } else if (event.event === 'end') {
            if (isActive) {
              closeSession();
            }
          } else if (event.event === 'audioOutput' && audioPlayerRef.current) {
            const chunks: string[] = event.data;

            while (chunks.length > 0) {
              const chunk = chunks.shift();

              if (chunk) {
                const audioData = base64ToFloat32Array(chunk);
                audioPlayerRef.current.playAudio(audioData);
              }
            }
          } else if (event.event === 'textStart') {
            onTextStart(event.data);
          } else if (event.event === 'textOutput') {
            onTextOutput(event.data);
          } else if (event.event === 'textStop') {
            onTextStop(event.data);
          }
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (e: any) => {
        console.error(e);
      },
    });

    await api.post('speech-to-speech', { channel: channelId });
  };

  const startRecording = async () => {
    if (
      !audioContextRef.current ||
      !audioStreamRef.current ||
      !systemPromptRef.current
    ) {
      return;
    }

    await dispatchEvent('promptStart');
    await dispatchEvent('systemPrompt', systemPromptRef.current);
    await dispatchEvent('audioStart');

    setupSystemPrompt(systemPromptRef.current);

    const sourceNode = audioContextRef.current.createMediaStreamSource(
      audioStreamRef.current
    );

    if (audioContextRef.current.createScriptProcessor) {
      const processor = audioContextRef.current.createScriptProcessor(
        512,
        1,
        1
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      processor.onaudioprocess = (e: any) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const int16Array = float32ArrayToInt16Array(inputData);
        const base64Data = arrayBufferToBase64(int16Array.buffer);
        audioInputQueue.current.push(base64Data);
      };

      sourceNode.connect(processor);
      processor.connect(audioContextRef.current.destination);

      sourceNodeRef.current = sourceNode;
      processorRef.current = processor;
    }

    setIsActive(true);

    processAudioInput();
  };

  const stopRecording = async () => {
    setIsActive(false);

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
      audioStreamRef.current
        .getTracks()
        .forEach((track: MediaStreamTrack) => track.stop());
      audioStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    await dispatchEvent('audioStop');
  };

  const startSession = async (systemPrompt: string) => {
    if (isActive || isLoading) {
      return;
    }

    clear();

    setIsLoading(true);

    systemPromptRef.current = systemPrompt;

    await connectToAppSync();
    await initAudio();
  };

  const closeSession = async () => {
    await stopRecording();

    setIsActive(false);
    setIsLoading(false);
  };

  return {
    messages,
    isActive,
    isLoading,
    isAssistantSpeeching,
    startSession,
    closeSession,
  };
};
