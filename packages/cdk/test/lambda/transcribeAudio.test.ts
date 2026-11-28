/* eslint-disable i18nhelper/no-jp-string */
import { invokeHandler } from './api/testApp';

const transcribeSend = jest.fn();
jest.mock('@aws-sdk/client-transcribe', () => {
  const actual = jest.requireActual('@aws-sdk/client-transcribe');
  return {
    ...actual,
    TranscribeClient: jest.fn().mockImplementation(() => ({
      send: (...args: unknown[]) => transcribeSend(...args),
    })),
  };
});

// Imported after the mock so that the handler's client is the mocked one
import {
  handler,
  joinWords,
  MAX_AUDIO_BYTES,
} from '../../lambda/transcribeAudio';
import { BadRequestException } from '@aws-sdk/client-transcribe';

const audio = Buffer.from('fake webm audio').toString('base64');

const transcriptOf = (transcript: string) => ({
  TranscriptResponse: { Results: { Transcript: transcript } },
});

describe('joinWords', () => {
  test('removes the spaces between Japanese words', () => {
    expect(
      joinWords('来週 の 月曜 日 に 15時 から 設定 し て ください', 'ja')
    ).toBe('来週の月曜日に15時から設定してください');
  });

  test('keeps the spaces between ASCII words in Japanese', () => {
    expect(joinWords('Amazon Bedrock を 使う', 'ja')).toBe(
      'Amazon Bedrockを使う'
    );
  });

  test('also joins Chinese', () => {
    expect(joinWords('你好 世界', 'zh-CN')).toBe('你好世界');
  });

  test('leaves other languages as they are', () => {
    expect(joinWords(' hello world ', 'en')).toBe('hello world');
  });
});

describe('transcribeAudio handler', () => {
  beforeEach(() => {
    transcribeSend.mockReset();
  });

  test('returns the transcript with Japanese words joined', async () => {
    transcribeSend.mockResolvedValue(transcriptOf('経理 部 と の 打ち合わせ'));

    const res = await invokeHandler(handler, {
      user: 'user1',
      body: { audio },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ text: '経理部との打ち合わせ' });
    const input = transcribeSend.mock.calls[0][0].input;
    expect(input.Language).toBe('ja');
    expect(Buffer.from(input.Media.MediaBytes).toString()).toBe(
      'fake webm audio'
    );
  });

  test('uses a supported language from the request', async () => {
    transcribeSend.mockResolvedValue(transcriptOf('hello world'));

    const res = await invokeHandler(handler, {
      user: 'user1',
      body: { audio, language: 'en' },
    });

    expect(JSON.parse(res.body)).toEqual({ text: 'hello world' });
    expect(transcribeSend.mock.calls[0][0].input.Language).toBe('en');
  });

  test('identifies the language among the candidates from the Settings page', async () => {
    transcribeSend.mockResolvedValue({
      TranscriptResponse: {
        Metadata: { LanguageCode: 'ja-JP' },
        Results: { Transcript: '料金 を 教え て' },
      },
    });

    const res = await invokeHandler(handler, {
      user: 'user1',
      body: {
        audio,
        languageOptions: ['ja-JP', 'en-US', 'zh-CN', 'th-TH'],
        language: 'en',
      },
    });

    // Joined because the identified language is Japanese
    expect(JSON.parse(res.body)).toEqual({ text: '料金を教えて' });
    const input = transcribeSend.mock.calls[0][0].input;
    expect(input.LanguageDetectionMode).toBe('IDENTIFY_LANGUAGE');
    // Base codes, Chinese as it is, Thai left out as unsupported
    expect(input.LanguageOptions).toEqual(['ja', 'en', 'zh-CN']);
    expect(input.Language).toBeUndefined();
  });

  test('uses the one supported candidate instead of identifying', async () => {
    transcribeSend.mockResolvedValue(transcriptOf(''));

    await invokeHandler(handler, {
      user: 'user1',
      body: { audio, languageOptions: ['ko-KR', 'th-TH', 'vi-VN'] },
    });

    const input = transcribeSend.mock.calls[0][0].input;
    expect(input.Language).toBe('ko');
    expect(input.LanguageDetectionMode).toBeUndefined();
  });

  test('falls back to Japanese for an unsupported language', async () => {
    transcribeSend.mockResolvedValue(transcriptOf(''));

    await invokeHandler(handler, {
      user: 'user1',
      body: { audio, language: 'th' },
    });

    expect(transcribeSend.mock.calls[0][0].input.Language).toBe('ja');
  });

  test('rejects a request without audio', async () => {
    const res = await invokeHandler(handler, { user: 'user1', body: {} });

    expect(res.statusCode).toBe(400);
    expect(transcribeSend).not.toHaveBeenCalled();
  });

  test('rejects audio over the limit', async () => {
    const big = Buffer.alloc(MAX_AUDIO_BYTES + 1).toString('base64');

    const res = await invokeHandler(handler, {
      user: 'user1',
      body: { audio: big },
    });

    expect(res.statusCode).toBe(413);
    expect(transcribeSend).not.toHaveBeenCalled();
  });

  test('passes the reason of a bad request to the browser', async () => {
    transcribeSend.mockRejectedValue(
      Object.assign(
        new BadRequestException({
          message: 'Audio is too short',
          $metadata: {},
        }),
        { Reason: 'audioTooShort' }
      )
    );

    const res = await invokeHandler(handler, {
      user: 'user1',
      body: { audio },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).reason).toBe('audioTooShort');
  });

  test('answers 500 when Transcribe fails', async () => {
    transcribeSend.mockRejectedValue(new Error('boom'));

    const res = await invokeHandler(handler, {
      user: 'user1',
      body: { audio },
    });

    expect(res.statusCode).toBe(500);
  });
});
