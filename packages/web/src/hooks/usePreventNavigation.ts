import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

interface UsePreventNavigationOptions {
  /** Block app-internal navigation (sidebar links, back button). Default: true */
  blockInternalNavigation?: boolean;
  /** Block browser operations (reload, close tab). Default: true */
  blockBrowserNavigation?: boolean;
  /** Let a navigation through without asking, checked when it happens */
  allow?: (nextPathname: string) => boolean;
}

/**
 * Prevents page navigation when there are unsaved changes
 * @param hasUnsavedChanges - Boolean indicating if there are unsaved changes
 * @param options - Customization options for blocking behavior
 * @returns Blocker object from useBlocker
 */
const usePreventNavigation = (
  hasUnsavedChanges: boolean,
  options: UsePreventNavigationOptions = {}
) => {
  const {
    blockInternalNavigation = true,
    blockBrowserNavigation = true,
    allow,
  } = options;

  // Block app-internal navigation (sidebar links, back button)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      blockInternalNavigation &&
      hasUnsavedChanges &&
      currentLocation.pathname !== nextLocation.pathname &&
      !allow?.(nextLocation.pathname)
  );

  // Block browser operations (reload, close tab, navigate to external URL)
  useEffect(() => {
    if (!blockBrowserNavigation || !hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, blockBrowserNavigation]);

  return blocker;
};

export default usePreventNavigation;
