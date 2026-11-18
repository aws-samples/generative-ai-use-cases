import { bedrockModelArn } from '../../lib/utils/model-id-utils';

describe('bedrockModelArn', () => {
  const base = { region: 'us-east-1', account: '123456789012' };

  test.each([
    'global.anthropic.claude-sonnet-4-6',
    'us.anthropic.claude-sonnet-4-6',
    'jp.anthropic.claude-sonnet-4-6',
    'apac.amazon.nova-pro-v1:0',
    'us-gov.anthropic.claude-sonnet-4-6',
  ])('returns an inference-profile ARN for %s', (modelId) => {
    expect(bedrockModelArn({ ...base, modelId })).toBe(
      `arn:aws:bedrock:us-east-1:123456789012:inference-profile/${modelId}`
    );
  });

  test.each(['anthropic.claude-3-haiku-20240307-v1:0', 'amazon.nova-pro-v1:0'])(
    'returns a foundation-model ARN for %s',
    (modelId) => {
      expect(bedrockModelArn({ ...base, modelId })).toBe(
        `arn:aws:bedrock:us-east-1::foundation-model/${modelId}`
      );
    }
  );
});
