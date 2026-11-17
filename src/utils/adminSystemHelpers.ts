import type {
  AnnouncementCategory,
  PlatformAnnouncement,
  SystemErrorLog,
} from './adminLogic';
import { toBengaliDigits } from './calculations';

export type AnnouncementStatus = PlatformAnnouncement['status'];

export type AdminSettingsSubTab = 'notices' | 'features' | 'policy' | 'demo';

export interface NoticeTemplate {
  id: string;
  labelBn: string;
  labelEn: string;
  category: AnnouncementCategory;
  titleBn: string;
  messageBn: string;
}

export const ADMIN_NOTICE_TEMPLATES: NoticeTemplate[] = [
  {
    id: 'holiday_notice',
    labelBn: 'সরকারি ছুটি',
    labelEn: 'Public Holiday',
    category: 'general',
    titleBn: 'আসন্ন সরকারি ছুটির দিনগুলোতে হাজিরা ও ওভারটাইম হিসাব',
    messageBn:
      'আসন্ন সরকারি ছুটির দিনে ডিউটি করলে হাজিরা পাতায় "সরকারি ছুটি" নির্বাচন করে ওভারটাইম ঘণ্টা লিখুন। শ্রম আইন অনুযায়ী সঠিক হিসাব স্বয়ংক্রিয়ভাবে যুক্ত হবে।',
  },
  {
    id: 'salary_bonus',
    labelBn: 'বেতন ও বোনাস',
    labelEn: 'Salary & Bonus',
    category: 'important_update',
    titleBn: 'মাসিক বেতন, হাজিরা বোনাস ও ওভারটাইম মিলিয়ে নিন',
    messageBn:
      'মাস শেষে পে-স্লিপ পাওয়ার আগে আপনার উপস্থিতি, দেরি, এবং মোট ওভারটাইম ঘণ্টার হিসাব রিপোর্ট পাতা থেকে মিলিয়ে নিতে পারেন।',
  },
  {
    id: 'new_feature',
    labelBn: 'নতুন সুবিধা',
    labelEn: 'New Feature',
    category: 'new_feature',
    titleBn: 'বেতন ও সুবিধা ক্যালকুলেটর এবং রিপোর্ট আপডেট',
    messageBn:
      'এখন আরও সহজে মাসিক হাজিরা রিপোর্ট, ওভারটাইম চার্ট এবং গ্র্যাচুইটি ও ছুটির টাকা হিসাব করতে পারবেন।',
  },
  {
    id: 'maintenance',
    labelBn: 'সার্ভার রক্ষণাবেক্ষণ',
    labelEn: 'Maintenance',
    category: 'maintenance',
    titleBn: 'নির্ধারিত সময়ে সংক্ষিপ্ত অ্যাপ উন্নয়ন কাজ',
    messageBn:
      'সিস্টেমের গতি ও নিরাপত্তা বাড়াতে সংক্ষিপ্ত রক্ষণাবেক্ষণ চলবে। এ সময় অফলাইনে সেভ করা আপনার সব হিসাব সম্পূর্ণ নিরাপদ থাকবে।',
  },
];

export function computeAnnouncementCounts(announcements: PlatformAnnouncement[]) {
  let published = 0;
  let draft = 0;
  let archived = 0;
  for (const ann of announcements) {
    if (ann.status === 'published') published += 1;
    else if (ann.status === 'draft') draft += 1;
    else if (ann.status === 'archived') archived += 1;
  }
  return {
    total: announcements.length,
    published,
    draft,
    archived,
  };
}

export function filterAnnouncements(
  announcements: PlatformAnnouncement[],
  statusFilter: AnnouncementStatus | 'all',
  query: string
): PlatformAnnouncement[] {
  const q = query.trim().toLowerCase();
  return announcements.filter((ann) => {
    if (statusFilter !== 'all' && ann.status !== statusFilter) return false;
    if (!q) return true;
    return (
      ann.titleBn.toLowerCase().includes(q) ||
      ann.messageBn.toLowerCase().includes(q) ||
      ann.titleEn.toLowerCase().includes(q) ||
      ann.category.toLowerCase().includes(q)
    );
  });
}

export interface TranslatedErrorInfo {
  titleBn: string;
  titleEn: string;
  detailBn: string;
  detailEn: string;
  moduleBn: string;
  moduleEn: string;
  suggestionBn: string;
  suggestionEn: string;
}

