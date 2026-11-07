import { Model } from './message';

// ctob: client (web) to bedrock (api)
// btoc: bedrock (api) to client (web)
export type SpeechToSpeechEventDirection = 'ctob' | 'btoc';

export type SpeechToSpeechEventType =
  | 'ready'
  | 'end'
  | 'promptStart'
  | 'systemPrompt'
  | 'audioStart'
  | 'audioInput'
  | 'audioStop'
  | 'audioOutput'
  | 'textStart'
  | 'textOutput'
  | 'textStop';

export type SpeechToSpeechEvent = {
  direction: SpeechToSpeechEventDirection;
  event: SpeechToSpeechEventType;
  data: any;
};

// Metadata describing a selectable speech-to-speech voice
export type SpeechToSpeechVoice = {
  voiceId: string;
  // BCP-47 locales the voice is listed for, e.g. ['en-IN', 'hi-IN']
  locales: string[];
  gender: 'feminine' | 'masculine';
  // The voice speaks every language the model supports
  polyglot?: boolean;
};

// Request payload sent from the web client to start a speech-to-speech session
export type SpeechToSpeechSessionRequest = {
  channel: string;
  model: Model;
  voiceId?: string;
};
