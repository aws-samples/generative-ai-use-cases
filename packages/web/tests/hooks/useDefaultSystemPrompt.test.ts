import { afterEach, describe, expect, it } from 'vitest';
import {
  initialSystemContext,
  useDefaultSystemPrompt,
} from '../../src/hooks/useDefaultSystemPrompt';
import { Prompter } from '../../src/prompts';

const prompter = {
  systemContext: (id: string) => `page prompt for ${id}`,
} as Prompter;

describe('initialSystemContext', () => {
  afterEach(() => {
    useDefaultSystemPrompt.getState().setUserDefault(null);
  });

  it("uses the page's prompt without a user default", () => {
    expect(initialSystemContext('/chat', prompter)).toBe(
      'page prompt for /chat'
    );
  });

  it("starts a new chat with the user's default", () => {
    useDefaultSystemPrompt.getState().setUserDefault('my prompt');
    expect(initialSystemContext('/chat', prompter)).toBe('my prompt');
  });

  it('leaves saved chats and other pages alone', () => {
    useDefaultSystemPrompt.getState().setUserDefault('my prompt');
    expect(initialSystemContext('/chat/abc', prompter)).toBe(
      'page prompt for /chat/abc'
    );
    expect(initialSystemContext('/rag', prompter)).toBe('page prompt for /rag');
  });
});
