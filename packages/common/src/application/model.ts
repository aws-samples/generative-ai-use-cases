import {
  FeatureFlags,
  PromptCacheField,
  ModelMetadata,
  SpeechToSpeechVoice,
} from 'generative-ai-use-cases';

// Manage Model Feature
// https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html
const MODEL_FEATURE: Record<string, FeatureFlags> = {
  // Model Feature Flags
  TEXT_ONLY: { text: true, doc: false, image: false, video: false },
  TEXT_REASONING: {
    text: true,
    doc: false,
    image: false,
    video: false,
    reasoning: true,
  },
  TEXT_DOC: { text: true, doc: true, image: false, video: false },
  TEXT_DOC_REASONING: {
    text: true,
    doc: true,
    image: false,
    video: false,
    reasoning: true,
  },
  TEXT_IMAGE: { text: true, doc: false, image: true, video: false },
  // Text + image models that reject sampling params (temperature / topP), e.g. Kimi K3, GPT-6
  TEXT_IMAGE_NO_SAMPLING: {
    text: true,
    doc: false,
    image: true,
    video: false,
    noSamplingParams: true,
  },
  TEXT_IMAGE_REASONING: {
    text: true,
    doc: false,
    image: true,
    video: false,
    reasoning: true,
  },
  TEXT_DOC_IMAGE: { text: true, doc: true, image: true, video: false },
  TEXT_DOC_IMAGE_REASONING: {
    text: true,
    doc: true,
    image: true,
    video: false,
    reasoning: true,
  },
  TEXT_DOC_IMAGE_ADAPTIVE_THINKING: {
    text: true,
    doc: true,
    image: true,
    video: false,
    reasoning: true,
    adaptiveThinking: true,
  },
  TEXT_DOC_IMAGE_ADAPTIVE_THINKING_NO_SAMPLING: {
    text: true,
    doc: true,
    image: true,
    video: false,
    reasoning: true,
    adaptiveThinking: true,
    xhighEffort: true,
    noSamplingParams: true,
  },
  TEXT_DOC_IMAGE_ADAPTIVE_THINKING_ALWAYS_ON_NO_SAMPLING: {
    text: true,
    doc: true,
    image: true,
    video: false,
    reasoning: true,
    adaptiveThinking: true,
    adaptiveThinkingAlwaysOn: true,
    xhighEffort: true,
    noSamplingParams: true,
  },
  TEXT_DOC_IMAGE_VIDEO: { text: true, doc: true, image: true, video: true },
  IMAGE_GEN: { image_gen: true },
  VIDEO_GEN: { video_gen: true },
  EMBEDDING: { embedding: true },
  RERANKING: { reranking: true },
  SPEECH_TO_SPEECH: { speechToSpeech: true },
  // Additional Flags
  LIGHT: { light: true },
  LEGACY: { legacy: true },
};

// Cross-region inference profile prefixes ('' is the plain model ID).
type ModelIdPrefix = 'global' | 'us' | 'eu' | 'apac' | 'jp' | 'au' | '';

// Defines the same model under several inference profile prefixes at once,
// e.g. withPrefixes('amazon.nova-pro-v1:0', ['us', 'eu'], metadata) defines
// 'us.amazon.nova-pro-v1:0' and 'eu.amazon.nova-pro-v1:0'.
// Keep a model under separate entries when its flags differ by prefix.
const withPrefixes = (
  baseModelId: string,
  prefixes: ModelIdPrefix[],
  metadata: ModelMetadata
): Record<string, ModelMetadata> =>
  Object.fromEntries(
    prefixes.map((prefix) => [
      prefix ? `${prefix}.${baseModelId}` : baseModelId,
      { ...metadata },
    ])
  );

