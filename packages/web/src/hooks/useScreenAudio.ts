import {
  Item,
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
  LanguageCode,
} from '@aws-sdk/client-transcribe-streaming';
import MicrophoneStream from 'microphone-stream';
import { useState, useEffect, useMemo, useRef } from 'react';
import update from 'immutability-helper';
import { Buffer } from 'buffer';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Transcript } from 'generative-ai-use-cases';
import {
  getTranscribeSampleRate,
  DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS,
  isLanguageWithoutWordSpaces,
} from '../utils/AudioUtils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Amazon Transcribe Streaming terminates a stream on the server side
// (e.g. max 4h session, no audio data received for 15 seconds).
// When that happens without the user stopping the transcription,
// reconnect automatically. Allow up to MAX_RECONNECT_ATTEMPTS consecutive
// failures with a linear backoff (1s, 2s, 3s). The failure counter is reset
// every time a connection is established successfully.
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type StreamOutcome = { connected: boolean; receivedResults: boolean };

const pcmEncodeChunk = (chunk: Buffer) => {
  const input = MicrophoneStream.toRaw(chunk);
  let offset = 0;
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return Buffer.from(buffer);
};

const region = import.meta.env.VITE_APP_REGION;
const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID;
const idPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID;
const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const useScreenAudio = () => {
  const { t } = useTranslation();
  const screenStreamRef = useRef<MicrophoneStream>();
  // The original display stream currently used for transcription.
  // Kept so that reconnections can reuse its (still live) audio track.
  const displayStreamRef = useRef<MediaStream | null>(null);
  // True when the user explicitly stopped the transcription
  const userStopRef = useRef(false);
  // Identifies the active transcription session so that an old
  // reconnection loop does not survive a stop/start cycle
  const sessionIdRef = useRef(0);
  // Offset added to result timestamps so that they stay monotonic
  // across automatic reconnections
  const timeOffsetRef = useRef(0);
  const lastEndTimeRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [rawTranscripts, setRawTranscripts] = useState<
    {
      resultId: string;
      startTime: number;
      endTime: number;
      isPartial: boolean;
      transcripts: Transcript[];
      languageCode?: string;
    }[]
  >([]);
  const [language, setLanguage] = useState<string>('ja-JP');
  const [transcribeClient, setTranscribeClient] =
    useState<TranscribeStreamingClient>();
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [preparedDisplayStream, setPreparedDisplayStream] =
    useState<MediaStream | null>(null);

  // Check browser support
  useEffect(() => {
    const supported =
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function';
    setIsSupported(supported);
  }, []);

  const transcriptScreen = useMemo(() => {
    const transcripts: Transcript[] = rawTranscripts.flatMap(
      (t) => t.transcripts
    );
    // If the speaker is continuous, merge
    const mergedTranscripts = transcripts.reduce((prev, item) => {
      if (
        prev.length === 0 ||
        item.speakerLabel !== prev[prev.length - 1].speakerLabel
      ) {
        prev.push({
          speakerLabel: item.speakerLabel,
          transcript: item.transcript,
        });
      } else {
        prev[prev.length - 1].transcript += ' ' + item.transcript;
      }
      return prev;
    }, [] as Transcript[]);
    // Japanese and Chinese are written without spaces between words
    if (isLanguageWithoutWordSpaces(language)) {
      return mergedTranscripts.map((item) => ({
        ...item,
        transcript: item.transcript.replace(/ /g, ''),
      }));
    }
    return mergedTranscripts;
  }, [rawTranscripts, language]);

  useEffect(() => {
    // break if already set
    if (transcribeClient) return;

    fetchAuthSession().then((session) => {
      const token = session.tokens?.idToken?.toString();
      // break if unauthenticated
      if (!token) {
        return;
      }

      const transcribe = new TranscribeStreamingClient({
        region,
        credentials: fromCognitoIdentityPool({
          clientConfig: { region },
          identityPoolId: idPoolId,
          logins: {
            [providerName]: token,
          },
        }),
      });
      setTranscribeClient(transcribe);
    });
  }, [transcribeClient]);

  // Consumes a single transcription stream.
  // `connected`: the connection was established (even if the stream ended or
  // failed afterwards). `receivedResults`: at least one transcription result
  // arrived, i.e. audio was actually flowing.
  const startStream = async (
    stream: MicrophoneStream,
    languageCode?: LanguageCode,
    speakerLabel: boolean = false,
    languageOptions?: string[],
    enableMultiLanguage: boolean = false
  ): Promise<StreamOutcome> => {
    if (!transcribeClient) return { connected: false, receivedResults: false };

    // Update Language
    if (languageCode) {
      setLanguage(languageCode);
    }

    const audioStream = async function* () {
      for await (const chunk of stream as unknown as Buffer[]) {
        yield {
          AudioEvent: {
            AudioChunk: pcmEncodeChunk(chunk),
          },
        };
      }
    };

    // Best Practice: https://docs.aws.amazon.com/transcribe/latest/dg/streaming.html
    let commandParams;

    if (enableMultiLanguage) {
      // Multi-language identification mode (bidirectional translation)
      commandParams = {
        LanguageCode: undefined,
        IdentifyLanguage: false,
        IdentifyMultipleLanguages: true,
        LanguageOptions: languageOptions
          ? languageOptions.join(',')
          : DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS,
      };
    } else if (languageCode) {
      // Specific language mode
      commandParams = {
        LanguageCode: languageCode,
        IdentifyLanguage: false,
        IdentifyMultipleLanguages: false,
        LanguageOptions: undefined,
      };
    } else {
      // Auto language identification mode
      commandParams = {
        LanguageCode: undefined,
        IdentifyLanguage: true,
        IdentifyMultipleLanguages: false,
        LanguageOptions: languageOptions
          ? languageOptions.join(',')
          : DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS,
      };
    }

    const command = new StartStreamTranscriptionCommand({
      ...commandParams,
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: getTranscribeSampleRate(stream.context.sampleRate),
      AudioStream: audioStream(),
      ShowSpeakerLabel: speakerLabel,
    });

    let connected = false;
    let receivedResults = false;
    try {
      const response = await transcribeClient.send(command);
      connected = true;

      if (response.TranscriptResultStream) {
        // This snippet should be put into an async function
        for await (const event of response.TranscriptResultStream) {
          if (
            event.TranscriptEvent?.Transcript?.Results &&
            event.TranscriptEvent.Transcript?.Results.length > 0
          ) {
            receivedResults = true;
            // Get multiple possible results, but this code only processes a single result
            const result = event.TranscriptEvent.Transcript?.Results[0];

            // Update Language
            if (result.LanguageCode) {
              setLanguage(result.LanguageCode);
            }

            // Process Multiple Speaker
            const transcriptItems =
              result.Alternatives?.flatMap(
                (alternative) => alternative.Items ?? []
              ) ?? [];
            // Merge consecutive transcript with same Speaker
            const mergedTranscripts = transcriptItems.reduce((acc, curr) => {
              if (acc.length > 0 && curr.Type === 'punctuation') {
                acc[acc.length - 1].Content += curr.Content || '';
              } else if (
                acc.length > 0 &&
                acc[acc.length - 1].Speaker === curr.Speaker
              ) {
                acc[acc.length - 1].Content += ' ' + (curr.Content || '');
              } else {
                acc.push(curr);
              }
              return acc;
            }, [] as Item[]);
            const transcripts: Transcript[] = mergedTranscripts?.map(
              (item) => ({
                speakerLabel: item.Speaker ? 'spk_' + item.Speaker : undefined,
                transcript: item.Content || '',
              })
            );

            // Keep timestamps monotonic across automatic reconnections
            const startTime = (result.StartTime ?? 0) + timeOffsetRef.current;
            const endTime = (result.EndTime ?? 0) + timeOffsetRef.current;
            lastEndTimeRef.current = Math.max(lastEndTimeRef.current, endTime);

            setRawTranscripts((prev) => {
              if (prev.length === 0 || !prev[prev.length - 1].isPartial) {
                // segment is complete
                const tmp = update(prev, {
                  $push: [
                    {
                      resultId: result.ResultId || '',
                      startTime,
                      endTime,
                      isPartial: result.IsPartial ?? false,
                      transcripts,
                      languageCode: result.LanguageCode,
                    },
                  ],
                });
                return tmp;
              } else {
                // segment is NOT complete(overrides the previous segment's transcript)
                const tmp = update(prev, {
                  $splice: [
                    [
                      prev.length - 1,
                      1,
                      {
                        resultId: result.ResultId || '',
                        startTime,
                        endTime,
                        isPartial: result.IsPartial ?? false,
                        transcripts,
                        languageCode: result.LanguageCode,
                      },
                    ],
                  ],
                });
                return tmp;
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Screen audio transcription error:', error);
    }
    return { connected, receivedResults };
  };

  // Marks the last partial segment as complete so that transcripts received
  // after a reconnection are appended instead of overwriting it
  const finalizeLastPartial = () => {
    setRawTranscripts((prev) => {
      if (prev.length === 0 || !prev[prev.length - 1].isPartial) {
        return prev;
      }
      return update(prev, {
        [prev.length - 1]: { isPartial: { $set: false } },
      });
    });
  };

  const startTranscription = async (
    languageCode?: LanguageCode,
    speakerLabel?: boolean,
    languageOptions?: string[],
    enableMultiLanguage?: boolean
  ) => {
    if (!isSupported) {
      setError('Screen audio capture is not supported in this browser');
      return;
    }

    let displayStream: MediaStream;
    try {
      setError('');

      // Request screen audio capture
      // Note: Most browsers require video to be true when capturing audio
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
      });

      // Check if audio track is available
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        displayStream.getTracks().forEach((track) => track.stop());
        throw new Error('No audio track available in screen capture');
      }
    } catch (e) {
      console.log('Screen audio capture error:', e);
      if (e instanceof Error) {
        if (e.name === 'NotAllowedError') {
          setError('Screen audio access was denied');
        } else if (e.name === 'NotSupportedError') {
          setError('Screen audio capture is not supported');
        } else {
          setError('Failed to start screen audio capture');
        }
      }
      return;
    }

    await startTranscriptionWithStream(
      displayStream,
      languageCode,
      speakerLabel,
      languageOptions,
      enableMultiLanguage
    );
  };

  /**
   * Prepares screen capture by requesting user permission and screen selection.
   * This function only handles the preparation phase (getDisplayMedia) without starting
   * the actual recording. This allows synchronization with microphone recording by
   * completing user interactions upfront, then starting both recordings simultaneously.
   *
   * @returns Promise<MediaStream> The prepared display stream with audio tracks
   * @throws Error if screen capture is not supported or user denies permission
   */
  const prepareScreenCapture = async (): Promise<MediaStream> => {
    if (!isSupported) {
      throw new Error('Screen audio capture is not supported in this browser');
    }

    try {
      setError('');

      // Request screen audio capture
      // Note: Most browsers require video to be true when capturing audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
      });

      // Check if audio track is available
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available in screen capture');
      }

      setPreparedDisplayStream(displayStream);
      return displayStream;
    } catch (e) {
      console.log('Screen audio capture preparation error:', e);
      if (e instanceof Error) {
        if (e.name === 'NotAllowedError') {
          setError('Screen audio access was denied');
        } else if (e.name === 'NotSupportedError') {
          setError('Screen audio capture is not supported');
        } else {
          setError('Failed to prepare screen audio capture');
        }
      }
      throw e;
    }
  };

  /**
   * Starts screen audio transcription using a pre-prepared display stream.
   * This function is designed to work with prepareScreenCapture() for synchronized
   * recording. It extracts audio tracks from the provided stream and begins
   * transcription without additional user interaction delays.
   *
   * When the transcription stream terminates without the user stopping it
   * (e.g. Transcribe Streaming server-side limits), it automatically
   * reconnects while the capture audio track is still live.
   *
   * @param displayStream The MediaStream obtained from prepareScreenCapture()
   * @param languageCode Optional language code for transcription
   * @param speakerLabel Whether to enable speaker recognition
   */
  const startTranscriptionWithStream = async (
    displayStream: MediaStream,
    languageCode?: LanguageCode,
    speakerLabel?: boolean,
    languageOptions?: string[],
    enableMultiLanguage?: boolean
  ) => {
    const sessionId = ++sessionIdRef.current;
    const isActive = () =>
      sessionIdRef.current === sessionId && !userStopRef.current;

    userStopRef.current = false;
    timeOffsetRef.current = 0;
    lastEndTimeRef.current = 0;
    displayStreamRef.current = displayStream;
    let consecutiveFailures = 0;
    let isInitialAttempt = true;

    try {
      setError('');

      // Stop the video track to save resources
      // (the audio track is kept alive for reconnections)
      displayStream.getVideoTracks().forEach((track) => track.stop());

      setRecording(true);
      while (isActive()) {
        const audioTrack = displayStream
          .getAudioTracks()
          .find((track) => track.readyState === 'live');
        if (!audioTrack) {
          if (isInitialAttempt) {
            throw new Error('No audio track available in screen capture');
          }
          // The capture source is gone (e.g. the user stopped sharing)
          toast.warning(t('transcribe.audio_source_lost'));
          break;
        }

        // Clone the track so that stopping the MicrophoneStream between
        // reconnections does not stop the original capture track
        const clonedTrack = audioTrack.clone();
        const stream = new MicrophoneStream();
        screenStreamRef.current = stream;
        let outcome: StreamOutcome = {
          connected: false,
          receivedResults: false,
        };
        try {
          stream.setStream(new MediaStream([clonedTrack]));
          outcome = await startStream(
            stream,
            languageCode,
            speakerLabel,
            languageOptions,
            enableMultiLanguage
          );
        } catch (e) {
          console.log('Screen audio transcription error:', e);
        } finally {
          stream.stop();
          clonedTrack.stop();
        }

        if (!isActive()) break;

        // The stream ended even though the user did not stop it.
        // Only a stream that produced results counts as healthy: one that
        // connects but ends with no results (e.g. no audio reaches the
        // browser) counts as a failure, so a dead source stops retrying.
        consecutiveFailures = outcome.receivedResults
          ? 0
          : consecutiveFailures + 1;
        if (isInitialAttempt && !outcome.connected) {
          // The very first connection could not be established:
          // keep the legacy behavior (no retry) and tell the user
          setError('Screen audio transcription failed');
          break;
        }
        isInitialAttempt = false;
        if (consecutiveFailures >= MAX_RECONNECT_ATTEMPTS) {
          toast.error(t('transcribe.reconnect_failed'));
          break;
        }

        // Prepare for the reconnection while keeping past transcripts
        timeOffsetRef.current = lastEndTimeRef.current;
        finalizeLastPartial();
        toast.info(t('transcribe.reconnecting'));
        await sleep(RECONNECT_DELAY_MS * (consecutiveFailures + 1));
      }
    } catch (e) {
      console.log('Screen audio transcription error:', e);
      if (e instanceof Error) {
        setError('Failed to start screen audio transcription');
      }
    } finally {
      if (sessionIdRef.current === sessionId) {
        screenStreamRef.current = undefined;
        setRecording(false);
        // Stop the original capture tracks
        displayStream.getTracks().forEach((track) => track.stop());
        displayStreamRef.current = null;
        transcribeClient?.destroy();
      }
      // Clean up prepared stream
      if (preparedDisplayStream === displayStream) {
        setPreparedDisplayStream(null);
      }
    }
  };

  const stopTranscription = () => {
    userStopRef.current = true;
    if (screenStreamRef.current) {
      screenStreamRef.current.stop();
      screenStreamRef.current = undefined;
    }
    setRecording(false);

    // Stop the original capture tracks used for transcription
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((track) => track.stop());
      displayStreamRef.current = null;
    }

    // Clean up prepared stream if exists
    if (preparedDisplayStream) {
      preparedDisplayStream.getTracks().forEach((track) => track.stop());
      setPreparedDisplayStream(null);
    }
  };

  const clearTranscripts = () => {
    setRawTranscripts([]);
    setError('');
  };

  return {
    startTranscription,
    prepareScreenCapture,
    startTranscriptionWithStream,
    stopTranscription,
    recording,
    transcriptScreen,
    clearTranscripts,
    isSupported,
    error,
    rawTranscripts,
  };
};

export default useScreenAudio;
