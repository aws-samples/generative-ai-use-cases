import {
  AdditionalModelRequestFields,
  FeatureFlags,
} from 'generative-ai-use-cases';

export type CaseKind = 'chat' | 'stream' | 'reasoning' | 'image' | 'document';

export type PlannedCase = {
  kind: CaseKind;
  // true: the model's flags promise this capability, so a failure is a defect.
  // false: only run with --probe, to find flags that could be enabled.
  expected: boolean;
};

// Region to call for each inference profile prefix. A plain model ID uses a
// region that offers it (see pickRegion). Pass --region to override.
const REGION_BY_PREFIX: Record<string, string> = {
  global: 'us-east-1',
  us: 'us-east-1',
  eu: 'eu-west-1',
  apac: 'ap-northeast-1',
  jp: 'ap-northeast-1',
  au: 'ap-southeast-2',
};

// Regions tried, in this order, to find where a plain (prefix-less) model ID is
// offered. Many models exist only in some regions, so a fixed default region
// reports them as invalid.
export const CANDIDATE_REGIONS = [
  'us-east-1',
  'us-west-2',
  'us-east-2',
  'ap-northeast-1',
  'eu-west-1',
  'eu-central-1',
  'ap-south-1',
];

export const pickRegion = ({
  modelId,
  defaultRegion,
  offeredIn,
}: {
  modelId: string;
  defaultRegion: string;
  // Model IDs the catalog lists, per region
  offeredIn: Record<string, Set<string>>;
}): string => {
  const prefixRegion = REGION_BY_PREFIX[modelId.split('.')[0]];
  if (prefixRegion) return prefixRegion;
  if (offeredIn[defaultRegion]?.has(modelId)) return defaultRegion;
  return (
    CANDIDATE_REGIONS.find((region) => offeredIn[region]?.has(modelId)) ??
    defaultRegion
  );
};

export const planCases = ({
  flags,
  probe,
}: {
  flags: FeatureFlags;
  probe: boolean;
}): PlannedCase[] => {
  const cases: PlannedCase[] = [
    { kind: 'chat', expected: true },
    { kind: 'stream', expected: true },
  ];
  if (flags.reasoning) cases.push({ kind: 'reasoning', expected: true });
  if (flags.image || probe) {
    cases.push({ kind: 'image', expected: !!flags.image });
  }
  if (flags.doc || probe) {
    cases.push({ kind: 'document', expected: !!flags.doc });
  }
  return cases;
};

// The same request fields the web app sends when the reasoning option is on.
export const reasoningParameters = (
  flags: FeatureFlags
): AdditionalModelRequestFields => ({
  reasoningConfig: flags.adaptiveThinking
    ? { type: 'adaptive', budgetTokens: 0, effort: 'low' }
    : { type: 'enabled', budgetTokens: 1024 },
});
