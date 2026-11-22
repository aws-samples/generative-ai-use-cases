import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PiHammer, PiSquaresFour } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import useSidebar from '../hooks/useSidebar';

type Props = {
  builderMode: boolean;
};

const BUILDER_PATH = '/use-case-builder';
const HOME_PATH = '/';

/**
 * Segmented control at the top of the sidebar that switches between the
 * regular use cases and Use Case Builder. In the collapsed rail it becomes a
 * pair of icon buttons.
 */
const DrawerModeTabs: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { collapsed } = useSidebar();

  const tabs = [
    {
      builder: false,
      label: t('drawer.use_cases'),
      path: HOME_PATH,
      icon: <PiSquaresFour />,
    },
    {
      builder: true,
      label: t('drawer.mode_builder'),
      path: BUILDER_PATH,
      icon: <PiHammer />,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={t('drawer.builder_mode')}
      className={
        collapsed
          ? 'flex flex-col items-center gap-y-1'
          : 'flex min-w-0 grow rounded-lg bg-white/10 p-0.5 text-xs'
      }>
      {tabs.map((tab) => {
        const selected = tab.builder === props.builderMode;
        return (
          <button
            key={tab.path}
            role="tab"
            type="button"
            aria-selected={selected}
            title={collapsed ? tab.label : undefined}
            aria-label={collapsed ? tab.label : undefined}
            className={`focus-visible:ring-aws-sky flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-1 ${
              collapsed ? 'size-8 text-lg' : 'min-w-0 flex-1 px-1 py-1'
            } ${
              selected
                ? 'bg-white/20 font-medium text-white'
                : 'text-white/60 hover:text-white'
            }`}
            onClick={() => {
              if (!selected) navigate(tab.path);
            }}>
            {collapsed ? (
              <span>{tab.icon}</span>
            ) : (
              <span className="truncate">{tab.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default DrawerModeTabs;
