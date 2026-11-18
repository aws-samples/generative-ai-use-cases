import { modelMetadata } from '@generative-ai-use-cases/common';
import {
  classify,
  extractPrices,
  normalizeName,
  OfferFile,
  pricePer1k,
} from '../../scripts/model-pricing/extract';
import { ALIASES, countPriced } from '../../scripts/model-pricing/update';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODEL_PRICING } from '../../lambda/utils/modelPricing.generated';

const offer = (
  products: [string, Record<string, string>, string, string][]
): OfferFile => ({
  products: Object.fromEntries(
    products.map(([sku, attributes]) => [sku, { sku, attributes }])
  ),
  terms: {
    OnDemand: Object.fromEntries(
      products.map(([sku, , unit, usd]) => [
        sku,
        {
          [`${sku}.T`]: {
            priceDimensions: {
              [`${sku}.T.D`]: { unit, pricePerUnit: { USD: usd } },
            },
          },
        },
      ])
    ),
  },
});

describe('classify', () => {
  test.each([
    [
      'Input tokens',
      'USE1-MP:USE1_input_tokens_standard-Units',
      'input',
      'regional',
    ],
    [
      'Output tokens',
      'USE1-MP:USE1_output_tokens_global_standard-Units',
      'output',
      'global',
    ],
    [
      'Prompt cache read input tokens',
      'USE1_cache_read_tokens_standard',
      'cacheRead',
      'regional',
    ],
    [
      'Prompt cache write input tokens',
      'USE1_cache_write_tokens_standard',
      'cacheWrite',
      'regional',
    ],
  ])('%s / %s', (inferenceType, usagetype, kind, scope) => {
    expect(classify({ inferenceType, usagetype })).toEqual({
      kind,
      scope,
      mantle: false,
    });
  });

  test.each([
    'USE1_cache_write_tokens_1h_standard',
    'USE1_input_tokens_long_ctx_standard',
    'USE1-InputTokenCount_Batch-Units',
    'USE1-x-input-tokens-flex',
    'USE1-x-input-tokens-priority',
    'USE1-Nova2.0Pro-input-video-token-count-cross-region-global',
    'USE1-ProvisionedThroughput_NoCommit_ModelUnits_Usage-Units',
  ])('drops the alternate tier %s', (usagetype) => {
    expect(classify({ inferenceType: 'Input tokens', usagetype })).toBe(
      undefined
    );
  });
});

describe('pricePer1k', () => {
  test('converts per-1M prices', () => {
    const file = offer([['a', {}, '1M tokens', '5']]);
    expect(pricePer1k(file, 'a')).toBe(0.005);
  });
  test('ignores units it does not know', () => {
    const file = offer([['a', {}, 'Images', '0.04']]);
    expect(pricePer1k(file, 'a')).toBe(undefined);
  });
});

describe('normalizeName', () => {
  test.each([
    ['OpenAI GPT-6 Sol', 'GPT-6 Sol'],
    ['Claude Opus 5.5 (Amazon Bedrock Edition)', 'Claude Opus 5.5'],
    ['Mistral Large (24.02)', 'Mistral Large'],
  ])('%s matches %s', (a, b) => {
    expect(normalizeName(a)).toBe(normalizeName(b));
  });
  test('keeps distinct models apart', () => {
    expect(normalizeName('Command R')).not.toBe(normalizeName('Command R+'));
    expect(normalizeName('Nova Lite')).not.toBe(normalizeName('Nova 2.0 Lite'));
  });
});

