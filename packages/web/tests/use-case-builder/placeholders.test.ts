import { describe, expect, test } from 'vitest';
import { extractPlaceholdersFromPromptTemplate } from '../../src/utils/UseCaseBuilderUtils';

describe('Can extract a single placeholder correctly', () => {
  test('No label', () => {
    expect(extractPlaceholdersFromPromptTemplate('{{text}}')).toEqual([
      '{{text}}',
    ]);

    expect(extractPlaceholdersFromPromptTemplate('hoge {{text}} hoge')).toEqual(
      ['{{text}}']
    );

    expect(
      extractPlaceholdersFromPromptTemplate(`hoge
fuga {{text}} fuga
hoge`)
    ).toEqual(['{{text}}']);
  });

  test('With label', () => {
    expect(extractPlaceholdersFromPromptTemplate('{{text:xxx}}')).toEqual([
      '{{text:xxx}}',
    ]);

    expect(
      extractPlaceholdersFromPromptTemplate('hoge {{text:xxx}} hoge')
    ).toEqual(['{{text:xxx}}']);

    expect(
      extractPlaceholdersFromPromptTemplate(`hoge
fuga {{text:xxx}} fuga
hoge`)
    ).toEqual(['{{text:xxx}}']);
  });
});

describe('Can extract multiple placeholders correctly', () => {
  test('No label', () => {
    expect(extractPlaceholdersFromPromptTemplate('{{text}} {{text}}')).toEqual([
      '{{text}}',
      '{{text}}',
    ]);

    expect(
      extractPlaceholdersFromPromptTemplate(`{{text}}
{{text}}`)
    ).toEqual(['{{text}}', '{{text}}']);

    expect(
      extractPlaceholdersFromPromptTemplate(`hoge {{text}} hoge
hoge {{text}} hoge`)
    ).toEqual(['{{text}}', '{{text}}']);
  });

  test('With label', () => {
    expect(
      extractPlaceholdersFromPromptTemplate('{{text:xxx}} {{text:xxx}}')
    ).toEqual(['{{text:xxx}}', '{{text:xxx}}']);

    expect(
      extractPlaceholdersFromPromptTemplate(`{{text:xxx}}
{{text:xxx}}`)
    ).toEqual(['{{text:xxx}}', '{{text:xxx}}']);

    expect(
      extractPlaceholdersFromPromptTemplate(`hoge {{text:xxx}} hoge
hoge {{text:xxx}} hoge`)
    ).toEqual(['{{text:xxx}}', '{{text:xxx}}']);
  });

  test('Compound', () => {
    expect(
      extractPlaceholdersFromPromptTemplate('{{text}} {{text:xxx}}')
    ).toEqual(['{{text}}', '{{text:xxx}}']);

    expect(
      extractPlaceholdersFromPromptTemplate(`{{text}}
{{text:xxx}}`)
    ).toEqual(['{{text}}', '{{text:xxx}}']);

    expect(
      extractPlaceholdersFromPromptTemplate(`hoge {{text}} hoge
hoge {{text:xxx}} hoge`)
    ).toEqual(['{{text}}', '{{text:xxx}}']);
  });
});
