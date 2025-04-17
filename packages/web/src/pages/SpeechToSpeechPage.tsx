import React, { useState, useMemo } from 'react';
import { useSpeechToSpeech } from '../hooks/useSpeechToSpeech';
import { useTranslation } from 'react-i18next';
import { PiArrowClockwiseBold, PiStopCircleBold, PiMicrophoneBold } from 'react-icons/pi';
import ChatMessage from '../components/ChatMessage';
import Switch from '../components/Switch';
import ExpandableField from '../components/ExpandableField';
import Button from '../components/Button';
import InputChatContent from '../components/InputChatContent';
import ScrollTopBottom from '../components/ScrollTopBottom';
import Alert from '../components/Alert.tsx';
import useFollow from '../hooks/useFollow';
import BedrockIcon from '../assets/bedrock.svg?react';

const SpeechToSpeech: React.FC = () => {
  const { t } = useTranslation();
  const {
    messages,
    isActive,
    isLoading,
    isAssistantSpeeching,
    startSession,
    closeSession,
  } = useSpeechToSpeech();
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  // TODO: avoid hardcoding
  const [systemPrompt, setSystemPrompt] = useState('You are an AI assistant.');
  const [inputSystemPrompt, setInputSystemPrompt] = useState(systemPrompt);
  const { scrollableContainer, setFollowing } = useFollow();

  const messagesWithoutSystemPrompt = useMemo(() => {
    return messages.filter(m => m.role !== 'system');
  }, [messages]);

  const showingMessages = useMemo(() => {
    if (showSystemPrompt) {
      return messages;
    } else {
      return messagesWithoutSystemPrompt
    }
  }, [messages, messagesWithoutSystemPrompt, showSystemPrompt]);

  const isEmpty = useMemo(() => {
    return messagesWithoutSystemPrompt.length === 0;
  }, [messagesWithoutSystemPrompt]);

  return (<>
    <div
      className={`${!isEmpty ? 'screen:pb-36' : ''} relative`}>
      <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        Speech to Speech
      </div>

      {isEmpty && (
        <div className="flex flex-col justify-center items-center h-[calc(100vh-9rem)]">
          <Alert title="About speech to speech" severity="warning" className="w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6">
            Speech to Speech はまだ実験的な段階です。アーキテクチャ等は今後変更される可能性があります。また、会話履歴は保存されません。
          </Alert>
          <div className="relative flex h-full flex-col items-center justify-center">
            <BedrockIcon className="fill-gray-400" />
          </div>
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
              />
              <div className="w-full border-b border-gray-300"></div>
            </div>
          )
        })}
        {isAssistantSpeeching && (<div>
          <ChatMessage
            chatContent={{ role: 'assistant', content: '' }}
            hideFeedback={true}
            hideSaveSystemContext={true}
            loading={true}
          />
          <div className="w-full border-b border-gray-300"></div>
        </div>)}
      </div>

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
                    setInputSystemPrompt('You are an AI assistant.')
                    setSystemPrompt('You are an AI assistant.')
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
            <Button className="w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6 h-12" onClick={() => { setFollowing(true); startSession(systemPrompt); }} outlined={true} disabled={isLoading}>
              {!isLoading ? (<><PiMicrophoneBold className="size-5 mr-2"/> Start new session</>) : (<span className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></span>)}
            </Button>
          ) : (
            <Button className="w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6 h-12" onClick={closeSession} disabled={isLoading}>
              {!isLoading ? (<><PiStopCircleBold className="size-5 mr-2"/> Close session</>) : (<span className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></span>)}
            </Button>
          )}
      </div>
    </div>
  </>);
};

export default SpeechToSpeech;
