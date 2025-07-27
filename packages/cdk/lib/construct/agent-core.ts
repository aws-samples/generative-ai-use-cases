import { Construct } from 'constructs';
import { IdentityPool } from 'aws-cdk-lib/aws-cognito-identitypool';
import { Effect, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AgentCoreConfiguration } from 'generative-ai-use-cases';

export interface AgentCoreProps {
  readonly agentCoreExternalRuntimes: AgentCoreConfiguration[];
  readonly idPool: IdentityPool;
  readonly genericRuntimeArn?: string; // ARN from the separate AgentCore stack
  readonly genericRuntimeName?: string; // Name from the separate AgentCore stack
}

export class AgentCore extends Construct {
  private readonly _genericRuntimeArn?: string;
  private readonly _genericRuntimeName?: string;

  constructor(scope: Construct, id: string, props: AgentCoreProps) {
    super(scope, id);

    this._genericRuntimeArn = props.genericRuntimeArn;
    this._genericRuntimeName = props.genericRuntimeName;

    // Grant invoke permissions to identity pool
    this.grantInvokePermissions(props.idPool, props.agentCoreExternalRuntimes);
  }

  /**
   * Grant invoke permissions to identity pool for all runtimes
   */
  private grantInvokePermissions(
    idPool: IdentityPool,
    externalRuntimes: AgentCoreConfiguration[]
  ): void {
    const resources = [
      ...(this._genericRuntimeArn ? [this._genericRuntimeArn + '*'] : []),
      ...externalRuntimes.map((runtime) => runtime.arn + '*'),
    ];

    if (resources.length > 0) {
      idPool.authenticatedRole.attachInlinePolicy(
        new Policy(this, 'AgentCoreRuntimePolicy', {
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['bedrock-agentcore:InvokeAgentRuntime'],
              resources: resources,
            }),
          ],
        })
      );
    }
  }

  /**
   * Get deployed generic runtime ARN
   */
  public get deployedGenericRuntimeArn(): string | undefined {
    return this._genericRuntimeArn;
  }

  /**
   * Get all available runtime ARNs (deployed + external)
   */
  public getAllRuntimeArns(): string[] {
    const arns: string[] = [];
    if (this._genericRuntimeArn) {
      arns.push(this._genericRuntimeArn);
    }
    // The external runtimes are passed as props, so we don't need to list them here.
    return arns;
  }

  /**
   * Get deployed runtime ARNs only
   */
  public getDeployedRuntimeArns(): string[] {
    const arns: string[] = [];
    if (this._genericRuntimeArn) {
      arns.push(this._genericRuntimeArn);
    }
    return arns;
  }

  /**
   * Check if AgentCore is enabled and has any runtimes
   */
  public get hasRuntimes(): boolean {
    return !!this._genericRuntimeArn;
  }

  /**
   * Get the generic runtime configuration
   */
  public getGenericRuntimeConfig(): { name: string } {
    return { name: this._genericRuntimeName || 'GenericAgentCoreRuntime' };
  }
}
