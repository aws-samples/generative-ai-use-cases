/* eslint-disable i18nhelper/no-jp-string */
// The Japanese examples are SSML samples, not UI text.
import { describe, expect, it } from 'vitest';
import { PollyEngine } from 'generative-ai-use-cases';
import {
  SSML_TAG_SUPPORT,
  SsmlTagId,
  getTagSupport,
  resolveTagId,
} from '../../src/utils/ssmlTags';
import {
  SSML_GUIDE_ENTRIES,
  getDateFormat,
  getPhonemeAlphabets,
  getSayAsTypes,
} from '../../src/utils/ssmlHelper';

const tagsOf = (engine: PollyEngine, level: 'none' | 'partial') =>
  (Object.keys(SSML_TAG_SUPPORT) as SsmlTagId[])
    .filter((id) => getTagSupport(id, engine) === level)
    .sort();

describe('tag support per engine', () => {
  it('standard: everything except the news domain', () => {
    expect(tagsOf('standard', 'none')).toEqual(['domain']);
  });
  it('neural: no emphasis, auto-breaths, domain and other effects', () => {
    expect(tagsOf('neural', 'none')).toEqual([
      'auto-breaths',
      'domain',
      'effect-other',
      'emphasis',
    ]);
    expect(getTagSupport('prosody', 'neural')).toBe('partial');
    expect(getTagSupport('say-as', 'neural')).toBe('partial');
    expect(getTagSupport('effect-drc', 'neural')).toBe('full');
  });
  it('generative: no drc either, partial mark, phoneme and prosody', () => {
    expect(tagsOf('generative', 'none')).toEqual([
      'auto-breaths',
      'domain',
      'effect-drc',
      'effect-other',
      'emphasis',
    ]);
    expect(tagsOf('generative', 'partial')).toEqual([
      'mark',
      'phoneme',
      'prosody',
    ]);
  });
  it('long-form: drc and phoneme are available', () => {
    expect(tagsOf('long-form', 'none')).toEqual([
      'auto-breaths',
      'domain',
      'effect-other',
      'emphasis',
    ]);
    expect(getTagSupport('effect-drc', 'long-form')).toBe('full');
  });
  it('resolves amazon:effect by its name', () => {
    expect(
      resolveTagId({ name: 'amazon:effect', attrs: { name: 'drc' } })
    ).toBe('effect-drc');
    expect(
      resolveTagId({ name: 'amazon:effect', attrs: { name: 'whispered' } })
    ).toBe('effect-other');
    expect(resolveTagId({ name: 'blink', attrs: {} })).toBeNull();
  });
  it('every guide entry has a known tag and a non-empty example', () => {
    for (const e of SSML_GUIDE_ENTRIES) {
      expect(SSML_TAG_SUPPORT[e.tagId]).toBeDefined();
      expect(e.example.length).toBeGreaterThan(0);
    }
    const examples = SSML_GUIDE_ENTRIES.map((e) => e.example);
    expect(examples).toContain('<sub alias="ジェンユー">GenU</sub>');
    expect(examples).toContain(
      '名前は<phoneme alphabet="x-amazon-yomigana" ph="ひろかず">浩一</phoneme>です。'
    );
  });
});

describe('toolbar options by language', () => {
  it('shows telephone only for the languages that support it', () => {
    expect(getSayAsTypes('ja-JP')).toContain('telephone');
    expect(getSayAsTypes('en-US')).toContain('telephone');
    expect(getSayAsTypes('ko-KR')).not.toContain('telephone');
    expect(getSayAsTypes('th-TH')).toEqual([
      'digits',
      'cardinal',
      'ordinal',
      'date',
    ]);
  });
  it('picks the default phonetic alphabet by language', () => {
    expect(getPhonemeAlphabets('ja-JP')[0]).toBe('x-amazon-yomigana');
    expect(getPhonemeAlphabets('cmn-CN')[0]).toBe('x-amazon-pinyin');
    expect(getPhonemeAlphabets('yue-CN')[0]).toBe('x-amazon-pinyin');
    expect(getPhonemeAlphabets('en-US')[0]).toBe('ipa');
    expect(getPhonemeAlphabets('ko-KR')[0]).toBe('ipa');
  });
  it('picks a date format', () => {
    expect(getDateFormat('ja-JP')).toBe('ymd');
    expect(getDateFormat('en-US')).toBe('mdy');
    expect(getDateFormat('fr-FR')).toBe('dmy');
  });
});
