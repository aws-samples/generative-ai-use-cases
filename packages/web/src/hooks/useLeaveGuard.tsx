import { useRef } from 'react';
import usePreventNavigation from './usePreventNavigation';
import NavigationBlockDialog from '../components/NavigationBlockDialog';

/**
 * Asks before leaving a page with unsaved changes (other pages, the back
 * button, reload). `allow` lets some destinations through, and `leave()`
 * lets the next navigation through, such as the one after saving.
 */
const useLeaveGuard = (
  unsaved: boolean,
  allow?: (nextPathname: string) => boolean
) => {
  const leaving = useRef(false);
  const blocker = usePreventNavigation(unsaved, {
    allow: (path) => leaving.current || !!allow?.(path),
  });
  return {
    leave: () => {
      leaving.current = true;
    },
    dialog: (
      <NavigationBlockDialog
        isOpen={blocker.state === 'blocked'}
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    ),
  };
};

export default useLeaveGuard;
