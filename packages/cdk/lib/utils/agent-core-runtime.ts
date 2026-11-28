import { CfnRuntime } from 'aws-cdk-lib/aws-bedrockagentcore';
import { Runtime } from '@aws-cdk/aws-bedrock-agentcore-alpha';

export type AgentCoreRuntimePlatformVersion = 'V1' | 'V2';

/**
 * Set the platform version of an AgentCore Runtime. The alpha Runtime
 * construct has no property for it yet, so set it on the L1 resource.
 * V1 leaves the template as it was, since V1 is the default.
 */
export const setRuntimePlatformVersion = (
  runtime: Runtime,
  platformVersion: AgentCoreRuntimePlatformVersion = 'V1'
): void => {
  if (platformVersion === 'V1') return;
  (runtime.node.defaultChild as CfnRuntime).addPropertyOverride(
    'PlatformVersion',
    platformVersion
  );
};
