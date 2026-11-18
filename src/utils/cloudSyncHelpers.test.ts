import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserDirectoryCreatePayload,
  buildUserDirectoryOwnerUpdatePayload,
  classifyFirestoreReadError,
  extractAvailableRegistrationMonths,
  getBstTodayISO,
  isOfflineOrTransientFirestoreError,
  isStrictAdminSession,
  mapFirebaseAuthError,
  mapFirestoreTimestampOrStringToDateISO,
  mapFirestoreUserDirectoryDoc,
  mapWorkerProfileDocToDirectoryEntry,
  mergeUserDirectories,
  PRIMARY_SUPER_ADMIN_EMAIL,
  resolveAuthProvider,
  resolveBestUserDisplayName,
  resolveVerifiedAdminSession,
  stripUndefinedAndMetaFields,
  normalizeWorkerProfileForFirestore,
  normalizeLoanPayloadForFirestore,
  normalizeSubcollectionPayloadForFirestore,
  truncateUtf8,
  utf8ByteLength,
} from './cloudSyncHelpers';
import type { AdminUserDirectoryEntry } from './adminLogic';
import { getInitialDemoState } from './demoData';

test('stripUndefinedAndMetaFields strips undefined, id, createdAt, updatedAt, and nested undefined values', () => {
  const fakeTimestamp = new Date('2026-11-16T00:00:00Z');
  const input = {
    id: 'doc-123',
    userId: 'uid-1',
    factoryName: 'ABC Knit',
    leavingDate: undefined,
    grossSalary: undefined,
    notes: 'keep me',
    repayments: [
      { id: 'r1', amount: 500, referenceNumber: undefined },
      undefined,
    ],
    createdAt: fakeTimestamp,
    updatedAt: fakeTimestamp,
  };

  const cleaned = stripUndefinedAndMetaFields(input);
  assert.equal('id' in cleaned, false);
  assert.equal('createdAt' in cleaned, false);
  assert.equal('updatedAt' in cleaned, false);
  assert.equal('leavingDate' in cleaned, false);
  assert.equal('grossSalary' in cleaned, false);
  assert.equal(cleaned.factoryName, 'ABC Knit');
  assert.equal(cleaned.notes, 'keep me');
  assert.deepEqual(cleaned.repayments, [{ id: 'r1', amount: 500 }]);
});

test('isStrictAdminSession and resolveVerifiedAdminSession enforce verified non-demo admin rules', () => {
  assert.equal(
    isStrictAdminSession({ email: PRIMARY_SUPER_ADMIN_EMAIL, emailVerified: true }, false),
    true
  );
  assert.equal(
    isStrictAdminSession({ email: 'SADIKULISLAM45974@GMAIL.COM', emailVerified: true }, false),
    true
  );
  // Spoofed unverified email must fail
  assert.equal(
    isStrictAdminSession({ email: PRIMARY_SUPER_ADMIN_EMAIL, emailVerified: false }, false),
    false
  );
  // Demo mode must fail
  assert.equal(
    isStrictAdminSession({ email: PRIMARY_SUPER_ADMIN_EMAIL, emailVerified: true }, true),
    false
  );
  // Regular user without /admins doc must fail
  assert.equal(
    resolveVerifiedAdminSession({
      user: { email: 'worker@example.com', emailVerified: true },
      isReadOnlyDemo: false,
      hasAdminsDoc: false,
    }),
    false
  );
  // Delegated verified user WITH /admins/{uid} doc succeeds when not demo
  assert.equal(
    resolveVerifiedAdminSession({
      user: { email: 'ops.admin@shromiksathi.org', emailVerified: true },
      isReadOnlyDemo: false,
      hasAdminsDoc: true,
    }),
    true
  );
  // Unverified user with /admins doc still rejected client-side
  assert.equal(
    resolveVerifiedAdminSession({
      user: { email: 'ops.admin@shromiksathi.org', emailVerified: false },
      isReadOnlyDemo: false,
      hasAdminsDoc: true,
    }),
    false
  );
});

test('resolveAuthProvider detects google.com vs password accurately', () => {
  assert.equal(resolveAuthProvider([{ providerId: 'google.com' }]), 'google.com');
  assert.equal(resolveAuthProvider([{ providerId: 'password' }]), 'password');
  assert.equal(resolveAuthProvider([]), 'password');
  assert.equal(resolveAuthProvider(null), 'password');
});

