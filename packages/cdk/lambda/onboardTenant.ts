import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  CreateGroupCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { v4 as uuidv4 } from 'uuid';

const cognito = new CognitoIdentityProviderClient({});
const lambda = new LambdaClient({});

interface OnboardTenantRequest {
  tenantName: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  plan?: 'basic' | 'standard' | 'premium';
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    const request: OnboardTenantRequest = JSON.parse(event.body || '{}');
    
    // Validate request
    if (!request.tenantName || !request.adminEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: 'Missing required fields: tenantName and adminEmail' 
        }),
      };
    }

    // Generate tenant ID
    const tenantId = `tenant-${uuidv4()}`;
    const plan = request.plan || 'basic';

    console.log(`Onboarding tenant: ${tenantId} with plan: ${plan}`);

    // Step 1: Create IAM role for the tenant
    const createRoleResponse = await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.TENANT_ROLE_FUNCTION_NAME,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          RequestType: 'Create',
          ResourceProperties: {
            TenantId: tenantId,
            Action: 'CREATE',
          },
          RequestId: `onboard-${tenantId}`,
          LogicalResourceId: `TenantRole-${tenantId}`,
          StackId: 'manual-onboarding',
        }),
      })
    );

    const roleResult = JSON.parse(
      new TextDecoder().decode(createRoleResponse.Payload)
    );

    if (roleResult.Status !== 'SUCCESS') {
      throw new Error(`Failed to create tenant role: ${roleResult.Reason}`);
    }

    // Step 2: Create Cognito group for the tenant
    try {
      await cognito.send(
        new CreateGroupCommand({
          GroupName: tenantId,
          UserPoolId: process.env.USER_POOL_ID,
          Description: `Group for ${request.tenantName}`,
          RoleArn: roleResult.Data.RoleArn,
        })
      );
    } catch (error: any) {
      if (error.name !== 'GroupExistsException') {
        throw error;
      }
    }

    // Step 3: Create admin user for the tenant
    const tempPassword = generateTempPassword();
    
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: request.adminEmail,
        UserAttributes: [
          {
            Name: 'email',
            Value: request.adminEmail,
          },
          {
            Name: 'email_verified',
            Value: 'true',
          },
          {
            Name: 'given_name',
            Value: request.adminFirstName,
          },
          {
            Name: 'family_name',
            Value: request.adminLastName,
          },
          {
            Name: 'custom:tenantId',
            Value: tenantId,
          },
          {
            Name: 'custom:tenantName',
            Value: request.tenantName,
          },
          {
            Name: 'custom:tenantPlan',
            Value: plan,
          },
          {
            Name: 'custom:isAdmin',
            Value: 'true',
          },
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS', // Don't send welcome email yet
      })
    );

    // Step 4: Add user to tenant group
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: request.adminEmail,
        GroupName: tenantId,
      })
    );

    // Step 5: Initialize tenant data in DynamoDB
    // This would typically include creating initial settings, permissions, etc.
    // For brevity, this is omitted here

    // Step 6: Create initial S3 folder structure
    // This would typically include creating tenant-specific folders
    // For brevity, this is omitted here

    // Step 7: Send welcome email with temporary password
    // In production, you would use SES or another email service
    console.log(`Tenant onboarded successfully: ${tenantId}`);
    console.log(`Admin user created: ${request.adminEmail}`);
    console.log(`Temporary password: ${tempPassword}`);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId,
        adminEmail: request.adminEmail,
        message: 'Tenant onboarded successfully',
        temporaryPassword: tempPassword, // In production, send via email
        nextSteps: [
          'Admin user must change password on first login',
          'Configure tenant settings',
          'Invite additional users',
        ],
      }),
    };
  } catch (error) {
    console.error('Error onboarding tenant:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Failed to onboard tenant',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

function generateTempPassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const all = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  // Ensure at least one of each required character type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}