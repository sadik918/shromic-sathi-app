import type { Language } from '../types';
import type { AdminRole, AdminUserDirectoryEntry } from './adminLogic';
import { computeBstComponentsFromUtcMs, getAccurateBstNow } from './networkTime';

export const PRIMARY_SUPER_ADMIN_EMAIL = 'sadikulislam45974@gmail.com';
export const SHROMIK_SATHI_APP_VERSION = '2.4.0';

const utf8Encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export function utf8ByteLength(input: string): number {
  if (utf8Encoder) {
    return utf8Encoder.encode(input).length;
  }
  let bytes = 0;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/**
 * Truncates a string so its UTF-8 byte length is <= maxBytes (matching Firestore Rules `.size()`),
 * without splitting UTF-16 surrogate pairs.
 */
export function truncateUtf8(val: unknown, maxBytes: number): string {
  const str = typeof val === 'string' ? val : val == null ? '' : String(val);
  if (maxBytes <= 0 || !str) return '';
  if (str.length * 3 <= maxBytes && utf8ByteLength(str) <= maxBytes) {
    return str;
  }
  if (utf8ByteLength(str) <= maxBytes) {
    return str;
  }
  let bytes = 0;
  let end = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    let charBytes = 1;
    let step = 1;
    if (code <= 0x7f) {
      charBytes = 1;
    } else if (code <= 0x7ff) {
      charBytes = 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      charBytes = 4;
      step = 2;
    } else {
      charBytes = 3;
    }
    if (bytes + charBytes > maxBytes) {
      break;
    }
    bytes += charBytes;
    end = i + step;
    if (step === 2) i += 1;
  }
  return str.slice(0, end);
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (typeof val !== 'object' || val === null) return false;
  if (Object.prototype.toString.call(val) !== '[object Object]') return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

function sanitizeNestedValue(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (Array.isArray(val)) {
    return val
      .map((item) => sanitizeNestedValue(item))
      .filter((item) => item !== undefined);
  }
  if (isPlainObject(val)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v === undefined) continue;
      const cleaned = sanitizeNestedValue(v);
      if (cleaned !== undefined) {
        out[k] = cleaned;
      }
    }
    return out;
  }
  return val;
}

/**
 * Strips `undefined` values (which throw in Firestore JS SDK) as well as document metadata
 * fields (`id`, `createdAt`, `updatedAt`, plus optional extra keys) before sending payloads to Firestore.
 * Preserves Firestore sentinel FieldValues / Timestamps / Dates cleanly.
 */
export function stripUndefinedAndMetaFields<T extends Record<string, unknown>>(
  obj: T,
  extraOmitKeys: string[] = []
): Record<string, unknown> {
  const omitSet = new Set(['id', 'createdAt', 'updatedAt', ...extraOmitKeys]);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (omitSet.has(key) || value === undefined) continue;
    const cleaned = sanitizeNestedValue(value);
    if (cleaned !== undefined) {
      result[key] = cleaned;
    }
  }
  return result;
}

export function getBstTodayISO(nowMs?: number): string {
  if (typeof nowMs === 'number' && Number.isFinite(nowMs)) {
    return computeBstComponentsFromUtcMs(nowMs).dateISO;
  }
  return getAccurateBstNow().dateISO;
}

export function isStrictAdminSession(
  user: { email?: string | null; emailVerified?: boolean } | null | undefined,
  isReadOnlyDemo = false
): boolean {
  if (isReadOnlyDemo || !user) return false;
  const email = (user.email || '').trim().toLowerCase();
  return email === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() && user.emailVerified === true;
}

export function resolveVerifiedAdminSession(params: {
  user?: { email?: string | null; emailVerified?: boolean } | null;
  isReadOnlyDemo?: boolean;
  hasAdminsDoc?: boolean;
}): boolean {
  const { user, isReadOnlyDemo = false, hasAdminsDoc = false } = params;
  if (isReadOnlyDemo || !user) return false;
  const email = (user.email || '').trim().toLowerCase();
  if (email === 'demo@therate.gmail.com') return false;
  if (isStrictAdminSession(user, isReadOnlyDemo)) return true;
  return Boolean(hasAdminsDoc && user.emailVerified === true);
}

export function resolveAuthProvider(
  providerData?: Array<{ providerId?: string | null }> | null
): 'google.com' | 'password' {
  if (Array.isArray(providerData)) {
    for (const p of providerData) {
      if (p?.providerId === 'google.com') return 'google.com';
    }
  }
  return 'password';
}

export function extractTimestampMillis(val: unknown): number | undefined {
  if (!val) return undefined;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val.getTime();
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (typeof val === 'object' && val !== null) {
    const maybeTs = val as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof maybeTs.toMillis === 'function') {
      try {
        const ms = maybeTs.toMillis();
        if (Number.isFinite(ms)) return ms;
      } catch {
        // fallback to toDate/seconds
      }
    }
    if (typeof maybeTs.toDate === 'function') {
      try {
        const ms = maybeTs.toDate().getTime();
        if (!Number.isNaN(ms)) return ms;
      } catch {
        return undefined;
      }
    }
    const secs =
      typeof maybeTs.seconds === 'number'
        ? maybeTs.seconds
        : typeof maybeTs._seconds === 'number'
        ? maybeTs._seconds
        : undefined;
    if (secs !== undefined && Number.isFinite(secs)) {
      return secs * 1000;
    }
  }
  return undefined;
}

/**
 * Converts a Firestore Timestamp, Date, or datetime string into an Asia/Dhaka (UTC+6)
 * YYYY-MM-DD calendar date. Plain date-only strings (`YYYY-MM-DD`) are preserved directly.
 */
export function mapFirestoreTimestampOrStringToDateISO(
  val: unknown,
  fallbackISO: string
): string {
  if (!val) return fallbackISO;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallbackISO;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return computeBstComponentsFromUtcMs(parsed).dateISO;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    return fallbackISO;
  }
  const ms = extractTimestampMillis(val);
  if (ms !== undefined) {
    return computeBstComponentsFromUtcMs(ms).dateISO;
  }
  return fallbackISO;
}

