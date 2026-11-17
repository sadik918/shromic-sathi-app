import type {
  AttendanceRecord,
  AttendanceStatus,
  Language,
  LeaveCategory,
  OvertimeRecord,
  SalaryPayment,
  SalaryRecord,
  WorkerProfile,
} from '../types';
import {
  calculateAttendanceBonusEligibility,
  computeDailyEarnedSalary,
  evaluateCheckInPunctuality,
  getEffectiveHourlyOtRate,
  getPublicHolidayForDate,
  resolveWorkerShiftForDate,
  roundCurrency,
  summarizeAttendanceForMonth,
  summarizeMonthlyPayments,
  summarizeOvertimeRecords,
  toBengaliDigits,
} from './calculations';

export type ReportStatusFilter =
  | 'all'
  | 'present'
  | 'late'
  | 'absent'
  | 'leave'
  | 'holiday';

export interface AttendanceReportRow {
  date: string; // YYYY-MM-DD
  dateLabel: string;
  dayShortLabel: string;
  inTime24: string;
  outTime24: string;
  inTimeDisplay: string;
  outTimeDisplay: string;
  status: AttendanceStatus | 'unmarked';
  statusLabelBn: string;
  statusLabelEn: string;
  leaveCategory: LeaveCategory;
  otHours: number;
  otDisplay: string;
  lateMinutes: number;
  lateDisplay: string;
  notes: string;
  shiftLabelBn: string;
  shiftLabelEn: string;
}

export interface MonthlyAttendanceReport {
  month: string;
  scheduledShiftWindow: string;
  scheduledShiftLabelBn: string;
  scheduledShiftLabelEn: string;
  rows: AttendanceReportRow[];
  summary: {
    totalPresent: number; // present + late
    onTimePresent: number;
    totalWorkingDays: number; // present + late + absent
    totalDutyTrackedDays: number; // present + late + absent + approved_leave
    totalAbsent: number;
    totalLate: number;
    totalLateMinutes: number;
    totalApprovedLeave: number;
    totalPublicHolidays: number;
    totalWeeklyHolidays: number;
    totalOvertimeHours: number;
    totalTrackedRecords: number;
  };
}

export interface LeaveReportRow {
  date: string;
  dateLabel: string;
  status: 'approved_leave' | 'weekly_holiday' | 'public_holiday' | 'absent';
  typeLabelBn: string;
  typeLabelEn: string;
  categoryLabelBn: string;
  categoryLabelEn: string;
  notes: string;
}

export interface MonthlyLeaveReport {
  month: string;
  year: string;
  monthlySummary: {
    approvedLeaveDays: number;
    weeklyHolidays: number;
    publicHolidays: number;
    absentDays: number;
    casualUsedInMonth: number;
    sickUsedInMonth: number;
    earnedUsedInMonth: number;
    unpaidUsedInMonth: number;
  };
  annualSummary: {
    casualEntitled: number;
    casualUsed: number;
    casualRemaining: number;
    sickEntitled: number;
    sickUsed: number;
    sickRemaining: number;
    earnedAccruedEst: number;
    earnedUsed: number;
    earnedRemaining: number;
    yearWorkingDays: number;
  };
  rows: LeaveReportRow[];
}

export interface MonthlySalaryReport {
  month: string;
  hasSavedSalaryRecord: boolean;
  workedDays: number;
  absentDays: number;
  lateDays: number;
  attendanceBonusEligible: boolean;
  basicSalary: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
  attendanceBonus: number;
  overtimeHours: number;
  overtimeHourlyRate: number;
  overtimeEarnings: number;
  festivalBonus: number;
  otherAllowances: number;
  advanceDeduction: number;
  absenceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  estimatedGross: number;
  estimatedNetPayable: number;
  totalReceived: number;
  outstandingBalance: number;
  overpaidAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  payments: SalaryPayment[];
}

const BN_SHORT_MONTHS: Record<string, string> = {
  '01': 'জানু',
  '02': 'ফেব্রু',
  '03': 'মার্চ',
  '04': 'এপ্রি',
  '05': 'মে',
  '06': 'জুন',
  '07': 'জুলাই',
  '08': 'আগস্ট',
  '09': 'সেপ্টে',
  '10': 'অক্টো',
  '11': 'নভে',
  '12': 'ডিসে',
};

const EN_SHORT_MONTHS: Record<string, string> = {
  '01': 'Jan',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Apr',
  '05': 'May',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Aug',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dec',
};

