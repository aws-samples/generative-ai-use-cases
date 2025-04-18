import { UseCaseInputExample } from 'generative-ai-use-cases';
import { ReactNode } from 'react';
import {
  PiCodeBold,
  PiDetectiveBold,
  PiEnvelopeSimpleBold,
  PiEraserBold,
  PiEyedropperBold,
  PiFlaskBold,
  PiListBulletsBold,
  PiMagnifyingGlassBold,
  PiNotePencilBold,
  PiQuestionBold,
  PiSquaresFourBold,
} from 'react-icons/pi';

import { TFunction } from 'i18next';

export type SamplePromptType = {
  title: string;
  description: string;
  category: string;
  promptTemplate: string;
  inputExamples: UseCaseInputExample[];
  icon: ReactNode;
  color?:
    | 'red'
    | 'green'
    | 'blue'
    | 'purple'
    | 'pink'
    | 'cyan'
    | 'yellow'
    | 'orange'
    | 'gray';
};

export const getUseCaseBuilderSamplePrompts = (
  t: TFunction
): SamplePromptType[] => [
  {
    category: t('useCaseBuilder.contentGeneration.name', {
      ns: 'prompts',
    }),
    title: t('useCaseBuilder.contentGeneration.rewrite.title', {
      ns: 'prompts',
    }),
    description: t('useCaseBuilder.contentGeneration.rewrite.description', {
      ns: 'prompts',
    }),
    promptTemplate: t(
      'useCaseBuilder.contentGeneration.rewrite.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.contentGeneration.rewrite.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.contentGeneration.rewrite.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.rewrite.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.contentGeneration.rewrite.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.rewrite.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiNotePencilBold />,
    color: 'blue',
  },
  {
    category: t('useCaseBuilder.contentGeneration.name', {
      ns: 'prompts',
    }),
    title: t('useCaseBuilder.contentGeneration.listWithExplanation.title', {
      ns: 'prompts',
    }),
    description: t(
      'useCaseBuilder.contentGeneration.listWithExplanation.description',
      { ns: 'prompts' }
    ),
    promptTemplate: t(
      'useCaseBuilder.contentGeneration.listWithExplanation.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.contentGeneration.listWithExplanation.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.contentGeneration.listWithExplanation.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.listWithExplanation.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.contentGeneration.listWithExplanation.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.listWithExplanation.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiListBulletsBold />,
    color: 'blue',
  },
  {
    category: t('useCaseBuilder.contentGeneration.name', {
      ns: 'prompts',
    }),
    title: t('useCaseBuilder.contentGeneration.createEmailResponse.title', {
      ns: 'prompts',
    }),
    description: t(
      'useCaseBuilder.contentGeneration.createEmailResponse.description',
      { ns: 'prompts' }
    ),
    promptTemplate: t(
      'useCaseBuilder.contentGeneration.createEmailResponse.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.contentGeneration.createEmailResponse.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.contentGeneration.createEmailResponse.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.createEmailResponse.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.contentGeneration.createEmailResponse.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.createEmailResponse.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiEnvelopeSimpleBold />,
    color: 'blue',
  },
  {
    category: t('useCaseBuilder.classification.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.classification.mailClassification.title', {
      ns: 'prompts',
    }),
    description: t(
      'useCaseBuilder.classification.mailClassification.description',
      { ns: 'prompts' }
    ),
    promptTemplate: t(
      'useCaseBuilder.classification.mailClassification.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.classification.mailClassification.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.classification.mailClassification.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.classification.mailClassification.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiSquaresFourBold />,
    color: 'green',
  },
  {
    category: t('useCaseBuilder.textProcessing.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.textProcessing.emailAddressExtraction.title', {
      ns: 'prompts',
    }),
    description: t(
      'useCaseBuilder.textProcessing.emailAddressExtraction.description',
      { ns: 'prompts' }
    ),
    promptTemplate: t(
      'useCaseBuilder.textProcessing.emailAddressExtraction.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.textProcessing.emailAddressExtraction.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.textProcessing.emailAddressExtraction.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.textProcessing.emailAddressExtraction.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiEyedropperBold />,
    color: 'orange',
  },
  {
    category: t('useCaseBuilder.textProcessing.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.textProcessing.personalInformationMasking.title', {
      ns: 'prompts',
    }),
    description: t(
      'useCaseBuilder.textProcessing.personalInformationMasking.description',
      { ns: 'prompts' }
    ),
    promptTemplate: t(
      'useCaseBuilder.textProcessing.personalInformationMasking.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.textProcessing.personalInformationMasking.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.textProcessing.personalInformationMasking.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.textProcessing.personalInformationMasking.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiEraserBold />,
    color: 'orange',
  },
  {
    category: t('useCaseBuilder.textAnalysis.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.textAnalysis.textSimilarity.title', {
      ns: 'prompts',
    }),
    description: t('useCaseBuilder.textAnalysis.textSimilarity.description', {
      ns: 'prompts',
    }),
    promptTemplate: t(
      'useCaseBuilder.textAnalysis.textSimilarity.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.textAnalysis.textSimilarity.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.textAnalysis.textSimilarity.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.textAnalysis.textSimilarity.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.textAnalysis.textSimilarity.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.textAnalysis.textSimilarity.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiMagnifyingGlassBold />,
    color: 'pink',
  },
  {
    category: t('useCaseBuilder.textAnalysis.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.textAnalysis.qaPair.title', {
      ns: 'prompts',
    }),
    description: t('useCaseBuilder.textAnalysis.qaPair.description', {
      ns: 'prompts',
    }),
    promptTemplate: t('useCaseBuilder.textAnalysis.qaPair.promptTemplate', {
      ns: 'prompts',
    }),
    inputExamples: [
      {
        title: t('useCaseBuilder.textAnalysis.qaPair.inputExample1.title', {
          ns: 'prompts',
        }),
        examples: {
          [t(
            'useCaseBuilder.textAnalysis.qaPair.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.textAnalysis.qaPair.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.textAnalysis.qaPair.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.textAnalysis.qaPair.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiQuestionBold />,
    color: 'pink',
  },
  {
    category: t('useCaseBuilder.textAnalysis.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.textAnalysis.qaPairWithReference.title', {
      ns: 'prompts',
    }),
    description: t(
      'useCaseBuilder.textAnalysis.qaPairWithReference.description',
      { ns: 'prompts' }
    ),
    promptTemplate: t(
      'useCaseBuilder.textAnalysis.qaPairWithReference.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.textAnalysis.qaPairWithReference.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.textAnalysis.qaPairWithReference.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.textAnalysis.qaPairWithReference.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.textAnalysis.qaPairWithReference.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.textAnalysis.qaPairWithReference.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiQuestionBold />,
    color: 'pink',
  },
  {
    category: t('useCaseBuilder.contentModeration.name', {
      ns: 'prompts',
    }),
    title: t('useCaseBuilder.contentModeration.contentModeration.title', {
      ns: 'prompts',
    }),
    description: t(
      'useCaseBuilder.contentModeration.contentModeration.description',
      { ns: 'prompts' }
    ),
    promptTemplate: t(
      'useCaseBuilder.contentModeration.contentModeration.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.contentModeration.contentModeration.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.contentModeration.contentModeration.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentModeration.contentModeration.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
        },
      },
      {
        title: t(
          'useCaseBuilder.contentModeration.contentModeration.inputExample2.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.contentModeration.contentModeration.inputExample2.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentModeration.contentModeration.inputExample2.parameters.value1',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiDetectiveBold />,
    color: 'red',
  },
  {
    category: t('useCaseBuilder.programming.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.programming.codeGeneration.title', {
      ns: 'prompts',
    }),
    description: t('useCaseBuilder.programming.codeGeneration.description', {
      ns: 'prompts',
    }),
    promptTemplate: t(
      'useCaseBuilder.programming.codeGeneration.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.programming.codeGeneration.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.programming.codeGeneration.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.codeGeneration.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.programming.codeGeneration.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.codeGeneration.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiCodeBold />,
    color: 'cyan',
  },
  {
    category: t('useCaseBuilder.programming.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.programming.codeExplanation.title', {
      ns: 'prompts',
    }),
    description: t('useCaseBuilder.programming.codeExplanation.description', {
      ns: 'prompts',
    }),
    promptTemplate: t(
      'useCaseBuilder.programming.codeExplanation.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.programming.codeExplanation.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.programming.codeExplanation.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.codeExplanation.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiCodeBold />,
    color: 'cyan',
  },
  {
    category: t('useCaseBuilder.programming.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.programming.codeFix.title', {
      ns: 'prompts',
    }),
    description: t('useCaseBuilder.programming.codeFix.description', {
      ns: 'prompts',
    }),
    promptTemplate: t('useCaseBuilder.programming.codeFix.promptTemplate', {
      ns: 'prompts',
    }),
    inputExamples: [
      {
        title: t('useCaseBuilder.programming.codeFix.inputExample1.title', {
          ns: 'prompts',
        }),
        examples: {
          [t(
            'useCaseBuilder.programming.codeFix.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.codeFix.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.programming.codeFix.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.codeFix.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiCodeBold />,
    color: 'cyan',
  },
  {
    category: t('useCaseBuilder.experimental.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.experimental.rolePlay.title', {
      ns: 'prompts',
    }),
    description: t('useCaseBuilder.experimental.rolePlay.description', {
      ns: 'prompts',
    }),
    promptTemplate: t('useCaseBuilder.experimental.rolePlay.promptTemplate', {
      ns: 'prompts',
    }),
    inputExamples: [
      {
        title: t('useCaseBuilder.experimental.rolePlay.inputExample1.title', {
          ns: 'prompts',
        }),
        examples: {
          [t(
            'useCaseBuilder.experimental.rolePlay.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.experimental.rolePlay.inputExample1.parameters.key1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.experimental.rolePlay.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.experimental.rolePlay.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.experimental.rolePlay.inputExample1.parameters.key3',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.experimental.rolePlay.inputExample1.parameters.value3',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.experimental.rolePlay.inputExample1.parameters.key4',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.experimental.rolePlay.inputExample1.parameters.value4',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiFlaskBold />,
    color: 'gray',
  },
  {
    category: t('useCaseBuilder.contentGeneration.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.contentGeneration.questionnaire.title', {
      ns: 'prompts',
    }),
    description: t(
      'useCaseBuilder.contentGeneration.questionnaire.description',
      { ns: 'prompts' }
    ),
    promptTemplate: t(
      'useCaseBuilder.contentGeneration.questionnaire.promptTemplate',
      { ns: 'prompts' }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.contentGeneration.questionnaire.inputExample1.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample1.parameters.key3',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample1.parameters.value3',
            { ns: 'prompts' }
          ),
        },
      },
      {
        title: t(
          'useCaseBuilder.contentGeneration.questionnaire.inputExample2.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample2.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample2.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample2.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample2.parameters.value2',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample2.parameters.key3',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample2.parameters.value3',
            { ns: 'prompts' }
          ),
        },
      },
      {
        title: t(
          'useCaseBuilder.contentGeneration.questionnaire.inputExample3.title',
          { ns: 'prompts' }
        ),
        examples: {
          [t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample3.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample3.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample3.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample3.parameters.value2',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample3.parameters.key3',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.contentGeneration.questionnaire.inputExample3.parameters.value3',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiNotePencilBold />,
    color: 'blue',
  },
  {
    category: t('useCaseBuilder.programming.name', { ns: 'prompts' }),
    title: t('useCaseBuilder.programming.queryGeneration.title', {
      ns: 'prompts',
    }),
    description: t('useCaseBuilder.programming.queryGeneration.description', {
      ns: 'prompts',
    }),
    promptTemplate: t(
      'useCaseBuilder.programming.queryGeneration.promptTemplate',
      {
        ns: 'prompts',
      }
    ),
    inputExamples: [
      {
        title: t(
          'useCaseBuilder.programming.queryGeneration.inputExample1.title',
          {
            ns: 'prompts',
          }
        ),
        examples: {
          [t(
            'useCaseBuilder.programming.queryGeneration.inputExample1.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.queryGeneration.inputExample1.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.programming.queryGeneration.inputExample1.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.queryGeneration.inputExample1.parameters.value2',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.programming.queryGeneration.inputExample1.parameters.key3',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.queryGeneration.inputExample1.parameters.value3',
            { ns: 'prompts' }
          ),
        },
      },
      {
        title: t(
          'useCaseBuilder.programming.queryGeneration.inputExample2.title',
          {
            ns: 'prompts',
          }
        ),
        examples: {
          [t(
            'useCaseBuilder.programming.queryGeneration.inputExample2.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.queryGeneration.inputExample2.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.programming.queryGeneration.inputExample2.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.queryGeneration.inputExample2.parameters.value2',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.programming.queryGeneration.inputExample2.parameters.key3',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.queryGeneration.inputExample2.parameters.value3',
            { ns: 'prompts' }
          ),
        },
      },
      {
        title: t(
          'useCaseBuilder.programming.queryGeneration.inputExample3.title',
          {
            ns: 'prompts',
          }
        ),
        examples: {
          [t(
            'useCaseBuilder.programming.queryGeneration.inputExample3.parameters.key1',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.queryGeneration.inputExample3.parameters.value1',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.programming.queryGeneration.inputExample3.parameters.key2',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.queryGeneration.inputExample3.parameters.value2',
            { ns: 'prompts' }
          ),
          [t(
            'useCaseBuilder.programming.queryGeneration.inputExample3.parameters.key3',
            { ns: 'prompts' }
          )]: t(
            'useCaseBuilder.programming.queryGeneration.inputExample3.parameters.value3',
            { ns: 'prompts' }
          ),
        },
      },
    ],
    icon: <PiCodeBold />,
    color: 'cyan',
  },
];
