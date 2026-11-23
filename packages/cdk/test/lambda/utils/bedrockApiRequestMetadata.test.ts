import bedrockApi from '../../../lambda/utils/bedrockApi';

const send = jest.fn();
jest.mock('../../../lambda/utils/bedrockClient', () => ({
  initBedrockRuntimeClient: jest.fn(async () => ({ send })),
}));

const model = {
  type: 'bedrock' as const,
  modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  region: 'us-east-1',
};
const messages = [{ role: 'user' as const, content: 'hello' }];
const metadata = { genu: 'genu', genu_user: 'u1', genu_usecase: 'chat' };

beforeEach(() => send.mockReset());

describe('bedrockApi request metadata', () => {
  test('Converse carries the tags', async () => {
    send.mockResolvedValue({
      output: { message: { role: 'assistant', content: [{ text: 'hi' }] } },
    });
    await bedrockApi.invoke(model, messages, '/chat', metadata);
    expect(send.mock.calls[0][0].input.requestMetadata).toEqual(metadata);
  });

  test('ConverseStream carries the tags', async () => {
    send.mockResolvedValue({ stream: [] });
    for await (const chunk of bedrockApi.invokeStream(
      model,
      messages,
      '/chat',
      undefined,
      metadata
    )) {
      void chunk;
    }
    expect(send.mock.calls[0][0].input.requestMetadata).toEqual(metadata);
  });

  test('InvokeModel carries the tags as a JSON string', async () => {
    send.mockResolvedValue({
      body: Buffer.from(JSON.stringify({ images: ['AAAA'] })),
    });
    await bedrockApi.generateImage(
      {
        type: 'bedrock',
        modelId: 'amazon.titan-image-generator-v2:0',
        region: 'us-east-1',
      },
      {
        textPrompt: [{ text: 'cat', weight: 1 }],
        width: 512,
        height: 512,
      } as never,
      metadata
    );
    expect(JSON.parse(send.mock.calls[0][0].input.requestMetadata)).toEqual(
      metadata
    );
  });

  test('calls without tags send none', async () => {
    send.mockResolvedValue({
      output: { message: { role: 'assistant', content: [{ text: 'hi' }] } },
    });
    await bedrockApi.invoke(model, messages, '/chat');
    expect(send.mock.calls[0][0].input).not.toHaveProperty('requestMetadata');
  });
});
