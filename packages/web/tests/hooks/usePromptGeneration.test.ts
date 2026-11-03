import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePromptGeneration } from '../../src/hooks/usePromptGeneration';

const mocks = vi.hoisted(() => ({
  predictStream: vi.fn(),
}));

vi.mock('../../src/hooks/useChatApi', () => ({
  default: () => ({ predictStream: mocks.predictStream }),
}));

// Streams the given model output as one JSON line per chunk, the way the
// predict-stream API does
const streamOutput = (text: string) =>
  async function* () {
    yield JSON.stringify({ text }) + '\n';
  };

const builtInTools = [
  {
    id: 'codeExecution',
    name: 'Code execution',
    description: 'Run code',
  },
];

const renderGeneration = () =>
  renderHook(() =>
    usePromptGeneration({
      modelId: 'test-model',
      agentName: 'agent',
      agentDescription: 'description',
      availableMCPServers: [],
      availableBuiltInTools: builtInTools,
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePromptGeneration built-in tool suggestions', () => {
  it('returns the built-in tools the model selected', async () => {
    mocks.predictStream.mockImplementation(
      streamOutput(
        '<SELECTED_BUILT_IN_TOOLS>\ncodeExecution\n</SELECTED_BUILT_IN_TOOLS>\n<SYSTEM_PROMPT>\nprompt\n</SYSTEM_PROMPT>'
      )
    );

    const { result } = renderGeneration();
    await act(async () => {
      await result.current.generate();
    });

    expect(result.current.suggestedBuiltInTools).toEqual(['codeExecution']);
  });

  it('drops ids that were not offered to the model', async () => {
    mocks.predictStream.mockImplementation(
      streamOutput(
        '<SELECTED_BUILT_IN_TOOLS>\nwebBrowser\ncodeExecution\n</SELECTED_BUILT_IN_TOOLS>\n<SYSTEM_PROMPT>\nprompt\n</SYSTEM_PROMPT>'
      )
    );

    const { result } = renderGeneration();
    await act(async () => {
      await result.current.generate();
    });

    expect(result.current.suggestedBuiltInTools).toEqual(['codeExecution']);
  });

  it('suggests nothing when every selected id is unknown', async () => {
    mocks.predictStream.mockImplementation(
      streamOutput(
        '<SELECTED_BUILT_IN_TOOLS>\nwebBrowser\n</SELECTED_BUILT_IN_TOOLS>\n<SYSTEM_PROMPT>\nprompt\n</SYSTEM_PROMPT>'
      )
    );

    const { result } = renderGeneration();
    await act(async () => {
      await result.current.generate();
    });

    // An empty list leaves the user's tool settings untouched in AgentForm
    expect(result.current.suggestedBuiltInTools).toEqual([]);
  });
});
