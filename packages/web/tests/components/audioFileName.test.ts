import { describe, expect, it } from 'vitest';
import {
  formatLocalTimestamp,
  makeUniqueFileName,
} from '../../src/utils/audioFileName';

describe('formatLocalTimestamp', () => {
  it('zero pads', () => {
    expect(formatLocalTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toBe(
      '20260102-030405'
    );
  });
  it('handles midnight', () => {
    expect(formatLocalTimestamp(new Date(2026, 10, 8, 0, 0, 0))).toBe(
      '20261108-000000'
    );
  });
  it('handles the end of the year', () => {
    expect(formatLocalTimestamp(new Date(2026, 11, 31, 23, 59, 59))).toBe(
      '20261231-235959'
    );
  });
});

describe('makeUniqueFileName', () => {
  const base = 'speech-kazuha-20261108-173045.mp3';
  it('keeps the name when there is no previous one', () => {
    expect(makeUniqueFileName(base, null)).toBe(base);
  });
  it('keeps the name when it differs from the last one', () => {
    expect(makeUniqueFileName(base, 'speech-kazuha-20261108-173044.mp3')).toBe(
      base
    );
    expect(makeUniqueFileName(base, 'speech-kazuha-20261108-173045.ogg')).toBe(
      base
    );
  });
  it('appends -2, -3, ... for the same name', () => {
    const second = makeUniqueFileName(base, base);
    expect(second).toBe('speech-kazuha-20261108-173045-2.mp3');
    expect(makeUniqueFileName(base, second)).toBe(
      'speech-kazuha-20261108-173045-3.mp3'
    );
  });
});
