import { PrimaryKey } from './base';
import { AdditionalModelRequestFields } from './text';

export type Role = 'system' | 'user' | 'assistant';

export type Model = {
  type: 'bedrock' | 'bedrockAgent' | 'bedrockKb' | 'sagemaker';
  modelId: string;
  modelParameters?: AdditionalModelRequestFields;
  sessionId?: string;
  region?: string;
};

export type Agent = {
  displayName: string;
  agentId: string;
  aliasId: string;
};

export type AgentMap = Record<string, { agentId: string; aliasId: string }>;

export type Flow = {
  flowId: string;
  aliasId: string;
  flowName: string;
  description: string;
};

export type MessageAttributes = {
  messageId: string;
  usecase: string;
  userId: string;
  feedback: string;
};

export type UnrecordedMessage = {
  role: Role;
  // Text
  content: string;
  // Additional data (image, etc.)
  trace?: string;
  extraData?: ExtraData[];
  llmType?: string;
};

export type ExtraData = {
  type: 'image' | 'video' | 'file' | 'json';
  name: string;
  source: {
    type: 's3' | 'base64' | 'json';
    mediaType: string; // mime type (i.e. image/png, text/plain, application/pdf, application/json)
    data: string; // s3 location for s3, data for base64, json for json
  };
};

export type UploadedFileType = {
  id: string;
  file: File;
  name: string;
  type: 'image' | 'video' | 'file';
  base64EncodedData?: string;
  s3Url?: string;
  uploading: boolean;
  deleting?: boolean;
  errorMessages: string[];
};

export type FileLimit = {
  accept: {
    doc: string[];
    image: string[];
    video: string[];
  };
  maxFileCount: number;
  maxFileSizeMB: number;
  maxImageFileCount: number;
  maxImageFileSizeMB: number;
  maxVideoFileCount: number;
  maxVideoFileSizeMB: number;
  strictImageDimensions?: { width: number; height: number }[];
};

export type RecordedMessage = PrimaryKey &
  MessageAttributes &
  UnrecordedMessage;

export type ToBeRecordedMessage = UnrecordedMessage & {
  createdDate?: string;
  messageId: string;
  usecase: string;
};

export type ShownMessage = Partial<PrimaryKey> &
  Partial<MessageAttributes> &
  UnrecordedMessage;

export type DocumentComment = {
  excerpt: string;
  replace?: string;
  comment?: string;
};
