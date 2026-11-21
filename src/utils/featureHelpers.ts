import type {
  AnonymousGradeAreaBenchmark,
  AttendanceRecord,
  ExpenseRecord,
  Language,
  LeaveApplication,
  LeaveApplicationType,
  OvertimeRecord,
  PayslipParsedFields,
  SalaryPayment,
  SalaryRecord,
  SavingsGoal,
  WorkerProfile,
} from '../types';
import {
  calculateAttendanceBonusEligibility,
  formatBDT,
  formatNumber,
  getSalaryStructure,
  isOtherIncomePayment,
  roundCurrency,
  summarizeAttendanceForMonth,
  toBengaliDigits,
} from './calculations';
import { formatMonthLabel } from './i18n';

// ============================================================================
// 1. RMG ANNUAL INCREMENT CALCULATOR (Exact Bangladesh RMG Gazette Math)
// ============================================================================

export interface RMGIncrementInput {
  currentBasic: number;
  currentGross?: number;
  medicalAllowance?: number;
  transportAllowance?: number;
  foodAllowance?: number;
  mode: 'percent' | 'amount';
  incrementPercent: number;
  incrementAmountBDT: number;
  otDivisor?: number;
  otMultiplier?: number;
}

export interface RMGIncrementOutput {
  oldBasic: number;
  oldHouseRent: number;
  oldMedical: number;
  oldTransport: number;
  oldFood: number;
  oldGross: number;
  oldOtRate: number;
  newBasic: number;
  newHouseRent: number;
  newMedical: number;
  newTransport: number;
  newFood: number;
  newGross: number;
  newOtRate: number;
  basicIncrease: number;
  monthlyGrossIncrease: number;
  yearlyGrossIncrease: number;
  effectivePercent: number;
  effectiveAmountBDT: number;
}

export function calculateRMGIncrement(input: RMGIncrementInput): RMGIncrementOutput {
  const medical =
    input.medicalAllowance !== undefined && input.medicalAllowance >= 0
      ? Math.round(input.medicalAllowance)
      : 750;
  const transport =
    input.transportAllowance !== undefined && input.transportAllowance >= 0
      ? Math.round(input.transportAllowance)
      : 450;
  const food =
    input.foodAllowance !== undefined && input.foodAllowance >= 0
      ? Math.round(input.foodAllowance)
      : 1250;
  const fixedAllowances = medical + transport + food;

  const oldBasic = Math.max(0, Math.round(Number(input.currentBasic) || 0));
  const oldHouseRent = Math.round(oldBasic * 0.5);
  const derivedOldGross = oldBasic + oldHouseRent + fixedAllowances;
  const oldGross =
    input.currentGross && input.currentGross > 0
      ? Math.round(input.currentGross)
      : derivedOldGross;

  const otDivisor = Number(input.otDivisor) > 0 ? Number(input.otDivisor) : 208;
  const otMultiplier = Number(input.otMultiplier) > 0 ? Number(input.otMultiplier) : 2;
  const oldOtRate = roundCurrency((oldBasic / otDivisor) * otMultiplier);

  let newBasic = oldBasic;
  let newHouseRent = oldHouseRent;
  let newMedical = medical;
  let newTransport = transport;
  let newFood = food;
  let newGross = oldGross;

  if (input.mode === 'amount') {
    const incAmt = Math.max(0, Math.round(Number(input.incrementAmountBDT) || 0));
    newGross = oldGross + incAmt;
    if (newGross > fixedAllowances) {
      newBasic = Math.round((newGross - fixedAllowances) / 1.5);
      newHouseRent = Math.round(newBasic * 0.5);
      const sumWithoutRoundingAdj = newBasic + newHouseRent + newMedical + newTransport + newFood;
      const roundingDiff = newGross - sumWithoutRoundingAdj;
      // Keep any 1-taka rounding difference in food allowance per RMG practice
      if (Math.abs(roundingDiff) <= 2) {
        newFood = Math.max(0, newFood + roundingDiff);
      } else {
        newGross = sumWithoutRoundingAdj;
      }
    } else {
      newBasic = oldBasic;
      newHouseRent = oldHouseRent;
      newGross = oldGross + incAmt;
    }
  } else {
    const pct = Math.max(0, Number(input.incrementPercent) || 0);
    // Annual increment % applies strictly to Basic Salary, rounded to nearest taka
    newBasic = Math.round(oldBasic * (1 + pct / 100));
    newHouseRent = Math.round(newBasic * 0.5);
    newGross = newBasic + newHouseRent + newMedical + newTransport + newFood;
  }

  const basicIncrease = Math.max(0, newBasic - oldBasic);
  const monthlyGrossIncrease = Math.max(0, newGross - oldGross);
  const yearlyGrossIncrease = monthlyGrossIncrease * 12;
  const newOtRate = roundCurrency((newBasic / otDivisor) * otMultiplier);
  const effectivePercent =
    oldBasic > 0 ? roundCurrency((basicIncrease / oldBasic) * 100) : 0;

  return {
    oldBasic,
    oldHouseRent,
    oldMedical: medical,
    oldTransport: transport,
    oldFood: food,
    oldGross,
    oldOtRate,
    newBasic,
    newHouseRent,
    newMedical,
    newTransport,
    newFood,
    newGross,
    newOtRate,
    basicIncrease,
    monthlyGrossIncrease,
    yearlyGrossIncrease,
    effectivePercent,
    effectiveAmountBDT: monthlyGrossIncrease,
  };
}

