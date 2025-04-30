import React, { useCallback, useEffect, useState } from 'react';
import ButtonIcon from './ButtonIcon';
import { BaseProps } from '../@types/common';
import { PiCheck, PiClipboard } from 'react-icons/pi';
import copy from 'copy-to-clipboard';
import useInterUseCases from '../hooks/useInterUseCases';

type Props = BaseProps & {
  text: string;
  html?: string;
  interUseCasesKey?: string;
  disabled?: boolean;
};

const ButtonCopy: React.FC<Props> = (props) => {
  const [showsCheck, setshowsCheck] = useState(false);
  const { setCopyTemporary } = useInterUseCases();

  useEffect(() => {
    if (props.interUseCasesKey) {
      setCopyTemporary(props.interUseCasesKey, props.text);
    }
  }, [props.interUseCasesKey, props.text, setCopyTemporary]);

  const copyMessage = useCallback((message: string, html?: string) => {
    // Copy both text and html
    copy(message, {
      format: 'text/plain',
      onCopy: (clipboardData) => {
        if (html) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (clipboardData as any).setData('text/html', html);
        }
      },
    });
    setshowsCheck(true);

    setTimeout(() => {
      setshowsCheck(false);
    }, 3000);
  }, []);

  return (
    <ButtonIcon
      className={`${props.className ?? ''}`}
      disabled={props.disabled}
      onClick={() => {
        copyMessage(props.text, props.html);
      }}>
      {showsCheck ? <PiCheck /> : <PiClipboard />}
    </ButtonIcon>
  );
};

export default ButtonCopy;