test('Bangladesh timezone (UTC+6 / Asia/Dhaka) converts late-night UTC timestamps accurately', () => {
  // 2026-11-16 19:30 UTC is 2026-11-17 01:30 AM in Bangladesh (UTC+6)
  const utcMs = Date.UTC(2026, 10, 16, 19, 30, 0);
  assert.equal(getBstTodayISO(utcMs), '2026-11-17');
  assert.equal(
    mapFirestoreTimestampOrStringToDateISO('2026-11-16T19:30:00Z', '2026-01-01'),
    '2026-11-17'
  );
  assert.equal(
    mapFirestoreTimestampOrStringToDateISO('Mon, 16 Nov 2026 22:00:00 GMT', '2026-01-01'),
    '2026-11-17'
  );
  assert.equal(
    mapFirestoreTimestampOrStringToDateISO({ toDate: () => new Date(utcMs) }, '2026-01-01'),
    '2026-11-17'
  );
  // Plain calendar YYYY-MM-DD strings stay untouched
  assert.equal(mapFirestoreTimestampOrStringToDateISO('2026-11-16', '2026-01-01'), '2026-11-16');
});

test('buildUserDirectoryCreatePayload and OwnerUpdatePayload obey firestore.rules constraints and preserve existingDisplayName', () => {
  const user = {
    uid: 'worker_uid_99',
    displayName: 'রহিম মিয়া',
    email: 'rahim@example.com',
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
    metadata: { creationTime: '2026-11-12T10:15:00Z' },
  };

  const createPayload = buildUserDirectoryCreatePayload({
    user,
    language: 'bn',
    todayISO: '2026-11-17',
  });
  assert.equal(createPayload.uid, 'worker_uid_99');
  assert.equal(createPayload.accountStatus, 'active');
  assert.equal(createPayload.role, 'user');
  assert.equal(createPayload.registeredAt, '2026-11-12');
  assert.equal(createPayload.lastSeenDate, '2026-11-17');
  assert.equal('suspensionReason' in createPayload, false);

  const updatePayload = buildUserDirectoryOwnerUpdatePayload({
    user: { ...user, displayName: null },
    existingDisplayName: 'রহিম উদ্দিন',
    language: 'en',
    todayISO: '2026-11-17',
  });
  assert.equal(updatePayload.displayName, 'রহিম উদ্দিন');
  assert.deepEqual(Object.keys(updatePayload).sort(), [
    'appVersion',
    'authProvider',
    'displayName',
    'email',
    'emailVerified',
    'language',
    'lastSeenDate',
    'offlineSyncState',
  ]);
});

test('mapFirestoreUserDirectoryDoc preserves admin role and converts timestamps to BST', () => {
  const fakeTs = { toDate: () => new Date('2026-11-15T09:00:00Z') };
  assert.equal(mapFirestoreTimestampOrStringToDateISO(fakeTs, '2026-01-01'), '2026-11-15');

  const mapped = mapFirestoreUserDirectoryDoc(
    'uid_abc',
    {
      displayName: 'Karim',
      email: 'karim@factory.com',
      accountStatus: 'suspended',
      role: 'admin',
      suspensionReason: 'Duplicate spam',
      createdAt: fakeTs,
      updatedAt: fakeTs,
      authProvider: 'google.com',
      language: 'bn',
      emailVerified: true,
    },
    '2026-11-17'
  );
  assert.equal(mapped.uid, 'uid_abc');
  assert.equal(mapped.registeredAt, '2026-11-15');
  assert.equal(mapped.accountStatus, 'suspended');
  assert.equal(mapped.role, 'admin');
  assert.equal(mapped.suspensionReason, 'Duplicate spam');
  assert.equal(mapped.authProvider, 'google.com');
});

