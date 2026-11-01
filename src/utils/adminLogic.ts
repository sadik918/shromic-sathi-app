import type { SupportFeedback, WorkerProfile } from '../types';

export type AdminRole = 'super_admin' | 'admin' | 'support_moderator';

export type AdminSectionId =
  | 'overview'
  | 'users'
  | 'roles'
  | 'subscriptions'
  | 'support'
  | 'settings'
  | 'monitoring'
  | 'audit';

export type AdminPermissionKey =
  | 'view_dashboard'
  | 'manage_users'
  | 'suspend_users'
  | 'manage_roles'
  | 'manage_subscriptions'
  | 'manage_tickets'
  | 'assign_tickets'
  | 'publish_announcements'
  | 'manage_app_settings'
  | 'update_calculation_policy'
  | 'view_system_monitoring'
  | 'resolve_system_errors'
  | 'view_audit_logs'
  | 'manage_backups'
  | 'export_admin_reports';

export interface AdminMenuSectionMeta {
  id: AdminSectionId;
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  subtitleEn: string;
}

export const ADMIN_MENU_SECTIONS: AdminMenuSectionMeta[] = [
  {
    id: 'overview',
    titleBn: 'ড্যাশবোর্ড ও অ্যানালিটিক্স',
    titleEn: 'Dashboard & Analytics',
    subtitleBn: 'মোট ইউজার, নতুন রেজিস্ট্রেশন, সিস্টেম স্ট্যাটাস',
    subtitleEn: 'Total users, new registrations, system status',
  },
  {
    id: 'users',
    titleBn: 'ইউজার ম্যানেজমেন্ট',
    titleEn: 'User Management',
    subtitleBn: 'অ্যাকাউন্ট স্ট্যাটাস, সার্চ, সাসপেন্ড ও রিঅ্যাক্টিভেট',
    subtitleEn: 'Account status, search, suspend & reactivate',
  },
  {
    id: 'roles',
    titleBn: 'অ্যাডমিন রোল ও পারমিশন',
    titleEn: 'Admin Roles & Permissions',
    subtitleBn: 'Super Admin, Admin, Support Moderator',
    subtitleEn: 'Super Admin, Admin, Support Moderator',
  },
  {
    id: 'subscriptions',
    titleBn: 'সাবস্ক্রিপশন ও প্ল্যান',
    titleEn: 'Subscriptions & Plans',
    subtitleBn: 'প্ল্যান নির্ধারণ, ফিচার ম্যাট্রিক্স, ইউজার অ্যাসাইন ও পেমেন্ট রিকোয়েস্ট',
    subtitleEn: 'Plan tiers, feature matrix, user assignment & payment requests',
  },
  {
    id: 'support',
    titleBn: 'সাপোর্ট ও ফিডব্যাক',
    titleEn: 'Support & Feedback',
    subtitleBn: 'সাপোর্ট টিকিট, অভিযোগ, বাগ রিপোর্ট, ফিচার রিকোয়েস্ট',
    subtitleEn: 'Support tickets, complaints, bug reports, feature requests',
  },
  {
    id: 'settings',
    titleBn: 'নোটিশ ও অ্যাপ সেটিংস',
    titleEn: 'Notices & App Settings',
    subtitleBn: 'ঘোষণা, FAQ, হেল্প সেন্টার, মেইনটেন্যান্স নোটিশ',
    subtitleEn: 'Announcements, FAQ, help center, maintenance notices',
  },
  {
    id: 'monitoring',
    titleBn: 'সিস্টেম মনিটরিং',
    titleEn: 'System Monitoring',
    subtitleBn: 'এরর লগ, অফলাইন সিঙ্ক সমস্যা, সার্ভিস স্ট্যাটাস',
    subtitleEn: 'Error logs, offline sync issues, service status',
  },
  {
    id: 'audit',
    titleBn: 'অডিট লগ ও ব্যাকআপ',
    titleEn: 'Audit Log & Backup',
    subtitleBn: 'অ্যাডমিন কার্যক্রমের ইতিহাস ও ডেটা পুনরুদ্ধার',
    subtitleEn: 'Admin activity history & data recovery safeguards',
  },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, AdminPermissionKey[]> = {
  super_admin: [
    'view_dashboard',
    'manage_users',
    'suspend_users',
    'manage_roles',
    'manage_subscriptions',
    'manage_tickets',
    'assign_tickets',
    'publish_announcements',
    'manage_app_settings',
    'update_calculation_policy',
    'view_system_monitoring',
    'resolve_system_errors',
    'view_audit_logs',
    'manage_backups',
    'export_admin_reports',
  ],
  admin: [
    'view_dashboard',
    'manage_users',
    'suspend_users',
    'manage_subscriptions',
    'manage_tickets',
    'assign_tickets',
    'publish_announcements',
    'view_system_monitoring',
    'resolve_system_errors',
    'view_audit_logs',
    'export_admin_reports',
  ],
  support_moderator: [
    'view_dashboard',
    'manage_tickets',
  ],
};

export interface AdminUserDirectoryEntry {
  uid: string;
  displayName: string;
  email: string;
  accountStatus: 'active' | 'suspended';
  emailVerified: boolean;
  registeredAt: string; // YYYY-MM-DD
  lastSeenDate: string; // YYYY-MM-DD
  authProvider: 'google.com' | 'password';
  language: 'bn' | 'en';
  offlineSyncState: 'synced' | 'pending' | 'error';
  appVersion: string;
  suspensionReason?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  statusHistory: Array<{
    status: 'active' | 'suspended';
    reason: string;
    changedBy: string;
    changedAt: string;
  }>;
}

export interface AdminRoleAssignment {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: AdminPermissionKey[];
  assignedBy: string;
  assignedAt: string;
  isPrimarySuperAdmin?: boolean;
  status: 'active' | 'revoked';
}

export type SupportTicketStatus =
  | 'new'
  | 'in_progress'
  | 'waiting_for_user'
  | 'resolved'
  | 'closed';

export type SupportTicketCategory =
  | 'login_registration'
  | 'account_recovery'
  | 'salary_calculation'
  | 'overtime_attendance'
  | 'loan_debt'
  | 'garment_info'
  | 'contact_book'
  | 'offline_sync'
  | 'bug_report'
  | 'feature_request'
  | 'other';

export interface SupportTicketRecord {
  id: string;
  ticketNumber: string;
  userId: string;
  workerName: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  subject: string;
  message: string;
  assignedTo: string;
  internalNotes: Array<{
    id: string;
    authorName: string;
    note: string;
    createdAt: string;
  }>;
  replies: Array<{
    id: string;
    authorName: string;
    message: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export type AnnouncementCategory =
  | 'general'
  | 'maintenance'
  | 'new_feature'
  | 'security'
  | 'important_update';

export interface PlatformAnnouncement {
  id: string;
  titleBn: string;
  titleEn: string;
  messageBn: string;
  messageEn: string;
  category: AnnouncementCategory;
  status: 'draft' | 'published' | 'archived';
  audience: 'all' | 'verified_workers';
  startDate: string;
  endDate: string;
  publishedBy: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalculationPolicyVersion {
  version: string;
  effectiveFrom: string;
  standardMonthlyHours: number;
  overtimeMultiplier: number;
  defaultWageBase: 'basic' | 'gross';
  minimumGrossWageGrade4: number;
  updatedBy: string;
  updatedAt: string;
  changeReason: string;
}

export interface FaqEntry {
  id: string;
  questionBn: string;
  questionEn: string;
  answerBn: string;
  answerEn: string;
  category: string;
}

export interface PlatformConfig {
  appNameBn: string;
  appNameEn: string;
  supportEmail: string;
  supportPhone: string;
  supportHoursBn: string;
  defaultLanguage: 'bn' | 'en';
  maintenanceMode: boolean;
  maintenanceMessageBn: string;
  maintenanceMessageEn: string;
  featureFlags: {
    voiceEntry: boolean;
    googleContactsSync: boolean;
    pdfPayslipExport: boolean;
    personalLoanTracker: boolean;
    offlineSyncBanner: boolean;
  };
  currentCalculationPolicy: CalculationPolicyVersion;
  calculationPolicyHistory: CalculationPolicyVersion[];
  faqs: FaqEntry[];
  termsSummaryBn: string;
  privacySummaryBn: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SystemErrorLog {
  id: string;
  timestamp: string;
  category: 'auth' | 'firestore_sync' | 'offline_queue' | 'pwa_storage' | 'ui_runtime';
  severity: 'warning' | 'error' | 'critical';
  errorCode: string;
  sanitizedMessage: string;
  affectedModule: string;
  resolutionStatus: 'unresolved' | 'investigating' | 'resolved';
  resolvedBy?: string;
  resolvedAt?: string;
  retryAvailable: boolean;
}

export type AuditActionType =
  | 'admin_login'
  | 'user_suspended'
  | 'user_reactivated'
  | 'account_recovery_triggered'
  | 'role_updated'
  | 'announcement_published'
  | 'announcement_archived'
  | 'config_updated'
  | 'policy_updated'
  | 'ticket_assigned'
  | 'ticket_status_updated'
  | 'error_resolved'
  | 'backup_verified';

export interface AdminAuditLog {
  id: string;
  timestamp: string;
  actorUid: string;
  actorName: string;
  actorRole: AdminRole;
  actionType: AuditActionType;
  targetId: string;
  targetLabel: string;
  outcome: 'success' | 'denied' | 'failed';
  reason: string;
  metadata: Record<string, string | number | boolean>;
}

export interface PlatformBackupRecord {
  id: string;
  timestamp: string;
  initiatedBy: string;
  type: 'automated_snapshot' | 'manual_verification';
  status: 'verified' | 'failed';
  collectionsCovered: number;
  integrityHash: string;
  notes: string;
}

export const PRIMARY_SUPER_ADMIN_EMAIL = 'sadikulislam45974@gmail.com';

const SENSITIVE_FIELD_BLOCKLIST = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'basicSalary',
  'grossSalary',
  'houseRentAllowance',
  'medicalAllowance',
  'transportAllowance',
  'foodAllowance',
  'attendanceBonus',
  'otCustomHourlyRate',
  'fileData',
  'totalLoanAmount',
  'paidAmount',
]);

/**
 * Checks whether a given admin role (and optional custom permission set) is authorized for an action.
 */
export function canAdminPerform(
  role: AdminRole | null | undefined,
  permission: AdminPermissionKey,
  customPermissions?: AdminPermissionKey[]
): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;
  const activePerms = customPermissions || ROLE_DEFAULT_PERMISSIONS[role] || [];
  return activePerms.includes(permission);
}

/**
 * Enforces strict server-grade RBAC rules on role changes:
 * - Only super_admin can modify roles.
 * - Cannot demote or revoke the primary bootstrapped Super Admin.
 * - Admin or Support Moderator cannot promote themselves or others.
 */
export function validateRoleChange(params: {
  actorRole: AdminRole | null;
  actorEmail: string;
  targetEmail: string;
  newRole: AdminRole;
}): { valid: boolean; errorBn?: string; errorEn?: string } {
  const { actorRole, targetEmail, newRole } = params;
  if (actorRole !== 'super_admin') {
    return {
      valid: false,
      errorBn: 'শুধুমাত্র সুপার অ্যাডমিন রোল ও পারমিশন পরিবর্তন করতে পারবেন।',
      errorEn: 'Only a Super Admin can modify administrator roles and permissions.',
    };
  }
  if (
    targetEmail.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() &&
    newRole !== 'super_admin'
  ) {
    return {
      valid: false,
      errorBn: 'প্রাথমিক সুপার অ্যাডমিনের রোল পরিবর্তন বা বাতিল করা যাবে না।',
      errorEn: 'The primary bootstrapped Super Admin role cannot be downgraded.',
    };
  }
  return { valid: true };
}

/**
 * Privacy Guard: Converts a WorkerProfile or raw user object into a strictly non-financial
 * AdminUserDirectoryEntry. Never exposes salary, overtime, expenses, loans, contacts, or vault files.
 */
export function sanitizeUserForAdminDirectory(
  raw: Partial<WorkerProfile> & {
    uid?: string;
    email?: string;
    emailVerified?: boolean;
    accountStatus?: 'active' | 'suspended';
    registeredAt?: string;
    lastSeenDate?: string;
    suspensionReason?: string;
  }
): AdminUserDirectoryEntry {
  const uid = raw.userId || raw.uid || 'unknown_uid';
  const registeredAt = raw.registeredAt || raw.effectiveFrom || '2026-01-15';
  return {
    uid,
    displayName: (raw.fullName || 'শ্রমিক ব্যবহারকারী').slice(0, 120),
    email: raw.email || `${uid.slice(0, 10)}@worker.shromiksathi.app`,
    accountStatus: raw.accountStatus || 'active',
    emailVerified: Boolean(raw.emailVerified ?? true),
    registeredAt,
    lastSeenDate: raw.lastSeenDate || '2026-10-28',
    authProvider: raw.email?.includes('gmail.com') ? 'google.com' : 'password',
    language: raw.language === 'en' ? 'en' : 'bn',
    offlineSyncState: 'synced',
    appVersion: 'v2.4.0-pwa',
    suspensionReason: raw.suspensionReason,
    statusHistory: [
      {
        status: raw.accountStatus || 'active',
        reason: raw.suspensionReason || 'Initial account registration',
        changedBy: 'System',
        changedAt: registeredAt,
      },
    ],
  };
}

/**
 * Strips any sensitive keys from audit log metadata so passwords, tokens, or financial figures
 * are never recorded in administrative history.
 */
export function sanitizeAuditMetadata(
  meta: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!SENSITIVE_FIELD_BLOCKLIST.has(k) && !/password|token|secret|salary|loan/i.test(k)) {
      clean[k] = typeof v === 'string' ? v.slice(0, 200) : v;
    }
  }
  return clean;
}