describe('extractPrices', () => {
  const input = { inferenceType: 'Input tokens' };
  const output = { inferenceType: 'Output tokens' };

  test('collects regional and global prices per model', () => {
    const { prices } = extractPrices([
      offer([
        [
          '1',
          { ...input, model: 'M', usagetype: 'in_standard' },
          '1K tokens',
          '0.002',
        ],
        [
          '2',
          { ...output, model: 'M', usagetype: 'out_standard' },
          '1K tokens',
          '0.01',
        ],
        [
          '3',
          { ...input, model: 'M', usagetype: 'in_global_standard' },
          '1K tokens',
          '0.0018',
        ],
        [
          '4',
          { ...output, model: 'M', usagetype: 'out_global_standard' },
          '1K tokens',
          '0.009',
        ],
      ]),
    ]);
    expect(prices.get('m')).toEqual({
      regional: { inputPer1k: 0.002, outputPer1k: 0.01 },
      global: { inputPer1k: 0.0018, outputPer1k: 0.009 },
    });
  });

  test('leaves out a model whose SKUs disagree', () => {
    const { prices, conflicts } = extractPrices([
      offer([
        ['1', { ...input, model: 'M', usagetype: 'a' }, '1K tokens', '0.002'],
        ['2', { ...input, model: 'M', usagetype: 'b' }, '1K tokens', '0.003'],
        ['3', { ...output, model: 'M', usagetype: 'c' }, '1K tokens', '0.01'],
      ]),
    ]);
    expect(prices.has('m')).toBe(false);
    expect(conflicts).toEqual(['m']);
  });

  test('uses mantle prices only when there is no runtime price', () => {
    const { prices } = extractPrices([
      offer([
        [
          '1',
          { ...input, model: 'A', usagetype: 'a-mantle-in' },
          '1K tokens',
          '1',
        ],
        [
          '2',
          { ...output, model: 'A', usagetype: 'a-mantle-out' },
          '1K tokens',
          '2',
        ],
        [
          '3',
          { ...input, model: 'B', usagetype: 'b-mantle-in' },
          '1K tokens',
          '1',
        ],
        [
          '4',
          { ...output, model: 'B', usagetype: 'b-mantle-out' },
          '1K tokens',
          '2',
        ],
        ['5', { ...input, model: 'B', usagetype: 'b-in' }, '1K tokens', '3'],
        ['6', { ...output, model: 'B', usagetype: 'b-out' }, '1K tokens', '4'],
      ]),
    ]);
    expect(prices.get('a')?.regional).toEqual({
      inputPer1k: 1,
      outputPer1k: 2,
    });
    expect(prices.get('b')?.regional).toEqual({
      inputPer1k: 3,
      outputPer1k: 4,
    });
  });

  test('names a model by servicename only in the marketplace form', () => {
    const { prices } = extractPrices([
      offer([
        [
          '1',
          { ...input, servicename: 'Amazon Bedrock', usagetype: 'x' },
          '1K tokens',
          '1',
        ],
        [
          '2',
          { ...output, servicename: 'Amazon Bedrock', usagetype: 'y' },
          '1K tokens',
          '2',
        ],
        [
          '3',
          {
            ...input,
            servicename: 'Foo (Amazon Bedrock Edition)',
            usagetype: 'x',
          },
          '1K tokens',
          '1',
        ],
        [
          '4',
          {
            ...output,
            servicename: 'Foo (Amazon Bedrock Edition)',
            usagetype: 'y',
          },
          '1K tokens',
          '2',
        ],
      ]),
    ]);
    expect([...prices.keys()]).toEqual(['foo']);
  });
});

describe('modelPricing.generated', () => {
  test('prices the common models in us-east-1', () => {
    const usEast1 = MODEL_PRICING['us-east-1'];
    expect(Object.keys(usEast1).length).toBeGreaterThan(50);
    expect(usEast1['Claude 3.5 Haiku'].regional).toMatchObject({
      inputPer1k: 0.0008,
      outputPer1k: 0.004,
    });
    expect(usEast1['Nova Lite'].regional).toMatchObject({
      inputPer1k: 0.00006,
      outputPer1k: 0.00024,
    });
  });

  test('every alias names a GenU model', () => {
    const names = new Set(
      Object.values(modelMetadata).map((meta) => meta.displayName)
    );
    for (const name of Object.keys(ALIASES)) expect(names).toContain(name);
  });
});

describe('countPriced', () => {
  test('counts entries with and without quotes', () => {
    expect(countPriced('{\n  "regional": {},\n  "global": {}\n}')).toBe(2);
    expect(countPriced('{\n  regional: {},\n  global: {}\n}')).toBe(2);
  });

  test('sees the entries in the committed table', () => {
    const source = readFileSync(
      join(__dirname, '../../lambda/utils/modelPricing.generated.ts'),
      'utf8'
    );
    expect(countPriced(source)).toBeGreaterThan(500);
  });
});
