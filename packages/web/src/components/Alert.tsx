import React, { useMemo } from 'react';
import { BaseProps } from '../@types/common';
import { PiInfo, PiXCircle, PiX, PiWarning } from 'react-icons/pi';
import ButtonIcon from './ButtonIcon';

// MEMO: Only Error is implemented currently
type Props = BaseProps & {
  title?: string;
  severity: 'info' | 'error' | 'warning';
  children: React.ReactNode;
  onDissmiss?: () => void;
};

const Alert: React.FC<Props> = (props) => {
  const colors = useMemo(() => {
    if (props.severity === 'error') {
      return {
        border: 'border-red-500',
        bg: 'bg-red-50',
        icon: 'text-red-500',
      };
    } else if (props.severity === 'warning') {
      return {
        border: 'border-yellow-500',
        bg: 'bg-yellow-50',
        icon: 'text-yellow-500',
      };
    }
    return {
      border: 'border-sky-500',
      bg: 'bg-sky-50',
      icon: 'text-sky-500',
    };
  }, [props.severity]);

  return (
    <div
      className={`${props.className ?? ''} flex border ${colors.border} ${
        colors.bg
      }`}>
      <div>
        {props.severity === 'error' && (
          <PiXCircle className={`m-3 text-4xl ${colors.icon}`} />
        )}
        {props.severity === 'info' && (
          <PiInfo className={`m-3 text-4xl ${colors.icon}`} />
        )}
        {props.severity === 'warning' && (
          <PiWarning className={`m-3 text-4xl ${colors.icon}`} />
        )}
      </div>
      <div className="my-3 mr-3 w-full text-sm">
        <div className="flex w-full items-center justify-between">
          <div className="font-semibold">{props.title}</div>
          {props.onDissmiss && (
            <ButtonIcon onClick={props.onDissmiss}>
              <PiX className="text-sm text-black" />
            </ButtonIcon>
          )}
        </div>
        <div>{props.children}</div>
      </div>
    </div>
  );
};

export default Alert;
