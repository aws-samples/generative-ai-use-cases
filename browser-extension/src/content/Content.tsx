import { twMerge } from 'tailwind-merge';
import HighlightMenu from '../app/features/highlight-menu/HighlightMenu';
import Browser from 'webextension-polyfill';
import { useEffect, useRef, useState } from 'react';
import { MessagePayload } from '../@types/extension-message';
import { extractPageText } from './pageText';
import { SystemContext } from '../@types/chat';

const Content = () => {
  const [isOpenChat, setIsOpenChat] = useState(false);
  const iframe = useRef<null | HTMLIFrameElement>(null);

  const openChat = (content: string, systemContext: SystemContext) => {
    setIsOpenChat(true);
    // Because Content can only use runtime messages, all TABs will receive a broadcast message (Content cannot use Browser.tabs)
    // If multiple screens are launched, all screens will be set to the value
    // Use the iframe message to send a message to a specific tab instead of the extension message
    iframe.current?.contentWindow?.postMessage({ type: 'CONTENT', content } as MessagePayload, '*');
    iframe.current?.contentWindow?.postMessage(
      { type: 'SYSTEM-CONTEXT', systemContext } as MessagePayload,
      '*',
    );
  };

  // Register once: a listener added on every render runs once per render
  useEffect(() => {
    const listener = (message: MessagePayload) => {
      if (message.type === 'CHAT-OPEN') {
        setIsOpenChat(true);
      } else if (message.type === 'CHAT-CLOSE') {
        setIsOpenChat(false);
      } else if (message.type === 'PAGE-CONTENT') {
        openChat(extractPageText(), message.systemContext);
      }
    };
    Browser.runtime.onMessage.addListener(listener);
    return () => Browser.runtime.onMessage.removeListener(listener);
    // openChat only uses the iframe ref and a state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <HighlightMenu onOpenChat={openChat} />
      <iframe
        ref={iframe}
        className={twMerge(
          'fixed z-[9999999999999] right-0 top-0 h-dvh shadow-xl border-1 bg-aws-squid-ink transition-all',
          isOpenChat ? 'xl:w-1/3 lg:2/5 md:w-2/5 sm:w-2/3' : 'w-0',
        )}
        src={Browser.runtime.getURL('pages/chat/index.html')}
        // Let the chat copy a response to the clipboard
        allow="clipboard-write"
      />
    </div>
  );
};

export default Content;
