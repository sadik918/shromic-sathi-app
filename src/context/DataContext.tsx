import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseAuthProfile,
  signOut,
  deleteUser,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, OperationType } from '../firebase';
import type {
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

interface DataContextValue {
  user: User | null;
  authReady: boolean;
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
  editHistory: EditHistoryEntry[];
  feedbackList: SupportFeedback[];
  isAdminUser: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<void>;
  signUpWithCredentials: (fullName: string, identifier: string, password: string) => Promise<void>;
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
  restoreDeletedRecord: (historyId: string) => Promise<boolean>;
  submitFeedback: (category: FeedbackCategory, message: string) => Promise<void>;
  resolveFeedback: (id: string) => Promise<void>;
  importBackupNonDestructive: (bundle: BackupBundle) => Promise<{ added: number; skipped: number }>;
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

function logFirestoreWarning(err: unknown, operationType: OperationType, path: string) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[Firestore Sync Notice] ${operationType} on ${path}: ${msg}`);
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
  editHistory: EditHistoryEntry[];
  feedback: SupportFeedback[];
}

function loadUserMirror(uid: string): UserLocalMirror {
  try {
    const raw = localStorage.getItem(`shromik_sathi_cloud_mirror_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as UserLocalMirror;
      return {
        ...parsed,
        loans: parsed.loans || [],
        workplaces: parsed.workplaces || [],
        contacts: parsed.contacts || [],
        editHistory: parsed.editHistory || [],
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
    editHistory: [],
    feedback: [],
  };
}

function saveUserMirror(uid: string, patch: Partial<UserLocalMirror>) {
  try {
    const current = loadUserMirror(uid);
    const updated = { ...current, ...patch };
    localStorage.setItem(`shromik_sathi_cloud_mirror_${uid}`, JSON.stringify(updated));
  } catch {
    // ignore quota errors
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

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Require login by default unless authenticated locally
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('onboarding') === '1') {
        return true;
      }
      if (localStorage.getItem('shromik_sathi_demo_active') === '1') {
        return true;
      }
      return false;
    }
    return false;
  });

  const [isReadOnlyDemo, setIsReadOnlyDemo] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('onboarding') === '1') {
        return false;
      }
      const activeEmail = (localStorage.getItem('shromik_sathi_active_email') || '')
        .trim()
        .toLowerCase();
      return (
        localStorage.getItem('shromik_sathi_readonly_demo') === '1' ||
        activeEmail === PUBLIC_DEMO_EMAIL
      );
    }
    return false;
  });

  const [publicDemoConfig, setPublicDemoConfig] = useState<PublicDemoSystemConfig>(() =>
    loadPublicDemoConfig()
  );
  const [readOnlyBlockedNotice, setReadOnlyBlockedNotice] = useState<string>('');
  const [initialAuthMode, setInitialAuthMode] = useState<'signin' | 'signup'>('signin');

  const [activeLocalEmail, setActiveLocalEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shromik_sathi_active_email') || '';
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
    return loadDemoState();
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
        saveUserStore(activeLocalEmail, nextState);
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
  const [todayISO, setTodayISO] = useState<string>(() => getTodayISO());
  const currentMonthISO = getCurrentMonthISO(todayISO);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthISO(getTodayISO()));
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

  // Automatically keep todayISO updated in real time if the calendar day advances
  useEffect(() => {
    const syncToday = () => {
      const nextToday = getTodayISO();
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
  const [fbProfile, setFbProfile] = useState<WorkerProfile | null>(null);
  const [fbOvertime, setFbOvertime] = useState<OvertimeRecord[]>([]);
  const [fbSalaryRecords, setFbSalaryRecords] = useState<SalaryRecord[]>([]);
  const [fbPayments, setFbPayments] = useState<SalaryPayment[]>([]);
  const [fbAttendance, setFbAttendance] = useState<AttendanceRecord[]>([]);
  const [fbExpenses, setFbExpenses] = useState<ExpenseRecord[]>([]);
  const [fbSavings, setFbSavings] = useState<SavingsGoal[]>([]);
  const [fbDocuments, setFbDocuments] = useState<VaultDocument[]>([]);
  const [fbReminders, setFbReminders] = useState<ReminderItem[]>([]);
  const [fbLoans, setFbLoans] = useState<PersonalLoan[]>([]);
  const [fbWorkplaces, setFbWorkplaces] = useState<GarmentWorkplace[]>([]);
  const [fbContacts, setFbContacts] = useState<WorkerContact[]>([]);
  const [fbEditHistory, setFbEditHistory] = useState<EditHistoryEntry[]>([]);
  const [fbFeedback, setFbFeedback] = useState<SupportFeedback[]>([]);

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

  const updatePublicDemoConfig = useCallback((patch: Partial<PublicDemoSystemConfig>) => {
    const next = savePublicDemoConfig(patch);
    setPublicDemoConfig(next);
  }, []);

  const clearInitialAuthMode = useCallback(() => {
    setInitialAuthMode('signin');
  }, []);

  const enterDemoMode = useCallback(() => {
    const check = validateDemoLoginAttempt({
      identifier: PUBLIC_DEMO_EMAIL,
      viaQuickButton: true,
    });
    if (!check.allowed) {
      throw new Error(check.errorBn || 'ডেমো মোড বর্তমানে বন্ধ আছে।');
    }
    // Always load pristine sample data when entering public read-only demo mode
    const freshSample = getInitialDemoState();
    setDemoState(freshSample);
    const updatedStats = recordDemoSessionStart();
    setPublicDemoConfig(updatedStats);
    setActiveLocalEmail(PUBLIC_DEMO_EMAIL);
    localStorage.setItem('shromik_sathi_active_email', PUBLIC_DEMO_EMAIL);
    localStorage.setItem('shromik_sathi_readonly_demo', '1');
    setIsReadOnlyDemo(true);
    setIsDemoMode(true);
    localStorage.setItem('shromik_sathi_demo_active', '1');
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

  // Ensure parent profile document exists in Firestore before subcollection writes
  const ensureParentProfileInFirestore = useCallback(
    async (currentUser: User, fallbackProfile?: WorkerProfile) => {
      if (profileEnsuredRef.current === currentUser.uid) {
        return;
      }
      const userDocRef = doc(db, 'users', currentUser.uid);
      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          const base = fallbackProfile || defaultWorkerProfile(currentUser.uid, currentUser.displayName);
          const { createdAt: _c, updatedAt: _u, ...cleanFields } = base;
          await setDoc(userDocRef, {
            ...cleanFields,
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        profileEnsuredRef.current = currentUser.uid;
      } catch (err) {
        logFirestoreWarning(err, OperationType.CREATE, `users/${currentUser.uid}`);
      }
    },
    []
  );

  // Auth listener
  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      setAuthReady(true);
    }, 1200);
    const unsub = onAuthStateChanged(auth, (u) => {
      window.clearTimeout(fallbackTimer);
      setUser(u);
      setAuthReady(true);
      if (u) {
        const mirror = loadUserMirror(u.uid);
        setFbProfile(mirror.profile || defaultWorkerProfile(u.uid, u.displayName));
        setFbOvertime(mirror.overtime);
        setFbSalaryRecords(mirror.salaryRecords);
        setFbPayments(mirror.payments);
        setFbAttendance(mirror.attendance);
        setFbExpenses(mirror.expenses);
        setFbSavings(mirror.savings);
        setFbDocuments(mirror.documents);
        setFbReminders(mirror.reminders);
        setFbLoans(mirror.loans || []);
        setFbWorkplaces(mirror.workplaces || []);
        setFbContacts(mirror.contacts || []);
        setFbEditHistory(mirror.editHistory || []);
        setFbFeedback(mirror.feedback);

        // If URL did not explicitly force demo=1, switch to authenticated cloud workspace
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') !== '1' && params.get('demo') !== '1') {
          setIsDemoMode(false);
          localStorage.setItem('shromik_sathi_demo_active', '0');
        }
      }
    });
    return () => {
      window.clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  // Attach Firestore listeners when authenticated and NOT in demo mode
  useEffect(() => {
    if (!authReady || !user || isDemoMode) {
      return;
    }

    const uid = user.uid;
    const userDocRef = doc(db, 'users', uid);

    const unsubProfile = onSnapshot(
      userDocRef,
      async (snap) => {
        if (snap.exists()) {
          const remoteProfile = snap.data() as WorkerProfile;
          profileEnsuredRef.current = uid;
          setFbProfile(remoteProfile);
          saveUserMirror(uid, { profile: remoteProfile });
        } else {
          const initialProfile = defaultWorkerProfile(uid, user.displayName);
          setFbProfile(initialProfile);
          saveUserMirror(uid, { profile: initialProfile });
          try {
            const { createdAt: _c, updatedAt: _u, ...cleanFields } = initialProfile;
            await setDoc(userDocRef, {
              ...cleanFields,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            profileEnsuredRef.current = uid;
          } catch (err) {
            logFirestoreWarning(err, OperationType.CREATE, `users/${uid}`);
          }
        }
      },
      (err) => logFirestoreWarning(err, OperationType.GET, `users/${uid}`)
    );

    const subCollections: Array<{
      name: keyof Omit<UserLocalMirror, 'profile' | 'feedback' | 'editHistory'>;
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
    ];

    const unsubs = subCollections.map(({ name, setter }) => {
      const colRef = collection(db, 'users', uid, name);
      const q = query(colRef, where('userId', '==', uid));
      return onSnapshot(
        q,
        (snap) => {
          const remoteList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setter((prevLocal) => {
            const merged = remoteList.length > 0 ? mergeById(prevLocal, remoteList) : prevLocal;
            saveUserMirror(uid, { [name]: merged });
            return merged;
          });
        },
        (err) => logFirestoreWarning(err, OperationType.LIST, `users/${uid}/${name}`)
      );
    });

    const feedbackQuery =
      user.email === 'sadikulislam45974@gmail.com'
        ? collection(db, 'feedback')
        : query(collection(db, 'feedback'), where('userId', '==', uid));

    const unsubFeedback = onSnapshot(
      feedbackQuery,
      (snap) => {
        const remoteFb = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupportFeedback, 'id'>),
        }));
        setFbFeedback((prev) => {
          const merged = remoteFb.length > 0 ? mergeById(prev, remoteFb) : prev;
          saveUserMirror(uid, { feedback: merged });
          return merged;
        });
      },
      (err) => logFirestoreWarning(err, OperationType.LIST, 'feedback')
    );

    return () => {
      unsubProfile();
      unsubs.forEach((u) => u());
      unsubFeedback();
    };
  }, [authReady, user, isDemoMode]);

  const activeProfile: WorkerProfile = isDemoMode
    ? demoState.profile
    : fbProfile || defaultWorkerProfile(user?.uid || 'guest', user?.displayName);

  const lang: Language = langState || activeProfile.language || 'bn';

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

    if (!user || isDemoMode) {
      const localRecord = readLocalUserSub(
        activeLocalEmail,
        activeProfile?.userId,
        'demo_worker'
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
      try {
        await setDoc(doc(db, 'subscriptionConfig', 'global'), nextConfig, { merge: true });
      } catch (err) {
        logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/global');
      }
    },
    [subscriptionConfig]
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
      try {
        await setDoc(
          doc(db, 'subscriptionConfig', 'plans_catalog'),
          { plans: nextPlans, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } catch (err) {
        logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/plans_catalog');
      }
    },
    [subscriptionPlans, isReadOnlyDemo, triggerReadOnlyBlock]
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
      try {
        await setDoc(
          doc(db, 'subscriptionConfig', 'plans_catalog'),
          { plans: nextPlans, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } catch (err) {
        logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/plans_catalog');
      }
    },
    [subscriptionPlans, isReadOnlyDemo, triggerReadOnlyBlock]
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
      try {
        await setDoc(
          doc(db, 'subscriptionConfig', 'coupons_catalog'),
          { coupons: nextCoupons, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } catch (err) {
        logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/coupons_catalog');
      }
    },
    [coupons, isReadOnlyDemo, triggerReadOnlyBlock]
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
      try {
        await setDoc(
          doc(db, 'subscriptionConfig', 'coupons_catalog'),
          { coupons: nextCoupons, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } catch (err) {
        logFirestoreWarning(err, OperationType.UPDATE, 'subscriptionConfig/coupons_catalog');
      }
    },
    [coupons, isReadOnlyDemo, triggerReadOnlyBlock]
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

      const paymentRequest: SubscriptionPaymentRequest = {
        id: makeStableId('payreq'),
        userId: effectiveUid,
        userName: user?.displayName || activeProfile.fullName || 'শ্রমিক ব্যবহারকারী',
        userPhone: activeProfile.phone || req.senderPhone,
        planId: req.planId,
        billingCycle: req.billingCycle,
        amountBdt: originalAmount,
        discountAmountBdt: discountAmount,
        finalAmountBdt: finalAmount,
        couponCode: req.couponCode,
        isRenewal: Boolean(req.isRenewal),
        paymentMethod: req.paymentMethod,
        transactionId: req.transactionId.trim(),
        senderPhone: req.senderPhone.trim(),
        requestedAt: new Date().toISOString(),
        status: 'pending',
        notes: req.notes,
      };

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
          startedAt: new Date().toISOString(),
        }),
        pendingRequest: paymentRequest,
        updatedAt: new Date().toISOString(),
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
      if (user) {
        try {
          await setDoc(doc(db, 'userSubscriptions', user.uid), nextRecord, { merge: true });
        } catch (err) {
          logFirestoreWarning(err, OperationType.UPDATE, `userSubscriptions/${user.uid}`);
        }
      }
    },
    [isReadOnlyDemo, triggerReadOnlyBlock, user, activeLocalEmail, subscriptionPlans, userSubscription, activeProfile.fullName, activeProfile.userId, activeProfile.phone]
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
        complimentaryReason: assignment.isComplimentary ? assignment.reason : undefined,
        grantedByAdminUid: user?.uid || 'admin',
        grantedByAdminEmail: user?.email || activeLocalEmail || undefined,
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

      try {
        await setDoc(doc(db, 'userSubscriptions', safeFirestoreId), nextRecord, { merge: true });
      } catch (err) {
        logFirestoreWarning(err, OperationType.UPDATE, `userSubscriptions/${safeFirestoreId}`);
      }
    },
    [subscriptionPlans, user, activeLocalEmail, activeProfile?.userId, todayISO]
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
          verifiedByAdminUid: user?.uid,
          adminNotes: note,
        };

        let patch: Partial<UserSubscriptionRecord> = {
          pendingRequest: updatedPending,
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

        const mergedRecord = { ...data, ...patch } as UserSubscriptionRecord;
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
        if (snap.exists()) {
          await updateDoc(targetDocRef, patch);
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

      // Keep active current workplace synced if factory details changed
      if (
        patch.factoryName !== undefined ||
        patch.factoryBranch !== undefined ||
        patch.department !== undefined ||
        patch.designation !== undefined ||
        patch.employeeId !== undefined ||
        patch.joiningDate !== undefined
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

      // Immediate optimistic update
      setFbProfile(merged);
      saveUserMirror(user.uid, { profile: merged });

      await withPendingTracking(async () => {
        await ensureParentProfileInFirestore(user, merged);
        const ref = doc(db, 'users', user.uid);
        const { createdAt: _c, updatedAt: _u, userId: _id, ...updateFields } = merged;
        try {
          await updateDoc(ref, {
            ...updateFields,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          logFirestoreWarning(err, OperationType.UPDATE, `users/${user.uid}`);
        }
      });
    },
    [activeProfile, isDemoMode, isReadOnlyDemo, triggerReadOnlyBlock, user, ensureParentProfileInFirestore, langState]
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

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
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

    // Handle dedicated Read-Only Demo Account login (demo@therate.gmail.com)
    if (isDemoAccountEmail(cleanId)) {
      const check = validateDemoLoginAttempt({
        identifier: cleanId,
        password,
        viaQuickButton: false,
      });
      if (!check.allowed) {
        throw new Error(lang === 'bn' ? check.errorBn : check.errorEn);
      }
      enterDemoMode();
      return;
    }

    // Check local registered accounts first or fallback if Firebase Email/Password is not enabled
    const localAccountsRaw = localStorage.getItem('shromik_sathi_local_accounts');
    const localAccounts: Array<{
      identifier: string;
      email: string;
      password: string;
      fullName: string;
    }> = localAccountsRaw ? JSON.parse(localAccountsRaw) : [];

    const email = normalizeIdentifierToEmail(cleanId);
    const matchedLocal = localAccounts.find(
      (a) =>
        a.identifier.toLowerCase() === cleanId.toLowerCase() ||
        a.email.toLowerCase() === email.toLowerCase()
    );

    if (matchedLocal && matchedLocal.password !== password) {
      throw new Error(
        lang === 'bn'
          ? 'পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।'
          : 'Incorrect password. Please try again.'
      );
    }

    setIsReadOnlyDemo(false);
    localStorage.removeItem('shromik_sathi_readonly_demo');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setActiveLocalEmail(email);
      localStorage.setItem('shromik_sathi_active_email', email);
      setIsDemoMode(false);
      localStorage.setItem('shromik_sathi_demo_active', '0');
      return;
    } catch {
      // Fallback to local session so login works seamlessly even if Email/Password provider isn't enabled in Firebase console
      const displayFullName =
        matchedLocal?.fullName ||
        (cleanId.includes('@') ? cleanId.split('@')[0] : cleanId);
      const userStore = loadUserStore(email, displayFullName);
      setDemoState(userStore);
      setActiveLocalEmail(email);
      localStorage.setItem('shromik_sathi_active_email', email);
      setIsDemoMode(true);
      localStorage.setItem('shromik_sathi_demo_active', '1');
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
          ? 'এই ইমেইলটি শুধুমাত্র ডেমো প্রিভিউর জন্য সংরক্ষিত। অনুগ্রহ করে আপনার নিজের ইমেইল বা মোবাইল নম্বর ব্যবহার করুন।'
          : 'This email is reserved for the Read-Only Demo account. Please use your personal email or phone number.'
      );
    }
    if (password.length < 4) {
      throw new Error(
        lang === 'bn'
          ? 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।'
          : 'Password must be at least 4 characters.'
      );
    }

    const email = normalizeIdentifierToEmail(cleanId);
    setIsReadOnlyDemo(false);
    localStorage.removeItem('shromik_sathi_readonly_demo');

    // Create completely isolated empty user store for newly registered user
    const newEmptyStore = createEmptyUserStore(email, cleanName);
    saveUserStore(email, newEmptyStore);

    // Save in local accounts registry
    try {
      const localAccountsRaw = localStorage.getItem('shromik_sathi_local_accounts');
      const localAccounts: Array<{
        identifier: string;
        email: string;
        password: string;
        fullName: string;
      }> = localAccountsRaw ? JSON.parse(localAccountsRaw) : [];
      const filtered = localAccounts.filter(
        (a) =>
          a.identifier.toLowerCase() !== cleanId.toLowerCase() &&
          a.email.toLowerCase() !== email.toLowerCase()
      );
      filtered.push({
        identifier: cleanId,
        email,
        password,
        fullName: cleanName,
      });
      localStorage.setItem('shromik_sathi_local_accounts', JSON.stringify(filtered));
    } catch {
      // ignore storage errors
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (cred.user) {
        await updateFirebaseAuthProfile(cred.user, { displayName: cleanName });
      }
      setActiveLocalEmail(email);
      localStorage.setItem('shromik_sathi_active_email', email);
      setIsDemoMode(false);
      localStorage.setItem('shromik_sathi_demo_active', '0');
      localStorage.removeItem('shromik_sathi_manual_setup_mode');
      setIsManualSetupMode(false);
      localStorage.setItem('shromik_sathi_needs_onboarding', '1');
      setNeedsOnboarding(true);
      return;
    } catch {
      // Seamless local account activation with onboarding and blank user store
      setDemoState(newEmptyStore);
      setActiveLocalEmail(email);
      localStorage.setItem('shromik_sathi_active_email', email);
      setIsDemoMode(true);
      localStorage.setItem('shromik_sathi_demo_active', '1');
      localStorage.removeItem('shromik_sathi_manual_setup_mode');
      setIsManualSetupMode(false);
      localStorage.setItem('shromik_sathi_needs_onboarding', '1');
      setNeedsOnboarding(true);
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
    localStorage.removeItem('shromik_sathi_needs_onboarding');
    localStorage.removeItem('shromik_sathi_manual_setup_mode');
    setNeedsOnboarding(false);
    setIsManualSetupMode(false);
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
    const liveToday = getTodayISO();
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

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      const ref = doc(db, 'users', user.uid, 'overtime', id);
      try {
        if (exists) {
          await updateDoc(ref, {
            ...sanitized,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(ref, {
            userId: user.uid,
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        logFirestoreWarning(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/overtime/${id}`
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'overtime', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/overtime/${id}`);
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

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      const ref = doc(db, 'users', user.uid, 'salaryRecords', id);
      try {
        if (exists) {
          await updateDoc(ref, { ...sanitized, updatedAt: serverTimestamp() });
        } else {
          await setDoc(ref, {
            userId: user.uid,
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        logFirestoreWarning(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/salaryRecords/${id}`
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'salaryRecords', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/salaryRecords/${id}`);
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

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      const ref = doc(db, 'users', user.uid, 'payments', id);
      try {
        if (exists) {
          await updateDoc(ref, { ...sanitized, updatedAt: serverTimestamp() });
        } else {
          await setDoc(ref, {
            userId: user.uid,
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        logFirestoreWarning(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/payments/${id}`
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'payments', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/payments/${id}`);
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
    const liveToday = getTodayISO();
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

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      const ref = doc(db, 'users', user.uid, 'attendance', id);
      try {
        if (exists) {
          await updateDoc(ref, { ...sanitized, updatedAt: serverTimestamp() });
        } else {
          await setDoc(ref, {
            userId: user.uid,
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        logFirestoreWarning(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/attendance/${id}`
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'attendance', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/attendance/${id}`);
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

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      const ref = doc(db, 'users', user.uid, 'expenses', id);
      try {
        if (exists) {
          await updateDoc(ref, { ...sanitized, updatedAt: serverTimestamp() });
        } else {
          await setDoc(ref, {
            userId: user.uid,
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        logFirestoreWarning(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/expenses/${id}`
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'expenses', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/expenses/${id}`);
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
    const sanitized = {
      title: rec.title.slice(0, 120),
      targetAmount: Number(rec.targetAmount) || 0,
      savedAmount: Number(rec.savedAmount) || 0,
      monthlyBudget: Number(rec.monthlyBudget) || 0,
      deadline: (rec.deadline || '').slice(0, 20),
      notes: (rec.notes || '').slice(0, 250),
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

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      const ref = doc(db, 'users', user.uid, 'savings', id);
      try {
        if (exists) {
          await updateDoc(ref, { ...sanitized, updatedAt: serverTimestamp() });
        } else {
          await setDoc(ref, {
            userId: user.uid,
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        logFirestoreWarning(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/savings/${id}`
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'savings', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/savings/${id}`);
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

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      const ref = doc(db, 'users', user.uid, 'documents', id);
      try {
        await setDoc(ref, {
          userId: user.uid,
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logFirestoreWarning(err, OperationType.CREATE, `users/${user.uid}/documents/${id}`);
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'documents', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/documents/${id}`);
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

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      const ref = doc(db, 'users', user.uid, 'reminders', id);
      try {
        if (exists) {
          await updateDoc(ref, { ...sanitized, updatedAt: serverTimestamp() });
        } else {
          await setDoc(ref, {
            userId: user.uid,
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        logFirestoreWarning(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/reminders/${id}`
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'reminders', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/reminders/${id}`);
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

    await withPendingTracking(async () => {
      await ensureParentProfileInFirestore(user, activeProfile);
      const ref = doc(db, 'users', user.uid, 'loans', id);
      try {
        if (exists) {
          await updateDoc(ref, { ...sanitized, updatedAt: serverTimestamp() });
        } else {
          await setDoc(ref, {
            userId: user.uid,
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        logFirestoreWarning(
          err,
          exists ? OperationType.UPDATE : OperationType.CREATE,
          `users/${user.uid}/loans/${id}`
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'loans', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/loans/${id}`);
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
    const id = existingId || makeStableId('wp');
    const sanitized: Omit<GarmentWorkplace, 'id' | 'userId'> = {
      factoryName: rec.factoryName.trim().slice(0, 150),
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

    setFbWorkplaces((prev) => {
      const item: GarmentWorkplace = { id, userId: user.uid, ...sanitized };
      let updated = prev;
      if (sanitized.isCurrent) {
        updated = updated.map((w) => ({ ...w, isCurrent: w.id === id }));
      }
      const exists = updated.some((w) => w.id === id);
      const next = exists ? updated.map((w) => (w.id === id ? item : w)) : [item, ...updated];
      saveUserMirror(user.uid, { workplaces: next });
      return next;
    });

    await withPendingTracking(async () => {
      try {
        await ensureParentProfileInFirestore(user);
        const docRef = doc(db, 'users', user.uid, 'workplaces', id);
        await setDoc(
          docRef,
          {
            id,
            userId: user.uid,
            ...sanitized,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        logFirestoreWarning(err, OperationType.CREATE, `users/${user.uid}/workplaces/${id}`);
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'workplaces', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/workplaces/${id}`);
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
    const sanitized: Omit<WorkerContact, 'id' | 'userId'> = {
      fullName: rec.fullName.trim().slice(0, 100),
      phone: rec.phone.trim().slice(0, 30),
      designation: (rec.designation || '').trim().slice(0, 100),
      category: rec.category,
      department: (rec.department || '').trim().slice(0, 100),
      lineNumber: (rec.lineNumber || '').trim().slice(0, 50),
      notes: (rec.notes || '').trim().slice(0, 300),
      isFavorite: Boolean(rec.isFavorite),
      isEmergency: Boolean(rec.isEmergency),
      source: rec.source || 'manual',
      googleResourceName: rec.googleResourceName || '',
      isSyncedToGoogle: Boolean(rec.isSyncedToGoogle),
    };

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

    await withPendingTracking(async () => {
      try {
        await ensureParentProfileInFirestore(user);
        const docRef = doc(db, 'users', user.uid, 'contacts', id);
        await setDoc(
          docRef,
          {
            id,
            userId: user.uid,
            ...sanitized,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        logFirestoreWarning(err, OperationType.CREATE, `users/${user.uid}/contacts/${id}`);
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
        designation: target.designation,
        category: target.category,
        department: target.department,
        lineNumber: target.lineNumber,
        notes: target.notes,
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
    await withPendingTracking(async () => {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'contacts', id));
      } catch (err) {
        logFirestoreWarning(err, OperationType.DELETE, `users/${user.uid}/contacts/${id}`);
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
    const sanitized = {
      workerName: activeProfile.fullName.slice(0, 120),
      category,
      message: message.slice(0, 1000),
      status: 'open' as const,
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
            f.id === id ? { ...f, status: 'resolved' as const } : f
          ),
        };
        saveDemoState(next);
        return next;
      });
      return;
    }
    setFbFeedback((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, status: 'resolved' as const } : f));
      saveUserMirror(user.uid, { feedback: next });
      return next;
    });
    await withPendingTracking(async () => {
      try {
        await updateDoc(doc(db, 'feedback', id), {
          status: 'resolved',
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
    for (const item of bundle.expenses || []) {
      if (!fbExpenses.some((x) => x.id === item.id)) {
        await saveExpense(item, item.id);
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

  const value: DataContextValue = {
    user,
    authReady,
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
    editHistory: isDemoMode || !user ? demoState.editHistory || [] : fbEditHistory,
    feedbackList: isDemoMode || !user ? demoState.feedback || [] : fbFeedback,
    isAdminUser:
      !isReadOnlyDemo &&
      (user?.email || activeLocalEmail || '').trim().toLowerCase() ===
        'sadikulislam45974@gmail.com',
    loginWithGoogle,
    loginWithCredentials,
    signUpWithCredentials,
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
    restoreDeletedRecord,
    submitFeedback,
    resolveFeedback,
    importBackupNonDestructive,
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
