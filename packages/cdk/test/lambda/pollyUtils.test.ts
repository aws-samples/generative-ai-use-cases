import {
  MAX_TEXT_LENGTH,
  buildSpeechInput,
  escapeXml,
  isWithinRequestLimit,
  mapPollyError,
  removeInvalidXmlChars,
  validateSynthesizeRequest,
  validateSynthesizeRequestDetailed,
  buildFileName,
  formatUtcTimestamp,
  isValidTimestamp,
} from '../../lambda/utils/pollyUtils';

const validRequest = {
  text: 'Hello',
  voiceId: 'Joanna',
  engine: 'neural' as const,
  languageCode: 'en-US',
  outputFormat: 'mp3' as const,
  speed: 1,
};

describe('escapeXml', () => {
  it('escapes XML special characters', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;'
    );
  });
});

describe('buildSpeechInput', () => {
  it('uses plain text at 100% speed', () => {
    expect(buildSpeechInput('a < b', 1)).toEqual({
      text: 'a < b',
      textType: 'text',
    });
  });

  it('wraps escaped text with prosody when speed is not 100%', () => {
    expect(buildSpeechInput('a < b & c', 1.25)).toEqual({
      text: '<speak><prosody rate="125%">a &lt; b &amp; c</prosody></speak>',
      textType: 'ssml',
    });
    expect(buildSpeechInput('x', 0.5).text).toContain('rate="50%"');
  });
});

describe('validateSynthesizeRequest', () => {
  it('accepts a valid request', () => {
    expect(validateSynthesizeRequest(validRequest)).toBeNull();
  });

  it('accepts exactly the maximum length and rejects one more', () => {
    expect(
      validateSynthesizeRequest({
        ...validRequest,
        text: 'a'.repeat(MAX_TEXT_LENGTH),
      })
    ).toBeNull();
    expect(
      validateSynthesizeRequest({
        ...validRequest,
        text: 'a'.repeat(MAX_TEXT_LENGTH + 1),
      })
    ).toContain('3000 characters or less');
  });

  it('counts characters by code point', () => {
    expect(
      validateSynthesizeRequest({
        ...validRequest,
        text: '😀'.repeat(MAX_TEXT_LENGTH),
      })
    ).toBeNull();
  });

  it('rejects empty text, bad engine, format, speed and ids', () => {
    expect(validateSynthesizeRequest(null)).not.toBeNull();
    expect(validateSynthesizeRequest({ ...validRequest, text: '  ' })).toMatch(
      /text is required/
    );
    expect(
      validateSynthesizeRequest({
        ...validRequest,
        engine: 'foo' as never,
      })
    ).toMatch(/engine/);
    expect(
      validateSynthesizeRequest({
        ...validRequest,
        outputFormat: 'wav' as never,
      })
    ).toMatch(/outputFormat/);
    expect(validateSynthesizeRequest({ ...validRequest, speed: 2.5 })).toMatch(
      /speed/
    );
    expect(validateSynthesizeRequest({ ...validRequest, speed: 0.4 })).toMatch(
      /speed/
    );
    expect(
      validateSynthesizeRequest({ ...validRequest, voiceId: 'a/b' })
    ).toMatch(/voiceId/);
    expect(
      validateSynthesizeRequest({ ...validRequest, languageCode: '??' })
    ).toMatch(/languageCode/);
  });
});

describe('removeInvalidXmlChars / request limit', () => {
  it('removes control characters except tab, LF and CR', () => {
    expect(removeInvalidXmlChars('a\u0000b\u0008c\td\ne\rf\u001Fg\u000B')).toBe(
      'abc\td\ne\rfg'
    );
    expect(buildSpeechInput('a\u0001b', 1).text).toBe('ab');
    expect(buildSpeechInput('a\u0001<b', 1.5).text).toContain('a&lt;b');
  });

  it('checks the final request text including escaping and tags', () => {
    expect(isWithinRequestLimit('a'.repeat(6000))).toBe(true);
    expect(isWithinRequestLimit('a'.repeat(6001))).toBe(false);
    // 2000 "&" are 2000 chars as text but 10000 chars once escaped
    expect(
      isWithinRequestLimit(buildSpeechInput('&'.repeat(2000), 1.5).text)
    ).toBe(false);
  });
});

