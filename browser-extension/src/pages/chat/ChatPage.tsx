import React, { useCallback, useEffect, useState } from 'react';
import '@aws-amplify/ui-react/styles.css';

import Chat from '../../app/features/chat/Chat';
import useSettings from '../../app/features/settings/useSettings';
import Header from '../../app/features/common/components/Header';
import Settings from '../../app/features/settings/Settings';
import Browser from 'webextension-polyfill';
import { MessagePayload } from '../../@types/extension-message';
import PromptSettings from '../../app/features/prompt-settings/PromptSettings';
import { PromptSetting } from '../../@types/settings';
import RequiresAuth from '../../app/features/common/components/RequiresAuth';

const ChatPage: React.FC = () => {
  const [isOpenSettings, setIsOpenSettings] = useState(false);
  const [isOpenPromptSettings, setIsOpenPromptSettings] = useState(false);
  const { hasConfiguredSettings } = useSettings();

  useEffect(() => {
    if (!hasConfiguredSettings) {
      setIsOpenSettings(true);
    } else {
      setIsOpenSettings(false);
    }
  }, [hasConfiguredSettings]);

  const [content, setContent] = useState('');
  const [promptSetting, setPromptSetting] = useState<PromptSetting>({
    systemContextId: '',
    systemContextTitle: '',
    systemContext: '',
  });

  // Receive a message from the background using the extension function
  Browser.runtime.onMessage.addListener((message: MessagePayload) => {
    if (message.type === 'CONTENT') {
      setContent(message.content);
    } else if (message.type === 'SYSTEM-CONTEXT') {
      setPromptSetting(message.systemContext);
    }
  });

  // Receive a message from Content (parent window) through the iframe
  window.addEventListener('message', (event: MessageEvent<MessagePayload>) => {
    const message = event.data;
    if (message.type === 'CONTENT') {
      setContent(message.content);
    } else if (message.type === 'SYSTEM-CONTEXT') {
      setPromptSetting(message.systemContext);
    }
  });

  const closeChat = useCallback(() => {
    setIsOpenPromptSettings(false);
    setIsOpenSettings(false);
    Browser.tabs?.query({ active: true, currentWindow: true }).then(([tab]) => {
      Browser.tabs.sendMessage(tab.id ?? 0, {
        type: 'CHAT-CLOSE',
      } as MessagePayload);
    });
  }, []);

  return (
    <div className="text-white text-sm">
      <Header
        onClickPromptSettings={() => {
          setIsOpenPromptSettings(!isOpenPromptSettings);
          setIsOpenSettings(false);
        }}
        onClickSettings={() => {
          setIsOpenPromptSettings(false);
          setIsOpenSettings(!isOpenSettings);
        }}
        onClickClose={closeChat}
      />
      <div className="pt-14">
        {isOpenSettings && (
          <Settings
            onBack={() => {
              setIsOpenSettings(false);
            }}
          />
        )}
        {isOpenPromptSettings && (
          <PromptSettings
            onBack={() => {
              setIsOpenPromptSettings(false);
            }}
          />
        )}
        {!isOpenSettings && !isOpenPromptSettings && (
          <RequiresAuth>
            <Chat initContent={content} initPromptSetting={promptSetting} />
          </RequiresAuth>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
