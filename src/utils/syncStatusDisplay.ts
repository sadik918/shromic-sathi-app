import type { Language } from '../types';
import { toBengaliDigits } from './calculations';

export type SyncState = 'synced' | 'syncing' | 'offline';

export interface HeaderSyncStatusPresentation {
  mode: SyncState;
  isOffline: boolean;
  label: string;
  accessibleLabel: string;
  tooltip: string;
  pendingCount: number;
}

export function resolveSyncState(isOnline: boolean, pendingWritesCount = 0): SyncState {
  if (!isOnline) {
    return 'offline';
  }
  if (pendingWritesCount > 0) {
    return 'syncing';
  }
  return 'synced';
}

export function resolveHeaderSyncStatus({
  syncState,
  pendingCount = 0,
  lang,
}: {
  syncState: SyncState;
  pendingCount?: number;
  lang: Language;
}): HeaderSyncStatusPresentation {
  const safePending = Math.max(0, Math.floor(pendingCount || 0));

  if (syncState === 'offline') {
    const label = lang === 'bn' ? 'অফলাইন' : 'Offline';
    const accessibleLabel = lang === 'bn' ? 'অফলাইন স্ট্যাটাস' : 'Offline Status';

    return {
      mode: 'offline',
      isOffline: true,
      label,
      accessibleLabel,
      tooltip: accessibleLabel,
      pendingCount: safePending,
    };
  }

  if (syncState === 'syncing') {
    const labelBn =
      safePending > 0
        ? `ক্লাউডে সিঙ্ক হচ্ছে (${toBengaliDigits(safePending)}টি বাকি)...`
        : 'ক্লাউডে সিঙ্ক হচ্ছে...';
    const labelEn =
      safePending > 0 ? `Syncing to cloud (${safePending} pending)...` : 'Syncing to cloud...';

    return {
      mode: 'syncing',
      isOffline: false,
      label: lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...',
      accessibleLabel: lang === 'bn' ? labelBn : labelEn,
      tooltip: lang === 'bn' ? labelBn : labelEn,
      pendingCount: safePending,
    };
  }

  const syncedBn = 'ক্লাউডে সংরক্ষিত (সিঙ্ক সম্পূর্ণ)';
  const syncedEn = 'Synced to cloud';
  return {
    mode: 'synced',
    isOffline: false,
    label: lang === 'bn' ? 'সংরক্ষিত' : 'Synced',
    accessibleLabel: lang === 'bn' ? syncedBn : syncedEn,
    tooltip: lang === 'bn' ? syncedBn : syncedEn,
    pendingCount: 0,
  };
}
