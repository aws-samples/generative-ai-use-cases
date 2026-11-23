// ConverseAPI

import { InferenceConfiguration } from '@aws-sdk/client-bedrock-runtime';

export type PromptCacheField = 'messages' | 'system' | 'tools';
export type PromptCachingConfig = {
  autoCacheFields: {
    [key in PromptCacheField]?: boolean;
  };
};

// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html#API_runtime_Converse_RequestSyntax
export type ConverseInferenceParams = {
  inferenceConfig?: InferenceConfiguration;
  promptCachingConfig?: PromptCachingConfig;
};

export type UsecaseConverseInferenceParams = {
  [key: string]: ConverseInferenceParams;
};

export type AdditionalModelRequestFields = {
  reasoningConfig: {
    type: 'enabled' | 'disabled' | 'adaptive';
    budgetTokens: number;
    effort?: 'max' | 'xhigh' | 'high' | 'medium' | 'low';
  };
};

export type BaseGuardrailConfigParams = {
  guardrailIdentifier: string;
  guardrailVersion: string;
  trace?: 'disabled' | 'enabled';
};

export type GuardrailConverseConfigParams = BaseGuardrailConfigParams;

export type GuardrailConverseStreamConfigParams = BaseGuardrailConfigParams & {
  streamProcessingMode?: 'sync' | 'async';
};
