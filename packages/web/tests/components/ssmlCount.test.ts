/* eslint-disable i18nhelper/no-jp-string */
// The Japanese examples are SSML samples, not UI text.
import { describe, expect, it } from 'vitest';
import {
  countBilledCharacters,
  countRequestCharacters,
  wrapSpeak,
} from '../../src/utils/ssmlCount';

describe('countBilledCharacters', () => {
  it('returns 0 for empty text and for tags only', () => {
    expect(countBilledCharacters('')).toBe(0);
    expect(countBilledCharacters('<break time="1s"/>')).toBe(0);
  });
  it('removes tags and keeps the text', () => {
    expect(
      countBilledCharacters('<speak>Hello<break time="1s"/></speak>')
    ).toBe(5);
  });
  it('counts Japanese by code points', () => {
    expect(
      countBilledCharacters(
        '名前は<phoneme alphabet="x-amazon-yomigana" ph="ひろかず">浩一</phoneme>です。'
      )
    ).toBe(8);
    expect(countBilledCharacters('<sub alias="ジェンユー">GenU</sub>')).toBe(4);
  });
  it('counts an emoji (surrogate pair) as one character', () => {
    expect(countBilledCharacters('😀😀<s>😀</s>')).toBe(3);
  });
  it('counts an entity as one character', () => {
    expect(countBilledCharacters('a&amp;b &lt;&gt; &#12354;')).toBe(8);
  });
  it('does not bill comments and keeps a trailing newline', () => {
    expect(countBilledCharacters('a<!-- c -->b\n')).toBe(3);
  });
});

describe('countRequestCharacters', () => {
  it('counts tags and entities, including the <speak> wrapper', () => {
    expect(countRequestCharacters('a&amp;')).toBe(
      Array.from('<speak>a&amp;</speak>').length
    );
  });
  it('does not add the wrapper twice', () => {
    expect(countRequestCharacters('<speak>a</speak>')).toBe(16);
  });
  it('wrapSpeak keeps SSML that starts with <speak', () => {
    expect(wrapSpeak('<speak>a</speak>')).toBe('<speak>a</speak>');
    expect(wrapSpeak('a')).toBe('<speak>a</speak>');
  });
});
