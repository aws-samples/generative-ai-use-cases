import type { Identifier, XYCoord } from 'dnd-core';
import React, { useMemo, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { twMerge } from 'tailwind-merge';
import { ItemTypeValues, ItemTypes } from './PromptSettings';
import { SystemContext } from '../../../@types/chat';
import { BaseProps } from '../../../@types/common';
import { PiCaretDown, PiDesktopTower, PiDotsSix, PiX } from 'react-icons/pi';
import ButtonIcon from '../common/components/ButtonIcon';
import { PromptSetting } from '../../../@types/settings';
import PromptSettingItem from './PromptSettingItem';
import { IconWrapper } from '../../components/IconWrapper';

type Props = BaseProps & {
  type: ItemTypeValues;
  index: number;
  canDrag?: boolean;
  isPreset?: boolean;
  movePrompt?: (dragIndex: number, hoverIndex: number) => void;
  onDelete?: () => void;
} & (
    | {
        isPromptSetting: true;
        prompt: PromptSetting;
        onChange: (prompt: PromptSetting) => void;
      }
    | {
        isPromptSetting?: false;
        prompt: SystemContext;
      }
  );

export type DragPromptItem = {
  index: number;
  prompt: SystemContext | PromptSetting;
};

const DraggablePromptItem: React.FC<Props> = (props) => {
  // Implement based on the React DnD example
  // https://react-dnd.github.io/react-dnd/examples/sortable/simple
  const ref = useRef<HTMLDivElement>(null);
  const [{ handlerId }, drop] = useDrop<DragPromptItem, void, { handlerId: Identifier | null }>({
    accept: ItemTypes.PROMPT_ITEM,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragPromptItem, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = props.index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Time to actually perform the action
      props.movePrompt ? props.movePrompt(dragIndex, hoverIndex) : null;

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: props.type,
    item: () => {
      return {
        index: props.index,
        prompt: props.prompt,
      } as DragPromptItem;
    },
    canDrag: () => (props.canDrag ? props.canDrag : true),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  const isPromptSetting = useMemo(() => {
    return !!props.isPromptSetting;
  }, [props.isPromptSetting]);

  const [isOpenSettings, setIsOpenSettings] = useState(false);

  return (
    <div
      ref={!isPromptSetting ? ref : undefined}
      className={twMerge(
        props.className,
        'flex flex-col border border-b-0 last:border-b first:rounded-t p-1 last:rounded-b bg-aws-squid-ink',
        props.canDrag === false ? 'bg-white/30 cursor-no-drop' : '',
        isDragging ? 'opacity-30' : '',
        isPromptSetting ? '' : 'cursor-grab',
      )}
      data-handler-id={handlerId}
    >
      <div className="flex items-center gap-2">
        {isPromptSetting && (
          <div ref={ref} className="pl-2 cursor-grab">
            <IconWrapper icon={PiDotsSix} />
          </div>
        )}
        <div
          className={twMerge(
            'flex items-center gap-2 p-1 w-full ',
            isPromptSetting ? 'hover:bg-white/20 rounded cursor-pointer' : '',
          )}
          onClick={() => {
            if (isPromptSetting) {
              setIsOpenSettings(!isOpenSettings);
            }
          }}
        >
          {isPromptSetting && (
            <IconWrapper
              icon={PiCaretDown}
              className={twMerge('transition', isOpenSettings ? '' : 'rotate-180')}
            />
          )}
          {props.prompt.systemContextTitle}
          {props.isPreset && <IconWrapper icon={PiDesktopTower} />}
        </div>

        {props.onDelete && (
          <ButtonIcon className="block ml-auto" onClick={props.onDelete}>
            <IconWrapper icon={PiX} />
          </ButtonIcon>
        )}
      </div>

      <div
        className={twMerge(
          'transition-all',
          isOpenSettings ? 'max-h-[350px] overflow-y-auto' : 'max-h-0 overflow-hidden ',
        )}
      >
        {props.isPromptSetting ? (
          <PromptSettingItem className="my-1" prompt={props.prompt} onChange={props.onChange} />
        ) : null}
      </div>
    </div>
  );
};

export default DraggablePromptItem;
