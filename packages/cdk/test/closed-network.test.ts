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
        'SecretsManager',
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
        webContent: true,
        video: true,
      },
      imageGenerationModelIds: [{ modelId: 'a', region: 'ap-northeast-1' }],
      videoGenerationModelIds: [],
    });
  });
});
