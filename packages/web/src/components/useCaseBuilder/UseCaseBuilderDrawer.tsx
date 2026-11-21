import React, { useMemo } from 'react';
import { BaseProps } from '../../@types/common';
import DrawerItem, { DrawerItemProps } from '../DrawerItem';
import DrawerBase from '../DrawerBase';
import ExpandableMenu from '../ExpandableMenu';
import useMyUseCases from '../../hooks/useCaseBuilder/useMyUseCases';
import CustomUseCaseDrawerItems from './CustomUseCaseDrawerItems';
import { useTranslation } from 'react-i18next';
import useSidebar from '../../hooks/useSidebar';

type Props = BaseProps & {
  items: DrawerItemProps[];
};

const UseCaseBuilderDrawer: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { collapsed } = useSidebar();

  const {
    favoriteUseCases,
    isLoadingFavoriteUseCases,
    loadMoreFavoriteUseCases,
    canLoadMoreFavoriteUseCases,
    recentlyUsedUseCases,
    isLoadingRecentlyUsedUseCases,
    loadMoreRecentlyUsedUseCases,
    canLoadMoreRecentlyUsedUseCases,
  } = useMyUseCases();

  const items = useMemo(() => {
    return props.items;
  }, [props.items]);

  return (
    <DrawerBase builderMode>
      <div className="flex-none">
        {!collapsed && (
          <div className="text-aws-smile mx-3 my-1 text-xs">
            {t('useCaseBuilder.mainMenu')}
          </div>
        )}
        {items.map((item, idx) => (
          <DrawerItem
            key={idx}
            className="mx-2"
            label={item.label}
            icon={item.icon}
            to={item.to}
            sub={item.sub}
          />
        ))}
        <div className="mt-2 border-b" />
      </div>

      {!collapsed && (
        <>
          <ExpandableMenu
            title={t('useCaseBuilder.favorites')}
            className="mx-3 my-2 text-xs">
            <div className="scrollbar-thin scrollbar-thumb-white ml-2 mr-1 h-full overflow-y-auto">
              <div>
                <CustomUseCaseDrawerItems useCases={favoriteUseCases} />
                {isLoadingFavoriteUseCases &&
                  new Array(10)
                    .fill('')
                    .map((_, idx) => (
                      <div
                        key={idx}
                        className="bg-aws-sky/20 my-0.5 h-8 w-full animate-pulse rounded"></div>
                    ))}
                {canLoadMoreFavoriteUseCases && !isLoadingFavoriteUseCases && (
                  <div className="my-2 flex w-full justify-center">
                    <button
                      className="text-sm hover:underline"
                      onClick={loadMoreFavoriteUseCases}>
                      {t('useCaseBuilder.loadMore')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </ExpandableMenu>
          <div className="border-b" />

          <ExpandableMenu
            title={t('useCaseBuilder.recentlyUsed')}
            className="mx-3 my-2 text-xs">
            <div className="scrollbar-thin scrollbar-thumb-white ml-2 mr-1 h-full overflow-y-auto">
              <div>
                <CustomUseCaseDrawerItems useCases={recentlyUsedUseCases} />
                {isLoadingRecentlyUsedUseCases &&
                  new Array(10)
                    .fill('')
                    .map((_, idx) => (
                      <div
                        key={idx}
                        className="bg-aws-sky/20 my-0.5 h-8 w-full animate-pulse rounded"></div>
                    ))}
                {canLoadMoreRecentlyUsedUseCases &&
                  !isLoadingRecentlyUsedUseCases && (
                    <div className="my-2 flex w-full justify-center">
                      <button
                        className="text-sm hover:underline"
                        onClick={loadMoreRecentlyUsedUseCases}>
                        {t('useCaseBuilder.loadMore')}
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </ExpandableMenu>
          <div className="border-b" />
        </>
      )}

      <div className="flex-1"></div>
    </DrawerBase>
  );
};

export default UseCaseBuilderDrawer;
