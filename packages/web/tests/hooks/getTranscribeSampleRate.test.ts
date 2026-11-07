import { describe, expect, test } from 'vitest';
import { getTranscribeSampleRate } from '../../src/utils/AudioUtils';

describe('getTranscribeSampleRate', () => {
  test.each([8000, 16000, 44100, 48000])(
    'returns %i Hz as is when Transcribe supports it',
    (sampleRate) => {
      expect(getTranscribeSampleRate(sampleRate)).toBe(sampleRate);
    }
  );

  test('rounds a non-integer sample rate to an integer', () => {
    expect(getTranscribeSampleRate(44100.4)).toBe(44100);
  });

  test.each([7999, 96000, 0, NaN, Infinity])(
    'throws when the sample rate is %s Hz',
    (sampleRate) => {
      expect(() => getTranscribeSampleRate(sampleRate)).toThrow(
        /Unsupported audio sample rate/
      );
    }
  );
});
