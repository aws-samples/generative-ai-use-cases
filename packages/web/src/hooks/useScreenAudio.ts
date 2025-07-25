import {
  Item,
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
  LanguageCode,
} from '@aws-sdk/client-transcribe-streaming';
import MicrophoneStream from 'microphone-stream';
import { useState, useEffect, useMemo } from 'react';
import update from 'immutability-helper';
import { Buffer } from 'buffer';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Transcript } from 'generative-ai-use-cases';

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
const cognitoIdentityPoolProxyEndpoint = import.meta.env
  .VITE_APP_COGNITO_IDENTITY_POOL_PROXY_ENDPOINT;
const cognito = new CognitoIdentityClient({
  region,
  ...(cognitoIdentityPoolProxyEndpoint
    ? { endpoint: cognitoIdentityPoolProxyEndpoint }
    : {}),
});
const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID;
const idPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID;
const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const useScreenAudio = () => {
  const [screenStream, setScreenStream] = useState<
    MicrophoneStream | undefined
  >();
  const [recording, setRecording] = useState(false);
  const [rawTranscripts, setRawTranscripts] = useState<
    {
      resultId: string;
      startTime: number;
      endTime: number;
      isPartial: boolean;
      transcripts: Transcript[];
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
    // If Japanese, remove spaces
    if (language === 'ja-JP') {
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
          client: cognito,
          identityPoolId: idPoolId,
          logins: {
            [providerName]: token,
          },
        }),
      });
      setTranscribeClient(transcribe);
    });
  }, [transcribeClient]);

  const startStream = async (
    stream: MicrophoneStream,
    languageCode?: LanguageCode,
    speakerLabel: boolean = false
  ) => {
    if (!transcribeClient) return;

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
    const command = new StartStreamTranscriptionCommand({
      LanguageCode: languageCode,
      IdentifyLanguage: languageCode ? false : true,
      LanguageOptions: languageCode ? undefined : 'en-US,ja-JP',
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: 48000,
      AudioStream: audioStream(),
      ShowSpeakerLabel: speakerLabel,
    });

    try {
      const response = await transcribeClient.send(command);

      if (response.TranscriptResultStream) {
        // This snippet should be put into an async function
        for await (const event of response.TranscriptResultStream) {
          if (
            event.TranscriptEvent?.Transcript?.Results &&
            event.TranscriptEvent.Transcript?.Results.length > 0
          ) {
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

            setRawTranscripts((prev) => {
              if (prev.length === 0 || !prev[prev.length - 1].isPartial) {
                // segment is complete
                const tmp = update(prev, {
                  $push: [
                    {
                      resultId: result.ResultId || '',
                      startTime: result.StartTime || 0,
                      endTime: result.EndTime || 0,
                      isPartial: result.IsPartial ?? false,
                      transcripts,
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
                        startTime: result.StartTime || 0,
                        endTime: result.EndTime || 0,
                        isPartial: result.IsPartial ?? false,
                        transcripts,
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
      setError('Screen audio transcription failed');
      stopTranscription();
    } finally {
      stopTranscription();
      transcribeClient.destroy();
    }
  };

  const startTranscription = async (
    languageCode?: LanguageCode,
    speakerLabel?: boolean
  ) => {
    if (!isSupported) {
      setError('Screen audio capture is not supported in this browser');
      return;
    }

    const stream = new MicrophoneStream();
    try {
      setError('');
      setScreenStream(stream);

      // Request screen audio capture
      // Note: Most browsers require video to be true when capturing audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
      });

      // Extract only the audio track
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available in screen capture');
      }

      // Create a new MediaStream with only audio
      const audioOnlyStream = new MediaStream(audioTracks);

      // Stop the video track to save resources
      const videoTracks = displayStream.getVideoTracks();
      videoTracks.forEach((track) => track.stop());

      stream.setStream(audioOnlyStream);
      setRecording(true);
      await startStream(stream, languageCode, speakerLabel);
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
    } finally {
      stream.stop();
      setRecording(false);
      setScreenStream(undefined);
    }
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
   * @param displayStream The MediaStream obtained from prepareScreenCapture()
   * @param languageCode Optional language code for transcription
   * @param speakerLabel Whether to enable speaker recognition
   */
  const startTranscriptionWithStream = async (
    displayStream: MediaStream,
    languageCode?: LanguageCode,
    speakerLabel?: boolean
  ) => {
    const stream = new MicrophoneStream();
    try {
      setError('');
      setScreenStream(stream);

      // Extract only the audio track
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available in screen capture');
      }

      // Create a new MediaStream with only audio
      const audioOnlyStream = new MediaStream(audioTracks);

      // Stop the video track to save resources
      const videoTracks = displayStream.getVideoTracks();
      videoTracks.forEach((track) => track.stop());

      stream.setStream(audioOnlyStream);
      setRecording(true);
      await startStream(stream, languageCode, speakerLabel);
    } catch (e) {
      console.log('Screen audio transcription error:', e);
      if (e instanceof Error) {
        setError('Failed to start screen audio transcription');
      }
    } finally {
      stream.stop();
      setRecording(false);
      setScreenStream(undefined);
      // Clean up prepared stream
      if (preparedDisplayStream === displayStream) {
        setPreparedDisplayStream(null);
      }
    }
  };

  const stopTranscription = () => {
    if (screenStream) {
      screenStream.stop();
      setRecording(false);
      setScreenStream(undefined);
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
