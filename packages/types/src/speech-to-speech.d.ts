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
