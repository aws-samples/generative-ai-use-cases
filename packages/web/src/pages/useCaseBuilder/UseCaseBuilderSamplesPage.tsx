import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SamplePromptType,
  getUseCaseBuilderSamplePrompts,
} from '../../prompts/useCaseBuilderSamples';
import { useTranslation } from 'react-i18next';

type CardSampleProps = SamplePromptType;

const CardSample: React.FC<CardSampleProps> = (props) => {
  const navigate = useNavigate();

  const onClick = useCallback(() => {
    navigate(`/use-case-builder/new`, {
      state: {
        title: props.title,
        promptTemplate: props.promptTemplate,
        description: props.description,
        inputExamples: props.inputExamples,
      },
    });
  }, [
    navigate,
    props.description,
    props.inputExamples,
    props.promptTemplate,
    props.title,
  ]);

  const color = useMemo(() => {
    if (!props.color) {
      return 'bg-blue-600 text-white';
    }

    switch (props.color) {
      case 'blue':
        return 'bg-blue-600 text-white';
      case 'red':
        return 'bg-red-500 text-white';
      case 'cyan':
        return 'bg-cyan-600 text-white';
      case 'green':
        return 'bg-green-500 text-white';
      case 'gray':
        return 'bg-gray-500 text-white';
      case 'orange':
        return 'bg-orange-500 text-white';
      case 'pink':
        return 'bg-pink-500 text-white';
      case 'purple':
        return 'bg-purple-500 text-white';
      case 'yellow':
        return 'bg-yellow-500 text-white';
    }
  }, [props.color]);

  return (
    <div
      className="flex cursor-pointer rounded-lg border-2 p-3 hover:bg-gray-100"
      onClick={onClick}>
      <div className="flex items-center">
        <div className={`${color} rounded-xl border p-2 text-3xl  shadow-md`}>
          {props.icon}
        </div>
        <div className="ml-2 flex flex-col">
          <div className="font-bold">{props.title}</div>
          <div className="text-sm text-gray-600 ">{props.description}</div>
          <div className="flex">
            <div className="mt-1 rounded bg-gray-200 p-1 text-xs font-semibold">
              {props.category}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const UseCaseBuilderSamplesPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:h-min print:visible print:h-min">
        {t('useCaseBuilder.samples')}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {getUseCaseBuilderSamplePrompts(t).map((sample, idx) => {
          return (
            <CardSample
              key={idx}
              title={sample.title}
              icon={sample.icon}
              category={sample.category}
              description={sample.description}
              promptTemplate={sample.promptTemplate}
              inputExamples={sample.inputExamples}
              color={sample.color}
            />
          );
        })}
      </div>
    </div>
  );
};

export default UseCaseBuilderSamplesPage;
