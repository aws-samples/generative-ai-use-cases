import {
  BedrockImageGenerationResponse,
  GenerateImageParams,
  GenerateVideoParams,
  Model,
  ModelConfiguration,
  StableDiffusionParams,
  UnrecordedMessage,
  ConverseInferenceParams,
  UsecaseConverseInferenceParams,
  GuardrailConverseConfigParams,
  GuardrailConverseStreamConfigParams,
  StabilityAI2024ModelParams,
  StabilityAI2024ModelResponse,
  AmazonGeneralImageParams,
  AmazonAdvancedImageParams,
  StreamingChunk,
  Metadata,
} from 'generative-ai-use-cases';
import {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamOutput,
  ConversationRole,
  ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import {
  BEDROCK_TEXT_MODELS,
  convertTextDocumentToUtf8,
  modelMetadata,
} from '@generative-ai-use-cases/common';
import {
  applyAutoCacheToMessages,
  applyAutoCacheToSystem,
} from './promptCache';
import { getFormatFromMimeType, getMimeTypeFromFileName } from './media';
import { createUniqueDocumentNamer } from './fileNameUtils';

// Default Models

const modelIds: ModelConfiguration[] = (
  JSON.parse(process.env.MODEL_IDS || '[]') as ModelConfiguration[]
)
  .map((model) => ({
    modelId: model.modelId.trim(),
    region: model.region.trim(),
  }))
  .filter((model) => model.modelId);
// If there is a lightweight model among the available models, prioritize the lightweight model.
const lightWeightModelIds = modelIds.filter(
  (model: ModelConfiguration) => modelMetadata[model.modelId].flags.light
);
const defaultModelConfiguration = lightWeightModelIds[0] || modelIds[0];
export const defaultModel: Model = {
  type: 'bedrock',
  modelId: defaultModelConfiguration?.modelId ?? '',
  region: defaultModelConfiguration?.region ?? '',
};

const imageGenerationModels: ModelConfiguration[] = (
  JSON.parse(
    process.env.IMAGE_GENERATION_MODEL_IDS || '[]'
  ) as ModelConfiguration[]
)
  .map(
    (model: ModelConfiguration): ModelConfiguration => ({
      modelId: model.modelId.trim(),
      region: model.region.trim(),
    })
  )
  .filter((model) => model.modelId);
export const defaultImageGenerationModel: Model = {
  type: 'bedrock',
  modelId: imageGenerationModels?.[0]?.modelId ?? '',
  region: imageGenerationModels?.[0]?.region ?? '',
};

const videoGenerationModels: ModelConfiguration[] = (
  JSON.parse(
    process.env.VIDEO_GENERATION_MODEL_IDS || '[]'
  ) as ModelConfiguration[]
)
  .map(
    (model: ModelConfiguration): ModelConfiguration => ({
      modelId: model.modelId.trim(),
      region: model.region.trim(),
    })
  )
  .filter((model) => model.modelId);
export const defaultVideoGenerationModel: Model = {
  type: 'bedrock',
  modelId: videoGenerationModels?.[0]?.modelId ?? '',
  region: videoGenerationModels?.[0]?.region ?? '',
};

const USECASE_DEFAULT_PARAMS: UsecaseConverseInferenceParams = {
  '/chat': {
    promptCachingConfig: {
      autoCacheFields: {
        system: true,
        messages: true,
      },
    },
  },
  '/rag': {
    inferenceConfig: {
      temperature: 0.0,
    },
    promptCachingConfig: {
      autoCacheFields: {
        system: false,
      },
    },
  },
  '/diagram': {
    promptCachingConfig: {
      autoCacheFields: {
        system: true,
      },
    },
  },
  '/meeting-minutes': {
    promptCachingConfig: {
      autoCacheFields: {
        system: true,
        messages: true,
      },
    },
  },
  '/use-case-builder': {
    promptCachingConfig: {
      autoCacheFields: {
        messages: false,
      },
    },
  },
  '/title': {
    promptCachingConfig: {
      autoCacheFields: {
        system: false,
        messages: false,
      },
    },
  },
};

// Guardrail Settings
const createGuardrailConfig = (): GuardrailConverseConfigParams | undefined => {
  if (
    process.env.GUARDRAIL_IDENTIFIER !== undefined &&
    process.env.GUARDRAIL_VERSION !== undefined
  ) {
    return {
      guardrailIdentifier: process.env.GUARDRAIL_IDENTIFIER,
      guardrailVersion: process.env.GUARDRAIL_VERSION,
      // Outputs become heavy and there is no way to check the trace on the app side, so disabled is hard-coded
      trace: 'disabled',
    };
  }
  return undefined;
};

const createGuardrailStreamConfig = ():
  | GuardrailConverseStreamConfigParams
  | undefined => {
  const baseConfig = createGuardrailConfig();
  if (baseConfig) {
    return {
      ...baseConfig,
      // Although there is a possibility that a bad output will occur when using asynchronous processing,
      // since it has never occurred even with bad inputs (i.e., stopping at the input point),
      // use asynchronous processing to improve the experience.
      // https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-streaming.html
      streamProcessingMode: 'async',
    };
  }
  return undefined;
};

// ID conversion rules
const idTransformationRules = [
  // Chat history -> Chat
  { pattern: /^\/chat\/.+/, replacement: '/chat' },
  // Use case builder (/new and /execute/*)
  {
    pattern: /^\/use-case-builder\/.+/,
    replacement: '/use-case-builder',
  },
];

// ID conversion
function normalizeId(id: string): string {
  if (!id) return id;
  const rule = idTransformationRules.find((rule) => id.match(rule.pattern));
  const ret = rule ? rule.replacement : id;
  return ret;
}

const mergeConverseInferenceParams = (
  a: ConverseInferenceParams,
  b: ConverseInferenceParams
) =>
  ({
    inferenceConfig: {
      ...a.inferenceConfig,
      ...b.inferenceConfig,
    },
    promptCachingConfig: {
      autoCacheFields: {
        ...a.promptCachingConfig?.autoCacheFields,
        ...b.promptCachingConfig?.autoCacheFields,
      },
    },
  }) as ConverseInferenceParams;

// API call, extract string from output, etc.

// Bedrock rejects a text block that is empty or only whitespace, in any turn
// and in the system prompt (#1685). Such text reaches here from a reply
// stopped before its first character, a retry, an edited message or an empty
// system prompt, and once saved it breaks every later request of that chat.
// Dropping the block is not enough: a turn with a document must also have
// text. So a blank turn gets a short placeholder, and a blank system prompt
// is left out.
const isBlank = (text: string) => text.trim() === '';
const BLANK_TEXT_PLACEHOLDER = {
  user: '(no text)',
  assistant: '(no response)',
} as const;

const createConverseCommandInput = (
  messages: UnrecordedMessage[],
  id: string,
  model: Model,
  defaultConverseInferenceParams: ConverseInferenceParams,
  usecaseConverseInferenceParams: UsecaseConverseInferenceParams
) => {
  // Set the string passed in the system role to the system prompt
  const system = messages.find((message) => message.role === 'system');
  const systemContext =
    system && !isBlank(system.content) ? [{ text: system.content }] : [];

  // Add the string of user role and assistant role other than the system role to the conversation
  messages = messages.filter((message) => message.role !== 'system');
  // Document names must be unique across the whole request, past turns included
  const toDocumentName = createUniqueDocumentNamer();
  const conversation = messages.map((message) => {
    const contentBlocks: ContentBlock[] = [];

    // Put images, videos, and documents before the task, instruction, and user query
    if (message.extraData) {
      message.extraData.forEach((extra) => {
        // Prior to v4.2.4, 'extra.source.mediaType' could be empty.
        // For resumed conversations from older versions, we fallback to detecting mimeType based on the extension.
        const mimeType =
          extra.source.mediaType || getMimeTypeFromFileName(extra.name);
        const format = getFormatFromMimeType(mimeType);

        if (extra.type === 'image' && extra.source.type === 'base64') {
          contentBlocks.push({
            image: {
              format,
              source: {
                bytes: Buffer.from(extra.source.data, 'base64'),
              },
            },
          } as ContentBlock.ImageMember);
        } else if (extra.type === 'file' && extra.source.type === 'base64') {
          contentBlocks.push({
            document: {
              format,
              name: toDocumentName(extra.name),
              source: {
                bytes: convertTextDocumentToUtf8(
                  Buffer.from(extra.source.data, 'base64'),
                  format
                ),
              },
            },
          } as ContentBlock.DocumentMember);
        } else if (extra.type === 'video' && extra.source.type === 'base64') {
          contentBlocks.push({
            video: {
              format,
              source: {
                bytes: Buffer.from(extra.source.data, 'base64'),
              },
            },
          } as ContentBlock.VideoMember);
        } else if (extra.type === 'video' && extra.source.type === 's3') {
          contentBlocks.push({
            video: {
              format,
              source: {
                s3Location: {
                  uri: extra.source.data,
                },
              },
            },
          } as ContentBlock.VideoMember);
        }
      });
    }

    contentBlocks.push({
      text: isBlank(message.content)
        ? BLANK_TEXT_PLACEHOLDER[message.role === 'user' ? 'user' : 'assistant']
        : message.content,
    });
    return {
      role:
        message.role === 'user'
          ? ConversationRole.USER
          : ConversationRole.ASSISTANT,
      content: contentBlocks,
    };
  });

  // Merge model's default params with use-case specific ones
  const usecaseParams = usecaseConverseInferenceParams[normalizeId(id)] || {};
  const params = mergeConverseInferenceParams(
    defaultConverseInferenceParams,
    usecaseParams
  );

  // Apply prompt caching
  const autoCacheFields = params.promptCachingConfig?.autoCacheFields || {};
  const conversationWithCache = autoCacheFields['messages']
    ? applyAutoCacheToMessages(conversation, model.modelId)
    : conversation;
  const systemContextWithCache = autoCacheFields['system']
    ? applyAutoCacheToSystem(systemContext, model.modelId)
    : systemContext;

  const guardrailConfig = createGuardrailConfig();

  const converseCommandInput: ConverseCommandInput = {
    modelId: model.modelId,
    messages: conversationWithCache,
    system: systemContextWithCache,
    inferenceConfig: modelMetadata[model.modelId].flags.noSamplingParams
      ? { maxTokens: params.inferenceConfig?.maxTokens }
      : params.inferenceConfig,
    guardrailConfig,
  };

  if (
    modelMetadata[model.modelId].flags.reasoning &&
    (model.modelParameters?.reasoningConfig?.type === 'enabled' ||
      model.modelParameters?.reasoningConfig?.type === 'adaptive')
  ) {
    const noSampling = modelMetadata[model.modelId].flags.noSamplingParams;
    converseCommandInput.inferenceConfig = {
      ...params.inferenceConfig,
      temperature: noSampling ? undefined : 1, // reasoning requires temperature to be 1, but some models don't support it
      topP: undefined, // reasoning does not require topP
      maxTokens: params.inferenceConfig?.maxTokens,
    };

    if (model.modelParameters?.reasoningConfig?.type === 'adaptive') {
      // Adaptive thinking (Claude Opus 4.6+)
      // https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html
      converseCommandInput.additionalModelRequestFields = {
        // Opus 4.7+ and the 5.x models return no thinking text without display
        thinking: { type: 'adaptive', display: 'summarized' },
        output_config: {
          effort: model.modelParameters?.reasoningConfig?.effort || 'high',
        },
      };
    } else {
      // Extended thinking (legacy: Claude 3.7 Sonnet, Claude 4/4.1/4.5)
      converseCommandInput.additionalModelRequestFields = {
        reasoning_config: {
          type: model.modelParameters?.reasoningConfig?.type,
          budget_tokens:
            model.modelParameters?.reasoningConfig?.budgetTokens || 0,
        },
      };
    }
  }

  return converseCommandInput;
};

// Function for models that do not support system prompts
// - Amazon Titan model (amazon.titan-text-premier-v1:0)
// - Mistral AI Instruct (mistral.mixtral-8x7b-instruct-v0:1, mistral.mistral-7b-instruct-v0:2)
// https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html#conversation-inference-supported-models-features
const createConverseCommandInputWithoutSystemContext = (
  messages: UnrecordedMessage[],
  id: string,
  model: Model,
  defaultConverseInferenceParams: ConverseInferenceParams,
  usecaseConverseInferenceParams: UsecaseConverseInferenceParams
) => {
  // Since system is not available, system is also included as user.
  // Copy the first turn instead of editing it, so the caller's messages stay
  // unchanged, and add nothing when there is no system prompt.
  const system = messages.find((message) => message.role === 'system');
  messages = messages.filter((message) => message.role !== 'system');
  if (system && messages.length > 0 && messages[0].role === 'user') {
    messages = [
      { ...messages[0], content: system.content + messages[0].content },
      ...messages.slice(1),
    ];
  }

  return createConverseCommandInput(
    messages,
    id,
    model,
    defaultConverseInferenceParams,
    usecaseConverseInferenceParams
  );
};

// ConverseStreamCommandInput has the same structure as ConverseCommandInput, so the input created by "createConverseCommandInput" can be used as is.
const createConverseStreamCommandInput = (
  messages: UnrecordedMessage[],
  id: string,
  model: Model,
  defaultParams: ConverseInferenceParams,
  usecaseParams: UsecaseConverseInferenceParams
): ConverseStreamCommandInput => {
  const converseCommandInput = createConverseCommandInput(
    messages,
    id,
    model,
    defaultParams,
    usecaseParams
  );
  const guardrailStreamConfig = createGuardrailStreamConfig();
  return {
    ...converseCommandInput,
    guardrailStreamConfig,
  } as ConverseStreamCommandInput;
};

// Function for models that do not support system prompts
// - Amazon Titan model (amazon.titan-text-premier-v1:0)
// - Mistral AI Instruct (mistral.mixtral-8x7b-instruct-v0:1, mistral.mistral-7b-instruct-v0:2)
// https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html#conversation-inference-supported-models-features
const createConverseStreamCommandInputWithoutSystemContext = (
  messages: UnrecordedMessage[],
  id: string,
  model: Model,
  defaultParams: ConverseInferenceParams,
  usecaseParams: UsecaseConverseInferenceParams
): ConverseStreamCommandInput => {
  const converseCommandInput = createConverseCommandInputWithoutSystemContext(
    messages,
    id,
    model,
    defaultParams,
    usecaseParams
  );
  const guardrailStreamConfig = createGuardrailStreamConfig();
  return {
    ...converseCommandInput,
    guardrailStreamConfig,
  } as ConverseStreamCommandInput;
};

const extractConverseOutput = (
  output: ConverseCommandOutput
): StreamingChunk => {
  if (output.output && output.output.message && output.output.message.content) {
    // output.message.content is an array, but usually only one element is returned, so join is not necessary.
    // However, to implement on the safe side, join is implemented so that it works even if an array with multiple elements comes.
    const responseText = output.output.message.content
      .map((block) => block.text)
      .join('\n');
    const reasoningText = output.output.message.content
      .map((block) => {
        if (block.reasoningContent) {
          return block.reasoningContent.reasoningText?.text;
        }
        return '';
      })
      .join('\n');
    const metadata = {
      usage: output.usage,
    } as Metadata;
    return { text: responseText, trace: reasoningText, metadata };
  }

  return { text: '', trace: '' };
};

const extractConverseStreamOutput = (
  output: ConverseStreamOutput
): StreamingChunk => {
  if (output.contentBlockDelta && output.contentBlockDelta.delta?.text) {
    return { text: output.contentBlockDelta.delta?.text };
  } else if (
    output.contentBlockDelta &&
    output.contentBlockDelta.delta?.reasoningContent
  ) {
    const reasoningText =
      output.contentBlockDelta.delta?.reasoningContent?.text;
    return { text: '', trace: reasoningText };
  } else if (output.metadata && output.metadata.usage) {
    return {
      text: '',
      metadata: { usage: output.metadata.usage } as Metadata,
    };
  }

  return { text: '', trace: '' };
};

const createBodyImageStableDiffusion = (params: GenerateImageParams) => {
  let body: StableDiffusionParams = {
    text_prompts: params.textPrompt,
    cfg_scale: params.cfgScale,
    style_preset: params.stylePreset,
    seed: params.seed,
    steps: params.step,
    image_strength: params.maskImage ? 0 : params.imageStrength, // When inpainting/outpainting, 0 or above is bad
    height: params.height,
    width: params.width,
  };
  if (params.initImage && params.maskImage === undefined) {
    // Image to Image
    body = {
      ...body,
      init_image: params.initImage,
    };
  } else if (params.initImage && params.maskImage) {
    // Image to Image (Masking)
    body = {
      ...body,
      init_image: params.initImage,
      mask_image: params.maskImage,
      mask_source:
        params.taskType === 'INPAINTING'
          ? 'MASK_IMAGE_BLACK'
          : 'MASK_IMAGE_WHITE',
    };
  }
  return JSON.stringify(body);
};

const createBodyImageStabilityAI2024Model = (params: GenerateImageParams) => {
  let positivePrompt: string = '';
  let negativePrompt: string | undefined;
  params.textPrompt.forEach((prompt) => {
    if (prompt.weight >= 0) {
      positivePrompt = prompt.text;
    } else {
      negativePrompt = prompt.text;
    }
  });
  if (!positivePrompt) {
    throw new Error('Positive prompt is required');
  }
  let body: StabilityAI2024ModelParams = {
    prompt: positivePrompt,
    seed: params.seed,
    output_format: 'png',
  };
  if (params.stylePreset) {
    body.prompt = body.prompt + ', ' + params.stylePreset;
  }

  // When in image-to-image mode, aspect ratio cannot be used
  if (params.aspectRatio && !params.initImage) {
    body = {
      ...body,
      aspect_ratio: params.aspectRatio,
    };
  }
  if (negativePrompt) {
    body = {
      ...body,
      negative_prompt: negativePrompt,
    };
  }

  // Image to Image
  if (params.initImage) {
    body = {
      ...body,
      image: params.initImage,
      mode: 'image-to-image',
      strength: params.imageStrength,
    };
  }
  return JSON.stringify(body);
};

const createBodyImageAmazonGeneralImage = (params: GenerateImageParams) => {
  // TODO: Support inpainting and outpainting too
  const imageGenerationConfig = {
    numberOfImages: 1,
    quality: 'standard',
    height: params.height,
    width: params.width,
    cfgScale: params.cfgScale,
    seed: params.seed % 214783648, // max for titan image
  };
  let body: Partial<AmazonGeneralImageParams> = {};
  if (params.initImage && params.taskType === undefined) {
    body = {
      taskType: 'IMAGE_VARIATION',
      imageVariationParams: {
        text:
          (params.textPrompt.find((x) => x.weight > 0)?.text || '') +
          ', ' +
          params.stylePreset,
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
        images: [params.initImage],
        similarityStrength: Math.max(params.imageStrength || 0.2, 0.2), // Min 0.2
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  } else if (params.initImage && params.taskType === 'INPAINTING') {
    body = {
      taskType: 'INPAINTING',
      inPaintingParams: {
        text:
          (params.textPrompt.find((x) => x.weight > 0)?.text || '') +
          ', ' +
          params.stylePreset,
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
        image: params.initImage,
        maskImage: params.maskImage,
        maskPrompt: params.maskPrompt,
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  } else if (params.initImage && params.taskType === 'OUTPAINTING') {
    body = {
      taskType: 'OUTPAINTING',
      outPaintingParams: {
        text:
          (params.textPrompt.find((x) => x.weight > 0)?.text || '') +
          ', ' +
          params.stylePreset,
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
        image: params.initImage,
        maskImage: params.maskImage,
        maskPrompt: params.maskPrompt,
        outPaintingMode: 'DEFAULT',
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  } else {
    body = {
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text:
          (params.textPrompt.find((x) => x.weight > 0)?.text || '') +
          ', ' +
          params.stylePreset,
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  }
  return JSON.stringify(body);
};

const createBodyImageAmazonAdvancedImage = (params: GenerateImageParams) => {
  const baseBody = JSON.parse(createBodyImageAmazonGeneralImage(params));
  let body: Partial<AmazonAdvancedImageParams> = {
    ...baseBody,
  };

  if (params.taskType === 'COLOR_GUIDED_GENERATION') {
    body = {
      taskType: 'COLOR_GUIDED_GENERATION',
      colorGuidedGenerationParams: {
        text: params.textPrompt.find((x) => x.weight > 0)?.text || '',
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
        referenceImage: params.initImage,
        colors: params.colors!,
      },
      imageGenerationConfig: body.imageGenerationConfig,
    };
  } else if (params.taskType === 'BACKGROUND_REMOVAL') {
    body = {
      taskType: 'BACKGROUND_REMOVAL',
      backgroundRemovalParams: {
        image: params.initImage!,
      },
    };
  } else if (body.textToImageParams) {
    // Extension of TEXT_IMAGE task type (Image Conditioning)
    body.textToImageParams = {
      ...body.textToImageParams,
      conditionImage: params.initImage,
      controlMode: params.controlMode,
      controlStrength: params.controlStrength,
    };
  }
  return JSON.stringify(body);
};

const extractOutputImageStableDiffusion = (
  response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse
) => {
  if ('result' in response) {
    // BedrockImageGenerationResponse
    if (response.result !== 'success') {
      throw new Error('Failed to invoke model');
    }
    return response.artifacts[0].base64;
  } else {
    // StabilityAI2024ModelResponse
    throw new Error('Unexpected response type for Stable Diffusion');
  }
};

const extractOutputImageStabilityAI2024Model = (
  response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse
) => {
  if ('finish_reasons' in response) {
    // StabilityAI2024ModelResponse
    if (response.finish_reasons[0] !== null) {
      if (response.finish_reasons[0] == 'Filter reason: prompt') {
        throw new Error(
          response.finish_reasons[0] + ': Japanese prompts are not supported'
        );
      }
      throw new Error(response.finish_reasons[0]);
    }
    return response.images[0];
  } else {
    // BedrockImageGenerationResponse
    throw new Error('Unexpected response type for Stability AI 2024 Model');
  }
};

const extractOutputImageAmazonImage = (
  response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse
) => {
  if ('images' in response) {
    return response.images[0];
  } else {
    throw new Error('Unexpected response type for Amazon Image');
  }
};

const createBodyVideoNovaReel = (params: GenerateVideoParams) => {
  return {
    taskType: 'TEXT_VIDEO',
    textToVideoParams: {
      text: params.prompt,
      images: params.images,
    },
    videoGenerationConfig: {
      durationSeconds: params.durationSeconds,
      fps: params.fps,
      dimension: params.dimension,
      seed: params.seed,
    },
  };
};

const createBodyVideoNovaReelV11 = (params: GenerateVideoParams) => {
  if (params.taskType === 'TEXT_VIDEO') {
    return {
      taskType: 'TEXT_VIDEO',
      textToVideoParams: {
        text: params.prompt,
        images: params.images,
      },
      videoGenerationConfig: {
        durationSeconds: params.durationSeconds,
        fps: params.fps,
        dimension: params.dimension,
        seed: params.seed,
      },
    };
  } else if (params.taskType === 'MULTI_SHOT_AUTOMATED') {
    return {
      taskType: 'MULTI_SHOT_AUTOMATED',
      multiShotAutomatedParams: {
        text: params.prompt,
      },
      videoGenerationConfig: {
        durationSeconds: params.durationSeconds,
        fps: params.fps,
        dimension: params.dimension,
        seed: params.seed,
      },
    };
  } else if (params.taskType === 'MULTI_SHOT_MANUAL') {
    throw new Error('Not implemented yet');
  } else {
    throw new Error(`Unknown task type ${params.taskType}`);
  }
};

const createBodyVideoLumaRayV2 = (params: GenerateVideoParams) => {
  return {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio,
    loop: params.loop,
    duration: `${params.durationSeconds}s`,
    resolution: params.resolution,
  };
};

// Definition of parameters and functions for each model related to text generation

// The request builders for one text model. Everything model-specific comes
// from modelMetadata (common): defaultParams, and flags such as
// noSystemPrompt and noSamplingParams that createConverseCommandInput reads.
type TextGenModelConfig = {
  defaultParams: ConverseInferenceParams;
  usecaseParams: UsecaseConverseInferenceParams;
  createConverseCommandInput: (
    messages: UnrecordedMessage[],
    id: string,
    model: Model,
    defaultParams: ConverseInferenceParams,
    usecaseParams: UsecaseConverseInferenceParams
  ) => ConverseCommandInput;
  createConverseStreamCommandInput: (
    messages: UnrecordedMessage[],
    id: string,
    model: Model,
    defaultParams: ConverseInferenceParams,
    usecaseParams: UsecaseConverseInferenceParams
  ) => ConverseStreamCommandInput;
  extractConverseOutput: (body: ConverseCommandOutput) => StreamingChunk;
  extractConverseStreamOutput: (body: ConverseStreamOutput) => StreamingChunk;
};

const textGenModelConfig = (modelId: string): TextGenModelConfig => {
  const { flags, defaultParams } = modelMetadata[modelId];
  if (!defaultParams) {
    throw new Error(
      `Text model ${modelId} has no defaultParams in modelMetadata`
    );
  }
  return flags.noSystemPrompt
    ? {
        defaultParams,
        usecaseParams: USECASE_DEFAULT_PARAMS,
        createConverseCommandInput:
          createConverseCommandInputWithoutSystemContext,
        createConverseStreamCommandInput:
          createConverseStreamCommandInputWithoutSystemContext,
        extractConverseOutput,
        extractConverseStreamOutput,
      }
    : {
        defaultParams,
        usecaseParams: USECASE_DEFAULT_PARAMS,
        createConverseCommandInput,
        createConverseStreamCommandInput,
        extractConverseOutput,
        extractConverseStreamOutput,
      };
};

export const BEDROCK_TEXT_GEN_MODELS: Record<string, TextGenModelConfig> =
  Object.fromEntries(
    BEDROCK_TEXT_MODELS.map((modelId) => [modelId, textGenModelConfig(modelId)])
  );

// Definition of parameters and functions for each image generation model

export const BEDROCK_IMAGE_GEN_MODELS: {
  [key: string]: {
    createBodyImage: (params: GenerateImageParams) => string;
    extractOutputImage: (
      response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse
    ) => string;
  };
} = {
  'stability.stable-diffusion-xl-v1': {
    createBodyImage: createBodyImageStableDiffusion,
    extractOutputImage: extractOutputImageStableDiffusion,
  },
  'stability.stable-image-core-v1:1': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'stability.stable-image-ultra-v1:1': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'stability.sd3-5-large-v1:0': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'amazon.titan-image-generator-v1': {
    createBodyImage: createBodyImageAmazonGeneralImage,
    extractOutputImage: extractOutputImageAmazonImage,
  },
  'amazon.titan-image-generator-v2:0': {
    createBodyImage: createBodyImageAmazonAdvancedImage,
    extractOutputImage: extractOutputImageAmazonImage,
  },
  'amazon.nova-canvas-v1:0': {
    createBodyImage: createBodyImageAmazonAdvancedImage,
    extractOutputImage: extractOutputImageAmazonImage,
  },
};

export const BEDROCK_VIDEO_GEN_MODELS: {
  [key: string]: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createBodyVideo: (params: GenerateVideoParams) => any;
  };
} = {
  'amazon.nova-reel-v1:0': {
    createBodyVideo: createBodyVideoNovaReel,
  },
  'amazon.nova-reel-v1:1': {
    createBodyVideo: createBodyVideoNovaReelV11,
  },
  'luma.ray-v2:0': {
    createBodyVideo: createBodyVideoLumaRayV2,
  },
};