describe('mapPollyError', () => {
  const err = (name: string, httpStatusCode?: number) => ({
    name,
    message: 'arn:aws:iam::123456789012:user/secret failed',
    $metadata: { httpStatusCode },
  });

  it.each([
    ['EngineNotSupportedException', 400, 400, 'ENGINE_NOT_SUPPORTED'],
    ['LanguageNotSupportedException', 400, 400, 'LANGUAGE_NOT_SUPPORTED'],
    ['InvalidSsmlException', 400, 400, 'INVALID_SSML'],
    ['TextLengthExceededException', 400, 400, 'TEXT_TOO_LONG'],
    ['InvalidSampleRateException', 400, 400, 'INVALID_SAMPLE_RATE'],
    ['ThrottlingException', 400, 429, 'THROTTLED'],
    ['TooManyRequestsException', 429, 429, 'THROTTLED'],
    ['SomethingThrottledError', 500, 429, 'THROTTLED'],
    ['InvalidNextTokenException', 400, 400, 'INVALID_NEXT_TOKEN'],
    ['ServiceFailureException', 500, 502, 'POLLY_SERVICE_FAILURE'],
    ['AccessDeniedException', 403, 500, 'POLLY_ACCESS_DENIED'],
    ['UnrecognizedClientException', 400, 500, 'POLLY_ACCESS_DENIED'],
  ])('%s (HTTP %s) -> %s %s', (name, http, statusCode, code) => {
    const res = mapPollyError(err(name, http));
    expect(res.statusCode).toBe(statusCode);
    expect(res.code).toBe(code);
    expect(res.message).not.toContain('arn:aws');
    expect(res.message).not.toContain('123456789012');
  });

  it('mentions the required IAM permissions for access denied', () => {
    const { message } = mapPollyError(err('AccessDeniedException', 403));
    expect(message).toContain('polly:SynthesizeSpeech');
    expect(message).toContain('polly:DescribeVoices');
  });

  it('maps S3 errors while saving to STORAGE_ERROR, even if access denied', () => {
    expect(mapPollyError(err('NoSuchBucket', 404)).code).toBe('STORAGE_ERROR');
    const res = mapPollyError(err('AccessDenied', 403), { storage: true });
    expect(res).toMatchObject({ statusCode: 500, code: 'STORAGE_ERROR' });
  });

  it('returns INTERNAL_ERROR without the original message for unknown errors', () => {
    for (const e of [
      new Error('secret-bucket arn:aws:s3:::x'),
      err('SomethingElse', 418),
      null,
      undefined,
      'string error',
    ]) {
      const res = mapPollyError(e);
      expect(res).toEqual({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal Server Error',
      });
    }
  });
});

