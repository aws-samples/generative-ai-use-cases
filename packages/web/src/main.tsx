import './i18n/config';
import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthWithUserpool from './components/AuthWithUserpool';
import AuthWithSAML from './components/AuthWithSAML';
import './index.css';
import {
  RouterProvider,
  createBrowserRouter,
  RouteObject,
} from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Setting from './pages/Setting';
import ChatPage from './pages/ChatPage';
import SharedChatPage from './pages/SharedChatPage';
import SummarizePage from './pages/SummarizePage';
import GenerateTextPage from './pages/GenerateTextPage';
import TranslatePage from './pages/TranslatePage';
import VideoAnalyzerPage from './pages/VideoAnalyzerPage';
import NotFound from './pages/NotFound';
import RagPage from './pages/RagPage';
import RagKnowledgeBasePage from './pages/RagKnowledgeBasePage';
import WebContent from './pages/WebContent';
import GenerateImagePage from './pages/GenerateImagePage';
import GenerateVideoPage from './pages/GenerateVideoPage';
import OptimizePromptPage from './pages/OptimizePromptPage';
import TranscribePage from './pages/TranscribePage';
import AgentChatPage from './pages/AgentChatPage.tsx';
import FlowChatPage from './pages/FlowChatPage';
import VoiceChatPage from './pages/VoiceChatPage';
import { MODELS } from './hooks/useModel';
import { Authenticator } from '@aws-amplify/ui-react';
import UseCaseBuilderEditPage from './pages/useCaseBuilder/UseCaseBuilderEditPage.tsx';
import App from './App.tsx';
import UseCaseBuilderRoot from './UseCaseBuilderRoot.tsx';
import UseCaseBuilderExecutePage from './pages/useCaseBuilder/UseCaseBuilderExecutePage.tsx';
import UseCaseBuilderSamplesPage from './pages/useCaseBuilder/UseCaseBuilderSamplesPage.tsx';
import UseCaseBuilderMyUseCasePage from './pages/useCaseBuilder/UseCaseBuilderMyUseCasePage.tsx';
import { optimizePromptEnabled } from './hooks/useOptimizePrompt';
import GenerateDiagramPage from './pages/GenerateDiagramPage.tsx';
import WriterPage from './pages/WriterPage.tsx';
import useUseCases from './hooks/useUseCases';
import { Toaster } from 'sonner';

const ragEnabled: boolean = import.meta.env.VITE_APP_RAG_ENABLED === 'true';
const ragKnowledgeBaseEnabled: boolean =
  import.meta.env.VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED === 'true';
const samlAuthEnabled: boolean =
  import.meta.env.VITE_APP_SAMLAUTH_ENABLED === 'true';
const agentEnabled: boolean = import.meta.env.VITE_APP_AGENT_ENABLED === 'true';
const inlineAgents: boolean = import.meta.env.VITE_APP_INLINE_AGENTS === 'true';
const {
  visionEnabled,
  imageGenModelIds,
  videoGenModelIds,
  speechToSpeechModelIds,
} = MODELS;
const useCaseBuilderEnabled: boolean =
  import.meta.env.VITE_APP_USE_CASE_BUILDER_ENABLED === 'true';
// eslint-disable-next-line  react-hooks/rules-of-hooks
const { enabled } = useUseCases();

const routes: RouteObject[] = [
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/setting',
    element: <Setting />,
  },
  {
    path: '/chat',
    element: <ChatPage />,
  },
  {
    path: '/chat/:chatId',
    element: <ChatPage />,
  },
  {
    path: '/share/:shareId',
    element: <SharedChatPage />,
  },
  enabled('generate')
    ? {
        path: '/generate',
        element: <GenerateTextPage />,
      }
    : null,
  enabled('summarize')
    ? {
        path: '/summarize',
        element: <SummarizePage />,
      }
    : null,
  enabled('writer')
    ? {
        path: '/writer',
        element: <WriterPage />,
      }
    : null,
  enabled('translate')
    ? {
        path: '/translate',
        element: <TranslatePage />,
      }
    : null,
  enabled('webContent')
    ? {
        path: '/web-content',
        element: <WebContent />,
      }
    : null,
  imageGenModelIds.length > 0 && enabled('image')
    ? {
        path: '/image',
        element: <GenerateImagePage />,
      }
    : null,
  videoGenModelIds.length > 0 && enabled('video')
    ? {
        path: '/video',
        element: <GenerateVideoPage />,
      }
    : null,
  enabled('diagram')
    ? {
        path: '/diagram',
        element: <GenerateDiagramPage />,
      }
    : null,
  optimizePromptEnabled
    ? {
        path: '/optimize',
        element: <OptimizePromptPage />,
      }
    : null,
  {
    path: '/transcribe',
    element: <TranscribePage />,
  },
  {
    path: '/flow-chat',
    element: <FlowChatPage />,
  },
  visionEnabled && enabled('videoAnalyzer')
    ? {
        path: '/video-analyzer',
        element: <VideoAnalyzerPage />,
      }
    : null,
  ragEnabled
    ? {
        path: '/rag',
        element: <RagPage />,
      }
    : null,
  ragKnowledgeBaseEnabled
    ? {
        path: '/rag-knowledge-base',
        element: <RagKnowledgeBasePage />,
      }
    : null,
  agentEnabled && !inlineAgents
    ? {
        path: '/agent',
        element: <AgentChatPage />,
      }
    : null,
  agentEnabled && inlineAgents
    ? {
        path: '/agent/:agentName',
        element: <AgentChatPage />,
      }
    : null,
  speechToSpeechModelIds.length > 0 && enabled('voiceChat')
    ? {
        path: '/voice-chat',
        element: <VoiceChatPage />,
      }
    : null,
  {
    path: '*',
    element: <NotFound />,
  },
].flatMap((r) => (r !== null ? [r] : []));

const useCaseBuilderRoutes: RouteObject[] = [
  {
    path: '/use-case-builder',
    element: <UseCaseBuilderSamplesPage />,
  },
  {
    path: `/use-case-builder/my-use-case`,
    element: <UseCaseBuilderMyUseCasePage />,
  },
  {
    path: `/use-case-builder/new`,
    element: <UseCaseBuilderEditPage />,
  },
  {
    path: `/use-case-builder/edit/:useCaseId`,
    element: <UseCaseBuilderEditPage />,
  },
  {
    path: `/use-case-builder/execute/:useCaseId`,
    element: <UseCaseBuilderExecutePage />,
  },
  {
    path: `/use-case-builder/setting`,
    element: <Setting />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
].flatMap((r) => (r !== null ? [r] : []));

const router = createBrowserRouter([
  {
    path: '/',
    element: samlAuthEnabled ? (
      <AuthWithSAML>
        <App />
      </AuthWithSAML>
    ) : (
      <AuthWithUserpool>
        <App />
      </AuthWithUserpool>
    ),
    children: routes,
  },
  ...(useCaseBuilderEnabled
    ? [
        {
          path: '/use-case-builder',
          element: samlAuthEnabled ? (
            <AuthWithSAML>
              <UseCaseBuilderRoot />
            </AuthWithSAML>
          ) : (
            <AuthWithUserpool>
              <UseCaseBuilderRoot />
            </AuthWithUserpool>
          ),
          children: useCaseBuilderRoutes,
        },
      ]
    : []),
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
    <React.Suspense fallback={<div>Loading...</div>}>
      <Authenticator.Provider>
        <RouterProvider router={router} />
        <Toaster />
      </Authenticator.Provider>
    </React.Suspense>
  </React.StrictMode>
);
