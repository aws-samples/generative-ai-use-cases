import {
  BedrockAgentCoreControlClient,
  CreateAgentRuntimeCommand,
  UpdateAgentRuntimeCommand,
  DeleteAgentRuntimeCommand,
  CreateAgentRuntimeRequest,
  UpdateAgentRuntimeRequest,
} from '@aws-sdk/client-bedrock-agentcore-control';

// Types for Custom Resource
interface CloudFormationCustomResourceEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  ResourceProperties: {
    AgentCoreRuntimeName: string;
    RoleArn: string;
    NetworkMode: string;
    ServerProtocol: string;
    CustomConfig: Record<string, unknown>;
  };
  PhysicalResourceId?: string;
}

interface AgentCoreRuntimeConfig {
  name: string;
  roleArn: string;
  networkMode: string;
  serverProtocol: string;
  containerImageUri: string;
  environmentVariables?: Record<string, string>;
}

interface CustomResourceResponse {
  PhysicalResourceId: string;
  Data?: {
    AgentCoreRuntimeId: string;
    AgentCoreRuntimeArn: string;
  };
}

/**
 * Create AgentCore Runtime using AWS SDK
 */
async function createAgentRuntime(
  client: BedrockAgentCoreControlClient,
  config: AgentCoreRuntimeConfig
): Promise<{ agentRuntimeId: string; agentRuntimeArn: string }> {
  console.log(`Creating AgentCore Runtime: ${config.name}`);

  if (!config.containerImageUri) {
    throw new Error('containerImageUri is required for AgentCore Runtime');
  }
  if (!config.serverProtocol) {
    throw new Error('serverProtocol is required for AgentCore Runtime');
  }

  const createParams: CreateAgentRuntimeRequest = {
    agentRuntimeName: config.name,
    agentRuntimeArtifact: {
      containerConfiguration: {
        containerUri: config.containerImageUri,
      },
    },
    roleArn: config.roleArn,
    networkConfiguration: {
      networkMode: (config.networkMode === 'DEFAULT'
        ? 'PUBLIC'
        : config.networkMode) as any,
    },
    protocolConfiguration: {
      serverProtocol: config.serverProtocol as any,
    },
    ...(config.environmentVariables && {
      environmentVariables: config.environmentVariables,
    }),
  };

  console.log('Create parameters:', JSON.stringify(createParams, null, 2));

  const command = new CreateAgentRuntimeCommand(createParams);
  const response = await client.send(command);

  if (!response.agentRuntimeId || !response.agentRuntimeArn) {
    throw new Error(
      'Failed to create AgentCore Runtime - missing ID or ARN in response'
    );
  }

  console.log(
    `Successfully created AgentCore Runtime: ${response.agentRuntimeId}`
  );

  return {
    agentRuntimeId: response.agentRuntimeId,
    agentRuntimeArn: response.agentRuntimeArn,
  };
}

/**
 * Update AgentCore Runtime using AWS SDK
 */
async function updateAgentRuntime(
  client: BedrockAgentCoreControlClient,
  agentRuntimeId: string,
  config: AgentCoreRuntimeConfig
): Promise<{ agentRuntimeId: string; agentRuntimeArn: string }> {
  console.log(`Updating AgentCore Runtime: ${agentRuntimeId}`);

  if (!config.containerImageUri) {
    throw new Error(
      'containerImageUri is required for AgentCore Runtime update'
    );
  }
  if (!config.serverProtocol) {
    throw new Error('serverProtocol is required for AgentCore Runtime update');
  }

  const updateParams: UpdateAgentRuntimeRequest = {
    agentRuntimeId,
    agentRuntimeArtifact: {
      containerConfiguration: {
        containerUri: config.containerImageUri,
      },
    },
    roleArn: config.roleArn,
    networkConfiguration: {
      networkMode: (config.networkMode === 'DEFAULT'
        ? 'PUBLIC'
        : config.networkMode) as any,
    },
    protocolConfiguration: {
      serverProtocol: config.serverProtocol as any,
    },
    ...(config.environmentVariables && {
      environmentVariables: config.environmentVariables,
    }),
  };

  console.log('Update parameters:', JSON.stringify(updateParams, null, 2));

  const command = new UpdateAgentRuntimeCommand(updateParams);
  const response = await client.send(command);

  console.log(`Successfully updated AgentCore Runtime: ${agentRuntimeId}`);

  return {
    agentRuntimeId,
    agentRuntimeArn:
      response.agentRuntimeArn ||
      `arn:aws:bedrock-agentcore:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:runtime/${agentRuntimeId}`,
  };
}

