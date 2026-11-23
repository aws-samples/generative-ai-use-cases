import { App, Stack } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import {
  CRI_PREFIX_PATTERN,
  getEndOfLife,
  MODEL_END_OF_LIFE,
  modelMetadata,
  RETIRED,
} from '@generative-ai-use-cases/common';
import { warnModelEndOfLife } from '../../../lib/utils/model-end-of-life';

const today = new Date('2026-11-21T09:00:00Z');

describe('MODEL_END_OF_LIFE', () => {
  const baseModelIds = new Set(
    Object.keys(modelMetadata).map((id) => id.replace(CRI_PREFIX_PATTERN, ''))
  );

  it.each(Object.entries(MODEL_END_OF_LIFE))(
    'names a model GenU defines and a valid date: %s',
    (baseModelId, value) => {
      expect(baseModelIds).toContain(baseModelId);
      expect(value === RETIRED || /^\d{4}-\d{2}-\d{2}$/.test(value)).toBe(true);
      if (value !== RETIRED) {
        expect(Number.isNaN(Date.parse(`${value}T00:00:00Z`))).toBe(false);
      }
    }
  );
});

describe('getEndOfLife', () => {
  it('returns undefined for a model with no announced end of life', () => {
    expect(
      getEndOfLife({ modelId: 'global.anthropic.claude-opus-5-5', today })
    ).toBeUndefined();
  });

  it('ignores the inference profile prefix', () => {
    expect(getEndOfLife({ modelId: 'us.deepseek.r1-v1:0', today })).toEqual(
      getEndOfLife({ modelId: 'deepseek.r1-v1:0', today })
    );
  });

  it('counts the days left before a scheduled end of life', () => {
    expect(getEndOfLife({ modelId: 'us.deepseek.r1-v1:0', today })).toEqual({
      state: 'scheduled',
      date: '2027-03-30',
      daysLeft: 129,
    });
  });

  it('treats the EOL date itself as ended', () => {
    expect(
      getEndOfLife({
        modelId: 'us.deepseek.r1-v1:0',
        today: new Date('2027-03-30T00:00:00Z'),
      })
    ).toEqual({ state: 'ended', date: '2027-03-30' });
  });

  it('returns ended for a past date and retired for an undated retired model', () => {
    expect(
      getEndOfLife({
        modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        today,
      })
    ).toEqual({ state: 'ended', date: '2026-10-14' });
    expect(
      getEndOfLife({ modelId: 'us.amazon.nova-premier-v1:0', today })
    ).toEqual({ state: 'retired' });
  });
});

describe('warnModelEndOfLife', () => {
  const warnings = (modelIds: string[]) => {
    const stack = new Stack(new App(), 'Test');
    warnModelEndOfLife({
      scope: stack,
      parameter: 'modelIds',
      modelIds,
      today,
    });
    return Annotations.fromStack(stack);
  };

  it('warns once per model, whichever way it is listed', () => {
    const annotations = warnings([
      'us.deepseek.r1-v1:0',
      'us.deepseek.r1-v1:0',
    ]);
    expect(
      annotations.findWarning(
        '*',
        Match.stringLikeRegexp(
          'DeepSeek-R1 \\(us.deepseek.r1-v1:0\\) in modelIds will reach end of life on Amazon Bedrock on 2027-03-30 \\(in 129 days\\) in at least one Region. Replace it with an active model or remove it from modelIds'
        )
      )
    ).toHaveLength(1);
  });

  it('says a past EOL model fails, and a retired one fails now', () => {
    const annotations = warnings([
      'us.anthropic.claude-sonnet-4-20250514-v1:0',
      'us.amazon.nova-premier-v1:0',
    ]);
    expect(
      annotations.findWarning(
        '*',
        Match.stringLikeRegexp(
          'reached end of life .* on 2026-10-14 in at least one Region'
        )
      )
    ).toHaveLength(1);
    expect(
      annotations.findWarning(
        '*',
        Match.stringLikeRegexp(
          'Nova Premier .* is no longer offered on Amazon Bedrock'
        )
      )
    ).toHaveLength(1);
  });

  it('adds no warning for a model with no announced end of life', () => {
    expect(
      warnings(['global.anthropic.claude-opus-5-5']).findWarning(
        '*',
        Match.anyValue()
      )
    ).toHaveLength(0);
  });
});
