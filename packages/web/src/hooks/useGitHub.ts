import axios from 'axios';
import useSWR from 'swr';

const GITHUB_API_BASE_URL = 'https://api.github.com';

const api = axios.create({
  baseURL: GITHUB_API_BASE_URL,
});

const fetcher = (path: string) => {
  return api
    .get(path, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    .then((res) => res.data);
};

interface PullRequestOnGitub {
  title: string;
  html_url: string;
  merged_at: string | null;
}

export interface PullRequest {
  title: string;
  url: string;
  mergedAt: Date;
}

const useGitHub = () => {
  return {
    getClosedPullRequests: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { data } = useSWR(
        '/repos/aws-samples/generative-ai-use-cases/pulls?state=close',
        fetcher
      );

      if (!data) {
        return [];
      }

      return data
        .filter((p: PullRequestOnGitub) => p.merged_at)
        .map((p: PullRequestOnGitub) => {
          return {
            title: p.title,
            url: p.html_url,
            mergedAt: new Date(p.merged_at!),
          };
        });
    },
  };
};

export default useGitHub;
