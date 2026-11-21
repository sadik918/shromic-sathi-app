import type {
  AlarmItem,
  AttendanceRecord,
  ExpenseRecord,
  GarmentWorkplace,
  Language,
  LeaveApplication,
  MoreSubView,
  NavTab,
  OvertimeRecord,
  PersonalLoan,
  ReminderItem,
  SalaryPayment,
  SalaryRecord,
  SavingsGoal,
  SupportFeedback,
  VaultDocument,
  WorkerContact,
  WorkerProfile,
} from '../types';
import type { PlatformAnnouncement } from './adminLogic';
import { formatBDT, formatNumber } from './calculations';
import { formatDateReadable, formatMonthLabel } from './i18n';

export type SmartSearchItemKind = 'date_report' | 'feature' | 'data';

export type SmartSearchIconKey =
  | 'date_report'
  | 'overtime'
  | 'attendance'
  | 'salary'
  | 'expenses'
  | 'profile'
  | 'alarm'
  | 'calculator'
  | 'contacts'
  | 'factory'
  | 'loans'
  | 'documents'
  | 'reports'
  | 'reminders'
  | 'announcements'
  | 'support'
  | 'subscriptions'
  | 'voice'
  | 'admin'
  | 'savings';

export interface SmartSearchItem {
  id: string;
  kind: SmartSearchItemKind;
  icon: SmartSearchIconKey;
  titleBn: string;
  titleEn: string;
  metaBn: string;
  metaEn: string;
  sectionLabelBn: string;
  sectionLabelEn: string;
  ctaLabelBn?: string;
  ctaLabelEn?: string;
  targetTab: NavTab;
  targetSubView?: MoreSubView;
  focusDate?: string;
  targetMonth?: string;
  recordDate?: string;
  actionType?: 'navigate' | 'open_voice';
  searchIndex: string;
  priority: number;
}

export interface SmartSearchDataset {
  lang: Language;
  selectedMonth: string;
  todayISO: string;
  isAdminUser: boolean;
  profile: WorkerProfile;
  overtime: OvertimeRecord[];
  attendance: AttendanceRecord[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
  expenses: ExpenseRecord[];
  savings: SavingsGoal[];
  loans: PersonalLoan[];
  contacts: WorkerContact[];
  workplaces: GarmentWorkplace[];
  reminders: ReminderItem[];
  documents: VaultDocument[];
  alarms: AlarmItem[];
  leaveApplications: LeaveApplication[];
  publishedAnnouncements: PlatformAnnouncement[];
  feedbackList: SupportFeedback[];
}

export interface ParsedDateQuery {
  day?: number;
  month?: number; // 1-12
  year?: number;
  exactDateISO?: string;
  wantsReport?: boolean;
}

const BN_TO_EN_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeSearchText(input: string): string {
  if (!input) return '';
  return input
    .replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] || d)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  জানু: 1,
  জানুয়ারি: 1,
  জানুয়ারি: 1,
  feb: 2,
  february: 2,
  ফেব: 2,
  ফেব্রুয়ারি: 2,
  ফেব্রুয়ারি: 2,
  mar: 3,
  march: 3,
  মার্চ: 3,
  apr: 4,
  april: 4,
  এপ্রিল: 4,
  may: 5,
  মে: 5,
  jun: 6,
  june: 6,
  জুন: 6,
  jul: 7,
  july: 7,
  জুলাই: 7,
  aug: 8,
  august: 8,
  আগস্ট: 8,
  sep: 9,
  sept: 9,
  september: 9,
  সেপ্টেম্বর: 9,
  oct: 10,
  october: 10,
  অক্টোবর: 10,
  nov: 11,
  november: 11,
  নভেম্বর: 11,
  dec: 12,
  december: 12,
  ডিসেম্বর: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getDaysInYearMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function shiftDateISOByDays(dateISO: string, deltaDays: number): string {
  const parts = dateISO.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dateISO;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + deltaDays));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function parseSmartDateQuery(
  rawQuery: string,
  selectedMonth: string,
  todayISO: string
): ParsedDateQuery | null {
  const norm = normalizeSearchText(rawQuery);
  if (!norm) return null;

  const wantsReport = /(রিপোর্ট|report|হাজিরা|hajira|attendance)/.test(norm);

  // Relative dates: আজ / today / গতকাল / yesterday
  if (/^(আজ|আজকে|আজকের|today)(\s+.*)?$/.test(norm)) {
    const [y, m, d] = todayISO.split('-').map(Number);
    return { day: d, month: m, year: y, exactDateISO: todayISO, wantsReport };
  }
  if (/^(গতকাল|গতকালের|yesterday)(\s+.*)?$/.test(norm)) {
    const yest = shiftDateISOByDays(todayISO, -1);
    const [y, m, d] = yest.split('-').map(Number);
    return { day: d, month: m, year: y, exactDateISO: yest, wantsReport };
  }

  // Exact ISO date: YYYY-MM-DD
  const isoMatch = norm.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= getDaysInYearMonth(year, month)) {
      return {
        day,
        month,
        year,
        exactDateISO: `${year}-${pad2(month)}-${pad2(day)}`,
        wantsReport,
      };
    }
  }

  // DD/MM/YYYY or DD/MM or DD-MM or DD.MM
  const dmyMatch = norm.match(/\b(\d{1,2})[/. -](\d{1,2})(?:[/. -](\d{4}))?\b/);
  if (dmyMatch && /[/. -]/.test(norm)) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const defaultYear = Number(selectedMonth.slice(0, 4)) || Number(todayISO.slice(0, 4)) || 2026;
    const year = dmyMatch[3] ? Number(dmyMatch[3]) : defaultYear;
    if (month >= 1 && month <= 12 && day >= 1 && day <= getDaysInYearMonth(year, month)) {
      return {
        day,
        month,
        year,
        exactDateISO: `${year}-${pad2(month)}-${pad2(day)}`,
        wantsReport,
      };
    }
  }

  // Day + Month Name (either order), e.g., "১৯ নভেম্বর", "19 nov", "november 19"
  let detectedMonth: number | undefined;
  for (const [token, mNum] of Object.entries(MONTH_NAME_MAP)) {
    if (norm.includes(token)) {
      detectedMonth = mNum;
      break;
    }
  }
  const dayNumMatch = norm.match(/\b([1-9]|[12]\d|3[01])\b/);
  const yearNumMatch = norm.match(/\b(20\d{2})\b/);

  if (detectedMonth && dayNumMatch) {
    const day = Number(dayNumMatch[1]);
    const defaultYear = Number(selectedMonth.slice(0, 4)) || Number(todayISO.slice(0, 4)) || 2026;
    const year = yearNumMatch ? Number(yearNumMatch[1]) : defaultYear;
    if (day >= 1 && day <= getDaysInYearMonth(year, detectedMonth)) {
      return {
        day,
        month: detectedMonth,
        year,
        exactDateISO: `${year}-${pad2(detectedMonth)}-${pad2(day)}`,
        wantsReport,
      };
    }
  }

  // Pure day number (1-31) OR day with তারিখ / tarikh / date / রিপোর্ট / হাজিরা / দিন
  const strippedDayQuery = norm
    .replace(/(তারিখের|তারিখ|tarikh|date|রিপোর্ট|report|হাজিরা|hajira|attendance|মাসের|এই|অন্যান্য|দিন)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^([1-9]|[12]\d|3[01])$/.test(strippedDayQuery)) {
    const day = Number(strippedDayQuery);
    if (day >= 1 && day <= 31) {
      return { day, wantsReport };
    }
  }

  return null;
}