export interface AuthUserSummaryForDirectory {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  providerData?: Array<{ providerId?: string | null }>;
  metadata?: { creationTime?: string | null };
}

/**
 * Builds rule-compliant create or update payloads for `/userDirectory/{uid}`.
 * Keeps financial fields strictly excluded and never injects forbidden keys (`suspensionReason` on create,
 * or `accountStatus`/`role` on non-admin owner update).
 */
export function buildUserDirectoryCreatePayload(params: {
  user: AuthUserSummaryForDirectory;
  displayName?: string;
  language: Language;
  todayISO: string;
  offlineSyncState?: 'synced' | 'pending' | 'error';
}): Record<string, unknown> {
  const { user, displayName, language, todayISO, offlineSyncState = 'synced' } = params;
  const fallbackName =
    (displayName || '').trim() ||
    (user.displayName || '').trim() ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Garment Worker';
  const safeDisplayName = truncateUtf8(fallbackName, 120) || 'Garment Worker';
  const safeEmail = truncateUtf8((user.email || '').trim(), 150);
  const registeredAt = truncateUtf8(
    mapFirestoreTimestampOrStringToDateISO(user.metadata?.creationTime, todayISO),
    25
  );

  return {
    uid: user.uid,
    displayName: safeDisplayName,
    email: safeEmail,
    registeredAt,
    lastSeenDate: truncateUtf8(todayISO, 25),
    accountStatus: 'active',
    role: 'user',
    authProvider: resolveAuthProvider(user.providerData),
    language,
    emailVerified: Boolean(user.emailVerified),
    offlineSyncState,
    appVersion: truncateUtf8(SHROMIK_SATHI_APP_VERSION, 40),
  };
}

export function buildUserDirectoryOwnerUpdatePayload(params: {
  user: AuthUserSummaryForDirectory;
  displayName?: string;
  existingDisplayName?: string;
  language: Language;
  todayISO: string;
  offlineSyncState?: 'synced' | 'pending' | 'error';
}): Record<string, unknown> {
  const {
    user,
    displayName,
    existingDisplayName,
    language,
    todayISO,
    offlineSyncState = 'synced',
  } = params;
  const fallbackName =
    (displayName || '').trim() ||
    (user.displayName || '').trim() ||
    (existingDisplayName || '').trim() ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Garment Worker';

  return {
    displayName: truncateUtf8(fallbackName, 120) || 'Garment Worker',
    email: truncateUtf8((user.email || '').trim(), 150),
    lastSeenDate: truncateUtf8(todayISO, 25),
    authProvider: resolveAuthProvider(user.providerData),
    language,
    emailVerified: Boolean(user.emailVerified),
    offlineSyncState,
    appVersion: truncateUtf8(SHROMIK_SATHI_APP_VERSION, 40),
  };
}

export function mapFirestoreUserDirectoryDoc(
  docId: string,
  data: Record<string, unknown>,
  fallbackDateISO: string
): AdminUserDirectoryEntry {
  const uid =
    typeof data.uid === 'string' && data.uid.trim().length > 0 ? data.uid.trim() : docId;
  const registeredAt = mapFirestoreTimestampOrStringToDateISO(
    data.registeredAt ?? data.createdAt,
    fallbackDateISO
  );
  const lastSeenDate = mapFirestoreTimestampOrStringToDateISO(
    data.lastSeenDate ?? data.updatedAt,
    registeredAt
  );
  const displayName =
    typeof data.displayName === 'string' && data.displayName.trim().length > 0
      ? data.displayName.trim()
      : typeof data.email === 'string' && data.email.includes('@')
      ? data.email.split('@')[0]
      : 'Garment Worker';

  const accountStatus: 'active' | 'suspended' =
    data.accountStatus === 'suspended' ? 'suspended' : 'active';
  const suspensionReason =
    typeof data.suspensionReason === 'string' && data.suspensionReason.trim().length > 0
      ? data.suspensionReason.trim()
      : undefined;

  const validRoles = new Set(['user', 'support_moderator', 'admin', 'super_admin']);
  const role =
    typeof data.role === 'string' && validRoles.has(data.role)
      ? (data.role as 'user' | AdminRole)
      : undefined;

  const createdAtMs =
    extractTimestampMillis(data.createdAt) ?? extractTimestampMillis(data.registeredAt);

  return {
    uid,
    displayName,
    email: typeof data.email === 'string' ? data.email : '',
    accountStatus,
    emailVerified: Boolean(data.emailVerified),
    registeredAt,
    lastSeenDate,
    authProvider: data.authProvider === 'google.com' ? 'google.com' : 'password',
    language: data.language === 'en' ? 'en' : 'bn',
    offlineSyncState:
      data.offlineSyncState === 'pending' || data.offlineSyncState === 'error'
        ? data.offlineSyncState
        : 'synced',
    appVersion:
      typeof data.appVersion === 'string' && data.appVersion.trim().length > 0
        ? data.appVersion
        : SHROMIK_SATHI_APP_VERSION,
    ...(role ? { role } : {}),
    ...(createdAtMs !== undefined ? { createdAtMs } : {}),
    suspensionReason,
    statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
  };
}

export function isDemoSeedUserId(uid: string): boolean {
  return uid.startsWith('usr_rmg_');
}

