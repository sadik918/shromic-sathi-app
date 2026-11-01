import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Mic,
  PiggyBank,
  Plus,
  Star,
  TrendingUp,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { AttendanceStatus, MoreSubView, NavTab } from '../types';
import {
  calculateAttendanceBonusEligibility,
  calculateOvertimeEstimate,
  calculateSalaryTotals,
  calculateSmartSalaryComparison,
  computeDailyEarnedSalary,
  evaluateBudgetAlert,
  formatBDT,
  formatNumber,
  getDefaultDateForMonth,
  getEffectiveHourlyOtRate,
  getPreviousMonth,
  getPublicHolidayForDate,
  getPublicHolidaysForMonth,
  isDailyQuickEntryCompleted,
  isFutureDate,
  isFutureMonth,
  shouldShowQuickDailyActions,
  summarizeAttendanceForMonth,
  summarizeMonthlyPayments,
  summarizeOvertimeRecords,
  summarizePersonalFinances,
  summarizePersonalLoans,
  toBengaliDigits,
} from '../utils/calculations';
import {
  formatDateReadable,
  formatDateSlashDMY,
  formatMonthLabel,
  formatShortMonthName,
  T,
} from '../utils/i18n';
import {
  getCalendarCellBadgeMeta,
  getRemindersForCalendarDate,
  parseCalendarReminderMeta,
  stepMonthISO,
} from '../utils/calendarReminders';
import { CalendarDateReminderSection } from './CalendarDateReminderSection';
import { DateInputDMY } from './DateInputDMY';
import { MissingRecordsSection } from './MissingRecordsSection';

interface DashboardViewProps {
  onNavigateTab: (tab: NavTab, sub?: MoreSubView, targetDateISO?: string) => void;
  onOpenVoiceModal: () => void;
}

const HOME_STATUS_LABELS: Record<AttendanceStatus, { bn: string; en: string; shortBn: string }> = {
  present: { bn: 'উপস্থিত', en: 'Present', shortBn: 'উপ' },
  late: { bn: 'দেরি', en: 'Late', shortBn: 'দেরি' },
  approved_leave: { bn: 'ছুটি', en: 'Leave', shortBn: 'ছুটি' },
  weekly_holiday: { bn: 'শুক্রবার ছুটি', en: 'Weekly Off', shortBn: 'শুক্র' },
  public_holiday: { bn: 'সরকারি ছুটি', en: 'Govt Holiday', shortBn: 'সরকারি' },
  absent: { bn: 'অনুপস্থিত', en: 'Absent', shortBn: 'অনু' },
};

