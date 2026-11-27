import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// i18n: return the key itself so assertions do not depend on translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Model list used for the model select box
vi.mock('../../../src/hooks/useModel', () => ({
  MODELS: {
    modelIds: ['test.model-1'],
    modelDisplayName: (modelId: string) => modelId,
  },
}));

// MCP server manager is covered by its own component
vi.mock('../../../src/components/agentBuilder/MCPServerManager', () => ({
  default: () => <div data-testid="mcp-server-manager" />,
}));

vi.mock('../../../src/hooks/useMCPServers', () => ({
  default: () => [],
}));

// Built-in tools the AI suggests, set per test
const promptGeneration = vi.hoisted(() => ({
  suggestedBuiltInTools: [] as string[],
}));

vi.mock('../../../src/hooks/usePromptGeneration', () => ({
  default: () => ({
    generatedPrompt: '',
    suggestedMCPServers: [],
    suggestedBuiltInTools: promptGeneration.suggestedBuiltInTools,
    isGenerating: false,
    error: undefined,
    generate: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}));

import AgentForm, {
  AgentFormData,
} from '../../../src/components/agentBuilder/AgentForm';

const renderForm = (props: Partial<Parameters<typeof AgentForm>[0]> = {}) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const onFormDataChange = vi.fn();
  render(
    <AgentForm
      onSave={onSave}
      onCancel={onCancel}
      onFormDataChange={onFormDataChange}
      {...props}
    />
  );
  return { onSave, onCancel, onFormDataChange };
};

const documentSearchCheckbox = () =>
  document.querySelector('#documentSearchEnabled') as HTMLInputElement;
const webSearchCheckbox = () =>
  document.querySelector('#webSearchEnabled') as HTMLInputElement;
const lastFormData = (onFormDataChange: ReturnType<typeof vi.fn>) =>
  onFormDataChange.mock.calls.at(-1)?.[0] as AgentFormData;

describe('AgentForm document search tool (#1870)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    promptGeneration.suggestedBuiltInTools = [];
    // The Textarea re-measures its height with a ResizeObserver, which jsdom lacks
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(function () {
        return { observe: vi.fn(), disconnect: vi.fn() };
      })
    );
    // Document search needs the Knowledge Base of the RAG chat
    vi.stubEnv('VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED', 'true');
    vi.stubEnv('VITE_APP_AGENT_CORE_AGENT_BUILDER_WEB_SEARCH_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is offered, unchecked, with its label and description', () => {
    renderForm();
    expect(documentSearchCheckbox().checked).toBe(false);
    expect(
      screen.getByText('agent_builder.enable_document_search')
    ).toBeDefined();
    expect(
      screen.getByText('agent_builder.document_search_description')
    ).toBeDefined();
  });

  it('reflects initialData and reports a change', () => {
    const { onFormDataChange } = renderForm({
      initialData: { documentSearchEnabled: true },
    });
    expect(documentSearchCheckbox().checked).toBe(true);
    fireEvent.click(documentSearchCheckbox());
    expect(lastFormData(onFormDataChange).documentSearchEnabled).toBe(false);
  });

  it('is independent from web search', () => {
    const { onFormDataChange } = renderForm();
    fireEvent.click(webSearchCheckbox());
    expect(lastFormData(onFormDataChange).webSearchEnabled).toBe(true);
    expect(lastFormData(onFormDataChange).documentSearchEnabled).toBe(false);
  });

  it('is not offered without the Knowledge Base', () => {
    vi.stubEnv('VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED', 'false');
    promptGeneration.suggestedBuiltInTools = ['documentSearch'];
    const { onFormDataChange } = renderForm();
    expect(documentSearchCheckbox()).toBeNull();
    expect(lastFormData(onFormDataChange).documentSearchEnabled).toBe(false);
  });

  it('turns on when the AI suggests it', () => {
    promptGeneration.suggestedBuiltInTools = ['documentSearch'];
    renderForm();
    expect(documentSearchCheckbox().checked).toBe(true);
  });
});
