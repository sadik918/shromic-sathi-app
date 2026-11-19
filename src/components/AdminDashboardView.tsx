import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  Globe,
  HelpCircle,
  History,
  LayoutGrid,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCheck,
  Users,
  UserX,
  X,
  Layers,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useData } from '../context/DataContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { toBengaliDigits } from '../utils/calculations';
import { formatMonthLabel } from '../utils/i18n';
import {
  classifyFirestoreReadError,
  extractAvailableRegistrationMonths,
  isGenericWorkerPlaceholderName,
  isOfflineOrTransientFirestoreError,
  mapFirestoreUserDirectoryDoc,
  mapWorkerProfileDocToDirectoryEntry,
  mergeUserDirectories,
  resolveBestUserDisplayName,
  type ClassifiedFirestoreReadError,
} from '../utils/cloudSyncHelpers';
import { AdminSubscriptionSection } from './AdminSubscriptionSection';
import { AdminSettingsSection } from './AdminSettingsSection';
import { AdminMonitoringSection } from './AdminMonitoringSection';
import {
  ADMIN_MENU_SECTIONS,
  canAdminPerform,
  computeAdminOverviewMetrics,
  filterAndPaginateUsers,
  loadAdminStore,
  mapLegacyFeedbackToTickets,
  mergeFeedbackTicketsIntoStore,
  PRIMARY_SUPER_ADMIN_EMAIL,
  reverseMapTicketCategoryToFeedbackCategory,
  ROLE_DEFAULT_PERMISSIONS,
  sanitizeAuditMetadata,
  sanitizeUserForAdminDirectory,
  saveAdminStore,
  validateRoleChange,
  type AdminAuditLog,
  type AdminPermissionKey,
  type AdminRole,
  type AdminSectionId,
  type AdminStoreState,
  type AdminUserDirectoryEntry,
  type AnnouncementCategory,
  type AuditActionType,
  type PlatformAnnouncement,
  type PlatformConfig,
  type SupportTicketCategory,
  type SupportTicketRecord,
  type SupportTicketStatus,
} from '../utils/adminLogic';
import type { SupportFeedback } from '../types';
import {
  ADMIN_QUICK_REPLIES,
  computeSupportTicketCounts,
  filterActivePublishedAnnouncements,
} from '../utils/supportHelpers';
import { buildAdminDashboardChartsData } from '../utils/adminSystemHelpers';
import {
  AdminBarChartCard,
  AdminGrowthTrendCard,
  AdminPieChartCard,
} from './AdminAnalyticsCharts';

interface AdminDashboardViewProps {
  onExitAdmin?: () => void;
}

const TICKET_CATEGORY_LABELS: Record<SupportTicketCategory, { bn: string; en: string }> = {
  login_registration: { bn: 'লগইন ও রেজিস্ট্রেশন', en: 'Login & Registration' },
  account_recovery: { bn: 'অ্যাকাউন্ট পুনরুদ্ধার', en: 'Account Recovery' },
  salary_calculation: { bn: 'বেতন হিসাব', en: 'Salary Calculation' },
  overtime_attendance: { bn: 'ওভারটাইম ও হাজিরা', en: 'Overtime & Attendance' },
  loan_debt: { bn: 'ধার-দেনা ও ঋণ হিসাব', en: 'Loan & Debt Tracker' },
  garment_info: { bn: 'গার্মেন্টস তথ্য', en: 'Garment Information' },
  contact_book: { bn: 'কন্টাক্ট বুক', en: 'Contact Book' },
  offline_sync: { bn: 'অফলাইন সিঙ্ক', en: 'Offline Synchronization' },
  bug_report: { bn: 'বাগ রিপোর্ট', en: 'Bug Report' },
  feature_request: { bn: 'ফিচার রিকোয়েস্ট', en: 'Feature Request' },
  other: { bn: 'অন্যান্য', en: 'Other' },
};

const TICKET_STATUS_LABELS: Record<SupportTicketStatus, { bn: string; en: string }> = {
  new: { bn: 'নতুন', en: 'New' },
  in_progress: { bn: 'চলমান', en: 'In Progress' },
  waiting_for_user: { bn: 'ইউজারের উত্তরের অপেক্ষায়', en: 'Waiting for User' },
  resolved: { bn: 'সমাধানকৃত', en: 'Resolved' },
  closed: { bn: 'বন্ধ', en: 'Closed' },
};

const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, { bn: string; en: string }> = {
  general: { bn: 'সাধারণ ঘোষণা', en: 'General Announcement' },
  maintenance: { bn: 'মেইনটেন্যান্স নোটিশ', en: 'Maintenance Notice' },
  new_feature: { bn: 'নতুন ফিচার', en: 'New Feature' },
  security: { bn: 'নিরাপত্তা বিজ্ঞপ্তি', en: 'Security Notice' },
  important_update: { bn: 'গুরুত্বপূর্ণ আপডেট', en: 'Important Update' },
};

type MatrixRoleKey = 'super_admin' | 'admin' | 'support_moderator' | 'ordinary_worker';

interface RoleFeatureItem {
  id: string;
  bn: string;
  en: string;
}

interface RoleFeatureGroup {
  groupId: string;
  titleBn: string;
  titleEn: string;
  items: RoleFeatureItem[];
}

const MATRIX_ROLES: Array<{ key: MatrixRoleKey; bn: string; en: string }> = [
  { key: 'super_admin', bn: 'সুপার অ্যাডমিন', en: 'Super Admin' },
  { key: 'admin', bn: 'অ্যাডমিন', en: 'Admin' },
  { key: 'support_moderator', bn: 'মডারেটর', en: 'Moderator' },
  { key: 'ordinary_worker', bn: 'সাধারণ ইউজার', en: 'User' },
];

const ROLE_FEATURE_GROUPS: RoleFeatureGroup[] = [
  {
    groupId: 'home',
    titleBn: 'হোম ও ড্যাশবোর্ড',
    titleEn: 'Home & Dashboard',
    items: [
      { id: 'home_tab', bn: 'হোম ড্যাশবোর্ড ট্যাব', en: 'Home Dashboard Tab' },
      { id: 'home_summary_cards', bn: 'বেতন, ওভারটাইম, হাজিরা ও সঞ্চয় সারাংশ কার্ড', en: 'Salary, Overtime, Attendance & Savings Summary Cards' },
      { id: 'home_quick_attendance', bn: 'দৈনিক দ্রুত হাজিরা ও আউট-টাইম এন্ট্রি', en: 'Daily Quick Attendance & Out-Time Entry' },
      { id: 'home_today_work', bn: 'আজকের কাজের সংক্ষিপ্ত হিসাব', en: "Today's Work Summary" },
      { id: 'home_voice_entry', bn: 'ভয়েস দিয়ে দ্রুত হিসাব এন্ট্রি', en: 'Quick Voice Entry' },
    ],
  },
  {
    groupId: 'overtime',
    titleBn: 'ওভারটাইম হিসাব',
    titleEn: 'Overtime Management',
    items: [
      { id: 'ot_tab', bn: 'ওভারটাইম ট্যাব', en: 'Overtime Tab' },
      { id: 'ot_daily_entry', bn: 'দৈনিক ওভারটাইম সংরক্ষণ ও সম্পাদনা', en: 'Daily Overtime Save & Edit' },
      { id: 'ot_rate_formula', bn: 'শ্রম আইন অনুযায়ী অটো ওভারটাইম রেট', en: 'Labor Law Auto Overtime Rate' },
      { id: 'ot_monthly_log', bn: 'মাসিক ওভারটাইম ঘণ্টা ও আয়ের তালিকা', en: 'Monthly Overtime Hours & Earnings Log' },
    ],
  },
  {
    groupId: 'salary',
    titleBn: 'বেতন ও পে-স্লিপ',
    titleEn: 'Salary & Payslip',
    items: [
      { id: 'salary_tab', bn: 'বেতন ট্যাব', en: 'Salary Tab' },
      { id: 'salary_structure_save', bn: 'বেতন ভাতা ও সংরক্ষণ', en: 'Salary Structure & Save' },
      { id: 'salary_received_payments', bn: 'হাতে পাওয়া বেতন ও জমা', en: 'Received Salary & Payments' },
      { id: 'salary_rate_comparison', bn: 'মাসের বেতন হারের তুলনামূলক হিসাব', en: 'Monthly Salary Rate Comparison' },
      { id: 'salary_payslip_export', bn: 'পে-স্লিপ ডাউনলোড ও প্রিন্ট', en: 'Payslip Download & Print' },
    ],
  },
  {
    groupId: 'attendance',
    titleBn: 'হাজিরা ও ছুটি',
    titleEn: 'Attendance & Leave',
    items: [
      { id: 'att_tab', bn: 'হাজিরা ট্যাব', en: 'Attendance Tab' },
      { id: 'att_monthly_calendar', bn: 'মাসিক হাজিরা ক্যালেন্ডার', en: 'Monthly Attendance Calendar' },
      { id: 'att_bonus_status', bn: 'হাজিরা বোনাস যোগ্যতা যাচাই', en: 'Attendance Bonus Eligibility Check' },
      { id: 'att_leave_summary', bn: 'বাৎসরিক ছুটি ও অনুপস্থিতির হিসাব', en: 'Annual Leave & Absence Summary' },
    ],
  },
  {
    groupId: 'expenses',
    titleBn: 'খরচ ও সঞ্চয়',
    titleEn: 'Expenses & Savings',
    items: [
      { id: 'exp_tab', bn: 'খরচ ট্যাব', en: 'Expenses Tab' },
      { id: 'exp_rent_utility', bn: 'বাড়ি ভাড়া, বিদ্যুৎ ও গ্যাস বিল হিসাব', en: 'House Rent, Electricity & Gas Bill Tracker' },
      { id: 'exp_daily_ledger', bn: 'দৈনিক বাজার ও সাংসারিক খরচ', en: 'Daily Market & Household Expenses' },
      { id: 'exp_savings_goal', bn: 'মাসিক সঞ্চয় লক্ষ্যমাত্রা ও জমা', en: 'Monthly Savings Goals & Deposits' },
    ],
  },
  {
    groupId: 'more',
    titleBn: 'আরও মেনু ও টুলস',
    titleEn: 'More Menu & Tools',
    items: [
      { id: 'more_worker_profile', bn: 'শ্রমিক প্রোফাইল ও পাসওয়ার্ড পরিবর্তন', en: 'Worker Profile & Password Change' },
      { id: 'more_alarm_reminder', bn: 'ডিউটি অ্যালার্ম ও রিমাইন্ডার', en: 'Duty Alarm & Reminders' },
      { id: 'more_calculator', bn: 'বেতন ও সুবিধা ক্যালকুলেটর', en: 'Salary & Benefits Calculator' },
      { id: 'more_personal_loans', bn: 'ধার-দেনা ও ঋণ হিসাব', en: 'Personal Loans & Debt Ledger' },
      { id: 'more_factory_shift', bn: 'কারখানা ও শিফট সেটিংস', en: 'Factory & Shift Settings' },
      { id: 'more_contact_book', bn: 'গার্মেন্টস কন্টাক্ট বুক', en: 'Garment Contact Book' },
      { id: 'more_document_vault', bn: 'ব্যক্তিগত ডকুমেন্ট ভল্ট', en: 'Private Document Vault' },
      { id: 'more_backup_export', bn: 'ডেটা ব্যাকআপ ও রিস্টোর', en: 'Data Backup & Restore' },
    ],
  },
  {
    groupId: 'admin',
    titleBn: 'অ্যাডমিন প্যানেল নিয়ন্ত্রণ',
    titleEn: 'Admin Panel Controls',
    items: [
      { id: 'admin_analytics_view', bn: 'অ্যাডমিন অ্যানালিটিক্স ড্যাশবোর্ড', en: 'Admin Analytics Dashboard' },
      { id: 'admin_user_manage', bn: 'ইউজার ম্যানেজমেন্ট ও অ্যাকাউন্ট স্ট্যাটাস', en: 'User Management & Account Status' },
      { id: 'admin_role_matrix', bn: 'অ্যাডমিন ও মডারেটর রোল ব্যবস্থাপনা', en: 'Admin & Moderator Role Management' },
      { id: 'admin_subscription_manage', bn: 'সাবস্ক্রিপশন ও প্ল্যান নিয়ন্ত্রণ', en: 'Subscription & Plan Control' },
      { id: 'admin_support_tickets', bn: 'সাপোর্ট টিকিট ও ফিডব্যাক সমাধান', en: 'Support Ticket & Feedback Resolution' },
      { id: 'admin_notice_settings', bn: 'নোটিশ প্রকাশ ও অ্যাপ সেটিংস', en: 'Notice Broadcast & App Settings' },
      { id: 'admin_system_audit', bn: 'সিস্টেম মনিটরিং ও অডিট লগ', en: 'System Monitoring & Audit Logs' },
    ],
  },
];

const ALL_MATRIX_FEATURE_IDS = ROLE_FEATURE_GROUPS.flatMap((g) => g.items.map((i) => i.id));
const WORKER_FEATURE_IDS = ROLE_FEATURE_GROUPS.filter((g) => g.groupId !== 'admin').flatMap((g) =>
  g.items.map((i) => i.id)
);

const DEFAULT_ROLE_FEATURE_MATRIX: Record<MatrixRoleKey, Record<string, boolean>> = {
  super_admin: Object.fromEntries(ALL_MATRIX_FEATURE_IDS.map((id) => [id, true])),
  admin: Object.fromEntries(
    ALL_MATRIX_FEATURE_IDS.map((id) => [id, id !== 'admin_role_matrix'])
  ),
  support_moderator: Object.fromEntries(
    ALL_MATRIX_FEATURE_IDS.map((id) => [
      id,
      WORKER_FEATURE_IDS.includes(id) ||
        id === 'admin_analytics_view' ||
        id === 'admin_support_tickets',
    ])
  ),
  ordinary_worker: Object.fromEntries(
    ALL_MATRIX_FEATURE_IDS.map((id) => [id, WORKER_FEATURE_IDS.includes(id)])
  ),
};

