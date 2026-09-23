import { Model, UnrecordedMessage } from 'generative-ai-use-cases';

const OPENAI_GPT_IDS = [
  'global.openai.gpt-6-sol',
  'us.openai.gpt-6-sol',
  'global.openai.gpt-6-luna',
  'us.openai.gpt-6-luna',
  'global.openai.gpt-6-astra',
  'us.openai.gpt-6-astra',
  'global.openai.gpt-5.6-sol',
  'us.openai.gpt-5.6-sol',
  'global.openai.gpt-5.6-luna',
  'us.openai.gpt-5.6-luna',
  'global.openai.gpt-5.6-terra',
  'us.openai.gpt-5.6-terra',
];

const messages: UnrecordedMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello' },
];

const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    // models.ts reads MODEL_IDS when it is imported
    MODEL_IDS: JSON.stringify(
      OPENAI_GPT_IDS.map((modelId) => ({ modelId, region: 'us-east-1' }))
    ),
  };
});

afterAll(() => {
  process.env = originalEnv;
});

const createInput = async (model: Model, id: string) => {
  const { BEDROCK_TEXT_GEN_MODELS } =
    await import('../../../lambda/utils/models');
  const config = BEDROCK_TEXT_GEN_MODELS[model.modelId];
  return config.createConverseCommandInput(
    messages,
    id,
    model,
    config.defaultParams,
    config.usecaseParams
  );
};

describe('OpenAI GPT-6 / GPT-5.6', () => {
  it.each(OPENAI_GPT_IDS)(
    'should be a supported text model: %s',
    async (id) => {
      const { BEDROCK_TEXT_MODELS } =
        await import('@generative-ai-use-cases/common');
      expect(BEDROCK_TEXT_MODELS).toContain(id);
    }
  );

  it.each(OPENAI_GPT_IDS)(
    'should send no temperature or topP, even in /rag: %s',
    async (modelId) => {
      const input = await createInput({ type: 'bedrock', modelId }, '/rag');
      expect(input.inferenceConfig).toEqual({ maxTokens: 8192 });
      expect(input.additionalModelRequestFields).toBeUndefined();
    }
  );

  it('should send the system prompt as system, with no cache point', async () => {
    const input = await createInput(
      { type: 'bedrock', modelId: 'global.openai.gpt-6-sol' },
      '/chat'
    );
    expect(input.system).toEqual([{ text: 'You are a helpful assistant.' }]);
    expect(input.messages).toEqual([
      { role: 'user', content: [{ text: 'Hello' }] },
    ]);
  });
});
