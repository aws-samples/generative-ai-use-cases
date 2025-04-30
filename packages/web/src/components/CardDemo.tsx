import React from 'react';
import { BaseProps } from '../@types/common';
import Card from './Card';
import Button from './Button';
import { useTranslation } from 'react-i18next';

type Props = BaseProps & {
  label: string;
  icon: React.ReactNode;
  description: string;
  onClickDemo: () => void;
  sub?: string;
};

const CardDemo: React.FC<Props> = (props) => {
  const { t } = useTranslation();

  return (
    <Card
      label={props.label}
      sub={props.sub}
      className={`${props.className} flex flex-col`}>
      <div className="mb-3 flex h-full flex-col items-center lg:flex-row lg:items-start">
        <div className="mb-4 text-7xl lg:mr-4">{props.icon}</div>
        <div className="text-sm">{props.description}</div>
      </div>
      <div className="flex items-end justify-end">
        <Button onClick={props.onClickDemo}>{t('common.try')}</Button>
      </div>
    </Card>
  );
};

export default CardDemo;
