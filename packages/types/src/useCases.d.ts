export type HiddenUseCases = {
  generate?: boolean;
  summarize?: boolean;
  writer?: boolean;
  translate?: boolean;
  webContent?: boolean;
  image?: boolean;
  video?: boolean;
  videoAnalyzer?: boolean;
  diagram?: boolean;
  meetingMinutes?: boolean;
  voiceChat?: boolean;
  transcribe?: boolean;
  textToSpeech?: boolean;
};

export type HiddenUseCasesKeys = keyof HiddenUseCases;
