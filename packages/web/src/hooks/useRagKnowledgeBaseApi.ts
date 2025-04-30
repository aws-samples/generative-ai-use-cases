import {
  RetrieveKnowledgeBaseRequest,
  RetrieveKnowledgeBaseResponse,
} from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useRagKnowledgeBaseApi = () => {
  const http = useHttp();
  return {
    retrieve: (query: string) => {
      return http.post<
        RetrieveKnowledgeBaseResponse,
        RetrieveKnowledgeBaseRequest
      >('/rag-knowledge-base/retrieve', {
        query,
      });
    },
  };
};

export default useRagKnowledgeBaseApi;
