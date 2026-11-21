import { Model, UnrecordedMessage } from 'generative-ai-use-cases';

// Requests that Bedrock rejected when each model was called with
// `npm run models:verify`. Keep the request shape that works.
const messages = (): UnrecordedMessage[] => [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello' },
];

const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv, MODEL_IDS: '[]' };
});

afterAll(() => {
  process.env = originalEnv;
});

const createInput = async (modelId: string) => {
  const { BEDROCK_TEXT_GEN_MODELS } =
    await import('../../../lambda/utils/models');
  const config = BEDROCK_TEXT_GEN_MODELS[modelId];
  const model: Model = { type: 'bedrock', modelId };
  return config.createConverseCommandInput(
    messages(),
    '/chat',
    model,
    config.defaultParams,
    config.usecaseParams
  );
};

describe('maxTokens that leaves room for the prompt', () => {
  it.each([
    ['mistral.ministral-3-3b-instruct', 65536],
    ['mistral.ministral-3-8b-instruct', 65536],
    ['mistral.ministral-3-14b-instruct', 65536],
    ['qwen.qwen3-235b-a22b-2507-v1:0', 65536],
    ['writer.palmyra-vision-7b', 2048],
  ])('%s asks for at most %d output tokens', async (modelId, maxTokens) => {
    const input = await createInput(modelId);
    expect(input.inferenceConfig?.maxTokens).toBe(maxTokens);
  });
});

describe('models that reject temperature', () => {
  it.each(['global.xai.grok-4.6', 'us.xai.grok-4.7'])(
    '%s sends no temperature or topP',
    async (modelId) => {
      const input = await createInput(modelId);
      expect(input.inferenceConfig?.temperature).toBeUndefined();
      expect(input.inferenceConfig?.topP).toBeUndefined();
    }
  );
});

describe('models that reject a system role', () => {
  it('Palmyra Vision 7B folds the system prompt into the user turn', async () => {
    const input = await createInput('writer.palmyra-vision-7b');
    expect(input.system).toEqual([]);
    expect(input.messages).toHaveLength(1);
    expect(input.messages?.[0].content?.[0]).toEqual({
      text: 'You are a helpful assistant.Hello',
    });
  });

  it('adds nothing and leaves the messages unchanged without a system prompt', async () => {
    jest.resetModules();
    const { BEDROCK_TEXT_GEN_MODELS } =
      await import('../../../lambda/utils/models');
    const modelId = 'openai.gpt-oss-120b-1:0';
    const config = BEDROCK_TEXT_GEN_MODELS[modelId];
    const userOnly: UnrecordedMessage[] = [{ role: 'user', content: 'Hello' }];
    const input = config.createConverseCommandInput(
      userOnly,
      '/chat',
      { type: 'bedrock', modelId },
      config.defaultParams,
      config.usecaseParams
    );
    expect(input.messages?.[0].content?.[0]).toEqual({ text: 'Hello' });
    expect(userOnly[0].content).toBe('Hello');
  });

  it('does not edit the caller messages when it folds the system prompt', async () => {
    const { BEDROCK_TEXT_GEN_MODELS } =
      await import('../../../lambda/utils/models');
    const modelId = 'writer.palmyra-vision-7b';
    const config = BEDROCK_TEXT_GEN_MODELS[modelId];
    const input = messages();
    config.createConverseCommandInput(
      input,
      '/chat',
      { type: 'bedrock', modelId },
      config.defaultParams,
      config.usecaseParams
    );
    expect(input[1].content).toBe('Hello');
  });
});
