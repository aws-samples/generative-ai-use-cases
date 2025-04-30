import { EditorBubble, removeAIHighlight, useEditor } from 'novel';
import { Fragment, type ReactNode, useEffect } from 'react';
import { Button } from '../ui/Button';
import { AISelector } from './AISelector';
import { PiMagicWand } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

interface GenerativeMenuSwitchProps {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const GenerativeMenuSwitch = ({
  children,
  open,
  onOpenChange,
}: GenerativeMenuSwitchProps) => {
  const { t } = useTranslation();
  const { editor } = useEditor();
  useEffect(() => {
    if (!open && editor) removeAIHighlight(editor);
  }, [open, editor]);

  if (!editor) return null;

  return (
    <EditorBubble
      tippyOptions={{
        placement: open ? 'bottom-start' : 'top',
        onHidden: () => {
          onOpenChange(false);
          editor.chain().unsetHighlight().run();
        },
      }}
      className="border-muted bg-background flex w-fit max-w-[90vw] overflow-hidden rounded-md border shadow-xl">
      {open && <AISelector open={open} onOpenChange={onOpenChange} />}
      {!open && (
        <Fragment>
          <Button
            className="gap-1 rounded-none text-purple-500"
            variant="ghost"
            onClick={() => onOpenChange(true)}
            size="sm">
            <PiMagicWand className="h-5 w-5" />
            {t('writer.ai.ask_ai')}
          </Button>
          {children}
        </Fragment>
      )}
    </EditorBubble>
  );
};

export default GenerativeMenuSwitch;
