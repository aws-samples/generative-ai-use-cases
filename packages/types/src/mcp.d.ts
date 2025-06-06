import { UnrecordedMessage, Model } from './message';

export type McpRequest = {
  systemPrompt: string;
  userPrompt: string;
  messages: UnrecordedMessage[];
  model: Model;
};