const BN_SHORT_WEEKDAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
const EN_SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LEAVE_CATEGORY_LABELS: Record<LeaveCategory, { bn: string; en: string }> = {
  none: { bn: 'প্রযোজ্য নয়', en: 'N/A' },
  casual: { bn: 'নৈমিত্তিক ছুটি', en: 'Casual Leave' },
  sick: { bn: 'অসুস্থতাজনিত ছুটি', en: 'Sick Leave' },
  earned: { bn: 'অর্জিত ছুটি', en: 'Earned Leave' },
  maternity: { bn: 'মাতৃত্বকালীন ছুটি', en: 'Maternity Leave' },
  festival: { bn: 'উৎসব ছুটি', en: 'Festival Leave' },
  unpaid: { bn: 'বিনা বেতনে ছুটি', en: 'Unpaid Leave' },
};

const STATUS_LABELS: Record<AttendanceStatus | 'unmarked', { bn: string; en: string }> = {
  present: { bn: 'উপস্থিত', en: 'Present' },
  late: { bn: 'দেরি', en: 'Late' },
  absent: { bn: 'অনুপস্থিত', en: 'Absent' },
  approved_leave: { bn: 'ছুটি', en: 'Leave' },
  weekly_holiday: { bn: 'সাপ্তাহিক ছুটি', en: 'Weekly Off' },
  public_holiday: { bn: 'সরকারি ছুটি', en: 'Govt Holiday' },
  unmarked: { bn: 'অচিহ্নিত', en: 'Unmarked' },
};

/**
 * Formats 24-hour 'HH:mm' string to 'hh:mm AM/PM', or '--:--' when blank.
 */
export function formatTime12h(time24?: string): string {
  if (!time24 || !/^\d{1,2}:\d{2}$/.test(time24.trim())) {
    return '--:--';
  }
  const [hRaw, mRaw] = time24.trim().split(':').map(Number);
  if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) return '--:--';
  const period = hRaw >= 12 ? 'PM' : 'AM';
  const h12 = hRaw % 12 === 0 ? 12 : hRaw % 12;
  const hh = String(h12).padStart(2, '0');
  const mm = String(mRaw).padStart(2, '0');
  return `${hh}:${mm} ${period}`;
}

export function formatReportShortDate(dateISO: string, lang: Language): string {
  const parts = dateISO.split('-');
  if (parts.length !== 3) return dateISO;
  const [, m, d] = parts;
  const dd = d.padStart(2, '0');
  if (lang === 'bn') {
    return `${toBengaliDigits(dd)} ${BN_SHORT_MONTHS[m] || m}`;
  }
  return `${dd} ${EN_SHORT_MONTHS[m] || m}`;
}

export function formatHoursCompact(hours: number, lang: Language): string {
  const rounded = roundCurrency(hours);
  if (rounded <= 0) {
    return lang === 'bn' ? '০০ ঘ.' : '0h';
  }
  const formatted = Number.isInteger(rounded)
    ? `${rounded}.0`
    : rounded.toFixed(1);
  return lang === 'bn' ? `${toBengaliDigits(formatted)} ঘ.` : `${formatted}h`;
}

export function formatLateCompact(minutes: number, lang: Language): string {
  const mins = Math.max(0, Math.round(minutes));
  if (mins <= 0) {
    return lang === 'bn' ? '০০ মি.' : '0m';
  }
  return lang === 'bn' ? `${toBengaliDigits(mins)} মি.` : `${mins}m`;
}

