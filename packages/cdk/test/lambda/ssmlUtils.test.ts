/* eslint-disable i18nhelper/no-jp-string */
// The Japanese examples are SSML samples, not UI text.
import {
  SSML_TAG_SUPPORT,
  checkSsmlElements,
  countBilledCharacters,
  parseSsml,
  validateSsml,
  wrapSpeak,
} from '../../lambda/utils/ssmlUtils';

describe('wrapSpeak', () => {
  it('wraps SSML that does not start with <speak', () => {
    expect(wrapSpeak('Hi <break time="1s"/>')).toBe(
      '<speak>Hi <break time="1s"/></speak>'
    );
  });
  it('does not wrap twice', () => {
    expect(wrapSpeak('<speak>Hi</speak>')).toBe('<speak>Hi</speak>');
    expect(wrapSpeak('  <speak version="1.0">Hi</speak>')).toBe(
      '  <speak version="1.0">Hi</speak>'
    );
  });
  it('wraps a tag whose name only starts with speak', () => {
    expect(wrapSpeak('<speaker/>')).toBe('<speak><speaker/></speak>');
  });
});

describe('countBilledCharacters', () => {
  it('excludes tags, counts Japanese by code points', () => {
    expect(
      countBilledCharacters(
        '名前は<phoneme alphabet="x-amazon-yomigana" ph="ひろかず">浩一</phoneme>です。'
      )
    ).toBe(8);
  });
  it('counts emoji as one character and entities as one', () => {
    expect(countBilledCharacters('😀<p>a &amp; b</p>')).toBe(6);
  });
  it('ignores comments', () => {
    expect(countBilledCharacters('a<!-- hidden -->b')).toBe(2);
  });
});

describe('parseSsml', () => {
  it('accepts balanced SSML', () => {
    const r = parseSsml(
      '<speak><sub alias="ジェンユー">GenU</sub><break time="1s"/> a &amp; b</speak>'
    );
    expect(r.ok).toBe(true);
  });
  it('accepts the amazon: prefix', () => {
    expect(
      parseSsml('<speak><amazon:effect name="drc">a</amazon:effect></speak>').ok
    ).toBe(true);
  });
  it.each([
    ['unclosed tag', '<speak><p>a</speak>'],
    ['wrong nesting', '<speak><p><s>a</p></s></speak>'],
    ['extra closing tag', '<speak>a</p></speak>'],
    ['stray <', '<speak>1 < 2</speak>'],
    ['stray &', '<speak>a & b</speak>'],
    ['unquoted attribute', '<speak><break time=1s/></speak>'],
    ['text after the root', '<speak>a</speak>b'],
    ['two roots', '<speak>a</speak><speak>b</speak>'],
  ])('rejects %s', (_name, ssml) => {
    expect(parseSsml(ssml).ok).toBe(false);
  });
});

describe('tag support table', () => {
  it('follows the Polly documentation', () => {
    expect(SSML_TAG_SUPPORT.emphasis.neural).toBe('none');
    expect(SSML_TAG_SUPPORT.emphasis.standard).toBe('full');
    expect(SSML_TAG_SUPPORT['effect-drc']['long-form']).toBe('full');
    expect(SSML_TAG_SUPPORT['effect-drc'].generative).toBe('none');
    expect(SSML_TAG_SUPPORT.domain.standard).toBe('none');
  });
});

describe('validateSsml', () => {
  it('accepts the Japanese examples on neural', () => {
    expect(validateSsml('<sub alias="ジェンユー">GenU</sub>', 'neural')).toBe(
      null
    );
    expect(
      validateSsml(
        '名前は<phoneme alphabet="x-amazon-yomigana" ph="ひろかず">浩一</phoneme>です。',
        'neural'
      )
    ).toBe(null);
  });
  it('rejects unsupported and forbidden tags with the tag and engine', () => {
    expect(validateSsml('<emphasis>a</emphasis>', 'neural')).toMatchObject({
      key: 'unsupported_tag',
      params: { tag: '<emphasis>', engine: 'neural' },
    });
    expect(validateSsml('<emphasis>a</emphasis>', 'standard')).toBe(null);
    expect(validateSsml('<voice name="x">a</voice>', 'standard')?.key).toBe(
      'forbidden_tag'
    );
  });
  it('checks break, rate, pitch and phoneme', () => {
    expect(validateSsml('<break time="11s"/>', 'neural')?.key).toBe(
      'break_time'
    );
    expect(validateSsml('<break time="10000ms"/>', 'neural')).toBe(null);
    expect(validateSsml('<prosody rate="10%">a</prosody>', 'neural')?.key).toBe(
      'prosody_rate'
    );
    expect(validateSsml('<prosody rate="fast">a</prosody>', 'neural')).toBe(
      null
    );
    expect(
      validateSsml('<prosody pitch="high">a</prosody>', 'neural')?.key
    ).toBe('prosody_pitch');
    expect(validateSsml('<prosody pitch="high">a</prosody>', 'standard')).toBe(
      null
    );
    expect(
      validateSsml('<phoneme alphabet="ipa">a</phoneme>', 'neural')?.key
    ).toBe('phoneme_attrs');
  });
  it('reports malformed SSML', () => {
    expect(validateSsml('<p>a', 'neural')?.key).toBe('malformed');
  });
});

describe('checkSsmlElements', () => {
  it('warns for say-as characters on neural', () => {
    const issues = checkSsmlElements(
      [{ name: 'say-as', attrs: { 'interpret-as': 'characters' } }],
      'neural'
    );
    expect(issues).toEqual([
      { level: 'warning', key: 'warn_say_as_characters' },
    ]);
  });
});