// ============================================================================
// 2. YEARLY LEAVE ALLOWANCE / TAKEN / REMAINING SUMMARY (BLA 2006)
// ============================================================================

export interface LeaveBalanceRow {
  type: LeaveApplicationType;
  labelBn: string;
  labelEn: string;
  allowed: number;
  taken: number;
  planned: number;
  remaining: number;
  isExceeded: boolean;
}

export function normalizeLeaveStatus(
  status?: string
): 'planned' | 'taken' {
  if (status === 'planned' || status === 'pending') return 'planned';
  return 'taken';
}

export function computeYearlyLeaveSummary(params: {
  year: number;
  leaveApplications: LeaveApplication[];
  attendance: AttendanceRecord[];
  joiningDate?: string;
}): LeaveBalanceRow[] {
  const { year, leaveApplications, attendance, joiningDate } = params;
  const yearPrefix = `${year}-`;

  // Count working days in the selected year (or total since joining if year has attendance)
  const yearAttendance = attendance.filter((a) => a.date && a.date.startsWith(yearPrefix));
  const presentOrLateDays = yearAttendance.filter(
    (a) => a.status === 'present' || a.status === 'late'
  ).length;
  // Earned leave: 1 day per 18 working days (BLA Sec 117), capped at 40
  const earnedAllowed = Math.min(40, Math.floor(presentOrLateDays / 18));

  // If user joined after this year, statutory allowance for that year is 0
  const joinYear = joiningDate && /^\d{4}/.test(joiningDate) ? Number(joiningDate.slice(0, 4)) : 0;
  const beforeJoiningYear = joinYear > 0 && year < joinYear;

  const definitions: Array<{
    type: LeaveApplicationType;
    labelBn: string;
    labelEn: string;
    allowed: number;
  }> = [
    { type: 'casual', labelBn: 'নৈমিত্তিক', labelEn: 'Casual', allowed: beforeJoiningYear ? 0 : 10 },
    { type: 'sick', labelBn: 'অসুস্থতা', labelEn: 'Sick', allowed: beforeJoiningYear ? 0 : 14 },
    { type: 'festival', labelBn: 'উৎসব', labelEn: 'Festival', allowed: beforeJoiningYear ? 0 : 11 },
    { type: 'earned', labelBn: 'অর্জিত', labelEn: 'Earned', allowed: beforeJoiningYear ? 0 : earnedAllowed },
    { type: 'maternity', labelBn: 'মাতৃত্ব', labelEn: 'Maternity', allowed: beforeJoiningYear ? 0 : 112 },
  ];

  const yearApps = leaveApplications.filter(
    (app) => app.startDate && app.startDate.startsWith(yearPrefix) && app.status !== 'rejected'
  );

  return definitions.map((def) => {
    const matchingApps = yearApps.filter((a) => a.leaveType === def.type);
    const taken = matchingApps
      .filter((a) => normalizeLeaveStatus(a.status) === 'taken')
      .reduce((sum, a) => sum + (Number(a.totalDays) || 0), 0);
    const planned = matchingApps
      .filter((a) => normalizeLeaveStatus(a.status) === 'planned')
      .reduce((sum, a) => sum + (Number(a.totalDays) || 0), 0);
    const remaining = def.allowed - taken;
    return {
      ...def,
      taken,
      planned,
      remaining,
      isExceeded: remaining < 0,
    };
  });
}

