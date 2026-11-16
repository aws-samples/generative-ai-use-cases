import type {
  PollyEngine,
  PollyOutputFormat,
  SynthesizeSpeechRequest,
} from 'generative-ai-use-cases';
import {
  countBilledCharacters,
  describeSsmlIssue,
  validateSsml,
  wrapSpeak,
} from './ssmlUtils';

// Amazon Polly SynthesizeSpeech accepts up to 3000 billed characters per request
export const MAX_TEXT_LENGTH = 3000;
export const MIN_SPEED = 0.5;
export const MAX_SPEED = 2.0;

export const ENGINES: PollyEngine[] = [
  'generative',
  'long-form',
  'neural',
  'standard',
];

export const OUTPUT_FORMATS: Record<
  PollyOutputFormat,
  { contentType: string; extension: string }
> = {
  mp3: { contentType: 'audio/mpeg', extension: 'mp3' },
  ogg_vorbis: { contentType: 'audio/ogg', extension: 'ogg' },
};

export const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Build the text sent to Polly.
 * In plain text mode, SSML is used only when the speed is not 100%.
 * In SSML mode, the text is the user's SSML: it is neither escaped nor
 * wrapped again (only wrapped with <speak> when missing) and the speed is ignored.
 */
export const buildSpeechInput = (
  text: string,
  speed: number,
  textType: 'text' | 'ssml' = 'text'
): { text: string; textType: 'text' | 'ssml' } => {
  // Characters that are invalid in XML 1.0 (control characters other than
  // tab, LF and CR) are removed before building the request text
  const cleaned = removeInvalidXmlChars(text);
  if (textType === 'ssml') {
    return { text: wrapSpeak(cleaned), textType: 'ssml' };
  }
  const rate = Math.round(speed * 100);
  if (rate === 100) {
    return { text: cleaned, textType: 'text' };
  }
  return {
    text: `<speak><prosody rate="${rate}%">${escapeXml(cleaned)}</prosody></speak>`,
    textType: 'ssml',
  };
};

// Polly limit of the whole request text (tags included) for SynthesizeSpeech
export const MAX_REQUEST_LENGTH = 6000;

export const removeInvalidXmlChars = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export type PollyErrorResponse = {
  statusCode: number;
  message: string;
  code: string;
};

const ACCESS_DENIED_NAMES = [
  'AccessDeniedException',
  'AccessDenied',
  'UnrecognizedClientException',
  'UnauthorizedException',
  'ExpiredTokenException',
  'InvalidSignatureException',
  'InvalidClientTokenId',
  'MissingAuthenticationToken',
  'CredentialsProviderError',
];

const S3_ERROR_NAMES = ['NoSuchBucket', 'S3ServiceException'];

/**
 * Map an error thrown by the AWS SDK (Polly / S3) to a response that is safe
 * to return to the user. Never includes the raw AWS message.
 * https://docs.aws.amazon.com/polly/latest/dg/API_SynthesizeSpeech.html
 * https://docs.aws.amazon.com/polly/latest/dg/API_DescribeVoices.html
 * https://docs.aws.amazon.com/polly/latest/dg/limits.html
 */
export const mapPollyError = (
  error: unknown,
  options: { storage?: boolean } = {}
): PollyErrorResponse => {
  const e = (error ?? {}) as {
    name?: unknown;
    $metadata?: { httpStatusCode?: number };
  };
  const name = typeof e.name === 'string' ? e.name : '';
  const status = e.$metadata?.httpStatusCode;

  // S3 failures (including S3 access denied) must not look like Polly ones
  if (options.storage || S3_ERROR_NAMES.includes(name)) {
    return {
      statusCode: 500,
      code: 'STORAGE_ERROR',
      message: 'Failed to save the generated audio file.',
    };
  }
  if (name === 'EngineNotSupportedException') {
    return {
      statusCode: 400,
      code: 'ENGINE_NOT_SUPPORTED',
      message:
        "The selected engine is not compatible with the selected voice, or is not available in this stack's Region (for example, Long-form voices are available only in us-east-1). Choose another engine or voice.",
    };
  }
  if (name === 'LanguageNotSupportedException') {
    return {
      statusCode: 400,
      code: 'LANGUAGE_NOT_SUPPORTED',
      message:
        'The selected language is not supported by the selected voice. Choose another language or voice.',
    };
  }
  if (name === 'InvalidSsmlException') {
    return {
      statusCode: 400,
      code: 'INVALID_SSML',
      message: 'The SSML is invalid. Check the tag syntax and spelling.',
    };
  }
  if (name === 'TextLengthExceededException') {
    return {
      statusCode: 400,
      code: 'TEXT_TOO_LONG',
      message: `The text exceeds the Polly limit (${MAX_REQUEST_LENGTH} characters in total and ${MAX_TEXT_LENGTH} billed characters for SynthesizeSpeech).`,
    };
  }
  if (name === 'InvalidSampleRateException') {
    return {
      statusCode: 400,
      code: 'INVALID_SAMPLE_RATE',
      message: 'The sample rate is not valid for the selected output format.',
    };
  }
  if (name === 'InvalidNextTokenException') {
    return {
      statusCode: 400,
      code: 'INVALID_NEXT_TOKEN',
      message: 'The pagination token is invalid.',
    };
  }
  if (name.includes('Throttl') || status === 429) {
    return {
      statusCode: 429,
      code: 'THROTTLED',
      message:
        'Too many requests to Amazon Polly (about 8 requests per second per account and Region for neural and generative voices). Wait a moment and try again.',
    };
  }
  if (name === 'ServiceFailureException') {
    return {
      statusCode: 502,
      code: 'POLLY_SERVICE_FAILURE',
      message: 'Amazon Polly failed temporarily. Try again later.',
    };
  }
  if (ACCESS_DENIED_NAMES.includes(name)) {
    return {
      statusCode: 500,
      code: 'POLLY_ACCESS_DENIED',
      message:
        'The server is not allowed to call Amazon Polly. Ask the administrator to check the IAM permissions polly:SynthesizeSpeech and polly:DescribeVoices.',
    };
  }
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal Server Error',
  };
};