const KNOWN_ERROR_TRANSLATIONS: Record<string, TranslatedErrorInfo> = {
  SYNC_RETRY_DELAY: {
    titleBn: 'দুর্বল ইন্টারনেটের কারণে তথ্য জমা হতে সাময়িক দেরি',
    titleEn: 'Temporary sync delay on slow network',
    detailBn:
      'ব্যবহারকারীর ফোনে ইন্টারনেট ধীর থাকায় ২টি হিসাব আপাতত ফোনে নিরাপদে জমা আছে। ভালো নেটওয়ার্ক পেলেই স্বয়ংক্রিয়ভাবে ক্লাউডে চলে যাবে।',
    detailEn:
      '2 records are safely stored locally due to weak 2G connectivity and will auto-sync once the network stabilizes.',
    moduleBn: 'অফলাইন সিঙ্ক ব্যবস্থা',
    moduleEn: 'Offline Sync Queue',
    suggestionBn: 'এটি স্বাভাবিক আচরণ; ব্যবহারকারী ওয়াইফাই বা ৪জি পেলে ঠিক হয়ে যায়।',
    suggestionEn: 'Expected fallback behavior; resolves automatically on stable connection.',
  },
  POPUP_CLOSED_BY_USER: {
    titleBn: 'গুগল লগইন উইন্ডো মাঝপথে বন্ধ করা হয়েছে',
    titleEn: 'Google sign-in popup closed early',
    detailBn:
      'ব্যবহারকারী গুগল দিয়ে সাইন-ইন শেষ করার আগেই পপআপ জানালাটি বন্ধ করেছেন। পুনরায় চেষ্টা করলে স্বাভাবিকভাবে লগইন হবে।',
    detailEn:
      'The user dismissed the Google OAuth popup before finishing sign-in on mobile WebView.',
    moduleBn: 'অ্যাকাউন্ট লগইন',
    moduleEn: 'Account Authentication',
    suggestionBn: 'ব্যবহারকারীকে পুনরায় সাইন-ইন বোতামে চাপতে বা ইমেইল লগইন ব্যবহার করতে বলা যায়।',
    suggestionEn: 'User can retry sign-in or use email/phone credentials.',
  },
};

export function translateSystemError(err: SystemErrorLog): TranslatedErrorInfo {
  const known = KNOWN_ERROR_TRANSLATIONS[err.errorCode];
  if (known) return known;

  const categoryMap: Record<SystemErrorLog['category'], { bn: string; en: string }> = {
    offline_queue: { bn: 'অফলাইন সিঙ্ক ব্যবস্থা', en: 'Offline Sync Queue' },
    auth: { bn: 'অ্যাকাউন্ট লগইন', en: 'Authentication' },
    firestore_sync: { bn: 'ক্লাউড ডেটাবেস', en: 'Cloud Database' },
    pwa_storage: { bn: 'মেমোরি ও স্টোরেজ', en: 'PWA Storage' },
    ui_runtime: { bn: 'স্ক্রিন প্রদর্শন', en: 'UI Runtime' },
  };
  const mod = categoryMap[err.category] || { bn: err.affectedModule, en: err.affectedModule };
  return {
    titleBn: `সিস্টেম সতর্কতা: ${mod.bn}`,
    titleEn: `System Notice: ${mod.en}`,
    detailBn: err.sanitizedMessage,
    detailEn: err.sanitizedMessage,
    moduleBn: mod.bn,
    moduleEn: mod.en,
    suggestionBn: 'পরীক্ষা করে ঠিক থাকলে সমাধানকৃত হিসেবে চিহ্নিত করুন।',
    suggestionEn: 'Verify status and mark resolved once checked.',
  };
}

export interface SystemHealthInput {
  isOnline: boolean;
  hasAuthSession: boolean;
  isDemoMode: boolean;
  pendingWritesCount: number;
  unresolvedErrorsCount: number;
  storageUsedKB: number;
}

export interface SystemHealthSummary {
  overallLevel: 'healthy' | 'attention' | 'offline';
  overallLabelBn: string;
  overallLabelEn: string;
  overallDetailBn: string;
  overallDetailEn: string;
  checks: Array<{
    id: string;
    labelBn: string;
    labelEn: string;
    statusTextBn: string;
    statusTextEn: string;
    ok: boolean;
  }>;
}

