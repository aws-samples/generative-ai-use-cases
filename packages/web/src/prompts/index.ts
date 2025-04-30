import { UnrecordedMessage } from 'generative-ai-use-cases';
import { RetrieveResultItem } from '@aws-sdk/client-kendra';
import { claudePrompter } from './claude';
import { TFunction } from 'i18next';

// Currently, prompter is only for Claude
export const getPrompter = (modelId: string) => {
  if (modelId.includes('claude')) {
    return claudePrompter;
  } else {
    // Default returns Claude's prompter
    // modelId is initially empty, so even if the initial model is not Claude,
    // claudePrompter is temporarily selected, but
    // When modelId is updated, the appropriate model will be selected, so we allow that state
    return claudePrompter;
  }
};

export type ChatParams = {
  content: string;
};

export type SummarizeParams = {
  sentence: string;
  context?: string;
};

export type WriterParams = {
  sentence: string;
  context?: string;
};

export type GenerateTextParams = {
  information: string;
  context: string;
};

export type TranslateParams = {
  sentence: string;
  language: string;
  context?: string;
};

export type WebContentParams = {
  text: string;
  context?: string;
};

export type RagParams = {
  promptType: 'RETRIEVE' | 'SYSTEM_CONTEXT';
  retrieveQueries?: string[];
  referenceItems?: RetrieveResultItem[];
};

export type VideoAnalyzerParams = {
  content: string;
};

export type SetTitleParams = {
  messages: UnrecordedMessage[];
};

export type DiagramParams = {
  determineType: boolean;
  diagramType?: string;
};

export type PromptListItem = {
  title: string;
  systemContext: string;
  prompt?: string;
  className?: string;
};

export type PromptList = {
  title: string;
  items: PromptListItem[];
  experimental?: boolean;
}[];

export interface Prompter {
  systemContext(pathname: string): string;
  chatPrompt(params: ChatParams): string;
  summarizePrompt(params: SummarizeParams): string;
  writerPrompt(params: WriterParams): string;
  generateTextPrompt(params: GenerateTextParams): string;
  translatePrompt(params: TranslateParams): string;
  webContentPrompt(params: WebContentParams): string;
  ragPrompt(params: RagParams): string;
  videoAnalyzerPrompt(params: VideoAnalyzerParams): string;
  setTitlePrompt(params: SetTitleParams): string;
  promptList(t: TFunction): PromptList;
  diagramPrompt(params: DiagramParams): string;
}
