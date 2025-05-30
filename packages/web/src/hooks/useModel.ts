import { Model, ModelConfiguration } from 'generative-ai-use-cases';
import {
  CRI_PREFIX_PATTERN,
  modelMetadata,
} from '@generative-ai-use-cases/common';

const modelRegion = import.meta.env.VITE_APP_MODEL_REGION;

// Get model names and other environment variables
const bedrockModelConfigs = (
  JSON.parse(import.meta.env.VITE_APP_MODEL_IDS) as ModelConfiguration[]
)
  .map((model) => ({
    modelId: model.modelId.trim(),
    region: model.region.trim(),
  }))
  .filter((model) => model.modelId);
const bedrockModelIds: string[] = bedrockModelConfigs.map(
  (model) => model.modelId
);
const lightModelIds: string[] = bedrockModelConfigs
  .filter((model) => modelMetadata[model.modelId].flags.light)
  .map((model) => model.modelId);
const modelIdsInModelRegion: string[] = bedrockModelConfigs
  .filter((model) => model.region === modelRegion)
  .map((model) => model.modelId);
const duplicateBaseModelIds = new Set(
  bedrockModelIds
    .map((modelId) => modelId.replace(CRI_PREFIX_PATTERN, ''))
    .filter((item, index, arr) => arr.indexOf(item) !== index)
);
const visionModelIds: string[] = bedrockModelIds.filter(
  (modelId) => modelMetadata[modelId].flags.image
);
const visionEnabled: boolean = visionModelIds.length > 0;

const endpointNames: string[] = JSON.parse(
  import.meta.env.VITE_APP_ENDPOINT_NAMES
)
  .map((name: string) => name.trim())
  .filter((name: string) => name);

const imageModelConfigs = (
  JSON.parse(import.meta.env.VITE_APP_IMAGE_MODEL_IDS) as ModelConfiguration[]
)
  .map(
    (model: ModelConfiguration): ModelConfiguration => ({
      modelId: model.modelId.trim(),
      region: model.region.trim(),
    })
  )
  .filter((model) => model.modelId);
const imageGenModelIds: string[] = imageModelConfigs.map(
  (model) => model.modelId
);

const videoModelConfigs = (
  JSON.parse(import.meta.env.VITE_APP_VIDEO_MODEL_IDS) as ModelConfiguration[]
)
  .map(
    (model: ModelConfiguration): ModelConfiguration => ({
      modelId: model.modelId.trim(),
      region: model.region.trim(),
    })
  )
  .filter((model) => model.modelId);
const videoGenModelIds: string[] = videoModelConfigs.map(
  (model) => model.modelId
);
const speechToSpeechModelConfigs = (
  JSON.parse(
    import.meta.env.VITE_APP_SPEECH_TO_SPEECH_MODEL_IDS
  ) as ModelConfiguration[]
)
  .map(
    (model: ModelConfiguration): ModelConfiguration => ({
      modelId: model.modelId.trim(),
      region: model.region.trim(),
    })
  )
  .filter((model) => model.modelId);
const speechToSpeechModelIds: string[] = speechToSpeechModelConfigs.map(
  (model) => model.modelId
);

const agentNames: string[] = JSON.parse(import.meta.env.VITE_APP_AGENT_NAMES)
  .map((name: string) => name.trim())
  .filter((name: string) => name);

const getFlows = () => {
  try {
    return JSON.parse(import.meta.env.VITE_APP_FLOWS);
  } catch (e) {
    return [];
  }
};

const flows = getFlows();

// Define model objects
const textModels = [
  ...bedrockModelConfigs.map(
    (model) =>
      ({
        modelId: model.modelId,
        type: 'bedrock',
        region: model.region,
      }) as Model
  ),
  ...endpointNames.map(
    (name) => ({ modelId: name, type: 'sagemaker' }) as Model
  ),
];
const imageGenModels = [
  ...imageModelConfigs.map(
    (model) =>
      ({
        modelId: model.modelId,
        type: 'bedrock',
        region: model.region,
      }) as Model
  ),
];
const videoGenModels = [
  ...videoModelConfigs.map(
    (model) =>
      ({
        modelId: model.modelId,
        type: 'bedrock',
        region: model.region,
      }) as Model
  ),
];
const speechToSpeechModels = [
  ...speechToSpeechModelConfigs.map(
    (model) =>
      ({
        modelId: model.modelId,
        type: 'bedrock',
        region: model.region,
      }) as Model
  ),
];
const agentModels = [
  ...agentNames.map(
    (name) => ({ modelId: name, type: 'bedrockAgent' }) as Model
  ),
];

export const findModelByModelId = (modelId: string) => {
  const model = [
    ...textModels,
    ...imageGenModels,
    ...videoGenModels,
    ...agentModels,
  ].find((m) => m.modelId === modelId);

  if (model) {
    // deep copy
    return JSON.parse(JSON.stringify(model));
  }

  return undefined;
};

const searchAgent = agentNames.find((name) => name.includes('Search'));

const modelDisplayName = (modelId: string): string => {
  // If there are multiple instances of the same model, add CRI suffix to the display name
  let displayName = modelMetadata[modelId]?.displayName ?? modelId;
  if (duplicateBaseModelIds.has(modelId.replace(CRI_PREFIX_PATTERN, ''))) {
    const criMatch = modelId.match(CRI_PREFIX_PATTERN);
    if (criMatch) {
      displayName += ` (${criMatch[1].toUpperCase()})`;
    }
  }
  return displayName;
};

export const MODELS = {
  modelRegion: modelRegion,
  modelIds: [...bedrockModelIds, ...endpointNames],
  modelIdsInModelRegion,
  modelMetadata,
  modelDisplayName,
  lightModelIds,
  visionModelIds: visionModelIds,
  visionEnabled: visionEnabled,
  imageGenModelIds: imageGenModelIds,
  videoGenModelIds: videoGenModelIds,
  agentNames: agentNames,
  textModels: textModels,
  imageGenModels: imageGenModels,
  videoGenModels: videoGenModels,
  agentModels: agentModels,
  agentEnabled: agentNames.length > 0,
  searchAgent: searchAgent,
  flows,
  flowChatEnabled: flows.length > 0,
  speechToSpeechModelIds: speechToSpeechModelIds,
  speechToSpeechModels: speechToSpeechModels,
};