export function mergeUserDirectories(
  firestoreUsers: AdminUserDirectoryEntry[],
  existingUsers: AdminUserDirectoryEntry[],
  options: { firestoreConnected: boolean }
): AdminUserDirectoryEntry[] {
  const map = new Map<string, AdminUserDirectoryEntry>();

  for (const existing of existingUsers) {
    if (!existing?.uid) continue;
    // Drop synthetic local mock seeds once Firestore is live
    if (options.firestoreConnected && isDemoSeedUserId(existing.uid)) {
      continue;
    }
    map.set(existing.uid, existing);
  }

  for (const remote of firestoreUsers) {
    if (!remote?.uid) continue;
    const prev = map.get(remote.uid);
    map.set(remote.uid, {
      ...remote,
      role: remote.role ?? prev?.role,
      createdAtMs: remote.createdAtMs ?? prev?.createdAtMs,
      statusHistory:
        remote.statusHistory && remote.statusHistory.length > 0
          ? remote.statusHistory
          : prev?.statusHistory || [],
      suspendedAt: prev?.suspendedAt,
      suspendedBy: prev?.suspendedBy,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const regCmp = (b.registeredAt || '').localeCompare(a.registeredAt || '');
    if (regCmp !== 0) return regCmp;
    const tsCmp = (b.createdAtMs || 0) - (a.createdAtMs || 0);
    if (tsCmp !== 0) return tsCmp;
    const seenCmp = (b.lastSeenDate || '').localeCompare(a.lastSeenDate || '');
    if (seenCmp !== 0) return seenCmp;
    return a.displayName.localeCompare(b.displayName);
  });
}

export function extractAvailableRegistrationMonths(
  users: AdminUserDirectoryEntry[],
  currentMonthISO: string
): string[] {
  const months = new Set<string>();
  if (/^\d{4}-\d{2}$/.test(currentMonthISO)) {
    months.add(currentMonthISO);
  }
  for (const u of users) {
    const m = (u.registeredAt || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(m)) {
      months.add(m);
    }
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

export function mapFirebaseAuthError(err: unknown, lang: Language): string {
  const code = String((err as { code?: unknown })?.code || '');
  const message = String((err as { message?: unknown })?.message || '');

  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return lang === 'bn'
      ? 'ইমেইল বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।'
      : 'Incorrect email or password. Please try again.';
  }
  if (code === 'auth/user-not-found') {
    return lang === 'bn'
      ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট তৈরি করুন।'
      : 'No account found with this email. Please create a new account.';
  }
  if (code === 'auth/email-already-in-use') {
    return lang === 'bn'
      ? 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট তৈরি করা হয়েছে। অনুগ্রহ করে লগইন করুন।'
      : 'This email is already registered. Please sign in instead.';
  }
  if (code === 'auth/weak-password') {
    return lang === 'bn'
      ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
      : 'Password must be at least 6 characters.';
  }
  if (code === 'auth/invalid-email') {
    return lang === 'bn'
      ? 'সঠিক ইমেইল ঠিকানা লিখুন।'
      : 'Please enter a valid email address.';
  }
  if (code === 'auth/too-many-requests') {
    return lang === 'bn'
      ? 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
      : 'Too many failed attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed' || message.includes('offline')) {
    return lang === 'bn'
      ? 'ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। নেটওয়ার্ক চালু করে আবার চেষ্টা করুন।'
      : 'Network error or offline. Please check your internet connection and try again.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return lang === 'bn'
      ? 'Google সাইন-ইন পপআপ বন্ধ করা হয়েছে। আবার চেষ্টা করুন।'
      : 'Google sign-in popup was closed. Please try again.';
  }
  if (code === 'auth/popup-blocked') {
    return lang === 'bn'
      ? 'ব্রাউজার পপআপ ব্লক করেছে। পপআপ অনুমতি দিয়ে আবার চেষ্টা করুন।'
      : 'Browser blocked the sign-in popup. Please allow popups and try again.';
  }
  if (code === 'auth/operation-not-allowed') {
    return lang === 'bn'
      ? 'ইমেইল/পাসওয়ার্ড সাইন-ইন সক্রিয় নেই। Google দিয়ে সাইন-ইন করুন অথবা Firebase Console থেকে Email/Password চালু করুন।'
      : 'Email/Password sign-in is not enabled. Use Google Sign-In or enable Email/Password in Firebase Console.';
  }

  return lang === 'bn'
    ? 'লগইন বা রেজিস্ট্রেশন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।'
    : 'Authentication failed. Please try again.';
}

export function isOfflineOrTransientFirestoreError(err: unknown): boolean {
  const code = String((err as { code?: unknown })?.code || '').toLowerCase();
  const msg = String((err as { message?: unknown })?.message || '').toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted' ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout')
  );
}

export interface ClassifiedFirestoreReadError {
  category: 'permission_denied' | 'offline_unavailable' | 'precondition' | 'unknown';
  code: string;
  retryable: boolean;
  messageBn: string;
  messageEn: string;
}

export function classifyFirestoreReadError(err: unknown): ClassifiedFirestoreReadError {
  const rawCode = String((err as { code?: unknown })?.code || '').trim();
  const code = rawCode.toLowerCase();
  const msg = String((err as { message?: unknown })?.message || '').toLowerCase();

  if (code.includes('permission-denied') || msg.includes('missing or insufficient permissions')) {
    return {
      category: 'permission_denied',
      code: rawCode || 'permission-denied',
      retryable: false,
      messageBn:
        'অ্যাডমিন অনুমতি যাচাই ব্যর্থ হয়েছে (permission-denied)। অনুগ্রহ করে ভেরিফাইড অ্যাডমিন অ্যাকাউন্ট দিয়ে পুনরায় লগইন করুন।',
      messageEn:
        'Admin permission check failed (permission-denied). Please sign in with a verified admin account.',
    };
  }

  if (isOfflineOrTransientFirestoreError(err)) {
    return {
      category: 'offline_unavailable',
      code: rawCode || 'unavailable',
      retryable: true,
      messageBn:
        'সার্ভার সংযোগ পাওয়া যাচ্ছে না বা আপনি অফলাইনে আছেন। ক্যাশ করা তালিকা দেখানো হচ্ছে; সংযোগ ফিরে এলে রিফ্রেশ করুন।',
      messageEn:
        'Firestore server is currently unreachable or offline. Cached directory may be shown; please retry when online.',
    };
  }

  if (code.includes('failed-precondition') || code.includes('invalid-argument')) {
    return {
      category: 'precondition',
      code: rawCode || 'failed-precondition',
      retryable: true,
      messageBn: `ফায়ারবেস কোয়েরি শর্ত পূর্ণ হয়নি (${rawCode || 'failed-precondition'})। পুনরায় চেষ্টা করুন।`,
      messageEn: `Firestore query precondition failed (${rawCode || 'failed-precondition'}). Please retry.`,
    };
  }

  return {
    category: 'unknown',
    code: rawCode || 'unknown',
    retryable: true,
    messageBn: `ফায়ারবেস থেকে ইউজার তালিকা লোড করা যায়নি (${rawCode || 'unknown'})। অনুগ্রহ করে রিফ্রেশ করুন।`,
    messageEn: `Failed to load user directory from Firestore (${rawCode || 'unknown'}). Please retry.`,
  };
}

