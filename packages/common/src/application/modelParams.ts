import { ConverseInferenceParams } from 'generative-ai-use-cases';

// Default Converse inference parameters, referenced by modelMetadata in
// model.ts. maxTokens is the output limit sent with each request, so it must
// not exceed what the model accepts (check with npm run models:verify).

export const DEFAULT_64K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 65536,
    temperature: 1,
    topP: 1,
  },
};

export const DEFAULT_128K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 131072,
    temperature: 1,
    topP: 1,
  },
};

// Kimi K3 rejects requests whose maxTokens is above 128000
// (128000 is accepted, 128001 returns
// "The maximum tokens you requested exceeds the model limit of 128000").
// Keep the output token limit safely below that ceiling.
// temperature / topP are omitted because the model rejects them
// (see TEXT_IMAGE_NO_SAMPLING in model.ts).
export const KIMI_K3_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 120000,
  },
};

// temperature / topP are omitted because the model rejects them
// (see TEXT_IMAGE_NO_SAMPLING in model.ts).
export const KIMI_K3_1_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
  },
};

export const CLAUDE_SONNET_4_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 64000,
    temperature: 1,
  },
};

export const CLAUDE_OPUS_4_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 32000,
    temperature: 1,
    topP: 0.999,
  },
};

export const CLAUDE_OPUS_4_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 64000,
    temperature: 1,
  },
};

export const CLAUDE_OPUS_4_6_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
    temperature: 1,
  },
};

export const CLAUDE_OPUS_5_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
  },
};

export const CLAUDE_OPUS_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
  },
};

export const CLAUDE_HAIKU_5_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
  },
};

export const CLAUDE_OPUS_4_8_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
  },
};

export const CLAUDE_OPUS_4_7_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
  },
};

export const CLAUDE_SONNET_4_6_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 64000,
    temperature: 1,
  },
};

export const CLAUDE_SONNET_5_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
  },
};

export const CLAUDE_SONNET_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
  },
};

export const CLAUDE_FABLE_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
  },
};

export const CLAUDE_3_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 8192,
    temperature: 0.6,
    topP: 0.8,
  },
};

export const CLAUDE_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 4096,
    temperature: 0.6,
    topP: 0.8,
  },
};

export const TITAN_TEXT_DEFAULT_PARAMS: ConverseInferenceParams = {
  // Converse API only accepts 3000, instead of 3072, which is described in the doc.
  // If 3072 is accepted, revert to 3072.
  // https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-text.html
  inferenceConfig: {
    maxTokens: 3000,
    temperature: 0.7,
    topP: 1.0,
  },
};

export const LLAMA_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 2048,
    temperature: 0.5,
    topP: 0.9,
    stopSequences: ['<|eot_id|>'],
  },
};

export const MISTRAL_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 8192,
    temperature: 0.6,
    topP: 0.99,
  },
};

export const MIXTRAL_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 4096,
    temperature: 0.6,
    topP: 0.99,
  },
};

export const COMMANDR_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 4000,
    temperature: 0.3,
    topP: 0.75,
  },
};

export const NOVA_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 5120,
    temperature: 0.7,
    topP: 0.9,
  },
  // There are no additional costs for cache writes with Amazon Nova models
  promptCachingConfig: {
    autoCacheFields: {
      system: true,
      messages: true,
    },
  },
};

export const NOVA_2_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 65535,
    temperature: 1,
  },
  // There are no additional costs for cache writes with Amazon Nova models
  promptCachingConfig: {
    autoCacheFields: {
      system: true,
      messages: true,
    },
  },
};

export const DEEPSEEK_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 32768,
    temperature: 0.6,
    topP: 0.95,
  },
};

// Qwen3 model parameters based on actual AWS Bedrock limits
export const QWEN_16K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 16384,
    temperature: 0.7,
    topP: 0.9,
  },
};

export const QWEN_64K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 65536,
    temperature: 0.7,
    topP: 0.9,
  },
};

export const QWEN_192K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 196608,
    temperature: 0.7,
    topP: 0.9,
  },
};

export const PALMYRA_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 8192,
    temperature: 1,
    topP: 0.9,
  },
};

export const OPENAI_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 8192,
    temperature: 1,
    topP: 1.0,
  },
};

// Palmyra Vision 7B has a 4096 token context window shared by the prompt and
// the output, so maxTokens must leave room for the input.
export const PALMYRA_VISION_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 2048,
    temperature: 1,
    topP: 1,
  },
};
