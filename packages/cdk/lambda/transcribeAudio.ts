import { Request, Response } from 'express';
import {
  TranscribeClient,
  TranscribeAudioCommand,
  BadRequestException,
  LanguageDetectionMode,
  SyncLanguage,
} from '@aws-sdk/client-transcribe';
import {
  TranscribeAudioRequest,
  TranscribeAudioResponse,
} from 'generative-ai-use-cases';
import { requireUserSub, sendJson } from './utils/http';

// TranscribeAudio accepts up to 25 MB inline, but the request comes through
// API Gateway (10 MB) as base64, which is a third larger than the audio. The
// browser records Opus in WebM at about 4 KB per second, so this is far more
// than a spoken chat message needs.
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

const SYNC_LANGUAGES = Object.values(SyncLanguage) as string[];

// A candidate from the Settings page (ja-JP, en-US, zh-CN, ...) as the
// language TranscribeAudio takes: the base code, or the code itself for
// Chinese. Undefined for a language it does not support (Thai, Vietnamese).
export const syncLanguage = (code: string): SyncLanguage | undefined => {
  if (SYNC_LANGUAGES.includes(code)) return code as SyncLanguage;
  const base = code.split('-')[0];
  return base !== 'zh' && SYNC_LANGUAGES.includes(base)
    ? (base as SyncLanguage)
    : undefined;
};

/**
 * How to tell TranscribeAudio the language: identify it among the user's
 * candidates when at least two are supported (one is rejected), otherwise
 * the one supported candidate, the display language, or Japanese.
 */
export const languageSettings = (
  languageOptions: unknown,
  language: unknown
):
  | { Language: SyncLanguage }
  | {
      LanguageDetectionMode: typeof LanguageDetectionMode.IDENTIFY_LANGUAGE;
      LanguageOptions: SyncLanguage[];
    } => {
  const candidates = Array.isArray(languageOptions)
    ? [
        ...new Set(
          languageOptions
            .filter((c): c is string => typeof c === 'string')
            .map(syncLanguage)
            .filter((c): c is SyncLanguage => !!c)
        ),
      ]
    : [];
  if (candidates.length >= 2) {
    return {
      LanguageDetectionMode: LanguageDetectionMode.IDENTIFY_LANGUAGE,
      LanguageOptions: candidates,
    };
  }
  const fallback =
    typeof language === 'string' ? syncLanguage(language) : undefined;
  return { Language: candidates[0] ?? fallback ?? SyncLanguage.JA };
};

// Japanese and Chinese transcripts come back with a space between every word.
// Remove a space when either side is not ASCII, and keep the spaces between
// ASCII words such as "Amazon Bedrock".
export const joinWords = (transcript: string, language: string): string => {
  const text = transcript.trim();
  if (!language.startsWith('ja') && !language.startsWith('zh')) {
    return text;
  }
  // eslint-disable-next-line no-control-regex
  return text.replace(/(?<=[^\x00-\x7F]) +| +(?=[^\x00-\x7F])/g, '');
};

/**
 * Transcribe a short recording from the chat input in one request
 * (TranscribeAudio). Nothing is stored: the audio is sent inline and only the
 * text is returned.
 */
export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  requireUserSub(request);
  const req: TranscribeAudioRequest = request.body ?? {};

  if (typeof req.audio !== 'string' || req.audio.length === 0) {
    return sendJson(response, 400, { message: 'audio is required' });
  }
  const audio = Buffer.from(req.audio, 'base64');
  if (audio.length === 0) {
    return sendJson(response, 400, { message: 'audio is not base64' });
  }
  if (audio.length > MAX_AUDIO_BYTES) {
    return sendJson(response, 413, {
      message: 'audio is too large',
      reason: 'audioFileTooLarge',
    });
  }
  const languages = languageSettings(req.languageOptions, req.language);

  try {
    const client = new TranscribeClient({});
    const res = await client.send(
      new TranscribeAudioCommand({
        Media: { MediaBytes: audio },
        ...languages,
      })
    );
    const transcript = res.TranscriptResponse?.Results?.Transcript ?? '';
    // The identified language (ja-JP, ...) when it was identified
    const language =
      res.TranscriptResponse?.Metadata?.LanguageCode ??
      ('Language' in languages ? languages.Language : '');
    const body: TranscribeAudioResponse = {
      text: joinWords(transcript, language),
    };
    return sendJson(response, 200, body);
  } catch (error) {
    if (error instanceof BadRequestException) {
      // For example audioTooShort or unsupportedAudioFormat, which the browser
      // shows as a message instead of a generic error
      return sendJson(response, 400, {
        message: error.message,
        reason: error.Reason,
      });
    }
    throw error;
  }
};