const VALID_EMPLOYMENT_TYPES = new Set([
  'permanent',
  'probation',
  'contractual',
  'piece_rate',
  'helper',
]);
const VALID_SHIFT_PATTERNS = new Set(['day', 'night', 'weekly_rotation', 'general']);
const VALID_WEEKDAYS = new Set([
  'friday',
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
]);
const VALID_LOAN_FREQUENCIES = new Set(['lump_sum', 'weekly', 'monthly', 'custom']);
const VALID_LOAN_STATUSES = new Set([
  'pending',
  'partially_repaid',
  'fully_settled',
  'overdue',
  'due_today',
  'archived',
]);

function clampNonNegNumber(val: unknown, fallback = 0, max = 50000000): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

/**
 * Ensures any WorkerProfile object (including legacy cached mirrors) satisfies
 * `/users/{uid}` Firestore Security Rules field types, enums, and bounds.
 */
export function normalizeWorkerProfileForFirestore(
  raw: Record<string, unknown>,
  uid: string,
  fallbackDisplayName?: string | null
): Record<string, unknown> {
  const cleaned = stripUndefinedAndMetaFields(raw, ['userId']);
  const todayISO = getBstTodayISO();
  const fullNameRaw = String(cleaned.fullName || fallbackDisplayName || 'শ্রমিক ব্যবহারকারী').trim();
  const fullName = truncateUtf8(fullNameRaw || 'শ্রমিক ব্যবহারকারী', 120) || 'Worker';

  const empTypeRaw = String(cleaned.employmentType || 'permanent');
  const employmentType = VALID_EMPLOYMENT_TYPES.has(empTypeRaw) ? empTypeRaw : 'permanent';

  const otWageBase = cleaned.otWageBase === 'gross' ? 'gross' : 'basic';
  const rawDivisor = Number(cleaned.otDivisor);
  const otDivisor = Number.isFinite(rawDivisor) && rawDivisor > 0 && rawDivisor <= 1000 ? rawDivisor : 208;
  const rawMult = Number(cleaned.otMultiplier);
  const otMultiplier = Number.isFinite(rawMult) && rawMult > 0 && rawMult <= 10 ? rawMult : 2;
  const otCalculationMode = cleaned.otCalculationMode === 'manual' ? 'manual' : 'formula';

  const shiftRaw = String(cleaned.shiftPattern || 'day');
  const shiftPattern = VALID_SHIFT_PATTERNS.has(shiftRaw) ? shiftRaw : 'day';
  const weekdayRaw = String(cleaned.weeklyHolidayDay || 'friday');
  const weeklyHolidayDay = VALID_WEEKDAYS.has(weekdayRaw) ? weekdayRaw : 'friday';

  const payDayRaw = Number(cleaned.expectedPayDay);
  const expectedPayDay =
    Number.isFinite(payDayRaw) && payDayRaw >= 1 && payDayRaw <= 31 ? Math.round(payDayRaw) : 7;

  const openingRaw = Number(cleaned.openingCashBalance);
  const openingCashBalance =
    cleaned.openingCashBalance !== undefined && Number.isFinite(openingRaw)
      ? Math.max(-5000000, Math.min(50000000, openingRaw))
      : undefined;

  const out: Record<string, unknown> = {
    fullName,
    photoUrl: truncateUtf8(cleaned.photoUrl || '', 450000),
    phone: truncateUtf8(cleaned.phone || '', 30),
    address: truncateUtf8(cleaned.address || '', 300),
    emergencyContact: truncateUtf8(cleaned.emergencyContact || '', 120),
    factoryName: truncateUtf8(cleaned.factoryName || '', 150),
    factoryBranch: truncateUtf8(cleaned.factoryBranch || '', 120),
    department: truncateUtf8(cleaned.department || '', 100),
    designation: truncateUtf8(cleaned.designation || '', 100),
    employeeId: truncateUtf8(cleaned.employeeId || '', 60),
    employmentType,
    joiningDate: truncateUtf8(cleaned.joiningDate || todayISO, 35),
    salaryGrade: truncateUtf8(cleaned.salaryGrade || '', 40),
    basicSalary: clampNonNegNumber(cleaned.basicSalary, 0, 1000000),
    houseRentAllowance: clampNonNegNumber(cleaned.houseRentAllowance, 0, 1000000),
    medicalAllowance: clampNonNegNumber(cleaned.medicalAllowance, 0, 500000),
    transportAllowance: clampNonNegNumber(cleaned.transportAllowance, 0, 500000),
    foodAllowance: clampNonNegNumber(cleaned.foodAllowance, 0, 500000),
    attendanceBonus: clampNonNegNumber(cleaned.attendanceBonus, 0, 500000),
    hasAttendanceBonus: Boolean(cleaned.hasAttendanceBonus),
    attendanceBonusAmount: clampNonNegNumber(cleaned.attendanceBonusAmount ?? cleaned.attendanceBonus, 0, 500000),
    attendanceBonusDays: clampNonNegNumber(cleaned.attendanceBonusDays ?? 30, 30, 31),
    maxConsecutiveAbsences: clampNonNegNumber(cleaned.maxConsecutiveAbsences ?? 0, 0, 31),
    bonusCutoffTimeEnabled: Boolean(cleaned.bonusCutoffTimeEnabled),
    latePenaltyEnabled: Boolean(cleaned.latePenaltyEnabled),
    maxLateDaysForBonus: clampNonNegNumber(cleaned.maxLateDaysForBonus ?? 3, 3, 31),
    grossSalary: clampNonNegNumber(cleaned.grossSalary, 0, 5000000),
    otWageBase,
    otDivisor,
    otMultiplier,
    otCalculationMode,
    otCustomHourlyRate: clampNonNegNumber(cleaned.otCustomHourlyRate, 0, 100000),
    shiftPattern,
    dayShiftStartTime: truncateUtf8(cleaned.dayShiftStartTime || '08:00', 10),
    nightShiftStartTime: truncateUtf8(cleaned.nightShiftStartTime || '20:00', 10),
    rotationStartDate: truncateUtf8(cleaned.rotationStartDate || '2026-10-01', 35),
    attendanceWindowStartDay: truncateUtf8(cleaned.attendanceWindowStartDay || '07:50', 10),
    attendanceWindowEndDay: truncateUtf8(cleaned.attendanceWindowEndDay || '08:05', 10),
    attendanceWindowStartNight: truncateUtf8(cleaned.attendanceWindowStartNight || '19:50', 10),
    attendanceWindowEndNight: truncateUtf8(cleaned.attendanceWindowEndNight || '20:05', 10),
    dayBonusCutoffTime: truncateUtf8(cleaned.dayBonusCutoffTime || '08:05', 10),
    nightBonusCutoffTime: truncateUtf8(cleaned.nightBonusCutoffTime || '20:05', 10),
    weeklyHolidayDay,
    expectedPayDay,
    monthlyBudgetTarget: clampNonNegNumber(cleaned.monthlyBudgetTarget, 0, 5000000),
    effectiveFrom: truncateUtf8(cleaned.effectiveFrom || `${todayISO.slice(0, 7)}-01`, 35),
    language: cleaned.language === 'en' ? 'en' : 'bn',
    privacyConsent: cleaned.privacyConsent === undefined ? true : Boolean(cleaned.privacyConsent),
  };

  if (openingCashBalance !== undefined) {
    out.openingCashBalance = openingCashBalance;
  }

  // Validate uid strictly as non-empty string if caller uses it on create
  if (!uid) {
    return out;
  }
  return out;
}

