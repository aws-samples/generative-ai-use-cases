import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The selected model lives in useChat, outside the page, as in the real
// hook. postChat records the model parameters each message is sent with.
// Everything the hooks return is the same object on every render, as in the
// real hooks: the page has effects that depend on them.
const { chatStore, hooks } = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const fn = vi.fn();
  const chatStore = {
    modelId: 'opus',
    listeners,
    postChat: vi.fn(async () => true),
    setModelId(id: string) {
      chatStore.modelId = id;
      listeners.forEach((l) => l());
    },
  };
  return {
    chatStore,
    hooks: {
      chat: {
        getModelId: () => chatStore.modelId,
        setModelId: (id: string) => chatStore.setModelId(id),
        loading: false,
        writing: false,
        loadingMessages: false,
        isEmpty: true,
        messages: [],
        rawMessages: [],
        clear: fn,
        postChat: chatStore.postChat,
        editChat: fn,
        updateSystemContext: fn,
        updateSystemContextByModel: fn,
        getCurrentSystemContext: () => '',
        retryGeneration: fn,
        forceToStop: fn,
      },
      chatApi: {
        createShareId: fn,
        findShareId: () => ({ data: undefined, mutate: fn }),
        deleteShareId: fn,
      },
      systemContextApi: (() => {
        const list = { data: [], mutate: fn };
        return {
          listSystemContexts: () => list,
          deleteSystemContext: fn,
          updateSystemContextTitle: fn,
          createSystemContext: fn,
        };
      })(),
      chatList: { getChatTitle: () => '' },
      files: { clear: fn, uploadedFiles: [], uploadFiles: fn, base64Cache: {} },
      follow: { scrollableContainer: { current: null }, setFollowing: fn },
      prompter: {
        chatPrompt: ({ content }: { content: string }) => content,
      },
    },
  };
});

vi.mock('../../../src/hooks/useChat', async () => {
  const { useEffect, useReducer } = await import('react');
  const useChatMock = () => {
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
      chatStore.listeners.add(rerender);
      return () => {
        chatStore.listeners.delete(rerender);
      };
    }, []);
    return hooks.chat;
  };
  return { default: useChatMock };
});
vi.mock('../../../src/hooks/useChatApi', () => ({
  default: () => hooks.chatApi,
}));
vi.mock('../../../src/hooks/useSystemContextApi', () => ({
  default: () => hooks.systemContextApi,
}));
vi.mock('../../../src/hooks/useChatList', () => ({
  default: () => hooks.chatList,
}));
vi.mock('../../../src/hooks/useFiles', () => ({
  default: () => hooks.files,
}));
vi.mock('../../../src/hooks/useFollow', () => ({
  default: () => hooks.follow,
}));
// Blocking navigation needs a data router; these tests use MemoryRouter.
vi.mock('../../../src/hooks/usePreventNavigation', () => ({
  default: () => undefined,
}));
vi.mock('../../../src/prompts', () => ({
  getPrompter: () => hooks.prompter,
}));

