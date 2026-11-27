import * as cdk from 'aws-cdk-lib';
import {
  BUNDLING_STACKS,
  DISABLE_ASSET_STAGING_CONTEXT,
} from 'aws-cdk-lib/cx-api';
import { processedStackInputSchema } from '../lib/stack-input';
import { createStacks } from '../lib/create-stacks';
import { stackInput } from './stack-input.fixture';

type Rule = { Prefix?: string; ExpirationInDays?: number; Status: string };

// The lifecycle rules of every bucket, by "<stack>/<logical id>"
const lifecycleRules = (fileExpirationDays?: number) => {
  const app = new cdk.App({
    context: {
      [BUNDLING_STACKS]: [],
      [DISABLE_ASSET_STAGING_CONTEXT]: true,
    },
  });
  createStacks(
    app,
    processedStackInputSchema.parse({ ...stackInput, fileExpirationDays })
  );
  const rules: Record<string, Rule[]> = {};
  for (const stack of app.synth().stacks) {
    for (const [id, r] of Object.entries(
      (stack.template.Resources ?? {}) as Record<
        string,
        { Type: string; Properties?: Record<string, unknown> }
      >
    )) {
      if (r.Type !== 'AWS::S3::Bucket') continue;
      const config = r.Properties?.LifecycleConfiguration as
        | { Rules: Rule[] }
        | undefined;
      rules[`${stack.stackName}/${id}`] = config?.Rules ?? [];
    }
  }
  return rules;
};

const find = (rules: Record<string, Rule[]>, pattern: RegExp) => {
  const keys = Object.keys(rules).filter((k) => pattern.test(k));
  expect(keys).toHaveLength(1);
  return rules[keys[0]];
};

describe('fileExpirationDays (#1213)', () => {
  test('deletes nothing unless it is set', () => {
    const rules = lifecycleRules();
    for (const pattern of [
      /APIFileBucket/,
      /TranscribeAudioBucket/,
      /TranscribeTranscriptBucket/,
      /VideoTmpBucketStack.*\/Bucket/,
    ]) {
      expect(find(rules, pattern)).toEqual([]);
    }
  });

  test("expires the users' files, and only those, in the file bucket", () => {
    expect(find(lifecycleRules(30), /APIFileBucket/)).toEqual([
      {
        Id: 'ExpireUserFiles',
        Prefix: 'users/',
        ExpirationInDays: 30,
        Status: 'Enabled',
      },
    ]);
  });

  test('expires the transcription and generated video buckets as a whole', () => {
    const rules = lifecycleRules(30);
    for (const pattern of [
      /TranscribeAudioBucket/,
      /TranscribeTranscriptBucket/,
      /VideoTmpBucketStack.*\/Bucket/,
    ]) {
      expect(find(rules, pattern)).toEqual([
        { Id: 'ExpireFiles', ExpirationInDays: 30, Status: 'Enabled' },
      ]);
    }
  });

  test('takes whole days of at least one', () => {
    for (const days of [0, 1.5]) {
      expect(
        processedStackInputSchema.safeParse({
          ...stackInput,
          fileExpirationDays: days,
        }).success
      ).toBe(false);
    }
  });
});
