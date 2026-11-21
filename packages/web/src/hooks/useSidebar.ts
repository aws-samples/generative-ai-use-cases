import { useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_COLLAPSED_WIDTH = 56;

// Matches Tailwind's `lg` breakpoint. Below it the sidebar is an overlay with
// a fixed width, so the stored width / collapsed state do not apply.
const DESKTOP_QUERY = '(min-width: 1024px)';

const clampWidth = (width: number) => {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
};

type SidebarState = {
  width: number;
  collapsed: boolean;
  resizing: boolean;
  setWidth: (width: number) => void;
  resetWidth: () => void;
  toggleCollapsed: () => void;
  setResizing: (resizing: boolean) => void;
};

const useSidebarState = create<SidebarState>()(
  persist(
    (set) => ({
      width: SIDEBAR_DEFAULT_WIDTH,
      collapsed: false,
      resizing: false,
      setWidth: (width) => set({ width: clampWidth(width) }),
      resetWidth: () => set({ width: SIDEBAR_DEFAULT_WIDTH }),
      toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
      setResizing: (resizing) => set({ resizing }),
    }),
    {
      name: 'sidebar-layout',
      partialize: (state) => ({
        width: state.width,
        collapsed: state.collapsed,
      }),
    }
  )
);

const subscribeDesktop = (callback: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};

const getDesktopSnapshot = () =>
  typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia(DESKTOP_QUERY).matches;

const useSidebar = () => {
  const {
    width,
    collapsed,
    resizing,
    setWidth,
    resetWidth,
    toggleCollapsed,
    setResizing,
  } = useSidebarState();
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    () => true
  );

  const isCollapsed = collapsed && isDesktop;
  const widthPx = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : clampWidth(width);

  return {
    /** Collapsed to the icon-only rail (desktop only). */
    collapsed: isCollapsed,
    /** Expanded width in px, kept even while collapsed. */
    width: clampWidth(width),
    /** Current rendered width in px. */
    widthPx,
    resizing,
    /** Style for the layout root so the sidebar and the content stay in sync. */
    layoutStyle: { '--sidebar-w': `${widthPx}px` } as CSSProperties,
    setWidth,
    resetWidth,
    toggleCollapsed,
    setResizing,
  };
};

export default useSidebar;
