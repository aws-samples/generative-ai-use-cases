import { GetAdminTokenUsageResponse } from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useAdminApi = () => {
  const { api } = useHttp();

  /**
   * Every user's token usage from `startDate` to `endDate` (YYYY-MM-DD).
   * With `userIds`, every total counts only those users.
   */
  const getAdminTokenUsage = async (
    startDate: string,
    endDate: string,
    userIds: string[] = []
  ): Promise<GetAdminTokenUsageResponse> => {
    const params = new URLSearchParams({ startDate, endDate });
    if (userIds.length > 0) params.append('userIds', userIds.join(','));
    const response = await api.get<GetAdminTokenUsageResponse>(
      `admin/token-usage?${params.toString()}`
    );
    return response.data;
  };

  return { getAdminTokenUsage };
};

export default useAdminApi;
