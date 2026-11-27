import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ResearchAgentCore } from './construct/research-agent-core';
import { ProcessedStackInput } from './stack-input';
import { BucketInfo } from 'generative-ai-use-cases';
import { REMOTE_OUTPUT_KEYS } from './remote-output-keys';

export interface ResearchAgentCoreStackProps extends StackProps {
  readonly params: ProcessedStackInput;
}

export class ResearchAgentCoreStack extends Stack {
  public researchAgentCore?: ResearchAgentCore;

  constructor(
    scope: Construct,
    id: string,
    props: ResearchAgentCoreStackProps
  ) {
    super(scope, id, props);

    const params = props.params;

    // Deploy Research AgentCore Runtime if enabled
    if (params.researchAgentEnabled) {
      this.researchAgentCore = new ResearchAgentCore(
        this,
        'ResearchAgentCore',
        {
          env: params.env,
          braveApiKey: params.researchAgentBraveApiKey,
          tavilyApiKey: params.researchAgentTavilyApiKey,
          gatewayArns: params.agentCoreGatewayArns ?? undefined,
        }
      );

      // Export runtime info for cross-region access
      if (this.researchAgentCore.deployedRuntimeArn) {
        new CfnOutput(
          this,
          REMOTE_OUTPUT_KEYS.RESEARCH_AGENT_CORE_RUNTIME_ARN,
          {
            value: this.researchAgentCore.deployedRuntimeArn,
          }
        );

        new CfnOutput(
          this,
          REMOTE_OUTPUT_KEYS.RESEARCH_AGENT_CORE_RUNTIME_NAME,
          {
            value: `GenUResearchRuntime${params.env}`,
          }
        );
      }

      // Export file bucket name
      new CfnOutput(this, REMOTE_OUTPUT_KEYS.RESEARCH_AGENT_FILE_BUCKET_NAME, {
        value: this.researchAgentCore.fileBucket.bucketName,
      });

      // Kept for the main stack's former import (see AgentCoreStack).
      this.exportValue(this.researchAgentCore.fileBucket.bucketName);
    }
  }

  /**
   * Get the deployed research runtime ARN
   */
  public get deployedRuntimeArn(): string | undefined {
    return this.researchAgentCore?.deployedRuntimeArn;
  }

  /**
   * Get the file bucket for Research Agent Core Runtime
   */
  public get fileBucket() {
    return this.researchAgentCore?.fileBucket;
  }

  /**
   * Get the file bucket information (bucket name and region)
   */
  public get fileBucketInfo(): BucketInfo | undefined {
    return this.researchAgentCore?.fileBucketInfo;
  }
}
