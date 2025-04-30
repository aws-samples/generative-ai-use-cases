import React from 'react';
import { BaseProps } from '../../@types/common';
import { PiLinkBold, PiLockKey } from 'react-icons/pi';
import Button from '../Button';
import { useTranslation } from 'react-i18next';

type Props = BaseProps & {
  isShared: boolean;
  disabled?: boolean;
  onClick: () => void;
};

const ButtonShare: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  return (
    <Button
      outlined
      className={`${props.className ?? ''} text-xs ${props.isShared ? 'font-bold' : ''}`}
      disabled={props.disabled}
      onClick={() => {
        props.onClick();
      }}>
      {props.isShared ? (
        <>
          <PiLinkBold className="mr-2" />
          {t('useCaseBuilder.shared')}
        </>
      ) : (
        <>
          <PiLockKey className="mr-2" />
          {t('useCaseBuilder.private')}
        </>
      )}
    </Button>
  );
};

export default ButtonShare;
