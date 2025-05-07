import { STSClient, AssumeRoleCommand, Credentials } from '@aws-sdk/client-sts';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime';
import { S3Client } from '@aws-sdk/client-s3';

// Temporary credentials for cross-account access
const stsClient = new STSClient();
let temporaryCredentials: Credentials | undefined;

// Store Bedrock clients
let bedrockRuntimeClient: BedrockRuntimeClient | undefined;
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

// Get AWS client params for cross account access.
// Assume the specified role and check if the obtained temporary credentials are valid.
// This allows access to AWS resources in a different AWS account.
const getCrossAccountClientParams = async (
  region: string,
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
    region,
    credentials: {
      accessKeyId: temporaryCredentials.AccessKeyId,
      secretAccessKey: temporaryCredentials.SecretAccessKey,
      sessionToken: temporaryCredentials.SessionToken,
    },
  };
};

export const initBedrockRuntimeClient = async (region: string) => {
  // Use cross-account role
  if (process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN) {
    return new BedrockRuntimeClient(
      await getCrossAccountClientParams(
        region,
        process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN
      )
    );
  }
  // Use Lambda execution role
  if (!bedrockRuntimeClient) {
    bedrockRuntimeClient = new BedrockRuntimeClient({ region });
  }
  return bedrockRuntimeClient;
};

export const initBedrockAgentRuntimeClient = async (region: string) => {
  // Use cross-account role
  if (process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN) {
    return new BedrockAgentRuntimeClient(
      await getCrossAccountClientParams(
        region,
        process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN
      )
    );
  }
  // Use Lambda execution role
  if (!bedrockAgentRuntimeClient) {
    bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient({ region });
  }
  return bedrockAgentRuntimeClient;
};

export const initKnowledgeBaseS3Client = async (region: string) => {
  // Use cross-account role (to get pre-signed URLs for S3 objects in a different account)
  if (process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN) {
    return new S3Client(
      await getCrossAccountClientParams(
        region,
        process.env.CROSS_ACCOUNT_BEDROCK_ROLE_ARN
      )
    );
  }
  // Use Lambda execution role
  if (!knowledgeBaseS3Client) {
    knowledgeBaseS3Client = new S3Client({ region });
  }
  return knowledgeBaseS3Client;
};
