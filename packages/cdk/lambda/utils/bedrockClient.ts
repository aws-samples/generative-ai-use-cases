import { STSClient, AssumeRoleCommand, Credentials } from '@aws-sdk/client-sts';
import {
  BedrockRuntimeClient,
  BedrockRuntimeClientConfig,
} from '@aws-sdk/client-bedrock-runtime';
import {
  BedrockAgentRuntimeClient,
  BedrockAgentRuntimeClientConfig,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import {
  BedrockAgentClient,
  BedrockAgentClientConfig,
} from '@aws-sdk/client-bedrock-agent';

// Temporary credentials for cross-account access
const stsClient = new STSClient();
let temporaryCredentials: Credentials | undefined;

// Store Bedrock clients
let bedrockRuntimeClient: BedrockRuntimeClient | undefined;
let bedrockAgentClient: BedrockAgentClient | undefined;
let bedrockAgentRuntimeClient: BedrockAgentRuntimeClient | undefined;
let knowledgeBaseS3Client: S3Client | undefined;

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

// Check if the temporary credentials will expire within 1 minute
const isCredentialRefreshRequired = () => {
  return (
    !temporaryCredentials?.Expiration || // expiration is undefined
    temporaryCredentials.Expiration.getTime() - Date.now() < 60_000 // expiration is less than 1 minute
  );
};

// Get AWS credentials for cross account access.
// Assume the specified role and check if the obtained temporary credentials are valid.
// This allows access to AWS resources in a different AWS account.
const getCrossAccountCredentials = async (
  crossAccountBedrockRoleArn: string
) => {
  // Get temporary credentials from STS and initialize the client
  if (isCredentialRefreshRequired()) {
    await assumeRole(crossAccountBedrockRoleArn);
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
    credentials: {
      accessKeyId: temporaryCredentials.AccessKeyId,
      secretAccessKey: temporaryCredentials.SecretAccessKey,
      sessionToken: temporaryCredentials.SessionToken,
    },
  };
};

export const initBedrockRuntimeClient = async (
  config: BedrockRuntimeClientConfig & { region: string }
) => {
  // Use cross-account role
  if (process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN) {
    return new BedrockRuntimeClient({
      ...(await getCrossAccountCredentials(
        process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN
      )),
      ...config,
    });
  }
  // Use Lambda execution role
  if (!bedrockRuntimeClient) {
    bedrockRuntimeClient = new BedrockRuntimeClient(config);
  }
  return bedrockRuntimeClient;
};

export const initBedrockAgentClient = async (
  config: BedrockAgentClientConfig & { region: string }
) => {
  // Use cross-account role
  if (process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN) {
    return new BedrockAgentClient({
      ...(await getCrossAccountCredentials(
        process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN
      )),
      ...config,
    });
  }
  // Use Lambda execution role
  if (!bedrockAgentClient) {
    bedrockAgentClient = new BedrockAgentClient(config);
  }
  return bedrockAgentClient;
};

export const initBedrockAgentRuntimeClient = async (
  config: BedrockAgentRuntimeClientConfig & { region: string }
) => {
  // Use cross-account role
  if (process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN) {
    return new BedrockAgentRuntimeClient({
      ...(await getCrossAccountCredentials(
        process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN
      )),
      ...config,
    });
  }
  // Use Lambda execution role
  if (!bedrockAgentRuntimeClient) {
    bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient(config);
  }
  return bedrockAgentRuntimeClient;
};

export const initKnowledgeBaseS3Client = async (
  config: S3ClientConfig & { region: string }
) => {
  // Use cross-account role (to get pre-signed URLs for S3 objects in a different account)
  if (process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN) {
    return new S3Client({
      ...(await getCrossAccountCredentials(
        process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN
      )),
      ...config,
    });
  }
  // Use Lambda execution role
  if (!knowledgeBaseS3Client) {
    knowledgeBaseS3Client = new S3Client(config);
  }
  return knowledgeBaseS3Client;
};
