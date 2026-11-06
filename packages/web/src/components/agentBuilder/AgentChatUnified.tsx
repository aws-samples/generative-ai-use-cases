import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import InputChatContent from '../InputChatContent';
import ChatMessage from '../ChatMessage';
import ScrollTopBottom from '../ScrollTopBottom';
import useFollow from '../../hooks/useFollow';
import { useAgentCore } from '../../hooks/useAgentCore';
import { MODELS } from '../../hooks/useModel';
import useFiles from '../../hooks/useFiles';
import { FileLimit, AgentConfiguration } from 'generative-ai-use-cases';
import BedrockIcon from '../../assets/bedrock.svg?react';
import {
  PiRobot as RobotIcon,
  PiPencil as EditIcon,
  PiArrowLeft as BackIcon,
} from 'react-icons/pi';
import ButtonIcon from '../ButtonIcon';
import Select from '../Select';

// Define file limits for the chat interface
// File size limits for AgentCore (AgentCore Runtime route: Frontend → AgentCore Runtime → Bedrock Converse API)
// - AgentCore Runtime payload limit: 100MB (not a bottleneck)
// - Anthropic Claude max request size: 32MB for the entire HTTP request body
// - Nova PDF/DOCX direct upload limit: 25MB combined (model-side error if exceeded)
// - Setting to 32MB as the upper bound based on Claude's documented limit
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
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    video: [],
  },
  maxFileCount: 5,
  maxFileSizeMB: 32,
  maxImageFileCount: 5,
  maxImageFileSizeMB: 5,
  maxVideoFileCount: 0,
  maxVideoFileSizeMB: 0,
};

interface AgentChatProps {
  agent: AgentConfiguration;
  sessionId?: string;
  className?: string;
  showHeader?: boolean;
  layout?: 'fullscreen' | 'card';
  hideScrollButtons?: boolean;
  showAgentInfo?: boolean;
  showEditButton?: boolean;
  onEdit?: () => void;
  onBack?: () => void;
  actions?: React.ReactNode;
}

