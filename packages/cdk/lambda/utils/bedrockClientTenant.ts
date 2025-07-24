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
import { getTenantClientConfig } from './tenantAuth';

// Store Bedrock clients per tenant
const bedrockRuntimeClientByTenant: Record<string, Record<string, BedrockRuntimeClient>> = {};
const bedrockAgentClientByTenant: Record<string, Record<string, BedrockAgentClient>> = {};
const bedrockAgentRuntimeClientByTenant: Record<string, Record<string, BedrockAgentRuntimeClient>> = {};
const knowledgeBaseS3ClientByTenant: Record<string, Record<string, S3Client>> = {};

/**
 * Initialize Bedrock Runtime client with tenant-specific credentials
 */
export const initTenantBedrockRuntimeClient = async (
  config: BedrockRuntimeClientConfig & { region: string },
  tenantId: string,
  credentials: Credentials
): Promise<BedrockRuntimeClient> => {
  // Initialize tenant client store if not exists
  if (!bedrockRuntimeClientByTenant[tenantId]) {
    bedrockRuntimeClientByTenant[tenantId] = {};
  }

  // Create client if not exists for this tenant and region
  if (!(config.region in bedrockRuntimeClientByTenant[tenantId])) {
    bedrockRuntimeClientByTenant[tenantId][config.region] = new BedrockRuntimeClient({
      ...config,
      ...getTenantClientConfig(credentials),
    });
  }

  return bedrockRuntimeClientByTenant[tenantId][config.region];
};

/**
 * Initialize Bedrock Agent client with tenant-specific credentials
 */
export const initTenantBedrockAgentClient = async (
  config: BedrockAgentClientConfig & { region: string },
  tenantId: string,
  credentials: Credentials
): Promise<BedrockAgentClient> => {
  // Initialize tenant client store if not exists
  if (!bedrockAgentClientByTenant[tenantId]) {
    bedrockAgentClientByTenant[tenantId] = {};
  }

  // Create client if not exists for this tenant and region
  if (!(config.region in bedrockAgentClientByTenant[tenantId])) {
    bedrockAgentClientByTenant[tenantId][config.region] = new BedrockAgentClient({
      ...config,
      ...getTenantClientConfig(credentials),
    });
  }

  return bedrockAgentClientByTenant[tenantId][config.region];
};

/**
 * Initialize Bedrock Agent Runtime client with tenant-specific credentials
 */
export const initTenantBedrockAgentRuntimeClient = async (
  config: BedrockAgentRuntimeClientConfig & { region: string },
  tenantId: string,
  credentials: Credentials
): Promise<BedrockAgentRuntimeClient> => {
  // Initialize tenant client store if not exists
  if (!bedrockAgentRuntimeClientByTenant[tenantId]) {
    bedrockAgentRuntimeClientByTenant[tenantId] = {};
  }

  // Create client if not exists for this tenant and region
  if (!(config.region in bedrockAgentRuntimeClientByTenant[tenantId])) {
    bedrockAgentRuntimeClientByTenant[tenantId][config.region] = new BedrockAgentRuntimeClient({
      ...config,
      ...getTenantClientConfig(credentials),
    });
  }

  return bedrockAgentRuntimeClientByTenant[tenantId][config.region];
};

/**
 * Initialize S3 client with tenant-specific credentials
 */
export const initTenantKnowledgeBaseS3Client = async (
  config: S3ClientConfig & { region: string },
  tenantId: string,
  credentials: Credentials
): Promise<S3Client> => {
  // Initialize tenant client store if not exists
  if (!knowledgeBaseS3ClientByTenant[tenantId]) {
    knowledgeBaseS3ClientByTenant[tenantId] = {};
  }

  // Create client if not exists for this tenant and region
  if (!(config.region in knowledgeBaseS3ClientByTenant[tenantId])) {
    knowledgeBaseS3ClientByTenant[tenantId][config.region] = new S3Client({
      ...config,
      ...getTenantClientConfig(credentials),
    });
  }

  return knowledgeBaseS3ClientByTenant[tenantId][config.region];
};

/**
 * Clean up tenant clients to free memory (optional - for long-running Lambda)
 */
export const cleanupTenantClients = (tenantId: string): void => {
  delete bedrockRuntimeClientByTenant[tenantId];
  delete bedrockAgentClientByTenant[tenantId];
  delete bedrockAgentRuntimeClientByTenant[tenantId];
  delete knowledgeBaseS3ClientByTenant[tenantId];
};