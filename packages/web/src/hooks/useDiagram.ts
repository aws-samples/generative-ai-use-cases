import { useMemo, useCallback, useState } from 'react';
import useChatApi from './useChatApi';
import { findModelByModelId } from './useModel';
import { getPrompter } from '../prompts';
import useChat from '../hooks/useChat';
import { PredictRequest } from 'generative-ai-use-cases';
import { useTranslation } from 'react-i18next';

const useDiagram = (id: string) => {
  const { t } = useTranslation();

  const {
    loading,
    getModelId,
    setModelId,
    setLoading,
    clear,
    updateSystemContext,
    messages,
    isEmpty,
    postChat,
  } = useChat(id);

  const modelId = useMemo(() => getModelId(), [getModelId]);
  const model = useMemo(() => {
    const mid = getModelId();
    return findModelByModelId(mid);
  }, [getModelId]);
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);
  const { predict } = useChatApi();

  const diagramTypeToJapanese = useMemo(() => {
    return {
      flowchart: t('diagram.types.flowchart.title'),
      piechart: t('diagram.types.piechart.title'),
      mindmap: t('diagram.types.mindmap.title'),
      quadrantchart: t('diagram.types.quadrantchart.title'),
      sequencediagram: t('diagram.types.sequencediagram.title'),
      timeline: t('diagram.types.timeline.title'),
      gitgraph: t('diagram.types.gitgraph.title'),
      erdiagram: t('diagram.types.erdiagram.title'),
      classdiagram: t('diagram.types.classdiagram.title'),
      statediagram: t('diagram.types.statediagram.title'),
      xychart: t('diagram.types.xychart.title'),
      blockdiagram: t('diagram.types.blockdiagram.title'),
      architecture: t('diagram.types.architecture.title'),
      ganttchart: t('diagram.types.ganttchart.title'),
      userjourney: t('diagram.types.userjourney.title'),
      sankeychart: t('diagram.types.sankeychart.title'),
      requirementdiagram: t('diagram.types.requirementdiagram.title'),
      networkpacket: t('diagram.types.networkpacket.title'),
    } as const;
  }, [t]);

  type DiagramType = keyof typeof diagramTypeToJapanese;

  const validTypes = useMemo(
    () => Object.keys(diagramTypeToJapanese) as DiagramType[],
    [diagramTypeToJapanese]
  );
  const [diagramType, setDiagramType] = useState<DiagramType | ''>('');

  // Extract the diagram type
  const extractDiagramType = useCallback(
    (targetText: string): DiagramType => {
      const defaultType = validTypes[0];
      const match = targetText.match(/<output>(.*?)<\/output>/i);
      if (!match) return defaultType;

      const content = match[1].toLowerCase();

      // Full match check
      if (validTypes.includes(content as DiagramType)) {
        return content as DiagramType;
      }

      // Partial match check
      const matchingType = validTypes.find(
        (type) => content.includes(type) || type.includes(content)
      );
      return matchingType || defaultType;
    },
    [validTypes]
  );

  const selectDiagram = useCallback(
    async (content: string) => {
      try {
        if (!model) {
          throw new Error('Model not found');
        }

        const payload: PredictRequest = {
          model: model,
          messages: [
            {
              role: 'system',
              content: prompter.diagramPrompt({ determineType: true }),
            },
            {
              role: 'user',
              content: `<content>${content}</content>`,
            },
          ],
          id: id,
        };

        const res = await predict(payload);
        const type = extractDiagramType(res);
        setDiagramType(type);
        return type;
      } catch (error: unknown) {
        throw `${error}`;
      }
    },
    [id, model, predict, prompter, extractDiagramType]
  );

  const postDiagram = useCallback(
    async (content: string, type: DiagramType | 'AI') => {
      setDiagramType('');
      try {
        let chosenType = type;

        // 1. When "AI" is selected, determine the diagram type
        if (type === 'AI') {
          chosenType = await selectDiagram(content);
        } else {
          setDiagramType(type);
        }

        // 2. Clear the past history of messages
        clear();

        // 3. Set the system prompt for the determined diagram type
        const systemPrompt = prompter.diagramPrompt({
          determineType: false,
          diagramType: chosenType,
        });
        updateSystemContext(systemPrompt);

        // 4. Generate the diagram
        await postChat(content, true);
      } catch (error: unknown) {
        setLoading(false);
        throw `${error}`;
      }
    },
    [clear, prompter, updateSystemContext, postChat, selectDiagram, setLoading]
  );

  return {
    loading,
    getModelId,
    setModelId,
    setLoading,
    clear,
    messages,
    isEmpty,
    postDiagram,
    diagramType,
  };
};

export default useDiagram;
