import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { GenericAgentCore } from './construct/generic-agent-core';
import { ProcessedStackInput } from './stack-input';
import { BucketInfo } from 'generative-ai-use-cases';
import { REMOTE_OUTPUT_KEYS } from './remote-output-keys';

export interface AgentCoreStackProps extends StackProps {
  readonly params: ProcessedStackInput;
}

export class AgentCoreStack extends Stack {
  public genericAgentCore?: GenericAgentCore;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    const params = props.params;

    // Deploy Generic AgentCore Runtime if either generic or agentBuilder is enabled
    if (params.createGenericAgentCoreRuntime || params.agentBuilderEnabled) {
      this.genericAgentCore = new GenericAgentCore(this, 'GenericAgentCore', {
        env: params.env,
        createGenericRuntime: params.createGenericAgentCoreRuntime,
        createAgentBuilderRuntime: params.agentBuilderEnabled,
        isAgentCoreNetworkPrivate: params.isAgentCoreNetworkPrivate,
        agentCoreVpcId: params.agentCoreVpcId,
        agentCoreSubnetIds: params.agentCoreSubnetIds,
        gatewayArns: params.agentCoreGatewayArns ?? undefined,
      });

      // Outputs read by GenerativeAiUseCasesStack via StackOutputs, also across Regions (only if values exist)
      if (
        params.createGenericAgentCoreRuntime &&
        this.genericAgentCore.deployedGenericRuntimeArn
      ) {
        new CfnOutput(this, REMOTE_OUTPUT_KEYS.GENERIC_AGENT_CORE_RUNTIME_ARN, {
          value: this.genericAgentCore.deployedGenericRuntimeArn,
        });

        new CfnOutput(
          this,
          REMOTE_OUTPUT_KEYS.GENERIC_AGENT_CORE_RUNTIME_NAME,
          {
            value: this.genericAgentCore.getGenericRuntimeConfig().name,
          }
        );
      }

      // Output retained security group ID for manual cleanup
      if (this.genericAgentCore.retainedSecurityGroupId) {
        new CfnOutput(this, 'RetainedSecurityGroupId', {
          value: this.genericAgentCore.retainedSecurityGroupId,
          description:
            'MANUAL CLEANUP REQUIRED: Security Group ID to delete after AgentCore ENI cleanup (check tags: ManualCleanupRequired=true)',
        });
      }

      if (
        params.agentBuilderEnabled &&
        this.genericAgentCore.deployedAgentBuilderRuntimeArn
      ) {
        new CfnOutput(
          this,
          REMOTE_OUTPUT_KEYS.AGENT_BUILDER_AGENT_CORE_RUNTIME_ARN,
          {
            value: this.genericAgentCore.deployedAgentBuilderRuntimeArn,
          }
        );

        new CfnOutput(
          this,
          REMOTE_OUTPUT_KEYS.AGENT_BUILDER_AGENT_CORE_RUNTIME_NAME,
          {
            value: this.genericAgentCore.getAgentBuilderRuntimeConfig().name,
          }
        );
      }

      // Always export file bucket name as it always exists
      new CfnOutput(this, REMOTE_OUTPUT_KEYS.FILE_BUCKET_NAME, {
        value: this.genericAgentCore.fileBucket.bucketName,
      });
    }
  }

  /**
   * Get the deployed generic runtime ARN
   */
  public get deployedGenericRuntimeArn(): string | undefined {
    return this.genericAgentCore?.deployedGenericRuntimeArn;
  }

  /**
   * Get the deployed AgentBuilder runtime ARN
   */
  public get deployedAgentBuilderRuntimeArn(): string | undefined {
    return this.genericAgentCore?.deployedAgentBuilderRuntimeArn;
  }

  /**
   * Get the generic runtime configuration
   */
  public getGenericRuntimeConfig() {
    return this.genericAgentCore?.getGenericRuntimeConfig();
  }

  /**
   * Get the AgentBuilder runtime configuration
   */
  public getAgentBuilderRuntimeConfig() {
    return this.genericAgentCore?.getAgentBuilderRuntimeConfig();
  }

  /**
   * Get the file bucket for Agent Core Runtime
   */
  public get fileBucket() {
    return this.genericAgentCore?.fileBucket;
  }

  /**
   * Get the file bucket information (bucket name and region)
   */
  public get fileBucketInfo(): BucketInfo | undefined {
    return this.genericAgentCore?.fileBucketInfo;
  }
}
