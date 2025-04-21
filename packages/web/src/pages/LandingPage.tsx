import React from 'react';
import { useNavigate } from 'react-router-dom';
import CardDemo from '../components/CardDemo';
import Button from '../components/Button';
import {
  PiChatCircleText,
  PiPencil,
  PiNote,
  PiChatsCircle,
  PiTranslate,
  PiGlobe,
  PiImages,
  PiVideoLight,
  PiNotebook,
  PiPen,
  PiRobot,
  PiVideoCamera,
  PiFlowArrow,
  PiTreeStructure,
  PiPenNib,
  PiMicrophoneBold,
} from 'react-icons/pi';
import AwsIcon from '../assets/aws.svg?react';
import useInterUseCases from '../hooks/useInterUseCases';
import {
  AgentPageQueryParams,
  ChatPageQueryParams,
  GenerateImagePageQueryParams,
  GenerateVideoPageQueryParams,
  GenerateTextPageQueryParams,
  InterUseCaseParams,
  RagPageQueryParams,
  SummarizePageQueryParams,
  TranslatePageQueryParams,
  WebContentPageQueryParams,
  VideoAnalyzerPageQueryParams,
  DiagramPageQueryParams,
} from '../@types/navigate';
import queryString from 'query-string';
import { MODELS } from '../hooks/useModel';
import useUseCases from '../hooks/useUseCases';
import { useTranslation } from 'react-i18next';

const ragEnabled: boolean = import.meta.env.VITE_APP_RAG_ENABLED === 'true';
const ragKnowledgeBaseEnabled: boolean =
  import.meta.env.VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED === 'true';
