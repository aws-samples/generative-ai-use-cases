const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: {
      ...actual.DynamoDBDocumentClient,
      from: () => ({ send: mockSend }),
    },
  };
});

process.env.TABLE_NAME = 'test-table';
process.env.BUCKET_NAME = 'file-bucket';

import { GenerateVideoRequest } from 'generative-ai-use-cases';
import { createJob, videoJobParams } from '../../lambda/repositoryVideoJob';

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({});
});

const request = (params: Record<string, unknown>): GenerateVideoRequest =>
  ({
    model: {
      type: 'bedrock',
      modelId: 'amazon.nova-reel-v1:1',
      region: 'us-east-1',
    },
    params,
  }) as unknown as GenerateVideoRequest;

describe('createJob', () => {
  it('keeps the job key and output when the request names them', async () => {
    const item = await createJob(
      'alice-name',
      'alice',
      'arn:aws:bedrock:us-east-1:111122223333:async-invoke/job1',
      request({
        prompt: 'a cat',
        durationSeconds: 6,
        id: 'share#forged',
        createdDate: '1',
        output: 's3://other-bucket/key',
        status: 'Completed',
        userId: 'user#bob',
        chatId: 'chat#x',
      })
    );

    const saved = mockSend.mock.calls[0][0].input.Item;
    expect(saved).toEqual(item);
    expect(saved.id).toBe('videoJob#alice-name');
    expect(saved.status).toBe('InProgress');
    expect(saved.output.startsWith('s3://file-bucket/users/alice/')).toBe(true);
    expect(saved).not.toHaveProperty('userId');
    expect(saved).not.toHaveProperty('chatId');
    expect(saved.prompt).toBe('a cat');
    expect(saved.durationSeconds).toBe(6);
  });
});

describe('videoJobParams', () => {
  it('keeps only known scalar parameters', () => {
    expect(
      videoJobParams({
        prompt: 'p',
        seed: 1,
        loop: false,
        images: [{ format: 'png', source: { bytes: 'x' } }],
        prompt2: 'ignored',
        aspectRatio: { nested: true },
      })
    ).toEqual({ prompt: 'p', seed: 1, loop: false });
  });

  it('returns nothing for a missing or non-object value', () => {
    expect(videoJobParams(undefined)).toEqual({});
    expect(videoJobParams('text')).toEqual({});
  });
});
