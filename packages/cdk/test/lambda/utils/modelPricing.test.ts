import {
  costOf,
  priceOf,
  resetConfiguredRegions,
} from '../../../lambda/utils/modelPricing';
import { MODEL_PRICING } from '../../../lambda/utils/modelPricing.generated';

const opus = (region: string) => MODEL_PRICING[region]['Claude Opus 5.5'];

beforeEach(() => {
  process.env.MODEL_REGION = 'us-east-1';
  process.env.MODEL_IDS = JSON.stringify([
    { modelId: 'jp.anthropic.claude-opus-5-5', region: 'ap-northeast-1' },
    { modelId: 'global.anthropic.claude-opus-5-5', region: 'us-east-1' },
  ]);
  resetConfiguredRegions();
});

describe('priceOf', () => {
  test('uses the global price for a global inference profile', () => {
    expect(priceOf('global.anthropic.claude-opus-5-5')).toEqual(
      opus('us-east-1').global
    );
  });

  test('uses the regional price of the Region the model is called in', () => {
    expect(priceOf('jp.anthropic.claude-opus-5-5')).toEqual(
      opus('ap-northeast-1').regional
    );
  });

  test('falls back to modelRegion for models not in MODEL_IDS', () => {
    expect(priceOf('us.anthropic.claude-opus-5-5')).toEqual(
      opus('us-east-1').regional
    );
  });

  test('has no price for unknown models', () => {
    expect(priceOf('unknown.model')).toBe(undefined);
  });
});

test('costOf adds every token kind', () => {
  expect(
    costOf(
      {
        inputPer1k: 0.003,
        outputPer1k: 0.015,
        cacheReadPer1k: 0.0003,
        cacheWritePer1k: 0.00375,
      },
      {
        inputTokens: 1000,
        outputTokens: 2000,
        cacheReadInputTokens: 10000,
        cacheWriteInputTokens: 1000,
      }
    )
  ).toBeCloseTo(0.003 + 0.03 + 0.003 + 0.00375, 10);
});
