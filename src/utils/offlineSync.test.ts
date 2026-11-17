import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMutationToQueue,
  loadOfflineQueue,
  reconcileCollectionWithOfflineState,
  saveOfflineQueue,
} from './offlineSync';

test('offlineSync reconciles offline deletions and pending upserts accurately', () => {
  let queue = applyMutationToQueue([], {
    collection: 'attendance',
    docId: 'att_20261110',
    action: 'upsert',
    payload: { id: 'att_20261110', date: '2026-11-10', status: 'present' },
  });
  queue = applyMutationToQueue(queue, {
    collection: 'attendance',
    docId: 'att_20261109',
    action: 'delete',
  });

  const { mergedItems, itemsToUploadToCloud, idsToDeleteFromCloud } =
    reconcileCollectionWithOfflineState<{ id: string; date?: string; status?: string }>({
      collection: 'attendance',
      localItems: [{ id: 'att_20261110', date: '2026-11-10', status: 'present' }],
      remoteItems: [
        { id: 'att_20261109', date: '2026-11-09', status: 'absent' },
        { id: 'att_20261108', date: '2026-11-08', status: 'present' },
      ],
      queue,
    });

  assert.equal(mergedItems.length, 2);
  assert.ok(mergedItems.some((i) => i.id === 'att_20261110'));
  assert.ok(mergedItems.some((i) => i.id === 'att_20261108'));
  assert.ok(!mergedItems.some((i) => i.id === 'att_20261109'));
  assert.deepEqual(idsToDeleteFromCloud, ['att_20261109']);
  assert.equal(itemsToUploadToCloud.length, 1);
  assert.equal(itemsToUploadToCloud[0].id, 'att_20261110');
});

test('saveOfflineQueue compacts oversized binary payloads without throwing when localStorage is mocked', () => {
  const store = new Map<string, string>();
  (globalThis as Record<string, any>).window = {};
  (globalThis as Record<string, any>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };

  try {
    const bigBlob = 'A'.repeat(700_000);
    const queue = [
      ...applyMutationToQueue([], {
        collection: 'documents',
        docId: 'doc_1',
        action: 'upsert',
        payload: { id: 'doc_1', fileData: bigBlob },
      }),
      ...applyMutationToQueue([], {
        collection: 'documents',
        docId: 'doc_2',
        action: 'upsert',
        payload: { id: 'doc_2', fileData: bigBlob },
      }),
    ];
    saveOfflineQueue('user_test', queue);
    const loaded = loadOfflineQueue('user_test');
    assert.equal(loaded.length, 2);
    assert.ok((loaded[0].payload?.fileData as string).length <= 32768);
  } finally {
    delete (globalThis as Record<string, any>).window;
    delete (globalThis as Record<string, any>).localStorage;
  }
});
