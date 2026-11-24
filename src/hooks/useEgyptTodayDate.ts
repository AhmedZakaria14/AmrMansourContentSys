import { useEffect, useState } from 'react';
import { getEgyptDateString } from '../utils/dateUtils';

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Returns today's YYYY-MM-DD date string in Africa/Cairo timezone and keeps it fresh:
 * - Recomputes at least once per minute so an open dashboard rolls over after midnight.
 * - Recomputes immediately when the browser tab becomes visible again or regains focus.
 */
export function useEgyptTodayDate(): string {
  const [todayDate, setTodayDate] = useState<string>(() => getEgyptDateString());

  useEffect(() => {
    const syncDate = () => {
      const next = getEgyptDateString();
      setTodayDate((prev) => (prev === next ? prev : next));
    };

    const intervalId = window.setInterval(syncDate, REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncDate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', syncDate);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', syncDate);
    };
  }, []);

  return todayDate;
}