const ATTENDANCE_STATUS_BN: Record<string, string> = {
  present: 'উপস্থিত',
  absent: 'অনুপস্থিত',
  late: 'বিলম্বিত',
  approved_leave: 'অনুমোদিত ছুটি',
  weekly_holiday: 'সাপ্তাহিক ছুটি',
  public_holiday: 'সরকারি ছুটি',
};

const ATTENDANCE_STATUS_EN: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  approved_leave: 'Approved Leave',
  weekly_holiday: 'Weekly Holiday',
  public_holiday: 'Public Holiday',
};

const EXPENSE_CATEGORY_BN: Record<string, string> = {
  food: 'খাবার ও বাজার',
  rent: 'বাসা ভাড়া',
  transport: 'যাতায়াত',
  family: 'পরিবার',
  medical: 'চিকিৎসা',
  education: 'শিক্ষা',
  other: 'অন্যান্য খরচ',
};

const EXPENSE_CATEGORY_EN: Record<string, string> = {
  food: 'Food & Groceries',
  rent: 'House Rent',
  transport: 'Transport',
  family: 'Family Support',
  medical: 'Medical',
  education: 'Education',
  other: 'Other Expense',
};

const PAYMENT_METHOD_BN: Record<string, string> = {
  cash: 'নগদ ক্যাশ',
  bkash: 'বিকাশ',
  nagad: 'নগদ',
  rocket: 'রকেট',
  bank: 'ব্যাংক',
};