// ============================================================================
// 3. HAJIRA BONUS RISK WARNING & SALARY DAY REMINDER
// ============================================================================

export interface BonusRiskEvaluation {
  status: 'safe' | 'at_risk' | 'lost';
  bonusAmount: number;
  lateDays: number;
  maxLateAllowed: number;
  reasonBn?: string;
  reasonEn?: string;
}

export interface SalaryDayReminderEvaluation {
  shouldShow: boolean;
  expectedPayDay: number;
  targetMonth: string; // YYYY-MM of the salary being paid
  dismissKey: string;
}

export function evaluateBonusRiskWarning(params: {
  profile: WorkerProfile;
  attendanceForMonth: AttendanceRecord[];
}): BonusRiskEvaluation {
  const { profile, attendanceForMonth } = params;
  const bonusAmount =
    profile.hasAttendanceBonus === false
      ? 0
      : Number(profile.attendanceBonusAmount ?? profile.attendanceBonus) || 0;

  if (profile.hasAttendanceBonus === false || bonusAmount <= 0 || attendanceForMonth.length === 0) {
    return { status: 'safe', bonusAmount: 0, lateDays: 0, maxLateAllowed: 0 };
  }

  const evalResult = calculateAttendanceBonusEligibility({
    recordsForMonth: attendanceForMonth,
    profile,
  });

  const attSum = summarizeAttendanceForMonth(attendanceForMonth);
  const maxLate = Number(profile.maxLateDaysForBonus) > 0 ? Number(profile.maxLateDaysForBonus) : 3;

  if (!evalResult.isEligible) {
    return {
      status: 'lost',
      bonusAmount,
      lateDays: attSum.lateDays,
      maxLateAllowed: maxLate,
      reasonBn: evalResult.reasonBn || 'অনুপস্থিতি বা নির্ধারিত সীমার বেশি দেরি',
      reasonEn: evalResult.reasonEn || 'Absence or late limit exceeded',
    };
  }

  // If late penalty is enabled and 1 more late day will cancel the bonus
  if (profile.latePenaltyEnabled && maxLate > 0 && attSum.lateDays === maxLate - 1) {
    return {
      status: 'at_risk',
      bonusAmount,
      lateDays: attSum.lateDays,
      maxLateAllowed: maxLate,
    };
  }

  return {
    status: 'safe',
    bonusAmount,
    lateDays: attSum.lateDays,
    maxLateAllowed: maxLate,
  };
}