test('mergeUserDirectories strips usr_rmg_ mock seeds when connected and sorts newest registrations first (including same-day timestamp)', () => {
  const mockSeed: AdminUserDirectoryEntry = {
    uid: 'usr_rmg_101',
    displayName: 'Mock Seed',
    email: 'mock@example.com',
    accountStatus: 'active',
    emailVerified: true,
    registeredAt: '2026-10-01',
    lastSeenDate: '2026-10-18',
    authProvider: 'password',
    language: 'bn',
    offlineSyncState: 'synced',
    appVersion: '2.4.0',
    statusHistory: [],
  };
  const realOlder: AdminUserDirectoryEntry = {
    ...mockSeed,
    uid: 'real_u1',
    displayName: 'Salma',
    registeredAt: '2026-11-01',
  };
  const sameDayMorning: AdminUserDirectoryEntry = {
    ...mockSeed,
    uid: 'real_u2',
    displayName: 'Nadia',
    registeredAt: '2026-11-17',
    createdAtMs: Date.UTC(2026, 10, 17, 2, 0, 0),
  };
  const sameDayAfternoon: AdminUserDirectoryEntry = {
    ...mockSeed,
    uid: 'real_u3',
    displayName: 'Amina',
    registeredAt: '2026-11-17',
    createdAtMs: Date.UTC(2026, 10, 17, 9, 0, 0),
  };

  const mergedConnected = mergeUserDirectories(
    [realOlder, sameDayMorning, sameDayAfternoon],
    [mockSeed],
    { firestoreConnected: true }
  );
  assert.deepEqual(
    mergedConnected.map((u) => u.uid),
    ['real_u3', 'real_u2', 'real_u1']
  );

  const months = extractAvailableRegistrationMonths(mergedConnected, '2026-11');
  assert.deepEqual(months, ['2026-11']);
});

test('mapFirebaseAuthError and classifyFirestoreReadError return structured error metadata', () => {
  assert.match(mapFirebaseAuthError({ code: 'auth/wrong-password' }, 'bn'), /ইমেইল বা পাসওয়ার্ড/);
  assert.match(mapFirebaseAuthError({ code: 'auth/email-already-in-use' }, 'en'), /already registered/);
  assert.match(mapFirebaseAuthError({ code: 'auth/weak-password' }, 'bn'), /৬ অক্ষর/);
  assert.equal(isOfflineOrTransientFirestoreError({ code: 'unavailable' }), true);
  assert.equal(isOfflineOrTransientFirestoreError({ code: 'permission-denied' }), false);

  const permErr = classifyFirestoreReadError({ code: 'permission-denied' });
  assert.equal(permErr.category, 'permission_denied');
  assert.equal(permErr.retryable, false);

  const offlineErr = classifyFirestoreReadError({ code: 'unavailable' });
  assert.equal(offlineErr.category, 'offline_unavailable');
  assert.equal(offlineErr.retryable, true);
});

test('normalizeWorkerProfileForFirestore clamps invalid legacy numbers/enums and populates required fields', () => {
  const normalized = normalizeWorkerProfileForFirestore(
    {
      id: 'legacy_id',
      userId: 'other_uid',
      fullName: '',
      expectedPayDay: 0,
      otDivisor: 0,
      otMultiplier: -1,
      employmentType: 'invalid_type',
      shiftPattern: 'unknown_shift',
      weeklyHolidayDay: 'noday',
      language: 'bn',
      basicSalary: -500,
    },
    'uid_real_123',
    'রহিমা খাতুন'
  );

  assert.equal('id' in normalized, false);
  assert.equal('userId' in normalized, false);
  assert.equal(normalized.fullName, 'রহিমা খাতুন');
  assert.equal(normalized.expectedPayDay, 7);
  assert.equal(normalized.otDivisor, 208);
  assert.equal(normalized.otMultiplier, 2);
  assert.equal(normalized.employmentType, 'permanent');
  assert.equal(normalized.shiftPattern, 'day');
  assert.equal(normalized.weeklyHolidayDay, 'friday');
  assert.equal(normalized.basicSalary, 0);
  assert.equal(normalized.privacyConsent, true);
});

test('normalizeLoanPayloadForFirestore ensures all demo loans satisfy Firestore schema rules', () => {
  const sample = getInitialDemoState();
  assert.ok(sample.loans.length >= 5);
  for (const loan of sample.loans) {
    const normalized = normalizeLoanPayloadForFirestore(loan as unknown as Record<string, unknown>);
    assert.equal('userId' in normalized, false);
    assert.equal('id' in normalized, false);
    assert.ok(typeof normalized.title === 'string' && normalized.title.length >= 1);
    assert.ok(typeof normalized.lenderType === 'string' && normalized.lenderType.length >= 1);
    assert.ok(typeof normalized.totalLoanAmount === 'number');
    assert.ok(typeof normalized.paidAmount === 'number');
    assert.ok(typeof normalized.monthlyInstallment === 'number');
    assert.ok(typeof normalized.nextDueDate === 'string' && normalized.nextDueDate.length <= 20);
    assert.ok(typeof normalized.notes === 'string' && utf8ByteLength(normalized.notes) <= 300);
    if (normalized.repaymentArrangement !== undefined) {
      assert.ok(
        typeof normalized.repaymentArrangement === 'string' &&
          utf8ByteLength(normalized.repaymentArrangement) <= 250
      );
    }
  }
});

