import useSWR from 'swr';
import { fetchAuthSession } from 'aws-amplify/auth';

/** Cognito group whose members may open the admin page. */
export const SYSTEM_ADMIN_GROUP = 'SystemAdminGroup';

/**
 * Whether the signed-in user is in the admin group, from the id token, or
 * undefined while the session is still loading. This only decides what the UI
 * shows; the API checks the group again.
 */
const useIsAdmin = (): boolean | undefined => {
  // Same SWR key as DrawerBase, so the session is fetched once.
  const { data } = useSWR('user', () => fetchAuthSession());
  if (!data) return undefined;
  const groups = data.tokens?.idToken?.payload['cognito:groups'];
  return Array.isArray(groups) && groups.includes(SYSTEM_ADMIN_GROUP);
};

export default useIsAdmin;
