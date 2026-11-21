import { modelMetadata } from '@generative-ai-use-cases/common';
import {
  planCases,
  reasoningParameters,
  pickRegion,
} from '../../scripts/model-verify/plan';

describe('pickRegion', () => {
  const offeredIn = {
    'us-east-1': new Set(['amazon.nova-pro-v1:0']),
    'us-west-2': new Set(['amazon.nova-pro-v1:0', 'deepseek.v3-v1:0']),
  };
  const pick = (modelId: string, defaultRegion = 'us-east-1') =>
    pickRegion({ modelId, defaultRegion, offeredIn });

  it.each([
    ['global.anthropic.claude-opus-5-5', 'us-east-1'],
    ['us.amazon.nova-pro-v1:0', 'us-east-1'],
    ['eu.amazon.nova-pro-v1:0', 'eu-west-1'],
    ['apac.amazon.nova-pro-v1:0', 'ap-northeast-1'],
    ['jp.anthropic.claude-opus-5-5', 'ap-northeast-1'],
    ['au.anthropic.claude-opus-5-5', 'ap-southeast-2'],
  ])('maps the prefix of %s to %s', (modelId, region) => {
    expect(pick(modelId)).toBe(region);
  });

  it('prefers the default region when it offers a plain model ID', () => {
    expect(pick('amazon.nova-pro-v1:0', 'us-west-2')).toBe('us-west-2');
  });

  it('finds a region that offers a model the default region lacks', () => {
    expect(pick('deepseek.v3-v1:0')).toBe('us-west-2');
  });

  it('falls back to the default region when no region offers the model', () => {
    expect(pick('unknown.model-v1:0', 'us-west-2')).toBe('us-west-2');
  });
});

describe('planCases', () => {
  const kinds = (
    flags: Parameters<typeof planCases>[0]['flags'],
    probe = false
  ) =>
    planCases({ flags, probe }).map(({ kind, expected }) => [kind, expected]);

  it('always checks chat and streaming', () => {
    expect(kinds({ text: true })).toEqual([
      ['chat', true],
      ['stream', true],
    ]);
  });

  it('adds the capabilities the flags promise', () => {
    expect(
      kinds({ text: true, image: true, doc: true, reasoning: true })
    ).toEqual([
      ['chat', true],
      ['stream', true],
      ['reasoning', true],
      ['image', true],
      ['document', true],
    ]);
  });

  it('probes image and document input only with --probe', () => {
    expect(kinds({ text: true }, true)).toEqual([
      ['chat', true],
      ['stream', true],
      ['image', false],
      ['document', false],
    ]);
  });
});

describe('reasoningParameters', () => {
  it('uses adaptive thinking for adaptive models', () => {
    expect(reasoningParameters({ adaptiveThinking: true })).toEqual({
      reasoningConfig: { type: 'adaptive', budgetTokens: 0, effort: 'low' },
    });
  });

  it('uses extended thinking otherwise', () => {
    expect(reasoningParameters({ reasoning: true })).toEqual({
      reasoningConfig: { type: 'enabled', budgetTokens: 1024 },
    });
  });

  it('plans a reasoning case for every reasoning text model', () => {
    const reasoningModels = Object.values(modelMetadata).filter(
      ({ flags }) => flags.text && flags.reasoning
    );
    expect(reasoningModels.length).toBeGreaterThan(0);
    for (const { flags } of reasoningModels) {
      expect(
        planCases({ flags, probe: false }).map(({ kind }) => kind)
      ).toContain('reasoning');
    }
  });
});