// opus has xhigh effort; sonnet does not; sonnet5 always reasons.
vi.mock('../../../src/hooks/useModel', () => ({
  MODELS: {
    allModelIds: ['opus', 'sonnet', 'sonnet5'],
    modelDisplayName: (id: string) => id,
    getModelMetadata: (id: string) => ({
      flags: {
        reasoning: true,
        adaptiveThinking: true,
        adaptiveThinkingAlwaysOn: id === 'sonnet5',
        xhighEffort: id === 'opus',
      },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/components/InputChatContent', () => ({
  default: ({
    onSend,
    onReasoningSwitched,
    onSetting,
    settingLabel,
    modelId,
    onModelChange,
    modelOptions,
  }: {
    onSend: () => void;
    onReasoningSwitched: () => void;
    onSetting: () => void;
    settingLabel?: string;
    modelId?: string;
    onModelChange?: (modelId: string) => void;
    modelOptions?: { value: string; label: string }[];
  }) => (
    <div>
      <button data-testid="send" onClick={onSend} />
      <button data-testid="reasoning" onClick={onReasoningSwitched} />
      <button data-testid="settings" onClick={onSetting} />
      <span data-testid="setting-label">{settingLabel ?? ''}</span>
      <select
        data-testid="model"
        value={modelId}
        onChange={(e) => onModelChange?.(e.target.value)}>
        {(modelOptions ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock('../../../src/components/ModelParameters', () => ({
  default: ({
    overrideModelParameters,
    setOverrideModelParameters,
  }: {
    overrideModelParameters: { reasoningConfig: { effort?: string } };
    setOverrideModelParameters: (p: unknown) => void;
  }) => (
    <select
      data-testid="effort"
      value={overrideModelParameters.reasoningConfig.effort ?? 'high'}
      onChange={(e) =>
        setOverrideModelParameters({
          ...overrideModelParameters,
          reasoningConfig: {
            ...overrideModelParameters.reasoningConfig,
            effort: e.target.value,
          },
        })
      }>
      {['xhigh', 'high', 'medium', 'low'].map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../../../src/components/ModalDialog', () => ({
  default: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div>{children}</div> : null),
}));

vi.mock('../../../src/components/ChatMessage', () => ({ default: () => null }));
vi.mock('../../../src/components/PromptList', () => ({ default: () => null }));
vi.mock('../../../src/components/ScrollTopBottom', () => ({
  default: () => null,
}));
vi.mock('../../../src/components/ModalSystemContext', () => ({
  default: () => null,
}));

let ChatPage: React.FC;

// A fresh copy of the page's module, as after a reload: anything kept only
// in memory is gone, and only what is in local storage is left.
const reload = async () => {
  cleanup();
  vi.resetModules();
  ChatPage = (await import('../../../src/pages/ChatPage')).default;
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:chatId" element={<ChatPage />} />
      </Routes>
    </MemoryRouter>
  );

const sentReasoning = () => {
  const args = chatStore.postChat.mock.calls.at(-1) as unknown[];
  return (args[10] as { reasoningConfig: { type: string; effort?: string } })
    .reasoningConfig;
};

const send = async () => {
  fireEvent.click(screen.getByTestId('send'));
  await Promise.resolve();
};

const chooseModel = (id: string) =>
  fireEvent.change(screen.getByTestId('model'), { target: { value: id } });

const turnOnReasoningWithEffort = (effort: string) => {
  fireEvent.click(screen.getByTestId('reasoning'));
  fireEvent.click(screen.getByTestId('settings'));
  fireEvent.change(screen.getByTestId('effort'), {
    target: { value: effort },
  });
};

describe('ChatPage reasoning settings', () => {
  beforeEach(async () => {
    localStorage.clear();
    chatStore.modelId = 'opus';
    chatStore.postChat.mockClear();
    await reload();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps reasoning and effort when the page is mounted again', async () => {
    renderAt('/chat');
    turnOnReasoningWithEffort('low');
    cleanup();

    // Opening a chat from the history is a different route, so the page is
    // mounted again.
    renderAt('/chat/chat-1');
    await send();
    expect(sentReasoning()).toMatchObject({ type: 'adaptive', effort: 'low' });
  });

  it('keeps reasoning and effort over a reload', async () => {
    renderAt('/chat');
    turnOnReasoningWithEffort('medium');

    await reload();
    renderAt('/chat');
    await send();
    expect(sentReasoning()).toMatchObject({
      type: 'adaptive',
      effort: 'medium',
    });
  });

  it('sends high to a model without xhigh, and xhigh again once it is back', async () => {
    renderAt('/chat');
    turnOnReasoningWithEffort('xhigh');

    chooseModel('sonnet');
    await send();
    expect(sentReasoning().effort).toBe('high');

    chooseModel('opus');
    await send();
    expect(sentReasoning().effort).toBe('xhigh');
  });

  it('keeps high once the user picks it on a model without xhigh', async () => {
    renderAt('/chat');
    turnOnReasoningWithEffort('xhigh');

    chooseModel('sonnet');
    fireEvent.change(screen.getByTestId('effort'), {
      target: { value: 'high' },
    });
    chooseModel('opus');
    await send();
    expect(sentReasoning().effort).toBe('high');
  });

  it('reasons with an always-on model, and not once the user is back on another', async () => {
    renderAt('/chat');

    chooseModel('sonnet5');
    await send();
    expect(sentReasoning().type).toBe('adaptive');

    chooseModel('opus');
    await send();
    expect(sentReasoning().type).toBe('disabled');
  });

  it('shows the effort beside the settings button while reasoning is on', () => {
    renderAt('/chat');
    expect(screen.getByTestId('setting-label').textContent).toBe('');

    turnOnReasoningWithEffort('low');
    expect(screen.getByTestId('setting-label').textContent).toBe('Low');

    // A model without xhigh shows the effort it is actually sent.
    fireEvent.change(screen.getByTestId('effort'), {
      target: { value: 'xhigh' },
    });
    chooseModel('sonnet');
    expect(screen.getByTestId('setting-label').textContent).toBe('High');

    fireEvent.click(screen.getByTestId('reasoning'));
    expect(screen.getByTestId('setting-label').textContent).toBe('');
  });
});
