import React, { useEffect, useState, useMemo, useCallback } from 'react';
import useMcp from '../hooks/useMcp';
import useFollow from '../hooks/useFollow';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { PiArrowClockwiseBold } from 'react-icons/pi';
import { MODELS, findModelByModelId } from '../hooks/useModel';
import StrandsIcon from '../assets/strands.svg?react';
import ChatMessage from '../components/ChatMessage';
import Select from '../components/Select';
import Switch from '../components/Switch';
import ExpandableField from '../components/ExpandableField';
import InputChatContent from '../components/InputChatContent';
import Button from '../components/Button';
import ScrollTopBottom from '../components/ScrollTopBottom';
import { UnrecordedMessage } from 'generative-ai-use-cases';
import { McpPageQueryParams } from '../@types/navigate';
import queryString from 'query-string';

type StateType = {
  content: string;
  inputSystemContext: string;
  setContent: (c: string) => void;
  setInputSystemContext: (c: string) => void;
};

const useMcpChatPageState = create<StateType>((set) => {
  return {
    content: '',
    inputSystemContext: '',
    setContent: (s: string) => {
      set(() => ({
        content: s,
      }));
    },
    setInputSystemContext: (s: string) => {
      set(() => ({
        inputSystemContext: s,
      }));
    },
  };
});

const McpChatPage: React.FC = () => {
  const { content, inputSystemContext, setContent, setInputSystemContext } =
    useMcpChatPageState();
  const { t } = useTranslation();
  const {
    postMessage,
    getModelId,
    setModelId,
    getCurrentSystemContext,
    updateSystemContext,
    rawMessages,
    messages,
    loading,
    isEmpty,
    clear,
  } = useMcp();
  const { pathname, search } = useLocation();
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const { scrollableContainer, setFollowing } = useFollow();
  const modelId = useMemo(() => {
    return getModelId();
  }, [getModelId]);
  const currentSystemContext = useMemo(() => {
    return getCurrentSystemContext();
  }, [getCurrentSystemContext]);
  const [showSystemContext, setShowSystemContext] = useState(false);

  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;

    if (search !== '') {
      const params = queryString.parse(search) as McpPageQueryParams;
      if (params.systemPrompt && params.systemPrompt !== '') {
        updateSystemContext(params.systemPrompt);
      } else {
        clear();
        setInputSystemContext(currentSystemContext);
      }
      setContent(params.content ?? '');
      setModelId(
        availableModels.includes(params.modelId ?? '')
          ? params.modelId!
          : _modelId
      );
    } else {
      setModelId(_modelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, setContent, availableModels, pathname]);

  useEffect(() => {
    setInputSystemContext(currentSystemContext);
  }, [currentSystemContext, setInputSystemContext]);

  const onSend = useCallback(() => {
    setFollowing(true);

    const model = findModelByModelId(modelId);

    postMessage({
      systemPrompt: currentSystemContext,
      userPrompt: content,
      messages: messages as UnrecordedMessage[],
      model,
    });
    setContent('');
  }, [
    modelId,
    setFollowing,
    postMessage,
    currentSystemContext,
    content,
    messages,
    setContent,
  ]);

  const onReset = useCallback(() => {
    clear();
    setContent('');
  }, [clear, setContent]);

  const showingMessages = useMemo(() => {
    if (showSystemContext) {
      return rawMessages;
    } else {
      return messages;
    }
  }, [showSystemContext, rawMessages, messages]);

  return (
    <div className={`${!isEmpty ? 'screen:pb-36' : ''} relative`}>
      <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('mcp_chat.title')}
      </div>

      <div className="mt-2 flex w-full items-end justify-center lg:mt-0 print:hidden">
        <Select
          value={modelId}
          onChange={setModelId}
          options={availableModels.map((m) => {
            return { value: m, label: modelDisplayName(m) };
          })}
        />
      </div>

      {isEmpty && (
        <div className="relative flex h-[calc(100vh-9rem)] flex-col items-center justify-center">
          <StrandsIcon className="size-[64px] fill-gray-400" />
        </div>
      )}

      {!isEmpty && (
        <>
          <div className="my-2 flex flex-col items-end pr-3 print:hidden">
            <Switch
              checked={showSystemContext}
              onSwitch={setShowSystemContext}
              label={t('chat.show_system_prompt')}
            />
          </div>

          <div ref={scrollableContainer}>
            {showingMessages.map((chat, idx) => (
              <div key={showSystemContext ? idx : idx + 1}>
                {idx === 0 && (
                  <div className="w-full border-b border-gray-300"></div>
                )}
                <ChatMessage
                  chatContent={chat}
                  loading={loading && idx === showingMessages.length - 1}
                  hideSaveSystemContext={true}
                />
                <div className="w-full border-b border-gray-300"></div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
        <ScrollTopBottom />
      </div>

      <div className="fixed bottom-0 z-0 flex w-full flex-col items-center justify-center lg:pr-64 print:hidden">
        {isEmpty && (
          <ExpandableField
            label={t('chat.system_prompt')}
            className="relative w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6">
            <>
              <div className="absolute -top-2 right-0 mb-2 flex justify-end">
                <Button
                  outlined
                  className="text-xs"
                  onClick={() => {
                    clear();
                    setInputSystemContext(currentSystemContext);
                  }}>
                  {t('chat.initialize')}
                </Button>
              </div>

              <InputChatContent
                disableMarginBottom={true}
                content={inputSystemContext}
                onChangeContent={setInputSystemContext}
                fullWidth={true}
                resetDisabled={true}
                disabled={inputSystemContext === currentSystemContext}
                sendIcon={<PiArrowClockwiseBold />}
                onSend={() => {
                  updateSystemContext(inputSystemContext);
                }}
                hideReset={true}
              />
            </>
          </ExpandableField>
        )}
        <InputChatContent
          content={content}
          disabled={loading}
          onChangeContent={setContent}
          onSend={onSend}
          onReset={onReset}
        />
      </div>
    </div>
  );
};

export default McpChatPage;
