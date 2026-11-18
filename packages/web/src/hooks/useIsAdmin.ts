import useSWR from 'swr';
import { fetchAuthSession } from 'aws-amplify/auth';

/** Cognito group whose members may open the admin page. */
export const SYSTEM_ADMIN_GROUP = 'SystemAdminGroup';

/**
 * Whether the signed-in user is in the admin group, from the id token, or
 * undefined until the session has an id token. This only decides what the UI
 * shows; the API checks the group again.
 *
 * On a page reload the session can be read before sign-in has finished and
 * come back without tokens. That is treated as still loading, and the session
 * is read again until the id token is there.
 */
const useIsAdmin = (): boolean | undefined => {
  // Same SWR key as DrawerBase, so the session is fetched once.
  const { data } = useSWR('user', () => fetchAuthSession(), {
    refreshInterval: (latest) => (latest?.tokens?.idToken ? 0 : 500),
  });
  const payload = data?.tokens?.idToken?.payload;
  if (!payload) return undefined;
  const groups = payload['cognito:groups'];
  return Array.isArray(groups) && groups.includes(SYSTEM_ADMIN_GROUP);
};

export default useIsAdmin;
