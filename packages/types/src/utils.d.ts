import {
  GenerateImageParams,
  GenerateVideoParams,
  Model,
  UnrecordedMessage,
} from 'generative-ai-use-cases';

export type InvokeInterface = (
  model: Model,
  messages: UnrecordedMessage[],
  id: string
) => Promise<string>;

export type InvokeStreamInterface = (
  model: Model,
  messages: UnrecordedMessage[],
  id: string,
  idToken?: string
) => AsyncIterable<string>;

// Return Base64 encoded image
export type GenerateImageInterface = (
  model: Model,
  params: GenerateImageParams
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
