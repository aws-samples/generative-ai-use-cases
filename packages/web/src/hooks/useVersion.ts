import axios from 'axios';
import useSWR from 'swr';
import useIsAdmin from './useIsAdmin';
import { compareVersions } from '../utils/releaseNotes';

const version: string | undefined = import.meta.env.VITE_APP_VERSION;
const LATEST_RELEASE_URL =
  'https://api.github.com/repos/aws-samples/generative-ai-use-cases/releases/latest';

const fetchLatestRelease = (url: string): Promise<string> =>
  axios
    .get<{ tag_name: string }>(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    .then((res) => res.data.tag_name.replace(/^v/, ''));

/**
 * The deployed version and, for members of the admin group, the latest
 * release on GitHub. Only admins can update the deployment, so only they are
 * told about a newer release, and the release is not fetched for other users.
 * When GitHub cannot be reached (for example in closed network mode), there
 * is no latest release and no update is shown.
 */
const useVersion = () => {
  const isAdmin = useIsAdmin() === true;
  const { data: latestVersion } = useSWR(
    isAdmin && version ? LATEST_RELEASE_URL : null,
    fetchLatestRelease,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const hasUpdate =
    !!version && !!latestVersion && compareVersions(latestVersion, version) > 0;

  return {
    localVersion: version,
    latestVersion: hasUpdate ? latestVersion : undefined,
    hasUpdate,
  };
};

export default useVersion;
