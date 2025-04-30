import { CommandGroup, CommandItem, CommandSeparator } from '../ui/Command';
import { useEditor } from 'novel';
import { PiCheck, PiQuotes, PiTrash } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

const AICompletionCommands = ({
  completion,
  onDiscard,
}: {
  completion: string;
  onDiscard: () => void;
}) => {
  const { t } = useTranslation();
  const { editor } = useEditor();
  if (!editor) return null;
  return (
    <>
      <CommandSeparator />
      <CommandGroup>
        <CommandItem
          className="gap-2 px-4"
          value="replace"
          onSelect={() => {
            const selection = editor.view.state.selection;

            editor
              .chain()
              .focus()
              .insertContentAt(
                {
                  from: selection.from,
                  to: selection.to,
                },
                completion
              )
              .run();
          }}>
          <PiCheck className="text-muted-foreground h-4 w-4" />
          {t('writer.ai.replace_selection')}
        </CommandItem>
        <CommandItem
          className="gap-2 px-4"
          value="insert"
          onSelect={() => {
            const selection = editor.view.state.selection;
            editor
              .chain()
              .focus()
              .insertContentAt(selection.to + 1, completion)
              .run();
          }}>
          <PiQuotes className="text-muted-foreground h-4 w-4" />
          {t('writer.ai.insert_below')}
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />

      <CommandGroup>
        <CommandItem onSelect={onDiscard} value="thrash" className="gap-2 px-4">
          <PiTrash className="text-muted-foreground h-4 w-4" />
          {t('writer.ai.discard')}
        </CommandItem>
      </CommandGroup>
    </>
  );
};

export default AICompletionCommands;
