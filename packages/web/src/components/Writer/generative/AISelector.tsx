import { Command, CommandInput } from '../ui/Command';

import {
  PiArrowUp,
  PiMagnifyingGlass,
  PiSpinner,
  PiMagicWand,
} from 'react-icons/pi';
import { useEditor } from 'novel';
import { addAIHighlight } from 'novel';
import { useState } from 'react';
import Markdown from 'react-markdown';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/ScrollArea';
import AICompletionCommands from './AICompletionCommand';
import AISelectorCommands from './AISelectorCommands';
import useWriter from '../../../hooks/useWriter';
import { useTranslation } from 'react-i18next';

interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISelector({ onOpenChange }: AISelectorProps) {
  const { t } = useTranslation();
  const { editor } = useEditor();
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<'instruction' | 'searchAgent'>(
    'instruction'
  );

  const [trace, setTrace] = useState('');
  const [completion, setCompletion] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const { write } = useWriter();

  const complete = async (
    text: string,
    options: { body: { option: string; command: string } }
  ) => {
    try {
      setIsLoading(true);
      setCompletion('');

      const stream = write(text, options.body.option, options.body.command);

      let trace = '';
      let fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.text) {
          fullResponse += chunk.text;
          fullResponse = fullResponse.replace('</output>', '');
          setCompletion(fullResponse);
        }
        if (chunk.trace) {
          trace += chunk.trace;
          setTrace(trace);
        }
      }
    } catch (e: unknown) {
      toast.error(
        typeof e === 'object' && e && 'message' in e
          ? (e.message as string)
          : t('writer.ai.error')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const hasCompletion = completion.length > 0 || trace.length > 0;
  if (!editor) return null;

  return (
    <Command className="w-[350px]">
      {hasCompletion && (
        <div className="flex max-h-[400px]">
          <ScrollArea>
            {trace && (
              <details className="prose prose-sm p-2 px-4">
                <summary>
                  <div className="inline-flex gap-1">
                    {t('writer.ai.trace')}
                    {isLoading && !completion && (
                      <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
                    )}
                  </div>
                </summary>
                <Markdown>{trace}</Markdown>
              </details>
            )}
            <div className="prose prose-sm p-2 px-4">
              <Markdown>{completion}</Markdown>
            </div>
          </ScrollArea>
        </div>
      )}

      {isLoading && (
        <div className="flex h-12 w-full items-center px-4 text-sm font-medium text-purple-500">
          <PiMagicWand className="mr-2 h-4 w-4 shrink-0  " />
          {t('writer.ai.thinking')}
          <div className="ml-2 mt-1">
            <PiSpinner className="h-4 w-4 animate-spin" />
          </div>
        </div>
      )}
      {!isLoading && (
        <>
          <div className="relative">
            <CommandInput
              className="border-none pr-6"
              value={inputValue}
              onValueChange={setInputValue}
              autoFocus
              placeholder={
                hasCompletion
                  ? t('writer.ai.continue_instruct')
                  : inputMode === 'searchAgent'
                    ? t('writer.ai.search_instruct')
                    : t('writer.ai.instruct_ai')
              }
              onFocus={() => addAIHighlight(editor)}
            />
            <Button
              size="icon"
              className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-purple-500 hover:bg-purple-900"
              onClick={() => {
                const option = inputMode === 'searchAgent' ? 'search' : 'zap';

                if (completion)
                  return complete(completion, {
                    body: { option: option, command: inputValue },
                  }).then(() => setInputValue(''));

                const slice = editor.state.selection.content();
                const text = editor.storage.markdown.serializer.serialize(
                  slice.content
                );

                complete(text, {
                  body: { option, command: inputValue },
                }).then(() => setInputValue(''));
              }}>
              {inputMode === 'searchAgent' ? (
                <PiMagnifyingGlass className="h-4 w-4" />
              ) : (
                <PiArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
          {hasCompletion ? (
            <AICompletionCommands
              onDiscard={() => {
                editor.chain().unsetHighlight().focus().run();
                onOpenChange(false);
              }}
              completion={completion}
            />
          ) : inputMode === 'instruction' ? (
            <AISelectorCommands
              onSelect={(value, option) => {
                if (option === 'search') {
                  setInputMode('searchAgent');
                } else {
                  complete(value, { body: { option, command: inputValue } });
                }
              }}
            />
          ) : null}
        </>
      )}
    </Command>
  );
}
