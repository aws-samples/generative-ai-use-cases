import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BaseProps } from '../@types/common';
import { Link } from 'react-router-dom';
import { PiChat, PiCheck, PiPencilLine, PiTrash, PiX } from 'react-icons/pi';
import ButtonIcon from './ButtonIcon';
import { Chat } from 'generative-ai-use-cases';
import { decomposeId } from '../utils/ChatUtils';
import DialogConfirmDeleteChat from './DialogConfirmDeleteChat';

type Props = BaseProps & {
  active: boolean;
  chat: Chat;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDelete: (chatId: string) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateTitle: (chatId: string, title: string) => Promise<any>;
  highlightWords: string[];
};

const ChatListItem: React.FC<Props> = (props) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState(false);
  const chatId = useMemo(() => {
    return decomposeId(props.chat.chatId) ?? '';
  }, [props.chat.chatId]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [tempTitle, setTempTitle] = useState('');

  useEffect(() => {
    if (editing) {
      setTempTitle(props.chat.title);
    }
  }, [editing, props.chat.title]);

  const updateTitle = useCallback(() => {
    setEditing(false);
    props.onUpdateTitle(chatId, tempTitle).catch(() => {
      setEditing(true);
    });
  }, [chatId, props, tempTitle]);

  useLayoutEffect(() => {
    if (editing) {
      const listener = (e: DocumentEventMap['keypress']) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();

          // Update Title in dispatch process (to synchronize)
          setTempTitle((newTitle) => {
            setEditing(false);
            props.onUpdateTitle(chatId, newTitle).catch(() => {
              setEditing(true);
            });
            return newTitle;
          });
        }
      };
      inputRef.current?.addEventListener('keypress', listener);

      inputRef.current?.focus();

      return () => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        inputRef.current?.removeEventListener('keypress', listener);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const highlightText = useCallback((text: string, words: string[]) => {
    if (words.length === 0) return text;

    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    return text.split(regex).map((part, i) => {
      if (words.some((word) => part.toLowerCase() === word.toLowerCase())) {
        return (
          <span key={i} className="text-aws-smile">
            {part}
          </span>
        );
      }
      return part;
    });
  }, []);

  return (
    <>
      {openDialog && (
        <DialogConfirmDeleteChat
          isOpen={openDialog}
          target={props.chat}
          onDelete={() => {
            setOpenDialog(false);
            props.onDelete(chatId);
          }}
          onClose={() => {
            setOpenDialog(false);
          }}
        />
      )}
      <Link
        className={`hover:bg-aws-sky group flex h-8 w-full items-center justify-start rounded p-2  ${
          props.active && 'bg-aws-sky'
        }
          ${props.className}`}
        to={`/chat/${chatId}`}>
        <div
          className={`flex h-8 max-h-5 w-full justify-start overflow-hidden`}>
          <div className="mr-2 ">
            <PiChat />
          </div>
          <div className="relative flex-1 text-ellipsis break-all">
            {editing ? (
              <input
                ref={inputRef}
                type="text"
                className="max-h-5 w-full bg-transparent p-0 text-sm ring-0"
                value={tempTitle}
                onChange={(e) => {
                  setTempTitle(e.target.value);
                }}
              />
            ) : (
              <div>{highlightText(props.chat.title, props.highlightWords)}</div>
            )}
            {!editing && (
              <div
                className={`group-hover:from-aws-sky group-hover:to-aws-sky/40 absolute right-0 w-8 bg-gradient-to-l
            ${props.active ? 'from-aws-sky' : 'from-aws-squid-ink'}
            `}
              />
            )}
          </div>
          <div className="flex">
            {props.active && !editing && (
              <>
                <ButtonIcon
                  onClick={() => {
                    setEditing(true);
                  }}>
                  <PiPencilLine />
                </ButtonIcon>
                <ButtonIcon
                  onClick={() => {
                    setOpenDialog(true);
                  }}>
                  <PiTrash />
                </ButtonIcon>
              </>
            )}
            {editing && (
              <>
                <ButtonIcon className="text-base" onClick={updateTitle}>
                  <PiCheck />
                </ButtonIcon>

                <ButtonIcon
                  className="text-base"
                  onClick={() => {
                    setEditing(false);
                  }}>
                  <PiX />
                </ButtonIcon>
              </>
            )}
          </div>
        </div>
      </Link>
    </>
  );
};

export default ChatListItem;
