import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit2,
  Flag,
  Moon,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { AttendanceRecord, AttendanceStatus, LeaveCategory, WorkShiftPattern } from '../types';
import {
  BANGLADESH_PUBLIC_HOLIDAYS,
  addHoursToTime,
  calculateAttendanceBonusEligibility,
  calculateOvertimeEstimate,
  evaluateCheckInPunctuality,
  formatBDT,
  formatNumber,
  getDefaultDateForMonth,
  getMissingRecordsForMonth,
  getPublicHolidayForDate,
  getPublicHolidaysForMonth,
  isFutureDate,
  isFutureMonth,
  resolveWorkerShiftForDate,
  roundCurrency,
  summarizeAttendanceForMonth,
} from '../utils/calculations';
import { formatDateReadable, formatDateSlashDMY, formatMonthLabel, T } from '../utils/i18n';
import {
  getCalendarCellBadgeMeta,
  getRemindersForCalendarDate,
  stepMonthISO,
} from '../utils/calendarReminders';
import { CalendarDateReminderSection } from './CalendarDateReminderSection';
import { DateInputDMY } from './DateInputDMY';
import { MissingRecordsSection } from './MissingRecordsSection';

interface AttendanceViewProps {
  initialSelectedDate?: string;
}

const STATUS_OPTIONS: Array<{
  id: AttendanceStatus;
  labelBn: string;
  labelEn: string;
  shortBn: string;
  badgeColor: string;
  cellColor: string;
}> = [
  {
    id: 'present',
    labelBn: 'উপস্থিত (Present)',
    labelEn: 'Present',
    shortBn: 'উপস্থিত',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
    cellColor: 'bg-emerald-500 text-white border-emerald-600',
  },
  {
    id: 'late',
    labelBn: 'দেরিতে উপস্থিত (Late)',
    labelEn: 'Late',
    shortBn: 'দেরি',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
    cellColor: 'bg-amber-500 text-white border-amber-600',
  },
  {
    id: 'approved_leave',
    labelBn: 'অনুমোদিত ছুটি (Leave)',
    labelEn: 'Approved Leave',
    shortBn: 'ছুটি',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300',
    cellColor: 'bg-blue-500 text-white border-blue-600',
  },
  {
    id: 'weekly_holiday',
    labelBn: 'সাপ্তাহিক ছুটি (শুক্রবার)',
    labelEn: 'Weekly Holiday (Friday)',
    shortBn: 'শুক্রবার ছুটি',
    badgeColor: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    cellColor: 'bg-slate-600 text-white border-slate-700',
  },
  {
    id: 'public_holiday',
    labelBn: 'সরকারি ও উৎসব ছুটি',
    labelEn: 'Public / Govt Holiday',
    shortBn: 'সরকারি ছুটি',
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300',
    cellColor: 'bg-orange-500 text-white border-orange-600',
  },
  {
    id: 'absent',
    labelBn: 'অনুপস্থিত (Absent)',
    labelEn: 'Absent',
    shortBn: 'অনুপস্থিত',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
    cellColor: 'bg-rose-500 text-white border-rose-600',
  },
];

const LEAVE_CATEGORIES: Array<{ id: LeaveCategory; labelBn: string; labelEn: string }> = [
  { id: 'none', labelBn: 'প্রযোজ্য নয়', labelEn: 'Not Applicable' },
  { id: 'casual', labelBn: 'নৈমিত্তিক ছুটি (Casual - ১০ দিন)', labelEn: 'Casual Leave (10d)' },
  { id: 'sick', labelBn: 'অসুস্থতাজনিত ছুটি (Sick - ১৪ দিন)', labelEn: 'Sick Leave (14d)' },
  { id: 'festival', labelBn: 'উৎসব ছুটি (Festival - ১১ দিন)', labelEn: 'Festival Leave (11d)' },
  { id: 'earned', labelBn: 'অর্জিত ছুটি (Earned Leave)', labelEn: 'Earned Leave' },
  { id: 'maternity', labelBn: 'মাতৃত্বকালীন ছুটি (Maternity)', labelEn: 'Maternity Leave' },
  { id: 'unpaid', labelBn: 'বিনা বেতনে ছুটি (Without Pay)', labelEn: 'Leave Without Pay' },
];

const WEEKDAY_HEADERS: Array<{ bn: string; en: string; isFriday?: boolean }> = [
  { bn: 'শনি', en: 'Sat' },
  { bn: 'রবি', en: 'Sun' },
  { bn: 'সোম', en: 'Mon' },
  { bn: 'মঙ্গল', en: 'Tue' },
  { bn: 'বুধ', en: 'Wed' },
  { bn: 'বৃহঃ', en: 'Thu' },
  { bn: 'শুক্র', en: 'Fri', isFriday: true },
];