test('truncateUtf8 respects UTF-8 byte limits on Bengali text and surrogate pairs', () => {
  // Each Bengali character is 3 UTF-8 bytes
  const longBengali = 'গার্মেন্টস শ্রমিকদের ওভারটাইম এবং হাজিরা হিসাব '.repeat(10);
  assert.ok(longBengali.length < 500);
  assert.ok(utf8ByteLength(longBengali) > 1000);

  const truncated100 = truncateUtf8(longBengali, 100);
  assert.ok(utf8ByteLength(truncated100) <= 100);
  assert.ok(utf8ByteLength(truncated100) >= 97);

  // Emoji surrogate pair (4 bytes) should never be split in half
  const emojiStr = 'ক😀খ'; // 3 + 4 + 3 = 10 bytes
  assert.equal(utf8ByteLength(emojiStr), 10);
  const trunc5 = truncateUtf8(emojiStr, 5); // cannot fit emoji (3+4=7 > 5)
  assert.equal(trunc5, 'ক');
  assert.equal(utf8ByteLength(trunc5), 3);
});

test('normalizeSubcollectionPayloadForFirestore sanitizes legacy records and long Bengali strings across all subcollections', () => {
  const longBn = 'অতিরিক্ত কাজের নোট এবং বিস্তারিত বিবরণ '.repeat(12);

  const ot = normalizeSubcollectionPayloadForFirestore('overtime', {
    id: 'ot_1',
    userId: 'u_1',
    date: 'invalid-date',
    divisorSnapshot: 0,
    multiplierSnapshot: -2,
    notes: longBn,
  });
  assert.equal('id' in ot, false);
  assert.equal('userId' in ot, false);
  assert.match(String(ot.date), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(String(ot.month), /^\d{4}-\d{2}$/);
  assert.equal(ot.divisorSnapshot, 208);
  assert.equal(ot.multiplierSnapshot, 2);
  assert.ok(utf8ByteLength(String(ot.notes)) <= 300);

  const wp = normalizeSubcollectionPayloadForFirestore('workplaces', {
    factoryName: '   ',
    shiftPattern: '' as unknown as string, // empty invalid enum
    department: longBn,
    isCurrent: true,
  });
  assert.equal(wp.factoryName, 'Garment Factory');
  assert.equal('shiftPattern' in wp, false);
  assert.ok(utf8ByteLength(String(wp.department)) <= 100);

  const exp = normalizeSubcollectionPayloadForFirestore('expenses', {
    category: 'unknown_cat',
    amount: -99,
    description: longBn,
  });
  assert.equal(exp.category, 'other');
  assert.equal(exp.amount, 0);
  assert.ok(utf8ByteLength(String(exp.description)) <= 250);
});

test('resolveBestUserDisplayName and mergeUserDirectories prefer real Google/profile names over শ্রমিক ব্যবহারকারী and email prefixes', () => {
  // When fbProfile had default placeholder 'শ্রমিক ব্যবহারকারী', real Google displayName wins
  assert.equal(
    resolveBestUserDisplayName(
      ['শ্রমিক ব্যবহারকারী', 'Aisha Mukta', 'aishamukta000'],
      'aishamukta000@gmail.com'
    ),
    'Aisha Mukta'
  );

  // When directory has email prefix 'aishamukta000' and /users profile has 'আয়েশা মুক্তা', merging picks the real name
  const dirEntry = mapFirestoreUserDirectoryDoc(
    'uid_aisha',
    {
      uid: 'uid_aisha',
      displayName: 'aishamukta000',
      email: 'aishamukta000@gmail.com',
      authProvider: 'google.com',
      emailVerified: true,
      registeredAt: '2026-11-17',
      lastSeenDate: '2026-11-17',
    },
    '2026-11-17'
  );
  const profileEntry = mapWorkerProfileDocToDirectoryEntry(
    'uid_aisha',
    {
      userId: 'uid_aisha',
      fullName: 'আয়েশা মুক্তা',
      joiningDate: '2026-11-17',
    },
    '2026-11-17'
  );

  const merged = mergeUserDirectories([dirEntry], [profileEntry], { firestoreConnected: true });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].uid, 'uid_aisha');
  assert.equal(merged[0].displayName, 'আয়েশা মুক্তা');
  assert.equal(merged[0].email, 'aishamukta000@gmail.com');
  assert.equal(merged[0].authProvider, 'google.com');
});

