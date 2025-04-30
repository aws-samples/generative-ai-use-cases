import React, { useState } from 'react';
import { BaseProps } from '../../../@types/common';
import { Message } from '../../../@types/chat';
import { twMerge } from 'tailwind-merge';
import { PiCaretUp } from 'react-icons/pi';
import { IconWrapper } from '../../components/IconWrapper';

type Props = BaseProps & {
  message: Message;
};

const ChatMessage: React.FC<Props> = (props) => {
  const { message } = props;
  const isUser = message.role === 'user';

  const [isOpen, setIsOpen] = useState(message.role === 'system' ? false : true);

  return (
    <div
      className={twMerge(
        'border-t last:border-b p-2',
        isUser ? 'bg-aws-squid-ink brightness-150' : '',
        props.className,
      )}
    >
      {message.title && (
        <div
          className="font-bold flex gap-2 cursor-pointer hover:bg-white/20 p-1 rounded items-center"
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          <IconWrapper
            icon={PiCaretUp}
            className={twMerge('transition', isOpen ? 'rotate-180' : '')}
          />

          <div>{message.title}</div>
        </div>
      )}

      <div
        className={twMerge(
          'transition-all ',
          message.role === 'system' && isOpen && 'max-h-[300px] overflow-y-auto',
          message.role === 'system' && !isOpen && 'max-h-0 overflow-hidden',
        )}
      >
        {message.content.split('\n').map((c, idx) => (
          <div key={idx}>{c}</div>
        ))}
      </div>
    </div>
  );
};

export default ChatMessage;