export function evaluateSalaryDayReminder(params: {
  profile: WorkerProfile;
  payments: SalaryPayment[];
  todayISO: string;
}): SalaryDayReminderEvaluation {
  const { profile, payments, todayISO } = params;
  const expectedPayDay = Number(profile.expectedPayDay) || 0;
  if (expectedPayDay < 1 || expectedPayDay > 31 || !/^\d{4}-\d{2}-\d{2}$/.test(todayISO)) {
    return { shouldShow: false, expectedPayDay: 0, targetMonth: '', dismissKey: '' };
  }

  const [yStr, mStr, dStr] = todayISO.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const currentMonth = `${yStr}-${mStr}`;

  // Previous month is the salary period typically paid in early next month
  const prevDate = new Date(year, month - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  // Check if tomorrow is expectedPayDay
  const tomorrow = new Date(year, month - 1, day + 1);
  const isTomorrowPayDay = tomorrow.getDate() === expectedPayDay;

  if (!isTomorrowPayDay) {
    return { shouldShow: false, expectedPayDay, targetMonth: prevMonth, dismissKey: '' };
  }

  // If pay day is in early month (1..15), it usually pays previous month's salary; otherwise current month
  const targetMonth = expectedPayDay <= 15 ? prevMonth : currentMonth;
  const hasRecordedSalary = payments.some(
    (p) =>
      !isOtherIncomePayment(p) &&
      (p.month === targetMonth || (p.paymentDate && p.paymentDate.startsWith(currentMonth)))
  );

  if (hasRecordedSalary) {
    return { shouldShow: false, expectedPayDay, targetMonth, dismissKey: '' };
  }

  return {
    shouldShow: true,
    expectedPayDay,
    targetMonth,
    dismissKey: `salary_day_reminder_${currentMonth}`,
  };
}

// ============================================================================
// 4. SALARY RECEIVED HISTORY & ON-TIME / DELAY ANALYTICS
// ============================================================================

export interface MonthlySalaryPaymentHistoryRow {
  month: string; // YYYY-MM
  payments: SalaryPayment[];
  totalReceived: number;
  payableAmount: number;
  coveragePct: number;
  latestPaymentDate: string | null;
  primaryMethod: SalaryPayment['paymentMethod'] | null;
  delayDays: number | null; // 0 = on time, >0 = late by N days, null = no record
  status: 'on_time' | 'late' | 'no_record';
}

export interface YearlySalaryPaymentSummary {
  year: number;
  totalReceivedYear: number;
  onTimeMonthsCount: number;
  lateMonthsCount: number;
  avgDelayDays: number;
  rows: MonthlySalaryPaymentHistoryRow[];
}

export function computeExpectedPayDateISO(salaryMonth: string, expectedPayDay: number): string {
  const [yStr, mStr] = salaryMonth.split('-');
  const y = Number(yStr) || 2026;
  const m = Number(mStr) || 1;
  const safeDay = Math.min(28, Math.max(1, expectedPayDay || 7));
  // RMG salaries for month M are paid on day `expectedPayDay` of month M+1 (unless expectedPayDay >= 25)
  const targetDate =
    safeDay >= 25 ? new Date(y, m - 1, safeDay) : new Date(y, m, safeDay);
  return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(
    targetDate.getDate()
  ).padStart(2, '0')}`;
}

export function buildYearlySalaryReceivedHistory(params: {
  year: number;
  profile: WorkerProfile;
  payments: SalaryPayment[];
  salaryRecords: SalaryRecord[];
  currentMonthISO: string;
}): YearlySalaryPaymentSummary {
  const { year, profile, payments, salaryRecords, currentMonthISO } = params;
  const expectedPayDay = Number(profile.expectedPayDay) || 7;
  const canonicalGross = getSalaryStructure(profile).grossSalary;

  const salaryPayments = payments.filter((p) => !isOtherIncomePayment(p));
  const [currY, currM] = currentMonthISO.split('-').map(Number);
  const maxMonth = year < currY ? 12 : year === currY ? currM : 0;

  const joinMonth =
    profile.joiningDate && /^\d{4}-\d{2}/.test(profile.joiningDate)
      ? profile.joiningDate.slice(0, 7)
      : '';

  const monthsToShow: string[] = [];
  for (let m = maxMonth; m >= 1; m -= 1) {
    const mISO = `${year}-${String(m).padStart(2, '0')}`;
    const hasPaymentInMonth = salaryPayments.some((p) => p.month === mISO);
    if (joinMonth && mISO < joinMonth && !hasPaymentInMonth) {
      continue;
    }
    monthsToShow.push(mISO);
  }

  let totalReceivedYear = 0;
  let onTimeMonthsCount = 0;
  let lateMonthsCount = 0;
  let totalDelayDaysAccum = 0;
  let delayedCount = 0;

  const rows: MonthlySalaryPaymentHistoryRow[] = monthsToShow.map((mISO) => {
    const monthPays = salaryPayments
      .filter((p) => p.month === mISO)
      .sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
    const totalReceived = roundCurrency(
      monthPays.reduce((s, p) => s + (Number(p.amountReceived) || 0), 0)
    );
    const savedRec = salaryRecords.find((s) => s.month === mISO);
    const payableAmount = savedRec?.estimatedNetPayable || canonicalGross || 0;
    const coveragePct =
      payableAmount > 0
        ? Math.min(100, Math.round((totalReceived / payableAmount) * 100))
        : totalReceived > 0
        ? 100
        : 0;

    if (monthPays.length === 0) {
      return {
        month: mISO,
        payments: [],
        totalReceived: 0,
        payableAmount,
        coveragePct: 0,
        latestPaymentDate: null,
        primaryMethod: null,
        delayDays: null,
        status: 'no_record',
      };
    }

    totalReceivedYear += totalReceived;
    const latestDate = monthPays[0].paymentDate || null;
    const expectedISO = computeExpectedPayDateISO(mISO, expectedPayDay);
    let delayDays = 0;
    if (latestDate && /^\d{4}-\d{2}-\d{2}$/.test(latestDate)) {
      const actualMs = new Date(`${latestDate}T00:00:00Z`).getTime();
      const expectedMs = new Date(`${expectedISO}T00:00:00Z`).getTime();
      const diff = Math.round((actualMs - expectedMs) / (24 * 60 * 60 * 1000));
      delayDays = Math.max(0, diff);
    }

    const status: 'on_time' | 'late' = delayDays > 0 ? 'late' : 'on_time';
    if (status === 'on_time') {
      onTimeMonthsCount += 1;
    } else {
      lateMonthsCount += 1;
      totalDelayDaysAccum += delayDays;
      delayedCount += 1;
    }

    return {
      month: mISO,
      payments: monthPays,
      totalReceived,
      payableAmount,
      coveragePct,
      latestPaymentDate: latestDate,
      primaryMethod: monthPays[0].paymentMethod,
      delayDays,
      status,
    };
  });

  const avgDelayDays = delayedCount > 0 ? roundCurrency(totalDelayDaysAccum / delayedCount) : 0;

  return {
    year,
    totalReceivedYear: roundCurrency(totalReceivedYear),
    onTimeMonthsCount,
    lateMonthsCount,
    avgDelayDays,
    rows,
  };
}

// ============================================================================
// 5. PAYSLIP PHOTO COMPARE ENGINE
// ============================================================================

export interface PayslipComparisonRow {
  key: keyof PayslipParsedFields;
  labelBn: string;
  labelEn: string;
  unit: 'bdt' | 'days' | 'hours';
  isDeduction?: boolean;
  payslipVal: number | null;
  appVal: number;
  diff: number | null; // payslip - app
  status: 'match' | 'mismatch' | 'missing';
}

export interface PayslipComparisonResult {
  rows: PayslipComparisonRow[];
  payslipNet: number;
  appNet: number;
  netDiff: number; // payslipNet - appNet (negative means payslip paid LESS)
  headlineBn: string;
  headlineEn: string;
  isMatched: boolean;
}

export function comparePayslipWithApp(params: {
  parsed: PayslipParsedFields;
  appData: {
    grossSalary: number;
    basicSalary: number;
    houseRentAllowance: number;
    medicalAllowance: number;
    transportAllowance: number;
    foodAllowance: number;
    presentDays: number;
    absentDays: number;
    otHours: number;
    otAmount: number;
    attendanceBonus: number;
    otherAllowances: number;
    advanceDeduction: number;
    absentDeduction: number;
    otherDeductions: number;
    netPayable: number;
  };
}): PayslipComparisonResult {
  const { parsed, appData } = params;

  const specs: Array<{
    key: keyof PayslipParsedFields;
    labelBn: string;
    labelEn: string;
    unit: 'bdt' | 'days' | 'hours';
    isDeduction?: boolean;
  }> = [
    { key: 'basicSalary', labelBn: 'মূল বেতন', labelEn: 'Basic Salary', unit: 'bdt' },
    { key: 'houseRentAllowance', labelBn: 'বাড়ি ভাড়া', labelEn: 'House Rent', unit: 'bdt' },
    { key: 'medicalAllowance', labelBn: 'চিকিৎসা ভাতা', labelEn: 'Medical Allowance', unit: 'bdt' },
    { key: 'transportAllowance', labelBn: 'যাতায়াত ভাতা', labelEn: 'Transport Allowance', unit: 'bdt' },
    { key: 'foodAllowance', labelBn: 'খাদ্য ভাতা', labelEn: 'Food Allowance', unit: 'bdt' },
    { key: 'presentDays', labelBn: 'উপস্থিত দিন', labelEn: 'Present Days', unit: 'days' },
    { key: 'absentDays', labelBn: 'অনুপস্থিত দিন', labelEn: 'Absent Days', unit: 'days' },
    { key: 'otHours', labelBn: 'ওভারটাইম ঘণ্টা', labelEn: 'OT Hours', unit: 'hours' },
    { key: 'otAmount', labelBn: 'ওভারটাইম টাকা', labelEn: 'OT Earnings', unit: 'bdt' },
    { key: 'attendanceBonus', labelBn: 'হাজিরা বোনাস', labelEn: 'Attendance Bonus', unit: 'bdt' },
    { key: 'otherAllowances', labelBn: 'অন্যান্য ভাতা', labelEn: 'Other Allowances', unit: 'bdt' },
    { key: 'advanceDeduction', labelBn: 'অগ্রিম কর্তন', labelEn: 'Advance Deduction', unit: 'bdt', isDeduction: true },
    { key: 'absentDeduction', labelBn: 'অনুপস্থিতি কর্তন', labelEn: 'Absence Deduction', unit: 'bdt', isDeduction: true },
    { key: 'otherDeductions', labelBn: 'অন্যান্য কর্তন', labelEn: 'Other Deductions', unit: 'bdt', isDeduction: true },
    { key: 'netPayable', labelBn: 'মোট প্রদেয় বেতন', labelEn: 'Net Payable', unit: 'bdt' },
  ];

  const rows: PayslipComparisonRow[] = specs.map((spec) => {
    const pVal = parsed[spec.key];
    const aVal = roundCurrency(Number(appData[spec.key]) || 0);
    if (pVal === null || pVal === undefined || Number.isNaN(Number(pVal))) {
      return {
        ...spec,
        payslipVal: null,
        appVal: aVal,
        diff: null,
        status: 'missing',
      };
    }
    const cleanP = roundCurrency(Number(pVal));
    const diff = roundCurrency(cleanP - aVal);
    const tolerance = spec.unit === 'bdt' ? 2 : 0.1;
    const isMatch = Math.abs(diff) <= tolerance;
    return {
      ...spec,
      payslipVal: cleanP,
      appVal: aVal,
      diff,
      status: isMatch ? 'match' : 'mismatch',
    };
  });

  const payslipNet =
    parsed.netPayable !== null && parsed.netPayable !== undefined
      ? roundCurrency(Number(parsed.netPayable))
      : roundCurrency(
          (parsed.grossSalary ??
            (parsed.basicSalary || 0) +
              (parsed.houseRentAllowance || 0) +
              (parsed.medicalAllowance || 0) +
              (parsed.transportAllowance || 0) +
              (parsed.foodAllowance || 0)) +
            (parsed.otAmount || 0) +
            (parsed.attendanceBonus || 0) +
            (parsed.otherAllowances || 0) -
            (parsed.advanceDeduction || 0) -
            (parsed.absentDeduction || 0) -
            (parsed.otherDeductions || 0)
        );
  const appNet = roundCurrency(appData.netPayable);
  const netDiff = roundCurrency(payslipNet - appNet);
  const isMatched = Math.abs(netDiff) <= 5;

  const headlineBn = isMatched
    ? 'সব হিসাব মিলে গেছে'
    : netDiff < 0
    ? `পে-স্লিপে ${formatBDT(Math.abs(netDiff), 'bn')} কম এসেছে`
    : `পে-স্লিপে ${formatBDT(netDiff, 'bn')} বেশি এসেছে`;

  const headlineEn = isMatched
    ? 'Everything matches'
    : netDiff < 0
    ? `Payslip is short by ${formatBDT(Math.abs(netDiff), 'en')}`
    : `Payslip is higher by ${formatBDT(netDiff, 'en')}`;

  return {
    rows,
    payslipNet,
    appNet,
    netDiff,
    headlineBn,
    headlineEn,
    isMatched,
  };
}

// ============================================================================
// 6. SAVINGS GOAL MONTHLY PLAN & MID-MONTH CHECK
// ============================================================================

export interface SavingsGoalPlanEvaluation {
  effectiveSaved: number;
  remainingAmount: number;
  progressPct: number;
  monthsRemaining: number;
  monthlyTargetNeeded: number;
  isBehindMidMonth: boolean;
  isCompleted: boolean;
}

export function evaluateSavingsGoalPlan(params: {
  goal: SavingsGoal;
  todayISO: string;
  currentMonthSurplus?: number;
}): SavingsGoalPlanEvaluation {
  const { goal, todayISO, currentMonthSurplus = 0 } = params;
  const target = Math.max(0, Number(goal.targetAmount) || 0);
  const baseSaved = Math.max(0, Number(goal.savedAmount) || 0);
  const surplusBoost =
    goal.countMonthlySurplus && currentMonthSurplus > 0 ? Math.round(currentMonthSurplus) : 0;
  const effectiveSaved = roundCurrency(baseSaved + surplusBoost);
  const remainingAmount = Math.max(0, roundCurrency(target - effectiveSaved));
  const progressPct = target > 0 ? Math.min(100, Math.round((effectiveSaved / target) * 100)) : 0;
  const isCompleted = target > 0 && effectiveSaved >= target;

  let monthsRemaining = 1;
  if (goal.deadline && /^\d{4}-\d{2}-\d{2}$/.test(goal.deadline) && /^\d{4}-\d{2}-\d{2}$/.test(todayISO)) {
    const [ty, tm, td] = todayISO.split('-').map(Number);
    const [dy, dm, dd] = goal.deadline.split('-').map(Number);
    const monthDiff = (dy - ty) * 12 + (dm - tm) + (dd >= td ? 0 : -1);
    monthsRemaining = Math.max(1, monthDiff + (dd > td ? 1 : 0));
  }

  const monthlyTargetNeeded =
    remainingAmount > 0 ? Math.ceil(remainingAmount / monthsRemaining) : 0;

  // Soft mid-month behind-plan reminder after 15th of month if no deposit this month
  const dayOfMonth = Number(todayISO.slice(8, 10)) || 1;
  const currentMonth = todayISO.slice(0, 7);
  const depositedThisMonth = Boolean(goal.lastDepositDate && goal.lastDepositDate.startsWith(currentMonth));
  const isBehindMidMonth =
    !isCompleted && dayOfMonth > 15 && monthlyTargetNeeded > 0 && !depositedThisMonth;

  return {
    effectiveSaved,
    remainingAmount,
    progressPct,
    monthsRemaining,
    monthlyTargetNeeded,
    isBehindMidMonth,
    isCompleted,
  };
}

// ============================================================================
// 7. ANONYMOUS REAL COMPARISON GUARD (>= 20 WORKERS MEDIAN ONLY)
// ============================================================================

export interface AnonymousComparisonMetric {
  key: 'gross' | 'ot_hours' | 'attendance_bonus';
  labelBn: string;
  labelEn: string;
  unit: 'bdt' | 'hours';
  userValue: number;
  medianValue: number;
}

export interface AnonymousComparisonViewData {
  sampleCount: number;
  gradeLabel: string;
  areaLabel: string;
  metrics: AnonymousComparisonMetric[];
}

export function buildAnonymousComparisonData(params: {
  benchmark: AnonymousGradeAreaBenchmark | null;
  userGross: number;
  userMonthlyOtHours: number;
  userAttendanceBonus: number;
}): AnonymousComparisonViewData | null {
  const { benchmark, userGross, userMonthlyOtHours, userAttendanceBonus } = params;
  // STRICT RULE: Only show comparison if at least 20 real anonymized workers exist in the bucket
  if (!benchmark || !Number.isFinite(benchmark.sampleCount) || benchmark.sampleCount < 20) {
    return null;
  }
  return {
    sampleCount: benchmark.sampleCount,
    gradeLabel: benchmark.salaryGrade,
    areaLabel: benchmark.area,
    metrics: [
      {
        key: 'gross',
        labelBn: 'মোট বেতন',
        labelEn: 'Gross Salary',
        unit: 'bdt',
        userValue: Math.round(userGross),
        medianValue: Math.round(benchmark.medianGrossSalary),
      },
      {
        key: 'ot_hours',
        labelBn: 'মাসিক ওটি ঘণ্টা',
        labelEn: 'Monthly OT Hours',
        unit: 'hours',
        userValue: roundCurrency(userMonthlyOtHours),
        medianValue: roundCurrency(benchmark.medianMonthlyOtHours),
      },
      {
        key: 'attendance_bonus',
        labelBn: 'হাজিরা বোনাস',
        labelEn: 'Attendance Bonus',
        unit: 'bdt',
        userValue: Math.round(userAttendanceBonus),
        medianValue: Math.round(benchmark.medianAttendanceBonus),
      },
    ],
  };
}

export function buildBenchmarkBucketKey(salaryGrade?: string, area?: string): string | null {
  const cleanGrade = (salaryGrade || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const cleanArea = (area || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!cleanGrade) return null;
  return cleanArea ? `${cleanGrade}__${cleanArea}` : cleanGrade;
}

// ============================================================================
// 8. FAMILY SHARE SUMMARY & CANVAS PNG CARD GENERATOR
// ============================================================================

export interface FamilyShareLine {
  label: string;
  value: string;
  highlight?: boolean;
}

export function buildFamilyShareText(params: {
  title: string;
  monthLabel: string;
  lines: FamilyShareLine[];
  lang: Language;
}): string {
  const header = `${params.title} — ${params.monthLabel}`;
  const body = params.lines.map((l) => `• ${l.label}: ${l.value}`).join('\n');
  const footer = params.lang === 'bn' ? 'শ্রমিক সাথী' : 'Shromik Sathi';
  return `${header}\n\n${body}\n\n— ${footer}`;
}

export async function renderSummaryCardToPngBlob(params: {
  title: string;
  monthLabel: string;
  lines: FamilyShareLine[];
  footerText: string;
}): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const width = 900;
  const rowHeight = 76;
  const height = Math.max(540, 250 + params.lines.length * rowHeight + 110);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Clean off-white background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, width, height);

  // Outer card with subtle border
  const pad = 40;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(pad, pad, cardW, cardH, 28);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top emerald header band
  ctx.fillStyle = '#047857';
  ctx.beginPath();
  ctx.roundRect(pad, pad, cardW, 138, [28, 28, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 38px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.fillText(params.title, pad + 40, pad + 64);

  ctx.fillStyle = '#D1FAE5';
  ctx.font = '600 24px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.fillText(params.monthLabel, pad + 40, pad + 108);

  // Rows
  let y = pad + 190;
  params.lines.forEach((line, idx) => {
    if (line.highlight) {
      ctx.fillStyle = '#ECFDF5';
      ctx.beginPath();
      ctx.roundRect(pad + 28, y - 42, cardW - 56, 64, 14);
      ctx.fill();
    } else if (idx > 0) {
      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad + 40, y - 46);
      ctx.lineTo(pad + cardW - 40, y - 46);
      ctx.stroke();
    }

    ctx.fillStyle = line.highlight ? '#065F46' : '#334155';
    ctx.font = `${line.highlight ? '700' : '600'} 25px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(line.label, pad + 44, y);

    ctx.fillStyle = line.highlight ? '#047857' : '#0F172A';
    ctx.font = 'bold 27px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(line.value, pad + cardW - 44, y);
    ctx.textAlign = 'left';

    y += rowHeight;
  });

  // Minimal bottom watermark
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 20px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(params.footerText, width / 2, height - pad - 24);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}

