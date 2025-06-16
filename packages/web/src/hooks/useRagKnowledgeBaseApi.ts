import {
  RetrieveKnowledgeBaseRequest,
  RetrieveKnowledgeBaseResponse,
} from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useRagKnowledgeBaseApi = () => {
  const http = useHttp();
  console.log('calling /rag-knowledge-base/retrieve');
  return {
    retrieve: (query: string, knowledgeBaseId?: string) => {
      return http.post<
        RetrieveKnowledgeBaseResponse,
        RetrieveKnowledgeBaseRequest
      >('/rag-knowledge-base/retrieve', {
        query,
        knowledgeBaseId,
      });
    },
  };
};

export default useRagKnowledgeBaseApi;
