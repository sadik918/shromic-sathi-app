import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeaderSyncStatus, resolveSyncState } from './syncStatusDisplay';

test('resolveSyncState prioritizes offline over pending writes', () => {
  assert.equal(resolveSyncState(false, 0), 'offline');
  assert.equal(resolveSyncState(false, 5), 'offline');
  assert.equal(resolveSyncState(true, 3), 'syncing');
  assert.equal(resolveSyncState(true, 0), 'synced');
});

test('resolveHeaderSyncStatus returns minimal Offline badge text with no extra sentence', () => {
  const bnStatus = resolveHeaderSyncStatus({
    syncState: 'offline',
    pendingCount: 3,
    lang: 'bn',
  });

  assert.equal(bnStatus.isOffline, true);
  assert.equal(bnStatus.mode, 'offline');
  assert.equal(bnStatus.label, 'অফলাইন');
  assert.equal(bnStatus.accessibleLabel, 'অফলাইন স্ট্যাটাস');

  const enStatus = resolveHeaderSyncStatus({
    syncState: 'offline',
    pendingCount: 2,
    lang: 'en',
  });

  assert.equal(enStatus.isOffline, true);
  assert.equal(enStatus.mode, 'offline');
  assert.equal(enStatus.label, 'Offline');
  assert.equal(enStatus.accessibleLabel, 'Offline Status');
});

test('resolveHeaderSyncStatus returns Sync icon presentation when online', () => {
  const syncing = resolveHeaderSyncStatus({
    syncState: 'syncing',
    pendingCount: 4,
    lang: 'bn',
  });
  assert.equal(syncing.isOffline, false);
  assert.equal(syncing.mode, 'syncing');
  assert.match(syncing.tooltip, /৪টি বাকি/);

  const synced = resolveHeaderSyncStatus({
    syncState: 'synced',
    pendingCount: 0,
    lang: 'en',
  });
  assert.equal(synced.isOffline, false);
  assert.equal(synced.mode, 'synced');
  assert.equal(synced.label, 'Synced');
});
