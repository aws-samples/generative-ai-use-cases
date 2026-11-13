export type PollyEngine = 'generative' | 'long-form' | 'neural' | 'standard';

export type PollyOutputFormat = 'mp3' | 'ogg_vorbis';

export type PollyVoice = {
  id: string;
  name: string;
  gender: string;
  languageCode: string;
  supportedEngines: PollyEngine[];
};

export type PollyLanguage = {
  code: string;
  name: string;
};

export type ListPollyVoicesResponse = {
  languages: PollyLanguage[];
  voices: PollyVoice[];
};

export type PollyTextType = 'text' | 'ssml';

export type SynthesizeSpeechRequest = {
  text: string;
  // 'ssml': text is SSML written by the user (default: 'text')
  textType?: PollyTextType;
  voiceId: string;
  engine: PollyEngine;
  languageCode: string;
  outputFormat: PollyOutputFormat;
  speed: number;
  // Client local time (yyyyMMdd-HHmmss) used in the file name. Optional.
  timestamp?: string;
};

export type SynthesizeSpeechResponse = {
  key: string;
  fileName: string;
  url: string;
  contentType: string;
  characters: number;
};
