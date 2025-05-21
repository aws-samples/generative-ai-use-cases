import React, { useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  PiList,
  PiHouse,
  PiChatCircleText,
  PiPencil,
  PiNote,
  PiChatsCircle,
  PiPenNib,
  PiTranslate,
  PiImages,
  PiVideoLight,
  PiSpeakerHighBold,
  PiGear,
  PiGlobe,
  PiX,
  PiRobot,
  PiVideoCamera,
  PiFlowArrow,
  PiMagicWand,
  PiMicrophoneBold,
  PiTreeStructure,
} from 'react-icons/pi';
import { Outlet } from 'react-router-dom';
import Drawer, { ItemProps } from './components/Drawer';
import ButtonIcon from './components/ButtonIcon';
import '@aws-amplify/ui-react/styles.css';
import useDrawer from './hooks/useDrawer';
import useChatList from './hooks/useChatList';
import PopupInterUseCasesDemo from './components/PopupInterUseCasesDemo';
import useInterUseCases from './hooks/useInterUseCases';
import { MODELS } from './hooks/useModel';
import useScreen from './hooks/useScreen';
import { optimizePromptEnabled } from './hooks/useOptimizePrompt';
import useUseCases from './hooks/useUseCases';
import { useTranslation } from 'react-i18next';

const ragEnabled: boolean = import.meta.env.VITE_APP_RAG_ENABLED === 'true';
const ragKnowledgeBaseEnabled: boolean =
  import.meta.env.VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED === 'true';
const agentEnabled: boolean = import.meta.env.VITE_APP_AGENT_ENABLED === 'true';
const inlineAgents: boolean = import.meta.env.VITE_APP_INLINE_AGENTS === 'true';
const {
  visionEnabled,
  imageGenModelIds,
  videoGenModelIds,
  speechToSpeechModelIds,
  agentNames,
  flowChatEnabled,
} = MODELS;

// Extract :chatId from /chat/:chatId format
// Return null if path is in a different format
const extractChatId = (path: string): string | null => {
  const pattern = /\/chat\/(.+)/;
  const match = path.match(pattern);

  return match ? match[1] : null;
};

