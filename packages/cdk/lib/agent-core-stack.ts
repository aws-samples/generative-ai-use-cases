import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { GenericAgentCore } from './construct/generic-agent-core';
import { ProcessedStackInput } from './stack-input';

export interface AgentCoreStackProps extends StackProps {
  readonly params: ProcessedStackInput;
}

export class AgentCoreStack extends Stack {
  public readonly genericAgentCore?: GenericAgentCore;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    const params = props.params;

    // Deploy Generic AgentCore Runtime if enabled
    if (params.createGenericAgentCoreRuntime) {
      this.genericAgentCore = new GenericAgentCore(this, 'GenericAgentCore');

      // Output the runtime ARN for cross-stack reference
      new CfnOutput(this, 'GenericAgentCoreRuntimeArn', {
        value: this.genericAgentCore.deployedGenericRuntimeArn || '',
        exportName: `${this.stackName}-GenericAgentCoreRuntimeArn`,
      });

      new CfnOutput(this, 'GenericAgentCoreRuntimeName', {
        value: this.genericAgentCore.getGenericRuntimeConfig().name,
        exportName: `${this.stackName}-GenericAgentCoreRuntimeName`,
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
   * Get the generic runtime configuration
   */
  public getGenericRuntimeConfig() {
    return this.genericAgentCore?.getGenericRuntimeConfig();
  }
}
