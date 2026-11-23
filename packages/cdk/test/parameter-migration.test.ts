import * as cdk from 'aws-cdk-lib';
import { getParams } from '../parameter';
import {
  extractParameters,
  parameterSource,
} from '../scripts/parameter-migration/extract';

const resolve = (context: Record<string, unknown>) =>
  getParams(new cdk.App({ context }));

describe('parameterSource', () => {
  test('the anonymous environment reads cdk.json', () => {
    expect(parameterSource({ context: {}, env: '', resolve })).toBe('cdk.json');
  });

  test('an environment defined in parameter.ts ignores cdk.json', () => {
    // parameter.ts ships with an empty dev entry.
    expect(parameterSource({ context: {}, env: 'dev', resolve })).toBe(
      'parameter.ts'
    );
  });

  test('an environment not defined in parameter.ts reads cdk.json', () => {
    expect(parameterSource({ context: {}, env: 'myenv', resolve })).toBe(
      'cdk.json'
    );
  });
});

describe('extractParameters', () => {
  test('keeps only values that differ from the schema default', () => {
    const { values } = extractParameters({
      context: {
        env: '',
        ragKnowledgeBaseEnabled: true,
        ragEnabled: false,
        modelRegion: 'us-west-2',
      },
    });
    expect(values).toEqual({
      ragKnowledgeBaseEnabled: true,
      modelRegion: 'us-west-2',
    });
  });

  test('treats null as unset', () => {
    const { values } = extractParameters({
      context: { tagValue: null, hostName: null },
    });
    expect(values).toEqual({});
  });

  test('keeps values as written in cdk.json', () => {
    const { values } = extractParameters({
      context: { modelIds: ['us.anthropic.claude-sonnet-4-20250514-v1:0'] },
    });
    expect(values.modelIds).toEqual([
      'us.anthropic.claude-sonnet-4-20250514-v1:0',
    ]);
  });

  test('separates unknown keys from CDK settings', () => {
    const { values, unknownKeys } = extractParameters({
      context: {
        '@aws-cdk/core:newStyleStackSynthesis': true,
        'aws-cdk:enableDiffNoFail': true,
        ragKnowledgeBaseEnabld: true,
      },
    });
    expect(values).toEqual({});
    expect(unknownKeys).toEqual(['ragKnowledgeBaseEnabld']);
  });

  test('rejects a context that fails the schema', () => {
    expect(() =>
      // The VPC ID requires subnet IDs.
      extractParameters({ context: { agentCoreVpcId: 'vpc-0123' } })
    ).toThrow();
  });
});
