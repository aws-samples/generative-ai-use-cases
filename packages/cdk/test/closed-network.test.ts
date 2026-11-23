import { stackInputSchema } from '../lib/stack-input';
import {
  ALWAYS_REQUIRED_VPC_ENDPOINTS,
  closedNetworkWarnings,
  closedNetworkWebConfig,
  requiredClosedNetworkVpcEndpoints,
} from '../lib/utils/closed-network';

const params = (overrides: Record<string, unknown> = {}) =>
  stackInputSchema.parse({
    region: 'ap-northeast-1',
    modelRegion: 'ap-northeast-1',
    closedNetworkMode: true,
    imageGenerationModelIds: [],
    speechToSpeechModelIds: [],
    ...overrides,
  });

const ids = (p: ReturnType<typeof params>) =>
  closedNetworkWarnings(p, p.modelRegion).map((w) => w.id);

describe('requiredClosedNetworkVpcEndpoints', () => {
  test('skips the endpoints of features that are off', () => {
    const endpoints = requiredClosedNetworkVpcEndpoints(
      params({
        hiddenUseCases: {
          transcribe: true,
          meetingMinutes: true,
          translate: true,
        },
      })
    );
    expect(endpoints).toEqual([...ALWAYS_REQUIRED_VPC_ENDPOINTS]);
  });

  test('adds the endpoints of features that are on', () => {
    const endpoints = requiredClosedNetworkVpcEndpoints(
      params({
        ragEnabled: true,
        agentEnabled: true,
        agentBuilderEnabled: true,
      })
    );
    expect(endpoints).toEqual(
      expect.arrayContaining([
        'Transcribe',
        'TranscribeStreaming',
        'Polly',
        'AgentCore',
        'AgentCoreGateway',
        'BedrockAgentApi',
        'Kendra',
      ])
    );
  });

  test('keeps Transcribe Streaming and Polly for Translate alone', () => {
    const endpoints = requiredClosedNetworkVpcEndpoints(
      params({ hiddenUseCases: { transcribe: true, meetingMinutes: true } })
    );
    expect(endpoints).toContain('TranscribeStreaming');
    expect(endpoints).toContain('Polly');
    expect(endpoints).not.toContain('Transcribe');
  });

  test('adds AgentCore for external runtimes only', () => {
    const endpoints = requiredClosedNetworkVpcEndpoints(
      params({
        agentCoreExternalRuntimes: [{ name: 'x', arn: 'arn:aws:x' }],
      })
    );
    expect(endpoints).toContain('AgentCore');
    expect(endpoints).not.toContain('AgentCoreGateway');
  });

  test('adds the AgentCore Gateway endpoint only when a gateway can be called', () => {
    expect(
      requiredClosedNetworkVpcEndpoints(
        params({ createGenericAgentCoreRuntime: true })
      )
    ).not.toContain('AgentCoreGateway');
    expect(
      requiredClosedNetworkVpcEndpoints(
        params({
          createGenericAgentCoreRuntime: true,
          agentCoreGatewayArns: [
            'arn:aws:bedrock-agentcore:ap-northeast-1:1:gateway/g',
          ],
        })
      )
    ).toContain('AgentCoreGateway');
  });

  test('keeps the endpoints listed in closedNetworkAdditionalVpcEndpoints', () => {
    const endpoints = requiredClosedNetworkVpcEndpoints(
      params({ closedNetworkAdditionalVpcEndpoints: ['Kendra', 'Lambda'] })
    );
    expect(endpoints).toContain('Kendra');
    expect(endpoints.filter((e) => e === 'Lambda')).toHaveLength(1);
  });
});

describe('closed network parameter validation', () => {
  test('rejects the research agent', () => {
    expect(() => params({ researchAgentEnabled: true })).toThrow(
      /researchAgentEnabled/
    );
  });

  test('rejects an AgentCore region other than region', () => {
    expect(() =>
      params({ agentBuilderEnabled: true, agentCoreRegion: 'us-east-1' })
    ).toThrow(/agentCoreRegion/);
  });
});

describe('closedNetworkWarnings', () => {
  test('warns about settings that do not work in closed network mode', () => {
    expect(
      ids(
        params({
          samlAuthEnabled: true,
          searchAgentEnabled: true,
          agentBuilderEnabled: true,
          mcpEnabled: true,
          allowedCountryCodes: ['JP'],
          hostName: 'genu',
          agentCoreVpcId: 'vpc-1',
          agentCoreSubnetIds: ['subnet-1'],
          agentCoreExternalRuntimes: [
            {
              name: 'remote',
              arn: 'arn:aws:bedrock-agentcore:us-east-1:1:runtime/r',
            },
          ],
          speechToSpeechModelIds: ['amazon.nova-2-5-sonic'],
          imageGenerationModelIds: [
            {
              modelId: 'stability.stable-image-core-v1:1',
              region: 'us-west-2',
            },
          ],
        })
      )
    ).toEqual(
      expect.arrayContaining([
        'genu:closedNetwork:saml',
        'genu:closedNetwork:searchAgent',
        'genu:closedNetwork:agentCoreInternetTools',
        'genu:closedNetwork:mcp',
        'genu:closedNetwork:waf',
        'genu:closedNetwork:customDomain',
        'genu:closedNetwork:voiceChat',
        'genu:closedNetwork:imageModelRegion',
        'genu:closedNetwork:webContent',
        'genu:closedNetwork:testEnvironment',
        'genu:closedNetwork:agentCoreVpcId',
        'genu:closedNetwork:externalRuntimeRegion',
      ])
    );
  });

  test('is quiet for a configuration that fits closed network mode', () => {
    expect(
      ids(
        params({
          hiddenUseCases: { webContent: true, voiceChat: true },
          closedNetworkCreateTestEnvironment: false,
          imageGenerationModelIds: [
            {
              modelId: 'amazon.nova-canvas-v1:0',
              region: 'ap-northeast-1',
            },
          ],
        })
      )
    ).toEqual([]);
  });
});

describe('closedNetworkWebConfig', () => {
  const base = {
    region: 'ap-northeast-1',
    hiddenUseCases: { summarize: true },
    imageGenerationModelIds: [
      { modelId: 'a', region: 'ap-northeast-1' },
      { modelId: 'b', region: 'us-west-2' },
    ],
    videoGenerationModelIds: [{ modelId: 'c', region: 'us-east-1' }],
  };

  test('passes the values through outside closed network mode', () => {
    expect(
      closedNetworkWebConfig({ ...base, closedNetworkMode: false })
    ).toEqual({
      hiddenUseCases: base.hiddenUseCases,
      imageGenerationModelIds: base.imageGenerationModelIds,
      videoGenerationModelIds: base.videoGenerationModelIds,
    });
  });

  test('hides unsupported use cases and drops unreachable models', () => {
    expect(
      closedNetworkWebConfig({ ...base, closedNetworkMode: true })
    ).toEqual({
      hiddenUseCases: {
        summarize: true,
        voiceChat: true,
        video: true,
      },
      imageGenerationModelIds: [{ modelId: 'a', region: 'ap-northeast-1' }],
      videoGenerationModelIds: [],
    });
  });
});
