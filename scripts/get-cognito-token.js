#!/usr/bin/env node

/**
 * Get Cognito ID Token using USER_PASSWORD_AUTH flow
 * Optimized for performance and clean execution
 */

const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');

const {
  VITE_APP_USER_POOL_ID: userPoolId,
  VITE_APP_USER_POOL_CLIENT_ID: clientId,
  COGNITO_EMAIL: username,
  COGNITO_PASSWORD: password,
} = process.env;

if (!userPoolId || !clientId || !username || !password) {
  console.error('Error: Missing required environment variables.');
  console.error('Required: VITE_APP_USER_POOL_ID, VITE_APP_USER_POOL_CLIENT_ID, COGNITO_EMAIL, COGNITO_PASSWORD');
  process.exit(1);
}

const regionMatch = userPoolId.match(/^([a-z0-9-]+)_.+/);
if (!regionMatch) {
  console.error('Error: Invalid VITE_APP_USER_POOL_ID format.');
  process.exit(1);
}
const region = regionMatch[1];

// Reuse client instance outside the handler for connection pooling
const client = new CognitoIdentityProviderClient({ region });

(async () => {
  try {
    const { AuthenticationResult } = await client.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: { USERNAME: username, PASSWORD: password },
      })
    );

    if (!AuthenticationResult?.IdToken) {
      throw new Error('Authentication succeeded but no IdToken was returned.');
    }

    process.stdout.write(`${AuthenticationResult.IdToken}\n`);
    process.exit(0);
  } catch (error) {
    console.error(`Authentication failed: ${error.message}`);
    process.exit(1);
  }
})();
