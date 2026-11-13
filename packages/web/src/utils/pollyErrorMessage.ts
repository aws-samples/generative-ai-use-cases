// Error codes returned by the /polly API ({ message, code })
const POLLY_ERROR_CODES = [
  'ENGINE_NOT_SUPPORTED',
  'LANGUAGE_NOT_SUPPORTED',
  'INVALID_SSML',
  'TEXT_TOO_LONG',
  'INVALID_SAMPLE_RATE',
  'THROTTLED',
  'INVALID_NEXT_TOKEN',
  'POLLY_SERVICE_FAILURE',
  'POLLY_ACCESS_DENIED',
  'STORAGE_ERROR',
  'INTERNAL_ERROR',
  'INVALID_REQUEST',
];

/**
 * Build the message shown to the user for a failed /polly request.
 * Order: localized text for the error code, then the (already sanitized)
 * message of the server, then a generic localized message.
 * Messages of the HTTP client (e.g. "Network Error") are never shown.
 */
export const getPollyErrorMessage = (
  error: unknown,
  t: (key: string) => string
): string => {
  const data = (
    error as { response?: { data?: { message?: unknown; code?: unknown } } }
  )?.response?.data;
  const code = typeof data?.code === 'string' ? data.code : '';
  if (POLLY_ERROR_CODES.includes(code)) {
    return t(`textToSpeech.error_${code.toLowerCase()}`);
  }
  if (typeof data?.message === 'string' && data.message.length > 0) {
    return data.message;
  }
  return t('textToSpeech.error_generic');
};
