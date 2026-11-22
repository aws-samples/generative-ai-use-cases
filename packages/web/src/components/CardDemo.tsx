import React from 'react';
import { BaseProps } from '../@types/common';
import Card from './Card';
import Button from './Button';
import { useTranslation } from 'react-i18next';
import { PiStar, PiStarFill } from 'react-icons/pi';
import useLocalStorageBoolean from '../hooks/useLocalStorageBoolean';

type Props = BaseProps & {
  label: string;
  icon: React.ReactNode;
  description: string;
  onClickDemo: () => void;
  sub?: string;
  /**
   * Sidebar path of this use case. When set, the card shows a star that adds
   * the use case to the sidebar or removes it, the same choice as the stars
   * in the sidebar.
   */
  sidebarPath?: string;
};

const FavoriteButton: React.FC<{ path: string }> = (props) => {
  const { t } = useTranslation();
  // Same key as the sidebar item, so both stay in step.
  const [visibility, setVisibility] = useLocalStorageBoolean(
    `visibility_${props.path}`,
    true
  );

  return (
    <button
      type="button"
      className="flex items-center text-xs text-gray-500 hover:underline"
      aria-pressed={visibility}
      onClick={() => setVisibility(!visibility)}>
      {visibility ? (
        <PiStarFill className="text-aws-smile mr-1 text-base" />
      ) : (
        <PiStar className="mr-1 text-base" />
      )}
      {visibility
        ? t('drawer.remove_from_sidebar')
        : t('drawer.add_to_sidebar')}
    </button>
  );
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
      <div className="flex items-end justify-between">
        {props.sidebarPath ? (
          <FavoriteButton path={props.sidebarPath} />
        ) : (
          <div />
        )}
        <Button onClick={props.onClickDemo}>{t('common.try')}</Button>
      </div>
    </Card>
  );
};

export default CardDemo;
