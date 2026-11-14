import { GetAdminTokenUsageResponse } from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useAdminApi = () => {
  const { api } = useHttp();

  /** Every user's token usage from `startDate` to `endDate` (YYYY-MM-DD). */
  const getAdminTokenUsage = async (
    startDate: string,
    endDate: string
  ): Promise<GetAdminTokenUsageResponse> => {
    const params = new URLSearchParams({ startDate, endDate });
    const response = await api.get<GetAdminTokenUsageResponse>(
      `admin/token-usage?${params.toString()}`
    );
    return response.data;
  };

  return { getAdminTokenUsage };
};

export default useAdminApi;
