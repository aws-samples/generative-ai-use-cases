import { useState, useRef } from 'react';
import { UnrecordedMessage } from 'generative-ai-use-cases';

type SpeechToSpeechMessage = UnrecordedMessage & { isPartial: boolean };

// stopReason が INTERRUPTED だったら content は空
// そこから先のそのロールの発言は無視される (基本的にアシスタントの発言と思われる)
// ユーザーの発言が到着したら、interrupted を解除

const useChatHistory = () => {
  const [messages, setMessages] = useState<SpeechToSpeechMessage[]>([]);
  const messageCache = useRef<Record<string, UnrecordedMessage>>({});
  const stopReasonCache = useRef<Record<string, string>>({});
  const interrupted = useRef<boolean>(false);

  const clear = () => {
    setMessages([]);
    messageCache.current = {};
  }

  const setupSystemPrompt = (prompt: string) => {
    setMessages([{
      role: 'system',
      content: prompt,
      isPartial: false,
    }]);
  };

  const updateMessages = (newMessage: SpeechToSpeechMessage) => {
    if (interrupted.current) {
      if (newMessage.role === 'assistant') {
        return;
      } else {
        interrupted.current = false;
      }
    }

    setMessages((messages) => {
      const lastMessageIndex = messages.length - 1;
      const lastMessage = messages[lastMessageIndex];
      const messagesWithoutLast = messages.slice(0, lastMessageIndex);

      if (lastMessage) {
        if (lastMessage.role !== newMessage.role) {
          return [...messagesWithoutLast, lastMessage, newMessage];
        } else {
          if (lastMessage.isPartial && !newMessage.isPartial) {
            return [...messagesWithoutLast, newMessage];
          } else {
            const updatedLastMessage = {
              ...lastMessage,
              content: lastMessage.content + ' ' + newMessage.content,
              isPartial: newMessage.isPartial,
            };
            return [...messagesWithoutLast, updatedLastMessage];
          }
        }
      }

      if (lastMessage) {
        return [...messagesWithoutLast, lastMessage];
      } else {
        return [...messagesWithoutLast];
      }
    });
  };

  const onTextOutput = (data: { id: string, role: string, content: string}) => {
    if (stopReasonCache.current[data.id]) {
      const newMessage: SpeechToSpeechMessage = {
        role: data.role as 'user' | 'assistant',
        content: data.content,
        isPartial: stopReasonCache.current[data.id] === 'PARTIAL_TURN',
      };

      updateMessages(newMessage);
    } else {
      messageCache.current[data.id] = { role: data.role as 'user' | 'assistant', content: data.content };
    }
  };

  const onTextStop = (data: { id: string, stopReason: string }) => {
    if (data.stopReason === 'INTERRUPTED') {
      interrupted.current = true;
      return;
    }

    if (messageCache.current[data.id]) {
      const newMessage: SpeechToSpeechMessage = {
        role: messageCache.current[data.id].role,
        content: messageCache.current[data.id].content,
        isPartial: data.stopReason === 'PARTIAL_TURN',
      };

      updateMessages(newMessage);
    } else {
      stopReasonCache.current[data.id] = data.stopReason;
    }
  };

  return {
    clear,
    messages,
    setupSystemPrompt,
    onTextOutput,
    onTextStop,
  };
}

export default useChatHistory;