export function buildFeatureSearchItems(isAdminUser: boolean): SmartSearchItem[] {
  const features: Array<{
    id: string;
    icon: SmartSearchIconKey;
    titleBn: string;
    titleEn: string;
    metaBn: string;
    metaEn: string;
    targetTab: NavTab;
    targetSubView?: MoreSubView;
    actionType?: 'navigate' | 'open_voice';
    keywords: string;
    priority: number;
  }> = [
    {
      id: 'feat-overtime',
      icon: 'overtime',
      titleBn: 'ওভারটাইম হিসাব',
      titleEn: 'Overtime Tracker',
      metaBn: 'ওটি এন্ট্রি ও ঘণ্টা হিসাব',
      metaEn: 'OT entries & hours',
      targetTab: 'overtime',
      keywords: 'overtime ot ওভারটাইম ওটি ঘণ্টা অতিরিক্ত কাজ যোগ করুন add ot',
      priority: 100,
    },
    {
      id: 'feat-attendance',
      icon: 'attendance',
      titleBn: 'হাজিরা ও ছুটি',
      titleEn: 'Attendance & Leave',
      metaBn: 'উপস্থিতি, ছুটি ও হাজিরা বোনাস',
      metaEn: 'Attendance, leave & bonus',
      targetTab: 'attendance',
      keywords: 'attendance hajira leave chuti হাজিরা উপস্থিতি অনুপস্থিত ছুটি লেট বোনাস মিস bonus absent present late',
      priority: 98,
    },
    {
      id: 'feat-salary',
      icon: 'salary',
      titleBn: 'বেতন ও পে-স্লিপ',
      titleEn: 'Salary & Payslip',
      metaBn: 'অর্জিত বেতন, পেমেন্ট ও পে-স্লিপ',
      metaEn: 'Earned salary, payments & payslip',
      targetTab: 'salary',
      keywords: 'salary beton payslip payment বেতন পে-স্লিপ মূল বেতন মোট বেতন ভাতা অগ্রিম পেমেন্ট স্যালারি',
      priority: 97,
    },
    {
      id: 'feat-expenses',
      icon: 'expenses',
      titleBn: 'ব্যক্তিগত হিসাব ও খরচ',
      titleEn: 'Personal Finance & Expenses',
      metaBn: 'দৈনিক খরচ, বাজেট ও সঞ্চয়',
      metaEn: 'Daily expenses, budget & savings',
      targetTab: 'expenses',
      keywords: 'expense khoroch finance savings budget খরচ ব্যয় আয় সঞ্চয় বাজেট বাজার বাসা ভাড়া ব্যক্তিগত হিসাব',
      priority: 95,
    },
    {
      id: 'feat-voice',
      icon: 'voice',
      titleBn: 'ভয়েস এন্ট্রি',
      titleEn: 'Voice Entry',
      metaBn: 'মুখে বলে দ্রুত এন্ট্রি',
      metaEn: 'Quick voice logging',
      targetTab: 'dashboard',
      actionType: 'open_voice',
      keywords: 'voice mic speak ভয়েস ভয়েস মুখে বলে মাইক অডিও',
      priority: 94,
    },
    {
      id: 'feat-calculator',
      icon: 'calculator',
      titleBn: 'বেতন ও সুবিধা ক্যালকুলেটর',
      titleEn: 'Salary & Benefits Calculator',
      metaBn: 'ঈদ বোনাস, গ্র্যাচুইটি ও শ্রম আইন',
      metaEn: 'Eid bonus, gratuity & benefits',
      targetTab: 'more',
      targetSubView: 'calculator',
      keywords: 'calculator calc eid gratuity maternity increment ক্যালকুলেটর হিসাব ঈদ বোনাস গ্র্যাচুইটি মাতৃত্বকালীন ইনক্রিমেন্ট',
      priority: 92,
    },
    {
      id: 'feat-loans',
      icon: 'loans',
      titleBn: 'ধার-দেনা ও ঋণ হিসাব',
      titleEn: 'Personal Loans & Debt',
      metaBn: 'টাকা পাব, টাকা দেব ও কিস্তি',
      metaEn: 'Lent, borrowed & installments',
      targetTab: 'more',
      targetSubView: 'personal_loans',
      keywords: 'loan debt dhar dena pawna kisti ধার দেনা ঋণ পাওনা কিস্তি টাকা পাব টাকা দেব',
      priority: 91,
    },
    {
      id: 'feat-alarm',
      icon: 'alarm',
      titleBn: 'অ্যালার্ম',
      titleEn: 'Duty Alarm',
      metaBn: 'শিফট ও ডিউটি অ্যালার্ম',
      metaEn: 'Shift & wake alarms',
      targetTab: 'more',
      targetSubView: 'alarm',
      keywords: 'alarm wake siren bell duty shift অ্যালার্ম সময় ঘুম ডিউটি সাইরেন',
      priority: 90,
    },
    {
      id: 'feat-contacts',
      icon: 'contacts',
      titleBn: 'গার্মেন্টস ও কন্ট্যাক্ট বুক',
      titleEn: 'Garment & Contacts',
      metaBn: 'সুপারভাইজার, লাইন চিফ ও জরুরি নম্বর',
      metaEn: 'Supervisors & emergency contacts',
      targetTab: 'more',
      targetSubView: 'contacts',
      keywords: 'contact phone number supervisor line chief hr কন্ট্যাক্ট ফোন নম্বর সুপারভাইজার লাইন চিফ জরুরি',
      priority: 89,
    },
    {
      id: 'feat-factory',
      icon: 'factory',
      titleBn: 'কারখানা ও শিফট',
      titleEn: 'Factory & Shift',
      metaBn: 'কারখানা তথ্য ও শিফট রোটেশন',
      metaEn: 'Workplace & shift schedule',
      targetTab: 'more',
      targetSubView: 'factory',
      keywords: 'factory garment workplace shift day night rotation কারখানা গার্মেন্টস শিফট ডে নাইট লাইন পদবী চাকরি',
      priority: 88,
    },
    {
      id: 'feat-profile',
      icon: 'profile',
      titleBn: 'শ্রমিক প্রোফাইল',
      titleEn: 'Worker Profile',
      metaBn: 'ব্যক্তিগত তথ্য, ছবি ও পাসওয়ার্ড',
      metaEn: 'Personal info, photo & password',
      targetTab: 'more',
      targetSubView: 'profile',
      keywords: 'profile account name photo password email phone প্রোফাইল নাম ছবি পাসওয়ার্ড ইমেইল সেটিংস',
      priority: 87,
    },
    {
      id: 'feat-documents',
      icon: 'documents',
      titleBn: 'কাগজপত্র ভল্ট',
      titleEn: 'Document Vault',
      metaBn: 'আইডি কার্ড, নিয়োগপত্র ও নথি',
      metaEn: 'ID card, letters & files',
      targetTab: 'more',
      targetSubView: 'documents',
      keywords: 'document vault id card letter file pdf কাগজপত্র ভল্ট আইডি কার্ড নিয়োগপত্র নথি ফাইল',
      priority: 86,
    },
    {
      id: 'feat-reports',
      icon: 'reports',
      titleBn: 'রিপোর্টসমূহ ও ব্যাকআপ',
      titleEn: 'Reports & Backup',
      metaBn: 'মাসিক রিপোর্ট, PDF, CSV ও ব্যাকআপ',
      metaEn: 'Monthly reports, export & backup',
      targetTab: 'more',
      targetSubView: 'reports',
      keywords: 'report pdf csv export print backup রিপোর্ট ব্যাকআপ প্রিন্ট ডাউনলোড এক্সপোর্ট',
      priority: 85,
    },
    {
      id: 'feat-reminders',
      icon: 'reminders',
      titleBn: 'রিমাইন্ডার ও শ্রম আইন',
      titleEn: 'Reminders & Labor Law',
      metaBn: 'বেতনের তারিখ, বিল ও শ্রম আইন',
      metaEn: 'Due dates & labor law guide',
      targetTab: 'more',
      targetSubView: 'reminders',
      keywords: 'reminder law labor rule bill রিমাইন্ডার মনে করিয়ে শ্রম আইন ২০০৬ বিল',
      priority: 84,
    },
    {
      id: 'feat-announcements',
      icon: 'announcements',
      titleBn: 'অ্যাডমিন নোটিশ',
      titleEn: 'Admin Notices',
      metaBn: 'প্রকাশিত নোটিশ ও ঘোষণা',
      metaEn: 'Published notices & updates',
      targetTab: 'more',
      targetSubView: 'announcements',
      keywords: 'notice announcement admin update নোটিশ অ্যাডমিন নোটিশ ঘোষণা আপডেট',
      priority: 83,
    },
    {
      id: 'feat-support',
      icon: 'support',
      titleBn: 'সহায়তা ও নীতিমালা',
      titleEn: 'Support & Privacy',
      metaBn: 'সাপোর্ট মেসেজ ও গোপনীয়তা নীতি',
      metaEn: 'Support chat & privacy policy',
      targetTab: 'more',
      targetSubView: 'support',
      keywords: 'support help feedback bug privacy সহায়তা সাপোর্ট ফিডব্যাক সমস্যা নীতিমালা মেসেজ',
      priority: 82,
    },
    {
      id: 'feat-subscriptions',
      icon: 'subscriptions',
      titleBn: 'সাবস্ক্রিপশন ও প্ল্যান',
      titleEn: 'Subscriptions & Plans',
      metaBn: 'প্ল্যান আপগ্রেড ও রিনিউ',
      metaEn: 'Plans, upgrade & renewal',
      targetTab: 'more',
      targetSubView: 'subscriptions',
      keywords: 'subscription plan pro premium renew সাবস্ক্রিপশন প্ল্যান প্যাকেজ রিনিউ আপগ্রেড',
      priority: 80,
    },
  ];

  if (isAdminUser) {
    features.push({
      id: 'feat-admin',
      icon: 'admin',
      titleBn: 'অ্যাডমিন ড্যাশবোর্ড',
      titleEn: 'Admin Dashboard',
      metaBn: 'ইউজার, নোটিশ ও সাপোর্ট ব্যবস্থাপনা',
      metaEn: 'Users, notices & support control',
      targetTab: 'admin',
      keywords: 'admin dashboard user suspend role অ্যাডমিন ড্যাশবোর্ড ইউজার সাসপেন্ড',
      priority: 81,
    });
  }

  return features.map((f) => ({
    id: f.id,
    kind: 'feature',
    icon: f.icon,
    titleBn: f.titleBn,
    titleEn: f.titleEn,
    metaBn: f.metaBn,
    metaEn: f.metaEn,
    sectionLabelBn: 'ফিচার',
    sectionLabelEn: 'Feature',
    targetTab: f.targetTab,
    targetSubView: f.targetSubView,
    actionType: f.actionType || 'navigate',
    priority: f.priority,
    searchIndex: normalizeSearchText(`${f.titleBn} ${f.titleEn} ${f.metaBn} ${f.metaEn} ${f.keywords}`),
  }));
}

