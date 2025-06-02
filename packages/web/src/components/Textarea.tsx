import React, { useLayoutEffect, useRef } from 'react';
import RowItem, { RowItemProps } from './RowItem';
import Help from './Help';
import { useTranslation } from 'react-i18next';

type Props = RowItemProps & {
  value?: string;
  label?: string;
  placeholder?: string;
  hint?: string;
  help?: string;
  optional?: boolean;
  noBorder?: boolean;
  rows?: number;
  maxHeight?: number;
  disabled?: boolean;
  required?: boolean;
  onEnter?: () => void;
  onChange: (value: string) => void;
  onPaste?: (pasteEvent: React.ClipboardEvent) => void;
};

const MAX_HEIGHT = 300;

const Textarea: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  const maxHeight = props.maxHeight || MAX_HEIGHT;

  useLayoutEffect(() => {
    if (!ref.current) return;
    // Reset the height to auto to calculate the scroll height
    ref.current.style.height = 'auto';
    ref.current.style.overflowY = 'hidden';

    // Ensure the layout is updated before calculating the scroll height
    // due to the bug in Firefox:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1795904
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1787062
    void ref.current.scrollHeight;

    // Set the height to match content, up to max height
    const scrollHeight = ref.current.scrollHeight;
    const isMax = maxHeight > 0 && scrollHeight > maxHeight;
    ref.current.style.height = (isMax ? maxHeight : scrollHeight) + 'px';
    ref.current.style.overflowY = isMax ? 'auto' : 'hidden';
  }, [props.value, maxHeight]);

  return (
    <RowItem notItem={props.notItem}>
      {props.label && (
        <div className="flex items-center">
          <span className="text-sm">{props.label}</span>
          {props.help && <Help className="ml-1" message={props.help} />}
          {props.optional && (
            /* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */
            <span className="ml-2 text-xs italic text-gray-500">
              - {t('common.optional')}
            </span>
          )}
          {props.required && (
            /* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */
            <span className="ml-2 text-xs font-bold text-gray-800">
              * {t('common.required')}
            </span>
          )}
        </div>
      )}
      <textarea
        ref={ref}
        className={`${
          props.className ?? ''
        } w-full resize-none rounded p-1.5 outline-none ${
          props.noBorder ? 'border-0 focus:ring-0 ' : 'border border-black/30'
        } ${props.disabled ? 'bg-gray-200 ' : ''}`}
        rows={props.rows ?? 1}
        placeholder={props.placeholder || t('common.enter_text')}
        value={props.value}
        onKeyDown={(e) => {
          // keyCode is deprecated, but used for some browsers to handle IME input
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (props.onEnter && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            props.onEnter();
          }
        }}
        onChange={(e) => {
          props.onChange(e.target.value);
        }}
        onPaste={props.onPaste}
        disabled={props.disabled}
      />
      {props.hint && (
        <div className="-mt-0.5 text-xs text-gray-400">{props.hint}</div>
      )}
    </RowItem>
  );
};

export default Textarea;
