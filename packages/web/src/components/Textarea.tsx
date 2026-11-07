import React, { useLayoutEffect, useRef } from 'react';
import RowItem, { RowItemProps } from './RowItem';
import Help from './Help';
import { useTranslation } from 'react-i18next';
import useUserSetting from '../hooks/useUserSetting';

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
  resizable?: boolean;
  onEnter?: () => void;
  onChange: (value: string) => void;
  onPaste?: (pasteEvent: React.ClipboardEvent) => void;
};

const MAX_HEIGHT = 300;

const Textarea: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { settingSubmitCmdOrCtrlEnter } = useUserSetting();
  const ref = useRef<HTMLTextAreaElement>(null);
  const maxHeight = props.maxHeight || MAX_HEIGHT;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || props.resizable) return;

    let running = false;

    const applyHeight = () => {
      // Guard against the ResizeObserver observing the height we set ourselves
      if (running) return;
      running = true;

      // Reset the height to auto to calculate the scroll height
      element.style.height = 'auto';
      element.style.overflowY = 'hidden';

      // Ensure the layout is updated before calculating the scroll height
      // due to the bug in Firefox:
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1795904
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1787062
      void element.scrollHeight;

      // scrollHeight covers the content and the padding but not the border, while the
      // height assigned below is interpreted as the full border box
      const style = window.getComputedStyle(element);
      const borderHeight =
        style.boxSizing === 'border-box'
          ? parseFloat(style.borderTopWidth) +
            parseFloat(style.borderBottomWidth)
          : 0;

      // Set the height to match content, up to max height
      const contentHeight = element.scrollHeight + borderHeight;
      const isMax = maxHeight > 0 && contentHeight > maxHeight;
      element.style.height = (isMax ? maxHeight : contentHeight) + 'px';
      element.style.overflowY = isMax ? 'auto' : 'hidden';

      running = false;
    };

    applyHeight();

    // The first measurement can run before the element has been laid out, for example
    // while the dialog that contains it is still being mounted. scrollHeight is 0 then,
    // and because this effect only depends on the value, a textarea whose value never
    // changes afterwards would keep that height forever. Re-measure whenever the box
    // actually changes so the height catches up.
    const observer = new ResizeObserver(applyHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.value, props.resizable, maxHeight]);

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
        } w-full ${props.resizable ? 'resize-y' : 'resize-none'} rounded p-1.5 outline-none ${
          props.noBorder ? 'border-0 focus:ring-0 ' : 'border border-black/30'
        } ${props.disabled ? 'bg-gray-200 ' : ''}`}
        rows={props.rows ?? (props.resizable ? 5 : 1)}
        placeholder={props.placeholder || t('common.enter_text')}
        value={props.value}
        onKeyDown={(e) => {
          // keyCode is deprecated, but used for some browsers to handle IME input
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;

          if (props.onEnter) {
            if (settingSubmitCmdOrCtrlEnter) {
              // When line break mode is enabled, enter key creates new line and cmd/ctrl+enter sends message
              if (navigator.platform.toLowerCase().includes('mac')) {
                if (e.key === 'Enter' && e.metaKey) {
                  e.preventDefault();
                  props.onEnter();
                }
              } else {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault();
                  props.onEnter();
                }
              }
            } else {
              // Default behavior: send with enter (not cmd/ctrl+enter)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                props.onEnter();
              }
            }
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
