import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSpeechToSpeech } from '../hooks/useSpeechToSpeech';
import { useTranslation } from 'react-i18next';
import {
  PiArrowClockwiseBold,
  PiStopCircleBold,
  PiMicrophoneBold,
  PiEar,
} from 'react-icons/pi';
import ChatMessage from '../components/ChatMessage';
import Switch from '../components/Switch';
import ExpandableField from '../components/ExpandableField';
import Button from '../components/Button';
import InputChatContent from '../components/InputChatContent';
import ScrollTopBottom from '../components/ScrollTopBottom';
import Alert from '../components/Alert.tsx';
import Select from '../components/Select';
import useFollow from '../hooks/useFollow';
import BedrockIcon from '../assets/bedrock.svg?react';
import { toast } from 'sonner';
import { MODELS } from '../hooks/useModel';

const VoiceChatPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    messages,
    isActive,
    isLoading,
    isAssistantSpeeching,
    startSession,
    closeSession,
    errorMessages,
  } = useSpeechToSpeech();
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    t('voiceChat.default_system_prompt')
  );
  const [inputSystemPrompt, setInputSystemPrompt] = useState(systemPrompt);
  const { scrollableContainer, setFollowing } = useFollow();
  const { speechToSpeechModelIds, speechToSpeechModels } = MODELS;
  const [modelId, setModelId] = useState(speechToSpeechModelIds[0]);
  // Define useRef for the cleanup function when leaving the page.
  // To get the latest value without including isActive in the dependency array.
  const isActiveRef = useRef(isActive);

  const messagesWithoutSystemPrompt = useMemo(() => {
    return messages.filter((m) => m.role !== 'system');
  }, [messages]);

  const showingMessages = useMemo(() => {
    if (showSystemPrompt) {
      return messages;
    } else {
      return messagesWithoutSystemPrompt;
    }
  }, [messages, messagesWithoutSystemPrompt, showSystemPrompt]);

  const isEmpty = useMemo(() => {
    return messagesWithoutSystemPrompt.length === 0;
  }, [messagesWithoutSystemPrompt]);

  useEffect(() => {
    if (errorMessages.length > 0) {
      toast.error(errorMessages[errorMessages.length - 1]);
    }
  }, [errorMessages]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        closeSession();
      }
    };
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className={`${!isEmpty ? 'screen:pb-36' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {t('voiceChat.title')}
        </div>

        {isEmpty && !isLoading && !isActive && (
          <div className="mt-2 flex w-full items-end justify-center lg:mt-0 print:hidden">
            <Select
              value={modelId}
              onChange={setModelId}
              options={speechToSpeechModelIds.map((m) => {
                return { value: m, label: m };
              })}
            />
          </div>
        )}

        {isEmpty && !isLoading && !isActive && (
          <div className="flex h-[calc(100vh-9rem)] flex-col items-center justify-center">
            <Alert
              title={t('voiceChat.experimental_warning_title')}
              severity="warning"
              className="w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6">
              {t('voiceChat.experimental_warning')}
            </Alert>
            <div className="relative flex h-full flex-col items-center justify-center">
              <BedrockIcon className="fill-gray-400" />
            </div>
          </div>
        )}

        {isEmpty && isLoading && (
          <div className="flex h-[calc(100vh-9rem)] animate-pulse flex-col items-center justify-center">
            <span className="size-32 animate-spin rounded-full border-8 border-gray-400 border-t-transparent"></span>
          </div>
        )}

        {isEmpty && !isLoading && isActive && (
          <div className="flex h-[calc(100vh-9rem)] animate-pulse flex-col items-center justify-center">
            <PiEar className="size-32" />
            <div className="mt-5 text-lg">{t('voiceChat.im_listening')}</div>
          </div>
        )}

        {!isEmpty && (
          <div className="my-2 flex flex-col items-end pr-3 print:hidden">
            <Switch
              checked={showSystemPrompt}
              onSwitch={setShowSystemPrompt}
              label={t('chat.show_system_prompt')}
            />
          </div>
        )}

        {!isEmpty && (
          <div ref={scrollableContainer}>
            {showingMessages.map((m, idx) => {
              return (
                <div key={showSystemPrompt ? idx : idx + 1}>
                  {idx === 0 && (
                    <div className="w-full border-b border-gray-300"></div>
                  )}
                  <ChatMessage
                    chatContent={m}
                    hideFeedback={true}
                    hideSaveSystemContext={true}
                    loading={
                      m.role === 'assistant' &&
                      idx === showingMessages.length - 1 &&
                      isAssistantSpeeching &&
                      isActive
                    }
                  />
                  <div className="w-full border-b border-gray-300"></div>
                </div>
              );
            })}
          </div>
        )}

        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>

        <div className="fixed bottom-7 z-0 flex w-full flex-col items-center justify-center lg:pr-64 print:hidden">
          {!isLoading && !isActive && (
            <ExpandableField
              label={t('chat.system_prompt')}
              className="relative w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6">
              <>
                <div className="absolute -top-2 right-0 mb-2 flex justify-end">
                  <Button
                    outlined
                    className="text-xs"
                    onClick={() => {
                      setInputSystemPrompt(
                        t('voiceChat.default_system_prompt')
                      );
                      setSystemPrompt(t('voiceChat.default_system_prompt'));
                    }}>
                    {t('chat.initialize')}
                  </Button>
                </div>

                <InputChatContent
                  disableMarginBottom={true}
                  content={inputSystemPrompt}
                  onChangeContent={setInputSystemPrompt}
                  fullWidth={true}
                  resetDisabled={true}
                  hideReset={true}
                  disabled={inputSystemPrompt === systemPrompt}
                  sendIcon={<PiArrowClockwiseBold />}
                  onSend={() => {
                    setSystemPrompt(inputSystemPrompt);
                  }}
                />
              </>
            </ExpandableField>
          )}

          {!isActive ? (
            <Button
              className="h-12 w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6"
              onClick={() => {
                const model = speechToSpeechModels.find(
                  (m) => m.modelId === modelId
                );
                setFollowing(true);
                startSession(systemPrompt, model!);
              }}
              outlined={true}
              disabled={isLoading}>
              {!isLoading ? (
                <>
                  <PiMicrophoneBold className="mr-2 size-5" />{' '}
                  {t('voiceChat.start')}
                </>
              ) : (
                <span className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></span>
              )}
            </Button>
          ) : (
            <Button
              className="h-12 w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6"
              onClick={closeSession}
              disabled={isLoading}>
              {!isLoading ? (
                <>
                  <PiStopCircleBold className="mr-2 size-5" />{' '}
                  {t('voiceChat.close')}
                </>
              ) : (
                <span className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></span>
              )}
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default VoiceChatPage;
