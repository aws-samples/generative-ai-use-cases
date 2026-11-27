import { useCallback, useEffect, useState } from 'react';

const MAINTENANCE_FILE = `${import.meta.env.BASE_URL}maintenance.json`;
const POLL_INTERVAL_MS = 60_000;

export type MaintenanceState = {
  maintenance: boolean;
  // Optional operator supplied text, shown instead of the default description
  message?: string;
};

const NOT_UNDER_MAINTENANCE: MaintenanceState = { maintenance: false };

/**
 * Poll the maintenance flag that is deployed next to the built assets.
 *
 * The flag is a .json on purpose. The service worker precache only covers
 * js/css/html/ico/png/svg, so this request always reaches the network instead of
 * being answered from the precache, which is what makes it usable as a kill switch
 * for an already installed PWA.
 *
 * Every failure is treated as "not under maintenance". Locking every user out
 * because one request failed would be worse than missing the notice.
 */
export const useMaintenance = (): MaintenanceState => {
  const [state, setState] = useState<MaintenanceState>(NOT_UNDER_MAINTENANCE);

  const check = useCallback(async () => {
    try {
      const res = await fetch(MAINTENANCE_FILE, { cache: 'no-store' });
      if (!res.ok) {
        setState(NOT_UNDER_MAINTENANCE);
        return;
      }

      // A missing file is rewritten to index.html with status 200 by the CloudFront
      // error responses, so confirm the payload is really JSON before trusting it.
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('json')) {
        setState(NOT_UNDER_MAINTENANCE);
        return;
      }

      const body = await res.json();
      setState({
        maintenance: body?.maintenance === true,
        message: typeof body?.message === 'string' ? body.message : undefined,
      });
    } catch {
      setState(NOT_UNDER_MAINTENANCE);
    }
  }, []);

  useEffect(() => {
    check();

    const timer = setInterval(check, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [check]);

  return state;
};
