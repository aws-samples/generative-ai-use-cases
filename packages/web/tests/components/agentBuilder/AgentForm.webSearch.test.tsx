import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../../../src/hooks/usePromptGeneration', () => ({
  default: () => ({
    generatedPrompt: '',
    suggestedMCPServers: [],
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

const webSearchCheckbox = () =>
  document.querySelector('#webSearchEnabled') as HTMLInputElement;

describe('AgentForm web search tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the web search checkbox with its label and description', () => {
    renderForm();

    const checkbox = webSearchCheckbox();
    expect(checkbox).not.toBeNull();
    expect(checkbox.type).toBe('checkbox');
    // getByText throws when the node is missing, so a defined result is enough
    expect(screen.getByText('agent_builder.enable_web_search')).toBeDefined();
    expect(
      screen.getByText('agent_builder.web_search_description')
    ).toBeDefined();
  });

  it('is unchecked by default', () => {
    renderForm();
    expect(webSearchCheckbox().checked).toBe(false);
  });

  it('reflects the value from initialData', () => {
    renderForm({ initialData: { webSearchEnabled: true } });
    expect(webSearchCheckbox().checked).toBe(true);
  });

  it('reports the change through onFormDataChange when toggled', () => {
    const { onFormDataChange } = renderForm();

    expect(webSearchCheckbox().checked).toBe(false);
    fireEvent.click(webSearchCheckbox());

    expect(webSearchCheckbox().checked).toBe(true);
    const lastCall = onFormDataChange.mock.calls.at(-1);
    expect((lastCall?.[0] as AgentFormData).webSearchEnabled).toBe(true);
  });

  it('keeps code execution independent from web search', () => {
    renderForm();

    const codeExecution = document.querySelector(
      '#codeExecutionEnabled'
    ) as HTMLInputElement;

    fireEvent.click(webSearchCheckbox());

    expect(webSearchCheckbox().checked).toBe(true);
    expect(codeExecution.checked).toBe(false);
  });
});
