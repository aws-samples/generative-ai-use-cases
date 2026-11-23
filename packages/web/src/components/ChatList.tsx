import React, { useCallback, useMemo } from 'react';
import { BaseProps } from '../@types/common';
import useChatList from '../hooks/useChatList';
import { useNavigate, useParams } from 'react-router-dom';
import ChatListItem from './ChatListItem';
import { decomposeId } from '../utils/ChatUtils';
import { useTranslation } from 'react-i18next';
import { Chat } from 'generative-ai-use-cases';
import {
  chatHistoryGroupKey,
  getChatActivityDate,
  getChatHistoryGroup,
  sortChatsByActivity,
} from '../utils/chatHistoryGroup';

type Props = BaseProps & {
  searchWords: string[];
};

const ChatList: React.FC<Props> = (props) => {
  const { t, i18n } = useTranslation();
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

  // Sorted by last activity, so consecutive chats share a section.
  const groupedChats = useMemo(() => {
    const now = new Date();
    const monthFormat = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
      year: 'numeric',
      month: 'long',
    });
    // Each chat also shows a short date: the time for today, the day otherwise.
    const timeFormat = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dayFormat = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
      month: 'numeric',
      day: 'numeric',
    });
    const groups: {
      key: string;
      label: string;
      chats: { chat: Chat; dateLabel?: string }[];
    }[] = [];
    for (const chat of sortChatsByActivity(searchedChats)) {
      const activityDate = getChatActivityDate(chat);
      const group = getChatHistoryGroup(activityDate, now);
      const key = chatHistoryGroupKey(group);
      if (groups.length === 0 || groups[groups.length - 1].key !== key) {
        const label =
          group.kind === 'month'
            ? monthFormat.format(new Date(group.year, group.month - 1))
            : {
                today: t('chat.history_today'),
                yesterday: t('chat.history_yesterday'),
                last_7_days: t('chat.history_last_7_days'),
                last_30_days: t('chat.history_last_30_days'),
              }[group.kind];
        groups.push({ key, label, chats: [] });
      }
      const active = new Date(Number(activityDate));
      const dateLabel = isNaN(active.getTime())
        ? undefined
        : (group.kind === 'today' ? timeFormat : dayFormat).format(active);
      groups[groups.length - 1].chats.push({ chat, dateLabel });
    }
    return groups;
  }, [searchedChats, t, i18n.resolvedLanguage]);

  return (
    <>
      <div
        className={`${
          props.className ?? ''
        } flex flex-col items-start gap-0.5 overflow-x-hidden`}>
        {groupedChats.map(({ key, label, chats: groupChats }) => (
          <React.Fragment key={key}>
            <div
              role="heading"
              aria-level={3}
              className="mt-2 px-2 text-xs text-gray-400 first:mt-0">
              {label}
            </div>
            {groupChats.map(({ chat, dateLabel }) => {
              const _chatId = decomposeId(chat.chatId);
              return (
                <ChatListItem
                  key={_chatId}
                  className={`${props.className && ''}`}
                  active={chatId === _chatId}
                  chat={chat}
                  dateLabel={dateLabel}
                  onDelete={onDelete}
                  onUpdateTitle={onUpdateTitle}
                  highlightWords={props.searchWords}
                />
              );
            })}
          </React.Fragment>
        ))}
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
