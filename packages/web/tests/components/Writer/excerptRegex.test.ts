import { describe, it, expect } from 'vitest';
import { buildExcerptRegex } from '../../../src/components/Writer/lib/excerptRegex';

const find = (excerpt: string, text: string) =>
  [...text.matchAll(buildExcerptRegex(excerpt)!)].map((m) => m[0]);

describe('buildExcerptRegex', () => {
  it('matches the excerpt across any whitespace, including none', () => {
    expect(find('foo bar', 'x foo  bar y')).toEqual(['foo  bar']);
    expect(find('foo\n bar', 'foo\n\nbar')).toEqual(['foo\n\nbar']);
    expect(find('foo bar', 'foobar')).toEqual(['foobar']);
  });

  it('treats regular expression characters as text', () => {
    expect(find('a.b (c)', 'axb (c) a.b (c)')).toEqual(['a.b (c)']);
  });

  it('does not include whitespace around the excerpt', () => {
    expect(find('  foo \n', 'a foo b')).toEqual(['foo']);
  });

  it('returns null for an excerpt with no text', () => {
    expect(buildExcerptRegex('')).toBeNull();
    expect(buildExcerptRegex(' \n ')).toBeNull();
  });

  it('stays fast on a long run of whitespace', () => {
    // An excerpt with several line breaks, against text where it almost
    // matches. Before, this did not finish within a minute.
    const text = 'a' + ' '.repeat(100_000) + 'c';
    const start = performance.now();
    expect(find('a\n \n \n b', text)).toEqual([]);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