export interface AdminOverviewMetrics {
  totalRegisteredUsers: number;
  newRegistrationsToday: number;
  newRegistrationsThisMonth: number;
  activeAccounts: number;
  suspendedAccounts: number;
  pendingSupportTickets: number;
  unresolvedTechnicalIssues: number;
  announcementsPublished: number;
}

export function computeAdminOverviewMetrics(params: {
  users: AdminUserDirectoryEntry[];
  tickets: SupportTicketRecord[];
  errors: SystemErrorLog[];
  announcements: PlatformAnnouncement[];
  todayISO: string;
}): AdminOverviewMetrics {
  const { users, tickets, errors, announcements, todayISO } = params;
  const currentMonth = todayISO.slice(0, 7);

  const totalRegisteredUsers = users.length;
  const newRegistrationsToday = users.filter((u) => u.registeredAt === todayISO).length;
  const newRegistrationsThisMonth = users.filter((u) =>
    u.registeredAt.startsWith(currentMonth)
  ).length;
  const activeAccounts = users.filter((u) => u.accountStatus === 'active').length;
  const suspendedAccounts = users.filter((u) => u.accountStatus === 'suspended').length;
  const pendingSupportTickets = tickets.filter(
    (t) => t.status === 'new' || t.status === 'in_progress' || t.status === 'waiting_for_user'
  ).length;
  const unresolvedTechnicalIssues = errors.filter(
    (e) => e.resolutionStatus !== 'resolved'
  ).length;
  const announcementsPublished = announcements.filter(
    (a) => a.status === 'published'
  ).length;

  return {
    totalRegisteredUsers,
    newRegistrationsToday,
    newRegistrationsThisMonth,
    activeAccounts,
    suspendedAccounts,
    pendingSupportTickets,
    unresolvedTechnicalIssues,
    announcementsPublished,
  };
}