export const modelMetadata: Record<string, ModelMetadata> = {
  // ==== Text ===

  // Anthropic
  ...withPrefixes(
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    ['', 'us', 'apac'],
    {
      flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
      displayName: 'Claude 3.5 Sonnet v2',
    }
  ),
  ...withPrefixes('anthropic.claude-3-5-haiku-20241022-v1:0', ['', 'us'], {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Claude 3.5 Haiku',
  }),
  ...withPrefixes(
    'anthropic.claude-3-5-sonnet-20240620-v1:0',
    ['', 'us', 'eu', 'apac'],
    {
      flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
      displayName: 'Claude 3.5 Sonnet',
    }
  ),
  ...withPrefixes('anthropic.claude-3-opus-20240229-v1:0', ['', 'us'], {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3 Opus',
  }),
  ...withPrefixes(
    'anthropic.claude-3-sonnet-20240229-v1:0',
    ['', 'us', 'eu', 'apac'],
    {
      flags: {
        ...MODEL_FEATURE.TEXT_DOC_IMAGE,
        ...MODEL_FEATURE.LIGHT,
        ...MODEL_FEATURE.LEGACY,
      },
      displayName: 'Claude 3 Sonnet',
    }
  ),
  ...withPrefixes(
    'anthropic.claude-3-haiku-20240307-v1:0',
    ['', 'us', 'eu', 'apac'],
    {
      flags: {
        ...MODEL_FEATURE.TEXT_DOC_IMAGE,
        ...MODEL_FEATURE.LIGHT,
      },
      displayName: 'Claude 3 Haiku',
    }
  ),
  ...withPrefixes('anthropic.claude-opus-4-5-20251101-v1:0', ['us', 'global'], {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
    displayName: 'Claude Opus 4.5',
  }),
  'us.anthropic.claude-opus-4-1-20250805-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Claude Opus 4.1',
  },
  'us.anthropic.claude-opus-4-20250514-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
    displayName: 'Claude Opus 4',
  },
  ...withPrefixes(
    'anthropic.claude-opus-5-5',
    ['global', 'us', 'eu', 'au', 'jp'],
    {
      flags:
        MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING_ALWAYS_ON_NO_SAMPLING,
      displayName: 'Claude Opus 5.5',
    }
  ),
  ...withPrefixes('anthropic.claude-opus-5', ['global', 'us', 'eu', 'au'], {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING_NO_SAMPLING,
    displayName: 'Claude Opus 5',
  }),
  ...withPrefixes(
    'anthropic.claude-haiku-5-5',
    ['global', 'us', 'eu', 'au', 'jp'],
    {
      flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING_NO_SAMPLING,
      displayName: 'Claude Haiku 5.5',
    }
  ),
  ...withPrefixes('anthropic.claude-opus-4-8', ['global', 'us', 'eu', 'jp'], {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING_NO_SAMPLING,
    displayName: 'Claude Opus 4.8',
  }),
  ...withPrefixes('anthropic.claude-opus-4-7', ['global', 'us', 'eu', 'jp'], {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING_NO_SAMPLING,
    displayName: 'Claude Opus 4.7',
  }),
  ...withPrefixes(
    'anthropic.claude-opus-4-6-v1',
    ['global', 'us', 'au', 'eu'],
    {
      flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING,
      displayName: 'Claude Opus 4.6',
    }
  ),
  ...withPrefixes('anthropic.claude-sonnet-5-5', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING_ALWAYS_ON_NO_SAMPLING,
    displayName: 'Claude Sonnet 5.5',
  }),
  ...withPrefixes('anthropic.claude-sonnet-5', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING_ALWAYS_ON_NO_SAMPLING,
    displayName: 'Claude Sonnet 5',
  }),
  'global.anthropic.claude-fable-5': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING_ALWAYS_ON_NO_SAMPLING,
    displayName: 'Claude Fable 5',
  },
  ...withPrefixes(
    'anthropic.claude-sonnet-4-6',
    ['global', 'us', 'eu', 'au', 'jp'],
    {
      flags: MODEL_FEATURE.TEXT_DOC_IMAGE_ADAPTIVE_THINKING,
      displayName: 'Claude Sonnet 4.6',
    }
  ),
  ...withPrefixes(
    'anthropic.claude-sonnet-4-5-20250929-v1:0',
    ['global', 'us', 'eu', 'jp'],
    {
      flags: {
        ...MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
        ...MODEL_FEATURE.LEGACY,
      },
      displayName: 'Claude Sonnet 4.5',
    }
  ),
  ...withPrefixes(
    'anthropic.claude-haiku-4-5-20251001-v1:0',
    ['global', 'us', 'eu', 'jp'],
    {
      flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
      displayName: 'Claude Haiku 4.5',
    }
  ),
  ...withPrefixes(
    'anthropic.claude-sonnet-4-20250514-v1:0',
    ['global', 'us', 'eu', 'apac'],
    {
      flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
      displayName: 'Claude Sonnet 4',
    }
  ),
  ...withPrefixes(
    'anthropic.claude-3-7-sonnet-20250219-v1:0',
    ['us', 'eu', 'apac'],
    {
      flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
      displayName: 'Claude 3.7 Sonnet',
    }
  ),
  // Amazon Titan
  'amazon.titan-text-express-v1': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Titan Text G1 - Express',
  },
  'amazon.titan-text-premier-v1:0': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'Titan Text G1 - Premier',
  },
  // Amazon Nova
  'amazon.nova-pro-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_VIDEO,
    displayName: 'Nova Pro',
  },
  'amazon.nova-lite-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE_VIDEO,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Lite',
  },
  ...withPrefixes('amazon.nova-micro-v1:0', ['', 'us', 'eu', 'apac'], {
    flags: {
      ...MODEL_FEATURE.TEXT_ONLY,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Micro',
  }),

  'us.amazon.nova-premier-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Nova Premier',
  },
  // S3 Video Upload only supports us-east-1.
  // If you want to use Video, please use amazon.nova-pro-v1:0 in us-east-1.
  // (Note: If RAG is enabled, it will be deleted when the region is changed)
  ...withPrefixes('amazon.nova-pro-v1:0', ['us', 'eu', 'apac'], {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Nova Pro',
  }),
  ...withPrefixes('amazon.nova-lite-v1:0', ['us', 'eu', 'apac'], {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Lite',
  }),
  ...withPrefixes('amazon.nova-2-lite-v1:0', ['us', 'jp', 'global'], {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Lite 2',
  }),
  // Meta
  'meta.llama3-8b-instruct-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Llama 3 8B Instruct',
  },
  'meta.llama3-70b-instruct-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Llama 3 70B Instruct',
  },
  'meta.llama3-1-8b-instruct-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Llama 3.1 8B Instruct',
  },
  'meta.llama3-1-70b-instruct-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Llama 3.1 70B Instruct',
  },
  'meta.llama3-1-405b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Llama 3.1 405B Instruct',
  },
  'us.meta.llama3-2-1b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Llama 3.2 1B Instruct',
  },
  'us.meta.llama3-2-3b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Llama 3.2 3B Instruct',
  },
  'us.meta.llama3-2-11b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Llama 3.2 11B Vision Instruct',
  },
  'us.meta.llama3-2-90b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Llama 3.2 90B Vision Instruct',
  },
  'us.meta.llama3-3-70b-instruct-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Llama 3.3 70B Instruct',
  },
  'us.meta.llama4-maverick-17b-instruct-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Llama 4 Maverick 17B Instruct',
  },
  'us.meta.llama4-scout-17b-instruct-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Llama 4 Scout 17B Instruct',
  },
  // Mistral
  'mistral.mistral-7b-instruct-v0:2': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Mistral 7B Instruct',
  },
  'mistral.mixtral-8x7b-instruct-v0:1': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Mixtral 8x7B Instruct',
  },
  'mistral.mistral-small-2402-v1:0': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'Mistral Small (24.02)',
  },
  'mistral.mistral-large-2402-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Mistral Large (24.02)',
  },
  'mistral.mistral-large-2407-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Mistral Large 2 (24.07)',
  },
  ...withPrefixes('mistral.pixtral-large-2502-v1:0', ['us', 'eu'], {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Pixtral Large (25.02)',
  }),
  'mistral.mistral-large-3-675b-instruct': {
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'Mistral Large 3',
  },
  'mistral.ministral-3-3b-instruct': {
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'Ministral 3 3B',
  },
  'mistral.ministral-3-8b-instruct': {
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'Ministral 3 8B',
  },
  'mistral.ministral-3-14b-instruct': {
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'Ministral 3 14B',
  },
  'mistral.magistral-small-2509': {
    // Reasoning by default without additional parameter
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'Magistral Small 2509',
  },
  // Cohere
  'cohere.command-r-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Command R',
  },
  'cohere.command-r-plus-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Command R+',
  },
  // DeepSeek
  'deepseek.v3-v1:0': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'DeepSeek V3.1',
  },
  'us.deepseek.r1-v1:0': {
    flags: {
      // Reasons natively. Bedrock rejects the reasoning_config the reasoning option sends.
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'DeepSeek-R1',
  },
  // Qwen
  'qwen.qwen3-235b-a22b-2507-v1:0': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'Qwen3 235B A22B 2507',
  },
  'qwen.qwen3-32b-v1:0': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'Qwen3 32B',
  },
  'qwen.qwen3-coder-480b-a35b-v1:0': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'Qwen3-Coder 480B A35B Instruct',
  },
  'qwen.qwen3-coder-30b-a3b-v1:0': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'Qwen3-Coder 30B A3B Instruct',
  },
  'qwen.qwen3-next-80b-a3b': {
    // TODO: Enable Reasoning
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'Qwen3 Next 80B A3B',
  },
  'qwen.qwen3-vl-235b-a22b': {
    // TODO: Enable Reasoning
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'Qwen3 VL 235B A22B',
  },
  // Writer
  'us.writer.palmyra-x4-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Palmyra X4',
  },
  'us.writer.palmyra-x5-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Palmyra X5',
  },
  // OpenAI
  'openai.gpt-oss-120b-1:0': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'GPT OSS 120B',
  },
  'openai.gpt-oss-20b-1:0': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'GPT OSS 20B',
  },
  // GPT-6.1 / GPT-6 / GPT-5.6: Converse rejects temperature, topP and document blocks.
  // Only global. and us. inference profiles exist.
  ...withPrefixes('openai.gpt-6.1-sol', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'GPT-6.1 Sol',
  }),
  ...withPrefixes('openai.gpt-6.1-terra', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'GPT-6.1 Terra',
  }),
  ...withPrefixes('openai.gpt-6-sol', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'GPT-6 Sol',
  }),
  ...withPrefixes('openai.gpt-6-luna', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'GPT-6 Luna',
  }),
  ...withPrefixes('openai.gpt-6-astra', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'GPT-6 Astra',
  }),
  ...withPrefixes('openai.gpt-5.6-sol', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'GPT-5.6 Sol',
  }),
  ...withPrefixes('openai.gpt-5.6-luna', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'GPT-5.6 Luna',
  }),
  ...withPrefixes('openai.gpt-5.6-terra', ['global', 'us'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'GPT-5.6 Terra',
  }),
  // Google
  'google.gemma-3-4b-it': {
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'Gemma 3 4B IT',
  },
  'google.gemma-3-12b-it': {
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'Gemma 3 12B IT',
  },
  'google.gemma-3-27b-it': {
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'Gemma 3 27B IT',
  },
  // MiniMax AI
  'minimax.minimax-m2': {
    // Reasoning by default without additional parameter
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'Minimax M2',
  },
  // Moonshot AI
  'moonshot.kimi-k2-thinking': {
    // Reasoning by default without additional parameter
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'Kimi K2 Thinking',
  },
  // Kimi K3 supports text and image input (video is not supported on Bedrock).
  // Documents are excluded because the Converse API rejects document inputs for this model.
  // Sampling params (temperature / topP) are rejected by this model, so noSamplingParams is set.
  ...withPrefixes('moonshotai.kimi-k3', ['us', 'global'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'Kimi K3',
  }),
  ...withPrefixes('moonshotai.kimi-k3.1', ['us', 'global'], {
    flags: MODEL_FEATURE.TEXT_IMAGE_NO_SAMPLING,
    displayName: 'Kimi K3.1',
  }),
  // NVIDIA
  'nvidia.nemotron-nano-9b-v2': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'NVIDIA Nemotron Nano 9B v2',
  },
  'nvidia.nemotron-nano-12b-v2': {
    flags: MODEL_FEATURE.TEXT_IMAGE,
    displayName: 'NVIDIA Nemotron Nano 12B v2 VL BF16',
  },
  'nvidia.nemotron-nano-3-30b': {
    flags: MODEL_FEATURE.TEXT_ONLY,
    displayName: 'NVIDIA Nemotron Nano 3 30B',
  },

  // === Image ===

  // Stability AI Image Gen
  'stability.stable-diffusion-xl-v1': {
    flags: {
      ...MODEL_FEATURE.IMAGE_GEN,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Stable Diffusion XL',
  },
  'stability.stable-image-core-v1:1': {
    flags: {
      ...MODEL_FEATURE.IMAGE_GEN,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Stable Image Core v1.1',
  },
  'stability.stable-image-ultra-v1:1': {
    flags: {
      ...MODEL_FEATURE.IMAGE_GEN,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Stable Image Ultra v1.1',
  },
  'stability.sd3-5-large-v1:0': {
    flags: {
      ...MODEL_FEATURE.IMAGE_GEN,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Stable Diffusion 3.5 Large',
  },
  // Amazon Image Gen
  'amazon.titan-image-generator-v2:0': {
    flags: MODEL_FEATURE.IMAGE_GEN,
    displayName: 'Titan Image Generator G1 v2',
  },
  'amazon.titan-image-generator-v1': {
    flags: MODEL_FEATURE.IMAGE_GEN,
    displayName: 'Titan Image Generator G1',
  },
  'amazon.nova-canvas-v1:0': {
    flags: MODEL_FEATURE.IMAGE_GEN,
    displayName: 'Nova Canvas',
  },

  // === Video ===

  'amazon.nova-reel-v1:0': {
    flags: MODEL_FEATURE.VIDEO_GEN,
    displayName: 'Nova Reel',
  },
  'amazon.nova-reel-v1:1': {
    flags: MODEL_FEATURE.VIDEO_GEN,
    displayName: 'Nova Reel',
  },
  'luma.ray-v2:0': {
    flags: MODEL_FEATURE.VIDEO_GEN,
    displayName: 'Ray',
  },

  // === Embedding ===

  // Amazon
  'amazon.titan-embed-text-v1': {
    flags: MODEL_FEATURE.EMBEDDING,
    displayName: 'Titan Embeddings G1 - Text',
  },
  'amazon.titan-embed-image-v1': {
    flags: MODEL_FEATURE.EMBEDDING,
    displayName: 'Titan Multimodal Embeddings G1',
  },
  'amazon.titan-embed-text-v2:0': {
    flags: MODEL_FEATURE.EMBEDDING,
    displayName: 'Titan Text Embeddings V2',
  },
  // Cohere
  'cohere.embed-english-v3': {
    flags: MODEL_FEATURE.EMBEDDING,
    displayName: 'Embed English',
  },
  'cohere.embed-multilingual-v3': {
    flags: MODEL_FEATURE.EMBEDDING,
    displayName: 'Embed Multilingual',
  },

  // === Reranking ===

  // Amazon
  'amazon.rerank-v1:0': {
    flags: MODEL_FEATURE.RERANKING,
    displayName: 'Rerank 1.0',
  },
  // Cohere
  'cohere.rerank-v3-5:0': {
    flags: MODEL_FEATURE.RERANKING,
    displayName: 'Rerank 3.5',
  },

  // === Speech to Speech ===

  // Amazon
  'amazon.nova-2-5-sonic': {
    flags: MODEL_FEATURE.SPEECH_TO_SPEECH,
    displayName: 'Nova 2.5 Sonic',
  },
  'amazon.nova-2-sonic-v1:0': {
    flags: MODEL_FEATURE.SPEECH_TO_SPEECH,
    displayName: 'Nova 2 Sonic',
  },
  'amazon.nova-sonic-v1:0': {
    flags: MODEL_FEATURE.SPEECH_TO_SPEECH,
    displayName: 'Nova Sonic',
  },
};

export const BEDROCK_TEXT_MODELS = Object.keys(modelMetadata).filter(
  (model) => modelMetadata[model].flags.text
);
export const BEDROCK_IMAGE_GEN_MODELS = Object.keys(modelMetadata).filter(
  (model) => modelMetadata[model].flags.image_gen
);
export const BEDROCK_VIDEO_GEN_MODELS = Object.keys(modelMetadata).filter(
  (model) => modelMetadata[model].flags.video_gen
);
export const BEDROCK_EMBEDDING_MODELS = Object.keys(modelMetadata).filter(
  (model) => modelMetadata[model].flags.embedding
);
export const BEDROCK_RERANKING_MODELS = Object.keys(modelMetadata).filter(
  (model) => modelMetadata[model].flags.reranking
);
export const BEDROCK_SPEECH_TO_SPEECH_MODELS = Object.keys(
  modelMetadata
).filter((model) => modelMetadata[model].flags.speechToSpeech);

// Voices available for each speech-to-speech model.
// Nova Sonic has no language parameter. The voiceId picks the voice (and its
// accent); the model answers in the language of the conversation.
// Sources:
//   https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-language-support.html
//   https://docs.aws.amazon.com/nova/latest/userguide/available-voices.html
const voice = (
  voiceId: string,
  gender: SpeechToSpeechVoice['gender'],
  locales: string[],
  polyglot?: boolean
): SpeechToSpeechVoice => ({
  voiceId,
  gender,
  locales,
  ...(polyglot ? { polyglot } : {}),
});

// Nova 2 Sonic / Nova 2.5 Sonic share the same voice set. tiffany and matthew
// are polyglot voices that speak every supported language. kiara and arjun are
// listed for both en-IN and hi-IN, so each voice is one entry with its locales.
// tiffany is placed first so it is the default selection and keeps backward
// compatibility with the previously hardcoded voiceId.
const NOVA_2_SONIC_VOICES: SpeechToSpeechVoice[] = [
  voice('tiffany', 'feminine', ['en-US'], true),
  voice('matthew', 'masculine', ['en-US'], true),
  voice('amy', 'feminine', ['en-GB']),
  voice('olivia', 'feminine', ['en-AU']),
  voice('kiara', 'feminine', ['en-IN', 'hi-IN']),
  voice('arjun', 'masculine', ['en-IN', 'hi-IN']),
  voice('ambre', 'feminine', ['fr-FR']),
  voice('florian', 'masculine', ['fr-FR']),
  voice('beatrice', 'feminine', ['it-IT']),
  voice('lorenzo', 'masculine', ['it-IT']),
  voice('tina', 'feminine', ['de-DE']),
  voice('lennart', 'masculine', ['de-DE']),
  voice('lupe', 'feminine', ['es-US']),
  voice('carlos', 'masculine', ['es-US']),
  voice('carolina', 'feminine', ['pt-BR']),
  voice('leo', 'masculine', ['pt-BR']),
];

// Nova Sonic v1 has a smaller voice set (its German feminine voice is greta).
const NOVA_SONIC_V1_VOICES: SpeechToSpeechVoice[] = [
  voice('tiffany', 'feminine', ['en-US']),
  voice('matthew', 'masculine', ['en-US']),
  voice('amy', 'feminine', ['en-GB']),
  voice('ambre', 'feminine', ['fr-FR']),
  voice('florian', 'masculine', ['fr-FR']),
  voice('beatrice', 'feminine', ['it-IT']),
  voice('lorenzo', 'masculine', ['it-IT']),
  voice('greta', 'feminine', ['de-DE']),
  voice('lennart', 'masculine', ['de-DE']),
  voice('lupe', 'feminine', ['es-US']),
  voice('carlos', 'masculine', ['es-US']),
];

export const SPEECH_TO_SPEECH_VOICES: Record<string, SpeechToSpeechVoice[]> = {
  'amazon.nova-2-5-sonic': NOVA_2_SONIC_VOICES,
  'amazon.nova-2-sonic-v1:0': NOVA_2_SONIC_VOICES,
  'amazon.nova-sonic-v1:0': NOVA_SONIC_V1_VOICES,
};

export const getSpeechToSpeechVoices = (
  modelId: string
): SpeechToSpeechVoice[] => {
  return SPEECH_TO_SPEECH_VOICES[modelId] ?? [];
};

// Whether voiceId is one of the voices of the speech-to-speech model
export const isSpeechToSpeechVoice = (
  modelId: string,
  voiceId: string
): boolean => {
  return getSpeechToSpeechVoices(modelId).some((v) => v.voiceId === voiceId);
};

// Prompt caching
// https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
export const SUPPORTED_CACHE_FIELDS: Record<string, PromptCacheField[]> = {
  'anthropic.claude-haiku-5-5': ['messages', 'system', 'tools'],
  'anthropic.claude-sonnet-5-5': ['messages', 'system', 'tools'],
  'anthropic.claude-sonnet-5': ['messages', 'system', 'tools'],
  'anthropic.claude-opus-5-5': ['messages', 'system', 'tools'],
  'anthropic.claude-opus-5': ['messages', 'system', 'tools'],
  'anthropic.claude-opus-4-8': ['messages', 'system', 'tools'],
  'anthropic.claude-opus-4-7': ['messages', 'system', 'tools'],
  'anthropic.claude-opus-4-6-v1': ['messages', 'system', 'tools'],
  'anthropic.claude-sonnet-4-6': ['messages', 'system', 'tools'],
  'anthropic.claude-opus-4-5-20251101-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-sonnet-4-5-20250929-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-haiku-4-5-20251001-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-opus-4-1-20250805-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-opus-4-20250514-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-sonnet-4-20250514-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-3-7-sonnet-20250219-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-3-5-haiku-20241022-v1:0': ['messages', 'system', 'tools'],
  'amazon.nova-premier-v1:0': ['messages', 'system'],
  'amazon.nova-pro-v1:0': ['messages', 'system'],
  'amazon.nova-lite-v1:0': ['messages', 'system'],
  'amazon.nova-micro-v1:0': ['messages', 'system'],
  'amazon.nova-2-lite-v1:0': ['messages', 'system'],
};

export const CRI_PREFIX_PATTERN = /^(global|us|eu|apac|jp|au)\./;

// Amazon Bedrock end-of-life (EOL) by base model ID, without an inference
// profile prefix. After its EOL date a model is removed and requests to it fail.
// Dates are the earliest EOL announced for any Region. The same model can stay
// available longer in other Regions, so check the Region you use.
// Sources: https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle-legacy.html
// and the modelLifecycle field of ListFoundationModels.
// RETIRED marks a model Bedrock already rejects with "reached the end of its
// life" and for which no date is published (found with npm run models:verify).
export const RETIRED = 'retired';
export const MODEL_END_OF_LIFE: Record<string, string> = {
  // Already retired
  'amazon.titan-text-express-v1': RETIRED,
  'amazon.titan-text-premier-v1:0': RETIRED,
  'amazon.nova-premier-v1:0': RETIRED,
  'anthropic.claude-3-opus-20240229-v1:0': RETIRED,
  'anthropic.claude-3-5-haiku-20241022-v1:0': RETIRED,
  'anthropic.claude-opus-4-20250514-v1:0': RETIRED,
  'meta.llama3-1-405b-instruct-v1:0': '2026-07-07',
  'meta.llama3-2-11b-instruct-v1:0': '2026-07-07',
  'meta.llama3-2-1b-instruct-v1:0': '2026-07-07',
  'meta.llama3-2-3b-instruct-v1:0': '2026-07-07',
  'meta.llama3-2-90b-instruct-v1:0': '2026-07-07',
  'cohere.command-r-v1:0': '2026-08-19',
  'cohere.command-r-plus-v1:0': '2026-08-19',
  'anthropic.claude-3-haiku-20240307-v1:0': '2026-09-10',
  'amazon.nova-sonic-v1:0': '2026-09-14',
  'amazon.nova-canvas-v1:0': '2026-09-30',
  'amazon.nova-reel-v1:0': '2026-09-30',
  'amazon.nova-reel-v1:1': '2026-09-30',
  'anthropic.claude-sonnet-4-20250514-v1:0': '2026-10-14',
  'anthropic.claude-3-sonnet-20240229-v1:0': '2026-11-13',
  'anthropic.claude-3-5-sonnet-20240620-v1:0': '2026-11-13',
  'anthropic.claude-3-5-sonnet-20241022-v2:0': '2026-11-13',
  'anthropic.claude-3-7-sonnet-20250219-v1:0': '2026-11-13',
  // Scheduled
  'anthropic.claude-opus-4-1-20250805-v1:0': '2027-01-08',
  'writer.palmyra-x4-v1:0': '2027-03-09',
  'writer.palmyra-x5-v1:0': '2027-03-21',
  'deepseek.r1-v1:0': '2027-03-30',
  'deepseek.v3-v1:0': '2027-03-30',
  'google.gemma-3-4b-it': '2027-03-30',
  'google.gemma-3-12b-it': '2027-03-30',
  'google.gemma-3-27b-it': '2027-03-30',
  'meta.llama3-8b-instruct-v1:0': '2027-03-30',
  'meta.llama3-70b-instruct-v1:0': '2027-03-30',
  'meta.llama3-1-8b-instruct-v1:0': '2027-03-30',
  'meta.llama3-1-70b-instruct-v1:0': '2027-03-30',
  'meta.llama3-3-70b-instruct-v1:0': '2027-03-30',
  'meta.llama4-maverick-17b-instruct-v1:0': '2027-03-30',
  'meta.llama4-scout-17b-instruct-v1:0': '2027-03-30',
  'minimax.minimax-m2': '2027-03-30',
  'mistral.mistral-7b-instruct-v0:2': '2027-03-30',
  'mistral.mixtral-8x7b-instruct-v0:1': '2027-03-30',
  'moonshot.kimi-k2-thinking': '2027-03-30',
  'nvidia.nemotron-nano-12b-v2': '2027-03-30',
  'nvidia.nemotron-nano-9b-v2': '2027-03-30',
  'qwen.qwen3-coder-30b-a3b-v1:0': '2027-03-30',
  'qwen.qwen3-coder-480b-a35b-v1:0': '2027-03-30',
  'anthropic.claude-sonnet-4-5-20250929-v1:0': '2027-04-08',
  'stability.stable-image-core-v1:1': '2027-05-09',
  'stability.sd3-5-large-v1:0': '2027-05-09',
};

export type EndOfLife =
  // Bedrock rejects requests now and publishes no date
  | { state: 'retired' }
  // The EOL date has passed
  | { state: 'ended'; date: string }
  // The EOL date is ahead
  | { state: 'scheduled'; date: string; daysLeft: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Returns undefined for a model with no announced end of life.
export const getEndOfLife = ({
  modelId,
  today = new Date(),
}: {
  modelId: string;
  today?: Date;
}): EndOfLife | undefined => {
  const value = MODEL_END_OF_LIFE[modelId.replace(CRI_PREFIX_PATTERN, '')];
  if (!value) return undefined;
  if (value === RETIRED) return { state: 'retired' };
  const msLeft =
    Date.parse(`${value}T00:00:00Z`) -
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return msLeft <= 0
    ? { state: 'ended', date: value }
    : {
        state: 'scheduled',
        date: value,
        daysLeft: Math.ceil(msLeft / MS_PER_DAY),
      };
};
