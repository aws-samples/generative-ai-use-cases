import { describe, expect, test } from 'vitest';
import {
  NOLABEL,
  extractPlaceholdersFromPromptTemplate,
  getItemsFromPlaceholders,
} from '../../src/utils/UseCaseBuilderUtils';

// {{retrieveKnowledgeBase:label:JSON}} (#1416)
const items = (template: string) =>
  getItemsFromPlaceholders(extractPlaceholdersFromPromptTemplate(template));

describe('retrieveKnowledgeBase with a metadata filter', () => {
  test('reads a filter whose JSON has braces of its own', () => {
    const template =
      'Q: {{text:q}}\n{{retrieveKnowledgeBase:q:{"category":"AWS","year":{"greaterThan":2020}}}}\nend';
    expect(extractPlaceholdersFromPromptTemplate(template)).toEqual([
      '{{text:q}}',
      '{{retrieveKnowledgeBase:q:{"category":"AWS","year":{"greaterThan":2020}}}}',
    ]);
    expect(items(template)[1]).toEqual({
      inputType: 'retrieveKnowledgeBase',
      label: 'q',
      filter: '{"category":"AWS","year":{"greaterThan":2020}}',
      placeholder:
        '{{retrieveKnowledgeBase:q:{"category":"AWS","year":{"greaterThan":2020}}}}',
    });
  });

  test('ignores braces inside JSON strings', () => {
    const placeholder =
      '{{retrieveKnowledgeBase:q:{"title":{"startsWith":"}}"}}}}';
    expect(extractPlaceholdersFromPromptTemplate(`a ${placeholder} b`)).toEqual(
      [placeholder]
    );
  });

  test('takes the filter without a label', () => {
    expect(
      items('{{text}} {{retrieveKnowledgeBase:{"tag":{"in":["AWS"]}}}}')[1]
    ).toMatchObject({ label: NOLABEL, filter: '{"tag":{"in":["AWS"]}}' });
  });

  test('keeps two searches of one query with different filters', () => {
    const found = items(
      '{{text:q}} {{retrieveKnowledgeBase:q:{"a":"1"}}} {{retrieveKnowledgeBase:q:{"a":"2"}}} {{retrieveKnowledgeBase:q}}'
    ).filter((i) => i.inputType === 'retrieveKnowledgeBase');
    expect(found.map((i) => i.filter)).toEqual([
      '{"a":"1"}',
      '{"a":"2"}',
      undefined,
    ]);
  });

  test('reads other placeholders as before', () => {
    expect(
      items('{{text:q}} {{retrieveKnowledgeBase:q}} {{select:s:A,B}}')
    ).toEqual([
      { inputType: 'text', label: 'q', options: undefined },
      { inputType: 'retrieveKnowledgeBase', label: 'q', options: undefined },
      { inputType: 'select', label: 's', options: 'A,B' },
    ]);
  });

  test('leaves an unclosed filter to the plain rule', () => {
    expect(
      extractPlaceholdersFromPromptTemplate('{{retrieveKnowledgeBase:q:{"a":1}')
    ).toEqual([]);
  });
});
