import React, { ReactNode, useMemo, useRef } from 'react';
import { BaseProps } from '../@types/common';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import useVersion from '../hooks/useVersion';
import IconWithDot from './IconWithDot';
import { PiGear, PiShieldCheck, PiSidebarSimple } from 'react-icons/pi';
import useIsAdmin from '../hooks/useIsAdmin';
import { fetchAuthSession } from 'aws-amplify/auth';
import useUserSetting from '../hooks/useUserSetting';
import { useTranslation } from 'react-i18next';
import useSidebar, {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from '../hooks/useSidebar';
import DrawerModeTabs from './DrawerModeTabs';

const RESIZE_KEY_STEP = 16;

type Props = BaseProps & {
  builderMode?: boolean;
  children: ReactNode;
};

const DrawerBase: React.FC<Props> = (props) => {
  const { getHasUpdate } = useVersion();
  const { settingShowEmail, settingShowUseCaseBuilder } = useUserSetting();
  const { t } = useTranslation();
  const isAdmin = useIsAdmin() === true;

  // The first argument is not required, but if it is not included, the request will not be made, so 'user' string is entered
  const { data } = useSWR('user', () => {
    return fetchAuthSession();
  });

  const email = useMemo<string>(() => {
    return (data?.tokens?.idToken?.payload.email ?? '') as string;
  }, [data]);

  const hasUpdate = getHasUpdate();

  const {
    collapsed,
    width,
    resizing,
    setWidth,
    resetWidth,
    toggleCollapsed,
    setResizing,
  } = useSidebar();
  const navRef = useRef<HTMLElement>(null);

  // Builder mode is always switchable back; the way in follows the deployment
  // and user settings.
  const showModeTabs =
    props.builderMode ||
    (import.meta.env.VITE_APP_USE_CASE_BUILDER_ENABLED === 'true' &&
      settingShowUseCaseBuilder);

  const toggleLabel = collapsed
    ? t('drawer.expand_sidebar')
    : t('drawer.collapse_sidebar');

  const settingUrl = useMemo(() => {
    return props.builderMode ? `/use-case-builder/setting` : '/setting';
  }, [props.builderMode]);

  return (
    <>
      {/* 100vh on a phone is the height with the browser's toolbars hidden, so
          the bottom of a fixed full-height drawer (the settings link) sits
          behind them while they are shown, and the drawer does not scroll.
          Use the height actually visible where the browser knows it.
          On a wide screen the width follows the user's choice (--sidebar-w,
          set by the layout); on a phone the drawer is an overlay of fixed
          width. */}
      <nav
        ref={navRef}
        className={`bg-aws-squid-ink relative flex h-screen w-64 flex-col justify-between text-sm text-white supports-[height:100dvh]:h-dvh lg:w-[var(--sidebar-w)] print:hidden ${
          resizing ? 'select-none' : 'lg:transition-width lg:duration-200'
        }`}>
        <div className="flex h-full min-h-0 flex-col">
          <div
            className={`flex-none flex-col gap-1 px-2 pb-2 pt-1 ${
              collapsed ? 'items-center' : ''
            } ${showModeTabs ? 'flex' : 'hidden lg:flex'}`}>
            <div
              className={`hidden lg:flex ${
                collapsed ? 'justify-center' : 'justify-end'
              }`}>
              <button
                type="button"
                className="focus:ring-aws-sky flex size-8 flex-none items-center justify-center rounded text-lg hover:bg-white/10 focus:outline-none focus:ring-1"
                title={toggleLabel}
                aria-label={toggleLabel}
                aria-expanded={!collapsed}
                onClick={toggleCollapsed}>
                <PiSidebarSimple />
              </button>
            </div>
            {showModeTabs && (
              <DrawerModeTabs builderMode={!!props.builderMode} />
            )}
          </div>
          {showModeTabs && <div className="border-b border-gray-400" />}
          {props.children}
          <div
            className={`flex flex-none border-t border-gray-400 px-3 py-2 ${
              collapsed
                ? 'flex-col items-center gap-y-2'
                : 'items-center justify-between gap-x-2'
            }`}>
            {!collapsed && settingShowEmail && (
              <div className="truncate text-xs">{email}</div>
            )}
            {!collapsed && <div className="grow" />}
            {isAdmin && (
              <Link to="/admin" title={t('admin.title')}>
                <PiShieldCheck className="text-lg" />
              </Link>
            )}
            <Link to={settingUrl} title={t('navigation.settings')}>
              <IconWithDot showDot={hasUpdate}>
                <PiGear className="text-lg" />
              </IconWithDot>
            </Link>
          </div>
        </div>

        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('drawer.resize_sidebar')}
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            aria-valuenow={width}
            tabIndex={0}
            className={`absolute inset-y-0 right-0 hidden w-1.5 cursor-col-resize touch-none hover:bg-white/30 focus:outline-none focus-visible:bg-white/30 lg:block ${
              resizing ? 'bg-white/30' : ''
            }`}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setResizing(true);
            }}
            onPointerMove={(e) => {
              // A drag only counts while the primary button is held, so a
              // missed pointerup can never leave the handle following the mouse.
              if (!resizing || !navRef.current) return;
              if (e.buttons !== 1) {
                setResizing(false);
                return;
              }
              setWidth(e.clientX - navRef.current.getBoundingClientRect().left);
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId);
              setResizing(false);
            }}
            onPointerCancel={() => {
              setResizing(false);
            }}
            onLostPointerCapture={() => {
              setResizing(false);
            }}
            onDoubleClick={resetWidth}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setWidth(width - RESIZE_KEY_STEP);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setWidth(width + RESIZE_KEY_STEP);
              }
            }}
          />
        )}
      </nav>
    </>
  );
};

export default DrawerBase;
