import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { GenerativeAiUseCasesStack } from './generative-ai-use-cases-stack';
import { CloudFrontWafStack } from './cloud-front-waf-stack';
import { DashboardStack } from './dashboard-stack';
import { AgentStack } from './agent-stack';
import { RagKnowledgeBaseStack } from './rag-knowledge-base-stack';
import { GuardrailStack } from './guardrail-stack';
import { ProcessedStackInput } from './stack-input';
import { VideoTmpBucketStack } from './video-tmp-bucket-stack';

class DeletionPolicySetter implements cdk.IAspect {
  constructor(private readonly policy: cdk.RemovalPolicy) {}

  visit(node: IConstruct): void {
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(this.policy);
    }
  }
}

export const createStacks = (app: cdk.App, params: ProcessedStackInput) => {
  // CloudFront WAF
  // Only deploy CloudFrontWafStack if IP address range (v4 or v6) or geographic restriction is defined
  // WAF v2 is only deployable in us-east-1, so the Stack is separated
  const cloudFrontWafStack =
    params.allowedIpV4AddressRanges ||
    params.allowedIpV6AddressRanges ||
    params.allowedCountryCodes ||
    params.hostName
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
        crossRegionReferences: true,
      })
    : null;

  // Guardrail
  const guardrail = params.guardrailEnabled
    ? new GuardrailStack(app, `GuardrailStack${params.env}`, {
        env: {
          account: params.account,
          region: params.modelRegion,
        },
        crossRegionReferences: true,
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
        params,
      }
    );

    videoBucketRegionMap[region] = videoTmpBucketStack.bucketName;
  }

  // GenU Stack
  const isSageMakerStudio = 'SAGEMAKER_APP_TYPE_LOWERCASE' in process.env;
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
      // Agent
      agents: agentStack?.agents,
      // Video Generation
      videoBucketRegionMap,
      // Guardrail
      guardrailIdentifier: guardrail?.guardrailIdentifier,
      guardrailVersion: 'DRAFT',
      // WAF
      webAclId: cloudFrontWafStack?.webAclArn,
      // Custom Domain
      cert: cloudFrontWafStack?.cert,
      // Image build environment
      isSageMakerStudio,
    }
  );

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
    cloudFrontWafStack,
    ragKnowledgeBaseStack,
    agentStack,
    guardrail,
    generativeAiUseCasesStack,
    dashboardStack,
  };
};
