import React, { useCallback, useEffect, useState } from 'react';
import { PiArrowsCounterClockwise, PiPaperPlaneRightFill, PiSpinner } from 'react-icons/pi';
import { BaseProps } from '../../../@types/common';
import { twMerge } from 'tailwind-merge';
import Button from '../common/components/Button';
import useChat from './useChat';
import TextareaChatContent from './TextareaChatContent';
import SelectPrompt from './SelectPrompt';
import { PromptSetting } from '../../../@types/settings';
import { produce } from 'immer';
import { IconWrapper } from '../../components/IconWrapper';

type Props = BaseProps & {
  initContent: string;
  initPromptSetting?: PromptSetting;
};

const InputContent: React.FC<Props> = (props) => {
  const { isEmptyMessages, sendMessage, clearMessages, isLoading } = useChat();

  const [content, setContent] = useState('');
  const [formValues, setFormValues] = useState<string[]>([]);

  const [promptSetting, setPromptSetting] = useState<PromptSetting>({
    systemContextId: '',
    systemContextTitle: '',
    systemContext: '',
  });

  useEffect(() => {
    if (props.initPromptSetting?.initializeMessages && !props.initPromptSetting?.directSend) {
      clearMessages();
    }
    if (props.initPromptSetting?.directSend) {
      sendMessage(
        props.initPromptSetting,
        props.initContent,
        props.initPromptSetting.initializeMessages,
      );
    } else {
      if (props.initContent) {
        setContent(props.initContent);
      }
      if (props.initPromptSetting) {
        setPromptSetting(props.initPromptSetting);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initContent, props.initPromptSetting]);

  useEffect(() => {
    if (promptSetting.formDefinitions && promptSetting.formDefinitions.length > 0) {
      const tmp = new Array(promptSetting.formDefinitions.length).fill('');
      const contentIndex = promptSetting.formDefinitions.findIndex((def) => def.autoCopy);
      if (contentIndex > -1) {
        tmp[contentIndex] = props.initContent;
      }
      setFormValues(tmp);
    }
  }, [promptSetting, props.initContent]);

  const send = useCallback(() => {
    if (isEmptyMessages && promptSetting.useForm) {
      let content_ = '';
      promptSetting.formDefinitions?.forEach((def, idx) => {
        content_ += `<${def.tag}>
${formValues[idx]}
</${def.tag}>
`;
      });
      sendMessage(promptSetting, content_);
      setFormValues(new Array(formValues.length).fill(''));
    } else {
      sendMessage(promptSetting, content);
    }

    setContent('');
  }, [content, formValues, isEmptyMessages, promptSetting, sendMessage]);

  return (
    <div className={twMerge('relative bg-aws-squid-ink px-2 pb-1', props.className)}>
      <div className="absolute -top-12 w-full h-12 -mx-2 bg-gradient-to-t bg-transparent from-aws-squid-ink"></div>
      <div className="mb-2 flex justify-end">
        {isEmptyMessages ? (
          <SelectPrompt
            selectedPromptId={promptSetting.systemContextId}
            onChange={(prompt) => {
              setPromptSetting({
                ...prompt,
              });
            }}
          />
        ) : (
          <Button
            className=""
            outlined
            icon={<IconWrapper icon={PiArrowsCounterClockwise} />}
            onClick={clearMessages}
          >
            最初からやり直す
          </Button>
        )}
      </div>
      {isEmptyMessages &&
      promptSetting.useForm &&
      (promptSetting.formDefinitions?.length ?? 0) > 0 ? (
        <div>
          {promptSetting.formDefinitions?.map((def, idx) => (
            <div key={idx}>
              <div className="text-xs">{def.label}</div>
              <TextareaChatContent
                value={def.autoCopy ? content : (formValues[idx] ?? '')}
                onChange={(value) => {
                  setFormValues(
                    produce(formValues, (draft) => {
                      draft[idx] = value;
                    }),
                  );
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <TextareaChatContent
          value={content}
          onChange={(value) => {
            setContent(value);
          }}
          onSend={send}
        />
      )}
      <button
        className={twMerge(
          'absolute right-3 bottom-3 mb-0.5  text-white p-2 rounded text-xl',
          isLoading ? 'border' : 'bg-aws-smile',
        )}
        disabled={isLoading}
        onClick={() => {
          send();
        }}
      >
        {isLoading ? (
          <IconWrapper icon={PiSpinner} className="animate-spin" />
        ) : (
          <IconWrapper icon={PiPaperPlaneRightFill} />
        )}
      </button>
    </div>
  );
};

export default InputContent;
