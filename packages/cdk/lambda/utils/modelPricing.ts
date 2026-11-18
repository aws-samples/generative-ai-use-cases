import { ModelConfiguration, ModelPrice } from 'generative-ai-use-cases';
import { modelMetadata } from '@generative-ai-use-cases/common';
import { MODEL_PRICING, MODEL_PRICING_DATE } from './modelPricing.generated';

export { MODEL_PRICING_DATE };

/** Region each configured model is called in (the first, if several). */
const configuredRegions = (): Map<string, string> => {
  const regions = new Map<string, string>();
  const models = JSON.parse(
    process.env.MODEL_IDS || '[]'
  ) as ModelConfiguration[];
  for (const model of models) {
    const id = model.modelId?.trim();
    if (id && !regions.has(id)) regions.set(id, model.region?.trim() ?? '');
  }
  return regions;
};

let regions: Map<string, string> | undefined;

/**
 * List price of a model as GenU calls it: the Region it is configured in, and
 * the global price for `global.` inference profiles. Undefined when the price
 * list has no price for it.
 */
export const priceOf = (modelId: string): ModelPrice | undefined => {
  regions ??= configuredRegions();
  const region = regions.get(modelId) || process.env.MODEL_REGION || '';
  const name = modelMetadata[modelId]?.displayName;
  if (!name) return undefined;
  const prices = MODEL_PRICING[region]?.[name];
  return modelId.startsWith('global.') ? prices?.global : prices?.regional;
};

export const costOf = (
  price: ModelPrice,
  tokens: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheWriteInputTokens: number;
  }
): number =>
  (tokens.inputTokens * price.inputPer1k +
    tokens.outputTokens * price.outputPer1k +
    tokens.cacheReadInputTokens * (price.cacheReadPer1k ?? 0) +
    tokens.cacheWriteInputTokens * (price.cacheWritePer1k ?? 0)) /
  1000;

/** Only for tests: forget the configured regions read from the env. */
export const resetConfiguredRegions = (): void => {
  regions = undefined;
};
