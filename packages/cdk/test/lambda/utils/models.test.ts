import { Model, UnrecordedMessage } from 'generative-ai-use-cases';

const OPUS_5_5_IDS = [
  'global.anthropic.claude-opus-5-5',
  'us.anthropic.claude-opus-5-5',
  'eu.anthropic.claude-opus-5-5',
  'au.anthropic.claude-opus-5-5',
  'jp.anthropic.claude-opus-5-5',
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
      OPUS_5_5_IDS.map((modelId) => ({ modelId, region: 'us-east-1' }))
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

describe('Claude Opus 5.5', () => {
  it.each(OPUS_5_5_IDS)('should be a supported text model: %s', async (id) => {
    const { BEDROCK_TEXT_MODELS } =
      await import('@generative-ai-use-cases/common');
    expect(BEDROCK_TEXT_MODELS).toContain(id);
  });

  it.each(OPUS_5_5_IDS)(
    'should drop the /rag temperature and send no thinking: %s',
    async (modelId) => {
      const input = await createInput({ type: 'bedrock', modelId }, '/rag');
      expect(input.inferenceConfig).toEqual({ maxTokens: 128000 });
      expect(input.additionalModelRequestFields).toBeUndefined();
    }
  );

  it('should send adaptive thinking without temperature', async () => {
    const input = await createInput(
      {
        type: 'bedrock',
        modelId: 'global.anthropic.claude-opus-5-5',
        modelParameters: {
          reasoningConfig: {
            type: 'adaptive',
            budgetTokens: 0,
            effort: 'xhigh',
          },
        },
      },
      '/chat'
    );
    expect(input.inferenceConfig?.temperature).toBeUndefined();
    expect(input.inferenceConfig?.topP).toBeUndefined();
    expect(input.additionalModelRequestFields).toEqual({
      thinking: { type: 'adaptive' },
      output_config: { effort: 'xhigh' },
    });
  });

  it('should add a cache point in /chat', async () => {
    const input = await createInput(
      { type: 'bedrock', modelId: 'global.anthropic.claude-opus-5-5' },
      '/chat'
    );
    expect(input.system?.at(-1)).toEqual({ cachePoint: { type: 'default' } });
    expect(input.messages?.at(-1)?.content?.at(-1)).toEqual({
      cachePoint: { type: 'default' },
    });
  });
});
