import { FeatureFlags, PromptCacheField } from 'generative-ai-use-cases';

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
};
export const modelFeatureFlags: Record<string, FeatureFlags> = {
  // ==== Text ===

  // Anthropic
  'anthropic.claude-3-5-sonnet-20241022-v2:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'anthropic.claude-3-5-haiku-20241022-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'anthropic.claude-3-5-sonnet-20240620-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'anthropic.claude-3-opus-20240229-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'anthropic.claude-3-sonnet-20240229-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE,
    ...MODEL_FEATURE.LIGHT,
  },
  'anthropic.claude-3-haiku-20240307-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE,
    ...MODEL_FEATURE.LIGHT,
  },
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0':
    MODEL_FEATURE.TEXT_DOC_IMAGE_REASONING,
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'us.anthropic.claude-3-5-haiku-20241022-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'us.anthropic.claude-3-5-sonnet-20240620-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'us.anthropic.claude-3-opus-20240229-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'us.anthropic.claude-3-sonnet-20240229-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE,
    ...MODEL_FEATURE.LIGHT,
  },
  'us.anthropic.claude-3-haiku-20240307-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE,
    ...MODEL_FEATURE.LIGHT,
  },
  'eu.anthropic.claude-3-5-sonnet-20240620-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'eu.anthropic.claude-3-sonnet-20240229-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE,
    ...MODEL_FEATURE.LIGHT,
  },
  'eu.anthropic.claude-3-haiku-20240307-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE,
    ...MODEL_FEATURE.LIGHT,
  },
  'apac.anthropic.claude-3-5-sonnet-20241022-v2:0':
    MODEL_FEATURE.TEXT_DOC_IMAGE,
  'apac.anthropic.claude-3-5-sonnet-20240620-v1:0':
    MODEL_FEATURE.TEXT_DOC_IMAGE,
  'apac.anthropic.claude-3-sonnet-20240229-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE,
    ...MODEL_FEATURE.LIGHT,
  },
  'apac.anthropic.claude-3-haiku-20240307-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE,
    ...MODEL_FEATURE.LIGHT,
  },
  'anthropic.claude-v2:1': MODEL_FEATURE.TEXT_DOC,
  'anthropic.claude-v2': MODEL_FEATURE.TEXT_DOC,
  'anthropic.claude-instant-v1': MODEL_FEATURE.TEXT_DOC,
  // Amazon Titan
  'amazon.titan-text-express-v1': MODEL_FEATURE.TEXT_DOC,
  'amazon.titan-text-premier-v1:0': MODEL_FEATURE.TEXT_ONLY,
  // Amazon Nova
  'amazon.nova-pro-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE_VIDEO,
  'amazon.nova-lite-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE_VIDEO,
    ...MODEL_FEATURE.LIGHT,
  },
  'amazon.nova-micro-v1:0': {
    ...MODEL_FEATURE.TEXT_ONLY,
    ...MODEL_FEATURE.LIGHT,
  },

  // S3 Video Upload only supports us-east-1.
  // If you want to use Video, please use amazon.nova-pro-v1:0 in us-east-1.
  // (Note: If RAG is enabled, it will be deleted when the region is changed)
  'us.amazon.nova-premier-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'us.amazon.nova-pro-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'us.amazon.nova-lite-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
    ...MODEL_FEATURE.LIGHT,
  },
  'us.amazon.nova-micro-v1:0': {
    ...MODEL_FEATURE.TEXT_ONLY,
    ...MODEL_FEATURE.LIGHT,
  },
  'eu.amazon.nova-pro-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
  'eu.amazon.nova-lite-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
    ...MODEL_FEATURE.LIGHT,
  },
  'eu.amazon.nova-micro-v1:0': {
    ...MODEL_FEATURE.TEXT_ONLY,
    ...MODEL_FEATURE.LIGHT,
  },
  'apac.amazon.nova-pro-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
  'apac.amazon.nova-lite-v1:0': {
    ...MODEL_FEATURE.TEXT_DOC_IMAGE, // Same as above
    ...MODEL_FEATURE.LIGHT,
  },
  'apac.amazon.nova-micro-v1:0': {
    ...MODEL_FEATURE.TEXT_ONLY,
    ...MODEL_FEATURE.LIGHT,
  },
  // Meta
  'meta.llama3-8b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC,
  'meta.llama3-70b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC,
  'meta.llama3-1-8b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC,
  'meta.llama3-1-70b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC,
  'meta.llama3-1-405b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC,
  'us.meta.llama3-2-1b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC,
  'us.meta.llama3-2-3b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC,
  'us.meta.llama3-2-11b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'us.meta.llama3-2-90b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'us.meta.llama3-3-70b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC,
  'us.meta.llama4-maverick-17b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'us.meta.llama4-scout-17b-instruct-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  // Mistral
  'mistral.mistral-7b-instruct-v0:2': MODEL_FEATURE.TEXT_DOC,
  'mistral.mixtral-8x7b-instruct-v0:1': MODEL_FEATURE.TEXT_DOC,
  'mistral.mistral-small-2402-v1:0': MODEL_FEATURE.TEXT_ONLY,
  'mistral.mistral-large-2402-v1:0': MODEL_FEATURE.TEXT_DOC,
  'mistral.mistral-large-2407-v1:0': MODEL_FEATURE.TEXT_DOC,
  'us.mistral.pixtral-large-2502-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  'eu.mistral.pixtral-large-2502-v1:0': MODEL_FEATURE.TEXT_DOC_IMAGE,
  // Cohere
  'cohere.command-r-v1:0': MODEL_FEATURE.TEXT_DOC,
  'cohere.command-r-plus-v1:0': MODEL_FEATURE.TEXT_DOC,
  // DeepSeek
  'us.deepseek.r1-v1:0': MODEL_FEATURE.TEXT_DOC,
  // Writer
  'us.writer.palmyra-x4-v1:0': MODEL_FEATURE.TEXT_DOC,
  'us.writer.palmyra-x5-v1:0': MODEL_FEATURE.TEXT_DOC,

  // === Image ===

  // Stability AI Image Gen
  'stability.stable-diffusion-xl-v1': MODEL_FEATURE.IMAGE_GEN,
  'stability.sd3-large-v1:0': MODEL_FEATURE.IMAGE_GEN,
  'stability.stable-image-core-v1:0': MODEL_FEATURE.IMAGE_GEN,
  'stability.stable-image-core-v1:1': MODEL_FEATURE.IMAGE_GEN,
  'stability.stable-image-ultra-v1:0': MODEL_FEATURE.IMAGE_GEN,
  'stability.stable-image-ultra-v1:1': MODEL_FEATURE.IMAGE_GEN,
  'stability.sd3-5-large-v1:0': MODEL_FEATURE.IMAGE_GEN,
  // Amazon Image Gen
  'amazon.titan-image-generator-v2:0': MODEL_FEATURE.IMAGE_GEN,
  'amazon.titan-image-generator-v1': MODEL_FEATURE.IMAGE_GEN,
  'amazon.nova-canvas-v1:0': MODEL_FEATURE.IMAGE_GEN,

  // === Video ===

  'amazon.nova-reel-v1:0': MODEL_FEATURE.VIDEO_GEN,
  'amazon.nova-reel-v1:1': MODEL_FEATURE.VIDEO_GEN,
  'luma.ray-v2:0': MODEL_FEATURE.VIDEO_GEN,

  // === Embedding ===

  // Amazon
  'amazon.titan-embed-text-v1': MODEL_FEATURE.EMBEDDING,
  'amazon.titan-embed-image-v1': MODEL_FEATURE.EMBEDDING,
  'amazon.titan-embed-text-v2:0': MODEL_FEATURE.EMBEDDING,
  // Cohere
  'cohere.embed-english-v3': MODEL_FEATURE.EMBEDDING,
  'cohere.embed-multilingual-v3': MODEL_FEATURE.EMBEDDING,

  // === Reranking ===

  // Amazon
  'amazon.rerank-v1:0': MODEL_FEATURE.RERANKING,
  // Cohere
  'cohere.rerank-v3-5:0': MODEL_FEATURE.RERANKING,

  // === Speech to Speech ===

  // Amazon
  'amazon.nova-sonic-v1:0': MODEL_FEATURE.SPEECH_TO_SPEECH,
};

