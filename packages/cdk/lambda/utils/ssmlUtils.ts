import type { PollyEngine } from 'generative-ai-use-cases';

// SSML helpers for the Amazon Polly tool (server side).
// The web package has a mirror of the tag table and of the rules
// (packages/web/src/utils/ssmlTags.ts and ssmlValidate.ts). Keep them in sync.
// https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html

export type SsmlSupport = 'full' | 'partial' | 'none';

export type SsmlTagId =
  | 'speak'
  | 'break'
  | 'emphasis'
  | 'lang'
  | 'mark'
  | 'p'
  | 's'
  | 'phoneme'
  | 'prosody'
  | 'say-as'
  | 'sub'
  | 'w'
  | 'auto-breaths'
  | 'domain'
  | 'effect-drc'
  | 'effect-other';

const all = (
  standard: SsmlSupport,
  neural: SsmlSupport,
  generative: SsmlSupport,
  longForm: SsmlSupport
): Record<PollyEngine, SsmlSupport> => ({
  standard,
  neural,
  generative,
  'long-form': longForm,
});

export const SSML_TAG_SUPPORT: Record<
  SsmlTagId,
  Record<PollyEngine, SsmlSupport>
> = {
  speak: all('full', 'full', 'full', 'full'),
  break: all('full', 'full', 'full', 'full'),
  emphasis: all('full', 'none', 'none', 'none'),
  lang: all('full', 'full', 'full', 'full'),
  mark: all('full', 'full', 'partial', 'full'),
  p: all('full', 'full', 'full', 'full'),
  s: all('full', 'full', 'full', 'full'),
  phoneme: all('full', 'full', 'partial', 'full'),
  prosody: all('full', 'partial', 'partial', 'partial'),
  'say-as': all('full', 'partial', 'full', 'full'),
  sub: all('full', 'full', 'full', 'full'),
  w: all('full', 'full', 'full', 'full'),
  'auto-breaths': all('full', 'none', 'none', 'none'),
  domain: all('none', 'none', 'none', 'none'),
  'effect-drc': all('full', 'full', 'none', 'full'),
  'effect-other': all('full', 'none', 'none', 'none'),
};

// Tags that Amazon Polly never accepts
export const FORBIDDEN_SSML_TAGS = ['audio', 'lexicon', 'lookup', 'voice'];

export type SsmlElement = { name: string; attrs: Record<string, string> };

export type SsmlIssue = {
  level: 'error' | 'warning';
  key: string;
  params?: Record<string, string | number>;
};

const NAME_TO_ID: Record<string, SsmlTagId> = {
  speak: 'speak',
  break: 'break',
  emphasis: 'emphasis',
  lang: 'lang',
  mark: 'mark',
  p: 'p',
  s: 's',
  phoneme: 'phoneme',
  prosody: 'prosody',
  'say-as': 'say-as',
  sub: 'sub',
  w: 'w',
  'amazon:auto-breaths': 'auto-breaths',
  'amazon:domain': 'domain',
};

export const resolveTagId = (el: SsmlElement): SsmlTagId | null => {
  if (el.name === 'amazon:effect') {
    return el.attrs.name === 'drc' ? 'effect-drc' : 'effect-other';
  }
  return NAME_TO_ID[el.name] ?? null;
};

const tagLabel = (el: SsmlElement): string => {
  if (el.name === 'amazon:effect') {
    if (el.attrs.name) return `<amazon:effect name="${el.attrs.name}">`;
    const first = Object.keys(el.attrs)[0];
    return first ? `<amazon:effect ${first}>` : '<amazon:effect>';
  }
  if (el.name === 'amazon:domain' && el.attrs.name) {
    return `<amazon:domain name="${el.attrs.name}">`;
  }
  return `<${el.name}>`;
};

const RATE_KEYWORDS = ['x-slow', 'slow', 'medium', 'fast', 'x-fast'];
const MAX_BREAK_SECONDS = 10;
const MIN_RATE = 20;
const MAX_RATE = 200;