const agentEnabled: boolean = import.meta.env.VITE_APP_AGENT_ENABLED === 'true';
const inlineAgents: boolean = import.meta.env.VITE_APP_INLINE_AGENTS === 'true';
const {
  imageGenModelIds,
  videoGenModelIds,
  speechToSpeechModelIds,
  visionEnabled,
  flowChatEnabled,
  agentNames,
} = MODELS;

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { enabled } = useUseCases();
  const { setIsShow, init } = useInterUseCases();
  const { t } = useTranslation();

  const demoChat = () => {
    const params: ChatPageQueryParams = {
      content: t('landing.demo.chat.content'),
      systemContext: '',
    };
    navigate(`/chat?${queryString.stringify(params)}`);
  };

  const demoRag = () => {
    const params: RagPageQueryParams = {
      content: t('landing.demo.rag.content'),
    };
    navigate(`/rag?${queryString.stringify(params)}`);
  };

  const demoRagKnowledgeBase = () => {
    const params: RagPageQueryParams = {
      content: t('landing.demo.rag.content'),
    };
    navigate(`/rag-knowledge-base?${queryString.stringify(params)}`);
  };

  const demoAgent = () => {
    if (agentNames.includes('CodeInterpreter')) {
      const params: AgentPageQueryParams = {
        modelId: 'CodeInterpreter',
        content: t('landing.demo.agent.content'),
      };
      navigate(`/agent?${queryString.stringify(params)}`);
    } else {
      navigate(`/agent`);
    }
  };

  const demoVoiceChat = () => {
    navigate('/voice-chat');
  };

  const demoGenerate = () => {
    const params: GenerateTextPageQueryParams = {
      information: t('landing.demo.generate.information'),
      context: t('landing.demo.generate.context'),
    };
    navigate(`/generate?${queryString.stringify(params)}`);
  };

  const demoSummarize = () => {
    const params: SummarizePageQueryParams = {
      sentence: t('landing.demo.summarize.sentence'),
      additionalContext: '',
    };
    navigate(`/summarize?${queryString.stringify(params)}`);
  };

  const demoWriter = () => {
    navigate(`/writer`);
  };

  const demoTranslate = () => {
    const params: TranslatePageQueryParams = {
      sentence: t('landing.demo.translate.sentence'),
      additionalContext: '',
      language: t('landing.demo.translate.language'),
    };
    navigate(`/translate?${queryString.stringify(params)}`);
  };

  const demoWebContent = () => {
    const params: WebContentPageQueryParams = {
      url: t('landing.demo.web_content.url'),
      context: '',
    };
    navigate(`/web-content?${queryString.stringify(params)}`);
  };

  const demoGenerateImage = () => {
    const params: GenerateImagePageQueryParams = {
      content: t('landing.demo.image.content'),
    };
    navigate(`/image?${queryString.stringify(params)}`);
  };

  const demoGenerateVideo = () => {
    const params: GenerateVideoPageQueryParams = {
      prompt: 'A banana is dancing in the middle of the ocean',
    };
    navigate(`/video?${queryString.stringify(params)}`);
  };

  const demoVideoAnalyzer = () => {
    const params: VideoAnalyzerPageQueryParams = {
      content: t('landing.demo.video.content'),
    };
    navigate(`/video-analyzer?${queryString.stringify(params)}`);
  };

  const demoGenerateDiagram = () => {
    const params: DiagramPageQueryParams = {
      content: t('landing.demo.diagram.content'),
    };
    navigate(`/diagram?${queryString.stringify(params)}`);
  };

  const demoBlog = () => {
    setIsShow(true);
    init(t('landing.use_cases_integration.blog.title'), [
      {
        title: t('useCaseBuilder.blog.reference_info'),
        description: t('useCaseBuilder.blog.reference_info_description'),
        path: 'web-content',
        params: {
          url: {
            value: 'https://aws.amazon.com/jp/what-is/generative-ai/',
          },
          context: {
            value: t('useCaseBuilder.blog.reference_info_context'),
          },
        } as InterUseCaseParams<WebContentPageQueryParams>,
      },
      {
        title: t('useCaseBuilder.blog.generate_article'),
        description: t('useCaseBuilder.blog.generate_article_description'),
        path: 'generate',
        params: {
          context: {
            value: t('useCaseBuilder.blog.generate_article_context'),
          },
          information: {
            value: '{content}',
          },
        } as InterUseCaseParams<GenerateTextPageQueryParams>,
      },
      {
        title: t('useCaseBuilder.blog.summarize_article'),
        description: t('useCaseBuilder.blog.summarize_article_description'),
        path: 'summarize',
        params: {
          sentence: {
            value: '{text}',
          },
        } as InterUseCaseParams<SummarizePageQueryParams>,
      },
      {
        title: t('useCaseBuilder.blog.generate_thumbnail'),
        description: t('useCaseBuilder.blog.generate_thumbnail_description'),
        path: 'image',
        params: {
          content: {
            value: t('useCaseBuilder.blog.generate_thumbnail_content', {
              summarizedSentence: '{summarizedSentence}',
            }),
          },
        } as InterUseCaseParams<GenerateImagePageQueryParams>,
      },
    ]);
  };

  const demoMeetingReport = () => {
    setIsShow(true);
    init(t('landing.use_cases_integration.meeting.title'), [
      {
        title: t('useCaseBuilder.meeting.transcription'),
        description: t('useCaseBuilder.meeting.transcription_description'),
        path: 'transcribe',
      },
      {
        title: t('useCaseBuilder.meeting.formatting'),
        description: t('useCaseBuilder.meeting.formatting_description'),
        path: 'generate',
        params: {
          context: {
            value: t('useCaseBuilder.meeting.formatting_context'),
          },
          information: {
            value: '{transcript}',
          },
        } as InterUseCaseParams<GenerateTextPageQueryParams>,
      },
      {
        title: t('useCaseBuilder.meeting.create_minutes'),
        description: t('useCaseBuilder.meeting.create_minutes_description'),
        path: 'generate',
        params: {
          context: {
            value: t('useCaseBuilder.meeting.create_minutes_context'),
          },
          information: {
            value: '{text}',
          },
        } as InterUseCaseParams<GenerateTextPageQueryParams>,
      },
    ]);
  };

  const demoFlowChat = () => {
    navigate(`/flow-chat`);
  };

  return (
    <div className="pb-24">
      <div className="bg-aws-squid-ink flex flex-col items-center justify-center px-3 py-5 text-xl font-semibold text-white lg:flex-row">
        <AwsIcon className="mr-5 size-20" />
        {t('landing.title')}
      </div>

      <div className="mx-3 mb-6 mt-5 flex flex-col items-center justify-center text-xs lg:flex-row">
        <Button className="mb-2 mr-0 lg:mb-0 lg:mr-2" onClick={() => {}}>
          {t('common.try')}
        </Button>
        {t('landing.try_message')}
      </div>

      <h1 className="mb-6 flex justify-center text-2xl font-bold">
        {t('landing.use_cases_title')}
      </h1>

      <div className="mx-4 grid gap-x-20 gap-y-5 md:grid-cols-1 xl:mx-20 xl:grid-cols-2">
        <CardDemo
          label={t('landing.use_cases.chat.title')}
          onClickDemo={demoChat}
          icon={<PiChatsCircle />}
          description={t('landing.use_cases.chat.description')}
        />
        {ragEnabled && (
          <CardDemo
            label={t('landing.use_cases.rag_chat.title')}
            sub={t('landing.use_cases.rag_chat.sub_kendra')}
            onClickDemo={demoRag}
            icon={<PiChatCircleText />}
            description={t('landing.use_cases.rag_chat.description_kendra')}
          />
        )}
        {ragKnowledgeBaseEnabled && (
          <CardDemo
            label={t('landing.use_cases.rag_chat.title')}
            sub={t('landing.use_cases.rag_chat.sub_kb')}
            onClickDemo={demoRagKnowledgeBase}
            icon={<PiChatCircleText />}
            description={t('landing.use_cases.rag_chat.description_kb')}
          />
        )}
        {agentEnabled && !inlineAgents && (
          <CardDemo
            label={t('landing.use_cases.agent_chat.title')}
            onClickDemo={demoAgent}
            icon={<PiRobot />}
            description={t('landing.use_cases.agent_chat.description')}
          />
        )}
        {flowChatEnabled && (
          <CardDemo
            label={t('landing.use_cases.flow_chat.title')}
            onClickDemo={demoFlowChat}
            icon={<PiFlowArrow />}
            description={t('landing.use_cases.flow_chat.description')}
          />
        )}
        {speechToSpeechModelIds.length > 0 && enabled('voiceChat') && (
          <CardDemo
            label={t('landing.use_cases.voice_chat.title')}
            onClickDemo={demoVoiceChat}
            icon={<PiMicrophoneBold />}
            description={t('landing.use_cases.voice_chat.description')}
          />
        )}
        {enabled('generate') && (
          <CardDemo
            label={t('landing.use_cases.generate_text.title')}
            onClickDemo={demoGenerate}
            icon={<PiPencil />}
            description={t('landing.use_cases.generate_text.description')}
          />
        )}
        {enabled('summarize') && (
          <CardDemo
            label={t('landing.use_cases.summarize.title')}
            onClickDemo={demoSummarize}
            icon={<PiNote />}
            description={t('landing.use_cases.summarize.description')}
          />
        )}
        {enabled('writer') && (
          <CardDemo
            label={t('landing.use_cases.writer.title')}
            onClickDemo={demoWriter}
            icon={<PiPenNib />}
            description={t('landing.use_cases.writer.description')}
          />
        )}
        {enabled('translate') && (
          <CardDemo
            label={t('landing.use_cases.translate.title')}
            onClickDemo={demoTranslate}
            icon={<PiTranslate />}
            description={t('landing.use_cases.translate.description')}
          />
        )}
        {enabled('webContent') && (
          <CardDemo
            label={t('landing.use_cases.web_content.title')}
            onClickDemo={demoWebContent}
            icon={<PiGlobe />}
            description={t('landing.use_cases.web_content.description')}
          />
        )}
        {imageGenModelIds.length > 0 && enabled('image') && (
          <CardDemo
            label={t('landing.use_cases.image.title')}
            onClickDemo={demoGenerateImage}
            icon={<PiImages />}
            description={t('landing.use_cases.image.description')}
          />
        )}
        {videoGenModelIds.length > 0 && enabled('video') && (
          <CardDemo
            label={t('landing.use_cases.video-generation.title')}
            onClickDemo={demoGenerateVideo}
            icon={<PiVideoLight />}
            description={t('landing.use_cases.video-generation.description')}
          />
        )}
        {visionEnabled && enabled('videoAnalyzer') && (
          <CardDemo
            label={t('landing.use_cases.video-analysis.title')}
            onClickDemo={demoVideoAnalyzer}
            icon={<PiVideoCamera />}
            description={t('landing.use_cases.video-analysis.description')}
          />
        )}
        {enabled('diagram') && (
          <CardDemo
            label={t('landing.use_cases.diagram.title')}
            onClickDemo={demoGenerateDiagram}
            icon={<PiTreeStructure />}
            description={t('landing.use_cases.diagram.description')}
          />
        )}
      </div>

      {
        // If any use case integration is enabled, display it
        // Blog article creation
        (enabled('webContent', 'generate', 'summarize', 'image') ||
          // Meeting report creation
          enabled('generate')) && (
          <>
            <h1 className="mb-6 mt-12 flex justify-center text-2xl font-bold">
              {t('landing.use_cases_integration.title')}
            </h1>

            <div className="mx-4 grid gap-x-20 gap-y-5 md:grid-cols-1 xl:mx-20 xl:grid-cols-2">
              {enabled('webContent', 'generate', 'summarize', 'image') && (
                <CardDemo
                  label={t('landing.use_cases_integration.blog.title')}
                  onClickDemo={demoBlog}
                  icon={<PiPen />}
                  description={t(
                    'landing.use_cases_integration.blog.description'
                  )}
                />
              )}

              {enabled('generate') && (
                <CardDemo
                  label={t('landing.use_cases_integration.meeting.title')}
                  onClickDemo={demoMeetingReport}
                  icon={<PiNotebook />}
                  description={t(
                    'landing.use_cases_integration.meeting.description'
                  )}
                />
              )}
            </div>
          </>
        )
      }
    </div>
  );
};

export default LandingPage;
