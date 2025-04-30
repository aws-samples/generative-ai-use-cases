export type Role = 'system' | 'user' | 'assistant';

export type Model = {
  type: 'bedrock' | 'bedrockAgent' | 'sagemaker';
  modelId: string;
  sessionId?: string;
};
export type ExtraData = {
  type: string;
  source: {
    type: string;
    mediaType: string;
    data: string;
  };
};

export type SystemContext = {
  systemContextId: string;
  systemContext: string;
  systemContextTitle: string;
};

export type Message = {
  role: Role;
  // Text
  content: string;
  // Additional data (image, etc.)
  extraData?: ExtraData[];
  llmType?: string;
  // Prompt title
  title?: string;
};

export type PredictRequest = {
  model?: Model;
  messages: Message[];
};
