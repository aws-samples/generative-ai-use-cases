import {
  DynamoDBClient,
  DynamoDBClientConfig,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  BatchGetItemCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Credentials } from '@aws-sdk/client-sts';
import { getTenantClientConfig } from './tenantAuth';

// Store DynamoDB clients per tenant
const dynamoClientsByTenant: Record<string, DynamoDBClient> = {};

/**
 * Initialize DynamoDB client with tenant-specific credentials
 */
export const initTenantDynamoDBClient = (
  tenantId: string,
  credentials: Credentials,
  config?: DynamoDBClientConfig
): DynamoDBClient => {
  if (!dynamoClientsByTenant[tenantId]) {
    dynamoClientsByTenant[tenantId] = new DynamoDBClient({
      ...config,
      ...getTenantClientConfig(credentials),
    });
  }
  return dynamoClientsByTenant[tenantId];
};

/**
 * Add tenant prefix to partition key
 */
export const addTenantPrefix = (tenantId: string, key: string): string => {
  return `${tenantId}#${key}`;
};

/**
 * Remove tenant prefix from partition key
 */
export const removeTenantPrefix = (tenantId: string, prefixedKey: string): string => {
  const prefix = `${tenantId}#`;
  return prefixedKey.startsWith(prefix) ? prefixedKey.slice(prefix.length) : prefixedKey;
};

/**
 * Get item with tenant isolation
 */
export const getTenantItem = async (
  client: DynamoDBClient,
  tableName: string,
  tenantId: string,
  key: Record<string, any>
) => {
  // Add tenant prefix to partition key
  const tenantKey = { ...key };
  const partitionKeyName = Object.keys(key)[0];
  tenantKey[partitionKeyName] = addTenantPrefix(tenantId, key[partitionKeyName]);

  const command = new GetItemCommand({
    TableName: tableName,
    Key: marshall(tenantKey),
  });

  const response = await client.send(command);
  if (response.Item) {
    const item = unmarshall(response.Item);
    // Remove tenant prefix from the response
    item[partitionKeyName] = removeTenantPrefix(tenantId, item[partitionKeyName]);
    return item;
  }
  return null;
};

/**
 * Put item with tenant isolation
 */
export const putTenantItem = async (
  client: DynamoDBClient,
  tableName: string,
  tenantId: string,
  item: Record<string, any>
) => {
  // Add tenant prefix to partition key
  const tenantItem = { ...item };
  const partitionKeyName = Object.keys(item).find(key => key.endsWith('Id') || key === 'id');
  
  if (partitionKeyName && tenantItem[partitionKeyName]) {
    tenantItem[partitionKeyName] = addTenantPrefix(tenantId, tenantItem[partitionKeyName]);
  }

  const command = new PutItemCommand({
    TableName: tableName,
    Item: marshall(tenantItem),
  });

  await client.send(command);
};

/**
 * Query items with tenant isolation
 */
export const queryTenantItems = async (
  client: DynamoDBClient,
  tableName: string,
  tenantId: string,
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>
) => {
  // Add tenant prefix to partition key values
  const tenantValues = { ...expressionAttributeValues };
  Object.keys(tenantValues).forEach(key => {
    if (key === ':pk' || key === ':partitionKey') {
      tenantValues[key] = addTenantPrefix(tenantId, tenantValues[key]);
    }
  });

  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: marshall(tenantValues),
    ExpressionAttributeNames: expressionAttributeNames,
  });

  const response = await client.send(command);
  
  if (response.Items) {
    return response.Items.map(item => {
      const unmarshalledItem = unmarshall(item);
      // Remove tenant prefix from partition key
      const partitionKeyName = Object.keys(unmarshalledItem).find(key => 
        unmarshalledItem[key] && typeof unmarshalledItem[key] === 'string' && 
        unmarshalledItem[key].startsWith(`${tenantId}#`)
      );
      
      if (partitionKeyName) {
        unmarshalledItem[partitionKeyName] = removeTenantPrefix(
          tenantId, 
          unmarshalledItem[partitionKeyName]
        );
      }
      
      return unmarshalledItem;
    });
  }
  
  return [];
};

/**
 * Update item with tenant isolation
 */
export const updateTenantItem = async (
  client: DynamoDBClient,
  tableName: string,
  tenantId: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>
) => {
  // Add tenant prefix to partition key
  const tenantKey = { ...key };
  const partitionKeyName = Object.keys(key)[0];
  tenantKey[partitionKeyName] = addTenantPrefix(tenantId, key[partitionKeyName]);

  const command = new UpdateItemCommand({
    TableName: tableName,
    Key: marshall(tenantKey),
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: marshall(expressionAttributeValues),
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: 'ALL_NEW',
  });

  const response = await client.send(command);
  
  if (response.Attributes) {
    const item = unmarshall(response.Attributes);
    // Remove tenant prefix from the response
    item[partitionKeyName] = removeTenantPrefix(tenantId, item[partitionKeyName]);
    return item;
  }
  
  return null;
};

/**
 * Delete item with tenant isolation
 */
export const deleteTenantItem = async (
  client: DynamoDBClient,
  tableName: string,
  tenantId: string,
  key: Record<string, any>
) => {
  // Add tenant prefix to partition key
  const tenantKey = { ...key };
  const partitionKeyName = Object.keys(key)[0];
  tenantKey[partitionKeyName] = addTenantPrefix(tenantId, key[partitionKeyName]);

  const command = new DeleteItemCommand({
    TableName: tableName,
    Key: marshall(tenantKey),
  });

  await client.send(command);
};

/**
 * Clean up tenant client to free memory
 */
export const cleanupTenantDynamoDBClient = (tenantId: string): void => {
  delete dynamoClientsByTenant[tenantId];
};