export function filterAndPaginateUsers(params: {
  users: AdminUserDirectoryEntry[];
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'suspended';
  monthFilter: string; // 'all' or YYYY-MM
  page: number;
  pageSize: number;
}): {
  items: AdminUserDirectoryEntry[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
} {
  const { users, searchQuery, statusFilter, monthFilter, page, pageSize } = params;
  const q = searchQuery.trim().toLowerCase();

  const filtered = users.filter((u) => {
    if (statusFilter !== 'all' && u.accountStatus !== statusFilter) return false;
    if (monthFilter !== 'all' && !u.registeredAt.startsWith(monthFilter)) return false;
    if (q) {
      const matchName = u.displayName.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchUid = u.uid.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchUid) return false;
    }
    return true;
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return { items, totalItems, totalPages, currentPage };
}

/**
 * Converts legacy SupportFeedback items into structured SupportTicketRecords without losing data.
 */
export function mapLegacyFeedbackToTickets(feedbackList: SupportFeedback[]): SupportTicketRecord[] {
  return feedbackList.map((fb, idx) => {
    const categoryMap: Record<string, SupportTicketCategory> = {
      calculation_help: 'salary_calculation',
      bug_report: 'bug_report',
      feature_request: 'feature_request',
      general: 'other',
    };
    const createdStr =
      typeof fb.createdAt === 'string'
        ? fb.createdAt.slice(0, 10)
        : '2026-10-25';
    return {
      id: fb.id,
      ticketNumber: `TKT-${String(1001 + idx)}`,
      userId: fb.userId,
      workerName: fb.workerName || 'শ্রমিক ব্যবহারকারী',
      category: categoryMap[fb.category] || 'other',
      status: fb.status === 'resolved' ? 'resolved' : 'new',
      subject:
        fb.category === 'calculation_help'
          ? 'বেতন ও ওভারটাইম হিসাব সংক্রান্ত প্রশ্ন'
          : fb.category === 'bug_report'
          ? 'অ্যাপ কারিগরি সমস্যা রিপোর্ট'
          : fb.category === 'feature_request'
          ? 'নতুন ফিচার যুক্ত করার অনুরোধ'
          : 'সাধারণ সহায়তা অনুরোধ',
      message: fb.message,
      assignedTo: 'Support Team',
      internalNotes: [],
      replies: [],
      createdAt: createdStr,
      updatedAt: createdStr,
      resolvedAt: fb.status === 'resolved' ? createdStr : undefined,
    };
  });
}

export interface AdminStoreState {
  users: AdminUserDirectoryEntry[];
  roles: AdminRoleAssignment[];
  tickets: SupportTicketRecord[];
  announcements: PlatformAnnouncement[];
  config: PlatformConfig;
  errors: SystemErrorLog[];
  auditLogs: AdminAuditLog[];
  backups: PlatformBackupRecord[];
}

const ADMIN_STORAGE_KEY = 'shromik_sathi_admin_store_v1';

export function buildDefaultAdminStore(todayISO = '2026-10-28'): AdminStoreState {
  const currentMonth = todayISO.slice(0, 7);
  return {
    users: [
      {
        uid: 'usr_rmg_1042_rahima',
        displayName: 'রহিমা আক্তার (Rahima Akter)',
        email: 'rahima.rmg1042@gmail.com',
        accountStatus: 'active',
        emailVerified: true,
        registeredAt: todayISO,
        lastSeenDate: todayISO,
        authProvider: 'google.com',
        language: 'bn',
        offlineSyncState: 'synced',
        appVersion: 'v2.4.0-pwa',
        statusHistory: [
          {
            status: 'active',
            reason: 'Initial Google OAuth Registration',
            changedBy: 'System',
            changedAt: todayISO,
          },
        ],
      },
      {
        uid: 'usr_rmg_2084_kamrul',
        displayName: 'কামরুল হাসান (Kamrul Hasan)',
        email: 'kamrul.sewing@gmail.com',
        accountStatus: 'active',
        emailVerified: true,
        registeredAt: `${currentMonth}-14`,
        lastSeenDate: todayISO,
        authProvider: 'google.com',
        language: 'bn',
        offlineSyncState: 'synced',
        appVersion: 'v2.4.0-pwa',
        statusHistory: [
          {
            status: 'active',
            reason: 'Initial Registration',
            changedBy: 'System',
            changedAt: `${currentMonth}-14`,
          },
        ],
      },
      {
        uid: 'usr_rmg_3119_nasrin',
        displayName: 'নাসরিন সুলতানা (Nasrin Sultana)',
        email: 'nasrin.quality@worker.bd',
        accountStatus: 'active',
        emailVerified: true,
        registeredAt: `${currentMonth}-06`,
        lastSeenDate: `${currentMonth}-27`,
        authProvider: 'password',
        language: 'bn',
        offlineSyncState: 'pending',
        appVersion: 'v2.4.0-pwa',
        statusHistory: [
          {
            status: 'active',
            reason: 'Initial Registration',
            changedBy: 'System',
            changedAt: `${currentMonth}-06`,
          },
        ],
      },
      {
        uid: 'usr_rmg_4092_mamun',
        displayName: 'মামুনুর রশিদ (Mamunur Rashid)',
        email: 'mamun.finishing@gmail.com',
        accountStatus: 'active',
        emailVerified: true,
        registeredAt: '2026-09-19',
        lastSeenDate: `${currentMonth}-26`,
        authProvider: 'google.com',
        language: 'bn',
        offlineSyncState: 'synced',
        appVersion: 'v2.3.8-pwa',
        statusHistory: [
          {
            status: 'active',
            reason: 'Initial Registration',
            changedBy: 'System',
            changedAt: '2026-09-19',
          },
        ],
      },
      {
        uid: 'usr_rmg_5018_sumaiya',
        displayName: 'সুমাইয়া খাতুন (Sumaiya Khatun)',
        email: 'sumaiya.operator@gmail.com',
        accountStatus: 'active',
        emailVerified: true,
        registeredAt: '2026-09-04',
        lastSeenDate: todayISO,
        authProvider: 'google.com',
        language: 'en',
        offlineSyncState: 'synced',
        appVersion: 'v2.4.0-pwa',
        statusHistory: [
          {
            status: 'active',
            reason: 'Initial Registration',
            changedBy: 'System',
            changedAt: '2026-09-04',
          },
        ],
      },
      {
        uid: 'usr_rmg_6890_spam_bot',
        displayName: 'অযাচিত টেস্ট অ্যাকাউন্ট (Automated Bot)',
        email: 'bulk.scraper99@tempmail.org',
        accountStatus: 'suspended',
        emailVerified: false,
        registeredAt: '2026-08-22',
        lastSeenDate: '2026-09-01',
        authProvider: 'password',
        language: 'en',
        offlineSyncState: 'error',
        appVersion: 'v2.2.0-pwa',
        suspensionReason: ' অস্বাভাবিক স্বয়ংক্রিয় স্প্যাম টিকিট সাবমিশন (Automated spam abuse)',
        suspendedAt: '2026-09-02',
        suspendedBy: PRIMARY_SUPER_ADMIN_EMAIL,
        statusHistory: [
          {
            status: 'active',
            reason: 'Initial Registration',
            changedBy: 'System',
            changedAt: '2026-08-22',
          },
          {
            status: 'suspended',
            reason: 'অস্বাভাবিক স্বয়ংক্রিয় স্প্যাম টিকিট সাবমিশন (Automated spam abuse)',
            changedBy: PRIMARY_SUPER_ADMIN_EMAIL,
            changedAt: '2026-09-02',
          },
        ],
      },
    ],
    roles: [
      {
        uid: 'admin_super_01',
        email: PRIMARY_SUPER_ADMIN_EMAIL,
        displayName: 'সাদিকুল ইসলাম (Super Admin)',
        role: 'super_admin',
        permissions: ROLE_DEFAULT_PERMISSIONS.super_admin,
        assignedBy: 'System Bootstrap',
        assignedAt: '2026-01-01',
        isPrimarySuperAdmin: true,
        status: 'active',
      },
      {
        uid: 'admin_ops_02',
        email: 'ops.admin@shromiksathi.org',
        displayName: 'তানভীর আহমেদ (Operations Admin)',
        role: 'admin',
        permissions: ROLE_DEFAULT_PERMISSIONS.admin,
        assignedBy: PRIMARY_SUPER_ADMIN_EMAIL,
        assignedAt: '2026-06-15',
        status: 'active',
      },
      {
        uid: 'admin_mod_03',
        email: 'support.desk@shromiksathi.org',
        displayName: 'ফারজানা ইয়াসমিন (Support Moderator)',
        role: 'support_moderator',
        permissions: ROLE_DEFAULT_PERMISSIONS.support_moderator,
        assignedBy: PRIMARY_SUPER_ADMIN_EMAIL,
        assignedAt: '2026-08-10',
        status: 'active',
      },
    ],
    tickets: [
      {
        id: 'tkt_1001',
        ticketNumber: 'TKT-1001',
        userId: 'usr_rmg_3119_nasrin',
        workerName: 'নাসরিন সুলতানা',
        category: 'offline_sync',
        status: 'new',
        subject: 'অফলাইন মোডে এন্ট্রি দেওয়ার পর ইন্টারনেট আসলে সিঙ্ক হতে দেরি হচ্ছে',
        message: 'কারখানার ভেতরে নেটওয়ার্ক থাকে না। বাসায় ফিরে ওয়াইফাই চালু করলে ২-৩ মিনিট পর সবুজ টিক আসে। এটা কি স্বাভাবিক?',
        assignedTo: 'ফারজানা ইয়াসমিন (Support Moderator)',
        internalNotes: [
          {
            id: 'note_1',
            authorName: 'ফারজানা ইয়াসমিন',
            note: 'Firestore IndexedDB persistence queue চেক করা হয়েছে, নেটওয়ার্ক রিকানেক্ট রিট্রাই স্বাভাবিক আছে।',
            createdAt: `${currentMonth}-27 14:20`,
          },
        ],
        replies: [],
        createdAt: `${currentMonth}-27`,
        updatedAt: `${currentMonth}-27`,
      },
      {
        id: 'tkt_1002',
        ticketNumber: 'TKT-1002',
        userId: 'usr_rmg_2084_kamrul',
        workerName: 'কামরুল হাসান',
        category: 'overtime_attendance',
        status: 'in_progress',
        subject: 'শুক্রবার সাপ্তাহিক ছুটির দিনে কাজের ওভারটাইম হিসাব প্রসঙ্গে',
        message: 'শুক্রবার ডিউটি করলে সেটা কি সাধারণ ওভারটাইমে যুক্ত করব নাকি আলাদা অপশন আছে?',
        assignedTo: 'তানভীর আহমেদ (Operations Admin)',
        internalNotes: [],
        replies: [
          {
            id: 'rep_1',
            authorName: 'তানভীর আহমেদ',
            message: 'হাজিরা পাতায় শুক্রবার উপস্থিত নির্বাচন করে ওভারটাইম ঘণ্টা দিলেই স্বয়ংক্রিয়ভাবে হিসাব হয়ে যাবে।',
            createdAt: `${currentMonth}-26 18:10`,
          },
        ],
        createdAt: `${currentMonth}-26`,
        updatedAt: `${currentMonth}-26`,
      },
      {
        id: 'tkt_1003',
        ticketNumber: 'TKT-1003',
        userId: 'usr_rmg_1042_rahima',
        workerName: 'রহিমা আক্তার',
        category: 'feature_request',
        status: 'resolved',
        subject: 'গুগল কন্টাক্ট থেকে সুপারভাইজারের নম্বর ইমপোর্ট করার সুবিধা চাই',
        message: 'আমার ফোনের গুগল কন্টাক্টে লাইন চিফ ও সুপারভাইজারের নাম্বার আছে, সরাসরি আনার অপশন দিলে ভালো হয়।',
        assignedTo: 'সাদিকুল ইসলাম (Super Admin)',
        internalNotes: [],
        replies: [
          {
            id: 'rep_2',
            authorName: 'সাদিকুল ইসলাম',
            message: 'গুগল কন্টাক্ট সিঙ্ক ফিচারটি কন্টাক্ট বুকে যুক্ত করা হয়েছে। ধন্যবাদ!',
            createdAt: `${todayISO} 09:30`,
          },
        ],
        createdAt: `${currentMonth}-20`,
        updatedAt: todayISO,
        resolvedAt: todayISO,
      },
    ],
    announcements: [
      {
        id: 'ann_01',
        titleBn: 'নতুন সুবিধা: ধার-দেনা ও কিস্তি ট্র্যাকার এবং গুগল কন্টাক্ট সিঙ্ক চালু হয়েছে',
        titleEn: 'New Feature: Personal Loan Tracker & Google Contacts Sync Launched',
        messageBn: 'শ্রমিক সাথী অ্যাপে এখন থেকে আপনার ব্যক্তিগত ধার-দেনা, কিস্তি পরিশোধ এবং গুগল কন্টাক্ট সিঙ্ক সুবিধা ব্যবহার করতে পারবেন। আপনার সকল আর্থিক তথ্য সম্পূর্ণ গোপন ও সুরক্ষিত।',
        messageEn: 'You can now track personal loans, repayments, and sync Google Contacts directly in Shromik Sathi. All financial records remain strictly private to your account.',
        category: 'new_feature',
        status: 'published',
        audience: 'all',
        startDate: `${currentMonth}-01`,
        endDate: '2026-12-31',
        publishedBy: PRIMARY_SUPER_ADMIN_EMAIL,
        publishedAt: `${currentMonth}-01`,
        createdAt: `${currentMonth}-01`,
        updatedAt: todayISO,
      },
      {
        id: 'ann_02',
        titleBn: 'ন্যূনতম মজুরি গ্রেড-৪ অনুযায়ী ওভারটাইম সূত্র যাচাইকরণ',
        titleEn: 'Minimum Wage Grade-4 Overtime Formula Verification Notice',
        messageBn: 'বাংলাদেশ শ্রম আইন ২০০৬ (ধারা ১০৮) অনুযায়ী মূল বেতন ÷ ২০৮ × ২ হারে ওভারটাইম হিসাব সক্রিয় রয়েছে। কারখানার নিয়ম ভিন্ন হলে কাস্টম রেট ব্যবহার করা যাবে।',
        messageEn: 'Overtime calculation follows Bangladesh Labor Law Section 108 ((Basic / 208) * 2). Custom manual rates remain supported in Factory Settings.',
        category: 'important_update',
        status: 'published',
        audience: 'all',
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        publishedBy: PRIMARY_SUPER_ADMIN_EMAIL,
        publishedAt: '2026-09-01',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      },
      {
        id: 'ann_03',
        titleBn: 'রাত ২টা থেকে ২:৩০ পর্যন্ত নির্ধারিত ডাটাবেস রক্ষণাবেক্ষণ (খসড়া)',
        titleEn: 'Scheduled Database Maintenance Window (Draft)',
        messageBn: 'সার্ভারের নিরাপত্তা আপডেটের জন্য নির্ধারিত সময়ে ক্লাউড সিঙ্ক সাময়িক ধীর হতে পারে। অফলাইন মোডে সকল কাজ স্বাভাবিকভাবে চলবে।',
        messageEn: 'Cloud sync may briefly pause during the scheduled maintenance window. Offline entry will continue uninterrupted.',
        category: 'maintenance',
        status: 'draft',
        audience: 'all',
        startDate: '2026-11-05',
        endDate: '2026-11-06',
        publishedBy: PRIMARY_SUPER_ADMIN_EMAIL,
        createdAt: todayISO,
        updatedAt: todayISO,
      },
    ],
    config: {
      appNameBn: 'শ্রমিক সাথী (Shromik Sathi)',
      appNameEn: 'Shromik Sathi — Worker Finance & OT Companion',
      supportEmail: 'support@shromiksathi.org',
      supportPhone: '+880 1700-000000 (হেল্পলাইন: ১৬৩৫৭ সরকারি শ্রম কল সেন্টার)',
      supportHoursBn: 'শনিবার – বৃহস্পতিবার, সকাল ৯:০০ – রাত ৮:০০',
      defaultLanguage: 'bn',
      maintenanceMode: false,
      maintenanceMessageBn: 'সিস্টেম উন্নয়ন কাজ চলছে। আপনার অফলাইন হিসাব সম্পূর্ণ নিরাপদ আছে।',
      maintenanceMessageEn: 'System maintenance is in progress. Offline records remain safe.',
      featureFlags: {
        voiceEntry: true,
        googleContactsSync: true,
        pdfPayslipExport: true,
        personalLoanTracker: true,
        offlineSyncBanner: true,
      },
      currentCalculationPolicy: {
        version: 'v2024.11-BD-RMG',
        effectiveFrom: '2024-12-01',
        standardMonthlyHours: 208,
        overtimeMultiplier: 2.0,
        defaultWageBase: 'basic',
        minimumGrossWageGrade4: 12500,
        updatedBy: PRIMARY_SUPER_ADMIN_EMAIL,
        updatedAt: '2026-01-01',
        changeReason: 'বাংলাদেশ গার্মেন্টস ন্যূনতম মজুরি বোর্ড গেজেট (গ্রেড-৪: ১২,৫০০ টাকা গ্রস, ৬,৭০০ টাকা মূল বেতন) ও শ্রম আইন ধারা ১০৮।',
      },
      calculationPolicyHistory: [
        {
          version: 'v2024.11-BD-RMG',
          effectiveFrom: '2024-12-01',
          standardMonthlyHours: 208,
          overtimeMultiplier: 2.0,
          defaultWageBase: 'basic',
          minimumGrossWageGrade4: 12500,
          updatedBy: PRIMARY_SUPER_ADMIN_EMAIL,
          updatedAt: '2026-01-01',
          changeReason: 'বাংলাদেশ গার্মেন্টস ন্যূনতম মজুরি বোর্ড গেজেট (গ্রেড-৪: ১২,৫০০ টাকা গ্রস, ৬,৭০০ টাকা মূল বেতন) ও শ্রম আইন ধারা ১০৮।',
        },
        {
          version: 'v2018.12-BD-RMG',
          effectiveFrom: '2018-12-01',
          standardMonthlyHours: 208,
          overtimeMultiplier: 2.0,
          defaultWageBase: 'basic',
          minimumGrossWageGrade4: 8000,
          updatedBy: 'System Archive',
          updatedAt: '2023-11-30',
          changeReason: 'পূর্ববর্তী ২০১৮ মজুরি কাঠামো (ঐতিহাসিক রেকর্ড সংরক্ষণের জন্য)।',
        },
      ],
      faqs: [
        {
          id: 'faq_1',
          questionBn: 'ওভারটাইম রেট কীভাবে হিসাব করা হয়?',
          questionEn: 'How is the hourly overtime rate calculated?',
          answerBn: 'বাংলাদেশ শ্রম আইন অনুযায়ী (মূল বেতন ÷ ২০৮ ঘণ্টা) × ২ সূত্রে প্রতি ঘণ্টার ওভারটাইম রেট বের করা হয়। এছাড়া কারখানা সেটিংসে গিয়ে নিজের নির্দিষ্ট রেটও বসানো যায়।',
          answerEn: 'Under Bangladesh Labor Law, hourly OT is (Basic Salary / 208) * 2. Workers can also set a manual hourly rate in Factory Settings.',
          category: 'salary_calculation',
        },
        {
          id: 'faq_2',
          questionBn: 'অ্যাডমিন কি আমার বেতন বা ধার-দেনার হিসাব দেখতে পান?',
          questionEn: 'Can administrators see my salary or personal loan records?',
          answerBn: 'না। আপনার বেতন, ওভারটাইম, খরচ, সঞ্চয়, ধার-দেনা এবং ডকুমেন্ট ভল্ট শুধুমাত্র আপনার নিজের ইউজার আইডিতে লক করা থাকে। অ্যাডমিন প্যানেলে কোনো শ্রমিকের ব্যক্তিগত আর্থিক তথ্য প্রদর্শিত হয় না।',
          answerEn: 'No. Your salary, overtime, expenses, loans, and document vault are strictly isolated to your UID. Administrators cannot view private financial data.',
          category: 'privacy',
        },
      ],
      termsSummaryBn: 'শ্রমিক সাথী একটি ব্যক্তিগত হিসাব ও ডকুমেন্ট সংরক্ষণ সহায়ক অ্যাপ। এটি কোনো ব্যাংক, এনজিও বা অর্থ লেনদেন প্রতিষ্ঠান নয়।',
      privacySummaryBn: 'ব্যবহারকারীর ব্যক্তিগত আর্থিক তথ্য, বেতন স্লিপ ও কন্টাক্ট বুক সম্পূর্ণ এনক্রিপ্টেড ও ইউজার আইডি দ্বারা সুরক্ষিত। কোনো তৃতীয় পক্ষের কাছে তথ্য বিক্রি বা শেয়ার করা হয় না।',
      updatedAt: todayISO,
      updatedBy: PRIMARY_SUPER_ADMIN_EMAIL,
    },
    errors: [
      {
        id: 'err_501',
        timestamp: `${todayISO} 08:15:22`,
        category: 'offline_queue',
        severity: 'warning',
        errorCode: 'SYNC_RETRY_DELAY',
        sanitizedMessage: 'Slow 2G network detected during background Firestore batch commit; queued 2 writes in local IndexedDB mirror.',
        affectedModule: 'DataContext / OfflineMirror',
        resolutionStatus: 'unresolved',
        retryAvailable: true,
      },
      {
        id: 'err_502',
        timestamp: '2026-10-27 21:40:10',
        category: 'auth',
        severity: 'warning',
        errorCode: 'POPUP_CLOSED_BY_USER',
        sanitizedMessage: 'Google OAuth sign-in popup was closed before completion on mobile WebView client.',
        affectedModule: 'AuthWelcomeView / GoogleOAuth',
        resolutionStatus: 'resolved',
        resolvedBy: 'তানভীর আহমেদ (Operations Admin)',
        resolvedAt: '2026-10-27 22:05:00',
        retryAvailable: false,
      },
    ],
    auditLogs: [
      {
        id: 'aud_9001',
        timestamp: `${todayISO} 09:35:00`,
        actorUid: 'admin_super_01',
        actorName: 'সাদিকুল ইসলাম (Super Admin)',
        actorRole: 'super_admin',
        actionType: 'ticket_status_updated',
        targetId: 'TKT-1003',
        targetLabel: 'Ticket TKT-1003 (Google Contacts Sync Request)',
        outcome: 'success',
        reason: 'Resolved feature request after enabling Google People API contacts.readonly integration.',
        metadata: { previousStatus: 'in_progress', newStatus: 'resolved' },
      },
      {
        id: 'aud_9002',
        timestamp: '2026-10-20 11:15:00',
        actorUid: 'admin_super_01',
        actorName: 'সাদিকুল ইসলাম (Super Admin)',
        actorRole: 'super_admin',
        actionType: 'backup_verified',
        targetId: 'bkp_oct_2026',
        targetLabel: 'System Schema & Non-Destructive Snapshot Check',
        outcome: 'success',
        reason: 'Routine monthly verification of Firestore security rules and schema integrity.',
        metadata: { collectionsVerified: 13, mode: 'non_destructive' },
      },
      {
        id: 'aud_9003',
        timestamp: '2026-09-02 16:42:10',
        actorUid: 'admin_super_01',
        actorName: 'সাদিকুল ইসলাম (Super Admin)',
        actorRole: 'super_admin',
        actionType: 'user_suspended',
        targetId: 'usr_rmg_6890_spam_bot',
        targetLabel: 'bulk.scraper99@tempmail.org',
        outcome: 'success',
        reason: 'অস্বাভাবিক স্বয়ংক্রিয় স্প্যাম টিকিট সাবমিশন (Automated spam abuse)',
        metadata: { previousStatus: 'active', newStatus: 'suspended' },
      },
    ],
    backups: [
      {
        id: 'bkp_oct_2026',
        timestamp: '2026-10-20 11:15:00',
        initiatedBy: PRIMARY_SUPER_ADMIN_EMAIL,
        type: 'automated_snapshot',
        status: 'verified',
        collectionsCovered: 13,
        integrityHash: 'sha256:9f84c2e1b77d49a0c31e882b410a9f65',
        notes: 'সকল সিকিউরিটি রুলস, ইনডেক্স ও নন-ডেস্ট্রাক্টিভ মার্জ পলিসি যাচাইকৃত।',
      },
      {
        id: 'bkp_sep_2026',
        timestamp: '2026-09-15 09:00:00',
        initiatedBy: 'System Scheduler',
        type: 'automated_snapshot',
        status: 'verified',
        collectionsCovered: 12,
        integrityHash: 'sha256:4a12b8d9c03e11f4a9923d01e774c821',
        notes: 'মাসিক রুটিন ভেরিফিকেশন সম্পন্ন।',
      },
    ],
  };
}

export function loadAdminStore(todayISO = '2026-10-28'): AdminStoreState {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdminStoreState;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.roles)) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  const initial = buildDefaultAdminStore(todayISO);
  saveAdminStore(initial);
  return initial;
}

export function saveAdminStore(state: AdminStoreState): void {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}
