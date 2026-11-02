// Parameter sets the guard synthesizes. The cdk.json defaults leave most
// stateful features off (RAG, Knowledge Base, agents, closed network), so the
// guard also synthesizes with them on, matching the configurations of
// test/generative-ai-use-cases.test.ts. Each profile is applied on top of the
// context in cdk.json.
const ALL_FEATURES: Record<string, unknown> = {
  ragEnabled: true,
  kendraIndexScheduleEnabled: false,
  ragKnowledgeBaseEnabled: true,
  agentEnabled: true,
  searchAgentEnabled: true,
  searchEngine: 'Brave',
  searchApiKey: 'XXXXXX',
  createGenericAgentCoreRuntime: true,
  agentBuilderEnabled: true,
  dashboard: true,
  guardrailEnabled: true,
  useCaseBuilderEnabled: true,
  allowedCountryCodes: ['JP'],
};

export const PROFILES: Readonly<Record<string, Record<string, unknown>>> = {
  default: {},
  'all-features': ALL_FEATURES,
  'closed-network': { ...ALL_FEATURES, closedNetworkMode: true },
};
