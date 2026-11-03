import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SummarizePage from '../../../src/pages/SummarizePage';

// The selected model lives in useChat. Keep it in a small store that
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
      messages: [],
      postChat: vi.fn(),
      clear: vi.fn(),
      updateSystemContextByModel: vi.fn(),
    };
  };
  return { default: useChatMock };
});

vi.mock('../../../src/hooks/useTyping', () => ({
  default: () => ({ setTypingTextInput: vi.fn(), typingTextOutput: '' }),
}));

vi.mock('../../../src/hooks/useModel', () => ({
  MODELS: {
    modelIds: ['model-a', 'model-b'],
    modelDisplayName: (id: string) => id,
  },
}));

vi.mock('../../../src/prompts', () => ({
  getPrompter: () => ({ summarizePrompt: () => '' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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

vi.mock('../../../src/components/Textarea', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => <textarea value={value} onChange={(e) => onChange(e.target.value)} />,
}));

vi.mock('../../../src/components/Markdown', () => ({ default: () => null }));
vi.mock('../../../src/components/ButtonCopy', () => ({ default: () => null }));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/summarize" element={<SummarizePage />} />
      </Routes>
    </MemoryRouter>
  );

describe('SummarizePage - opened from a URL', () => {
  beforeEach(() => {
    modelStore.modelId = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('starts with the text and the model given in the URL', () => {
    renderAt('/summarize?sentence=from-url&modelId=model-a');
    expect(screen.getAllByRole('textbox')[0]).toHaveProperty(
      'value',
      'from-url'
    );
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'model-a');
  });

  // The home page demo and "send to another use case" open the page with the
  // text in the query string. Changing the model afterwards must not put the
  // text, or the model, back to what the URL said.
  it('keeps the text the user edited and the model they picked', () => {
    renderAt('/summarize?sentence=from-url&modelId=model-a');
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'edited by the user' },
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'model-b' },
    });
    expect(screen.getAllByRole('textbox')[0]).toHaveProperty(
      'value',
      'edited by the user'
    );
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'model-b');
  });
});
