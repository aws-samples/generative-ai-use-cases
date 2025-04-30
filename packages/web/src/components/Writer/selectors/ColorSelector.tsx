import { PiCheck, PiCaretDown } from 'react-icons/pi';
import { EditorBubbleItem, useEditor } from 'novel';
import { useTranslation } from 'react-i18next';

import { Button } from '../ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
export interface BubbleColorMenuItem {
  name: string;
  color: string;
}

export const ColorSelector = ({ open, onOpenChange }: ColorSelectorProps) => {
  const { t } = useTranslation();
  const { editor } = useEditor();

  const TEXT_COLORS: BubbleColorMenuItem[] = [
    {
      name: t('writer.colors.default'),
      color: 'var(--novel-black)',
    },
    {
      name: t('writer.colors.purple'),
      color: '#9333EA',
    },
    {
      name: t('writer.colors.red'),
      color: '#E00000',
    },
    {
      name: t('writer.colors.yellow'),
      color: '#EAB308',
    },
    {
      name: t('writer.colors.blue'),
      color: '#2563EB',
    },
    {
      name: t('writer.colors.green'),
      color: '#008A00',
    },
    {
      name: t('writer.colors.orange'),
      color: '#FFA500',
    },
    {
      name: t('writer.colors.pink'),
      color: '#BA4081',
    },
    {
      name: t('writer.colors.gray'),
      color: '#A8A29E',
    },
  ];

  const HIGHLIGHT_COLORS: BubbleColorMenuItem[] = [
    {
      name: t('writer.colors.default'),
      color: 'var(--novel-highlight-default)',
    },
    {
      name: t('writer.colors.purple'),
      color: 'var(--novel-highlight-purple)',
    },
    {
      name: t('writer.colors.red'),
      color: 'var(--novel-highlight-red)',
    },
    {
      name: t('writer.colors.yellow'),
      color: 'var(--novel-highlight-yellow)',
    },
    {
      name: t('writer.colors.blue'),
      color: 'var(--novel-highlight-blue)',
    },
    {
      name: t('writer.colors.green'),
      color: 'var(--novel-highlight-green)',
    },
    {
      name: t('writer.colors.orange'),
      color: 'var(--novel-highlight-orange)',
    },
    {
      name: t('writer.colors.pink'),
      color: 'var(--novel-highlight-pink)',
    },
    {
      name: t('writer.colors.gray'),
      color: 'var(--novel-highlight-gray)',
    },
  ];

  if (!editor) return null;
  const activeColorItem = TEXT_COLORS.find(({ color }) =>
    editor.isActive('textStyle', { color })
  );

  const activeHighlightItem = HIGHLIGHT_COLORS.find(({ color }) =>
    editor.isActive('highlight', { color })
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" className="gap-2 rounded-none" variant="ghost">
          {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
          <span
            className="rounded-sm px-1"
            style={{
              color: activeColorItem?.color,
              backgroundColor: activeHighlightItem?.color,
            }}>
            A
          </span>
          <PiCaretDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        sideOffset={5}
        className="my-1 flex max-h-80 w-48 flex-col overflow-hidden overflow-y-auto rounded border p-1 shadow-xl "
        align="start">
        <div className="flex flex-col">
          <div className="text-muted-foreground my-1 px-2 text-sm font-semibold">
            {t('writer.color')}
          </div>
          {TEXT_COLORS.map(({ name, color }) => (
            <EditorBubbleItem
              key={name}
              onSelect={() => {
                editor.commands.unsetColor();
                name !== t('writer.colors.default') &&
                  editor
                    .chain()
                    .focus()
                    .setColor(color || '')
                    .run();
                onOpenChange(false);
              }}
              className="hover:bg-accent flex cursor-pointer items-center justify-between px-2 py-1 text-sm">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
                <div
                  className="rounded-sm border px-2 py-px font-medium"
                  style={{ color }}>
                  A
                </div>
                <span>{name}</span>
              </div>
            </EditorBubbleItem>
          ))}
        </div>
        <div>
          <div className="text-muted-foreground my-1 px-2 text-sm font-semibold">
            {t('writer.background')}
          </div>
          {HIGHLIGHT_COLORS.map(({ name, color }) => (
            <EditorBubbleItem
              key={name}
              onSelect={() => {
                editor.commands.unsetHighlight();
                name !== t('writer.colors.default') &&
                  editor.chain().focus().setHighlight({ color }).run();
                onOpenChange(false);
              }}
              className="hover:bg-accent flex cursor-pointer items-center justify-between px-2 py-1 text-sm">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
                <div
                  className="rounded-sm border px-2 py-px font-medium"
                  style={{ backgroundColor: color }}>
                  A
                </div>
                <span>{name}</span>
              </div>
              {editor.isActive('highlight', { color }) && (
                <PiCheck className="h-4 w-4" />
              )}
            </EditorBubbleItem>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ColorSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
