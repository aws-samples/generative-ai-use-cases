import { JwtRsaVerifier } from 'aws-jwt-verify';
import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';

export const verifyToken = async (
  token: string
): Promise<CognitoIdTokenPayload | undefined> => {
  try {
    const region = process.env.AWS_REGION!;
    const userPoolId = process.env.USER_POOL_ID!;
    const clientId = process.env.USER_POOL_CLIENT_ID!;

    // VPC Endpoint with Private DNS enabled will automatically resolve to the correct endpoint
    const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;

    const verifier = JwtRsaVerifier.create({
      issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      audience: clientId,
      jwksUri,
      tokenUse: 'id',
    });

    const payload = await verifier.verify(token);
    return payload as CognitoIdTokenPayload;
  } catch {
    return undefined;
  }
};

/** Cognito group whose members may use the admin API and pages. */
export const SYSTEM_ADMIN_GROUP = 'SystemAdminGroup';

/** True when the verified id token puts the caller in the admin group. */
export const isSystemAdmin = (
  payload: CognitoIdTokenPayload | undefined
): boolean => {
  const groups = payload?.['cognito:groups'];
  return Array.isArray(groups) && groups.includes(SYSTEM_ADMIN_GROUP);
};
