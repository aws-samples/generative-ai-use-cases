import { sanitizeTranscribeLanguageOptions } from '@generative-ai-use-cases/common';

// Range accepted by Amazon Transcribe Streaming for MediaSampleRateHertz
// https://docs.aws.amazon.com/transcribe/latest/dg/how-input.html
const MIN_TRANSCRIBE_SAMPLE_RATE_HZ = 8000;
const MAX_TRANSCRIBE_SAMPLE_RATE_HZ = 48000;

/**
 * Returns the sample rate to declare to Transcribe Streaming.
 *
 * The PCM we send is produced at the AudioContext's rate, which follows the
 * output device (e.g. 16 kHz while a Bluetooth headset is in call mode), so
 * the declared rate must be the context's actual rate, not a fixed value.
 */
export const getTranscribeSampleRate = (contextSampleRate: number): number => {
  const sampleRate = Math.round(contextSampleRate);
  const isSupported =
    Number.isFinite(sampleRate) &&
    sampleRate >= MIN_TRANSCRIBE_SAMPLE_RATE_HZ &&
    sampleRate <= MAX_TRANSCRIBE_SAMPLE_RATE_HZ;
  if (!isSupported) {
    throw new Error(
      `Unsupported audio sample rate: ${contextSampleRate} Hz (Transcribe accepts ${MIN_TRANSCRIBE_SAMPLE_RATE_HZ}-${MAX_TRANSCRIBE_SAMPLE_RATE_HZ} Hz)`
    );
  }
  return sampleRate;
};

// localStorage key of the user's candidate languages for automatic language
// identification (Settings page). The value is a JSON array of codes.
export const TRANSCRIBE_LANGUAGE_OPTIONS_STORAGE_KEY =
  'transcribeLanguageOptions';

/** Parse the stored setting; anything invalid falls back to the default. */
export const parseTranscribeLanguageOptions = (
  stored: string | null
): string[] => {
  try {
    return sanitizeTranscribeLanguageOptions(JSON.parse(stored ?? ''));
  } catch {
    return sanitizeTranscribeLanguageOptions(undefined);
  }
};

/**
 * The user's candidate languages, read at the moment transcription starts so
 * a change on the Settings page applies to the next recording.
 */
export const getTranscribeLanguageOptions = (): string[] =>
  parseTranscribeLanguageOptions(
    localStorage.getItem(TRANSCRIBE_LANGUAGE_OPTIONS_STORAGE_KEY)
  );

// Languages written without spaces between words. Transcribe returns their
// transcript as space-separated items, so the spaces are removed for display.
export const isLanguageWithoutWordSpaces = (languageCode: string): boolean =>
  languageCode === 'ja-JP' || languageCode === 'zh-CN';