export function getDaysInMonthCount(monthISO: string): number {
  const [y, m] = monthISO.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

export function buildMonthlyAttendanceReport(params: {
  month: string;
  attendance: AttendanceRecord[];
  overtime: OvertimeRecord[];
  profile: WorkerProfile;
  lang: Language;
  todayISO?: string;
  includeAllMonthDays?: boolean;
}): MonthlyAttendanceReport {
  const {
    month,
    attendance,
    overtime,
    profile,
    lang,
    todayISO,
    includeAllMonthDays = false,
  } = params;

  const monthAttendance = attendance.filter((a) => a.month === month);
  const monthOvertime = overtime.filter((o) => o.month === month);

  const attByDate = new Map<string, AttendanceRecord>();
  for (const rec of monthAttendance) {
    attByDate.set(rec.date, rec);
  }

  const otByDate = new Map<string, OvertimeRecord[]>();
  for (const ot of monthOvertime) {
    const existing = otByDate.get(ot.date) || [];
    existing.push(ot);
    otByDate.set(ot.date, existing);
  }

  const totalDaysInMonth = getDaysInMonthCount(month);
  const datesSet = new Set<string>();

  if (includeAllMonthDays) {
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const iso = `${month}-${String(day).padStart(2, '0')}`;
      if (!todayISO || iso <= todayISO || attByDate.has(iso) || otByDate.has(iso)) {
        datesSet.add(iso);
      }
    }
  } else {
    for (const a of monthAttendance) datesSet.add(a.date);
    for (const o of monthOvertime) datesSet.add(o.date);
  }

  const sortedDates = Array.from(datesSet).sort((a, b) => a.localeCompare(b));

  const sampleShift = resolveWorkerShiftForDate(profile, `${month}-01`, 0);
  const scheduledShiftWindow = `${formatTime12h(sampleShift.officeStartTime)} - ${formatTime12h(
    sampleShift.defaultEndTime
  )}`;

  let totalLateMinutes = 0;
  let totalOvertimeHours = 0;

  const rows: AttendanceReportRow[] = sortedDates.map((dateISO) => {
    const rec = attByDate.get(dateISO);
    const dayOts = otByDate.get(dateISO) || [];
    const otHours = roundCurrency(
      dayOts.reduce((sum, item) => sum + (Number(item.approvedHours) || 0), 0)
    );
    totalOvertimeHours = roundCurrency(totalOvertimeHours + otHours);

    const shiftForDay = resolveWorkerShiftForDate(profile, dateISO, 0);
    const pubHoliday = getPublicHolidayForDate(dateISO);
    const jsDay = new Date(`${dateISO}T00:00:00`).getDay();
    const dayShortLabel =
      lang === 'bn' ? BN_SHORT_WEEKDAYS[jsDay] || '' : EN_SHORT_WEEKDAYS[jsDay] || '';

    const status: AttendanceStatus | 'unmarked' = rec
      ? rec.status
      : dayOts.length > 0
      ? 'present'
      : 'unmarked';

    const inTime24 =
      rec?.checkIn ||
      (status === 'present' || status === 'late' ? shiftForDay.officeStartTime : '');

    // Pick latest checkOut from attendance record or overtime endTime
    const otEndTime = dayOts.length > 0 ? dayOts[dayOts.length - 1].endTime : '';
    const outTime24 =
      otEndTime ||
      rec?.checkOut ||
      (status === 'present' || status === 'late' ? shiftForDay.defaultEndTime : '');

    let lateMinutes = 0;
    if (status === 'present' || status === 'late') {
      if (rec?.checkIn) {
        const cutoff =
          shiftForDay.activeShift === 'night'
            ? profile.nightBonusCutoffTime ||
              profile.attendanceWindowEndNight ||
              shiftForDay.officeStartTime
            : profile.dayBonusCutoffTime ||
              profile.attendanceWindowEndDay ||
              shiftForDay.officeStartTime;
        const punc = evaluateCheckInPunctuality({
          checkInTime: rec.checkIn,
          shiftStartTime: shiftForDay.officeStartTime,
          bonusCutoffTime: cutoff,
        });
        lateMinutes = punc.lateMinutes;
      }
      if (status === 'late' && lateMinutes === 0) {
        // Fallback when user marked status='late' without altering checkIn timestamp
        lateMinutes = 15;
      }
      totalLateMinutes += lateMinutes;
    }

    const statusMeta = STATUS_LABELS[status];
    const defaultNote = pubHoliday
      ? lang === 'bn'
        ? pubHoliday.titleBn
        : pubHoliday.titleEn
      : '';

    return {
      date: dateISO,
      dateLabel: formatReportShortDate(dateISO, lang),
      dayShortLabel,
      inTime24,
      outTime24,
      inTimeDisplay: formatTime12h(inTime24),
      outTimeDisplay: formatTime12h(outTime24),
      status,
      statusLabelBn: statusMeta.bn,
      statusLabelEn: statusMeta.en,
      leaveCategory: rec?.leaveCategory || 'none',
      otHours,
      otDisplay: formatHoursCompact(otHours, lang),
      lateMinutes,
      lateDisplay: formatLateCompact(lateMinutes, lang),
      notes: rec?.notes || defaultNote,
      shiftLabelBn: shiftForDay.shiftLabelBn,
      shiftLabelEn: shiftForDay.shiftLabelEn,
    };
  });

  const attSummary = summarizeAttendanceForMonth(monthAttendance);

  return {
    month,
    scheduledShiftWindow,
    scheduledShiftLabelBn: sampleShift.shiftLabelBn,
    scheduledShiftLabelEn: sampleShift.shiftLabelEn,
    rows,
    summary: {
      totalPresent: attSummary.workingDays,
      onTimePresent: attSummary.presentDays,
      totalWorkingDays: attSummary.workingDays + attSummary.absentDays,
      totalDutyTrackedDays:
        attSummary.workingDays + attSummary.absentDays + attSummary.approvedLeaveDays,
      totalAbsent: attSummary.absentDays,
      totalLate: attSummary.lateDays,
      totalLateMinutes,
      totalApprovedLeave: attSummary.approvedLeaveDays,
      totalPublicHolidays: attSummary.publicHolidays,
      totalWeeklyHolidays: attSummary.weeklyHolidays,
      totalOvertimeHours,
      totalTrackedRecords: monthAttendance.length,
    },
  };
}

