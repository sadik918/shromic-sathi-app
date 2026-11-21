import { useEffect, useState } from 'react';
import { resolveSyncState, type SyncState } from '../utils/syncStatusDisplay';

export type { SyncState };

export function useOnlineStatus(pendingWritesCount = 0): {
  isOnline: boolean;
  syncState: SyncState;
} {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const syncFromNavigator = () => {
      if (typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
      }
    };
    const handleVisibility = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncFromNavigator();
      }
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    syncFromNavigator();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', syncFromNavigator);
    window.addEventListener('pageshow', syncFromNavigator);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', syncFromNavigator);
      window.removeEventListener('pageshow', syncFromNavigator);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const syncState = resolveSyncState(isOnline, pendingWritesCount);

  return { isOnline, syncState };
}
