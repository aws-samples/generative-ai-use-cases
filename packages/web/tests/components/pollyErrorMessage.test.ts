import { describe, expect, it } from 'vitest';
import { getPollyErrorMessage } from '../../src/utils/pollyErrorMessage';

const t = (key: string) => `t:${key}`;
const apiError = (data: unknown) => ({ response: { data } });

describe('getPollyErrorMessage', () => {
  it('uses the localized text for a known code', () => {
    expect(
      getPollyErrorMessage(
        apiError({ code: 'ENGINE_NOT_SUPPORTED', message: 'server text' }),
        t
      )
    ).toBe('t:textToSpeech.error_engine_not_supported');
    expect(getPollyErrorMessage(apiError({ code: 'THROTTLED' }), t)).toBe(
      't:textToSpeech.error_throttled'
    );
  });

  it('falls back to the server message for an unknown code', () => {
    expect(
      getPollyErrorMessage(apiError({ code: 'NEW_CODE', message: 'hello' }), t)
    ).toBe('hello');
    expect(getPollyErrorMessage(apiError({ message: 'hello' }), t)).toBe(
      'hello'
    );
  });

  it('falls back to the generic message and never shows client errors', () => {
    expect(getPollyErrorMessage(new Error('Network Error'), t)).toBe(
      't:textToSpeech.error_generic'
    );
    expect(getPollyErrorMessage(apiError({}), t)).toBe(
      't:textToSpeech.error_generic'
    );
    expect(getPollyErrorMessage(undefined, t)).toBe(
      't:textToSpeech.error_generic'
    );
  });
});
