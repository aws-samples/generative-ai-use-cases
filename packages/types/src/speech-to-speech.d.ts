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
  // Human readable language name, e.g. 'English (US)'
  language: string;
  // BCP-47 locale, e.g. 'en-US'
  locale: string;
  gender: 'feminine' | 'masculine';
};

// Request payload sent from the web client to start a speech-to-speech session
export type SpeechToSpeechSessionRequest = {
  channel: string;
  model: Model;
  voiceId?: string;
};
