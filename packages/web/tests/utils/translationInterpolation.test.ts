import { describe, expect, test } from 'vitest';
import yaml from 'js-yaml';
import i18next from 'i18next';

const files = import.meta.glob<string>(
  '../../public/locales/translation/*.yaml',
  { query: '?raw', import: 'default', eager: true }
);
const byLanguage = Object.fromEntries(
  Object.entries(files).map(([file, text]) => [
    file.split('/').pop()!.replace('.yaml', ''),
    text,
  ])
);
const languages = Object.keys(byLanguage);
const load = (lang: string) =>
  yaml.load(byLanguage[lang]) as Record<string, unknown>;

// Every message, by "a.b.c" key
const messages = (node: unknown, prefix = ''): [string, string][] =>
  typeof node === 'string'
    ? [[prefix, node]]
    : Object.entries((node ?? {}) as Record<string, unknown>).flatMap(
        ([k, v]) => messages(v, prefix ? `${prefix}.${k}` : k)
      );

describe('translation messages', () => {
  // "{{text{{label}}}}" is read by i18next as a variable named
  // "text{{label", so the label was never filled in and the braces showed
  test.each(languages)('%s nests no variable inside another', (lang) => {
    const nested = messages(load(lang)).filter(([, m]) =>
      /\{\{[^}]*\{\{/.test(m)
    );
    expect(nested).toEqual([]);
  });

  test('a use case builder error shows the placeholder as written', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'en',
      resources: { en: { translation: load('en') } },
      interpolation: { escapeValue: false },
    });
    expect(
      i18n.t('useCaseBuilder.error.missing_kb_text_form', {
        placeholder: '{{text:query}}',
      })
    ).toContain('{{text:query}}');
    expect(
      i18n.t('useCaseBuilder.error.duplicate_select_options', {
        placeholder: '{{select:size}}',
      })
    ).toBe('{{select:size}} contains duplicate options.');
  });
});
