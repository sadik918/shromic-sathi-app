export type OfflineSyncCollection =
  | 'profile'
  | 'overtime'
  | 'salaryRecords'
  | 'payments'
  | 'attendance'
  | 'expenses'
  | 'savings'
  | 'documents'
  | 'reminders'
  | 'loans'
  | 'workplaces'
  | 'contacts';

export interface OfflineMutation {
  key: string;
  collection: OfflineSyncCollection;
  docId: string;
  action: 'upsert' | 'delete';
  payload?: Record<string, any>;
  updatedAt: number;
}

const OFFLINE_QUEUE_PREFIX = 'shromik_sathi_offline_queue_v1_';

export function normalizeSyncScopeKey(scopeKey: string): string {
  return (scopeKey || 'default').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

export function applyMutationToQueue(
  queue: OfflineMutation[],
  mutation: Omit<OfflineMutation, 'key' | 'updatedAt'> & { updatedAt?: number }
): OfflineMutation[] {
  const key = `${mutation.collection}:${mutation.docId}`;
  const updatedAt = mutation.updatedAt ?? Date.now();
  const filtered = queue.filter((m) => m.key !== key);
  return [
    ...filtered,
    {
      key,
      collection: mutation.collection,
      docId: mutation.docId,
      action: mutation.action,
      payload: mutation.action === 'upsert' ? mutation.payload : undefined,
      updatedAt,
    },
  ];
}

export function removeMutationFromQueue(
  queue: OfflineMutation[],
  collection: OfflineSyncCollection,
  docId: string
): OfflineMutation[] {
  const key = `${collection}:${docId}`;
  return queue.filter((m) => m.key !== key);
}

export function mergeOfflineQueues(
  primaryQueue: OfflineMutation[],
  secondaryQueue: OfflineMutation[]
): OfflineMutation[] {
  const map = new Map<string, OfflineMutation>();
  for (const item of primaryQueue) {
    map.set(item.key, item);
  }
  for (const item of secondaryQueue) {
    const existing = map.get(item.key);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      map.set(item.key, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.updatedAt - b.updatedAt);
}

export function loadOfflineQueue(scopeKey: string): OfflineMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${OFFLINE_QUEUE_PREFIX}${normalizeSyncScopeKey(scopeKey)}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(scopeKey: string, queue: OfflineMutation[]): void {
  if (typeof window === 'undefined') return;
  try {
    const storageKey = `${OFFLINE_QUEUE_PREFIX}${normalizeSyncScopeKey(scopeKey)}`;
    if (queue.length === 0) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(queue));
    }
  } catch {
    // ignore storage quota errors
  }
}

export function enqueueOfflineMutation(
  scopeKey: string,
  mutation: Omit<OfflineMutation, 'key' | 'updatedAt'> & { updatedAt?: number }
): OfflineMutation[] {
  const current = loadOfflineQueue(scopeKey);
  const next = applyMutationToQueue(current, mutation);
  saveOfflineQueue(scopeKey, next);
  return next;
}

export function clearOfflineMutation(
  scopeKey: string,
  collection: OfflineSyncCollection,
  docId: string
): OfflineMutation[] {
  const current = loadOfflineQueue(scopeKey);
  const next = removeMutationFromQueue(current, collection, docId);
  saveOfflineQueue(scopeKey, next);
  return next;
}

/**
 * Reconciles local cached items, remote Firestore items, and any pending offline mutations
 * for a given subcollection so that:
 * 1. Offline deletions are respected (deleted items are not resurrected by remote snapshots)
 *    and queued for cloud deletion if they still exist in remoteItems.
 * 2. Offline edits (queued upserts) win over stale remote snapshots and are queued for cloud upload.
 * 3. Any local-only items not yet present in remoteItems are preserved and queued for cloud upload.
 */
export function reconcileCollectionWithOfflineState<T extends { id: string }>({
  collection,
  localItems,
  remoteItems,
  queue,
}: {
  collection: OfflineSyncCollection;
  localItems: T[];
  remoteItems: T[];
  queue: OfflineMutation[];
}): {
  mergedItems: T[];
  itemsToUploadToCloud: T[];
  idsToDeleteFromCloud: string[];
} {
  const colQueue = queue.filter((m) => m.collection === collection);
  const deletedIds = new Set<string>(
    colQueue.filter((m) => m.action === 'delete').map((m) => m.docId)
  );
  const pendingUpserts = new Map<string, OfflineMutation>();
  for (const m of colQueue) {
    if (m.action === 'upsert') {
      pendingUpserts.set(m.docId, m);
    }
  }

  const remoteIds = new Set<string>(remoteItems.map((r) => r.id));
  const mergedMap = new Map<string, T>();
  const uploadMap = new Map<string, T>();

  // 1. Seed with remote items (excluding items deleted offline)
  for (const remoteItem of remoteItems) {
    if (deletedIds.has(remoteItem.id)) {
      continue;
    }
    mergedMap.set(remoteItem.id, remoteItem);
  }

  // 2. Apply local items: if an item is missing from remote OR has a pending offline upsert,
  //    keep the local version and mark it for upload to Cloud Firestore.
  for (const localItem of localItems) {
    if (!localItem || !localItem.id || deletedIds.has(localItem.id)) {
      continue;
    }
    const hasPendingUpsert = pendingUpserts.has(localItem.id);
    const existsInRemote = remoteIds.has(localItem.id);
    if (!existsInRemote || hasPendingUpsert) {
      mergedMap.set(localItem.id, localItem);
      uploadMap.set(localItem.id, localItem);
    }
  }

  // 3. Also ensure any queued upsert payload not yet in localItems is included
  for (const [docId, mut] of pendingUpserts.entries()) {
    if (deletedIds.has(docId)) continue;
    if (!mergedMap.has(docId) && mut.payload) {
      const reconstructed = { ...(mut.payload as T), id: docId };
      mergedMap.set(docId, reconstructed);
      uploadMap.set(docId, reconstructed);
    } else if (mut.payload && mergedMap.has(docId)) {
      const current = mergedMap.get(docId)!;
      const mergedItem = { ...current, ...(mut.payload as Partial<T>), id: docId };
      mergedMap.set(docId, mergedItem);
      uploadMap.set(docId, mergedItem);
    }
  }

  const idsToDeleteFromCloud = Array.from(deletedIds);

  return {
    mergedItems: Array.from(mergedMap.values()),
    itemsToUploadToCloud: Array.from(uploadMap.values()),
    idsToDeleteFromCloud,
  };
}
