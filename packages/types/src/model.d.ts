import { ConverseInferenceParams } from './text';

// Define the type of Feature Flag
export type FeatureFlags = {
  // Model Feature Flags
  text?: boolean;
  doc?: boolean;
  image?: boolean;
  video?: boolean;
  reasoning?: boolean;
  adaptiveThinking?: boolean;
  // Adaptive thinking is always on and cannot be disabled (e.g. Claude Sonnet 5)
  adaptiveThinkingAlwaysOn?: boolean;
  // Supports the 'xhigh' effort level (e.g. Claude Opus 4.7+, Claude Sonnet 5)
  xhighEffort?: boolean;
  noSamplingParams?: boolean;
  // Rejects a system role, so the system prompt goes into the first user turn
  noSystemPrompt?: boolean;

  // Maximum number of images the model accepts in a single request.
  // Defaults to 20 (Converse API default) when not set.
  maxImageCount?: number;

  image_gen?: boolean;
  video_gen?: boolean;

  embedding?: boolean;
  reranking?: boolean;

  speechToSpeech?: boolean;

  // Additional Flags
  light?: boolean;
  legacy?: boolean;
};

export type ModelConfiguration = {
  modelId: string;
  region: string;
};

export type ModelMetadata = {
  flags: FeatureFlags;
  displayName: string;
  // Default Converse inference parameters (text models)
  defaultParams?: ConverseInferenceParams;
};
