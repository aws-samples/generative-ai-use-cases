import { useState, useCallback } from 'react';
import useChatApi from './useChatApi';
import { MODELS } from './useModel';
import { getPrompter } from '../prompts';
import { UnrecordedMessage, Model } from 'generative-ai-use-cases';

export type MeetingMinutesStyle =
  | 'transcription'
  | 'newspaper'
  | 'faq'
  | 'custom';

export const useMeetingMinutes = () => {
  const { predictStream } = useChatApi();
  const { modelIds: availableModels, textModels } = MODELS;

  // Meeting minutes specific state
  const [minutesStyle, setMinutesStyle] =
    useState<MeetingMinutesStyle>('transcription');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [generationFrequency, setGenerationFrequency] = useState(5); // in minutes
  const [generatedMinutes, setGeneratedMinutes] = useState('');
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState('');
  const [lastGeneratedTime, setLastGeneratedTime] = useState<Date | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoGenerateSessionTimestamp, setAutoGenerateSessionTimestamp] =
    useState<number | null>(null);

  const generateMinutes = useCallback(
    async (
      transcript: string,
      modelId: string,
      onGenerate?: (
        status: 'generating' | 'success' | 'error',
        data?: { message?: string; minutes?: string }
      ) => void
    ) => {
      if (!transcript || transcript.trim() === '') return;

      const model = textModels.find((m) => m.modelId === modelId);
      if (!model) {
        onGenerate?.('error', { message: 'Model not found' });
        return;
      }

      setLoading(true);
      onGenerate?.('generating');

      try {
        const prompter = getPrompter(modelId);

        const promptContent =
          minutesStyle === 'custom' && customPrompt
            ? customPrompt
            : prompter.meetingMinutesPrompt({
                style: minutesStyle,
                customPrompt,
              });

        const messages: UnrecordedMessage[] = [
          {
            role: 'system',
            content: promptContent,
          },
          {
            role: 'user',
            content: transcript,
          },
        ];

        const stream = predictStream({
          model: model as Model,
          messages,
          id: `meeting-minutes-${autoGenerateSessionTimestamp || Date.now()}`,
        });

        let fullResponse = '';
        setGeneratedMinutes('');

        for await (const chunk of stream) {
          if (chunk) {
            const chunks = chunk.split('\n');

            for (const c of chunks) {
              if (c && c.length > 0) {
                try {
                  const payload = JSON.parse(c) as { text: string };
                  if (payload.text && payload.text.length > 0) {
                    fullResponse += payload.text;
                    setGeneratedMinutes((prev) => prev + payload.text);
                  }
                } catch (error) {
                  // Skip invalid JSON chunks
                  console.debug('Skipping invalid JSON chunk:', c);
                }
              }
            }
          }
        }

        setLastProcessedTranscript(transcript);
        setLastGeneratedTime(new Date());
        onGenerate?.('success', { minutes: fullResponse });
      } catch (error) {
        onGenerate?.('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    },
    [
      minutesStyle,
      customPrompt,
      predictStream,
      textModels,
      autoGenerateSessionTimestamp,
    ]
  );

  const handleAutoGenerateToggle = useCallback((enabled: boolean) => {
    setAutoGenerate(enabled);
    if (enabled) {
      // Set timestamp when auto-generation starts
      setAutoGenerateSessionTimestamp(Date.now());
    } else {
      // Clear timestamp when auto-generation stops
      setAutoGenerateSessionTimestamp(null);
    }
  }, []);

  const clearMinutes = useCallback(() => {
    setGeneratedMinutes('');
    setLastProcessedTranscript('');
    setLastGeneratedTime(null);
    setAutoGenerateSessionTimestamp(null);
  }, []);

  return {
    // State
    minutesStyle,
    setMinutesStyle,
    autoGenerate,
    setAutoGenerate: handleAutoGenerateToggle,
    generationFrequency,
    setGenerationFrequency,
    generatedMinutes,
    setGeneratedMinutes,
    lastProcessedTranscript,
    setLastProcessedTranscript,
    lastGeneratedTime,
    setLastGeneratedTime,
    customPrompt,
    setCustomPrompt,
    loading,

    // Actions
    generateMinutes,
    clearMinutes,

    // Utilities
    availableModels,
  };
};

export default useMeetingMinutes;