const WEEKDAY_NAMES: Array<{ bn: string; en: string; isWeekend: boolean }> = [
  { bn: 'শনি', en: 'Sat', isWeekend: false },
  { bn: 'রবি', en: 'Sun', isWeekend: false },
  { bn: 'সোম', en: 'Mon', isWeekend: false },
  { bn: 'মঙ্গল', en: 'Tue', isWeekend: false },
  { bn: 'বুধ', en: 'Wed', isWeekend: false },
  { bn: 'বৃহস্পতি', en: 'Thu', isWeekend: false },
  { bn: 'শুক্র', en: 'Fri', isWeekend: true },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenVoiceModal,
}) => {
  const {
    user,
    profile,
    todayISO,
    currentMonthISO,
    selectedMonth,
    setSelectedMonth,
    lang,
    overtime,
    salaryRecords,
    payments,
    attendance,
    expenses,
    savings,
    loans,
    reminders,
    isProfileSetupIncomplete,
    reopenOnboarding,
    saveOvertime,
    deleteOvertime,
    saveAttendance,
    saveReminder,
    toggleReminder,
    deleteReminder,
  } = useData();

  const dict = T[lang];
  const isUpcomingMonth = isFutureMonth(selectedMonth, currentMonthISO);
  const [quickDate, setQuickDate] = useState(() =>
    getDefaultDateForMonth(selectedMonth, todayISO)
  );
  const [quickFeedback, setQuickFeedback] = useState('');
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [isEditingQuickCalc, setIsEditingQuickCalc] = useState(false);
  const [noOtConfirmedDates, setNoOtConfirmedDates] = useState<Record<string, boolean>>({});
  const [quickHasBonus, setQuickHasBonus] = useState<boolean>(true);

  const [quickDraftStatus, setQuickDraftStatus] = useState<AttendanceStatus>('present');
  const [quickDraftOtHours, setQuickDraftOtHours] = useState<number>(0);
  const [quickDraftBonus, setQuickDraftBonus] = useState<boolean>(true);
  const [quickOtResetNotice, setQuickOtResetNotice] = useState<string>('');

  useEffect(() => {
    if (!quickDate.startsWith(selectedMonth)) {
      setQuickDate(getDefaultDateForMonth(selectedMonth, todayISO));
    }
  }, [selectedMonth, todayISO, quickDate]);

  const isQuickDateFuture = isFutureDate(quickDate, todayISO);
  const isQuickActionLocked = isUpcomingMonth || isQuickDateFuture;

  // Filter current month records & detect missing entries
  const otSummary = summarizeOvertimeRecords(overtime, selectedMonth, quickDate);
  const monthPayments = payments.filter((p) => p.month === selectedMonth);
  const monthAttendance = attendance.filter((a) => a.month === selectedMonth);
  const monthExpenses = expenses.filter((e) => e.month === selectedMonth);
  const monthHolidays = getPublicHolidaysForMonth(selectedMonth);

  const savedSalaryRecord = salaryRecords.find((s) => s.month === selectedMonth);

  const computedSalary = calculateSalaryTotals({
    basicSalary: savedSalaryRecord ? savedSalaryRecord.basicSalary : profile.basicSalary,
    houseRentAllowance: savedSalaryRecord
      ? savedSalaryRecord.houseRentAllowance
      : profile.houseRentAllowance,
    medicalAllowance: savedSalaryRecord
      ? savedSalaryRecord.medicalAllowance
      : profile.medicalAllowance,
    transportAllowance: savedSalaryRecord
      ? savedSalaryRecord.transportAllowance
      : profile.transportAllowance,
    foodAllowance: savedSalaryRecord ? savedSalaryRecord.foodAllowance : profile.foodAllowance,
    attendanceBonus: savedSalaryRecord
      ? savedSalaryRecord.attendanceBonus
      : profile.attendanceBonus,
    overtimeEarnings: otSummary.monthlyEarnings,
    festivalBonus: savedSalaryRecord ? savedSalaryRecord.festivalBonus : 0,
    otherAllowances: savedSalaryRecord ? savedSalaryRecord.otherAllowances : 0,
    advanceDeduction: savedSalaryRecord ? savedSalaryRecord.advanceDeduction : 0,
    absenceDeduction: savedSalaryRecord ? savedSalaryRecord.absenceDeduction : 0,
    otherDeductions: savedSalaryRecord ? savedSalaryRecord.otherDeductions : 0,
    adjustments: savedSalaryRecord ? savedSalaryRecord.adjustments : 0,
  });

  const monthlyWageBase =
    (profile.grossSalary > 0 ? profile.grossSalary : 0) ||
    computedSalary.baseGross ||
    profile.basicSalary ||
    12500;

  const attBonusEval = calculateAttendanceBonusEligibility({
    recordsForMonth: monthAttendance,
    profile,
  });

  const earnedSalaryBreakdown = computeDailyEarnedSalary({
    monthlyWage: monthlyWageBase,
    attendanceRecords: monthAttendance,
    overtimeEarnings: otSummary.monthlyEarnings,
    attendanceBonus: savedSalaryRecord ? savedSalaryRecord.attendanceBonus : profile.attendanceBonus,
    isAttendanceBonusEligible: attBonusEval.isEligible,
    otherAllowances: savedSalaryRecord
      ? (savedSalaryRecord.festivalBonus || 0) + (savedSalaryRecord.otherAllowances || 0)
      : 0,
    deductions: savedSalaryRecord
      ? savedSalaryRecord.advanceDeduction +
        savedSalaryRecord.absenceDeduction +
        savedSalaryRecord.otherDeductions
      : 0,
    adjustments: savedSalaryRecord ? savedSalaryRecord.adjustments : 0,
  });

  const expectedNetSalary = earnedSalaryBreakdown.totalEarnedSalary;
  const paymentSummary = summarizeMonthlyPayments(expectedNetSalary, monthPayments);
  const earnedOutstandingBalance = Math.max(
    0,
    Math.round(earnedSalaryBreakdown.totalEarnedSalary - paymentSummary.totalReceived)
  );
  const attendanceSummary = summarizeAttendanceForMonth(monthAttendance);
  const financeSummary = summarizePersonalFinances(monthPayments, monthExpenses, savings);
  const loanSummary = summarizePersonalLoans(loans);

  // Previous month comparison for Smart Salary Comparison & Financial Insights
  const prevMonth = getPreviousMonth(selectedMonth);
  const prevOtSummary = summarizeOvertimeRecords(overtime, prevMonth);
  const prevSalaryRecord = salaryRecords.find((s) => s.month === prevMonth);
  const prevComputedSalary = calculateSalaryTotals({
    basicSalary: prevSalaryRecord ? prevSalaryRecord.basicSalary : profile.basicSalary,
    houseRentAllowance: prevSalaryRecord
      ? prevSalaryRecord.houseRentAllowance
      : profile.houseRentAllowance,
    medicalAllowance: prevSalaryRecord
      ? prevSalaryRecord.medicalAllowance
      : profile.medicalAllowance,
    transportAllowance: prevSalaryRecord
      ? prevSalaryRecord.transportAllowance
      : profile.transportAllowance,
    foodAllowance: prevSalaryRecord ? prevSalaryRecord.foodAllowance : profile.foodAllowance,
    attendanceBonus: prevSalaryRecord ? prevSalaryRecord.attendanceBonus : profile.attendanceBonus,
    overtimeEarnings: prevSalaryRecord
      ? prevSalaryRecord.overtimeEarnings
      : prevOtSummary.monthlyEarnings,
    festivalBonus: prevSalaryRecord ? prevSalaryRecord.festivalBonus : 0,
    otherAllowances: prevSalaryRecord ? prevSalaryRecord.otherAllowances : 0,
    advanceDeduction: prevSalaryRecord ? prevSalaryRecord.advanceDeduction : 0,
    absenceDeduction: prevSalaryRecord ? prevSalaryRecord.absenceDeduction : 0,
    otherDeductions: prevSalaryRecord ? prevSalaryRecord.otherDeductions : 0,
    adjustments: prevSalaryRecord ? prevSalaryRecord.adjustments : 0,
  });

  const smartComparison = calculateSmartSalaryComparison({
    currentMonthNet: expectedNetSalary,
    previousMonthNet: prevSalaryRecord
      ? prevSalaryRecord.estimatedNetPayable
      : prevComputedSalary.estimatedNetPayable,
    currentOtHours: otSummary.monthlyHours,
    previousOtHours: prevSalaryRecord
      ? prevSalaryRecord.overtimeHours
      : prevOtSummary.monthlyHours,
    currentOtEarnings: otSummary.monthlyEarnings,
    previousOtEarnings: prevSalaryRecord
      ? prevSalaryRecord.overtimeEarnings
      : prevOtSummary.monthlyEarnings,
    absentDays: attendanceSummary.absentDays,
    lateDays: attendanceSummary.lateDays,
    attendanceBonusAmount: profile.attendanceBonus,
  });

  const activeBudgetLimit = savings[0]?.monthlyBudget || 9000;
  const budgetAlert = evaluateBudgetAlert(financeSummary.totalExpenses, activeBudgetLimit);

  const hourlyRate = getEffectiveHourlyOtRate(profile);
  const wageBaseVal =
    profile.otWageBase === 'gross' ? profile.grossSalary : profile.basicSalary;

  const existingDayAtt = attendance.find((a) => a.date === quickDate);
  const existingDayOt = overtime.find((o) => o.date === quickDate);

  useEffect(() => {
    const existingAtt = attendance.find((a) => a.date === quickDate);
    const existingOt = overtime.find((o) => o.date === quickDate);

    if (existingAtt) {
      setQuickDraftStatus(existingAtt.status);
      setQuickDraftBonus(existingAtt.hasAttendanceBonus ?? true);
      setQuickHasBonus(existingAtt.hasAttendanceBonus ?? true);
    } else if (getPublicHolidayForDate(quickDate)) {
      setQuickDraftStatus('public_holiday');
      setQuickDraftBonus(true);
      setQuickHasBonus(true);
    } else if (new Date(`${quickDate}T00:00:00`).getDay() === 5) {
      setQuickDraftStatus('weekly_holiday');
      setQuickDraftBonus(true);
      setQuickHasBonus(true);
    } else {
      setQuickDraftStatus('present');
      setQuickDraftBonus(true);
      setQuickHasBonus(true);
    }

    setQuickDraftOtHours(existingOt ? existingOt.approvedHours : 0);
    setQuickOtResetNotice('');
  }, [quickDate, attendance, overtime, isEditingQuickCalc]);

  const isQuickEntryCompleted = isDailyQuickEntryCompleted({
    attendanceRecord: existingDayAtt,
    overtimeRecord: existingDayOt,
    noOvertimeConfirmed: Boolean(noOtConfirmedDates[quickDate]),
  });
  const showQuickDailyActions = shouldShowQuickDailyActions({
    isCompleted: isQuickEntryCompleted,
    isEditing: isEditingQuickCalc,
  });

  const handleSelectQuickStatus = (st: AttendanceStatus) => {
    setQuickDraftStatus(st);

    if (st === 'present') {
      setQuickDraftBonus(true);
      setQuickHasBonus(true);
    } else if (st === 'late') {
      setQuickDraftBonus(false);
      setQuickHasBonus(false);
    } else if (st === 'absent') {
      setQuickDraftBonus(false);
      setQuickHasBonus(false);
    } else if (st === 'weekly_holiday' || st === 'public_holiday') {
      setQuickDraftBonus(true);
      setQuickHasBonus(true);
    }

    const isNonWorking =
      st === 'approved_leave' ||
      st === 'weekly_holiday' ||
      st === 'public_holiday' ||
      st === 'absent';

    const existingOt = overtime.find((o) => o.date === quickDate);
    const prevOtVal = quickDraftOtHours > 0 ? quickDraftOtHours : existingOt ? existingOt.approvedHours : 0;

    if (isNonWorking && prevOtVal > 0) {
      setQuickDraftOtHours(0);
      const label = HOME_STATUS_LABELS[st]?.bn || st;
      setQuickOtResetNotice(
        lang === 'bn'
          ? `স্ট্যাটাস পরিবর্তন করে '${label}' করায় পূর্বের ${formatNumber(prevOtVal, 'bn', 1)} ঘণ্টা ওভারটাইম স্বয়ংক্রিয়ভাবে ০ ঘণ্টা করা হয়েছে।`
          : `Status changed to '${HOME_STATUS_LABELS[st]?.en || st}' — previous ${prevOtVal}h overtime automatically reset to 0h.`
      );
    } else if (!isNonWorking) {
      setQuickOtResetNotice('');
    }
  };

  const handleSelectQuickOt = (hours: number) => {
    if (quickDraftStatus !== 'present' && quickDraftStatus !== 'late') {
      setQuickFeedback(
        lang === 'bn'
          ? 'ছুটি বা অনুপস্থিতির দিনে ওভারটাইম যোগ করা সম্ভব নয়।'
          : 'Cannot add overtime on leave, holiday or absent days.'
      );
      return;
    }
    setQuickDraftOtHours(Math.max(0, Math.min(24, hours)));
    setQuickOtResetNotice('');
  };

  const handleSaveQuickEntry = async () => {
    if (isProfileSetupIncomplete) {
      try {
        localStorage.setItem(
          'shromik_sathi_pending_quick_entry_v1',
          JSON.stringify({
            source: 'dashboard',
            date: quickDate,
            status: quickDraftStatus,
            otHours: quickDraftOtHours,
            hasBonus: quickDraftBonus,
          })
        );
      } catch {
        // ignore storage errors
      }
      reopenOnboarding();
      return;
    }
    if (isFutureMonth(quickDate.slice(0, 7), currentMonthISO) || isFutureDate(quickDate, todayISO)) {
      setQuickFeedback(
        lang === 'bn'
          ? 'আসন্ন মাস বা ভবিষ্যতের তারিখে হিসাব যোগ বা এডিট করা যাবে না।'
          : 'Cannot save for future dates.'
      );
      return;
    }

    const existingAtt = attendance.find((a) => a.date === quickDate);
    const existingOt = overtime.find((o) => o.date === quickDate);
    const isWorkingStatus = quickDraftStatus === 'present' || quickDraftStatus === 'late';
    const pubHol = getPublicHolidayForDate(quickDate);
    const clampedHours = isWorkingStatus ? Math.min(24, Math.max(0, quickDraftOtHours)) : 0;

    let computedEndTime = '';
    if (isWorkingStatus && clampedHours > 0) {
      computedEndTime = `${String((17 + Math.round(clampedHours)) % 24).padStart(2, '0')}:00`;
    } else if (isWorkingStatus) {
      computedEndTime = '17:00';
    }

    // 1. Save Attendance
    await saveAttendance(
      {
        date: quickDate,
        month: quickDate.slice(0, 7),
        status: quickDraftStatus,
        leaveCategory: quickDraftStatus === 'approved_leave' ? 'casual' : 'none',
        checkIn: isWorkingStatus ? '08:00' : '',
        checkOut: computedEndTime,
        hasAttendanceBonus: quickDraftBonus,
        notes:
          quickDraftStatus === 'public_holiday' && pubHol
            ? pubHol.titleBn
            : lang === 'bn'
            ? `হোম থেকে চিহ্নিত (${HOME_STATUS_LABELS[quickDraftStatus].bn})`
            : `Marked ${HOME_STATUS_LABELS[quickDraftStatus].en}`,
      },
      existingAtt?.id
    );

    // 2. Save or Delete Overtime
    if (isWorkingStatus && clampedHours > 0) {
      const { estimatedEarnings } = calculateOvertimeEstimate(
        wageBaseVal,
        profile.otDivisor,
        profile.otMultiplier,
        clampedHours,
        hourlyRate
      );

      await saveOvertime(
        {
          date: quickDate,
          month: quickDate.slice(0, 7),
          startTime: existingOt?.startTime || '17:00',
          endTime: computedEndTime,
          breakMinutes: existingOt?.breakMinutes || 0,
          totalMinutes: Math.round(clampedHours * 60),
          approvedHours: clampedHours,
          basicSalarySnapshot: wageBaseVal,
          divisorSnapshot: profile.otDivisor || 208,
          multiplierSnapshot: profile.otMultiplier || 2,
          hourlyRateSnapshot: hourlyRate,
          estimatedEarnings,
          notes:
            existingOt?.notes ||
            (lang === 'bn' ? 'হোম ওভারভিউ থেকে দ্রুত যোগ' : 'Quick OT from Home Overview'),
        },
        existingOt?.id
      );
    } else if (existingOt) {
      await deleteOvertime(existingOt.id);
    }

    setNoOtConfirmedDates((prev) => ({ ...prev, [quickDate]: clampedHours === 0 }));
    setIsEditingQuickCalc(false);

    const statusLabel = HOME_STATUS_LABELS[quickDraftStatus].bn;
    setQuickFeedback(
      lang === 'bn'
        ? `${formatDateReadable(quickDate, 'bn')} তারিখের হিসাব '${statusLabel}'${
            isWorkingStatus && clampedHours > 0
              ? ` এবং ${formatNumber(clampedHours, 'bn', 1)} ঘণ্টা ওভারটাইম`
              : ''
          } সফলভাবে সংরক্ষণ করা হয়েছে!`
        : `Attendance and overtime saved for ${quickDate}!`
    );
  };

  // Auto-complete any queued quick entry immediately after initial setup finishes
  useEffect(() => {
    if (isProfileSetupIncomplete) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem('shromik_sathi_pending_quick_entry_v1');
    } catch {
      return;
    }
    if (!raw) return;

    try {
      localStorage.removeItem('shromik_sathi_pending_quick_entry_v1');
      const pending = JSON.parse(raw) as {
        source?: string;
        date?: string;
        status?: AttendanceStatus;
        otHours?: number;
        hasBonus?: boolean;
      };
      const targetDate = pending.date || quickDate;
      const targetStatus: AttendanceStatus = pending.status || 'present';
      const targetOtHours = Number(pending.otHours) || 0;
      const targetBonus = typeof pending.hasBonus === 'boolean' ? pending.hasBonus : true;

      if (isFutureMonth(targetDate.slice(0, 7), currentMonthISO) || isFutureDate(targetDate, todayISO)) {
        return;
      }

      const existingAtt = attendance.find((a) => a.date === targetDate);
      const existingOt = overtime.find((o) => o.date === targetDate);
      const isWorkingStatus = targetStatus === 'present' || targetStatus === 'late';
      const pubHol = getPublicHolidayForDate(targetDate);
      const clampedHours = isWorkingStatus ? Math.min(24, Math.max(0, targetOtHours)) : 0;

      let computedEndTime = '';
      if (isWorkingStatus && clampedHours > 0) {
        computedEndTime = `${String((17 + Math.round(clampedHours)) % 24).padStart(2, '0')}:00`;
      } else if (isWorkingStatus) {
        computedEndTime = '17:00';
      }

      void (async () => {
        await saveAttendance(
          {
            date: targetDate,
            month: targetDate.slice(0, 7),
            status: targetStatus,
            leaveCategory: targetStatus === 'approved_leave' ? 'casual' : 'none',
            checkIn: isWorkingStatus ? '08:00' : '',
            checkOut: computedEndTime,
            hasAttendanceBonus: targetBonus,
            notes:
              targetStatus === 'public_holiday' && pubHol
                ? pubHol.titleBn
                : lang === 'bn'
                ? `হোম থেকে চিহ্নিত (${HOME_STATUS_LABELS[targetStatus].bn})`
                : `Marked ${HOME_STATUS_LABELS[targetStatus].en}`,
          },
          existingAtt?.id
        );

        if (isWorkingStatus && clampedHours > 0) {
          const { estimatedEarnings } = calculateOvertimeEstimate(
            wageBaseVal,
            profile.otDivisor,
            profile.otMultiplier,
            clampedHours,
            hourlyRate
          );

          await saveOvertime(
            {
              date: targetDate,
              month: targetDate.slice(0, 7),
              startTime: existingOt?.startTime || '17:00',
              endTime: computedEndTime,
              breakMinutes: existingOt?.breakMinutes || 0,
              totalMinutes: Math.round(clampedHours * 60),
              approvedHours: clampedHours,
              basicSalarySnapshot: wageBaseVal,
              divisorSnapshot: profile.otDivisor || 208,
              multiplierSnapshot: profile.otMultiplier || 2,
              hourlyRateSnapshot: hourlyRate,
              estimatedEarnings,
              notes:
                existingOt?.notes ||
                (lang === 'bn' ? 'হোম ওভারভিউ থেকে দ্রুত যোগ' : 'Quick OT from Home Overview'),
            },
            existingOt?.id
          );
        } else if (existingOt) {
          await deleteOvertime(existingOt.id);
        }

        setNoOtConfirmedDates((prev) => ({ ...prev, [targetDate]: clampedHours === 0 }));
        setIsEditingQuickCalc(false);
        const statusLabel = HOME_STATUS_LABELS[targetStatus]?.bn || targetStatus;
        setQuickFeedback(
          lang === 'bn'
            ? `সেটআপ সম্পন্ন হয়েছে এবং ${formatDateReadable(targetDate, 'bn')} তারিখের হিসাব '${statusLabel}'${
                isWorkingStatus && clampedHours > 0
                  ? ` ও ${formatNumber(clampedHours, 'bn', 1)} ঘণ্টা ওভারটাইম`
                  : ''
              } সফলভাবে সংরক্ষণ করা হয়েছে!`
            : `Setup completed and ${targetDate} entry saved!`
        );
      })();
    } catch {
      // ignore parse errors
    }
  }, [
    isProfileSetupIncomplete,
    quickDate,
    currentMonthISO,
    todayISO,
    attendance,
    overtime,
    saveAttendance,
    saveOvertime,
    deleteOvertime,
    wageBaseVal,
    profile.otDivisor,
    profile.otMultiplier,
    hourlyRate,
    lang,
  ]);

  const handleQuickAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;
    await saveReminder({
      title: newReminderTitle.trim(),
      category: 'salary_date',
      dueDate: quickDate,
      isCompleted: false,
      notes: '',
    });
    setNewReminderTitle('');
    setQuickFeedback(
      lang === 'bn' ? 'নতুন রিমাইন্ডার সংরক্ষিত হয়েছে!' : 'New reminder added!'
    );
  };

  // Calendar grid data for Home Attendance Overview (Saturday to Friday week)
  const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayJsDay = new Date(`${selectedMonth}-01T00:00:00`).getDay();
  // Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
  const firstDayOffset = (firstDayJsDay + 1) % 7;

  // Combine recent transactions (payments + expenses + overtime)
  const recentActivity = [
    ...overtime
      .filter((o) => o.month === selectedMonth)
      .map((o) => ({
        id: `ot_${o.id}`,
        rawId: o.id,
        date: o.date,
        title:
          lang === 'bn'
            ? `ওভারটাইম: ${formatNumber(o.approvedHours, 'bn', 1)} ঘণ্টা`
            : `Overtime: ${o.approvedHours} hrs`,
        subtitle: o.notes || (lang === 'bn' ? 'দৈনিক ওভারটাইম' : 'Daily overtime'),
        amountText: `+ ${formatBDT(o.estimatedEarnings, lang)}`,
        type: 'overtime' as const,
      })),
    ...monthPayments.map((p) => ({
      id: `pay_${p.id}`,
      rawId: p.id,
      date: p.paymentDate,
      title:
        lang === 'bn'
          ? `বেতন প্রাপ্তি (${
              p.paymentMethod === 'bkash'
                ? 'বিকাশ'
                : p.paymentMethod === 'nagad'
                ? 'নগদ'
                : p.paymentMethod === 'rocket'
                ? 'রকেট'
                : p.paymentMethod === 'bank'
                ? 'ব্যাংক'
                : 'ক্যাশ'
            })`
          : `Salary Received (${p.paymentMethod.toUpperCase()})`,
      subtitle: p.referenceNote || (lang === 'bn' ? 'বেতন জমা' : 'Salary payment'),
      amountText: `+ ${formatBDT(p.amountReceived, lang)}`,
      type: 'payment' as const,
    })),
    ...monthExpenses.map((e) => ({
      id: `exp_${e.id}`,
      rawId: e.id,
      date: e.date,
      title:
        lang === 'bn'
          ? `খরচ (${
              e.category === 'food'
                ? 'খাবার'
                : e.category === 'rent'
                ? 'বাসা ভাড়া'
                : e.category === 'transport'
                ? 'যাতায়াত'
                : e.category === 'family'
                ? 'পরিবার'
                : e.category === 'medical'
                ? 'চিকিৎসা'
                : e.category === 'education'
                ? 'পড়াশোনা'
                : 'অন্যান্য'
            })`
          : `Expense (${e.category})`,
      subtitle: e.description || '',
      amountText: `- ${formatBDT(e.amount, lang)}`,
      type: 'expense' as const,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div data-testid="dashboard-view" className="space-y-6">
      {/* Mandatory Initial Setup Prompt on Home when User Skipped Onboarding ("পরে করব") */}
      {isProfileSetupIncomplete && (
        <section
          data-testid="home-onboarding-setup-prompt"
          className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-2xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-extrabold text-amber-950 dark:text-amber-200">
                {lang === 'bn'
                  ? 'প্রথমে আপনার বেতন, ওভারটাইম ও কর্মস্থল সেটআপ করুন'
                  : 'Complete Your Salary, Overtime & Workplace Setup First'}
              </h2>
              <p className="text-xs text-amber-900/90 dark:text-amber-300/90 leading-relaxed">
                {lang === 'bn'
                  ? 'ওভারটাইম হিসাব, দৈনিক হাজিরা এবং নতুন চাকরি/গার্মেন্টস যুক্ত করার আগে আপনার মূল বেতন, ওভারটাইম হার ও কর্মস্থলের তথ্য সেটআপ করা আবশ্যক।'
                  : 'Please set up your salary, overtime rate, and workplace details before adding overtime, attendance, or job records.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="home-complete-setup-btn"
            onClick={reopenOnboarding}
            className="min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            <span>
              {lang === 'bn'
                ? 'প্রথমে সেটআপ সম্পন্ন করুন'
                : 'Complete Setup Now'}
            </span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </section>
      )}

      {/* Worker Identity & Primary Action Strip */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Logged-in User Profile Photo next to Welcome */}
            <div className="flex items-center shrink-0">

              <button
                type="button"
                data-testid="dashboard-user-avatar"
                onClick={() => onNavigateTab('more', 'profile')}
                title={
                  lang === 'bn'
                    ? 'প্রোফাইল ছবি পরিবর্তন বা প্রোফাইল দেখুন'
                    : 'Change profile photo or view profile'
                }
                aria-label={
                  lang === 'bn'
                    ? 'প্রোফাইল ছবি পরিবর্তন বা প্রোফাইল দেখুন'
                    : 'Change profile photo or view profile'
                }
                className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 shadow-2xs flex items-center justify-center overflow-hidden shrink-0 group cursor-pointer"
              >
                {profile.photoUrl || user?.photoURL ? (
                  <img
                    src={profile.photoUrl || user?.photoURL || ''}
                    alt={profile.fullName || 'প্রোফাইল ছবি'}
                    data-testid="dashboard-user-photo-img"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    data-testid="dashboard-user-photo-fallback"
                    className="text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-200"
                  >
                    {(profile.fullName || user?.displayName || 'শ্র').trim().charAt(0)}
                  </span>
                )}
                <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-2xs">
                  <Camera className="w-2.5 h-2.5" />
                </span>
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight truncate">
                {lang === 'bn'
                  ? profile.fullName
                    ? `স্বাগতম, ${profile.fullName}`
                    : 'স্বাগতম'
                  : profile.fullName
                  ? `Welcome, ${profile.fullName}`
                  : 'Welcome'}
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/70 px-2.5 py-2 sm:px-3 sm:py-2.5 min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-emerald-800/80 dark:text-emerald-300/80 truncate">
                {lang === 'bn' ? 'রানিং মাস' : 'Current Month'}
              </p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200 truncate">
                {formatMonthLabel(selectedMonth, lang)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-2 sm:px-3 sm:py-2.5 min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {lang === 'bn' ? 'মোট ওভারটাইম' : 'Total Overtime'}
              </p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums truncate">
                {formatNumber(otSummary.monthlyHours, lang, 1)}{' '}
                {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-2 sm:px-3 sm:py-2.5 min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {lang === 'bn' ? 'মোট উপস্থিত' : 'Total Present'}
              </p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums truncate">
                {formatNumber(attendanceSummary.workingDays, lang)}{' '}
                {lang === 'bn' ? 'দিন' : 'days'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full lg:w-auto shrink-0">
          <button
            type="button"
            data-testid="open-voice-modal-btn"
            onClick={() => {
              if (isProfileSetupIncomplete) {
                reopenOnboarding();
                return;
              }
              onOpenVoiceModal();
            }}
            className="min-h-[40px] sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap"
          >
            <Mic className="w-4 h-4 shrink-0" />
            <span>{dict.voiceEntryBtn}</span>
          </button>

          <button
            type="button"
            data-testid="dashboard-add-overtime-btn"
            onClick={() => {
              if (isProfileSetupIncomplete) {
                reopenOnboarding();
                return;
              }
              onNavigateTab('overtime');
            }}
            className="min-h-[40px] sm:min-h-[44px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap shadow-xs"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{lang === 'bn' ? 'ওভারটাইম যোগ করুন' : 'Add Overtime'}</span>
          </button>
        </div>
      </section>

      {/* Today's Record Summary Card */}
      {(() => {
        const todayAttRec = attendance.find((a) => a.date === todayISO);
        const todayOtRec = overtime.find((o) => o.date === todayISO);
        const todayOtHours = todayOtRec ? todayOtRec.approvedHours : 0;
        const todayOtEarnings = todayOtRec ? todayOtRec.estimatedEarnings : 0;
        const todayOutTime = todayOtRec?.endTime || todayAttRec?.checkOut || '';
        const todayPubHol = getPublicHolidayForDate(todayISO);
        const isTodayFri = new Date(`${todayISO}T00:00:00`).getDay() === 5;

        let statusLabel = lang === 'bn' ? 'হাজিরা দেওয়া হয়নি' : 'Not marked';
        let statusColor = 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';

        if (todayAttRec) {
          const meta = HOME_STATUS_LABELS[todayAttRec.status];
          statusLabel = lang === 'bn' ? meta.bn : meta.en;
          statusColor =
            todayAttRec.status === 'present'
              ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-300'
              : todayAttRec.status === 'late'
              ? 'text-amber-800 bg-amber-100 dark:bg-amber-950/80 dark:text-amber-300'
              : todayAttRec.status === 'absent'
              ? 'text-rose-800 bg-rose-100 dark:bg-rose-950/80 dark:text-rose-300'
              : 'text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300';
        } else if (todayPubHol) {
          statusLabel = lang === 'bn' ? 'সরকারি ছুটি' : 'Govt Holiday';
          statusColor = 'text-orange-800 bg-orange-100 dark:bg-orange-950 dark:text-orange-300';
        } else if (isTodayFri) {
          statusLabel = lang === 'bn' ? 'শুক্রবার ছুটি' : 'Friday Off';
          statusColor = 'text-slate-800 bg-slate-200 dark:bg-slate-800 dark:text-slate-300';
        }

        return (
          <div
            data-testid="today-quick-summary-card"
            className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/90 dark:border-emerald-800/80 shadow-xs space-y-2"
          >
            <div className="flex items-center justify-between gap-2 flex-nowrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CalendarCheck2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                  {lang === 'bn' ? 'আজকের হিসাব' : "Today's Status"} ({formatDateReadable(todayISO, lang)})
                </h3>
              </div>

              <button
                type="button"
                data-testid="edit-today-status-btn"
                onClick={() => {
                  setQuickDate(todayISO);
                  if (showQuickDailyActions && isEditingQuickCalc) {
                    setIsEditingQuickCalc(false);
                  } else {
                    setIsEditingQuickCalc(true);
                  }
                }}
                title={lang === 'bn' ? 'আজকের দ্রুত হিসাব এডিট করুন' : "Edit Today's Quick Record"}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                  showQuickDailyActions && isEditingQuickCalc
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <Edit2
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                    showQuickDailyActions && isEditingQuickCalc
                      ? 'text-white'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                />
                <span>
                  {showQuickDailyActions && isEditingQuickCalc
                    ? lang === 'bn'
                      ? 'সম্পন্ন'
                      : 'Done'
                    : lang === 'bn'
                    ? 'এডিট করুন'
                    : 'Edit'}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className={`px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold ${statusColor} shrink-0 whitespace-nowrap`}>
                {statusLabel}
              </span>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium">
                {todayOtHours > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    {lang === 'bn'
                      ? `${todayOutTime ? `আউট: ${toBengaliDigits(todayOutTime)} · ` : ''}ওভারটাইম: ${formatNumber(todayOtHours, 'bn', 1)} ঘণ্টা (${formatBDT(todayOtEarnings, 'bn')})`
                      : `${todayOutTime ? `Out: ${todayOutTime} · ` : ''}Overtime: ${todayOtHours} hrs (${formatBDT(todayOtEarnings, 'en')})`}
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    {lang === 'bn'
                      ? `${todayOutTime ? `আউট: ${toBengaliDigits(todayOutTime)} · ` : ''}ওভারটাইম: ০ ঘণ্টা (ওভারটাইম করা হয়নি)`
                      : `${todayOutTime ? `Out: ${todayOutTime} · ` : ''}Overtime: 0 hrs`}
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })()}

      {quickFeedback && (
        <div
          role="status"
          data-testid="quick-action-feedback"
          className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>{quickFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setQuickFeedback('')}
            className="text-xs font-bold text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Interactive Home Quick-Action Bar ("আজকের দ্রুত হিসাব"):
          - Automatically shown when today's attendance + out-time/overtime has NOT been added yet.
          - Automatically hidden once today's attendance + out-time/overtime IS added.
          - Shown inline right here on Home when clicking "এডিট করুন" on the "আজকের হিসাব" card above. */}
      {showQuickDailyActions && (
        <section
          id="quick-daily-actions-section"
          data-testid="quick-daily-actions-section"
          className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-3.5 sm:p-5 space-y-3.5 shadow-xs"
        >
          <div className="flex items-center justify-between gap-1.5 pb-2.5 border-b border-slate-100 dark:border-slate-800 flex-nowrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs sm:text-base font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0">
                {lang === 'bn' ? 'আজকের দ্রুত হিসাব' : 'Quick Daily Actions'}
              </h2>
              {isEditingQuickCalc && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold whitespace-nowrap shrink-0">
                  {lang === 'bn' ? 'এডিট' : 'Edit'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <label
                htmlFor="home-quick-date"
                className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0"
              >
                {lang === 'bn' ? 'তারিখ:' : 'Date:'}
              </label>
              <DateInputDMY
                id="home-quick-date"
                data-testid="home-quick-date"
                value={quickDate}
                max={todayISO}
                disabled={isUpcomingMonth}
                onChange={(val) => setQuickDate(val)}
                lang={lang}
                className="min-w-[125px] sm:min-w-[138px]"
              />
              {(isEditingQuickCalc || isQuickEntryCompleted) && (
                <button
                  type="button"
                  data-testid="close-quick-daily-actions-btn"
                  onClick={() => setIsEditingQuickCalc(false)}
                  className="min-h-[32px] px-2.5 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] sm:text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
                </button>
              )}
            </div>
          </div>

          {isQuickActionLocked && (
            <div
              data-testid="home-future-lock-banner"
              className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2"
            >
              <span>
                {isUpcomingMonth
                  ? lang === 'bn'
                    ? `${formatMonthLabel(selectedMonth, 'bn')} একটি আসন্ন মাস — আসন্ন মাসে ওভারটাইম বা উপস্থিতি যোগ ও এডিট করা যাবে না।`
                    : `${formatMonthLabel(selectedMonth, 'en')} is an upcoming month — overtime and attendance cannot be added or edited.`
                  : lang === 'bn'
                  ? `${formatDateSlashDMY(quickDate, 'bn')} ভবিষ্যতের তারিখ — শুধুমাত্র আজ (${formatDateSlashDMY(todayISO, 'bn')}) বা পূর্ববর্তী তারিখে হিসাব যোগ করা যাবে।`
                  : `${formatDateSlashDMY(quickDate, 'en')} is a future date — you can only add records for today or past dates.`}
              </span>
              {!isUpcomingMonth && isQuickDateFuture && (
                <button
                  type="button"
                  onClick={() => setQuickDate(todayISO)}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  {lang === 'bn' ? 'আজকের তারিখ নিন' : 'Select Today'}
                </button>
              )}
            </div>
          )}

          {quickOtResetNotice && (
            <div
              data-testid="ot-auto-reset-alert"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-400 dark:border-rose-700 text-rose-900 dark:text-rose-100 text-xs font-bold flex items-start gap-2.5 shadow-2xs"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-extrabold text-xs text-rose-800 dark:text-rose-200">
                  {lang === 'bn' ? 'সতর্কতা: ওভারটাইম ০ ঘণ্টা করা হয়েছে' : 'Notice: Overtime Reset to 0h'}
                </p>
                <p className="text-[11px] leading-relaxed font-semibold opacity-95">
                  {quickOtResetNotice}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Quick Attendance Mark */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-1.5 flex-nowrap">
                <span className="text-[11px] sm:text-xs font-extrabold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {lang === 'bn' ? '১. আজকের হাজিরা' : '1. Attendance'} ({formatDateSlashDMY(quickDate, lang)})
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100/80 dark:bg-emerald-950/80 text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 whitespace-nowrap shrink-0">
                  {lang === 'bn'
                    ? `নির্বাচন: ${HOME_STATUS_LABELS[quickDraftStatus].bn}`
                    : `Selected: ${HOME_STATUS_LABELS[quickDraftStatus].en}`}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {(
                  [
                    'present',
                    'late',
                    'approved_leave',
                    'weekly_holiday',
                    'public_holiday',
                    'absent',
                  ] as AttendanceStatus[]
                ).map((st) => {
                  const active = quickDraftStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isQuickActionLocked}
                      data-testid={`quick-attendance-${st}`}
                      onClick={() => handleSelectQuickStatus(st)}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${
                        active
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-emerald-50'
                      }`}
                    >
                      {lang === 'bn' ? HOME_STATUS_LABELS[st].bn : HOME_STATUS_LABELS[st].en}
                    </button>
                  );
                })}
              </div>

              {/* Attendance Bonus Toggle Checkbox */}
              <label className="flex items-center gap-2 pt-1 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="quick-bonus-checkbox"
                  checked={quickDraftBonus}
                  disabled={isQuickActionLocked}
                  onChange={(e) => setQuickDraftBonus(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                />
                <span>{lang === 'bn' ? 'হাজিরা বোনাস বহাল (টিক দিন)' : 'Attendance Bonus Active'}</span>
              </label>
            </div>

            {/* Quick Out-Time & Overtime Add / Edit */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/60 space-y-2.5">
              <div className="flex items-center justify-between gap-1.5 flex-nowrap">
                <span className="text-[11px] sm:text-xs font-extrabold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {lang === 'bn' ? '২. আউট টাইম ও ওভারটাইম সেট করুন' : '2. Set Out-Time & Overtime'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100/80 dark:bg-emerald-950/80 text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 tabular-nums whitespace-nowrap shrink-0">
                  {lang === 'bn'
                    ? `ওভারটাইম: ${formatNumber(quickDraftOtHours, 'bn', 1)} ঘণ্টা`
                    : `Overtime: ${quickDraftOtHours} hrs`}
                </span>
              </div>

              {quickDraftStatus !== 'present' && quickDraftStatus !== 'late' ? (
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200/60 dark:border-emerald-800/50 text-xs space-y-1.5">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {quickDraftStatus === 'absent'
                      ? lang === 'bn'
                        ? 'অনুপস্থিতির দিনে ওভারটাইম প্রযোজ্য নয়।'
                        : 'Overtime not applicable on absent days.'
                      : lang === 'bn'
                      ? 'ছুটির দিনে নিয়মিত কর্মঘণ্টার ওভারটাইম প্রযোজ্য নয়।'
                      : 'Regular overtime not applicable on leaves or holidays.'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {lang === 'bn'
                      ? 'ওভারটাইম লিখতে ১ নম্বরে ‘উপস্থিত’ অথবা ‘দেরি’ সিলেক্ট করুন।'
                      : 'To set overtime, select "Present" or "Late" in step 1.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-1">
                  <button
                    type="button"
                    data-testid="quick-ot-0"
                    disabled={isQuickActionLocked}
                    onClick={() => handleSelectQuickOt(0)}
                    className={`min-h-[40px] px-1 py-1 rounded-xl border text-[10px] sm:text-xs font-bold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex flex-col items-center justify-center leading-tight ${
                      quickDraftOtHours === 0
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white hover:bg-emerald-700 hover:text-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{lang === 'bn' ? '০ ঘঃ' : '0h'}</span>
                    <span className="text-[9px] opacity-80">{lang === 'bn' ? '৫টা' : '5PM'}</span>
                  </button>
                  {[
                    { h: 1, outBn: '৬টা', outEn: '6PM' },
                    { h: 2, outBn: '৭টা', outEn: '7PM' },
                    { h: 3, outBn: '৮টা', outEn: '8PM' },
                  ].map(({ h, outBn, outEn }) => {
                    const isActiveOt = quickDraftOtHours === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        data-testid={`quick-ot-${h}`}
                        disabled={isQuickActionLocked}
                        onClick={() => handleSelectQuickOt(h)}
                        className={`min-h-[40px] px-1 py-1 rounded-xl border text-[10px] sm:text-xs font-bold transition-all tabular-nums cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex flex-col items-center justify-center leading-tight ${
                          isActiveOt
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                            : 'bg-white hover:bg-emerald-700 hover:text-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        <span>{lang === 'bn' ? `+${formatNumber(h, 'bn')} ঘঃ` : `+${h}h`}</span>
                        <span className="text-[9px] opacity-80">{lang === 'bn' ? outBn : outEn}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    data-testid="quick-ot-minus"
                    onClick={() => handleSelectQuickOt(quickDraftOtHours - 1)}
                    disabled={isQuickActionLocked || quickDraftOtHours <= 0}
                    className="min-h-[40px] px-1 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer flex flex-col items-center justify-center leading-tight"
                  >
                    <span>− ১ {lang === 'bn' ? 'ঘঃ' : 'h'}</span>
                    <span className="text-[9px] opacity-75">{lang === 'bn' ? 'কমান' : 'Less'}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="quick-ot-plus"
                    onClick={() => handleSelectQuickOt(quickDraftOtHours + 1)}
                    disabled={isQuickActionLocked || quickDraftOtHours >= 24}
                    className="min-h-[40px] px-1 py-1 rounded-xl border border-emerald-400 dark:border-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 text-[10px] sm:text-xs font-bold text-emerald-900 dark:text-emerald-200 disabled:opacity-40 cursor-pointer flex flex-col items-center justify-center leading-tight"
                  >
                    <span>+ ১ {lang === 'bn' ? 'ঘঃ' : 'h'}</span>
                    <span className="text-[9px] opacity-80">{lang === 'bn' ? 'যোগ' : 'Add'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Explicit Complete / Save Action Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {lang === 'bn'
                ? '* সব নির্বাচন শেষে সম্পূর্ণ বাটনে চাপ দিলে হিসাব চূড়ান্তভাবে সংরক্ষিত হবে।'
                : '* Click "Complete" to save attendance and overtime changes.'}
            </span>
            <button
              type="button"
              data-testid="save-quick-entry-submit-btn"
              disabled={isQuickActionLocked}
              onClick={handleSaveQuickEntry}
              className="min-h-[42px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4.5 h-4.5" />
              <span>{lang === 'bn' ? 'সম্পূর্ণ' : 'Complete & Save'}</span>
            </button>
          </div>
        </section>
      )}

      {/* 2. 6 Summary Cards Grid — Mobile-First 2-Column Compact Layout */}
      <section aria-label={lang === 'bn' ? 'মাসিক সারসংক্ষেপ' : 'Monthly Summary'}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Card 1: Attendance-Based Earned Salary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">
                  {lang === 'bn' ? 'চলতি অর্জিত বেতন' : 'Earned Salary'}
                </span>
                <Banknote className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              </div>
              <p
                data-testid="dashboard-expected-salary"
                className="mt-1.5 sm:mt-2 text-lg sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums"
              >
                {formatBDT(earnedSalaryBreakdown.totalEarnedSalary, lang)}
              </p>
              <p className="mt-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                {lang === 'bn'
                  ? `উপস্থিতি: ${formatNumber(earnedSalaryBreakdown.attendedDaysCount, 'bn')} দিন · দৈনিক ${formatBDT(earnedSalaryBreakdown.dailyWageRate, 'bn')}`
                  : `Attended: ${earnedSalaryBreakdown.attendedDaysCount}d · ${formatBDT(earnedSalaryBreakdown.dailyWageRate, 'en')}/d`}
              </p>
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-1 flex-nowrap">
                <span className="whitespace-nowrap truncate">
                  {lang === 'bn' ? 'পূর্ণ বেতন:' : 'Full:'}{' '}
                  <strong className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                    {formatBDT(earnedSalaryBreakdown.fullExpectedMonthlySalary, lang)}
                  </strong>
                </span>
                {(profile.attendanceBonus || 0) > 0 && (
                  !attBonusEval.isEligible ? (
                    <span
                      data-testid="bonus-missed-badge"
                      title={lang === 'bn' ? attBonusEval.reasonBn : attBonusEval.reasonEn}
                      className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[9px] sm:text-[10px] font-bold whitespace-nowrap shrink-0"
                    >
                      {lang === 'bn' ? 'বোনাস মিস' : 'Missed'}
                    </span>
                  ) : (
                    <span
                      data-testid="bonus-active-badge"
                      className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[9px] sm:text-[10px] font-bold whitespace-nowrap shrink-0"
                    >
                      {lang === 'bn' ? 'বোনাস বহাল' : 'Active'}
                    </span>
                  )
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('salary')}
              className="mt-3 sm:mt-4 min-h-[38px] sm:min-h-[40px] w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1 transition-colors"
            >
              <span className="truncate">{lang === 'bn' ? 'বেতনের বিস্তারিত দেখুন' : 'View Salary Details'}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {/* Card 2: Actual Salary Received */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{dict.receivedSalary}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              </div>
              <p
                data-testid="dashboard-received-salary"
                className="mt-1.5 sm:mt-2 text-lg sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
              >
                {formatBDT(paymentSummary.totalReceived, lang)}
              </p>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums line-clamp-1">
                {lang === 'bn'
                  ? `${formatNumber(monthPayments.length, 'bn')}টি পেমেন্ট এন্ট্রি`
                  : `${monthPayments.length} payment(s)`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('salary')}
              className="mt-3 sm:mt-4 min-h-[38px] sm:min-h-[40px] w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1 transition-colors"
            >
              <span className="truncate">{lang === 'bn' ? 'প্রাপ্ত টাকা লিখুন' : 'Record Pay'}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {/* Card 3: Overtime Hours & Est. Earnings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{dict.overtimeSummary}</span>
                <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              </div>
              <div className="mt-1.5 sm:mt-2 flex flex-wrap items-baseline gap-1.5">
                <p
                  data-testid="dashboard-ot-hours"
                  className="text-lg sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums"
                >
                  {formatNumber(otSummary.monthlyHours, lang, 1)}{' '}
                  <span className="text-xs sm:text-base font-semibold">
                    {lang === 'bn' ? 'ঘঃ' : 'h'}
                  </span>
                </p>
                <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  ({formatBDT(otSummary.monthlyEarnings, lang)})
                </span>
              </div>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums line-clamp-1">
                {lang === 'bn'
                  ? `বার্ষিক: ${formatNumber(otSummary.yearlyHours, 'bn', 1)} ঘঃ (${formatBDT(otSummary.yearlyEarnings, 'bn')})`
                  : `Yearly: ${otSummary.yearlyHours}h (${formatBDT(otSummary.yearlyEarnings, 'en')})`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('overtime')}
              className="mt-3 sm:mt-4 min-h-[38px] sm:min-h-[40px] w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1 transition-colors"
            >
              <span className="truncate">{lang === 'bn' ? 'ওভারটাইম খাতা' : 'OT Tracker'}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {/* Card 4: Outstanding Salary Balance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{dict.outstandingBalance}</span>
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              </div>
              <p
                data-testid="dashboard-outstanding-balance"
                className="mt-1.5 sm:mt-2 text-lg sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums"
              >
                {formatBDT(earnedOutstandingBalance, lang)}
              </p>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                {earnedOutstandingBalance === 0
                  ? lang === 'bn'
                    ? 'চলতি অর্জিত বেতন সম্পূর্ণ পরিশোধিত'
                    : 'All earned salary paid'
                  : lang === 'bn'
                  ? 'চলতি অর্জিত বেতন হতে বকেয়া'
                  : 'Outstanding from earned pay'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('salary')}
              className="mt-3 sm:mt-4 min-h-[38px] sm:min-h-[40px] w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1 transition-colors"
            >
              <span className="truncate">{lang === 'bn' ? 'বকেয়া হিসাব' : 'Balance Details'}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {/* Card 5: Attendance & Working Days */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{dict.attendanceSummary}</span>
                <CalendarCheck2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              </div>
              <p
                data-testid="dashboard-working-days"
                className="mt-1.5 sm:mt-2 text-lg sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums"
              >
                {formatNumber(attendanceSummary.workingDays, lang)}{' '}
                <span className="text-xs sm:text-base font-semibold">
                  {lang === 'bn' ? 'দিন' : 'days'}
                </span>
              </p>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums line-clamp-1">
                {lang === 'bn'
                  ? `ছুটি: ${formatNumber(attendanceSummary.approvedLeaveDays, 'bn')} · অনু: ${formatNumber(attendanceSummary.absentDays, 'bn')}`
                  : `Leave: ${attendanceSummary.approvedLeaveDays}d · Absent: ${attendanceSummary.absentDays}d`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('attendance')}
              className="mt-3 sm:mt-4 min-h-[38px] sm:min-h-[40px] w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1 transition-colors"
            >
              <span className="truncate">{lang === 'bn' ? 'হাজিরা ক্যালেন্ডার' : 'Calendar'}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {/* Card 6: Monthly Expenses & Savings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{dict.monthlySavings}</span>
                <PiggyBank className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              </div>
              <div className="mt-1.5 sm:mt-2 flex flex-wrap items-baseline gap-1.5">
                <p
                  data-testid="dashboard-monthly-expenses"
                  className="text-lg sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums"
                >
                  {formatBDT(financeSummary.totalExpenses, lang)}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'খরচ' : 'spent'}
                </span>
              </div>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 tabular-nums line-clamp-1">
                {lang === 'bn'
                  ? `সঞ্চয়: ${formatBDT(financeSummary.totalSaved, 'bn')} · ঋণ: ${formatBDT(loanSummary.totalRemaining, 'bn')}`
                  : `Saved: ${formatBDT(financeSummary.totalSaved, 'en')} · Loan: ${formatBDT(loanSummary.totalRemaining, 'en')}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('expenses')}
              className="mt-3 sm:mt-4 min-h-[38px] sm:min-h-[40px] w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1 transition-colors"
            >
              <span className="truncate">{lang === 'bn' ? 'খরচ ও ঋণ খাতা' : 'Expenses & Loans'}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Inline Missing Records Section */}
      <MissingRecordsSection onSelectDate={() => onNavigateTab('attendance')} />

      {/* 6. Quick Access: My Garment & Contact Book Banner */}
      <section className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {lang === 'bn' ? 'আমার গার্মেন্টস ও কন্ট্যাক্ট বুক' : 'My Garment & Contact Book'}
            </h3>
          </div>
        </div>

        <button
          type="button"
          data-testid="open-garment-contacts-hub-btn"
          onClick={() => onNavigateTab('more', 'contacts')}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
        >
          <BookOpen className="w-4 h-4" />
          <span>{lang === 'bn' ? 'কন্ট্যাক্ট বুক খুলুন' : 'Open Contacts'}</span>
          <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </section>

      {/* 7. Priority Feature 1: Smart Salary Comparison & Monthly Financial Insights */}
      <section
        data-testid="smart-salary-comparison"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 space-y-3.5"
      >
        <div className="flex items-center justify-between gap-1.5 pb-2.5 border-b border-slate-100 dark:border-slate-800 flex-nowrap">
          <h2 className="text-xs sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="truncate">
              {lang === 'bn'
                ? 'স্মার্ট তুলনা ও আর্থিক বিশ্লেষণ'
                : 'Smart Comparison & Insights'}
            </span>
          </h2>

          <button
            type="button"
            onClick={() => setSelectedMonth(prevMonth)}
            className="min-h-[28px] sm:min-h-[34px] px-2 sm:px-3 py-1 rounded-lg sm:rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-[10px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            {lang === 'bn'
              ? `${formatShortMonthName(selectedMonth, 'bn')} বনাম ${formatShortMonthName(prevMonth, 'bn')} দেখুন`
              : `${formatShortMonthName(selectedMonth, 'en')} vs ${formatShortMonthName(prevMonth, 'en')}`}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Comparison 1: Net Salary Difference */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <p className="text-[11px] text-slate-500">
              {lang === 'bn' ? 'গত মাসের তুলনায় বেতন পার্থক্য' : 'Net Salary vs Last Month'}
            </p>
            <p
              data-testid="smart-net-diff"
              className={`mt-1 text-base sm:text-lg font-bold tabular-nums ${
                smartComparison.netDiff >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {smartComparison.netDiff >= 0 ? '+' : '-'}
              {formatBDT(Math.abs(smartComparison.netDiff), lang)} (
              {smartComparison.netDiffPercent >= 0 ? '+' : ''}
              {formatNumber(smartComparison.netDiffPercent, lang, 1)}%)
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              {lang === 'bn' ? 'গত মাস:' : 'Prev:'}{' '}
              {formatBDT(
                prevSalaryRecord
                  ? prevSalaryRecord.estimatedNetPayable
                  : prevComputedSalary.estimatedNetPayable,
                lang
              )}
            </p>
          </div>

          {/* Comparison 2: Overtime Hours Comparison */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <p className="text-[11px] text-slate-500">
              {lang === 'bn' ? 'ওভারটাইম ঘণ্টার তুলনা' : 'Overtime Hours Change'}
            </p>
            <p className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {smartComparison.otHoursDiff >= 0 ? '+' : ''}
              {formatNumber(smartComparison.otHoursDiff, lang, 1)}{' '}
              {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              {lang === 'bn' ? 'আয়ের পার্থক্য:' : 'OT Pay Diff:'}{' '}
              {smartComparison.otEarningsDiff >= 0 ? '+' : '-'}
              {formatBDT(Math.abs(smartComparison.otEarningsDiff), lang)}
            </p>
          </div>

          {/* Comparison 3: Attendance Bonus Eligibility */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <p className="text-[11px] text-slate-500">
              {lang === 'bn' ? 'হাজিরা বোনাস যোগ্যতা' : 'Attendance Bonus Status'}
            </p>
            <p
              className={`mt-1 text-sm sm:text-base font-bold ${
                smartComparison.attendanceBonusSafe
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {smartComparison.attendanceBonusSafe
                ? lang === 'bn'
                  ? `✓ প্রাপ্য (${formatBDT(profile.attendanceBonus, 'bn')})`
                  : `✓ Eligible (${formatBDT(profile.attendanceBonus, 'en')})`
                : lang === 'bn'
                ? 'ঝুঁকিতে (অনুপস্থিতি/দেরি)'
                : 'At Risk (Absent/Late)'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {lang === 'bn'
                ? `অনুপস্থিত: ${formatNumber(attendanceSummary.absentDays, 'bn')} দিন · দেরি: ${formatNumber(attendanceSummary.lateDays, 'bn')} দিন`
                : `Absent: ${attendanceSummary.absentDays}d · Late: ${attendanceSummary.lateDays}d`}
            </p>
          </div>

          {/* Comparison 4: Monthly Budget & Loan Snapshot */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <p className="text-[11px] text-slate-500">
              {lang === 'bn' ? 'মাসিক বাজেট ও কিস্তি স্থিতি' : 'Budget & Loan Status'}
            </p>
            <p
              className={`mt-1 text-sm sm:text-base font-bold tabular-nums ${
                budgetAlert.status === 'exceeded'
                  ? 'text-red-600 dark:text-red-400'
                  : budgetAlert.status === 'warning'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {lang === 'bn'
                ? `বাজেট ব্যবহার: ${formatNumber(budgetAlert.usagePercent, 'bn')}%`
                : `Budget Used: ${budgetAlert.usagePercent}%`}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              {lang === 'bn'
                ? `মাসিক ঋণের কিস্তি: ${formatBDT(loanSummary.monthlyInstallmentTotal, 'bn')}`
                : `Loan Installment: ${formatBDT(loanSummary.monthlyInstallmentTotal, 'en')}`}
            </p>
          </div>
        </div>
      </section>

      {/* Dedicated Attendance & Public Holidays Overview right inside Home (হোমের ভিতরে হাজিরা ও ছুটি ওভারভিউ) */}
      <section
        data-testid="home-attendance-overview"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 space-y-4"
      >
        <div
          data-testid="home-attendance-header-row"
          className="flex items-center justify-between gap-1 sm:gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 flex-nowrap"
        >
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <h2 className="text-xs sm:text-base font-bold text-slate-900 dark:text-white inline-flex items-center gap-1 shrink-0">
              <CalendarCheck2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>{lang === 'bn' ? 'তারিখ' : 'Date'}</span>
            </h2>
            <div className="inline-flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                data-testid="home-cal-prev-month-btn"
                onClick={() => setSelectedMonth(stepMonthISO(selectedMonth, -1))}
                title={lang === 'bn' ? 'পূর্বের মাস' : 'Previous Month'}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <span
                data-testid="home-attendance-month-label"
                className="text-[11px] sm:text-sm font-bold text-emerald-800 dark:text-emerald-300 px-1.5 sm:px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 whitespace-nowrap shrink-0"
              >
                {formatMonthLabel(selectedMonth, lang)}
              </span>
              <button
                type="button"
                data-testid="home-cal-next-month-btn"
                onClick={() => setSelectedMonth(stepMonthISO(selectedMonth, 1))}
                title={lang === 'bn' ? 'পরের মাস (আগামী রিমাইন্ডার সেট করুন)' : 'Next Month'}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          <button
            type="button"
            data-testid="home-go-to-attendance-btn"
            onClick={() => onNavigateTab('attendance')}
            className="min-h-[28px] sm:min-h-[36px] px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-1 shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <span>{lang === 'bn' ? 'হাজিরা পাতায় দেখুন' : 'Go to Attendance'}</span>
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          </button>
        </div>

        {/* Real 7-Day Monthly Calendar Grid on Home Overview */}
        <div className="space-y-2">
          {/* Weekday Column Headers: Saturday to Friday */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {WEEKDAY_NAMES.map((w, idx) => (
              <div
                key={idx}
                className={`py-1.5 text-center text-xs font-bold rounded-lg ${
                  w.isWeekend
                    ? 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50'
                    : 'text-slate-600 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60'
                }`}
              >
                {lang === 'bn' ? w.bn : w.en}
              </div>
            ))}
          </div>

          {/* Monthly Day Grid with Leading Blank Padding */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Leading blanks for start of month */}
            {Array.from({ length: firstDayOffset }).map((_, idx) => (
              <div
                key={`blank-${idx}`}
                className="min-h-[48px] sm:min-h-[56px] rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200/50 dark:border-slate-800/50"
              />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dNum = idx + 1;
              const dPad = String(dNum).padStart(2, '0');
              const fullDate = `${selectedMonth}-${dPad}`;
              const rec = monthAttendance.find((a) => a.date === fullDate);
              const pubHol = getPublicHolidayForDate(fullDate);
              const isFri = new Date(`${fullDate}T00:00:00`).getDay() === 5;
              const isSelected = quickDate === fullDate;
              const isTodayCell = fullDate === todayISO;
              const isFutureCell = isUpcomingMonth || isFutureDate(fullDate, todayISO);
              const dayOtHours = overtime
                .filter((o) => o.date === fullDate)
                .reduce((sum, o) => sum + (Number(o.approvedHours) || 0), 0);

              let bg =
                'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400';
              let statusShort = '';

              if (rec) {
                statusShort = HOME_STATUS_LABELS[rec.status].shortBn;
                if (rec.status === 'present') {
                  bg =
                    'bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-600 dark:text-white dark:border-emerald-500 shadow-2xs';
                } else if (rec.status === 'absent') {
                  bg =
                    'bg-red-700 text-white border-red-800 dark:bg-red-800 dark:text-white dark:border-red-600 shadow-2xs';
                } else if (rec.status === 'late') {
                  bg =
                    'bg-amber-500 text-white border-amber-600 dark:bg-amber-600 dark:text-white dark:border-amber-500 shadow-2xs';
                } else if (rec.status === 'approved_leave') {
                  bg =
                    'bg-indigo-600 text-white border-indigo-700 dark:bg-indigo-600 dark:text-white dark:border-indigo-500 shadow-2xs';
                } else if (rec.status === 'public_holiday') {
                  bg =
                    'bg-purple-600 text-white border-purple-700 dark:bg-purple-700 dark:text-white dark:border-purple-500 shadow-2xs';
                } else if (rec.status === 'weekly_holiday') {
                  bg =
                    'bg-sky-600 text-white border-sky-700 dark:bg-sky-700 dark:text-white dark:border-sky-500 shadow-2xs';
                }
              } else if (pubHol) {
                const isPastHol = fullDate < todayISO;
                bg = isPastHol
                  ? 'bg-slate-500 text-white border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 shadow-2xs'
                  : 'bg-purple-600 text-white border-purple-700 dark:bg-purple-700 dark:text-white dark:border-purple-500 shadow-2xs';
                statusShort = 'সরকারি';
              } else if (isFri) {
                bg =
                  'bg-sky-100 dark:bg-sky-950/70 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800';
                statusShort = 'শুক্র';
              } else if (isFutureCell) {
                bg =
                  'bg-slate-100/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border-dashed border-slate-200 dark:border-slate-800';
                statusShort = lang === 'bn' ? 'আসন্ন' : 'Next';
              }

              const dayReminders = getRemindersForCalendarDate(reminders, fullDate);
              const hasDayReminder = dayReminders.length > 0;

              return (
                <button
                  key={fullDate}
                  type="button"
                  data-testid={`home-cal-day-${fullDate}`}
                  data-has-reminder={hasDayReminder ? 'true' : 'false'}
                  data-status={
                    rec?.status ||
                    (pubHol
                      ? 'public_holiday'
                      : isFri
                      ? 'weekly_holiday'
                      : isFutureCell
                      ? 'future'
                      : 'unmarked')
                  }
                  onClick={() => setQuickDate(fullDate)}
                  title={
                    hasDayReminder
                      ? `${fullDate} — নোট/রিমাইন্ডার: ${dayReminders.map((r) => r.title).join(', ')}`
                      : pubHol
                      ? pubHol.titleBn
                      : fullDate
                  }
                  className={`min-h-[48px] sm:min-h-[56px] rounded-xl border p-1 flex flex-col items-center justify-center transition-all cursor-pointer relative ${bg} ${
                    isSelected
                      ? 'ring-2 ring-offset-1 ring-emerald-500 dark:ring-white font-bold scale-[1.03] shadow-xs z-10'
                      : hasDayReminder
                      ? 'ring-2 ring-indigo-500/80 dark:ring-indigo-400'
                      : ''
                  }`}
                >
                  {isTodayCell && (
                    <span className="absolute -top-1.5 right-1 px-1 rounded bg-emerald-900 text-white text-[8px] font-bold leading-tight">
                      {lang === 'bn' ? 'আজ' : 'Today'}
                    </span>
                  )}
                  {hasDayReminder && (() => {
                    const cellBadge = getCalendarCellBadgeMeta(dayReminders);
                    return (
                      <span
                        data-testid={`home-cal-rem-badge-${fullDate}`}
                        className={`absolute -top-1.5 left-1 px-1 py-0.2 rounded-full ${cellBadge.cellBadgeColor} text-[8px] font-extrabold leading-tight inline-flex items-center gap-0.5 shadow-2xs`}
                      >
                        <Bell className="w-2 h-2" />
                        <span>{lang === 'bn' ? cellBadge.labelBn : cellBadge.labelEn}</span>
                      </span>
                    );
                  })()}
                  <span className="text-xs sm:text-sm font-bold tabular-nums leading-none">
                    {formatNumber(dNum, lang)}
                  </span>
                  {statusShort && (
                    <span className="text-[10px] sm:text-[11px] leading-tight font-semibold truncate max-w-full mt-0.5">
                      {statusShort}
                    </span>
                  )}
                  {dayOtHours > 0 && (
                    <span className="text-[8px] font-extrabold px-1 rounded bg-black/25 text-white leading-tight mt-0.5">
                      +{formatNumber(dayOtHours, lang, 1)}ঘঃ
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Attendance & Overtime Details Card (Shows when clicking any date on Home Calendar, matching AttendanceView) */}
        {(() => {
          const clickedHoliday = getPublicHolidayForDate(quickDate);
          const clickedIsFri = new Date(`${quickDate}T00:00:00`).getDay() === 5;
          const clickedOtHours = overtime
            .filter((o) => o.date === quickDate)
            .reduce((sum, o) => sum + (Number(o.approvedHours) || 0), 0);
          const clickedOtEarnings = overtime
            .filter((o) => o.date === quickDate)
            .reduce((sum, o) => sum + (Number(o.estimatedEarnings) || 0), 0);

          return (
            <div
              data-testid="home-selected-date-details-card"
              className="mt-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {lang === 'bn' ? 'নির্বাচিত তারিখের বিস্তারিত' : 'Selected Date Details'}
                  </p>
                  <h4
                    data-testid="home-selected-date-heading"
                    className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5"
                  >
                    {formatDateReadable(quickDate, lang)}
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {isQuickActionLocked && (
                    <span
                      data-testid="home-selected-date-future-badge"
                      className="inline-flex items-center px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-xs font-bold"
                    >
                      {lang === 'bn' ? 'আসন্ন তারিখ (লক)' : 'Future Date (Locked)'}
                    </span>
                  )}
                  <button
                    type="button"
                    data-testid="home-goto-attendance-btn"
                    onClick={() => onNavigateTab('attendance', undefined, quickDate)}
                    className="min-h-[32px] px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>
                      {lang === 'bn' ? 'হাজিরা পাতায় গিয়ে দেখুন' : 'Go to Attendance'}
                    </span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Attendance Status Box */}
                <div
                  data-testid="home-selected-date-attendance-box"
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                      {lang === 'bn' ? 'হাজিরা অবস্থা' : 'Attendance Status'}
                    </span>
                    {existingDayAtt ? (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span
                          data-testid="home-selected-date-status-badge"
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold ${
                            existingDayAtt.status === 'present'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : existingDayAtt.status === 'absent'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                              : existingDayAtt.status === 'late'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                              : existingDayAtt.status === 'approved_leave'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                              : existingDayAtt.status === 'public_holiday'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300'
                          }`}
                        >
                          {lang === 'bn'
                            ? HOME_STATUS_LABELS[existingDayAtt.status].bn
                            : HOME_STATUS_LABELS[existingDayAtt.status].en}
                        </span>
                        {(existingDayAtt.checkIn || existingDayAtt.checkOut) && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {existingDayAtt.checkIn} - {existingDayAtt.checkOut}
                          </span>
                        )}
                      </div>
                    ) : clickedHoliday ? (
                      <span
                        data-testid="home-selected-date-status-badge"
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 mt-0.5"
                      >
                        {lang === 'bn' ? `সরকারি ছুটি (${clickedHoliday.titleBn})` : 'Govt Holiday'}
                      </span>
                    ) : clickedIsFri ? (
                      <span
                        data-testid="home-selected-date-status-badge"
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 mt-0.5"
                      >
                        {lang === 'bn' ? 'শুক্রবার সাপ্তাহিক ছুটি' : 'Friday Weekly Off'}
                      </span>
                    ) : isQuickActionLocked ? (
                      <span
                        data-testid="home-selected-date-status-badge"
                        className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-0.5 block"
                      >
                        {lang === 'bn'
                          ? 'আসন্ন তারিখ — এখনো উপস্থিতি বা ওভারটাইম দেওয়া যাবে না'
                          : 'Future date — attendance cannot be marked yet'}
                      </span>
                    ) : (
                      <span
                        data-testid="home-selected-date-status-badge"
                        className="text-xs font-semibold text-slate-400 mt-0.5 block"
                      >
                        {lang === 'bn' ? 'এখনো হাজিরা বসানো হয়নি' : 'Not marked yet'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Overtime Hours on Selected Date Box */}
                <div
                  data-testid="home-selected-date-overtime-box"
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                      {lang === 'bn' ? 'ওভারটাইম ডিটেইলস' : 'Overtime on this Date'}
                    </span>
                    {clickedOtHours > 0 ? (
                      <div className="mt-0.5">
                        <span className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                          {formatNumber(clickedOtHours, lang, 1)}{' '}
                          {lang === 'bn' ? 'ঘণ্টা ওভারটাইম' : 'hrs OT'}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-1.5">
                          ({formatBDT(clickedOtEarnings, lang)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 mt-0.5 block">
                        {lang === 'bn'
                          ? '০ ঘণ্টা (কোনো ওভারটাইম নেই)'
                          : '0 hrs (No overtime recorded)'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Calendar Date Notes, Birthdays, Events & Tasks (View-Only on Home Calendar) */}
              <CalendarDateReminderSection
                selectedDate={quickDate}
                selectedMonth={selectedMonth}
                onSelectDate={(newDate) => {
                  const targetM = newDate.slice(0, 7);
                  if (targetM !== selectedMonth) {
                    setSelectedMonth(targetM);
                  }
                  setQuickDate(newDate);
                }}
                testIdPrefix="home-cal"
                readOnly={true}
              />
            </div>
          );
        })()}

        {/* Distinct Color Legend for Home Attendance Calendar */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-700 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" />
            <span>{lang === 'bn' ? 'উপস্থিত' : 'Present'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-700 inline-block" />
            <span>{lang === 'bn' ? 'অনুপস্থিত (গাঢ় লাল)' : 'Absent'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
            <span>{lang === 'bn' ? 'দেরি' : 'Late'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-600 inline-block" />
            <span>{lang === 'bn' ? 'অনুমোদিত ছুটি' : 'Approved Leave'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-sky-600 inline-block" />
            <span>{lang === 'bn' ? 'সাপ্তাহিক ছুটি (শুক্র)' : 'Weekly Holiday'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-purple-600 inline-block" />
            <span>{lang === 'bn' ? 'আসন্ন সরকারি ছুটি' : 'Upcoming Holiday'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-500 inline-block" />
            <span>{lang === 'bn' ? 'পার হওয়া ছুটি' : 'Passed Holiday'}</span>
          </span>
        </div>

        {/* Tentative & Public Holidays Section inside Home — Distinct Colors for Past vs Upcoming Holidays */}
        <div
          data-testid="home-month-holidays-section"
          className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-emerald-600 fill-emerald-200 dark:fill-emerald-900 shrink-0" />
              <span>
                {lang === 'bn' ? 'এই মাসের সরকারি ও উৎসব ছুটি' : 'Public & Festival Holidays this Month'}
              </span>
            </h3>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                {lang === 'bn' ? 'পার হয়েছে' : 'Passed'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                {lang === 'bn' ? 'আসন্ন ছুটি' : 'Upcoming'}
              </span>
            </div>
          </div>

          {monthHolidays.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {monthHolidays.map((h) => {
                const isPastHoliday = h.date < todayISO;
                return (
                  <button
                    key={h.date}
                    type="button"
                    data-testid={`home-holiday-card-${h.date}`}
                    data-holiday-state={isPastHoliday ? 'past' : 'upcoming'}
                    onClick={() => {
                      setQuickDate(h.date);
                      setQuickDraftStatus('public_holiday');
                      if (!isFutureMonth(h.date.slice(0, 7), currentMonthISO) && !isFutureDate(h.date, todayISO)) {
                        setIsEditingQuickCalc(true);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 group shadow-2xs cursor-pointer ${
                      isPastHoliday
                        ? 'bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700'
                        : 'bg-emerald-50/90 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform ${
                        isPastHoliday
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          : 'bg-emerald-200/80 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200'
                      }`}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          isPastHoliday
                            ? 'fill-slate-400 text-slate-600 dark:text-slate-300'
                            : 'fill-emerald-500 text-emerald-700 dark:text-emerald-300'
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p
                          className={`text-[11px] font-bold tracking-wide ${
                            isPastHoliday
                              ? 'text-slate-600 dark:text-slate-400'
                              : 'text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {formatDateSlashDMY(h.date, lang)}
                        </p>
                        <span
                          data-testid={`home-holiday-badge-${h.date}`}
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                            isPastHoliday
                              ? 'bg-slate-300/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {isPastHoliday
                            ? lang === 'bn'
                              ? 'পার হয়েছে'
                              : 'Passed'
                            : lang === 'bn'
                            ? 'আসন্ন ছুটি'
                            : 'Upcoming'}
                        </span>
                      </div>
                      <h4
                        className={`mt-1 text-sm font-bold leading-snug ${
                          isPastHoliday
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {lang === 'bn' ? h.titleBn : h.titleEn}
                      </h4>
                      <span
                        className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          isPastHoliday
                            ? 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300'
                            : 'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-200'
                        }`}
                      >
                        {isPastHoliday
                          ? lang === 'bn'
                            ? 'ছুটি সম্পন্ন · ১-ট্যাপে হাজিরায় যোগ করুন'
                            : 'Past Holiday · Tap to mark'
                          : lang === 'bn'
                          ? 'আসন্ন ছুটি · বিস্তারিত দেখতে ট্যাপ করুন'
                          : 'Upcoming Holiday · Tap to view'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              {lang === 'bn'
                ? 'এই মাসে কোনো নির্ধারিত বা সম্ভাব্য সরকারি ছুটি নেই।'
                : 'No tentative or official public holidays scheduled for this month.'}
            </div>
          )}
        </div>
      </section>

      {/* Bottom 2-Column Section: Recent Activity & Reminders */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'সাম্প্রতিক হিসাব ও লেনদেন' : 'Recent Activity & Records'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('more', 'reports')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline min-h-[36px] inline-flex items-center"
            >
              {lang === 'bn' ? 'সব রিপোর্ট দেখুন' : 'All Reports'}
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? 'এই মাসে এখনো কোনো লেনদেন বা ওভারটাইম যোগ করা হয়নি।'
                : 'No transactions or overtime entries recorded for this month yet.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-4 min-h-[56px]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                      {item.type === 'overtime' ? (
                        <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      ) : item.type === 'payment' ? (
                        <Banknote className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      ) : (
                        <Wallet className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {formatDateReadable(item.date, lang)}
                        {item.subtitle ? ` · ${item.subtitle}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        item.type === 'expense'
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {item.amountText}
                    </span>
                    {item.type === 'overtime' && (
                      <button
                        type="button"
                        onClick={() => deleteOvertime(item.rawId)}
                        title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Reminders with Direct Quick-Add */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'আসন্ন রিমাইন্ডার ও করণীয়' : 'Upcoming Reminders'}
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('more', 'reminders')}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline min-h-[36px] inline-flex items-center"
              >
                {lang === 'bn' ? 'সব রিমাইন্ডার' : 'Manage All'}
              </button>
            </div>

            {/* Quick Add Reminder Form */}
            <form onSubmit={handleQuickAddReminder} className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={newReminderTitle}
                onChange={(e) => setNewReminderTitle(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'নতুন রিমাইন্ডার লিখুন (যেমন: ১০ তারিখ বেতন)...'
                    : 'Add a quick reminder...'
                }
                className="flex-1 min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="min-h-[38px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0"
              >
                {lang === 'bn' ? 'যোগ' : 'Add'}
              </button>
            </form>

            {reminders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'কোনো রিমাইন্ডার নেই।' : 'No reminders configured.'}
              </div>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {reminders.slice(0, 5).map((rem) => {
                  const parsed = parseCalendarReminderMeta(rem);
                  return (
                    <div
                      key={rem.id}
                      className="py-2.5 flex items-start justify-between gap-2 min-h-[50px]"
                    >
                      <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={rem.isCompleted}
                          onChange={(e) => toggleReminder(rem.id, e.target.checked)}
                          className="mt-1 w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p
                              className={`text-sm font-medium ${
                                rem.isCompleted
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {rem.title}
                            </p>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${parsed.eventBadgeColor}`}
                            >
                              {lang === 'bn' ? parsed.eventKindLabelBn : parsed.eventKindLabelEn}
                            </span>
                          </div>
                          {parsed.cleanNotes && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1">
                              {parsed.cleanNotes}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span>{formatDateReadable(rem.dueDate, lang)}</span>
                            {parsed.alarmEnabled && (
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                · 🔔 {lang === 'bn' ? parsed.offsetLabelBn : parsed.offsetLabelEn}
                              </span>
                            )}
                          </p>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => deleteReminder(rem.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                        title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>


    </div>
  );
};
