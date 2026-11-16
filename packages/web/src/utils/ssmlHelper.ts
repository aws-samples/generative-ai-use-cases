/* eslint-disable i18nhelper/no-jp-string */
// The Japanese examples are SSML samples, not UI text.
import type { SsmlTagId } from './ssmlTags';

// Options of the SSML insert toolbar.
// https://docs.aws.amazon.com/polly/latest/dg/say-as-tag.html
// https://docs.aws.amazon.com/polly/latest/dg/phoneme-tag.html

export const PAUSE_OPTIONS = ['250ms', '500ms', '1s', '2s'];

export type SayAsType =
  | 'digits'
  | 'cardinal'
  | 'ordinal'
  | 'date'
  | 'telephone';

// Languages where interpret-as="telephone" is available
const TELEPHONE_LANGUAGES = [
  'en-AU',
  'en-GB',
  'en-IN',
  'en-US',
  'en-GB-WLS',
  'es-ES',
  'es-MX',
  'es-US',
  'fr-FR',
  'fr-CA',
  'pt-BR',
  'pt-PT',
  'de-DE',
  'it-IT',
  'ja-JP',
  'ru-RU',
];

/** interpret-as values that are valid for the language. */
export const getSayAsTypes = (languageCode: string): SayAsType[] => {
  const types: SayAsType[] = ['digits', 'cardinal', 'ordinal', 'date'];
  if (TELEPHONE_LANGUAGES.includes(languageCode)) types.push('telephone');
  return types;
};

/** Value of the format attribute required by interpret-as="date". */
export const getDateFormat = (languageCode: string): string => {
  const lang = languageCode.split('-')[0];
  if (['ja', 'ko', 'cmn', 'yue', 'zh'].includes(lang)) return 'ymd';
  return languageCode === 'en-US' ? 'mdy' : 'dmy';
};

/** Phoneme alphabets for the language; the first one is the default. */
export const getPhonemeAlphabets = (languageCode: string): string[] => {
  const lang = languageCode.split('-')[0];
  if (lang === 'ja') {
    return ['x-amazon-yomigana', 'x-amazon-pron-kana', 'ipa'];
  }
  if (lang === 'cmn' || lang === 'yue') {
    return ['x-amazon-pinyin', 'ipa'];
  }
  return ['ipa', 'x-sampa'];
};

export type ProsodyOption = { id: string; attribute: string };

// Only rate and volume: pitch is not supported by neural, generative and long-form
export const PROSODY_OPTIONS: ProsodyOption[] = [
  { id: 'rate-80', attribute: 'rate="80%"' },
  { id: 'rate-90', attribute: 'rate="90%"' },
  { id: 'rate-110', attribute: 'rate="110%"' },
  { id: 'rate-120', attribute: 'rate="120%"' },
  { id: 'volume-soft', attribute: 'volume="soft"' },
  { id: 'volume-loud', attribute: 'volume="loud"' },
];

export const LANG_OPTIONS = [
  'en-US',
  'en-GB',
  'ja-JP',
  'ko-KR',
  'cmn-CN',
  'fr-FR',
  'de-DE',
  'es-ES',
];

// Tags of the toolbar buttons
export const TOOLBAR_TAGS = {
  pause: 'break',
  sayAs: 'say-as',
  sub: 'sub',
  phoneme: 'phoneme',
  prosody: 'prosody',
  lang: 'lang',
  paragraph: 'p',
  sentence: 's',
} as const satisfies Record<string, SsmlTagId>;

export type SsmlGuideEntry = {
  id: string;
  tag: string;
  tagId: SsmlTagId;
  example: string;
};

// Tags listed in the guide dialog, with a copyable example for each
export const SSML_GUIDE_ENTRIES: SsmlGuideEntry[] = [
  {
    id: 'speak',
    tag: '<speak>',
    tagId: 'speak',
    example: '<speak>Hello, world.</speak>',
  },
  {
    id: 'break',
    tag: '<break>',
    tagId: 'break',
    example: 'Hello.<break time="1s"/>Nice to meet you.',
  },
  {
    id: 'p',
    tag: '<p>',
    tagId: 'p',
    example: '<p>First paragraph.</p><p>Second paragraph.</p>',
  },
  {
    id: 's',
    tag: '<s>',
    tagId: 's',
    example: '<s>First sentence.</s><s>Second sentence.</s>',
  },
  {
    id: 'sub',
    tag: '<sub>',
    tagId: 'sub',
    example: '<sub alias="ジェンユー">GenU</sub>',
  },
  {
    id: 'phoneme_yomigana',
    tag: '<phoneme>',
    tagId: 'phoneme',
    example:
      '名前は<phoneme alphabet="x-amazon-yomigana" ph="ひろかず">浩一</phoneme>です。',
  },
  {
    id: 'phoneme_ipa',
    tag: '<phoneme>',
    tagId: 'phoneme',
    example: '<phoneme alphabet="ipa" ph="pɪˈkɑːn">pecan</phoneme>',
  },
  {
    id: 'say-as',
    tag: '<say-as>',
    tagId: 'say-as',
    example: '<say-as interpret-as="digits">12345</say-as>',
  },
  {
    id: 'prosody',
    tag: '<prosody>',
    tagId: 'prosody',
    example: '<prosody rate="80%" volume="loud">Slow and loud.</prosody>',
  },
  {
    id: 'lang',
    tag: '<lang>',
    tagId: 'lang',
    example: 'Say <lang xml:lang="fr-FR">bonjour</lang> in French.',
  },
  {
    id: 'w',
    tag: '<w>',
    tagId: 'w',
    example: 'I <w role="amazon:VBD">read</w> the book yesterday.',
  },
  {
    id: 'mark',
    tag: '<mark>',
    tagId: 'mark',
    example: 'Go from <mark name="a"/>here to <mark name="b"/>there.',
  },
  {
    id: 'emphasis',
    tag: '<emphasis>',
    tagId: 'emphasis',
    example: 'This is <emphasis level="strong">really</emphasis> important.',
  },
  {
    id: 'drc',
    tag: '<amazon:effect name="drc">',
    tagId: 'effect-drc',
    example:
      '<amazon:effect name="drc">Evenly loud speech for noisy places.</amazon:effect>',
  },
  {
    id: 'whispered',
    tag: '<amazon:effect name="whispered">',
    tagId: 'effect-other',
    example:
      '<amazon:effect name="whispered">This is a secret.</amazon:effect>',
  },
  {
    id: 'auto-breaths',
    tag: '<amazon:auto-breaths>',
    tagId: 'auto-breaths',
    example:
      '<amazon:auto-breaths>A long sentence with natural breathing.</amazon:auto-breaths>',
  },
];