/**
 * Validate the request body of POST /polly/synthesize.
 * Returns an error message, or null when the request is valid.
 */
/**
 * Returns true when the final request text (after escaping, tags included)
 * is within the Polly limit.
 */
export const isWithinRequestLimit = (requestText: string): boolean =>
  Array.from(requestText).length <= MAX_REQUEST_LENGTH;

/**
 * Client local time as yyyyMMdd-HHmmss. Strict format plus range checks, because
 * the value ends up in the S3 key and in the Content-Disposition header.
 */
export const isValidTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{8}-\d{6}$/.test(value)) return false;
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(9, 11));
  const minute = Number(value.slice(11, 13));
  const second = Number(value.slice(13, 15));
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
};

/** Formats a date as yyyyMMdd-HHmmss in UTC. */
export const formatUtcTimestamp = (date: Date): string => {
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return (
    `${p(date.getUTCFullYear(), 4)}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
  );
};

/**
 * speech-<voice>-<yyyyMMdd>-<HHmmss>.<ext>
 * A missing or invalid timestamp falls back to the current time in UTC.
 */
export const buildFileName = (
  voiceId: string,
  extension: string,
  timestamp?: unknown,
  now: Date = new Date()
): string => {
  const ts = isValidTimestamp(timestamp) ? timestamp : formatUtcTimestamp(now);
  return `speech-${voiceId.toLowerCase()}-${ts}.${extension}`;
};

export const validateSynthesizeRequest = (
  req: Partial<SynthesizeSpeechRequest> | null | undefined
): string | null => validateSynthesizeRequestDetailed(req)?.message ?? null;

/**
 * Same as validateSynthesizeRequest, but also returns the error code
 * (INVALID_REQUEST, TEXT_TOO_LONG or INVALID_SSML).
 */
export const validateSynthesizeRequestDetailed = (
  req: Partial<SynthesizeSpeechRequest> | null | undefined
): { message: string; code: string } | null => {
  const invalid = (message: string, code = 'INVALID_REQUEST') => ({
    message,
    code,
  });
  if (!req || typeof req !== 'object') {
    return invalid('Request body is required.');
  }
  if (typeof req.text !== 'string' || req.text.trim().length === 0) {
    return invalid('text is required.');
  }
  if (
    req.textType !== undefined &&
    req.textType !== 'text' &&
    req.textType !== 'ssml'
  ) {
    return invalid("textType must be 'text' or 'ssml'.");
  }
  const isSsml = req.textType === 'ssml';
  // Count by code points (not UTF-16 units) so that it matches what the user sees.
  // In SSML mode, tags are not billed and are not counted.
  const length = isSsml
    ? countBilledCharacters(removeInvalidXmlChars(req.text))
    : Array.from(req.text).length;
  if (length > MAX_TEXT_LENGTH) {
    return invalid(
      `text must be ${MAX_TEXT_LENGTH} characters or less (received ${length}).`,
      isSsml ? 'TEXT_TOO_LONG' : 'INVALID_REQUEST'
    );
  }
  if (
    typeof req.voiceId !== 'string' ||
    !/^[A-Za-z]{1,32}$/.test(req.voiceId)
  ) {
    return invalid('voiceId is invalid.');
  }
  if (!req.engine || !ENGINES.includes(req.engine)) {
    return invalid(`engine must be one of ${ENGINES.join(', ')}.`);
  }
  if (
    typeof req.languageCode !== 'string' ||
    !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(req.languageCode)
  ) {
    return invalid('languageCode is invalid.');
  }
  if (!req.outputFormat || !(req.outputFormat in OUTPUT_FORMATS)) {
    return invalid(
      `outputFormat must be one of ${Object.keys(OUTPUT_FORMATS).join(', ')}.`
    );
  }
  if (
    typeof req.speed !== 'number' ||
    !Number.isFinite(req.speed) ||
    req.speed < MIN_SPEED ||
    req.speed > MAX_SPEED
  ) {
    return invalid(`speed must be between ${MIN_SPEED} and ${MAX_SPEED}.`);
  }
  // timestamp is optional; an invalid value is ignored (UTC fallback in buildFileName)
  if (isSsml) {
    // Tags the Polly engine does not support, forbidden tags and malformed
    // SSML are rejected here, before calling Polly
    const issue = validateSsml(removeInvalidXmlChars(req.text), req.engine);
    if (issue) {
      return invalid(describeSsmlIssue(issue), 'INVALID_SSML');
    }
  }
  return null;
};
