import { produce } from 'immer';
import useChatApi from './useChatApi';
import { Chat } from 'generative-ai-use-cases';
import usePagination from './usePagination';

const useChatList = () => {
  const { listChats, deleteChat: deleteChatApi, updateTitle } = useChatApi();
  const {
    data,
    flattenData: chats,
    mutate,
    isLoading,
    canLoadMore,
    loadMore,
  } = usePagination(listChats(), 100);

  const deleteChat = async (chatId: string) => {
    mutate(
      produce(data, (draft) => {
        if (data && draft) {
          for (const d in data) {
            const idx = data[d].data.findIndex(
              (c) => c.chatId === `chat#${chatId}`
            );

            if (idx > -1) {
              draft[d].data.splice(idx, 1);
              break;
            }
          }
        }
      }),
      {
        revalidate: false,
      }
    );

    return deleteChatApi(chatId).finally(() => {
      mutate();
    });
  };

  const updateChatTitle = async (chatId: string, title: string) => {
    mutate(
      produce(data, (draft) => {
        if (data && draft) {
          for (const d in data) {
            const idx = data[d].data.findIndex(
              (c) => c.chatId === `chat#${chatId}`
            );

            if (idx > -1) {
              draft[d].data[idx].title = title;
              break;
            }
          }
        }
      }),
      {
        revalidate: false,
      }
    );

    return updateTitle(chatId, title).finally(() => {
      mutate();
    });
  };

  const getChatTitle = (chatId: string) => {
    const idx =
      chats.findIndex((c: Chat) => c.chatId === `chat#${chatId}`) ?? -1;

    if (idx > -1) {
      return chats[idx].title;
    } else {
      return null;
    }
  };

  return {
    loading: isLoading,
    chats,
    mutate,
    updateChatTitle,
    deleteChat,
    getChatTitle,
    canLoadMore,
    loadMore,
  };
};

export default useChatList;
