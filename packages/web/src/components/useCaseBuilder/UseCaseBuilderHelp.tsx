import React, { useState } from 'react';
import { PiCaretUp } from 'react-icons/pi';
import ButtonCopy from '../ButtonCopy';
import { useTranslation } from 'react-i18next';

type PromptSampleProps = {
  title: string;
  prompt: string;
};
const PromptSample: React.FC<PromptSampleProps> = (props) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="mt-3 rounded border border-gray-400">
      {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
      <div
        className="flex cursor-pointer items-center justify-between bg-gray-400 px-2 py-1 text-sm text-white hover:opacity-80"
        onClick={() => {
          setIsOpen(!isOpen);
        }}>
        {t('useCaseBuilder.help.example')}: {props.title}
        <PiCaretUp className={`${isOpen ? 'rotate-180' : ''} transition-all`} />
      </div>
      {isOpen && (
        <pre className="whitespace-pre-wrap break-words bg-gray-100 p-3 text-sm">
          {props.prompt}
          <div className="flex w-full justify-end">
            <ButtonCopy text={props.prompt} />
          </div>
        </pre>
      )}
    </div>
  );
};

const Placeholder: React.FC<{
  inputType: string;
  label?: string;
  options?: string;
}> = (props) => {
  return (
    /* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */
    <span className="rounded bg-gray-200 px-1 py-0.5">
      {`{{${props.inputType}${props.label !== undefined ? ':' + props.label : ''}${props.options !== undefined ? ':' + props.options : ''}}}`}
    </span>
  );
};

const UseCaseBuilderHelp = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-y-8 py-4">
      <div className="flex flex-col gap-y-4">
        <div className="text-lg font-bold">
          {t('useCaseBuilder.help.promptTemplateTitle')}
        </div>
        <div className="text-sm leading-relaxed">
          {t('useCaseBuilder.help.promptTemplateDescription')}
        </div>
      </div>

      <div className="flex flex-col gap-y-4">
        <div className="text-lg font-bold">
          {t('useCaseBuilder.help.placeholder')}
        </div>
        <div className="text-sm leading-relaxed">
          {t('useCaseBuilder.help.placeholderDescription')}
        </div>
      </div>

      <div className="flex flex-col gap-y-4">
        <div className="text-lg font-bold">
          {t('useCaseBuilder.help.placeholderList')}
        </div>

        <div className="flex flex-col gap-y-10">
          <div className="flex flex-col gap-y-4">
            <div className="flex items-center text-base font-bold">
              <Placeholder inputType="text" /> <ButtonCopy text={'{{text}}'} />
            </div>
            <div className="text-sm leading-relaxed">
              {t('useCaseBuilder.help.textPlaceholderDescription')}
              <PromptSample
                title={t('useCaseBuilder.help.emailReplyExample')}
                prompt={t('useCaseBuilder.help.emailReplyPrompt')}
              />
            </div>
          </div>

          <div className="flex flex-col gap-y-4">
            <div className="flex items-center text-base font-bold">
              <Placeholder inputType="form" /> <ButtonCopy text={'{{form}}'} />
            </div>
            <div className="text-sm leading-relaxed">
              {t('useCaseBuilder.help.formPlaceholderDescription')}
              <PromptSample
                title={t('useCaseBuilder.help.formPlaceholderExample.title')}
                prompt={t('useCaseBuilder.help.formPlaceholderExample.prompt')}
              />
            </div>
          </div>

          <div className="flex flex-col gap-y-4">
            <div className="flex items-center text-base font-bold">
              <Placeholder inputType="select" />{' '}
              <ButtonCopy text={'{{select}}'} />
            </div>
            <div className="text-sm leading-relaxed">
              {t('useCaseBuilder.help.selectPlaceholderDescription')}
              <PromptSample
                title={t('useCaseBuilder.help.selectPlaceholderExample.title')}
                prompt={t(
                  'useCaseBuilder.help.selectPlaceholderExample.prompt'
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-y-4">
            <div className="flex items-center text-base font-bold">
              <Placeholder inputType="retrieveKendra" />{' '}
              <ButtonCopy text={'{{retrieveKendra}}'} />
            </div>
            <div className="text-sm leading-relaxed">
              {t('useCaseBuilder.help.retrieveKendraDescription')}
              <PromptSample
                title={t('useCaseBuilder.help.retrieveKendraExample.title')}
                prompt={t('useCaseBuilder.help.retrieveKendraExample.prompt')}
              />
            </div>
          </div>

          <div className="flex flex-col gap-y-4">
            <div className="flex items-center text-base font-bold">
              <Placeholder inputType="retrieveKnowledgeBase" />{' '}
              <ButtonCopy text={'{{retrieveKnowledgeBase}}'} />
            </div>
            <div className="text-sm leading-relaxed">
              {t('useCaseBuilder.help.retrieveKnowledgeBaseDescription')}
              <PromptSample
                title={t(
                  'useCaseBuilder.help.retrieveKnowledgeBaseExample.title'
                )}
                prompt={t(
                  'useCaseBuilder.help.retrieveKnowledgeBaseExample.prompt'
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UseCaseBuilderHelp;