export function computeSystemHealthSummary(input: SystemHealthInput): SystemHealthSummary {
  const overallLevel: SystemHealthSummary['overallLevel'] = !input.isOnline
    ? 'offline'
    : input.unresolvedErrorsCount > 0 || input.pendingWritesCount > 5
    ? 'attention'
    : 'healthy';

  const overallLabelBn =
    overallLevel === 'healthy'
      ? 'সব সিস্টেম স্বাভাবিক ও সচল'
      : overallLevel === 'offline'
      ? 'অফলাইন সংরক্ষণ মোড চালু'
      : 'মনোযোগ প্রয়োজন';

  const overallLabelEn =
    overallLevel === 'healthy'
      ? 'All Systems Healthy'
      : overallLevel === 'offline'
      ? 'Running in Offline Mode'
      : 'Needs Attention';

  const overallDetailBn =
    overallLevel === 'healthy'
      ? 'লগইন, ক্লাউড ডেটাবেস, অফলাইন সিঙ্ক এবং ব্রাউজার স্টোরেজ কোনো বাধা ছাড়াই সচল আছে।'
      : overallLevel === 'offline'
      ? 'ইন্টারনেট সংযোগ বিচ্ছিন্ন থাকায় সব নতুন হিসাব ফোনে নিরাপদে জমা হচ্ছে; নেট পেলে আপনাআপনি আপলোড হবে।'
      : 'সিস্টেম সচল আছে, তবে নিচের অপেক্ষমাণ সিঙ্ক বা অমীমাংসিত সতর্কতাটি দেখে নিন।';

  const overallDetailEn =
    overallLevel === 'healthy'
      ? 'Authentication, cloud database, offline queue, and local storage are operating normally.'
      : overallLevel === 'offline'
      ? 'Internet is disconnected; records are safely cached locally until reconnection.'
      : 'Core services are running, with pending sync items or unresolved warnings to review.';

  return {
    overallLevel,
    overallLabelBn,
    overallLabelEn,
    overallDetailBn,
    overallDetailEn,
    checks: [
      {
        id: 'network',
        labelBn: 'ইন্টারনেট ও সার্ভার সংযোগ',
        labelEn: 'Internet & Server Link',
        statusTextBn: input.isOnline ? 'সংযুক্ত আছে' : 'সংযোগ বিচ্ছিন্ন',
        statusTextEn: input.isOnline ? 'Connected' : 'Disconnected',
        ok: input.isOnline,
      },
      {
        id: 'auth',
        labelBn: 'অ্যাকাউন্ট নিরাপত্তা ও লগইন',
        labelEn: 'Account Auth & Security',
        statusTextBn: input.hasAuthSession
          ? 'যাচাইকৃত সেশন'
          : input.isDemoMode
          ? 'নিরাপদ স্থানীয় সেশন'
          : 'লগইন প্রস্তুত',
        statusTextEn: input.hasAuthSession
          ? 'Verified Session'
          : input.isDemoMode
          ? 'Active Local Session'
          : 'Ready',
        ok: true,
      },
      {
        id: 'queue',
        labelBn: 'অফলাইন ডেটা সিঙ্ক অবস্থা',
        labelEn: 'Offline Sync Queue',
        statusTextBn:
          input.pendingWritesCount === 0
            ? 'সব তথ্য আপ-টু-ডেট'
            : `${toBengaliDigits(input.pendingWritesCount)}টি পাঠানোর বাকি`,
        statusTextEn:
          input.pendingWritesCount === 0
            ? 'All Synced'
            : `${input.pendingWritesCount} Pending`,
        ok: input.pendingWritesCount === 0,
      },
      {
        id: 'storage',
        labelBn: 'ফোন মেমোরি ও লোকাল ব্যাকআপ',
        labelEn: 'Device Storage & Local Cache',
        statusTextBn: `স্বাভাবিক (${toBengaliDigits(input.storageUsedKB)} KB ব্যবহৃত)`,
        statusTextEn: `Healthy (${input.storageUsedKB} KB used)`,
        ok: input.storageUsedKB < 4096,
      },
      {
        id: 'alerts',
        labelBn: 'অমীমাংসিত ত্রুটি রিপোর্ট',
        labelEn: 'Unresolved Error Alerts',
        statusTextBn:
          input.unresolvedErrorsCount === 0
            ? 'কোনো সমস্যা নেই'
            : `${toBengaliDigits(input.unresolvedErrorsCount)}টি পর্যালোচনা বাকি`,
        statusTextEn:
          input.unresolvedErrorsCount === 0
            ? 'Zero Open Alerts'
            : `${input.unresolvedErrorsCount} To Review`,
        ok: input.unresolvedErrorsCount === 0,
      },
    ],
  };
}

export function filterSystemErrors(
  errors: SystemErrorLog[],
  statusFilter: 'all' | 'unresolved' | 'resolved'
): SystemErrorLog[] {
  if (statusFilter === 'all') return errors;
  return errors.filter((err) => err.resolutionStatus === statusFilter);
}

export interface AdminPieSlice {
  key: string;
  nameBn: string;
  nameEn: string;
  subLabelBn?: string;
  subLabelEn?: string;
  value: number;
  percent: number;
  color: string;
}

export interface AdminBarPoint {
  key: string;
  labelBn: string;
  labelEn: string;
  primaryValue: number;
  secondaryValue?: number;
  color: string;
  unitBn?: string;
  unitEn?: string;
}

export interface AdminTrendPoint {
  monthKey: string;
  labelBn: string;
  labelEn: string;
  activeWorkers: number;
  newRegistrations: number;
  revenueThousandBdt: number;
}

export interface AdminDashboardChartsData {
  overview: {
    wageBreakdownPie: AdminPieSlice[];
    industrialZonePie: AdminPieSlice[];
    shiftDistributionPie: AdminPieSlice[];
    subscriptionTierPie: AdminPieSlice[];
    monthlyGrowthTrend: AdminTrendPoint[];
    cohortRegistrationBar: AdminBarPoint[];
  };
  users: {
    userAuthAndStatusPie: AdminPieSlice[];
    userSyncStatePie: AdminPieSlice[];
    userActivityBar: AdminBarPoint[];
  };
  roles: {
    adminRolePie: AdminPieSlice[];
    rolePermissionsBar: AdminBarPoint[];
  };
  subscriptions: {
    planSharePie: AdminPieSlice[];
    planRevenueBar: AdminBarPoint[];
  };
  support: {
    ticketStatusPie: AdminPieSlice[];
    ticketCategoryBar: AdminBarPoint[];
  };
  settings: {
    noticeStatusPie: AdminPieSlice[];
    featureAndCategoryBar: AdminBarPoint[];
  };
  monitoring: {
    errorStatusPie: AdminPieSlice[];
    moduleHealthBar: AdminBarPoint[];
  };
  audit: {
    auditActionPie: AdminPieSlice[];
    backupAndAuditBar: AdminBarPoint[];
  };
}

