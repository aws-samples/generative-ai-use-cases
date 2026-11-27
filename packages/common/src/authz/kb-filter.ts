import { RetrievalFilter } from '@aws-sdk/client-bedrock-agent-runtime';

/**
 * Evaluate a Knowledge Base `RetrievalFilter` against one document's metadata.
 *
 * Used to decide whether a caller may open a source document: the same filters
 * the `knowledge_base` tool applies to retrieval must also hold for the
 * document being downloaded. Bedrock evaluates filters inside the vector store,
 * so there is no API to ask; this is a local re-implementation of the subset of
 * operators GenU supports.
 *
 * The semantics follow what Retrieve returns on OpenSearch Serverless and
 * S3 Vectors Knowledge Bases (both agree):
 * - an attribute is treated as a list of values (a scalar is a list of one,
 *   a missing key an empty list); `equals`, `in`, `listContains` and
 *   `stringContains` hold when any value matches;
 * - `notEquals` and `notIn` are the negation of `equals` and `in`, so they
 *   hold for a missing key or a value of another type;
 * - comparisons hold only for a number attribute.
 *
 * Fail closed: an operator outside the supported set, or an operand Bedrock
 * refuses (`in` / `notIn` with an empty or non-string list, `listContains`
 * with a non-string), throws `UnsupportedFilterError`, and the caller must
 * deny.
 */

export type MetadataValue = string | number | boolean | string[];
export type DocumentMetadata = Record<string, MetadataValue>;

export class UnsupportedFilterError extends Error {}

const LEAF_OPERATORS = [
  'equals',
  'notEquals',
  'greaterThan',
  'greaterThanOrEquals',
  'lessThan',
  'lessThanOrEquals',
  'in',
  'notIn',
  'startsWith',
  'listContains',
  'stringContains',
] as const;

type LeafOperator = (typeof LEAF_OPERATORS)[number];

const isScalar = (v: unknown): v is string | number | boolean =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

const evaluateLeaf = (
  op: LeafOperator,
  attribute: { key?: unknown; value?: unknown },
  metadata: DocumentMetadata
): boolean => {
  if (typeof attribute?.key !== 'string') {
    throw new UnsupportedFilterError(`${op}: key must be a string`);
  }
  const expected = attribute.value;
  const has = Object.prototype.hasOwnProperty.call(metadata, attribute.key);
  const actual = has ? metadata[attribute.key] : undefined;
  // The attribute as a list: a scalar is a list of one, a missing key empty.
  const values: (string | number | boolean)[] =
    actual === undefined ? [] : Array.isArray(actual) ? actual : [actual];
  const stringList = (): string[] => {
    if (
      !Array.isArray(expected) ||
      expected.length === 0 ||
      !expected.every((v) => typeof v === 'string')
    ) {
      throw new UnsupportedFilterError(`${op}: value must be a string list`);
    }
    return expected as string[];
  };

  switch (op) {
    case 'equals':
    case 'notEquals': {
      if (!isScalar(expected)) {
        throw new UnsupportedFilterError(`${op}: value must be a scalar`);
      }
      const matches = values.some((v) => v === expected);
      return op === 'equals' ? matches : !matches;
    }
    case 'greaterThan':
    case 'greaterThanOrEquals':
    case 'lessThan':
    case 'lessThanOrEquals': {
      if (typeof expected !== 'number') {
        throw new UnsupportedFilterError(`${op}: value must be a number`);
      }
      if (typeof actual !== 'number') return false;
      if (op === 'greaterThan') return actual > expected;
      if (op === 'greaterThanOrEquals') return actual >= expected;
      if (op === 'lessThan') return actual < expected;
      return actual <= expected;
    }
    case 'in':
    case 'notIn': {
      const list = stringList();
      const matches = values.some(
        (v) => typeof v === 'string' && list.includes(v)
      );
      return op === 'in' ? matches : !matches;
    }
    case 'listContains':
      if (typeof expected !== 'string') {
        throw new UnsupportedFilterError(`${op}: value must be a string`);
      }
      return values.some((v) => v === expected);
    case 'startsWith':
    case 'stringContains':
      if (typeof expected !== 'string') {
        throw new UnsupportedFilterError(`${op}: value must be a string`);
      }
      return values.some(
        (v) =>
          typeof v === 'string' &&
          (op === 'startsWith' ? v.startsWith(expected) : v.includes(expected))
      );
  }
};

