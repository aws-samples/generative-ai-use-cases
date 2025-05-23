import React, { useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import Select from '../components/Select';
import ExpandableField from '../components/ExpandableField';
import { create } from 'zustand';
import { MODELS } from '../hooks/useModel';
import queryString from 'query-string';
import useDiagram from '../hooks/useDiagram';
import { DiagramPageQueryParams } from '../@types/navigate';
import Markdown from '../components/Markdown';
import { RiRobot2Line, RiMindMap } from 'react-icons/ri';
import { BiAbacus } from 'react-icons/bi';
import { BsDiagram3 } from 'react-icons/bs';
import { GrCluster } from 'react-icons/gr';
import { VscTypeHierarchy } from 'react-icons/vsc';
import { FaChartGantt, FaTimeline } from 'react-icons/fa6';
import { PiChartPieDuotone } from 'react-icons/pi';
import { GoChecklist } from 'react-icons/go';
import { LiaMailBulkSolid } from 'react-icons/lia';
import {
  TbGitBranch,
  TbRoute,
  TbChartSankey,
  TbChartDots3,
  TbMathXy,
  TbBrandAws,
  TbPackages,
  TbMathSymbols,
} from 'react-icons/tb';
import { useTranslation } from 'react-i18next';

const DiagramRenderer = lazy(() => import('../components/DiagramRenderer'));

type StateType = {
  content: string;
  setContent: (s: string) => void;
  diagramCode: string;
  setDiagramCode: (s: string) => void;
  diagramSentence: string;
  setDiagramSentence: (s: string) => void;
  selectedType: DiagramType;
  setSelectedType: (s: DiagramType) => void;
  diagramGenerationError: Error | null;
  setDiagramGenerationError: (e: Error | null) => void;
  clear: () => void;
};

const useDiagramPageState = create<StateType>((set) => {
  const INIT_STATE = {
    content: '',
    diagramCode: '',
    diagramSentence: '',
    selectedType: 'AI' as DiagramType,
    diagramGenerationError: null,
  };
  return {
    ...INIT_STATE,
    setContent: (s: string) => set({ content: s }),
    setDiagramCode: (s: string) => set({ diagramCode: s }),
    setDiagramSentence: (s: string) => set({ diagramSentence: s }),
    setSelectedType: (type: DiagramType) => set({ selectedType: type }),
    setDiagramGenerationError: (e: Error | null) =>
      set({ diagramGenerationError: e }),
    clear: () => set(INIT_STATE),
  };
});

type DiagramType =
  | 'AI'
  | 'flowchart'
  | 'piechart'
  | 'mindmap'
  | 'quadrantchart'
  | 'sequencediagram'
  | 'timeline'
  | 'gitgraph'
  | 'erdiagram'
  | 'classdiagram'
  | 'statediagram'
  | 'xychart'
  | 'blockdiagram'
  | 'architecture'
  | 'ganttchart'
  | 'userjourney'
  | 'sankeychart'
  | 'requirementdiagram'
  | 'networkpacket';

type DiagramInfo = {
  id: DiagramType;
  icon: React.ElementType;
  title: string;
  description: string;
  example: {
    title: string;
    content: string;
  };
  category: 'main' | 'other';
};

const GenerateDiagramPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    content,
    setContent,
    diagramCode,
    setDiagramCode,
    diagramSentence,
    setDiagramSentence,
    selectedType,
    setSelectedType,
    diagramGenerationError,
    setDiagramGenerationError,
    clear,
  } = useDiagramPageState();
  const { pathname, search } = useLocation();
  const {
    loading,
    getModelId,
    setModelId,
    clear: clearChat,
    setLoading,
    messages,
    isEmpty,
    postDiagram,
    diagramType,
  } = useDiagram(pathname);

  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();

  const disabledExec = useMemo(() => {
    return content === '' || loading;
  }, [content, loading]);

  const handleMarkdownChange = (markdown: string) => {
    setDiagramCode(markdown);
  };

  useEffect(() => {
    (() => {
      if (search) {
        const params = queryString.parse(search) as DiagramPageQueryParams;
        const modelIdFromParams = params.modelId;

        if (params.content) {
          setContent(params.content);
        }

        if (modelIdFromParams && availableModels.includes(modelIdFromParams)) {
          setModelId(modelIdFromParams);
        } else {
          setModelId(availableModels[0]);
        }
      } else {
        setModelId(availableModels[0]);
      }
    })();
    // To avoid infinite loops, only keep the following dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels, search]);

  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    const currentMessage = lastMessage.content;

    if (currentMessage.toLowerCase().includes('```mermaid')) {
      const mermaidCode = currentMessage
        .split('```mermaid')[1]
        .split('```')[0]
        .trim();
      setDiagramCode(mermaidCode);
    }

    if (currentMessage.toLowerCase().includes('<description>')) {
      const mermaidDescription = currentMessage
        .split(/<description>/i)[1]
        .split(/<\/description>/i)[0]
        .trim();
      setDiagramSentence(mermaidDescription);
    } else if (currentMessage.includes(t('diagram.serverBusy'))) {
      setDiagramSentence(t('diagram.serverBusy'));
    } else {
      setDiagramSentence(currentMessage);
    }
  }, [messages, setDiagramCode, setDiagramSentence, t]);

  const onClickExec = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    // I want to clear the previous result, so clear content except
    setDiagramGenerationError(null);
    setDiagramCode('');
    setDiagramSentence('');

    try {
      await postDiagram(content, selectedType);
    } catch (error: unknown) {
      if (error instanceof Error) setDiagramGenerationError(error);
      else setDiagramGenerationError(new Error(`${error}`));
    }
  }, [
    content,
    loading,
    postDiagram,
    selectedType,
    setDiagramCode,
    setDiagramGenerationError,
    setDiagramSentence,
    setLoading,
  ]);

  const onClickClear = useCallback(() => {
    clear();
    clearChat();
  }, [clear, clearChat]);

  // Define the diagram data with translation
  const DiagramData = useMemo<Record<DiagramType, DiagramInfo>>(
    () => ({
      AI: {
        id: 'AI',
        icon: RiRobot2Line,
        title: 'AI',
        description: t('diagram.types.AI.description'),
        example: {
          title: t('diagram.types.AI.exampleTitle'),
          content: t('diagram.types.AI.content'),
        },
        category: 'main',
      },
      flowchart: {
        id: 'flowchart',
        icon: VscTypeHierarchy,
        title: t('diagram.types.flowchart.title'),
        description: t('diagram.types.flowchart.desc'),
        example: {
          title: t('diagram.types.flowchart.exampleTitle'),
          content: t('diagram.types.flowchart.content'),
        },
        category: 'main',
      },
      piechart: {
        id: 'piechart',
        icon: PiChartPieDuotone,
        title: t('diagram.types.piechart.title'),
        description: t('diagram.types.piechart.desc'),
        example: {
          title: t('diagram.types.piechart.exampleTitle'),
          content: t('diagram.types.piechart.content'),
        },
        category: 'main',
      },
      mindmap: {
        id: 'mindmap',
        icon: RiMindMap,
        title: t('diagram.types.mindmap.title'),
        description: t('diagram.types.mindmap.desc'),
        example: {
          title: t('diagram.types.mindmap.exampleTitle'),
          content: t('diagram.types.mindmap.content'),
        },
        category: 'main',
      },
      quadrantchart: {
        id: 'quadrantchart',
        icon: TbMathSymbols,
        title: t('diagram.types.quadrantchart.title'),
        description: t('diagram.types.quadrantchart.desc'),
        example: {
          title: t('diagram.types.quadrantchart.exampleTitle'),
          content: t('diagram.types.quadrantchart.content'),
        },
        category: 'other',
      },
      sequencediagram: {
        id: 'sequencediagram',
        icon: BiAbacus,
        title: t('diagram.types.sequencediagram.title'),
        description: t('diagram.types.sequencediagram.desc'),
        example: {
          title: t('diagram.types.sequencediagram.exampleTitle'),
          content: t('diagram.types.sequencediagram.content'),
        },
        category: 'other',
      },
      timeline: {
        id: 'timeline',
        icon: FaTimeline,
        title: t('diagram.types.timeline.title'),
        description: t('diagram.types.timeline.desc'),
        example: {
          title: t('diagram.types.timeline.exampleTitle'),
          content: t('diagram.types.timeline.content'),
        },
        category: 'other',
      },
      gitgraph: {
        id: 'gitgraph',
        icon: TbGitBranch,
        title: t('diagram.types.gitgraph.title'),
        description: t('diagram.types.gitgraph.desc'),
        example: {
          title: t('diagram.types.gitgraph.exampleTitle'),
          content: t('diagram.types.gitgraph.content'),
        },
        category: 'other',
      },
      erdiagram: {
        id: 'erdiagram',
        icon: GrCluster,
        title: t('diagram.types.erdiagram.title'),
        description: t('diagram.types.erdiagram.desc'),
        example: {
          title: t('diagram.types.erdiagram.exampleTitle'),
          content: t('diagram.types.erdiagram.content'),
        },
        category: 'other',
      },
      classdiagram: {
        id: 'classdiagram',
        icon: BsDiagram3,
        title: t('diagram.types.classdiagram.title'),
        description: t('diagram.types.classdiagram.desc'),
        example: {
          title: t('diagram.types.classdiagram.exampleTitle'),
          content: t('diagram.types.classdiagram.content'),
        },
        category: 'other',
      },
      statediagram: {
        id: 'statediagram',
        icon: TbChartDots3,
        title: t('diagram.types.statediagram.title'),
        description: t('diagram.types.statediagram.desc'),
        example: {
          title: t('diagram.types.statediagram.exampleTitle'),
          content: t('diagram.types.statediagram.content'),
        },
        category: 'other',
      },
      xychart: {
        id: 'xychart',
        icon: TbMathXy,
        title: t('diagram.types.xychart.title'),
        description: t('diagram.types.xychart.desc'),
        example: {
          title: t('diagram.types.xychart.exampleTitle'),
          content: t('diagram.types.xychart.content'),
        },
        category: 'other',
      },
      blockdiagram: {
        id: 'blockdiagram',
        icon: TbPackages,
        title: t('diagram.types.blockdiagram.title'),
        description: t('diagram.types.blockdiagram.desc'),
        example: {
          title: t('diagram.types.blockdiagram.exampleTitle'),
          content: t('diagram.types.blockdiagram.content'),
        },
        category: 'other',
      },
      architecture: {
        id: 'architecture',
        icon: TbBrandAws,
        title: t('diagram.types.architecture.title'),
        description: t('diagram.types.architecture.desc'),
        example: {
          title: t('diagram.types.architecture.exampleTitle'),
          content: t('diagram.types.architecture.content'),
        },
        category: 'other',
      },
      ganttchart: {
        id: 'ganttchart',
        icon: FaChartGantt,
        title: t('diagram.types.ganttchart.title'),
        description: t('diagram.types.ganttchart.desc'),
        example: {
          title: t('diagram.types.ganttchart.exampleTitle'),
          content: t('diagram.types.ganttchart.content'),
        },
        category: 'other',
      },
      userjourney: {
        id: 'userjourney',
        icon: TbRoute,
        title: t('diagram.types.userjourney.title'),
        description: t('diagram.types.userjourney.desc'),
        example: {
          title: t('diagram.types.userjourney.exampleTitle'),
          content: t('diagram.types.userjourney.content'),
        },
        category: 'other',
      },
      sankeychart: {
        id: 'sankeychart',
        icon: TbChartSankey,
        title: t('diagram.types.sankeychart.title'),
        description: t('diagram.types.sankeychart.desc'),
        example: {
          title: t('diagram.types.sankeychart.exampleTitle'),
          content: t('diagram.types.sankeychart.content'),
        },
        category: 'other',
      },
      requirementdiagram: {
        id: 'requirementdiagram',
        icon: GoChecklist,
        title: t('diagram.types.requirementdiagram.title'),
        description: t('diagram.types.requirementdiagram.desc'),
        example: {
          title: t('diagram.types.requirementdiagram.exampleTitle'),
          content: t('diagram.types.requirementdiagram.content'),
        },
        category: 'other',
      },
      networkpacket: {
        id: 'networkpacket',
        icon: LiaMailBulkSolid,
        title: t('diagram.types.networkpacket.title'),
        description: t('diagram.types.networkpacket.desc'),
        example: {
          title: t('diagram.types.networkpacket.exampleTitle'),
          content: t('diagram.types.networkpacket.content'),
        },
        category: 'other',
      },
    }),
    [t]
  );

  const MainTypeOptions = useMemo(
    () =>
      Object.values(DiagramData).filter(
        (diagram) => diagram.category === 'main'
      ),
    [DiagramData]
  );

  const OtherTypeOption = useMemo(
    () =>
      Object.values(DiagramData).filter(
        (diagram) => diagram.category === 'other'
      ),
    [DiagramData]
  );

  const DiagramTypeButton: React.FC<{
    option: DiagramInfo;
    isSelected: boolean;
    onClick: (id: DiagramType) => void;
  }> = ({ option, isSelected, onClick }) => (
    <button
      onClick={() => onClick(option.id)}
      className={`min-h-[155px] w-[calc(25%)] min-w-[110px] max-w-[130px] flex-col rounded-lg border px-1 hover:bg-blue-50
        ${isSelected ? 'border-blue-600 bg-blue-100' : 'border-gray-500 bg-white'}`}>
      <div className="text-2xl">
        {React.createElement(option.icon, {
          size: '1.5rem',
          className: `mx-auto ${isSelected ? 'text-gray-900' : 'text-gray-500'}`,
        })}
      </div>
      <div
        className={`my-3 text-xs font-bold ${isSelected ? 'text-black' : 'text-gray-500'}`}>
        {option.title}
      </div>
      <div
        className={`text-xs ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
        {option.description}
      </div>
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <div className="invisible col-span-12 my-0 ml-5 h-0 items-center text-xl font-semibold lg:visible lg:mb-0 lg:mt-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('diagram.title')}
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-4 p-4 lg:h-[calc(100vh-4rem)] lg:flex-row">
        {/* Left column: Input area */}
        <div className="w-full lg:w-[45%]">
          <Card
            label={t('diagram.input_label')}
            className="flex h-full flex-col">
            <div className="overflow-y-auto pb-5 pl-1">
              <div className="mb-2">
                <Select
                  value={modelId}
                  onChange={setModelId}
                  options={availableModels.map((m) => ({
                    value: m,
                    label: modelDisplayName(m),
                  }))}
                  label={t('diagram.model')}
                />
              </div>
              {/* Select the main type */}
              <div className="mb-2">
                <label className="mb-2 block text-sm font-bold text-gray-700">
                  <>
                    {t('diagram.diagram_type')}{' '}
                    {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
                    <span className="font-normal">
                      - {DiagramData[selectedType].title}
                    </span>
                  </>
                </label>
                <div className="scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 flex gap-2 overflow-x-auto pb-2">
                  {MainTypeOptions.map((option) => (
                    <DiagramTypeButton
                      key={option.id}
                      option={option}
                      isSelected={selectedType === option.id}
                      onClick={setSelectedType}
                    />
                  ))}
                </div>
              </div>

              {/* Select other types */}
              <ExpandableField label={t('diagram.other_diagram_types')}>
                <div className="scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 flex gap-2 overflow-x-auto pb-2">
                  {OtherTypeOption.map((option) => (
                    <DiagramTypeButton
                      key={option.id}
                      option={option}
                      isSelected={selectedType === option.id}
                      onClick={setSelectedType}
                    />
                  ))}
                </div>
              </ExpandableField>

              <div className="my-4">
                <Textarea
                  placeholder={t('diagram.input_placeholder')}
                  value={content}
                  onChange={setContent}
                  className="w-full resize-none overflow-y-auto"
                />
              </div>

              {/* Place the input example and buttons */}
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                {/* Input example */}
                <div className="w-full sm:w-auto">
                  <div className="mb-1 text-sm font-bold text-gray-600">
                    {t('diagram.input_example')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="cursor-pointer rounded-full border px-4 py-1 text-sm text-gray-600 hover:bg-gray-50"
                      onClick={() =>
                        setContent(DiagramData[selectedType].example.content)
                      }
                      outlined>
                      {DiagramData[selectedType].example.title}
                    </Button>
                  </div>
                </div>

                {/* Clear & Generate buttons */}
                <div className="mr-2 flex flex-col gap-1 sm:flex-row">
                  <Button
                    outlined
                    onClick={onClickClear}
                    disabled={disabledExec}>
                    {t('diagram.clear')}
                  </Button>
                  <Button disabled={disabledExec} onClick={onClickExec}>
                    {t('diagram.generate')}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right column: Output area */}
        <div className="w-full lg:w-[55%]">
          <Card
            label={t('diagram.result')}
            className="flex h-full flex-col px-3">
            <div className="min-h-0 flex-1 overflow-auto">
              {/* Display the generation status */}
              {loading && (
                <div className="mb-4 space-y-2">
                  {/* Step1 display */}
                  {diagramType === '' ? (
                    <div className="flex min-h-[40px] items-center justify-center rounded-md bg-gray-50 p-3">
                      <span className="text-gray-600">
                        {t('diagram.step1_loading')}
                      </span>
                      <div className="border-aws-sky ml-2 size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
                    </div>
                  ) : (
                    <div className="flex min-h-[40px] flex-col items-center justify-center rounded-md bg-blue-50 p-3">
                      <span className="text-gray-600">
                        {t('diagram.step1_complete')}
                      </span>
                      <span className="mt-1 text-gray-600">
                        {
                          DiagramData[diagramType as keyof typeof DiagramData]
                            ?.title
                        }
                        {t('diagram.step1_selected')}
                      </span>
                    </div>
                  )}

                  {/* Step2 display */}
                  {diagramType !== '' && (
                    <div className="flex min-h-[40px] items-center justify-center rounded-md bg-gray-50 p-3">
                      <span className="text-gray-600">
                        {t('diagram.step2_loading')}
                      </span>
                      <div className="border-aws-sky ml-2 size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
                    </div>
                  )}
                </div>
              )}

              {/* Display the diagram and description */}
              <div className="space-y-4">
                {diagramSentence.length > 0 && (
                  <div className="rounded-lg bg-gray-50 p-4">
                    <h3 className="mb-2 text-lg font-medium">
                      {t('diagram.answer')}
                    </h3>
                    <div className="flex justify-start whitespace-pre-wrap">
                      {diagramSentence}
                    </div>
                  </div>
                )}

                {diagramCode.length > 0 && (
                  <div className="rounded-lg bg-gray-50">
                    <h3 className="border-b border-gray-200 p-4 text-lg font-medium">
                      {DiagramData[diagramType as keyof typeof DiagramData]
                        ?.title || t('diagram.chart')}
                    </h3>
                    {loading ? (
                      <div className="p-3">
                        <Markdown>
                          {['```mermaid', diagramCode, '```'].join('\n')}
                        </Markdown>
                      </div>
                    ) : (
                      <div className="p-3">
                        <Suspense fallback={<div>{t('common.loading')}</div>}>
                          <DiagramRenderer
                            code={diagramCode}
                            handleMarkdownChange={handleMarkdownChange}
                          />
                        </Suspense>
                      </div>
                    )}
                  </div>
                )}

                {!loading && isEmpty && (
                  <div className="rounded-lg py-8 text-center text-gray-500">
                    {t('diagram.diagram_will_appear')}
                  </div>
                )}

                {diagramGenerationError && (
                  <div className="rounded-lg bg-red-50 p-4 text-red-600">
                    {diagramGenerationError.message}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GenerateDiagramPage;
