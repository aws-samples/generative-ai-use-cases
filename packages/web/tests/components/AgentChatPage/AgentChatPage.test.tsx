import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentChatPage from '../../../src/pages/AgentChatPage';

// The selected agent lives in useChat. Keep it in a small store that
// re-renders the page when it changes, as the real hook does.
const { modelStore } = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    modelStore: {
      modelId: '',
      listeners,
      set(id: string) {
        modelStore.modelId = id;
        listeners.forEach((l) => l());
      },
    },
  };
});

vi.mock('../../../src/hooks/useChat', async () => {
  const { useEffect, useReducer } = await import('react');
  const useChatMock = () => {
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
      modelStore.listeners.add(rerender);
      return () => {
        modelStore.listeners.delete(rerender);
      };
    }, []);
    return {
      getModelId: () => modelStore.modelId,
      setModelId: (id: string) => modelStore.set(id),
      loading: false,
      writing: false,
      loadingMessages: false,
      isEmpty: true,
      messages: [],
      clear: vi.fn(),
      postChat: vi.fn(),
      editChat: vi.fn(),
      updateSystemContextByModel: vi.fn(),
      retryGeneration: vi.fn(),
      forceToStop: vi.fn(),
    };
  };
  return { default: useChatMock };
});

vi.mock('../../../src/hooks/useModel', () => ({
  MODELS: { agentNames: ['CodeInterpreter', 'SearchEngine'] },
}));

vi.mock('../../../src/prompts', () => ({
  getPrompter: () => ({}),
}));

vi.mock('../../../src/hooks/useFiles', () => ({
  default: () => ({
    clear: vi.fn(),
    uploadedFiles: [],
    uploadFiles: vi.fn(),
    base64Cache: {},
  }),
}));

vi.mock('../../../src/hooks/useFollow', () => ({
  default: () => ({
    scrollableContainer: { current: null },
    setFollowing: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/assets/bedrock.svg?react', () => ({
  default: () => null,
}));

vi.mock('../../../src/components/Select', () => ({
  default: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../../../src/components/InputChatContent', () => ({
  default: () => null,
}));
vi.mock('../../../src/components/ChatMessage', () => ({
  default: () => null,
}));
vi.mock('../../../src/components/ScrollTopBottom', () => ({
  default: () => null,
}));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/agent" element={<AgentChatPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('AgentChatPage - choosing an agent', () => {
  beforeEach(() => {
    modelStore.modelId = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('starts on the agent given in the URL', () => {
    renderAt('/agent?modelId=CodeInterpreter&content=demo');
    expect(screen.getByRole('combobox')).toHaveProperty(
      'value',
      'CodeInterpreter'
    );
  });

  // The home page demo opens /agent?modelId=CodeInterpreter. Picking another
  // agent afterwards must stick rather than snap back to the URL's (#1502).
  it('keeps the agent the user picks after opening it from a URL', () => {
    renderAt('/agent?modelId=CodeInterpreter&content=demo');
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'SearchEngine' },
    });
    expect(screen.getByRole('combobox')).toHaveProperty(
      'value',
      'SearchEngine'
    );
  });

  it('lets the user pick an agent when opened without a URL query', () => {
    renderAt('/agent');
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'SearchEngine' },
    });
    expect(screen.getByRole('combobox')).toHaveProperty(
      'value',
      'SearchEngine'
    );
  });
});