describe('SSML mode', () => {
  const ssmlRequest = { ...validRequest, textType: 'ssml' as const };

  it('does not escape or re-wrap the user SSML and ignores the speed', () => {
    expect(buildSpeechInput('A & B <break time="1s"/>', 1.5, 'ssml')).toEqual({
      text: '<speak>A & B <break time="1s"/></speak>',
      textType: 'ssml',
    });
    expect(buildSpeechInput('<speak>Hi</speak>', 0.5, 'ssml')).toEqual({
      text: '<speak>Hi</speak>',
      textType: 'ssml',
    });
  });

  it('removes invalid XML characters in SSML mode', () => {
    expect(buildSpeechInput('a\u0001b', 1, 'ssml').text).toBe(
      '<speak>ab</speak>'
    );
  });

  it('keeps the plain mode output unchanged', () => {
    expect(buildSpeechInput('a & b', 1)).toEqual({
      text: 'a & b',
      textType: 'text',
    });
    expect(buildSpeechInput('a & b', 1.5, 'text')).toEqual({
      text: '<speak><prosody rate="150%">a &amp; b</prosody></speak>',
      textType: 'ssml',
    });
  });

  it('accepts a valid SSML request and a request without textType', () => {
    expect(
      validateSynthesizeRequest({
        ...ssmlRequest,
        text: 'Hello <break time="1s"/> world',
      })
    ).toBeNull();
    expect(validateSynthesizeRequest(validRequest)).toBeNull();
  });

  it('rejects an invalid textType', () => {
    expect(
      validateSynthesizeRequest({
        ...validRequest,
        textType: 'html' as unknown as 'ssml',
      })
    ).toMatch(/textType/);
  });

  it('counts only billed characters against the 3000 limit', () => {
    const tags = '<break time="1s"/>';
    // 3000 billed characters + many tags is accepted by the billed-characters check
    expect(
      validateSynthesizeRequest({
        ...ssmlRequest,
        text: `${'a'.repeat(3000)}${tags}`,
      })
    ).toBeNull();
    expect(
      validateSynthesizeRequestDetailed({
        ...ssmlRequest,
        text: `${'a'.repeat(3001)}${tags}`,
      })
    ).toMatchObject({ code: 'TEXT_TOO_LONG' });
  });

  it('keeps INVALID_REQUEST for plain text over the limit', () => {
    expect(
      validateSynthesizeRequestDetailed({
        ...validRequest,
        text: 'a'.repeat(3001),
      })
    ).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('rejects unsupported tags for the engine with INVALID_SSML', () => {
    const r = validateSynthesizeRequestDetailed({
      ...ssmlRequest,
      engine: 'neural',
      text: '<emphasis>a</emphasis>',
    });
    expect(r?.code).toBe('INVALID_SSML');
    expect(r?.message).toContain('<emphasis>');
    expect(r?.message).toContain('neural');
    expect(
      validateSynthesizeRequest({
        ...ssmlRequest,
        engine: 'standard',
        text: '<emphasis>a</emphasis>',
      })
    ).toBeNull();
  });

  it('rejects malformed SSML', () => {
    expect(
      validateSynthesizeRequestDetailed({ ...ssmlRequest, text: '<p>a' })?.code
    ).toBe('INVALID_SSML');
  });

  it('checks the 6000 character limit of the whole request', () => {
    // 2000 billed characters (&amp; is one) but 10000 characters in total
    const text = '&amp;'.repeat(2000);
    expect(validateSynthesizeRequest({ ...ssmlRequest, text })).toBeNull();
    expect(isWithinRequestLimit(buildSpeechInput(text, 1, 'ssml').text)).toBe(
      false
    );
    expect(
      isWithinRequestLimit(buildSpeechInput('a'.repeat(5985), 1, 'ssml').text)
    ).toBe(true);
    expect(
      isWithinRequestLimit(buildSpeechInput('a'.repeat(5986), 1, 'ssml').text)
    ).toBe(false);
  });
});

describe('file name timestamp', () => {
  it('formats UTC with zero padding, midnight and end of year', () => {
    expect(formatUtcTimestamp(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe(
      '20260102-030405'
    );
    expect(formatUtcTimestamp(new Date(Date.UTC(2026, 10, 8, 0, 0, 0)))).toBe(
      '20261108-000000'
    );
    expect(
      formatUtcTimestamp(new Date(Date.UTC(2026, 11, 31, 23, 59, 59)))
    ).toBe('20261231-235959');
  });

  it('accepts valid timestamps', () => {
    for (const v of ['20261108-173045', '20260101-000000', '20261231-235959']) {
      expect(isValidTimestamp(v)).toBe(true);
    }
  });

  it('rejects invalid timestamps', () => {
    for (const v of [
      '2026-11-08',
      '20261108-1730',
      '20261308-000000',
      '20261108-246000',
      '20261100-000000',
      '20261108-006000',
      '20261108-000060',
      '../20261108-17304',
      '20261108-173045"',
      '20261108-173045\n',
      '20261108-173045;',
      '../../20261108-173045',
      undefined,
      20261108,
    ]) {
      expect(isValidTimestamp(v)).toBe(false);
    }
  });

  it('builds the file name from the client timestamp', () => {
    expect(buildFileName('Kazuha', 'mp3', '20261108-173045')).toBe(
      'speech-kazuha-20261108-173045.mp3'
    );
  });

  it('falls back to the current UTC time when missing or invalid', () => {
    const now = new Date(Date.UTC(2026, 10, 8, 17, 30, 45));
    const expected = 'speech-joanna-20261108-173045.ogg';
    expect(buildFileName('Joanna', 'ogg', undefined, now)).toBe(expected);
    expect(buildFileName('Joanna', 'ogg', '../x";', now)).toBe(expected);
  });
});
