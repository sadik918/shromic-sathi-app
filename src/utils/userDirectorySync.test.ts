import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UserDirectorySyncCoordinator,
  type UserDirectoryFirestoreAdapter,
  type UserDirectoryOfflineQueueAdapter,
} from './userDirectorySync';
import {
  applyMutationToQueue,
  removeMutationFromQueue,
  type OfflineMutation,
} from './offlineSync';

interface InMemorySyncHarness {
  store: Map<string, Record<string, unknown>>;
  queues: Map<string, OfflineMutation[]>;
  calls: {
    getDocFromServer: number;
    getDocFromCache: number;
    createDoc: number;
    updateDoc: number;
  };
  errors: Array<{ uid: string; operation: 'read' | 'create' | 'update'; code?: string }>;
  adapter: UserDirectoryFirestoreAdapter;
  queueAdapter: UserDirectoryOfflineQueueAdapter;
}

function createHarness(options?: {
  initialDocs?: Record<string, Record<string, unknown>>;
  cachedDocs?: Record<string, Record<string, unknown>>;
  serverReadErrorsRemaining?: number;
  serverReadError?: Error & { code?: string };
  cacheReadThrows?: boolean;
  updateErrorsRemaining?: number;
  updateError?: Error & { code?: string };
  createError?: Error & { code?: string };
  serverDelayMs?: number;
}): InMemorySyncHarness {
  const store = new Map<string, Record<string, unknown>>(
    Object.entries(options?.initialDocs || {})
  );
  const cache = new Map<string, Record<string, unknown>>(
    Object.entries(options?.cachedDocs || {})
  );
  const queues = new Map<string, OfflineMutation[]>();
  const calls = { getDocFromServer: 0, getDocFromCache: 0, createDoc: 0, updateDoc: 0 };
  const errors: Array<{ uid: string; operation: 'read' | 'create' | 'update'; code?: string }> = [];

  let serverReadErrLeft = options?.serverReadErrorsRemaining ?? 0;
  let updateErrLeft = options?.updateErrorsRemaining ?? 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const adapter: UserDirectoryFirestoreAdapter = {
    getDocFromServer: async (uid) => {
      calls.getDocFromServer += 1;
      if (options?.serverDelayMs) await sleep(options.serverDelayMs);
      if (serverReadErrLeft > 0) {
        serverReadErrLeft -= 1;
        throw (
          options?.serverReadError ||
          Object.assign(new Error('Failed to get document from server (offline).'), {
            code: 'unavailable',
          })
        );
      }
      const doc = store.get(uid);
      return doc ? { exists: true, data: { ...doc } } : { exists: false };
    },
    getDocFromCache: async (uid) => {
      calls.getDocFromCache += 1;
      if (options?.cacheReadThrows) {
        throw Object.assign(new Error('Cache unavailable'), { code: 'unavailable' });
      }
      const doc = cache.get(uid);
      return doc ? { exists: true, data: { ...doc } } : { exists: false };
    },
    createDoc: async (uid, payload) => {
      calls.createDoc += 1;
      if (options?.serverDelayMs) await sleep(options.serverDelayMs);
      if (options?.createError) {
        throw options.createError;
      }
      if (store.has(uid)) {
        throw Object.assign(new Error('Document already exists'), { code: 'already-exists' });
      }
      store.set(uid, { ...payload, createdAt: 'serverTimestamp', updatedAt: 'serverTimestamp' });
    },
    updateDoc: async (uid, payload) => {
      calls.updateDoc += 1;
      if (options?.serverDelayMs) await sleep(options.serverDelayMs);
      if (updateErrLeft > 0) {
        updateErrLeft -= 1;
        throw (
          options?.updateError ||
          Object.assign(new Error('Network unavailable'), { code: 'unavailable' })
        );
      }
      const existing = store.get(uid) || {};
      store.set(uid, { ...existing, ...payload, updatedAt: 'serverTimestamp' });
    },
  };

  const queueAdapter: UserDirectoryOfflineQueueAdapter = {
    loadQueue: (uid) => queues.get(uid) || [],
    enqueueRetry: (uid, payload) => {
      const current = queues.get(uid) || [];
      queues.set(
        uid,
        applyMutationToQueue(current, {
          collection: 'userDirectory',
          docId: uid,
          action: 'upsert',
          payload,
        })
      );
    },
    clearRetry: (uid) => {
      const current = queues.get(uid) || [];
      queues.set(uid, removeMutationFromQueue(current, 'userDirectory', uid));
    },
  };

  return { store, queues, calls, errors, adapter, queueAdapter };
}

