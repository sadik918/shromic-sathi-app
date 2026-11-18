import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseAuthProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  deleteUser,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, OperationType, type FirestoreErrorInfo } from '../firebase';
import type {
  AlarmItem,
  AttendanceRecord,
  EditHistoryEntry,
  ExpenseRecord,
  FeedbackCategory,
  GarmentWorkplace,
  Language,
  LoanRepayment,
  LoanStatus,
  OvertimeRecord,
  PersonalLoan,
  RecoverableEntityType,
  ReminderItem,
  SalaryPayment,
  SalaryRecord,
  SavingsGoal,
  SupportFeedback,
  VaultDocument,
  WorkerContact,
  WorkerProfile,
} from '../types';
import {
  DEMO_WRITE_BLOCKED_NOTICE_BN,
  createEmptyUserStore,
  getInitialDemoState,
  isDemoAccountEmail,
  loadDemoState,
  loadPublicDemoConfig,
  loadUserStore,
  PUBLIC_DEMO_EMAIL,
  recordDemoBlockedWrite,
  recordDemoSessionStart,
  resetDemoState,
  saveDemoState,
  savePublicDemoConfig,
  saveUserStore,
  validateDemoLoginAttempt,
  type DemoStoreState,
  type PublicDemoSystemConfig,
} from '../utils/demoData';
import {
  buildJobTransitionArchive,
  getCurrentMonthISO,
  getTodayISO,
  isFutureDate,
  isFutureMonth,
  isWorkerSetupCompleted,
  mergeBackupRecordsNonDestructive,
  type BackupBundle,
  type NewGarmentJobTransitionInput,
} from '../utils/calculations';
import {
  clearOfflineMutation,
  enqueueOfflineMutation,
  loadOfflineQueue,
  mergeOfflineQueues,
  reconcileCollectionWithOfflineState,
  saveOfflineQueue,
  type OfflineSyncCollection,
} from '../utils/offlineSync';
import {
  areRecordListsEquivalent,
  shouldSkipRedundantMirrorWrite,
} from '../utils/offlineReadiness';
import {
  deleteContactPhotoFromDevice,
  saveContactPhotoToDevice,
} from '../utils/deviceMediaStore';
import {
  DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG,
  DEFAULT_SUBSCRIPTION_PLANS,
  DEFAULT_COUPON_CODES,
  canAccessFeature,
  computeSubscriptionRenewalNotice,
  createDefaultExpiringSubscription,
  filterPublishedPlans,
  resolveUserActivePlan,
  validatePlanInput,
  validateCouponCode,
  type CouponCode,
  type FeatureAccessCheckResult,
  type FeatureKey,
  type GlobalSubscriptionConfig,
  type PlanFeatureRule,
  type SubscriptionAuditLog,
  type SubscriptionPaymentRequest,
  type SubscriptionPlan,
  type SubscriptionPlanTier,
  type SubscriptionRenewalNotice,
  type UserSubscriptionRecord,
} from '../utils/subscriptionLogic';
import { resolveWorkerDisplayName } from '../utils/homeAnalytics';
import {
  buildCoreRequiredWorkerProfilePayload,
  buildUserSubscriptionUpgradeMutation,
  getBstTodayISO,
  isGenericWorkerPlaceholderName,
  isOfflineOrTransientFirestoreError,
  isStrictAdminSession,
  mapFirebaseAuthError,
  normalizeLoanPayloadForFirestore,
  normalizeSubcollectionPayloadForFirestore,
  normalizeWorkerProfileForFirestore,
  resolveBestUserDisplayName,
  resolveVerifiedAdminSession,
  sanitizeFirestorePayload,
  type SubcollectionName,
} from '../utils/cloudSyncHelpers';
import { defaultUserDirectorySyncCoordinator } from '../utils/userDirectorySync';

