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

  // Since AppSync Events are not FIFO, the order of events may be switched.
  // For example, onTextOutput might come before onTextStart.
  // This is a process where if a new message has the same role as the previous message, the messages are combined.
  // Otherwise (if it's a different role), it's added as a new message.
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

  // This is where the interruption processing is inserted.
  // When an interruption occurs:
  // 1) If interruptedIndex === 0, the assistant's entire utterance is canceled, so we connect the user's statements before and after.
  // 2) If interruptedIndex > 0, the assistant was interrupted after speaking partially, so we display up to the point where the utterance was completed in the UI.
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
