import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  CustomResource,
  CustomResourceProvider,
  CustomResourceProviderRuntime,
  Stack,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface StackOutputsProps {
  /** The stack whose outputs are read. It may be in another Region. */
  readonly stack: Stack;
  /** Output logical IDs to read. Each one must exist in `stack`. */
  readonly outputKeys: string[];
}

const RESOURCE_TYPE = 'Custom::GenUStackOutputs';

/**
 * Reads outputs of another stack in this app at deploy time.
 *
 * Unlike a cross-stack reference (`Fn::ImportValue`), this creates no export,
 * so the other stack can change or drop the value without the "export in use"
 * deadlock. Unlike `Fn::GetStackOutput`, the outputs are read again on every
 * deploy, so a changed value reaches the resources that use it: CloudFormation
 * only resolves `Fn::GetStackOutput` again when the resource that uses it
 * changes.
 */
export class StackOutputs extends Construct {
  private readonly resource: CustomResource;

  constructor(scope: Construct, id: string, props: StackOutputsProps) {
    super(scope, id);

    const provider = CustomResourceProvider.getOrCreateProvider(
      this,
      RESOURCE_TYPE,
      {
        codeDirectory: path.join(
          __dirname,
          '../../custom-resources/stack-outputs'
        ),
        runtime: CustomResourceProviderRuntime.NODEJS_22_X,
        policyStatements: [
          {
            Effect: 'Allow',
            Action: 'cloudformation:DescribeStacks',
            Resource: '*',
          },
        ],
      }
    );

    this.resource = new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      resourceType: RESOURCE_TYPE,
      properties: {
        StackName: props.stack.stackName,
        Region: props.stack.region,
        OutputKeys: props.outputKeys,
        // Changes on every synth, so the outputs are read on every deploy.
        // Resources that use them are only updated when a value changed.
        randomString: randomUUID(),
      },
    });

    // The outputs must be in place before they are read.
    Stack.of(this).addDependency(props.stack);
  }

  /** The value of an output listed in `outputKeys`. */
  get(key: string): string {
    return this.resource.getAttString(key);
  }
}
