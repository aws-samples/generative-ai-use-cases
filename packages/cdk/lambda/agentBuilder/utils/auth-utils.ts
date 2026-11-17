import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';

// VPC Endpoint with Private DNS enabled will automatically resolve to the correct endpoint
const cognitoClient = new CognitoIdentityProviderClient({});

/**
 * Get user email from Cognito
 */
export async function getUserEmail(
  userId: string
): Promise<string | undefined> {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: process.env.USER_POOL_ID!,
      Username: userId,
    });

    const response = await cognitoClient.send(command);
    const emailAttribute = response.UserAttributes?.find(
      (attr: AttributeType) => attr.Name === 'email'
    );

    return emailAttribute?.Value;
  } catch (error) {
    console.error('Error getting user email:', error);
    return undefined;
  }
}