export const AttendanceView: React.FC<AttendanceViewProps> = ({ initialSelectedDate }) => {
  const {
    todayISO,
    currentMonthISO,
    selectedMonth,
    setSelectedMonth,
    lang,
    profile,
    overtime,
    attendance,
    reminders,
    isProfileSetupIncomplete,
    reopenOnboarding,
    saveAttendance,
    saveOvertime,
    deleteOvertime,
    updateProfile,
    saveReminder,
  } = useData();
  const dict = T[lang];

  const isUpcomingMonth = isFutureMonth(selectedMonth, currentMonthISO);
  const [selectedDate, setSelectedDate] = useState(() =>
    initialSelectedDate && initialSelectedDate.startsWith(selectedMonth)
      ? initialSelectedDate
      : getDefaultDateForMonth(selectedMonth, todayISO)
  );
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [leaveCategory, setLeaveCategory] = useState<LeaveCategory>('none');
  const [checkIn, setCheckIn] = useState('08:00');
  const [checkOut, setCheckOut] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [entryOtHours, setEntryOtHours] = useState<number>(0);
  const [entryHasBonus, setEntryHasBonus] = useState<boolean>(true);
  const [isEditingAttendance, setIsEditingAttendance] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showShiftConfig, setShowShiftConfig] = useState(false);
  const [showBonusConfig, setShowBonusConfig] = useState(false);
  const [showAllAnnualHolidays, setShowAllAnnualHolidays] = useState(false);
  const editorFormRef = useRef<HTMLDivElement | null>(null);
  const autoPopulatedMonthsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (initialSelectedDate && initialSelectedDate.startsWith(selectedMonth)) {
      setSelectedDate(initialSelectedDate);
    }
  }, [initialSelectedDate, selectedMonth]);

  useEffect(() => {
    if (!selectedDate.startsWith(selectedMonth)) {
      if (initialSelectedDate && initialSelectedDate.startsWith(selectedMonth)) {
        setSelectedDate(initialSelectedDate);
      } else {
        setSelectedDate(getDefaultDateForMonth(selectedMonth, todayISO));
      }
    }
  }, [selectedMonth, todayISO, selectedDate, initialSelectedDate]);

  const isSelectedDateFuture = isFutureDate(selectedDate, todayISO);
  const isEntryLocked = isUpcomingMonth || isSelectedDateFuture;

  const shiftPattern: WorkShiftPattern = profile.shiftPattern || 'day';
  const dayShiftStart = profile.dayShiftStartTime || '08:00';
  const nightShiftStart = profile.nightShiftStartTime || '20:00';
  const rotationStart = profile.rotationStartDate || `${selectedMonth}-01`;

  const resolvedShift = resolveWorkerShiftForDate(profile, selectedDate, 0);
  const scheduledShiftForSelectedDate = {
    activeShift: resolvedShift.activeShift,
    startTime: resolvedShift.officeStartTime,
    endTime: resolvedShift.defaultEndTime,
    labelBn: resolvedShift.shiftLabelBn,
    labelEn: resolvedShift.shiftLabelEn,
  };

  const monthAttendance = attendance
    .filter((a) => a.month === selectedMonth)
    .sort((a, b) => b.date.localeCompare(a.date));

  const summary = summarizeAttendanceForMonth(monthAttendance);
  const monthPublicHolidays = getPublicHolidaysForMonth(selectedMonth);
  const selectedDateHoliday = getPublicHolidayForDate(selectedDate);
  const missingEntries = getMissingRecordsForMonth(
    selectedMonth,
    attendance,
    overtime,
    profile.joiningDate,
    todayISO
  );

  // Evaluate Attendance Bonus Eligibility
  const bonusEvaluation = calculateAttendanceBonusEligibility({
    recordsForMonth: monthAttendance,
    profile,
  });

  const activeShiftCutoffTime =
    scheduledShiftForSelectedDate.activeShift === 'night'
      ? profile.nightBonusCutoffTime || profile.attendanceWindowEndNight || '20:05'
      : profile.dayBonusCutoffTime || profile.attendanceWindowEndDay || '08:05';

  // Evaluate Check-in Punctuality
  const punctuality = evaluateCheckInPunctuality({
    checkInTime: checkIn,
    shiftStartTime: scheduledShiftForSelectedDate.startTime,
    bonusCutoffTime: activeShiftCutoffTime,
  });

  // Selected date Attendance & Overtime records
  const selectedDateAttendance = monthAttendance.find((a) => a.date === selectedDate);
  const selectedDateOvertimeList = overtime.filter((o) => o.date === selectedDate);
  const selectedDateOtHours = roundCurrency(
    selectedDateOvertimeList.reduce((sum, o) => sum + (Number(o.approvedHours) || 0), 0)
  );
  const selectedDateOtEarnings = roundCurrency(
    selectedDateOvertimeList.reduce((sum, o) => sum + (Number(o.estimatedEarnings) || 0), 0)
  );

  // Recent Present Dates list for quick inspection & 1-tap Cross -> Absent
  const recentPresentRecords = monthAttendance.filter(
    (a) => a.status === 'present' || a.status === 'late'
  );

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsEditingAttendance(false);
    const existing = monthAttendance.find((a) => a.date === dateStr);
    const pubHoliday = getPublicHolidayForDate(dateStr);
    const dayObj = new Date(`${dateStr}T00:00:00`);
    const isFriday = dayObj.getDay() === 5;

    // Prefill existing overtime hours for this date if present
    const existingOtList = overtime.filter((o) => o.date === dateStr);
    const otHours = existingOtList.reduce((s, o) => s + (Number(o.approvedHours) || 0), 0);
    setEntryOtHours(otHours);

    if (existing) {
      setStatus(existing.status);
      setLeaveCategory(existing.leaveCategory);
      setCheckIn(existing.checkIn);
      setCheckOut(existing.checkOut);
      setNotes(existing.notes);
      setEntryHasBonus(existing.hasAttendanceBonus !== false);
    } else if (pubHoliday) {
      setStatus('public_holiday');
      setLeaveCategory('festival');
      setCheckIn('');
      setCheckOut('');
      setNotes(lang === 'bn' ? pubHoliday.titleBn : pubHoliday.titleEn);
      setEntryHasBonus(true);
    } else if (isFriday) {
      setStatus('weekly_holiday');
      setLeaveCategory('none');
      setCheckIn('');
      setCheckOut('');
      setNotes(lang === 'bn' ? 'শুক্রবার সাপ্তাহিক ছুটি' : 'Friday Weekly Holiday');
      setEntryHasBonus(true);
    } else {
      setStatus('present');
      setLeaveCategory('none');
      setCheckIn('08:00');
      setCheckOut('17:00');
      setNotes('');
      setEntryHasBonus(true);
    }
  };

  const handleQuickAddOt = async (hours: number) => {
    if (isProfileSetupIncomplete) {
      try {
        localStorage.setItem(
          'shromik_sathi_pending_quick_entry_v1',
          JSON.stringify({
            source: 'attendance',
            date: selectedDate,
            status: 'present',
            leaveCategory: 'none',
            checkIn: checkIn || '08:00',
            checkOut: checkOut || '17:00',
            otHours: hours,
            hasBonus: entryHasBonus,
            notes: 'হাজিরা থেকে সরাসরি ওটি যোগ',
          })
        );
      } catch {
        // ignore storage errors
      }
      reopenOnboarding();
      return;
    }
    if (isFutureMonth(selectedDate.slice(0, 7), currentMonthISO) || isFutureDate(selectedDate, todayISO)) {
      showToast(
        lang === 'bn'
          ? 'আসন্ন মাস বা ভবিষ্যতের তারিখে ওভারটাইম যোগ করা যাবে না।'
          : 'Cannot add overtime for future dates.'
      );
      return;
    }
    const wageBase = profile.otWageBase === 'gross' ? profile.grossSalary : profile.basicSalary;
    const customRate = profile.otCalculationMode === 'manual' ? profile.otCustomHourlyRate : undefined;
    const { hourlyRate, estimatedEarnings } = calculateOvertimeEstimate(
      wageBase,
      profile.otDivisor || 208,
      profile.otMultiplier || 2,
      hours,
      customRate
    );
    const existingOt = overtime.find((o) => o.date === selectedDate);
    const outTime = checkOut || '17:00';
    await saveOvertime(
      {
        date: selectedDate,
        month: selectedDate.slice(0, 7),
        startTime: outTime,
        endTime: addHoursToTime(outTime, hours),
        breakMinutes: 0,
        totalMinutes: Math.round(hours * 60),
        approvedHours: hours,
        basicSalarySnapshot: wageBase,
        divisorSnapshot: profile.otDivisor || 208,
        multiplierSnapshot: profile.otMultiplier || 2,
        hourlyRateSnapshot: hourlyRate,
        estimatedEarnings,
        notes: 'হাজিরা থেকে সরাসরি ওটি যোগ',
      },
      existingOt?.id
    );
    setEntryOtHours(hours);
    showToast(
      lang === 'bn'
        ? `${formatNumber(hours, 'bn', 1)} ঘণ্টা ওভারটাইম যোগ হয়েছে (+ ${formatBDT(estimatedEarnings, 'bn')})!`
        : `Added ${hours}h overtime (+ ${formatBDT(estimatedEarnings, 'en')})!`
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProfileSetupIncomplete) {
      try {
        localStorage.setItem(
          'shromik_sathi_pending_quick_entry_v1',
          JSON.stringify({
            source: 'attendance',
            date: selectedDate,
            status,
            leaveCategory: status === 'approved_leave' ? leaveCategory : 'none',
            checkIn: status === 'present' || status === 'late' ? checkIn : '',
            checkOut: status === 'present' || status === 'late' ? checkOut : '',
            otHours: status === 'present' || status === 'late' ? entryOtHours : 0,
            hasBonus: entryHasBonus,
            notes: notes.trim(),
          })
        );
      } catch {
        // ignore storage errors
      }
      reopenOnboarding();
      return;
    }
    if (isFutureMonth(selectedDate.slice(0, 7), currentMonthISO) || isFutureDate(selectedDate, todayISO)) {
      showToast(
        lang === 'bn'
          ? 'আসন্ন মাস বা ভবিষ্যতের তারিখে উপস্থিতি যোগ বা এডিট করা যাবে না।'
          : 'Cannot add or edit attendance for upcoming months or future dates.'
      );
      return;
    }
    const existing = monthAttendance.find((a) => a.date === selectedDate);
    await saveAttendance(
      {
        date: selectedDate,
        month: selectedDate.slice(0, 7),
        status,
        leaveCategory: status === 'approved_leave' ? leaveCategory : 'none',
        checkIn: status === 'present' || status === 'late' ? checkIn : '',
        checkOut: status === 'present' || status === 'late' ? checkOut : '',
        notes: notes.trim(),
        hasAttendanceBonus: status === 'present' || status === 'late' ? entryHasBonus : undefined,
      },
      existing?.id
    );

    // If marked absent, remove any existing overtime on this date as overtime cannot occur when absent
    if (status === 'absent') {
      const existingOt = overtime.find((o) => o.date === selectedDate);
      if (existingOt) {
        await deleteOvertime(existingOt.id);
      }
    }

    // Also record overtime if hours specified and status is present/late
    if (entryOtHours > 0 && (status === 'present' || status === 'late')) {
      const wageBase = profile.otWageBase === 'gross' ? profile.grossSalary : profile.basicSalary;
      const customRate = profile.otCalculationMode === 'manual' ? profile.otCustomHourlyRate : undefined;
      const { hourlyRate, estimatedEarnings } = calculateOvertimeEstimate(
        wageBase,
        profile.otDivisor || 208,
        profile.otMultiplier || 2,
        entryOtHours,
        customRate
      );
      const existingOt = overtime.find((o) => o.date === selectedDate);
      const outTime = checkOut || '17:00';
      await saveOvertime(
        {
          date: selectedDate,
          month: selectedDate.slice(0, 7),
          startTime: outTime,
          endTime: addHoursToTime(outTime, entryOtHours),
          breakMinutes: 0,
          totalMinutes: Math.round(entryOtHours * 60),
          approvedHours: entryOtHours,
          basicSalarySnapshot: wageBase,
          divisorSnapshot: profile.otDivisor || 208,
          multiplierSnapshot: profile.otMultiplier || 2,
          hourlyRateSnapshot: hourlyRate,
          estimatedEarnings,
          notes: notes.trim() || 'হাজিরার সাথে যুক্ত ওভারটাইম',
        },
        existingOt?.id
      );
    }

    setIsEditingAttendance(false);
    showToast(
      lang === 'bn'
        ? `হাজিরা সংরক্ষিত হয়েছে${entryOtHours > 0 ? ` (ওভারটাইম: ${formatNumber(entryOtHours, 'bn', 1)} ঘণ্টা)` : ''}!`
        : `Attendance saved${entryOtHours > 0 ? ` with ${entryOtHours}h overtime` : ''}!`
    );
  };

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
      const pending = JSON.parse(raw) as {
        source?: string;
        date?: string;
        status?: AttendanceStatus;
        leaveCategory?: LeaveCategory;
        checkIn?: string;
        checkOut?: string;
        otHours?: number;
        hasBonus?: boolean;
        notes?: string;
      };
      if (pending.source !== 'attendance') return;
      localStorage.removeItem('shromik_sathi_pending_quick_entry_v1');
      const targetDate = pending.date || selectedDate;
      const targetStatus: AttendanceStatus = pending.status || 'present';
      const targetLeave: LeaveCategory = pending.leaveCategory || 'none';
      const targetHours = Number(pending.otHours) || 0;
      const existingAtt = attendance.find((a) => a.date === targetDate);
      const existingOt = overtime.find((o) => o.date === targetDate);

      void (async () => {
        await saveAttendance(
          {
            date: targetDate,
            month: targetDate.slice(0, 7),
            status: targetStatus,
            leaveCategory: targetStatus === 'approved_leave' ? targetLeave : 'none',
            checkIn: targetStatus === 'present' || targetStatus === 'late' ? pending.checkIn || '08:00' : '',
            checkOut: targetStatus === 'present' || targetStatus === 'late' ? pending.checkOut || '17:00' : '',
            notes: pending.notes || '',
            hasAttendanceBonus:
              targetStatus === 'present' || targetStatus === 'late' ? pending.hasBonus ?? true : undefined,
          },
          existingAtt?.id
        );

        if (targetHours > 0 && (targetStatus === 'present' || targetStatus === 'late')) {
          const wageBase = profile.otWageBase === 'gross' ? profile.grossSalary : profile.basicSalary;
          const customRate = profile.otCalculationMode === 'manual' ? profile.otCustomHourlyRate : undefined;
          const { hourlyRate, estimatedEarnings } = calculateOvertimeEstimate(
            wageBase,
            profile.otDivisor || 208,
            profile.otMultiplier || 2,
            targetHours,
            customRate
          );
          const outTime = pending.checkOut || '17:00';
          await saveOvertime(
            {
              date: targetDate,
              month: targetDate.slice(0, 7),
              startTime: outTime,
              endTime: addHoursToTime(outTime, targetHours),
              breakMinutes: 0,
              totalMinutes: Math.round(targetHours * 60),
              approvedHours: targetHours,
              basicSalarySnapshot: wageBase,
              divisorSnapshot: profile.otDivisor || 208,
              multiplierSnapshot: profile.otMultiplier || 2,
              hourlyRateSnapshot: hourlyRate,
              estimatedEarnings,
              notes: pending.notes || 'হাজিরার সাথে যুক্ত ওভারটাইম',
            },
            existingOt?.id
          );
        }
        setIsEditingAttendance(false);
        showToast(
          lang === 'bn'
            ? `সেটআপ সম্পন্ন হয়েছে এবং হাজিরা${targetHours > 0 ? ` ও ${formatNumber(targetHours, 'bn', 1)} ঘণ্টা ওভারটাইম` : ''} সংরক্ষিত হয়েছে!`
            : `Setup completed and attendance saved!`
        );
      })();
    } catch {
      // ignore parse errors
    }
  }, [
    isProfileSetupIncomplete,
    selectedDate,
    attendance,
    overtime,
    saveAttendance,
    saveOvertime,
    profile.otWageBase,
    profile.grossSalary,
    profile.basicSalary,
    profile.otCalculationMode,
    profile.otCustomHourlyRate,
    profile.otDivisor,
    profile.otMultiplier,
    lang,
  ]);

  // Quick 1-Tap Cross on a Present record to mark it Absent (অনুপস্থিত)
  const handleQuickMarkAbsent = async (rec: AttendanceRecord) => {
    if (isFutureMonth(rec.month, currentMonthISO) || isFutureDate(rec.date, todayISO)) {
      showToast(
        lang === 'bn'
          ? 'আসন্ন মাস বা ভবিষ্যতের তারিখে উপস্থিতি এডিট করা যাবে না।'
          : 'Cannot edit attendance for future dates.'
      );
      return;
    }
    await saveAttendance(
      {
        date: rec.date,
        month: rec.month,
        status: 'absent',
        leaveCategory: 'none',
        checkIn: '',
        checkOut: '',
        notes:
          lang === 'bn'
            ? 'উপস্থিত থেকে অনুপস্থিত হিসেবে পরিবর্তন করা হয়েছে'
            : 'Changed from Present to Absent',
      },
      rec.id
    );
    if (selectedDate === rec.date) {
      setStatus('absent');
      setCheckIn('');
      setCheckOut('');
    }
    showToast(
      lang === 'bn'
        ? `${formatDateReadable(rec.date, lang)} তারিখটি অনুপস্থিত হিসেবে আপডেট হয়েছে!`
        : `${rec.date} marked as Absent!`
    );
  };

  // Quick 1-Tap status toggle for the currently selected date
  const handleQuickStatusForSelectedDate = async (newStatus: AttendanceStatus) => {
    if (isFutureMonth(selectedDate.slice(0, 7), currentMonthISO) || isFutureDate(selectedDate, todayISO)) {
      showToast(
        lang === 'bn'
          ? 'আসন্ন মাস বা ভবিষ্যতের তারিখে উপস্থিতি যোগ বা এডিট করা যাবে না।'
          : 'Cannot mark attendance for upcoming months or future dates.'
      );
      return;
    }
    const existing = monthAttendance.find((a) => a.date === selectedDate);
    await saveAttendance(
      {
        date: selectedDate,
        month: selectedDate.slice(0, 7),
        status: newStatus,
        leaveCategory: 'none',
        checkIn: newStatus === 'present' || newStatus === 'late' ? checkIn || '08:00' : '',
        checkOut: newStatus === 'present' || newStatus === 'late' ? checkOut || '17:00' : '',
        notes:
          newStatus === 'absent'
            ? lang === 'bn'
              ? 'অনুপস্থিত'
              : 'Absent'
            : notes.trim(),
      },
      existing?.id
    );
    setStatus(newStatus);
    showToast(
      lang === 'bn'
        ? `${formatDateReadable(selectedDate, lang)} তারিখের হাজিরা আপডেট হয়েছে!`
        : 'Attendance status updated!'
    );
  };

  const handleAutoPopulateHolidays = async (silent = false) => {
    if (isUpcomingMonth) {
      if (!silent) {
        showToast(
          lang === 'bn'
            ? 'আসন্ন মাসে অটো ছুটি যোগ করা যাবে না।'
            : 'Cannot auto-populate holidays for an upcoming month.'
        );
      }
      return;
    }
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const daysInMonth = new Date(year, month, 0).getDate();

    let addedCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      if (isFutureDate(dateStr, todayISO)) continue;
      const existing = monthAttendance.find((a) => a.date === dateStr);
      if (existing) continue;

      const pubHoliday = getPublicHolidayForDate(dateStr);
      const dayOfWeek = new Date(year, month - 1, d).getDay();

      if (pubHoliday) {
        await saveAttendance({
          date: dateStr,
          month: selectedMonth,
          status: 'public_holiday',
          leaveCategory: 'none',
          checkIn: '',
          checkOut: '',
          notes: lang === 'bn' ? pubHoliday.titleBn : pubHoliday.titleEn,
        });
        addedCount++;
      } else if (dayOfWeek === 5) {
        await saveAttendance({
          date: dateStr,
          month: selectedMonth,
          status: 'weekly_holiday',
          leaveCategory: 'none',
          checkIn: '',
          checkOut: '',
          notes: lang === 'bn' ? 'শুক্রবার সাপ্তাহিক ছুটি' : 'Friday Weekly Holiday',
        });
        addedCount++;
      }
    }

    if (!silent) {
      showToast(
        lang === 'bn'
          ? addedCount > 0
            ? `${formatNumber(addedCount, lang)}টি সরকারি ও শুক্রবার ছুটি ক্যালেন্ডারে যুক্ত হয়েছে!`
            : 'এই মাসের সকল সরকারি ও শুক্রবার ছুটি ইতিমধ্যে বসানো আছে।'
          : `${addedCount} holidays added to calendar!`
      );
    }
  };

  // Automatically populate unmarked Fridays & Public Holidays up to today once when month is viewed
  useEffect(() => {
    if (isUpcomingMonth) return;
    if (autoPopulatedMonthsRef.current.has(selectedMonth)) return;
    const hasHolidayMarked = monthAttendance.some(
      (a) => a.status === 'weekly_holiday' || a.status === 'public_holiday'
    );
    if (!hasHolidayMarked && monthAttendance.length > 0) {
      autoPopulatedMonthsRef.current.add(selectedMonth);
      void handleAutoPopulateHolidays(true);
    }
  }, [selectedMonth, monthAttendance.length, isUpcomingMonth]);

  const handleSetShiftReminder = async () => {
    const title =
      lang === 'bn'
        ? `${scheduledShiftForSelectedDate.labelBn} ডিউটি রিমাইন্ডার (${scheduledShiftForSelectedDate.startTime})`
        : `${scheduledShiftForSelectedDate.labelEn} Reminder (${scheduledShiftForSelectedDate.startTime})`;
    await saveReminder({
      title,
      category: 'other',
      dueDate: selectedDate,
      isCompleted: false,
      notes:
        lang === 'bn'
          ? `ডিউটি শুরু: ${scheduledShiftForSelectedDate.startTime}, শেষ: ${scheduledShiftForSelectedDate.endTime}`
          : `Shift: ${scheduledShiftForSelectedDate.startTime} - ${scheduledShiftForSelectedDate.endTime}`,
    });
    showToast(
      lang === 'bn'
        ? 'শিফট রিমাইন্ডার সফলভাবে সেট করা হয়েছে!'
        : 'Shift reminder added successfully!'
    );
  };

  // Build calendar cells aligned to Saturday-first grid (standard in Bangladesh)
  const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayJs = new Date(yearNum, monthNum - 1, 1).getDay();
  const leadingEmptyDays = (firstDayJs + 1) % 7;

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const existing = monthAttendance.find((a) => a.date === dateStr);
    const pubHoliday = getPublicHolidayForDate(dateStr);
    const dayOfWeek = new Date(yearNum, monthNum - 1, day).getDay();
    const isFriday = dayOfWeek === 5;
    const dayOvertimeHours = roundCurrency(
      overtime
        .filter((o) => o.date === dateStr)
        .reduce((acc, o) => acc + (Number(o.approvedHours) || 0), 0)
    );
    return {
      day,
      dateStr,
      existing,
      pubHoliday,
      isFriday,
      dayOvertimeHours,
    };
  });

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {isUpcomingMonth && (
        <div
          data-testid="attendance-upcoming-month-banner"
          className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs font-bold"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {lang === 'bn'
                ? `${formatMonthLabel(selectedMonth, 'bn')} একটি আসন্ন মাস — আসন্ন মাসে উপস্থিতি বা ওভারটাইম যোগ ও এডিট করা যাবে না।`
                : `${formatMonthLabel(selectedMonth, 'en')} is an upcoming month — attendance cannot be added or edited.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonth(currentMonthISO)}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 cursor-pointer"
          >
            {lang === 'bn' ? 'চলতি মাসে ফিরুন' : 'Current Month'}
          </button>
        </div>
      )}

      {/* 1. COMPACT SINGLE-LINE DUTY SHIFT & ICON-ONLY SHIFT REMINDER */}
      <div
        data-testid="shift-schedule-card"
        className="bg-white dark:bg-slate-900 rounded-2xl px-3.5 py-2.5 border border-slate-200/90 dark:border-slate-800 shadow-xs"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Left: Compact Title + Current Shift Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                scheduledShiftForSelectedDate.activeShift === 'night'
                  ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300'
              }`}
            >
              {scheduledShiftForSelectedDate.activeShift === 'night' ? (
                <Moon className="w-3.5 h-3.5" />
              ) : (
                <Sun className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {lang === 'bn' ? 'ডিউটি শিফট ও রিমাইন্ডার' : 'Shift & Reminder'}
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {lang === 'bn'
                    ? scheduledShiftForSelectedDate.labelBn
                    : scheduledShiftForSelectedDate.labelEn}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {scheduledShiftForSelectedDate.startTime} - {scheduledShiftForSelectedDate.endTime}
              </p>
            </div>
          </div>

          {/* Right: Compact Shift Selector + Icon-Only Reminder Button */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              {(
                [
                  { id: 'day', bn: 'ডে', en: 'Day' },
                  { id: 'night', bn: 'নাইট', en: 'Night' },
                  { id: 'weekly_rotation', bn: 'রোটেশন', en: 'Rot.' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`shift-mode-${item.id}`}
                  onClick={() => updateProfile({ shiftPattern: item.id })}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    shiftPattern === item.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  {lang === 'bn' ? item.bn : item.en}
                </button>
              ))}
            </div>

            {/* Icon-Only Shift Reminder Button */}
            <button
              type="button"
              data-testid="set-shift-reminder-btn"
              onClick={handleSetShiftReminder}
              title={lang === 'bn' ? 'শিফট রিমাইন্ডার সেট করুন' : 'Set Shift Reminder'}
              aria-label={lang === 'bn' ? 'শিফট রিমাইন্ডার সেট করুন' : 'Set Shift Reminder'}
              className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowShiftConfig((v) => !v)}
              title={lang === 'bn' ? 'সময় পরিবর্তন' : 'Edit Shift Time'}
              className="w-7 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer shrink-0"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {showShiftConfig && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                {lang === 'bn' ? 'ডে শিফট শুরুর সময়' : 'Day Shift Start'}
              </label>
              <input
                type="time"
                value={dayShiftStart}
                onChange={(e) => updateProfile({ dayShiftStartTime: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                {lang === 'bn' ? 'নাইট শিফট শুরুর সময়' : 'Night Shift Start'}
              </label>
              <input
                type="time"
                value={nightShiftStart}
                onChange={(e) => updateProfile({ nightShiftStartTime: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                {lang === 'bn' ? 'রোটেশন শুরুর তারিখ' : 'Rotation Reference Date'}
              </label>
              <DateInputDMY
                value={rotationStart}
                onChange={(val) => updateProfile({ rotationStartDate: val })}
                lang={lang}
              />
            </div>
          </div>
        )}
      </div>

      {/* ATTENDANCE BONUS CONFIGURATION & LIVE STATUS CARD */}
      <div
        data-testid="attendance-bonus-card"
        className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-emerald-200/90 dark:border-emerald-800/80 shadow-xs space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Award className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {lang === 'bn' ? 'হাজিরা বোনাস সেটিংস' : 'Attendance Bonus Settings'}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  bonusEvaluation.isEligible
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {bonusEvaluation.statusBadgeBn}
              </span>
            </div>
          </div>

          <button
            type="button"
            data-testid="toggle-bonus-config-btn"
            onClick={() => setShowBonusConfig((v) => !v)}
            className="px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold transition-all cursor-pointer shrink-0"
          >
            {showBonusConfig ? (lang === 'bn' ? 'বন্ধ করুন' : 'Close') : (lang === 'bn' ? 'এডিট সেটিংস' : 'Edit Settings')}
          </button>
        </div>

        {/* Live Bonus Progress Summary Bar without extra subtitles */}
        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex-wrap">
          <span>
            {lang === 'bn' ? 'এক্টিভ দিন:' : 'Active Days:'}{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {formatNumber(bonusEvaluation.activeDaysCount, lang)} / {formatNumber(bonusEvaluation.requiredDays, lang)} দিন
            </strong>
          </span>
          <span>
            {lang === 'bn'
              ? `অনুপস্থিতি: ${formatNumber(bonusEvaluation.absentDaysCount, lang)} দিন`
              : `Absent: ${bonusEvaluation.absentDaysCount} days`}
          </span>
          <span className="text-emerald-700 dark:text-emerald-400">
            {lang === 'bn'
              ? `কাট-অফ টাইম: ${scheduledShiftForSelectedDate.activeShift === 'night' ? 'নাইট' : 'ডে'} ${activeShiftCutoffTime}`
              : `Cutoff: ${activeShiftCutoffTime}`}
          </span>
        </div>

        {/* Editable Settings Fields */}
        {showBonusConfig && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800">
              <label className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
                {lang === 'bn' ? 'গার্মেন্টসে হাজিরা বোনাস চালু আছে?' : 'Enable Attendance Bonus?'}
              </label>
              <input
                type="checkbox"
                checked={profile.hasAttendanceBonus !== false}
                onChange={(e) => updateProfile({ hasAttendanceBonus: e.target.checked })}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  {lang === 'bn' ? 'হাজিরা বোনাসের পরিমাণ (টাকা)' : 'Bonus Amount (BDT)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={profile.attendanceBonusAmount ?? profile.attendanceBonus ?? 500}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    updateProfile({ attendanceBonusAmount: val, attendanceBonus: val });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  {lang === 'bn' ? 'আবশ্যক এক্টিভ দিন (যেমন: ৩০ বা ২৫)' : 'Required Active Days'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={profile.attendanceBonusDays || 30}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(31, Number(e.target.value) || 30));
                    updateProfile({ attendanceBonusDays: val });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  {lang === 'bn' ? 'অনুপস্থিতির সর্বোচ্চ সীমা' : 'Max Consecutive Absences'}
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={profile.maxConsecutiveAbsences || 0}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    updateProfile({ maxConsecutiveAbsences: val });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Day & Night Shift Cutoff Times for Punching Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  {lang === 'bn' ? 'ডে শিফট বোনাস কাট-অফ সময় (যেমন: ০৮:০৫)' : 'Day Shift Bonus Cutoff'}
                </label>
                <input
                  type="time"
                  value={profile.dayBonusCutoffTime || profile.attendanceWindowEndDay || '08:05'}
                  onChange={(e) =>
                    updateProfile({
                      dayBonusCutoffTime: e.target.value,
                      attendanceWindowEndDay: e.target.value,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  {lang === 'bn' ? 'নাইট শিফট বোনাস কাট-অফ সময় (যেমন: ২০:০৫)' : 'Night Shift Bonus Cutoff'}
                </label>
                <input
                  type="time"
                  value={profile.nightBonusCutoffTime || profile.attendanceWindowEndNight || '20:05'}
                  onChange={(e) =>
                    updateProfile({
                      nightBonusCutoffTime: e.target.value,
                      attendanceWindowEndNight: e.target.value,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact Summary Row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {dict.presentDays}
          </p>
          <p className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatNumber(summary.presentDays, lang)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {dict.lateDays}
          </p>
          <p className="text-base sm:text-lg font-extrabold text-amber-600 dark:text-amber-400">
            {formatNumber(summary.lateDays, lang)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {dict.approvedLeaveDays}
          </p>
          <p className="text-base sm:text-lg font-extrabold text-blue-600 dark:text-blue-400">
            {formatNumber(summary.approvedLeaveDays, lang)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'শুক্রবার ছুটি' : 'Fridays'}
          </p>
          <p className="text-base sm:text-lg font-extrabold text-slate-700 dark:text-slate-300">
            {formatNumber(summary.weeklyHolidays, lang)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'সরকারি ছুটি' : 'Govt Holidays'}
          </p>
          <p className="text-base sm:text-lg font-extrabold text-orange-600 dark:text-orange-400">
            {formatNumber(summary.publicHolidays, lang)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {dict.absentDays}
          </p>
          <p className="text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-400">
            {formatNumber(summary.absentDays, lang)}
          </p>
        </div>
      </div>

      {/* Missing Attendance & Overtime Alert */}
      <MissingRecordsSection onSelectDate={(dateStr: string) => handleSelectDate(dateStr)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 2. CALENDAR CARD WITH SINGLE-LINE MONTH+YEAR & ICON-ONLY AUTO-HOLIDAY BUTTON */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3.5">
          {/* Single-Line Calendar Header: Month & Year + Month Prev/Next + Auto-Holiday Icon Button */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="inline-flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  data-testid="att-cal-prev-month-btn"
                  onClick={() => setSelectedMonth(stepMonthISO(selectedMonth, -1))}
                  title={lang === 'bn' ? 'পূর্বের মাস' : 'Previous Month'}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="text-xs sm:text-base font-extrabold text-slate-900 dark:text-white truncate px-1">
                  {formatMonthLabel(selectedMonth, lang)}
                </h3>
                <button
                  type="button"
                  data-testid="att-cal-next-month-btn"
                  onClick={() => setSelectedMonth(stepMonthISO(selectedMonth, 1))}
                  title={lang === 'bn' ? 'পরের মাস (আগামী রিমাইন্ডার সেট করুন)' : 'Next Month'}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Compact Legend Dots */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {lang === 'bn' ? 'উপস্থিত' : 'Present'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  {lang === 'bn' ? 'সরকারি ছুটি' : 'Govt'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}
                </span>
              </div>

              {/* Icon-Only Auto-Populate Holidays Button */}
              <button
                type="button"
                disabled={isUpcomingMonth}
                data-testid="auto-populate-holidays-btn"
                onClick={() => handleAutoPopulateHolidays(false)}
                title={
                  lang === 'bn'
                    ? 'সরকারি ও শুক্রবার ছুটি অটো বসান'
                    : 'Auto-Mark Fridays & Govt Holidays'
                }
                aria-label={
                  lang === 'bn'
                    ? 'সরকারি ও শুক্রবার ছুটি অটো বসান'
                    : 'Auto-Mark Fridays & Govt Holidays'
                }
                className="w-8 h-8 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAY_HEADERS.map((w, idx) => (
              <div
                key={idx}
                className={`text-[11px] font-bold py-1 rounded-lg ${
                  w.isFriday
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/30'
                    : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40'
                }`}
              >
                {lang === 'bn' ? w.bn : w.en}
              </div>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: leadingEmptyDays }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-12 sm:h-14 rounded-xl bg-transparent" />
            ))}

            {calendarDays.map(
              ({ day, dateStr, existing, pubHoliday, isFriday, dayOvertimeHours }) => {
                const isSelected = selectedDate === dateStr;
                const isTodayCell = dateStr === todayISO;
                const isFutureCell = isUpcomingMonth || isFutureDate(dateStr, todayISO);
                const statusMeta = existing
                  ? STATUS_OPTIONS.find((s) => s.id === existing.status)
                  : null;
                const isMissingWorkday = missingEntries.some((m) => m.date === dateStr);
                const isPastHoliday = pubHoliday && dateStr < todayISO;

                const dayReminders = getRemindersForCalendarDate(reminders, dateStr);
                const hasDayReminder = dayReminders.length > 0;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    data-testid={`calendar-day-${day}`}
                    data-has-reminder={hasDayReminder ? 'true' : 'false'}
                    onClick={() => handleSelectDate(dateStr)}
                    title={
                      hasDayReminder
                        ? `${dateStr} — নোট/রিমাইন্ডার: ${dayReminders.map((r) => r.title).join(', ')}`
                        : pubHoliday
                        ? `${pubHoliday.titleBn}`
                        : isFriday
                        ? 'শুক্রবার সাপ্তাহিক ছুটি'
                        : dateStr
                    }
                    className={`h-12 sm:h-14 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer relative px-0.5 ${
                      isSelected
                        ? 'ring-2 ring-emerald-500 ring-offset-1 z-10'
                        : hasDayReminder
                        ? 'ring-2 ring-indigo-500/80 dark:ring-indigo-400'
                        : ''
                    } ${
                      statusMeta
                        ? statusMeta.cellColor
                        : pubHoliday
                        ? isPastHoliday
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-400 dark:border-slate-600'
                          : 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800'
                        : isFriday
                        ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                        : isMissingWorkday
                        ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 border-dashed border-amber-400 dark:border-amber-700'
                        : isFutureCell
                        ? 'bg-slate-100/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 border-dashed border-slate-200 dark:border-slate-800'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
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
                          data-testid={`att-cal-rem-badge-${dateStr}`}
                          className={`absolute -top-1.5 left-1 px-1 py-0.2 rounded-full ${cellBadge.cellBadgeColor} text-[8px] font-extrabold leading-tight inline-flex items-center gap-0.5 shadow-2xs`}
                        >
                          <Bell className="w-2 h-2" />
                          <span>{lang === 'bn' ? cellBadge.labelBn : cellBadge.labelEn}</span>
                        </span>
                      );
                    })()}
                    <span className="text-xs sm:text-sm leading-none">
                      {formatNumber(day, lang)}
                    </span>

                    <span className="text-[9px] font-semibold mt-0.5 opacity-95 leading-tight truncate max-w-full">
                      {existing
                        ? statusMeta?.shortBn
                        : pubHoliday
                        ? lang === 'bn'
                          ? 'সরকারি'
                          : 'Govt'
                        : isFriday
                        ? lang === 'bn'
                          ? 'শুক্র'
                          : 'Fri'
                        : isFutureCell
                        ? lang === 'bn'
                          ? 'আসন্ন'
                          : 'Next'
                        : ''}
                    </span>

                    {/* Overtime Badge on Calendar Cell if OT exists on this date */}
                    {dayOvertimeHours > 0 && (
                      <span className="text-[8px] font-extrabold px-1 rounded bg-black/25 text-white leading-tight mt-0.5">
                        +{formatNumber(dayOvertimeHours, lang, 1)}ঘঃ
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>

          {/* 3. CLICKED DATE DETAILS SUMMARY CARD (Shows Attendance Status + Overtime Hours on Selected Date) */}
          <div
            data-testid="selected-date-details-card"
            className="mt-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                  {lang === 'bn' ? 'নির্বাচিত তারিখ' : 'Selected Date'}
                </p>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  {formatDateReadable(selectedDate, lang)} ({formatDateSlashDMY(selectedDate, lang)})
                </h4>
              </div>

              {isEntryLocked && (
                <span
                  data-testid="selected-date-future-badge"
                  className="inline-flex items-center px-2 sm:px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-xs font-bold shrink-0 whitespace-nowrap"
                >
                  {lang === 'bn' ? 'আসন্ন তারিখ (লক)' : 'Future Date (Locked)'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Attendance Status Box */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                    {lang === 'bn' ? 'হাজিরা অবস্থা' : 'Attendance Status'}
                  </span>
                  {selectedDateAttendance ? (
                    <div className="mt-0.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold ${
                          STATUS_OPTIONS.find((s) => s.id === selectedDateAttendance.status)
                            ?.badgeColor || ''
                        }`}
                      >
                        {lang === 'bn'
                          ? STATUS_OPTIONS.find((s) => s.id === selectedDateAttendance.status)
                              ?.shortBn
                          : STATUS_OPTIONS.find((s) => s.id === selectedDateAttendance.status)
                              ?.labelEn}
                      </span>
                      {(selectedDateAttendance.checkIn || selectedDateAttendance.checkOut) && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2 font-medium">
                          {selectedDateAttendance.checkIn} - {selectedDateAttendance.checkOut}
                        </span>
                      )}
                    </div>
                  ) : selectedDateHoliday ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 mt-0.5">
                      {lang === 'bn' ? 'সরকারি ছুটি' : 'Govt Holiday'}
                    </span>
                  ) : new Date(`${selectedDate}T00:00:00`).getDay() === 5 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 mt-0.5">
                      {lang === 'bn' ? 'শুক্রবার সাপ্তাহিক ছুটি' : 'Friday Weekly Off'}
                    </span>
                  ) : isEntryLocked ? (
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-0.5 block">
                      {lang === 'bn'
                        ? 'আসন্ন তারিখ — এখনো উপস্থিতি দেওয়া যাবে না'
                        : 'Future date — attendance locked'}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400 mt-0.5 block">
                      {lang === 'bn' ? 'এখনো হাজিরা বসানো হয়নি' : 'Not marked yet'}
                    </span>
                  )}
                </div>
              </div>

              {/* Overtime Hours on Selected Date Box */}
              <div
                data-testid="selected-date-overtime-box"
                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                    {lang === 'bn' ? 'ওভারটাইম ডিটেইলস' : 'Overtime on this Date'}
                  </span>
                  {selectedDateOtHours > 0 ? (
                    <div className="mt-0.5">
                      <span className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formatNumber(selectedDateOtHours, lang, 1)}{' '}
                        {lang === 'bn' ? 'ঘণ্টা ওভারটাইম' : 'hrs OT'}
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-1.5">
                        ({formatBDT(selectedDateOtEarnings, lang)})
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

            {/* Calendar Date Tasks, Events, Birthdays & Notes (Full Add/Edit on Attendance Page) */}
            <CalendarDateReminderSection
              selectedDate={selectedDate}
              selectedMonth={selectedMonth}
              onSelectDate={(newDate) => {
                const targetM = newDate.slice(0, 7);
                if (targetM !== selectedMonth) {
                  setSelectedMonth(targetM);
                }
                handleSelectDate(newDate);
              }}
              testIdPrefix="att-cal"
              readOnly={false}
            />
          </div>
        </div>

        {/* Right Column: Day Editor Form + Recent Present Dates List */}
        <div className="lg:col-span-5 space-y-4">
          {/* Day Editor Form: Collapses when Present is already recorded, with 1-tap Overtime adder */}
          {(selectedDateAttendance?.status === 'present' || selectedDateAttendance?.status === 'late') && !isEditingAttendance ? (
            <div
              ref={editorFormRef}
              data-testid="attendance-present-compact-card"
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-emerald-200/90 dark:border-emerald-800/80 shadow-xs space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {selectedDate === todayISO
                        ? lang === 'bn' ? 'আজকের উপস্থিতি সম্পন্ন' : 'Today Attendance Done'
                        : `${formatDateReadable(selectedDate, lang)}`}
                    </h3>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                      {lang === 'bn' ? 'উপস্থিত' : 'Present'}
                      {(selectedDateAttendance.checkIn || selectedDateAttendance.checkOut) &&
                        ` · ${selectedDateAttendance.checkIn || '০৮:০০'} - ${selectedDateAttendance.checkOut || '১৭:০০'}`}
                    </p>
                  </div>
                </div>

                {!isEntryLocked && (
                  <button
                    type="button"
                    data-testid="edit-attendance-btn"
                    onClick={() => setIsEditingAttendance(true)}
                    className="min-h-[32px] px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'এডিট' : 'Edit'}</span>
                  </button>
                )}
              </div>

              {/* Overtime Summary in compact present card */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                    {lang === 'bn' ? 'ওভারটাইম পরিবর্তন বা যোগ করুন:' : 'Overtime for this date:'}
                  </span>
                  <div className="mt-0.5">
                    {selectedDateOtHours > 0 ? (
                      <span className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formatNumber(selectedDateOtHours, lang, 1)} {lang === 'bn' ? 'ঘণ্টা ওভারটাইম' : 'hrs OT'} ({formatBDT(selectedDateOtEarnings, lang)})
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">
                        {lang === 'bn' ? '০ ঘণ্টা (ওভারটাইম নেই)' : '0 hrs (No overtime)'}
                      </span>
                    )}
                  </div>
                </div>

                {!isEntryLocked && (
                  <button
                    type="button"
                    data-testid="edit-ot-inside-card-btn"
                    onClick={() => setIsEditingAttendance(true)}
                    className="min-h-[32px] px-3 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'এডিট করুন' : 'Edit'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              ref={editorFormRef}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'হাজিরা ও ওভারটাইম এন্ট্রি' : 'Attendance & Overtime Entry'}
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                    {formatDateReadable(selectedDate, lang)} ({formatDateSlashDMY(selectedDate, lang)})
                  </p>
                </div>
                {isEditingAttendance && (
                  <button
                    type="button"
                    onClick={() => setIsEditingAttendance(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded-lg"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                )}
              </div>

              {isEntryLocked && (
                <div
                  data-testid="attendance-editor-future-lock"
                  className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2"
                >
                  <span>
                    {isUpcomingMonth
                      ? lang === 'bn'
                        ? 'আসন্ন মাসে উপস্থিতি যোগ বা এডিট করা যাবে না।'
                        : 'Cannot add or edit attendance in an upcoming month.'
                      : lang === 'bn'
                      ? `${formatDateSlashDMY(selectedDate, 'bn')} ভবিষ্যতের তারিখ — আজ বা পূর্বের তারিখ নির্বাচন করুন।`
                      : `${formatDateSlashDMY(selectedDate, 'en')} is a future date — select today or a past date.`}
                  </span>
                  {!isUpcomingMonth && isSelectedDateFuture && (
                    <button
                      type="button"
                      onClick={() => handleSelectDate(todayISO)}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                      {lang === 'bn' ? 'আজকের তারিখ নিন' : 'Today'}
                    </button>
                  )}
                </div>
              )}

              {selectedDateHoliday && (
                <div className="mb-3 p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/80 flex items-start gap-2">
                  <Flag className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-orange-900 dark:text-orange-200">
                      {lang === 'bn' ? selectedDateHoliday.titleBn : selectedDateHoliday.titleEn}
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === 'bn' ? 'উপস্থিতির অবস্থা নির্বাচন করুন' : 'Select Status'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STATUS_OPTIONS.map((opt) => {
                      const isDisabled =
                        isEntryLocked ||
                        (!!selectedDateHoliday && (opt.id === 'present' || opt.id === 'absent'));
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            setStatus(opt.id);
                            if (opt.id === 'absent') {
                              setEntryOtHours(0);
                              setEntryHasBonus(false);
                            } else if (opt.id === 'late') {
                              setEntryHasBonus(false);
                            } else if (opt.id === 'present') {
                              setEntryHasBonus(true);
                            }
                          }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                            status === opt.id
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                          }`}
                        >
                          {lang === 'bn' ? opt.shortBn : opt.labelEn}
                        </button>
                      );
                    })}
                  </div>
                  {selectedDateHoliday && (
                    <p className="mt-1 text-[11px] text-orange-700 dark:text-orange-400 font-semibold">
                      {lang === 'bn'
                        ? '* সরকারি ছুটির দিনে উপস্থিতি/অনুপস্থিতি নির্বাচন প্রযোজ্য নয়'
                        : '* Present/Absent cannot be selected on Govt Holidays'}
                    </p>
                  )}
                </div>

                {status === 'approved_leave' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'ছুটির ধরন' : 'Leave Category'}
                    </label>
                    <select
                      value={leaveCategory}
                      disabled={isEntryLocked}
                      onChange={(e) => setLeaveCategory(e.target.value as LeaveCategory)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white disabled:opacity-50"
                    >
                      {LEAVE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {lang === 'bn' ? c.labelBn : c.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {status === 'absent' && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs font-semibold text-rose-800 dark:text-rose-300">
                    {lang === 'bn'
                      ? 'অনুপস্থিত থাকলে ওভারটাইম যোগ করা সম্ভব নয় (০ ঘণ্টা)।'
                      : 'Overtime cannot be selected when marked Absent (0 hrs).'}
                  </div>
                )}

                {(status === 'present' || status === 'late') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {lang === 'bn' ? 'প্রবেশ (Check-in)' : 'Check-in'}
                          </label>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${punctuality.badgeClass}`}>
                            {lang === 'bn' ? punctuality.labelBn : punctuality.labelEn}
                          </span>
                        </div>
                        <input
                          type="time"
                          disabled={isEntryLocked}
                          value={checkIn}
                          onChange={(e) => setCheckIn(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {lang === 'bn' ? 'ছুটি (Check-out)' : 'Check-out'}
                        </label>
                        <input
                          type="time"
                          disabled={isEntryLocked}
                          value={checkOut}
                          onChange={(e) => setCheckOut(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Manual Attendance Bonus Checkbox */}
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid="attendance-bonus-toggle-checkbox"
                        checked={entryHasBonus}
                        disabled={isEntryLocked}
                        onChange={(e) => setEntryHasBonus(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          {lang === 'bn' ? 'হাজিরা বোনাস বহাল আছে (টিক দিন)' : 'Attendance Bonus Active'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {lang === 'bn'
                            ? 'কারখানায় কোনো কারণে আজকের বোনাস কাটা গেলে টিক তুলে দিন'
                            : 'Uncheck if attendance bonus was forfeited today'}
                        </span>
                      </div>
                    </label>

                    {/* Mandatory Overtime Selection when Present */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            {lang === 'bn'
                              ? 'ওভারটাইম ঘণ্টা নির্বাচন করুন (বাধ্যতামূলক):'
                              : 'Select Overtime Hours (Required):'}
                          </span>
                        </label>
                        <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {formatNumber(entryOtHours, lang, 1)} {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[0, 1, 2, 3, 4].map((hrs) => (
                          <button
                            key={hrs}
                            type="button"
                            disabled={isEntryLocked}
                            onClick={() => setEntryOtHours(hrs)}
                            className={`min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                              entryOtHours === hrs
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                            }`}
                          >
                            {hrs === 0 ? (lang === 'bn' ? '০ ঘণ্টা (নেই)' : '0 hr (None)') : `${formatNumber(hrs, lang)} ${lang === 'bn' ? 'ঘণ্টা' : 'hr'}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {dict.notes}
                  </label>
                  <input
                    type="text"
                    disabled={isEntryLocked}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={lang === 'bn' ? 'ঐচ্ছিক নোট...' : 'Optional notes...'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {isEditingAttendance && (
                    <button
                      type="button"
                      onClick={() => setIsEditingAttendance(false)}
                      className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isEntryLocked}
                    data-testid="attendance-save-btn"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isEntryLocked
                      ? lang === 'bn'
                        ? 'আসন্ন মাস বা ভবিষ্যতের তারিখে যোগ করা যাবে না'
                        : 'Locked for Future Dates'
                      : dict.save}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 4. RECENT PRESENT DATES LIST WITH EDIT & 1-TAP CROSS (✕) TO MARK ABSENT */}
          <div
            data-testid="recent-present-dates-card"
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn'
                    ? `সাম্প্রতিক উপস্থিতির তালিকা (${formatNumber(
                        recentPresentRecords.length,
                        lang
                      )} দিন)`
                    : `Recent Present Dates (${recentPresentRecords.length})`}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'ভুলবশত উপস্থিত থাকলে (✕) বাটনে চাপ দিলে সাথে সাথে অনুপস্থিত হয়ে যাবে'
                    : 'Tap (✕) to quickly switch a date from Present to Absent, or Edit'}
                </p>
              </div>
            </div>

            {recentPresentRecords.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                {lang === 'bn'
                  ? 'এই মাসে এখনো কোনো উপস্থিত তারিখ নেই।'
                  : 'No present dates recorded for this month.'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {recentPresentRecords.map((rec) => {
                  const recOtHours = roundCurrency(
                    overtime
                      .filter((o) => o.date === rec.date)
                      .reduce((acc, o) => acc + (Number(o.approvedHours) || 0), 0)
                  );
                  return (
                    <div
                      key={rec.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        selectedDate === rec.date
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70'
                      }`}
                    >
                      <div
                        onClick={() => handleSelectDate(rec.date)}
                        className="min-w-0 pr-2 cursor-pointer flex-1"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {formatDateSlashDMY(rec.date, lang)} ({formatDateReadable(rec.date, lang)})
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {rec.status === 'late'
                              ? lang === 'bn'
                                ? 'দেরি'
                                : 'Late'
                              : lang === 'bn'
                              ? 'উপস্থিত'
                              : 'Present'}
                          </span>
                          {recOtHours > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                              +{formatNumber(recOtHours, lang, 1)}{' '}
                              {lang === 'bn' ? 'ঘণ্টা ওটি' : 'h OT'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {rec.checkIn && rec.checkOut
                            ? `${rec.checkIn} - ${rec.checkOut}`
                            : lang === 'bn'
                            ? 'নিয়মিত ডিউটি'
                            : 'Regular shift'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectDate(rec.date);
                            editorFormRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }}
                          title={lang === 'bn' ? 'এডিট করুন' : 'Edit'}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid={`mark-absent-cross-btn-${rec.date}`}
                          onClick={() => handleQuickMarkAbsent(rec)}
                          title={
                            lang === 'bn'
                              ? 'অনুপস্থিত হিসেবে চিহ্নিত করুন (✕)'
                              : 'Mark as Absent (✕)'
                          }
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. COLLAPSIBLE ANNUAL PUBLIC HOLIDAYS DIRECTORY (Past vs Upcoming Holidays Color-Coded) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-orange-500 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'bn'
                  ? 'সারা বছরের প্রধান সরকারি ও সম্ভাব্য ছুটিসমূহ (২০২৬)'
                  : 'Bangladesh Public & Tentative Holidays (2026)'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? `এই মাসে সরকারি ছুটি: ${formatNumber(monthPublicHolidays.length, lang)}টি · পুরো বছরে মোট: ${formatNumber(BANGLADESH_PUBLIC_HOLIDAYS.length, lang)}টি`
                  : `${monthPublicHolidays.length} holidays this month · ${BANGLADESH_PUBLIC_HOLIDAYS.length} total in 2026`}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="toggle-annual-holidays-btn"
            onClick={() => setShowAllAnnualHolidays((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 font-bold text-xs transition-all cursor-pointer"
          >
            {showAllAnnualHolidays ? (
              <>
                <span>{lang === 'bn' ? 'ছুটির তালিকা লুকান' : 'Hide All Holidays'}</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>
                  {lang === 'bn'
                    ? `সবগুলো ছুটি দেখুন (${formatNumber(BANGLADESH_PUBLIC_HOLIDAYS.length, lang)}টি)`
                    : `View All Holidays (${BANGLADESH_PUBLIC_HOLIDAYS.length})`}
                </span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {showAllAnnualHolidays && (
          <div
            data-testid="annual-holidays-expanded-grid"
            className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
          >
            {BANGLADESH_PUBLIC_HOLIDAYS.map((h) => {
              const isPastHoliday = h.date < todayISO;
              return (
                <div
                  key={h.date}
                  data-testid={`annual-holiday-card-${h.date}`}
                  data-holiday-state={isPastHoliday ? 'past' : 'upcoming'}
                  onClick={() => {
                    if (h.month !== selectedMonth) {
                      setSelectedMonth(h.month);
                    }
                    handleSelectDate(h.date);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                    isPastHoliday
                      ? 'bg-slate-100/90 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700'
                      : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span
                        className={`text-[11px] font-extrabold ${
                          isPastHoliday
                            ? 'text-slate-600 dark:text-slate-400'
                            : 'text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {formatDateSlashDMY(h.date, lang)} ({formatDateReadable(h.date, lang)})
                      </span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold ${
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
                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                      {lang === 'bn' ? h.titleBn : h.titleEn}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