/** Operators the vector store refuses (S3 Vectors has no string matching). */
export const unsupportedFilterOperators = (
  storageType: string | undefined
): string[] =>
  storageType === 's3vectors' ? ['startsWith', 'stringContains'] : [];

export type EvaluateFilterOptions = {
  /** Operators Retrieve refuses on this Knowledge Base; they throw here too. */
  unsupportedOperators?: string[];
};

export const evaluateFilter = (
  filter: RetrievalFilter,
  metadata: DocumentMetadata,
  options: EvaluateFilterOptions = {}
): boolean => {
  const entries = Object.entries(filter ?? {}).filter(
    ([, v]) => v !== undefined
  );
  if (entries.length !== 1) {
    throw new UnsupportedFilterError('a filter must have exactly one operator');
  }
  const [op, operand] = entries[0];
  if (options.unsupportedOperators?.includes(op)) {
    throw new UnsupportedFilterError(`unsupported operator: ${op}`);
  }

  if (op === 'andAll' || op === 'orAll') {
    if (!Array.isArray(operand) || operand.length === 0) {
      throw new UnsupportedFilterError(`${op}: operand must be a list`);
    }
    const results = (operand as RetrievalFilter[]).map((f) =>
      evaluateFilter(f, metadata, options)
    );
    return op === 'andAll' ? results.every(Boolean) : results.some(Boolean);
  }

  if ((LEAF_OPERATORS as readonly string[]).includes(op)) {
    return evaluateLeaf(
      op as LeafOperator,
      operand as { key?: unknown; value?: unknown },
      metadata
    );
  }

  throw new UnsupportedFilterError(`unsupported operator: ${op}`);
};

/** True only when every filter holds. An empty list holds trivially. */
export const evaluateFilters = (
  filters: RetrievalFilter[],
  metadata: DocumentMetadata,
  options: EvaluateFilterOptions = {}
): boolean => filters.every((f) => evaluateFilter(f, metadata, options));

/**
 * Normalize the `metadataAttributes` of a `<document>.metadata.json` file.
 *
 * Both forms Bedrock accepts are read: a plain value (`"year": 2024`) and the
 * typed form (`{ "value": { "type": "NUMBER", "numberValue": 2024 } }`).
 * Attributes that are neither are dropped, so a filter on them cannot match.
 */
export const parseDocumentMetadata = (raw: unknown): DocumentMetadata => {
  const attributes = (raw as { metadataAttributes?: unknown })
    ?.metadataAttributes;
  if (typeof attributes !== 'object' || attributes === null) return {};

  const out: DocumentMetadata = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (isScalar(value)) {
      out[key] = value;
    } else if (
      Array.isArray(value) &&
      value.every((v) => typeof v === 'string')
    ) {
      out[key] = value as string[];
    } else if (typeof value === 'object' && value !== null) {
      const typed = (value as { value?: Record<string, unknown> }).value;
      switch (typed?.type) {
        case 'STRING':
          if (typeof typed.stringValue === 'string')
            out[key] = typed.stringValue;
          break;
        case 'NUMBER':
          if (typeof typed.numberValue === 'number')
            out[key] = typed.numberValue;
          break;
        case 'BOOLEAN':
          if (typeof typed.booleanValue === 'boolean')
            out[key] = typed.booleanValue;
          break;
        case 'STRING_LIST':
          if (
            Array.isArray(typed.stringListValue) &&
            typed.stringListValue.every((v) => typeof v === 'string')
          )
            out[key] = typed.stringListValue as string[];
          break;
      }
    }
  }
  return out;
};