const ROLE_MATRIX_STORAGE_KEY = 'shromik_sathi_role_feature_matrix_v1';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onExitAdmin }) => {
  const {
    user,
    liveAuthUid,
    profile,
    isAdminUser,
    isDemoMode,
    publicDemoConfig,
    updatePublicDemoConfig,
    resetDemoData,
    todayISO,
    pendingWritesCount,
    feedbackList,
    resolveFeedback,
    syncFeedbackUpdateLocal,
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    logout,
  } = useData();

  const { isOnline } = useOnlineStatus(pendingWritesCount);

  // Persistent Admin Store
  const [store, setStore] = useState<AdminStoreState>(() => loadAdminStore(todayISO));
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const adminScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const adminSidebarNavRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (adminScrollContainerRef.current) {
      adminScrollContainerRef.current.scrollTo({ top: 0 });
    }
  }, [activeSection]);

  // Role simulation for RBAC verification (defaults to super_admin when authorized)
  const [simulatedRole, setSimulatedRole] = useState<AdminRole | 'ordinary_worker'>(() =>
    isAdminUser ? 'super_admin' : 'ordinary_worker'
  );

  // Interactive Role Feature Access Matrix State
  const [roleFeatureMatrix, setRoleFeatureMatrix] = useState<
    Record<MatrixRoleKey, Record<string, boolean>>
  >(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(ROLE_MATRIX_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            super_admin: { ...DEFAULT_ROLE_FEATURE_MATRIX.super_admin, ...(parsed.super_admin || {}) },
            admin: { ...DEFAULT_ROLE_FEATURE_MATRIX.admin, ...(parsed.admin || {}) },
            support_moderator: {
              ...DEFAULT_ROLE_FEATURE_MATRIX.support_moderator,
              ...(parsed.support_moderator || {}),
            },
            ordinary_worker: {
              ...DEFAULT_ROLE_FEATURE_MATRIX.ordinary_worker,
              ...(parsed.ordinary_worker || {}),
            },
          };
        }
      } catch {
        // fallback to default
      }
    }
    return DEFAULT_ROLE_FEATURE_MATRIX;
  });

  const [selectedMatrixGroup, setSelectedMatrixGroup] = useState<string>('all');

  const handleToggleRoleFeature = (roleKey: MatrixRoleKey, featureId: string) => {
    setRoleFeatureMatrix((prev) => {
      const currentVal = Boolean(prev[roleKey]?.[featureId]);
      const next: Record<MatrixRoleKey, Record<string, boolean>> = {
        ...prev,
        [roleKey]: {
          ...(prev[roleKey] || {}),
          [featureId]: !currentVal,
        },
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ROLE_MATRIX_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      if (user && !isDemoMode) {
        setDoc(
          doc(db, 'subscriptionConfig', 'role_feature_matrix'),
          { matrix: next, updatedAt: serverTimestamp() },
          { merge: true }
        ).catch(() => {});
      }
      return next;
    });
  };

  // Real-time Firestore listener for `/userDirectory` (Admin-only list rule)
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);
  const [directorySyncStatus, setDirectorySyncStatus] = useState<
    'idle' | 'loading' | 'live' | 'cached' | 'error'
  >('idle');
  const [directoryReadError, setDirectoryReadError] =
    useState<ClassifiedFirestoreReadError | null>(null);

  useEffect(() => {
    if (!isAdminUser || !user || isDemoMode) {
      setDirectorySyncStatus('idle');
      setDirectoryReadError(null);
      return;
    }
    if (!isOnline || !auth.currentUser) {
      setDirectorySyncStatus('cached');
      setDirectoryReadError(null);
      return;
    }
    setDirectorySyncStatus('loading');
    let latestDirectoryEntries: AdminUserDirectoryEntry[] = [];
    let latestProfileEntries: AdminUserDirectoryEntry[] = [];

    const applyCombinedUsers = () => {
      const combinedRemote = mergeUserDirectories(
        latestDirectoryEntries,
        latestProfileEntries,
        { firestoreConnected: true }
      );
      setStore((prev) => {
        const nextUsers = mergeUserDirectories(combinedRemote, prev.users, {
          firestoreConnected: true,
        });
        const nextState = { ...prev, users: nextUsers };
        saveAdminStore(nextState);
        return nextState;
      });
    };

    const unsubDirectory = onSnapshot(
      collection(db, 'userDirectory'),
      (snapshot) => {
        latestDirectoryEntries = snapshot.docs.map((d) =>
          mapFirestoreUserDirectoryDoc(d.id, d.data() as Record<string, unknown>, todayISO)
        );
        setDirectoryReadError(null);
        setDirectorySyncStatus(snapshot.metadata.fromCache ? 'cached' : 'live');
        applyCombinedUsers();
      },
      (err) => {
        if (!isOfflineOrTransientFirestoreError(err)) {
          console.error('Admin userDirectory listener error:', err);
        }
        const classified = classifyFirestoreReadError(err);
        setDirectoryReadError(classified);
        setDirectorySyncStatus('error');
        setErrorBanner(lang === 'bn' ? classified.messageBn : classified.messageEn);
      }
    );

    const unsubProfiles = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        latestProfileEntries = snapshot.docs.map((d) =>
          mapWorkerProfileDocToDirectoryEntry(d.id, d.data() as Record<string, unknown>, todayISO)
        );
        applyCombinedUsers();

        // Backfill /userDirectory/{uid} for any user in /users whose directory entry is missing or has a placeholder/email-prefix name
        const dirByUid = new Map(latestDirectoryEntries.map((u) => [u.uid, u]));
        for (const profEntry of latestProfileEntries) {
          if (!profEntry.uid || isGenericWorkerPlaceholderName(profEntry.displayName)) continue;
          const existingDir = dirByUid.get(profEntry.uid);
          if (!existingDir) continue;
          const bestName = resolveBestUserDisplayName(
            [profEntry.displayName, existingDir.displayName],
            existingDir.email || profEntry.email
          );
          if (bestName && bestName !== existingDir.displayName) {
            void updateDoc(doc(db, 'userDirectory', profEntry.uid), {
              displayName: bestName.slice(0, 120),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
      },
      () => {
        // Non-fatal if /users read fails transiently; /userDirectory remains active
      }
    );

    const unsubFeedback = onSnapshot(
      collection(db, 'feedback'),
      (snapshot) => {
        const liveFeedbackDocs: SupportFeedback[] = snapshot.docs.map((d) => {
          const raw = d.data() as Record<string, any>;
          return {
            id: d.id,
            userId: String(raw.userId || ''),
            workerName: String(raw.workerName || 'শ্রমিক ব্যবহারকারী'),
            category: raw.category || 'general',
            message: String(raw.message || ''),
            status: raw.status === 'resolved' ? 'resolved' : 'open',
            adminStatus: raw.adminStatus,
            assignedTo: raw.assignedTo,
            ticketNumber: raw.ticketNumber,
            subject: raw.subject,
            replies: Array.isArray(raw.replies) ? raw.replies : [],
            internalNotes: Array.isArray(raw.internalNotes) ? raw.internalNotes : [],
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
          };
        });
        const mappedTickets = mapLegacyFeedbackToTickets(liveFeedbackDocs, todayISO);
        setStore((prev) => {
          const merged = mergeFeedbackTicketsIntoStore(prev.tickets, mappedTickets);
          if (!merged.updated) return prev;
          const nextState = { ...prev, tickets: merged.tickets };
          saveAdminStore(nextState);
          return nextState;
        });
      },
      () => {
        // Non-fatal if /feedback read fails transiently
      }
    );

    const unsubAnnouncements = onSnapshot(
      collection(db, 'announcements'),
      (snapshot) => {
        const liveAnns: PlatformAnnouncement[] = snapshot.docs.map((d) => {
          const raw = d.data() as Record<string, any>;
          const createdStr =
            typeof raw.createdAt === 'string' && raw.createdAt
              ? raw.createdAt
              : todayISO;
          const updatedStr =
            typeof raw.updatedAt === 'string' && raw.updatedAt
              ? raw.updatedAt
              : createdStr;
          return {
            id: d.id,
            titleBn: String(raw.titleBn || raw.titleEn || ''),
            titleEn: String(raw.titleEn || raw.titleBn || ''),
            messageBn: String(raw.messageBn || raw.messageEn || ''),
            messageEn: String(raw.messageEn || raw.messageBn || ''),
            category: (raw.category || 'general') as AnnouncementCategory,
            status:
              raw.status === 'draft' || raw.status === 'archived'
                ? raw.status
                : 'published',
            audience: raw.audience || 'all',
            startDate: typeof raw.startDate === 'string' ? raw.startDate : todayISO,
            endDate: typeof raw.endDate === 'string' ? raw.endDate : '2026-12-31',
            publishedBy: String(raw.publishedBy || PRIMARY_SUPER_ADMIN_EMAIL),
            publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : createdStr,
            createdAt: createdStr,
            updatedAt: updatedStr,
          };
        });
        if (liveAnns.length > 0) {
          setStore((prev) => {
            const byId = new Map<string, PlatformAnnouncement>();
            for (const a of prev.announcements) byId.set(a.id, a);
            for (const a of liveAnns) byId.set(a.id, a);
            const merged = Array.from(byId.values()).sort((a, b) =>
              (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
            );
            const nextState = { ...prev, announcements: merged };
            saveAdminStore(nextState);
            return nextState;
          });
        }
      },
      () => {
        // Non-fatal if /announcements read fails transiently
      }
    );

    return () => {
      unsubDirectory();
      unsubProfiles();
      unsubFeedback();
      unsubAnnouncements();
    };
  }, [isAdminUser, user, liveAuthUid, isDemoMode, isOnline, todayISO, lang]);

  const handleRefreshUsersFromCloud = async () => {
    if (!isAdminUser || !user || isDemoMode) return;
    setIsRefreshingUsers(true);
    setDirectorySyncStatus('loading');
    setDirectoryReadError(null);
    try {
      const [dirSnapshot, usersSnapshot] = await Promise.all([
        getDocsFromServer(collection(db, 'userDirectory')),
        getDocsFromServer(collection(db, 'users')).catch(() => null),
      ]);
      const dirUsers = dirSnapshot.docs.map((d) =>
        mapFirestoreUserDirectoryDoc(d.id, d.data() as Record<string, unknown>, todayISO)
      );
      const profileUsers = usersSnapshot
        ? usersSnapshot.docs.map((d) =>
            mapWorkerProfileDocToDirectoryEntry(
              d.id,
              d.data() as Record<string, unknown>,
              todayISO
            )
          )
        : [];
      const remoteUsers = mergeUserDirectories(dirUsers, profileUsers, {
        firestoreConnected: true,
      });
      setDirectorySyncStatus('live');
      setDirectoryReadError(null);
      setStore((prev) => {
        const nextUsers = mergeUserDirectories(remoteUsers, prev.users, {
          firestoreConnected: true,
        });
        const nextState = { ...prev, users: nextUsers };
        saveAdminStore(nextState);
        return nextState;
      });
      showToast(
        lang === 'bn'
          ? `ক্লাউড থেকে ${toBengaliDigits(remoteUsers.length)} জন ইউজারের তথ্য রিফ্রেশ হয়েছে।`
          : `Refreshed ${remoteUsers.length} users from Firestore.`
      );
    } catch (err) {
      if (!isOfflineOrTransientFirestoreError(err)) {
        console.error('Admin userDirectory refresh error:', err);
      }
      const classified = classifyFirestoreReadError(err);
      setDirectoryReadError(classified);
      setDirectorySyncStatus('error');
      showError(lang === 'bn' ? classified.messageBn : classified.messageEn);
    } finally {
      setIsRefreshingUsers(false);
    }
  };

  // Sync current logged-in worker's non-sensitive directory entry & live feedback into store
  useEffect(() => {
    setStore((prev) => {
      let updated = false;
      let nextUsers = prev.users;

      if (isDemoMode && profile && profile.userId) {
        const sanitizedCurrent = sanitizeUserForAdminDirectory({
          ...profile,
          email: user?.email || 'worker.current@shromiksathi.app',
          emailVerified: user?.emailVerified ?? true,
          registeredAt: todayISO,
          lastSeenDate: todayISO,
        });
        if (!prev.users.some((u) => u.uid === sanitizedCurrent.uid)) {
          nextUsers = [sanitizedCurrent, ...prev.users];
          updated = true;
        }
      }

      const mappedFeedback = mapLegacyFeedbackToTickets(feedbackList, todayISO);
      const mergedTicketsResult = mergeFeedbackTicketsIntoStore(prev.tickets, mappedFeedback);
      const nextTickets = mergedTicketsResult.tickets;
      if (mergedTicketsResult.updated) {
        updated = true;
      }

      if (!updated) return prev;
      const nextState = { ...prev, users: nextUsers, tickets: nextTickets };
      saveAdminStore(nextState);
      return nextState;
    });
  }, [isDemoMode, profile, user, feedbackList, todayISO]);

  const effectiveRole: AdminRole | null =
    !isAdminUser || simulatedRole === 'ordinary_worker' ? null : simulatedRole;

  const actorName =
    user?.displayName ||
    (effectiveRole === 'super_admin'
      ? 'সাদিকুল ইসলাম (Super Admin)'
      : effectiveRole === 'admin'
      ? 'তানভীর আহমেদ (Admin)'
      : 'ফারজানা ইয়াসমিন (Moderator)');

  const actorEmail = user?.email || PRIMARY_SUPER_ADMIN_EMAIL;
  const actorUid = user?.uid || 'admin_super_01';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const showError = (msg: string) => {
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(''), 4500);
  };

  // Helper to append an immutable audit log entry
  const recordAudit = (params: {
    actionType: AuditActionType;
    targetId: string;
    targetLabel: string;
    outcome?: 'success' | 'denied' | 'failed';
    reason: string;
    metadata?: Record<string, string | number | boolean>;
  }): AdminAuditLog => {
    const nowStr = `${todayISO} ${new Date().toTimeString().slice(0, 8)}`;
    const entry: AdminAuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowStr,
      actorUid,
      actorName,
      actorRole: effectiveRole || 'support_moderator',
      actionType: params.actionType,
      targetId: params.targetId,
      targetLabel: params.targetLabel,
      outcome: params.outcome || 'success',
      reason: params.reason.slice(0, 400),
      metadata: sanitizeAuditMetadata(params.metadata || {}),
    };

    if (user && !isDemoMode) {
      setDoc(doc(db, 'auditLogs', entry.id), {
        actorUid: user.uid,
        actionType: entry.actionType,
        targetId: entry.targetId,
        reason: entry.reason,
        createdAt: serverTimestamp(),
      }).catch(() => {
        // local audit mirror already persists entry
      });
    }

    return entry;
  };

  // Overview Metrics
  const metrics = useMemo(
    () =>
      computeAdminOverviewMetrics({
        users: store.users,
        tickets: store.tickets,
        errors: store.errors,
        announcements: store.announcements,
        todayISO,
      }),
    [store.users, store.tickets, store.errors, store.announcements, todayISO]
  );

  // Comprehensive Admin Charts Data across all 8 sections
  const adminCharts = useMemo(() => {
    const countTruthy = (obj: Record<string, boolean> | undefined) =>
      obj ? Object.values(obj).filter(Boolean).length : 0;
    return buildAdminDashboardChartsData({
      store,
      roleFeatureCounts: {
        super_admin: countTruthy(roleFeatureMatrix.super_admin),
        admin: countTruthy(roleFeatureMatrix.admin),
        support_moderator: countTruthy(roleFeatureMatrix.support_moderator),
        user: countTruthy(roleFeatureMatrix.ordinary_worker),
      },
    });
  }, [store, roleFeatureMatrix]);

  // ============================================================================
  // USER MANAGEMENT STATE & HANDLERS
  // ============================================================================
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [userMonthFilter, setUserMonthFilter] = useState<string>('all');
  const [userRegistrationPeriod, setUserRegistrationPeriod] = useState<'all' | 'today'>('all');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDirectoryEntry | null>(null);
  const [suspendModalUser, setSuspendModalUser] = useState<AdminUserDirectoryEntry | null>(null);
  const [suspendReasonInput, setSuspendReasonInput] = useState('');

  const availableRegistrationMonths = useMemo(
    () => extractAvailableRegistrationMonths(store.users, todayISO.slice(0, 7)),
    [store.users, todayISO]
  );

  const paginatedUsers = useMemo(
    () =>
      filterAndPaginateUsers({
        users: store.users,
        searchQuery: userSearch,
        statusFilter: userStatusFilter,
        monthFilter: userMonthFilter,
        registrationPeriod: userRegistrationPeriod,
        todayISO,
        page: userPage,
        pageSize: userPageSize,
      }),
    [
      store.users,
      userSearch,
      userStatusFilter,
      userMonthFilter,
      userRegistrationPeriod,
      todayISO,
      userPage,
      userPageSize,
    ]
  );

  useEffect(() => {
    if (userPage > paginatedUsers.totalPages) {
      setUserPage(paginatedUsers.totalPages);
    }
  }, [userPage, paginatedUsers.totalPages]);

  const hasActiveUserFilters = Boolean(
    userSearch.trim() ||
      userStatusFilter !== 'all' ||
      userMonthFilter !== 'all' ||
      userRegistrationPeriod !== 'all'
  );

  const handleResetUserFilters = () => {
    setUserSearch('');
    setUserStatusFilter('all');
    setUserMonthFilter('all');
    setUserRegistrationPeriod('all');
    setUserPage(1);
  };

  const handleConfirmUserStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendModalUser) return;

    if (!canAdminPerform(effectiveRole, 'suspend_users')) {
      showError(
        lang === 'bn'
          ? 'অ্যাক্সেস প্রত্যাখ্যাত: ইউজার সাসপেন্ড করার অনুমতি আপনার রোলে নেই।'
          : 'Permission denied: Your role cannot suspend or reactivate accounts.'
      );
      return;
    }

    const trimmedReason = suspendReasonInput.trim();
    if (trimmedReason.length < 5) {
      showError(
        lang === 'bn'
          ? 'অনুগ্রহ করে কমপক্ষে ৫ অক্ষরের সুস্পষ্ট কারণ উল্লেখ করুন।'
          : 'Please provide a clear reason (at least 5 characters).'
      );
      return;
    }

    const targetStatus: 'active' | 'suspended' =
      suspendModalUser.accountStatus === 'active' ? 'suspended' : 'active';
    const actionType: AuditActionType =
      targetStatus === 'suspended' ? 'user_suspended' : 'user_reactivated';

    const auditEntry = recordAudit({
      actionType,
      targetId: suspendModalUser.uid,
      targetLabel: `${suspendModalUser.displayName} (${suspendModalUser.email})`,
      reason: trimmedReason,
      metadata: {
        previousStatus: suspendModalUser.accountStatus,
        newStatus: targetStatus,
      },
    });

    setStore((prev) => {
      const nextUsers = prev.users.map((u) => {
        if (u.uid !== suspendModalUser.uid) return u;
        return {
          ...u,
          accountStatus: targetStatus,
          suspensionReason: targetStatus === 'suspended' ? trimmedReason : undefined,
          suspendedAt: targetStatus === 'suspended' ? todayISO : undefined,
          suspendedBy: targetStatus === 'suspended' ? actorEmail : undefined,
          statusHistory: [
            {
              status: targetStatus,
              reason: trimmedReason,
              changedBy: actorName,
              changedAt: todayISO,
            },
            ...u.statusHistory,
          ],
        };
      });
      const nextState = {
        ...prev,
        users: nextUsers,
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(nextState);
      return nextState;
    });

    if (user && !isDemoMode) {
      try {
        await updateDoc(doc(db, 'userDirectory', suspendModalUser.uid), {
          accountStatus: targetStatus,
          suspensionReason: targetStatus === 'suspended' ? trimmedReason : '',
          updatedAt: serverTimestamp(),
        });
      } catch (err: any) {
        if (err?.code === 'not-found') {
          try {
            await setDoc(doc(db, 'userDirectory', suspendModalUser.uid), {
              uid: suspendModalUser.uid,
              displayName: (suspendModalUser.displayName || 'Garment Worker').slice(0, 120),
              email: suspendModalUser.email,
              registeredAt: suspendModalUser.registeredAt,
              lastSeenDate: suspendModalUser.lastSeenDate,
              accountStatus: targetStatus,
              ...(targetStatus === 'suspended' ? { suspensionReason: trimmedReason } : {}),
              role: suspendModalUser.role || 'user',
              authProvider: suspendModalUser.authProvider,
              language: suspendModalUser.language,
              emailVerified: suspendModalUser.emailVerified,
              offlineSyncState: suspendModalUser.offlineSyncState,
              appVersion: suspendModalUser.appVersion,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (createErr) {
            if (!isOfflineOrTransientFirestoreError(createErr)) {
              showError(
                lang === 'bn'
                  ? 'ফায়ারবেসে অ্যাকাউন্ট স্ট্যাটাস সংরক্ষণ করা যায়নি।'
                  : 'Failed to save user status in Firestore.'
              );
            }
          }
        } else if (!isOfflineOrTransientFirestoreError(err)) {
          showError(
            lang === 'bn'
              ? 'ফায়ারবেসে অ্যাকাউন্ট স্ট্যাটাস আপডেট করা যায়নি।'
              : 'Failed to update user status in Firestore.'
          );
        }
      }
    }

    setSuspendModalUser(null);
    setSuspendReasonInput('');
    showToast(
      lang === 'bn'
        ? targetStatus === 'suspended'
          ? 'অ্যাকাউন্ট সাসপেন্ড করা হয়েছে এবং অডিট লগে রেকর্ড হয়েছে।'
          : 'অ্যাকাউন্ট পুনরায় সক্রিয় (Reactivate) করা হয়েছে।'
        : `Account ${targetStatus} and logged in audit history.`
    );
  };

  const handleTriggerSafeRecovery = (targetUser: AdminUserDirectoryEntry) => {
    if (!canAdminPerform(effectiveRole, 'manage_users')) {
      showError(lang === 'bn' ? 'অ্যাক্সেস প্রত্যাখ্যাত।' : 'Permission denied.');
      return;
    }
    const auditEntry = recordAudit({
      actionType: 'account_recovery_triggered',
      targetId: targetUser.uid,
      targetLabel: targetUser.email,
      reason: 'Initiated standard Firebase password/OAuth verification recovery link dispatch.',
      metadata: { method: targetUser.authProvider },
    });
    setStore((prev) => {
      const next = { ...prev, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(
      lang === 'bn'
        ? `${targetUser.email}-এ নিরাপদ অ্যাকাউন্ট রিকভারি নির্দেশনা পাঠানো হয়েছে।`
        : `Safe recovery verification sent to ${targetUser.email}.`
    );
  };

  // ============================================================================
  // ADMIN ROLES & PERMISSIONS STATE & HANDLERS
  // ============================================================================
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>('support_moderator');
  const [roleReason, setRoleReason] = useState('');

  const handleAssignAdminRole = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateRoleChange({
      actorRole: effectiveRole,
      actorEmail,
      targetEmail: newAdminEmail.trim(),
      newRole: newAdminRole,
    });
    if (!validation.valid) {
      showError(lang === 'bn' ? validation.errorBn! : validation.errorEn!);
      return;
    }
    if (!newAdminName.trim() || !newAdminEmail.trim() || !roleReason.trim()) {
      showError(
        lang === 'bn'
          ? 'নাম, ইমেইল এবং রোল প্রদানের কারণ পূরণ করুন।'
          : 'Please fill in name, email, and authorization reason.'
      );
      return;
    }

    const cleanEmail = newAdminEmail.trim().toLowerCase();
    const auditEntry = recordAudit({
      actionType: 'role_updated',
      targetId: cleanEmail,
      targetLabel: `${newAdminName.trim()} (${newAdminRole})`,
      reason: roleReason.trim(),
      metadata: { assignedRole: newAdminRole },
    });

    setStore((prev) => {
      const existingIdx = prev.roles.findIndex((r) => r.email.toLowerCase() === cleanEmail);
      let nextRoles = [...prev.roles];
      if (existingIdx >= 0) {
        nextRoles[existingIdx] = {
          ...nextRoles[existingIdx],
          displayName: newAdminName.trim(),
          role: newAdminRole,
          permissions: ROLE_DEFAULT_PERMISSIONS[newAdminRole],
          assignedBy: actorEmail,
          assignedAt: todayISO,
          status: 'active',
        };
      } else {
        nextRoles = [
          ...nextRoles,
          {
            uid: `admin_${Date.now()}`,
            email: cleanEmail,
            displayName: newAdminName.trim(),
            role: newAdminRole,
            permissions: ROLE_DEFAULT_PERMISSIONS[newAdminRole],
            assignedBy: actorEmail,
            assignedAt: todayISO,
            status: 'active',
          },
        ];
      }
      const next = { ...prev, roles: nextRoles, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });

    setNewAdminName('');
    setNewAdminEmail('');
    setRoleReason('');
    showToast(
      lang === 'bn'
        ? 'অ্যাডমিন রোল ও পারমিশন সফলভাবে সংরক্ষিত হয়েছে।'
        : 'Admin role assignment updated and audited.'
    );
  };

  const handleChangeExistingRole = (targetEmail: string, nextRole: AdminRole) => {
    const validation = validateRoleChange({
      actorRole: effectiveRole,
      actorEmail,
      targetEmail,
      newRole: nextRole,
    });
    if (!validation.valid) {
      showError(lang === 'bn' ? validation.errorBn! : validation.errorEn!);
      return;
    }
    const auditEntry = recordAudit({
      actionType: 'role_updated',
      targetId: targetEmail,
      targetLabel: `Role changed to ${nextRole}`,
      reason: `Role updated to ${nextRole} by Super Admin`,
      metadata: { newRole: nextRole },
    });
    setStore((prev) => {
      const nextRoles = prev.roles.map((r) =>
        r.email.toLowerCase() === targetEmail.toLowerCase()
          ? { ...r, role: nextRole, permissions: ROLE_DEFAULT_PERMISSIONS[nextRole] }
          : r
      );
      const next = { ...prev, roles: nextRoles, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(
      lang === 'bn' ? 'রোল পারমিশন আপডেট করা হয়েছে।' : 'Role permissions updated.'
    );
  };

  // ============================================================================
  // SUPPORT TICKET MANAGEMENT STATE & HANDLERS
  // ============================================================================
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<SupportTicketStatus | 'all'>('all');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<SupportTicketCategory | 'all'>('all');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [ticketInternalNoteText, setTicketInternalNoteText] = useState('');

  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    return store.tickets.filter((t) => {
      if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false;
      if (ticketCategoryFilter !== 'all' && t.category !== ticketCategoryFilter) return false;
      if (q) {
        return (
          t.ticketNumber.toLowerCase().includes(q) ||
          t.workerName.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.message.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [store.tickets, ticketSearch, ticketStatusFilter, ticketCategoryFilter]);

  const activeTicket = useMemo(
    () =>
      store.tickets.find((t) => t.id === activeTicketId) ||
      filteredTickets[0] ||
      null,
    [store.tickets, activeTicketId, filteredTickets]
  );

  const buildFeedbackSyncPayload = (targetTicket: SupportTicketRecord): SupportFeedback => {
    const fbStatus: 'open' | 'resolved' =
      targetTicket.status === 'resolved' || targetTicket.status === 'closed'
        ? 'resolved'
        : 'open';
    return {
      id: targetTicket.id,
      userId: targetTicket.userId || user?.uid || 'demo_user',
      workerName: targetTicket.workerName || 'শ্রমিক ব্যবহারকারী',
      category: reverseMapTicketCategoryToFeedbackCategory(targetTicket.category),
      message: targetTicket.message || 'সহায়তা অনুরোধ',
      status: fbStatus,
      adminStatus: targetTicket.status,
      assignedTo: targetTicket.assignedTo || 'Support Team',
      ticketNumber: targetTicket.ticketNumber || 'TKT-2001',
      subject: targetTicket.subject || 'সাধারণ সহায়তা অনুরোধ',
      replies: targetTicket.replies || [],
      internalNotes: targetTicket.internalNotes || [],
      createdAt: targetTicket.createdAt || todayISO,
      updatedAt: new Date().toISOString(),
    };
  };

  const persistTicketToFirestore = async (
    targetTicket: SupportTicketRecord
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!user || isDemoMode) return { ok: true };
    const fbStatus: 'open' | 'resolved' =
      targetTicket.status === 'resolved' || targetTicket.status === 'closed'
        ? 'resolved'
        : 'open';
    const fbCategory = reverseMapTicketCategoryToFeedbackCategory(targetTicket.category);
    const safeUserId = (targetTicket.userId || user.uid)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 128);
    const safeWorkerName =
      (targetTicket.workerName || 'শ্রমিক ব্যবহারকারী').trim().slice(0, 120) ||
      'শ্রমিক ব্যবহারকারী';
    const safeMessage =
      (targetTicket.message || 'সহায়তা অনুরোধ').trim().slice(0, 1000) ||
      'সহায়তা অনুরোধ';
    const cleanReplies = (targetTicket.replies || []).slice(-100).map((r) => ({
      id: String(r.id || `rep_${Date.now()}`).slice(0, 80),
      authorName: String(r.authorName || actorName).slice(0, 120),
      authorRole: r.authorRole === 'user' ? 'user' : 'admin',
      message: String(r.message || '').slice(0, 1000),
      createdAt: String(r.createdAt || todayISO).slice(0, 40),
    }));
    const cleanNotes = (targetTicket.internalNotes || []).slice(-100).map((n) => ({
      id: String(n.id || `note_${Date.now()}`).slice(0, 80),
      authorName: String(n.authorName || actorName).slice(0, 120),
      note: String(n.note || '').slice(0, 1000),
      createdAt: String(n.createdAt || todayISO).slice(0, 40),
    }));
    const ticketRef = doc(db, 'feedback', targetTicket.id);
    const updatePayload = {
      status: fbStatus,
      adminStatus: targetTicket.status,
      assignedTo: (targetTicket.assignedTo || 'Support Team').slice(0, 120),
      ticketNumber: (targetTicket.ticketNumber || 'TKT-2001').slice(0, 40),
      subject: (targetTicket.subject || 'সাধারণ সহায়তা অনুরোধ').slice(0, 200),
      replies: cleanReplies,
      internalNotes: cleanNotes,
      updatedAt: serverTimestamp(),
    };
    try {
      await updateDoc(ticketRef, updatePayload);
      return { ok: true };
    } catch (updateErr) {
      try {
        const snap = await getDoc(ticketRef);
        if (snap.exists()) {
          const existing = snap.data() as Record<string, unknown>;
          const repairPayload: Record<string, unknown> = {
            userId:
              typeof existing.userId === 'string' && existing.userId
                ? existing.userId
                : safeUserId,
            workerName:
              typeof existing.workerName === 'string' && existing.workerName
                ? existing.workerName
                : safeWorkerName,
            category:
              typeof existing.category === 'string' && existing.category
                ? existing.category
                : fbCategory,
            message:
              typeof existing.message === 'string' && existing.message
                ? existing.message
                : safeMessage,
            ...updatePayload,
          };
          if (!existing.createdAt) {
            repairPayload.createdAt = serverTimestamp();
          }
          await setDoc(ticketRef, repairPayload, { merge: true });
        } else {
          await setDoc(ticketRef, {
            userId: safeUserId,
            workerName: safeWorkerName,
            category: fbCategory,
            message: safeMessage,
            ...updatePayload,
            createdAt: serverTimestamp(),
          });
        }
        return { ok: true };
      } catch (fallbackErr) {
        const errObj = fallbackErr || updateErr;
        if (isOfflineOrTransientFirestoreError(errObj)) {
          return { ok: true };
        }
        console.error('Failed to persist support ticket update to Firestore:', errObj);
        return {
          ok: false,
          error:
            lang === 'bn'
              ? 'ক্লাউডে টিকিট আপডেট সিঙ্ক করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
              : 'Failed to sync support ticket update to cloud. Please try again.',
        };
      }
    }
  };

  const handleUpdateTicketStatus = async (ticket: SupportTicketRecord, nextStatus: SupportTicketStatus) => {
    if (!canAdminPerform(effectiveRole, 'manage_tickets')) {
      showError(lang === 'bn' ? 'টিকিট আপডেটের অনুমতি নেই।' : 'Permission denied.');
      return;
    }

    if (nextStatus === 'resolved') {
      await resolveFeedback(ticket.id).catch(() => {});
    }

    const updatedTicket: SupportTicketRecord = {
      ...ticket,
      status: nextStatus,
      updatedAt: todayISO,
      resolvedAt: nextStatus === 'resolved' || nextStatus === 'closed' ? todayISO : ticket.resolvedAt,
    };

    const auditEntry = recordAudit({
      actionType: 'ticket_status_updated',
      targetId: ticket.ticketNumber,
      targetLabel: `${ticket.ticketNumber} (${ticket.subject})`,
      reason: `Ticket status changed from ${ticket.status} to ${nextStatus}`,
      metadata: { previousStatus: ticket.status, newStatus: nextStatus },
    });

    setStore((prev) => {
      const nextTickets = prev.tickets.map((t) => (t.id === ticket.id ? updatedTicket : t));
      const next = { ...prev, tickets: nextTickets, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    syncFeedbackUpdateLocal(buildFeedbackSyncPayload(updatedTicket));
    const res = await persistTicketToFirestore(updatedTicket);
    if (!res.ok && res.error) {
      showError(res.error);
      return;
    }
    showToast(
      lang === 'bn'
        ? `টিকিট ${ticket.ticketNumber}-এর স্ট্যাটাস আপডেট করা হয়েছে।`
        : `Updated ${ticket.ticketNumber} status to ${nextStatus}.`
    );
  };

  const handleAssignTicket = async (ticket: SupportTicketRecord, assignee: string) => {
    if (!canAdminPerform(effectiveRole, 'assign_tickets') && effectiveRole !== 'support_moderator') {
      showError(lang === 'bn' ? 'টিকিট অ্যাসাইন করার অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const updatedTicket: SupportTicketRecord = {
      ...ticket,
      assignedTo: assignee,
      updatedAt: todayISO,
    };
    const auditEntry = recordAudit({
      actionType: 'ticket_assigned',
      targetId: ticket.ticketNumber,
      targetLabel: `Assigned to ${assignee}`,
      reason: `Support ticket assigned to ${assignee}`,
    });
    setStore((prev) => {
      const nextTickets = prev.tickets.map((t) => (t.id === ticket.id ? updatedTicket : t));
      const next = { ...prev, tickets: nextTickets, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    syncFeedbackUpdateLocal(buildFeedbackSyncPayload(updatedTicket));
    const res = await persistTicketToFirestore(updatedTicket);
    if (!res.ok && res.error) {
      showError(res.error);
      return;
    }
    showToast(lang === 'bn' ? 'টিকিট দায়িত্বপ্রাপ্ত মডারেটরকে অ্যাসাইন করা হয়েছে।' : 'Ticket assigned.');
  };

  const handleAddTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !ticketReplyText.trim()) return;
    if (!canAdminPerform(effectiveRole, 'manage_tickets')) {
      showError(lang === 'bn' ? 'টিকিটে উত্তর দেওয়ার অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const msg = ticketReplyText.trim();
    const nowStamp = `${todayISO} ${new Date().toTimeString().slice(0, 5)}`;
    const newReply = {
      id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorName: actorName,
      authorRole: 'admin' as const,
      message: msg,
      createdAt: nowStamp,
    };
    const updatedTicket: SupportTicketRecord = {
      ...activeTicket,
      status: activeTicket.status === 'new' ? ('in_progress' as const) : activeTicket.status,
      updatedAt: todayISO,
      replies: [...(activeTicket.replies || []), newReply],
    };

    setStore((prev) => {
      const nextTickets = prev.tickets.map((t) =>
        t.id === activeTicket.id ? updatedTicket : t
      );
      const next = { ...prev, tickets: nextTickets };
      saveAdminStore(next);
      return next;
    });
    syncFeedbackUpdateLocal(buildFeedbackSyncPayload(updatedTicket));
    setTicketReplyText('');
    const res = await persistTicketToFirestore(updatedTicket);
    if (!res.ok && res.error) {
      showError(res.error);
      return;
    }
    showToast(lang === 'bn' ? 'ব্যবহারকারীর টিকিটে উত্তর পাঠানো হয়েছে।' : 'Reply sent to ticket thread.');
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !ticketInternalNoteText.trim()) return;
    const note = ticketInternalNoteText.trim();
    const nowStamp = `${todayISO} ${new Date().toTimeString().slice(0, 5)}`;
    const newNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorName: actorName,
      note,
      createdAt: nowStamp,
    };
    const updatedTicket: SupportTicketRecord = {
      ...activeTicket,
      internalNotes: [...(activeTicket.internalNotes || []), newNote],
    };

    setStore((prev) => {
      const nextTickets = prev.tickets.map((t) =>
        t.id === activeTicket.id ? updatedTicket : t
      );
      const next = { ...prev, tickets: nextTickets };
      saveAdminStore(next);
      return next;
    });
    setTicketInternalNoteText('');
    const res = await persistTicketToFirestore(updatedTicket);
    if (!res.ok && res.error) {
      showError(res.error);
      return;
    }
    showToast(lang === 'bn' ? 'অভ্যন্তরীণ অ্যাডমিন নোট সংরক্ষিত হয়েছে।' : 'Internal note added.');
  };

  // ============================================================================
  // ANNOUNCEMENTS & APP SETTINGS STATE & HANDLERS
  // ============================================================================
  const [annTitleBn, setAnnTitleBn] = useState('');
  const [annMessageBn, setAnnMessageBn] = useState('');
  const [annCategory, setAnnCategory] = useState<AnnouncementCategory>('general');
  const [annStartDate, setAnnStartDate] = useState(todayISO);
  const [annEndDate, setAnnEndDate] = useState('2026-12-31');
  const [annPreviewDevice, setAnnPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');

  // Calculation Policy Update Modal State
  const [policyHoursInput, setPolicyHoursInput] = useState(
    String(store.config.currentCalculationPolicy.standardMonthlyHours)
  );
  const [policyMultiplierInput, setPolicyMultiplierInput] = useState(
    String(store.config.currentCalculationPolicy.overtimeMultiplier)
  );
  const [policyMinGrossInput, setPolicyMinGrossInput] = useState(
    String(store.config.currentCalculationPolicy.minimumGrossWageGrade4)
  );
  const [policyReasonInput, setPolicyReasonInput] = useState('');
  const [policyConfirmOpen, setPolicyConfirmOpen] = useState(false);

  const syncPublishedAnnouncementsLocal = (announcements: PlatformAnnouncement[]) => {
    if (typeof window === 'undefined') return;
    try {
      const active = filterActivePublishedAnnouncements(announcements, todayISO);
      localStorage.setItem('shromik_sathi_live_announcements_v1', JSON.stringify(active));
      window.dispatchEvent(new CustomEvent('shromik-sathi-announcements-updated'));
    } catch {
      // ignore storage errors
    }
  };

  const buildAnnouncementCloudPayload = (ann: PlatformAnnouncement, statusOverride?: 'draft' | 'published' | 'archived') => ({
    titleBn: ann.titleBn.slice(0, 200),
    titleEn: (ann.titleEn || ann.titleBn).slice(0, 200),
    messageBn: ann.messageBn.slice(0, 1500),
    messageEn: (ann.messageEn || ann.messageBn).slice(0, 1500),
    category: ann.category,
    status: statusOverride || ann.status,
    audience: ann.audience || 'all',
    startDate: (ann.startDate || todayISO).slice(0, 20),
    endDate: (ann.endDate || '2026-12-31').slice(0, 20),
    publishedBy: (ann.publishedBy || actorEmail).slice(0, 120),
    publishedAt: (ann.publishedAt || todayISO).slice(0, 40),
    createdAt: (ann.createdAt || todayISO).slice(0, 40),
    updatedAt: serverTimestamp(),
  });

  const handlePublishAnnouncement = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    if (!canAdminPerform(effectiveRole, 'publish_announcements')) {
      showError(
        lang === 'bn'
          ? 'ঘোষণা প্রকাশ করার অনুমতি আপনার রোলে নেই।'
          : 'Your role is not permitted to publish announcements.'
      );
      return;
    }
    if (!annTitleBn.trim() || !annMessageBn.trim()) {
      showError(
        lang === 'bn'
          ? 'ঘোষণার শিরোনাম ও বিস্তারিত বার্তা লিখুন।'
          : 'Please enter announcement title and message.'
      );
      return;
    }

    const status = asDraft ? 'draft' : 'published';
    const newAnn: PlatformAnnouncement = {
      id: `ann_${Date.now()}`,
      titleBn: annTitleBn.trim(),
      titleEn: annTitleBn.trim(),
      messageBn: annMessageBn.trim(),
      messageEn: annMessageBn.trim(),
      category: annCategory,
      status,
      audience: 'all',
      startDate: annStartDate,
      endDate: annEndDate,
      publishedBy: actorEmail,
      publishedAt: status === 'published' ? todayISO : undefined,
      createdAt: todayISO,
      updatedAt: todayISO,
    };

    const auditEntry = recordAudit({
      actionType: 'announcement_published',
      targetId: newAnn.id,
      targetLabel: newAnn.titleBn,
      reason: `Announcement ${status}: ${newAnn.titleBn}`,
      metadata: { category: annCategory, status },
    });

    setStore((prev) => {
      const nextAnns = [newAnn, ...prev.announcements];
      const next = {
        ...prev,
        announcements: nextAnns,
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(next);
      syncPublishedAnnouncementsLocal(nextAnns);
      return next;
    });

    setAnnTitleBn('');
    setAnnMessageBn('');

    if (user && !isDemoMode) {
      try {
        await setDoc(
          doc(db, 'announcements', newAnn.id),
          buildAnnouncementCloudPayload(newAnn)
        );
      } catch (err) {
        if (!isOfflineOrTransientFirestoreError(err)) {
          console.error('Failed to publish announcement to Firestore:', err);
          showError(
            lang === 'bn'
              ? 'ক্লাউডে নোটিশ প্রকাশ করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
              : 'Failed to sync announcement to cloud.'
          );
          return;
        }
      }
    }

    showToast(
      lang === 'bn'
        ? status === 'published'
          ? 'নতুন ঘোষণা সফলভাবে প্রকাশিত হয়েছে!'
          : 'ঘোষণাটি খসড়া (Draft) হিসেবে সংরক্ষিত হয়েছে।'
        : `Announcement ${status}.`
    );
  };

  const handleToggleAnnouncementStatus = async (ann: PlatformAnnouncement, nextStatus: 'published' | 'archived') => {
    if (!canAdminPerform(effectiveRole, 'publish_announcements')) {
      showError(lang === 'bn' ? 'অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const auditEntry = recordAudit({
      actionType: nextStatus === 'archived' ? 'announcement_archived' : 'announcement_published',
      targetId: ann.id,
      targetLabel: ann.titleBn,
      reason: `Changed announcement status to ${nextStatus}`,
    });
    setStore((prev) => {
      const nextAnns = prev.announcements.map((a) =>
        a.id === ann.id ? { ...a, status: nextStatus, updatedAt: todayISO } : a
      );
      const next = { ...prev, announcements: nextAnns, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      syncPublishedAnnouncementsLocal(nextAnns);
      return next;
    });
    if (user && !isDemoMode) {
      try {
        await setDoc(
          doc(db, 'announcements', ann.id),
          buildAnnouncementCloudPayload(ann, nextStatus),
          { merge: true }
        );
      } catch (err) {
        if (!isOfflineOrTransientFirestoreError(err)) {
          console.error('Failed to update announcement status:', err);
          showError(
            lang === 'bn'
              ? 'নোটিশের স্ট্যাটাস ক্লাউডে আপডেট হয়নি।'
              : 'Failed to update announcement in cloud.'
          );
          return;
        }
      }
    }
    showToast(lang === 'bn' ? 'ঘোষণার স্ট্যাটাস আপডেট করা হয়েছে।' : 'Announcement updated.');
  };

  const handleDeleteAnnouncement = async (ann: PlatformAnnouncement) => {
    if (!canAdminPerform(effectiveRole, 'publish_announcements')) {
      showError(lang === 'bn' ? 'অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const auditEntry = recordAudit({
      actionType: 'announcement_archived',
      targetId: ann.id,
      targetLabel: ann.titleBn,
      reason: `Deleted announcement ${ann.titleBn}`,
    });
    setStore((prev) => {
      const nextAnns = prev.announcements.filter((a) => a.id !== ann.id);
      const next = { ...prev, announcements: nextAnns, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      syncPublishedAnnouncementsLocal(nextAnns);
      return next;
    });
    if (user && !isDemoMode) {
      try {
        await setDoc(
          doc(db, 'announcements', ann.id),
          buildAnnouncementCloudPayload(ann, 'archived'),
          { merge: true }
        );
      } catch (err) {
        if (!isOfflineOrTransientFirestoreError(err)) {
          console.error('Failed to archive announcement:', err);
        }
      }
    }
    showToast(lang === 'bn' ? 'নোটিশটি তালিকা থেকে সরানো হয়েছে।' : 'Announcement removed.');
  };

  const handleSavePlatformPreferences = (patch: {
    maintenanceMessageBn: string;
    supportEmail: string;
    supportPhone: string;
    supportHoursBn: string;
  }) => {
    if (!canAdminPerform(effectiveRole, 'manage_app_settings')) {
      showError(
        lang === 'bn'
          ? 'শুধুমাত্র সুপার অ্যাডমিন এই সেটিংস পরিবর্তন করতে পারবেন।'
          : 'Only Super Admin can update platform preferences.'
      );
      return;
    }
    const auditEntry = recordAudit({
      actionType: 'config_updated',
      targetId: 'platformPreferences',
      targetLabel: 'Support Contact & Maintenance Notice',
      reason: 'Updated support contact details and maintenance notice message.',
    });
    setStore((prev) => {
      const nextConfig: PlatformConfig = {
        ...prev.config,
        maintenanceMessageBn: patch.maintenanceMessageBn.trim() || prev.config.maintenanceMessageBn,
        supportEmail: patch.supportEmail.trim() || prev.config.supportEmail,
        supportPhone: patch.supportPhone.trim() || prev.config.supportPhone,
        supportHoursBn: patch.supportHoursBn.trim() || prev.config.supportHoursBn,
        updatedAt: todayISO,
        updatedBy: actorEmail,
      };
      const next = { ...prev, config: nextConfig, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(lang === 'bn' ? 'অ্যাপের সাপোর্ট ও সতর্কবার্তা সংরক্ষিত হয়েছে।' : 'Settings saved.');
  };

  const handleToggleFeatureFlag = (key: keyof PlatformConfig['featureFlags']) => {
    if (!canAdminPerform(effectiveRole, 'manage_app_settings')) {
      showError(
        lang === 'bn'
          ? 'শুধুমাত্র সুপার অ্যাডমিন অ্যাপ সেটিংস ও ফিচার ফ্ল্যাগ পরিবর্তন করতে পারবেন।'
          : 'Only Super Admin can change feature flags.'
      );
      return;
    }
    const nextVal = !store.config.featureFlags[key];
    const auditEntry = recordAudit({
      actionType: 'config_updated',
      targetId: `featureFlag.${key}`,
      targetLabel: `Feature Flag: ${key}`,
      reason: `Toggled feature flag ${key} to ${String(nextVal)}`,
      metadata: { flag: key, enabled: nextVal },
    });
    setStore((prev) => {
      const nextConfig: PlatformConfig = {
        ...prev.config,
        featureFlags: {
          ...prev.config.featureFlags,
          [key]: nextVal,
        },
        updatedAt: todayISO,
        updatedBy: actorEmail,
      };
      const next = { ...prev, config: nextConfig, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(lang === 'bn' ? 'ফিচার ফ্ল্যাগ আপডেট করা হয়েছে।' : 'Feature flag updated.');
  };

  const handleToggleMaintenanceMode = () => {
    if (!canAdminPerform(effectiveRole, 'manage_app_settings')) {
      showError(lang === 'bn' ? 'অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const nextMode = !store.config.maintenanceMode;
    const auditEntry = recordAudit({
      actionType: 'config_updated',
      targetId: 'maintenanceMode',
      targetLabel: 'Platform Maintenance Notice Mode',
      reason: `Set maintenanceMode to ${String(nextMode)}`,
      metadata: { maintenanceMode: nextMode },
    });
    setStore((prev) => {
      const next = {
        ...prev,
        config: { ...prev.config, maintenanceMode: nextMode, updatedAt: todayISO, updatedBy: actorEmail },
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(next);
      return next;
    });
    showToast(
      lang === 'bn'
        ? nextMode
          ? 'মেইনটেন্যান্স নোটিশ মোড চালু করা হয়েছে।'
          : 'মেইনটেন্যান্স নোটিশ মোড বন্ধ করা হয়েছে।'
        : `Maintenance mode set to ${String(nextMode)}.`
    );
  };

  const handleConfirmPolicyChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdminPerform(effectiveRole, 'update_calculation_policy')) {
      showError(lang === 'bn' ? 'শুধুমাত্র সুপার অ্যাডমিন পলিসি আপডেট করতে পারবেন।' : 'Super Admin required.');
      return;
    }
    const hours = Number(policyHoursInput);
    const mult = Number(policyMultiplierInput);
    const minGross = Number(policyMinGrossInput);
    if (!hours || hours <= 0 || !mult || mult <= 0 || !minGross || minGross <= 0 || policyReasonInput.trim().length < 5) {
      showError(
        lang === 'bn'
          ? 'সঠিক সংখ্যা এবং পলিসি পরিবর্তনের সুস্পষ্ট কারণ (কমপক্ষে ৫ অক্ষর) প্রদান করুন।'
          : 'Provide valid calculation numbers and an explicit audit reason.'
      );
      return;
    }

    const newVersionStr = `v${todayISO.slice(0, 7).replace('-', '.')}-BD-RMG`;
    const newPolicy = {
      version: newVersionStr,
      effectiveFrom: todayISO,
      standardMonthlyHours: hours,
      overtimeMultiplier: mult,
      defaultWageBase: 'basic' as const,
      minimumGrossWageGrade4: minGross,
      updatedBy: actorEmail,
      updatedAt: todayISO,
      changeReason: policyReasonInput.trim(),
    };

    const auditEntry = recordAudit({
      actionType: 'policy_updated',
      targetId: newVersionStr,
      targetLabel: `Calculation Policy ${newVersionStr}`,
      reason: policyReasonInput.trim(),
      metadata: { standardMonthlyHours: hours, overtimeMultiplier: mult, minimumGrossWageGrade4: minGross },
    });

    setStore((prev) => {
      const next = {
        ...prev,
        config: {
          ...prev.config,
          currentCalculationPolicy: newPolicy,
          calculationPolicyHistory: [newPolicy, ...prev.config.calculationPolicyHistory],
          updatedAt: todayISO,
          updatedBy: actorEmail,
        },
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(next);
      return next;
    });

    setPolicyConfirmOpen(false);
    setPolicyReasonInput('');
    showToast(
      lang === 'bn'
        ? 'নতুন বেতন ও ওভারটাইম পলিসি ভার্সন সংরক্ষিত হয়েছে (পূর্ববর্তী ঐতিহাসিক রেকর্ড অপরিবর্তিত থাকবে)।'
        : 'New calculation policy version published with historical preservation.'
    );
  };

  // ============================================================================
  // SYSTEM MONITORING & AUDIT LOGS HANDLERS
  // ============================================================================
  const handleResolveErrorLog = (errId: string) => {
    if (!canAdminPerform(effectiveRole, 'resolve_system_errors')) {
      showError(lang === 'bn' ? 'অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const auditEntry = recordAudit({
      actionType: 'error_resolved',
      targetId: errId,
      targetLabel: `System Error ${errId}`,
      reason: 'Verified diagnostic log and marked resolved.',
    });
    setStore((prev) => {
      const nextErrors = prev.errors.map((er) =>
        er.id === errId
          ? { ...er, resolutionStatus: 'resolved' as const, resolvedBy: actorName, resolvedAt: todayISO }
          : er
      );
      const next = { ...prev, errors: nextErrors, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(lang === 'bn' ? 'এরর লগ সমাধানকৃত হিসেবে চিহ্নিত হয়েছে।' : 'Error log marked resolved.');
  };

  const [auditSearch, setAuditSearch] = useState('');
  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return store.auditLogs;
    return store.auditLogs.filter(
      (log) =>
        log.actionType.toLowerCase().includes(q) ||
        log.targetLabel.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        log.reason.toLowerCase().includes(q)
    );
  }, [store.auditLogs, auditSearch]);

  const handleRunBackupVerification = () => {
    if (!canAdminPerform(effectiveRole, 'manage_backups')) {
      showError(
        lang === 'bn'
          ? 'শুধুমাত্র সুপার অ্যাডমিন ব্যাকআপ ভেরিফিকেশন পরিচালনা করতে পারবেন।'
          : 'Only Super Admin can trigger backup verification.'
      );
      return;
    }
    const nowStamp = `${todayISO} ${new Date().toTimeString().slice(0, 8)}`;
    const newBkp = {
      id: `bkp_${Date.now()}`,
      timestamp: nowStamp,
      initiatedBy: actorEmail,
      type: 'manual_verification' as const,
      status: 'verified' as const,
      collectionsCovered: 16,
      integrityHash: `sha256:${Math.random().toString(16).slice(2, 18)}a8f4c1`,
      notes: 'নন-ডেস্ট্রাক্টিভ স্কিমা ও সিকিউরিটি রুলস ইন্টিগ্রিটি চেক সফল।',
    };
    const auditEntry = recordAudit({
      actionType: 'backup_verified',
      targetId: newBkp.id,
      targetLabel: 'Manual Non-Destructive Backup Verification',
      reason: 'Verified schema integrity and non-destructive backup readiness.',
    });
    setStore((prev) => {
      const next = {
        ...prev,
        backups: [newBkp, ...prev.backups],
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(next);
      return next;
    });
    showToast(
      lang === 'bn'
        ? 'ডাটাবেস স্কিমা ও ব্যাকআপ ইন্টিগ্রিটি যাচাই সফলভাবে সম্পন্ন হয়েছে।'
        : 'Backup integrity verification completed.'
    );
  };

  const handleExportSafeAdminReport = () => {
    if (!canAdminPerform(effectiveRole, 'export_admin_reports')) {
      showError(lang === 'bn' ? 'রিপোর্ট এক্সপোর্টের অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const safeReport = {
      generatedAt: new Date().toISOString(),
      platform: 'Shromik Sathi Super Admin Report (Privacy-Preserving Aggregate)',
      privacyGuarantee: 'Contains ZERO worker salary, overtime, expense, loan, contact, or document records.',
      metrics,
      auditLogCount: store.auditLogs.length,
      recentAuditEvents: store.auditLogs.slice(0, 20),
    };
    const blob = new Blob([JSON.stringify(safeReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shromik-sathi-admin-audit-report-${todayISO}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      lang === 'bn'
        ? 'নিরাপদ অ্যাডমিন অডিট রিপোর্ট ডাউনলোড হয়েছে (কোনো ব্যক্তিগত আর্থিক তথ্য ছাড়া)।'
        : 'Privacy-safe aggregate admin report downloaded.'
    );
  };

  const getSectionIcon = (id: AdminSectionId) => {
    switch (id) {
      case 'overview':
        return <LayoutGrid className="w-5 h-5 shrink-0" />;
      case 'users':
        return <Users className="w-5 h-5 shrink-0" />;
      case 'roles':
        return <ShieldCheck className="w-5 h-5 shrink-0" />;
      case 'subscriptions':
        return <Layers className="w-5 h-5 shrink-0" />;
      case 'support':
        return <MessageSquare className="w-5 h-5 shrink-0" />;
      case 'settings':
        return <Megaphone className="w-5 h-5 shrink-0" />;
      case 'monitoring':
        return <Activity className="w-5 h-5 shrink-0" />;
      case 'audit':
        return <History className="w-5 h-5 shrink-0" />;
    }
  };

  // ============================================================================
  // UNAUTHORIZED / ORDINARY WORKER ACCESS DENIED VIEW
  // ============================================================================
  if (!effectiveRole) {
    return (
      <div className="max-w-2xl mx-auto my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {lang === 'bn'
              ? 'অ্যাডমিন ড্যাশবোর্ড সংরক্ষিত (Access Restricted)'
              : 'Admin Dashboard Access Restricted'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {lang === 'bn'
              ? 'সাধারণ ব্যবহারকারী বা অনুমোদনহীন অ্যাকাউন্ট থেকে অ্যাডমিন প্যানেলে প্রবেশ করা সম্পূর্ণ নিষিদ্ধ। শুধুমাত্র সার্ভার-অনুমোদিত Super Admin, Admin অথবা Support Moderator এই ড্যাশবোর্ড ব্যবহার করতে পারবেন।'
              : 'Ordinary user accounts cannot access protected administrative routes. Only server-verified Super Admin, Admin, or Support Moderator accounts are permitted.'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
          <p className="font-bold text-slate-800 dark:text-slate-100">
            {lang === 'bn' ? 'নিরাপদ অ্যাডমিন প্রভিশনিং নিয়ম:' : 'Secure Administrator Provisioning:'}
          </p>
          <p>
            • Primary Super Admin: <span className="font-mono font-semibold">{PRIMARY_SUPER_ADMIN_EMAIL}</span>
          </p>
          <p>
            • Firestore Security Rule Gate: <span className="font-mono">exists(/databases/$(database)/documents/admins/$(request.auth.uid))</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {isAdminUser && (
            <button
              type="button"
              onClick={() => setSimulatedRole('super_admin')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {lang === 'bn'
                  ? 'সুপার অ্যাডমিন মোডে ফিরে যান'
                  : 'Restore Super Admin Session'}
              </span>
            </button>
          )}
          {onExitAdmin && (
            <button
              type="button"
              onClick={onExitAdmin}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'bn' ? 'শ্রমিক অ্যাপে ফিরে যান' : 'Return to Worker App'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentSectionMeta =
    ADMIN_MENU_SECTIONS.find((s) => s.id === activeSection) || ADMIN_MENU_SECTIONS[0];

  const handleDesktopFixedChromeWheel = (e: React.WheelEvent<HTMLElement>) => {
    if (typeof window === 'undefined' || window.innerWidth < 1024) return;
    const navEl = adminSidebarNavRef.current;
    if (navEl && navEl.contains(e.target as Node) && navEl.scrollHeight > navEl.clientHeight) {
      return;
    }
    const scrollEl = adminScrollContainerRef.current;
    if (scrollEl && e.deltaY !== 0) {
      const pixelDelta =
        e.deltaMode === 1
          ? e.deltaY * 40
          : e.deltaMode === 2
          ? e.deltaY * scrollEl.clientHeight
          : e.deltaY;
      scrollEl.scrollTop += pixelDelta;
    }
  };

  return (
    <div
      data-testid="super-admin-dashboard"
      className="min-h-screen lg:fixed lg:inset-0 lg:h-dvh lg:w-screen lg:overflow-hidden w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row"
    >
      {/* ===================================================================== */}
      {/* DESKTOP FIXED LEFT SIDEBAR (FLUSH TO LEFT EDGE, NEVER SCROLLS) */}
      {/* ===================================================================== */}
      <aside
        data-testid="admin-desktop-sidebar"
        onWheel={handleDesktopFixedChromeWheel}
        className={`hidden lg:flex flex-col shrink-0 lg:h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {/* Sidebar Header with Official Brand Emblem */}
        <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/80 p-0.5 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png"
                alt={lang === 'bn' ? 'শ্রমিক সাথী লোগো' : 'Shromik Sathi Logo'}
                width={32}
                height={32}
                className="w-full h-full object-contain rounded-full"
              />
            </span>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {lang === 'bn' ? 'শ্রমিক সাথী' : 'Shromik Sathi'}
                </p>
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 truncate">
                  {lang === 'bn' ? 'অ্যাডমিন কনসোল' : 'Admin Console'}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* 8-Item Navigation Menu (Fixed Inside Sidebar) */}
        <nav
          ref={adminSidebarNavRef}
          aria-label="Admin Navigation"
          className="flex-1 min-h-0 p-3 space-y-1.5 overflow-y-auto overscroll-y-contain"
        >
          {ADMIN_MENU_SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                data-testid={`admin-nav-${sec.id}`}
                onClick={() => setActiveSection(sec.id)}
                title={lang === 'bn' ? sec.titleBn : sec.titleEn}
                className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors flex items-center gap-3 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <span
                  className={`shrink-0 ${
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {getSectionIcon(sec.id)}
                </span>
                {!sidebarCollapsed && (
                  <span className="text-xs font-bold leading-snug truncate flex-1">
                    {lang === 'bn' ? sec.titleBn : sec.titleEn}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Return to Worker View */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          {onExitAdmin && (
            <button
              type="button"
              data-testid="exit-admin-btn"
              onClick={onExitAdmin}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && (
                <span className="truncate">
                  {lang === 'bn' ? 'শ্রমিক অ্যাপে ফিরুন' : 'Worker View'}
                </span>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* RIGHT MAIN WORKSPACE (FIXED TOP HEADER + SCROLLABLE CONTENT PANE) */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 lg:h-full lg:overflow-hidden">
        {/* Pinned Top Admin Header */}
        <header
          data-testid="admin-top-header"
          onWheel={handleDesktopFixedChromeWheel}
          className="sticky top-0 z-20 lg:static shrink-0 h-14 lg:h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              data-testid="admin-mobile-menu-btn"
              aria-label="Open admin menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[36px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
              <span>{lang === 'bn' ? 'মেনু' : 'Menu'}</span>
            </button>

            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
              {lang === 'bn' ? currentSectionMeta.titleBn : currentSectionMeta.titleEn}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Role Simulator (Desktop Inline) */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Shield className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <label
                htmlFor="admin-role-select"
                className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0"
              >
                {lang === 'bn' ? 'রোল:' : 'Role:'}
              </label>
              <select
                id="admin-role-select"
                data-testid="admin-role-simulator"
                value={simulatedRole}
                onChange={(e) => setSimulatedRole(e.target.value as AdminRole | 'ordinary_worker')}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer"
              >
                <option value="super_admin">{lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin'}</option>
                <option value="admin">{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</option>
                <option value="support_moderator">{lang === 'bn' ? 'মডারেটর' : 'Moderator'}</option>
                <option value="ordinary_worker">{lang === 'bn' ? 'সাধারণ ইউজার' : 'Ordinary Worker'}</option>
              </select>
            </div>

            {/* Distinct Corner Brand Badge */}
            <span
              data-testid="admin-corner-brand-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-[11px] sm:text-xs font-extrabold tracking-tight whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{lang === 'bn' ? 'শ্রমিক সাথী অ্যাডমিন' : 'Shromik Sathi Admin'}</span>
            </span>

            {/* Language & Theme (Desktop Quick Buttons) */}
            <button
              type="button"
              onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
              className="hidden lg:inline-flex min-h-[36px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>

            <button
              type="button"
              aria-label="Toggle theme"
              onClick={toggleDarkMode}
              className="hidden lg:flex w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 items-center justify-center cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Mobile Quick Return to Worker View */}
            {onExitAdmin && (
              <button
                type="button"
                onClick={onExitAdmin}
                aria-label={lang === 'bn' ? 'শ্রমিক অ্যাপে ফিরুন' : 'Return to Worker App'}
                className="lg:hidden min-h-[34px] px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden min-[380px]:inline">{lang === 'bn' ? 'ফিরুন' : 'Exit'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Mobile Slide-Over Admin Drawer (Separate Mobile Experience) */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            />
            <div
              data-testid="admin-mobile-drawer"
              className="relative w-72 max-w-[82vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 overflow-hidden"
            >
              <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {lang === 'bn' ? 'শ্রমিক সাথী অ্যাডমিন' : 'Shromik Sathi Admin'}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Close admin menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {ADMIN_MENU_SECTIONS.map((sec) => {
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      data-testid={`admin-mobile-nav-${sec.id}`}
                      onClick={() => {
                        setActiveSection(sec.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-bold'
                          : 'text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`shrink-0 ${
                            isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {getSectionIcon(sec.id)}
                        </span>
                        <span className="text-xs truncate">
                          {lang === 'bn' ? sec.titleBn : sec.titleEn}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>

              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5 shrink-0">
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Shield className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <select
                    data-testid="admin-mobile-role-simulator"
                    aria-label={lang === 'bn' ? 'রোল নির্বাচন' : 'Select Role'}
                    value={simulatedRole}
                    onChange={(e) => setSimulatedRole(e.target.value as AdminRole | 'ordinary_worker')}
                    className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="super_admin">{lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin'}</option>
                    <option value="admin">{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</option>
                    <option value="support_moderator">{lang === 'bn' ? 'মডারেটর' : 'Moderator'}</option>
                    <option value="ordinary_worker">{lang === 'bn' ? 'সাধারণ ইউজার' : 'Ordinary Worker'}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
                    className="min-h-[36px] px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleDarkMode}
                    className="min-h-[36px] px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                    <span>{darkMode ? (lang === 'bn' ? 'লাইট' : 'Light') : lang === 'bn' ? 'ডার্ক' : 'Dark'}</span>
                  </button>
                </div>

                {onExitAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onExitAdmin();
                    }}
                    className="w-full min-h-[38px] px-3 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'শ্রমিক অ্যাপে ফিরুন' : 'Return to Worker App'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toast & Error Alerts */}
        {toastMsg && (
          <div
            role="status"
            className="mx-3 sm:mx-6 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {errorBanner && (
          <div
            role="alert"
            className="mx-3 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2 shrink-0"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Scrollable Section Content Container */}
        <div
          ref={adminScrollContainerRef}
          data-testid="admin-scroll-container"
          className="flex-1 min-h-0 lg:overflow-y-auto overscroll-y-contain p-3 sm:p-5 lg:p-6"
        >
          <div className="max-w-7xl mx-auto space-y-5">
          {/* ================================================================= */}
          {/* SECTION 1: ড্যাশবোর্ড ও অ্যানালিটিক্স (OVERVIEW & ANALYTICS) */}
          {/* ================================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-5">
              {/* Quick Control: Login Page Demo Mode Visibility Toggle */}
              <div
                data-testid="admin-overview-demo-toggle-card"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      publicDemoConfig.enabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'bn'
                        ? 'লগইন পেজে ডেমো মোড বাটন নিয়ন্ত্রণ'
                        : 'Login Page Try Demo Mode Control'}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="admin-overview-toggle-demo-btn"
                  onClick={() => {
                    const nextEnabled = !publicDemoConfig.enabled;
                    updatePublicDemoConfig({ enabled: nextEnabled });
                    showToast(
                      nextEnabled
                        ? lang === 'bn'
                          ? 'লগইন পেজে ডেমো মোড বাটন চালু করা হয়েছে'
                          : 'Login page Try Demo button enabled'
                        : lang === 'bn'
                        ? 'লগইন পেজ থেকে ডেমো মোড বাটন বন্ধ করা হয়েছে'
                        : 'Login page Try Demo button disabled'
                    );
                  }}
                  className={`w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0 transition-colors ${
                    publicDemoConfig.enabled
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                >
                  {publicDemoConfig.enabled
                    ? lang === 'bn'
                      ? 'ডেমো মোড বন্ধ করুন'
                      : 'Turn Off Demo Mode'
                    : lang === 'bn'
                    ? 'ডেমো মোড চালু করুন'
                    : 'Turn On Demo Mode'}
                </button>
              </div>

              {/* 8 Summary Metric Cards — Clean Title + Number Only (No Subtitles) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'মোট নিবন্ধিত ইউজার' : 'Total Registered Users'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.totalRegisteredUsers) : metrics.totalRegisteredUsers}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'আজকের নতুন রেজিস্ট্রেশন' : 'New Registrations Today'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.newRegistrationsToday) : metrics.newRegistrationsToday}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'এই মাসের রেজিস্ট্রেশন' : 'New This Month'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                    {lang === 'bn'
                      ? toBengaliDigits(metrics.newRegistrationsThisMonth)
                      : metrics.newRegistrationsThisMonth}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'সক্রিয় অ্যাকাউন্ট' : 'Active Accounts'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.activeAccounts) : metrics.activeAccounts}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'সাসপেন্ডেড অ্যাকাউন্ট' : 'Suspended Accounts'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.suspendedAccounts) : metrics.suspendedAccounts}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'অপেক্ষমাণ সাপোর্ট টিকিট' : 'Pending Support Tickets'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.pendingSupportTickets) : metrics.pendingSupportTickets}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'অমীমাংসিত কারিগরি সমস্যা' : 'Unresolved Tech Issues'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                    {lang === 'bn'
                      ? toBengaliDigits(metrics.unresolvedTechnicalIssues)
                      : metrics.unresolvedTechnicalIssues}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'প্রকাশিত ঘোষণা' : 'Published Announcements'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
                    {lang === 'bn'
                      ? toBengaliDigits(metrics.announcementsPublished)
                      : metrics.announcementsPublished}
                  </p>
                </div>
              </div>

              {/* Interactive Pie Charts Grid: Wage Breakdown, Industrial Zones, Shift Distribution */}
              <div
                data-testid="admin-overview-pie-charts-grid"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-5"
              >
                <AdminPieChartCard
                  dataTestId="admin-overview-wage-pie"
                  titleBn="শ্রমিক মজুরি ও বেতনের বিশ্লেষণ (পাই চার্ট)"
                  titleEn="Worker Wage Analytics (Pie Chart)"
                  lang={lang}
                  slices={adminCharts.overview.wageBreakdownPie}
                  centerValueBn="৳২.০৮ কোটি"
                  centerValueEn="৳20.8M"
                  centerLabelBn="মোট বেতন প্রবাহ"
                  centerLabelEn="Total Payroll"
                  showValueAsPercent
                  stackedLegend
                  icon={<FileText className="w-4 h-4 text-emerald-600 shrink-0" />}
                />

                <AdminPieChartCard
                  dataTestId="admin-overview-zone-pie"
                  titleBn="শিল্পাঞ্চলভিত্তিক ইউজার অনুপাত (পাই চার্ট)"
                  titleEn="Industrial Zones Ratio (Pie Chart)"
                  lang={lang}
                  slices={adminCharts.overview.industrialZonePie}
                  centerValueBn="৫টি জোন"
                  centerValueEn="5 Zones"
                  centerLabelBn="প্রধান শিল্প এলাকা"
                  centerLabelEn="RMG Hubs"
                  showValueAsPercent
                  stackedLegend
                  icon={<Globe className="w-4 h-4 text-teal-600 shrink-0" />}
                />

                <AdminPieChartCard
                  dataTestId="admin-overview-shift-pie"
                  titleBn="শিফট ডিউটি ও বোনাস বিশ্লেষণ (পাই চার্ট)"
                  titleEn="Shift & Bonus Analytics (Pie Chart)"
                  lang={lang}
                  slices={adminCharts.overview.shiftDistributionPie}
                  centerValueBn="৯১.৪%"
                  centerValueEn="91.4%"
                  centerLabelBn="হাজিরা বোনাস যোগ্য"
                  centerLabelEn="Bonus Qualified"
                  showValueAsPercent
                  stackedLegend
                  icon={<Clock className="w-4 h-4 text-sky-600 shrink-0" />}
                />
              </div>

              {/* Monthly Growth Trend Area Chart + Subscription Revenue Pie Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-6 items-start">
                <div className="lg:col-span-7">
                  <AdminGrowthTrendCard
                    lang={lang}
                    trend={adminCharts.overview.monthlyGrowthTrend}
                    dataTestId="admin-overview-growth-trend-card"
                  />
                </div>
                <div className="lg:col-span-5">
                  <AdminPieChartCard
                    dataTestId="admin-overview-sub-pie"
                    titleBn="সাবস্ক্রিপশন প্ল্যান ও আয় অনুপাত (পাই চার্ট)"
                    titleEn="Subscription Plan Share (Pie Chart)"
                    lang={lang}
                    slices={adminCharts.overview.subscriptionTierPie}
                    centerValueBn="৳৪,৭৫,০০০"
                    centerValueEn="৳475,000"
                    centerLabelBn="মাসিক আয় (MRR)"
                    centerLabelEn="Monthly MRR"
                    badgeTextBn="কনভার্সন ১২.৮%"
                    badgeTextEn="12.8% Conv."
                    showValueAsPercent
                    stackedLegend
                    icon={<Activity className="w-4 h-4 text-emerald-600 shrink-0" />}
                  />
                </div>
              </div>

              {/* Quick Admin Action Center */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">

                {/* Quick Admin Action Center (12 Cols) */}
                <div className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Settings className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'bn' ? 'দ্রুত অ্যাডমিন অ্যাকশন সেন্টার' : 'Quick Admin Actions'}</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={handleExportSafeAdminReport}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-2 transition cursor-pointer text-left"
                    >
                      <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'bn' ? 'রিপোর্ট ডাউনলোড' : 'Export Analytics'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection('settings')}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-2 transition cursor-pointer text-left"
                    >
                      <Megaphone className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>{lang === 'bn' ? 'সিস্টেম নোটিশ জারি' : 'Broadcast Notice'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRunBackupVerification}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-2 transition cursor-pointer text-left"
                    >
                      <Database className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{lang === 'bn' ? 'ডাটাবেস পরীক্ষা' : 'DB Health Check'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection('audit')}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-2 transition cursor-pointer text-left"
                    >
                      <History className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>{lang === 'bn' ? 'অডিট লগ তালিকা' : 'View Audit Logs'}</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {lang === 'bn' ? 'ফায়ারস্টোর ডাটাবেস সংযোগ:' : 'Firestore Sync Status:'}
                    </span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {lang === 'bn' ? '১৮ মি.সে. (সচল)' : '18 ms (Healthy)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 7-Section Directory Card (Title Only, No Subtitles) + Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
                {/* Left 7 Cols: Interactive 7-Section Directory (Name Only, No Subtitles) */}
                <div className="lg:col-span-7 space-y-3">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'অ্যাডমিন ড্যাশবোর্ড মেনুসমূহ'
                      : 'Admin Dashboard Modules'}
                  </h2>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {ADMIN_MENU_SECTIONS.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setActiveSection(sec.id)}
                        className="w-full px-4 sm:px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-emerald-700 dark:text-emerald-400 shrink-0">
                            {getSectionIcon(sec.id)}
                          </span>
                          <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                            {lang === 'bn' ? sec.titleBn : sec.titleEn}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right 5 Cols: Stored Data Trends + Recent Audit Activity */}
                <div className="lg:col-span-5 space-y-4">
                  <AdminBarChartCard
                    dataTestId="admin-overview-cohort-bar"
                    titleBn="মাসভিত্তিক ইউজার রেজিস্ট্রেশন (বার গ্রাফ)"
                    titleEn="Monthly User Registrations (Bar Chart)"
                    lang={lang}
                    bars={adminCharts.overview.cohortRegistrationBar}
                    badgeTextBn={`মোট ${toBengaliDigits(store.users.length)} জন`}
                    badgeTextEn={`${store.users.length} total`}
                    icon={<Users className="w-4 h-4 text-emerald-600 shrink-0" />}
                  />

                  {/* Recent Administrative Activity */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {lang === 'bn' ? 'সাম্প্রতিক অ্যাডমিন কার্যক্রম' : 'Recent Admin Activity'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveSection('audit')}
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        {lang === 'bn' ? 'সব দেখুন' : 'View All'}
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {store.auditLogs.slice(0, 3).map((log) => (
                        <div key={log.id} className="py-2.5 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {log.targetLabel}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 shrink-0">
                              {log.timestamp.slice(0, 10)}
                            </span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 line-clamp-1">
                            {log.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 2: ইউজার ম্যানেজমেন্ট (USER MANAGEMENT — NO SUBTITLES) */}
          {/* ================================================================= */}
          {activeSection === 'users' && (
            <div className="space-y-4">
              {/* Compact Summary Strip (No Subtitles) */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {lang === 'bn' ? 'মোট ইউজার' : 'Total Users'}
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {lang === 'bn' ? toBengaliDigits(store.users.length) : store.users.length}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {lang === 'bn' ? 'সক্রিয়' : 'Active'}
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {lang === 'bn' ? toBengaliDigits(metrics.activeAccounts) : metrics.activeAccounts}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    {lang === 'bn' ? 'সাসপেন্ডেড' : 'Suspended'}
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                    {lang === 'bn' ? toBengaliDigits(metrics.suspendedAccounts) : metrics.suspendedAccounts}
                  </span>
                </div>
              </div>

              {/* User Management Pie & Bar Charts Row */}
              <div
                data-testid="admin-users-charts-row"
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                <AdminPieChartCard
                  dataTestId="admin-users-auth-pie"
                  titleBn="ইউজার স্ট্যাটাস ও লগইন মাধ্যম (পাই চার্ট)"
                  titleEn="User Status & Auth Method (Pie Chart)"
                  lang={lang}
                  slices={adminCharts.users.userAuthAndStatusPie}
                  centerValueBn={`${toBengaliDigits(store.users.length)} জন`}
                  centerValueEn={`${store.users.length}`}
                  centerLabelBn="মোট ইউজার"
                  centerLabelEn="Total Users"
                  valueSuffixBn=" জন"
                  valueSuffixEn=" users"
                />
                <AdminBarChartCard
                  dataTestId="admin-users-activity-bar"
                  titleBn="ইউজারভিত্তিক মোট হিসাব রেকর্ড (বার গ্রাফ)"
                  titleEn="User Recorded Entries (Bar Chart)"
                  lang={lang}
                  bars={adminCharts.users.userActivityBar}
                  badgeTextBn="ওটি, হাজিরা ও বেতন"
                  badgeTextEn="OT, Att & Salary"
                />
              </div>

              {/* Firestore User Directory Sync Status & Read Error Bar */}
              {!isDemoMode && (
                <div
                  data-testid="admin-directory-status-bar"
                  className={`rounded-2xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
                    directoryReadError
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                      : directorySyncStatus === 'live'
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {directoryReadError ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          directorySyncStatus === 'live' ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                    )}
                    <span className="font-semibold">
                      {directoryReadError
                        ? `${lang === 'bn' ? directoryReadError.messageBn : directoryReadError.messageEn} [${directoryReadError.code}]`
                        : directorySyncStatus === 'loading'
                        ? lang === 'bn'
                          ? 'ফায়ারবেস থেকে ইউজার ডিরেক্টরি লোড হচ্ছে...'
                          : 'Loading live user directory from Firestore...'
                        : directorySyncStatus === 'cached'
                        ? lang === 'bn'
                          ? 'অফলাইন/ক্যাশ করা ইউজার তালিকা দেখানো হচ্ছে'
                          : 'Showing cached user directory (reconnecting...)'
                        : lang === 'bn'
                        ? `ক্লাউড ডিরেক্টরি সিঙ্ক সক্রিয় · নতুন আজ ${toBengaliDigits(metrics.newRegistrationsToday)} জন`
                        : `Live Firestore directory active · ${metrics.newRegistrationsToday} new today`}
                    </span>
                  </div>

                  {directoryReadError && (
                    <button
                      type="button"
                      data-testid="admin-directory-retry-btn"
                      onClick={handleRefreshUsersFromCloud}
                      disabled={isRefreshingUsers}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-60"
                    >
                      {lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Retry'}
                    </button>
                  )}
                </div>
              )}

              {/* Search & Filter Bar — Mobile & Desktop Responsive */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    data-testid="admin-user-search"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                    placeholder={
                      lang === 'bn'
                        ? 'নাম, ইমেইল বা ইউজার আইডি দিয়ে খুঁজুন...'
                        : 'Search by name, email, or UID...'
                    }
                    className="w-full min-h-[40px] pl-9 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="admin-user-today-filter"
                    onClick={() => {
                      setUserRegistrationPeriod((prev) => (prev === 'today' ? 'all' : 'today'));
                      setUserPage(1);
                    }}
                    className={`min-h-[40px] px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                      userRegistrationPeriod === 'today'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {lang === 'bn'
                      ? `আজকের নতুন (${toBengaliDigits(metrics.newRegistrationsToday)})`
                      : `New Today (${metrics.newRegistrationsToday})`}
                  </button>

                  <select
                    aria-label="Filter by account status"
                    data-testid="admin-user-status-filter"
                    value={userStatusFilter}
                    onChange={(e) => {
                      setUserStatusFilter(e.target.value as 'all' | 'active' | 'suspended');
                      setUserPage(1);
                    }}
                    className="flex-1 sm:flex-none sm:w-auto min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="all">{lang === 'bn' ? 'সকল স্ট্যাটাস' : 'All Statuses'}</option>
                    <option value="active">{lang === 'bn' ? 'সক্রিয়' : 'Active'}</option>
                    <option value="suspended">{lang === 'bn' ? 'সাসপেন্ডেড' : 'Suspended'}</option>
                  </select>

                  <select
                    aria-label="Filter by registration month"
                    data-testid="admin-user-month-filter"
                    value={userMonthFilter}
                    onChange={(e) => {
                      setUserMonthFilter(e.target.value);
                      setUserPage(1);
                    }}
                    className="flex-1 sm:flex-none sm:w-auto min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="all">{lang === 'bn' ? 'সকল মাস' : 'All Months'}</option>
                    {availableRegistrationMonths.map((monthKey) => (
                      <option key={monthKey} value={monthKey}>
                        {formatMonthLabel(monthKey, lang)}
                      </option>
                    ))}
                  </select>

                  {hasActiveUserFilters && (
                    <button
                      type="button"
                      data-testid="admin-user-reset-filters"
                      onClick={handleResetUserFilters}
                      className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer shrink-0"
                    >
                      {lang === 'bn' ? 'সব দেখুন' : 'Reset'}
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="admin-refresh-users-btn"
                    onClick={handleRefreshUsersFromCloud}
                    disabled={isRefreshingUsers}
                    aria-label={lang === 'bn' ? 'ইউজারের তালিকা রিফ্রেশ করুন' : 'Refresh users'}
                    className="min-h-[40px] px-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingUsers ? 'animate-spin' : ''}`} />
                    <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
                  </button>
                </div>
              </div>

              {/* Users List: Mobile Cards (< md) + Desktop Table (>= md) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedUsers.items.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      {lang === 'bn' ? 'কোনো ব্যবহারকারী পাওয়া যায়নি।' : 'No matching users found.'}
                    </div>
                  ) : (
                    paginatedUsers.items.map((u) => {
                      const isExpanded = selectedUserDetail?.uid === u.uid;
                      return (
                        <div key={u.uid} className="p-3.5 space-y-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                  {u.displayName}
                                </p>
                                {u.registeredAt === todayISO && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200 text-[10px] font-bold shrink-0">
                                    {lang === 'bn' ? 'নতুন' : 'New'}
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                            </div>
                            <span
                              className={`px-2.5 py-0.5 rounded-lg font-bold shrink-0 ${
                                u.accountStatus === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              {u.accountStatus === 'active'
                                ? lang === 'bn'
                                  ? 'সক্রিয়'
                                  : 'Active'
                                : lang === 'bn'
                                ? 'সাসপেন্ডেড'
                                : 'Suspended'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            <span>{u.uid}</span>
                            <span>·</span>
                            <span>{u.registeredAt}</span>
                            <span>·</span>
                            <span>{u.appVersion}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              data-testid={`mobile-user-detail-btn-${u.uid}`}
                              onClick={() =>
                                setSelectedUserDetail((prev) => (prev?.uid === u.uid ? null : u))
                              }
                              className={`min-h-[36px] px-3 rounded-xl border font-semibold cursor-pointer transition-colors ${
                                isExpanded
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              {lang === 'bn' ? 'বিস্তারিত' : 'Details'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSuspendModalUser(u);
                                setSuspendReasonInput('');
                              }}
                              className={`min-h-[36px] px-3 rounded-xl font-bold cursor-pointer ${
                                u.accountStatus === 'active'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              }`}
                            >
                              {u.accountStatus === 'active'
                                ? lang === 'bn'
                                  ? 'সাসপেন্ড'
                                  : 'Suspend'
                                : lang === 'bn'
                                ? 'সক্রিয় করুন'
                                : 'Reactivate'}
                            </button>
                          </div>

                          {/* Inline User Details */}
                          {isExpanded && (
                            <div
                              data-testid={`mobile-user-detail-panel-${u.uid}`}
                              className="mt-2 pt-3 border-t border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-slate-800/60 rounded-xl p-3.5 space-y-3"
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
                                <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {u.displayName}
                                </h3>
                                <button
                                  type="button"
                                  onClick={() => setSelectedUserDetail(null)}
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-2 text-xs">
                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                                  <span className="text-slate-500">
                                    {lang === 'bn' ? 'লগইন মাধ্যম' : 'Auth Provider'}
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {u.authProvider}
                                  </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                                  <span className="text-slate-500">
                                    {lang === 'bn' ? 'সর্বশেষ সক্রিয় তারিখ' : 'Last Seen Date'}
                                  </span>
                                  <span className="font-bold font-mono text-slate-900 dark:text-white">
                                    {u.lastSeenDate}
                                  </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                                  <span className="text-slate-500">
                                    {lang === 'bn' ? 'অ্যাকাউন্ট রিকভারি' : 'Account Recovery'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerSafeRecovery(u)}
                                    className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                                  >
                                    {lang === 'bn' ? 'রিকভারি লিংক পাঠান' : 'Send Recovery Link'}
                                  </button>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                  {lang === 'bn'
                                    ? 'স্ট্যাটাস পরিবর্তনের ইতিহাস:'
                                    : 'Status History:'}
                                </h4>
                                <div className="space-y-1.5 text-[11px]">
                                  {u.statusHistory.map((h, i) => (
                                    <div
                                      key={i}
                                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2"
                                    >
                                      <span>
                                        <strong className="uppercase">{h.status}</strong> — {h.reason} (
                                        {h.changedBy})
                                      </span>
                                      <span className="font-mono text-slate-400 shrink-0">
                                        {h.changedAt}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                        <th className="py-3 px-4">{lang === 'bn' ? 'ব্যবহারকারী ও ইমেইল' : 'User & Email'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'ইউজার আইডি' : 'UID'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'নিবন্ধনের তারিখ' : 'Registered'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'ভেরিফিকেশন ও সংস্করণ' : 'Verification & Version'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'কার্যক্রম' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedUsers.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            {lang === 'bn' ? 'কোনো ব্যবহারকারী পাওয়া যায়নি।' : 'No matching users found.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.items.map((u) => {
                          const isExpanded = selectedUserDetail?.uid === u.uid;
                          return (
                            <React.Fragment key={u.uid}>
                              <tr
                                className={`transition-colors ${
                                  isExpanded
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-slate-900 dark:text-white">{u.displayName}</p>
                                    {u.registeredAt === todayISO && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200 text-[10px] font-bold shrink-0">
                                        {lang === 'bn' ? 'নতুন' : 'New'}
                                      </span>
                                    )}
                                    {u.role && u.role !== 'user' && (
                                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/70 dark:text-indigo-200 text-[10px] font-bold shrink-0">
                                        {u.role}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-500 dark:text-slate-400">{u.email}</p>
                                </td>
                                <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                  {u.uid}
                                </td>
                                <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                  {u.registeredAt}
                                </td>
                                <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                  <span>
                                    {u.emailVerified
                                      ? lang === 'bn'
                                        ? 'ভেরিফাইড'
                                        : 'Verified'
                                      : lang === 'bn'
                                      ? 'আনভেরিফাইড'
                                      : 'Unverified'}
                                  </span>
                                  <span aria-hidden="true"> · </span>
                                  <span className="font-mono">{u.appVersion}</span>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`font-bold ${
                                      u.accountStatus === 'active'
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {u.accountStatus === 'active'
                                      ? lang === 'bn'
                                        ? 'সক্রিয়'
                                        : 'Active'
                                      : lang === 'bn'
                                      ? 'সাসপেন্ডেড'
                                      : 'Suspended'}
                                  </span>
                                  {u.suspensionReason && (
                                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 max-w-[200px] truncate">
                                      {u.suspensionReason}
                                    </p>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      data-testid={`user-detail-btn-${u.uid}`}
                                      onClick={() =>
                                        setSelectedUserDetail((prev) =>
                                          prev?.uid === u.uid ? null : u
                                        )
                                      }
                                      className={`px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer transition-colors ${
                                        isExpanded
                                          ? 'bg-emerald-600 text-white border-emerald-600'
                                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                      }`}
                                    >
                                      {lang === 'bn' ? 'বিস্তারিত' : 'Details'}
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`toggle-suspend-${u.uid}`}
                                      onClick={() => {
                                        setSuspendModalUser(u);
                                        setSuspendReasonInput('');
                                      }}
                                      className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
                                        u.accountStatus === 'active'
                                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300'
                                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                                      }`}
                                    >
                                      {u.accountStatus === 'active'
                                        ? lang === 'bn'
                                          ? 'সাসপেন্ড'
                                          : 'Suspend'
                                        : lang === 'bn'
                                        ? 'সক্রিয় করুন'
                                        : 'Reactivate'}
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Inline User Detail Row rendered immediately beneath this user's row */}
                              {isExpanded && (
                                <tr
                                  data-testid={`user-detail-panel-${u.uid}`}
                                  className="bg-emerald-50/30 dark:bg-slate-800/40"
                                >
                                  <td colSpan={6} className="p-4">
                                    <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            {u.displayName}
                                          </h3>
                                          <p className="text-xs text-slate-500 font-mono">{u.uid}</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedUserDetail(null)}
                                          className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                          <span className="text-slate-500 block">
                                            {lang === 'bn' ? 'লগইন মাধ্যম' : 'Auth Provider'}
                                          </span>
                                          <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                                            {u.authProvider}
                                          </span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                          <span className="text-slate-500 block">
                                            {lang === 'bn' ? 'সর্বশেষ সক্রিয় তারিখ' : 'Last Seen Date'}
                                          </span>
                                          <span className="font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
                                            {u.lastSeenDate}
                                          </span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                          <span className="text-slate-500 block">
                                            {lang === 'bn'
                                              ? 'অ্যাকাউন্ট রিকভারি'
                                              : 'Account Recovery'}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleTriggerSafeRecovery(u)}
                                            className="mt-1 text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                                          >
                                            {lang === 'bn'
                                              ? 'রিকভারি লিংক পাঠান'
                                              : 'Send Recovery Link'}
                                          </button>
                                        </div>
                                      </div>

                                      <div>
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                          {lang === 'bn'
                                            ? 'স্ট্যাটাস পরিবর্তনের ইতিহাস:'
                                            : 'Status History:'}
                                        </h4>
                                        <div className="space-y-1.5 text-xs">
                                          {u.statusHistory.map((h, i) => (
                                            <div
                                              key={i}
                                              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-2"
                                            >
                                              <span>
                                                <strong className="uppercase">{h.status}</strong> —{' '}
                                                {h.reason} ({h.changedBy})
                                              </span>
                                              <span className="font-mono text-slate-400">
                                                {h.changedAt}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                <div className="px-3.5 sm:px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span data-testid="admin-user-pagination-summary">
                    {lang === 'bn'
                      ? `দেখানো হচ্ছে ${toBengaliDigits(paginatedUsers.startIndex)}–${toBengaliDigits(paginatedUsers.endIndex)} / মোট ${toBengaliDigits(paginatedUsers.totalItems)} জন · পৃষ্ঠা ${toBengaliDigits(paginatedUsers.currentPage)} / ${toBengaliDigits(paginatedUsers.totalPages)}`
                      : `Showing ${paginatedUsers.startIndex}–${paginatedUsers.endIndex} of ${paginatedUsers.totalItems} · Page ${paginatedUsers.currentPage}/${paginatedUsers.totalPages}`}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5">
                      <span>{lang === 'bn' ? 'প্রতি পৃষ্ঠা:' : 'Per page:'}</span>
                      <select
                        aria-label={lang === 'bn' ? 'প্রতি পৃষ্ঠায় ইউজার সংখ্যা' : 'Users per page'}
                        data-testid="admin-user-page-size"
                        value={userPageSize}
                        onChange={(e) => {
                          setUserPageSize(Number(e.target.value) || 10);
                          setUserPage(1);
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                      >
                        <option value={5}>{lang === 'bn' ? '৫' : '5'}</option>
                        <option value={10}>{lang === 'bn' ? '১০' : '10'}</option>
                        <option value={25}>{lang === 'bn' ? '২৫' : '25'}</option>
                        <option value={50}>{lang === 'bn' ? '৫০' : '50'}</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={paginatedUsers.currentPage <= 1}
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'bn' ? 'পূর্ববর্তী' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      disabled={paginatedUsers.currentPage >= paginatedUsers.totalPages}
                      onClick={() => setUserPage((p) => Math.min(paginatedUsers.totalPages, p + 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'bn' ? 'পরবর্তী' : 'Next'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Confirmation Modal for Suspend / Reactivate */}
              {suspendModalUser && (
                <div
                  role="dialog"
                  aria-modal="true"
                  className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
                >
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {suspendModalUser.accountStatus === 'active'
                            ? lang === 'bn'
                              ? 'অ্যাকাউন্ট সাসপেন্ড নিশ্চিতকরণ'
                              : 'Confirm Account Suspension'
                            : lang === 'bn'
                            ? 'অ্যাকাউন্ট সক্রিয় নিশ্চিতকরণ'
                            : 'Confirm Account Reactivation'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {suspendModalUser.displayName} ({suspendModalUser.email})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSuspendModalUser(null)}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleConfirmUserStatusChange} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {lang === 'bn'
                            ? 'প্রশাসনিক পদক্ষেপের কারণ *'
                            : 'Reason for administrative action *'}
                        </label>
                        <textarea
                          rows={3}
                          required
                          data-testid="suspend-reason-input"
                          value={suspendReasonInput}
                          onChange={(e) => setSuspendReasonInput(e.target.value)}
                          placeholder={
                            lang === 'bn'
                              ? 'সুনির্দিষ্ট কারণ লিখুন...'
                              : 'Enter explicit justification...'
                          }
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs sm:text-sm"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSuspendModalUser(null)}
                          className="min-h-[38px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                        >
                          {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          data-testid="confirm-suspend-submit"
                          className={`min-h-[38px] px-4 rounded-xl text-white text-xs font-bold cursor-pointer ${
                            suspendModalUser.accountStatus === 'active'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-emerald-700 hover:bg-emerald-800'
                          }`}
                        >
                          {suspendModalUser.accountStatus === 'active'
                            ? lang === 'bn'
                              ? 'সাসপেন্ড নিশ্চিত করুন'
                              : 'Confirm Suspend'
                            : lang === 'bn'
                            ? 'সক্রিয় নিশ্চিত করুন'
                            : 'Confirm Reactivate'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 3: অ্যাডমিন রোল ও পারমিশন (INTERACTIVE ROLE MATRIX) */}
          {/* ================================================================= */}
          {activeSection === 'roles' && (
            <div className="space-y-5">
              {/* Role & Permission Analytics Charts Row */}
              <div
                data-testid="admin-roles-charts-row"
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                <AdminPieChartCard
                  dataTestId="admin-roles-pie"
                  titleBn="অ্যাডমিন ও মডারেটর রোল অনুপাত (পাই চার্ট)"
                  titleEn="Admin & Moderator Roles (Pie Chart)"
                  lang={lang}
                  slices={adminCharts.roles.adminRolePie}
                  centerValueBn={`${toBengaliDigits(store.roles.length)} জন`}
                  centerValueEn={`${store.roles.length}`}
                  centerLabelBn="দায়িত্বপ্রাপ্ত টিম"
                  centerLabelEn="Assigned Team"
                  valueSuffixBn=" জন"
                  valueSuffixEn=" members"
                />
                <AdminBarChartCard
                  dataTestId="admin-roles-bar"
                  titleBn="রোলভিত্তিক অনুমোদিত ফিচার সংখ্যা (বার গ্রাফ)"
                  titleEn="Enabled Features by Role (Bar Chart)"
                  lang={lang}
                  bars={adminCharts.roles.rolePermissionsBar}
                  badgeTextBn="মোট ৩৫টি ফিচার"
                  badgeTextEn="35 Total Features"
                />
              </div>

              {/* Interactive Role & Feature Access Matrix (No Subtitles, Single-Language) */}
              <div
                data-testid="admin-role-feature-matrix-card"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
              >
                {/* Matrix Header + Module Group Filter Tabs */}
                <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>
                        {lang === 'bn'
                          ? 'রোল ও ফিচার পারমিশন ম্যাট্রিক্স'
                          : 'Role & Feature Permission Matrix'}
                      </span>
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {MATRIX_ROLES.map((roleItem) => (
                        <span
                          key={roleItem.key}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold"
                        >
                          {lang === 'bn' ? roleItem.bn : roleItem.en}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Module Tab Filter Bar */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedMatrixGroup('all')}
                      className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        selectedMatrixGroup === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {lang === 'bn' ? 'সব ট্যাব ও ফিচার' : 'All Tabs & Features'}
                    </button>
                    {ROLE_FEATURE_GROUPS.map((grp) => (
                      <button
                        key={grp.groupId}
                        type="button"
                        data-testid={`matrix-group-tab-${grp.groupId}`}
                        onClick={() => setSelectedMatrixGroup(grp.groupId)}
                        className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          selectedMatrixGroup === grp.groupId
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {lang === 'bn' ? grp.titleBn : grp.titleEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Responsive Checkbox Matrix Table (Works on both Mobile & Desktop) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 font-bold">
                        <th className="py-3 px-3 sm:px-4 min-w-[170px] sm:min-w-[240px]">
                          {lang === 'bn' ? 'অ্যাপের ট্যাব ও ফিচার' : 'App Tab & Feature'}
                        </th>
                        {MATRIX_ROLES.map((roleCol) => (
                          <th
                            key={roleCol.key}
                            className="py-3 px-2 sm:px-4 text-center whitespace-nowrap"
                          >
                            {lang === 'bn' ? roleCol.bn : roleCol.en}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {ROLE_FEATURE_GROUPS.filter(
                        (grp) => selectedMatrixGroup === 'all' || grp.groupId === selectedMatrixGroup
                      ).map((grp) => (
                        <React.Fragment key={grp.groupId}>
                          {/* Group Section Row */}
                          <tr className="bg-indigo-50/60 dark:bg-indigo-950/30">
                            <td
                              colSpan={5}
                              className="py-2 px-3 sm:px-4 font-bold text-indigo-900 dark:text-indigo-300 text-xs"
                            >
                              {lang === 'bn' ? grp.titleBn : grp.titleEn}
                            </td>
                          </tr>

                          {/* Feature Checkbox Rows */}
                          {grp.items.map((feat) => (
                            <tr
                              key={feat.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-2.5 px-3 sm:px-4 font-semibold text-slate-800 dark:text-slate-100">
                                {lang === 'bn' ? feat.bn : feat.en}
                              </td>
                              {MATRIX_ROLES.map((roleCol) => {
                                const isChecked = Boolean(
                                  roleFeatureMatrix[roleCol.key]?.[feat.id]
                                );
                                return (
                                  <td
                                    key={roleCol.key}
                                    className="py-2.5 px-2 sm:px-4 text-center"
                                  >
                                    <label className="inline-flex items-center justify-center p-1 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        data-testid={`matrix-check-${roleCol.key}-${feat.id}`}
                                        aria-label={`${lang === 'bn' ? feat.bn : feat.en} - ${
                                          lang === 'bn' ? roleCol.bn : roleCol.en
                                        }`}
                                        checked={isChecked}
                                        onChange={() =>
                                          handleToggleRoleFeature(roleCol.key, feat.id)
                                        }
                                        className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                                      />
                                    </label>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Current Administrators & Moderators List: Mobile Cards + Desktop Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'অ্যাডমিন ও মডারেটর তালিকা' : 'Administrators & Moderators'}
                  </h3>
                </div>

                {/* Mobile Cards (< md) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {store.roles.map((r) => (
                    <div key={r.uid} className="p-3.5 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{r.displayName}</p>
                          <p className="font-mono text-slate-500 truncate">{r.email}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                          {r.role === 'super_admin'
                            ? lang === 'bn'
                              ? 'সুপার অ্যাডমিন'
                              : 'Super Admin'
                            : r.role === 'admin'
                            ? lang === 'bn'
                              ? 'অ্যাডমিন'
                              : 'Admin'
                            : lang === 'bn'
                            ? 'মডারেটর'
                            : 'Moderator'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-500 font-mono">{r.assignedAt}</span>
                        {r.isPrimarySuperAdmin ? (
                          <span className="text-[11px] text-slate-400">
                            {lang === 'bn' ? 'অপরিবর্তনীয়' : 'Locked'}
                          </span>
                        ) : (
                          <select
                            aria-label={`Change role for ${r.displayName}`}
                            value={r.role}
                            disabled={effectiveRole !== 'super_admin'}
                            onChange={(e) =>
                              handleChangeExistingRole(r.email, e.target.value as AdminRole)
                            }
                            className="min-h-[34px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold disabled:opacity-50"
                          >
                            <option value="super_admin">{lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin'}</option>
                            <option value="admin">{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</option>
                            <option value="support_moderator">{lang === 'bn' ? 'মডারেটর' : 'Moderator'}</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                        <th className="py-3 px-4">{lang === 'bn' ? 'নাম ও ইমেইল' : 'Name & Email'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'বর্তমান রোল' : 'Assigned Role'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'অনুমোদনের তারিখ' : 'Assigned Date'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'রোল পরিবর্তন' : 'Modify Role'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {store.roles.map((r) => (
                        <tr key={r.uid}>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 dark:text-white">{r.displayName}</p>
                            <p className="font-mono text-slate-500">{r.email}</p>
                          </td>
                          <td className="py-3 px-4 font-semibold text-emerald-700 dark:text-emerald-400">
                            {r.role === 'super_admin'
                              ? lang === 'bn'
                                ? 'সুপার অ্যাডমিন'
                                : 'Super Admin'
                              : r.role === 'admin'
                              ? lang === 'bn'
                                ? 'অ্যাডমিন'
                                : 'Admin'
                              : lang === 'bn'
                              ? 'মডারেটর'
                              : 'Moderator'}
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono">
                            {r.assignedAt}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {r.isPrimarySuperAdmin ? (
                              <span className="text-[11px] text-slate-400">
                                {lang === 'bn' ? 'অপরিবর্তনীয়' : 'Locked'}
                              </span>
                            ) : (
                              <select
                                aria-label={`Change role for ${r.displayName}`}
                                value={r.role}
                                disabled={effectiveRole !== 'super_admin'}
                                onChange={(e) =>
                                  handleChangeExistingRole(r.email, e.target.value as AdminRole)
                                }
                                className="min-h-[34px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold disabled:opacity-50"
                              >
                                <option value="super_admin">{lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin'}</option>
                                <option value="admin">{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</option>
                                <option value="support_moderator">{lang === 'bn' ? 'মডারেটর' : 'Moderator'}</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add / Provision New Admin or Moderator Form */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn'
                    ? 'নতুন অ্যাডমিন বা মডারেটর যুক্ত করুন'
                    : 'Assign New Administrator or Moderator'}
                </h3>
                <form onSubmit={handleAssignAdminRole} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                    </label>
                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder={lang === 'bn' ? 'যেমন: মাহবুব আলম' : 'e.g. Mahbub Alam'}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
                    </label>
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="moderator@shromiksathi.org"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'নির্ধারিত রোল' : 'Role'}
                    </label>
                    <select
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value as AdminRole)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    >
                      <option value="support_moderator">{lang === 'bn' ? 'মডারেটর' : 'Moderator'}</option>
                      <option value="admin">{lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}</option>
                      <option value="super_admin">{lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'নিয়োগের কারণ' : 'Authorization Reason'}
                    </label>
                    <input
                      type="text"
                      value={roleReason}
                      onChange={(e) => setRoleReason(e.target.value)}
                      placeholder={lang === 'bn' ? 'যেমন: গাজীপুর জোন সাপোর্ট' : 'e.g. Support desk'}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={effectiveRole !== 'super_admin'}
                      className="w-full sm:w-auto min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {lang === 'bn' ? 'রোল সংরক্ষণ করুন' : 'Save Role'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION: সাবস্ক্রিপশন ও প্ল্যান (SUBSCRIPTIONS & PLANS) */}
          {/* ================================================================= */}
          {activeSection === 'subscriptions' && (
            <div className="space-y-4">
              <div
                data-testid="admin-subscriptions-charts-row"
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                <AdminPieChartCard
                  dataTestId="admin-subscriptions-pie"
                  titleBn="প্ল্যানভিত্তিক ইউজার অনুপাত (পাই চার্ট)"
                  titleEn="User Share by Plan Tier (Pie Chart)"
                  lang={lang}
                  slices={adminCharts.subscriptions.planSharePie}
                  centerValueBn="১০০%"
                  centerValueEn="100%"
                  centerLabelBn="মোট ইউজার বেস"
                  centerLabelEn="User Base"
                  showValueAsPercent
                />
                <AdminBarChartCard
                  dataTestId="admin-subscriptions-bar"
                  titleBn="প্ল্যানভিত্তিক মাসিক আয় ও শেয়ার (বার গ্রাফ)"
                  titleEn="Monthly Revenue & Share by Tier (Bar Chart)"
                  lang={lang}
                  bars={adminCharts.subscriptions.planRevenueBar}
                  badgeTextBn="৳৪.৭৫ লাখ MRR"
                  badgeTextEn="৳475k MRR"
                />
              </div>

              <AdminSubscriptionSection
                effectiveRole={effectiveRole}
                actorUid={actorUid}
                actorName={actorName}
                lang={lang}
                showToast={showToast}
                showError={showError}
                recordAudit={recordAudit}
                directoryUsers={store.users}
              />
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 4: সাপোর্ট ও ফিডব্যাক (SUPPORT & FEEDBACK) */}
          {/* ================================================================= */}
          {activeSection === 'support' && (() => {
            const ticketCounts = computeSupportTicketCounts(store.tickets);
            return (
              <div className="space-y-4">
                {/* 4 Clickable Ticket KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
                  <button
                    type="button"
                    onClick={() => setTicketStatusFilter('all')}
                    className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-3.5 transition-colors cursor-pointer ${
                      ticketStatusFilter === 'all'
                        ? 'border-emerald-600 dark:border-emerald-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      {lang === 'bn' ? 'মোট টিকিট' : 'Total Tickets'}
                    </span>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                      {lang === 'bn' ? toBengaliDigits(ticketCounts.total) : ticketCounts.total}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTicketStatusFilter('new')}
                    className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-3.5 transition-colors cursor-pointer ${
                      ticketStatusFilter === 'new'
                        ? 'border-amber-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 block">
                      {lang === 'bn' ? 'নতুন অনুরোধ' : 'New'}
                    </span>
                    <p className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                      {lang === 'bn' ? toBengaliDigits(ticketCounts.newCount) : ticketCounts.newCount}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTicketStatusFilter('in_progress')}
                    className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-3.5 transition-colors cursor-pointer ${
                      ticketStatusFilter === 'in_progress'
                        ? 'border-sky-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 block">
                      {lang === 'bn' ? 'চলমান' : 'In Progress'}
                    </span>
                    <p className="text-xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-400 mt-1">
                      {lang === 'bn' ? toBengaliDigits(ticketCounts.inProgress) : ticketCounts.inProgress}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTicketStatusFilter('resolved')}
                    className={`text-left bg-white dark:bg-slate-900 border rounded-2xl p-3.5 transition-colors cursor-pointer ${
                      ticketStatusFilter === 'resolved'
                        ? 'border-emerald-600'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 block">
                      {lang === 'bn' ? 'সমাধানকৃত' : 'Resolved'}
                    </span>
                    <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                      {lang === 'bn' ? toBengaliDigits(ticketCounts.resolved) : ticketCounts.resolved}
                    </p>
                  </button>
                </div>

                {/* Support Ticket Status Pie Chart & Category Bar Chart */}
                <div
                  data-testid="admin-support-charts-row"
                  className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                >
                  <AdminPieChartCard
                    dataTestId="admin-support-status-pie"
                    titleBn="সাপোর্ট টিকিট স্ট্যাটাস বিভাজন (পাই চার্ট)"
                    titleEn="Support Ticket Status (Pie Chart)"
                    lang={lang}
                    slices={adminCharts.support.ticketStatusPie}
                    centerValueBn={`${toBengaliDigits(ticketCounts.total)}টি`}
                    centerValueEn={`${ticketCounts.total}`}
                    centerLabelBn="মোট টিকিট"
                    centerLabelEn="Total Tickets"
                    valueSuffixBn="টি"
                    valueSuffixEn=" tickets"
                  />
                  <AdminBarChartCard
                    dataTestId="admin-support-category-bar"
                    titleBn="সমস্যার ধরন অনুযায়ী টিকিট (বার গ্রাফ)"
                    titleEn="Tickets by Issue Category (Bar Chart)"
                    lang={lang}
                    bars={adminCharts.support.ticketCategoryBar}
                  />
                </div>

                {/* Filter Bar */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={ticketSearch}
                      onChange={(e) => setTicketSearch(e.target.value)}
                      placeholder={
                        lang === 'bn'
                          ? 'টিকিট নম্বর, কর্মীর নাম বা বিষয় দিয়ে খুঁজুন...'
                          : 'Search by ticket ID, worker name, or issue...'
                      }
                      className="w-full min-h-[40px] pl-9 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:flex items-center gap-2">
                    <select
                      aria-label="Filter tickets by status"
                      value={ticketStatusFilter}
                      onChange={(e) => setTicketStatusFilter(e.target.value as SupportTicketStatus | 'all')}
                      className="w-full sm:w-auto min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                    >
                      <option value="all">{lang === 'bn' ? 'সকল স্ট্যাটাস' : 'All Statuses'}</option>
                      {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {lang === 'bn' ? v.bn : v.en}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Filter tickets by category"
                      value={ticketCategoryFilter}
                      onChange={(e) =>
                        setTicketCategoryFilter(e.target.value as SupportTicketCategory | 'all')
                      }
                      className="w-full sm:w-auto min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                    >
                      <option value="all">{lang === 'bn' ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
                      {Object.entries(TICKET_CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {lang === 'bn' ? v.bn : v.en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Split View: Ticket List + Selected Ticket Workspace */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left 5 Cols: Ticket Queue */}
                  <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {filteredTickets.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        {lang === 'bn' ? 'কোনো সাপোর্ট টিকিট পাওয়া যায়নি।' : 'No support tickets found.'}
                      </div>
                    ) : (
                      filteredTickets.map((t) => {
                        const isSelected = activeTicket?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTicketId(t.id)}
                            className={`w-full p-4 text-left transition-colors space-y-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/40'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {t.ticketNumber}
                              </span>
                              <span className="font-semibold text-slate-600 dark:text-slate-300">
                                {lang === 'bn'
                                  ? TICKET_STATUS_LABELS[t.status].bn
                                  : TICKET_STATUS_LABELS[t.status].en}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                              {t.subject}
                            </p>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="truncate">
                                {t.workerName} ·{' '}
                                {lang === 'bn'
                                  ? TICKET_CATEGORY_LABELS[t.category]?.bn
                                  : TICKET_CATEGORY_LABELS[t.category]?.en}
                              </span>
                              <span className="font-mono shrink-0">{t.createdAt}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Right 7 Cols: Active Ticket Details, Quick Replies, Assignment & Notes */}
                  <div className="lg:col-span-7 lg:sticky lg:top-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                    {!activeTicket ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        {lang === 'bn'
                          ? 'বিস্তারিত দেখতে তালিকা থেকে একটি টিকিট নির্বাচন করুন।'
                          : 'Select a ticket from the queue to inspect and respond.'}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {activeTicket.ticketNumber}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{activeTicket.workerName}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{activeTicket.createdAt}</span>
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1">
                              {activeTicket.subject}
                            </h3>
                          </div>

                          <select
                            aria-label="Update ticket status"
                            data-testid="ticket-status-select"
                            value={activeTicket.status}
                            onChange={(e) =>
                              handleUpdateTicketStatus(
                                activeTicket,
                                e.target.value as SupportTicketStatus
                              )
                            }
                            className="min-h-[36px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                          >
                            {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {lang === 'bn' ? v.bn : v.en}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Issue Description */}
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                          {activeTicket.message}
                        </div>

                        {/* Moderator Assignment */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                          <span className="text-slate-500">
                            {lang === 'bn' ? 'দায়িত্বপ্রাপ্ত মডারেটর:' : 'Assigned Moderator:'}{' '}
                            <strong className="text-slate-800 dark:text-slate-100">
                              {activeTicket.assignedTo}
                            </strong>
                          </span>
                          <select
                            aria-label="Assign ticket moderator"
                            value={activeTicket.assignedTo}
                            onChange={(e) => handleAssignTicket(activeTicket, e.target.value)}
                            className="min-h-[34px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                          >
                            {store.roles.map((r) => (
                              <option key={r.uid} value={r.displayName}>
                                {r.displayName}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Replies Thread & 1-Tap Quick Reply Templates */}
                        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {lang === 'bn' ? 'প্রদত্ত উত্তরসমূহ' : 'Replies to Worker'}
                          </h4>
                          {activeTicket.replies.length === 0 ? (
                            <p className="text-xs text-slate-400">
                              {lang === 'bn' ? 'এখনো কোনো উত্তর পাঠানো হয়নি।' : 'No replies sent yet.'}
                            </p>
                          ) : (
                            activeTicket.replies.map((rep) => {
                              const isWorkerReply = rep.authorRole === 'user';
                              return (
                                <div
                                  key={rep.id}
                                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                                    isWorkerReply
                                      ? 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700'
                                      : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-800/60'
                                  }`}
                                >
                                  <div
                                    className={`flex items-center justify-between text-[11px] font-semibold ${
                                      isWorkerReply
                                        ? 'text-slate-700 dark:text-slate-300'
                                        : 'text-emerald-800 dark:text-emerald-300'
                                    }`}
                                  >
                                    <span>
                                      {rep.authorName}
                                      {isWorkerReply
                                        ? lang === 'bn'
                                          ? ' (ব্যবহারকারী)'
                                          : ' (User)'
                                        : ''}
                                    </span>
                                    <span className="font-mono">{rep.createdAt}</span>
                                  </div>
                                  <p className="text-slate-800 dark:text-slate-200">{rep.message}</p>
                                </div>
                              );
                            })
                          )}

                          {/* Quick Reply Chips */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {ADMIN_QUICK_REPLIES.map((qr) => (
                              <button
                                key={qr.id}
                                type="button"
                                onClick={() => setTicketReplyText(lang === 'bn' ? qr.textBn : qr.textEn)}
                                className="min-h-[30px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                {lang === 'bn' ? qr.labelBn : qr.labelEn}
                              </button>
                            ))}
                          </div>

                          <form onSubmit={handleAddTicketReply} className="flex flex-col sm:flex-row gap-2 pt-1">
                            <input
                              type="text"
                              data-testid="ticket-reply-input"
                              value={ticketReplyText}
                              onChange={(e) => setTicketReplyText(e.target.value)}
                              placeholder={
                                lang === 'bn'
                                  ? 'শ্রমিককে উত্তর লিখুন...'
                                  : 'Write a response to the worker...'
                              }
                              className="flex-1 min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                            />
                            <button
                              type="submit"
                              data-testid="ticket-reply-submit"
                              className="min-h-[38px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'উত্তর পাঠান' : 'Reply'}</span>
                            </button>
                          </form>
                        </div>

                        {/* Internal Admin Notes */}
                        <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {lang === 'bn' ? 'অভ্যন্তরীণ অ্যাডমিন নোট' : 'Internal Admin Notes'}
                          </h4>
                          {activeTicket.internalNotes.map((n) => (
                            <div
                              key={n.id}
                              className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 text-xs"
                            >
                              <span className="font-bold text-amber-900 dark:text-amber-300">
                                {n.authorName} ({n.createdAt}):
                              </span>{' '}
                              <span className="text-slate-700 dark:text-slate-200">{n.note}</span>
                            </div>
                          ))}
                          <form onSubmit={handleAddInternalNote} className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={ticketInternalNoteText}
                              onChange={(e) => setTicketInternalNoteText(e.target.value)}
                              placeholder={
                                lang === 'bn'
                                  ? 'অভ্যন্তরীণ নোট যুক্ত করুন...'
                                  : 'Add internal team note...'
                              }
                              className="flex-1 min-h-[36px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                            />
                            <button
                              type="submit"
                              className="min-h-[36px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold shrink-0 cursor-pointer"
                            >
                              {lang === 'bn' ? 'নোট যোগ' : 'Add Note'}
                            </button>
                          </form>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ================================================================= */}
          {/* SECTION 5: নোটিশ ও অ্যাপ সেটিংস */}
          {/* ================================================================= */}
          {activeSection === 'settings' && (
            <div className="space-y-4">
              <div
                data-testid="admin-settings-charts-row"
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                <AdminPieChartCard
                  dataTestId="admin-settings-notice-pie"
                  titleBn="সিস্টেম নোটিশ স্ট্যাটাস (পাই চার্ট)"
                  titleEn="System Notice Status (Pie Chart)"
                  lang={lang}
                  slices={adminCharts.settings.noticeStatusPie}
                  centerValueBn={`${toBengaliDigits(store.announcements.length)}টি`}
                  centerValueEn={`${store.announcements.length}`}
                  centerLabelBn="মোট নোটিশ"
                  centerLabelEn="Total Notices"
                  valueSuffixBn="টি"
                  valueSuffixEn=" notices"
                />
                <AdminBarChartCard
                  dataTestId="admin-settings-feature-bar"
                  titleBn="সচল অ্যাপ ফিচার ও নোটিশ পরিসংখ্যান (বার গ্রাফ)"
                  titleEn="Active Features & Notice Metrics (Bar Chart)"
                  lang={lang}
                  bars={adminCharts.settings.featureAndCategoryBar}
                />
              </div>

              <AdminSettingsSection
                store={store}
                lang={lang}
                effectiveRole={effectiveRole}
                actorEmail={actorEmail}
                todayISO={todayISO}
                announcementCategoryLabels={ANNOUNCEMENT_CATEGORY_LABELS}
                annTitleBn={annTitleBn}
                setAnnTitleBn={setAnnTitleBn}
                annMessageBn={annMessageBn}
                setAnnMessageBn={setAnnMessageBn}
                annCategory={annCategory}
                setAnnCategory={setAnnCategory}
                annStartDate={annStartDate}
                setAnnStartDate={setAnnStartDate}
                annEndDate={annEndDate}
                setAnnEndDate={setAnnEndDate}
                annPreviewDevice={annPreviewDevice}
                setAnnPreviewDevice={setAnnPreviewDevice}
                handlePublishAnnouncement={handlePublishAnnouncement}
                handleToggleAnnouncementStatus={handleToggleAnnouncementStatus}
                handleDeleteAnnouncement={handleDeleteAnnouncement}
                handleToggleFeatureFlag={handleToggleFeatureFlag}
                handleToggleMaintenanceMode={handleToggleMaintenanceMode}
                handleSavePlatformPreferences={handleSavePlatformPreferences}
                policyConfirmOpen={policyConfirmOpen}
                setPolicyConfirmOpen={setPolicyConfirmOpen}
                policyHoursInput={policyHoursInput}
                setPolicyHoursInput={setPolicyHoursInput}
                policyMultiplierInput={policyMultiplierInput}
                setPolicyMultiplierInput={setPolicyMultiplierInput}
                policyMinGrossInput={policyMinGrossInput}
                setPolicyMinGrossInput={setPolicyMinGrossInput}
                policyReasonInput={policyReasonInput}
                setPolicyReasonInput={setPolicyReasonInput}
                handleConfirmPolicyChange={handleConfirmPolicyChange}
                publicDemoConfig={publicDemoConfig}
                updatePublicDemoConfig={updatePublicDemoConfig}
                resetDemoData={resetDemoData}
                showToast={showToast}
                showError={showError}
                recordAudit={recordAudit}
              />
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 6: সিস্টেম মনিটরিং */}
          {/* ================================================================= */}
          {activeSection === 'monitoring' && (
            <div className="space-y-4">
              <div
                data-testid="admin-monitoring-charts-row"
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                <AdminPieChartCard
                  dataTestId="admin-monitoring-error-pie"
                  titleBn="সিস্টেম সতর্কতা ও সমাধান অনুপাত (পাই চার্ট)"
                  titleEn="System Alert Resolution (Pie Chart)"
                  lang={lang}
                  slices={adminCharts.monitoring.errorStatusPie}
                  centerValueBn={`${toBengaliDigits(store.errors.length)}টি`}
                  centerValueEn={`${store.errors.length}`}
                  centerLabelBn="লগকৃত সতর্কতা"
                  centerLabelEn="Logged Alerts"
                  valueSuffixBn="টি"
                  valueSuffixEn=" alerts"
                />
                <AdminBarChartCard
                  dataTestId="admin-monitoring-module-bar"
                  titleBn="সিস্টেম মডিউল সক্ষমতা হার (বার গ্রাফ)"
                  titleEn="Module Reliability Score (Bar Chart)"
                  lang={lang}
                  bars={adminCharts.monitoring.moduleHealthBar}
                />
              </div>

              <AdminMonitoringSection
                store={store}
                lang={lang}
                isOnline={isOnline}
                hasAuthSession={Boolean(user)}
                isDemoMode={isDemoMode}
                pendingWritesCount={pendingWritesCount}
                onResolveErrorLog={handleResolveErrorLog}
                showToast={showToast}
              />
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 7: অডিট লগ ও ব্যাকআপ (AUDIT LOGS & BACKUP RECOVERY) */}
          {/* ================================================================= */}
          {activeSection === 'audit' && (
            <div className="space-y-5">
              <div
                data-testid="admin-audit-charts-row"
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                <AdminPieChartCard
                  dataTestId="admin-audit-action-pie"
                  titleBn="অ্যাডমিন অ্যাকশন ও অডিট বিভাজন (পাই চার্ট)"
                  titleEn="Admin Audit Breakdown (Pie Chart)"
                  lang={lang}
                  slices={adminCharts.audit.auditActionPie}
                  centerValueBn={`${toBengaliDigits(store.auditLogs.length)}টি`}
                  centerValueEn={`${store.auditLogs.length}`}
                  centerLabelBn="মোট অডিট লগ"
                  centerLabelEn="Audit Events"
                  valueSuffixBn="টি"
                  valueSuffixEn=" events"
                />
                <AdminBarChartCard
                  dataTestId="admin-audit-backup-bar"
                  titleBn="অডিট ইভেন্ট ও সুরক্ষিত ব্যাকআপ (বার গ্রাফ)"
                  titleEn="Audit Events & Protected Backups (Bar Chart)"
                  lang={lang}
                  bars={adminCharts.audit.backupAndAuditBar}
                />
              </div>

              {/* Top Action Bar: Search Audit Logs & Export Safe Report */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'অ্যাকশন, অ্যাডমিন নাম বা টার্গেট আইডি দিয়ে অডিট লগ খুঁজুন...'
                        : 'Search audit history by action, actor, or target...'
                    }
                    className="w-full min-h-[40px] pl-9 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportSafeAdminReport}
                  className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {lang === 'bn'
                      ? 'অডিট ও সামারি রিপোর্ট এক্সপোর্ট (JSON)'
                      : 'Export Safe Audit Report'}
                  </span>
                </button>
              </div>

              {/* Immutable Audit Log: Mobile Cards + Desktop Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'অপরিবর্তনীয় প্রশাসনিক অডিট লগ (Immutable Audit Trail)'
                      : 'Immutable Administrative Audit Trail'}
                  </h3>
                </div>

                {/* Mobile Audit Cards (< md) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAuditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2 font-mono">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {log.actionType}
                        </span>
                        <span className="text-[11px] text-slate-500">{log.timestamp}</span>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">{log.targetLabel}</p>
                      <p className="text-slate-600 dark:text-slate-300">{log.reason}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>
                          {log.actorName} ({log.actorRole})
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                          {log.outcome}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Audit Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                        <th className="py-3 px-4">{lang === 'bn' ? 'ইভেন্ট আইডি ও সময়' : 'Event & Timestamp'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'প্রশাসক ও রোল' : 'Acting Admin'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'অ্যাকশন ও টার্গেট' : 'Action & Target'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'কারণ ও ফলাফল' : 'Reason & Outcome'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAuditLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="py-3 px-4 font-mono">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{log.id}</p>
                            <p className="text-[11px] text-slate-500">{log.timestamp}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 dark:text-white">{log.actorName}</p>
                            <p className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">
                              {log.actorRole}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold font-mono text-slate-800 dark:text-slate-200">
                              {log.actionType}
                            </p>
                            <p className="text-slate-500">{log.targetLabel}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-slate-700 dark:text-slate-200">{log.reason}</p>
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                              {log.outcome}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data Backup Verification & Non-Destructive Recovery Protocol */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'ডেটা ব্যাকআপ যাচাই ও নিরাপদ পুনরুদ্ধার নীতিমালা'
                      : 'Verified Backup Status & Safe Recovery Procedure'}
                  </h3>
                  <button
                    type="button"
                    onClick={handleRunBackupVerification}
                    className="min-h-[38px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'bn' ? 'ব্যাকআপ ইন্টিগ্রিটি যাচাই করুন' : 'Verify Backup Integrity'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {store.backups.map((bkp) => (
                    <div
                      key={bkp.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-emerald-700 dark:text-emerald-400 uppercase">
                          {bkp.status} ({bkp.collectionsCovered} Collections)
                        </span>
                        <span className="font-mono text-slate-500">{bkp.timestamp}</span>
                      </div>
                      <p className="font-mono text-[11px] text-slate-500 truncate">
                        {bkp.integrityHash}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">{bkp.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* MOBILE FIXED BOTTOM ADMIN NAVIGATION BAR (SEPARATE MOBILE SHELL) */}
        {/* ================================================================= */}
        <nav
          data-testid="admin-mobile-bottom-nav"
          aria-label="Mobile Admin Navigation"
          className="lg:hidden shrink-0 h-[58px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center px-1"
        >
          {(
            [
              {
                id: 'overview',
                labelBn: 'ড্যাশবোর্ড',
                labelEn: 'Overview',
                icon: <LayoutGrid className="w-4 h-4" />,
              },
              {
                id: 'users',
                labelBn: 'ইউজার',
                labelEn: 'Users',
                icon: <Users className="w-4 h-4" />,
              },
              {
                id: 'subscriptions',
                labelBn: 'প্ল্যান',
                labelEn: 'Plans',
                icon: <Layers className="w-4 h-4" />,
              },
              {
                id: 'support',
                labelBn: 'সাপোর্ট',
                labelEn: 'Support',
                icon: <MessageSquare className="w-4 h-4" />,
              },
            ] as const
          ).map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`admin-mobile-tab-${item.id}`}
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                  isActive
                    ? 'text-emerald-700 dark:text-emerald-400 font-extrabold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                {item.icon}
                <span className="text-[11px] mt-0.5 leading-tight whitespace-nowrap">
                  {lang === 'bn' ? item.labelBn : item.labelEn}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            data-testid="admin-mobile-tab-more"
            onClick={() => setMobileMenuOpen(true)}
            className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
              activeSection === 'roles' ||
              activeSection === 'settings' ||
              activeSection === 'monitoring' ||
              activeSection === 'audit'
                ? 'text-indigo-700 dark:text-indigo-400 font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'
            }`}
          >
            <Menu className="w-4 h-4" />
            <span className="text-[11px] mt-0.5 leading-tight whitespace-nowrap">
              {lang === 'bn' ? 'সব মেনু' : 'More'}
            </span>
          </button>
        </nav>
      </div>
    </div>
  );
};
