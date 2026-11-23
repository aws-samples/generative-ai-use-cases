import { Link, useLocation } from 'react-router-dom';
import { BaseProps } from '../@types/common';
import useDrawer from '../hooks/useDrawer';
import useSidebar from '../hooks/useSidebar';
import { useCallback } from 'react';
import { PiStar, PiStarFill } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import useLocalStorageBoolean from '../hooks/useLocalStorageBoolean';

export type DrawerItemProps = BaseProps & {
  label: string;
  to: string;
  icon: JSX.Element;
  sub?: string;
  /**
   * True while the user is picking which use cases to keep in the sidebar:
   * every item is listed with a star that adds or removes it.
   */
  editingFavorite?: boolean;
};

const DrawerItem: React.FC<DrawerItemProps> = (props) => {
  const location = useLocation();
  const { switchOpen } = useDrawer();
  const { collapsed } = useSidebar();
  const { t } = useTranslation();
  // A use case is in the sidebar unless the user removed it. The key is the
  // one the earlier visibility switch wrote, so existing choices carry over.
  const [visibility, setVisibility] = useLocalStorageBoolean(
    `visibility_${props.to}`,
    true
  );

  // If the screen is narrow, close the Drawer when clicked
  const onClick = useCallback(() => {
    if (
      document
        .getElementById('smallDrawerFiller')
        ?.classList.contains('visible')
    ) {
      switchOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {!visibility && !props.editingFavorite ? (
        <div></div>
      ) : (
        <div className="mt-0.5 flex h-8 items-center">
          {props.editingFavorite && (
            <button
              type="button"
              className="focus:ring-aws-sky mr-1 rounded p-1 text-base hover:opacity-50 focus:outline-none focus:ring-1"
              title={
                visibility
                  ? t('drawer.remove_from_sidebar')
                  : t('drawer.add_to_sidebar')
              }
              aria-label={
                visibility
                  ? t('drawer.remove_from_sidebar')
                  : t('drawer.add_to_sidebar')
              }
              aria-pressed={visibility}
              onClick={() => setVisibility(!visibility)}>
              {visibility ? (
                <PiStarFill className="text-aws-smile" />
              ) : (
                <PiStar />
              )}
            </button>
          )}
          <Link
            className={`hover:bg-aws-sky flex h-8 w-full items-center rounded p-2 ${
              collapsed ? 'justify-center' : ''
            } ${location.pathname === props.to && 'bg-aws-sky'} ${
              props.className
            }`}
            to={props.to}
            title={collapsed ? props.label : undefined}
            aria-label={collapsed ? props.label : undefined}
            onClick={onClick}>
            {!props.editingFavorite && (
              <span className={collapsed ? 'text-lg' : 'mr-2'}>
                {props.icon}
              </span>
            )}
            {!collapsed && (
              <div className="flex w-full items-center justify-between">
                <span>{props.label}</span>
                {props.sub && (
                  <span className="text-xs text-gray-300">{props.sub}</span>
                )}
              </div>
            )}
          </Link>
        </div>
      )}
    </>
  );
};

export default DrawerItem;
