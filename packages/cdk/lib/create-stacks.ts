import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { GenerativeAiUseCasesStack } from './generative-ai-use-cases-stack';
import { CloudFrontWafStack } from './cloud-front-waf-stack';
import { DashboardStack } from './dashboard-stack';
import { AgentStack } from './agent-stack';
import { RagKnowledgeBaseStack } from './rag-knowledge-base-stack';
import { GuardrailStack } from './guardrail-stack';
import { AgentCoreStack } from './agent-core-stack';
import { ResearchAgentCoreStack } from './research-agent-core-stack';
import { ProcessedStackInput } from './stack-input';
import { VideoTmpBucketStack } from './video-tmp-bucket-stack';
import { ClosedNetworkStack } from './closed-network-stack';

class DeletionPolicySetter implements cdk.IAspect {
  constructor(private readonly policy: cdk.RemovalPolicy) {}

  visit(node: IConstruct): void {
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(this.policy);
    }
  }
}

export const createStacks = (app: cdk.App, params: ProcessedStackInput) => {
  // GenU Stack
  const isSageMakerStudio = 'SAGEMAKER_APP_TYPE_LOWERCASE' in process.env;

  let closedNetworkStack: ClosedNetworkStack | undefined = undefined;

  if (params.closedNetworkMode) {
    closedNetworkStack = new ClosedNetworkStack(
      app,
      `ClosedNetworkStack${params.env}`,
      {
        env: {
          account: params.account,
          region: params.region,
        },
        params,
        isSageMakerStudio,
      }
    );
  }

  // CloudFront WAF
  // Only deploy CloudFrontWafStack if IP address range (v4 or v6) or geographic restriction is defined
  // WAF v2 is only deployable in us-east-1, so the Stack is separated
  const cloudFrontWafStack =
    (params.allowedIpV4AddressRanges ||
      params.allowedIpV6AddressRanges ||
      params.allowedCountryCodes ||
      params.hostName) &&
    !params.closedNetworkMode
      ? new CloudFrontWafStack(app, `CloudFrontWafStack${params.env}`, {
          env: {
            account: params.account,
            region: 'us-east-1',
          },
          params: params,
          crossRegionReferences: true,
        })
      : null;

  // RAG Knowledge Base
  const ragKnowledgeBaseStack =
    params.ragKnowledgeBaseEnabled && !params.ragKnowledgeBaseId
      ? new RagKnowledgeBaseStack(app, `RagKnowledgeBaseStack${params.env}`, {
          env: {
            account: params.account,
            region: params.modelRegion,
          },
          params: params,
          crossRegionReferences: true,
        })
      : null;

  // Agent
  if (params.crossAccountBedrockRoleArn) {
    if (params.agentEnabled || params.searchApiKey) {
      throw new Error(
        'When `crossAccountBedrockRoleArn` is specified, the `agentEnabled` and `searchApiKey` parameters are not supported. Please create agents in the other account and specify them in the `agents` parameter.'
      );
    }
  }
  const agentStack = params.agentEnabled
    ? new AgentStack(app, `WebSearchAgentStack${params.env}`, {
        env: {
          account: params.account,
          region: params.modelRegion,
        },
        params: params,
        vpc: closedNetworkStack?.vpc,
      })
    : null;

  // Guardrail
  const guardrailStack = params.guardrailEnabled
    ? new GuardrailStack(app, `GuardrailStack${params.env}`, {
        env: {
          account: params.account,
          region: params.modelRegion,
        },
        crossRegionReferences: true,
      })
    : null;

  // Agent Core Runtime (always create if either feature is enabled)
  const agentCoreStack =
    params.createGenericAgentCoreRuntime || params.agentBuilderEnabled
      ? new AgentCoreStack(app, `AgentCoreStack${params.env}`, {
          env: {
            account: params.account,
            region: params.agentCoreRegion,
          },
          params: params,
          vpc: closedNetworkStack?.closedVpc.vpc,
          subnets: closedNetworkStack?.closedVpc.subnets,
        })
      : null;

  // Research Agent Core Runtime
  const researchAgentCoreStack = params.researchAgentEnabled
    ? new ResearchAgentCoreStack(app, `ResearchAgentCoreStack${params.env}`, {
        env: {
          account: params.account,
          region: params.agentCoreRegion,
        },
        params: params,
      })
    : null;

  // Create S3 Bucket for each unique region for StartAsyncInvoke in video generation
  // because the S3 Bucket must be in the same region as Bedrock Runtime
  const videoModelRegions = [
    ...new Set(params.videoGenerationModelIds.map((model) => model.region)),
  ];
  const videoBucketRegionMap: Record<string, string> = {};

  for (const region of videoModelRegions) {
    const videoTmpBucketStack = new VideoTmpBucketStack(
      app,
      `VideoTmpBucketStack${params.env}${region}`,
      {
        env: {
          account: params.account,
          region,
        },
        params: params,
      }
    );

    videoBucketRegionMap[region] = videoTmpBucketStack.bucketName;
  }

  const generativeAiUseCasesStack = new GenerativeAiUseCasesStack(
    app,
    `GenerativeAiUseCasesStack${params.env}`,
    {
      env: {
        account: params.account,
        region: params.region,
      },
      description: params.anonymousUsageTracking
        ? 'Generative AI Use Cases (uksb-1tupboc48)'
        : undefined,
      params: params,
      crossRegionReferences: true,
      // RAG Knowledge Base
      knowledgeBaseId: ragKnowledgeBaseStack?.knowledgeBaseId,
      knowledgeBaseDataSourceBucketName:
        ragKnowledgeBaseStack?.dataSourceBucketName,
      agentStack: agentStack || undefined,

      // Agent Core
      createGenericAgentCoreRuntime: params.createGenericAgentCoreRuntime,
      agentBuilderEnabled: params.agentBuilderEnabled,
      agentCoreStack: agentCoreStack || undefined,
      // Research Agent Core
      researchAgentEnabled: params.researchAgentEnabled,
      researchAgentCoreStack: researchAgentCoreStack || undefined,
      // Video Generation
      videoBucketRegionMap,
      // Guardrail
      guardrailIdentifier: guardrailStack?.guardrailIdentifier,
      guardrailVersion: 'DRAFT',
      // WAF
      webAclId: cloudFrontWafStack?.webAclArn,
      // Custom Domain
      cert: cloudFrontWafStack?.cert,
      // Image build environment
      isSageMakerStudio,
      // Closed network
      vpc: closedNetworkStack?.vpc,
      apiGatewayVpcEndpoint: closedNetworkStack?.apiGatewayVpcEndpoint,
      webBucket: closedNetworkStack?.webBucket,
      closedNetworkStack: closedNetworkStack || undefined,
    }
  );

  // Add explicit dependencies for RemoteOutputs
  if (agentStack) {
    generativeAiUseCasesStack.addDependency(agentStack);
  }
  if (agentCoreStack) {
    generativeAiUseCasesStack.addDependency(agentCoreStack);
  }
  if (closedNetworkStack) {
    generativeAiUseCasesStack.addDependency(closedNetworkStack);
  }

  // Tag all resources for IAM principal-based cost allocation
  // This replaces Application Inference Profiles for Bedrock cost tracking
  const appName = `genu${params.env}`;
  cdk.Tags.of(generativeAiUseCasesStack).add('app', appName);
  if (agentCoreStack) {
    cdk.Tags.of(agentCoreStack).add('app', appName);
  }
  if (researchAgentCoreStack) {
    cdk.Tags.of(researchAgentCoreStack).add('app', appName);
  }
  if (agentStack) {
    cdk.Tags.of(agentStack).add('app', appName);
  }

  cdk.Aspects.of(generativeAiUseCasesStack).add(
    new DeletionPolicySetter(cdk.RemovalPolicy.DESTROY)
  );

  const dashboardStack = params.dashboard
    ? new DashboardStack(
        app,
        `GenerativeAiUseCasesDashboardStack${params.env}`,
        {
          env: {
            account: params.account,
            region: params.modelRegion,
          },
          params: params,
          userPool: generativeAiUseCasesStack.userPool,
          userPoolClient: generativeAiUseCasesStack.userPoolClient,
          appRegion: params.region,
          crossRegionReferences: true,
        }
      )
    : null;

  return {
    closedNetworkStack,
    cloudFrontWafStack,
    ragKnowledgeBaseStack,
    agentStack,
    guardrailStack,
    agentCoreStack,
    generativeAiUseCasesStack,
    dashboardStack,
  };
};
