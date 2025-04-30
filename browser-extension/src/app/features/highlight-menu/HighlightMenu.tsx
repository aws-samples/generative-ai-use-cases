import React, { useEffect, useState } from 'react';
import {
  useFloating,
  useDismiss,
  useInteractions,
  flip,
  shift,
  autoUpdate,
  autoPlacement,
} from '@floating-ui/react';
import AwsLogo from '../../../assets/aws.svg?react';
import PromptList from './PromptList';
import { BaseProps } from '../../../@types/common';
import { PromptSetting } from '../../../@types/settings';

type Props = BaseProps & {
  onOpenChat: (content: string, systemContext: PromptSetting) => void;
};

const HighlightMenu: React.FC<Props> = (props) => {
  const [isOpen, setIsOpen] = useState(false);

  // Implement based on the Floating UI example
  // https://floating-ui.com/docs/react-examples
  const { refs, floatingStyles, context } = useFloating({
    placement: 'bottom',
    transform: true,
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      flip(),
      shift(),
      autoPlacement({
        allowedPlacements: ['top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end'],
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);

  const { getFloatingProps } = useInteractions([dismiss]);

  useEffect(() => {
    const handleMouseUp = (event: MouseEvent) => {
      if (refs.floating.current?.contains(event.target as Element | null)) {
        return;
      }

      setTimeout(() => {
        const selection = window.getSelection();
        const range =
          typeof selection?.rangeCount === 'number' && selection.rangeCount > 0
            ? selection.getRangeAt(0)
            : null;

        if (selection?.isCollapsed) {
          setIsOpen(false);
          return;
        }

        if (range) {
          refs.setReference({
            getBoundingClientRect: () => range.getBoundingClientRect(),
            getClientRects: () => range.getClientRects(),
          });
          setIsOpen(true);
        }
      });
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (refs.floating.current?.contains(event.target as Element | null)) {
        return;
      }

      if (window.getSelection()?.isCollapsed) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [refs]);

  const [isOpenContextList, setIsOpenContextList] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsOpenContextList(false);
    }
  }, [isOpen]);

  const [content, setContent] = useState('');

  return (
    <div>
      {isOpen && (
        <div
          ref={refs.setFloating}
          style={{
            ...floatingStyles,
            zIndex: 9999999999999,
          }}
          {...getFloatingProps()}
        >
          <div>
            {isOpenContextList ? (
              <PromptList
                onClick={(systemContext) => {
                  props.onOpenChat(content, systemContext);
                }}
              />
            ) : (
              <button
                className="rounded-full p-2 py-3 bg-aws-squid-ink text-white"
                onClick={() => {
                  setContent(window.getSelection()?.toString() ?? '');
                  setIsOpenContextList(true);
                }}
              >
                {/* The font setting of the integration target affects the pixel, so specify the pixel */}
                <div className="flex items-center">
                  <div className="rounded">
                    <AwsLogo className="h-[13px]" />
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HighlightMenu;
