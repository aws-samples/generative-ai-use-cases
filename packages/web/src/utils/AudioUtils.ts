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

const FALLBACK_TRANSCRIBE_LANGUAGE_OPTIONS = 'ja-JP,en-US';

/**
 * Read the transcribeLanguageOptions deploy parameter (a JSON array of
 * language codes) as the comma-separated list Transcribe streaming takes.
 * The deploy-time validation guarantees at least two codes; anything else
 * (e.g. a local dev server without the variable) falls back to ja-JP / en-US.
 */
export const parseTranscribeLanguageOptions = (raw?: string): string => {
  try {
    const codes: unknown = JSON.parse(raw ?? '');
    if (
      Array.isArray(codes) &&
      codes.length >= 2 &&
      codes.every((c) => typeof c === 'string' && c !== '')
    ) {
      return codes.join(',');
    }
  } catch {
    // fall through
  }
  return FALLBACK_TRANSCRIBE_LANGUAGE_OPTIONS;
};

// Candidates for automatic language identification in Transcribe streaming,
// used when the caller does not pass its own list.
export const DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS =
  parseTranscribeLanguageOptions(
    import.meta.env.VITE_APP_TRANSCRIBE_LANGUAGE_OPTIONS
  );

// Languages written without spaces between words. Transcribe returns their
// transcript as space-separated items, so the spaces are removed for display.
export const isLanguageWithoutWordSpaces = (languageCode: string): boolean =>
  languageCode === 'ja-JP' || languageCode === 'zh-CN';