test('1. Newly registered email/password user creates userDirectory doc with BST dates and active user defaults', async () => {
  const coordinator = new UserDirectorySyncCoordinator();
  const h = createHarness();

  const res = await coordinator.sync({
    user: {
      uid: 'uid_email_new_1',
      displayName: 'রফিকুল ইসলাম',
      email: 'rafiq@worker.bd',
      emailVerified: false,
      providerData: [{ providerId: 'password' }],
      // 20:30 UTC on Nov 16 = 02:30 BST on Nov 17
      metadata: { creationTime: 'Mon, 16 Nov 2026 20:30:00 GMT' },
    },
    options: { language: 'bn', todayISO: '2026-11-17' },
    adapter: h.adapter,
    queueAdapter: h.queueAdapter,
  });

  assert.equal(res.status, 'created');
  assert.equal(h.calls.createDoc, 1);
  assert.equal(h.calls.updateDoc, 0);
  const saved = h.store.get('uid_email_new_1')!;
  assert.equal(saved.uid, 'uid_email_new_1');
  assert.equal(saved.displayName, 'রফিকুল ইসলাম');
  assert.equal(saved.authProvider, 'password');
  assert.equal(saved.accountStatus, 'active');
  assert.equal(saved.role, 'user');
  assert.equal(saved.registeredAt, '2026-11-17');
  assert.equal(saved.lastSeenDate, '2026-11-17');
  assert.equal('suspensionReason' in saved, false);
});

test('2. Newly registered Google user creates userDirectory doc with google.com provider', async () => {
  const coordinator = new UserDirectorySyncCoordinator();
  const h = createHarness();

  const res = await coordinator.sync({
    user: {
      uid: 'uid_google_new_1',
      displayName: 'Ayesha Begum',
      email: 'ayesha.rmg@gmail.com',
      emailVerified: true,
      providerData: [{ providerId: 'google.com' }],
      metadata: { creationTime: '2026-11-17T08:00:00Z' },
    },
    options: { language: 'en', todayISO: '2026-11-17' },
    adapter: h.adapter,
    queueAdapter: h.queueAdapter,
  });

  assert.equal(res.status, 'created');
  const saved = h.store.get('uid_google_new_1')!;
  assert.equal(saved.authProvider, 'google.com');
  assert.equal(saved.emailVerified, true);
  assert.equal(saved.language, 'en');
  assert.equal(saved.accountStatus, 'active');
  assert.equal(saved.role, 'user');
});

test('3. Existing user signing in again runs owner updateDoc and preserves existing displayName & registeredAt', async () => {
  const coordinator = new UserDirectorySyncCoordinator();
  const h = createHarness({
    initialDocs: {
      uid_existing_1: {
        uid: 'uid_existing_1',
        displayName: 'সালমা আক্তার',
        email: 'salma@gmail.com',
        registeredAt: '2026-09-10',
        lastSeenDate: '2026-11-01',
        accountStatus: 'active',
        role: 'user',
        authProvider: 'password',
        language: 'bn',
      },
    },
  });

  // Simulate fast login where user.displayName & opts.displayName aren't populated yet
  const res = await coordinator.sync({
    user: {
      uid: 'uid_existing_1',
      displayName: null,
      email: 'salma@gmail.com',
      emailVerified: true,
      providerData: [{ providerId: 'password' }],
    },
    options: { language: 'bn', todayISO: '2026-11-17' },
    adapter: h.adapter,
    queueAdapter: h.queueAdapter,
  });

  assert.equal(res.status, 'updated');
  assert.equal(h.calls.createDoc, 0);
  assert.equal(h.calls.updateDoc, 1);
  const saved = h.store.get('uid_existing_1')!;
  assert.equal(saved.displayName, 'সালমা আক্তার'); // Never overwritten with 'salma' email prefix!
  assert.equal(saved.registeredAt, '2026-09-10'); // Preserved!
  assert.equal(saved.lastSeenDate, '2026-11-17');
});

