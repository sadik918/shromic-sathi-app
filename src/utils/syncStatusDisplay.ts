import type { Language } from '../types';
import { toBengaliDigits } from './calculations';

export type SyncState = 'synced' | 'syncing' | 'offline';

export interface HeaderSyncStatusPresentation {
  mode: SyncState;
  isOffline: boolean;
  compactLabel: string;
  fullLabel: string;
  accessibleLabel: string;
  tooltip: string;
  clickMessage: string;
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
    const countSuffixBn = safePending > 0 ? ` (${toBengaliDigits(safePending)})` : '';
    const countSuffixEn = safePending > 0 ? ` (${safePending})` : '';

    const pendingDetailBn =
      safePending > 0
        ? ` (${toBengaliDigits(safePending)}টি পরিবর্তন ফোনে অপেক্ষমাণ আছে)`
        : '';
    const pendingDetailEn =
      safePending > 0
        ? ` (${safePending} local ${safePending === 1 ? 'change' : 'changes'} waiting to sync)`
        : '';

    const explanationBn = `অফলাইন স্ট্যাটাস — ইন্টারনেট সংযোগ নেই। ডেটা এখন ক্লাউডে সিঙ্ক হচ্ছে না, তবে ফোনে নিরাপদভাবে সংরক্ষিত আছে${pendingDetailBn}।`;
    const explanationEn = `Offline Status — No internet connection. Data is not currently syncing to the cloud, and your changes remain saved locally${pendingDetailEn}.`;

    return {
      mode: 'offline',
      isOffline: true,
      compactLabel: lang === 'bn' ? `অফলাইন${countSuffixBn}` : `Offline${countSuffixEn}`,
      fullLabel:
        lang === 'bn' ? `অফলাইন স্ট্যাটাস${countSuffixBn}` : `Offline Status${countSuffixEn}`,
      accessibleLabel: lang === 'bn' ? explanationBn : explanationEn,
      tooltip: lang === 'bn' ? explanationBn : explanationEn,
      clickMessage: lang === 'bn' ? explanationBn : explanationEn,
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
      compactLabel: lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...',
      fullLabel: lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...',
      accessibleLabel: lang === 'bn' ? labelBn : labelEn,
      tooltip: lang === 'bn' ? labelBn : labelEn,
      clickMessage: lang === 'bn' ? labelBn : labelEn,
      pendingCount: safePending,
    };
  }

  const syncedBn = 'ক্লাউডে সংরক্ষিত (সিঙ্ক সম্পূর্ণ)';
  const syncedEn = 'Synced to cloud';
  return {
    mode: 'synced',
    isOffline: false,
    compactLabel: lang === 'bn' ? 'সংরক্ষিত' : 'Synced',
    fullLabel: lang === 'bn' ? 'সংরক্ষিত' : 'Synced',
    accessibleLabel: lang === 'bn' ? syncedBn : syncedEn,
    tooltip: lang === 'bn' ? syncedBn : syncedEn,
    clickMessage: lang === 'bn' ? syncedBn : syncedEn,
    pendingCount: 0,
  };
}
