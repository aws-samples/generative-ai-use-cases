import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeTranscribeLanguageOptions } from '@generative-ai-use-cases/common';
import {
  TRANSCRIBE_LANGUAGE_OPTIONS_STORAGE_KEY,
  getTranscribeLanguageOptions,
  isLanguageWithoutWordSpaces,
  parseTranscribeLanguageOptions,
} from '../../src/utils/AudioUtils';

describe('sanitizeTranscribeLanguageOptions', () => {
  it('keeps a valid selection', () => {
    expect(sanitizeTranscribeLanguageOptions(['ja-JP', 'zh-CN'])).toEqual([
      'ja-JP',
      'zh-CN',
    ]);
  });

  it('drops unknown codes and duplicates', () => {
    expect(
      sanitizeTranscribeLanguageOptions(['ja-JP', 'xx-XX', 'ja-JP', 'ko-KR'])
    ).toEqual(['ja-JP', 'ko-KR']);
  });

  it('caps the list at five languages', () => {
    expect(
      sanitizeTranscribeLanguageOptions([
        'ja-JP',
        'en-US',
        'zh-CN',
        'ko-KR',
        'th-TH',
        'vi-VN',
      ])
    ).toHaveLength(5);
  });

  it('falls back to Japanese and English with fewer than two languages', () => {
    expect(sanitizeTranscribeLanguageOptions(['zh-CN'])).toEqual([
      'ja-JP',
      'en-US',
    ]);
    expect(sanitizeTranscribeLanguageOptions('ja-JP')).toEqual([
      'ja-JP',
      'en-US',
    ]);
    expect(sanitizeTranscribeLanguageOptions(undefined)).toEqual([
      'ja-JP',
      'en-US',
    ]);
  });
});

describe('the user setting', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to Japanese and English', () => {
    expect(getTranscribeLanguageOptions()).toEqual(['ja-JP', 'en-US']);
  });

  it('reads the languages chosen on the Settings page', () => {
    localStorage.setItem(
      TRANSCRIBE_LANGUAGE_OPTIONS_STORAGE_KEY,
      JSON.stringify(['en-US', 'zh-CN', 'ko-KR'])
    );
    expect(getTranscribeLanguageOptions()).toEqual(['en-US', 'zh-CN', 'ko-KR']);
  });

  it('ignores a broken stored value', () => {
    expect(parseTranscribeLanguageOptions('not json')).toEqual([
      'ja-JP',
      'en-US',
    ]);
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
