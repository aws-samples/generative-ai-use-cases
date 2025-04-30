import {
  PiEqualsThin,
  PiChecks,
  PiArrowClockwise,
  PiSkipForward,
  PiTextAlignJustify,
  PiMagnifyingGlass,
  PiCheck,
  PiFileMagnifyingGlass,
} from 'react-icons/pi';
import { getPrevText, useEditor } from 'novel';
import { CommandGroup, CommandItem, CommandSeparator } from '../ui/Command';
import { MODELS } from '../../../hooks/useModel';
import { useTranslation } from 'react-i18next';

const AISelectorCommands = ({ onSelect }: AISelectorCommandsProps) => {
  const { t } = useTranslation();
  const { editor } = useEditor();

  const options = [
    {
      value: 'improve',
      label: t('writer.ai.options.improve'),
      icon: PiArrowClockwise,
    },
    {
      value: 'fix',
      label: t('writer.ai.options.fix'),
      icon: PiChecks,
    },
    {
      value: 'shorter',
      label: t('writer.ai.options.shorter'),
      icon: PiEqualsThin,
    },
    {
      value: 'longer',
      label: t('writer.ai.options.longer'),
      icon: PiTextAlignJustify,
    },
  ];

  const agentOptions = [
    {
      value: 'search',
      label: t('writer.ai.options.search'),
      icon: PiMagnifyingGlass,
    },
    {
      value: 'collectData',
      label: t('writer.ai.options.collect_data'),
      icon: PiFileMagnifyingGlass,
    },
    {
      value: 'factCheck',
      label: t('writer.ai.options.fact_check'),
      icon: PiCheck,
    },
  ];

  if (!editor) return null;
  return (
    <>
      <CommandSeparator />
      <CommandGroup heading={t('writer.ai.edit_selection')}>
        {options.map((option) => (
          <CommandItem
            onSelect={(value: string) => {
              const slice = editor.state.selection.content();
              const text = editor.storage.markdown.serializer.serialize(
                slice.content
              );
              onSelect(text, value);
            }}
            className="flex gap-2 px-4"
            key={option.value}
            value={option.value}>
            <option.icon className="h-4 w-4 text-purple-500" />
            {option.label}
          </CommandItem>
        ))}
      </CommandGroup>

      {MODELS.searchAgent && (
        <>
          <CommandSeparator />
          <CommandGroup heading={t('writer.ai.use_search_engine')}>
            {agentOptions.map((option) => (
              <CommandItem
                onSelect={(value: string) => {
                  const slice = editor.state.selection.content();
                  const text = editor.storage.markdown.serializer.serialize(
                    slice.content
                  );
                  onSelect(text, value);
                }}
                className="flex gap-2 px-4"
                key={option.value}
                value={option.value}>
                <option.icon className="h-4 w-4 text-purple-500" />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      )}

      <CommandSeparator />
      <CommandGroup heading={t('writer.ai.generate')}>
        <CommandItem
          onSelect={() => {
            const pos = editor.state.selection.from;
            const text = getPrevText(editor, pos);
            onSelect(text, 'continue');
          }}
          value="continue"
          className="gap-2 px-4">
          <PiSkipForward className="h-4 w-4 text-purple-500" />
          {t('writer.ai.options.continue')}
        </CommandItem>
      </CommandGroup>
    </>
  );
};

interface AISelectorCommandsProps {
  onSelect: (value: string, option: string) => void;
}

export default AISelectorCommands;
