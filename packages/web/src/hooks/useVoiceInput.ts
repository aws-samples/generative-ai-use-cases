import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TranscribeAudioRequest,
  TranscribeAudioResponse,
} from 'generative-ai-use-cases';
import useHttp from './useHttp';
import { getTranscribeLanguageOptions } from '../utils/AudioUtils';

// Long enough for a spoken chat message, and well under the API limit
// (about 4 KB per second of Opus).
export const MAX_RECORDING_MS = 2 * 60 * 1000;

// Off only in a closed network deployment without the Transcribe endpoint.
// Unset (local development against an older stack, tests) means on.
export const voiceInputEnabled: boolean =
  import.meta.env.VITE_APP_VOICE_INPUT_ENABLED !== 'false';

// Display language of GenU -> language of TranscribeAudio, used when none of
// the user's candidate languages is supported (Thai and Vietnamese are not).
const SPEECH_LANGUAGES: Record<string, string> = {
  ja: 'ja',
  en: 'en',
  ko: 'ko',
  zh: 'zh-CN',
};

export const speechLanguage = (displayLanguage: string): string | undefined =>
  SPEECH_LANGUAGES[displayLanguage.split('-')[0]];

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing';

export type VoiceInputError = 'micDenied' | 'tooShort' | 'failed';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Drop the "data:audio/webm;base64," prefix
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Record from the microphone and turn the speech into text in one request
 * after the recording stops. The text is handed to `onText`; nothing is sent
 * to the model until the user presses send.
 */
const useVoiceInput = (
  displayLanguage: string,
  onText: (text: string) => void
) => {
  const http = useHttp();
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [error, setError] = useState<VoiceInputError | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const supported =
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const transcribe = useCallback(
    async (blob: Blob) => {
      setStatus('transcribing');
      try {
        const res = await http.post<
          TranscribeAudioResponse,
          TranscribeAudioRequest
        >('transcribe/audio', {
          audio: await blobToBase64(blob),
          // The same candidates as the other speech recognition screens,
          // read now so a change on the Settings page applies right away
          languageOptions: getTranscribeLanguageOptions(),
          language: speechLanguage(displayLanguage),
        });
        if (res.data.text) {
          onTextRef.current(res.data.text);
        }
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reason = (e as any)?.response?.data?.reason;
        setError(reason === 'audioTooShort' ? 'tooShort' : 'failed');
      } finally {
        setStatus('idle');
      }
    },
    [http, displayLanguage]
  );

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('micDenied');
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      const blob = new Blob(chunks, { type: recorder.mimeType });
      if (blob.size === 0) {
        setStatus('idle');
        return;
      }
      transcribe(blob);
    };
    recorderRef.current = recorder;
    recorder.start();
    setStatus('recording');
    timerRef.current = setTimeout(stop, MAX_RECORDING_MS);
  }, [stop, transcribe]);

  const toggle = useCallback(() => {
    if (status === 'recording') {
      stop();
    } else if (status === 'idle') {
      start();
    }
  }, [status, start, stop]);

  // Release the microphone when the input is unmounted while recording
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder?.state === 'recording') {
        recorder.onstop = null;
        recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return { supported, status, error, toggle };
};

export default useVoiceInput;
