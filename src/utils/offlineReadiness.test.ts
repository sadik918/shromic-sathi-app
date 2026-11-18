import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areRecordListsEquivalent,
  resolveStaticCachePolicy,
  shouldFetchOnlineTime,
  shouldSkipRedundantMirrorWrite,
} from './offlineReadiness';

test('resolveStaticCachePolicy keeps shell HTML, SW, and manifest as no-cache and hashed assets as immutable', () => {
  assert.equal(resolveStaticCachePolicy('/'), 'no-cache');
  assert.equal(resolveStaticCachePolicy('/index.html'), 'no-cache');
  assert.equal(resolveStaticCachePolicy('/sw.js'), 'no-cache');
  assert.equal(resolveStaticCachePolicy('/alarm-sw-helper.js'), 'no-cache');
  assert.equal(resolveStaticCachePolicy('/manifest.webmanifest'), 'no-cache');
  assert.equal(resolveStaticCachePolicy('/sw.js?v=2'), 'no-cache');
  assert.equal(resolveStaticCachePolicy('/assets/index-AbCd1234.js'), 'immutable');
  assert.equal(resolveStaticCachePolicy('/assets/vendor-firebase-Xyz.js'), 'immutable');
  assert.equal(resolveStaticCachePolicy('/icon.svg'), 'default');
});

test('shouldSkipRedundantMirrorWrite skips unchanged offline cache emissions but preserves server writes', () => {
  const itemsA = [
    { id: 'ot_1', hours: 2, date: '2026-10-10' },
    { id: 'ot_2', hours: 3, date: '2026-10-11' },
  ];
  const itemsB = [
    { id: 'ot_1', hours: 2, date: '2026-10-10' },
    { id: 'ot_2', hours: 3, date: '2026-10-11' },
  ];
  const itemsModified = [
    { id: 'ot_1', hours: 4, date: '2026-10-10' },
    { id: 'ot_2', hours: 3, date: '2026-10-11' },
  ];

  assert.equal(areRecordListsEquivalent(itemsA, itemsB), true);
  assert.equal(
    shouldSkipRedundantMirrorWrite({
      isFromServer: false,
      localList: itemsA,
      mergedList: itemsB,
    }),
    true
  );
  assert.equal(
    shouldSkipRedundantMirrorWrite({
      isFromServer: false,
      localList: itemsA,
      mergedList: itemsModified,
    }),
    false
  );
  assert.equal(
    shouldSkipRedundantMirrorWrite({
      isFromServer: true,
      localList: itemsA,
      mergedList: itemsB,
    }),
    false
  );
});

test('shouldFetchOnlineTime short-circuits only when explicitly offline', () => {
  assert.equal(shouldFetchOnlineTime(false), false);
  assert.equal(shouldFetchOnlineTime(true), true);
  assert.equal(shouldFetchOnlineTime(undefined), true);
});