export const BEDROCK_TEXT_MODELS = Object.keys(modelFeatureFlags).filter(
  (model) => modelFeatureFlags[model].text
);
export const BEDROCK_IMAGE_GEN_MODELS = Object.keys(modelFeatureFlags).filter(
  (model) => modelFeatureFlags[model].image_gen
);
export const BEDROCK_VIDEO_GEN_MODELS = Object.keys(modelFeatureFlags).filter(
  (model) => modelFeatureFlags[model].video_gen
);
export const BEDROCK_EMBEDDING_MODELS = Object.keys(modelFeatureFlags).filter(
  (model) => modelFeatureFlags[model].embedding
);
export const BEDROCK_RERANKING_MODELS = Object.keys(modelFeatureFlags).filter(
  (model) => modelFeatureFlags[model].reranking
);
export const BEDROCK_SPEECH_TO_SPEECH_MODELS = Object.keys(
  modelFeatureFlags
).filter((model) => modelFeatureFlags[model].speechToSpeech);

// Prompt caching
// https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
export const SUPPORTED_CACHE_FIELDS: Record<string, PromptCacheField[]> = {
  'anthropic.claude-3-7-sonnet-20250219-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-3-5-haiku-20241022-v1:0': ['messages', 'system', 'tools'],
  'amazon.nova-pro-v1:0': ['messages', 'system'],
  'amazon.nova-lite-v1:0': ['messages', 'system'],
  'amazon.nova-micro-v1:0': ['messages', 'system'],
};
