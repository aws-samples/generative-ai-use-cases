import React, { useCallback, useMemo } from 'react';
import { BaseProps } from '../@types/common';
import useChatList from '../hooks/useChatList';
import { useNavigate, useParams } from 'react-router-dom';
import ChatListItem from './ChatListItem';
import { decomposeId } from '../utils/ChatUtils';
import { useTranslation } from 'react-i18next';

type Props = BaseProps & {
  searchWords: string[];
};

const ChatList: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { chats, loading, deleteChat, updateChatTitle, canLoadMore, loadMore } =
    useChatList();
  const { chatId } = useParams();
  const navigate = useNavigate();

  const onDelete = useCallback(
    async (_chatId: string) => {
      navigate('/chat');
      return await deleteChat(_chatId).catch(() => {
        navigate(`/chat/${_chatId}`);
      });
    },
    [deleteChat, navigate]
  );

  const onUpdateTitle = useCallback(
    (_chatId: string, title: string) => {
      return updateChatTitle(_chatId, title);
    },
    [updateChatTitle]
  );

  const searchedChats = useMemo(() => {
    if (props.searchWords.length === 0) {
      return chats;
    }

    // OR search
    return chats.filter((c) => {
      return props.searchWords.some((w) =>
        c.title.toLowerCase().includes(w.toLowerCase())
      );
    });
  }, [props.searchWords, chats]);

  return (
    <>
      <div
        className={`${
          props.className ?? ''
        } flex flex-col items-start gap-0.5 overflow-x-hidden`}>
        {searchedChats.map((chat) => {
          const _chatId = decomposeId(chat.chatId);
          return (
            <ChatListItem
              key={_chatId}
              className={`${props.className && ''}`}
              active={chatId === _chatId}
              chat={chat}
              onDelete={onDelete}
              onUpdateTitle={onUpdateTitle}
              highlightWords={props.searchWords}
            />
          );
        })}
        {canLoadMore && !loading && (
          <div className="my-2 flex w-full justify-center">
            <button
              className="hover:underline"
              onClick={() => {
                loadMore();
              }}>
              {t('common.load_more')}
            </button>
          </div>
        )}
        {loading &&
          new Array(10)
            .fill('')
            .map((_, idx) => (
              <div
                key={idx}
                className="bg-aws-sky/20 my-1 h-6 w-full animate-pulse rounded"></div>
            ))}
      </div>
    </>
  );
};

export default ChatList;