/** Check the elements of an SSML document against the selected engine. */
export const checkSsmlElements = (
  elements: SsmlElement[],
  engine: PollyEngine
): SsmlIssue[] => {
  const issues: SsmlIssue[] = [];
  const add = (issue: SsmlIssue) => {
    if (
      !issues.some(
        (i) =>
          i.key === issue.key &&
          JSON.stringify(i.params) === JSON.stringify(issue.params)
      )
    ) {
      issues.push(issue);
    }
  };

  for (const el of elements) {
    const tag = tagLabel(el);
    if (FORBIDDEN_SSML_TAGS.includes(el.name)) {
      add({ level: 'error', key: 'forbidden_tag', params: { tag } });
      continue;
    }
    const id = resolveTagId(el);
    if (!id) {
      add({ level: 'error', key: 'unknown_tag', params: { tag } });
      continue;
    }
    if (SSML_TAG_SUPPORT[id][engine] === 'none') {
      add({
        level: 'error',
        key: 'unsupported_tag',
        params: { tag, engine },
      });
      continue;
    }

    if (el.name === 'break' && el.attrs.time !== undefined) {
      const m = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/.exec(el.attrs.time);
      const seconds = m
        ? m[2] === 'ms'
          ? Number(m[1]) / 1000
          : Number(m[1])
        : NaN;
      if (!(seconds <= MAX_BREAK_SECONDS)) {
        add({
          level: 'error',
          key: 'break_time',
          params: { value: el.attrs.time },
        });
      }
    }

    if (el.name === 'prosody') {
      const rate = el.attrs.rate;
      if (rate !== undefined && !RATE_KEYWORDS.includes(rate)) {
        const m = /^(\d+(?:\.\d+)?)%$/.exec(rate);
        const n = m ? Number(m[1]) : NaN;
        if (!(n >= MIN_RATE && n <= MAX_RATE)) {
          add({
            level: 'error',
            key: 'prosody_rate',
            params: { value: rate },
          });
        }
      }
      if (el.attrs.pitch !== undefined && engine !== 'standard') {
        add({ level: 'error', key: 'prosody_pitch', params: { engine } });
      }
      if (
        el.attrs['amazon:max-duration'] !== undefined &&
        engine !== 'standard'
      ) {
        add({
          level: 'error',
          key: 'unsupported_tag',
          params: { tag: '<prosody amazon:max-duration>', engine },
        });
      }
      if (engine === 'generative') {
        add({ level: 'warning', key: 'warn_prosody_generative' });
      }
    }

    if (el.name === 'phoneme' && (!el.attrs.alphabet || !el.attrs.ph)) {
      add({ level: 'error', key: 'phoneme_attrs' });
    }

    if (
      el.name === 'say-as' &&
      engine === 'neural' &&
      ['characters', 'spell-out'].includes(el.attrs['interpret-as'])
    ) {
      add({ level: 'warning', key: 'warn_say_as_characters' });
    }
  }
  return issues;
};

const SPEAK_START = /^\s*<speak[\s>/]/;

/** Wrap the user's SSML with <speak> unless it already starts with it. */
export const wrapSpeak = (ssml: string): string =>
  SPEAK_START.test(ssml) ? ssml : `<speak>${ssml}</speak>`;

