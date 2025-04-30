import React, { useCallback, useState } from 'react';
import { BaseProps } from '../../../@types/common';
import { produce } from 'immer';
import DraggablePromptItem, { DragPromptItem } from './DraggablePromptItem';
import { SystemContext } from '../../../@types/chat';
import { presetPrompts as PRESET_PROMPTS } from './presetPrompts';
import { useDrop } from 'react-dnd';
import usePrompt from './usePrompt';
import { PiCaretLeft, PiDesktopTower } from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';
import Button from '../common/components/Button';
import useSystemContext from './useSystemContext';
import { PromptSetting } from '../../../@types/settings';
import { IconWrapper } from '../../components/IconWrapper';

export const ItemTypes = {
  PROMPT_ITEM: 'promptItem',
  PRESET_ITEM: 'presetItem',
  SYSTEM_CONTEXT_ITEM: 'systemContextItem',
} as const;

export type ItemTypeValues = (typeof ItemTypes)[keyof typeof ItemTypes];

type Props = BaseProps & {
  onBack: () => void;
};

const PromptSettings: React.FC<Props> = (props) => {
  const [presetPrompts] = useState<SystemContext[]>([...PRESET_PROMPTS]);
  const { prompts, savePrompts } = usePrompt();
  const { systemContexts } = useSystemContext();

  const movePrompt = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      savePrompts((prev) =>
        produce(prev, (draft) => {
          draft.splice(dragIndex, 1);
          draft.splice(hoverIndex, 0, prev[dragIndex]);
        }),
      );
    },
    [savePrompts],
  );

  const renderAvailablePromptItem = useCallback((prompt: PromptSetting, index: number) => {
    return (
      <DraggablePromptItem
        className="mx-1 first:mt-1 last:mb-1"
        type={ItemTypes.PROMPT_ITEM}
        key={prompt.systemContextId}
        index={index}
        prompt={prompt}
        isPromptSetting
        isPreset={
          PRESET_PROMPTS.findIndex(
            (prompt_) => prompt_.systemContextId === prompt.systemContextId,
          ) > -1
        }
        movePrompt={movePrompt}
        onDelete={() => {
          savePrompts((prev) =>
            produce(prev, (draft) => {
              draft.splice(index, 1);
            }),
          );
        }}
        onChange={(prompt_) => {
          savePrompts((prev) =>
            produce(prev, (draft) => {
              draft[index] = prompt_;
            }),
          );
        }}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderPromptItem = useCallback(
    (prompt: SystemContext, index: number, type: ItemTypeValues) => {
      return (
        <DraggablePromptItem
          className="mx-1 first:mt-1 last:mb-1"
          type={type}
          key={prompt.systemContextId}
          index={index}
          prompt={prompt}
          isPreset={type === 'presetItem'}
          canDrag={
            prompts.findIndex((prompt_) => prompt_.systemContextId === prompt.systemContextId) < 0
          }
        />
      );
    },
    [prompts],
  );

  const [, drop] = useDrop({
    accept: [ItemTypes.PRESET_ITEM, ItemTypes.SYSTEM_CONTEXT_ITEM],
    drop: (item: DragPromptItem) => {
      if (
        prompts.findIndex((prompt_) => prompt_.systemContextId === item.prompt.systemContextId) > -1
      ) {
        return;
      }
      savePrompts((prev) =>
        produce(prev, (draft) => {
          draft.splice(item.index, 0, item.prompt);
        }),
      );
    },
  });

  const [isSelectedPreset, setisSelectedPreset] = useState(false);

  return (
    <div className="p-2 h-dvh flex flex-col gap-2">
      <div>
        <div className="text-base font-semibold mb-1">プロンプト設定</div>
        <div className="font-light text-aws-font-color-gray mb-1 text-xs">
          この拡張機能で利用したいプロンプトを設定してください。ドラッグ &
          ドロップで設定できます。「利用するプロンプト」は、プロンプトごとに詳細な設定を行うことも可能です。
        </div>
      </div>

      <div className="h-1/2 flex flex-col">
        <div className="text-sm font-semibold mb-1">利用するプロンプト</div>
        <div ref={drop} className="h-full overflow-y-auto bg-white/10 border rounded">
          {prompts.map((prompt, i) => renderAvailablePromptItem(prompt, i))}
        </div>
      </div>

      <div className="h-1/2 flex flex-col">
        <div className="flex text-sm font-semibold">
          <div
            className={twMerge(
              'border border-b-0 p-2 rounded-tl cursor-pointer hover:bg-white/50',
              !isSelectedPreset ? 'bg-white/30' : '',
            )}
            onClick={() => {
              setisSelectedPreset(false);
            }}
          >
            登録済みのシステムプロンプト
          </div>
          <div
            className={twMerge(
              'border border-b-0 p-2 rounded-tr border-l-0 flex items-center gap-1 cursor-pointer hover:bg-white/50',
              isSelectedPreset ? 'bg-white/30' : '',
            )}
            onClick={() => {
              setisSelectedPreset(true);
            }}
          >
            <IconWrapper icon={PiDesktopTower} /> プリセット
          </div>
        </div>
        <div className="h-full overflow-y-auto bg-white/10 border rounded-b rounded-tr">
          {isSelectedPreset
            ? presetPrompts.map((prompt, i) => renderPromptItem(prompt, i, 'presetItem'))
            : systemContexts.map((prompt, i) => renderPromptItem(prompt, i, 'systemContextItem'))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button outlined icon={<IconWrapper icon={PiCaretLeft} />} onClick={props.onBack}>
          戻る
        </Button>
      </div>
    </div>
  );
};

export default PromptSettings;
