import React, { useMemo } from 'react';
import { BaseProps } from '../@types/common';
import ButtonIcon from './ButtonIcon';
import {
  PiThumbsUp,
  PiThumbsDown,
  PiThumbsUpFill,
  PiThumbsDownFill,
} from 'react-icons/pi';
import { ShownMessage } from 'generative-ai-use-cases';

type Props = BaseProps & {
  message: ShownMessage;
  feedback: string;
  onClick: () => void;
  disabled: boolean;
};

const ButtonFeedback: React.FC<Props> = (props) => {
  const color = useMemo(() => {
    if (props.disabled) {
      return 'text-gray-500';
    }

    if (props.feedback === 'good') {
      return 'text-green-500';
    } else {
      return 'text-red-500';
    }
  }, [props]);

  const icon = useMemo(() => {
    if (props.feedback === 'good') {
      if (props.message.feedback === 'good') {
        return <PiThumbsUpFill />;
      } else {
        return <PiThumbsUp />;
      }
    } else {
      if (props.message.feedback === 'bad') {
        return <PiThumbsDownFill />;
      } else {
        return <PiThumbsDown />;
      }
    }
  }, [props]);

  return (
    <ButtonIcon
      className={`${props.className} ${color}`}
      disabled={props.disabled}
      onClick={props.onClick}>
      {icon}
    </ButtonIcon>
  );
};

export default ButtonFeedback;
