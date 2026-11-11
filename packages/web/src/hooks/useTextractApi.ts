import {
  DetectDocumentTextRequest,
  DetectDocumentTextResponse,
} from 'generative-ai-use-cases';
import useHttp from './useHttp';

const useTextractApi = () => {
  const http = useHttp();
  return {
    detectDocumentText: async (
      req: DetectDocumentTextRequest
    ): Promise<DetectDocumentTextResponse> => {
      const res = await http.post<DetectDocumentTextResponse>(
        'textract/detect',
        req
      );
      return res.data;
    },
  };
};

export default useTextractApi;
