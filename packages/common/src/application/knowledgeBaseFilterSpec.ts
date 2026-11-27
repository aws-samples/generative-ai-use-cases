import type { RetrievalFilter } from '@aws-sdk/client-bedrock-agent-runtime';

/**
 * The filter a use case writes in `{{retrieveKnowledgeBase:label:JSON}}`
 * (#1416), turned into Retrieve filters: one per condition, all of which must
 * hold. They narrow a search and are combined with the caller's access filters,
 * never in place of them.
 *
 * - `{"category": "AWS"}`: the attribute equals the value
 * - `{"year": {"greaterThan": 2020}}`: one or more operators on an attribute
 *
 * The operators and their values follow Retrieve's `RetrievalFilter`.
 */

export class KnowledgeBaseFilterSpecError extends Error {}

const SCALAR_OPERATORS = ['equals', 'notEquals'] as const;
const NUMBER_OPERATORS = [
  'greaterThan',
  'greaterThanOrEquals',
  'lessThan',
  'lessThanOrEquals',
] as const;
const STRING_LIST_OPERATORS = ['in', 'notIn'] as const;
const STRING_OPERATORS = [
  'startsWith',
  'stringContains',
  'listContains',
] as const;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isScalar = (v: unknown): v is string | number | boolean =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

const includes = (list: readonly string[], op: string) => list.includes(op);

const checkValue = (key: string, op: string, value: unknown) => {
  const fail = (expected: string) => {
    throw new KnowledgeBaseFilterSpecError(`"${key}": ${op} takes ${expected}`);
  };
  if (includes(SCALAR_OPERATORS, op)) {
    if (!isScalar(value)) fail('a string, number or boolean');
  } else if (includes(NUMBER_OPERATORS, op)) {
    if (typeof value !== 'number') fail('a number');
  } else if (includes(STRING_LIST_OPERATORS, op)) {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every((v) => typeof v === 'string')
    ) {
      fail('a list of strings');
    }
  } else if (includes(STRING_OPERATORS, op)) {
    if (typeof value !== 'string') fail('a string');
  } else {
    throw new KnowledgeBaseFilterSpecError(`"${key}": unknown operator ${op}`);
  }
};

export const knowledgeBaseFiltersFromSpec = (
  spec: unknown
): RetrievalFilter[] => {
  if (!isPlainObject(spec) || Object.keys(spec).length === 0) {
    throw new KnowledgeBaseFilterSpecError(
      'The filter must be a JSON object with at least one attribute'
    );
  }
  const filters: RetrievalFilter[] = [];
  for (const [key, condition] of Object.entries(spec)) {
    if (isScalar(condition)) {
      filters.push({ equals: { key, value: condition } });
      continue;
    }
    if (!isPlainObject(condition) || Object.keys(condition).length === 0) {
      throw new KnowledgeBaseFilterSpecError(
        `"${key}": give a value, or an object of operators`
      );
    }
    for (const [op, value] of Object.entries(condition)) {
      checkValue(key, op, value);
      filters.push({ [op]: { key, value } } as unknown as RetrievalFilter);
    }
  }
  return filters;
};

/** The same, from the JSON text written in the prompt template. */
export const knowledgeBaseFiltersFromJson = (
  json: string
): RetrievalFilter[] => {
  let spec: unknown;
  try {
    spec = JSON.parse(json);
  } catch {
    throw new KnowledgeBaseFilterSpecError('The filter is not valid JSON');
  }
  return knowledgeBaseFiltersFromSpec(spec);
};
