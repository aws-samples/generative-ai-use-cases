import { describe, it, expect } from 'vitest';
import { getLanguageLabel } from '../../src/utils/pollyLanguageLabel';

describe('getLanguageLabel', () => {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });

  it('does not throw for en-GB-WLS and falls back to the API name', () => {
    expect(() =>
      getLanguageLabel(displayNames, 'en-GB-WLS', 'Welsh English')
    ).not.toThrow();
    expect(getLanguageLabel(displayNames, 'en-GB-WLS', 'Welsh English')).toBe(
      'Welsh English (en-GB-WLS)'
    );
  });

  it('uses the localized name for a normal code', () => {
    expect(getLanguageLabel(displayNames, 'ja-JP', 'Japanese')).toBe(
      'Japanese (Japan) (ja-JP)'
    );
  });

  it('falls back to the API name when DisplayNames is unavailable', () => {
    expect(getLanguageLabel(null, 'ja-JP', 'Japanese')).toBe(
      'Japanese (ja-JP)'
    );
  });
});
