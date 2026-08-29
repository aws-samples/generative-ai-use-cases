import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShownMessage } from 'generative-ai-use-cases';
import ChatMessage from '../../src/components/ChatMessage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/chat' }),
}));

vi.mock('../../src/hooks/useChat', () => ({
  default: () => ({
    sendFeedback: vi.fn(),
  }),
  __esModule: true,
}));

vi.mock('../../src/hooks/useFiles', () => ({
  default: () => ({
    getFileDownloadSignedUrl: vi.fn(),
  }),
  __esModule: true,
}));

vi.mock('../../src/hooks/useTyping', () => ({
  default: () => ({
    setTypingTextInput: vi.fn(),
    typingTextOutput: 'Hello',
  }),
  __esModule: true,
}));

const userMessage = (messageId?: string): ShownMessage =>
  ({
    id: 'chat#chat123',
    role: 'user',
    content: 'Hello',
    messageId,
  }) as ShownMessage;

// The edit button is the only button rendered for a user message
const editButtons = () => screen.queryAllByRole('button');

describe('ChatMessage edit button', () => {
  it('is shown for any recorded user message, not only the latest one', () => {
    render(
      <ChatMessage
        chatContent={userMessage('msg123')}
        editable={true}
        // A message in the middle of the conversation
        hasFollowingMessages={true}
        onCommitEdit={vi.fn()}
      />
    );

    expect(editButtons()).toHaveLength(1);
  });

  it('is hidden when the message is not recorded yet (no messageId)', () => {
    render(
      <ChatMessage
        chatContent={userMessage(undefined)}
        editable={true}
        onCommitEdit={vi.fn()}
      />
    );

    expect(editButtons()).toHaveLength(0);
  });

  it('is hidden when editable is false', () => {
    render(
      <ChatMessage
        chatContent={userMessage('msg123')}
        editable={false}
        onCommitEdit={vi.fn()}
      />
    );

    expect(editButtons()).toHaveLength(0);
  });
});