const ENTITY = /&(?:[A-Za-z][A-Za-z0-9]*|#\d+|#x[0-9A-Fa-f]+);/g;

/**
 * Number of billed characters of an SSML text: tags and comments are not
 * billed, an entity such as &amp; counts as one character. Counted by code points.
 */
export const countBilledCharacters = (ssml: string): number =>
  Array.from(
    ssml
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(ENTITY, '_')
  ).length;

export type SsmlParseResult =
  | { ok: true; elements: SsmlElement[] }
  | { ok: false };

const TAG = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>/g;
const NAME = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/;
const ATTR = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const BAD_AMP = /&(?!(?:[A-Za-z][A-Za-z0-9]*|#\d+|#x[0-9A-Fa-f]+);)/;

/**
 * Small tokenizer that checks the structure of the (already wrapped) SSML:
 * one root element, balanced and properly nested tags, quoted attributes and
 * no stray < or &. It is not a full XML parser.
 */
export const parseSsml = (ssml: string): SsmlParseResult => {
  const elements: SsmlElement[] = [];
  const stack: string[] = [];
  let rootClosed = false;
  let rootSeen = false;
  let last = 0;
  TAG.lastIndex = 0;

  const textOk = (s: string): boolean => !s.includes('<') && !BAD_AMP.test(s);

  let m: RegExpExecArray | null;
  while ((m = TAG.exec(ssml)) !== null) {
    const between = ssml.slice(last, m.index);
    last = m.index + m[0].length;
    if (!textOk(between)) return { ok: false };
    if (between.trim() !== '' && (stack.length === 0 || rootClosed)) {
      return { ok: false };
    }
    const tag = m[0];
    if (/^<(?:!--|\?|!\[CDATA\[)/.test(tag)) continue;

    const closing = /^<\/\s*([^\s>]+)\s*>$/.exec(tag);
    if (closing) {
      if (stack.pop() !== closing[1]) return { ok: false };
      if (stack.length === 0) rootClosed = true;
      continue;
    }
    const opening = /^<([^\s/>]+)([\s\S]*?)(\/?)>$/.exec(tag);
    if (!opening || !NAME.test(opening[1])) return { ok: false };
    if (rootClosed) return { ok: false };

    const attrText = opening[2];
    const attrs: Record<string, string> = {};
    ATTR.lastIndex = 0;
    let a: RegExpExecArray | null;
    while ((a = ATTR.exec(attrText)) !== null) {
      if (a[1] in attrs) return { ok: false };
      attrs[a[1]] = a[2] ?? a[3] ?? '';
      if (!textOk(attrs[a[1]])) return { ok: false };
    }
    if (attrText.replace(ATTR, '').trim() !== '') return { ok: false };

    elements.push({ name: opening[1], attrs });
    rootSeen = true;
    if (opening[3] === '/') {
      if (stack.length === 0) rootClosed = true;
    } else {
      stack.push(opening[1]);
    }
  }
  const tail = ssml.slice(last);
  if (!textOk(tail) || tail.trim() !== '') return { ok: false };
  if (!rootSeen || stack.length > 0) return { ok: false };
  return { ok: true, elements };
};

/** English message for an issue (server responses). */
export const describeSsmlIssue = (issue: SsmlIssue): string => {
  const p = issue.params ?? {};
  switch (issue.key) {
    case 'malformed':
      return 'The SSML is not well-formed. Check that every tag is closed and properly nested, and that reserved characters are escaped.';
    case 'forbidden_tag':
      return `${p.tag} is not supported by Amazon Polly.`;
    case 'unknown_tag':
      return `${p.tag} is not a supported SSML tag.`;
    case 'unsupported_tag':
      return `${p.tag} is not supported by the ${p.engine} engine.`;
    case 'break_time':
      return `The break time "${p.value}" is invalid. Use up to 10s or 10000ms.`;
    case 'prosody_rate':
      return `The prosody rate "${p.value}" is invalid. Use 20% to 200%, or x-slow, slow, medium, fast, x-fast.`;
    case 'prosody_pitch':
      return `The pitch attribute of <prosody> is not supported by the ${p.engine} engine.`;
    case 'phoneme_attrs':
      return '<phoneme> requires both the alphabet and ph attributes.';
    default:
      return 'The SSML is invalid.';
  }
};

/**
 * Validate SSML for the selected engine. Returns the first error, or null.
 * `ssml` is the user's text (it is wrapped with <speak> when needed).
 */
export const validateSsml = (
  ssml: string,
  engine: PollyEngine
): SsmlIssue | null => {
  const parsed = parseSsml(wrapSpeak(ssml));
  if (!parsed.ok) return { level: 'error', key: 'malformed' };
  return (
    checkSsmlElements(parsed.elements, engine).find(
      (i) => i.level === 'error'
    ) ?? null
  );
};