test('4. Two simultaneous triggers for the same UID serialize cleanly without conflicting create calls', async () => {
  const coordinator = new UserDirectorySyncCoordinator();
  const h = createHarness({ serverDelayMs: 15 });

  // Call A comes from onAuthStateChanged before displayName is updated; Call B comes from signUpWithCredentials with full name
  const p1 = coordinator.sync({
    user: {
      uid: 'uid_race_1',
      displayName: '',
      email: 'new.worker@worker.bd',
      emailVerified: false,
      providerData: [{ providerId: 'password' }],
      metadata: { creationTime: '2026-11-17T05:00:00Z' },
    },
    options: { language: 'bn', todayISO: '2026-11-17' },
    adapter: h.adapter,
    queueAdapter: h.queueAdapter,
  });

  const p2 = coordinator.sync({
    user: {
      uid: 'uid_race_1',
      displayName: 'জাহিদ হাসান',
      email: 'new.worker@worker.bd',
      emailVerified: false,
      providerData: [{ providerId: 'password' }],
      metadata: { creationTime: '2026-11-17T05:00:00Z' },
    },
    options: { displayName: 'জাহিদ হাসান', language: 'bn', todayISO: '2026-11-17' },
    adapter: h.adapter,
    queueAdapter: h.queueAdapter,
  });

  // Third redundant identical trigger should coalesce without launching an extra write pass
  const p3 = coordinator.sync({
    user: {
      uid: 'uid_race_1',
      displayName: 'জাহিদ হাসান',
      email: 'new.worker@worker.bd',
      emailVerified: false,
      providerData: [{ providerId: 'password' }],
    },
    options: { displayName: 'জাহিদ হাসান', language: 'bn', todayISO: '2026-11-17' },
    adapter: h.adapter,
    queueAdapter: h.queueAdapter,
  });

  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
  assert.equal(h.calls.createDoc, 1); // Only ONE createDoc ever happened!
  assert.equal(h.calls.updateDoc, 1); // Followed sequentially by ONE updateDoc with explicit name!
  assert.equal(r1.status, 'updated');
  assert.equal(r2.status, 'updated');
  assert.equal(r3.status, 'updated');
  assert.equal(h.store.get('uid_race_1')?.displayName, 'জাহিদ হাসান');
});

test('5. Admin-managed role and accountStatus remain untouched after ordinary user sign-in synchronization', async () => {
  const coordinator = new UserDirectorySyncCoordinator();
  const h = createHarness({
    initialDocs: {
      uid_mod_suspended: {
        uid: 'uid_mod_suspended',
        displayName: 'তানভীর আহমেদ',
        email: 'tanvir@shromiksathi.org',
        registeredAt: '2026-05-01',
        lastSeenDate: '2026-11-01',
        accountStatus: 'suspended',
        suspensionReason: 'Policy audit hold',
        role: 'support_moderator',
        authProvider: 'google.com',
        language: 'bn',
      },
    },
  });

  const res = await coordinator.sync({
    user: {
      uid: 'uid_mod_suspended',
      displayName: 'তানভীর আহমেদ',
      email: 'tanvir@shromiksathi.org',
      emailVerified: true,
      providerData: [{ providerId: 'google.com' }],
    },
    options: { language: 'en', todayISO: '2026-11-17' },
    adapter: h.adapter,
    queueAdapter: h.queueAdapter,
  });

  assert.equal(res.status, 'updated');
  const saved = h.store.get('uid_mod_suspended')!;
  assert.equal(saved.role, 'support_moderator');
  assert.equal(saved.accountStatus, 'suspended');
  assert.equal(saved.suspensionReason, 'Policy audit hold');
  assert.equal(saved.registeredAt, '2026-05-01');
  assert.equal(saved.language, 'en');
  assert.equal(saved.lastSeenDate, '2026-11-17');
});

