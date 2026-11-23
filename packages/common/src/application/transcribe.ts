// Languages a user can choose as candidates for automatic language
// identification in transcription. These are the languages the meeting
// minutes screen offers, one dialect each, since Amazon Transcribe allows only
// one dialect per language among the candidates.
export const TRANSCRIBE_AUTO_DETECT_LANGUAGES = [
  'ja-JP',
  'en-US',
  'zh-CN',
  'ko-KR',
  'th-TH',
  'vi-VN',
] as const;

export const DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS = ['ja-JP', 'en-US'];

// Amazon Transcribe needs at least two candidates and recommends five or fewer.
export const MIN_TRANSCRIBE_LANGUAGE_OPTIONS = 2;
export const MAX_TRANSCRIBE_LANGUAGE_OPTIONS = 5;

/**
 * Keep only usable candidates from a user's setting or a request body.
 *
 * Unknown codes and duplicates are dropped and the list is capped at the
 * maximum. If fewer than two remain, the default (Japanese and English) is
 * used, so a broken setting never breaks transcription.
 */
export const sanitizeTranscribeLanguageOptions = (value: unknown): string[] => {
  const allowed: readonly string[] = TRANSCRIBE_AUTO_DETECT_LANGUAGES;
  const codes = Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => allowed.includes(v)))]
    : [];
  return codes.length >= MIN_TRANSCRIBE_LANGUAGE_OPTIONS
    ? codes.slice(0, MAX_TRANSCRIBE_LANGUAGE_OPTIONS)
    : [...DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS];
};
