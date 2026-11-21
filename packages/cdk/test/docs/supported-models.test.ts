import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BEDROCK_TEXT_MODELS,
  CRI_PREFIX_PATTERN,
} from '@generative-ai-use-cases/common';

// The supported text model list in DEPLOY_OPTION.md is written from
// modelMetadata. When this test fails, replace the code block after the marker
// comment with the expected value shown in the diff.
const LIST_MARKER = '<!-- supported-text-models';
const LANGS = ['ja', 'en'];

// One line per base model: the plain ID on its own line, then the prefixed IDs
// grouped as "{global|us}.<base>" (or "us.<base>" when there is only one).
const supportedTextModelList = (): string => {
  const prefixesByBase = new Map<string, string[]>();
  for (const modelId of BEDROCK_TEXT_MODELS) {
    const base = modelId.replace(CRI_PREFIX_PATTERN, '');
    const prefix = modelId.match(CRI_PREFIX_PATTERN)?.[1] ?? '';
    prefixesByBase.set(base, [...(prefixesByBase.get(base) ?? []), prefix]);
  }
  const lines: string[] = [];
  for (const [base, prefixes] of prefixesByBase) {
    if (prefixes.includes('')) lines.push(`"${base}",`);
    const withPrefix = prefixes.filter(Boolean);
    if (withPrefix.length === 1) lines.push(`"${withPrefix[0]}.${base}",`);
    if (withPrefix.length > 1) {
      lines.push(`"{${withPrefix.join('|')}}.${base}",`);
    }
  }
  return lines.join('\n');
};

const documentedList = (lang: string): string => {
  const doc = readFileSync(
    join(__dirname, '../../../../docs', lang, 'DEPLOY_OPTION.md'),
    'utf8'
  );
  const marker = doc.indexOf(LIST_MARKER);
  expect(marker).toBeGreaterThan(-1);
  const start = doc.indexOf('```\n', marker) + '```\n'.length;
  const end = doc.indexOf('\n```', start);
  return doc.slice(start, end);
};

describe('supported text model list in DEPLOY_OPTION.md', () => {
  it.each(LANGS)('matches modelMetadata (%s)', (lang) => {
    expect(documentedList(lang)).toBe(supportedTextModelList());
  });
});
