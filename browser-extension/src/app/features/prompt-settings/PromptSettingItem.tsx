import React from 'react';
import { twMerge } from 'tailwind-merge';
import { BaseProps } from '../../../@types/common';
import { PromptSetting } from '../../../@types/settings';
import InputText from '../common/components/InputText';
import ButtonIcon from '../common/components/ButtonIcon';
import { PiTrash } from 'react-icons/pi';
import Button from '../common/components/Button';
import { IconWrapper } from '../../components/IconWrapper';

import Checkbox from '../common/components/Checkbox';
import { produce } from 'immer';

type Props = BaseProps & {
  prompt: PromptSetting;
  disabled?: boolean;
  onChange?: (propmt: PromptSetting) => void;
};

const PromptSettingItem: React.FC<Props> = (props) => {
  return (
    <div className={twMerge('flex flex-col gap-1', props.className)}>
      <div>
        <div className="text-xs ">プロンプト</div>
        <textarea
          className={twMerge(
            'text-xs text-aws-font-color-gray border p-1 rounded bg-aws-squid-ink w-full resize-none',
          )}
          rows={13}
          value={props.prompt.systemContext}
        />
      </div>
      <div>
        <Checkbox
          label="フォーム形式で入力する"
          value={props.prompt.useForm ?? false}
          disabled={props.disabled}
          onChange={(checked) => {
            props.onChange
              ? props.onChange({
                  ...props.prompt,
                  useForm: checked,
                  formDefinitions: props.prompt.formDefinitions ?? [
                    {
                      label: '',
                      tag: '',
                      autoCopy: true,
                    },
                  ],
                })
              : null;
          }}
        />

        {props.prompt.useForm && (
          <div className="flex flex-col gap-1">
            {props.prompt.formDefinitions?.map((def, idx) => (
              <div className="flex gap-1 items-center" key={idx}>
                <InputText
                  label="ラベル"
                  value={def.label}
                  disabled={props.disabled}
                  onChange={(val) => {
                    props.onChange
                      ? props.onChange({
                          ...props.prompt,
                          formDefinitions: produce(props.prompt.formDefinitions, (draft) => {
                            if (draft) {
                              draft[idx].label = val;
                            }
                          }),
                        })
                      : null;
                  }}
                />
                <InputText
                  label="プロンプトタグ"
                  value={def.tag}
                  disabled={props.disabled}
                  onChange={(val) => {
                    props.onChange
                      ? props.onChange({
                          ...props.prompt,
                          formDefinitions: produce(props.prompt.formDefinitions, (draft) => {
                            if (draft) {
                              draft[idx].tag = val;
                            }
                          }),
                        })
                      : null;
                  }}
                />
                <Checkbox
                  label="選択部分を自動コピー"
                  value={def.autoCopy}
                  disabled={props.disabled}
                  onChange={(val) => {
                    props.onChange
                      ? props.onChange({
                          ...props.prompt,
                          formDefinitions: produce(props.prompt.formDefinitions, (draft) => {
                            if (draft) {
                              draft[idx].autoCopy = val;
                            }
                          }),
                        })
                      : null;
                  }}
                />
                {props.onChange && (
                  <ButtonIcon
                    className="text-base mt-3"
                    onClick={() => {
                      props.onChange
                        ? props.onChange({
                            ...props.prompt,
                            formDefinitions: produce(props.prompt.formDefinitions, (draft) => {
                              if (draft) {
                                draft.splice(idx, 1);
                                if (draft.length === 0) {
                                  draft.push({
                                    autoCopy: true,
                                    label: '',
                                    tag: '',
                                  });
                                }
                              }
                            }),
                          })
                        : null;
                    }}
                  >
                    <IconWrapper icon={PiTrash} />
                  </ButtonIcon>
                )}
              </div>
            ))}

            {!props.disabled && (
              <div>
                <Button
                  className="ml-auto"
                  outlined
                  onClick={() => {
                    props.onChange
                      ? props.onChange({
                          ...props.prompt,
                          formDefinitions: produce(props.prompt.formDefinitions, (draft) => {
                            if (draft) {
                              draft.push({
                                autoCopy: false,
                                label: '',
                                tag: '',
                              });
                            }
                          }),
                        })
                      : null;
                  }}
                >
                  追加
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <Checkbox
          label="一問一答形式にする（会話履歴を無視する）"
          value={props.prompt.ignoreHistory ?? false}
          disabled={props.disabled}
          onChange={(checked) => {
            props.onChange
              ? props.onChange({
                  ...props.prompt,
                  ignoreHistory: checked,
                })
              : null;
          }}
        />
      </div>
      <div>
        <Checkbox
          label="拡張機能を開いた際にすぐに送信する"
          value={props.prompt.directSend ?? false}
          disabled={props.disabled}
          onChange={(checked) => {
            props.onChange
              ? props.onChange({
                  ...props.prompt,
                  directSend: checked,
                })
              : null;
          }}
        />
      </div>
      <div>
        <Checkbox
          label="初期化した状態で拡張機能を開く"
          value={props.prompt.initializeMessages ?? false}
          disabled={props.disabled}
          onChange={(checked) => {
            props.onChange
              ? props.onChange({
                  ...props.prompt,
                  initializeMessages: checked,
                })
              : null;
          }}
        />
      </div>
    </div>
  );
};

export default PromptSettingItem;
