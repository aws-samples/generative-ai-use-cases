import { invokeHandler } from './api/testApp';

const invoke = jest.fn();
jest.mock('../../lambda/utils/api', () => ({
  __esModule: true,
  default: { bedrock: { invoke: (...args: unknown[]) => invoke(...args) } },
}));
jest.mock('../../lambda/utils/models', () => ({
  defaultModel: { type: 'bedrock', modelId: 'model' },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { handler } = require('../../lambda/predict');

const request = (extraData?: unknown[]) => ({
  user: 'alice',
  body: {
    id: 'x',
    messages: [{ role: 'user', content: 'hello', extraData }],
  },
});

describe('predict', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue('answer');
  });

  test('refuses an S3 reference without calling the model', async () => {
    const res = await invokeHandler(
      handler,
      request([
        {
          type: 'video',
          name: 'v.mp4',
          source: { type: 's3', mediaType: 'video/mp4', data: 's3://b/k.mp4' },
        },
      ])
    );
    expect(res.statusCode).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });

  test('passes inline data and plain text to the model', async () => {
    const inline = await invokeHandler(
      handler,
      request([
        {
          type: 'image',
          name: 'a.png',
          source: { type: 'base64', mediaType: 'image/png', data: 'AAAA' },
        },
      ])
    );
    const text = await invokeHandler(handler, request());
    expect(inline.statusCode).toBe(200);
    expect(text.statusCode).toBe(200);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
