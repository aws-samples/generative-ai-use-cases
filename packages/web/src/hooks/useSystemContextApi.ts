import {
  CreateSystemContextRequest,
  SystemContext,
  UpdateSystemContextTitleResponse,
} from 'generative-ai-use-cases';

import useHttp from './useHttp';
import { decomposeId } from '../utils/ChatUtils';

const useSystemContextApi = () => {
  const http = useHttp();

  return {
    createSystemContext: async (
      systemContextTitle: string,
      systemContext: string
    ): Promise<CreateSystemContextRequest> => {
      const res = await http.post('/systemcontexts', {
        systemContextTitle: systemContextTitle,
        systemContext: systemContext,
      });
      return res.data;
    },
    deleteSystemContext: async (_systemContextId: string) => {
      const systemContextId = decomposeId(_systemContextId);
      return http.delete<void>(`/systemcontexts/${systemContextId}`);
    },
    updateSystemContextTitle: async (
      _systemContextId: string,
      title: string
    ): Promise<UpdateSystemContextTitleResponse> => {
      const systemContextId = decomposeId(_systemContextId);
      const res = await http.put(`systemcontexts/${systemContextId}/title`, {
        title,
      });
      return res.data;
    },
    listSystemContexts: () => {
      const res = http.get<SystemContext[]>('/systemcontexts');
      return res;
    },
  };
};

export default useSystemContextApi;
