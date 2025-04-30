// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InterUseCaseParams<T extends Record<string, unknown> = any> = {
  // Set the screen item to be set
  // Only items managed by useLocation can be specified
  [key in keyof T]: {
    // Set the value you want to set
    // If you want to embed the value of the screen item of the transition source, set {interUseCasesKey}
    // For example, if you want to embed the value of context, set {context}
    value: string;
  };
};
export type InterUseCase = {
  title: string;
  description: string;
  path: string;
  params?: InterUseCaseParams;
};

export type BaseQueryParams = {
  modelId?: string;
};

export type ChatPageQueryParams = BaseQueryParams & {
  content?: string;
  systemContext?: string;
};

export type WriterPageQueryParams = BaseQueryParams & {
  sentence?: string;
};

export type GenerateImagePageQueryParams = BaseQueryParams & {
  content?: string;
  imageModelId?: string;
};

export type GenerateVideoPageQueryParams = BaseQueryParams & {
  prompt?: string;
};

export type GenerateTextPageQueryParams = BaseQueryParams & {
  information?: string;
  context?: string;
};

export type RagPageQueryParams = BaseQueryParams & {
  content?: stiring;
};

export type AgentPageQueryParams = BaseQueryParams & {
  content?: stiring;
};

export type SummarizePageQueryParams = BaseQueryParams & {
  sentence?: string;
  additionalContext?: string;
};

export type TranslatePageQueryParams = BaseQueryParams & {
  sentence?: string;
  additionalContext?: string;
  language?: string;
};

export type WebContentPageQueryParams = BaseQueryParams & {
  url?: string;
  context?: string;
};

export type VideoAnalyzerPageQueryParams = BaseQueryParams & {
  content: string;
};

export type DiagramPageQueryParams = BaseQueryParams & {
  content: string;
};
