import React from 'react';
import InputContent from './InputContent';
import useChat from './useChat';
import ChatMessage from './ChatMessage';
import { PromptSetting } from '../../../@types/settings';

type Props = {
  initContent: string;
  initImage?: string;
  initPromptSetting?: PromptSetting;
};

const Chat: React.FC<Props> = (props) => {
  const { messages } = useChat();

  return (
    <div className="relative h-full w-full overflow-y-auto">
      <div className="mb-36">
        {messages.map((message, idx) => (
          <ChatMessage key={idx} message={message} />
        ))}
      </div>

      <InputContent
        className="fixed bottom-0 w-full"
        initContent={props.initContent}
        initImage={props.initImage}
        initPromptSetting={props.initPromptSetting}
      />
    </div>
  );
};

export default Chat;
