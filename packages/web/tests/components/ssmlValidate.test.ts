/* eslint-disable i18nhelper/no-jp-string */
// The Japanese examples are SSML samples, not UI text.
import { describe, expect, it } from 'vitest';
import { validateSsml } from '../../src/utils/ssmlValidate';

const keys = (ssml: string, engine: Parameters<typeof validateSsml>[1]) =>
  validateSsml(ssml, engine).errors.map((i) => i.key);

describe('validateSsml', () => {
  it('accepts empty text', () => {
    expect(validateSsml('', 'neural')).toEqual({ errors: [], warnings: [] });
  });

  it('accepts valid SSML, with or without <speak>', () => {
    expect(keys('Hello<break time="500ms"/>world', 'neural')).toEqual([]);
    expect(keys('<speak>Hello</speak>', 'neural')).toEqual([]);
    expect(keys('<s>One.</s><s>Two.</s>', 'long-form')).toEqual([]);
  });

  it('accepts the sub and yomigana examples', () => {
    expect(keys('<sub alias="ジェンユー">GenU</sub>', 'neural')).toEqual([]);
    expect(
      keys(
        '名前は<phoneme alphabet="x-amazon-yomigana" ph="ひろかず">浩一</phoneme>です。',
        'neural'
      )
    ).toEqual([]);
  });

  it('accepts the amazon: prefix and escaped reserved characters', () => {
    expect(
      keys(
        '<amazon:effect name="drc">a &amp; b &lt; c &apos;</amazon:effect>',
        'neural'
      )
    ).toEqual([]);
  });

  it.each([
    ['unbalanced tag', '<p>Hello'],
    ['wrong nesting', '<p><s>Hello</p></s>'],
    ['unescaped &', 'Tom & Jerry'],
    ['unescaped <', '1 < 2'],
  ])('rejects %s as malformed', (_n, ssml) => {
    expect(keys(ssml, 'neural')).toEqual(['malformed']);
  });

  it.each(['audio', 'lexicon', 'lookup', 'voice'])(
    'always rejects <%s>',
    (tag) => {
      for (const engine of [
        'standard',
        'neural',
        'generative',
        'long-form',
      ] as const) {
        expect(keys(`<${tag} name="x">a</${tag}>`, engine)).toEqual([
          'forbidden_tag',
        ]);
      }
    }
  );

  it('rejects tags the engine does not support, naming the tag and engine', () => {
    const r = validateSsml('<emphasis>Hi</emphasis>', 'neural');
    expect(r.errors).toEqual([
      {
        level: 'error',
        key: 'unsupported_tag',
        params: { tag: '<emphasis>', engine: 'neural' },
      },
    ]);
    expect(keys('<emphasis>Hi</emphasis>', 'standard')).toEqual([]);
    expect(
      validateSsml(
        '<amazon:effect name="whispered">a</amazon:effect>',
        'neural'
      ).errors[0].params
    ).toEqual({ tag: '<amazon:effect name="whispered">', engine: 'neural' });
    expect(
      keys('<amazon:auto-breaths>a</amazon:auto-breaths>', 'long-form')
    ).toEqual(['unsupported_tag']);
    expect(
      keys('<amazon:effect name="drc">a</amazon:effect>', 'generative')
    ).toEqual(['unsupported_tag']);
    expect(
      keys('<amazon:effect name="drc">a</amazon:effect>', 'long-form')
    ).toEqual([]);
  });

  it('rejects unknown tags', () => {
    expect(keys('<blink>a</blink>', 'standard')).toEqual(['unknown_tag']);
  });

  it('limits <break> to 10 seconds', () => {
    expect(keys('<break time="10s"/>', 'neural')).toEqual([]);
    expect(keys('<break time="10000ms"/>', 'neural')).toEqual([]);
    expect(keys('<break time="10.5s"/>', 'neural')).toEqual(['break_time']);
    expect(keys('<break time="10001ms"/>', 'neural')).toEqual(['break_time']);
    expect(keys('<break time="soon"/>', 'neural')).toEqual(['break_time']);
    expect(keys('<break strength="strong"/>', 'neural')).toEqual([]);
  });

  it('limits the prosody rate to 20-200% or keywords', () => {
    expect(keys('<prosody rate="20%">a</prosody>', 'neural')).toEqual([]);
    expect(keys('<prosody rate="200%">a</prosody>', 'neural')).toEqual([]);
    expect(keys('<prosody rate="19%">a</prosody>', 'neural')).toEqual([
      'prosody_rate',
    ]);
    expect(keys('<prosody rate="201%">a</prosody>', 'neural')).toEqual([
      'prosody_rate',
    ]);
    expect(keys('<prosody rate="fast">a</prosody>', 'neural')).toEqual([]);
    expect(keys('<prosody rate="x-slow">a</prosody>', 'neural')).toEqual([]);
    expect(keys('<prosody rate="quick">a</prosody>', 'neural')).toEqual([
      'prosody_rate',
    ]);
  });

  it('rejects pitch on neural, generative and long-form only', () => {
    for (const engine of ['neural', 'generative', 'long-form'] as const) {
      expect(keys('<prosody pitch="high">a</prosody>', engine)).toEqual([
        'prosody_pitch',
      ]);
    }
    expect(keys('<prosody pitch="high">a</prosody>', 'standard')).toEqual([]);
  });

  it('requires alphabet and ph on <phoneme>', () => {
    expect(keys('<phoneme alphabet="ipa">a</phoneme>', 'neural')).toEqual([
      'phoneme_attrs',
    ]);
    expect(keys('<phoneme ph="a">a</phoneme>', 'neural')).toEqual([
      'phoneme_attrs',
    ]);
    expect(
      keys('<phoneme alphabet="ipa" ph="a">a</phoneme>', 'neural')
    ).toEqual([]);
  });

  it('warns without blocking', () => {
    expect(
      validateSsml('<say-as interpret-as="characters">AB</say-as>', 'neural')
    ).toEqual({
      errors: [],
      warnings: [{ level: 'warning', key: 'warn_say_as_characters' }],
    });
    expect(
      validateSsml('<say-as interpret-as="characters">AB</say-as>', 'standard')
        .warnings
    ).toEqual([]);
    expect(
      validateSsml('<prosody rate="90%">A.</prosody>', 'generative').warnings
    ).toEqual([{ level: 'warning', key: 'warn_prosody_generative' }]);
  });

  it('re-evaluates when the engine changes', () => {
    const ssml = '<emphasis>a</emphasis>';
    expect(keys(ssml, 'standard')).toEqual([]);
    expect(keys(ssml, 'neural')).toEqual(['unsupported_tag']);
  });
});
