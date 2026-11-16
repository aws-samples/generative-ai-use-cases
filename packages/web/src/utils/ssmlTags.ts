import type { PollyEngine } from 'generative-ai-use-cases';

// Tag support of the Amazon Polly engines (mirror of
// packages/cdk/lambda/utils/ssmlUtils.ts, keep them in sync).
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

export const tagLabel = (el: SsmlElement): string => {
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

export const SSML_ENGINES: PollyEngine[] = [
  'neural',
  'standard',
  'generative',
  'long-form',
];

export const getTagSupport = (
  id: SsmlTagId,
  engine: PollyEngine
): SsmlSupport => SSML_TAG_SUPPORT[id][engine];
