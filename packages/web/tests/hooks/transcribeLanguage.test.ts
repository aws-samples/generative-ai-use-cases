import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS,
  isLanguageWithoutWordSpaces,
} from '../../src/utils/AudioUtils';

describe('Transcribe language defaults', () => {
  it('identifies English, Japanese and Chinese by default', () => {
    const options = DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS.split(',');
    expect(options).toEqual(['en-US', 'ja-JP', 'zh-CN']);
    // Transcribe allows only one dialect per language.
    const languages = options.map((o) => o.split('-')[0]);
    expect(new Set(languages).size).toBe(languages.length);
  });

  it('removes word spaces for Japanese and Chinese only', () => {
    expect(isLanguageWithoutWordSpaces('ja-JP')).toBe(true);
    expect(isLanguageWithoutWordSpaces('zh-CN')).toBe(true);
    expect(isLanguageWithoutWordSpaces('en-US')).toBe(false);
    expect(isLanguageWithoutWordSpaces('ko-KR')).toBe(false);
  });
});
