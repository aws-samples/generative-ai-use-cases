import {
  BEDROCK_IMAGE_GEN_MODELS as IMAGE_MODEL_IDS,
  BEDROCK_TEXT_MODELS,
  BEDROCK_VIDEO_GEN_MODELS as VIDEO_MODEL_IDS,
  modelMetadata,
  withPrefixes,
} from '@generative-ai-use-cases/common';
import {
  BEDROCK_IMAGE_GEN_MODELS,
  BEDROCK_TEXT_GEN_MODELS,
  BEDROCK_VIDEO_GEN_MODELS,
} from '../../../lambda/utils/models';

// Text request builders are derived from modelMetadata, so each text model
// needs its defaultParams there. Image and video builders are written here
// separately, so their lists must match modelMetadata.
describe('model registries', () => {
  const sorted = (ids: string[]) => [...ids].sort();

  it('gives every text model its defaultParams and a request builder', () => {
    const missing = BEDROCK_TEXT_MODELS.filter(
      (modelId) => !modelMetadata[modelId].defaultParams
    );
    expect(missing).toEqual([]);
    expect(sorted(Object.keys(BEDROCK_TEXT_GEN_MODELS))).toEqual(
      sorted(BEDROCK_TEXT_MODELS)
    );
  });

  it('defines a request builder for every image and video model', () => {
    expect(sorted(Object.keys(BEDROCK_IMAGE_GEN_MODELS))).toEqual(
      sorted(IMAGE_MODEL_IDS)
    );
    expect(sorted(Object.keys(BEDROCK_VIDEO_GEN_MODELS))).toEqual(
      sorted(VIDEO_MODEL_IDS)
    );
  });
});

describe('withPrefixes', () => {
  it("uses '' for the plain model ID and copies the value per key", () => {
    const entries = withPrefixes('amazon.nova-pro-v1:0', ['', 'us'], {
      maxTokens: 1,
    });
    expect(Object.keys(entries)).toEqual([
      'amazon.nova-pro-v1:0',
      'us.amazon.nova-pro-v1:0',
    ]);
    expect(entries['amazon.nova-pro-v1:0']).not.toBe(
      entries['us.amazon.nova-pro-v1:0']
    );
  });
});
