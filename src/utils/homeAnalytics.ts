import type {
  AttendanceRecord,
  ExpenseCategory,
  ExpenseRecord,
  GarmentWorkplace,
  Language,
  OvertimeRecord,
  PersonalLoan,
  SalaryPayment,
  SalaryRecord,
  SavingsGoal,
  WorkerProfile,
} from '../types';
import {
  calculateAttendanceBonusEligibility,
  calculateSalaryTotals,
  computeDailyEarnedSalary,
  computeWorkplaceTenureAnalytics,
  formatNumber,
  getLoanDirection,
  getLoanOriginalAmount,
  getLoanPersonName,
  getLoanRemainingBalance,
  getLoanRepaymentsTotal,
  isOtherIncomePayment,
  roundCurrency,
  summarizeAttendanceForMonth,
  summarizeMonthlyPayments,
  summarizeOvertimeRecords,
  summarizePersonalFinances,
  summarizePersonalLoans,
} from './calculations';
import { stepMonthISO } from './calendarReminders';
import { formatMonthLabel, formatShortMonthName } from './i18n';

export interface AnalyticsPieSlice {
  key: string;
  nameBn: string;
  nameEn: string;
  subLabelBn?: string;
  subLabelEn?: string;
  value: number;
  percent: number;
  color: string;
}

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  earnedSalary: number;
  receivedSalary: number;
  overtimeEarnings: number;
  overtimeHours: number;
  expenses: number;
  presentDays: number;
  absentDays: number;
}

export interface HomeOverviewAnalytics {
  selectedMonth: string;
  kpis: {
    attendanceRatePct: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    approvedLeaveDays: number;
    holidayDays: number;
    totalTrackedDays: number;
    basicSalary: number;
    houseRentAllowance: number;
    otherFixedAllowances: number;
    bonusesTotal: number;
    otHours: number;
    otEarnings: number;
    otSharePct: number;
    earnedSalary: number;
    fullExpectedSalary: number;
    receivedSalary: number;
    salaryCollectionPct: number;
    outstandingBalance: number;
    otherIncome: number;
    totalIncome: number;
    totalExpenses: number;
    expenseRatioPct: number;
    netCashflow: number;
    totalSaved: number;
    totalSavingsTarget: number;
    savingsProgressPct: number;
    loanRemaining: number;
  };
  attendanceSlices: AnalyticsPieSlice[];
  salarySlices: AnalyticsPieSlice[];
  expenseCategorySlices: AnalyticsPieSlice[];
  monthlyTrend: MonthlyTrendPoint[];
  latestPopulatedAttendanceMonth: string | null;
  latestPopulatedExpenseMonth: string | null;
}

const EXPENSE_META: Record<
  ExpenseCategory,
  { nameBn: string; nameEn: string; color: string }
> = {
  rent: { nameBn: 'বাসা ভাড়া ও বিল', nameEn: 'Rent & Bills', color: '#0D9488' },
  food: { nameBn: 'খাবার ও বাজার', nameEn: 'Food & Grocery', color: '#059669' },
  family: { nameBn: 'পরিবার', nameEn: 'Family', color: '#4F46E5' },
  transport: { nameBn: 'যাতায়াত', nameEn: 'Transport', color: '#2563EB' },
  medical: { nameBn: 'চিকিৎসা', nameEn: 'Medical', color: '#E11D48' },
  education: { nameBn: 'পড়াশোনা', nameEn: 'Education', color: '#7C3AED' },
  other: { nameBn: 'অন্যান্য', nameEn: 'Other', color: '#64748B' },
};

function computeMonthSnapshot(params: {
  month: string;
  profile: WorkerProfile;
  attendance: AttendanceRecord[];
  overtime: OvertimeRecord[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
  expenses: ExpenseRecord[];
}) {
  const { month, profile, attendance, overtime, salaryRecords, payments, expenses } = params;
  const monthAtt = attendance.filter((a) => a.month === month);
  const monthPayments = payments.filter((p) => p.month === month);
  const monthExpenses = expenses.filter((e) => e.month === month);
  const otSum = summarizeOvertimeRecords(overtime, month);
  const savedSal = salaryRecords.find((s) => s.month === month);

  const basic = savedSal ? savedSal.basicSalary : profile.basicSalary || 0;
  const houseRent = savedSal ? savedSal.houseRentAllowance : profile.houseRentAllowance || 0;
  const medical = savedSal ? savedSal.medicalAllowance : profile.medicalAllowance || 0;
  const transport = savedSal ? savedSal.transportAllowance : profile.transportAllowance || 0;
  const food = savedSal ? savedSal.foodAllowance : profile.foodAllowance || 0;
  const attBonusAmount = savedSal ? savedSal.attendanceBonus : profile.attendanceBonus || 0;
  const festivalBonus = savedSal ? savedSal.festivalBonus || 0 : 0;
  const otherAllowances = savedSal ? savedSal.otherAllowances || 0 : 0;

  const computed = calculateSalaryTotals({
    basicSalary: basic,
    houseRentAllowance: houseRent,
    medicalAllowance: medical,
    transportAllowance: transport,
    foodAllowance: food,
    attendanceBonus: attBonusAmount,
    overtimeEarnings: otSum.monthlyEarnings,
    festivalBonus,
    otherAllowances,
    advanceDeduction: savedSal ? savedSal.advanceDeduction : 0,
    absenceDeduction: savedSal ? savedSal.absenceDeduction : 0,
    otherDeductions: savedSal ? savedSal.otherDeductions : 0,
    adjustments: savedSal ? savedSal.adjustments : 0,
  });

  const attBonusEval = calculateAttendanceBonusEligibility({
    recordsForMonth: monthAtt,
    profile,
  });

  const monthlyWageBase =
    (profile.grossSalary > 0 ? profile.grossSalary : 0) ||
    computed.baseGross ||
    profile.basicSalary ||
    12500;

  const earnedBreakdown = computeDailyEarnedSalary({
    monthlyWage: monthlyWageBase,
    attendanceRecords: monthAtt,
    overtimeEarnings: otSum.monthlyEarnings,
    attendanceBonus: attBonusAmount,
    isAttendanceBonusEligible: attBonusEval.isEligible,
    otherAllowances: festivalBonus + otherAllowances,
    deductions: savedSal
      ? savedSal.advanceDeduction + savedSal.absenceDeduction + savedSal.otherDeductions
      : 0,
    adjustments: savedSal ? savedSal.adjustments : 0,
  });

  const attSummary = summarizeAttendanceForMonth(monthAtt);
  const paySummary = summarizeMonthlyPayments(earnedBreakdown.totalEarnedSalary, monthPayments);
  const otherIncome = roundCurrency(
    monthPayments
      .filter((p) => isOtherIncomePayment(p))
      .reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0)
  );
  const totalExpenses = roundCurrency(
    monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  );

  let resolvedEarnedSalary = earnedBreakdown.totalEarnedSalary;
  if (monthAtt.length === 0) {
    if (savedSal) {
      resolvedEarnedSalary = savedSal.estimatedNetPayable;
    } else if (paySummary.totalReceived > 0 || otSum.monthlyEarnings > 0) {
      resolvedEarnedSalary = Math.max(paySummary.totalReceived, otSum.monthlyEarnings);
    } else {
      resolvedEarnedSalary = 0;
    }
  }

  return {
    basic,
    houseRent,
    otherFixedAllowances: roundCurrency(medical + transport + food),
    bonusesTotal: roundCurrency(
      (attBonusEval.isEligible ? attBonusAmount : 0) + festivalBonus + otherAllowances
    ),
    otHours: otSum.monthlyHours,
    otEarnings: otSum.monthlyEarnings,
    earnedSalary: resolvedEarnedSalary,
    fullExpectedSalary: earnedBreakdown.fullExpectedMonthlySalary,
    receivedSalary: paySummary.totalReceived,
    otherIncome,
    totalExpenses,
    attSummary,
    monthAttCount: monthAtt.length,
    monthExpenses,
  };
}

