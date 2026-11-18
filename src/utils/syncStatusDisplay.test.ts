import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeaderSyncStatus, resolveSyncState } from './syncStatusDisplay';

test('resolveSyncState prioritizes offline over pending writes', () => {
  assert.equal(resolveSyncState(false, 0), 'offline');
  assert.equal(resolveSyncState(false, 5), 'offline');
  assert.equal(resolveSyncState(true, 3), 'syncing');
  assert.equal(resolveSyncState(true, 0), 'synced');
});

test('resolveHeaderSyncStatus returns explicit Offline Status badge metadata when offline (EN)', () => {
  const status = resolveHeaderSyncStatus({
    syncState: 'offline',
    pendingCount: 0,
    lang: 'en',
  });

  assert.equal(status.isOffline, true);
  assert.equal(status.mode, 'offline');
  assert.equal(status.compactLabel, 'Offline');
  assert.equal(status.fullLabel, 'Offline Status');
  assert.match(status.accessibleLabel, /not currently syncing to the cloud/i);
  assert.match(status.clickMessage, /Offline Status/i);
});

test('resolveHeaderSyncStatus includes queued local changes count when offline (BN & EN)', () => {
  const bnStatus = resolveHeaderSyncStatus({
    syncState: 'offline',
    pendingCount: 2,
    lang: 'bn',
  });
  assert.equal(bnStatus.isOffline, true);
  assert.equal(bnStatus.compactLabel, 'অফলাইন (২)');
  assert.equal(bnStatus.fullLabel, 'অফলাইন স্ট্যাটাস (২)');
  assert.match(bnStatus.accessibleLabel, /ক্লাউডে সিঙ্ক হচ্ছে না/);
  assert.match(bnStatus.accessibleLabel, /২টি পরিবর্তন/);

  const enStatus = resolveHeaderSyncStatus({
    syncState: 'offline',
    pendingCount: 1,
    lang: 'en',
  });
  assert.equal(enStatus.compactLabel, 'Offline (1)');
  assert.equal(enStatus.fullLabel, 'Offline Status (1)');
  assert.match(enStatus.clickMessage, /1 local change waiting to sync/);
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
  assert.equal(synced.fullLabel, 'Synced');
});
