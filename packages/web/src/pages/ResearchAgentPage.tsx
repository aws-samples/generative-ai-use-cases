import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import InputChatContent from '../components/InputChatContent';
import ChatMessage from '../components/ChatMessage';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import useFollow from '../hooks/useFollow';
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import useFiles from '../hooks/useFiles';
import { useTranslation } from 'react-i18next';
import { useResearchAgent } from '../hooks/useResearchAgent';
import { MODELS } from '../hooks/useModel';

// State management
type StateType = {
  content: string;
  selectedMode: string | null;
  hoveredMode: string | null;
  setContent: (c: string) => void;
  setSelectedMode: (m: string | null) => void;
  setHoveredMode: (m: string | null) => void;
};

const useResearchAgentPageState = create<StateType>((set) => ({
  content: '',
  selectedMode: null,
  hoveredMode: null,
  setContent: (s: string) => set({ content: s }),
  setSelectedMode: (m: string | null) => set({ selectedMode: m }),
  setHoveredMode: (m: string | null) => set({ hoveredMode: m }),
}));

const ResearchAgentPage: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const {
    content,
    selectedMode,
    hoveredMode,
    setContent,
    setSelectedMode,
    setHoveredMode,
  } = useResearchAgentPageState();

  // AgentCore Runtime hook
  const {
    messages,
    isEmpty,
    clear,
    loading,
    invokeResearchAgent,
    getResearchRuntime,
    getModelId,
    setModelId,
  } = useResearchAgent(pathname);

  const { scrollableContainer, setFollowing } = useFollow();
  const researchRuntime = getResearchRuntime();
  const { modelIds } = MODELS;
  // Filter to Claude 4+ models only for Research Agent
  const availableModels: string[] = modelIds.filter(
    (id) => id.includes('claude-sonnet-4') || id.includes('claude-opus-4')
  );
  const modelId: string = getModelId();
  const [sessionId] = useState(uuidv4());
  const { clear: clearFiles, uploadedFiles } = useFiles(pathname);

  useEffect(() => {
    setFollowing(true);
    if (!modelId && availableModels.length > 0) {
      setModelId(availableModels[0]);
    }
  }, [setFollowing, modelId, availableModels, setModelId]);

  const onSend = useCallback(() => {
    if (!content || loading) return;
    if (!researchRuntime) return;

    setFollowing(true);

    const uploadedFileObjects = uploadedFiles.filter(
      (file) => !file.errorMessages.length && !file.uploading
    );
    const filesToSend =
      uploadedFileObjects.length > 0
        ? uploadedFileObjects.map((f) => f.file)
        : undefined;

    const mode = (selectedMode || 'technical-research') as
      | 'technical-research'
      | 'mini-research'
      | 'general-research';
    const model = {
      type: 'bedrock' as const,
      modelId: modelId,
      region: import.meta.env.VITE_APP_MODEL_REGION,
    };

    // Use AgentCore Runtime
    invokeResearchAgent({
      agentRuntimeArn: researchRuntime!.arn,
      mode,
      prompt: content,
      model,
      files: filesToSend,
      sessionId,
    });

    setContent('');
    clearFiles();

    if (selectedMode && isEmpty) {
      setSelectedMode(null);
    }
  }, [
    content,
    selectedMode,
    researchRuntime,
    loading,
    isEmpty,
    setFollowing,
    invokeResearchAgent,
    sessionId,
    clearFiles,
    uploadedFiles,
    modelId,
    setSelectedMode,
    setContent,
  ]);

  const onReset = useCallback(() => {
    clear();
    setContent('');
    clearFiles();
  }, [clear, clearFiles, setContent]);

  return (
    <>
      <div className={`${!isEmpty ? 'screen:pb-48' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {t('research.label')}
        </div>

        <div className="mt-2 flex w-full items-end justify-center lg:mt-0 print:hidden">
          <Select
            value={modelId}
            onChange={setModelId}
            options={availableModels.map((m: string) => ({
              value: m,
              label: m,
            }))}
          />
        </div>

        {messages.length === 0 && (
          <div className="relative flex h-[calc(100vh-13rem)] flex-col items-center justify-center gap-y-4">
            <div className="mb-4 text-center text-sm text-gray-500">
              {t('research.description')}
            </div>

            <div className="flex flex-col gap-2">
              <div className="mb-2 text-center text-sm font-semibold text-gray-700">
                {t('research.select_mode')}
              </div>
              <div className="relative grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedMode('technical-research')}
                  onMouseEnter={() => setHoveredMode('technical-research')}
                  onMouseLeave={() => setHoveredMode(null)}
                  className={`rounded border px-4 py-2 text-sm transition-colors ${
                    selectedMode === 'technical-research'
                      ? 'bg-aws-smile border-aws-smile text-white'
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}>
                  {t('research.technical_research')}
                </button>
                <button
                  onClick={() => setSelectedMode('mini-research')}
                  onMouseEnter={() => setHoveredMode('mini-research')}
                  onMouseLeave={() => setHoveredMode(null)}
                  className={`rounded border px-4 py-2 text-sm transition-colors ${
                    selectedMode === 'mini-research'
                      ? 'bg-aws-smile border-aws-smile text-white'
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}>
                  {t('research.mini_research')}
                </button>
                <button
                  onClick={() => setSelectedMode('general-research')}
                  onMouseEnter={() => setHoveredMode('general-research')}
                  onMouseLeave={() => setHoveredMode(null)}
                  className={`rounded border px-4 py-2 text-sm transition-colors ${
                    selectedMode === 'general-research'
                      ? 'bg-aws-smile border-aws-smile text-white'
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}>
                  {t('research.general_research')}
                </button>
                {hoveredMode && (
                  <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-lg">
                    {t(`research.${hoveredMode.replace('-', '_')}_desc`)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={scrollableContainer}>
          {!isEmpty &&
            messages.map((message, idx) => (
              <div key={idx}>
                {idx === 0 && (
                  <div className="w-full border-b border-gray-300"></div>
                )}
                <ChatMessage
                  chatContent={message}
                  loading={loading && idx === messages.length - 1}
                />
                <div className="w-full border-b border-gray-300"></div>
              </div>
            ))}
        </div>

        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>

        <div className="fixed bottom-0 z-0 flex w-full flex-col items-center justify-center lg:pr-[var(--sidebar-w,16rem)] print:hidden">
          <InputChatContent
            content={content}
            disabled={loading}
            onChangeContent={setContent}
            resetDisabled={isEmpty}
            isEmpty={isEmpty}
            onSend={onSend}
            onReset={onReset}
          />
        </div>
      </div>
    </>
  );
};

export default ResearchAgentPage;
