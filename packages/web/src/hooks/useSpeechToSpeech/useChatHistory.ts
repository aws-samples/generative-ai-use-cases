import { useState, useRef } from 'react';
import { UnrecordedMessage } from 'generative-ai-use-cases';

const useChatHistory = () => {
  const [messages, setMessages] = useState<UnrecordedMessage[]>([]);
  const [isAssistantSpeeching, setIsAssistantSpeeching] = useState(false);
  const messageCache = useRef<Record<string, UnrecordedMessage>>({});
  const generationStageCache = useRef<Record<string, string>>({});
  const stopReasonCache = useRef<Record<string, string>>({});

  const clear = () => {
    setMessages([]);
    messageCache.current = {};
    generationStageCache.current = {};
    stopReasonCache.current = {};
  }

  const setupSystemPrompt = (prompt: string) => {
    setMessages([{
      role: 'system',
      content: prompt,
    }]);
  };

  const tryUpdateMessage = (id: string) => {
    if (
      !messageCache.current[id] ||
        !generationStageCache.current[id] ||
        !stopReasonCache.current[id]
    ) {
      return;
    }

    if (generationStageCache.current[id] !== 'FINAL') {
      return;
    }

    if (stopReasonCache.current[id] === 'INTERRUPTED') {
      return;
    }

    setMessages((messages) => {
      const lastMessageIndex = messages.length - 1;
      const lastMessage = messages[lastMessageIndex];
      const messagesWithoutLast = messages.slice(0, lastMessageIndex);
      const role = messageCache.current[id].role;
      const content = messageCache.current[id].content;

      if (lastMessage.role === role) {
        const updatedLastMessage: UnrecordedMessage = {
          ...lastMessage,
          content: lastMessage.content + ' ' + content,
        };
        return [...messagesWithoutLast, updatedLastMessage];
      } else {
        const newMessage: UnrecordedMessage = { role, content };
        return [...messagesWithoutLast, lastMessage, newMessage];
      }
    });
  }

  const onTextStart = (data: { id: string, role: string, generationStage: string}) => {
    generationStageCache.current[data.id] = data.generationStage;
    tryUpdateMessage(data.id);

    if (data.role === 'assistant' && data.generationStage === 'SPECULATIVE') {
      setIsAssistantSpeeching(true);
    } else {
      setIsAssistantSpeeching(false);
    }
  };

  const onTextOutput = (data: { id: string, role: string, content: string}) => {
    messageCache.current[data.id] = { role: data.role as 'user' | 'assistant', content: data.content };
    tryUpdateMessage(data.id);
  };

  const onTextStop = (data: { id: string, stopReason: string }) => {
    stopReasonCache.current[data.id] = data.stopReason;
    tryUpdateMessage(data.id);
  };

  return {
    clear,
    messages,
    setupSystemPrompt,
    onTextStart,
    onTextOutput,
    onTextStop,
    isAssistantSpeeching,
  };
}

export default useChatHistory;
