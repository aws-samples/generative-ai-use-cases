import React, { useEffect, useRef, useState } from 'react';
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
  const [isMax, setIsMax] = useState(false);
  const _maxHeight = props.maxHeight || MAX_HEIGHT;

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    ref.current.style.height = 'auto';

    if (_maxHeight > 0 && ref.current.scrollHeight > _maxHeight) {
      ref.current.style.height = _maxHeight + 'px';
      setIsMax(true);
    } else {
      ref.current.style.height = ref.current.scrollHeight + 'px';
      setIsMax(false);
    }
  }, [props.value, _maxHeight]);

  useEffect(() => {
    const current = ref.current;
    if (!current) {
      return;
    }

    const listener = (e: DocumentEventMap['keypress']) => {
      if (props.onEnter) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          props.onEnter();
        }
      }
    };

    current.addEventListener('keypress', listener);

    return () => {
      if (current) {
        current.removeEventListener('keypress', listener);
      }
    };
  }, [ref, props]);

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
          isMax ? 'overflow-y-auto' : 'overflow-hidden'
        } ${
          props.noBorder ? 'border-0 focus:ring-0 ' : 'border border-black/30'
        } ${props.disabled ? 'bg-gray-200 ' : ''}`}
        rows={props.rows ?? 1}
        placeholder={props.placeholder || t('common.enter_text')}
        value={props.value}
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