export function filterAttendanceReportRows(
  rows: AttendanceReportRow[],
  filter: ReportStatusFilter
): AttendanceReportRow[] {
  if (filter === 'all') return rows;
  if (filter === 'present') {
    return rows.filter((r) => r.status === 'present');
  }
  if (filter === 'late') {
    return rows.filter((r) => r.status === 'late');
  }
  if (filter === 'absent') {
    return rows.filter((r) => r.status === 'absent');
  }
  if (filter === 'leave') {
    return rows.filter((r) => r.status === 'approved_leave');
  }
  if (filter === 'holiday') {
    return rows.filter(
      (r) => r.status === 'weekly_holiday' || r.status === 'public_holiday'
    );
  }
  return rows;
}

export function buildMonthlyLeaveReport(params: {
  month: string;
  attendance: AttendanceRecord[];
  lang: Language;
}): MonthlyLeaveReport {
  const { month, attendance, lang } = params;
  const year = month.slice(0, 4);

  const monthRecords = attendance
    .filter((a) => a.month === month)
    .sort((a, b) => a.date.localeCompare(b.date));
  const yearRecords = attendance.filter((a) => a.month.startsWith(year));

  const monthSummary = summarizeAttendanceForMonth(monthRecords);
  const yearSummary = summarizeAttendanceForMonth(yearRecords);

  const casualUsedYear = yearSummary.leaveBreakdown.casual;
  const sickUsedYear = yearSummary.leaveBreakdown.sick;
  const earnedUsedYear = yearSummary.leaveBreakdown.earned;
  const earnedAccruedEst = Math.floor(yearSummary.workingDays / 18);

  const rows: LeaveReportRow[] = monthRecords
    .filter(
      (r) =>
        r.status === 'approved_leave' ||
        r.status === 'weekly_holiday' ||
        r.status === 'public_holiday' ||
        r.status === 'absent'
    )
    .map((r) => {
      const st = STATUS_LABELS[r.status];
      const catMeta = LEAVE_CATEGORY_LABELS[r.leaveCategory || 'none'];
      const pubHol = getPublicHolidayForDate(r.date);
      return {
        date: r.date,
        dateLabel: formatReportShortDate(r.date, lang),
        status: r.status as LeaveReportRow['status'],
        typeLabelBn: st.bn,
        typeLabelEn: st.en,
        categoryLabelBn:
          r.status === 'approved_leave'
            ? catMeta.bn
            : r.status === 'public_holiday' && pubHol
            ? pubHol.titleBn
            : st.bn,
        categoryLabelEn:
          r.status === 'approved_leave'
            ? catMeta.en
            : r.status === 'public_holiday' && pubHol
            ? pubHol.titleEn
            : st.en,
        notes: r.notes || '',
      };
    });

  return {
    month,
    year,
    monthlySummary: {
      approvedLeaveDays: monthSummary.approvedLeaveDays,
      weeklyHolidays: monthSummary.weeklyHolidays,
      publicHolidays: monthSummary.publicHolidays,
      absentDays: monthSummary.absentDays,
      casualUsedInMonth: monthSummary.leaveBreakdown.casual,
      sickUsedInMonth: monthSummary.leaveBreakdown.sick,
      earnedUsedInMonth: monthSummary.leaveBreakdown.earned,
      unpaidUsedInMonth: monthSummary.leaveBreakdown.unpaid,
    },
    annualSummary: {
      casualEntitled: 10,
      casualUsed: casualUsedYear,
      casualRemaining: Math.max(0, 10 - casualUsedYear),
      sickEntitled: 14,
      sickUsed: sickUsedYear,
      sickRemaining: Math.max(0, 14 - sickUsedYear),
      earnedAccruedEst,
      earnedUsed: earnedUsedYear,
      earnedRemaining: Math.max(0, earnedAccruedEst - earnedUsedYear),
      yearWorkingDays: yearSummary.workingDays,
    },
    rows,
  };
}

