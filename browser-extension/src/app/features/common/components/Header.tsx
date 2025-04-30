import React from 'react';
import { PiGear, PiListPlus, PiX } from 'react-icons/pi';
import ButtonIcon from './ButtonIcon';
import { IconWrapper } from '../../../components/IconWrapper';

type Props = {
  onClickPromptSettings: () => void;
  onClickSettings: () => void;
  onClickClose: () => void;
};

const Header: React.FC<Props> = (props) => {
  return (
    <div className="fixed top-0 w-full z-50">
      <div className="relative h-12 flex items-center justify-between bg-aws-squid-ink p-2 brightness-150">
        <div className="text-lg font-bold ml-3">GenU 拡張機能</div>
        <div className="flex items-center">
          <ButtonIcon onClick={props.onClickPromptSettings}>
            <IconWrapper icon={PiListPlus} />
          </ButtonIcon>
          <ButtonIcon onClick={props.onClickSettings}>
            <IconWrapper icon={PiGear} />
          </ButtonIcon>
          <ButtonIcon onClick={props.onClickClose}>
            <IconWrapper icon={PiX} />
          </ButtonIcon>
        </div>
      </div>
    </div>
  );
};

export default Header;