function attachPercents(
  raw: Array<Omit<AnalyticsPieSlice, 'percent'>>
): AnalyticsPieSlice[] {
  const positive = raw.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return [];
  return positive.map((s) => ({
    ...s,
    percent: Math.round((s.value / total) * 100),
  }));
}

export function buildHomeOverviewAnalytics(params: {
  selectedMonth: string;
  lang: Language;
  profile: WorkerProfile;
  attendance: AttendanceRecord[];
  overtime: OvertimeRecord[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
  expenses: ExpenseRecord[];
  savings: SavingsGoal[];
  loans: PersonalLoan[];
}): HomeOverviewAnalytics {
  const {
    selectedMonth,
    lang,
    profile,
    attendance,
    overtime,
    salaryRecords,
    payments,
    expenses,
    savings,
    loans,
  } = params;

  const curr = computeMonthSnapshot({
    month: selectedMonth,
    profile,
    attendance,
    overtime,
    salaryRecords,
    payments,
    expenses,
  });

  const monthPayments = payments.filter((p) => p.month === selectedMonth);
  const financeSummary = summarizePersonalFinances(monthPayments, curr.monthExpenses, savings);
  const loanSummary = summarizePersonalLoans(loans);

  const {
    presentDays,
    lateDays,
    absentDays,
    approvedLeaveDays,
    weeklyHolidays,
    publicHolidays,
  } = curr.attSummary;

  const holidayDays = weeklyHolidays + publicHolidays;
  const workOpportunityDays = presentDays + lateDays + absentDays;
  const attendanceRatePct =
    workOpportunityDays > 0
      ? Math.round(((presentDays + lateDays) / workOpportunityDays) * 100)
      : 0;

  const attendanceSlices = attachPercents([
    { key: 'present', nameBn: 'উপস্থিত', nameEn: 'Present', value: presentDays, color: '#059669' },
    {
      key: 'holidays',
      nameBn: 'সাপ্তাহিক ও সরকারি ছুটি',
      nameEn: 'Weekly & Govt Holidays',
      subLabelBn:
        publicHolidays > 0
          ? `সাপ্তাহিক ${formatNumber(weeklyHolidays, 'bn')} + সরকারি ${formatNumber(publicHolidays, 'bn')}`
          : `সাপ্তাহিক ${formatNumber(weeklyHolidays, 'bn')} দিন`,
      subLabelEn:
        publicHolidays > 0
          ? `Weekly ${weeklyHolidays} + Govt ${publicHolidays}`
          : `Weekly ${weeklyHolidays} days`,
      value: holidayDays,
      color: '#0EA5E9',
    },
    {
      key: 'approved_leave',
      nameBn: 'অনুমোদিত ছুটি',
      nameEn: 'Approved Leave',
      value: approvedLeaveDays,
      color: '#4F46E5',
    },
    { key: 'late', nameBn: 'দেরি', nameEn: 'Late', value: lateDays, color: '#D97706' },
    { key: 'absent', nameBn: 'অনুপস্থিত', nameEn: 'Absent', value: absentDays, color: '#E11D48' },
  ]);

  const salarySlices = attachPercents([
    {
      key: 'basic',
      nameBn: 'মূল বেতন',
      nameEn: 'Basic Salary',
      value: curr.basic,
      color: '#059669',
    },
    {
      key: 'house_rent',
      nameBn: 'বাড়ি ভাড়া',
      nameEn: 'House Rent',
      value: curr.houseRent,
      color: '#0D9488',
    },
    {
      key: 'allowances',
      nameBn: 'চিকিৎসা, যাতায়াত ও খাদ্য',
      nameEn: 'Allowances',
      value: curr.otherFixedAllowances,
      color: '#2563EB',
    },
    {
      key: 'overtime',
      nameBn: `ওভারটাইম আয় (${formatNumber(curr.otHours, 'bn', 1)} ঘণ্টা)`,
      nameEn: `Overtime Pay (${curr.otHours}h)`,
      value: curr.otEarnings,
      color: '#D97706',
    },
    {
      key: 'bonuses',
      nameBn: 'হাজিরা ও অন্যান্য বোনাস',
      nameEn: 'Bonuses',
      value: curr.bonusesTotal,
      color: '#7C3AED',
    },
  ]);

  const expenseCategorySlices = attachPercents(
    (Object.keys(EXPENSE_META) as ExpenseCategory[])
      .map((cat) => ({
        key: cat,
        nameBn: EXPENSE_META[cat].nameBn,
        nameEn: EXPENSE_META[cat].nameEn,
        value: financeSummary.byCategory[cat] || 0,
        color: EXPENSE_META[cat].color,
      }))
      .sort((a, b) => b.value - a.value)
  );

  // 6-month historical trend ending at selectedMonth
  const trendMonths: string[] = [];
  for (let offset = -5; offset <= 0; offset++) {
    trendMonths.push(stepMonthISO(selectedMonth, offset));
  }

  const monthlyTrend: MonthlyTrendPoint[] = trendMonths.map((m) => {
    const snap = computeMonthSnapshot({
      month: m,
      profile,
      attendance,
      overtime,
      salaryRecords,
      payments,
      expenses,
    });
    return {
      month: m,
      label: formatShortMonthName(m, lang),
      earnedSalary: Math.round(snap.earnedSalary),
      receivedSalary: Math.round(snap.receivedSalary),
      overtimeEarnings: Math.round(snap.otEarnings),
      overtimeHours: snap.otHours,
      expenses: Math.round(snap.totalExpenses),
      presentDays: snap.attSummary.workingDays,
      absentDays: snap.attSummary.absentDays,
    };
  });

  const totalSalaryMix =
    curr.basic + curr.houseRent + curr.otherFixedAllowances + curr.otEarnings + curr.bonusesTotal;
  const otSharePct =
    totalSalaryMix > 0 ? Math.round((curr.otEarnings / totalSalaryMix) * 100) : 0;

  const totalIncome = roundCurrency(curr.receivedSalary + curr.otherIncome);
  const incomeBaseForExpense = totalIncome > 0 ? totalIncome : curr.earnedSalary;
  const expenseRatioPct =
    incomeBaseForExpense > 0
      ? Math.min(999, Math.round((curr.totalExpenses / incomeBaseForExpense) * 100))
      : 0;

  const salaryCollectionPct =
    curr.earnedSalary > 0
      ? Math.min(100, Math.round((curr.receivedSalary / curr.earnedSalary) * 100))
      : curr.receivedSalary > 0
      ? 100
      : 0;

  const savingsProgressPct =
    financeSummary.totalSavingsTarget > 0
      ? Math.min(
          100,
          Math.round((financeSummary.totalSaved / financeSummary.totalSavingsTarget) * 100)
        )
      : 0;

  // Detect latest populated attendance / expense month so empty months offer 1-tap navigation
  const attMonths = Array.from(new Set(attendance.map((a) => a.month))).sort();
  const latestPopulatedAttendanceMonth =
    attMonths.length > 0 ? attMonths[attMonths.length - 1] : null;
  const expMonths = Array.from(new Set(expenses.map((e) => e.month))).sort();
  const latestPopulatedExpenseMonth =
    expMonths.length > 0 ? expMonths[expMonths.length - 1] : null;

  return {
    selectedMonth,
    kpis: {
      attendanceRatePct,
      presentDays,
      lateDays,
      absentDays,
      approvedLeaveDays,
      holidayDays,
      totalTrackedDays: curr.monthAttCount,
      basicSalary: curr.basic,
      houseRentAllowance: curr.houseRent,
      otherFixedAllowances: curr.otherFixedAllowances,
      bonusesTotal: curr.bonusesTotal,
      otHours: curr.otHours,
      otEarnings: curr.otEarnings,
      otSharePct,
      earnedSalary: curr.earnedSalary,
      fullExpectedSalary: curr.fullExpectedSalary,
      receivedSalary: curr.receivedSalary,
      salaryCollectionPct,
      outstandingBalance: Math.max(0, Math.round(curr.earnedSalary - curr.receivedSalary)),
      otherIncome: curr.otherIncome,
      totalIncome,
      totalExpenses: curr.totalExpenses,
      expenseRatioPct,
      netCashflow: roundCurrency(totalIncome - curr.totalExpenses),
      totalSaved: financeSummary.totalSaved,
      totalSavingsTarget: financeSummary.totalSavingsTarget,
      savingsProgressPct,
      loanRemaining: loanSummary.totalRemaining,
    },
    attendanceSlices,
    salarySlices,
    expenseCategorySlices,
    monthlyTrend,
    latestPopulatedAttendanceMonth,
    latestPopulatedExpenseMonth,
  };
}

/**
 * Returns culturally appropriate time-of-day greeting in Bengali or English
 * based on Bangladesh Standard Time hour (0-23).
 */
export function getTimeOfDayGreeting(hour24: number, lang: Language): string {
  const h = ((Math.floor(hour24) % 24) + 24) % 24;
  if (h >= 5 && h < 12) {
    return lang === 'bn' ? 'আসসালামু আলাইকুম, শুভ সকাল' : 'Good Morning';
  }
  if (h >= 12 && h < 15) {
    return lang === 'bn' ? 'আসসালামু আলাইকুম, শুভ দুপুর' : 'Good Noon';
  }
  if (h >= 15 && h < 18) {
    return lang === 'bn' ? 'আসসালামু আলাইকুম, শুভ বিকাল' : 'Good Afternoon';
  }
  if (h >= 18 && h < 21) {
    return lang === 'bn' ? 'আসসালামু আলাইকুম, শুভ সন্ধ্যা' : 'Good Evening';
  }
  return lang === 'bn' ? 'আসসালামু আলাইকুম, শুভ রাত' : 'Good Night';
}

const PLACEHOLDER_WORKER_NAMES = new Set([
  'শ্রমিক ব্যবহারকারী',
  'শ্রমিক বন্ধু',
  'worker',
  'worker user',
  'guest',
]);

export function isPlaceholderWorkerName(name?: string | null): boolean {
  const clean = (name || '').trim();
  if (!clean) return true;
  return PLACEHOLDER_WORKER_NAMES.has(clean.toLowerCase());
}

/**
 * Resolves the worker's real display name so generic placeholder strings like
 * "শ্রমিক ব্যবহারকারী" never hide a registered name or Google account displayName.
 */
export function resolveWorkerDisplayName(params: {
  profileFullName?: string | null;
  authDisplayName?: string | null;
  localAccountName?: string | null;
  email?: string | null;
  lang?: Language;
}): string {
  const {
    profileFullName,
    authDisplayName,
    localAccountName,
    email,
    lang = 'bn',
  } = params;

  const cleanProfile = (profileFullName || '').trim();
  if (cleanProfile && !isPlaceholderWorkerName(cleanProfile)) {
    return cleanProfile.slice(0, 120);
  }

  const cleanAuth = (authDisplayName || '').trim();
  if (cleanAuth && !isPlaceholderWorkerName(cleanAuth)) {
    return cleanAuth.slice(0, 120);
  }

  const cleanLocal = (localAccountName || '').trim();
  if (cleanLocal && !isPlaceholderWorkerName(cleanLocal)) {
    return cleanLocal.slice(0, 120);
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail === 'sadikulislam45974@gmail.com') {
    return lang === 'en' ? 'Sadikul Islam' : 'সাদিকুল ইসলাম';
  }

  if (cleanEmail && cleanEmail.includes('@') && !cleanEmail.startsWith('demo@')) {
    const localPart = cleanEmail.split('@')[0] || '';
    const formatted = localPart
      .replace(/[._-]+/g, ' ')
      .replace(/\d+$/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    if (formatted && !isPlaceholderWorkerName(formatted)) {
      return formatted.slice(0, 120);
    }
  }

  return lang === 'en' ? 'Worker' : 'শ্রমিক';
}

export interface ExpenseRentTrendPoint {
  month: string;
  label: string;
  rentAndBills: number;
  bazarFood: number;
  otherExpenses: number;
  totalExpenses: number;
  totalIncome: number;
}

export function buildExpenseRentTrend(params: {
  selectedMonth: string;
  lang: Language;
  expenses: ExpenseRecord[];
  payments: SalaryPayment[];
}): ExpenseRentTrendPoint[] {
  const { selectedMonth, lang, expenses, payments } = params;
  const months: string[] = [];
  for (let offset = -5; offset <= 0; offset++) {
    months.push(stepMonthISO(selectedMonth, offset));
  }

  return months.map((m) => {
    const mExp = expenses.filter((e) => e.month === m);
    const mPay = payments.filter((p) => p.month === m);

    const rentAndBills = Math.round(
      mExp
        .filter((e) => e.category === 'rent')
        .reduce((s, e) => s + (Number(e.amount) || 0), 0)
    );
    const bazarFood = Math.round(
      mExp
        .filter((e) => e.category === 'food')
        .reduce((s, e) => s + (Number(e.amount) || 0), 0)
    );
    const otherExpenses = Math.round(
      mExp
        .filter((e) => e.category !== 'rent' && e.category !== 'food')
        .reduce((s, e) => s + (Number(e.amount) || 0), 0)
    );
    const totalExpenses = rentAndBills + bazarFood + otherExpenses;
    const totalIncome = Math.round(
      mPay.reduce((s, p) => s + (Number(p.amountReceived) || 0), 0)
    );

    return {
      month: m,
      label: formatShortMonthName(m, lang),
      rentAndBills,
      bazarFood,
      otherExpenses,
      totalExpenses,
      totalIncome,
    };
  });
}

export interface FactoryComparisonBarPoint {
  metricKey: string;
  labelBn: string;
  labelEn: string;
  currentVal: number;
  previousVal: number;
}

export interface FactoryComparisonAnalytics {
  currentFactoryName: string;
  previousFactoryName: string;
  hasPastFactory: boolean;
  grossDeltaAmount: number;
  grossGrowthPct: number;
  salaryCompositionSlices: AnalyticsPieSlice[];
  attendanceBalanceSlices: AnalyticsPieSlice[];
  comparisonBars: FactoryComparisonBarPoint[];
  attendanceRateCurrentPct: number;
  attendanceRatePreviousPct: number;
}

export function buildFactoryComparisonAnalytics(params: {
  profile: WorkerProfile;
  workplaces: GarmentWorkplace[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
  overtime: OvertimeRecord[];
  attendance: AttendanceRecord[];
  todayISO: string;
}): FactoryComparisonAnalytics {
  const { profile, workplaces, salaryRecords, payments, overtime, attendance, todayISO } = params;

  const currentWp = workplaces.find((w) => w.isCurrent);
  const pastWorkplaces = workplaces.filter((w) => !w.isCurrent);
  const latestPast = pastWorkplaces[0] || null;

  const currentFactoryName =
    currentWp?.factoryName || profile.factoryName || 'বর্তমান কারখানা';
  const previousFactoryName = latestPast
    ? latestPast.factoryName
    : 'ন্যূনতম মজুরি মানদণ্ড';

  const currGross =
    profile.grossSalary || currentWp?.grossSalary || 12500;
  const currBasic =
    profile.basicSalary || currentWp?.basicSalary || Math.round(currGross * 0.536);

  const currentTenure = computeWorkplaceTenureAnalytics({
    workplace: {
      ...(currentWp || {}),
      isCurrent: true,
      joiningDate: profile.joiningDate || currentWp?.joiningDate || '2025-01-01',
      grossSalary: currGross,
      basicSalary: currBasic,
    },
    profile,
    salaryRecords,
    payments,
    overtime,
    attendance,
    todayISO,
  });

  const currAvgIncome =
    currentTenure.monthsWorked > 0 && currentTenure.totalReceivedSalary > 0
      ? Math.round(currentTenure.totalReceivedSalary / currentTenure.monthsWorked)
      : currGross;

  const prevGross = latestPast
    ? latestPast.grossSalary || 10500
    : 12500;
  const prevBasic = latestPast
    ? latestPast.basicSalary || Math.round(prevGross * 0.52)
    : 6700;
  const prevTenure = latestPast
    ? computeWorkplaceTenureAnalytics({
        workplace: latestPast,
        profile,
        salaryRecords,
        payments,
        overtime,
        attendance,
        todayISO,
      })
    : null;
  const prevAvgIncome = prevTenure
    ? prevTenure.monthsWorked > 0 && prevTenure.totalReceivedSalary > 0
      ? Math.round(prevTenure.totalReceivedSalary / prevTenure.monthsWorked)
      : prevGross
    : 12500;

  const currTotalWorkOpp =
    currentTenure.totalPresentDays + currentTenure.totalAbsentDays;
  const attendanceRateCurrentPct =
    currTotalWorkOpp > 0
      ? Math.round((currentTenure.totalPresentDays / currTotalWorkOpp) * 100)
      : 96;

  const prevTotalWorkOpp = prevTenure
    ? prevTenure.totalPresentDays + prevTenure.totalAbsentDays
    : 0;
  const attendanceRatePreviousPct = prevTenure
    ? prevTotalWorkOpp > 0
      ? Math.round((prevTenure.totalPresentDays / prevTotalWorkOpp) * 100)
      : 94
    : 95;

  const grossDeltaAmount = Math.round(currGross - prevGross);
  const grossGrowthPct =
    prevGross > 0 ? Math.round(((currGross - prevGross) / prevGross) * 100) : 0;

  const otherFixed =
    (profile.medicalAllowance || 0) +
    (profile.transportAllowance || 0) +
    (profile.foodAllowance || 0);
  const salaryCompositionSlices = attachPercents([
    {
      key: 'basic',
      nameBn: 'মূল বেতন',
      nameEn: 'Basic Salary',
      value: currBasic,
      color: '#059669',
    },
    {
      key: 'house_rent',
      nameBn: 'বাড়ি ভাড়া',
      nameEn: 'House Rent',
      value: profile.houseRentAllowance || Math.round(currBasic * 0.5),
      color: '#0D9488',
    },
    {
      key: 'allowances',
      nameBn: 'ভাতা (চিকিৎসা/যাতায়াত/খাদ্য)',
      nameEn: 'Allowances',
      value: otherFixed || Math.max(0, currGross - currBasic - Math.round(currBasic * 0.5)),
      color: '#2563EB',
    },
    {
      key: 'att_bonus',
      nameBn: 'হাজিরা বোনাস',
      nameEn: 'Attendance Bonus',
      value: profile.attendanceBonus || 0,
      color: '#D97706',
    },
  ]);

  const attendanceBalanceSlices = attachPercents([
    {
      key: 'curr_present',
      nameBn: 'উপস্থিত কর্মদিবস',
      nameEn: 'Present Days',
      value: currentTenure.totalPresentDays || 1,
      color: '#059669',
    },
    {
      key: 'curr_leave',
      nameBn: 'ছুটি ও সরকারি বন্ধ',
      nameEn: 'Leave & Holidays',
      value: currentTenure.totalLeaveDays,
      color: '#0EA5E9',
    },
    {
      key: 'curr_absent',
      nameBn: 'অনুপস্থিত',
      nameEn: 'Absent',
      value: currentTenure.totalAbsentDays,
      color: '#E11D48',
    },
  ]);

  const comparisonBars: FactoryComparisonBarPoint[] = [
    {
      metricKey: 'gross',
      labelBn: 'মোট বেতন (Gross)',
      labelEn: 'Gross Pay',
      currentVal: Math.round(currGross),
      previousVal: Math.round(prevGross),
    },
    {
      metricKey: 'basic',
      labelBn: 'মূল বেতন (Basic)',
      labelEn: 'Basic Pay',
      currentVal: Math.round(currBasic),
      previousVal: Math.round(prevBasic),
    },
    {
      metricKey: 'avg_monthly',
      labelBn: 'মাসিক গড় আয়',
      labelEn: 'Monthly Avg',
      currentVal: Math.round(currAvgIncome),
      previousVal: Math.round(prevAvgIncome),
    },
  ];

  return {
    currentFactoryName,
    previousFactoryName,
    hasPastFactory: Boolean(latestPast),
    grossDeltaAmount,
    grossGrowthPct,
    salaryCompositionSlices,
    attendanceBalanceSlices,
    comparisonBars,
    attendanceRateCurrentPct,
    attendanceRatePreviousPct,
  };
}

export interface LoanBarComparisonPoint {
  name: string;
  fullName: string;
  direction: 'lent' | 'borrowed';
  principal: number;
  repaid: number;
  remaining: number;
}

export interface LoanPortfolioAnalytics {
  portfolioPieSlices: AnalyticsPieSlice[];
  personComparisonBars: LoanBarComparisonPoint[];
  totalLentPrincipal: number;
  totalLentReceived: number;
  totalLentDue: number;
  totalBorrowedPrincipal: number;
  totalBorrowedPaid: number;
  totalBorrowedDue: number;
  netPosition: number;
}

export function buildLoanPortfolioAnalytics(
  loans: PersonalLoan[],
  _todayISO?: string
): LoanPortfolioAnalytics {
  const active = loans.filter((l) => !l.isArchived);

  let totalLentPrincipal = 0;
  let totalLentReceived = 0;
  let totalLentDue = 0;
  let totalBorrowedPrincipal = 0;
  let totalBorrowedPaid = 0;
  let totalBorrowedDue = 0;

  const bars: LoanBarComparisonPoint[] = [];

  for (const loan of active) {
    const dir = getLoanDirection(loan);
    const orig = getLoanOriginalAmount(loan);
    const repaid = getLoanRepaymentsTotal(loan);
    const rem = getLoanRemainingBalance(loan);
    const pName = getLoanPersonName(loan);
    const shortName = pName.length > 14 ? `${pName.slice(0, 13)}…` : pName;

    if (dir === 'lent') {
      totalLentPrincipal += orig;
      totalLentReceived += repaid;
      totalLentDue += rem;
    } else {
      totalBorrowedPrincipal += orig;
      totalBorrowedPaid += repaid;
      totalBorrowedDue += rem;
    }

    bars.push({
      name: shortName,
      fullName: pName,
      direction: dir,
      principal: Math.round(orig),
      repaid: Math.round(repaid),
      remaining: Math.round(rem),
    });
  }

  const portfolioPieSlices = attachPercents([
    {
      key: 'lent_due',
      nameBn: 'পাওনা বাকি (আমি পাব)',
      nameEn: 'Receivable Due',
      value: Math.round(totalLentDue),
      color: '#059669',
    },
    {
      key: 'borrowed_due',
      nameBn: 'দেনা বাকি (আমি দেব)',
      nameEn: 'Debt Remaining',
      value: Math.round(totalBorrowedDue),
      color: '#7C3AED',
    },
    {
      key: 'lent_received',
      nameBn: 'পাওনা আদায় হয়েছে',
      nameEn: 'Lent Recovered',
      value: Math.round(totalLentReceived),
      color: '#0D9488',
    },
    {
      key: 'borrowed_paid',
      nameBn: 'দেনা পরিশোধ করেছি',
      nameEn: 'Debt Repaid',
      value: Math.round(totalBorrowedPaid),
      color: '#2563EB',
    },
  ]);

  // Prioritize active/largest loans up to 6 entries so the bar chart stays uncluttered
  const personComparisonBars = [...bars]
    .sort((a, b) => b.remaining - a.remaining || b.principal - a.principal)
    .slice(0, 6);

  return {
    portfolioPieSlices,
    personComparisonBars,
    totalLentPrincipal: roundCurrency(totalLentPrincipal),
    totalLentReceived: roundCurrency(totalLentReceived),
    totalLentDue: roundCurrency(totalLentDue),
    totalBorrowedPrincipal: roundCurrency(totalBorrowedPrincipal),
    totalBorrowedPaid: roundCurrency(totalBorrowedPaid),
    totalBorrowedDue: roundCurrency(totalBorrowedDue),
    netPosition: roundCurrency(totalLentDue - totalBorrowedDue),
  };
}

export interface OvertimePieAnalytics {
  selectedMonth: string;
  monthlySlices: AnalyticsPieSlice[];
  weeklySlices: AnalyticsPieSlice[];
  sixMonthHours: number;
  sixMonthEarnings: number;
  sixMonthDays: number;
  selectedMonthHours: number;
  selectedMonthEarnings: number;
  selectedMonthDays: number;
  monthlyUsesHoursFallback: boolean;
  weeklyUsesHoursFallback: boolean;
  latestPopulatedOtMonth: string | null;
}

const OT_MONTH_PALETTE = [
  '#0EA5E9',
  '#4F46E5',
  '#0D9488',
  '#D97706',
  '#2563EB',
  '#059669',
];

const OT_WEEK_META = [
  {
    key: 'week_1',
    nameBn: 'সপ্তাহ ১ (১–৭ তারিখ)',
    nameEn: 'Week 1 (Days 1–7)',
    color: '#059669',
  },
  {
    key: 'week_2',
    nameBn: 'সপ্তাহ ২ (৮–১৪ তারিখ)',
    nameEn: 'Week 2 (Days 8–14)',
    color: '#2563EB',
  },
  {
    key: 'week_3',
    nameBn: 'সপ্তাহ ৩ (১৫–২১ তারিখ)',
    nameEn: 'Week 3 (Days 15–21)',
    color: '#D97706',
  },
  {
    key: 'week_4',
    nameBn: 'সপ্তাহ ৪ (২২–৩১ তারিখ)',
    nameEn: 'Week 4 (Days 22–31)',
    color: '#7C3AED',
  },
] as const;

export function buildOvertimePieAnalytics(params: {
  selectedMonth: string;
  lang: Language;
  overtime: OvertimeRecord[];
}): OvertimePieAnalytics {
  const { selectedMonth, overtime } = params;

  const otRecords = overtime.filter((o) => (o.approvedHours || 0) > 0);

  // 6-month window ending at selectedMonth
  const windowMonths: string[] = [];
  for (let offset = -5; offset <= 0; offset++) {
    windowMonths.push(stepMonthISO(selectedMonth, offset));
  }

  let sixMonthHoursRaw = 0;
  let sixMonthEarningsRaw = 0;
  let sixMonthDays = 0;

  const monthlyStats = windowMonths.map((monthISO, idx) => {
    const recs = otRecords.filter((o) => o.month === monthISO);
    const hrs = recs.reduce((s, r) => s + (r.approvedHours || 0), 0);
    const earn = recs.reduce((s, r) => s + (r.estimatedEarnings || 0), 0);
    const days = new Set(recs.map((r) => r.date)).size;

    sixMonthHoursRaw += hrs;
    sixMonthEarningsRaw += earn;
    sixMonthDays += days;

    return {
      monthISO,
      hrs: Math.round(hrs * 100) / 100,
      earn: Math.round(earn),
      days,
      color: OT_MONTH_PALETTE[idx % OT_MONTH_PALETTE.length],
    };
  });

  const monthlyUsesHoursFallback = sixMonthHoursRaw > 0 && sixMonthEarningsRaw <= 0;

  // Present newest months first in the legend for quick scanning
  const monthlySlices = attachPercents(
    [...monthlyStats]
      .reverse()
      .map((m) => ({
        key: m.monthISO,
        nameBn: formatMonthLabel(m.monthISO, 'bn'),
        nameEn: formatMonthLabel(m.monthISO, 'en'),
        subLabelBn: `${formatNumber(m.hrs, 'bn', 1)} ঘণ্টা · ${formatNumber(m.days, 'bn')} দিন`,
        subLabelEn: `${formatNumber(m.hrs, 'en', 1)} hrs · ${m.days} d`,
        value: monthlyUsesHoursFallback ? Math.round(m.hrs * 10) / 10 : m.earn,
        color: m.color,
      }))
  );

  // Selected month week-by-week distribution
  const monthRecs = otRecords.filter((o) => o.month === selectedMonth);
  const weekBuckets = [0, 1, 2, 3].map((idx) => ({
    meta: OT_WEEK_META[idx],
    hrs: 0,
    earn: 0,
    dates: new Set<string>(),
  }));

  for (const r of monthRecs) {
    const dayNum = Number(r.date.slice(8, 10)) || 1;
    const bucketIdx = dayNum <= 7 ? 0 : dayNum <= 14 ? 1 : dayNum <= 21 ? 2 : 3;
    weekBuckets[bucketIdx].hrs += r.approvedHours || 0;
    weekBuckets[bucketIdx].earn += r.estimatedEarnings || 0;
    weekBuckets[bucketIdx].dates.add(r.date);
  }

  const selectedMonthHoursRaw = monthRecs.reduce((s, r) => s + (r.approvedHours || 0), 0);
  const selectedMonthEarningsRaw = monthRecs.reduce(
    (s, r) => s + (r.estimatedEarnings || 0),
    0
  );
  const selectedMonthDays = new Set(monthRecs.map((r) => r.date)).size;
  const weeklyUsesHoursFallback =
    selectedMonthHoursRaw > 0 && selectedMonthEarningsRaw <= 0;

  const weeklySlices = attachPercents(
    weekBuckets.map((b) => {
      const hrs = Math.round(b.hrs * 100) / 100;
      const days = b.dates.size;
      return {
        key: b.meta.key,
        nameBn: b.meta.nameBn,
        nameEn: b.meta.nameEn,
        subLabelBn: `${formatNumber(hrs, 'bn', 1)} ঘণ্টা · ${formatNumber(days, 'bn')} দিন`,
        subLabelEn: `${formatNumber(hrs, 'en', 1)} hrs · ${days} d`,
        value: weeklyUsesHoursFallback ? Math.round(hrs * 10) / 10 : Math.round(b.earn),
        color: b.meta.color,
      };
    })
  );

  const latestPopulatedOtMonth =
    Array.from(new Set(otRecords.map((o) => o.month)))
      .filter(Boolean)
      .sort()
      .pop() || null;

  return {
    selectedMonth,
    monthlySlices,
    weeklySlices,
    sixMonthHours: Math.round(sixMonthHoursRaw * 100) / 100,
    sixMonthEarnings: roundCurrency(sixMonthEarningsRaw),
    sixMonthDays,
    selectedMonthHours: Math.round(selectedMonthHoursRaw * 100) / 100,
    selectedMonthEarnings: roundCurrency(selectedMonthEarningsRaw),
    selectedMonthDays,
    monthlyUsesHoursFallback,
    weeklyUsesHoursFallback,
    latestPopulatedOtMonth,
  };
}

export interface RecentActivityPieAnalytics {
  selectedMonth: string;
  slices: AnalyticsPieSlice[];
  expenseSlices: AnalyticsPieSlice[];
  totalTransactionsCount: number;
  totalVolumeAmount: number;
  paymentTotal: number;
  paymentCount: number;
  overtimeTotal: number;
  overtimeHours: number;
  overtimeCount: number;
  expenseTotal: number;
  expenseCount: number;
  netBalance: number;
  latestPopulatedActivityMonth: string | null;
}

const RECENT_EXPENSE_CATEGORY_ORDER: ExpenseCategory[] = [
  'rent',
  'food',
  'family',
  'transport',
  'medical',
  'education',
  'other',
];

const RECENT_EXPENSE_SLICE_META: Record<
  ExpenseCategory,
  { nameBn: string; nameEn: string; color: string }
> = {
  rent: {
    nameBn: 'বাসা ভাড়া ও বিল',
    nameEn: 'Rent & Utility Bills',
    color: '#E11D48',
  },
  food: {
    nameBn: 'খাবার ও বাজার খরচ',
    nameEn: 'Food & Grocery',
    color: '#D97706',
  },
  family: {
    nameBn: 'পরিবার ও বাড়িতে পাঠানো',
    nameEn: 'Family Support',
    color: '#7C3AED',
  },
  transport: {
    nameBn: 'যাতায়াত ও ভাড়া',
    nameEn: 'Transport & Fare',
    color: '#2563EB',
  },
  medical: {
    nameBn: 'চিকিৎসা ও ওষুধ',
    nameEn: 'Medical & Pharmacy',
    color: '#DB2777',
  },
  education: {
    nameBn: 'পড়াশোনা ও শিক্ষা',
    nameEn: 'Education',
    color: '#0D9488',
  },
  other: {
    nameBn: 'অন্যান্য খরচ',
    nameEn: 'Other Expenses',
    color: '#64748B',
  },
};

export function buildRecentActivityPieAnalytics(params: {
  selectedMonth: string;
  overtime: OvertimeRecord[];
  payments: SalaryPayment[];
  expenses: ExpenseRecord[];
}): RecentActivityPieAnalytics {
  const { selectedMonth, overtime, payments, expenses } = params;

  const monthOt = overtime.filter(
    (o) => o.month === selectedMonth && (Number(o.approvedHours) || 0) > 0
  );
  const monthPay = payments.filter((p) => p.month === selectedMonth);
  const monthExp = expenses.filter((e) => e.month === selectedMonth);

  const regularPayments = monthPay.filter((p) => !isOtherIncomePayment(p));
  const extraIncomePayments = monthPay.filter((p) => isOtherIncomePayment(p));

  const regularPaymentTotal = roundCurrency(
    regularPayments.reduce((s, p) => s + (Number(p.amountReceived) || 0), 0)
  );
  const extraIncomeTotal = roundCurrency(
    extraIncomePayments.reduce((s, p) => s + (Number(p.amountReceived) || 0), 0)
  );

  const overtimeHours =
    Math.round(
      monthOt.reduce((s, o) => s + (Number(o.approvedHours) || 0), 0) * 100
    ) / 100;
  const overtimeTotal = roundCurrency(
    monthOt.reduce((s, o) => s + (Number(o.estimatedEarnings) || 0), 0)
  );
  const paymentTotal = roundCurrency(regularPaymentTotal + extraIncomeTotal);
  const expenseTotal = roundCurrency(
    monthExp.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  );

  const overtimeCount = monthOt.length;
  const paymentCount = monthPay.length;
  const expenseCount = monthExp.length;
  const totalTransactionsCount = overtimeCount + paymentCount + expenseCount;
  const totalVolumeAmount = roundCurrency(
    paymentTotal + overtimeTotal + expenseTotal
  );
  const netBalance = roundCurrency(paymentTotal + overtimeTotal - expenseTotal);

  // Build individual expense slices per category (never merged together)
  const rawExpenseCategorySlices: Array<Omit<AnalyticsPieSlice, 'percent'>> = [];
  for (const cat of RECENT_EXPENSE_CATEGORY_ORDER) {
    const catRecs = monthExp.filter((e) => e.category === cat);
    const catAmount = roundCurrency(
      catRecs.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    );
    if (catAmount > 0) {
      const meta = RECENT_EXPENSE_SLICE_META[cat];
      const latestDesc = catRecs[0]?.description?.trim();
      rawExpenseCategorySlices.push({
        key: `expense_${cat}`,
        nameBn: meta.nameBn,
        nameEn: meta.nameEn,
        subLabelBn:
          catRecs.length === 1 && latestDesc
            ? latestDesc
            : `${formatNumber(catRecs.length, 'bn')}টি এন্ট্রি`,
        subLabelEn: `${catRecs.length} ${catRecs.length === 1 ? 'entry' : 'entries'}`,
        value: Math.round(catAmount),
        color: meta.color,
      });
    }
  }

  const rawAllSlices: Array<Omit<AnalyticsPieSlice, 'percent'>> = [];

  if (regularPaymentTotal > 0) {
    rawAllSlices.push({
      key: 'payment_salary',
      nameBn: 'বেতন প্রাপ্তি ও জমা',
      nameEn: 'Salary Received',
      subLabelBn: `${formatNumber(regularPayments.length, 'bn')}টি বেতন এন্ট্রি`,
      subLabelEn: `${regularPayments.length} salary ${regularPayments.length === 1 ? 'entry' : 'entries'}`,
      value: Math.round(regularPaymentTotal),
      color: '#059669',
    });
  }

  if (extraIncomeTotal > 0) {
    rawAllSlices.push({
      key: 'payment_extra',
      nameBn: 'অতিরিক্ত ও বোনাস আয়',
      nameEn: 'Extra & Bonus Income',
      subLabelBn: `${formatNumber(extraIncomePayments.length, 'bn')}টি এন্ট্রি`,
      subLabelEn: `${extraIncomePayments.length} ${extraIncomePayments.length === 1 ? 'entry' : 'entries'}`,
      value: Math.round(extraIncomeTotal),
      color: '#10B981',
    });
  }

  if (overtimeTotal > 0) {
    rawAllSlices.push({
      key: 'overtime',
      nameBn: 'ওভারটাইম আয়',
      nameEn: 'Overtime Earnings',
      subLabelBn: `${formatNumber(overtimeHours, 'bn', 1)} ঘণ্টা · ${formatNumber(overtimeCount, 'bn')}টি এন্ট্রি`,
      subLabelEn: `${formatNumber(overtimeHours, 'en', 1)} hrs · ${overtimeCount} entries`,
      value: Math.round(overtimeTotal),
      color: '#0EA5E9',
    });
  }

  // Append each populated expense category as its own slice (never merged)
  rawAllSlices.push(...rawExpenseCategorySlices);

  const slices = attachPercents(rawAllSlices);
  const expenseSlices = attachPercents(rawExpenseCategorySlices);

  const allMonths = Array.from(
    new Set([
      ...overtime
        .filter((o) => (Number(o.approvedHours) || 0) > 0)
        .map((o) => o.month),
      ...payments.map((p) => p.month),
      ...expenses.map((e) => e.month),
    ])
  )
    .filter(Boolean)
    .sort();
  const latestPopulatedActivityMonth =
    allMonths.length > 0 ? allMonths[allMonths.length - 1] : null;

  return {
    selectedMonth,
    slices,
    expenseSlices,
    totalTransactionsCount,
    totalVolumeAmount,
    paymentTotal,
    paymentCount,
    overtimeTotal,
    overtimeHours,
    overtimeCount,
    expenseTotal,
    expenseCount,
    netBalance,
    latestPopulatedActivityMonth,
  };
}

