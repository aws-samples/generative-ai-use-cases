import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersCommandOutput,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';

// Emails of Cognito users for the admin page. Few users are looked up one by
// one; many are read in bulk with ListUsers (60 per call), which keeps the
// number of Cognito calls low for large deployments.

const client = new CognitoIdentityProviderClient({});

/** Above this many users, ListUsers is cheaper than one AdminGetUser each. */
export const BULK_THRESHOLD = 100;
const CONCURRENCY = 10;
const TTL_MS = 10 * 60 * 1000;

// Only successful lookups are cached (a user without an email included), so a
// throttled or failed call is retried on the next request.
const cache = new Map<string, { email?: string; expiresAt: number }>();

const remember = (userName: string, email: string | undefined) =>
  cache.set(userName, { email, expiresAt: Date.now() + TTL_MS });

const emailOf = (attributes?: { Name?: string; Value?: string }[]) =>
  attributes?.find((attribute) => attribute.Name === 'email')?.Value;

const getOne = async (userPoolId: string, userName: string) => {
  try {
    const res = await client.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: userName })
    );
    remember(userName, emailOf(res.UserAttributes));
  } catch (error) {
    if (error instanceof UserNotFoundException) remember(userName, undefined);
    else console.error('Email lookup failed:', error);
  }
};

const listAll = async (userPoolId: string) => {
  let token: string | undefined;
  do {
    const res: ListUsersCommandOutput = await client.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        AttributesToGet: ['email'],
        PaginationToken: token,
      })
    );
    for (const user of res.Users ?? []) {
      if (user.Username) remember(user.Username, emailOf(user.Attributes));
    }
    token = res.PaginationToken;
  } while (token);
};

/** userName -> email for the given users; unknown or failed lookups are left out. */
export const lookupEmails = async (
  userNames: string[]
): Promise<Map<string, string>> => {
  const userPoolId = process.env.USER_POOL_ID!;
  const now = Date.now();
  const missing = userNames.filter(
    (name) => !((cache.get(name)?.expiresAt ?? 0) > now)
  );
  if (missing.length > BULK_THRESHOLD) {
    try {
      await listAll(userPoolId);
    } catch (error) {
      console.error('Listing users failed:', error);
    }
  } else {
    let next = 0;
    await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENCY, missing.length) },
        async () => {
          while (next < missing.length) {
            await getOne(userPoolId, missing[next++]);
          }
        }
      )
    );
  }
  const result = new Map<string, string>();
  for (const name of userNames) {
    const email = cache.get(name)?.email;
    if (email) result.set(name, email);
  }
  return result;
};

/** Only for tests. */
export const clearEmailCache = (): void => cache.clear();
