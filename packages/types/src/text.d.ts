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
  reasoningConfig?: {
    type: 'enabled' | 'disabled';
    budgetTokens?: number;
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

export type TitanParams = {
  inputText?: string;
  textGenerationConfig?: {
    temperature?: number;
    topP?: number;
    maxTokenCount?: number;
    stopSequences?: string[];
  };
};

// Claude v2 & Claude Instant v1
// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html
export type ClaudeParams = {
  prompt?: string;
  max_tokens_to_sample?: number;
  stop_sequences?: string[];
  temperature?: number;
  top_k?: number;
  top_p?: number;
};

// Claude Message
// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html
export type ClaudeMessageParams = {
  system?: string;
  anthropic_version?: string;
  messages?: {
    role: string;
    content: {
      type: string;
      text?: string;
      source?: {
        type: string;
        media_type: string;
        data: string;
      };
    }[];
  }[];
  max_tokens?: number;
  stop_sequences?: string[];
  temperature?: number;
  top_k?: number;
  top_p?: number;
};

// Llama
// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-meta.html
export type LlamaParams = {
  prompt?: string;
  max_gen_len?: number;
  temperature?: number;
  top_p?: number;
};

// Mistral
// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-mistral.html
export type MistralParams = {
  prompt?: string;
  max_tokens?: number;
  stop?: string[];
  temperature?: number;
  top_k?: number;
  top_p?: number;
};

// DeepSeel
// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-deepseek.html
export type DeepSeekParams = {
  prompt?: string;
  max_tokens?: number;
  stop?: string[];
  temperature?: number;
  top_p?: number;
};

// Cohere Command R / Command R+
// https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-cohere-command-r-plus.html
// stream, tools, tools_results is not supported in Bedrock yet, so commented out.
export type CommandRParams = {
  message?: string;
  chat_history?: {
    role: 'USER' | 'CHATBOT';
    message: string;
  }[];
  documents?: {
    title: string;
    snippet: string;
  }[];
  search_queries_only?: boolean;
  preamble?: string;
  // stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  p?: number;
  k?: number;
  prompt_truncation?: string;
  frequency_penalty?: number;
  presence_penalty?: number;
  seed?: number;
  return_prompt?: boolean;
  // tools?: {
  //   name: string;
  //   description: string;
  //   parameter_definitions: {
  //     [key: string]: {
  //       description: string;
  //       type: string;
  //       required: boolean;
  //     };
  //   };
  // }[];
  // tool_results?: {
  //   call: {
  //     name: string;
  //     parameters: {
  //       [key: string]: string;
  //     };
  //   };
  //   outputs: {
  //     text: string;
  //   }[];
  // }[];
  stop_sequences?: string[];
  raw_prompting?: boolean;
};

// Text Generation Inference
// https://github.com/huggingface/text-generation-inference
export type TGIParams = {
  inputs: string;
  parameters: {
    max_new_tokens: number;
    return_full_text: boolean;
    do_sample: boolean;
    temperature: number;
  };
};

export type BedrockResponse = {
  // Claude
  completion: string;
  type: string;
  // ClaudeMessage Non-stream
  content: {
    type: string;
    text: string;
  }[];
  // ClaudeMessage Stream
  delta: {
    text: string;
  };
  // Titan
  outputText: string;
  // Llama
  generation: string;
  // Mistral
  outputs: {
    text: string;
  }[];
  // CommandR
  text: string;
  // DeepSeek
  choices: {
    text: string;
  }[];
};