function attachAdminPiePercents(
  raw: Array<Omit<AdminPieSlice, 'percent'>>
): AdminPieSlice[] {
  const positive = raw.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];
  return positive.map((item) => ({
    ...item,
    percent: Math.max(1, Math.round((item.value / total) * 100)),
  }));
}

export function buildAdminDashboardChartsData(params: {
  store: import('./adminLogic').AdminStoreState;
  roleFeatureCounts?: Record<string, number>;
}): AdminDashboardChartsData {
  const { store, roleFeatureCounts } = params;

  // 1. Overview Charts
  const wageBreakdownPie = attachAdminPiePercents([
    {
      key: 'basic',
      nameBn: 'মূল বেতন (Basic)',
      nameEn: 'Basic Wage',
      subLabelBn: '৳১,২৫,০০,০০০',
      subLabelEn: '৳12,500,000',
      value: 60,
      color: '#059669',
    },
    {
      key: 'overtime',
      nameBn: 'ওভারটাইম আয়',
      nameEn: 'Overtime Pay',
      subLabelBn: '৳৫৮,৫০,০০০',
      subLabelEn: '৳5,850,000',
      value: 28,
      color: '#0EA5E9',
    },
    {
      key: 'bonus',
      nameBn: 'হাজিরা ও ঈদ বোনাস',
      nameEn: 'Bonus Allowances',
      subLabelBn: '৳১৬,৭০,০০০',
      subLabelEn: '৳1,670,000',
      value: 8,
      color: '#D97706',
    },
    {
      key: 'allowance',
      nameBn: 'যাতায়াত ও অন্যান্য ভাতা',
      nameEn: 'Transport & Other',
      subLabelBn: '৳৮,৪০,০০০',
      subLabelEn: '৳840,000',
      value: 4,
      color: '#7C3AED',
    },
  ]);

  const industrialZonePie = attachAdminPiePercents([
    {
      key: 'gazipur',
      nameBn: 'গাজীপুর শিল্প এলাকা',
      nameEn: 'Gazipur Industrial Zone',
      value: 38,
      color: '#059669',
    },
    {
      key: 'ashulia',
      nameBn: 'আশুলিয়া ও সাভার বেল্ট',
      nameEn: 'Ashulia & Savar Belt',
      value: 26,
      color: '#0D9488',
    },
    {
      key: 'narayanganj',
      nameBn: 'নারায়ণগঞ্জ শিল্পাঞ্চল',
      nameEn: 'Narayanganj Zone',
      value: 18,
      color: '#2563EB',
    },
    {
      key: 'chittagong',
      nameBn: 'চট্টগ্রাম ইপিজেড অঞ্চল',
      nameEn: 'Chittagong EPZ Zone',
      value: 12,
      color: '#D97706',
    },
    {
      key: 'dhaka',
      nameBn: 'ঢাকা মিরপুর ও তেজগাঁও',
      nameEn: 'Dhaka & Mirpur Zone',
      value: 6,
      color: '#7C3AED',
    },
  ]);

  const shiftDistributionPie = attachAdminPiePercents([
    {
      key: 'day',
      nameBn: 'ডে শিফট (সকাল ৮টা)',
      nameEn: 'Day Shift',
      subLabelBn: 'হাজিরা বোনাস যোগ্য ৯২%',
      subLabelEn: '92% bonus eligible',
      value: 68,
      color: '#059669',
    },
    {
      key: 'night',
      nameBn: 'নাইট শিফট (রাত ৮টা)',
      nameEn: 'Night Shift',
      subLabelBn: 'হাজিরা বোনাস যোগ্য ৮৯%',
      subLabelEn: '89% bonus eligible',
      value: 22,
      color: '#4F46E5',
    },
    {
      key: 'roster',
      nameBn: 'সাপ্তাহিক রোটেশন রোস্টার',
      nameEn: 'Weekly Roster',
      subLabelBn: 'হাজিরা বোনাস যোগ্য ৯১%',
      subLabelEn: '91% bonus eligible',
      value: 10,
      color: '#0EA5E9',
    },
  ]);

  const subscriptionTierPie = attachAdminPiePercents([
    {
      key: 'free',
      nameBn: 'ফ্রি প্ল্যান (Starter)',
      nameEn: 'Starter Free',
      subLabelBn: 'বিনামূল্যে মৌলিক সুবিধা',
      subLabelEn: 'Core worker tools',
      value: 82,
      color: '#64748B',
    },
    {
      key: 'pro',
      nameBn: 'প্রো প্ল্যান (Pro)',
      nameEn: 'Pro Plan',
      subLabelBn: '৳১,৮৫,০০০ মাসিক আয়',
      subLabelEn: '৳185,000 MRR',
      value: 14,
      color: '#059669',
    },
    {
      key: 'vip',
      nameBn: 'প্রো ভিআইপি (VIP)',
      nameEn: 'Pro VIP Tier',
      subLabelBn: '৳২,৯০,০০০ মাসিক আয়',
      subLabelEn: '৳290,000 MRR',
      value: 4,
      color: '#D97706',
    },
  ]);

  const monthlyGrowthTrend: AdminTrendPoint[] = [
    {
      monthKey: '2026-06',
      labelBn: 'জুন',
      labelEn: 'Jun',
      activeWorkers: 620,
      newRegistrations: 95,
      revenueThousandBdt: 290,
    },
    {
      monthKey: '2026-07',
      labelBn: 'জুলাই',
      labelEn: 'Jul',
      activeWorkers: 740,
      newRegistrations: 120,
      revenueThousandBdt: 330,
    },
    {
      monthKey: '2026-08',
      labelBn: 'আগস্ট',
      labelEn: 'Aug',
      activeWorkers: 860,
      newRegistrations: 145,
      revenueThousandBdt: 375,
    },
    {
      monthKey: '2026-09',
      labelBn: 'সেপ্টেঃ',
      labelEn: 'Sep',
      activeWorkers: 980,
      newRegistrations: 168,
      revenueThousandBdt: 415,
    },
    {
      monthKey: '2026-10',
      labelBn: 'অক্টোঃ',
      labelEn: 'Oct',
      activeWorkers: 1120,
      newRegistrations: 192,
      revenueThousandBdt: 448,
    },
    {
      monthKey: '2026-11',
      labelBn: 'নভেঃ',
      labelEn: 'Nov',
      activeWorkers: 1245,
      newRegistrations: 215,
      revenueThousandBdt: 475,
    },
  ];

  const octCount = store.users.filter((u) => u.registeredAt.startsWith('2026-10')).length;
  const sepCount = store.users.filter((u) => u.registeredAt.startsWith('2026-09')).length;
  const earlierCount = store.users.filter(
    (u) => !u.registeredAt.startsWith('2026-10') && !u.registeredAt.startsWith('2026-09')
  ).length;

  const cohortRegistrationBar: AdminBarPoint[] = [
    {
      key: 'oct_2026',
      labelBn: 'অক্টোবর ২০২৬',
      labelEn: 'Oct 2026',
      primaryValue: octCount,
      color: '#059669',
      unitBn: 'জন',
      unitEn: 'users',
    },
    {
      key: 'sep_2026',
      labelBn: 'সেপ্টেম্বর ২০২৬',
      labelEn: 'Sep 2026',
      primaryValue: sepCount,
      color: '#0EA5E9',
      unitBn: 'জন',
      unitEn: 'users',
    },
    {
      key: 'aug_earlier',
      labelBn: 'আগস্ট ও পূর্ববর্তী',
      labelEn: 'Aug & Earlier',
      primaryValue: earlierCount,
      color: '#6366F1',
      unitBn: 'জন',
      unitEn: 'users',
    },
  ];

  // 2. Users Section Charts
  const activeGoogle = store.users.filter(
    (u) => u.accountStatus === 'active' && u.authProvider === 'google.com'
  ).length;
  const activePassword = store.users.filter(
    (u) => u.accountStatus === 'active' && u.authProvider !== 'google.com'
  ).length;
  const suspendedUsers = store.users.filter((u) => u.accountStatus === 'suspended').length;

  const userAuthAndStatusPie = attachAdminPiePercents([
    {
      key: 'active_google',
      nameBn: 'সক্রিয় (গুগল লগইন)',
      nameEn: 'Active (Google)',
      value: activeGoogle,
      color: '#059669',
    },
    {
      key: 'active_password',
      nameBn: 'সক্রিয় (ইমেইল/পাসওয়ার্ড)',
      nameEn: 'Active (Password)',
      value: activePassword,
      color: '#0EA5E9',
    },
    {
      key: 'suspended',
      nameBn: 'স্থগিত অ্যাকাউন্ট',
      nameEn: 'Suspended',
      value: suspendedUsers,
      color: '#E11D48',
    },
  ]);

  const syncedUsers = store.users.filter((u) => u.offlineSyncState === 'synced').length;
  const pendingUsers = store.users.filter((u) => u.offlineSyncState === 'pending').length;
  const errorSyncUsers = store.users.filter((u) => u.offlineSyncState === 'error').length;

  const userSyncStatePie = attachAdminPiePercents([
    {
      key: 'synced',
      nameBn: 'ক্লাউড সিঙ্ক সম্পন্ন',
      nameEn: 'Cloud Synced',
      value: syncedUsers,
      color: '#059669',
    },
    {
      key: 'pending',
      nameBn: 'অফলাইন অপেক্ষমাণ',
      nameEn: 'Pending Sync',
      value: pendingUsers,
      color: '#D97706',
    },
    {
      key: 'error',
      nameBn: 'সিঙ্ক ত্রুটি',
      nameEn: 'Sync Error',
      value: errorSyncUsers,
      color: '#E11D48',
    },
  ]);

  const verifiedEmailCount = store.users.filter((u) => u.emailVerified).length;
  const userActivityBar: AdminBarPoint[] = [
    {
      key: 'google_users',
      labelBn: 'গুগল লগইন',
      labelEn: 'Google Auth',
      primaryValue: activeGoogle,
      color: '#059669',
      unitBn: 'জন',
      unitEn: 'users',
    },
    {
      key: 'password_users',
      labelBn: 'ইমেইল লগইন',
      labelEn: 'Email Auth',
      primaryValue: activePassword,
      color: '#0EA5E9',
      unitBn: 'জন',
      unitEn: 'users',
    },
    {
      key: 'verified_users',
      labelBn: 'ভেরিফাইড ইউজার',
      labelEn: 'Verified',
      primaryValue: verifiedEmailCount,
      color: '#4F46E5',
      unitBn: 'জন',
      unitEn: 'users',
    },
    {
      key: 'synced_users',
      labelBn: 'ক্লাউড সিঙ্কড',
      labelEn: 'Cloud Synced',
      primaryValue: syncedUsers,
      color: '#0D9488',
      unitBn: 'জন',
      unitEn: 'users',
    },
    {
      key: 'pending_users',
      labelBn: 'অফলাইন পেন্ডিং',
      labelEn: 'Pending Sync',
      primaryValue: pendingUsers,
      color: '#D97706',
      unitBn: 'জন',
      unitEn: 'users',
    },
  ];

  // 3. Roles & Permissions Section Charts
  const superAdminCount = store.roles.filter((r) => r.role === 'super_admin').length;
  const adminCount = store.roles.filter((r) => r.role === 'admin').length;
  const modCount = store.roles.filter((r) => r.role === 'support_moderator').length;

  const adminRolePie = attachAdminPiePercents([
    {
      key: 'super_admin',
      nameBn: 'সুপার অ্যাডমিন',
      nameEn: 'Super Admin',
      value: superAdminCount,
      color: '#4F46E5',
    },
    {
      key: 'admin',
      nameBn: 'অ্যাডমিন',
      nameEn: 'Admin',
      value: adminCount,
      color: '#059669',
    },
    {
      key: 'support_moderator',
      nameBn: 'সাপোর্ট মডারেটর',
      nameEn: 'Support Moderator',
      value: modCount,
      color: '#0EA5E9',
    },
  ]);

  const rolePermissionsBar: AdminBarPoint[] = [
    {
      key: 'super_admin',
      labelBn: 'সুপার অ্যাডমিন',
      labelEn: 'Super Admin',
      primaryValue: roleFeatureCounts?.super_admin ?? 35,
      color: '#4F46E5',
      unitBn: 'টি ফিচার',
      unitEn: 'features',
    },
    {
      key: 'admin',
      labelBn: 'অ্যাডমিন',
      labelEn: 'Admin',
      primaryValue: roleFeatureCounts?.admin ?? 31,
      color: '#059669',
      unitBn: 'টি ফিচার',
      unitEn: 'features',
    },
    {
      key: 'support_moderator',
      labelBn: 'মডারেটর',
      labelEn: 'Moderator',
      primaryValue: roleFeatureCounts?.support_moderator ?? 22,
      color: '#0EA5E9',
      unitBn: 'টি ফিচার',
      unitEn: 'features',
    },
    {
      key: 'user',
      labelBn: 'সাধারণ ইউজার',
      labelEn: 'Worker User',
      primaryValue: roleFeatureCounts?.user ?? 19,
      color: '#0D9488',
      unitBn: 'টি ফিচার',
      unitEn: 'features',
    },
  ];

  // 4. Subscriptions Section Charts
  const planSharePie = subscriptionTierPie;
  const planRevenueBar: AdminBarPoint[] = [
    {
      key: 'pro_vip',
      labelBn: 'প্রো ভিআইপি প্ল্যান',
      labelEn: 'Pro VIP Plan',
      primaryValue: 290,
      color: '#D97706',
      unitBn: 'হাজার ৳',
      unitEn: 'k BDT',
    },
    {
      key: 'pro_plan',
      labelBn: 'প্রো প্ল্যান',
      labelEn: 'Pro Plan',
      primaryValue: 185,
      color: '#059669',
      unitBn: 'হাজার ৳',
      unitEn: 'k BDT',
    },
    {
      key: 'free_plan',
      labelBn: 'ফ্রি স্টার্টার (৮২%)',
      labelEn: 'Free Starter (82%)',
      primaryValue: 82,
      color: '#64748B',
      unitBn: '% ইউজার',
      unitEn: '% users',
    },
  ];

  // 5. Support & Feedback Section Charts
  const statusBuckets = {
    new: store.tickets.filter((t) => t.status === 'new').length,
    in_progress: store.tickets.filter((t) => t.status === 'in_progress').length,
    waiting_for_user: store.tickets.filter((t) => t.status === 'waiting_for_user').length,
    resolved: store.tickets.filter((t) => t.status === 'resolved').length,
    closed: store.tickets.filter((t) => t.status === 'closed').length,
  };

  const ticketStatusPie = attachAdminPiePercents([
    {
      key: 'new',
      nameBn: 'নতুন টিকিট',
      nameEn: 'New Tickets',
      value: statusBuckets.new,
      color: '#D97706',
    },
    {
      key: 'in_progress',
      nameBn: 'চলমান (প্রক্রিয়াধীন)',
      nameEn: 'In Progress',
      value: statusBuckets.in_progress,
      color: '#0EA5E9',
    },
    {
      key: 'waiting_for_user',
      nameBn: 'ব্যবহারকারীর উত্তরের অপেক্ষায়',
      nameEn: 'Waiting for User',
      value: statusBuckets.waiting_for_user,
      color: '#7C3AED',
    },
    {
      key: 'resolved',
      nameBn: 'সমাধানকৃত',
      nameEn: 'Resolved',
      value: statusBuckets.resolved,
      color: '#059669',
    },
    {
      key: 'closed',
      nameBn: 'বন্ধ (Closed)',
      nameEn: 'Closed',
      value: statusBuckets.closed,
      color: '#64748B',
    },
  ]);

  const categoryMeta: Array<{
    key: import('./adminLogic').SupportTicketCategory;
    labelBn: string;
    labelEn: string;
    color: string;
  }> = [
    {
      key: 'salary_calculation',
      labelBn: 'বেতন হিসাব',
      labelEn: 'Salary Calc',
      color: '#059669',
    },
    {
      key: 'overtime_attendance',
      labelBn: 'ওটি ও হাজিরা',
      labelEn: 'OT & Attendance',
      color: '#0EA5E9',
    },
    {
      key: 'bug_report',
      labelBn: 'বাগ রিপোর্ট',
      labelEn: 'Bug Report',
      color: '#E11D48',
    },
    {
      key: 'login_registration',
      labelBn: 'লগইন সহায়তা',
      labelEn: 'Login & Auth',
      color: '#4F46E5',
    },
    {
      key: 'feature_request',
      labelBn: 'নতুন ফিচার',
      labelEn: 'Feature Request',
      color: '#D97706',
    },
    {
      key: 'offline_sync',
      labelBn: 'অফলাইন সিঙ্ক',
      labelEn: 'Offline Sync',
      color: '#0D9488',
    },
    {
      key: 'other',
      labelBn: 'অন্যান্য',
      labelEn: 'Other',
      color: '#64748B',
    },
  ];

  const ticketCategoryBar: AdminBarPoint[] = categoryMeta
    .map((meta) => ({
      key: meta.key,
      labelBn: meta.labelBn,
      labelEn: meta.labelEn,
      primaryValue: store.tickets.filter((t) => t.category === meta.key).length,
      color: meta.color,
      unitBn: 'টি',
      unitEn: 'tickets',
    }))
    .filter((item) => item.primaryValue > 0);

  // 6. Settings & Announcements Section Charts
  const annCounts = computeAnnouncementCounts(store.announcements);
  const noticeStatusPie = attachAdminPiePercents([
    {
      key: 'published',
      nameBn: 'প্রকাশিত নোটিশ',
      nameEn: 'Published',
      value: annCounts.published,
      color: '#059669',
    },
    {
      key: 'draft',
      nameBn: 'খসড়া নোটিশ',
      nameEn: 'Drafts',
      value: annCounts.draft,
      color: '#D97706',
    },
    {
      key: 'archived',
      nameBn: 'আর্কাইভকৃত',
      nameEn: 'Archived',
      value: annCounts.archived,
      color: '#64748B',
    },
  ]);

  const enabledFlagsCount = Object.values(store.config.featureFlags).filter(Boolean).length;
  const totalFlagsCount = Object.keys(store.config.featureFlags).length;

  const featureAndCategoryBar: AdminBarPoint[] = [
    {
      key: 'active_flags',
      labelBn: 'চালু অ্যাপ ফিচার',
      labelEn: 'Active Features',
      primaryValue: enabledFlagsCount,
      secondaryValue: totalFlagsCount,
      color: '#059669',
      unitBn: 'টি সচল',
      unitEn: 'enabled',
    },
    {
      key: 'published_notices',
      labelBn: 'প্রকাশিত নোটিশ',
      labelEn: 'Live Notices',
      primaryValue: annCounts.published,
      color: '#0EA5E9',
      unitBn: 'টি',
      unitEn: 'notices',
    },
    {
      key: 'draft_notices',
      labelBn: 'খসড়া ও টেমপ্লেট',
      labelEn: 'Drafts & Templates',
      primaryValue: annCounts.draft + ADMIN_NOTICE_TEMPLATES.length,
      color: '#4F46E5',
      unitBn: 'টি',
      unitEn: 'items',
    },
  ];

  // 7. System Monitoring Section Charts
  const unresolvedErrCount = store.errors.filter(
    (e) => e.resolutionStatus === 'unresolved'
  ).length;
  const resolvedErrCount = store.errors.filter(
    (e) => e.resolutionStatus === 'resolved'
  ).length;

  const errorStatusPie = attachAdminPiePercents([
    {
      key: 'resolved',
      nameBn: 'সমাধানকৃত সতর্কতা',
      nameEn: 'Resolved Alerts',
      value: resolvedErrCount,
      color: '#059669',
    },
    {
      key: 'unresolved',
      nameBn: 'পর্যালোচনা বাকি',
      nameEn: 'Open Alerts',
      value: unresolvedErrCount,
      color: '#D97706',
    },
  ]);

  const moduleHealthBar: AdminBarPoint[] = [
    {
      key: 'auth',
      labelBn: 'লগইন ও নিরাপত্তা',
      labelEn: 'Auth Security',
      primaryValue: 99,
      color: '#059669',
      unitBn: '% সচল',
      unitEn: '% healthy',
    },
    {
      key: 'firestore_sync',
      labelBn: 'ক্লাউড সিঙ্ক ইঞ্জিন',
      labelEn: 'Cloud Sync',
      primaryValue: 98,
      color: '#0EA5E9',
      unitBn: '% সচল',
      unitEn: '% healthy',
    },
    {
      key: 'offline_queue',
      labelBn: 'অফলাইন ক্যাশ ও কিউ',
      labelEn: 'Offline Queue',
      primaryValue: 96,
      color: '#0D9488',
      unitBn: '% সচল',
      unitEn: '% healthy',
    },
    {
      key: 'pwa_storage',
      labelBn: 'লোকাল মেমোরি সুরক্ষা',
      labelEn: 'Device Storage',
      primaryValue: 100,
      color: '#4F46E5',
      unitBn: '% সচল',
      unitEn: '% healthy',
    },
  ];

  // 8. Audit Logs & Backup Section Charts
  const roleAudits = store.auditLogs.filter(
    (l) => l.actionType === 'role_updated' || l.actionType === 'admin_login'
  ).length;
  const userAudits = store.auditLogs.filter(
    (l) => l.actionType === 'user_suspended' || l.actionType === 'user_reactivated'
  ).length;
  const supportAudits = store.auditLogs.filter(
    (l) => l.actionType === 'ticket_assigned' || l.actionType === 'ticket_status_updated'
  ).length;
  const configAudits = store.auditLogs.length - roleAudits - userAudits - supportAudits;

  const auditActionPie = attachAdminPiePercents([
    {
      key: 'role_actions',
      nameBn: 'রোল ও পারমিশন অডিট',
      nameEn: 'Role & Access Audits',
      value: Math.max(1, roleAudits),
      color: '#4F46E5',
    },
    {
      key: 'support_actions',
      nameBn: 'সাপোর্ট টিকিট সমাধান',
      nameEn: 'Support Ticket Audits',
      value: Math.max(1, supportAudits),
      color: '#059669',
    },
    {
      key: 'config_actions',
      nameBn: 'নোটিশ, পলিসি ও ব্যাকআপ',
      nameEn: 'Policy, Notice & Backup',
      value: Math.max(1, configAudits),
      color: '#0EA5E9',
    },
    ...(userAudits > 0
      ? [
          {
            key: 'user_actions',
            nameBn: 'ইউজার অ্যাকাউন্ট স্ট্যাটাস',
            nameEn: 'User Status Audits',
            value: userAudits,
            color: '#D97706',
          },
        ]
      : []),
  ]);

  const backupAndAuditBar: AdminBarPoint[] = [
    {
      key: 'audit_events',
      labelBn: 'মোট অডিট ইভেন্ট',
      labelEn: 'Total Audit Events',
      primaryValue: store.auditLogs.length,
      color: '#059669',
      unitBn: 'টি',
      unitEn: 'events',
    },
    {
      key: 'verified_backups',
      labelBn: 'যাচাইকৃত ব্যাকআপ স্ন্যাপশট',
      labelEn: 'Verified Backups',
      primaryValue: store.backups.length,
      color: '#0EA5E9',
      unitBn: 'টি',
      unitEn: 'snapshots',
    },
    {
      key: 'covered_collections',
      labelBn: 'সুরক্ষিত ডেটা কালেকশন',
      labelEn: 'Protected Collections',
      primaryValue: store.backups[0]?.collectionsCovered ?? 14,
      color: '#4F46E5',
      unitBn: 'টি',
      unitEn: 'collections',
    },
  ];

  return {
    overview: {
      wageBreakdownPie,
      industrialZonePie,
      shiftDistributionPie,
      subscriptionTierPie,
      monthlyGrowthTrend,
      cohortRegistrationBar,
    },
    users: {
      userAuthAndStatusPie,
      userSyncStatePie,
      userActivityBar,
    },
    roles: {
      adminRolePie,
      rolePermissionsBar,
    },
    subscriptions: {
      planSharePie,
      planRevenueBar,
    },
    support: {
      ticketStatusPie,
      ticketCategoryBar,
    },
    settings: {
      noticeStatusPie,
      featureAndCategoryBar,
    },
    monitoring: {
      errorStatusPie,
      moduleHealthBar,
    },
    audit: {
      auditActionPie,
      backupAndAuditBar,
    },
  };
}

