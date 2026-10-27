import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import AgentForm, {
  AgentFormData,
} from '../../components/agentBuilder/AgentForm';
import AgentTester from '../../components/agentBuilder/AgentTester';
import { useAgentBuilder } from '../../hooks/agentBuilder/useAgentBuilder';
import useAgentBuilderList from '../../hooks/agentBuilder/useAgentBuilderList';
import {
  PiRobot as RobotIcon,
  PiArrowLeft as BackIcon,
  PiPencilSimple,
  PiEye,
  PiUploadSimple as ImportIcon,
} from 'react-icons/pi';
import {
  fromPortableAgent,
  PortableAgent,
} from '../../utils/agentDefinitionFile';

const AgentBuilderEditPage: React.FC = () => {
  const { t } = useTranslation();
  const { agentId } = useParams<{ agentId?: string }>();
  const navigate = useNavigate();

  // Single agent state management (for loading existing agent)
  const { agent, loading, error } = useAgentBuilder(agentId);

  // List operations (for create/update with optimistic updates)
  const { createAgent, updateAgent } = useAgentBuilderList();

  const isEditMode = Boolean(agentId);
  const [currentFormData, setCurrentFormData] = useState<AgentFormData | null>(
    null
  );

  // View toggle state for responsive layout
  const [activeView, setActiveView] = useState<'editor' | 'preview'>('editor');

  // An imported definition stands in for the loaded one, so the form fills
  // itself from the file rather than the user retyping it. Kept in state so
  // it survives until they save or leave.
  const [imported, setImported] = useState<PortableAgent | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Cleared straight away, or choosing the same file twice would not fire
      // a change and the second import would go unnoticed.
      event.target.value = '';
      if (!file) return;
      try {
        setImported(fromPortableAgent(JSON.parse(await file.text())));
        setImportError(null);
      } catch {
        setImportError(t('agent_builder.import_failed'));
      }
    },
    [t]
  );

  const handleSave = useCallback(
    async (formData: AgentFormData) => {
      if (agentId && isEditMode) {
        await updateAgent(agentId, {
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          modelId: formData.modelId,
          mcpServers: formData.mcpServers as string[], // Explicit type assertion
          codeExecutionEnabled: formData.codeExecutionEnabled,
          isPublic: formData.isPublic,
          tags: formData.tags,
          agentId,
        });
        // Navigate back to agent chat page after editing
        navigate(`/agent-builder/${agentId}`);
      } else {
        console.log(
          'Creating agent with data:',
          JSON.stringify(formData, null, 2)
        );
        const newAgent = await createAgent({
          name: formData.name,
          description: formData.description,
          systemPrompt: formData.systemPrompt,
          modelId: formData.modelId,
          mcpServers: formData.mcpServers as string[], // Explicit type assertion
          codeExecutionEnabled: formData.codeExecutionEnabled,
          isPublic: formData.isPublic,
          tags: formData.tags,
        });
        if (newAgent) {
          console.log('Created agent:', JSON.stringify(newAgent, null, 2));
          // Navigate to agent list after creating new agent
          navigate(`/agent-builder/${newAgent.agentId}`);
        }
      }
    },
    [agentId, isEditMode, updateAgent, navigate, createAgent]
  ); // Remove function dependencies

  const handleCancel = useCallback(() => {
    if (agentId && isEditMode) {
      // Navigate back to agent chat page when canceling edit
      navigate(`/agent-builder/${agentId}`);
    } else {
      // Navigate to agent list when canceling create
      navigate('/agent-builder');
    }
  }, [navigate, agentId, isEditMode]);

  const handleFormDataChange = useCallback((formData: AgentFormData) => {
    setCurrentFormData(formData);
  }, []);

  const title = isEditMode
    ? t('agent_builder.edit_agent')
    : t('agent_builder.create_agent');

  // Loading state
  if (loading && isEditMode) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="border-aws-sky h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-600">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <RobotIcon className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mb-4 text-xl font-semibold text-gray-900">{error}</h1>
          <Button onClick={handleCancel} outlined>
            <BackIcon className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button outlined onClick={handleCancel}>
            <BackIcon className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('common.back')}</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
          <Button outlined onClick={() => fileInput.current?.click()}>
            <ImportIcon className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">
              {t('agent_builder.import')}
            </span>
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {/* View Toggle for small screens - aligned with title on right */}
        <div className="lg:hidden">
          <div className="flex rounded border text-xs font-bold">
            <div
              className={`my-1 ml-1 flex cursor-pointer items-center rounded px-2 py-1 ${
                activeView === 'editor'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-600'
              }`}
              onClick={() => setActiveView('editor')}>
              <PiPencilSimple className="text-base sm:mr-1" />
              <span className="hidden sm:inline">
                {t('agent_builder.editor')}
              </span>
            </div>
            <div
              className={`my-1 mr-1 flex cursor-pointer items-center rounded px-2 py-1 ${
                activeView === 'preview'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-600'
              }`}
              onClick={() => setActiveView('preview')}>
              <PiEye className="text-base sm:mr-1" />
              <span className="hidden sm:inline">
                {t('agent_builder.preview')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {importError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      {/* Content - Large screens: side-by-side, Small screens: toggle view */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Agent Configuration - Always visible on large screens, toggle on small */}
        <div
          className={`space-y-6 ${activeView !== 'editor' ? 'hidden lg:block' : ''}`}>
          <AgentForm
            initialData={imported || agent || undefined}
            onSave={handleSave}
            onCancel={handleCancel}
            onFormDataChange={handleFormDataChange}
            loading={loading}
            error={error || undefined}
            isEditMode={isEditMode}
          />
        </div>

        {/* Agent Testing - Always visible on large screens, toggle on small */}
        {(currentFormData || agent) && (
          <div
            className={`space-y-6 ${activeView !== 'preview' ? 'hidden lg:block' : ''}`}>
            <AgentTester
              agent={{
                // Use current form data if available, otherwise use existing agent data
                ...(currentFormData
                  ? {
                      agentId: agentId || 'temp-id',
                      name: currentFormData.name,
                      description: currentFormData.description,
                      systemPrompt: currentFormData.systemPrompt,
                      modelId: currentFormData.modelId,
                      mcpServers: currentFormData.mcpServers as string[],
                      codeExecutionEnabled:
                        currentFormData.codeExecutionEnabled,
                      isPublic: currentFormData.isPublic,
                      tags: currentFormData.tags,
                      isMyAgent: true,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      createdBy: 'current-user',
                      starCount: 0,
                    }
                  : {
                      ...agent!,
                      agentId: agentId || 'temp-id',
                      isPublic: false,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      createdBy: 'current-user',
                    }),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentBuilderEditPage;
