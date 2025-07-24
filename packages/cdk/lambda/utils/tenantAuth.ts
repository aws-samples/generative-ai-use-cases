import {
  STSClient,
  AssumeRoleCommand,
  AssumeRoleCommandInput,
  Credentials,
} from '@aws-sdk/client-sts';
import { APIGatewayProxyEvent } from 'aws-lambda';

const sts = new STSClient({});

export interface TenantContext {
  tenantId: string;
  credentials?: Credentials;
}

/**
 * Extract tenant ID from the request context
 */
export function getTenantId(event: APIGatewayProxyEvent): string | null {
  // Try to get tenant ID from Cognito claims
  const claims = event.requestContext.authorizer?.claims;
  if (claims && claims['custom:tenantId']) {
    return claims['custom:tenantId'];
  }

  // Try to get tenant ID from JWT token (for authenticated users)
  if (event.headers.Authorization) {
    try {
      const token = event.headers.Authorization.replace('Bearer ', '');
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      if (payload['custom:tenantId']) {
        return payload['custom:tenantId'];
      }
    } catch (error) {
      console.error('Error parsing JWT token:', error);
    }
  }

  // Try to get tenant ID from custom header (for service-to-service calls)
  if (event.headers['X-Tenant-Id']) {
    return event.headers['X-Tenant-Id'];
  }

  return null;
}

/**
 * Assume the tenant-specific role and return temporary credentials
 */
export async function assumeTenantRole(
  tenantId: string,
  sessionName?: string
): Promise<Credentials> {
  const roleArn = `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/tenant-${tenantId}-execution-role`;
  
  const assumeRoleInput: AssumeRoleCommandInput = {
    RoleArn: roleArn,
    RoleSessionName: sessionName || `tenant-${tenantId}-session-${Date.now()}`,
    DurationSeconds: 3600, // 1 hour
    Tags: [
      {
        Key: 'TenantId',
        Value: tenantId,
      },
    ],
  };

  try {
    const response = await sts.send(new AssumeRoleCommand(assumeRoleInput));
    
    if (!response.Credentials) {
      throw new Error('Failed to obtain credentials from STS');
    }

    return response.Credentials;
  } catch (error) {
    console.error(`Error assuming role for tenant ${tenantId}:`, error);
    throw new Error(`Failed to assume role for tenant ${tenantId}`);
  }
}

/**
 * Get tenant context from the API Gateway event
 */
export async function getTenantContext(
  event: APIGatewayProxyEvent
): Promise<TenantContext> {
  const tenantId = getTenantId(event);
  
  if (!tenantId) {
    throw new Error('Tenant ID not found in request context');
  }

  // Assume tenant role to get credentials
  const credentials = await assumeTenantRole(tenantId);

  return {
    tenantId,
    credentials,
  };
}

/**
 * Create AWS SDK client configuration with tenant credentials
 */
export function getTenantClientConfig(credentials: Credentials) {
  return {
    credentials: {
      accessKeyId: credentials.AccessKeyId!,
      secretAccessKey: credentials.SecretAccessKey!,
      sessionToken: credentials.SessionToken,
      expiration: credentials.Expiration,
    },
  };
}