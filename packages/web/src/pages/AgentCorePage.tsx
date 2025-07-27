import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import InputChatContent from '../components/InputChatContent';
import ChatMessage from '../components/ChatMessage';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import useFollow from '../hooks/useFollow';
import { create } from 'zustand';
import BedrockIcon from '../assets/bedrock.svg?react';
import { v4 as uuidv4 } from 'uuid';
import useFiles from '../hooks/useFiles';
import { FileLimit } from 'generative-ai-use-cases';
import { useTranslation } from 'react-i18next';
import { useAgentCore } from '../hooks/useAgentCore';
import { MODELS } from '../hooks/useModel';

// Define file limits for the chat interface
const fileLimit: FileLimit = {
  accept: {
    doc: [
      // TODO
      // '.csv',
      // '.doc',
      // '.docx',
      // '.html',
      // '.md',
      // '.pdf',
      // '.txt',
      // '.xls',
      // '.xlsx',
      // '.yaml',
      // '.json',
    ],
    image: [
      // '.jpg', '.jpeg', '.png', '.gif', '.webp'
    ],
    video: [],
  },
  maxFileCount: 5,
  maxFileSizeMB: 10,
  maxImageFileCount: 5,
  maxImageFileSizeMB: 5,
  maxVideoFileCount: 0,
  maxVideoFileSizeMB: 0,
};

// State management with zustand
type StateType = {
  content: string;
  inputSystemContext: string;
  setContent: (c: string) => void;
  setInputSystemContext: (c: string) => void;
};

