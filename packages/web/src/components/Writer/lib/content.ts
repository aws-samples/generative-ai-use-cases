import { TFunction } from 'i18next';

export const getDefaultEditorContent = (t: TFunction) => {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: t('writer.title') }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: t('writer.description'),
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: t('writer.tutorial') }],
      },
      {
        type: 'heading',
        attrs: { level: 4 },
        content: [{ type: 'text', text: t('writer.useAsTextEditor') }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: t('writer.textEditorDescription'),
          },
        ],
      },
      {
        type: 'paragraph',
        content: [],
      },
      {
        type: 'heading',
        attrs: { level: 4 },
        content: [{ type: 'text', text: t('writer.autoCompleteFeature') }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: t('writer.autoCompleteDescription'),
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: t('writer.example1'),
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: t('writer.amazonBedrockDescription'),
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: t('writer.example2'),
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: t('writer.factCheckExample'),
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 4 },
        content: [{ type: 'text', text: t('writer.reviewFeature') }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: t('writer.reviewDescription'),
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: t('writer.incorrectTextExample'),
          },
        ],
      },
    ],
  };
};

export const emptyContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};
