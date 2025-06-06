import { TokenUsageStats } from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useStatApi = () => {
  const { api } = useHttp();

  /**
   * Get token usage statistics by date range
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @returns Token usage statistics
   */
  const getTokenUsageByDateRange = async (
    startDate: string,
    endDate: string
  ): Promise<TokenUsageStats[]> => {
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);

      const response = await api.get<TokenUsageStats[]>(
        `token-usage?${params.toString()}`
      );

      if (!response.data) {
        console.warn('No data returned from API');
        return [];
      }
      console.log('response.data', response.data);
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  return {
    getTokenUsageByDateRange,
  };
};

export default useStatApi;