/**
 * Ensures any PersonalLoan payload (including sample seeds and legacy cached items)
 * satisfies `/users/{uid}/loans/{loanId}` Firestore Security Rules.
 */
export function normalizeLoanPayloadForFirestore(raw: Record<string, unknown>): Record<string, unknown> {
  const cleaned = stripUndefinedAndMetaFields(raw, ['userId']);
  const totalLoanAmount = clampNonNegNumber(
    cleaned.totalLoanAmount ?? cleaned.originalAmount,
    0,
    50000000
  );
  const originalAmount = clampNonNegNumber(
    cleaned.originalAmount ?? totalLoanAmount,
    0,
    50000000
  );
  const paidAmount = clampNonNegNumber(cleaned.paidAmount, 0, 50000000);
  const monthlyInstallment = clampNonNegNumber(
    cleaned.monthlyInstallment ?? cleaned.installmentAmount,
    0,
    5000000
  );

  const titleRaw = String(cleaned.title || cleaned.personName || 'ধার-দেনা').trim();
  const title = truncateUtf8(titleRaw || 'ধার-দেনা', 150) || 'Loan';
  const lenderType = truncateUtf8(cleaned.lenderType || 'person', 30) || 'person';
  const nextDueDate = truncateUtf8(cleaned.nextDueDate || cleaned.expectedRepaymentDate || '', 20);
  const notes = truncateUtf8(cleaned.notes || cleaned.reason || '', 300);

  const out: Record<string, unknown> = {
    title,
    lenderType,
    totalLoanAmount,
    paidAmount,
    monthlyInstallment,
    nextDueDate,
    notes,
  };

  if (cleaned.personName !== undefined) {
    out.personName = truncateUtf8(cleaned.personName, 100);
  }
  if (cleaned.contactNumber !== undefined) {
    out.contactNumber = truncateUtf8(cleaned.contactNumber, 30);
  }
  if (cleaned.direction === 'lent' || cleaned.direction === 'borrowed') {
    out.direction = cleaned.direction;
  }
  if (cleaned.originalAmount !== undefined) {
    out.originalAmount = originalAmount;
  }
  if (cleaned.transactionDate !== undefined) {
    out.transactionDate = truncateUtf8(cleaned.transactionDate, 20);
  }
  if (cleaned.expectedRepaymentDate !== undefined) {
    out.expectedRepaymentDate = truncateUtf8(cleaned.expectedRepaymentDate, 20);
  }
  if (cleaned.reason !== undefined) {
    out.reason = truncateUtf8(cleaned.reason, 300);
  }
  if (cleaned.repaymentArrangement !== undefined) {
    out.repaymentArrangement = truncateUtf8(cleaned.repaymentArrangement, 250);
  }
  if (cleaned.installmentAmount !== undefined) {
    out.installmentAmount = clampNonNegNumber(cleaned.installmentAmount, 0, 5000000);
  }
  if (
    typeof cleaned.repaymentFrequency === 'string' &&
    VALID_LOAN_FREQUENCIES.has(cleaned.repaymentFrequency)
  ) {
    out.repaymentFrequency = cleaned.repaymentFrequency;
  }
  if (cleaned.nextInstallmentDate !== undefined) {
    out.nextInstallmentDate = truncateUtf8(cleaned.nextInstallmentDate, 20);
  }
  if (cleaned.reminderEnabled !== undefined) {
    out.reminderEnabled = Boolean(cleaned.reminderEnabled);
  }
  if (typeof cleaned.status === 'string' && VALID_LOAN_STATUSES.has(cleaned.status)) {
    out.status = cleaned.status;
  }
  if (Array.isArray(cleaned.repayments)) {
    out.repayments = cleaned.repayments.slice(0, 500);
  }
  if (cleaned.isArchived !== undefined) {
    out.isArchived = Boolean(cleaned.isArchived);
  }

  return out;
}

