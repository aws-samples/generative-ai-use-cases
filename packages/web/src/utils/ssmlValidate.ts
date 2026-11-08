import type { PollyEngine } from 'generative-ai-use-cases';
import {
  FORBIDDEN_SSML_TAGS,
  SSML_TAG_SUPPORT,
  SsmlElement,
  resolveTagId,
  tagLabel,
} from './ssmlTags';
import { wrapSpeak } from './ssmlCount';

export type SsmlIssue = {
  level: 'error' | 'warning';
  key: string;
  params?: Record<string, string | number>;
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

export type SsmlValidation = { errors: SsmlIssue[]; warnings: SsmlIssue[] };

// Polly SSML uses the amazon: prefix without declaring it. Declare it so that
// the XML parser accepts it.
const declareAmazonPrefix = (wrapped: string): string =>
  /xmlns:amazon\s*=/.test(wrapped)
    ? wrapped
    : wrapped.replace(/<speak(?=[\s>/])/, '<speak xmlns:amazon="urn:amazon"');

/** Parse with DOMParser. Returns null when the SSML is not well-formed XML. */
export const parseSsmlElements = (ssml: string): SsmlElement[] | null => {
  const doc = new DOMParser().parseFromString(
    declareAmazonPrefix(wrapSpeak(ssml)),
    'application/xml'
  );
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  return Array.from(doc.getElementsByTagName('*')).map((el) => ({
    name: el.tagName,
    attrs: Object.fromEntries(
      Array.from(el.attributes)
        .filter((a) => !a.name.startsWith('xmlns'))
        .map((a) => [a.name, a.value])
    ),
  }));
};

/** Validate the SSML typed by the user for the selected engine. */
export const validateSsml = (
  ssml: string,
  engine: PollyEngine
): SsmlValidation => {
  if (ssml.trim() === '') return { errors: [], warnings: [] };
  const elements = parseSsmlElements(ssml);
  if (!elements) {
    return { errors: [{ level: 'error', key: 'malformed' }], warnings: [] };
  }
  const issues = checkSsmlElements(elements, engine);
  return {
    errors: issues.filter((i) => i.level === 'error'),
    warnings: issues.filter((i) => i.level === 'warning'),
  };
};
