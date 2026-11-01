import { useEffect, useState } from 'react';

export type SyncState = 'synced' | 'syncing' | 'offline';

export function useOnlineStatus(pendingWritesCount = 0): {
  isOnline: boolean;
  syncState: SyncState;
} {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  let syncState: SyncState = 'synced';
  if (!isOnline) {
    syncState = 'offline';
  } else if (pendingWritesCount > 0) {
    syncState = 'syncing';
  }

  return { isOnline, syncState };
}