const VALID_PAYMENT_METHODS = new Set(['cash', 'bkash', 'nagad', 'rocket', 'bank']);
const VALID_ATTENDANCE_STATUSES = new Set([
  'present',
  'absent',
  'weekly_holiday',
  'public_holiday',
  'approved_leave',
  'late',
]);
const VALID_LEAVE_CATEGORIES = new Set([
  'none',
  'casual',
  'sick',
  'earned',
  'maternity',
  'festival',
  'unpaid',
]);
const VALID_EXPENSE_CATEGORIES = new Set([
  'food',
  'rent',
  'transport',
  'family',
  'medical',
  'education',
  'other',
]);
const VALID_DOC_CATEGORIES = new Set([
  'id_card',
  'appointment_letter',
  'payslip',
  'increment_letter',
  'leave_approval',
  'other',
]);
const VALID_REMINDER_CATEGORIES = new Set([
  'salary_date',
  'bill_payment',
  'monthly_review',
  'other',
]);
const VALID_CONTACT_CATEGORIES = new Set([
  'supervisor',
  'line_chief',
  'production_manager',
  'hr_admin',
  'security',
  'coworker',
  'emergency',
  'other',
  'google',
]);
const VALID_ALARM_TONES = new Set([
  'factory_siren',
  'digital_beep',
  'gentle_chime',
  'morning_bell',
  'custom_device',
]);

function coerceDateISO(val: unknown, fallbackISO: string): string {
  const s = typeof val === 'string' ? val.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallbackISO;
}

function coerceMonthISO(val: unknown, dateISO: string): string {
  const s = typeof val === 'string' ? val.trim() : '';
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return dateISO.slice(0, 7);
}

function clampFiniteNumber(val: unknown, fallback = 0, min = -50000000, max = 50000000): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export type SubcollectionName =
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
  | 'contacts'
  | 'alarms';

/**
 * Normalizes any user subcollection document before writing to Cloud Firestore so legacy/cached
 * records and Bengali inputs always adhere to `firestore.rules` required keys, `hasOnly`, enums,
 * numeric bounds, and UTF-8 byte lengths.
 */
