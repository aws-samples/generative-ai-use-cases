// Helpers for moving deployment parameters from the cdk.json context into an
// environment entry in parameter.ts.
//
// getParams() uses either the cdk.json context or the parameter.ts entry for
// the environment, never a mix: when parameter.ts defines the environment, the
// context is ignored and every parameter the entry leaves out falls back to
// the schema default. A migration therefore has to carry every parameter whose
// effective value differs from the default, not only the ones the user
// remembers changing.
import { isDeepStrictEqual } from 'node:util';
import { stackInputSchema } from '../../lib/stack-input';

export type ParameterSource = 'cdk.json' | 'parameter.ts';

const PROBE = '__genu_parameter_source_probe__';

/**
 * Tells which source getParams() reads for the environment. Passes a probe
 * value for tagValue through the context: it survives only when the context
 * is in effect.
 */
export const parameterSource = (props: {
  context: Record<string, unknown>;
  env: string;
  resolve: (context: Record<string, unknown>) => { tagValue?: string | null };
}): ParameterSource =>
  props.resolve({ ...props.context, env: props.env, tagValue: PROBE })
    .tagValue === PROBE
    ? 'cdk.json'
    : 'parameter.ts';

// In zod 4, refine() keeps the object schema, so its shape lists every
// parameter.
const schemaKeys = (): Set<string> =>
  new Set(Object.keys(stackInputSchema.shape));

// Context keys that are CDK settings (feature flags and the like), not GenU
// parameters. They stay in cdk.json.
const isCdkSetting = (key: string): boolean =>
  key.startsWith('@') || key.includes(':');

export type Extraction = {
  /** Parameters to write into the parameter.ts entry, as written in cdk.json. */
  values: Record<string, unknown>;
  /** Context keys that are neither GenU parameters nor CDK settings. */
  unknownKeys: string[];
};

/**
 * Returns the parameters in the context whose effective value differs from
 * the schema default. Throws when the context does not pass the schema.
 */
export const extractParameters = (props: {
  context: Record<string, unknown>;
}): Extraction => {
  const keys = schemaKeys();
  const effective = stackInputSchema.parse(props.context) as Record<
    string,
    unknown
  >;
  const defaults = stackInputSchema.parse({}) as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const key of Object.keys(props.context)) {
    if (
      key !== 'env' &&
      keys.has(key) &&
      !isDeepStrictEqual(effective[key] ?? null, defaults[key] ?? null)
    ) {
      values[key] = props.context[key];
    }
  }
  const unknownKeys = Object.keys(props.context).filter(
    (key) => !keys.has(key) && !isCdkSetting(key)
  );
  return { values, unknownKeys };
};
