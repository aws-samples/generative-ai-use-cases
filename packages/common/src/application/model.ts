import {
  FeatureFlags,
  PromptCacheField,
  ModelMetadata,
} from 'generative-ai-use-cases';

// Manage Model Feature
// https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html
const MODEL_FEATURE: Record<string, FeatureFlags> = {
  // Model Feature Flags
  TEXT_ONLY: { text: true, doc: false, image: false, video: false },
  TEXT_DOC: { text: true, doc: true, image: false, video: false },
  TEXT_DOC_IMAGE: { text: true, doc: true, image: true, video: false },
  TEXT_DOC_IMAGE_REASONING: {
    text: true,
    doc: true,
    image: true,
    video: false,
    reasoning: true,
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

export const modelMetadata: Record<string, ModelMetadata> = {
  // ==== Text ===

  // Anthropic
  'anthropic.claude-3-5-sonnet-20241022-v2:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3.5 Sonnet v2',
  },
  'anthropic.claude-3-5-haiku-20241022-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3.5 Haiku',
  },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3.5 Sonnet',
  },
  'anthropic.claude-3-opus-20240229-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3 Opus',
  },
  'anthropic.claude-3-sonnet-20240229-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Claude 3 Sonnet',
  },
  'anthropic.claude-3-haiku-20240307-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Claude 3 Haiku',
  },
  'us.anthropic.claude-opus-4-20250514-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
    displayName: 'Claude Opus 4',
  },
  'us.anthropic.claude-sonnet-4-20250514-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
    displayName: 'Claude Sonnet 4',
  },
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
    displayName: 'Claude 3.7 Sonnet',
  },
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3.5 Sonnet v2',
  },
  'us.anthropic.claude-3-5-haiku-20241022-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3.5 Haiku',
  },
  'us.anthropic.claude-3-5-sonnet-20240620-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3.5 Sonnet',
  },
  'us.anthropic.claude-3-opus-20240229-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3 Opus',
  },
  'us.anthropic.claude-3-sonnet-20240229-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Claude 3 Sonnet',
  },
  'us.anthropic.claude-3-haiku-20240307-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Claude 3 Haiku',
  },
  'eu.anthropic.claude-sonnet-4-20250514-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
    displayName: 'Claude Sonnet 4',
  },
  'eu.anthropic.claude-3-7-sonnet-20250219-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
    displayName: 'Claude 3.7 Sonnet',
  },
  'eu.anthropic.claude-3-5-sonnet-20240620-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3.5 Sonnet',
  },
  'eu.anthropic.claude-3-sonnet-20240229-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Claude 3 Sonnet',
  },
  'eu.anthropic.claude-3-haiku-20240307-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Claude 3 Haiku',
  },
  'apac.anthropic.claude-sonnet-4-20250514-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
    displayName: 'Claude Sonnet 4',
  },
  'apac.anthropic.claude-3-7-sonnet-20250219-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
    displayName: 'Claude 3.7 Sonnet',
  },
  'apac.anthropic.claude-3-5-sonnet-20241022-v2:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3.5 Sonnet v2',
  },
  'apac.anthropic.claude-3-5-sonnet-20240620-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Claude 3.5 Sonnet',
  },
  'apac.anthropic.claude-3-sonnet-20240229-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Claude 3 Sonnet',
  },
  'apac.anthropic.claude-3-haiku-20240307-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Claude 3 Haiku',
  },
  'anthropic.claude-v2:1': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Claude 2.1',
  },
  'anthropic.claude-v2': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Claude',
  },
  'anthropic.claude-instant-v1': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Claude Instant',
  },
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
  'amazon.nova-micro-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_ONLY,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Micro',
  },

  // S3 Video Upload only supports us-east-1.
  // If you want to use Video, please use amazon.nova-pro-v1:0 in us-east-1.
  // (Note: If RAG is enabled, it will be deleted when the region is changed)
  'us.amazon.nova-premier-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Nova Premier',
  },
  'us.amazon.nova-pro-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Nova Pro',
  },
  'us.amazon.nova-lite-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Lite',
  },
  'us.amazon.nova-micro-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_ONLY,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Micro',
  },
  'eu.amazon.nova-pro-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
    displayName: 'Nova Pro',
  },
  'eu.amazon.nova-lite-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Lite',
  },
  'eu.amazon.nova-micro-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_ONLY,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Micro',
  },
  'apac.amazon.nova-pro-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
    displayName: 'Nova Pro',
  },
  'apac.amazon.nova-lite-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Lite',
  },
  'apac.amazon.nova-micro-v1:0': {
    flags: {
      ...MODEL_FEATURE.TEXT_ONLY,
      ...MODEL_FEATURE.LIGHT,
    },
    displayName: 'Nova Micro',
  },
  // Meta
  'meta.llama3-8b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Llama 3 8B Instruct',
  },
  'meta.llama3-70b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Llama 3 70B Instruct',
  },
  'meta.llama3-1-8b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Llama 3.1 8B Instruct',
  },
  'meta.llama3-1-70b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
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
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Llama 3.3 70B Instruct',
  },
  'us.meta.llama4-maverick-17b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Llama 4 Maverick 17B Instruct',
  },
  'us.meta.llama4-scout-17b-instruct-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Llama 4 Scout 17B Instruct',
  },
  // Mistral
  'mistral.mistral-7b-instruct-v0:2': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Mistral 7B Instruct',
  },
  'mistral.mixtral-8x7b-instruct-v0:1': {
    flags: MODEL_FEATURE.TEXT_DOC,
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
  'us.mistral.pixtral-large-2502-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Pixtral Large (25.02)',
  },
  'eu.mistral.pixtral-large-2502-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC_IMAGE,
    displayName: 'Pixtral Large (25.02)',
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
  'us.deepseek.r1-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'DeepSeek-R1',
  },
  // Writer
  'us.writer.palmyra-x4-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Palmyra X4',
  },
  'us.writer.palmyra-x5-v1:0': {
    flags: MODEL_FEATURE.TEXT_DOC,
    displayName: 'Palmyra X5',
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
  'stability.sd3-large-v1:0': {
    flags: {
      ...MODEL_FEATURE.IMAGE_GEN,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'SD3 Large 1.0',
  },
  'stability.stable-image-core-v1:0': {
    flags: {
      ...MODEL_FEATURE.IMAGE_GEN,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Stable Image Core v1.0',
  },
  'stability.stable-image-core-v1:1': {
    flags: MODEL_FEATURE.IMAGE_GEN,
    displayName: 'Stable Image Core v1.1',
  },
  'stability.stable-image-ultra-v1:0': {
    flags: {
      ...MODEL_FEATURE.IMAGE_GEN,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Stable Image Ultra v1.0',
  },
  'stability.stable-image-ultra-v1:1': {
    flags: {
      ...MODEL_FEATURE.IMAGE_GEN,
      ...MODEL_FEATURE.LEGACY,
    },
    displayName: 'Stable Image Ultra v1.1',
  },
  'stability.sd3-5-large-v1:0': {
    flags: MODEL_FEATURE.IMAGE_GEN,
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

// Prompt caching
// https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
export const SUPPORTED_CACHE_FIELDS: Record<string, PromptCacheField[]> = {
  'anthropic.claude-opus-4-20250514-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-sonnet-4-20250514-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-3-7-sonnet-20250219-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-3-5-haiku-20241022-v1:0': ['messages', 'system', 'tools'],
  'amazon.nova-pro-v1:0': ['messages', 'system'],
  'amazon.nova-lite-v1:0': ['messages', 'system'],
  'amazon.nova-micro-v1:0': ['messages', 'system'],
};
