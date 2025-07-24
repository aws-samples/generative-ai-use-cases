import {
  S3Client,
  S3ClientConfig,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Credentials } from '@aws-sdk/client-sts';
import { getTenantClientConfig } from './tenantAuth';

// Store S3 clients per tenant
const s3ClientsByTenant: Record<string, S3Client> = {};

/**
 * Initialize S3 client with tenant-specific credentials
 */
export const initTenantS3Client = (
  tenantId: string,
  credentials: Credentials,
  config?: S3ClientConfig
): S3Client => {
  if (!s3ClientsByTenant[tenantId]) {
    s3ClientsByTenant[tenantId] = new S3Client({
      ...config,
      ...getTenantClientConfig(credentials),
    });
  }
  return s3ClientsByTenant[tenantId];
};

/**
 * Get tenant-specific S3 key prefix
 */
export const getTenantPrefix = (tenantId: string): string => {
  return `tenants/${tenantId}/`;
};

/**
 * Add tenant prefix to S3 key
 */
export const addTenantPrefixToKey = (tenantId: string, key: string): string => {
  const prefix = getTenantPrefix(tenantId);
  // Don't add prefix if it already exists
  if (key.startsWith(prefix)) {
    return key;
  }
  return `${prefix}${key}`;
};

/**
 * Remove tenant prefix from S3 key
 */
export const removeTenantPrefixFromKey = (tenantId: string, key: string): string => {
  const prefix = getTenantPrefix(tenantId);
  if (key.startsWith(prefix)) {
    return key.slice(prefix.length);
  }
  return key;
};

/**
 * Get object with tenant isolation
 */
export const getTenantObject = async (
  client: S3Client,
  bucketName: string,
  tenantId: string,
  key: string
) => {
  const tenantKey = addTenantPrefixToKey(tenantId, key);
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: tenantKey,
  });

  const response = await client.send(command);
  return response;
};

/**
 * Put object with tenant isolation
 */
export const putTenantObject = async (
  client: S3Client,
  bucketName: string,
  tenantId: string,
  key: string,
  body: string | Uint8Array | Buffer | ReadableStream,
  contentType?: string,
  metadata?: Record<string, string>
) => {
  const tenantKey = addTenantPrefixToKey(tenantId, key);
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: tenantKey,
    Body: body,
    ContentType: contentType,
    Metadata: {
      ...metadata,
      tenantId: tenantId,
    },
    Tagging: `TenantId=${tenantId}`,
  });

  const response = await client.send(command);
  return response;
};

/**
 * Delete object with tenant isolation
 */
export const deleteTenantObject = async (
  client: S3Client,
  bucketName: string,
  tenantId: string,
  key: string
) => {
  const tenantKey = addTenantPrefixToKey(tenantId, key);
  
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: tenantKey,
  });

  const response = await client.send(command);
  return response;
};

/**
 * List objects with tenant isolation
 */
export const listTenantObjects = async (
  client: S3Client,
  bucketName: string,
  tenantId: string,
  prefix?: string,
  maxKeys?: number
) => {
  const tenantPrefix = getTenantPrefix(tenantId);
  const fullPrefix = prefix ? `${tenantPrefix}${prefix}` : tenantPrefix;
  
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: fullPrefix,
    MaxKeys: maxKeys || 1000,
  });

  const response = await client.send(command);
  
  // Remove tenant prefix from keys in the response
  if (response.Contents) {
    response.Contents = response.Contents.map(obj => ({
      ...obj,
      Key: obj.Key ? removeTenantPrefixFromKey(tenantId, obj.Key) : obj.Key,
    }));
  }
  
  return response;
};

/**
 * Copy object within tenant boundaries
 */
export const copyTenantObject = async (
  client: S3Client,
  bucketName: string,
  tenantId: string,
  sourceKey: string,
  destinationKey: string
) => {
  const tenantSourceKey = addTenantPrefixToKey(tenantId, sourceKey);
  const tenantDestKey = addTenantPrefixToKey(tenantId, destinationKey);
  
  const command = new CopyObjectCommand({
    Bucket: bucketName,
    CopySource: `${bucketName}/${tenantSourceKey}`,
    Key: tenantDestKey,
    TaggingDirective: 'COPY',
  });

  const response = await client.send(command);
  return response;
};

/**
 * Get presigned URL for tenant object
 */
export const getTenantPresignedUrl = async (
  client: S3Client,
  bucketName: string,
  tenantId: string,
  key: string,
  operation: 'getObject' | 'putObject',
  expiresIn: number = 3600
): Promise<string> => {
  const tenantKey = addTenantPrefixToKey(tenantId, key);
  
  let command;
  if (operation === 'getObject') {
    command = new GetObjectCommand({
      Bucket: bucketName,
      Key: tenantKey,
    });
  } else {
    command = new PutObjectCommand({
      Bucket: bucketName,
      Key: tenantKey,
      Tagging: `TenantId=${tenantId}`,
    });
  }

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
};

/**
 * Check if object exists within tenant boundaries
 */
export const tenantObjectExists = async (
  client: S3Client,
  bucketName: string,
  tenantId: string,
  key: string
): Promise<boolean> => {
  const tenantKey = addTenantPrefixToKey(tenantId, key);
  
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: tenantKey,
    });
    
    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

/**
 * Clean up tenant client to free memory
 */
export const cleanupTenantS3Client = (tenantId: string): void => {
  delete s3ClientsByTenant[tenantId];
};