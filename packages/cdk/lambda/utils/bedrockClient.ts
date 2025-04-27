import { STSClient, AssumeRoleCommand, Credentials } from '@aws-sdk/client-sts';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockAgentClient } from '@aws-sdk/client-bedrock-agent';
import { S3Client } from '@aws-sdk/client-s3';

export const defaultRegion = process.env.MODEL_REGION as string;

// Temporary credentials for cross-account access
const stsClient = new STSClient();
let temporaryCredentials: Credentials | undefined;

// Function to get temporary credentials from STS
const assumeRole = async (crossAccountBedrockRoleArn: string) => {
  const command = new AssumeRoleCommand({
    RoleArn: crossAccountBedrockRoleArn,
    RoleSessionName: 'BedrockApiAccess',
  });
  try {
    const response = await stsClient.send(command);
    if (response.Credentials) {
      temporaryCredentials = response.Credentials;
    } else {
      throw new Error('Failed to get credentials.');
    }
  } catch (error) {
    console.error('Error assuming role: ', error);
    throw error;
  }
};

// Check if the temporary credentials will expire within 3 seconds
const isCredentialRefreshRequired = () => {
  return temporaryCredentials?.Expiration?.getTime() ?? 0 + 3000 < Date.now();
};

// Get Bedrock client params. By default, we initializes the Bedrock client in the region specified by the environment variable.
// There is a special case where you want to use Bedrock resources in a different AWS account.
// In that case, check if the CROSS_ACCOUNT_BEDROCK_ROLE_ARN environment variable is set. (It is set as an environment variable if crossAccountBedrockRoleArn is set in cdk.json)
// If it is set, assume the specified role and initialize the Bedrock client using the temporary credentials obtained.
// This allows access to Bedrock resources in a different AWS account.
const getClientParams = async (region: string) => {
  if (process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN) {
    // Get temporary credentials from STS and initialize the client
    if (isCredentialRefreshRequired()) {
      await assumeRole(process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN);
    }
    if (
      !temporaryCredentials ||
      !temporaryCredentials.AccessKeyId ||
      !temporaryCredentials.SecretAccessKey ||
      !temporaryCredentials.SessionToken
    ) {
      throw new Error('The temporary credentials from STS are incomplete.');
    }
    return {
      region,
      credentials: {
        accessKeyId: temporaryCredentials.AccessKeyId,
        secretAccessKey: temporaryCredentials.SecretAccessKey,
        sessionToken: temporaryCredentials.SessionToken,
      },
    };
  } else {
    // Initialize the client without using STS
    return { region };
  }
};

export const initBedrockRuntimeClient = async (region: string) => {
  return new BedrockRuntimeClient(await getClientParams(region));
};

export const initBedrockAgentClient = async (region: string) => {
  return new BedrockAgentClient(await getClientParams(region));
};

export const initBedrockAgentRuntimeClient = async (region: string) => {
  return new BedrockAgentRuntimeClient(await getClientParams(region));
};

export const initKbS3Client = async (region: string) => {
  return new S3Client(await getClientParams(region));
};
