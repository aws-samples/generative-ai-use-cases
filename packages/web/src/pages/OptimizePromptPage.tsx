import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import Card from '../components/Card';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import Select from '../components/Select';
import Markdown from '../components/Markdown';
import ButtonCopy from '../components/ButtonCopy';
import useOptimizePrompt from '../hooks/useOptimizePrompt';
import { MODELS } from '../hooks/useModel';

type StateType = {
  prompt: string;
  setPrompt: (s: string) => void;
  modelId: string;
  setModelId: (s: string) => void;
  optimizedPrompt: string;
  setOptimizedPrompt: (s: string) => void;
  clear: () => void;
};

const useOptimizePromptState = create<StateType>((set, get) => {
  const INIT_STATE = {
    prompt: '',
    modelId: '',
    optimizedPrompt: '',
  };

  return {
    ...INIT_STATE,
    setPrompt: (p: string) => {
      set(() => ({
        prompt: p,
      }));
    },
    setModelId: (m: string) => {
      set(() => ({
        modelId: m,
      }));
    },
    setOptimizedPrompt: (p: string) => {
      set(() => ({
        optimizedPrompt: p,
      }));
    },
    clear: () => {
      set({
        ...INIT_STATE,
        modelId: get().modelId,
      });
    },
  };
});

const OptimizePromptPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    prompt,
    setPrompt,
    modelId,
    setModelId,
    optimizedPrompt,
    setOptimizedPrompt,
    clear,
  } = useOptimizePromptState();
  const { supportedModelIds, optimizePrompt } = useOptimizePrompt();
  const [loading, setLoading] = useState(false);
  const { modelDisplayName } = MODELS;

  useEffect(() => {
    // If supportedModelIds is 0, this page will be disabled
    // index out of range will not occur
    setModelId(supportedModelIds[0]);
  }, [supportedModelIds, setModelId]);

  const onClickExec = useCallback(async () => {
    if (loading) return;

    setLoading(true);

    try {
      const stream = optimizePrompt({ prompt, targetModelId: modelId });

      let tmpOptimizedPrompt = '';

      for await (const chunk of stream) {
        tmpOptimizedPrompt += chunk;
      }

      tmpOptimizedPrompt = JSON.parse(tmpOptimizedPrompt);

      setOptimizedPrompt(tmpOptimizedPrompt);
    } catch (e) {
      console.error(e);

      setOptimizedPrompt(`${e}`);
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    setLoading,
    optimizePrompt,
    prompt,
    modelId,
    setOptimizedPrompt,
  ]);

  const disabledExec = useMemo(() => {
    return prompt === '' || loading;
  }, [prompt, loading]);

  return (
    <div className="grid grid-cols-12">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('optimizePrompt.title')}
      </div>
      <div className="col-span-12 col-start-1 mx-2 lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
        <Card>
          <Select
            value={modelId}
            onChange={setModelId}
            options={supportedModelIds.map((m) => {
              return { value: m, label: modelDisplayName(m) };
            })}
          />
          <div className="flex w-full flex-col lg:flex-row">
            <div className="w-full lg:w-1/2">
              <Textarea
                placeholder={t('optimizePrompt.input_placeholder')}
                value={prompt}
                onChange={setPrompt}
                maxHeight={-1}
                rows={5}
              />
            </div>
            <div className="w-full lg:ml-2 lg:w-1/2">
              <div className="rounded border border-black/30 p-1.5">
                <Markdown>{optimizedPrompt}</Markdown>
                {loading && (
                  <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
                )}
                {!loading && optimizedPrompt === '' && (
                  <div className="text-gray-500">
                    {t('optimizePrompt.result_placeholder')}
                  </div>
                )}
                <div className="flex w-full justify-end">
                  <ButtonCopy
                    text={optimizedPrompt}
                    interUseCasesKey="optimizePrompt"></ButtonCopy>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-3">
                <Button onClick={clear} outlined disabled={disabledExec}>
                  {t('optimizePrompt.clear')}
                </Button>
                <Button onClick={onClickExec} disabled={disabledExec}>
                  {t('optimizePrompt.execute')}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OptimizePromptPage;
