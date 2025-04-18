import { useState, useRef, useMemo } from 'react';
import { UnrecordedMessage } from 'generative-ai-use-cases';

type EventMessage = {
  id: string;
  role: string;
  content: string;
  generationStage: string;
  stopReason: string;
};

type EventMessageCacheEntity = Partial<EventMessage> & {
  id: string;
};

const useChatHistory = () => {
  const [eventMessages, setEventMessages] = useState<EventMessage[][]>([]);
  const eventMessageCache = useRef<Record<string, EventMessage>>({});

  const clear = () => {
    setEventMessages([]);
    eventMessageCache.current = {};
  };

  const setupSystemPrompt = (prompt: string) => {
    setEventMessages([
      [
        {
          id: 'system',
          role: 'system',
          content: prompt,
          generationStage: 'FINAL',
          stopReason: 'END_TURN',
        },
      ],
    ]);
  };

  const tryUpdateEventMessage = (tmpEventMessage: EventMessageCacheEntity) => {
    const currentCacheEntity = eventMessageCache.current[tmpEventMessage.id];

    const newEntity = {
      id: tmpEventMessage.id,
      role: tmpEventMessage.role ?? currentCacheEntity?.role,
      content: tmpEventMessage.content ?? currentCacheEntity?.content,
      generationStage:
        tmpEventMessage.generationStage ?? currentCacheEntity?.generationStage,
      stopReason: tmpEventMessage.stopReason ?? currentCacheEntity?.stopReason,
    };

    eventMessageCache.current[tmpEventMessage.id] = newEntity;

    if (
      newEntity.role &&
      newEntity.content &&
      newEntity.generationStage &&
      newEntity.stopReason
    ) {
      setEventMessages((prevEventMessages) => {
        const lastEventMessagesIndex = prevEventMessages.length - 1;
        const lastEventMessages = prevEventMessages[lastEventMessagesIndex];
        const eventMessagesWithoutLast = prevEventMessages.slice(
          0,
          lastEventMessagesIndex
        );

        if (lastEventMessages[0].role === newEntity.role) {
          if (newEntity.generationStage === 'FINAL') {
            const countFinals = lastEventMessages.filter(
              (m) => m.generationStage === 'FINAL'
            ).length;
            const beforeEventMessages = lastEventMessages.slice(0, countFinals);
            const afterEventMessages = lastEventMessages.slice(countFinals + 1);
            return [
              ...eventMessagesWithoutLast,
              [...beforeEventMessages, newEntity, ...afterEventMessages],
            ];
          } else {
            return [
              ...eventMessagesWithoutLast,
              [...lastEventMessages, newEntity],
            ];
          }
        } else {
          return [...eventMessagesWithoutLast, lastEventMessages, [newEntity]];
        }
      });
    }
  };

  const onTextStart = (data: {
    id: string;
    role: string;
    generationStage: string;
  }) => {
    tryUpdateEventMessage({
      id: data.id,
      role: data.role,
      generationStage: data.generationStage,
    });
  };

  const onTextOutput = (data: {
    id: string;
    role: string;
    content: string;
  }) => {
    tryUpdateEventMessage({
      id: data.id,
      role: data.role,
      content: data.content,
    });
  };

  const onTextStop = (data: { id: string; stopReason: string }) => {
    tryUpdateEventMessage({ id: data.id, stopReason: data.stopReason });
  };

  const messages: UnrecordedMessage[] = useMemo(() => {
    let interrupted: boolean = false;

    const res: UnrecordedMessage[] = [];

    for (const ms of eventMessages) {
      if (interrupted) {
        res[res.length - 1].content =
          res[res.length - 1].content +
          ' ' +
          ms.map((m: EventMessage) => m.content).join(' ');
        interrupted = false;
      } else {
        const interruptedIndex = ms.findIndex(
          (m: EventMessage) => m.stopReason === 'INTERRUPTED'
        );

        if (interruptedIndex === 0) {
          interrupted = true;
        } else if (interruptedIndex > 0) {
          res.push({
            role: ms[0].role as 'system' | 'user' | 'assistant',
            content: ms
              .slice(0, interruptedIndex)
              .map((m: EventMessage) => m.content)
              .join(' '),
          });
        } else {
          res.push({
            role: ms[0].role as 'system' | 'user' | 'assistant',
            content: ms.map((m: EventMessage) => m.content).join(' '),
          });
        }
      }
    }

    return res;
  }, [eventMessages]);

  const isAssistantSpeeching = useMemo(() => {
    if (eventMessages.length === 0) {
      return false;
    }

    const lastEventMessages = eventMessages[eventMessages.length - 1];

    if (lastEventMessages[0].role === 'assistant') {
      const hasSpeculative =
        lastEventMessages.filter(
          (e: EventMessage) => e.generationStage === 'SPECULATIVE'
        ).length > 0;
      return hasSpeculative;
    }

    return false;
  }, [eventMessages]);

  return {
    clear,
    messages,
    setupSystemPrompt,
    onTextStart,
    onTextOutput,
    onTextStop,
    isAssistantSpeeching,
    eventMessages,
  };
};

export default useChatHistory;