function buildDateQuickReportItems(
  dataset: SmartSearchDataset,
  parsed: ParsedDateQuery
): SmartSearchItem[] {
  const candidateDates = new Set<string>();
  const activeMonth = /^\d{4}-\d{2}$/.test(dataset.selectedMonth)
    ? dataset.selectedMonth
    : dataset.todayISO.slice(0, 7);

  if (parsed.exactDateISO) {
    candidateDates.add(parsed.exactDateISO);
  } else if (parsed.day) {
    // 1. Always add the matching day in the currently selected month (if valid for that month)
    const [selYear, selMonth] = activeMonth.split('-').map(Number);
    if (selYear && selMonth && parsed.day <= getDaysInYearMonth(selYear, selMonth)) {
      candidateDates.add(`${selYear}-${pad2(selMonth)}-${pad2(parsed.day)}`);
    }

    // 2. Also collect EVERY other month where the user has any record on that exact day
    const daySuffix = `-${pad2(parsed.day)}`;
    const collectIfDayMatches = (d?: string) => {
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d.endsWith(daySuffix)) {
        candidateDates.add(d);
      }
    };
    for (const r of dataset.attendance) collectIfDayMatches(r.date);
    for (const r of dataset.overtime) collectIfDayMatches(r.date);
    for (const r of dataset.expenses) collectIfDayMatches(r.date);
    for (const r of dataset.payments) collectIfDayMatches(r.paymentDate);
    for (const r of dataset.reminders) collectIfDayMatches(r.dueDate);
    for (const r of dataset.leaveApplications) collectIfDayMatches(r.startDate);
    for (const r of dataset.documents) collectIfDayMatches(r.issueDate);
  }

  const sortedDates = Array.from(candidateDates).sort((a, b) => {
    const aIsCurrent = a.startsWith(activeMonth) ? 1 : 0;
    const bIsCurrent = b.startsWith(activeMonth) ? 1 : 0;
    if (aIsCurrent !== bIsCurrent) return bIsCurrent - aIsCurrent;
    return b.localeCompare(a);
  });

  const results: SmartSearchItem[] = [];

  for (const dateISO of sortedDates.slice(0, 8)) {
    const monthStr = dateISO.slice(0, 7);
    const isCurrentMonth = monthStr === activeMonth;
    const att = dataset.attendance.find((a) => a.date === dateISO);
    const ots = dataset.overtime.filter((o) => o.date === dateISO);
    const exps = dataset.expenses.filter((e) => e.date === dateISO);
    const pays = dataset.payments.filter((p) => p.paymentDate === dateISO);
    const rems = dataset.reminders.filter((r) => r.dueDate === dateISO);

    const otHours = ots.reduce((sum, o) => sum + (Number(o.approvedHours) || 0), 0);
    const expTotal = exps.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const payTotal = pays.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);

    const summaryBnParts: string[] = [];
    const summaryEnParts: string[] = [];

    if (att) {
      summaryBnParts.push(ATTENDANCE_STATUS_BN[att.status] || att.status);
      summaryEnParts.push(ATTENDANCE_STATUS_EN[att.status] || att.status);
    }
    if (otHours > 0) {
      summaryBnParts.push(`ওটি ${formatNumber(otHours, 'bn', 1)} ঘণ্টা`);
      summaryEnParts.push(`OT ${formatNumber(otHours, 'en', 1)} hrs`);
    }
    if (expTotal > 0) {
      summaryBnParts.push(`খরচ ${formatBDT(expTotal, 'bn')}`);
      summaryEnParts.push(`Expense ${formatBDT(expTotal, 'en')}`);
    }
    if (payTotal > 0) {
      summaryBnParts.push(`পেমেন্ট ${formatBDT(payTotal, 'bn')}`);
      summaryEnParts.push(`Paid ${formatBDT(payTotal, 'en')}`);
    }
    if (rems.length > 0) {
      summaryBnParts.push(`রিমাইন্ডার ${formatNumber(rems.length, 'bn')}টি`);
      summaryEnParts.push(`${rems.length} reminder${rems.length > 1 ? 's' : ''}`);
    }

    const readableBn = formatDateReadable(dateISO, 'bn');
    const readableEn = formatDateReadable(dateISO, 'en');

    results.push({
      id: `date-report-${dateISO}`,
      kind: 'date_report',
      icon: 'date_report',
      titleBn: isCurrentMonth
        ? `${readableBn} · চলতি মাস`
        : `${readableBn} · অন্যান্য মাস`,
      titleEn: isCurrentMonth
        ? `${readableEn} · This Month`
        : `${readableEn} · Other Month`,
      metaBn:
        summaryBnParts.length > 0
          ? summaryBnParts.join(' · ')
          : 'কোনো এন্ট্রি নেই · হাজিরায় গিয়ে দেখুন বা যোগ করুন',
      metaEn:
        summaryEnParts.length > 0
          ? summaryEnParts.join(' · ')
          : 'No entries yet · Open in Attendance',
      sectionLabelBn: 'তারিখ রিপোর্ট',
      sectionLabelEn: 'Date Report',
      ctaLabelBn: 'হাজিরায় দেখুন',
      ctaLabelEn: 'Attendance',
      targetTab: 'attendance',
      focusDate: dateISO,
      targetMonth: monthStr,
      recordDate: dateISO,
      priority: isCurrentMonth ? 200 : 160,
      searchIndex: normalizeSearchText(`${dateISO} ${readableBn} ${readableEn}`),
    });
  }

  return results;
}