interface DataContextValue {
  user: User | null;
  authReady: boolean;
  cloudDataLoaded: boolean;
  cloudSyncError: string;
  clearCloudSyncError: () => void;
  isDemoMode: boolean;
  isReadOnlyDemo: boolean;
  readOnlyBlockedNotice: string;
  triggerReadOnlyBlock: () => void;
  dismissReadOnlyNotice: () => void;
  publicDemoConfig: PublicDemoSystemConfig;
  updatePublicDemoConfig: (patch: Partial<PublicDemoSystemConfig>) => void;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  exitDemoToSignUp: () => void;
  initialAuthMode: 'signin' | 'signup';
  clearInitialAuthMode: () => void;
  resetDemoData: () => void;
  pendingWritesCount: number;
  offlinePendingCount: number;
  syncOfflineDataToCloud: (forceRetry?: boolean) => Promise<void>;
  todayISO: string;
  currentMonthISO: string;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
  profile: WorkerProfile;
  overtime: OvertimeRecord[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
  attendance: AttendanceRecord[];
  expenses: ExpenseRecord[];
  savings: SavingsGoal[];
  documents: VaultDocument[];
  reminders: ReminderItem[];
  loans: PersonalLoan[];
  workplaces: GarmentWorkplace[];
  contacts: WorkerContact[];
  alarms: AlarmItem[];
  editHistory: EditHistoryEntry[];
  feedbackList: SupportFeedback[];
  isAdminUser: boolean;
  loginWithGoogle: (mode?: 'signin' | 'signup') => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<void>;
  signUpWithCredentials: (fullName: string, identifier: string, password: string) => Promise<void>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  needsOnboarding: boolean;
  isManualSetupMode: boolean;
  isProfileSetupIncomplete: boolean;
  reopenOnboarding: () => void;
  completeOnboarding: (patch?: Partial<WorkerProfile>) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccountAndData: () => Promise<void>;
  updateProfile: (patch: Partial<WorkerProfile>) => Promise<void>;
  saveOvertime: (rec: Omit<OvertimeRecord, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  deleteOvertime: (id: string) => Promise<void>;
  saveSalaryRecord: (rec: Omit<SalaryRecord, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  deleteSalaryRecord: (id: string) => Promise<void>;
  savePayment: (rec: Omit<SalaryPayment, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  saveAttendance: (rec: Omit<AttendanceRecord, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  deleteAttendance: (id: string) => Promise<void>;
  saveExpense: (rec: Omit<ExpenseRecord, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  saveSavingsGoal: (rec: Omit<SavingsGoal, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
  saveVaultDocument: (rec: Omit<VaultDocument, 'id' | 'userId'>) => Promise<void>;
  deleteVaultDocument: (id: string) => Promise<void>;
  saveReminder: (rec: Omit<ReminderItem, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  toggleReminder: (id: string, isCompleted: boolean) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  saveLoan: (rec: Omit<PersonalLoan, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  payLoanInstallment: (id: string, installmentAmount?: number) => Promise<void>;
  addLoanRepayment: (loanId: string, repayment: Omit<LoanRepayment, 'id' | 'userId' | 'loanId'>) => Promise<void>;
  deleteLoanRepayment: (loanId: string, repaymentId: string) => Promise<void>;
  settleLoan: (loanId: string) => Promise<void>;
  archiveLoan: (loanId: string) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  saveWorkplace: (rec: Omit<GarmentWorkplace, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  deleteWorkplace: (id: string) => Promise<void>;
  transitionToNewGarmentJob: (input: NewGarmentJobTransitionInput) => Promise<void>;
  saveContact: (rec: Omit<WorkerContact, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  toggleFavoriteContact: (id: string, isFavorite: boolean) => Promise<void>;
  saveAlarm: (rec: Omit<AlarmItem, 'id' | 'userId'>, existingId?: string) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
  restoreDeletedRecord: (historyId: string) => Promise<boolean>;
  submitFeedback: (category: FeedbackCategory, message: string) => Promise<void>;
  resolveFeedback: (id: string) => Promise<void>;
  importBackupNonDestructive: (bundle: BackupBundle) => Promise<{ added: number; skipped: number }>;
  seedSampleDemoData: (options?: { silent?: boolean }) => Promise<{ added: number }>;
  subscriptionConfig: GlobalSubscriptionConfig;
  subscriptionPlans: SubscriptionPlan[];
  userSubscription: UserSubscriptionRecord | null;
  activePlan: SubscriptionPlan;
  isSubscriptionSystemEnabled: boolean;
  subscriptionRenewalNotice: SubscriptionRenewalNotice;
  checkFeatureAccess: (
    featureKey: FeatureKey,
    currentCount?: number,
    requireExport?: boolean,
    requireAdvanced?: boolean
  ) => FeatureAccessCheckResult;
  updateGlobalSubscriptionConfig: (patch: Partial<GlobalSubscriptionConfig>) => Promise<void>;
  saveSubscriptionPlan: (plan: SubscriptionPlan) => Promise<void>;
  deleteSubscriptionPlan: (planId: string) => Promise<void>;
  coupons: CouponCode[];
  saveCoupon: (coupon: CouponCode) => Promise<void>;
  deleteCoupon: (couponId: string) => Promise<void>;
  validateCoupon: (code: string, planId: string, amountBdt: number) => {
    valid: boolean;
    discountAmountBdt: number;
    finalAmountBdt: number;
    coupon?: CouponCode;
    errorBn?: string;
  };
  requestPlanUpgrade: (req: {
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    paymentMethod: 'bkash' | 'nagad' | 'bank' | 'manual';
    transactionId: string;
    senderPhone: string;
    couponCode?: string;
    discountAmountBdt?: number;
    finalAmountBdt?: number;
    isRenewal?: boolean;
    notes?: string;
  }) => Promise<void>;
  adminAssignUserPlan: (
    userId: string,
    assignment: {
      planId: string;
      billingCycle?: 'monthly' | 'yearly' | 'custom' | 'lifetime';
      reason: string;
      expiresAt?: string | null;
      customDaysRemaining?: number | null;
      isComplimentary?: boolean;
    }
  ) => Promise<void>;
  adminProcessPaymentRequest: (userId: string, approved: boolean, note?: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function makeStableId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function isPermissionDeniedError(err: unknown): boolean {
  const code = String((err as { code?: unknown })?.code || '').toLowerCase();
  const msg = String((err as { message?: unknown })?.message || '').toLowerCase();
  return code.includes('permission-denied') || msg.includes('missing or insufficient permissions');
}

function computePayloadSignature(action: string, payload?: Record<string, unknown>): string {
  try {
    return `${action}:${JSON.stringify(payload || {})}`;
  } catch {
    return `${action}:unserializable`;
  }
}

function reportFirestoreFailure(
  err: unknown,
  operationType: OperationType,
  path: string,
  onSyncError?: (msg: string) => void
) {
  const errInfo: FirestoreErrorInfo = {
    error: err instanceof Error ? err.message : String(err),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
  };
  const isOfflineTransient = isOfflineOrTransientFirestoreError(err);
  if (!isOfflineTransient) {
    console.error('Firestore Error:', JSON.stringify(errInfo));
  }
  if (onSyncError && !isOfflineTransient) {
    const isPerm = isPermissionDeniedError(err);
    const langStored = typeof window !== 'undefined' ? localStorage.getItem('shromik_sathi_lang') : 'bn';
    const isEn = langStored === 'en';
    onSyncError(
      isPerm
        ? isEn
          ? 'Cloud sync blocked by database permissions. Please verify your login session.'
          : 'ক্লাউড ডেটা সিঙ্ক অনুমতি পাওয়া যায়নি। অনুগ্রহ করে পুনরায় লগইন করুন।'
        : isEn
        ? 'Failed to save changes to Cloud Firestore. Changes remain queued locally.'
        : 'ক্লাউড ডাটাবেসে তথ্য সংরক্ষণ করতে সমস্যা হয়েছে। পরিবর্তনটি অফলাইন কিউতে সংরক্ষিত আছে।'
    );
  }
}

function logFirestoreWarning(err: unknown, operationType: OperationType, path: string) {
  reportFirestoreFailure(err, operationType, path);
}

function lookupLocalAccountFullName(emailOrId?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  const clean = (emailOrId || '').trim().toLowerCase();
  if (!clean) return null;
  try {
    const raw = localStorage.getItem('shromik_sathi_local_accounts');
    if (!raw) return null;
    const list = JSON.parse(raw) as Array<{
      identifier?: string;
      email?: string;
      fullName?: string;
    }>;
    const matched = list.find(
      (a) =>
        (a.email && a.email.toLowerCase() === clean) ||
        (a.identifier && a.identifier.toLowerCase() === clean)
    );
    return matched?.fullName?.trim() || null;
  } catch {
    return null;
  }
}

export function defaultWorkerProfile(uid: string, displayName?: string | null): WorkerProfile {
  return {
    userId: uid,
    fullName: (displayName || 'শ্রমিক ব্যবহারকারী').slice(0, 120),
    photoUrl: '',
    phone: '',
    address: '',
    emergencyContact: '',
    factoryName: '',
    factoryBranch: '',
    department: '',
    designation: '',
    employeeId: '',
    employmentType: 'permanent',
    joiningDate: new Date().toISOString().slice(0, 10),
    salaryGrade: '',
    basicSalary: 0,
    houseRentAllowance: 0,
    medicalAllowance: 0,
    transportAllowance: 0,
    foodAllowance: 0,
    attendanceBonus: 0,
    hasAttendanceBonus: false,
    attendanceBonusAmount: 0,
    attendanceBonusDays: 30,
    maxConsecutiveAbsences: 0,
    bonusCutoffTimeEnabled: false,
    latePenaltyEnabled: false,
    maxLateDaysForBonus: 3,
    dayBonusCutoffTime: '08:05',
    nightBonusCutoffTime: '20:05',
    grossSalary: 0,
    otWageBase: 'basic',
    otDivisor: 208,
    otMultiplier: 2,
    otCalculationMode: 'manual',
    otCustomHourlyRate: 0,
    shiftPattern: 'day',
    dayShiftStartTime: '08:00',
    nightShiftStartTime: '20:00',
    rotationStartDate: '2026-10-01',
    attendanceWindowStartDay: '07:50',
    attendanceWindowEndDay: '08:05',
    attendanceWindowStartNight: '19:50',
    attendanceWindowEndNight: '20:05',
    weeklyHolidayDay: 'friday',
    expectedPayDay: 7,
    monthlyBudgetTarget: 0,
    effectiveFrom: new Date().toISOString().slice(0, 7) + '-01',
    language: 'bn',
    privacyConsent: true,
  };
}

interface UserLocalMirror {
  profile: WorkerProfile | null;
  overtime: OvertimeRecord[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
  attendance: AttendanceRecord[];
  expenses: ExpenseRecord[];
  savings: SavingsGoal[];
  documents: VaultDocument[];
  reminders: ReminderItem[];
  loans: PersonalLoan[];
  workplaces: GarmentWorkplace[];
  contacts: WorkerContact[];
  alarms?: AlarmItem[];
  editHistory: EditHistoryEntry[];
  feedback: SupportFeedback[];
}

function filterOwnedItems<T extends { userId?: string }>(items: T[] | undefined, uid: string): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && (!item.userId || item.userId === uid));
}

function loadUserMirror(uid: string): UserLocalMirror {
  if (!uid) {
    return {
      profile: null,
      overtime: [],
      salaryRecords: [],
      payments: [],
      attendance: [],
      expenses: [],
      savings: [],
      documents: [],
      reminders: [],
      loans: [],
      workplaces: [],
      contacts: [],
      alarms: [],
      editHistory: [],
      feedback: [],
    };
  }
  try {
    const raw = localStorage.getItem(`shromik_sathi_cloud_mirror_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as UserLocalMirror;
      const validProfile =
        parsed.profile && (!parsed.profile.userId || parsed.profile.userId === uid)
          ? { ...parsed.profile, userId: uid }
          : null;
      return {
        profile: validProfile,
        overtime: filterOwnedItems(parsed.overtime, uid),
        salaryRecords: filterOwnedItems(parsed.salaryRecords, uid),
        payments: filterOwnedItems(parsed.payments, uid),
        attendance: filterOwnedItems(parsed.attendance, uid),
        expenses: filterOwnedItems(parsed.expenses, uid),
        savings: filterOwnedItems(parsed.savings, uid),
        documents: filterOwnedItems(parsed.documents, uid),
        reminders: filterOwnedItems(parsed.reminders, uid),
        loans: filterOwnedItems(parsed.loans, uid),
        workplaces: filterOwnedItems(parsed.workplaces, uid),
        contacts: filterOwnedItems(parsed.contacts, uid),
        alarms: filterOwnedItems(parsed.alarms, uid),
        editHistory: filterOwnedItems(parsed.editHistory, uid),
        feedback: filterOwnedItems(parsed.feedback, uid),
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    profile: null,
    overtime: [],
    salaryRecords: [],
    payments: [],
    attendance: [],
    expenses: [],
    savings: [],
    documents: [],
    reminders: [],
    loans: [],
    workplaces: [],
    contacts: [],
    alarms: [],
    editHistory: [],
    feedback: [],
  };
}

const SUBCOLLECTION_KEYS: Array<
  Exclude<OfflineSyncCollection, 'profile' | 'userDirectory'>
> = [
  'overtime',
  'salaryRecords',
  'payments',
  'attendance',
  'expenses',
  'savings',
  'documents',
  'reminders',
  'loans',
  'workplaces',
  'contacts',
  'alarms',
];

function recordMirrorPatchInOfflineQueue(
  scopeKey: string,
  prevMirror: Partial<UserLocalMirror>,
  patch: Partial<UserLocalMirror>
) {
  if (!scopeKey) return;
  if (patch.profile) {
    enqueueOfflineMutation(scopeKey, {
      collection: 'profile',
      docId: 'profile',
      action: 'upsert',
      payload: patch.profile as Record<string, any>,
    });
  }
  for (const col of SUBCOLLECTION_KEYS) {
    if (patch[col] !== undefined) {
      const prevList = ((prevMirror[col] as Array<{ id: string }>) || []).filter(Boolean);
      const nextList = ((patch[col] as Array<{ id: string }>) || []).filter(Boolean);
      const prevMap = new Map(prevList.map((item) => [item.id, item]));
      const nextIds = new Set(nextList.map((item) => item.id));

      for (const prevItem of prevList) {
        if (prevItem?.id && !nextIds.has(prevItem.id)) {
          enqueueOfflineMutation(scopeKey, {
            collection: col,
            docId: prevItem.id,
            action: 'delete',
          });
        }
      }

      for (const nextItem of nextList) {
        if (!nextItem?.id) continue;
        const prevItem = prevMap.get(nextItem.id);
        if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(nextItem)) {
          enqueueOfflineMutation(scopeKey, {
            collection: col,
            docId: nextItem.id,
            action: 'upsert',
            payload: nextItem as Record<string, any>,
          });
        }
      }
    }
  }
}

function compactMirrorForQuota(mirror: UserLocalMirror): UserLocalMirror {
  return {
    ...mirror,
    profile: mirror.profile
      ? {
          ...mirror.profile,
          photoUrl:
            mirror.profile.photoUrl && mirror.profile.photoUrl.length > 32768
              ? ''
              : mirror.profile.photoUrl,
        }
      : null,
    documents: (mirror.documents || []).map((d) => ({
      ...d,
      fileData: d.fileData && d.fileData.length > 16384 ? '' : d.fileData,
    })),
    contacts: (mirror.contacts || []).map((c) => ({
      ...c,
      photoUrl: c.photoUrl && c.photoUrl.length > 8192 ? '' : c.photoUrl,
    })),
  };
}

function saveUserMirror(
  uid: string,
  patch: Partial<UserLocalMirror>,
  options?: { fromRemoteSnapshot?: boolean }
) {
  try {
    const current = loadUserMirror(uid);
    if (!options?.fromRemoteSnapshot) {
      recordMirrorPatchInOfflineQueue(uid, current, patch);
    }
    const updated = { ...current, ...patch };
    const storageKey = `shromik_sathi_cloud_mirror_${uid}`;
    const serialized = JSON.stringify(updated);
    if (serialized.length > 1_500_000) {
      localStorage.setItem(storageKey, JSON.stringify(compactMirrorForQuota(updated)));
    } else {
      try {
        localStorage.setItem(storageKey, serialized);
      } catch {
        localStorage.setItem(storageKey, JSON.stringify(compactMirrorForQuota(updated)));
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shromik-sathi-offline-queue-updated'));
    }
  } catch {
    // ignore quota errors if browser storage is completely restricted
  }
}

function mergeById<T extends { id: string }>(localItems: T[], remoteItems: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of localItems) {
    map.set(item.id, item);
  }
  for (const item of remoteItems) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

const AUTH_UID_CACHE_KEY = 'shromik_sathi_auth_uid';
const AUTH_EMAIL_CACHE_KEY = 'shromik_sathi_auth_email';
const AUTH_NAME_CACHE_KEY = 'shromik_sathi_auth_name';
const AUTH_PHOTO_CACHE_KEY = 'shromik_sathi_auth_photo';
const AUTH_VERIFIED_CACHE_KEY = 'shromik_sathi_auth_verified';

function persistAuthSessionCache(u: User): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_UID_CACHE_KEY, u.uid);
    localStorage.setItem(AUTH_EMAIL_CACHE_KEY, u.email || '');
    localStorage.setItem(AUTH_NAME_CACHE_KEY, u.displayName || '');
    localStorage.setItem(AUTH_PHOTO_CACHE_KEY, u.photoURL || '');
    localStorage.setItem(AUTH_VERIFIED_CACHE_KEY, u.emailVerified ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function clearAuthSessionCache(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_UID_CACHE_KEY);
    localStorage.removeItem(AUTH_EMAIL_CACHE_KEY);
    localStorage.removeItem(AUTH_NAME_CACHE_KEY);
    localStorage.removeItem(AUTH_PHOTO_CACHE_KEY);
    localStorage.removeItem(AUTH_VERIFIED_CACHE_KEY);
  } catch {
    // ignore storage errors
  }
}

function loadCachedAuthUser(): User | null {
  if (typeof window === 'undefined') return null;
  if (auth.currentUser) return auth.currentUser;
  try {
    const uid = (localStorage.getItem(AUTH_UID_CACHE_KEY) || '').trim();
    if (!uid) return null;
    const email = localStorage.getItem(AUTH_EMAIL_CACHE_KEY) || null;
    const displayName = localStorage.getItem(AUTH_NAME_CACHE_KEY) || null;
    const photoURL = localStorage.getItem(AUTH_PHOTO_CACHE_KEY) || null;
    const emailVerified = localStorage.getItem(AUTH_VERIFIED_CACHE_KEY) === '1';
    return {
      uid,
      email,
      displayName,
      photoURL,
      emailVerified,
      isAnonymous: false,
      metadata: {},
      providerData: email
        ? [
            {
              providerId: 'google.com',
              uid: email,
              displayName,
              email,
              phoneNumber: null,
              photoURL,
            },
          ]
        : [],
      refreshToken: '',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => '',
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({ uid, email, displayName }),
      phoneNumber: null,
      providerId: 'firebase',
    } as unknown as User;
  } catch {
    return null;
  }
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialCachedUser = loadCachedAuthUser();
  const initialCachedMirror = initialCachedUser ? loadUserMirror(initialCachedUser.uid) : null;

  const [user, setUser] = useState<User | null>(() => initialCachedUser);
  const [liveAuthUid, setLiveAuthUid] = useState<string | null>(
    () => auth.currentUser?.uid || null
  );
  const autoAlignedMonthUidRef = useRef<string | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      if (auth.currentUser || initialCachedUser) return true;
      const hasFirebaseCachedKey = Object.keys(localStorage).some((k) =>
        k.startsWith('firebase:authUser:')
      );
      if (!hasFirebaseCachedKey) return true;
    }
    return false;
  });
  const [cloudDataLoaded, setCloudDataLoaded] = useState<boolean>(() =>
    Boolean(initialCachedUser)
  );
  const [cloudSyncError, setCloudSyncError] = useState<string>('');
  const clearCloudSyncError = useCallback(() => setCloudSyncError(''), []);

  // Require real Firebase Authentication unless explicit ?onboarding=1 preview is requested
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('shromik_sathi_readonly_demo');
      localStorage.removeItem('shromik_sathi_local_accounts');
      const params = new URLSearchParams(window.location.search);
      if (params.get('onboarding') === '1') {
        return true;
      }
      localStorage.setItem('shromik_sathi_demo_active', '0');
    }
    return false;
  });

  const [isReadOnlyDemo, setIsReadOnlyDemo] = useState<boolean>(false);

  const [publicDemoConfig, setPublicDemoConfig] = useState<PublicDemoSystemConfig>(() => ({
    ...loadPublicDemoConfig(),
    enabled: false,
  }));
  const [readOnlyBlockedNotice, setReadOnlyBlockedNotice] = useState<string>('');
  const [initialAuthMode, setInitialAuthMode] = useState<'signin' | 'signup'>('signin');

  const [activeLocalEmail, setActiveLocalEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = (localStorage.getItem('shromik_sathi_active_email') || '').trim();
      if (stored && !isDemoAccountEmail(stored)) {
        return stored;
      }
    }
    return '';
  });

  const [demoState, setDemoState] = useState<DemoStoreState>(() => {
    if (typeof window !== 'undefined') {
      const active = (localStorage.getItem('shromik_sathi_active_email') || '').trim();
      if (active && !isDemoAccountEmail(active)) {
        return loadUserStore(active);
      }
    }
    return createEmptyUserStore('guest@shromiksathi.app', 'শ্রমিক');
  });

  // Keep local user store in sync when active email changes
  useEffect(() => {
    if (activeLocalEmail && !isDemoAccountEmail(activeLocalEmail)) {
      setDemoState(loadUserStore(activeLocalEmail));
    } else if (isDemoAccountEmail(activeLocalEmail)) {
      setDemoState(loadDemoState());
    }
  }, [activeLocalEmail]);

  const persistCurrentLocalStore = useCallback(
    (nextState: DemoStoreState) => {
      if (activeLocalEmail && !isDemoAccountEmail(activeLocalEmail)) {
        const prevStore = loadUserStore(activeLocalEmail);
        recordMirrorPatchInOfflineQueue(activeLocalEmail, prevStore, nextState);
        saveUserStore(activeLocalEmail, nextState);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('shromik-sathi-offline-queue-updated'));
        }
      } else {
        saveDemoState(nextState);
      }
    },
    [activeLocalEmail]
  );
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('onboarding') === '1') {
        return true;
      }
      return localStorage.getItem('shromik_sathi_needs_onboarding') === '1';
    }
    return false;
  });
  const [isManualSetupMode, setIsManualSetupMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('manual_setup') === '1') {
        return true;
      }
      if (params.get('onboarding') === '1') {
        return false;
      }
      return localStorage.getItem('shromik_sathi_manual_setup_mode') === '1';
    }
    return false;
  });
  const [pendingWritesCount, setPendingWritesCount] = useState(0);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [todayISO, setTodayISO] = useState<string>(() => getBstTodayISO());
  const currentMonthISO = getCurrentMonthISO(todayISO);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthISO(getBstTodayISO()));
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shromik_sathi_dark') === '1';
    }
    return false;
  });

  const [langState, setLangState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shromik_sathi_lang');
      if (stored === 'bn' || stored === 'en') return stored;
    }
    return 'bn';
  });

  // Automatically keep todayISO updated in real time in Asia/Dhaka (UTC+6)
  useEffect(() => {
    const syncToday = () => {
      const nextToday = getBstTodayISO();
      setTodayISO((prev) => {
        if (prev !== nextToday) {
          const prevMonth = prev.slice(0, 7);
          const nextMonth = nextToday.slice(0, 7);
          if (prevMonth !== nextMonth) {
            setSelectedMonth((currSel) => (currSel === prevMonth ? nextMonth : currSel));
          }
          return nextToday;
        }
        return prev;
      });
    };
    const interval = window.setInterval(syncToday, 30000);
    window.addEventListener('focus', syncToday);
    document.addEventListener('visibilitychange', syncToday);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncToday);
      document.removeEventListener('visibilitychange', syncToday);
    };
  }, []);

  // Live Firestore states for authenticated users (backed by local optimistic mirror)
  const [fbProfile, setFbProfile] = useState<WorkerProfile | null>(
    () =>
      initialCachedMirror?.profile ||
      (initialCachedUser
        ? defaultWorkerProfile(initialCachedUser.uid, initialCachedUser.displayName)
        : null)
  );
  const [fbOvertime, setFbOvertime] = useState<OvertimeRecord[]>(
    () => initialCachedMirror?.overtime || []
  );
  const [fbSalaryRecords, setFbSalaryRecords] = useState<SalaryRecord[]>(
    () => initialCachedMirror?.salaryRecords || []
  );
  const [fbPayments, setFbPayments] = useState<SalaryPayment[]>(
    () => initialCachedMirror?.payments || []
  );
  const [fbAttendance, setFbAttendance] = useState<AttendanceRecord[]>(
    () => initialCachedMirror?.attendance || []
  );
  const [fbExpenses, setFbExpenses] = useState<ExpenseRecord[]>(
    () => initialCachedMirror?.expenses || []
  );
  const [fbSavings, setFbSavings] = useState<SavingsGoal[]>(
    () => initialCachedMirror?.savings || []
  );
  const [fbDocuments, setFbDocuments] = useState<VaultDocument[]>(
    () => initialCachedMirror?.documents || []
  );
  const [fbReminders, setFbReminders] = useState<ReminderItem[]>(
    () => initialCachedMirror?.reminders || []
  );
  const [fbLoans, setFbLoans] = useState<PersonalLoan[]>(
    () => initialCachedMirror?.loans || []
  );
  const [fbWorkplaces, setFbWorkplaces] = useState<GarmentWorkplace[]>(
    () => initialCachedMirror?.workplaces || []
  );
  const [fbContacts, setFbContacts] = useState<WorkerContact[]>(
    () => initialCachedMirror?.contacts || []
  );
  const [fbAlarms, setFbAlarms] = useState<AlarmItem[]>(
    () => initialCachedMirror?.alarms || []
  );
  const [fbEditHistory, setFbEditHistory] = useState<EditHistoryEntry[]>(
    () => initialCachedMirror?.editHistory || []
  );
  const [fbFeedback, setFbFeedback] = useState<SupportFeedback[]>(
    () => initialCachedMirror?.feedback || []
  );

  // Subscription system state (respects Admin Master Switch and Firestore config)
  const [subscriptionConfig, setSubscriptionConfig] = useState<GlobalSubscriptionConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        // Clean up legacy forced toggle key
        localStorage.removeItem('shromik_sathi_admin_manual_toggle_v3');
        const storedV4 = localStorage.getItem('shromik_sathi_sub_config_v4');
        const storedLegacy = localStorage.getItem('shromik_sathi_sub_config');
        const raw = storedV4 || storedLegacy;
        if (raw) {
          const parsed = JSON.parse(raw);
          const effectiveEnabled =
            typeof parsed.enabled === 'boolean'
              ? parsed.enabled
              : DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG.enabled;
          const effectiveWarningDays =
            typeof parsed.renewalWarningDays === 'number' && parsed.renewalWarningDays >= 0
              ? parsed.renewalWarningDays
              : DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG.renewalWarningDays ?? 5;
          const next: GlobalSubscriptionConfig = {
            ...DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG,
            ...parsed,
            enabled: effectiveEnabled,
            renewalWarningDays: effectiveWarningDays,
          };
          return next;
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG;
  });

  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('shromik_sathi_sub_plans');
        if (stored) return JSON.parse(stored);
      } catch {
        // ignore
      }
    }
    return DEFAULT_SUBSCRIPTION_PLANS;
  });

  const [userSubscription, setUserSubscription] = useState<UserSubscriptionRecord | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        // Clean up legacy auto-seeded 25-day subscription so unsubscribed users don't falsely see "5 days remaining"
        if (localStorage.getItem('shromik_sathi_user_sub_25d_v2') === '1') {
          localStorage.removeItem('shromik_sathi_user_sub_25d_v2');
          localStorage.removeItem('shromik_sathi_user_sub');
        }
        const subsMapRaw = localStorage.getItem('shromik_sathi_user_subs_v4');
        if (subsMapRaw) {
          const subsMap = JSON.parse(subsMapRaw) as Record<string, UserSubscriptionRecord | null>;
          const activeKey =
            localStorage.getItem('shromik_sathi_local_session_email') || 'current';
          const candidate = subsMap[activeKey] ?? subsMap['current'] ?? null;
          if (candidate) return candidate;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });

  const [coupons, setCoupons] = useState<CouponCode[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('shromik_sathi_coupons');
        if (stored) return JSON.parse(stored);
      } catch {
        // ignore
      }
    }
    return DEFAULT_COUPON_CODES;
  });

  const profileEnsuredRef = useRef<string | null>(null);
  const directorySyncedRef = useRef<string | null>(null);
  const prevAuthUidRef = useRef<string | null>(
    auth.currentUser?.uid || initialCachedUser?.uid || null
  );
  const remoteKnownDocIdsRef = useRef<Record<string, Set<string>>>({});
  const inFlightSyncKeysRef = useRef<Set<string>>(new Set());
  const ensureProfileFlightRef = useRef<Map<string, Promise<'created' | 'already_exists' | 'skipped'>>>(new Map());
  const persistProfileFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  const nonRetryableFailedMutationsRef = useRef<Map<string, string>>(new Map());
  const lastTokenRefreshAtRef = useRef<number>(0);
  const [hasAdminsDoc, setHasAdminsDoc] = useState<boolean>(false);
  const fbProfileNameRef = useRef<string>('');
  const langStateRef = useRef<Language>(langState);

  useEffect(() => {
    langStateRef.current = langState;
  }, [langState]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('shromik_sathi_dark', '1');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('shromik_sathi_dark', '0');
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const triggerReadOnlyBlock = useCallback(() => {
    const updatedCfg = recordDemoBlockedWrite();
    setPublicDemoConfig(updatedCfg);
    setReadOnlyBlockedNotice(DEMO_WRITE_BLOCKED_NOTICE_BN);
  }, []);

  const dismissReadOnlyNotice = useCallback(() => {
    setReadOnlyBlockedNotice('');
  }, []);

  useEffect(() => {
    if (!readOnlyBlockedNotice) return;
    const timer = window.setTimeout(() => {
      setReadOnlyBlockedNotice('');
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [readOnlyBlockedNotice]);

  const isVerifiedAdminRef = useRef(false);

  const updatePublicDemoConfig = useCallback((patch: Partial<PublicDemoSystemConfig>) => {
    const next = savePublicDemoConfig(patch);
    setPublicDemoConfig(next);
    if (auth.currentUser && isVerifiedAdminRef.current) {
      setDoc(
        doc(db, 'demoConfig', 'global'),
        {
          enabled: Boolean(next.enabled),
          demoEmail: next.demoEmail || PUBLIC_DEMO_EMAIL,
          maintenanceMessageBn:
            (next.maintenanceMessageBn || 'ডেমো মোড বর্তমানে বন্ধ আছে।').slice(0, 400),
          maintenanceMessageEn:
            (next.maintenanceMessageEn || 'Public Demo Mode is disabled.').slice(0, 400),
          lastResetAt: (next.lastResetAt || '').slice(0, 40),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => logFirestoreWarning(err, OperationType.WRITE, 'demoConfig/global'));
    }
  }, []);

  const clearInitialAuthMode = useCallback(() => {
    setInitialAuthMode('signin');
  }, []);

  const enterDemoMode = useCallback(() => {
    // Public Demo Mode has been removed
    setIsReadOnlyDemo(false);
    setIsDemoMode(false);
  }, []);

  const exitDemoMode = useCallback(() => {
    setIsDemoMode(false);
    setIsReadOnlyDemo(false);
    setReadOnlyBlockedNotice('');
    setActiveLocalEmail('');
    localStorage.removeItem('shromik_sathi_active_email');
    localStorage.removeItem('shromik_sathi_readonly_demo');
    localStorage.setItem('shromik_sathi_demo_active', '0');
  }, []);

  const exitDemoToSignUp = useCallback(() => {
    setInitialAuthMode('signup');
    exitDemoMode();
  }, [exitDemoMode]);

  const resetDemoData = useCallback(() => {
    const fresh = resetDemoState();
    setDemoState(fresh);
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const nextCfg = savePublicDemoConfig({ lastResetAt: nowStr });
    setPublicDemoConfig(nextCfg);
  }, []);

  useEffect(() => {
    fbProfileNameRef.current = fbProfile?.fullName || '';
  }, [fbProfile?.fullName]);

  const refreshOfflinePendingCount = useCallback(() => {
    if (isReadOnlyDemo) {
      setOfflinePendingCount(0);
      return;
    }
    const uidQueue = user?.uid ? loadOfflineQueue(user.uid) : [];
    setOfflinePendingCount(uidQueue.length);
  }, [user?.uid, isReadOnlyDemo]);

  // Synchronize non-financial user directory entry for Admin Dashboard User Management
  // Serialized per UID via UserDirectorySyncCoordinator to prevent race/conflict writes.
  const syncUserDirectoryEntry = useCallback(
    async (
      currentUser: User,
      opts?: {
        displayName?: string;
        language?: Language;
        offlineSyncState?: 'synced' | 'pending' | 'error';
      }
    ) => {
      if (!currentUser?.uid) return;
      const language = opts?.language || langStateRef.current || 'bn';
      const displayName = resolveBestUserDisplayName(
        [
          opts?.displayName,
          fbProfileNameRef.current,
          currentUser.displayName,
          auth.currentUser?.displayName,
        ],
        currentUser.email || auth.currentUser?.email
      );

      return defaultUserDirectorySyncCoordinator.sync({
        user: currentUser,
        options: {
          displayName: displayName || undefined,
          language,
          offlineSyncState: opts?.offlineSyncState,
          todayISO: getBstTodayISO(),
        },
        adapter: {
          getDocFromServer: async (targetUid) => {
            const snap = await getDocFromServer(doc(db, 'userDirectory', targetUid));
            return {
              exists: snap.exists(),
              data: snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
            };
          },
          getDocFromCache: async (targetUid) => {
            const snap = await getDoc(doc(db, 'userDirectory', targetUid));
            return {
              exists: snap.exists(),
              data: snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
            };
          },
          createDoc: async (targetUid, payload) => {
            await setDoc(doc(db, 'userDirectory', targetUid), {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          },
          updateDoc: async (targetUid, payload) => {
            await updateDoc(doc(db, 'userDirectory', targetUid), {
              ...payload,
              updatedAt: serverTimestamp(),
            });
          },
        },
        onSyncCompleted: (targetUid, result) => {
          if (result.status === 'created' || result.status === 'updated') {
            directorySyncedRef.current = targetUid;
          }
          refreshOfflinePendingCount();
        },
        onError: (err, ctx) => {
          reportFirestoreFailure(
            err,
            ctx.operation === 'read' ? OperationType.GET : OperationType.WRITE,
            `userDirectory/${ctx.uid}`,
            setCloudSyncError
          );
          refreshOfflinePendingCount();
        },
      });
    },
    [refreshOfflinePendingCount]
  );

  const refreshAuthTokenIfNeeded = useCallback(async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) return false;
    const now = Date.now();
    if (now - lastTokenRefreshAtRef.current < 20000) {
      return false;
    }
    lastTokenRefreshAtRef.current = now;
    try {
      await current.getIdToken(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const persistWorkerProfileDoc = useCallback(
    async (
      uid: string,
      rawProfile: WorkerProfile | Record<string, unknown>,
      fallbackDisplayName?: string | null,
      remoteExistsHint?: boolean
    ) => {
      const priorFlight = persistProfileFlightRef.current.get(uid);
      const execute = async () => {
        const userDocRef = doc(db, 'users', uid);
        const normalized = normalizeWorkerProfileForFirestore(
          rawProfile as Record<string, unknown>,
          uid,
          fallbackDisplayName
        );

        // Keys that may not be present in an older deployed /users/{uid} hasOnly() ruleset on the remote DB;
        // these are persisted in the local mirror and merged on read, while coreFirestorePayload writes cleanly on the 1st try.
        const EXTENDED_LOCAL_PROFILE_KEYS = new Set([
          'maxConsecutiveAbsences',
          'bonusCutoffTimeEnabled',
          'latePenaltyEnabled',
          'maxLateDaysForBonus',
          'shiftPattern',
          'dayShiftStartTime',
          'nightShiftStartTime',
          'rotationStartDate',
          'attendanceWindowStartDay',
          'attendanceWindowEndDay',
          'attendanceWindowStartNight',
          'attendanceWindowEndNight',
          'dayBonusCutoffTime',
          'nightBonusCutoffTime',
          'weeklyHolidayDay',
          'expectedPayDay',
          'monthlyBudgetTarget',
        ]);

        const coreFirestorePayload: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(normalized)) {
          if (!EXTENDED_LOCAL_PROFILE_KEYS.has(k)) {
            coreFirestorePayload[k] = v;
          }
        }

        let existsRemote = remoteExistsHint;
        if (existsRemote === undefined) {
          try {
            const sSnap = await getDocFromServer(userDocRef);
            existsRemote = sSnap.exists();
          } catch {
            try {
              const cSnap = await getDoc(userDocRef);
              existsRemote = cSnap.exists();
            } catch {
              existsRemote = profileEnsuredRef.current === uid;
            }
          }
        }

        const minimalRequiredPayload = buildCoreRequiredWorkerProfilePayload(
          rawProfile as Record<string, unknown>,
          uid,
          fallbackDisplayName
        );

        const recoverLegacyProfileWrite = async () => {
          let existingSnap;
          try {
            existingSnap = await getDocFromServer(userDocRef);
          } catch {
            try {
              existingSnap = await getDoc(userDocRef);
            } catch {
              existingSnap = undefined;
            }
          }

          const existingData = existingSnap?.exists()
            ? (existingSnap.data() as Record<string, unknown>)
            : null;

          if (!existingData) {
            try {
              await setDoc(userDocRef, {
                ...coreFirestorePayload,
                userId: uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              profileEnsuredRef.current = uid;
              return;
            } catch (createCoreErr: any) {
              if (!isPermissionDeniedError(createCoreErr)) {
                throw createCoreErr;
              }
              await setDoc(userDocRef, {
                ...minimalRequiredPayload,
                userId: uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              profileEnsuredRef.current = uid;
              return;
            }
          }

          const allowedKeys = new Set([
            ...Object.keys(normalized),
            'id',
            'userId',
            'createdAt',
            'updatedAt',
          ]);
          const hasStrayLegacyKeys = Object.keys(existingData).some(
            (existingKey) => !allowedKeys.has(existingKey)
          );

          const existingCreatedAt = existingData.createdAt;
          const hasTimestampCreatedAt = Boolean(
            existingCreatedAt &&
              typeof existingCreatedAt === 'object' &&
              typeof (existingCreatedAt as { toMillis?: unknown }).toMillis === 'function'
          );

          // If stray legacy keys exist on server, full setDoc overwrite cleanly removes them
          // without triggering affectedKeys().hasOnly() failures from deleteField().
          if (hasStrayLegacyKeys) {
            try {
              await setDoc(userDocRef, {
                ...normalized,
                userId: uid,
                createdAt: hasTimestampCreatedAt ? existingCreatedAt : serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              profileEnsuredRef.current = uid;
              return;
            } catch {
              // Fall through to core/minimal setDoc fallbacks below
            }
          } else {
            const updatePayload: Record<string, unknown> = {
              ...coreFirestorePayload,
              userId: uid,
              updatedAt: serverTimestamp(),
            };
            if (!hasTimestampCreatedAt) {
              updatePayload.createdAt = serverTimestamp();
            }
            try {
              await updateDoc(userDocRef, updatePayload);
              profileEnsuredRef.current = uid;
              return;
            } catch {
              // Fall through to setDoc fallbacks below
            }
          }

          try {
            await setDoc(userDocRef, {
              ...coreFirestorePayload,
              userId: uid,
              createdAt: hasTimestampCreatedAt ? existingCreatedAt : serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            profileEnsuredRef.current = uid;
            return;
          } catch (setCoreErr: any) {
            if (!isPermissionDeniedError(setCoreErr)) {
              throw setCoreErr;
            }
            // Final fallback: strictly minimum required fields so legacy rulesets still succeed
            await setDoc(userDocRef, {
              ...minimalRequiredPayload,
              userId: uid,
              createdAt: hasTimestampCreatedAt ? existingCreatedAt : serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            profileEnsuredRef.current = uid;
          }
        };

        const runPrimaryWrite = async () => {
          if (!existsRemote) {
            await setDoc(userDocRef, {
              ...normalized,
              userId: uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            profileEnsuredRef.current = uid;
            return;
          }

          await updateDoc(userDocRef, {
            ...normalized,
            userId: uid,
            updatedAt: serverTimestamp(),
          });
          profileEnsuredRef.current = uid;
        };

        try {
          await runPrimaryWrite();
        } catch (err: any) {
          const code = String(err?.code || '').toLowerCase();
          if (code.includes('not-found')) {
            await setDoc(userDocRef, {
              ...normalized,
              userId: uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            profileEnsuredRef.current = uid;
            return;
          }
          if (isPermissionDeniedError(err)) {
            const refreshed = await refreshAuthTokenIfNeeded();
            if (refreshed) {
              try {
                await runPrimaryWrite();
                return;
              } catch (retryErr: any) {
                if (!isPermissionDeniedError(retryErr)) {
                  throw retryErr;
                }
              }
            }
            await recoverLegacyProfileWrite();
            return;
          }
          throw err;
        }
      };

      const chained = (priorFlight || Promise.resolve())
        .catch(() => {})
        .then(execute);
      persistProfileFlightRef.current.set(uid, chained);
      try {
        await chained;
        nonRetryableFailedMutationsRef.current.delete('profile:profile');
        if (nonRetryableFailedMutationsRef.current.size === 0) {
          setCloudSyncError('');
        }
      } finally {
        if (persistProfileFlightRef.current.get(uid) === chained) {
          persistProfileFlightRef.current.delete(uid);
        }
      }
    },
    [refreshAuthTokenIfNeeded]
  );

  // Ensure parent profile document exists in Firestore (and has valid `userId == uid`) before subcollection writes.
  // Always checks server first when online so an empty local cache never overwrites cloud data.
  const ensureParentProfileInFirestore = useCallback(
    async (
      currentUser: User,
      fallbackProfile?: WorkerProfile
    ): Promise<'created' | 'already_exists' | 'skipped'> => {
      if (profileEnsuredRef.current === currentUser.uid) {
        return 'already_exists';
      }
      const existingFlight = ensureProfileFlightRef.current.get(currentUser.uid);
      if (existingFlight) {
        return await existingFlight;
      }

      const runner = (async (): Promise<'created' | 'already_exists' | 'skipped'> => {
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          let snap;
          try {
            snap = await getDocFromServer(userDocRef);
          } catch {
            snap = await getDoc(userDocRef);
          }
          const exists = snap.exists();
          const hasMatchingUid = exists && snap.data()?.userId === currentUser.uid;
          if (!exists || !hasMatchingUid) {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              return 'skipped';
            }
            const base = exists
              ? ({
                  ...(snap.data() as WorkerProfile),
                  ...(fallbackProfile || {}),
                } as WorkerProfile)
              : fallbackProfile || defaultWorkerProfile(currentUser.uid, currentUser.displayName);
            await persistWorkerProfileDoc(currentUser.uid, base, currentUser.displayName, exists);
            return 'created';
          } else {
            profileEnsuredRef.current = currentUser.uid;
            return 'already_exists';
          }
        } catch (err) {
          reportFirestoreFailure(
            err,
            OperationType.CREATE,
            `users/${currentUser.uid}`,
            setCloudSyncError
          );
          return 'skipped';
        }
      })();

      ensureProfileFlightRef.current.set(currentUser.uid, runner);
      try {
        return await runner;
      } finally {
        if (ensureProfileFlightRef.current.get(currentUser.uid) === runner) {
          ensureProfileFlightRef.current.delete(currentUser.uid);
        }
      }
    },
    [persistWorkerProfileDoc]
  );

  const upsertSubcollectionDoc = useCallback(
    async (
      uid: string,
      colName: SubcollectionName,
      docId: string,
      rawPayload: Record<string, any>
    ) => {
      const cleanFields = normalizeSubcollectionPayloadForFirestore(colName, rawPayload);
      const docRef = doc(db, 'users', uid, colName, docId);
      const knownSet = remoteKnownDocIdsRef.current[colName];
      let existsRemote = knownSet?.has(docId) ?? false;

      if (!existsRemote) {
        try {
          const snap = await getDocFromServer(docRef);
          existsRemote = snap.exists();
        } catch {
          try {
            const cSnap = await getDoc(docRef);
            existsRemote = cSnap.exists();
          } catch {
            existsRemote = false;
          }
        }
      }

      const performWrite = async (targetExists: boolean) => {
        if (targetExists) {
          await updateDoc(docRef, {
            ...cleanFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(docRef, {
            ...cleanFields,
            userId: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      };

      try {
        await performWrite(existsRemote);
      } catch (err: any) {
        const code = String(err?.code || '').toLowerCase();
        if (code.includes('not-found')) {
          await performWrite(false);
        } else if (isPermissionDeniedError(err)) {
          await refreshAuthTokenIfNeeded();
          // Re-verify existence & parent profile before retrying once
          const currentUser = auth.currentUser;
          if (currentUser && currentUser.uid === uid && profileEnsuredRef.current !== uid) {
            await ensureParentProfileInFirestore(currentUser);
          }
          let serverExists = existsRemote;
          try {
            const sSnap = await getDocFromServer(docRef);
            serverExists = sSnap.exists();
          } catch {
            // keep prior assumption
          }
          await performWrite(serverExists);
        } else {
          throw err;
        }
      }

      if (!remoteKnownDocIdsRef.current[colName]) {
        remoteKnownDocIdsRef.current[colName] = new Set();
      }
      remoteKnownDocIdsRef.current[colName].add(docId);
      nonRetryableFailedMutationsRef.current.delete(`${colName}:${docId}`);
      if (nonRetryableFailedMutationsRef.current.size === 0) {
        setCloudSyncError('');
      }
    },
    [ensureParentProfileInFirestore, refreshAuthTokenIfNeeded]
  );

  // Auth listener: reset transient cloud state on user change / sign-out before loading from Firestore
  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      setAuthReady(true);
    }, 300);
    const unsub = onAuthStateChanged(auth, (u) => {
      window.clearTimeout(fallbackTimer);
      setLiveAuthUid(u?.uid || null);

      // If Firebase emits null (e.g., offline reload, slow IndexedDB init, or mobile WebView storage),
      // preserve the cached user session until the user explicitly clicks Logout.
      if (!u) {
        const cachedUser = loadCachedAuthUser();
        if (cachedUser) {
          setUser(cachedUser);
          setAuthReady(true);
          setCloudDataLoaded(true);
          return;
        }
      } else {
        persistAuthSessionCache(u);
      }

      const nextUid = u?.uid || null;
      if (prevAuthUidRef.current !== nextUid) {
        prevAuthUidRef.current = nextUid;
        profileEnsuredRef.current = null;
        directorySyncedRef.current = null;
        autoAlignedMonthUidRef.current = null;
        remoteKnownDocIdsRef.current = {};
        nonRetryableFailedMutationsRef.current.clear();
        setHasAdminsDoc(false);
        setCloudDataLoaded(Boolean(u));
        setCloudSyncError('');
        setFbProfile(null);
        setFbOvertime([]);
        setFbSalaryRecords([]);
        setFbPayments([]);
        setFbAttendance([]);
        setFbExpenses([]);
        setFbSavings([]);
        setFbDocuments([]);
        setFbReminders([]);
        setFbLoans([]);
        setFbWorkplaces([]);
        setFbContacts([]);
        setFbAlarms([]);
        setFbEditHistory([]);
        setFbFeedback([]);
      }

      setUser(u);
      setAuthReady(true);

      if (u) {
        const mirror = loadUserMirror(u.uid);
        if (mirror.profile) {
          setFbProfile(mirror.profile);
          setCloudDataLoaded(true);
        }
        if (mirror.overtime.length > 0) setFbOvertime(mirror.overtime);
        if (mirror.salaryRecords.length > 0) setFbSalaryRecords(mirror.salaryRecords);
        if (mirror.payments.length > 0) setFbPayments(mirror.payments);
        if (mirror.attendance.length > 0) setFbAttendance(mirror.attendance);
        if (mirror.expenses.length > 0) setFbExpenses(mirror.expenses);
        if (mirror.savings.length > 0) setFbSavings(mirror.savings);
        if (mirror.documents.length > 0) setFbDocuments(mirror.documents);
        if (mirror.reminders.length > 0) setFbReminders(mirror.reminders);
        if ((mirror.loans || []).length > 0) setFbLoans(mirror.loans || []);
        if ((mirror.workplaces || []).length > 0) setFbWorkplaces(mirror.workplaces || []);
        if ((mirror.contacts || []).length > 0) setFbContacts(mirror.contacts || []);
        if ((mirror.alarms || []).length > 0) setFbAlarms(mirror.alarms || []);
        if ((mirror.editHistory || []).length > 0) setFbEditHistory(mirror.editHistory || []);
        if (mirror.feedback.length > 0) setFbFeedback(mirror.feedback);

        const params = new URLSearchParams(window.location.search);
        if (params.get('onboarding') !== '1') {
          setIsDemoMode(false);
          localStorage.setItem('shromik_sathi_demo_active', '0');
        }
      } else {
        setCloudDataLoaded(false);
      }
    });
    return () => {
      window.clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  const isSyncingOfflineRef = useRef(false);

  // Read-only verification against /admins/{uid} (no client writes allowed by firestore.rules)
  useEffect(() => {
    if (!authReady || !user || isDemoMode || isReadOnlyDemo) {
      setHasAdminsDoc(false);
      return;
    }
    if (isStrictAdminSession(user, isReadOnlyDemo)) {
      setHasAdminsDoc(true);
      return;
    }
    if (!user.emailVerified || !auth.currentUser || auth.currentUser.uid !== user.uid) {
      setHasAdminsDoc(false);
      return;
    }
    let cancelled = false;
    const adminDocRef = doc(db, 'admins', user.uid);
    const isCurrentlyOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    (isCurrentlyOffline
      ? getDoc(adminDocRef)
      : getDocFromServer(adminDocRef).catch(() => getDoc(adminDocRef))
    )
      .then((snap) => {
        if (!cancelled) {
          setHasAdminsDoc(Boolean(snap?.exists()));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasAdminsDoc(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, user, liveAuthUid, isDemoMode, isReadOnlyDemo]);

  const isVerifiedAdmin = resolveVerifiedAdminSession({
    user,
    isReadOnlyDemo,
    hasAdminsDoc,
  });
  isVerifiedAdminRef.current = isVerifiedAdmin;

  useEffect(() => {
    refreshOfflinePendingCount();
    if (typeof window === 'undefined') return;
    const handleQueueUpdated = () => refreshOfflinePendingCount();
    window.addEventListener('shromik-sathi-offline-queue-updated', handleQueueUpdated);
    return () => {
      window.removeEventListener('shromik-sathi-offline-queue-updated', handleQueueUpdated);
    };
  }, [refreshOfflinePendingCount]);

  // Attach Firestore listeners when authenticated and NOT in demo mode
  useEffect(() => {
    if (!authReady || !user || isDemoMode) {
      return;
    }
    // Wait for real Firebase Auth instance before attaching live Firestore listeners;
    // when offline or during the brief IndexedDB hydration window, local mirror state is already active.
    if (!auth.currentUser || auth.currentUser.uid !== user.uid) {
      setCloudDataLoaded(true);
      return;
    }

    let cancelled = false;
    const uid = user.uid;
    const userDocRef = doc(db, 'users', uid);

    const subCollections: Array<{
      name: Exclude<OfflineSyncCollection, 'profile' | 'userDirectory'>;
      setter: React.Dispatch<React.SetStateAction<any[]>>;
    }> = [
      { name: 'overtime', setter: setFbOvertime },
      { name: 'salaryRecords', setter: setFbSalaryRecords },
      { name: 'payments', setter: setFbPayments },
      { name: 'attendance', setter: setFbAttendance },
      { name: 'expenses', setter: setFbExpenses },
      { name: 'savings', setter: setFbSavings },
      { name: 'documents', setter: setFbDocuments },
      { name: 'reminders', setter: setFbReminders },
      { name: 'loans', setter: setFbLoans },
      { name: 'workplaces', setter: setFbWorkplaces },
      { name: 'contacts', setter: setFbContacts },
      { name: 'alarms', setter: setFbAlarms },
    ];

    const pendingInitialKeys = new Set<string>([
      'profile',
      ...subCollections.map((c) => c.name),
    ]);
    const markCollectionReady = (key: string) => {
      if (cancelled) return;
      pendingInitialKeys.delete(key);
      if (pendingInitialKeys.size === 0) {
        setCloudDataLoaded(true);
      }
    };
    // Safety net for slow/offline cold boots so UI never hangs indefinitely
    const isColdOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const readySafetyTimer = window.setTimeout(
      () => {
        if (!cancelled) setCloudDataLoaded(true);
      },
      isColdOffline ? 600 : 4500
    );

    // Ensure user appears in Admin User Management directory once per session
    if (directorySyncedRef.current !== uid) {
      void syncUserDirectoryEntry(user);
    }

    const unsubProfile = onSnapshot(
      userDocRef,
      { includeMetadataChanges: true },
      async (snap) => {
        if (cancelled) return;
        const currentQueue = loadOfflineQueue(uid);
        const pendingProfileMut = currentQueue.find(
          (m) => m.collection === 'profile' && m.action === 'upsert'
        );
        if (pendingProfileMut) {
          const mirror = loadUserMirror(uid);
          const localProf =
            mirror.profile ||
            (pendingProfileMut.payload as WorkerProfile | undefined) ||
            defaultWorkerProfile(uid, user.displayName);
          setFbProfile(localProf);
          markCollectionReady('profile');
          const profSig = computePayloadSignature('upsert', localProf as unknown as Record<string, unknown>);
          const alreadyBlocked =
            nonRetryableFailedMutationsRef.current.get('profile:profile') === profSig;
          if (
            !alreadyBlocked &&
            !snap.metadata.hasPendingWrites &&
            (typeof navigator === 'undefined' || navigator.onLine) &&
            !inFlightSyncKeysRef.current.has('profile:profile')
          ) {
            inFlightSyncKeysRef.current.add('profile:profile');
            try {
              let remoteExists = snap.exists();
              if (!remoteExists) {
                try {
                  const sSnap = await getDocFromServer(userDocRef);
                  remoteExists = sSnap.exists();
                } catch {
                  remoteExists = false;
                }
              }
              await persistWorkerProfileDoc(uid, localProf, user.displayName, remoteExists);
              clearOfflineMutation(uid, 'profile', 'profile');
              nonRetryableFailedMutationsRef.current.delete('profile:profile');
              setCloudSyncError('');
              refreshOfflinePendingCount();
            } catch (err) {
              if (isPermissionDeniedError(err)) {
                nonRetryableFailedMutationsRef.current.set('profile:profile', profSig);
              }
              reportFirestoreFailure(
                err,
                OperationType.UPDATE,
                `users/${uid}`,
                setCloudSyncError
              );
            } finally {
              inFlightSyncKeysRef.current.delete('profile:profile');
            }
          }
          return;
        }

        if (snap.exists()) {
          const remoteProfile = snap.data() as WorkerProfile;
          const mirrorProf = loadUserMirror(uid).profile;
          const localHasSetup = Boolean(mirrorProf && isWorkerSetupCompleted(mirrorProf));
          const remoteHasSetup = isWorkerSetupCompleted(remoteProfile);
          const rawMerged: WorkerProfile =
            localHasSetup && !remoteHasSetup
              ? {
                  ...defaultWorkerProfile(uid, user.displayName),
                  ...remoteProfile,
                  ...(mirrorProf || {}),
                  userId: uid,
                }
              : {
                  ...defaultWorkerProfile(uid, user.displayName),
                  ...(mirrorProf || {}),
                  ...remoteProfile,
                  userId: uid,
                };
          const resolvedName = resolveBestUserDisplayName(
            [user.displayName, rawMerged.fullName, remoteProfile.fullName, mirrorProf?.fullName],
            user.email
          );
          const mergedProfile: WorkerProfile = {
            ...rawMerged,
            fullName:
              !isGenericWorkerPlaceholderName(rawMerged.fullName) &&
              rawMerged.fullName?.trim() &&
              rawMerged.fullName.trim().toLowerCase() !== (user.email || '').split('@')[0]?.toLowerCase()
                ? rawMerged.fullName
                : resolvedName || rawMerged.fullName,
          };
          profileEnsuredRef.current = uid;
          setFbProfile(mergedProfile);
          saveUserMirror(uid, { profile: mergedProfile }, { fromRemoteSnapshot: true });
          const nameUpgradedFromPlaceholder =
            Boolean(user.displayName?.trim()) &&
            isGenericWorkerPlaceholderName(remoteProfile.fullName) &&
            mergedProfile.fullName !== remoteProfile.fullName;
          if (
            ((localHasSetup && !remoteHasSetup) || nameUpgradedFromPlaceholder) &&
            !snap.metadata.fromCache &&
            (typeof navigator === 'undefined' || navigator.onLine)
          ) {
            void persistWorkerProfileDoc(uid, mergedProfile, user.displayName, true).catch(
              () => {}
            );
          }
          if (isWorkerSetupCompleted(mergedProfile)) {
            localStorage.removeItem('shromik_sathi_needs_onboarding');
            localStorage.removeItem('shromik_sathi_manual_setup_mode');
            setNeedsOnboarding(false);
            setIsManualSetupMode(false);
          }
          if (
            !isGenericWorkerPlaceholderName(mergedProfile.fullName) ||
            Boolean(user.displayName?.trim())
          ) {
            void syncUserDirectoryEntry(user, {
              displayName: resolveBestUserDisplayName(
                [user.displayName, mergedProfile.fullName],
                user.email
              ),
              language: mergedProfile.language,
            }).catch(() => {});
          }
          markCollectionReady('profile');
          return;
        }

        // Snapshot didn't exist locally. Verify directly from server before assuming brand-new user
        // so an offline or cold cache never overwrites existing cloud profile data.
        const isOnline = typeof navigator === 'undefined' || navigator.onLine;
        if (!isOnline) {
          const mirror = loadUserMirror(uid);
          setFbProfile(mirror.profile || defaultWorkerProfile(uid, user.displayName));
          markCollectionReady('profile');
          return;
        }

        try {
          const serverSnap = await getDocFromServer(userDocRef);
          if (cancelled) return;
          if (serverSnap.exists()) {
            const remoteProfile = serverSnap.data() as WorkerProfile;
            const mirrorProf = loadUserMirror(uid).profile;
            const localHasSetup = Boolean(mirrorProf && isWorkerSetupCompleted(mirrorProf));
            const remoteHasSetup = isWorkerSetupCompleted(remoteProfile);
            const rawMerged: WorkerProfile =
              localHasSetup && !remoteHasSetup
                ? {
                    ...defaultWorkerProfile(uid, user.displayName),
                    ...remoteProfile,
                    ...(mirrorProf || {}),
                    userId: uid,
                  }
                : {
                    ...defaultWorkerProfile(uid, user.displayName),
                    ...(mirrorProf || {}),
                    ...remoteProfile,
                    userId: uid,
                  };
            const resolvedName = resolveBestUserDisplayName(
              [user.displayName, rawMerged.fullName, remoteProfile.fullName, mirrorProf?.fullName],
              user.email
            );
            const mergedProfile: WorkerProfile = {
              ...rawMerged,
              fullName:
                !isGenericWorkerPlaceholderName(rawMerged.fullName) &&
                rawMerged.fullName?.trim() &&
                rawMerged.fullName.trim().toLowerCase() !== (user.email || '').split('@')[0]?.toLowerCase()
                  ? rawMerged.fullName
                  : resolvedName || rawMerged.fullName,
            };
            profileEnsuredRef.current = uid;
            setFbProfile(mergedProfile);
            saveUserMirror(uid, { profile: mergedProfile }, { fromRemoteSnapshot: true });
            if (localHasSetup && !remoteHasSetup) {
              void persistWorkerProfileDoc(uid, mergedProfile, user.displayName, true).catch(
                () => {}
              );
            }
            if (isWorkerSetupCompleted(mergedProfile)) {
              localStorage.removeItem('shromik_sathi_needs_onboarding');
              localStorage.removeItem('shromik_sathi_manual_setup_mode');
              setNeedsOnboarding(false);
              setIsManualSetupMode(false);
            }
            if (
              !isGenericWorkerPlaceholderName(mergedProfile.fullName) ||
              Boolean(user.displayName?.trim())
            ) {
              void syncUserDirectoryEntry(user, {
                displayName: resolveBestUserDisplayName(
                  [user.displayName, mergedProfile.fullName],
                  user.email
                ),
                language: mergedProfile.language,
              }).catch(() => {});
            }
            markCollectionReady('profile');
            return;
          }

          // Server confirmed profile does not exist yet: initialize once
          const mirror = loadUserMirror(uid);
          const initialProfile =
            (mirror.profile && isWorkerSetupCompleted(mirror.profile) ? mirror.profile : null) ||
            mirror.profile ||
            defaultWorkerProfile(uid, user.displayName);
          await persistWorkerProfileDoc(uid, initialProfile, user.displayName, false);
          setFbProfile(initialProfile);
          saveUserMirror(uid, { profile: initialProfile }, { fromRemoteSnapshot: true });
        } catch (err) {
          const mirror = loadUserMirror(uid);
          setFbProfile(mirror.profile || defaultWorkerProfile(uid, user.displayName));
          reportFirestoreFailure(
            err,
            OperationType.GET,
            `users/${uid}`,
            setCloudSyncError
          );
        } finally {
          markCollectionReady('profile');
        }
      },
      (err) => {
        reportFirestoreFailure(err, OperationType.GET, `users/${uid}`, setCloudSyncError);
        markCollectionReady('profile');
      }
    );

    const unsubs = subCollections.map(({ name, setter }) => {
      const colRef = collection(db, 'users', uid, name);
      const q = query(colRef, where('userId', '==', uid));
      return onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          if (cancelled) return;
          const snapshotDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const isFromServer = !snap.metadata.fromCache;
          if (isFromServer) {
            remoteKnownDocIdsRef.current[name] = new Set(snap.docs.map((d) => d.id));
          }

          const currentQueue = loadOfflineQueue(uid);
          const localMirrorList = (loadUserMirror(uid)[name] as Array<{ id: string }>) || [];
          // When snapshot is only from local IndexedDB cache, do not assume items are already on the remote server
          const { mergedItems, itemsToUploadToCloud, idsToDeleteFromCloud } =
            reconcileCollectionWithOfflineState({
              collection: name,
              localItems: isFromServer
                ? localMirrorList
                : mergeById(localMirrorList, snapshotDocs),
              remoteItems: isFromServer ? snapshotDocs : [],
              queue: currentQueue,
            });
          const skipRedundantWrite = shouldSkipRedundantMirrorWrite({
            isFromServer,
            localList: localMirrorList as ReadonlyArray<Record<string, unknown>>,
            mergedList: mergedItems as ReadonlyArray<Record<string, unknown>>,
          });
          if (!skipRedundantWrite) {
            saveUserMirror(uid, { [name]: mergedItems }, { fromRemoteSnapshot: true });
            setter(mergedItems);
          } else {
            setter((prev) =>
              areRecordListsEquivalent(
                prev as ReadonlyArray<Record<string, unknown>>,
                mergedItems as ReadonlyArray<Record<string, unknown>>
              )
                ? prev
                : mergedItems
            );
          }
          markCollectionReady(name);

          if (name === 'contacts') {
            for (const c of mergedItems as WorkerContact[]) {
              if (c?.id && c?.photoUrl) {
                void saveContactPhotoToDevice(c.id, c.photoUrl);
              }
            }
          }

          if (
            isFromServer &&
            !snap.metadata.hasPendingWrites &&
            (typeof navigator === 'undefined' || navigator.onLine) &&
            (itemsToUploadToCloud.length > 0 || idsToDeleteFromCloud.length > 0)
          ) {
            void (async () => {
              await ensureParentProfileInFirestore(user);
              for (const item of itemsToUploadToCloud) {
                if (!item?.id) continue;
                const syncKey = `${name}:${item.id}`;
                const itemSig = computePayloadSignature('upsert', item as Record<string, unknown>);
                if (
                  inFlightSyncKeysRef.current.has(syncKey) ||
                  nonRetryableFailedMutationsRef.current.get(syncKey) === itemSig
                ) {
                  continue;
                }
                inFlightSyncKeysRef.current.add(syncKey);
                try {
                  await upsertSubcollectionDoc(
                    uid,
                    name,
                    item.id,
                    item as Record<string, any>
                  );
                  clearOfflineMutation(uid, name, item.id);
                  nonRetryableFailedMutationsRef.current.delete(syncKey);
                  setCloudSyncError('');
                } catch (err) {
                  if (isPermissionDeniedError(err)) {
                    nonRetryableFailedMutationsRef.current.set(syncKey, itemSig);
                  }
                  reportFirestoreFailure(
                    err,
                    OperationType.WRITE,
                    `users/${uid}/${name}/${item.id}`,
                    setCloudSyncError
                  );
                } finally {
                  inFlightSyncKeysRef.current.delete(syncKey);
                }
              }
              for (const delId of idsToDeleteFromCloud) {
                const syncKey = `${name}:${delId}`;
                const delSig = computePayloadSignature('delete');
                if (
                  inFlightSyncKeysRef.current.has(syncKey) ||
                  nonRetryableFailedMutationsRef.current.get(syncKey) === delSig
                ) {
                  continue;
                }
                inFlightSyncKeysRef.current.add(syncKey);
                try {
                  await deleteDoc(doc(db, 'users', uid, name, delId));
                  clearOfflineMutation(uid, name, delId);
                  nonRetryableFailedMutationsRef.current.delete(syncKey);
                  setCloudSyncError('');
                } catch (err) {
                  if (isPermissionDeniedError(err)) {
                    nonRetryableFailedMutationsRef.current.set(syncKey, delSig);
                  }
                  reportFirestoreFailure(
                    err,
                    OperationType.DELETE,
                    `users/${uid}/${name}/${delId}`,
                    setCloudSyncError
                  );
                } finally {
                  inFlightSyncKeysRef.current.delete(syncKey);
                }
              }
              refreshOfflinePendingCount();
            })();
          }
        },
        (err) => {
          reportFirestoreFailure(
            err,
            OperationType.LIST,
            `users/${uid}/${name}`,
            setCloudSyncError
          );
          markCollectionReady(name);
        }
      );
    });

    const feedbackQuery = isVerifiedAdmin
      ? collection(db, 'feedback')
      : query(collection(db, 'feedback'), where('userId', '==', uid));

    const unsubFeedback = onSnapshot(
      feedbackQuery,
      (snap) => {
        if (cancelled) return;
        const normalizeFeedbackTs = (val: unknown): string | undefined => {
          if (typeof val === 'string' && val.trim()) return val.trim();
          if (val && typeof val === 'object') {
            const ts = val as { toDate?: () => Date; seconds?: number };
            if (typeof ts.toDate === 'function') {
              try {
                return ts.toDate().toISOString();
              } catch {
                return undefined;
              }
            }
            if (typeof ts.seconds === 'number') {
              try {
                return new Date(ts.seconds * 1000).toISOString();
              } catch {
                return undefined;
              }
            }
          }
          return undefined;
        };

        const remoteFb: SupportFeedback[] = snap.docs.map((d) => {
          const raw = d.data() as Record<string, any>;
          return {
            id: d.id,
            userId: String(raw.userId || uid),
            workerName: String(raw.workerName || 'শ্রমিক ব্যবহারকারী'),
            category: (raw.category as FeedbackCategory) || 'general',
            message: String(raw.message || ''),
            status: raw.status === 'resolved' ? 'resolved' : 'open',
            ...(raw.adminStatus ? { adminStatus: raw.adminStatus } : {}),
            ...(raw.assignedTo ? { assignedTo: String(raw.assignedTo) } : {}),
            ...(raw.ticketNumber ? { ticketNumber: String(raw.ticketNumber) } : {}),
            ...(raw.subject ? { subject: String(raw.subject) } : {}),
            replies: Array.isArray(raw.replies) ? raw.replies : [],
            internalNotes: Array.isArray(raw.internalNotes) ? raw.internalNotes : [],
            createdAt: normalizeFeedbackTs(raw.createdAt) || new Date().toISOString(),
            updatedAt: normalizeFeedbackTs(raw.updatedAt) || new Date().toISOString(),
          };
        });

        setFbFeedback((prev) => {
          const merged = remoteFb.length > 0 ? mergeById(prev, remoteFb) : prev;
          saveUserMirror(uid, { feedback: merged }, { fromRemoteSnapshot: true });
          return merged;
        });

        // If online and snapshot is from server, backfill any local-only feedback owned by this user to Firestore
        if (!snap.metadata.fromCache && (typeof navigator === 'undefined' || navigator.onLine)) {
          const remoteIds = new Set(snap.docs.map((d) => d.id));
          const mirrorFb = loadUserMirror(uid).feedback || [];
          for (const localItem of mirrorFb) {
            if (
              localItem &&
              localItem.id &&
              localItem.userId === uid &&
              !remoteIds.has(localItem.id)
            ) {
              const safeWorkerName =
                (
                  localItem.workerName ||
                  fbProfileNameRef.current ||
                  user.displayName ||
                  user.email?.split('@')[0] ||
                  'শ্রমিক ব্যবহারকারী'
                )
                  .trim()
                  .slice(0, 120) || 'শ্রমিক ব্যবহারকারী';
              void setDoc(doc(db, 'feedback', localItem.id), {
                userId: uid,
                workerName: safeWorkerName,
                category: localItem.category || 'general',
                message: (localItem.message || '').slice(0, 1000) || 'সহায়তা অনুরোধ',
                status: localItem.status === 'resolved' ? 'resolved' : 'open',
                adminStatus:
                  localItem.adminStatus ||
                  (localItem.status === 'resolved' ? 'resolved' : 'new'),
                replies: Array.isArray(localItem.replies) ? localItem.replies : [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }).catch(() => {});
            }
          }
        }
      },
      (err) => reportFirestoreFailure(err, OperationType.LIST, 'feedback')
    );

    return () => {
      cancelled = true;
      window.clearTimeout(readySafetyTimer);
      unsubProfile();
      unsubs.forEach((u) => u());
      unsubFeedback();
    };
  }, [
    authReady,
    user,
    liveAuthUid,
    isDemoMode,
    isVerifiedAdmin,
    ensureParentProfileInFirestore,
    persistWorkerProfileDoc,
    upsertSubcollectionDoc,
    syncUserDirectoryEntry,
    refreshOfflinePendingCount,
  ]);

  const rawActiveProfile: WorkerProfile = useMemo(
    () =>
      isDemoMode
        ? demoState.profile
        : fbProfile || defaultWorkerProfile(user?.uid || 'guest', user?.displayName),
    [isDemoMode, demoState.profile, fbProfile, user?.uid, user?.displayName]
  );

  const effectiveEmail = user?.email || activeLocalEmail || '';
  const localAccountFullName = isReadOnlyDemo
    ? null
    : lookupLocalAccountFullName(effectiveEmail);
  const resolvedLang: Language =
    langState || rawActiveProfile.language || 'bn';
  const resolvedFullName = useMemo(
    () =>
      isReadOnlyDemo
        ? rawActiveProfile.fullName
        : resolveWorkerDisplayName({
            profileFullName: rawActiveProfile.fullName,
            authDisplayName: user?.displayName,
            localAccountName: localAccountFullName,
            email: effectiveEmail,
            lang: resolvedLang,
          }),
    [
      isReadOnlyDemo,
      rawActiveProfile.fullName,
      user?.displayName,
      localAccountFullName,
      effectiveEmail,
      resolvedLang,
    ]
  );

  const activeProfile: WorkerProfile = useMemo(
    () =>
      resolvedFullName && resolvedFullName !== rawActiveProfile.fullName
        ? { ...rawActiveProfile, fullName: resolvedFullName }
        : rawActiveProfile,
    [rawActiveProfile, resolvedFullName]
  );

  const lang: Language = resolvedLang;

  useEffect(() => {
    if (activeProfile?.language && activeProfile.language !== langState) {
      if (typeof window !== 'undefined' && !localStorage.getItem('shromik_sathi_lang')) {
        setLangState(activeProfile.language);
      }
    }
  }, [activeProfile?.language, langState]);

  const withPendingTracking = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setPendingWritesCount((c) => c + 1);
    try {
      return await fn();
    } finally {
      setPendingWritesCount((c) => Math.max(0, c - 1));
    }
  };

  // Automatically flush any pending offline mutations AND reconcile local mirror with Cloud Firestore
  const syncOfflineDataToCloud = useCallback(async (forceRetry = false) => {
    if (isReadOnlyDemo || isSyncingOfflineRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    if (forceRetry === true) {
      nonRetryableFailedMutationsRef.current.clear();
    }

    isSyncingOfflineRef.current = true;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const uid = currentUser.uid;
      const emailKey = (currentUser.email || '').trim().toLowerCase();

      // Merge any legacy email-keyed offline queue into the authenticated uid's queue once
      if (emailKey && !isDemoAccountEmail(emailKey)) {
        const emailQueue = loadOfflineQueue(emailKey);
        const uidQueue = loadOfflineQueue(uid);
        if (emailQueue.length > 0) {
          saveOfflineQueue(uid, mergeOfflineQueues(uidQueue, emailQueue));
          saveOfflineQueue(emailKey, []);
        }
        const emailStore = loadUserStore(emailKey);
        const currentMirror = loadUserMirror(uid);
        const mergedMirrorPatch: Partial<UserLocalMirror> = {};
        if (
          emailStore.profile &&
          !currentMirror.profile &&
          isWorkerSetupCompleted(emailStore.profile)
        ) {
          mergedMirrorPatch.profile = { ...emailStore.profile, userId: uid };
        }
        for (const col of SUBCOLLECTION_KEYS) {
          const emailItems = ((emailStore as Record<string, any>)[col] as Array<{ id: string }>) || [];
          const mirrorItems = (currentMirror[col] as Array<{ id: string }>) || [];
          if (emailItems.length > 0 && mirrorItems.length === 0) {
            mergedMirrorPatch[col] = mergeById(
              mirrorItems,
              emailItems.map((it) => ({ ...it, userId: uid }))
            ) as any;
          }
        }
        if (Object.keys(mergedMirrorPatch).length > 0) {
          saveUserMirror(uid, mergedMirrorPatch, { fromRemoteSnapshot: true });
        }
      }

      const queue = loadOfflineQueue(uid);
      const mirror = loadUserMirror(uid);

      const setterByCollection: Record<
        Exclude<OfflineSyncCollection, 'profile' | 'userDirectory'>,
        React.Dispatch<React.SetStateAction<any[]>>
      > = {
        overtime: setFbOvertime,
        salaryRecords: setFbSalaryRecords,
        payments: setFbPayments,
        attendance: setFbAttendance,
        expenses: setFbExpenses,
        savings: setFbSavings,
        documents: setFbDocuments,
        reminders: setFbReminders,
        loans: setFbLoans,
        workplaces: setFbWorkplaces,
        contacts: setFbContacts,
        alarms: setFbAlarms,
      };

      await withPendingTracking(async () => {
        await ensureParentProfileInFirestore(currentUser, mirror.profile || undefined);
        let hadPermError = false;

        // 1. Flush explicit offline queue mutations first
        for (const mut of queue) {
          const syncKey = `${mut.collection}:${mut.docId}`;
          const targetPayload =
            mut.collection === 'profile'
              ? ((mirror.profile || mut.payload) as Record<string, unknown> | undefined)
              : mut.collection !== 'userDirectory' && mut.action === 'upsert'
              ? (((mirror[mut.collection] as Array<Record<string, any>>)?.find(
                  (x) => x.id === mut.docId
                ) || mut.payload) as Record<string, unknown> | undefined)
              : (mut.payload as Record<string, unknown> | undefined);
          const mutSig = computePayloadSignature(mut.action, targetPayload);

          if (
            inFlightSyncKeysRef.current.has(syncKey) ||
            nonRetryableFailedMutationsRef.current.get(syncKey) === mutSig
          ) {
            continue;
          }
          inFlightSyncKeysRef.current.add(syncKey);
          try {
            if (mut.collection === 'userDirectory') {
              await syncUserDirectoryEntry(currentUser, {
                displayName:
                  typeof mut.payload?.displayName === 'string' && mut.payload.displayName.trim()
                    ? mut.payload.displayName
                    : undefined,
                language:
                  mut.payload?.language === 'en' || mut.payload?.language === 'bn'
                    ? mut.payload.language
                    : langStateRef.current,
              });
            } else if (mut.collection === 'profile' && mut.action === 'upsert') {
              const profToUpload = mirror.profile || (mut.payload as WorkerProfile | undefined);
              if (profToUpload) {
                await persistWorkerProfileDoc(uid, profToUpload, currentUser.displayName);
              }
              clearOfflineMutation(uid, 'profile', mut.docId);
            } else if (mut.action === 'upsert' && mut.collection !== 'profile') {
              const list = (mirror[mut.collection] as Array<Record<string, any>>) || [];
              const itemToUpload = list.find((x) => x.id === mut.docId) || mut.payload;
              if (itemToUpload && mut.docId) {
                await upsertSubcollectionDoc(
                  uid,
                  mut.collection,
                  mut.docId,
                  itemToUpload as Record<string, any>
                );
              }
              clearOfflineMutation(uid, mut.collection, mut.docId);
            } else if (mut.action === 'delete' && mut.collection !== 'profile') {
              await deleteDoc(doc(db, 'users', uid, mut.collection, mut.docId));
              remoteKnownDocIdsRef.current[mut.collection]?.delete(mut.docId);
              clearOfflineMutation(uid, mut.collection, mut.docId);
            }
            nonRetryableFailedMutationsRef.current.delete(syncKey);
          } catch (err) {
            if (isPermissionDeniedError(err)) {
              hadPermError = true;
              nonRetryableFailedMutationsRef.current.set(syncKey, mutSig);
            }
            reportFirestoreFailure(
              err,
              mut.action === 'delete' ? OperationType.DELETE : OperationType.WRITE,
              mut.collection === 'userDirectory'
                ? `userDirectory/${uid}`
                : mut.collection === 'profile'
                ? `users/${uid}`
                : `users/${uid}/${mut.collection}/${mut.docId}`,
              setCloudSyncError
            );
          } finally {
            inFlightSyncKeysRef.current.delete(syncKey);
          }
        }

        // 2. Reconcile profile directly with the live Firestore server
        try {
          const userDocRef = doc(db, 'users', uid);
          const profSnap = await getDocFromServer(userDocRef);
          const latestMirrorProf = loadUserMirror(uid).profile;
          if (profSnap.exists()) {
            const remoteProf = profSnap.data() as WorkerProfile;
            const localHasSetup = Boolean(
              latestMirrorProf && isWorkerSetupCompleted(latestMirrorProf)
            );
            const remoteHasSetup = isWorkerSetupCompleted(remoteProf);
            const mergedProfile: WorkerProfile =
              localHasSetup && !remoteHasSetup
                ? {
                    ...defaultWorkerProfile(uid, currentUser.displayName),
                    ...remoteProf,
                    ...(latestMirrorProf || {}),
                    userId: uid,
                  }
                : {
                    ...defaultWorkerProfile(uid, currentUser.displayName),
                    ...(latestMirrorProf || {}),
                    ...remoteProf,
                    userId: uid,
                  };
            setFbProfile(mergedProfile);
            saveUserMirror(uid, { profile: mergedProfile }, { fromRemoteSnapshot: true });
            if (localHasSetup && !remoteHasSetup) {
              await persistWorkerProfileDoc(uid, mergedProfile, currentUser.displayName, true);
            }
          } else if (latestMirrorProf) {
            await persistWorkerProfileDoc(uid, latestMirrorProf, currentUser.displayName, false);
          }
        } catch {
          // ignore transient server profile check errors
        }

        // 3. Reconcile all 12 subcollections between local mirror and live Firestore server
        const latestMirror = loadUserMirror(uid);
        const remainingQueue = loadOfflineQueue(uid);
        for (const col of SUBCOLLECTION_KEYS) {
          try {
            const colRef = collection(db, 'users', uid, col);
            const q = query(colRef, where('userId', '==', uid));
            const serverSnap = await getDocsFromServer(q);
            const remoteList = serverSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            remoteKnownDocIdsRef.current[col] = new Set(serverSnap.docs.map((d) => d.id));
            const localList = (latestMirror[col] as Array<{ id: string }>) || [];

            const { mergedItems, itemsToUploadToCloud, idsToDeleteFromCloud } =
              reconcileCollectionWithOfflineState({
                collection: col,
                localItems: localList,
                remoteItems: remoteList,
                queue: remainingQueue,
              });

            saveUserMirror(uid, { [col]: mergedItems }, { fromRemoteSnapshot: true });
            setterByCollection[col](mergedItems);

            for (const item of itemsToUploadToCloud) {
              if (!item?.id) continue;
              const syncKey = `${col}:${item.id}`;
              const itemSig = computePayloadSignature('upsert', item as Record<string, unknown>);
              if (
                inFlightSyncKeysRef.current.has(syncKey) ||
                nonRetryableFailedMutationsRef.current.get(syncKey) === itemSig
              ) {
                continue;
              }
              inFlightSyncKeysRef.current.add(syncKey);
              try {
                await upsertSubcollectionDoc(uid, col, item.id, item as Record<string, any>);
                clearOfflineMutation(uid, col, item.id);
                nonRetryableFailedMutationsRef.current.delete(syncKey);
              } catch (err) {
                if (isPermissionDeniedError(err)) {
                  hadPermError = true;
                  nonRetryableFailedMutationsRef.current.set(syncKey, itemSig);
                }
                reportFirestoreFailure(
                  err,
                  OperationType.WRITE,
                  `users/${uid}/${col}/${item.id}`,
                  setCloudSyncError
                );
              } finally {
                inFlightSyncKeysRef.current.delete(syncKey);
              }
            }

            for (const delId of idsToDeleteFromCloud) {
              const syncKey = `${col}:${delId}`;
              const delSig = computePayloadSignature('delete');
              if (
                inFlightSyncKeysRef.current.has(syncKey) ||
                nonRetryableFailedMutationsRef.current.get(syncKey) === delSig
              ) {
                continue;
              }
              inFlightSyncKeysRef.current.add(syncKey);
              try {
                await deleteDoc(doc(db, 'users', uid, col, delId));
                remoteKnownDocIdsRef.current[col]?.delete(delId);
                clearOfflineMutation(uid, col, delId);
                nonRetryableFailedMutationsRef.current.delete(syncKey);
              } catch (err) {
                if (isPermissionDeniedError(err)) {
                  hadPermError = true;
                  nonRetryableFailedMutationsRef.current.set(syncKey, delSig);
                }
              } finally {
                inFlightSyncKeysRef.current.delete(syncKey);
              }
            }
          } catch {
            // ignore transient network error on individual collection
          }
        }

        if (!hadPermError && loadOfflineQueue(uid).length === 0) {
          setCloudSyncError('');
        }
      });
    } finally {
      isSyncingOfflineRef.current = false;
      refreshOfflinePendingCount();
    }
  }, [
    activeLocalEmail,
    ensureParentProfileInFirestore,
    persistWorkerProfileDoc,
    isReadOnlyDemo,
    refreshOfflinePendingCount,
    syncUserDirectoryEntry,
    upsertSubcollectionDoc,
    liveAuthUid,
  ]);

  // Auto-align selectedMonth once per user session when cloud data loads if current selectedMonth has 0 records
  useEffect(() => {
    if (!user || isDemoMode || !cloudDataLoaded) return;
    if (autoAlignedMonthUidRef.current === user.uid) return;

    const hasRecordsInMonth = (m: string) =>
      fbOvertime.some((o) => o.month === m) ||
      fbAttendance.some((a) => a.month === m) ||
      fbSalaryRecords.some((s) => s.month === m) ||
      fbPayments.some((p) => p.month === m) ||
      fbExpenses.some((e) => e.month === m);

    const allDataMonths = new Set<string>();
    for (const o of fbOvertime) if (o.month) allDataMonths.add(o.month);
    for (const a of fbAttendance) if (a.month) allDataMonths.add(a.month);
    for (const s of fbSalaryRecords) if (s.month) allDataMonths.add(s.month);
    for (const p of fbPayments) if (p.month) allDataMonths.add(p.month);
    for (const e of fbExpenses) if (e.month) allDataMonths.add(e.month);

    if (allDataMonths.size === 0) return;

    autoAlignedMonthUidRef.current = user.uid;
    if (!hasRecordsInMonth(selectedMonth)) {
      const sortedMonths = Array.from(allDataMonths).sort().reverse();
      if (sortedMonths[0]) {
        setSelectedMonth(sortedMonths[0]);
      }
    }
  }, [
    user,
    isDemoMode,
    cloudDataLoaded,
    selectedMonth,
    fbOvertime,
    fbAttendance,
    fbSalaryRecords,
    fbPayments,
    fbExpenses,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnlineOrFocus = () => {
      if (document.visibilityState === 'visible' || navigator.onLine) {
        void syncOfflineDataToCloud();
      }
    };
    window.addEventListener('online', handleOnlineOrFocus);
    window.addEventListener('focus', handleOnlineOrFocus);
    document.addEventListener('visibilitychange', handleOnlineOrFocus);

    if (navigator.onLine) {
      void syncOfflineDataToCloud();
    }

    // Periodic 15s check when online so any offline-entered data automatically syncs to Firestore
    const autoSyncTimer = window.setInterval(() => {
      if (
        navigator.onLine &&
        auth.currentUser &&
        loadOfflineQueue(auth.currentUser.uid).length > 0
      ) {
        void syncOfflineDataToCloud();
      }
    }, 15000);

    return () => {
      window.clearInterval(autoSyncTimer);
      window.removeEventListener('online', handleOnlineOrFocus);
      window.removeEventListener('focus', handleOnlineOrFocus);
      document.removeEventListener('visibilitychange', handleOnlineOrFocus);
    };
  }, [syncOfflineDataToCloud]);

  // Subscription Firestore synchronization
  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, 'subscriptionConfig', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as GlobalSubscriptionConfig;
          setSubscriptionConfig((prev) => {
            // If the admin made a more recent change locally in this browser, preserve it
            let localV4: GlobalSubscriptionConfig | null = null;
            if (typeof window !== 'undefined') {
              try {
                const rawV4 = localStorage.getItem('shromik_sathi_sub_config_v4');
                if (rawV4) localV4 = JSON.parse(rawV4);
              } catch {
                // ignore
              }
            }
            if (
              localV4?.updatedAt &&
              (!data.updatedAt || localV4.updatedAt > data.updatedAt)
            ) {
              return {
                ...DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG,
                ...data,
                ...localV4,
              };
            }

            const effectiveEnabled =
              typeof data.enabled === 'boolean' ? data.enabled : prev.enabled;
            const effectiveWarningDays =
              typeof data.renewalWarningDays === 'number' && data.renewalWarningDays >= 0
                ? data.renewalWarningDays
                : prev.renewalWarningDays ?? 5;
            const merged: GlobalSubscriptionConfig = {
              ...prev,
              ...data,
              enabled: effectiveEnabled,
              renewalWarningDays: effectiveWarningDays,
              paymentNumberBkash:
                (data.paymentNumberBkash || '').trim() ||
                prev.paymentNumberBkash ||
                DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG.paymentNumberBkash,
              paymentNumberNagad:
                (data.paymentNumberNagad || '').trim() ||
                prev.paymentNumberNagad ||
                DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG.paymentNumberNagad,
            };
            if (typeof window !== 'undefined') {
              localStorage.setItem('shromik_sathi_sub_config', JSON.stringify(merged));
              localStorage.setItem('shromik_sathi_sub_config_v4', JSON.stringify(merged));
            }
            return merged;
          });
        }
      },
      (err) => logFirestoreWarning(err, OperationType.GET, 'subscriptionConfig/global')
    );

    const unsubPlans = onSnapshot(
      doc(db, 'subscriptionConfig', 'plans_catalog'),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.plans)) {
          const plans = snap.data().plans as SubscriptionPlan[];
          setSubscriptionPlans(plans);
          localStorage.setItem('shromik_sathi_sub_plans', JSON.stringify(plans));
        }
      },
      (err) => logFirestoreWarning(err, OperationType.GET, 'subscriptionConfig/plans_catalog')
    );

    const unsubCoupons = onSnapshot(
      doc(db, 'subscriptionConfig', 'coupons_catalog'),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.coupons)) {
          const remoteCoupons = snap.data().coupons as CouponCode[];
          setCoupons(remoteCoupons);
          localStorage.setItem('shromik_sathi_coupons', JSON.stringify(remoteCoupons));
        }
      },
      (err) => logFirestoreWarning(err, OperationType.GET, 'subscriptionConfig/coupons_catalog')
    );

    return () => {
      unsubConfig();
      unsubPlans();
      unsubCoupons();
    };
  }, []);

  // Listen to user's subscription record (without forcing any fake 5-day remaining subscription)
  useEffect(() => {
    const readLocalUserSub = (...keys: (string | undefined | null)[]): UserSubscriptionRecord | null => {
      if (typeof window === 'undefined') return null;
      try {
        const subsMapRaw = localStorage.getItem('shromik_sathi_user_subs_v4');
        if (!subsMapRaw) return null;
        const subsMap = JSON.parse(subsMapRaw) as Record<string, UserSubscriptionRecord | null>;
        for (const k of keys) {
          if (k && subsMap[k] !== undefined) {
            return subsMap[k];
          }
        }
        if (subsMap['current'] !== undefined) {
          return subsMap['current'];
        }
      } catch {
        // ignore
      }
      return null;
    };

    const writeLocalUserSub = (record: UserSubscriptionRecord | null, ...keys: (string | undefined | null)[]) => {
      if (typeof window === 'undefined') return;
      try {
        const subsMapRaw = localStorage.getItem('shromik_sathi_user_subs_v4');
        const subsMap: Record<string, UserSubscriptionRecord | null> = subsMapRaw
          ? JSON.parse(subsMapRaw)
          : {};
        for (const k of keys) {
          if (k) subsMap[k] = record;
        }
        subsMap['current'] = record;
        localStorage.setItem('shromik_sathi_user_subs_v4', JSON.stringify(subsMap));
      } catch {
        // ignore
      }
    };

    if (!user || isDemoMode || !auth.currentUser || auth.currentUser.uid !== user.uid) {
      const localRecord = readLocalUserSub(
        user?.uid || activeLocalEmail,
        user?.email || activeProfile?.userId,
        activeLocalEmail || 'demo_worker'
      );
      setUserSubscription(localRecord);
      return;
    }

    const unsubUserSub = onSnapshot(
      doc(db, 'userSubscriptions', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserSubscriptionRecord;
          setUserSubscription(data);
          writeLocalUserSub(data, user.uid, user.email);
        } else {
          const localRecord = readLocalUserSub(user.uid, user.email, activeLocalEmail);
          setUserSubscription(localRecord);
        }
      },
      (err) => logFirestoreWarning(err, OperationType.GET, `userSubscriptions/${user.uid}`)
    );
    return () => unsubUserSub();
  }, [user, isDemoMode, activeLocalEmail, activeProfile?.userId, todayISO]);

  const resolvedActive = resolveUserActivePlan({
    isSystemEnabled: Boolean(subscriptionConfig.enabled),
    userSub: userSubscription,
    plans: subscriptionPlans,
    todayISO,
  });

  const activePlan = resolvedActive.plan;

  const isSubscriptionSystemEnabled = Boolean(subscriptionConfig.enabled);

  const subscriptionRenewalNotice = computeSubscriptionRenewalNotice({
    isSystemEnabled: isSubscriptionSystemEnabled,
    userSub: userSubscription,
    plans: subscriptionPlans,
    todayISO,
    warningThresholdDays: subscriptionConfig.renewalWarningDays ?? 5,
  });

  const checkFeatureAccess = useCallback(
    (
      featureKey: FeatureKey,
      currentCount?: number,
      requireExport?: boolean,
      requireAdvanced?: boolean
    ): FeatureAccessCheckResult => {
      return canAccessFeature({
        isSystemEnabled: Boolean(subscriptionConfig.enabled),
        userSub: userSubscription,
        plans: subscriptionPlans,
        feature: featureKey,
        currentCount,
        requireExport,
        requireAdvanced,
        todayISO,
      });
    },
    [subscriptionConfig.enabled, userSubscription, subscriptionPlans, todayISO]
  );

  const updateGlobalSubscriptionConfig = useCallback(
    async (patch: Partial<GlobalSubscriptionConfig>) => {
      const nextConfig: GlobalSubscriptionConfig = {
        ...subscriptionConfig,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      setSubscriptionConfig(nextConfig);
      if (typeof window !== 'undefined') {
        localStorage.setItem('shromik_sathi_sub_config', JSON.stringify(nextConfig));
        localStorage.setItem('shromik_sathi_sub_config_v4', JSON.stringify(nextConfig));
      }
      if (user && !isDemoMode && isVerifiedAdminRef.current) {
        try {
          await setDoc(
            doc(db, 'subscriptionConfig', 'global'),
            sanitizeFirestorePayload(nextConfig as unknown as Record<string, unknown>),
            { merge: true }
          );
        } catch (err) {
          logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/global');
        }
      }
    },
    [subscriptionConfig, user, isDemoMode]
  );

  const saveSubscriptionPlan = useCallback(
    async (plan: SubscriptionPlan) => {
      const val = validatePlanInput(plan);
      if (!val.valid) {
        throw new Error(val.errorBn || 'প্ল্যান তথ্য সঠিক নয়');
      }
      const existingIdx = subscriptionPlans.findIndex((p) => p.id === plan.id);
      let nextPlans: SubscriptionPlan[];
      if (existingIdx >= 0) {
        nextPlans = [...subscriptionPlans];
        nextPlans[existingIdx] = { ...plan, updatedAt: new Date().toISOString() };
      } else {
        nextPlans = [
          ...subscriptionPlans,
          {
            ...plan,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      setSubscriptionPlans(nextPlans);
      localStorage.setItem('shromik_sathi_sub_plans', JSON.stringify(nextPlans));
      if (user && !isDemoMode && isVerifiedAdminRef.current) {
        try {
          await setDoc(
            doc(db, 'subscriptionConfig', 'plans_catalog'),
            sanitizeFirestorePayload({ plans: nextPlans, updatedAt: new Date().toISOString() }),
            { merge: true }
          );
        } catch (err) {
          logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/plans_catalog');
        }
      }
    },
    [subscriptionPlans, user, isDemoMode]
  );

  const deleteSubscriptionPlan = useCallback(
    async (planId: string) => {
      if (isReadOnlyDemo) {
        triggerReadOnlyBlock();
        return;
      }
      const nextPlans = subscriptionPlans.filter((p) => p.id !== planId);
      setSubscriptionPlans(nextPlans);
      localStorage.setItem('shromik_sathi_sub_plans', JSON.stringify(nextPlans));
      if (user && !isDemoMode && isVerifiedAdminRef.current) {
        try {
          await setDoc(
            doc(db, 'subscriptionConfig', 'plans_catalog'),
            sanitizeFirestorePayload({ plans: nextPlans, updatedAt: new Date().toISOString() }),
            { merge: true }
          );
        } catch (err) {
          logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/plans_catalog');
        }
      }
    },
    [subscriptionPlans, isReadOnlyDemo, triggerReadOnlyBlock, user, isDemoMode]
  );

  const saveCoupon = useCallback(
    async (coupon: CouponCode) => {
      if (isReadOnlyDemo) {
        triggerReadOnlyBlock();
        return;
      }
      const existingIdx = coupons.findIndex((c) => c.id === coupon.id || c.code.toUpperCase() === coupon.code.toUpperCase());
      const cleanCoupon = {
        ...coupon,
        code: coupon.code.trim().toUpperCase(),
        updatedAt: new Date().toISOString(),
      };
      let nextCoupons: CouponCode[];
      if (existingIdx >= 0) {
        nextCoupons = [...coupons];
        nextCoupons[existingIdx] = cleanCoupon;
      } else {
        nextCoupons = [cleanCoupon, ...coupons];
      }
      setCoupons(nextCoupons);
      localStorage.setItem('shromik_sathi_coupons', JSON.stringify(nextCoupons));
      if (user && !isDemoMode && isVerifiedAdminRef.current) {
        try {
          await setDoc(
            doc(db, 'subscriptionConfig', 'coupons_catalog'),
            sanitizeFirestorePayload({ coupons: nextCoupons, updatedAt: new Date().toISOString() }),
            { merge: true }
          );
        } catch (err) {
          logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/coupons_catalog');
        }
      }
    },
    [coupons, isReadOnlyDemo, triggerReadOnlyBlock, user, isDemoMode]
  );

  const deleteCoupon = useCallback(
    async (couponId: string) => {
      if (isReadOnlyDemo) {
        triggerReadOnlyBlock();
        return;
      }
      const nextCoupons = coupons.filter((c) => c.id !== couponId);
      setCoupons(nextCoupons);
      localStorage.setItem('shromik_sathi_coupons', JSON.stringify(nextCoupons));
      if (user && !isDemoMode && isVerifiedAdminRef.current) {
        try {
          await setDoc(
            doc(db, 'subscriptionConfig', 'coupons_catalog'),
            sanitizeFirestorePayload({ coupons: nextCoupons, updatedAt: new Date().toISOString() }),
            { merge: true }
          );
        } catch (err) {
          logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/coupons_catalog');
        }
      }
    },
    [coupons, isReadOnlyDemo, triggerReadOnlyBlock, user, isDemoMode]
  );

  const validateCoupon = useCallback(
    (code: string, planId: string, amountBdt: number) => {
      return validateCouponCode(code, planId, amountBdt, coupons);
    },
    [coupons]
  );

  const requestPlanUpgrade = useCallback(
    async (req: {
      planId: string;
      billingCycle: 'monthly' | 'yearly';
      paymentMethod: 'bkash' | 'nagad' | 'bank' | 'manual';
      transactionId: string;
      senderPhone: string;
      couponCode?: string;
      discountAmountBdt?: number;
      finalAmountBdt?: number;
      isRenewal?: boolean;
      notes?: string;
    }) => {
      if (isReadOnlyDemo) {
        triggerReadOnlyBlock();
        return;
      }
      const effectiveUid = user?.uid || activeProfile.userId || 'local_worker';
      const selectedPlan = subscriptionPlans.find((p) => p.id === req.planId);
      const originalAmount =
        req.billingCycle === 'yearly'
          ? selectedPlan?.pricing?.yearlyPriceBdt ?? (selectedPlan?.priceBDT ? selectedPlan.priceBDT * 10 : 0)
          : selectedPlan?.pricing?.monthlyPriceBdt ?? (selectedPlan?.priceBDT ?? 0);

      const discountAmount = req.discountAmountBdt || 0;
      const finalAmount = req.finalAmountBdt !== undefined ? req.finalAmountBdt : Math.max(0, originalAmount - discountAmount);
      const nowISO = new Date().toISOString();

      const rawPaymentRequest: SubscriptionPaymentRequest = {
        id: makeStableId('payreq'),
        userId: effectiveUid,
        userName: user?.displayName || activeProfile.fullName || 'শ্রমিক ব্যবহারকারী',
        userPhone: activeProfile.phone || req.senderPhone,
        planId: req.planId,
        billingCycle: req.billingCycle,
        amountBdt: originalAmount,
        discountAmountBdt: discountAmount,
        finalAmountBdt: finalAmount,
        ...(req.couponCode ? { couponCode: req.couponCode.trim() } : {}),
        isRenewal: Boolean(req.isRenewal),
        paymentMethod: req.paymentMethod,
        transactionId: req.transactionId.trim(),
        senderPhone: req.senderPhone.trim(),
        requestedAt: nowISO,
        status: 'pending',
        ...(req.notes ? { notes: req.notes.trim() } : {}),
      };
      const paymentRequest = sanitizeFirestorePayload(
        rawPaymentRequest as unknown as Record<string, unknown>
      ) as unknown as SubscriptionPaymentRequest;

      if (req.couponCode) {
        const cleanCode = req.couponCode.trim().toUpperCase();
        const updatedCoupons = coupons.map((c) =>
          c.code.toUpperCase() === cleanCode ? { ...c, usedCount: c.usedCount + 1 } : c
        );
        setCoupons(updatedCoupons);
        localStorage.setItem('shromik_sathi_coupons', JSON.stringify(updatedCoupons));
      }

      const nextRecord: UserSubscriptionRecord = {
        ...(userSubscription || {
          userId: effectiveUid,
          userEmail: user?.email || '',
          userDisplayName: user?.displayName || activeProfile.fullName || '',
          planId: 'starter_free',
          status: 'free',
          billingCycle: 'monthly',
          startedAt: nowISO,
        }),
        pendingRequest: paymentRequest,
        updatedAt: nowISO,
      };

      setUserSubscription(nextRecord);
      if (typeof window !== 'undefined') {
        try {
          const subsMapRaw = localStorage.getItem('shromik_sathi_user_subs_v4');
          const subsMap = subsMapRaw ? JSON.parse(subsMapRaw) : {};
          subsMap[effectiveUid] = nextRecord;
          if (user?.email) subsMap[user.email] = nextRecord;
          if (activeLocalEmail) subsMap[activeLocalEmail] = nextRecord;
          subsMap['current'] = nextRecord;
          localStorage.setItem('shromik_sathi_user_subs_v4', JSON.stringify(subsMap));
        } catch {
          // ignore
        }
      }
      if (user && !isDemoMode) {
        try {
          const subRef = doc(db, 'userSubscriptions', user.uid);
          const existingSnap = await getDoc(subRef).catch(() => null);
          const mutation = buildUserSubscriptionUpgradeMutation({
            uid: user.uid,
            userEmail: user.email || '',
            userDisplayName: user.displayName || activeProfile.fullName || '',
            pendingRequest: paymentRequest as unknown as Record<string, unknown>,
            nowISO,
            docExists: Boolean(existingSnap?.exists()),
          });
          if (mutation.mode === 'set') {
            await setDoc(subRef, mutation.payload);
          } else {
            await updateDoc(subRef, mutation.payload);
          }
        } catch (err) {
          logFirestoreWarning(err, OperationType.UPDATE, `userSubscriptions/${user.uid}`);
        }
      }
    },
    [
      isReadOnlyDemo,
      triggerReadOnlyBlock,
      user,
      isDemoMode,
      activeLocalEmail,
      subscriptionPlans,
      coupons,
      userSubscription,
      activeProfile.fullName,
      activeProfile.userId,
      activeProfile.phone,
    ]
  );

  const adminAssignUserPlan = useCallback(
    async (
      targetUid: string,
      assignment: {
        planId: string;
        billingCycle?: 'monthly' | 'yearly' | 'custom' | 'lifetime';
        reason: string;
        expiresAt?: string | null;
        customDaysRemaining?: number | null;
        isComplimentary?: boolean;
      }
    ) => {
      const cleanTarget = targetUid.trim();
      const targetPlan = subscriptionPlans.find((p) => p.id === assignment.planId);
      const targetTier = targetPlan?.tier || (assignment.planId === 'starter_free' ? 'starter_free' : 'pro');
      const isFreePlan =
        assignment.planId === 'starter_free' ||
        targetTier === 'starter_free' ||
        Boolean(targetPlan?.pricing?.isFree);
      const nowISO = new Date().toISOString();

      let startDateStr = todayISO;
      let endDateStr: string | null = null;
      let defaultExp: string | null = null;

      if (!isFreePlan) {
        if (typeof assignment.customDaysRemaining === 'number') {
          const totalDays = assignment.billingCycle === 'yearly' ? 365 : 30;
          const remDays = Math.max(0, Math.round(assignment.customDaysRemaining));
          const elapsedDays = Math.max(0, totalDays - remDays);
          const parts = todayISO.slice(0, 10).split('-').map(Number);
          const y = parts[0] || 2026;
          const m = parts[1] || 1;
          const d = parts[2] || 1;
          startDateStr = new Date(Date.UTC(y, m - 1, d - elapsedDays)).toISOString().slice(0, 10);
          endDateStr = new Date(Date.UTC(y, m - 1, d + remDays)).toISOString().slice(0, 10);
          defaultExp = `${endDateStr}T23:59:59.000Z`;
        } else if (assignment.expiresAt !== undefined) {
          defaultExp = assignment.expiresAt;
          endDateStr = defaultExp ? defaultExp.slice(0, 10) : null;
        } else if (assignment.billingCycle === 'monthly') {
          const parts = todayISO.slice(0, 10).split('-').map(Number);
          endDateStr = new Date(Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, (parts[2] || 1) + 30))
            .toISOString()
            .slice(0, 10);
          defaultExp = `${endDateStr}T23:59:59.000Z`;
        } else if (assignment.billingCycle === 'yearly') {
          const parts = todayISO.slice(0, 10).split('-').map(Number);
          endDateStr = new Date(Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, (parts[2] || 1) + 365))
            .toISOString()
            .slice(0, 10);
          defaultExp = `${endDateStr}T23:59:59.000Z`;
        }
      }

      const nextRecord: UserSubscriptionRecord = {
        userId: cleanTarget,
        planId: assignment.planId,
        tier: targetTier,
        status: isFreePlan ? 'free' : 'active',
        billingCycle: isFreePlan ? 'lifetime' : assignment.billingCycle || 'monthly',
        startedAt: `${startDateStr}T00:00:00.000Z`,
        startDate: startDateStr,
        expiresAt: isFreePlan ? null : defaultExp,
        endDate: isFreePlan ? null : endDateStr,
        isComplimentary: isFreePlan ? false : (assignment.isComplimentary ?? false),
        ...(assignment.isComplimentary && assignment.reason
          ? { complimentaryReason: assignment.reason }
          : {}),
        grantedByAdminUid: user?.uid || 'admin',
        ...(user?.email || activeLocalEmail
          ? { grantedByAdminEmail: user?.email || activeLocalEmail }
          : {}),
        updatedAt: nowISO,
      };

      const isCurrentActiveUser =
        cleanTarget === 'current' ||
        cleanTarget === user?.uid ||
        (user?.email && cleanTarget.toLowerCase() === user.email.toLowerCase()) ||
        (activeLocalEmail && cleanTarget.toLowerCase() === activeLocalEmail.toLowerCase()) ||
        cleanTarget === activeProfile?.userId;

      if (typeof window !== 'undefined') {
        try {
          const subsMapRaw = localStorage.getItem('shromik_sathi_user_subs_v4');
          const subsMap = subsMapRaw ? JSON.parse(subsMapRaw) : {};
          subsMap[cleanTarget] = nextRecord;
          if (isCurrentActiveUser) {
            if (user?.uid) subsMap[user.uid] = nextRecord;
            if (user?.email) subsMap[user.email] = nextRecord;
            if (activeLocalEmail) subsMap[activeLocalEmail] = nextRecord;
            if (activeProfile?.userId) subsMap[activeProfile.userId] = nextRecord;
            subsMap['current'] = nextRecord;
          }
          localStorage.setItem('shromik_sathi_user_subs_v4', JSON.stringify(subsMap));
        } catch {
          // ignore
        }
      }

      if (isCurrentActiveUser) {
        setUserSubscription(nextRecord);
      }

      const safeFirestoreId =
        isCurrentActiveUser && user?.uid
          ? user.uid
          : cleanTarget.replace(/[^a-zA-Z0-9_-]/g, '_');

      if (user && !isDemoMode && isVerifiedAdminRef.current) {
        try {
          await setDoc(
            doc(db, 'userSubscriptions', safeFirestoreId),
            sanitizeFirestorePayload(nextRecord as unknown as Record<string, unknown>),
            { merge: true }
          );
        } catch (err) {
          logFirestoreWarning(err, OperationType.UPDATE, `userSubscriptions/${safeFirestoreId}`);
        }
      }
    },
    [subscriptionPlans, user, isDemoMode, activeLocalEmail, activeProfile?.userId, todayISO]
  );

  const adminProcessPaymentRequest = useCallback(
    async (targetUid: string, approved: boolean, note?: string) => {
      try {
        const targetDocRef = doc(db, 'userSubscriptions', targetUid);
        const snap = await getDoc(targetDocRef);
        const data = snap.exists()
          ? (snap.data() as UserSubscriptionRecord)
          : userSubscription?.userId === targetUid
          ? userSubscription
          : null;
        if (!data || !data.pendingRequest) return;

        const nowISO = new Date().toISOString();
        const updatedPending: SubscriptionPaymentRequest = {
          ...data.pendingRequest,
          status: approved ? 'approved' : 'rejected',
          verifiedAt: nowISO,
          ...(user?.uid ? { verifiedByAdminUid: user.uid } : {}),
          ...(note ? { adminNotes: note } : {}),
        };

        let patch: Partial<UserSubscriptionRecord> = {
          pendingRequest: sanitizeFirestorePayload(
            updatedPending as unknown as Record<string, unknown>
          ) as unknown as SubscriptionPaymentRequest,
          updatedAt: nowISO,
        };

        if (approved) {
          const targetPlan = subscriptionPlans.find((p) => p.id === data.pendingRequest?.planId);
          const parts = todayISO.slice(0, 10).split('-').map(Number);
          const daysToAdd = data.pendingRequest?.billingCycle === 'yearly' ? 365 : 30;
          const endDateStr = new Date(
            Date.UTC(parts[0] || 2026, (parts[1] || 1) - 1, (parts[2] || 1) + daysToAdd)
          )
            .toISOString()
            .slice(0, 10);
          patch = {
            ...patch,
            planId: data.pendingRequest.planId,
            tier: targetPlan?.tier || 'starter_free',
            status: 'active',
            billingCycle: data.pendingRequest.billingCycle,
            startedAt: nowISO,
            startDate: todayISO,
            expiresAt: `${endDateStr}T23:59:59.000Z`,
            endDate: endDateStr,
            paymentHistory: [...(data.paymentHistory || []), updatedPending],
          };
        }

        const sanitizedPatch = sanitizeFirestorePayload(patch as unknown as Record<string, unknown>);
        const mergedRecord = { ...data, ...sanitizedPatch } as UserSubscriptionRecord;
        if (user?.uid === targetUid || userSubscription?.userId === targetUid) {
          setUserSubscription(mergedRecord);
          if (typeof window !== 'undefined') {
            try {
              const subsMapRaw = localStorage.getItem('shromik_sathi_user_subs_v4');
              const subsMap = subsMapRaw ? JSON.parse(subsMapRaw) : {};
              subsMap[targetUid] = mergedRecord;
              subsMap['current'] = mergedRecord;
              localStorage.setItem('shromik_sathi_user_subs_v4', JSON.stringify(subsMap));
            } catch {
              // ignore
            }
          }
        }
        if (snap.exists() && isVerifiedAdminRef.current) {
          await updateDoc(targetDocRef, sanitizedPatch);
        }
      } catch (err) {
        logFirestoreWarning(err, OperationType.UPDATE, `userSubscriptions/${targetUid}`);
      }
    },
    [user, subscriptionPlans, userSubscription, todayISO]
  );

  const updateProfile = useCallback(
    async (patch: Partial<WorkerProfile>) => {
      if (isReadOnlyDemo) {
        triggerReadOnlyBlock();
        return;
      }
      const merged: WorkerProfile = {
        ...activeProfile,
        ...patch,
        language: patch.language ?? activeProfile.language ?? langState,
        fullName: (patch.fullName ?? activeProfile.fullName).slice(0, 120),
        photoUrl: (patch.photoUrl ?? activeProfile.photoUrl ?? '').slice(0, 150000),
        phone: (patch.phone ?? activeProfile.phone).slice(0, 30),
        address: (patch.address ?? activeProfile.address).slice(0, 300),
        emergencyContact: (patch.emergencyContact ?? activeProfile.emergencyContact).slice(0, 120),
        factoryName: (patch.factoryName ?? activeProfile.factoryName).slice(0, 150),
        factoryBranch: (patch.factoryBranch ?? activeProfile.factoryBranch).slice(0, 120),
        department: (patch.department ?? activeProfile.department).slice(0, 100),
        designation: (patch.designation ?? activeProfile.designation).slice(0, 100),
        employeeId: (patch.employeeId ?? activeProfile.employeeId).slice(0, 60),
        salaryGrade: (patch.salaryGrade ?? activeProfile.salaryGrade).slice(0, 40),
        otCalculationMode: patch.otCalculationMode ?? activeProfile.otCalculationMode ?? 'formula',
        otCustomHourlyRate: Number(patch.otCustomHourlyRate ?? activeProfile.otCustomHourlyRate ?? 0),
        shiftPattern: patch.shiftPattern ?? activeProfile.shiftPattern ?? 'day',
        dayShiftStartTime: (patch.dayShiftStartTime ?? activeProfile.dayShiftStartTime ?? '08:00').slice(0, 10),
        nightShiftStartTime: (patch.nightShiftStartTime ?? activeProfile.nightShiftStartTime ?? '20:00').slice(0, 10),
        rotationStartDate: (patch.rotationStartDate ?? activeProfile.rotationStartDate ?? '2026-10-01').slice(0, 20),
        attendanceWindowStartDay: (patch.attendanceWindowStartDay ?? activeProfile.attendanceWindowStartDay ?? '07:50').slice(0, 10),
        attendanceWindowEndDay: (patch.attendanceWindowEndDay ?? activeProfile.attendanceWindowEndDay ?? '08:05').slice(0, 10),
        attendanceWindowStartNight: (patch.attendanceWindowStartNight ?? activeProfile.attendanceWindowStartNight ?? '19:50').slice(0, 10),
        attendanceWindowEndNight: (patch.attendanceWindowEndNight ?? activeProfile.attendanceWindowEndNight ?? '20:05').slice(0, 10),
        hasAttendanceBonus: patch.hasAttendanceBonus !== undefined ? Boolean(patch.hasAttendanceBonus) : Boolean(activeProfile.hasAttendanceBonus !== false),
        attendanceBonusAmount: Number(patch.attendanceBonusAmount ?? activeProfile.attendanceBonusAmount ?? activeProfile.attendanceBonus ?? 600),
        attendanceBonusDays: Number(patch.attendanceBonusDays ?? activeProfile.attendanceBonusDays ?? 30),
        maxConsecutiveAbsences: Number(patch.maxConsecutiveAbsences ?? activeProfile.maxConsecutiveAbsences ?? 0),
        dayBonusCutoffTime: (patch.dayBonusCutoffTime ?? activeProfile.dayBonusCutoffTime ?? '08:05').slice(0, 10),
        nightBonusCutoffTime: (patch.nightBonusCutoffTime ?? activeProfile.nightBonusCutoffTime ?? '20:05').slice(0, 10),
        weeklyHolidayDay: patch.weeklyHolidayDay ?? activeProfile.weeklyHolidayDay ?? 'friday',
        expectedPayDay: Number(patch.expectedPayDay ?? activeProfile.expectedPayDay ?? 7),
        monthlyBudgetTarget: Number(patch.monthlyBudgetTarget ?? activeProfile.monthlyBudgetTarget ?? 9000),
      };

      // Keep active current workplace synced only if factory name is present
      if (
        (patch.factoryName !== undefined ||
          patch.factoryBranch !== undefined ||
          patch.department !== undefined ||
          patch.designation !== undefined ||
          patch.employeeId !== undefined ||
          patch.joiningDate !== undefined) &&
        merged.factoryName.trim().length > 0
      ) {
        const currentWps = isDemoMode || !user ? demoState.workplaces || [] : fbWorkplaces;
        const currentWp = currentWps.find((w) => w.isCurrent);
        const wpId = currentWp?.id || makeStableId('wp_curr');
        void saveWorkplace(
          {
            factoryName: merged.factoryName,
            factoryAddress: merged.factoryBranch,
            factoryArea: merged.factoryBranch,
            department: merged.department,
            floorNumber: '',
            lineNumber: '',
            designation: merged.designation,
            employeeId: merged.employeeId,
            joiningDate: merged.joiningDate,
            shiftPattern: merged.shiftPattern,
            grossSalary: merged.grossSalary,
            basicSalary: merged.basicSalary,
            isCurrent: true,
          },
          wpId
        );
      }

      if (isDemoMode || !user) {
        setDemoState((prev) => {
          const next = { ...prev, profile: merged };
          persistCurrentLocalStore(next);
          return next;
        });
        return;
      }

      // Immediate optimistic update + local offline mirror
      setFbProfile(merged);
      saveUserMirror(user.uid, { profile: merged });
      if (
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        !auth.currentUser ||
        auth.currentUser.uid !== user.uid
      ) {
        refreshOfflinePendingCount();
        return;
      }

      await withPendingTracking(async () => {
        const ensuredStatus = await ensureParentProfileInFirestore(user, merged);
        try {
          if (ensuredStatus !== 'created') {
            await persistWorkerProfileDoc(
              user.uid,
              merged,
              user.displayName,
              profileEnsuredRef.current === user.uid ? true : undefined
            );
          }
          clearOfflineMutation(user.uid, 'profile', 'profile');
          nonRetryableFailedMutationsRef.current.delete('profile:profile');
          setCloudSyncError('');
          refreshOfflinePendingCount();
        } catch (err: any) {
          if (isPermissionDeniedError(err)) {
            const profSig = computePayloadSignature(
              'upsert',
              merged as unknown as Record<string, unknown>
            );
            nonRetryableFailedMutationsRef.current.set('profile:profile', profSig);
          }
          reportFirestoreFailure(
            err,
            OperationType.UPDATE,
            `users/${user.uid}`,
            setCloudSyncError
          );
        }

        if (patch.fullName !== undefined || patch.language !== undefined) {
          void syncUserDirectoryEntry(user, {
            displayName: merged.fullName,
            language: merged.language,
          });
        }
      });
    },
    [
      activeProfile,
      isDemoMode,
      isReadOnlyDemo,
      triggerReadOnlyBlock,
      user,
      ensureParentProfileInFirestore,
      persistWorkerProfileDoc,
      langState,
      fbWorkplaces,
      persistCurrentLocalStore,
      refreshOfflinePendingCount,
      syncUserDirectoryEntry,
    ]
  );

  const setLang = useCallback(
    async (newLang: Language) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('shromik_sathi_lang', newLang);
      }
      setLangState(newLang);
      if (!isReadOnlyDemo) {
        await updateProfile({ language: newLang });
      }
    },
    [isReadOnlyDemo, updateProfile]
  );

  const loginWithGoogle = async (_mode: 'signin' | 'signup' = 'signin') => {
    setIsReadOnlyDemo(false);
    localStorage.removeItem('shromik_sathi_readonly_demo');

    let cred;
    try {
      cred = await signInWithPopup(auth, googleProvider);
    } catch (fbErr) {
      throw new Error(mapFirebaseAuthError(fbErr, lang));
    }
    if (!cred.user) return;

    const uid = cred.user.uid;
    const userEmail = cred.user.email || '';

    // Persist session cache & hydrate ONLY this user's isolated mirror immediately
    persistAuthSessionCache(cred.user);
    prevAuthUidRef.current = uid;
    profileEnsuredRef.current = null;
    directorySyncedRef.current = null;
    autoAlignedMonthUidRef.current = null;
    remoteKnownDocIdsRef.current = {};
    nonRetryableFailedMutationsRef.current.clear();

    const mirror = loadUserMirror(uid);
    const googleResolvedName = resolveBestUserDisplayName(
      [cred.user.displayName, mirror.profile?.fullName],
      userEmail
    );
    const fallbackProf: WorkerProfile = mirror.profile
      ? {
          ...mirror.profile,
          fullName:
            !isGenericWorkerPlaceholderName(mirror.profile.fullName) &&
            mirror.profile.fullName.trim().toLowerCase() !== userEmail.split('@')[0]?.toLowerCase()
              ? mirror.profile.fullName
              : googleResolvedName || cred.user.displayName || mirror.profile.fullName,
          photoUrl: mirror.profile.photoUrl || cred.user.photoURL || '',
        }
      : {
          ...defaultWorkerProfile(uid, cred.user.displayName),
          fullName: googleResolvedName || cred.user.displayName || 'শ্রমিক',
          photoUrl: cred.user.photoURL || '',
          language: lang,
          privacyConsent: true,
        };
    setFbProfile(fallbackProf);
    setFbOvertime(mirror.overtime || []);
    setFbSalaryRecords(mirror.salaryRecords || []);
    setFbPayments(mirror.payments || []);
    setFbAttendance(mirror.attendance || []);
    setFbExpenses(mirror.expenses || []);
    setFbSavings(mirror.savings || []);
    setFbDocuments(mirror.documents || []);
    setFbReminders(mirror.reminders || []);
    setFbLoans(mirror.loans || []);
    setFbWorkplaces(mirror.workplaces || []);
    setFbContacts(mirror.contacts || []);
    setFbAlarms(mirror.alarms || []);
    setFbEditHistory(mirror.editHistory || []);
    setFbFeedback(mirror.feedback || []);

    setLiveAuthUid(uid);
    setUser(cred.user);
    setAuthReady(true);
    setIsDemoMode(false);
    localStorage.setItem('shromik_sathi_demo_active', '0');
    localStorage.removeItem('shromik_sathi_needs_onboarding');
    localStorage.removeItem('shromik_sathi_manual_setup_mode');
    setNeedsOnboarding(false);
    setIsManualSetupMode(false);
    if (userEmail) {
      setActiveLocalEmail(userEmail);
      localStorage.setItem('shromik_sathi_active_email', userEmail);
    }
    setCloudDataLoaded(true);

    // Fetch existing Firestore profile and sync all collections in the background without blocking navigation
    void (async () => {
      const userDocRef = doc(db, 'users', uid);
      let serverCheckSucceeded = false;
      let snap;
      try {
        snap = await getDocFromServer(userDocRef);
        serverCheckSucceeded = true;
      } catch {
        try {
          snap = await getDoc(userDocRef);
        } catch {
          snap = undefined;
        }
      }
      if (snap?.exists()) {
        const remoteProf = snap.data() as WorkerProfile;
        const localHasSetup = Boolean(mirror.profile && isWorkerSetupCompleted(mirror.profile));
        const remoteHasSetup = isWorkerSetupCompleted(remoteProf);
        const rawMerged: WorkerProfile =
          localHasSetup && !remoteHasSetup
            ? {
                ...defaultWorkerProfile(uid, cred.user.displayName),
                ...remoteProf,
                ...(mirror.profile || {}),
                userId: uid,
              }
            : {
                ...defaultWorkerProfile(uid, cred.user.displayName),
                ...(mirror.profile || {}),
                ...remoteProf,
                userId: uid,
              };
        const bestName = resolveBestUserDisplayName(
          [cred.user.displayName, rawMerged.fullName, remoteProf.fullName],
          userEmail
        );
        const mergedProf: WorkerProfile = {
          ...rawMerged,
          fullName:
            !isGenericWorkerPlaceholderName(rawMerged.fullName) &&
            rawMerged.fullName?.trim() &&
            rawMerged.fullName.trim().toLowerCase() !== userEmail.split('@')[0]?.toLowerCase()
              ? rawMerged.fullName
              : bestName || rawMerged.fullName,
          photoUrl: rawMerged.photoUrl || cred.user.photoURL || '',
        };
        setFbProfile(mergedProf);
        saveUserMirror(uid, { profile: mergedProf }, { fromRemoteSnapshot: true });
      } else if (serverCheckSucceeded) {
        saveUserMirror(uid, { profile: fallbackProf }, { fromRemoteSnapshot: true });
        await ensureParentProfileInFirestore(cred.user, fallbackProf);
      }
      await syncUserDirectoryEntry(cred.user, {
        displayName: cred.user.displayName || googleResolvedName || undefined,
        language: lang,
      });
      void syncOfflineDataToCloud(true);
    })();
  };

  const normalizeIdentifierToEmail = (identifier: string): string => {
    const trimmed = identifier.trim().toLowerCase();
    if (trimmed.includes('@')) {
      return trimmed;
    }
    const safeSlug = trimmed.replace(/[^a-z0-9._-]/g, '') || 'worker';
    return `${safeSlug}@shromiksathi.app`;
  };

  const loginWithCredentials = async (identifier: string, password: string) => {
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      throw new Error(
        lang === 'bn'
          ? 'অনুগ্রহ করে ইমেইল/ইউজারনেম এবং পাসওয়ার্ড লিখুন।'
          : 'Please enter both username/email and password.'
      );
    }

    if (isDemoAccountEmail(cleanId)) {
      throw new Error(
        lang === 'bn'
          ? 'ডেমো মোড বন্ধ করা হয়েছে। অনুগ্রহ করে আপনার নিজের অ্যাকাউন্ট দিয়ে লগইন বা সাইন আপ করুন।'
          : 'Demo mode has been removed. Please log in or sign up with your personal account.'
      );
    }

    const email = normalizeIdentifierToEmail(cleanId);
    setIsReadOnlyDemo(false);
    localStorage.removeItem('shromik_sathi_readonly_demo');
    localStorage.removeItem('shromik_sathi_local_accounts');

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      persistAuthSessionCache(cred.user);
      prevAuthUidRef.current = uid;
      profileEnsuredRef.current = null;
      directorySyncedRef.current = null;
      autoAlignedMonthUidRef.current = null;
      remoteKnownDocIdsRef.current = {};
      nonRetryableFailedMutationsRef.current.clear();

      const mirror = loadUserMirror(uid);
      setFbProfile(
        mirror.profile || {
          ...defaultWorkerProfile(uid, cred.user.displayName),
          language: lang,
        }
      );
      setFbOvertime(mirror.overtime || []);
      setFbSalaryRecords(mirror.salaryRecords || []);
      setFbPayments(mirror.payments || []);
      setFbAttendance(mirror.attendance || []);
      setFbExpenses(mirror.expenses || []);
      setFbSavings(mirror.savings || []);
      setFbDocuments(mirror.documents || []);
      setFbReminders(mirror.reminders || []);
      setFbLoans(mirror.loans || []);
      setFbWorkplaces(mirror.workplaces || []);
      setFbContacts(mirror.contacts || []);
      setFbAlarms(mirror.alarms || []);
      setFbEditHistory(mirror.editHistory || []);
      setFbFeedback(mirror.feedback || []);

      setLiveAuthUid(uid);
      setUser(cred.user);
      setActiveLocalEmail(email);
      localStorage.setItem('shromik_sathi_active_email', email);
      setIsDemoMode(false);
      localStorage.setItem('shromik_sathi_demo_active', '0');
      setCloudDataLoaded(true);

      const userDocRef = doc(db, 'users', cred.user.uid);
      try {
        let snap;
        try {
          snap = await getDocFromServer(userDocRef);
        } catch {
          snap = await getDoc(userDocRef);
        }
        if (snap.exists() && isWorkerSetupCompleted(snap.data() as WorkerProfile)) {
          localStorage.removeItem('shromik_sathi_needs_onboarding');
          localStorage.removeItem('shromik_sathi_manual_setup_mode');
          setNeedsOnboarding(false);
          setIsManualSetupMode(false);
        }
      } catch {
        // onSnapshot listener handles profile hydration
      }

      void syncUserDirectoryEntry(cred.user, { language: lang });
      void syncOfflineDataToCloud(true);
    } catch (fbErr) {
      throw new Error(mapFirebaseAuthError(fbErr, lang));
    }
  };

  const changeUserPassword = async (currentPassword: string, newPassword: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }

    const cleanCurrent = currentPassword.trim();
    const cleanNew = newPassword.trim();

    if (!cleanCurrent) {
      throw new Error(
        lang === 'bn'
          ? 'অনুগ্রহ করে বর্তমান পাসওয়ার্ড লিখুন।'
          : 'Please enter your current password.'
      );
    }

    if (!cleanNew || cleanNew.length < 6) {
      throw new Error(
        lang === 'bn'
          ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
          : 'New password must be at least 6 characters long.'
      );
    }

    if (cleanCurrent === cleanNew) {
      throw new Error(
        lang === 'bn'
          ? 'নতুন পাসওয়ার্ডটি বর্তমান পাসওয়ার্ড থেকে ভিন্ন হতে হবে।'
          : 'New password must be different from current password.'
      );
    }

    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error(
        lang === 'bn'
          ? 'পাসওয়ার্ড পরিবর্তনের জন্য অনুগ্রহ করে ইমেইল ও পাসওয়ার্ড দিয়ে লগইন থাকুন।'
          : 'Please sign in with your email and password before changing your password.'
      );
    }

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, cleanCurrent);
      await reauthenticateWithCredential(auth.currentUser, credential);
    } catch (authErr: any) {
      const errCode = authErr?.code || '';
      if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
        throw new Error(
          lang === 'bn'
            ? 'বর্তমান পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আপনার সঠিক বর্তমান পাসওয়ার্ড দিন।'
            : 'Current password is incorrect. Please enter your correct current password.'
        );
      }
      throw new Error(mapFirebaseAuthError(authErr, lang));
    }

    try {
      await updatePassword(auth.currentUser, cleanNew);
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        throw new Error(
          lang === 'bn'
            ? 'নিরাপত্তার স্বার্থে পাসওয়ার্ড পরিবর্তনের আগে অনুগ্রহ করে একবার লগআউট করে পুনরায় লগইন করুন।'
            : 'For security reasons, please log out and log in again before changing password.'
        );
      }
      throw new Error(mapFirebaseAuthError(err, lang));
    }
  };

  const signUpWithCredentials = async (
    fullName: string,
    identifier: string,
    password: string
  ) => {
    const cleanName = fullName.trim();
    const cleanId = identifier.trim();
    if (!cleanName || !cleanId || !password) {
      throw new Error(
        lang === 'bn'
          ? 'অনুগ্রহ করে নাম, ইমেইল/ইউজারনেম এবং পাসওয়ার্ড পূরণ করুন।'
          : 'Please fill in your name, username/email, and password.'
      );
    }
    if (isDemoAccountEmail(cleanId)) {
      throw new Error(
        lang === 'bn'
          ? 'ডেমো মোড বন্ধ করা হয়েছে। অনুগ্রহ করে আপনার নিজের ইমেইল বা মোবাইল নম্বর ব্যবহার করুন।'
          : 'Demo mode has been removed. Please use your personal email or phone number.'
      );
    }
    if (password.length < 6) {
      throw new Error(
        lang === 'bn'
          ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
          : 'Password must be at least 6 characters.'
      );
    }

    const email = normalizeIdentifierToEmail(cleanId);
    setIsReadOnlyDemo(false);
    localStorage.removeItem('shromik_sathi_readonly_demo');
    localStorage.removeItem('shromik_sathi_local_accounts');

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (cred.user) {
        const uid = cred.user.uid;
        persistAuthSessionCache(cred.user);
        prevAuthUidRef.current = uid;
        profileEnsuredRef.current = null;
        directorySyncedRef.current = null;
        autoAlignedMonthUidRef.current = null;
        remoteKnownDocIdsRef.current = {};
        nonRetryableFailedMutationsRef.current.clear();

        setFbOvertime([]);
        setFbSalaryRecords([]);
        setFbPayments([]);
        setFbAttendance([]);
        setFbExpenses([]);
        setFbSavings([]);
        setFbDocuments([]);
        setFbReminders([]);
        setFbLoans([]);
        setFbWorkplaces([]);
        setFbContacts([]);
        setFbAlarms([]);
        setFbEditHistory([]);
        setFbFeedback([]);

        setLiveAuthUid(uid);
        setUser(cred.user);
        try {
          await updateFirebaseAuthProfile(cred.user, { displayName: cleanName });
        } catch {
          // ignore non-fatal profile displayName update error
        }
        const initialProf: WorkerProfile = {
          ...defaultWorkerProfile(uid, cleanName),
          fullName: cleanName,
          language: lang,
          privacyConsent: true,
        };
        setFbProfile(initialProf);
        setCloudDataLoaded(true);
        saveUserMirror(uid, { profile: initialProf }, { fromRemoteSnapshot: true });
        await ensureParentProfileInFirestore(cred.user, initialProf);
        await syncUserDirectoryEntry(cred.user, {
          displayName: cleanName,
          language: lang,
        });
      }
      setActiveLocalEmail(email);
      localStorage.setItem('shromik_sathi_active_email', email);
      setIsDemoMode(false);
      localStorage.setItem('shromik_sathi_demo_active', '0');
      localStorage.removeItem('shromik_sathi_manual_setup_mode');
      setIsManualSetupMode(false);
      localStorage.setItem('shromik_sathi_needs_onboarding', '1');
      setNeedsOnboarding(true);
    } catch (fbErr) {
      throw new Error(mapFirebaseAuthError(fbErr, lang));
    }
  };

  const completeOnboarding = useCallback(
    async (patch?: Partial<WorkerProfile>) => {
      if (isReadOnlyDemo) {
        triggerReadOnlyBlock();
        return;
      }
      localStorage.removeItem('shromik_sathi_needs_onboarding');
      localStorage.removeItem('shromik_sathi_manual_setup_mode');
      setNeedsOnboarding(false);
      setIsManualSetupMode(false);
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.has('onboarding') || url.searchParams.has('manual_setup')) {
            url.searchParams.delete('onboarding');
            url.searchParams.delete('manual_setup');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
          }
        } catch {
          // ignore URL errors
        }
      }
      if (!patch) {
        localStorage.removeItem('shromik_sathi_pending_quick_entry_v1');
        await updateProfile({
          grossSalary: 0,
          basicSalary: 0,
        });
        return;
      }
      if (patch) {
        await updateProfile(patch);
        if (patch.factoryName && (isDemoMode || !user)) {
          setDemoState((prev) => {
            const list = prev.workplaces || [];
            const currentWp = list.find((w) => w.isCurrent);
            const updatedWp: GarmentWorkplace = {
              id: currentWp?.id || 'wp_onboarding_current',
              userId: prev.profile.userId,
              factoryName: patch.factoryName || prev.profile.factoryName,
              factoryAddress: currentWp?.factoryAddress || patch.address || '',
              factoryArea: patch.factoryBranch || prev.profile.factoryBranch,
              department: patch.department || prev.profile.department,
              floorNumber: currentWp?.floorNumber || '',
              lineNumber: currentWp?.lineNumber || '',
              designation: patch.designation || prev.profile.designation,
              employeeId: patch.employeeId || prev.profile.employeeId,
              supervisorName: currentWp?.supervisorName || '',
              joiningDate: patch.joiningDate || prev.profile.joiningDate,
              shiftPattern: patch.shiftPattern || prev.profile.shiftPattern || 'day',
              grossSalary: patch.grossSalary ?? prev.profile.grossSalary,
              basicSalary: patch.basicSalary ?? prev.profile.basicSalary,
              factoryPhone: currentWp?.factoryPhone || '',
              notes: currentWp?.notes || 'অনবোর্ডিংয়ে নিবন্ধিত বর্তমান গার্মেন্টস',
              isCurrent: true,
            };
            const nextWorkplaces = currentWp
              ? list.map((w) => (w.id === currentWp.id ? updatedWp : w))
              : [updatedWp, ...list];
            const next = { ...prev, workplaces: nextWorkplaces };
            persistCurrentLocalStore(next);
            return next;
          });
        }
      }
    },
    [isDemoMode, isReadOnlyDemo, triggerReadOnlyBlock, updateProfile, user]
  );

  const reopenOnboarding = useCallback(() => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (isWorkerSetupCompleted(activeProfile)) {
      return;
    }
    localStorage.setItem('shromik_sathi_manual_setup_mode', '1');
    localStorage.setItem('shromik_sathi_needs_onboarding', '1');
    setIsManualSetupMode(true);
    setNeedsOnboarding(true);
  }, [activeProfile, isReadOnlyDemo, triggerReadOnlyBlock]);

  const isProfileSetupIncomplete = !isReadOnlyDemo && !isWorkerSetupCompleted(activeProfile);

  const logout = async () => {
    clearAuthSessionCache();
    localStorage.removeItem('shromik_sathi_needs_onboarding');
    localStorage.removeItem('shromik_sathi_manual_setup_mode');
    localStorage.removeItem('shromik_sathi_active_tab');
    localStorage.removeItem('shromik_sathi_more_subview');
    localStorage.removeItem('shromik_sathi_active_email');
    prevAuthUidRef.current = null;
    profileEnsuredRef.current = null;
    directorySyncedRef.current = null;
    autoAlignedMonthUidRef.current = null;
    remoteKnownDocIdsRef.current = {};
    nonRetryableFailedMutationsRef.current.clear();
    setNeedsOnboarding(false);
    setIsManualSetupMode(false);
    setFbProfile(null);
    setFbOvertime([]);
    setFbSalaryRecords([]);
    setFbPayments([]);
    setFbAttendance([]);
    setFbExpenses([]);
    setFbSavings([]);
    setFbDocuments([]);
    setFbReminders([]);
    setFbLoans([]);
    setFbWorkplaces([]);
    setFbContacts([]);
    setFbAlarms([]);
    setFbEditHistory([]);
    setFbFeedback([]);
    setLiveAuthUid(null);
    setUser(null);
    exitDemoMode();
    if (auth.currentUser) {
      await signOut(auth);
    }
  };

  const deleteAccountAndData = async () => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (isDemoMode || !user) {
      resetDemoState();
      exitDemoMode();
      return;
    }
    const uid = user.uid;
    clearAuthSessionCache();
    localStorage.removeItem(`shromik_sathi_cloud_mirror_${uid}`);
    const subs = [
      'overtime',
      'salaryRecords',
      'payments',
      'attendance',
      'expenses',
      'savings',
      'documents',
      'reminders',
      'loans',
      'workplaces',
      'contacts',
      'alarms',
    ];
    for (const sub of subs) {
      try {
        const colRef = collection(db, 'users', uid, sub);
        const q = query(colRef, where('userId', '==', uid));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'users', uid, sub, d.id));
        }
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${uid}/${sub}`);
      }
    }
    try {
      await deleteDoc(doc(db, 'users', uid));
      await deleteUser(user);
    } catch (err) {
      logFirestoreWarning(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  const saveOvertime = async (
    rec: Omit<OvertimeRecord, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const sanitized = {
      date: rec.date.slice(0, 15),
      month: rec.month.slice(0, 10),
      startTime: rec.startTime.slice(0, 10),
      endTime: rec.endTime.slice(0, 10),
      breakMinutes: Number(rec.breakMinutes) || 0,
      totalMinutes: Number(rec.totalMinutes) || 0,
      approvedHours: Number(rec.approvedHours) || 0,
      basicSalarySnapshot: Number(rec.basicSalarySnapshot) || 0,
      divisorSnapshot: Number(rec.divisorSnapshot) || 208,
      multiplierSnapshot: Number(rec.multiplierSnapshot) || 2,
      hourlyRateSnapshot: Number(rec.hourlyRateSnapshot) || 0,
      estimatedEarnings: Number(rec.estimatedEarnings) || 0,
      notes: (rec.notes || '').slice(0, 300),
    };

    // Guard: Do not allow adding or editing overtime in upcoming future months or future dates
    const localToday = getTodayISO();
    const bstToday = getBstTodayISO();
    const liveToday = localToday > bstToday ? localToday : bstToday;
    const liveMonth = getCurrentMonthISO(liveToday);
    if (isFutureMonth(sanitized.month, liveMonth) || isFutureDate(sanitized.date, liveToday)) {
      return;
    }

    // Enforce 1 overtime record per date: if an entry already exists on this date, update it instead of creating a duplicate
    const currentList = isDemoMode || !user ? demoState.overtime : fbOvertime;
    const existingSameDate = currentList.find((o) => o.date === sanitized.date);
    const id = existingId || existingSameDate?.id || makeStableId('ot');

    if (sanitized.month && sanitized.month !== selectedMonth) {
      setSelectedMonth(sanitized.month);
    }

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: OvertimeRecord = {
          id,
          userId: prev.profile.userId,
          ...sanitized,
        };
        const exists = prev.overtime.some((o) => o.id === id);
        const overtime = exists
          ? prev.overtime.map((o) => (o.id === id ? item : o))
          : [item, ...prev.overtime];
        const next = { ...prev, overtime };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: OvertimeRecord = { id, userId: user.uid, ...sanitized };
    const exists = fbOvertime.some((o) => o.id === id);
    setFbOvertime((prev) => {
      const next = exists
        ? prev.map((o) => (o.id === id ? optimisticItem : o))
        : [optimisticItem, ...prev];
      saveUserMirror(user.uid, { overtime: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(user.uid, 'overtime', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'overtime', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/overtime/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const appendHistoryEntry = useCallback(
    (
      entityType: RecoverableEntityType,
      action: 'create' | 'update' | 'delete' | 'restore',
      summaryBn: string,
      summaryEn: string,
      recoverablePayload?: Record<string, any>
    ) => {
      const entry: EditHistoryEntry = {
        id: makeStableId('hist'),
        userId: activeProfile.userId,
        entityType,
        action,
        summaryBn,
        summaryEn,
        timestamp: new Date().toISOString(),
        recoverablePayload,
      };
      if (isDemoMode || !user) {
        setDemoState((prev) => {
          const editHistory = [entry, ...(prev.editHistory || [])].slice(0, 60);
          const next = { ...prev, editHistory };
          persistCurrentLocalStore(next);
          return next;
        });
      } else {
        setFbEditHistory((prev) => {
          const editHistory = [entry, ...prev].slice(0, 60);
          saveUserMirror(user.uid, { editHistory });
          return editHistory;
        });
      }
    },
    [activeProfile.userId, isDemoMode, user, persistCurrentLocalStore]
  );

  const deleteOvertime = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const existingItem = (isDemoMode || !user ? demoState.overtime : fbOvertime).find(
      (o) => o.id === id
    );
    if (existingItem) {
      appendHistoryEntry(
        'overtime',
        'delete',
        `${existingItem.date} তারিখের ${existingItem.approvedHours} ঘণ্টা ওভারটাইম মুছে ফেলা হয়েছে (৳${existingItem.estimatedEarnings})`,
        `Deleted ${existingItem.approvedHours}h overtime on ${existingItem.date} (৳${existingItem.estimatedEarnings})`,
        existingItem
      );
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = { ...prev, overtime: prev.overtime.filter((o) => o.id !== id) };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbOvertime((prev) => {
      const next = prev.filter((o) => o.id !== id);
      saveUserMirror(user.uid, { overtime: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'overtime', id));
        remoteKnownDocIdsRef.current.overtime?.delete(id);
        clearOfflineMutation(user.uid, 'overtime', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/overtime/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveSalaryRecord = async (
    rec: Omit<SalaryRecord, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = existingId || `sal_${rec.month.replace(/[^0-9]/g, '')}`;
    const sanitized = {
      month: rec.month.slice(0, 10),
      effectiveDate: (rec.effectiveDate || `${rec.month}-01`).slice(0, 20),
      basicSalary: Number(rec.basicSalary) || 0,
      houseRentAllowance: Number(rec.houseRentAllowance) || 0,
      medicalAllowance: Number(rec.medicalAllowance) || 0,
      transportAllowance: Number(rec.transportAllowance) || 0,
      foodAllowance: Number(rec.foodAllowance) || 0,
      attendanceBonus: Number(rec.attendanceBonus) || 0,
      overtimeHours: Number(rec.overtimeHours) || 0,
      overtimeEarnings: Number(rec.overtimeEarnings) || 0,
      festivalBonus: Number(rec.festivalBonus) || 0,
      otherAllowances: Number(rec.otherAllowances) || 0,
      advanceDeduction: Number(rec.advanceDeduction) || 0,
      absenceDeduction: Number(rec.absenceDeduction) || 0,
      otherDeductions: Number(rec.otherDeductions) || 0,
      adjustments: Number(rec.adjustments) || 0,
      estimatedGross: Number(rec.estimatedGross) || 0,
      estimatedNetPayable: Number(rec.estimatedNetPayable) || 0,
      notes: (rec.notes || '').slice(0, 400),
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: SalaryRecord = { id, userId: prev.profile.userId, ...sanitized };
        const exists = prev.salaryRecords.some((s) => s.id === id || s.month === sanitized.month);
        const salaryRecords = exists
          ? prev.salaryRecords.map((s) =>
              s.id === id || s.month === sanitized.month ? item : s
            )
          : [item, ...prev.salaryRecords];
        const next = { ...prev, salaryRecords };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: SalaryRecord = { id, userId: user.uid, ...sanitized };
    const exists = fbSalaryRecords.some((s) => s.id === id || s.month === sanitized.month);
    setFbSalaryRecords((prev) => {
      const next = exists
        ? prev.map((s) => (s.id === id || s.month === sanitized.month ? optimisticItem : s))
        : [optimisticItem, ...prev];
      saveUserMirror(user.uid, { salaryRecords: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(
          user.uid,
          'salaryRecords',
          id,
          sanitized as Record<string, any>
        );
        clearOfflineMutation(user.uid, 'salaryRecords', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/salaryRecords/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const deleteSalaryRecord = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = { ...prev, salaryRecords: prev.salaryRecords.filter((s) => s.id !== id) };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbSalaryRecords((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveUserMirror(user.uid, { salaryRecords: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'salaryRecords', id));
        remoteKnownDocIdsRef.current.salaryRecords?.delete(id);
        clearOfflineMutation(user.uid, 'salaryRecords', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/salaryRecords/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const savePayment = async (
    rec: Omit<SalaryPayment, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = existingId || makeStableId('pay');
    const sanitized = {
      month: rec.month.slice(0, 10),
      paymentDate: rec.paymentDate.slice(0, 15),
      amountReceived: Number(rec.amountReceived) || 0,
      paymentMethod: rec.paymentMethod,
      isPartial: Boolean(rec.isPartial),
      referenceNote: (rec.referenceNote || '').slice(0, 300),
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: SalaryPayment = { id, userId: prev.profile.userId, ...sanitized };
        const exists = prev.payments.some((p) => p.id === id);
        const payments = exists
          ? prev.payments.map((p) => (p.id === id ? item : p))
          : [item, ...prev.payments];
        const next = { ...prev, payments };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: SalaryPayment = { id, userId: user.uid, ...sanitized };
    const exists = fbPayments.some((p) => p.id === id);
    setFbPayments((prev) => {
      const next = exists
        ? prev.map((p) => (p.id === id ? optimisticItem : p))
        : [optimisticItem, ...prev];
      saveUserMirror(user.uid, { payments: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(user.uid, 'payments', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'payments', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/payments/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const deletePayment = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const existingItem = (isDemoMode || !user ? demoState.payments : fbPayments).find(
      (p) => p.id === id
    );
    if (existingItem) {
      appendHistoryEntry(
        'payment',
        'delete',
        `${existingItem.paymentDate} তারিখের বেতন প্রাপ্তি ৳${existingItem.amountReceived} মুছে ফেলা হয়েছে`,
        `Deleted salary payment of ৳${existingItem.amountReceived} on ${existingItem.paymentDate}`,
        existingItem
      );
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = { ...prev, payments: prev.payments.filter((p) => p.id !== id) };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbPayments((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveUserMirror(user.uid, { payments: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'payments', id));
        remoteKnownDocIdsRef.current.payments?.delete(id);
        clearOfflineMutation(user.uid, 'payments', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/payments/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveAttendance = async (
    rec: Omit<AttendanceRecord, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = existingId || `att_${rec.date.replace(/[^0-9]/g, '')}`;
    const sanitized = {
      date: rec.date.slice(0, 15),
      month: rec.month.slice(0, 10),
      status: rec.status,
      leaveCategory: rec.leaveCategory,
      checkIn: (rec.checkIn || '').slice(0, 10),
      checkOut: (rec.checkOut || '').slice(0, 10),
      notes: (rec.notes || '').slice(0, 300),
      ...(typeof rec.hasAttendanceBonus === 'boolean'
        ? { hasAttendanceBonus: rec.hasAttendanceBonus }
        : {}),
    };

    // Guard: Do not allow adding or editing attendance in upcoming future months or future dates
    const localToday = getTodayISO();
    const bstToday = getBstTodayISO();
    const liveToday = localToday > bstToday ? localToday : bstToday;
    const liveMonth = getCurrentMonthISO(liveToday);
    if (isFutureMonth(sanitized.month, liveMonth) || isFutureDate(sanitized.date, liveToday)) {
      return;
    }

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: AttendanceRecord = { id, userId: prev.profile.userId, ...sanitized };
        const exists = prev.attendance.some((a) => a.id === id || a.date === rec.date);
        const attendance = exists
          ? prev.attendance.map((a) => (a.id === id || a.date === rec.date ? item : a))
          : [item, ...prev.attendance];
        const next = { ...prev, attendance };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: AttendanceRecord = { id, userId: user.uid, ...sanitized };
    const exists = fbAttendance.some((a) => a.id === id || a.date === rec.date);
    setFbAttendance((prev) => {
      const next = exists
        ? prev.map((a) => (a.id === id || a.date === rec.date ? optimisticItem : a))
        : [optimisticItem, ...prev];
      saveUserMirror(user.uid, { attendance: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(user.uid, 'attendance', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'attendance', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/attendance/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const deleteAttendance = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const existingItem = (isDemoMode || !user ? demoState.attendance : fbAttendance).find(
      (a) => a.id === id
    );
    if (existingItem) {
      appendHistoryEntry(
        'attendance',
        'delete',
        `${existingItem.date} তারিখের হাজিরা রেকর্ড মুছে ফেলা হয়েছে`,
        `Deleted attendance record for ${existingItem.date}`,
        existingItem
      );
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = { ...prev, attendance: prev.attendance.filter((a) => a.id !== id) };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbAttendance((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveUserMirror(user.uid, { attendance: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'attendance', id));
        remoteKnownDocIdsRef.current.attendance?.delete(id);
        clearOfflineMutation(user.uid, 'attendance', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/attendance/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveExpense = async (
    rec: Omit<ExpenseRecord, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = existingId || makeStableId('exp');
    const sanitized = {
      date: rec.date.slice(0, 15),
      month: rec.month.slice(0, 10),
      category: rec.category,
      amount: Number(rec.amount) || 0,
      description: (rec.description || '').slice(0, 250),
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: ExpenseRecord = { id, userId: prev.profile.userId, ...sanitized };
        const exists = prev.expenses.some((e) => e.id === id);
        const expenses = exists
          ? prev.expenses.map((e) => (e.id === id ? item : e))
          : [item, ...prev.expenses];
        const next = { ...prev, expenses };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: ExpenseRecord = { id, userId: user.uid, ...sanitized };
    const exists = fbExpenses.some((e) => e.id === id);
    setFbExpenses((prev) => {
      const next = exists
        ? prev.map((e) => (e.id === id ? optimisticItem : e))
        : [optimisticItem, ...prev];
      saveUserMirror(user.uid, { expenses: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(user.uid, 'expenses', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'expenses', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/expenses/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const deleteExpense = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const existingItem = (isDemoMode || !user ? demoState.expenses : fbExpenses).find(
      (e) => e.id === id
    );
    if (existingItem) {
      appendHistoryEntry(
        'expense',
        'delete',
        `${existingItem.date} তারিখের খরচ (৳${existingItem.amount} — ${existingItem.description}) মুছে ফেলা হয়েছে`,
        `Deleted expense of ৳${existingItem.amount} on ${existingItem.date}`,
        existingItem
      );
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = { ...prev, expenses: prev.expenses.filter((e) => e.id !== id) };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbExpenses((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveUserMirror(user.uid, { expenses: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'expenses', id));
        remoteKnownDocIdsRef.current.expenses?.delete(id);
        clearOfflineMutation(user.uid, 'expenses', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/expenses/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveSavingsGoal = async (
    rec: Omit<SavingsGoal, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = existingId || makeStableId('sav');
    const sanitized: Omit<SavingsGoal, 'id' | 'userId'> = {
      title: rec.title.slice(0, 120),
      targetAmount: Number(rec.targetAmount) || 0,
      savedAmount: Number(rec.savedAmount) || 0,
      monthlyBudget: Number(rec.monthlyBudget) || 0,
      deadline: (rec.deadline || '').slice(0, 20),
      notes: (rec.notes || '').slice(0, 250),
      ...(rec.storageLocation ? { storageLocation: rec.storageLocation.trim().slice(0, 120) } : {}),
      ...(rec.commissionType === 'commission' || rec.commissionType === 'non_commission'
        ? { commissionType: rec.commissionType }
        : {}),
      ...(rec.commissionAmount !== undefined
        ? { commissionAmount: Math.max(0, Number(rec.commissionAmount) || 0) }
        : {}),
      ...(rec.frequency === 'monthly' || rec.frequency === 'weekly' || rec.frequency === 'daily'
        ? { frequency: rec.frequency }
        : {}),
      ...(rec.lastDepositDate ? { lastDepositDate: rec.lastDepositDate.slice(0, 20) } : {}),
      ...(rec.nextDueDate ? { nextDueDate: rec.nextDueDate.slice(0, 20) } : {}),
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: SavingsGoal = { id, userId: prev.profile.userId, ...sanitized };
        const exists = prev.savings.some((s) => s.id === id);
        const savings = exists
          ? prev.savings.map((s) => (s.id === id ? item : s))
          : [item, ...prev.savings];
        const next = { ...prev, savings };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: SavingsGoal = { id, userId: user.uid, ...sanitized };
    const exists = fbSavings.some((s) => s.id === id);
    setFbSavings((prev) => {
      const next = exists
        ? prev.map((s) => (s.id === id ? optimisticItem : s))
        : [optimisticItem, ...prev];
      saveUserMirror(user.uid, { savings: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(user.uid, 'savings', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'savings', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/savings/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const deleteSavingsGoal = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = { ...prev, savings: prev.savings.filter((s) => s.id !== id) };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbSavings((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveUserMirror(user.uid, { savings: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'savings', id));
        remoteKnownDocIdsRef.current.savings?.delete(id);
        clearOfflineMutation(user.uid, 'savings', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/savings/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveVaultDocument = async (rec: Omit<VaultDocument, 'id' | 'userId'>) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = makeStableId('doc');
    const sanitized = {
      title: rec.title.slice(0, 120),
      category: rec.category,
      fileName: rec.fileName.slice(0, 150),
      fileType: rec.fileType.slice(0, 60),
      fileSize: Math.min(524288, Number(rec.fileSize) || 0),
      fileData: rec.fileData.slice(0, 750000),
      issueDate: (rec.issueDate || '').slice(0, 20),
      notes: (rec.notes || '').slice(0, 300),
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: VaultDocument = { id, userId: prev.profile.userId, ...sanitized };
        const next = { ...prev, documents: [item, ...prev.documents] };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: VaultDocument = { id, userId: user.uid, ...sanitized };
    setFbDocuments((prev) => {
      const next = [optimisticItem, ...prev];
      saveUserMirror(user.uid, { documents: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(user.uid, 'documents', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'documents', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.CREATE,
          `users/${user.uid}/documents/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const deleteVaultDocument = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = { ...prev, documents: prev.documents.filter((d) => d.id !== id) };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbDocuments((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveUserMirror(user.uid, { documents: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'documents', id));
        remoteKnownDocIdsRef.current.documents?.delete(id);
        clearOfflineMutation(user.uid, 'documents', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/documents/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveReminder = async (
    rec: Omit<ReminderItem, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = existingId || makeStableId('rem');
    const sanitized = {
      title: rec.title.slice(0, 150),
      category: rec.category,
      dueDate: rec.dueDate.slice(0, 15),
      isCompleted: Boolean(rec.isCompleted),
      notes: (rec.notes || '').slice(0, 250),
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: ReminderItem = { id, userId: prev.profile.userId, ...sanitized };
        const exists = prev.reminders.some((r) => r.id === id);
        const reminders = exists
          ? prev.reminders.map((r) => (r.id === id ? item : r))
          : [item, ...prev.reminders];
        const next = { ...prev, reminders };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: ReminderItem = { id, userId: user.uid, ...sanitized };
    const exists = fbReminders.some((r) => r.id === id);
    setFbReminders((prev) => {
      const next = exists
        ? prev.map((r) => (r.id === id ? optimisticItem : r))
        : [optimisticItem, ...prev];
      saveUserMirror(user.uid, { reminders: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(user.uid, 'reminders', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'reminders', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/reminders/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const toggleReminder = async (id: string, isCompleted: boolean) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const reminders = prev.reminders.map((r) =>
          r.id === id ? { ...r, isCompleted } : r
        );
        const next = { ...prev, reminders };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    const target = fbReminders.find((r) => r.id === id);
    if (!target) return;
    await saveReminder(
      {
        title: target.title,
        category: target.category,
        dueDate: target.dueDate,
        isCompleted,
        notes: target.notes,
      },
      id
    );
  };

  const deleteReminder = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const existingItem = (isDemoMode || !user ? demoState.reminders : fbReminders).find(
      (r) => r.id === id
    );
    if (existingItem) {
      appendHistoryEntry(
        'reminder',
        'delete',
        `রিমাইন্ডার “${existingItem.title}” মুছে ফেলা হয়েছে`,
        `Deleted reminder "${existingItem.title}"`,
        existingItem
      );
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = { ...prev, reminders: prev.reminders.filter((r) => r.id !== id) };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbReminders((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveUserMirror(user.uid, { reminders: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'reminders', id));
        remoteKnownDocIdsRef.current.reminders?.delete(id);
        clearOfflineMutation(user.uid, 'reminders', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/reminders/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveLoan = async (
    rec: Omit<PersonalLoan, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = existingId || makeStableId('loan');
    const origAmt = Math.max(0, Number(rec.originalAmount ?? rec.totalLoanAmount) || 0);
    const repList = Array.isArray(rec.repayments) ? rec.repayments : [];
    const totalRepaid = repList.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const paidAmt = Math.max(Number(rec.paidAmount) || 0, totalRepaid);
    const rem = origAmt - paidAmt;

    let computedStatus: LoanStatus = rec.status || 'pending';
    if (rem <= 0 && origAmt > 0) {
      computedStatus = 'fully_settled';
    } else if (paidAmt > 0) {
      computedStatus = 'partially_repaid';
    }

    const sanitized = {
      title: (rec.title || rec.personName || 'ধার-দেনা').slice(0, 150),
      lenderType: rec.lenderType || 'person',
      totalLoanAmount: origAmt,
      paidAmount: paidAmt,
      monthlyInstallment: Math.max(0, Number(rec.monthlyInstallment) || 0),
      nextDueDate: (rec.nextDueDate || rec.expectedRepaymentDate || '').slice(0, 15),
      notes: (rec.notes || rec.reason || '').slice(0, 300),
      personName: (rec.personName || rec.title || 'অজানা ব্যক্তি').slice(0, 100),
      contactNumber: (rec.contactNumber || '').slice(0, 30),
      direction: rec.direction || 'lent',
      originalAmount: origAmt,
      transactionDate: (rec.transactionDate || getTodayISO()).slice(0, 15),
      expectedRepaymentDate: (rec.expectedRepaymentDate || rec.nextDueDate || '').slice(0, 15),
      reason: (rec.reason || rec.notes || '').slice(0, 300),
      repaymentArrangement: rec.repaymentArrangement || 'lump_sum',
      status: computedStatus,
      repayments: repList,
      isArchived: Boolean(rec.isArchived),
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: PersonalLoan = { id, userId: prev.profile.userId, ...sanitized };
        const currentLoans = prev.loans || [];
        const exists = currentLoans.some((l) => l.id === id);
        const loans = exists
          ? currentLoans.map((l) => (l.id === id ? item : l))
          : [item, ...currentLoans];
        const next = { ...prev, loans };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: PersonalLoan = { id, userId: user.uid, ...sanitized };
    const exists = fbLoans.some((l) => l.id === id);
    setFbLoans((prev) => {
      const next = exists
        ? prev.map((l) => (l.id === id ? optimisticItem : l))
        : [optimisticItem, ...prev];
      saveUserMirror(user.uid, { loans: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(user.uid, 'loans', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'loans', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/loans/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const addLoanRepayment = async (
    loanId: string,
    repayment: Omit<LoanRepayment, 'id' | 'userId' | 'loanId'>
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const activeLoans = isDemoMode || !user ? demoState.loans || [] : fbLoans;
    const target = activeLoans.find((l) => l.id === loanId);
    if (!target) return;

    const newRepayment: LoanRepayment = {
      id: makeStableId('rep'),
      loanId,
      userId: activeProfile.userId,
      amount: Math.max(0, Number(repayment.amount) || 0),
      repaymentDate: repayment.repaymentDate || getTodayISO(),
      repaymentMethod: repayment.repaymentMethod || 'cash',
      direction: repayment.direction || (target.direction === 'lent' ? 'received' : 'paid'),
      notes: (repayment.notes || '').slice(0, 300),
      receivedByPerson: repayment.receivedByPerson,
    };

    const existingRepayments = target.repayments || [];
    const updatedRepayments = [newRepayment, ...existingRepayments];
    const totalRepaid = updatedRepayments.reduce((acc, r) => acc + r.amount, 0);

    const origAmt = target.originalAmount || target.totalLoanAmount || 0;
    const rem = origAmt - totalRepaid;
    const newStatus: LoanStatus = rem <= 0 ? 'fully_settled' : 'partially_repaid';

    await saveLoan(
      {
        ...target,
        paidAmount: totalRepaid,
        status: newStatus,
        repayments: updatedRepayments,
      },
      loanId
    );

    const person = target.personName || target.title;
    const actionLabel = target.direction === 'lent' ? 'পাওনা উদ্ধার' : 'ধার পরিশোধ';
    appendHistoryEntry(
      'loan',
      'update',
      `${person}-এর থেকে ${actionLabel} ৳${newRepayment.amount} রেকর্ড করা হয়েছে`,
      `Recorded repayment of ৳${newRepayment.amount} with ${person}`
    );
  };

  const deleteLoanRepayment = async (loanId: string, repaymentId: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const activeLoans = isDemoMode || !user ? demoState.loans || [] : fbLoans;
    const target = activeLoans.find((l) => l.id === loanId);
    if (!target || !target.repayments) return;

    const updatedRepayments = target.repayments.filter((r) => r.id !== repaymentId);
    const totalRepaid = updatedRepayments.reduce((acc, r) => acc + r.amount, 0);
    const origAmt = target.originalAmount || target.totalLoanAmount || 0;
    const rem = origAmt - totalRepaid;

    let newStatus: LoanStatus = 'pending';
    if (rem <= 0 && origAmt > 0) {
      newStatus = 'fully_settled';
    } else if (totalRepaid > 0) {
      newStatus = 'partially_repaid';
    }

    await saveLoan(
      {
        ...target,
        paidAmount: totalRepaid,
        status: newStatus,
        repayments: updatedRepayments,
      },
      loanId
    );
  };

  const settleLoan = async (loanId: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const activeLoans = isDemoMode || !user ? demoState.loans || [] : fbLoans;
    const target = activeLoans.find((l) => l.id === loanId);
    if (!target) return;

    const origAmt = target.originalAmount || target.totalLoanAmount || 0;
    await saveLoan(
      {
        ...target,
        paidAmount: origAmt,
        status: 'fully_settled',
      },
      loanId
    );

    appendHistoryEntry(
      'loan',
      'update',
      `“${target.personName || target.title}” ঋণের হিসাব সম্পূর্ণরূপে নিষ্পত্তি করা হয়েছে`,
      `Marked loan with "${target.personName || target.title}" as fully settled`
    );
  };

  const archiveLoan = async (loanId: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const activeLoans = isDemoMode || !user ? demoState.loans || [] : fbLoans;
    const target = activeLoans.find((l) => l.id === loanId);
    if (!target) return;

    const nextArchived = !target.isArchived;
    await saveLoan(
      {
        ...target,
        isArchived: nextArchived,
      },
      loanId
    );
  };

  const payLoanInstallment = async (id: string, installmentAmount?: number) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const activeLoans = isDemoMode || !user ? demoState.loans || [] : fbLoans;
    const target = activeLoans.find((l) => l.id === id);
    if (!target) return;
    const increment = installmentAmount !== undefined ? installmentAmount : (target.monthlyInstallment || 0);
    const dir = target.direction === 'lent' ? 'received' : 'paid';
    await addLoanRepayment(id, {
      amount: Math.max(0, increment),
      repaymentDate: getTodayISO(),
      repaymentMethod: 'cash',
      direction: dir,
      notes: 'কিস্তি পরিশোধ',
    });
  };

  const deleteLoan = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const existingItem = (isDemoMode || !user ? demoState.loans || [] : fbLoans).find(
      (l) => l.id === id
    );
    if (existingItem) {
      appendHistoryEntry(
        'loan',
        'delete',
        `ধার-দেনা হিসাব “${existingItem.personName || existingItem.title}” (মোট ৳${existingItem.originalAmount || existingItem.totalLoanAmount}) মুছে ফেলা হয়েছে`,
        `Deleted loan record "${existingItem.personName || existingItem.title}" (Total ৳${existingItem.originalAmount || existingItem.totalLoanAmount})`,
        existingItem
      );
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = { ...prev, loans: (prev.loans || []).filter((l) => l.id !== id) };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbLoans((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveUserMirror(user.uid, { loans: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'loans', id));
        remoteKnownDocIdsRef.current.loans?.delete(id);
        clearOfflineMutation(user.uid, 'loans', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/loans/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveWorkplace = async (
    rec: Omit<GarmentWorkplace, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const cleanFactoryName = rec.factoryName.trim().slice(0, 150);
    if (!cleanFactoryName) {
      return;
    }
    const id = existingId || makeStableId('wp');
    const sanitized: Omit<GarmentWorkplace, 'id' | 'userId'> = {
      factoryName: cleanFactoryName,
      factoryAddress: (rec.factoryAddress || '').trim().slice(0, 250),
      factoryArea: (rec.factoryArea || '').trim().slice(0, 100),
      department: (rec.department || '').trim().slice(0, 100),
      floorNumber: (rec.floorNumber || '').trim().slice(0, 50),
      lineNumber: (rec.lineNumber || '').trim().slice(0, 50),
      designation: (rec.designation || '').trim().slice(0, 100),
      employeeId: (rec.employeeId || '').trim().slice(0, 60),
      supervisorName: (rec.supervisorName || '').trim().slice(0, 100),
      joiningDate: (rec.joiningDate || '').slice(0, 15),
      leavingDate: rec.leavingDate ? rec.leavingDate.slice(0, 15) : undefined,
      leavingReason: rec.leavingReason ? rec.leavingReason.trim().slice(0, 200) : undefined,
      shiftPattern: rec.shiftPattern,
      grossSalary: rec.grossSalary !== undefined ? Number(rec.grossSalary) : undefined,
      basicSalary: rec.basicSalary !== undefined ? Number(rec.basicSalary) : undefined,
      totalReceivedSalary: rec.totalReceivedSalary !== undefined ? Number(rec.totalReceivedSalary) : undefined,
      totalExpectedSalary: rec.totalExpectedSalary !== undefined ? Number(rec.totalExpectedSalary) : undefined,
      totalOvertimeHours: rec.totalOvertimeHours !== undefined ? Number(rec.totalOvertimeHours) : undefined,
      totalOvertimeEarnings: rec.totalOvertimeEarnings !== undefined ? Number(rec.totalOvertimeEarnings) : undefined,
      totalPresentDays: rec.totalPresentDays !== undefined ? Number(rec.totalPresentDays) : undefined,
      totalAbsentDays: rec.totalAbsentDays !== undefined ? Number(rec.totalAbsentDays) : undefined,
      totalLeaveDays: rec.totalLeaveDays !== undefined ? Number(rec.totalLeaveDays) : undefined,
      monthsWorked: rec.monthsWorked !== undefined ? Number(rec.monthsWorked) : undefined,
      factoryPhone: (rec.factoryPhone || '').trim().slice(0, 30),
      notes: (rec.notes || '').trim().slice(0, 300),
      isCurrent: Boolean(rec.isCurrent),
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: GarmentWorkplace = { id, userId: prev.profile.userId, ...sanitized };
        let currentList = prev.workplaces || [];
        if (sanitized.isCurrent) {
          currentList = currentList.map((w) => ({ ...w, isCurrent: w.id === id }));
        }
        const exists = currentList.some((w) => w.id === id);
        const workplaces = exists
          ? currentList.map((w) => (w.id === id ? item : w))
          : [item, ...currentList];
        const next = { ...prev, workplaces };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const exists = fbWorkplaces.some((w) => w.id === id);
    setFbWorkplaces((prev) => {
      const item: GarmentWorkplace = { id, userId: user.uid, ...sanitized };
      let updated = prev;
      if (sanitized.isCurrent) {
        updated = updated.map((w) => ({ ...w, isCurrent: w.id === id }));
      }
      const next = exists ? updated.map((w) => (w.id === id ? item : w)) : [item, ...updated];
      saveUserMirror(user.uid, { workplaces: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      try {
        await ensureParentProfileInFirestore(user, activeProfile);
        await upsertSubcollectionDoc(user.uid, 'workplaces', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'workplaces', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/workplaces/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const transitionToNewGarmentJob = async (input: NewGarmentJobTransitionInput) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const currentWorkplaces = isDemoMode || !user ? demoState.workplaces || [] : fbWorkplaces;
    const currentOvertime = isDemoMode || !user ? demoState.overtime || [] : fbOvertime;
    const currentSalaries = isDemoMode || !user ? demoState.salaryRecords || [] : fbSalaryRecords;
    const currentPayments = isDemoMode || !user ? demoState.payments || [] : fbPayments;
    const currentAttendance = isDemoMode || !user ? demoState.attendance || [] : fbAttendance;

    const { archivedExistingId, archivedPastWorkplace, newCurrentWorkplace, updatedProfilePatch } =
      buildJobTransitionArchive({
        profile: activeProfile,
        workplaces: currentWorkplaces,
        input,
        salaryRecords: currentSalaries,
        payments: currentPayments,
        overtime: currentOvertime,
        attendance: currentAttendance,
        todayISO,
      });

    const archivedId = archivedExistingId || makeStableId('wp_past');
    const archivedWpFull: GarmentWorkplace = {
      id: archivedId,
      userId: activeProfile.userId,
      ...archivedPastWorkplace,
    };

    const newWpId = makeStableId('wp_curr');
    const newWpFull: GarmentWorkplace = {
      id: newWpId,
      userId: activeProfile.userId,
      ...newCurrentWorkplace,
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const existingList = prev.workplaces || [];
        const hasPrevInList = existingList.some((w) => w.id === archivedId || w.isCurrent);
        const updatedList = existingList.map((w) =>
          w.id === archivedId || w.isCurrent
            ? { ...archivedWpFull, id: w.id }
            : { ...w, isCurrent: false }
        );
        const finalWorkplaces = hasPrevInList
          ? [newWpFull, ...updatedList]
          : [newWpFull, archivedWpFull, ...updatedList];
        const mergedProfile: WorkerProfile = {
          ...prev.profile,
          ...updatedProfilePatch,
        };
        const next: DemoStoreState = {
          ...prev,
          profile: mergedProfile,
          workplaces: finalWorkplaces,
        };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    await saveWorkplace(archivedPastWorkplace, archivedId);
    await saveWorkplace(newCurrentWorkplace, newWpId);
    await updateProfile(updatedProfilePatch);
  };

  const deleteWorkplace = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const existingItem = (isDemoMode || !user ? demoState.workplaces || [] : fbWorkplaces).find(
      (w) => w.id === id
    );
    if (existingItem) {
      appendHistoryEntry(
        'workplace',
        'delete',
        `কর্মস্থল তথ্য “${existingItem.factoryName}” মুছে ফেলা হয়েছে`,
        `Deleted workplace record "${existingItem.factoryName}"`,
        existingItem
      );
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = {
          ...prev,
          workplaces: (prev.workplaces || []).filter((w) => w.id !== id),
        };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbWorkplaces((prev) => {
      const next = prev.filter((w) => w.id !== id);
      saveUserMirror(user.uid, { workplaces: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'workplaces', id));
        remoteKnownDocIdsRef.current.workplaces?.delete(id);
        clearOfflineMutation(user.uid, 'workplaces', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/workplaces/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveContact = async (
    rec: Omit<WorkerContact, 'id' | 'userId'>,
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = existingId || makeStableId('contact');
    const cleanPhotoUrl = (rec.photoUrl || '').trim().slice(0, 95000);
    const sanitized: Omit<WorkerContact, 'id' | 'userId'> = {
      fullName: rec.fullName.trim().slice(0, 100),
      phone: rec.phone.trim().slice(0, 30),
      photoUrl: cleanPhotoUrl,
      designation: (rec.designation || '').trim().slice(0, 100),
      category: rec.category,
      customCategory: (rec.customCategory || '').trim().slice(0, 100),
      department: (rec.department || '').trim().slice(0, 100),
      lineNumber: (rec.lineNumber || '').trim().slice(0, 50),
      notes: (rec.notes || '').trim().slice(0, 300),
      isPinned: Boolean(rec.isPinned),
      isFavorite: Boolean(rec.isFavorite),
      isEmergency: Boolean(rec.isEmergency),
      source: rec.source || 'manual',
      googleResourceName: rec.googleResourceName || '',
      isSyncedToGoogle: Boolean(rec.isSyncedToGoogle),
    };

    // Persist compressed photo directly to IndexedDB device storage for zero-data offline loads
    if (cleanPhotoUrl) {
      await saveContactPhotoToDevice(id, cleanPhotoUrl);
    } else if (existingId) {
      await deleteContactPhotoFromDevice(id);
    }

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: WorkerContact = { id, userId: prev.profile.userId, ...sanitized };
        const currentList = prev.contacts || [];
        const exists = currentList.some((c) => c.id === id);
        const contacts = exists
          ? currentList.map((c) => (c.id === id ? item : c))
          : [item, ...currentList];
        const next = { ...prev, contacts };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    setFbContacts((prev) => {
      const item: WorkerContact = { id, userId: user.uid, ...sanitized };
      const exists = prev.some((c) => c.id === id);
      const next = exists ? prev.map((c) => (c.id === id ? item : c)) : [item, ...prev];
      saveUserMirror(user.uid, { contacts: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      try {
        await ensureParentProfileInFirestore(user, activeProfile);
        await upsertSubcollectionDoc(user.uid, 'contacts', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'contacts', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.WRITE,
          `users/${user.uid}/contacts/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const toggleFavoriteContact = async (id: string, isFavorite: boolean) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const contacts = (prev.contacts || []).map((c) =>
          c.id === id ? { ...c, isFavorite } : c
        );
        const next = { ...prev, contacts };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    const target = fbContacts.find((c) => c.id === id);
    if (!target) return;
    await saveContact(
      {
        fullName: target.fullName,
        phone: target.phone,
        photoUrl: target.photoUrl,
        designation: target.designation,
        category: target.category,
        customCategory: target.customCategory,
        department: target.department,
        lineNumber: target.lineNumber,
        notes: target.notes,
        isPinned: target.isPinned,
        isFavorite,
        isEmergency: target.isEmergency,
        source: target.source,
        googleResourceName: target.googleResourceName,
        isSyncedToGoogle: target.isSyncedToGoogle,
      },
      id
    );
  };

  const deleteContact = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const existingItem = (isDemoMode || !user ? demoState.contacts || [] : fbContacts).find(
      (c) => c.id === id
    );
    if (existingItem) {
      appendHistoryEntry(
        'contact',
        'delete',
        `কন্ট্যাক্ট “${existingItem.fullName}” (${existingItem.phone}) মুছে ফেলা হয়েছে`,
        `Deleted contact "${existingItem.fullName}" (${existingItem.phone})`,
        existingItem
      );
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = {
          ...prev,
          contacts: (prev.contacts || []).filter((c) => c.id !== id),
        };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }
    setFbContacts((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveUserMirror(user.uid, { contacts: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'contacts', id));
        remoteKnownDocIdsRef.current.contacts?.delete(id);
        clearOfflineMutation(user.uid, 'contacts', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/contacts/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const saveAlarm = async (
    rec: Omit<AlarmItem, 'id' | 'userId'> & { id?: string },
    existingId?: string
  ) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id =
      (existingId && existingId.trim()) ||
      (typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : '') ||
      makeStableId('alarm');
    const cleanTime = (rec.time || '07:00').trim().slice(0, 10);
    const cleanLabel = (rec.label || 'ডিউটি অ্যালার্ম').trim().slice(0, 150) || 'ডিউটি অ্যালার্ম';
    const validTones = new Set([
      'factory_siren',
      'digital_beep',
      'gentle_chime',
      'morning_bell',
      'custom_device',
    ]);
    const sanitized: Omit<AlarmItem, 'id' | 'userId'> = {
      time: cleanTime.length >= 4 ? cleanTime : '07:00',
      label: cleanLabel,
      isEnabled: Boolean(rec.isEnabled),
      repeatDays: Array.isArray(rec.repeatDays)
        ? rec.repeatDays.filter((d) => typeof d === 'number' && d >= 0 && d <= 6)
        : [6, 0, 1, 2, 3, 4],
      toneId: validTones.has(rec.toneId) ? rec.toneId : 'custom_device',
      ...(rec.customToneName ? { customToneName: rec.customToneName.slice(0, 120) } : {}),
      ...(rec.customToneId ? { customToneId: rec.customToneId.slice(0, 128) } : {}),
      ...(rec.lastTriggeredDate ? { lastTriggeredDate: rec.lastTriggeredDate.slice(0, 20) } : {}),
    };

    if (isDemoMode || !user) {
      return;
    }

    const optimisticItem: AlarmItem = { id, userId: user.uid, ...sanitized };
    const exists = fbAlarms.some((a) => a.id === id);
    setFbAlarms((prev) => {
      const existsInPrev = prev.some((a) => a.id === id);
      const next = existsInPrev
        ? prev.map((a) => (a.id === id ? optimisticItem : a))
        : [...prev, optimisticItem];
      saveUserMirror(user.uid, { alarms: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      try {
        await upsertSubcollectionDoc(user.uid, 'alarms', id, sanitized as Record<string, any>);
        clearOfflineMutation(user.uid, 'alarms', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/alarms/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const deleteAlarm = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (isDemoMode || !user) {
      return;
    }
    setFbAlarms((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveUserMirror(user.uid, { alarms: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      refreshOfflinePendingCount();
      return;
    }
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'alarms', id));
        remoteKnownDocIdsRef.current.alarms?.delete(id);
        clearOfflineMutation(user.uid, 'alarms', id);
        refreshOfflinePendingCount();
      } catch (err) {
        reportFirestoreFailure(
          err,
          OperationType.DELETE,
          `users/${user.uid}/alarms/${id}`,
          setCloudSyncError
        );
      }
    });
  };

  const restoreDeletedRecord = async (historyId: string): Promise<boolean> => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return false;
    }
    const historyList = isDemoMode || !user ? demoState.editHistory || [] : fbEditHistory;
    const entry = historyList.find((h) => h.id === historyId);
    if (!entry || !entry.recoverablePayload) {
      return false;
    }
    const payload =
      typeof entry.recoverablePayload === 'string'
        ? (JSON.parse(entry.recoverablePayload) as Record<string, unknown>)
        : (entry.recoverablePayload as Record<string, unknown>);
    const restoredId = typeof payload.id === 'string' ? payload.id : undefined;

    if (entry.entityType === 'overtime') {
      await saveOvertime(payload as Omit<OvertimeRecord, 'id' | 'userId'>, restoredId);
    } else if (entry.entityType === 'payment') {
      await savePayment(payload as Omit<SalaryPayment, 'id' | 'userId'>, restoredId);
    } else if (entry.entityType === 'attendance') {
      await saveAttendance(payload as Omit<AttendanceRecord, 'id' | 'userId'>, restoredId);
    } else if (entry.entityType === 'expense') {
      await saveExpense(payload as Omit<ExpenseRecord, 'id' | 'userId'>, restoredId);
    } else if (entry.entityType === 'savings') {
      await saveSavingsGoal(payload as Omit<SavingsGoal, 'id' | 'userId'>, restoredId);
    } else if (entry.entityType === 'reminder') {
      await saveReminder(payload as Omit<ReminderItem, 'id' | 'userId'>, restoredId);
    } else if (entry.entityType === 'loan') {
      await saveLoan(payload as Omit<PersonalLoan, 'id' | 'userId'>, restoredId);
    } else if (entry.entityType === 'salary') {
      await saveSalaryRecord(payload as Omit<SalaryRecord, 'id' | 'userId'>, restoredId);
    } else if (entry.entityType === 'workplace') {
      await saveWorkplace(payload as Omit<GarmentWorkplace, 'id' | 'userId'>, restoredId);
    } else if (entry.entityType === 'contact') {
      await saveContact(payload as Omit<WorkerContact, 'id' | 'userId'>, restoredId);
    } else {
      return false;
    }

    // Mark entry as restored by removing recoverablePayload and logging restore
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const updatedHistory = (prev.editHistory || []).map((h) =>
          h.id === historyId
            ? {
                ...h,
                action: 'restore' as const,
                summaryBn: `পুনরুদ্ধার সম্পন্ন: ${h.summaryBn}`,
                summaryEn: `Restored: ${h.summaryEn}`,
                recoverablePayload: undefined,
              }
            : h
        );
        const next = { ...prev, editHistory: updatedHistory };
        persistCurrentLocalStore(next);
        return next;
      });
    } else {
      setFbEditHistory((prev) => {
        const updatedHistory = prev.map((h) =>
          h.id === historyId
            ? {
                ...h,
                action: 'restore' as const,
                summaryBn: `পুনরুদ্ধার সম্পন্ন: ${h.summaryBn}`,
                summaryEn: `Restored: ${h.summaryEn}`,
                recoverablePayload: undefined,
              }
            : h
        );
        saveUserMirror(user.uid, { editHistory: updatedHistory });
        return updatedHistory;
      });
    }
    return true;
  };

  const submitFeedback = async (category: FeedbackCategory, message: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const id = makeStableId('fb');
    const safeWorkerName =
      (
        activeProfile.fullName ||
        user?.displayName ||
        user?.email?.split('@')[0] ||
        'শ্রমিক ব্যবহারকারী'
      )
        .trim()
        .slice(0, 120) || 'শ্রমিক ব্যবহারকারী';
    const sanitized = {
      workerName: safeWorkerName,
      category,
      message: message.slice(0, 1000),
      status: 'open' as const,
      adminStatus: 'new' as const,
      replies: [] as NonNullable<SupportFeedback['replies']>,
    };

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const item: SupportFeedback = {
          id,
          userId: prev.profile.userId,
          ...sanitized,
          createdAt: new Date().toISOString(),
        };
        const next = { ...prev, feedback: [item, ...(prev.feedback || [])] };
        persistCurrentLocalStore(next);
        return next;
      });
      return;
    }

    const optimisticItem: SupportFeedback = {
      id,
      userId: user.uid,
      ...sanitized,
      createdAt: new Date().toISOString(),
    };
    setFbFeedback((prev) => {
      const next = [optimisticItem, ...prev];
      saveUserMirror(user.uid, { feedback: next });
      return next;
    });

    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      return;
    }

    await withPendingTracking(async () => {
      const ref = doc(db, 'feedback', id);
      try {
        await setDoc(ref, {
          userId: user.uid,
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreWarning(err, OperationType.CREATE, `feedback/${id}`);
      }
    });
  };

  const resolveFeedback = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const next = {
          ...prev,
          feedback: (prev.feedback || []).map((f) =>
            f.id === id ? { ...f, status: 'resolved' as const, adminStatus: 'resolved' as const } : f
          ),
        };
        saveDemoState(next);
        return next;
      });
      return;
    }
    setFbFeedback((prev) => {
      const next = prev.map((f) =>
        f.id === id ? { ...f, status: 'resolved' as const, adminStatus: 'resolved' as const } : f
      );
      saveUserMirror(user.uid, { feedback: next });
      return next;
    });
    if (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      !auth.currentUser ||
      auth.currentUser.uid !== user.uid
    ) {
      return;
    }
    await withPendingTracking(async () => {
      try {
        await updateDoc(doc(db, 'feedback', id), {
          status: 'resolved',
          adminStatus: 'resolved',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreWarning(err, OperationType.UPDATE, `feedback/${id}`);
      }
    });
  };

  const importBackupNonDestructive = async (
    bundle: BackupBundle
  ): Promise<{ added: number; skipped: number }> => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return { added: 0, skipped: 0 };
    }
    let totalAdded = 0;
    let totalSkipped = 0;

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const otMerge = mergeBackupRecordsNonDestructive(prev.overtime, bundle.overtime || []);
        const salMerge = mergeBackupRecordsNonDestructive(prev.salaryRecords, bundle.salaryRecords || []);
        const payMerge = mergeBackupRecordsNonDestructive(prev.payments, bundle.payments || []);
        const attMerge = mergeBackupRecordsNonDestructive(prev.attendance, bundle.attendance || []);
        const expMerge = mergeBackupRecordsNonDestructive(prev.expenses, bundle.expenses || []);
        const savMerge = mergeBackupRecordsNonDestructive(prev.savings, bundle.savings || []);
        const remMerge = mergeBackupRecordsNonDestructive(prev.reminders, bundle.reminders || []);
        const loanMerge = mergeBackupRecordsNonDestructive(prev.loans || [], bundle.loans || []);

        totalAdded =
          otMerge.addedCount +
          salMerge.addedCount +
          payMerge.addedCount +
          attMerge.addedCount +
          expMerge.addedCount +
          savMerge.addedCount +
          remMerge.addedCount +
          loanMerge.addedCount;

        totalSkipped =
          otMerge.skippedCount +
          salMerge.skippedCount +
          payMerge.skippedCount +
          attMerge.skippedCount +
          expMerge.skippedCount +
          savMerge.skippedCount +
          remMerge.skippedCount +
          loanMerge.skippedCount;

        const next: DemoStoreState = {
          ...prev,
          overtime: otMerge.merged,
          salaryRecords: salMerge.merged,
          payments: payMerge.merged,
          attendance: attMerge.merged,
          expenses: expMerge.merged,
          savings: savMerge.merged,
          reminders: remMerge.merged,
          loans: loanMerge.merged,
        };
        saveDemoState(next);
        return next;
      });
      return { added: totalAdded, skipped: totalSkipped };
    }

    for (const item of bundle.overtime || []) {
      if (!fbOvertime.some((x) => x.id === item.id)) {
        await saveOvertime(item, item.id);
        totalAdded++;
      } else {
        totalSkipped++;
      }
    }
    for (const item of bundle.salaryRecords || []) {
      if (!fbSalaryRecords.some((x) => x.id === item.id)) {
        await saveSalaryRecord(item, item.id);
        totalAdded++;
      } else {
        totalSkipped++;
      }
    }
    for (const item of bundle.payments || []) {
      if (!fbPayments.some((x) => x.id === item.id)) {
        await savePayment(item, item.id);
        totalAdded++;
      } else {
        totalSkipped++;
      }
    }
    for (const item of bundle.attendance || []) {
      if (!fbAttendance.some((x) => x.id === item.id)) {
        await saveAttendance(item, item.id);
        totalAdded++;
      } else {
        totalSkipped++;
      }
    }
    for (const item of bundle.expenses || []) {
      if (!fbExpenses.some((x) => x.id === item.id)) {
        await saveExpense(item, item.id);
        totalAdded++;
      } else {
        totalSkipped++;
      }
    }
    for (const item of bundle.savings || []) {
      if (!fbSavings.some((x) => x.id === item.id)) {
        await saveSavingsGoal(item, item.id);
        totalAdded++;
      } else {
        totalSkipped++;
      }
    }
    for (const item of bundle.reminders || []) {
      if (!fbReminders.some((x) => x.id === item.id)) {
        await saveReminder(item, item.id);
        totalAdded++;
      } else {
        totalSkipped++;
      }
    }
    for (const item of bundle.loans || []) {
      if (!fbLoans.some((x) => x.id === item.id)) {
        await saveLoan(item, item.id);
        totalAdded++;
      } else {
        totalSkipped++;
      }
    }

    return { added: totalAdded, skipped: totalSkipped };
  };

  const seedSampleDemoData = useCallback(async (): Promise<{ added: number }> => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return { added: 0 };
    }
    const sample = getInitialDemoState();
    let totalAdded = 0;

    if (isDemoMode || !user) {
      setDemoState((prev) => {
        const mergeNonDestructive = <T extends { id: string }>(
          curr: T[],
          incoming: T[]
        ): T[] => {
          const seen = new Set(curr.map((x) => x.id));
          const additions = incoming
            .filter((x) => !seen.has(x.id))
            .map((x) => ({ ...x, userId: prev.profile.userId }));
          totalAdded += additions.length;
          return [...curr, ...additions];
        };

        const hasProfileSalary = (prev.profile.basicSalary || 0) > 0;
        const nextProfile: WorkerProfile = hasProfileSalary
          ? prev.profile
          : {
              ...sample.profile,
              ...prev.profile,
              userId: prev.profile.userId,
              fullName: prev.profile.fullName || sample.profile.fullName,
              factoryName: prev.profile.factoryName || sample.profile.factoryName,
              designation: prev.profile.designation || sample.profile.designation,
              basicSalary: sample.profile.basicSalary,
              houseRentAllowance: sample.profile.houseRentAllowance,
              medicalAllowance: sample.profile.medicalAllowance,
              transportAllowance: sample.profile.transportAllowance,
              foodAllowance: sample.profile.foodAllowance,
              attendanceBonus: sample.profile.attendanceBonus,
              grossSalary: sample.profile.grossSalary,
            };

        const next: DemoStoreState = {
          ...prev,
          profile: nextProfile,
          overtime: mergeNonDestructive(prev.overtime || [], sample.overtime),
          salaryRecords: mergeNonDestructive(prev.salaryRecords || [], sample.salaryRecords),
          payments: mergeNonDestructive(prev.payments || [], sample.payments),
          attendance: mergeNonDestructive(prev.attendance || [], sample.attendance),
          expenses: mergeNonDestructive(prev.expenses || [], sample.expenses),
          savings: mergeNonDestructive(prev.savings || [], sample.savings),
          reminders: mergeNonDestructive(prev.reminders || [], sample.reminders),
          loans: mergeNonDestructive(prev.loans || [], sample.loans),
          workplaces: mergeNonDestructive(prev.workplaces || [], sample.workplaces),
          contacts: mergeNonDestructive(prev.contacts || [], sample.contacts),
        };
        persistCurrentLocalStore(next);
        return next;
      });
      return { added: totalAdded };
    }

    const uid = user.uid;
    await ensureParentProfileInFirestore(user);

    const mergeAndSync = async <T extends { id: string }>(
      colName: Exclude<OfflineSyncCollection, 'profile' | 'userDirectory'>,
      current: T[],
      sampleItems: T[],
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      const seen = new Set(current.map((x) => x.id));
      const toAdd = sampleItems
        .filter((x) => !seen.has(x.id))
        .map((x) => ({ ...x, userId: uid }));
      if (toAdd.length === 0) return;
      totalAdded += toAdd.length;
      const merged = [...current, ...toAdd];
      setter(merged);
      saveUserMirror(uid, { [colName]: merged });
      for (const item of toAdd) {
        try {
          await upsertSubcollectionDoc(uid, colName, item.id, item as Record<string, any>);
          clearOfflineMutation(uid, colName, item.id);
        } catch (err) {
          reportFirestoreFailure(
            err,
            OperationType.CREATE,
            `users/${uid}/${colName}/${item.id}`,
            setCloudSyncError
          );
        }
      }
    };

    if (!fbProfile || (fbProfile.basicSalary || 0) <= 0) {
      const enrichedProfile: WorkerProfile = {
        ...(fbProfile || defaultWorkerProfile(uid, user.displayName)),
        factoryName: fbProfile?.factoryName || sample.profile.factoryName,
        department: fbProfile?.department || sample.profile.department,
        designation: fbProfile?.designation || sample.profile.designation,
        basicSalary: sample.profile.basicSalary,
        houseRentAllowance: sample.profile.houseRentAllowance,
        medicalAllowance: sample.profile.medicalAllowance,
        transportAllowance: sample.profile.transportAllowance,
        foodAllowance: sample.profile.foodAllowance,
        attendanceBonus: sample.profile.attendanceBonus,
        grossSalary: sample.profile.grossSalary,
      };
      setFbProfile(enrichedProfile);
      saveUserMirror(uid, { profile: enrichedProfile });
      try {
        await persistWorkerProfileDoc(uid, enrichedProfile, user.displayName, true);
        clearOfflineMutation(uid, 'profile', 'profile');
      } catch (err) {
        reportFirestoreFailure(err, OperationType.UPDATE, `users/${uid}`, setCloudSyncError);
      }
    }

    await mergeAndSync('overtime', fbOvertime, sample.overtime, setFbOvertime);
    await mergeAndSync('salaryRecords', fbSalaryRecords, sample.salaryRecords, setFbSalaryRecords);
    await mergeAndSync('payments', fbPayments, sample.payments, setFbPayments);
    await mergeAndSync('attendance', fbAttendance, sample.attendance, setFbAttendance);
    await mergeAndSync('expenses', fbExpenses, sample.expenses, setFbExpenses);
    await mergeAndSync('savings', fbSavings, sample.savings, setFbSavings);
    await mergeAndSync('reminders', fbReminders, sample.reminders, setFbReminders);
    await mergeAndSync('loans', fbLoans, sample.loans, setFbLoans);
    await mergeAndSync('workplaces', fbWorkplaces, sample.workplaces, setFbWorkplaces);
    await mergeAndSync('contacts', fbContacts, sample.contacts, setFbContacts);
    refreshOfflinePendingCount();

    return { added: totalAdded };
  }, [
    isReadOnlyDemo,
    triggerReadOnlyBlock,
    isDemoMode,
    user,
    persistCurrentLocalStore,
    ensureParentProfileInFirestore,
    persistWorkerProfileDoc,
    upsertSubcollectionDoc,
    fbProfile,
    fbOvertime,
    fbSalaryRecords,
    fbPayments,
    fbAttendance,
    fbExpenses,
    fbSavings,
    fbReminders,
    fbLoans,
    fbWorkplaces,
    fbContacts,
    refreshOfflinePendingCount,
  ]);

  const value: DataContextValue = {
    user,
    authReady,
    cloudDataLoaded,
    cloudSyncError,
    clearCloudSyncError,
    isDemoMode,
    isReadOnlyDemo,
    readOnlyBlockedNotice,
    triggerReadOnlyBlock,
    dismissReadOnlyNotice,
    publicDemoConfig,
    updatePublicDemoConfig,
    enterDemoMode,
    exitDemoMode,
    exitDemoToSignUp,
    initialAuthMode,
    clearInitialAuthMode,
    resetDemoData,
    pendingWritesCount,
    offlinePendingCount,
    syncOfflineDataToCloud,
    todayISO,
    currentMonthISO,
    selectedMonth,
    setSelectedMonth,
    darkMode,
    toggleDarkMode,
    lang,
    setLang,
    profile: activeProfile,
    overtime: isDemoMode || !user ? demoState.overtime : fbOvertime,
    salaryRecords: isDemoMode || !user ? demoState.salaryRecords : fbSalaryRecords,
    payments: isDemoMode || !user ? demoState.payments : fbPayments,
    attendance: isDemoMode || !user ? demoState.attendance : fbAttendance,
    expenses: isDemoMode || !user ? demoState.expenses : fbExpenses,
    savings: isDemoMode || !user ? demoState.savings : fbSavings,
    documents: isDemoMode || !user ? demoState.documents : fbDocuments,
    reminders: isDemoMode || !user ? demoState.reminders : fbReminders,
    loans: isDemoMode || !user ? demoState.loans || [] : fbLoans,
    workplaces: isDemoMode || !user ? demoState.workplaces || [] : fbWorkplaces,
    contacts: isDemoMode || !user ? demoState.contacts || [] : fbContacts,
    alarms: isDemoMode || !user ? [] : fbAlarms,
    editHistory: isDemoMode || !user ? demoState.editHistory || [] : fbEditHistory,
    feedbackList: isDemoMode || !user ? demoState.feedback || [] : fbFeedback,
    isAdminUser: isVerifiedAdmin,
    loginWithGoogle,
    loginWithCredentials,
    signUpWithCredentials,
    changeUserPassword,
    needsOnboarding: !isReadOnlyDemo && needsOnboarding,
    isManualSetupMode,
    isProfileSetupIncomplete,
    reopenOnboarding,
    completeOnboarding,
    logout,
    deleteAccountAndData,
    updateProfile,
    saveOvertime,
    deleteOvertime,
    saveSalaryRecord,
    deleteSalaryRecord,
    savePayment,
    deletePayment,
    saveAttendance,
    deleteAttendance,
    saveExpense,
    deleteExpense,
    saveSavingsGoal,
    deleteSavingsGoal,
    saveVaultDocument,
    deleteVaultDocument,
    saveReminder,
    toggleReminder,
    deleteReminder,
    saveLoan,
    payLoanInstallment,
    addLoanRepayment,
    deleteLoanRepayment,
    settleLoan,
    archiveLoan,
    deleteLoan,
    saveWorkplace,
    deleteWorkplace,
    transitionToNewGarmentJob,
    saveContact,
    deleteContact,
    toggleFavoriteContact,
    saveAlarm,
    deleteAlarm,
    restoreDeletedRecord,
    submitFeedback,
    resolveFeedback,
    importBackupNonDestructive,
    seedSampleDemoData,
    subscriptionConfig,
    subscriptionPlans,
    userSubscription,
    activePlan,
    isSubscriptionSystemEnabled,
    subscriptionRenewalNotice,
    checkFeatureAccess,
    coupons,
    saveCoupon,
    deleteCoupon,
    validateCoupon,
    updateGlobalSubscriptionConfig,
    saveSubscriptionPlan,
    deleteSubscriptionPlan,
    requestPlanUpgrade,
    adminAssignUserPlan,
    adminProcessPaymentRequest,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData must be used inside DataProvider');
  }
  return ctx;
}
