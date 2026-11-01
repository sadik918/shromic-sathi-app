import type { Language } from '../types';
import { toBengaliDigits } from './calculations';

const BN_MONTHS: Record<string, string> = {
  '01': 'জানুয়ারি',
  '02': 'ফেব্রুয়ারি',
  '03': 'মার্চ',
  '04': 'এপ্রিল',
  '05': 'মে',
  '06': 'জুন',
  '07': 'জুলাই',
  '08': 'আগস্ট',
  '09': 'সেপ্টেম্বর',
  '10': 'অক্টোবর',
  '11': 'নভেম্বর',
  '12': 'ডিসেম্বর',
};

const EN_MONTHS: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

export function formatMonthLabel(monthStr: string, lang: Language): string {
  const [year, month] = monthStr.split('-');
  if (!year || !month) return monthStr;
  if (lang === 'bn') {
    return `${BN_MONTHS[month] || month} ${toBengaliDigits(year)}`;
  }
  return `${EN_MONTHS[month] || month} ${year}`;
}

export function formatShortMonthName(monthStr: string, lang: Language): string {
  const [, month] = monthStr.split('-');
  if (!month) return monthStr;
  if (lang === 'bn') {
    return BN_MONTHS[month] || month;
  }
  return EN_MONTHS[month] || month;
}

export function formatDateReadable(dateStr: string, lang: Language): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  if (lang === 'bn') {
    return `${toBengaliDigits(Number(d))} ${BN_MONTHS[m] || m}, ${toBengaliDigits(y)}`;
  }
  return `${Number(d)} ${EN_MONTHS[m] || m} ${y}`;
}

/**
 * Formats an ISO date string (YYYY-MM-DD) strictly as Date/Month/Year (DD/MM/YYYY),
 * e.g., ২৭/১০/২০২৬ in Bengali or 27/10/2026 in English.
 */
export function formatDateSlashDMY(dateStr: string, lang: Language = 'bn'): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  const formatted = `${dd}/${mm}/${y}`;
  return lang === 'bn' ? toBengaliDigits(formatted) : formatted;
}

export function formatDateShortBn(dateStr: string, lang: Language = 'bn'): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [, m, d] = parts;
  if (lang === 'bn') {
    return `${toBengaliDigits(Number(d))}ই ${BN_MONTHS[m] || m}`;
  }
  return `${Number(d)} ${EN_MONTHS[m] || m}`;
}


export const T = {
  bn: {
    appTitle: 'শ্রমিক সাথী',
    appSubtitle: 'বাংলাদেশ গার্মেন্টস শ্রমিক ডিজিটাল সহকারী',
    navDashboard: 'হোম',
    navOvertime: 'ওভারটাইম',
    navSalary: 'বেতন',
    navAttendance: 'হাজিরা',
    navExpenses: 'হিসাব',
    navMore: 'আরও',
    demoBanner: 'ডেমো মোড সক্রিয় — এটি নমুনা তথ্য, আপনার ব্যক্তিগত একাউন্টের তথ্যের সাথে যুক্ত নয়',
    exitDemo: 'ডেমো বন্ধ করুন',
    syncSynced: 'সংরক্ষিত',
    syncPending: 'সিঙ্ক হচ্ছে...',
    syncOffline: 'অফলাইন মোড',
    voiceEntryBtn: 'কণ্ঠস্বর এন্ট্রি',
    expectedSalary: 'সম্ভাব্য মোট বেতন (এই মাস)',
    receivedSalary: 'প্রাপ্ত বেতন (আসল জমা)',
    overtimeSummary: 'ওভারটাইম ঘণ্টা ও আয়',
    attendanceSummary: 'উপস্থিতি ও কর্মদিবস',
    outstandingBalance: 'বকেয়া বেতন স্থিতি',
    monthlySavings: 'ব্যক্তিগত ব্যয় ও সঞ্চয়',
    estimateDisclaimer:
      'বিঃদ্রঃ এই হিসাবটি আপনার প্রদত্ত তথ্যের ভিত্তিতে একটি ব্যক্তিগত আনুমানিক হিসাব (Estimate)। এটি কারখানার অফিসিয়াল পে-রোল স্লিপ নয়।',
    date: 'তারিখ',
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    edit: 'এডিট',
    delete: 'মুছুন',
    notes: 'নোট / বিবরণ',
    presentDays: 'উপস্থিত',
    lateDays: 'দেরি',
    approvedLeaveDays: 'ছুটি',
    absentDays: 'অনুপস্থিত',
    targetAmount: 'লক্ষ্যমাত্রা (৳)',
    savedAmount: 'জমানো টাকা (৳)',
    monthlyBudget: 'মাসিক বাজেট (৳)',
  },
  en: {
    appTitle: 'Shromik Sathi',
    appSubtitle: 'Bangladesh Garment Worker Digital Assistant',
    navDashboard: 'Home',
    navOvertime: 'Overtime',
    navSalary: 'Salary',
    navAttendance: 'Attendance',
    navExpenses: 'Finances',
    navMore: 'More',
    demoBanner: 'Demo Environment Active — Sample records isolated from real accounts',
    exitDemo: 'Exit Demo',
    syncSynced: 'Synced',
    syncPending: 'Syncing...',
    syncOffline: 'Offline Mode',
    voiceEntryBtn: 'Voice Entry',
    expectedSalary: 'Expected Salary (This Month)',
    receivedSalary: 'Actual Salary Received',
    overtimeSummary: 'Overtime Hours & Est. Pay',
    attendanceSummary: 'Attendance & Working Days',
    outstandingBalance: 'Outstanding Salary Balance',
    monthlySavings: 'Expenses & Savings',
    estimateDisclaimer:
      'Note: All calculated totals are personal estimates based on your saved settings, not an official factory payroll slip.',
    date: 'Date',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    notes: 'Notes',
    presentDays: 'Present',
    lateDays: 'Late',
    approvedLeaveDays: 'Leave',
    absentDays: 'Absent',
    targetAmount: 'Target (৳)',
    savedAmount: 'Saved (৳)',
    monthlyBudget: 'Budget (৳)',
  },
};