// ============================================================================
// 9. YEARLY SALARY HISTORY SHARE TEXT HELPER
// ============================================================================

export function buildSalaryHistoryShareText(
  summary: YearlySalaryPaymentSummary,
  lang: Language
): string {
  const yearLabel = lang === 'bn' ? toBengaliDigits(summary.year) : String(summary.year);
  const lines = [
    lang === 'bn'
      ? `বেতন পাওয়ার ইতিহাস (${yearLabel})`
      : `Salary Payment History (${yearLabel})`,
    '',
    lang === 'bn'
      ? `মোট পেয়েছেন: ${formatBDT(summary.totalReceivedYear, 'bn')}`
      : `Total Received: ${formatBDT(summary.totalReceivedYear, 'en')}`,
    lang === 'bn'
      ? `সময়মতো: ${toBengaliDigits(summary.onTimeMonthsCount)} মাস | দেরিতে: ${toBengaliDigits(summary.lateMonthsCount)} মাস`
      : `On-time: ${summary.onTimeMonthsCount} mo | Late: ${summary.lateMonthsCount} mo`,
    '',
    ...summary.rows
      .filter((r) => r.status !== 'no_record')
      .map((r) => {
        const mLabel = formatMonthLabel(r.month, lang);
        const amt = formatBDT(r.totalReceived, lang);
        const statusStr =
          r.status === 'on_time'
            ? lang === 'bn'
              ? 'সময়মতো'
              : 'On time'
            : lang === 'bn'
            ? `${toBengaliDigits(r.delayDays || 0)} দিন দেরিতে`
            : `${r.delayDays}d late`;
        return `• ${mLabel}: ${amt} (${statusStr})`;
      }),
    '',
    lang === 'bn' ? '— শ্রমিক সাথী' : '— Shromik Sathi',
  ];
  return lines.join('\n');
}

export function formatShortDelayText(
  delayDays: number | null,
  status: 'on_time' | 'late' | 'no_record',
  lang: Language
): string {
  if (status === 'no_record') return lang === 'bn' ? 'রেকর্ড নেই' : 'No record';
  if (status === 'on_time') return lang === 'bn' ? 'সময়মতো পেয়েছেন' : 'Paid on time';
  return lang === 'bn'
    ? `${toBengaliDigits(delayDays || 0)} দিন দেরিতে পেয়েছেন`
    : `${formatNumber(delayDays || 0, 'en')} days late`;
}