/**
 * Delete AgentCore Runtime using AWS SDK
 */
async function deleteAgentRuntime(
  client: BedrockAgentCoreControlClient,
  agentRuntimeId: string
): Promise<void> {
  console.log(`Deleting AgentCore Runtime: ${agentRuntimeId}`);

  try {
    const deleteParams = { agentRuntimeId };
    const command = new DeleteAgentRuntimeCommand(deleteParams);
    await client.send(command);
    console.log(`Successfully deleted AgentCore Runtime: ${agentRuntimeId}`);
  } catch (error: any) {
    console.log(`Delete error for AgentCore Runtime ${agentRuntimeId}:`, error);

    // Simplified error handling: Only handle resource not found
    if (
      error.name === 'ResourceNotFoundException' ||
      error.message?.includes('not found') ||
      error.message?.includes('does not exist')
    ) {
      console.log(
        `AgentCore Runtime ${agentRuntimeId} already deleted or not found`
      );
      return; // Success case
    }

    // For all other errors, let them bubble up
    // CloudFormation will handle resource abandonment as designed
    throw error;
  }
}

/**
 * Main Lambda handler for CustomResource using Provider Framework
 */
export async function handler(
  event: CloudFormationCustomResourceEvent
): Promise<CustomResourceResponse> {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const { RequestType, ResourceProperties, PhysicalResourceId } = event;
  const {
    AgentCoreRuntimeName: agentRuntimeName,
    CustomConfig: customConfig = {},
    RoleArn: roleArn,
    NetworkMode: networkMode,
    ServerProtocol: serverProtocol,
  } = ResourceProperties;

  // Extract configuration
  const config: AgentCoreRuntimeConfig = {
    name: agentRuntimeName,
    roleArn,
    networkMode,
    serverProtocol,
    containerImageUri: (customConfig as any).containerImageUri,
    environmentVariables: (customConfig as any).environmentVariables,
  };

  const client = new BedrockAgentCoreControlClient({
    region: process.env.AWS_REGION,
  });

  try {
    switch (RequestType) {
      case 'Create': {
        const { agentRuntimeId, agentRuntimeArn } = await createAgentRuntime(
          client,
          config
        );

        return {
          PhysicalResourceId: agentRuntimeId,
          Data: {
            AgentCoreRuntimeId: agentRuntimeId,
            AgentCoreRuntimeArn: agentRuntimeArn,
          },
        };
      }

      case 'Update': {
        if (!PhysicalResourceId) {
          throw new Error('PhysicalResourceId is required for Update');
        }

        const { agentRuntimeId, agentRuntimeArn } = await updateAgentRuntime(
          client,
          PhysicalResourceId,
          config
        );

        return {
          PhysicalResourceId: agentRuntimeId,
          Data: {
            AgentCoreRuntimeId: agentRuntimeId,
            AgentCoreRuntimeArn: agentRuntimeArn,
          },
        };
      }

      case 'Delete': {
        console.log(
          `Processing Delete request for PhysicalResourceId: ${PhysicalResourceId}`
        );

        // Simple validation: Only process if we have a valid resource ID
        if (
          !PhysicalResourceId ||
          PhysicalResourceId === 'deleted' ||
          PhysicalResourceId === 'failed'
        ) {
          console.log(`No valid resource to delete: ${PhysicalResourceId}`);
          return {
            PhysicalResourceId: PhysicalResourceId || 'deleted',
          };
        }

        // Simple delete operation - let errors bubble up naturally
        await deleteAgentRuntime(client, PhysicalResourceId);

        return {
          PhysicalResourceId: PhysicalResourceId,
        };
      }

      default:
        throw new Error(`Unknown request type: ${RequestType}`);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    console.log('Request details:', {
      RequestType,
      PhysicalResourceId,
      LogicalResourceId: event.LogicalResourceId,
    });

    // Simple error handling: Re-throw the error
    // Provider Framework will handle CloudFormation response
    throw error;
  }
}
