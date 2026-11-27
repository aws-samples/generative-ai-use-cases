import * as cdk from 'aws-cdk-lib';
import {
  BUNDLING_STACKS,
  DISABLE_ASSET_STAGING_CONTEXT,
} from 'aws-cdk-lib/cx-api';
import { processedStackInputSchema } from '../lib/stack-input';
import { createStacks } from '../lib/create-stacks';
import { stackInput } from './stack-input.fixture';

type Resource = { Type: string; Properties?: Record<string, unknown> };

// The main stack's resources for these settings
const mainStack = (input: Partial<typeof stackInput>) => {
  const app = new cdk.App({
    context: {
      [BUNDLING_STACKS]: [],
      [DISABLE_ASSET_STAGING_CONTEXT]: true,
    },
  });
  createStacks(
    app,
    processedStackInputSchema.parse({ ...stackInput, ...input })
  );
  const stack = app
    .synth()
    .stacks.find((s) => s.stackName.startsWith('GenerativeAiUseCasesStack'))!;
  return Object.values(stack.template.Resources as Record<string, Resource>);
};

const searchFunctions = (resources: Resource[]) =>
  resources.filter(
    (r) =>
      r.Type === 'AWS::Lambda::Function' &&
      JSON.stringify(r.Properties).includes('KNOWLEDGE_BASE_HYBRID_SEARCH') &&
      !JSON.stringify(r.Properties).includes('TABLE_NAME')
  );

describe('document search of Agent Builder agents (#1870)', () => {
  const both = { agentBuilderEnabled: true, ragKnowledgeBaseEnabled: true };

  test('is created with the Agent Builder and the Knowledge Base, and only then', () => {
    expect(searchFunctions(mainStack(both))).toHaveLength(1);
    expect(
      searchFunctions(mainStack({ ...both, ragKnowledgeBaseEnabled: false }))
    ).toHaveLength(0);
    expect(
      searchFunctions(mainStack({ ...both, agentBuilderEnabled: false }))
    ).toHaveLength(0);
  });

  test('is published to the runtimes, which alone may invoke it', () => {
    const resources = mainStack(both);
    const config = resources.find(
      (r) =>
        r.Type === 'AWS::SSM::Parameter' &&
        JSON.stringify(r.Properties).includes('userPoolClientId')
    );
    expect(JSON.stringify(config?.Properties)).toContain(
      'documentSearchFunction'
    );
    const permissions = resources.filter(
      (r) => r.Type === 'AWS::Lambda::Permission'
    );
    const invoke = permissions.find((p) =>
      JSON.stringify(p.Properties?.Principal).includes('RuntimeRole')
    );
    expect(invoke?.Properties?.Action).toBe('lambda:InvokeFunction');
  });
});