export function buildMonthlySalaryReport(params: {
  month: string;
  profile: WorkerProfile;
  attendance: AttendanceRecord[];
  overtime: OvertimeRecord[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
}): MonthlySalaryReport {
  const { month, profile, attendance, overtime, salaryRecords, payments } = params;

  const monthAttendance = attendance.filter((a) => a.month === month);
  const monthOvertime = overtime.filter((o) => o.month === month);
  const monthPayments = payments
    .filter((p) => p.month === month)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const savedRecord = salaryRecords.find((s) => s.month === month);

  const otSummary = summarizeOvertimeRecords(monthOvertime, month);
  const hourlyRate = getEffectiveHourlyOtRate(profile);
  const attSummary = summarizeAttendanceForMonth(monthAttendance);

  const basicSalary = savedRecord ? savedRecord.basicSalary : profile.basicSalary;
  const houseRentAllowance = savedRecord
    ? savedRecord.houseRentAllowance
    : profile.houseRentAllowance;
  const medicalAllowance = savedRecord
    ? savedRecord.medicalAllowance
    : profile.medicalAllowance;
  const transportAllowance = savedRecord
    ? savedRecord.transportAllowance
    : profile.transportAllowance;
  const foodAllowance = savedRecord
    ? savedRecord.foodAllowance
    : profile.foodAllowance;

  const monthlyWage = roundCurrency(
    basicSalary +
      houseRentAllowance +
      medicalAllowance +
      transportAllowance +
      foodAllowance
  );

  const overtimeHours =
    monthOvertime.length > 0
      ? otSummary.monthlyHours
      : savedRecord?.overtimeHours || 0;
  const overtimeEarnings =
    monthOvertime.length > 0
      ? otSummary.monthlyEarnings
      : savedRecord?.overtimeEarnings || 0;

  const bonusEval = calculateAttendanceBonusEligibility({
    recordsForMonth: monthAttendance,
    profile,
  });

  const festivalBonus = savedRecord?.festivalBonus || 0;
  const otherAllowances = savedRecord?.otherAllowances || 0;
  const advanceDeduction = savedRecord?.advanceDeduction || 0;
  const absenceDeduction = savedRecord?.absenceDeduction || 0;
  const otherDeductions = savedRecord?.otherDeductions || 0;
  const totalDeductions = roundCurrency(
    advanceDeduction + absenceDeduction + otherDeductions
  );

  const rawBonusAmount =
    profile.hasAttendanceBonus === false
      ? 0
      : savedRecord?.attendanceBonus ??
        profile.attendanceBonusAmount ??
        profile.attendanceBonus ??
        0;

  const earnedDaily = computeDailyEarnedSalary({
    monthlyWage,
    attendanceRecords: monthAttendance,
    overtimeEarnings,
    attendanceBonus: rawBonusAmount,
    isAttendanceBonusEligible: bonusEval.isEligible,
    otherAllowances: festivalBonus + otherAllowances,
    deductions: totalDeductions,
    adjustments: savedRecord?.adjustments || 0,
  });

  const attendanceBonus = earnedDaily.earnedAttendanceBonus;

  // If user has attendance rows in this month, use earnedNetPayable from tracked days + saved deductions/bonuses
  const estimatedNetPayable =
    monthAttendance.length > 0
      ? earnedDaily.totalEarnedSalary
      : savedRecord
      ? savedRecord.estimatedNetPayable
      : roundCurrency(overtimeEarnings);

  const estimatedGross =
    monthAttendance.length > 0
      ? earnedDaily.totalEarnedGross
      : savedRecord
      ? savedRecord.estimatedGross
      : roundCurrency(overtimeEarnings);

  const paymentBalance = summarizeMonthlyPayments(estimatedNetPayable, monthPayments);

  return {
    month,
    hasSavedSalaryRecord: Boolean(savedRecord),
    workedDays: attSummary.workingDays,
    absentDays: attSummary.absentDays,
    lateDays: attSummary.lateDays,
    attendanceBonusEligible: bonusEval.isEligible,
    basicSalary,
    houseRentAllowance,
    medicalAllowance,
    transportAllowance,
    foodAllowance,
    attendanceBonus,
    overtimeHours,
    overtimeHourlyRate: hourlyRate,
    overtimeEarnings,
    festivalBonus,
    otherAllowances,
    advanceDeduction,
    absenceDeduction,
    otherDeductions,
    totalDeductions,
    estimatedGross,
    estimatedNetPayable,
    totalReceived: paymentBalance.totalReceived,
    outstandingBalance: paymentBalance.outstandingBalance,
    overpaidAmount: paymentBalance.overpaidAmount,
    paymentStatus: paymentBalance.status,
    payments: monthPayments,
  };
}
