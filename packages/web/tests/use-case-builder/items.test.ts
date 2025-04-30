import { describe, expect, test } from 'vitest';
import {
  getItemsFromPlaceholders,
  getTextFormItemsFromItems,
  getTextFormUniqueLabels,
  NOLABEL,
} from '../../src/utils/UseCaseBuilderUtils';

describe('Can parse input type correctly', () => {
  test('text', () => {
    expect(getItemsFromPlaceholders(['{{text:xxx}}'])).toEqual([
      {
        inputType: 'text',
        label: 'xxx',
      },
    ]);
  });

  test('retrieveKendra', () => {
    expect(getItemsFromPlaceholders(['{{retrieveKendra:xxx}}'])).toEqual([
      {
        inputType: 'retrieveKendra',
        label: 'xxx',
      },
    ]);
  });

  test('retrieveKnowledgeBase', () => {
    expect(getItemsFromPlaceholders(['{{retrieveKnowledgeBase:xxx}}'])).toEqual(
      [
        {
          inputType: 'retrieveKnowledgeBase',
          label: 'xxx',
        },
      ]
    );
  });

  test('Invalid type', () => {
    expect(getItemsFromPlaceholders(['{{hoge:xxx}}'])).toEqual([]);

    expect(getItemsFromPlaceholders(['{{hoge}}'])).toEqual([]);
  });
});

describe('Can parse a single label correctly', () => {
  test('No label', () => {
    expect(getItemsFromPlaceholders(['{{text}}'])).toEqual([
      {
        inputType: 'text',
        label: NOLABEL,
      },
    ]);
  });

  test('Empty label', () => {
    expect(getItemsFromPlaceholders(['{{text:}}'])).toEqual([
      {
        inputType: 'text',
        label: '',
      },
    ]);
  });

  test('{} is included', () => {
    expect(getItemsFromPlaceholders(['{{text:x{x}x}}'])).toEqual([
      {
        inputType: 'text',
        label: 'x{x}x',
      },
    ]);
  });

  test('The label of an input type that does not allow options contains :', () => {
    expect(getItemsFromPlaceholders(['{{text:x:x:x}}'])).toEqual([
      {
        inputType: 'text',
        label: 'x:x:x',
      },
    ]);
  });

  test('Contains a space', () => {
    expect(getItemsFromPlaceholders(['{{text: xxx }}'])).toEqual([
      {
        inputType: 'text',
        label: ' xxx ',
      },
    ]);
  });
});

describe('Can parse options correctly', () => {
  test('No options', () => {
    expect(getItemsFromPlaceholders(['{{select}}'])).toEqual([
      {
        inputType: 'select',
        label: NOLABEL,
        options: undefined,
      },
    ]);

    expect(getItemsFromPlaceholders(['{{select:}}'])).toEqual([
      {
        inputType: 'select',
        label: '',
        options: undefined,
      },
    ]);

    expect(getItemsFromPlaceholders(['{{select:hoge}}'])).toEqual([
      {
        inputType: 'select',
        label: 'hoge',
        options: undefined,
      },
    ]);
  });

  test('Options specified', () => {
    expect(getItemsFromPlaceholders(['{{select:hoge:}}'])).toEqual([
      {
        inputType: 'select',
        label: 'hoge',
        options: '',
      },
    ]);

    expect(getItemsFromPlaceholders(['{{select::hoge}}'])).toEqual([
      {
        inputType: 'select',
        label: '',
        options: 'hoge',
      },
    ]);

    expect(getItemsFromPlaceholders(['{{select:hoge:fuga,hage}}'])).toEqual([
      {
        inputType: 'select',
        label: 'hoge',
        options: 'fuga,hage',
      },
    ]);
  });
});

describe('Can parse multiple labels correctly', () => {
  test('No label is duplicated', () => {
    expect(getItemsFromPlaceholders(['{{text}}', '{{text}}'])).toEqual([
      {
        inputType: 'text',
        label: NOLABEL,
      },
    ]);
  });

  test('Label is duplicated', () => {
    expect(getItemsFromPlaceholders(['{{text:xxx}}', '{{text:xxx}}'])).toEqual([
      {
        inputType: 'text',
        label: 'xxx',
      },
    ]);
  });

  test('No label and with label are mixed', () => {
    expect(
      getItemsFromPlaceholders([
        '{{text}}',
        '{{text}}',
        '{{text:xxx}}',
        '{{text:xxx}}',
        '{{text:yyy}}',
        '{{text:yyy}}',
      ])
    ).toEqual([
      {
        inputType: 'text',
        label: NOLABEL,
      },
      {
        inputType: 'text',
        label: 'xxx',
      },
      {
        inputType: 'text',
        label: 'yyy',
      },
    ]);
  });

  test('Different input types have the same label', () => {
    expect(
      getItemsFromPlaceholders([
        '{{text}}',
        '{{retrieveKendra}}',
        '{{retrieveKnowledgeBase}}',
        '{{text:xxx}}',
        '{{retrieveKendra:xxx}}',
        '{{retrieveKnowledgeBase:xxx}}',
      ])
    ).toEqual([
      {
        inputType: 'text',
        label: NOLABEL,
      },
      {
        inputType: 'retrieveKendra',
        label: NOLABEL,
      },
      {
        inputType: 'retrieveKnowledgeBase',
        label: NOLABEL,
      },
      {
        inputType: 'text',
        label: 'xxx',
      },
      {
        inputType: 'retrieveKendra',
        label: 'xxx',
      },
      {
        inputType: 'retrieveKnowledgeBase',
        label: 'xxx',
      },
    ]);
  });

  test('Can extract TEXT_FORM_TYPES correctly', () => {
    expect(
      getTextFormItemsFromItems([
        {
          inputType: 'text',
          label: NOLABEL,
        },
        {
          inputType: 'text',
          label: 'xxx',
        },
        {
          inputType: 'retrieveKendra',
          label: NOLABEL,
        },
        {
          inputType: 'retrieveKendra',
          label: 'xxx',
        },
      ])
    ).toEqual([
      {
        inputType: 'text',
        label: NOLABEL,
      },
      {
        inputType: 'text',
        label: 'xxx',
      },
    ]);
  });

  test('Can extract unique labels', () => {
    expect(
      getTextFormUniqueLabels([
        {
          inputType: 'text',
          label: NOLABEL,
        },
        {
          inputType: 'text',
          label: 'xxx',
        },
        {
          inputType: 'form',
          label: NOLABEL,
        },
        {
          inputType: 'form',
          label: 'xxx',
        },
        {
          inputType: 'retrieveKendra',
          label: NOLABEL,
        },
        {
          inputType: 'retrieveKendra',
          label: 'xxx',
        },
      ])
    ).toEqual([NOLABEL, 'xxx']);
  });
});