export function buildAllSmartSearchItems(dataset: SmartSearchDataset): SmartSearchItem[] {
  const { lang } = dataset;
  const items: SmartSearchItem[] = [...buildFeatureSearchItems(dataset.isAdminUser)];

  // 1. Worker Profile info (factory, designation, department, ID, phone)
  const p = dataset.profile;
  if (p.fullName || p.factoryName || p.employeeId) {
    const metaPartsBn = [p.factoryName, p.designation, p.department, p.employeeId]
      .filter(Boolean)
      .join(' · ');
    items.push({
      id: 'data-profile-main',
      kind: 'data',
      icon: 'profile',
      titleBn: p.fullName || 'শ্রমিক প্রোফাইল',
      titleEn: p.fullName || 'Worker Profile',
      metaBn: metaPartsBn || 'ব্যক্তিগত প্রোফাইল তথ্য',
      metaEn: metaPartsBn || 'Personal profile details',
      sectionLabelBn: 'প্রোফাইল',
      sectionLabelEn: 'Profile',
      targetTab: 'more',
      targetSubView: 'profile',
      priority: 65,
      searchIndex: normalizeSearchText(
        `${p.fullName} ${p.factoryName} ${p.factoryBranch} ${p.department} ${p.designation} ${p.employeeId} ${p.phone} ${p.address} ${p.salaryGrade} ${p.grossSalary} ${p.basicSalary}`
      ),
    });
  }

  // 2. Overtime records
  for (const ot of dataset.overtime) {
    const dateBn = formatDateReadable(ot.date, 'bn');
    const dateEn = formatDateReadable(ot.date, 'en');
    const hrsBn = formatNumber(ot.approvedHours, 'bn', 1);
    const hrsEn = formatNumber(ot.approvedHours, 'en', 1);
    const earnBn = formatBDT(ot.estimatedEarnings, 'bn');
    const earnEn = formatBDT(ot.estimatedEarnings, 'en');
    items.push({
      id: `data-ot-${ot.id}`,
      kind: 'data',
      icon: 'overtime',
      titleBn: ot.notes?.trim()
        ? `${ot.notes.trim()} (${hrsBn} ঘণ্টা)`
        : `ওভারটাইম ${hrsBn} ঘণ্টা · ${dateBn}`,
      titleEn: ot.notes?.trim()
        ? `${ot.notes.trim()} (${hrsEn} hrs)`
        : `Overtime ${hrsEn} hrs · ${dateEn}`,
      metaBn: `${dateBn} · ${earnBn}`,
      metaEn: `${dateEn} · ${earnEn}`,
      sectionLabelBn: 'ওভারটাইম',
      sectionLabelEn: 'Overtime',
      targetTab: 'overtime',
      targetMonth: ot.month,
      recordDate: ot.date,
      priority: 72,
      searchIndex: normalizeSearchText(
        `overtime ot ওভারটাইম ওটি ${ot.date} ${dateBn} ${dateEn} ${ot.month} ${ot.approvedHours} ${ot.estimatedEarnings} ${ot.startTime} ${ot.endTime} ${ot.notes || ''}`
      ),
    });
  }

  // 3. Attendance records
  for (const att of dataset.attendance) {
    const statusBn = ATTENDANCE_STATUS_BN[att.status] || att.status;
    const statusEn = ATTENDANCE_STATUS_EN[att.status] || att.status;
    const dateBn = formatDateReadable(att.date, 'bn');
    const dateEn = formatDateReadable(att.date, 'en');
    items.push({
      id: `data-att-${att.id}`,
      kind: 'data',
      icon: 'attendance',
      titleBn: `${statusBn} · ${dateBn}`,
      titleEn: `${statusEn} · ${dateEn}`,
      metaBn: [att.checkIn ? `ইন ${att.checkIn}` : '', att.notes?.trim() || '']
        .filter(Boolean)
        .join(' · ') || formatMonthLabel(att.month, 'bn'),
      metaEn: [att.checkIn ? `In ${att.checkIn}` : '', att.notes?.trim() || '']
        .filter(Boolean)
        .join(' · ') || formatMonthLabel(att.month, 'en'),
      sectionLabelBn: 'হাজিরা',
      sectionLabelEn: 'Attendance',
      targetTab: 'attendance',
      focusDate: att.date,
      targetMonth: att.month,
      recordDate: att.date,
      priority: 68,
      searchIndex: normalizeSearchText(
        `attendance hajira হাজিরা ${statusBn} ${statusEn} ${att.status} ${att.leaveCategory || ''} ${att.date} ${dateBn} ${dateEn} ${att.month} ${att.checkIn || ''} ${att.checkOut || ''} ${att.notes || ''}`
      ),
    });
  }

  // 4. Salary payments
  for (const pay of dataset.payments) {
    const methodBn = PAYMENT_METHOD_BN[pay.paymentMethod] || pay.paymentMethod;
    const dateBn = formatDateReadable(pay.paymentDate, 'bn');
    const dateEn = formatDateReadable(pay.paymentDate, 'en');
    items.push({
      id: `data-pay-${pay.id}`,
      kind: 'data',
      icon: 'salary',
      titleBn: pay.referenceNote?.trim()
        ? `${pay.referenceNote.trim()} (${formatBDT(pay.amountReceived, 'bn')})`
        : `বেতন পেমেন্ট ${formatBDT(pay.amountReceived, 'bn')}`,
      titleEn: pay.referenceNote?.trim()
        ? `${pay.referenceNote.trim()} (${formatBDT(pay.amountReceived, 'en')})`
        : `Salary Payment ${formatBDT(pay.amountReceived, 'en')}`,
      metaBn: `${dateBn} · ${methodBn}`,
      metaEn: `${dateEn} · ${pay.paymentMethod}`,
      sectionLabelBn: 'বেতন',
      sectionLabelEn: 'Salary',
      targetTab: 'salary',
      targetMonth: pay.month,
      recordDate: pay.paymentDate,
      priority: 74,
      searchIndex: normalizeSearchText(
        `salary payment beton বেতন পেমেন্ট ${pay.amountReceived} ${pay.paymentDate} ${dateBn} ${dateEn} ${pay.month} ${pay.paymentMethod} ${methodBn} ${pay.referenceNote || ''}`
      ),
    });
  }

  // 5. Salary records
  for (const sr of dataset.salaryRecords) {
    const mBn = formatMonthLabel(sr.month, 'bn');
    const mEn = formatMonthLabel(sr.month, 'en');
    items.push({
      id: `data-sr-${sr.id}`,
      kind: 'data',
      icon: 'salary',
      titleBn: `বেতন হিসাব · ${mBn}`,
      titleEn: `Salary Record · ${mEn}`,
      metaBn: `প্রাপ্য ${formatBDT(sr.estimatedNetPayable, 'bn')}${sr.notes ? ` · ${sr.notes}` : ''}`,
      metaEn: `Net ${formatBDT(sr.estimatedNetPayable, 'en')}${sr.notes ? ` · ${sr.notes}` : ''}`,
      sectionLabelBn: 'বেতন',
      sectionLabelEn: 'Salary',
      targetTab: 'salary',
      targetMonth: sr.month,
      recordDate: sr.effectiveDate,
      priority: 71,
      searchIndex: normalizeSearchText(
        `salary record beton বেতন হিসাব ${sr.month} ${mBn} ${mEn} ${sr.estimatedNetPayable} ${sr.estimatedGross} ${sr.basicSalary} ${sr.notes || ''}`
      ),
    });
  }

  // 6. Expenses
  for (const exp of dataset.expenses) {
    const catBn = EXPENSE_CATEGORY_BN[exp.category] || exp.category;
    const catEn = EXPENSE_CATEGORY_EN[exp.category] || exp.category;
    const dateBn = formatDateReadable(exp.date, 'bn');
    const dateEn = formatDateReadable(exp.date, 'en');
    items.push({
      id: `data-exp-${exp.id}`,
      kind: 'data',
      icon: 'expenses',
      titleBn: exp.description?.trim() || catBn,
      titleEn: exp.description?.trim() || catEn,
      metaBn: `${formatBDT(exp.amount, 'bn')} · ${catBn} · ${dateBn}`,
      metaEn: `${formatBDT(exp.amount, 'en')} · ${catEn} · ${dateEn}`,
      sectionLabelBn: 'খরচ',
      sectionLabelEn: 'Expense',
      targetTab: 'expenses',
      targetMonth: exp.month,
      recordDate: exp.date,
      priority: 75,
      searchIndex: normalizeSearchText(
        `expense khoroch খরচ ব্যয় ${exp.description || ''} ${catBn} ${catEn} ${exp.category} ${exp.amount} ${exp.date} ${dateBn} ${dateEn} ${exp.month}`
      ),
    });
  }

  // 7. Savings goals
  for (const sg of dataset.savings) {
    items.push({
      id: `data-sav-${sg.id}`,
      kind: 'data',
      icon: 'savings',
      titleBn: sg.title,
      titleEn: sg.title,
      metaBn: `জমা ${formatBDT(sg.savedAmount, 'bn')} / ${formatBDT(sg.targetAmount, 'bn')}`,
      metaEn: `Saved ${formatBDT(sg.savedAmount, 'en')} / ${formatBDT(sg.targetAmount, 'en')}`,
      sectionLabelBn: 'সঞ্চয়',
      sectionLabelEn: 'Savings',
      targetTab: 'expenses',
      priority: 73,
      searchIndex: normalizeSearchText(
        `savings sonchoy সঞ্চয় জমা ${sg.title} ${sg.savedAmount} ${sg.targetAmount} ${sg.storageLocation || ''} ${sg.notes || ''}`
      ),
    });
  }

  // 8. Personal loans (ধার-দেনা)
  for (const loan of dataset.loans) {
    const name = loan.personName || loan.title || (lang === 'bn' ? 'ব্যক্তিগত লেনদেন' : 'Personal Loan');
    const amt = loan.originalAmount ?? loan.totalLoanAmount ?? 0;
    const dirBn = loan.direction === 'lent' ? 'টাকা পাব' : 'টাকা দেব';
    const dirEn = loan.direction === 'lent' ? 'Receivable' : 'Payable';
    items.push({
      id: `data-loan-${loan.id}`,
      kind: 'data',
      icon: 'loans',
      titleBn: `${name} (${formatBDT(amt, 'bn')})`,
      titleEn: `${name} (${formatBDT(amt, 'en')})`,
      metaBn: [dirBn, loan.reason || loan.notes || ''].filter(Boolean).join(' · '),
      metaEn: [dirEn, loan.reason || loan.notes || ''].filter(Boolean).join(' · '),
      sectionLabelBn: 'ধার-দেনা',
      sectionLabelEn: 'Loans',
      targetTab: 'more',
      targetSubView: 'personal_loans',
      recordDate: loan.transactionDate,
      priority: 76,
      searchIndex: normalizeSearchText(
        `loan debt dhar dena pawna ধার দেনা ঋণ পাওনা ${dirBn} ${dirEn} ${name} ${loan.title || ''} ${loan.contactNumber || ''} ${amt} ${loan.reason || ''} ${loan.notes || ''} ${loan.transactionDate || ''}`
      ),
    });
  }

  // 9. Contacts
  for (const c of dataset.contacts) {
    items.push({
      id: `data-contact-${c.id}`,
      kind: 'data',
      icon: 'contacts',
      titleBn: c.fullName,
      titleEn: c.fullName,
      metaBn: [c.phone, c.designation || c.department || ''].filter(Boolean).join(' · '),
      metaEn: [c.phone, c.designation || c.department || ''].filter(Boolean).join(' · '),
      sectionLabelBn: 'কন্ট্যাক্ট',
      sectionLabelEn: 'Contact',
      targetTab: 'more',
      targetSubView: 'contacts',
      priority: 77,
      searchIndex: normalizeSearchText(
        `contact phone number কন্ট্যাক্ট ফোন নম্বর ${c.fullName} ${c.phone} ${c.designation || ''} ${c.department || ''} ${c.lineNumber || ''} ${c.category || ''} ${c.customCategory || ''} ${c.notes || ''}`
      ),
    });
  }

  // 10. Workplaces
  for (const wp of dataset.workplaces) {
    items.push({
      id: `data-wp-${wp.id}`,
      kind: 'data',
      icon: 'factory',
      titleBn: wp.factoryName,
      titleEn: wp.factoryName,
      metaBn: [wp.designation, wp.department, wp.factoryArea].filter(Boolean).join(' · '),
      metaEn: [wp.designation, wp.department, wp.factoryArea].filter(Boolean).join(' · '),
      sectionLabelBn: 'কারখানা',
      sectionLabelEn: 'Factory',
      targetTab: 'more',
      targetSubView: 'factory',
      priority: 74,
      searchIndex: normalizeSearchText(
        `factory garment workplace কারখানা গার্মেন্টস ${wp.factoryName} ${wp.factoryArea} ${wp.factoryAddress} ${wp.department} ${wp.designation} ${wp.lineNumber} ${wp.supervisorName || ''} ${wp.notes || ''}`
      ),
    });
  }

  // 11. Reminders
  for (const rem of dataset.reminders) {
    const dateBn = rem.dueDate ? formatDateReadable(rem.dueDate, 'bn') : '';
    const dateEn = rem.dueDate ? formatDateReadable(rem.dueDate, 'en') : '';
    items.push({
      id: `data-rem-${rem.id}`,
      kind: 'data',
      icon: 'reminders',
      titleBn: rem.title,
      titleEn: rem.title,
      metaBn: [dateBn, rem.notes?.trim() || ''].filter(Boolean).join(' · ') || 'রিমাইন্ডার',
      metaEn: [dateEn, rem.notes?.trim() || ''].filter(Boolean).join(' · ') || 'Reminder',
      sectionLabelBn: 'রিমাইন্ডার',
      sectionLabelEn: 'Reminder',
      targetTab: 'more',
      targetSubView: 'reminders',
      recordDate: rem.dueDate,
      priority: 70,
      searchIndex: normalizeSearchText(
        `reminder রিমাইন্ডার ${rem.title} ${rem.category} ${rem.dueDate} ${dateBn} ${dateEn} ${rem.notes || ''}`
      ),
    });
  }

  // 12. Vault Documents
  for (const d of dataset.documents) {
    items.push({
      id: `data-doc-${d.id}`,
      kind: 'data',
      icon: 'documents',
      titleBn: d.title || d.fileName,
      titleEn: d.title || d.fileName,
      metaBn: [d.fileName, d.issueDate ? formatDateReadable(d.issueDate, 'bn') : '']
        .filter(Boolean)
        .join(' · '),
      metaEn: [d.fileName, d.issueDate ? formatDateReadable(d.issueDate, 'en') : '']
        .filter(Boolean)
        .join(' · '),
      sectionLabelBn: 'কাগজপত্র',
      sectionLabelEn: 'Document',
      targetTab: 'more',
      targetSubView: 'documents',
      recordDate: d.issueDate,
      priority: 70,
      searchIndex: normalizeSearchText(
        `document vault কাগজপত্র ভল্ট নথি ${d.title} ${d.fileName} ${d.category} ${d.issueDate} ${d.notes || ''}`
      ),
    });
  }

  // 13. Alarms
  for (const al of dataset.alarms) {
    items.push({
      id: `data-alarm-${al.id}`,
      kind: 'data',
      icon: 'alarm',
      titleBn: al.label ? `${al.label} (${al.time})` : `অ্যালার্ম ${al.time}`,
      titleEn: al.label ? `${al.label} (${al.time})` : `Alarm ${al.time}`,
      metaBn: al.isEnabled ? 'চালু আছে' : 'বন্ধ আছে',
      metaEn: al.isEnabled ? 'Active' : 'Off',
      sectionLabelBn: 'অ্যালার্ম',
      sectionLabelEn: 'Alarm',
      targetTab: 'more',
      targetSubView: 'alarm',
      priority: 69,
      searchIndex: normalizeSearchText(`alarm অ্যালার্ম সময় ${al.time} ${al.label || ''}`),
    });
  }

  // 14. Leave Applications
  for (const lv of dataset.leaveApplications) {
    const startBn = formatDateReadable(lv.startDate, 'bn');
    const startEn = formatDateReadable(lv.startDate, 'en');
    items.push({
      id: `data-leave-${lv.id}`,
      kind: 'data',
      icon: 'attendance',
      titleBn: lv.reason?.trim() ? `ছুটি: ${lv.reason.trim()}` : `ছুটির আবেদন · ${startBn}`,
      titleEn: lv.reason?.trim() ? `Leave: ${lv.reason.trim()}` : `Leave Application · ${startEn}`,
      metaBn: `${startBn} · ${formatNumber(lv.totalDays, 'bn')} দিন`,
      metaEn: `${startEn} · ${lv.totalDays} days`,
      sectionLabelBn: 'ছুটি',
      sectionLabelEn: 'Leave',
      targetTab: 'attendance',
      focusDate: lv.startDate,
      targetMonth: lv.startDate.slice(0, 7),
      recordDate: lv.startDate,
      priority: 69,
      searchIndex: normalizeSearchText(
        `leave chuti ছুটি আবেদন ${lv.leaveType} ${lv.status} ${lv.startDate} ${lv.endDate} ${startBn} ${startEn} ${lv.reason || ''}`
      ),
    });
  }

  // 15. Published Admin Notices
  for (const ann of dataset.publishedAnnouncements) {
    items.push({
      id: `data-ann-${ann.id}`,
      kind: 'data',
      icon: 'announcements',
      titleBn: ann.titleBn || ann.titleEn || 'অ্যাডমিন নোটিশ',
      titleEn: ann.titleEn || ann.titleBn || 'Admin Notice',
      metaBn: (ann.messageBn || ann.messageEn || '').slice(0, 80),
      metaEn: (ann.messageEn || ann.messageBn || '').slice(0, 80),
      sectionLabelBn: 'নোটিশ',
      sectionLabelEn: 'Notice',
      targetTab: 'more',
      targetSubView: 'announcements',
      priority: 71,
      searchIndex: normalizeSearchText(
        `notice announcement নোটিশ ঘোষণা ${ann.titleBn} ${ann.titleEn} ${ann.messageBn} ${ann.messageEn} ${ann.category}`
      ),
    });
  }

  // 16. Support Feedback
  for (const fb of dataset.feedbackList) {
    const replyText = (fb.replies || []).map((r) => r.message).join(' ');
    items.push({
      id: `data-fb-${fb.id}`,
      kind: 'data',
      icon: 'support',
      titleBn: fb.subject?.trim() || fb.message.slice(0, 56),
      titleEn: fb.subject?.trim() || fb.message.slice(0, 56),
      metaBn: fb.status === 'resolved' ? 'সমাধান হয়েছে' : 'সাপোর্ট মেসেজ',
      metaEn: fb.status === 'resolved' ? 'Resolved' : 'Support message',
      sectionLabelBn: 'সহায়তা',
      sectionLabelEn: 'Support',
      targetTab: 'more',
      targetSubView: 'support',
      priority: 66,
      searchIndex: normalizeSearchText(
        `support feedback help সাপোর্ট সহায়তা ${fb.subject || ''} ${fb.message} ${fb.category} ${replyText}`
      ),
    });
  }

  return items;
}

