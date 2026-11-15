import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import InputChatContent from '../components/InputChatContent';
import ChatMessage from '../components/ChatMessage';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import useFollow from '../hooks/useFollow';
import { create } from 'zustand';
import BedrockIcon from '../assets/bedrock.svg?react';
import { v4 as uuidv4 } from 'uuid';
import useFiles from '../hooks/useFiles';
import { useTranslation } from 'react-i18next';
import { useAgentCore } from '../hooks/useAgentCore';
import { MODELS } from '../hooks/useModel';
import { PiArrowLeft } from 'react-icons/pi';
import ButtonIcon from '../components/ButtonIcon';
import useDropOverlay from '../hooks/useDropOverlay';
import useAcceptedExtensions from '../hooks/useAcceptedExtensions';
import { agentCoreFileLimit } from '../utils/fileLimit';

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
  const { agentArn } = useParams<{ agentArn?: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { content, setContent } = useAgentCorePageState();

  const {
    messages,
    isEmpty,
    clear,
    loading,
    invokeAgentRuntime,
    getGenericRuntime,
    getAllAvailableRuntimes,
    getExternalRuntimes,
    getModelId,
    setModelId,
  } = useAgentCore(pathname);

  const { scrollableContainer, setFollowing } = useFollow();

  // Get runtimes
  const allAvailableRuntimes = getAllAvailableRuntimes();
  const genericRuntime = getGenericRuntime();
  const externalRuntimes = getExternalRuntimes();

  // Get models from MODELS like ChatPage does
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();

  const [selectedArn, setSelectedArn] = useState('');
  const [sessionId] = useState(uuidv4());
  const [writing, setWriting] = useState(false);

  const { clear: clearFiles, uploadFiles, uploadedFiles } = useFiles(pathname);

  // Set the ARN from URL parameter or first available ARN as default
  useEffect(() => {
    if (agentArn) {
      // If agentArn is provided in URL, use it
      const decodedArn = decodeURIComponent(agentArn);
      setSelectedArn(decodedArn);
    } else if (allAvailableRuntimes.length > 0 && !selectedArn) {
      // Otherwise, use the first available ARN
      setSelectedArn(allAvailableRuntimes[0].arn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentArn, allAvailableRuntimes]);

  // Initialize system context and model ID only once on mount
  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;
    setModelId(_modelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels]);

  // Accept file types based on model
  const accept = useAcceptedExtensions(agentCoreFileLimit, modelId);

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

  // Drop overlay; see useDropOverlay for why it closes on its own.
  const onDropFiles = useCallback(
    (files: File[]) => uploadFiles(files, agentCoreFileLimit, accept),
    [uploadFiles, accept]
  );
  const { isOver, hideOverlay, handleDragOver, handleDragLeave, handleDrop } =
    useDropOverlay(onDropFiles);

  // Prepare runtime options
  const runtimeOptions = useMemo(() => {
    // If agentArn is provided, only show that specific runtime
    if (agentArn) {
      const decodedArn = decodeURIComponent(agentArn);
      const runtime = allAvailableRuntimes.find((r) => r.arn === decodedArn);
      if (runtime) {
        const isGeneric = genericRuntime && runtime.arn === genericRuntime.arn;
        const isExternal = externalRuntimes.some((r) => r.arn === runtime.arn);
        return [
          {
            value: runtime.arn,
            label: runtime.name,
            tags: isGeneric
              ? ['Generic']
              : isExternal
                ? ['External']
                : undefined,
          },
        ];
      }
      return [];
    }

    // Otherwise, show all available runtimes
    return allAvailableRuntimes.map((runtime) => {
      const isGeneric = genericRuntime && runtime.arn === genericRuntime.arn;
      const isExternal = externalRuntimes.some((r) => r.arn === runtime.arn);
      return {
        value: runtime.arn,
        label: runtime.name,
        tags: isGeneric ? ['Generic'] : isExternal ? ['External'] : undefined,
      };
    });
  }, [agentArn, allAvailableRuntimes, genericRuntime, externalRuntimes]);

  // Prepare model options
  const modelOptions = useMemo(() => {
    return availableModels.map((m) => {
      return { value: m, label: modelDisplayName(m) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels]);

  // Find the current runtime configuration
  const currentRuntime = useMemo(() => {
    if (agentArn) {
      const decodedArn = decodeURIComponent(agentArn);
      return allAvailableRuntimes.find((r) => r.arn === decodedArn);
    }
    return undefined;
  }, [agentArn, allAvailableRuntimes]);

  // Calculate page title from runtime options
  const pageTitle = useMemo(() => {
    if (currentRuntime) {
      return currentRuntime.display_name || currentRuntime.name;
    }
    if (agentArn && runtimeOptions.length > 0) {
      const runtime = runtimeOptions.find(
        (option) => option.value === decodeURIComponent(agentArn)
      );
      return runtime ? runtime.label : t('agent_core.title', 'AgentCore');
    }
    return t('agent_core.title', 'AgentCore');
  }, [currentRuntime, agentArn, runtimeOptions, t]);

  const showingMessages = useMemo(() => {
    return messages;
  }, [messages]);

  return (
    <>
      <div
        onDragOver={fileUpload ? handleDragOver : undefined}
        className={`${!isEmpty ? 'screen:pb-48' : ''} relative`}>
        <div className="invisible my-0 flex h-0 flex-col items-center justify-center lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {agentArn && (
            <div className="absolute left-5">
              <ButtonIcon
                onClick={() => navigate('/agent-core')}
                title={t('common.back')}>
                <PiArrowLeft />
              </ButtonIcon>
            </div>
          )}
          <div className="text-xl font-semibold">{pageTitle}</div>
          {currentRuntime?.description && (
            <div className="mt-1 text-sm text-gray-500">
              {currentRuntime.description}
            </div>
          )}
        </div>

        {/* File Drop Overlay */}
        {isOver && fileUpload && (
          <div
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={hideOverlay}
            className="fixed bottom-0 left-0 right-0 top-0 z-[999] bg-slate-300 p-10 text-center">
            <div className="flex h-full w-full items-center justify-center outline-dashed">
              <div className="font-bold">
                {t('chat.drop_files', 'Drop files here')}
              </div>
            </div>
          </div>
        )}

        {/* Selection Controls */}
        <div className="my-2 flex w-full flex-col items-center justify-center gap-x-2 md:flex-row print:hidden">
          {/* AgentCore Runtime Selection - Hide if specific agent is selected */}
          {!agentArn && (
            <div className="w-4/5 sm:w-1/2 md:w-fit">
              <Select
                value={selectedArn}
                onChange={setSelectedArn}
                options={runtimeOptions}
                label={t('agent_core.runtime')}
                fullWidth
                showTags
              />
            </div>
          )}
          {/* Model Selection */}
          <div className="w-4/5 sm:w-1/2 md:w-fit">
            <Select
              value={modelId}
              onChange={setModelId}
              options={modelOptions}
              label={t('agent_core.model')}
              fullWidth
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
            isEmpty={isEmpty}
            onSend={() => {
              if (!loading) {
                onSend();
              } else {
                onStop();
              }
            }}
            onReset={onReset}
            fileUpload={fileUpload}
            fileLimit={agentCoreFileLimit}
            accept={accept}
            canStop={writing}
          />
        </div>
      </div>
    </>
  );
};

export default AgentCorePage;
