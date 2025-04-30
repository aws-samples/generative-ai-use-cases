import {
  QueryKendraRequest,
  QueryKendraResponse,
  RetrieveKendraRequest,
  RetrieveKendraResponse,
} from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useRagApi = () => {
  const http = useHttp();
  return {
    query: (query: string) => {
      return http.post<QueryKendraResponse, QueryKendraRequest>('/rag/query', {
        query,
      });
    },
    retrieve: (query: string) => {
      return http.post<RetrieveKendraResponse, RetrieveKendraRequest>(
        '/rag/retrieve',
        {
          query,
        }
      );
    },
  };
};

export default useRagApi;