const App: React.FC = () => {
  const { t } = useTranslation();
  const { switchOpen: switchDrawer, opened: isOpenDrawer } = useDrawer();
  const { pathname } = useLocation();
  const { getChatTitle } = useChatList();
  const { isShow } = useInterUseCases();
  const { screen, notifyScreen, scrollTopAnchorRef, scrollBottomAnchorRef } =
    useScreen();
  const { enabled } = useUseCases();

  const items: ItemProps[] = [
    {
      label: t('navigation.home'),
      to: '/',
      icon: <PiHouse />,
      display: 'usecase' as const,
    },
    {
      label: t('navigation.settings'),
      to: '/setting',
      icon: <PiGear />,
      display: 'none' as const,
    },
    {
      label: t('navigation.chat'),
      to: '/chat',
      icon: <PiChatsCircle />,
      display: 'usecase' as const,
    },
    ragEnabled
      ? {
          label: t('navigation.ragChat'),
          to: '/rag',
          icon: <PiChatCircleText />,
          display: 'usecase' as const,
          sub: 'Amazon Kendra',
        }
      : null,
    ragKnowledgeBaseEnabled
      ? {
          label: t('navigation.ragChat'),
          to: '/rag-knowledge-base',
          icon: <PiChatCircleText />,
          display: 'usecase' as const,
          sub: 'Knowledge Base',
        }
      : null,
    agentEnabled && !inlineAgents
      ? {
          label: t('navigation.agentChat'),
          to: '/agent',
          icon: <PiRobot />,
          display: 'usecase' as const,
        }
      : null,
    ...(agentEnabled && inlineAgents
      ? agentNames.map((name: string) => {
          return {
            label: name,
            to: `/agent/${name}`,
            icon: <PiRobot />,
            display: 'usecase' as const,
            sub: 'Agent',
          };
        })
      : []),
    flowChatEnabled
      ? {
          label: t('navigation.flowChat'),
          to: '/flow-chat',
          icon: <PiFlowArrow />,
          display: 'usecase' as const,
        }
      : null,
    speechToSpeechModelIds.length > 0 && enabled('voiceChat')
      ? {
          label: t('navigation.voiceChat'),
          to: '/voice-chat',
          icon: <PiMicrophoneBold />,
          display: 'usecase' as const,
        }
      : null,
    enabled('generate')
      ? {
          label: t('navigation.textGeneration'),
          to: '/generate',
          icon: <PiPencil />,
          display: 'usecase' as const,
        }
      : null,
    enabled('summarize')
      ? {
          label: t('navigation.summary'),
          to: '/summarize',
          icon: <PiNote />,
          display: 'usecase' as const,
        }
      : null,
    enabled('writer')
      ? {
          label: t('navigation.writing'),
          to: '/writer',
          icon: <PiPenNib />,
          display: 'usecase' as const,
        }
      : null,
    enabled('translate')
      ? {
          label: t('navigation.translation'),
          to: '/translate',
          icon: <PiTranslate />,
          display: 'usecase' as const,
        }
      : null,
    enabled('webContent')
      ? {
          label: t('navigation.webContentExtraction'),
          to: '/web-content',
          icon: <PiGlobe />,
          display: 'usecase' as const,
        }
      : null,
    imageGenModelIds.length > 0 && enabled('image')
      ? {
          label: t('navigation.imageGeneration'),
          to: '/image',
          icon: <PiImages />,
          display: 'usecase' as const,
        }
      : null,
    videoGenModelIds.length > 0 && enabled('video')
      ? {
          label: t('navigation.videoGeneration'),
          to: '/video',
          icon: <PiVideoLight />,
          display: 'usecase' as const,
        }
      : null,
    visionEnabled && enabled('videoAnalyzer')
      ? {
          label: t('navigation.videoAnalysis'),
          to: '/video-analyzer',
          icon: <PiVideoCamera />,
          display: 'usecase' as const,
        }
      : null,
    enabled('diagram')
      ? {
          label: t('navigation.diagramGeneration'),
          to: '/diagram',
          icon: <PiTreeStructure />,
          display: 'usecase' as const,
        }
      : null,
    {
      label: t('navigation.speechRecognition'),
      to: '/transcribe',
      icon: <PiSpeakerHighBold />,
      display: 'tool' as const,
    },
    optimizePromptEnabled
      ? {
          label: t('navigation.promptOptimization'),
          to: '/optimize',
          icon: <PiMagicWand />,
          display: 'tool' as const,
        }
      : null,
  ].flatMap((i) => (i !== null ? [i] : []));

  const label = useMemo(() => {
    const chatId = extractChatId(pathname);

    if (chatId) {
      return getChatTitle(chatId) || '';
    } else {
      return items.find((i) => i.to === pathname)?.label || '';
    }
  }, [items, pathname, getChatTitle]);

  // When there is no scroll event (e.g. moving from the top of the page to the top of the page)
  // The top/bottom determination is not made, so re-determine it according to the change of pathname
  useEffect(() => {
    if (screen.current) {
      notifyScreen(screen.current);
    }
  }, [pathname, screen, notifyScreen]);

  return (
    <div
      className="screen:w-screen screen:h-screen overflow-x-hidden overflow-y-scroll"
      ref={screen}>
      <main className="flex-1">
        <div ref={scrollTopAnchorRef}></div>
        <header className="bg-aws-squid-ink visible flex h-12 w-full items-center justify-between text-lg text-white lg:invisible lg:h-0 print:hidden">
          <div className="flex w-10 items-center justify-start">
            <button
              className="focus:ring-aws-sky mr-2 rounded-full  p-2 hover:opacity-50 focus:outline-none focus:ring-1"
              onClick={() => {
                switchDrawer();
              }}>
              <PiList />
            </button>
          </div>

          {label}

          {/* Dummy block to center the label */}
          <div className="w-10" />
        </header>

        <div
          className={`fixed -left-64 top-0 z-50 transition-all lg:left-0 lg:z-0 ${
            isOpenDrawer ? 'left-0' : '-left-64'
          }`}>
          <Drawer items={items} />
        </div>

        <div
          id="smallDrawerFiller"
          className={`${isOpenDrawer ? 'visible' : 'invisible'} lg:invisible`}>
          <div
            className="screen:h-screen fixed top-0 z-40 w-screen bg-gray-900/90"
            onClick={switchDrawer}></div>
          <ButtonIcon
            className="fixed left-64 top-0 z-40 text-white"
            onClick={switchDrawer}>
            <PiX />
          </ButtonIcon>
        </div>
        <div className="text-aws-font-color lg:ml-64">
          {/* Show when inter-use case connection is enabled */}
          {isShow && <PopupInterUseCasesDemo />}
          <Outlet />
        </div>
        <div ref={scrollBottomAnchorRef}></div>
      </main>
    </div>
  );
};

export default App;