const AgentChatUnified: React.FC<AgentChatProps> = ({
  agent,
  sessionId: providedSessionId,
  className = '',
  showHeader = true,
  layout = 'fullscreen',
  hideScrollButtons = false,
  showAgentInfo = true,
  showEditButton = false,
  onEdit,
  onBack,
  actions,
}) => {
  const { t } = useTranslation();

  // Generate session ID if not provided
  const { pathname } = useLocation();
  const [sessionId] = useState(() => providedSessionId || uuidv4());
  const { scrollableContainer, setFollowing } = useFollow();

  // AgentCore for chat functionality
  const {
    messages: chatMessages,
    isEmpty: chatIsEmpty,
    clear: clearChat,
    loading: chatLoading,
    invokeAgentRuntime,
    getAgentBuilderRuntime,
    updateSystemContext,
    getModelId,
    setModelId,
  } = useAgentCore(pathname);

  const [chatContent, setChatContent] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [isOver, setIsOver] = useState(false);

  // Get models from MODELS
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();

  // File handling
  const { clear: clearFiles, uploadFiles, uploadedFiles } = useFiles(pathname);

  // Initialize model ID when agent is loaded
  useEffect(() => {
    if (agent && availableModels.length > 0) {
      const agentModelId = agent.modelId || availableModels[0];
      setModelId(agentModelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.modelId, availableModels]);

  // Initialize system context when component mounts (only once per agent)
  useEffect(() => {
    if (!initialized && agent) {
      console.log('Initializing agent chat:', agent.name);

      // Set the system context to the agent's system prompt
      const systemPrompt = `${agent.systemPrompt || 'You are a helpful assistant.'}

Agent Name: ${agent.name}
Agent Description: ${agent.description || 'No description provided'}

Please respond as this agent with the specified behavior and personality.`;

      updateSystemContext(systemPrompt);
      setInitialized(true);
      handleResetChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.agentId, initialized]);

  // Update system context when agent data changes (for real-time updates)
  useEffect(() => {
    if (initialized && agent) {
      console.log('Updating agent context:', agent.name);

      const systemPrompt = `${agent.systemPrompt || 'You are a helpful assistant.'}

Agent Name: ${agent.name}
Agent Description: ${agent.description || 'No description provided'}

Please respond as this agent with the specified behavior and personality.`;

      updateSystemContext(systemPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.name, agent?.description, agent?.systemPrompt, initialized]);

  // Accept file types based on model
  const accept = useMemo(() => {
    if (!modelId) return [];
    const feature = MODELS.getModelMetadata(modelId);
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

  const handleSendMessage = useCallback(async () => {
    if (!chatContent.trim() || chatLoading) return;

    if (layout === 'fullscreen') {
      setFollowing(true);
    }

    try {
      const agentBuilderRuntime = getAgentBuilderRuntime();
      if (!agentBuilderRuntime) {
        throw new Error('No AgentBuilder runtime available');
      }

      console.log('Sending message with agent:', agent.name);
      console.log('Using sessionId:', sessionId);
      console.log('MCP servers count:', agent.mcpServers?.length || 0);
      console.log('Code execution enabled:', agent.codeExecutionEnabled);

      // Get uploaded files from the useFiles hook
      const uploadedFileObjects = uploadedFiles.filter(
        (file) => !file.errorMessages.length && !file.uploading
      );
      const filesToSend =
        uploadedFileObjects.length > 0
          ? uploadedFileObjects.map((uploadedFile) => uploadedFile.file)
          : undefined;

      // Use AgentCore's invokeAgentRuntime with MCP servers
      invokeAgentRuntime(
        agentBuilderRuntime.arn,
        sessionId,
        chatContent,
        'DEFAULT',
        filesToSend,
        'current-user',
        agent.mcpServers,
        agent.agentId,
        modelId,
        agent.codeExecutionEnabled ?? false,
        agent.webSearchEnabled ?? false
      );

      setChatContent('');
      clearFiles();
    } catch (error) {
      console.error('Error sending message:', error);
      alert(
        `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      );
    }
  }, [
    chatContent,
    layout,
    agent,
    modelId,
    chatLoading,
    setFollowing,
    invokeAgentRuntime,
    getAgentBuilderRuntime,
    sessionId,
    uploadedFiles,
    clearFiles,
  ]);

  const handleResetChat = useCallback(() => {
    clearChat();
    setChatContent('');
    clearFiles();
  }, [clearChat, clearFiles]);

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

  // Render unified header with all controls
  const renderUnifiedHeader = () => (
    <div className="flex flex-col items-center gap-3">
      {/* Header with title, description and actions */}
      <div className="flex items-start justify-center gap-3">
        {/* Back button positioned absolutely on the left */}
        {onBack && (
          <div className="absolute left-5">
            <ButtonIcon onClick={onBack} title={t('common.back')}>
              <BackIcon />
            </ButtonIcon>
          </div>
        )}

        <div className="min-w-0 flex-1 text-center">
          {/* Agent Title */}
          <div className="truncate text-xl font-semibold">
            {agent?.name || t('agent_builder.agent_chat')}
          </div>
          {/* Agent Description */}
          {agent?.description && (
            <div className="mt-1 break-words text-sm text-gray-600">
              {agent.description}
            </div>
          )}
        </div>

        <div className="right-0 top-0 flex shrink-0 items-center gap-2">
          {showEditButton && onEdit && (
            <ButtonIcon onClick={onEdit} title={t('common.edit')}>
              <EditIcon />
            </ButtonIcon>
          )}
          {actions}
        </div>
      </div>

      {/* Controls - all stacked vertically for consistent layout */}
      {showAgentInfo && (
        <div className="flex w-full flex-col items-center gap-3 print:hidden">
          {/* Model Selection */}
          <div className="w-full max-w-md">
            <Select
              value={modelId}
              onChange={setModelId}
              options={availableModels.map((model) => ({
                value: model,
                label:
                  model === agent.modelId
                    ? `${modelDisplayName(model)} (${t('common.default')})`
                    : modelDisplayName(model),
              }))}
              fullWidth
              showTags
            />
          </div>

          {/* Agent Capabilities */}
          {(agent.codeExecutionEnabled ||
            agent.webSearchEnabled ||
            (agent.mcpServers && agent.mcpServers.length > 0)) && (
            <div className="flex flex-wrap justify-center gap-2">
              {/* Code Execution - only show when enabled */}
              {agent.codeExecutionEnabled && (
                <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  {t('agent_builder.code_execution')}
                </span>
              )}

              {/* Web Search - only show when enabled */}
              {agent.webSearchEnabled && (
                <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  {t('agent_builder.web_search')}
                </span>
              )}

              {/* MCP Server List */}
              {agent.mcpServers &&
                agent.mcpServers.map((serverName) => (
                  <span
                    key={serverName}
                    className="inline-block rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    {serverName}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div
      className={`flex ${layout === 'card' ? 'h-full' : 'h-[calc(100vh-13rem)]'} flex-col items-center justify-center ${layout === 'card' ? 'p-8' : ''}`}>
      {agent ? (
        <>
          <RobotIcon className="h-16 w-16 fill-gray-400 text-gray-400" />
          <p className="mt-4 text-center text-gray-500">
            {t('agent_builder.start_chatting_with', { name: agent.name })}
          </p>
          {agent.description && (
            <p className="mt-2 text-center text-sm text-gray-400">
              {agent.description}
            </p>
          )}
        </>
      ) : (
        <>
          <BedrockIcon className="fill-gray-400" />
          <p className="mt-4 text-gray-500">
            {t('agent_builder.loading_agent')}
          </p>
        </>
      )}
    </div>
  );

  // Render file drop overlay
  const renderFileDropOverlay = () =>
    isOver &&
    fileUpload && (
      <div
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`${layout === 'card' ? 'absolute inset-0' : 'fixed bottom-0 left-0 right-0 top-0'} z-[999] bg-slate-300/75 p-10 text-center`}>
        <div className="flex h-full w-full items-center justify-center outline-dashed">
          <div className="font-bold">{t('chat.drop_files')}</div>
        </div>
      </div>
    );

  // Render chat messages
  const renderChatMessages = () =>
    !chatIsEmpty && (
      <div
        ref={scrollableContainer}
        className={layout === 'card' ? 'h-full overflow-auto p-4' : ''}>
        {chatMessages.map((message, idx) => (
          <div key={idx + 1}>
            {idx === 0 && (
              <div
                className={`w-full border-b border-gray-300 ${layout === 'card' ? 'mb-4' : ''}`}></div>
            )}
            <ChatMessage
              idx={idx}
              chatContent={message}
              loading={chatLoading && idx === chatMessages.length - 1}
            />
            <div
              className={`w-full border-b border-gray-300 ${layout === 'card' ? 'mt-4' : ''}`}></div>
          </div>
        ))}
      </div>
    );

  if (layout === 'card') {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
        <div
          onDragOver={fileUpload ? handleDragOver : undefined}
          className="relative">
          {/* Agent Header */}
          {showHeader && (
            <div className="border-b border-gray-200 p-4">
              {renderUnifiedHeader()}
            </div>
          )}

          {renderFileDropOverlay()}

          {/* Chat Area */}
          <div className="relative h-[600px]">
            {chatIsEmpty ? renderEmptyState() : renderChatMessages()}

            {/* Scroll Controls */}
            {!hideScrollButtons && (
              <div className="absolute right-4 top-4 z-10">
                <ScrollTopBottom />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-4">
            <InputChatContent
              content={chatContent}
              disabled={chatLoading}
              onChangeContent={setChatContent}
              resetDisabled={chatIsEmpty}
              isEmpty={chatIsEmpty}
              onSend={handleSendMessage}
              onReset={handleResetChat}
              fileUpload={fileUpload}
              fileLimit={fileLimit}
              accept={accept}
              fullWidth={true}
            />
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen layout - matches AgentCorePage layout
  return (
    <div
      onDragOver={fileUpload ? handleDragOver : undefined}
      className={`${!chatIsEmpty ? 'screen:pb-48' : ''} relative ${className}`}>
      {/* Unified Header */}
      {showHeader && (
        <div className="my-5 print:my-5">{renderUnifiedHeader()}</div>
      )}

      {renderFileDropOverlay()}

      {/* Empty State or Chat Messages */}
      {chatIsEmpty ? renderEmptyState() : renderChatMessages()}

      {/* Scroll Controls */}
      {!hideScrollButtons && (
        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>
      )}

      {/* Input Area */}
      <div className="fixed bottom-0 z-0 flex w-full flex-col items-center justify-center lg:pr-64 print:hidden">
        <InputChatContent
          content={chatContent}
          disabled={chatLoading}
          onChangeContent={setChatContent}
          resetDisabled={chatIsEmpty}
          isEmpty={chatIsEmpty}
          onSend={handleSendMessage}
          onReset={handleResetChat}
          fileUpload={fileUpload}
          fileLimit={fileLimit}
          accept={accept}
        />
      </div>
    </div>
  );
};

export default AgentChatUnified;
