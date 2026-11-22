import { create } from 'zustand';
import { Prompter } from '../prompts';

/**
 * The system prompt the user chose for new chats (one of their saved system
 * prompts), or null to use the built-in one. ChatPage keeps it up to date from
 * the user settings; useChat reads it when it starts a new chat.
 */
export const useDefaultSystemPrompt = create<{
  userDefault: string | null;
  setUserDefault: (prompt: string | null) => void;
}>((set) => ({
  userDefault: null,
  setUserDefault: (prompt) => set({ userDefault: prompt }),
}));

/**
 * The system prompt a chat starts with: the user's default for a new chat,
 * otherwise the page's own prompt.
 */
export const initialSystemContext = (id: string, prompter: Prompter): string =>
  (id === '/chat' && useDefaultSystemPrompt.getState().userDefault) ||
  prompter.systemContext(id);