export function runSmartSearch(
  allItems: SmartSearchItem[],
  query: string,
  options?: {
    maxFeatures?: number;
    maxData?: number;
    dataset?: SmartSearchDataset;
  }
): { dateReports: SmartSearchItem[]; features: SmartSearchItem[]; data: SmartSearchItem[] } {
  const maxFeatures = options?.maxFeatures ?? 8;
  const maxData = options?.maxData ?? 12;
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    const quickFeatures = allItems
      .filter((i) => i.kind === 'feature')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6);
    return { dateReports: [], features: quickFeatures, data: [] };
  }

  const dataset = options?.dataset;
  const parsedDate = dataset
    ? parseSmartDateQuery(normalizedQuery, dataset.selectedMonth, dataset.todayISO)
    : null;
  const dateReports =
    parsedDate && dataset ? buildDateQuickReportItems(dataset, parsedDate) : [];

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const scored: Array<{ item: SmartSearchItem; score: number }> = [];
  const activeMonth = dataset?.selectedMonth || '';

  for (const item of allItems) {
    const idx = item.searchIndex;

    // Smart date-based matching on data records (e.g. searching "১৯" or "১৯ তারিখ" matches every 19th across all months!)
    let matchedByDate = false;
    if (parsedDate && item.kind === 'data' && item.recordDate) {
      if (parsedDate.exactDateISO && item.recordDate === parsedDate.exactDateISO) {
        matchedByDate = true;
      } else if (
        !parsedDate.exactDateISO &&
        parsedDate.day &&
        item.recordDate.endsWith(`-${pad2(parsedDate.day)}`)
      ) {
        matchedByDate = true;
      }
    }

    const matchedByText = tokens.every((tok) => idx.includes(tok));
    if (!matchedByDate && !matchedByText) {
      continue;
    }

    const titleNorm = normalizeSearchText(`${item.titleBn} ${item.titleEn}`);
    let score = item.priority;

    if (matchedByDate) {
      score += 80;
      if (activeMonth && item.recordDate?.startsWith(activeMonth)) {
        score += 40;
      }
    }
    if (titleNorm.startsWith(normalizedQuery)) {
      score += 60;
    } else if (titleNorm.includes(normalizedQuery)) {
      score += 35;
    } else if (tokens.some((tok) => titleNorm.includes(tok))) {
      score += 20;
    }
    if (item.kind === 'feature') {
      score += 10;
    }

    scored.push({ item, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.item.recordDate || '').localeCompare(a.item.recordDate || '');
  });

  const features: SmartSearchItem[] = [];
  const data: SmartSearchItem[] = [];

  for (const entry of scored) {
    if (entry.item.kind === 'feature') {
      if (features.length < maxFeatures) features.push(entry.item);
    } else {
      if (data.length < maxData) data.push(entry.item);
    }
  }

  return { dateReports, features, data };
}