const useAgentCorePageState = create<StateType>((set) => {
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

const AgentCorePage: React.FC = () => {
  const { t } = useTranslation();
  const pageTitle = t('agent_core.title', 'AgentCore');
  const { pathname } = useLocation();
  const { content, setContent } = useAgentCorePageState();

  // Use a fixed ID for Agent Core Runtime similar to MCP
  const fixedId = '/agent-core';
  const {
    messages,
    isEmpty,
    clear,
    loading,
    invokeAgentRuntime,
    getGenericRuntime,
    getAllAvailableRuntimes,
    getModelId,
    setModelId,
  } = useAgentCore(fixedId);

  const { scrollableContainer, setFollowing } = useFollow();

  // Get runtimes
  const allAvailableRuntimes = getAllAvailableRuntimes();
  const genericRuntime = getGenericRuntime();

  // Get models from MODELS like ChatPage does
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();

  const [selectedArn, setSelectedArn] = useState('');
  const [sessionId] = useState(uuidv4());
  const [isOver, setIsOver] = useState(false);
  const [writing, setWriting] = useState(false);

  const { clear: clearFiles, uploadFiles, uploadedFiles } = useFiles(pathname);

  // Set the first available ARN as default if none is selected
  useEffect(() => {
    if (allAvailableRuntimes.length > 0 && !selectedArn) {
      setSelectedArn(allAvailableRuntimes[0].arn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAvailableRuntimes]);

  // Initialize system context and model ID only once on mount
  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;
    setModelId(_modelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels]);

  // Accept file types based on model
  const accept = useMemo(() => {
    if (!modelId) return [];
    const feature = MODELS.modelMetadata[modelId];
    return [
      ...(feature.flags.doc ? fileLimit.accept.doc : []),
      ...(feature.flags.image ? fileLimit.accept.image : []),
      ...(feature.flags.video ? fileLimit.accept.video : []),
    ];
  }, [modelId]);

  // File upload enabled
  const fileUpload = useMemo(() => {
    return accept.length > 0;
  }, [accept]);

  // Handle sending a message
  const onSend = useCallback(() => {
    if (!content || !selectedArn || loading) return;

    setFollowing(true);
    setWriting(true);

    try {
      // Get uploaded files from the useFiles hook
      const uploadedFileObjects = uploadedFiles.filter(
        (file) => !file.errorMessages.length && !file.uploading
      );
      const filesToSend =
        uploadedFileObjects.length > 0
          ? uploadedFileObjects.map((uploadedFile) => uploadedFile.file)
          : undefined;

      // Invoke agent runtime with content and files
      invokeAgentRuntime(
        selectedArn,
        sessionId,
        content,
        'DEFAULT',
        filesToSend
      );
      setContent('');
      clearFiles();
    } catch (error) {
      console.error('Error sending message:', error);
      setWriting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    content,
    selectedArn,
    loading,
    setFollowing,
    invokeAgentRuntime,
    sessionId,
    clearFiles,
    uploadedFiles,
  ]);

  // Handle reset
  const onReset = useCallback(() => {
    clear();
    setContent('');
    clearFiles();
  }, [clear, clearFiles, setContent]);

  // Handle stop generation
  const onStop = useCallback(() => {
    setWriting(false);
    // Note: AgentCore doesn't have a direct forceToStop method, so we just update the UI state
  }, []);

  // Handle drag and drop for files
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsOver(false);
    if (event.dataTransfer.files) {
      uploadFiles(Array.from(event.dataTransfer.files), fileLimit, accept);
    }
  };

  // Prepare runtime options
  const runtimeOptions = useMemo(() => {
    return allAvailableRuntimes.map((runtime) => {
      const isGeneric = genericRuntime && runtime.arn === genericRuntime.arn;
      const typeLabel = isGeneric ? '[Generic]' : '[External]';
      return {
        value: runtime.arn,
        label: `${runtime.name} ${typeLabel}`,
      };
    });
  }, [allAvailableRuntimes, genericRuntime]);

  // Prepare model options
  const modelOptions = useMemo(() => {
    return availableModels.map((m) => {
      return { value: m, label: modelDisplayName(m) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels]);

  const showingMessages = useMemo(() => {
    return messages;
  }, [messages]);

  return (
    <>
      <div
        onDragOver={fileUpload ? handleDragOver : undefined}
        className={`${!isEmpty ? 'screen:pb-36' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {pageTitle}
        </div>

        {/* File Drop Overlay */}
        {isOver && fileUpload && (
          <div
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="fixed bottom-0 left-0 right-0 top-0 z-[999] bg-slate-300 p-10 text-center">
            <div className="flex h-full w-full items-center justify-center outline-dashed">
              <div className="font-bold">
                {t('chat.drop_files', 'Drop files here')}
              </div>
            </div>
          </div>
        )}

        {/* Selection Controls */}
        <div className="mb-2 mt-2 flex w-full items-center justify-center gap-4">
          {/* AgentCore Runtime Selection */}
          <div className="flex max-w-xl flex-col items-start px-4">
            <Select
              value={selectedArn}
              onChange={setSelectedArn}
              options={runtimeOptions}
            />
          </div>

          {/* Model Selection */}
          <div className="mt-2 flex items-end justify-center lg:mt-0 print:hidden">
            <Select
              value={modelId}
              onChange={setModelId}
              options={modelOptions}
            />
          </div>
        </div>

        {/* Empty State */}
        {isEmpty && (
          <div className="relative flex h-[calc(100vh-13rem)] flex-col items-center justify-center">
            <BedrockIcon className="fill-gray-400" />
            <p className="mt-4 text-gray-500">
              {t(
                'agent_core.start_conversation',
                'Start a conversation with AgentCore'
              )}
            </p>
          </div>
        )}

        {/* Chat Messages */}
        {!isEmpty && (
          <div ref={scrollableContainer}>
            {showingMessages.map((message, idx) => (
              <div key={idx + 1}>
                {idx === 0 && (
                  <div className="w-full border-b border-gray-300"></div>
                )}
                <ChatMessage
                  idx={idx}
                  chatContent={message}
                  loading={loading && idx === showingMessages.length - 1}
                />
                <div className="w-full border-b border-gray-300"></div>
              </div>
            ))}
          </div>
        )}

        {/* Scroll Controls */}
        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>

        {/* Input Area */}
        <div className="fixed bottom-0 z-0 flex w-full flex-col items-center justify-center lg:pr-64 print:hidden">
          <InputChatContent
            content={content}
            disabled={loading && !writing}
            onChangeContent={setContent}
            resetDisabled={isEmpty}
            onSend={() => {
              if (!loading) {
                onSend();
              } else {
                onStop();
              }
            }}
            onReset={onReset}
            fileUpload={fileUpload}
            fileLimit={fileLimit}
            accept={accept}
            canStop={writing}
          />
        </div>
      </div>
    </>
  );
};

export default AgentCorePage;
