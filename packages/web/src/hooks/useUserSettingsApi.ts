import { DefaultChat, UserSettings } from 'generative-ai-use-cases';
import useHttp from './useHttp';
import { decomposeId } from '../utils/ChatUtils';

const useUserSettingsApi = () => {
  const http = useHttp();

  return {
    getUserSettings: () => http.get<UserSettings>('/user-settings'),
    /** Start new chats with this saved system prompt (`systemContext#<id>`). */
    setDefaultSystemContext: async (systemContextId: string) => {
      const body: DefaultChat = {
        type: 'systemContext',
        id: decomposeId(systemContextId)!,
      };
      await http.put('/user-settings/default-chat', body);
    },
    clearDefaultChat: async () => {
      await http.delete<void>('/user-settings/default-chat');
    },
  };
};

export default useUserSettingsApi;