export function normalizeSubcollectionPayloadForFirestore(
  colName: SubcollectionName,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const cleaned = stripUndefinedAndMetaFields(raw, ['userId']);
  const todayISO = getBstTodayISO();

  switch (colName) {
    case 'overtime': {
      const date = coerceDateISO(cleaned.date, todayISO);
      const month = coerceMonthISO(cleaned.month, date);
      const divRaw = Number(cleaned.divisorSnapshot);
      const multRaw = Number(cleaned.multiplierSnapshot);
      return {
        date,
        month,
        startTime: truncateUtf8(cleaned.startTime || '17:00', 10),
        endTime: truncateUtf8(cleaned.endTime || '19:00', 10),
        breakMinutes: clampNonNegNumber(cleaned.breakMinutes, 0, 720),
        totalMinutes: clampNonNegNumber(cleaned.totalMinutes, 0, 1440),
        approvedHours: clampNonNegNumber(cleaned.approvedHours, 0, 24),
        basicSalarySnapshot: clampNonNegNumber(cleaned.basicSalarySnapshot, 0, 5000000),
        divisorSnapshot: Number.isFinite(divRaw) && divRaw > 0 ? divRaw : 208,
        multiplierSnapshot: Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 2,
        hourlyRateSnapshot: clampNonNegNumber(cleaned.hourlyRateSnapshot, 0, 500000),
        estimatedEarnings: clampNonNegNumber(cleaned.estimatedEarnings, 0, 5000000),
        notes: truncateUtf8(cleaned.notes || '', 300),
      };
    }

    case 'salaryRecords': {
      const month = coerceMonthISO(cleaned.month, todayISO);
      return {
        month,
        effectiveDate: truncateUtf8(cleaned.effectiveDate || `${month}-01`, 20),
        basicSalary: clampNonNegNumber(cleaned.basicSalary, 0),
        houseRentAllowance: clampNonNegNumber(cleaned.houseRentAllowance, 0),
        medicalAllowance: clampNonNegNumber(cleaned.medicalAllowance, 0),
        transportAllowance: clampNonNegNumber(cleaned.transportAllowance, 0),
        foodAllowance: clampNonNegNumber(cleaned.foodAllowance, 0),
        attendanceBonus: clampNonNegNumber(cleaned.attendanceBonus, 0),
        overtimeHours: clampNonNegNumber(cleaned.overtimeHours, 0),
        overtimeEarnings: clampNonNegNumber(cleaned.overtimeEarnings, 0),
        festivalBonus: clampNonNegNumber(cleaned.festivalBonus, 0),
        otherAllowances: clampNonNegNumber(cleaned.otherAllowances, 0),
        advanceDeduction: clampNonNegNumber(cleaned.advanceDeduction, 0),
        absenceDeduction: clampNonNegNumber(cleaned.absenceDeduction, 0),
        otherDeductions: clampNonNegNumber(cleaned.otherDeductions, 0),
        adjustments: clampFiniteNumber(cleaned.adjustments, 0),
        estimatedGross: clampNonNegNumber(cleaned.estimatedGross, 0),
        estimatedNetPayable: clampFiniteNumber(cleaned.estimatedNetPayable, 0),
        notes: truncateUtf8(cleaned.notes || '', 400),
      };
    }

    case 'payments': {
      const paymentDate = truncateUtf8(cleaned.paymentDate || todayISO, 15);
      const month = coerceMonthISO(cleaned.month, coerceDateISO(paymentDate, todayISO));
      const methodRaw = String(cleaned.paymentMethod || 'cash');
      return {
        month,
        paymentDate,
        amountReceived: clampNonNegNumber(cleaned.amountReceived, 0, 5000000),
        paymentMethod: VALID_PAYMENT_METHODS.has(methodRaw) ? methodRaw : 'cash',
        isPartial: Boolean(cleaned.isPartial),
        referenceNote: truncateUtf8(cleaned.referenceNote || '', 300),
      };
    }

    case 'attendance': {
      const date = coerceDateISO(cleaned.date, todayISO);
      const month = coerceMonthISO(cleaned.month, date);
      const statusRaw = String(cleaned.status || 'present');
      const leaveRaw = String(cleaned.leaveCategory || 'none');
      const out: Record<string, unknown> = {
        date,
        month,
        status: VALID_ATTENDANCE_STATUSES.has(statusRaw) ? statusRaw : 'present',
        leaveCategory: VALID_LEAVE_CATEGORIES.has(leaveRaw) ? leaveRaw : 'none',
        checkIn: truncateUtf8(cleaned.checkIn || '', 10),
        checkOut: truncateUtf8(cleaned.checkOut || '', 10),
        notes: truncateUtf8(cleaned.notes || '', 300),
      };
      if (typeof cleaned.hasAttendanceBonus === 'boolean') {
        out.hasAttendanceBonus = cleaned.hasAttendanceBonus;
      }
      return out;
    }

    case 'expenses': {
      const date = coerceDateISO(cleaned.date, todayISO);
      const month = coerceMonthISO(cleaned.month, date);
      const catRaw = String(cleaned.category || 'other');
      return {
        date,
        month,
        category: VALID_EXPENSE_CATEGORIES.has(catRaw) ? catRaw : 'other',
        amount: clampNonNegNumber(cleaned.amount, 0, 5000000),
        description: truncateUtf8(cleaned.description || '', 250),
      };
    }

    case 'savings': {
      const out: Record<string, unknown> = {
        title: truncateUtf8(String(cleaned.title || '').trim() || 'Savings Goal', 120) || 'Savings',
        targetAmount: clampNonNegNumber(cleaned.targetAmount, 0, 50000000),
        savedAmount: clampNonNegNumber(cleaned.savedAmount, 0, 50000000),
        monthlyBudget: clampNonNegNumber(cleaned.monthlyBudget, 0, 5000000),
        deadline: truncateUtf8(cleaned.deadline || '', 20),
        notes: truncateUtf8(cleaned.notes || '', 250),
      };
      if (typeof cleaned.storageLocation === 'string' && cleaned.storageLocation.trim()) {
        out.storageLocation = truncateUtf8(cleaned.storageLocation.trim(), 120);
      }
      if (cleaned.commissionType === 'commission' || cleaned.commissionType === 'non_commission') {
        out.commissionType = cleaned.commissionType;
      }
      if (cleaned.commissionAmount !== undefined) {
        out.commissionAmount = clampNonNegNumber(cleaned.commissionAmount, 0, 5000000);
      }
      if (cleaned.frequency === 'monthly' || cleaned.frequency === 'weekly' || cleaned.frequency === 'daily') {
        out.frequency = cleaned.frequency;
      }
      if (typeof cleaned.lastDepositDate === 'string' && cleaned.lastDepositDate.trim()) {
        out.lastDepositDate = truncateUtf8(cleaned.lastDepositDate.trim(), 20);
      }
      if (typeof cleaned.nextDueDate === 'string' && cleaned.nextDueDate.trim()) {
        out.nextDueDate = truncateUtf8(cleaned.nextDueDate.trim(), 20);
      }
      return out;
    }

    case 'documents': {
      const catRaw = String(cleaned.category || 'other');
      return {
        title: truncateUtf8(String(cleaned.title || '').trim() || 'Document', 120) || 'Document',
        category: VALID_DOC_CATEGORIES.has(catRaw) ? catRaw : 'other',
        fileName: truncateUtf8(String(cleaned.fileName || '').trim() || 'document', 150) || 'document',
        fileType: truncateUtf8(cleaned.fileType || 'application/octet-stream', 60),
        fileSize: clampNonNegNumber(cleaned.fileSize, 0, 524288),
        fileData: truncateUtf8(cleaned.fileData || '', 750000),
        issueDate: truncateUtf8(cleaned.issueDate || '', 20),
        notes: truncateUtf8(cleaned.notes || '', 300),
      };
    }

    case 'reminders': {
      const catRaw = String(cleaned.category || 'other');
      return {
        title: truncateUtf8(String(cleaned.title || '').trim() || 'Reminder', 150) || 'Reminder',
        category: VALID_REMINDER_CATEGORIES.has(catRaw) ? catRaw : 'other',
        dueDate: truncateUtf8(cleaned.dueDate || todayISO, 15),
        isCompleted: Boolean(cleaned.isCompleted),
        notes: truncateUtf8(cleaned.notes || '', 250),
      };
    }

    case 'loans':
      return normalizeLoanPayloadForFirestore(raw);

    case 'workplaces': {
      const out: Record<string, unknown> = {
        factoryName:
          truncateUtf8(String(cleaned.factoryName || '').trim() || 'Garment Factory', 150) ||
          'Factory',
        isCurrent: Boolean(cleaned.isCurrent),
      };
      if (cleaned.factoryAddress !== undefined) out.factoryAddress = truncateUtf8(cleaned.factoryAddress, 250);
      if (cleaned.factoryArea !== undefined) out.factoryArea = truncateUtf8(cleaned.factoryArea, 100);
      if (cleaned.department !== undefined) out.department = truncateUtf8(cleaned.department, 100);
      if (cleaned.floorNumber !== undefined) out.floorNumber = truncateUtf8(cleaned.floorNumber, 50);
      if (cleaned.lineNumber !== undefined) out.lineNumber = truncateUtf8(cleaned.lineNumber, 50);
      if (cleaned.designation !== undefined) out.designation = truncateUtf8(cleaned.designation, 100);
      if (cleaned.employeeId !== undefined) out.employeeId = truncateUtf8(cleaned.employeeId, 60);
      if (cleaned.supervisorName !== undefined) out.supervisorName = truncateUtf8(cleaned.supervisorName, 100);
      if (cleaned.joiningDate !== undefined) out.joiningDate = truncateUtf8(cleaned.joiningDate, 20);
      if (cleaned.leavingDate !== undefined) out.leavingDate = truncateUtf8(cleaned.leavingDate, 20);
      if (cleaned.leavingReason !== undefined) out.leavingReason = truncateUtf8(cleaned.leavingReason, 200);
      if (typeof cleaned.shiftPattern === 'string' && VALID_SHIFT_PATTERNS.has(cleaned.shiftPattern)) {
        out.shiftPattern = cleaned.shiftPattern;
      }
      if (cleaned.grossSalary !== undefined && Number.isFinite(Number(cleaned.grossSalary))) {
        out.grossSalary = clampNonNegNumber(cleaned.grossSalary, 0, 5000000);
      }
      if (cleaned.basicSalary !== undefined && Number.isFinite(Number(cleaned.basicSalary))) {
        out.basicSalary = clampNonNegNumber(cleaned.basicSalary, 0, 1000000);
      }
      if (cleaned.totalReceivedSalary !== undefined && Number.isFinite(Number(cleaned.totalReceivedSalary))) {
        out.totalReceivedSalary = clampNonNegNumber(cleaned.totalReceivedSalary, 0);
      }
      if (cleaned.totalExpectedSalary !== undefined && Number.isFinite(Number(cleaned.totalExpectedSalary))) {
        out.totalExpectedSalary = clampNonNegNumber(cleaned.totalExpectedSalary, 0);
      }
      if (cleaned.totalOvertimeHours !== undefined && Number.isFinite(Number(cleaned.totalOvertimeHours))) {
        out.totalOvertimeHours = clampNonNegNumber(cleaned.totalOvertimeHours, 0);
      }
      if (cleaned.totalOvertimeEarnings !== undefined && Number.isFinite(Number(cleaned.totalOvertimeEarnings))) {
        out.totalOvertimeEarnings = clampNonNegNumber(cleaned.totalOvertimeEarnings, 0);
      }
      if (cleaned.totalPresentDays !== undefined && Number.isFinite(Number(cleaned.totalPresentDays))) {
        out.totalPresentDays = clampNonNegNumber(cleaned.totalPresentDays, 0);
      }
      if (cleaned.totalAbsentDays !== undefined && Number.isFinite(Number(cleaned.totalAbsentDays))) {
        out.totalAbsentDays = clampNonNegNumber(cleaned.totalAbsentDays, 0);
      }
      if (cleaned.totalLeaveDays !== undefined && Number.isFinite(Number(cleaned.totalLeaveDays))) {
        out.totalLeaveDays = clampNonNegNumber(cleaned.totalLeaveDays, 0);
      }
      if (cleaned.monthsWorked !== undefined && Number.isFinite(Number(cleaned.monthsWorked))) {
        out.monthsWorked = clampNonNegNumber(cleaned.monthsWorked, 0);
      }
      if (cleaned.factoryPhone !== undefined) out.factoryPhone = truncateUtf8(cleaned.factoryPhone, 30);
      if (cleaned.notes !== undefined) out.notes = truncateUtf8(cleaned.notes, 300);
      return out;
    }

    case 'contacts': {
      const catRaw = String(cleaned.category || 'other');
      const out: Record<string, unknown> = {
        fullName:
          truncateUtf8(String(cleaned.fullName || '').trim() || 'Contact', 100) || 'Contact',
        phone: truncateUtf8(String(cleaned.phone || '').trim() || '000', 30) || '000',
        category: VALID_CONTACT_CATEGORIES.has(catRaw) ? catRaw : 'other',
        isFavorite: Boolean(cleaned.isFavorite),
        isEmergency: Boolean(cleaned.isEmergency),
      };
      if (cleaned.photoUrl !== undefined) out.photoUrl = truncateUtf8(cleaned.photoUrl, 98000);
      if (cleaned.designation !== undefined) out.designation = truncateUtf8(cleaned.designation, 100);
      if (cleaned.customCategory !== undefined) out.customCategory = truncateUtf8(cleaned.customCategory, 100);
      if (cleaned.department !== undefined) out.department = truncateUtf8(cleaned.department, 100);
      if (cleaned.lineNumber !== undefined) out.lineNumber = truncateUtf8(cleaned.lineNumber, 50);
      if (cleaned.notes !== undefined) out.notes = truncateUtf8(cleaned.notes, 300);
      if (cleaned.isPinned !== undefined) out.isPinned = Boolean(cleaned.isPinned);
      if (cleaned.source === 'google' || cleaned.source === 'manual') out.source = cleaned.source;
      if (cleaned.googleResourceName !== undefined) {
        out.googleResourceName = truncateUtf8(cleaned.googleResourceName, 200);
      }
      if (cleaned.isSyncedToGoogle !== undefined) {
        out.isSyncedToGoogle = Boolean(cleaned.isSyncedToGoogle);
      }
      return out;
    }

    case 'alarms': {
      const timeStr = truncateUtf8(String(cleaned.time || '07:00').trim(), 10);
      const toneRaw = String(cleaned.toneId || 'factory_siren');
      const out: Record<string, unknown> = {
        time: timeStr.length >= 4 ? timeStr : '07:00',
        label: truncateUtf8(String(cleaned.label || '').trim() || 'Alarm', 150) || 'Alarm',
        isEnabled: Boolean(cleaned.isEnabled),
        repeatDays: Array.isArray(cleaned.repeatDays)
          ? cleaned.repeatDays.filter((d) => typeof d === 'number' && d >= 0 && d <= 6).slice(0, 7)
          : [6, 0, 1, 2, 3, 4],
        toneId: VALID_ALARM_TONES.has(toneRaw) ? toneRaw : 'factory_siren',
      };
      if (cleaned.customToneName !== undefined) {
        out.customToneName = truncateUtf8(cleaned.customToneName, 120);
      }
      if (cleaned.customToneId !== undefined) {
        out.customToneId = truncateUtf8(cleaned.customToneId, 128);
      }
      if (cleaned.lastTriggeredDate !== undefined) {
        out.lastTriggeredDate = truncateUtf8(cleaned.lastTriggeredDate, 20);
      }
      return out;
    }
  }
}