test('7. getDocFromServer failure NEVER overwrites existing doc with setDoc and safely retries once back online', async () => {
  const coordinator = new UserDirectorySyncCoordinator();
  const h = createHarness({
    initialDocs: {
      uid_offline_1: {
        uid: 'uid_offline_1',
        displayName: 'আলিয়া সুলতানা',
        email: 'aliya@gmail.com',
        registeredAt: '2026-08-15',
        lastSeenDate: '2026-11-10',
        accountStatus: 'suspended',
        suspensionReason: 'Duplicate report check',
        role: 'admin',
      },
    },
    // Cache is empty on a cold device and server read fails once due to offline/unavailable
    cachedDocs: {},
    serverReadErrorsRemaining: 1,
    serverReadError: Object.assign(new Error('Failed to get document because the client is offline.'), {
      code: 'unavailable',
    }),
  });

  const reportedErrors: Array<{ operation: string; code: string }> = [];
  const resOffline = await coordinator.sync({
    user: {
      uid: 'uid_offline_1',
      displayName: 'আলিয়া সুলতানা',
      email: 'aliya@gmail.com',
      emailVerified: true,
      providerData: [{ providerId: 'google.com' }],
    },
    options: { language: 'bn', todayISO: '2026-11-17' },
    adapter: h.adapter,
    queueAdapter: h.queueAdapter,
    onError: (err, ctx) => {
      reportedErrors.push({
        operation: ctx.operation,
        code: String((err as { code?: string })?.code || ''),
      });
    },
  });

  assert.equal(resOffline.status, 'queued_retry');
  assert.equal(h.calls.createDoc, 0); // CRITICAL: Never called setDoc when server read failed!
  assert.equal(h.calls.updateDoc, 0);
  assert.equal(h.queues.get('uid_offline_1')?.length, 1);
  assert.equal(h.queues.get('uid_offline_1')?.[0].collection, 'userDirectory');
  assert.deepEqual(reportedErrors, [{ operation: 'read', code: 'unavailable' }]);

  // Verify existing server doc remained 100% intact
  assert.equal(h.store.get('uid_offline_1')?.accountStatus, 'suspended');
  assert.equal(h.store.get('uid_offline_1')?.role, 'admin');

  // Now connectivity returns and retry runs
  const resRetry = await coordinator.sync({
    user: {
      uid: 'uid_offline_1',
      displayName: 'আলিয়া সুলতানা',
      email: 'aliya@gmail.com',
      emailVerified: true,
      providerData: [{ providerId: 'google.com' }],
    },
    options: { language: 'bn', todayISO: '2026-11-17' },
    adapter: h.adapter,
    queueAdapter: h.queueAdapter,
  });

  assert.equal(resRetry.status, 'updated');
  assert.equal(h.calls.createDoc, 0);
  assert.equal(h.calls.updateDoc, 1);
  assert.equal(h.queues.get('uid_offline_1')?.length, 0); // Retry queue cleared cleanly!
  assert.equal(h.store.get('uid_offline_1')?.accountStatus, 'suspended');
  assert.equal(h.store.get('uid_offline_1')?.role, 'admin');
  assert.equal(h.store.get('uid_offline_1')?.lastSeenDate, '2026-11-17');
});
