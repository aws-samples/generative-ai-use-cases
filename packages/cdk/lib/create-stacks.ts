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
import { ApplicationInferenceProfileStack } from './application-inference-profile-stack';

class DeletionPolicySetter implements cdk.IAspect {
  constructor(private readonly policy: cdk.RemovalPolicy) {}

  visit(node: IConstruct): void {
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(this.policy);
    }
  }
}

// Merges inference profile ARNs into ModelIds and returns a new array
const mergeModelIdsAndInferenceProfileArn = (
  modelIds: ProcessedStackInput['modelIds'],
  inferenceProfileStacks: Record<string, ApplicationInferenceProfileStack>
) => {
  return modelIds.map((modelId) => {
    const result = { ...modelId };
    const stack = inferenceProfileStacks[modelId.region];
    if (stack && stack.inferenceProfileArns[modelId.modelId]) {
      result.inferenceProfileArn = stack.inferenceProfileArns[modelId.modelId];
    }
    return result;
  });
};

export const createStacks = (app: cdk.App, params: ProcessedStackInput) => {
  // Create an ApplicationInferenceProfile for each region of the model to be used
  const modelRegions = [
    ...new Set([
      ...params.modelIds.map((model) => model.region),
      ...params.imageGenerationModelIds.map((model) => model.region),
      ...params.videoGenerationModelIds.map((model) => model.region),
      ...params.speechToSpeechModelIds.map((model) => model.region),
    ]),
  ];
  const inferenceProfileStacks: Record<
    string,
    ApplicationInferenceProfileStack
  > = {};
  for (const region of modelRegions) {
    const applicationInferenceProfileStack =
      new ApplicationInferenceProfileStack(
        app,
        `ApplicationInferenceProfileStack${params.env}${region}`,
        {
          env: {
            account: params.account,
            region,
          },
          params,
        }
      );
    inferenceProfileStacks[region] = applicationInferenceProfileStack;
  }

  // Set inference profile ARNs to model IDs
  const updatedParams: ProcessedStackInput = JSON.parse(JSON.stringify(params));
  updatedParams.modelIds = mergeModelIdsAndInferenceProfileArn(
    params.modelIds,
    inferenceProfileStacks
  );
  updatedParams.imageGenerationModelIds = mergeModelIdsAndInferenceProfileArn(
    params.imageGenerationModelIds,
    inferenceProfileStacks
  );
  updatedParams.videoGenerationModelIds = mergeModelIdsAndInferenceProfileArn(
    params.videoGenerationModelIds,
    inferenceProfileStacks
  );
  updatedParams.speechToSpeechModelIds = mergeModelIdsAndInferenceProfileArn(
    params.speechToSpeechModelIds,
    inferenceProfileStacks
  );

  // CloudFront WAF
  // Only deploy CloudFrontWafStack if IP address range (v4 or v6) or geographic restriction is defined
  // WAF v2 is only deployable in us-east-1, so the Stack is separated
  const cloudFrontWafStack =
    updatedParams.allowedIpV4AddressRanges ||
    updatedParams.allowedIpV6AddressRanges ||
    updatedParams.allowedCountryCodes ||
    updatedParams.hostName
      ? new CloudFrontWafStack(app, `CloudFrontWafStack${updatedParams.env}`, {
          env: {
            account: updatedParams.account,
            region: 'us-east-1',
          },
          params: updatedParams,
          crossRegionReferences: true,
        })
      : null;

  // RAG Knowledge Base
  const ragKnowledgeBaseStack =
    updatedParams.ragKnowledgeBaseEnabled && !updatedParams.ragKnowledgeBaseId
      ? new RagKnowledgeBaseStack(
          app,
          `RagKnowledgeBaseStack${updatedParams.env}`,
          {
            env: {
              account: updatedParams.account,
              region: updatedParams.modelRegion,
            },
            params: updatedParams,
            crossRegionReferences: true,
          }
        )
      : null;

  // Agent
  if (updatedParams.crossAccountBedrockRoleArn) {
    if (updatedParams.agentEnabled || updatedParams.searchApiKey) {
      throw new Error(
        'When `crossAccountBedrockRoleArn` is specified, the `agentEnabled` and `searchApiKey` parameters are not supported. Please create agents in the other account and specify them in the `agents` parameter.'
      );
    }
  }
  const agentStack = updatedParams.agentEnabled
    ? new AgentStack(app, `WebSearchAgentStack${updatedParams.env}`, {
        env: {
          account: updatedParams.account,
          region: updatedParams.modelRegion,
        },
        params: updatedParams,
        crossRegionReferences: true,
      })
    : null;

  // Guardrail
  const guardrail = updatedParams.guardrailEnabled
    ? new GuardrailStack(app, `GuardrailStack${updatedParams.env}`, {
        env: {
          account: updatedParams.account,
          region: updatedParams.modelRegion,
        },
        crossRegionReferences: true,
      })
    : null;

  // Create S3 Bucket for each unique region for StartAsyncInvoke in video generation
  // because the S3 Bucket must be in the same region as Bedrock Runtime
  const videoModelRegions = [
    ...new Set(
      updatedParams.videoGenerationModelIds.map((model) => model.region)
    ),
  ];
  const videoBucketRegionMap: Record<string, string> = {};

  for (const region of videoModelRegions) {
    const videoTmpBucketStack = new VideoTmpBucketStack(
      app,
      `VideoTmpBucketStack${updatedParams.env}${region}`,
      {
        env: {
          account: updatedParams.account,
          region,
        },
        params: updatedParams,
      }
    );

    videoBucketRegionMap[region] = videoTmpBucketStack.bucketName;
  }

  // GenU Stack
  const isSageMakerStudio = 'SAGEMAKER_APP_TYPE_LOWERCASE' in process.env;
  const generativeAiUseCasesStack = new GenerativeAiUseCasesStack(
    app,
    `GenerativeAiUseCasesStack${updatedParams.env}`,
    {
      env: {
        account: updatedParams.account,
        region: updatedParams.region,
      },
      description: updatedParams.anonymousUsageTracking
        ? 'Generative AI Use Cases (uksb-1tupboc48)'
        : undefined,
      params: updatedParams,
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

  const dashboardStack = updatedParams.dashboard
    ? new DashboardStack(
        app,
        `GenerativeAiUseCasesDashboardStack${updatedParams.env}`,
        {
          env: {
            account: updatedParams.account,
            region: updatedParams.modelRegion,
          },
          params: updatedParams,
          userPool: generativeAiUseCasesStack.userPool,
          userPoolClient: generativeAiUseCasesStack.userPoolClient,
          appRegion: updatedParams.region,
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
