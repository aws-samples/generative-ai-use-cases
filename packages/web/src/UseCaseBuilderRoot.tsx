import React, { useMemo } from 'react';
import {
  PiList,
  PiX,
  PiSwatches,
  PiListDashes,
  PiNotePencil,
} from 'react-icons/pi';
import { Outlet, useLocation } from 'react-router-dom';
import { ItemProps } from './components/Drawer';
import ButtonIcon from './components/ButtonIcon';
import '@aws-amplify/ui-react/styles.css';
import useDrawer from './hooks/useDrawer';
import PopupInterUseCasesDemo from './components/PopupInterUseCasesDemo';
import useInterUseCases from './hooks/useInterUseCases';
import UseCaseBuilderDrawer from './components/useCaseBuilder/UseCaseBuilderDrawer';
import usePageTitle from './hooks/usePageTitle';
import { useTranslation } from 'react-i18next';

const UseCaseBuilderRoot: React.FC = () => {
  const { t } = useTranslation();
  const { switchOpen: switchDrawer, opened: isOpenDrawer } = useDrawer();
  const { isShow } = useInterUseCases();
  const { pathname } = useLocation();
  const { pageTitle } = usePageTitle();

  const items = useMemo<ItemProps[]>(
    () =>
      [
        {
          label: t('useCaseBuilder.samples'),
          to: '/use-case-builder',
          icon: <PiSwatches />,
          display: 'usecase' as const,
        },
        {
          label: t('useCaseBuilder.myUseCases'),
          to: `/use-case-builder/my-use-case`,
          icon: <PiListDashes />,
          display: 'usecase' as const,
        },
        {
          label: t('useCaseBuilder.createNew'),
          to: `/use-case-builder/new`,
          icon: <PiNotePencil />,
          display: 'usecase' as const,
        },
      ].flatMap((i) => (i !== null ? [i] : [])),
    [t]
  );

  const label = useMemo(() => {
    const label_ = items.find((i) => i.to === pathname)?.label || '';
    if (label_) {
      return label_;
    }
    return pageTitle;
  }, [items, pageTitle, pathname]);

  return (
    <div className="screen:w-screen screen:h-screen overflow-x-hidden overflow-y-scroll">
      <main className="flex-1">
        <header className="bg-aws-squid-ink visible flex h-12 w-full items-center justify-between text-lg text-white lg:invisible lg:h-0 print:hidden">
          <div className="flex w-10 items-center justify-start">
            <button
              className="focus:ring-aws-sky mr-2 rounded-full  p-2 hover:opacity-50 focus:outline-none focus:ring-1"
              onClick={() => {
                switchDrawer();
              }}>
              <PiList />
            </button>
          </div>

          <div className="line-clamp-1">{label}</div>

          {/* Dummy block to center the label */}
          <div className="w-10" />
        </header>

        <div
          className={`fixed -left-64 top-0 z-50 transition-all lg:left-0 lg:z-0 ${
            isOpenDrawer ? 'left-0' : '-left-64'
          }`}>
          <UseCaseBuilderDrawer items={items} />
        </div>

        <div
          id="smallDrawerFiller"
          className={`${isOpenDrawer ? 'visible' : 'invisible'} lg:invisible`}>
          <div
            className="screen:h-screen fixed top-0 z-40 w-screen bg-gray-900/90"
            onClick={switchDrawer}></div>
          <ButtonIcon
            className="fixed left-64 top-0 z-40 text-white"
            onClick={switchDrawer}>
            <PiX />
          </ButtonIcon>
        </div>
        <div className="text-aws-font-color lg:ml-64">
          {/* Show when inter-use case connection is enabled */}
          {isShow && <PopupInterUseCasesDemo />}
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default UseCaseBuilderRoot;
