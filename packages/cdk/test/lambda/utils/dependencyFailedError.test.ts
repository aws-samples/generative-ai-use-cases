import { DependencyFailedException } from '@aws-sdk/client-bedrock-agent-runtime';
import {
  ApiInterface,
  Model,
  UnrecordedMessage,
} from 'generative-ai-use-cases';

// An action group's Lambda function failing surfaces as a
// DependencyFailedException from InvokeAgent (#912). It is not an access
// problem, so it must not be reported as ACCESS_DENIED, whose message tells
// the user to enable the model in the Bedrock console.

process.env.BUILTIN_AGENTS_JSON = JSON.stringify([
  { displayName: 'TestAgent', agentId: 'AGENT', aliasId: 'ALIAS' },
]);

const dependencyFailed = () =>
  new DependencyFailedException({
    $metadata: {},
    message:
      "Your request couldn't be completed. Lambda function arn:aws:lambda:us-east-1:123456789012:function:action encountered a problem while processing request.",
  });

jest.mock('../../../lambda/utils/bedrockClient', () => ({
  // GetAgentAlias and ListAgentActionGroups, read before the agent is invoked
  initBedrockAgentClient: async () => ({
    send: async () => ({ agentAlias: {}, actionGroupSummaries: [] }),
  }),
  initBedrockAgentRuntimeClient: async () => ({
    send: async () => {
      throw dependencyFailed();
    },
  }),
}));

jest.mock('uuid', () => ({ v4: () => 'uuid' }));

jest.mock('../../../lambda/utils/auth', () => ({
  verifyToken: async () => undefined,
}));

// Imported after BUILTIN_AGENTS_JSON is set: the agent list is read when the
// module loads.
let bedrockAgentApi: ApiInterface;
let bedrockKbApi: ApiInterface;
beforeAll(async () => {
  bedrockAgentApi = (await import('../../../lambda/utils/bedrockAgentApi'))
    .default;
  bedrockKbApi = (await import('../../../lambda/utils/bedrockKbApi')).default;
});

const lastChunk = async (stream: AsyncIterable<string>) => {
  let last = '';
  for await (const chunk of stream) {
    last = chunk;
  }
  return JSON.parse(last);
};

const messages: UnrecordedMessage[] = [{ role: 'user', content: 'hello' }];

describe('DependencyFailedException', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is DEPENDENCY_FAILED on the agent path', async () => {
    const chunk = await lastChunk(
      bedrockAgentApi.invokeStream(
        { type: 'bedrockAgent', modelId: 'TestAgent', sessionId: 's' } as Model,
        messages,
        'id'
      )
    );
    expect(chunk).toMatchObject({
      stopReason: 'error',
      errorCode: 'DEPENDENCY_FAILED',
    });
  });

  it('is DEPENDENCY_FAILED on the knowledge base path', async () => {
    const chunk = await lastChunk(
      bedrockKbApi.invokeStream(
        { type: 'bedrockKb', modelId: 'anthropic.claude' } as Model,
        messages,
        'id'
      )
    );
    expect(chunk).toMatchObject({
      stopReason: 'error',
      errorCode: 'DEPENDENCY_FAILED',
    });
  });
});
