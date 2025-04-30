import React, { useCallback, useEffect } from 'react';
import InputChatContent from '../components/InputChatContent';
import { create } from 'zustand';
import useChat from '../hooks/useChat';
import useRag from '../hooks/useRag';
import { useLocation } from 'react-router-dom';
import ChatMessage from '../components/ChatMessage';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import useFollow from '../hooks/useFollow';
import BedrockIcon from '../assets/bedrock.svg?react';
import KendraIcon from '../assets/kendra.svg?react';
import { PiPlus } from 'react-icons/pi';
import { RagPageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import queryString from 'query-string';
import { useTranslation } from 'react-i18next';

type StateType = {
  content: string;
  setContent: (c: string) => void;
};

const useRagPageState = create<StateType>((set) => {
  return {
    content: '',
    setContent: (s: string) => {
      set(() => ({
        content: s,
      }));
    },
  };
});

const RagPage: React.FC = () => {
  const { t } = useTranslation();
  const { content, setContent } = useRagPageState();
  const { pathname, search } = useLocation();
  const { getModelId, setModelId } = useChat(pathname);
  const { postMessage, clear, loading, messages, isEmpty } = useRag(pathname);
  const { scrollableContainer, setFollowing } = useFollow();
  const { modelIds: availableModels } = MODELS;
  const modelId = getModelId();

  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;
    if (search !== '') {
      const params = queryString.parse(search) as RagPageQueryParams;
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
  }, [availableModels, modelId, search, setContent]);

  const onSend = useCallback(() => {
    setFollowing(true);
    postMessage(content);
    setContent('');
  }, [content, postMessage, setContent, setFollowing]);

  const onReset = useCallback(() => {
    clear();
    setContent('');
  }, [clear, setContent]);

  return (
    <>
      <div className={`${!isEmpty ? 'screen:pb-36' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {t('rag.title')}
        </div>

        <div className="mt-2 flex w-full items-end justify-center lg:mt-0">
          <Select
            value={modelId}
            onChange={setModelId}
            options={availableModels.map((m) => {
              return { value: m, label: m };
            })}
          />
        </div>

        {isEmpty && (
          <div className="relative flex h-[calc(100vh-9rem)] flex-col items-center justify-center">
            <div className="flex items-center gap-x-3">
              <KendraIcon className="size-[64px] fill-gray-400" />
              <PiPlus className="text-2xl text-gray-400" />
              <BedrockIcon className="fill-gray-400" />
            </div>
          </div>
        )}

        <div ref={scrollableContainer}>
          {messages.map((chat, idx) => (
            <div key={idx}>
              <ChatMessage
                idx={idx}
                chatContent={chat}
                loading={loading && idx === messages.length - 1}
              />
              <div className="w-full border-b border-gray-300"></div>
            </div>
          ))}
        </div>

        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>

        <div className="fixed bottom-0 z-0 flex w-full items-end justify-center lg:pr-64 print:hidden">
          <InputChatContent
            content={content}
            disabled={loading}
            onChangeContent={setContent}
            onSend={() => {
              onSend();
            }}
            onReset={onReset}
          />
        </div>
      </div>
    </>
  );
};

export default RagPage;
