import { describe, it, expect } from 'vitest';
import {
  isLanguageWithoutWordSpaces,
  parseTranscribeLanguageOptions,
} from '../../src/utils/AudioUtils';

describe('parseTranscribeLanguageOptions', () => {
  it('turns the deploy parameter into the list Transcribe streaming takes', () => {
    expect(parseTranscribeLanguageOptions('["ja-JP","en-US","zh-CN"]')).toBe(
      'ja-JP,en-US,zh-CN'
    );
  });

  it('falls back to Japanese and English when the parameter is missing or invalid', () => {
    expect(parseTranscribeLanguageOptions(undefined)).toBe('ja-JP,en-US');
    expect(parseTranscribeLanguageOptions('')).toBe('ja-JP,en-US');
    expect(parseTranscribeLanguageOptions('not json')).toBe('ja-JP,en-US');
    // Transcribe needs at least two candidates
    expect(parseTranscribeLanguageOptions('["ja-JP"]')).toBe('ja-JP,en-US');
    expect(parseTranscribeLanguageOptions('["ja-JP", 1]')).toBe('ja-JP,en-US');
  });
});

describe('isLanguageWithoutWordSpaces', () => {
  it('removes word spaces for Japanese and Chinese only', () => {
    expect(isLanguageWithoutWordSpaces('ja-JP')).toBe(true);
    expect(isLanguageWithoutWordSpaces('zh-CN')).toBe(true);
    expect(isLanguageWithoutWordSpaces('en-US')).toBe(false);
    expect(isLanguageWithoutWordSpaces('ko-KR')).toBe(false);
  });
});
