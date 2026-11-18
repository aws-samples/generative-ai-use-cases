// Pure parsing of the AWS Price List bulk offer files for Amazon Bedrock
// (AmazonBedrock and AmazonBedrockFoundationModels). No IO; update.ts fetches
// the files and writes the result.
//
// The offer files are not a documented schema: attributes and usage type names
// differ between providers and between older and newer models. Only the plain
// on-demand text token prices are kept; every alternate tier is dropped.

import { ModelPrice, ModelPrices } from 'generative-ai-use-cases';

export type PriceKind = 'input' | 'output' | 'cacheRead' | 'cacheWrite';

export type OfferFile = {
  products: Record<
    string,
    { sku: string; attributes: Record<string, string | undefined> }
  >;
  terms: {
    OnDemand?: Record<
      string,
      Record<
        string,
        {
          priceDimensions: Record<
            string,
            { unit: string; pricePerUnit: { USD?: string } }
          >;
        }
      >
    >;
  };
};

// Alternate tiers and non-text token types listed in the same files.
const EXCLUDE = [
  'batch',
  'provisioned',
  'reserved',
  'commit',
  'customization',
  'custom-model',
  'custommodel',
  'flex',
  'priority',
  'latency',
  'longctx',
  '1h',
  '30m',
  'video',
  'image',
  'audio',
  'speech',
  'grounding',
  'embedding',
];

const compact = (text: string) => text.toLowerCase().replace(/[-_ .]/g, '');

export const classify = (
  attributes: Record<string, string | undefined>
):
  | { kind: PriceKind; scope: keyof ModelPrices; mantle: boolean }
  | undefined => {
  const usage = attributes.usagetype ?? '';
  const text = compact(
    [
      attributes.inferenceType,
      usage,
      attributes.feature,
      attributes.service_tier,
      attributes.featureType,
    ]
      .filter(Boolean)
      .join(' ')
  );
  if (EXCLUDE.some((word) => text.includes(word))) return undefined;

  const scope = compact(usage).includes('global') ? 'global' : 'regional';
  // Prices for the OpenAI-compatible endpoint; used only when a model has no
  // bedrock-runtime price.
  const mantle = text.includes('mantle');
  if (text.includes('cacheread')) return { kind: 'cacheRead', scope, mantle };
  if (text.includes('cachewrite')) return { kind: 'cacheWrite', scope, mantle };
  if (text.includes('input')) return { kind: 'input', scope, mantle };
  if (text.includes('output')) return { kind: 'output', scope, mantle };
  return undefined;
};

/** The on-demand USD price per 1,000 tokens of a SKU. */
export const pricePer1k = (
  offer: OfferFile,
  sku: string
): number | undefined => {
  const prices: number[] = [];
  for (const term of Object.values(offer.terms.OnDemand?.[sku] ?? {})) {
    for (const dim of Object.values(term.priceDimensions)) {
      const usd = Number(dim.pricePerUnit.USD);
      if (!Number.isFinite(usd)) continue;
      const unit = dim.unit.toLowerCase().replace(/\s+/g, '');
      if (unit === '1ktokens') prices.push(usd);
      else if (unit === '1mtokens') prices.push(usd / 1000);
    }
  }
  // Tiered SKUs (several dimensions) are not plain on-demand prices.
  return prices.length === 1 ? prices[0] : undefined;
};

/**
 * Model names differ in filler words and punctuation between GenU's display
 * names and the price list. Still an exact match on what remains, so distinct
 * models ("Command R" / "Command R+") do not collide.
 */
export const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    // "(Amazon Bedrock Edition)", "(24.02)": not part of the model name
    .replace(/\([^)]*\)/g, '')
    // vendor prefixes that only one side carries ("OpenAI GPT-6 Sol")
    .replace(/^\s*(openai|nvidia)\s+/, '')
    .replace(/\b(instruct|chat|it|vision)\b/g, '')
    .replace(/[^a-z0-9+]/g, '');

const round = (value: number) => Math.round(value * 1e9) / 1e9;

export type ExtractResult = {
  /** normalized model name -> prices */
  prices: Map<string, ModelPrices>;
  /** names whose matching SKUs disagree on a price; left out of `prices` */
  conflicts: string[];
};

/** Prices of every model in the given offer files (one Region). */
export const extractPrices = (offers: OfferFile[]): ExtractResult => {
  const found = new Map<string, Map<string, Set<number>>>();
  for (const offer of offers) {
    for (const product of Object.values(offer.products)) {
      const attributes = product.attributes;
      // AmazonBedrock lists "Amazon Bedrock" as servicename on every product,
      // so servicename names a model only in the marketplace form.
      const serviceName = attributes.servicename?.includes(
        '(Amazon Bedrock Edition)'
      )
        ? attributes.servicename
        : undefined;
      const name = attributes.model ?? serviceName;
      if (!name) continue;
      const classified = classify(attributes);
      if (!classified) continue;
      const price = pricePer1k(offer, product.sku);
      if (price === undefined) continue;
      const key = normalizeName(name);
      const slots = found.get(key) ?? new Map<string, Set<number>>();
      const slot = `${classified.mantle ? 'mantle:' : ''}${classified.scope}:${classified.kind}`;
      slots.set(slot, (slots.get(slot) ?? new Set()).add(round(price)));
      found.set(key, slots);
    }
  }

  const prices = new Map<string, ModelPrices>();
  const conflicts: string[] = [];
  for (const [name, slots] of found) {
    if ([...slots.values()].some((values) => values.size > 1)) {
      conflicts.push(name);
      continue;
    }
    const get = (scope: keyof ModelPrices, kind: PriceKind) =>
      [
        ...(slots.get(`${scope}:${kind}`) ??
          slots.get(`mantle:${scope}:${kind}`) ??
          []),
      ][0];
    const entry: ModelPrices = {};
    for (const scope of ['regional', 'global'] as const) {
      const input = get(scope, 'input');
      const output = get(scope, 'output');
      if (input === undefined || output === undefined) continue;
      const price: ModelPrice = { inputPer1k: input, outputPer1k: output };
      const cacheRead = get(scope, 'cacheRead');
      const cacheWrite = get(scope, 'cacheWrite');
      if (cacheRead !== undefined) price.cacheReadPer1k = cacheRead;
      if (cacheWrite !== undefined) price.cacheWritePer1k = cacheWrite;
      entry[scope] = price;
    }
    if (entry.regional || entry.global) prices.set(name, entry);
  }
  return { prices, conflicts: conflicts.sort() };
};
