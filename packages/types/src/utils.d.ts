import {
  GenerateImageParams,
  GenerateVideoParams,
  Model,
  UnrecordedMessage,
} from 'generative-ai-use-cases';

/**
 * Key-value tags recorded with a Bedrock call in the model invocation logs
 * (`requestMetadata`). Implementations that cannot send them ignore them.
 */
export type RequestMetadata = Record<string, string>;

export type InvokeInterface = (
  model: Model,
  messages: UnrecordedMessage[],
  id: string,
  requestMetadata?: RequestMetadata
) => Promise<string>;

export type InvokeStreamInterface = (
  model: Model,
  messages: UnrecordedMessage[],
  id: string,
  idToken?: string,
  requestMetadata?: RequestMetadata
) => AsyncIterable<string>;

// Return Base64 encoded image
export type GenerateImageInterface = (
  model: Model,
  params: GenerateImageParams,
  requestMetadata?: RequestMetadata
) => Promise<string>;

export type GenerateVideoInterface = (
  model: Model,
  params: GenerateVideoParams
) => Promise<string>;

export type ApiInterface = {
  invoke: InvokeInterface;
  invokeStream: InvokeStreamInterface;
  generateImage: GenerateImageInterface;
  generateVideo: GenerateVideoInterface;
};
