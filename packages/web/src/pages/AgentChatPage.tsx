import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import InputChatContent from '../components/InputChatContent';
import useChat from '../hooks/useChat';
import ChatMessage from '../components/ChatMessage';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import useFollow from '../hooks/useFollow';
import { create } from 'zustand';
import BedrockIcon from '../assets/bedrock.svg?react';
import { AgentPageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import { getPrompter } from '../prompts';
import { v4 as uuidv4 } from 'uuid';
import queryString from 'query-string';
import useFiles from '../hooks/useFiles';
import { FileLimit } from 'generative-ai-use-cases';
import { useTranslation } from 'react-i18next';

const fileLimit: FileLimit = {
  accept: {
    doc: [
      '.csv',
      '.doc',
      '.docx',
      '.html',
      '.md',
      '.pdf',
      '.txt',
      '.xls',
      '.xlsx',
      '.yaml',
      '.json',
    ],
    image: [],
    video: [],
  },
  maxFileCount: 5,
  maxFileSizeMB: 10,
  maxImageFileCount: 0,
  maxImageFileSizeMB: 0,
  maxVideoFileCount: 0,
  maxVideoFileSizeMB: 0,
};

type StateType = {
  sessionId: string;
  content: string;
  setSessionId: (c: string) => void;
  setContent: (c: string) => void;
};

const useChatPageState = create<StateType>((set) => {
  return {
    sessionId: uuidv4(),
    content: '',
    setSessionId: (s: string) => {
      set(() => ({
        sessionId: s,
      }));
    },
    setContent: (s: string) => {
      set(() => ({
        content: s,
      }));
    },
  };
});

const AgentChatPage: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId, content, setContent, setSessionId } = useChatPageState();
  const { pathname, search } = useLocation();
  const { agentName } = useParams();

  const {
    getModelId,
    setModelId,
    loading,
    loadingMessages,
    isEmpty,
    messages,
    clear,
    postChat,
    updateSystemContextByModel,
    retryGeneration,
  } = useChat(pathname);
  const { scrollableContainer, setFollowing } = useFollow();
  const { agentNames: availableModels } = MODELS;
  const modelId = getModelId();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);

  const [isOver, setIsOver] = useState(false);
  const {
    clear: clearFiles,
    uploadedFiles,
    uploadFiles,
    base64Cache,
  } = useFiles(pathname);

  useEffect(() => {
    updateSystemContextByModel();
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, [prompter]);

  const title = useMemo(() => {
    if (agentName) {
      return agentName;
    } else {
      return t('agent.title');
    }
  }, [agentName, t]);

  useEffect(() => {
    if (agentName) {
      setModelId(agentName);
    } else {
      const _modelId = !modelId ? availableModels[0] : modelId;
      if (search !== '') {
        const params = queryString.parse(search) as AgentPageQueryParams;
        setContent(params.content ?? '');
        setModelId(
          availableModels.includes(params.modelId ?? '')
            ? params.modelId!
            : _modelId
        );
      } else {
        setModelId(_modelId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setContent, modelId, availableModels, search, agentName]);

  const onSend = useCallback(() => {
    setFollowing(true);
    postChat(
      content,
      false,
      undefined,
      undefined,
      sessionId,
      uploadedFiles,
      undefined,
      undefined,
      undefined,
      base64Cache
    );
    setContent('');
    clearFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, setFollowing]);

  const onRetry = useCallback(() => {
    retryGeneration(
      false,
      undefined,
      undefined,
      sessionId,
      undefined,
      undefined,
      undefined,
      undefined,
      base64Cache
    );
  }, [retryGeneration, sessionId, base64Cache]);

  const onReset = useCallback(() => {
    clear();
    setContent('');
    setSessionId(uuidv4());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clear]);

  const showingMessages = useMemo(() => {
    return messages;
  }, [messages]);

  const handleDragOver = (event: React.DragEvent) => {
    // When a file is dragged, display the overlay
    event.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    // When a file is dragged, hide the overlay
    event.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    // When a file is dropped, add the file
    event.preventDefault();
    setIsOver(false);
    if (event.dataTransfer.files) {
      // Reflect the file and upload it
      uploadFiles(
        Array.from(event.dataTransfer.files),
        fileLimit,
        fileLimit.accept.doc
      );
    }
  };

  return (
    <>
      <div
        onDragOver={handleDragOver}
        className={`${!isEmpty ? 'screen:pb-36' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {title}
        </div>

        {isOver && (
          <div
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="fixed bottom-0 left-0 right-0 top-0 z-[999] bg-slate-300 p-10 text-center">
            <div className="flex h-full w-full items-center justify-center outline-dashed">
              <div className="font-bold">{t('agent.drop_files')}</div>
            </div>
          </div>
        )}

        {!agentName && (
          <div className="mb-6 mt-2 flex w-full items-end justify-center lg:mt-0">
            <Select
              value={modelId}
              onChange={setModelId}
              options={availableModels.map((m) => {
                return { value: m, label: m };
              })}
            />
          </div>
        )}

        {((isEmpty && !loadingMessages) || loadingMessages) && (
          <div className="relative flex h-[calc(100vh-13rem)] flex-col items-center justify-center">
            <BedrockIcon
              className={`fill-gray-400 ${
                loadingMessages ? 'animate-pulse' : ''
              }`}
            />
          </div>
        )}

        <div ref={scrollableContainer}>
          {!isEmpty &&
            showingMessages.map((chat, idx) => (
              <div key={idx + 1}>
                {idx === 0 && (
                  <div className="w-full border-b border-gray-300"></div>
                )}
                <ChatMessage
                  idx={idx}
                  chatContent={chat}
                  loading={loading && idx === showingMessages.length - 1}
                  allowRetry={idx === showingMessages.length - 1}
                  retryGeneration={onRetry}
                />
                <div className="w-full border-b border-gray-300"></div>
              </div>
            ))}
        </div>

        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>

        <div className="fixed bottom-0 z-0 flex w-full flex-col items-center justify-center lg:pr-64 print:hidden">
          <InputChatContent
            content={content}
            disabled={loading}
            onChangeContent={setContent}
            resetDisabled={false}
            onSend={() => {
              onSend();
            }}
            onReset={onReset}
            fileUpload={true}
            fileLimit={fileLimit}
            accept={fileLimit.accept.doc}
          />
        </div>
      </div>
    </>
  );
};

export default AgentChatPage;
