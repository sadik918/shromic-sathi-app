import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { OvertimeRecord, WorkShiftPattern } from '../types';
import {
  addHoursToTime,
  calculateOvertimeEstimate,
  formatBDT,
  formatNumber,
  getDefaultDateForMonth,
  getEffectiveHourlyOtRate,
  isFutureDate,
  isFutureMonth,
  resolveWorkerShiftForDate,
  roundCurrency,
  summarizeOvertimeRecords,
  toBengaliDigits,
} from '../utils/calculations';
import { formatDateReadable, formatDateSlashDMY, formatMonthLabel } from '../utils/i18n';
import { DateInputDMY } from './DateInputDMY';
import { MissingRecordsSection } from './MissingRecordsSection';

function shiftDateString(dateStr: string, offsetDays: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function formatOtDuration(hours: number, totalMinutes?: number, lang: 'bn' | 'en' = 'bn'): string {
  if (totalMinutes && totalMinutes > 0) {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (m === 0) return `${formatNumber(h, lang)} ${lang === 'bn' ? 'ঘণ্টা' : 'hrs'}`;
    if (h === 0) return `${formatNumber(m, lang)} ${lang === 'bn' ? 'মিনিট' : 'mins'}`;
    return `${formatNumber(h, lang)} ${lang === 'bn' ? 'ঘণ্টা' : 'hrs'} ${formatNumber(m, lang)} ${lang === 'bn' ? 'মিনিট' : 'mins'}`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${formatNumber(h, lang)} ${lang === 'bn' ? 'ঘণ্টা' : 'hrs'}`;
  if (h === 0) return `${formatNumber(m, lang)} ${lang === 'bn' ? 'মিনিট' : 'mins'}`;
  return `${formatNumber(h, lang)} ${lang === 'bn' ? 'ঘণ্টা' : 'hrs'} ${formatNumber(m, lang)} ${lang === 'bn' ? 'মিনিট' : 'mins'}`;
}

export const OvertimeView: React.FC = () => {
  const {
    profile,
    todayISO,
    currentMonthISO,
    selectedMonth,
    setSelectedMonth,
    lang,
    overtime,
    attendance,
    saveAttendance,
    saveOvertime,
    deleteOvertime,
    updateProfile,
    isProfileSetupIncomplete,
    reopenOnboarding,
  } = useData();

  const isUpcomingMonth = isFutureMonth(selectedMonth, currentMonthISO);
  const todayDefault = getDefaultDateForMonth(selectedMonth, todayISO);

  // Form states for daily overtime entry
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(todayDefault);
  const [approvedHours, setApprovedHours] = useState<number>(0);
  const [showAddFormManually, setShowAddFormManually] = useState(false);
  const editFormRef = useRef<HTMLFormElement | null>(null);
  const hoursInputRef = useRef<HTMLInputElement | null>(null);

  // Keep selected date aligned when selectedMonth or todayISO changes
  useEffect(() => {
    if (!editingId && !date.startsWith(selectedMonth)) {
      setDate(getDefaultDateForMonth(selectedMonth, todayISO));
    }
  }, [selectedMonth, todayISO, editingId, date]);

  const isFutureSelectedDate = isFutureDate(date, todayISO);
  const isEntryLocked = isUpcomingMonth || isFutureSelectedDate;

  // Resolve active shift & office start time for the selected date
  const resolvedShift = resolveWorkerShiftForDate(profile, date, approvedHours);
  const [startTime, setStartTime] = useState<string>(resolvedShift.officeStartTime);
  const [endTime, setEndTime] = useState<string>(resolvedShift.defaultEndTime);

  // Per-entry hourly rate (auto-populated from profile's active mode: manual or formula)
  const activeProfileHourlyRate = getEffectiveHourlyOtRate(profile);
  const [entryHourlyRate, setEntryHourlyRate] = useState<number>(activeProfileHourlyRate);
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [listFilter, setListFilter] = useState<'month' | 'all'>('month');

  // OT Policy Settings Panel state
  const [showPolicySettings, setShowPolicySettings] = useState(false);
  const [otCustomHourlyRate, setOtCustomHourlyRate] = useState<number>(
    profile.otCustomHourlyRate && profile.otCustomHourlyRate > 0
      ? profile.otCustomHourlyRate
      : roundCurrency(
          (profile.basicSalary / (profile.otDivisor || 208)) * (profile.otMultiplier || 2)
        )
  );
  const [policyBasicSalary, setPolicyBasicSalary] = useState<number>(profile.basicSalary);
  const [otWageBase, setOtWageBase] = useState<'basic' | 'gross'>(profile.otWageBase);
  const [otDivisor, setOtDivisor] = useState<number>(profile.otDivisor || 208);
  const [otMultiplier, setOtMultiplier] = useState<number>(profile.otMultiplier || 2);

  // Sync entryHourlyRate and default shift start/end times when profile or date changes (unless editing an existing entry)
  useEffect(() => {
    if (!editingId) {
      setEntryHourlyRate(getEffectiveHourlyOtRate(profile));
      const shiftForDate = resolveWorkerShiftForDate(profile, date, approvedHours);
      setStartTime(shiftForDate.officeStartTime);
      setEndTime(shiftForDate.defaultEndTime);
    }
    setPolicyBasicSalary(profile.basicSalary);
    setOtWageBase(profile.otWageBase);
    setOtDivisor(profile.otDivisor || 208);
    setOtMultiplier(profile.otMultiplier || 2);
    if (profile.otCustomHourlyRate && profile.otCustomHourlyRate > 0) {
      setOtCustomHourlyRate(profile.otCustomHourlyRate);
    } else {
      setOtCustomHourlyRate(getEffectiveHourlyOtRate(profile));
    }
  }, [profile, date, editingId]);

  const wageBaseAmount =
    profile.otWageBase === 'gross' ? profile.grossSalary : profile.basicSalary;

  const computedEstimate = calculateOvertimeEstimate(
    wageBaseAmount,
    profile.otDivisor,
    profile.otMultiplier,
    approvedHours,
    entryHourlyRate > 0 ? entryHourlyRate : undefined
  );

  const finalEstimatedEarnings = computedEstimate.estimatedEarnings;

  const summaries = summarizeOvertimeRecords(overtime, selectedMonth, date);

  const displayedRecords = (
    listFilter === 'month' ? overtime.filter((r) => r.month === selectedMonth) : overtime
  ).sort((a, b) => {
    const cmp = b.date.localeCompare(a.date);
    if (cmp !== 0) return cmp;
    return b.startTime.localeCompare(a.startTime);
  });

  const displayedTotalHours = roundCurrency(
    displayedRecords.reduce((s, r) => s + r.approvedHours, 0)
  );
  const displayedTotalEarnings = roundCurrency(
    displayedRecords.reduce((s, r) => s + r.estimatedEarnings, 0)
  );

  const existingAttForDate = attendance.find((a) => a.date === date);
  const isDateMarkedAbsent = existingAttForDate?.status === 'absent';

  const existingSameDateRecord = overtime.find(
    (r) => r.date === date && r.id !== editingId
  );
  const isFormCollapsed = !!existingSameDateRecord && !editingId && !showAddFormManually;

  const handleQuickAdjustRecordHours = async (rec: OvertimeRecord, delta: number) => {
    const nextHours = roundCurrency(Math.min(24, Math.max(0.5, rec.approvedHours + delta)));
    if (nextHours === rec.approvedHours) return;
    const nextEstimate = calculateOvertimeEstimate(
      rec.basicSalarySnapshot || wageBaseAmount,
      rec.divisorSnapshot || 208,
      rec.multiplierSnapshot || 2,
      nextHours,
      rec.hourlyRateSnapshot > 0 ? rec.hourlyRateSnapshot : undefined
    );
    await saveOvertime(
      {
        date: rec.date,
        month: rec.month,
        startTime: rec.startTime,
        endTime: addHoursToTime(rec.startTime, 9 + nextHours),
        breakMinutes: rec.breakMinutes,
        totalMinutes: Math.round(nextHours * 60),
        approvedHours: nextHours,
        basicSalarySnapshot: rec.basicSalarySnapshot,
        divisorSnapshot: rec.divisorSnapshot,
        multiplierSnapshot: rec.multiplierSnapshot,
        hourlyRateSnapshot: rec.hourlyRateSnapshot,
        estimatedEarnings: nextEstimate.estimatedEarnings,
        notes: rec.notes,
      },
      rec.id
    );
    setFormSuccess(
      lang === 'bn'
        ? `${formatDateReadable(rec.date, 'bn')} তারিখের ওভারটাইম ${formatNumber(nextHours, 'bn', 1)} ঘণ্টা (${formatBDT(nextEstimate.estimatedEarnings, 'bn')}) আপডেট হয়েছে।`
        : `Updated overtime for ${rec.date} to ${nextHours} hrs.`
    );
  };

  const handleQuickShiftPatternChange = async (nextPattern: WorkShiftPattern) => {
    const nextDayStart = profile.dayShiftStartTime || '08:00';
    const nextNightStart = profile.nightShiftStartTime || '20:00';
    await updateProfile({
      shiftPattern: nextPattern,
      dayShiftStartTime: nextDayStart,
      nightShiftStartTime: nextNightStart,
      rotationStartDate: profile.rotationStartDate || `${selectedMonth}-01`,
    });
    const updatedShift = resolveWorkerShiftForDate(
      {
        ...profile,
        shiftPattern: nextPattern,
        dayShiftStartTime: nextDayStart,
        nightShiftStartTime: nextNightStart,
      },
      date,
      approvedHours
    );
    setStartTime(updatedShift.officeStartTime);
    setEndTime(updatedShift.defaultEndTime);
  };

  const handleQuickHoursSelect = (hrs: number) => {
    setApprovedHours(hrs);
    setFormError('');
    setEndTime(addHoursToTime(startTime, 9 + hrs));
  };

  const handleChangeDate = (newDate: string) => {
    setDate(newDate);
    setFormError('');
    setShowAddFormManually(false);
    if (/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      const m = newDate.slice(0, 7);
      if (m !== selectedMonth) {
        setSelectedMonth(m);
      }
      if (!editingId) {
        const shiftInfo = resolveWorkerShiftForDate(profile, newDate, approvedHours);
        setStartTime(shiftInfo.officeStartTime);
        setEndTime(shiftInfo.defaultEndTime);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (isProfileSetupIncomplete) {
      if (date && approvedHours > 0) {
        try {
          localStorage.setItem(
            'shromik_sathi_pending_quick_entry_v1',
            JSON.stringify({
              source: 'overtime',
              date,
              status: 'present',
              otHours: approvedHours,
              startTime: startTime || resolvedShift.officeStartTime,
              endTime: endTime || resolvedShift.defaultEndTime,
              notes: notes.trim(),
            })
          );
        } catch {
          // ignore storage errors
        }
      }
      reopenOnboarding();
      return;
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError(
        lang === 'bn' ? 'সঠিক তারিখ নির্বাচন করুন।' : 'Please select a valid date.'
      );
      return;
    }

    if (isFutureMonth(date.slice(0, 7), currentMonthISO) || isFutureDate(date, todayISO)) {
      setFormError(
        lang === 'bn'
          ? `আসন্ন মাস বা ভবিষ্যতের তারিখে (${formatDateSlashDMY(date, 'bn')}) অগ্রিম ওভারটাইম যোগ বা এডিট করা যাবে না। আজকের (${formatDateSlashDMY(todayISO, 'bn')}) বা পূর্ববর্তী তারিখ নির্বাচন করুন।`
          : `Cannot add or edit overtime for a future date (${date}).`
      );
      return;
    }

    if (isDateMarkedAbsent) {
      setFormError(
        lang === 'bn'
          ? `এই তারিখে (${formatDateSlashDMY(date, 'bn')}) হাজিরা 'অনুপস্থিত' দেওয়া হয়েছে। অনুপস্থিত থাকলে ওভারটাইম যোগ করা সম্ভব নয়। ওভারটাইম যোগ করতে চাইলে প্রথমে হাজিরা পাতায় গিয়ে উপস্থিত মার্ক করুন।`
          : 'Cannot add overtime when marked absent. Please mark attendance present first.'
      );
      return;
    }

    if (!editingId && existingSameDateRecord) {
      setFormError(
        lang === 'bn'
          ? `${formatDateReadable(date, 'bn')} তারিখে ইতিমধ্যে ওভারটাইম যোগ করা আছে। একই তারিখে দুইটা ওভারটাইম যোগ করা যাবে না — পাশের 'এডিট' বাটনে ক্লিক করে ঘণ্টা বাড়াতে বা কমাতে পারবেন।`
          : `Overtime already exists on ${date}. Please edit the existing entry instead of adding a duplicate.`
      );
      return;
    }

    if (!approvedHours || approvedHours <= 0) {
      setFormError(
        lang === 'bn'
          ? 'অনুগ্রহ করে প্রথমে ওভারটাইম ঘণ্টা নির্বাচন করুন।'
          : 'Please select overtime hours first before adding.'
      );
      return;
    }

    if (approvedHours > 24) {
      setFormError(
        lang === 'bn'
          ? 'ওভারটাইম ঘণ্টা সর্বোচ্চ ২৪ ঘণ্টার মধ্যে হতে হবে।'
          : 'Overtime hours cannot exceed 24 hours.'
      );
      return;
    }

    const effectiveRate =
      entryHourlyRate > 0 ? roundCurrency(entryHourlyRate) : computedEstimate.hourlyRate;

    await saveOvertime(
      {
        date,
        month: date.slice(0, 7),
        startTime: startTime || resolvedShift.officeStartTime,
        endTime: endTime || resolvedShift.defaultEndTime,
        breakMinutes: 0,
        totalMinutes: Math.round(approvedHours * 60),
        approvedHours,
        basicSalarySnapshot: wageBaseAmount,
        divisorSnapshot: profile.otDivisor || 208,
        multiplierSnapshot: profile.otMultiplier || 2,
        hourlyRateSnapshot: effectiveRate,
        estimatedEarnings: finalEstimatedEarnings,
        notes: notes.trim(),
      },
      editingId || undefined
    );

    // Synchronize with attendance: ensure date has attendance marked present if not already
    if (!existingAttForDate || existingAttForDate.status !== 'present') {
      await saveAttendance(
        {
          date,
          month: date.slice(0, 7),
          status: 'present',
          leaveCategory: 'none',
          checkIn: startTime || '08:00',
          checkOut: endTime || '17:00',
          notes: 'ওভারটাইমের সাথে স্বয়ংক্রিয় উপস্থিতি',
        },
        existingAttForDate?.id
      );
    }

    setFormSuccess(
      editingId
        ? lang === 'bn'
          ? `ওভারটাইম এন্ট্রি (${formatDateReadable(date, 'bn')} · ${formatBDT(finalEstimatedEarnings, 'bn')}) আপডেট হয়েছে।`
          : 'Overtime record updated.'
        : lang === 'bn'
        ? `নতুন ওভারটাইম (${formatOtDuration(approvedHours, undefined, 'bn')} = ${formatBDT(finalEstimatedEarnings, 'bn')}) সফলভাবে যোগ হয়েছে!`
        : 'New overtime record saved!'
    );
    setEditingId(null);
    setApprovedHours(0);
    setShowAddFormManually(false);
    setNotes('');
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
        otHours?: number;
        startTime?: string;
        endTime?: string;
        notes?: string;
      };
      if (pending.source !== 'overtime') return;
      localStorage.removeItem('shromik_sathi_pending_quick_entry_v1');
      const targetDate = pending.date || date;
      const targetHours = Number(pending.otHours) || 0;
      if (!targetDate || targetHours <= 0) return;

      const customRate =
        profile.otCalculationMode === 'manual' && (profile.otCustomHourlyRate || 0) > 0
          ? profile.otCustomHourlyRate
          : undefined;
      const est = calculateOvertimeEstimate(
        wageBaseAmount,
        profile.otDivisor || 208,
        profile.otMultiplier || 2,
        targetHours,
        customRate
      );
      const existingAtt = attendance.find((a) => a.date === targetDate);
      const existingOt = overtime.find((o) => o.date === targetDate);

      void (async () => {
        await saveOvertime(
          {
            date: targetDate,
            month: targetDate.slice(0, 7),
            startTime: pending.startTime || '08:00',
            endTime: pending.endTime || '19:00',
            breakMinutes: 0,
            totalMinutes: Math.round(targetHours * 60),
            approvedHours: targetHours,
            basicSalarySnapshot: wageBaseAmount,
            divisorSnapshot: profile.otDivisor || 208,
            multiplierSnapshot: profile.otMultiplier || 2,
            hourlyRateSnapshot: est.hourlyRate,
            estimatedEarnings: est.estimatedEarnings,
            notes: pending.notes || '',
          },
          existingOt?.id
        );
        if (!existingAtt || existingAtt.status !== 'present') {
          await saveAttendance(
            {
              date: targetDate,
              month: targetDate.slice(0, 7),
              status: 'present',
              leaveCategory: 'none',
              checkIn: pending.startTime || '08:00',
              checkOut: pending.endTime || '17:00',
              notes: 'ওভারটাইমের সাথে স্বয়ংক্রিয় উপস্থিতি',
            },
            existingAtt?.id
          );
        }
        setFormSuccess(
          lang === 'bn'
            ? `সেটআপ সম্পন্ন হয়েছে এবং নতুন ওভারটাইম (${formatOtDuration(targetHours, undefined, 'bn')} = ${formatBDT(est.estimatedEarnings, 'bn')}) সফলভাবে যোগ হয়েছে!`
            : 'Setup completed and overtime record saved!'
        );
        setApprovedHours(0);
        setShowAddFormManually(false);
        setNotes('');
      })();
    } catch {
      // ignore parse errors
    }
  }, [
    isProfileSetupIncomplete,
    date,
    wageBaseAmount,
    profile.otCalculationMode,
    profile.otCustomHourlyRate,
    profile.otDivisor,
    profile.otMultiplier,
    attendance,
    overtime,
    saveOvertime,
    saveAttendance,
    lang,
  ]);

  const handleEditRecord = (rec: OvertimeRecord) => {
    setEditingId(rec.id);
    setDate(rec.date);
    setStartTime(rec.startTime);
    setEndTime(rec.endTime);
    setApprovedHours(rec.approvedHours);
    setEntryHourlyRate(
      rec.hourlyRateSnapshot > 0 ? rec.hourlyRateSnapshot : getEffectiveHourlyOtRate(profile)
    );
    setNotes(rec.notes || '');
    setShowAddFormManually(true);
    setFormError('');
    setFormSuccess('');
    setTimeout(() => {
      if (editFormRef.current) {
        editFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      hoursInputRef.current?.focus({ preventScroll: true });
    }, 60);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otCustomHourlyRate <= 0) return;
    const savedRate = roundCurrency(otCustomHourlyRate);
    await updateProfile({
      otCalculationMode: 'manual',
      otCustomHourlyRate: savedRate,
    });
    setEntryHourlyRate(savedRate);
    setShowPolicySettings(false);
    setFormSuccess(
      lang === 'bn'
        ? `ওভারটাইম প্রতি ঘণ্টা ${formatBDT(savedRate, 'bn', savedRate % 1 !== 0)} ডিফল্ট হিসেবে সংরক্ষিত হয়েছে!`
        : `Default overtime rate (${formatBDT(savedRate, 'en', true)}/hr) saved!`
    );
  };

  const formulaPreviewRate = roundCurrency(
    ((otWageBase === 'gross' ? profile.grossSalary : policyBasicSalary) /
      (otDivisor || 208)) *
      (otMultiplier || 2)
  );

  return (
    <div className="space-y-5">
      {isProfileSetupIncomplete && (
        <div
          data-testid="overtime-setup-required-banner"
          role="region"
          className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {lang === 'bn'
                  ? 'প্রথমে আপনার বেতন ও ওভারটাইম সেটআপ সম্পন্ন করুন'
                  : 'Complete your salary & overtime setup first'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {lang === 'bn'
                  ? 'বেতন ও ওভারটাইম সেটআপ করলে আপনি আপনার ওভারটাইম ও জব তথ্য যোগ করতে পারবেন।'
                  : 'Once setup is completed, you can add overtime and manage your job.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="overtime-complete-setup-btn"
            onClick={reopenOnboarding}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold whitespace-nowrap cursor-pointer"
          >
            {lang === 'bn' ? 'প্রথমে সেটআপ করুন' : 'Complete Setup'}
          </button>
        </div>
      )}

      {/* 1. Missing Records Section Placed at the VERY TOP of Overtime View */}
      <MissingRecordsSection onSelectDate={(d) => handleChangeDate(d)} />

      {/* Upcoming Month Restriction Notice */}
      {isUpcomingMonth && (
        <div
          data-testid="overtime-upcoming-month-banner"
          role="alert"
          className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {lang === 'bn'
                ? `${formatMonthLabel(selectedMonth, 'bn')} হলো আসন্ন মাস। আসন্ন বা ভবিষ্যতের কোনো মাসে ওভারটাইম যোগ বা এডিট করা যাবে না।`
                : `${formatMonthLabel(selectedMonth, 'en')} is an upcoming month. Adding or editing overtime is locked for future months.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonth(currentMonthISO)}
            className="min-h-[32px] px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 whitespace-nowrap"
          >
            {lang === 'bn' ? 'রানিং মাসে ফিরুন' : 'Current Month'}
          </button>
        </div>
      )}

      {/* 2. Daily Overtime Header & Compact Settings Icon Toggle (Placed BELOW Missing Records) */}
      <div
        data-testid="daily-overtime-header-card"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3"
      >
        <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white truncate">
          {lang === 'bn' ? 'দৈনিক ওভারটাইম টাকার হিসাব' : 'Daily Overtime Earnings Calculator'}
        </h1>

        <button
          type="button"
          data-testid="toggle-ot-policy-btn"
          aria-label={
            lang === 'bn'
              ? 'ওভারটাইম নিয়ম ও ঘণ্টা প্রতি টাকা সেটিংস'
              : 'Overtime Rate Settings'
          }
          title={
            lang === 'bn'
              ? 'ওভারটাইম নিয়ম সেটিংস'
              : 'Overtime Rate Settings'
          }
          onClick={() => setShowPolicySettings((v) => !v)}
          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
            showPolicySettings
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
              : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {/* Simplified OT Policy Settings Panel (Single-Line Headings on Mobile, No Mode Radio Cards, No Effective Date) */}
      {showPolicySettings && (
        <form
          onSubmit={handleSavePolicy}
          data-testid="ot-policy-settings-panel"
          className="bg-white dark:bg-slate-900 border-2 border-emerald-600/30 dark:border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs"
        >
          {/* Single-line Title on Mobile */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 min-w-0">
            <h2
              data-testid="ot-policy-heading"
              className="text-xs sm:text-base font-bold text-slate-900 dark:text-white whitespace-nowrap truncate"
            >
              {lang === 'bn'
                ? 'প্রতি ঘণ্টা টাকার হার নির্ধারণ করুন'
                : 'Set Hourly Overtime Rate'}
            </h2>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
              {formatBDT(otCustomHourlyRate, lang, otCustomHourlyRate % 1 !== 0)}/
              {lang === 'bn' ? 'ঘঃ' : 'hr'}
            </span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <label
                htmlFor="manual-ot-rate-input"
                className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 whitespace-nowrap truncate"
              >
                {lang === 'bn'
                  ? 'প্রতি ১ ঘণ্টা ওভারটাইম কত টাকা? (৳ / ঘণ্টা)'
                  : 'Hourly Overtime Rate (BDT / Hour)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="manual-ot-rate-input"
                  data-testid="manual-ot-rate-input"
                  type="number"
                  step="0.01"
                  min="1"
                  value={otCustomHourlyRate}
                  onChange={(e) => setOtCustomHourlyRate(Number(e.target.value) || 0)}
                  className="flex-1 min-h-[44px] rounded-xl border border-emerald-500 bg-white dark:bg-slate-900 px-3.5 text-base font-bold text-slate-900 dark:text-white tabular-nums"
                  placeholder="যেমন: 70 বা 100"
                />
                <button
                  type="button"
                  data-testid="apply-formula-rate-btn"
                  onClick={() => setOtCustomHourlyRate(formulaPreviewRate)}
                  className="min-h-[44px] px-3.5 rounded-xl bg-emerald-100/80 hover:bg-emerald-200/80 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold whitespace-nowrap shrink-0 tabular-nums transition-colors"
                >
                  {formatBDT(formulaPreviewRate, lang, true)}/{lang === 'bn' ? 'ঘঃ বসান' : 'hr'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowPolicySettings(false)}
              className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
            <button
              type="submit"
              data-testid="save-ot-policy-btn"
              className="min-h-[40px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Rate'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Daily, Weekly, Monthly, Yearly Summaries */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? `নির্বাচিত তারিখ (${formatDateSlashDMY(date, 'bn')})`
              : `Selected Date (${formatDateSlashDMY(date, 'en')})`}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatNumber(summaries.dailyHours, lang, 1)} {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
          </p>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
            {formatBDT(summaries.dailyEarnings, lang)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'সাপ্তাহিক (৭ দিন) ওভারটাইম' : 'Weekly (7-Day) OT'}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatNumber(summaries.weeklyHours, lang, 1)} {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
          </p>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
            {formatBDT(summaries.weeklyEarnings, lang)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? `মাসিক মোট (${formatMonthLabel(selectedMonth, 'bn')})`
              : `Monthly (${formatMonthLabel(selectedMonth, 'en')})`}
          </p>
          <p
            data-testid="overtime-monthly-hours"
            className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums"
          >
            {formatNumber(summaries.monthlyHours, lang, 1)} {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
          </p>
          <p
            data-testid="overtime-monthly-earnings"
            className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5"
          >
            {formatBDT(summaries.monthlyEarnings, lang)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'সর্বমোট ওভারটাইম জমা' : 'Yearly Total OT'}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatNumber(summaries.yearlyHours, lang, 1)} {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
          </p>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
            {formatBDT(summaries.yearlyEarnings, lang)}
          </p>
        </div>
      </div>

      {/* Main Split: Add/Edit Overtime Form + Monthly Overtime List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Saved Overtime Compact Card OR Add / Edit Overtime Form */}
        {isFormCollapsed && existingSameDateRecord ? (
          <div
            data-testid="overtime-saved-compact-card"
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-emerald-200/90 dark:border-emerald-800/80 rounded-2xl p-5 space-y-4 self-start shadow-xs"
          >
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm whitespace-nowrap overflow-hidden pb-2.5 border-b border-emerald-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-extrabold text-slate-900 dark:text-white truncate">
                  {lang === 'bn' ? 'ওভারটাইম সম্পূর্ণ সংরক্ষিত' : 'Overtime Saved'}
                </span>
                <span className="hidden sm:inline text-slate-500 font-normal">
                  ({formatDateReadable(date, lang)})
                </span>
              </div>
              <button
                type="button"
                data-testid="edit-saved-ot-btn"
                onClick={() => handleEditRecord(existingSameDateRecord)}
                className="min-h-[30px] px-2.5 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'এডিট করুন' : 'Edit'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block">
                  {lang === 'bn' ? 'মোট ওভারটাইম সময়' : 'Overtime Duration'}
                </span>
                <span className="mt-1 text-base font-extrabold text-slate-900 dark:text-white block tabular-nums">
                  {formatOtDuration(existingSameDateRecord.approvedHours, existingSameDateRecord.totalMinutes, lang)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {existingSameDateRecord.startTime} - {existingSameDateRecord.endTime}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                  {lang === 'bn' ? 'আনুমানিক প্রাপ্য টাকা' : 'Estimated Earnings'}
                </span>
                <span className="mt-1 text-base font-extrabold text-emerald-700 dark:text-emerald-400 block tabular-nums">
                  {formatBDT(existingSameDateRecord.estimatedEarnings, lang, true)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'হাজিরায় যুক্ত' : 'Synced to Attendance'}
                </span>
              </div>
            </div>

            {existingSameDateRecord.notes && (
              <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{lang === 'bn' ? 'নোট: ' : 'Note: '}</span>
                {existingSameDateRecord.notes}
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                {lang === 'bn' ? 'অন্য তারিখ নির্বাচন বা নতুন এন্ট্রি' : 'Select another date or add new'}
              </span>
              <button
                type="button"
                data-testid="reopen-ot-form-btn"
                onClick={() => setShowAddFormManually(true)}
                className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{lang === 'bn' ? '+ নতুন ওভারটাইম ফর্ম খুলুন' : '+ Open Form'}</span>
              </button>
            </div>
          </div>
        ) : (
          <form
            ref={editFormRef}
            id="overtime-entry-form"
            data-testid="overtime-entry-form"
            onSubmit={handleSubmit}
            className={`lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 space-y-4 self-start transition-all scroll-mt-20 ${
              editingId
                ? 'border-2 border-emerald-500 dark:border-emerald-500 ring-4 ring-emerald-500/10 shadow-sm'
                : 'border border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                {editingId && (
                  <span
                    data-testid="overtime-editing-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold mb-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>
                      {lang === 'bn'
                        ? `এডিট মোড · ${formatDateReadable(date, 'bn')}`
                        : `Editing · ${date}`}
                    </span>
                  </span>
                )}
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingId
                    ? lang === 'bn'
                      ? 'ওভারটাইম তথ্য সংশোধন করুন'
                      : 'Edit Overtime Entry'
                    : lang === 'bn'
                    ? 'নতুন ওভারটাইম যোগ করুন'
                    : 'Add Daily Overtime'}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {editingId ? (
                  <button
                    type="button"
                    data-testid="cancel-edit-overtime-btn"
                    onClick={() => {
                      setEditingId(null);
                      setApprovedHours(0);
                      setShowAddFormManually(false);
                      setFormError('');
                    }}
                    className="min-h-[34px] px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel Edit'}
                  </button>
                ) : existingSameDateRecord && showAddFormManually ? (
                  <button
                    type="button"
                    onClick={() => setShowAddFormManually(false)}
                    className="min-h-[34px] px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    {lang === 'bn' ? 'হাইড করুন' : 'Hide'}
                  </button>
                ) : null}
              </div>
            </div>

          {formError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
            >
              {formError}
            </div>
          )}

          {formSuccess && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Date Selector with Quick Previous / Today / Next Day Controls (DD/MM/YYYY format) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="ot-date-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {lang === 'bn' ? 'তারিখ (দিন/মাস/সাল)' : 'Select Date (DD/MM/YYYY)'}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isUpcomingMonth}
                  onClick={() => handleChangeDate(shiftDateString(date, -1))}
                  className="min-h-[30px] px-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-0.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'আগের দিন' : 'Prev'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeDate(todayISO)}
                  className="min-h-[30px] px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
                >
                  {lang === 'bn' ? 'আজ' : 'Today'}
                </button>
                <button
                  type="button"
                  disabled={isUpcomingMonth || shiftDateString(date, 1) > todayISO}
                  onClick={() => handleChangeDate(shiftDateString(date, 1))}
                  className="min-h-[30px] px-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-0.5"
                >
                  <span>{lang === 'bn' ? 'পরের দিন' : 'Next'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <DateInputDMY
              id="ot-date-input"
              data-testid="ot-date-input"
              value={date}
              max={todayISO}
              disabled={isUpcomingMonth}
              onChange={(val) => handleChangeDate(val)}
              lang={lang}
              required
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-semibold text-slate-900 dark:text-white"
            />

            {isFutureSelectedDate && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 font-medium">
                {lang === 'bn'
                  ? `ভবিষ্যতের তারিখ (${formatDateSlashDMY(date, 'bn')}) নির্বাচন করা হয়েছে — এই তারিখে ওভারটাইম যোগ বা এডিট করা যাবে না।`
                  : `Future date (${formatDateSlashDMY(date, 'en')}) selected — overtime cannot be added in advance.`}
              </div>
            )}

            {existingSameDateRecord && !editingId && !isEntryLocked && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex items-center justify-between gap-2">
                <p className="text-xs text-amber-900 dark:text-amber-200 font-medium leading-snug">
                  {lang === 'bn'
                    ? `এই তারিখে ইতিমধ্যে ${formatNumber(existingSameDateRecord.approvedHours, 'bn', 1)} ঘণ্টা ওভারটাইম আছে। একই তারিখে দুইবার যোগ করা যাবে না।`
                    : `Overtime (${existingSameDateRecord.approvedHours}h) already exists on this date.`}
                </p>
                <button
                  type="button"
                  onClick={() => handleEditRecord(existingSameDateRecord)}
                  className="min-h-[32px] px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 inline-flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{lang === 'bn' ? 'এডিট করুন' : 'Edit'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Hours Buttons */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {lang === 'bn'
                ? 'কত ঘণ্টা ওভারটাইম করেছেন?'
                : 'How many hours of overtime?'}
            </span>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 8].map((h) => (
                <button
                  key={h}
                  type="button"
                  disabled={isEntryLocked}
                  onClick={() => handleQuickHoursSelect(h)}
                  className={`min-h-[38px] rounded-xl text-xs font-bold border transition-colors disabled:opacity-40 ${
                    approvedHours === h
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-emerald-50'
                  }`}
                >
                  {formatNumber(h, lang)} {lang === 'bn' ? 'ঘঃ' : 'h'}
                </button>
              ))}
            </div>
          </div>

          {/* Start Time & End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ot-start-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {lang === 'bn' ? 'শুরুর সময় (অফিস টাইম)' : 'Start Time (Office)'}
              </label>
              <input
                id="ot-start-input"
                type="time"
                disabled={isEntryLocked}
                value={startTime}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  setStartTime(nextStart);
                  setEndTime(addHoursToTime(nextStart, 9 + approvedHours));
                }}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold text-slate-900 dark:text-white tabular-nums disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="ot-end-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {lang === 'bn' ? 'শেষের সময়' : 'End Time'}
              </label>
              <input
                id="ot-end-input"
                type="time"
                disabled={isEntryLocked}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold text-slate-900 dark:text-white tabular-nums disabled:opacity-50"
              />
            </div>
          </div>

          {/* Overtime Hours and Per-Hour Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ot-approved-hours"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {lang === 'bn' ? 'ওভারটাইম ঘণ্টা' : 'OT Hours'}
              </label>
              <input
                ref={hoursInputRef}
                id="ot-approved-hours"
                data-testid="ot-approved-hours-input"
                type="number"
                disabled={isEntryLocked}
                max={24}
                min={0.5}
                step="any"
                value={approvedHours > 0 ? approvedHours : ''}
                placeholder={lang === 'bn' ? 'ঘণ্টা নির্বাচন করুন' : 'Select hours'}
                onChange={(e) => {
                  const nextHrs = Number(e.target.value) || 0;
                  setApprovedHours(nextHrs);
                  if (nextHrs > 0) setFormError('');
                  setEndTime(addHoursToTime(startTime, 9 + nextHrs));
                }}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-bold text-slate-900 dark:text-white tabular-nums disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="ot-hourly-rate-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {lang === 'bn' ? 'প্রতি ঘণ্টার টাকা (৳)' : 'Rate per Hour (৳)'}
              </label>
              <input
                id="ot-hourly-rate-input"
                type="number"
                disabled={isEntryLocked}
                step="0.01"
                min={1}
                value={entryHourlyRate}
                onChange={(e) => setEntryHourlyRate(Number(e.target.value) || 0)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums disabled:opacity-50"
              />
            </div>
          </div>

          {/* Freeform Notes Input */}
          <div>
            <label
              htmlFor="ot-notes-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              {lang === 'bn' ? 'নোট (ঐচ্ছিক)' : 'Notes (Optional)'}
            </label>
            <input
              id="ot-notes-input"
              type="text"
              disabled={isEntryLocked}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'এখানে আপনার নোট লিখুন (যেমন: শিপমেন্ট ডিউটি)...'
                  : 'Enter custom notes here...'
              }
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isEntryLocked || isDateMarkedAbsent}
            data-testid="save-overtime-btn"
            className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {isEntryLocked
                ? lang === 'bn'
                  ? 'আসন্ন মাস / ভবিষ্যতের তারিখে ওভারটাইম বন্ধ'
                  : 'Locked for Future Dates'
                : isDateMarkedAbsent
                ? lang === 'bn'
                  ? 'অনুপস্থিত থাকায় ওভারটাইম বন্ধ'
                  : 'Overtime Disabled (Absent)'
                : editingId
                ? lang === 'bn'
                  ? 'পরিবর্তন সংরক্ষণ করুন'
                  : 'Update Overtime Entry'
                : lang === 'bn'
                ? 'ওভারটাইম যোগ করুন'
                : 'Save Overtime'}
            </span>
          </button>
        </form>
        )}

        {/* Right: Monthly Overtime List + Prominent Total Hours & Total Taka Summary */}
        <div
          data-testid="monthly-overtime-list-card"
          className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {listFilter === 'month'
                    ? lang === 'bn'
                      ? `${formatMonthLabel(selectedMonth, 'bn')} মাসে ওভারটাইমের তালিকা`
                      : `Overtime List (${formatMonthLabel(selectedMonth, 'en')})`
                    : lang === 'bn'
                    ? 'সকল তারিখের ওভারটাইমের তালিকা'
                    : 'All Overtime Entries'}
                </h2>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setListFilter('month')}
                  className={`min-h-[30px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    listFilter === 'month'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'bn' ? 'এই মাস' : 'This Month'}
                </button>
                <button
                  type="button"
                  onClick={() => setListFilter('all')}
                  className={`min-h-[30px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    listFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'bn'
                    ? `সব দেখুন (${formatNumber(overtime.length, 'bn')})`
                    : `All (${overtime.length})`}
                </button>
              </div>
            </div>

            {/* Prominent Summary Cards inside the Monthly List: Total Hours & Total Amount */}
            <div
              data-testid="overtime-list-totals-banner"
              className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/70"
            >
              <div>
                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 block">
                  {lang === 'bn' ? 'সর্বমোট ওভারটাইম ঘণ্টা' : 'Total Overtime Hours'}
                </span>
                <span className="mt-0.5 text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums block">
                  {formatNumber(displayedTotalHours, lang, 1)}{' '}
                  {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 block">
                  {lang === 'bn' ? 'সর্বমোট ওভারটাইম টাকা' : 'Total Overtime Amount'}
                </span>
                <span className="mt-0.5 text-lg sm:text-xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums block">
                  {formatBDT(displayedTotalEarnings, lang, true)}
                </span>
              </div>
            </div>

            {displayedRecords.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'এই মাসে কোনো ওভারটাইম রেকর্ড পাওয়া যায়নি। বাম পাশের ফর্ম থেকে নতুন ওভারটাইম যোগ করুন।'
                  : 'No overtime entries recorded for this month.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayedRecords.map((rec) => {
                  const isBeingEdited = editingId === rec.id;
                  const badgeLabel =
                    rec.totalMinutes && rec.totalMinutes % 60 !== 0
                      ? lang === 'bn'
                        ? `${formatNumber(Math.floor(rec.totalMinutes / 60), 'bn')}ঘ ${formatNumber(rec.totalMinutes % 60, 'bn')}মি`
                        : `${Math.floor(rec.totalMinutes / 60)}h ${rec.totalMinutes % 60}m`
                      : `${formatNumber(rec.approvedHours, lang, 1)}${lang === 'bn' ? ' ঘঃ' : 'h'}`;

                  return (
                    <div
                      key={rec.id}
                      data-testid={`overtime-record-card-${rec.date}`}
                      className={`rounded-2xl border p-3 sm:p-3.5 transition-all space-y-2.5 ${
                        isBeingEdited
                          ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 ring-2 ring-emerald-500/15'
                          : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-emerald-200 dark:hover:border-slate-700'
                      }`}
                    >
                      {/* Top Row: Hours Badge + Date + Duration & Shift Time */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="min-w-[40px] h-9 px-1.5 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 font-extrabold text-xs tabular-nums text-center leading-tight">
                            {badgeLabel}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-extrabold text-slate-900 dark:text-white inline-flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>{formatDateReadable(rec.date, lang)}</span>
                              </span>
                              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                ·
                              </span>
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                {formatOtDuration(rec.approvedHours, rec.totalMinutes, lang)}
                              </span>
                              {isBeingEdited && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                                  {lang === 'bn' ? 'এডিট হচ্ছে' : 'Editing'}
                                </span>
                              )}
                            </div>
                            {(rec.notes || (rec.startTime && rec.endTime)) && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {rec.startTime && rec.endTime
                                  ? lang === 'bn'
                                    ? `${toBengaliDigits(rec.startTime)} - ${toBengaliDigits(rec.endTime)}`
                                    : `${rec.startTime} - ${rec.endTime}`
                                  : ''}
                                {rec.notes && rec.startTime && rec.endTime ? ' · ' : ''}
                                {rec.notes || ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Overtime Taka on Left -> Beside it: [- / +] -> [Edit] -> [Delete] */}
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2">
                        {/* 1. Overtime Amount */}
                        <div className="min-w-0 shrink-0">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block leading-none">
                            {lang === 'bn' ? 'ওভারটাইম টাকা' : 'OT Amount'}
                          </span>
                          <span className="mt-1 text-sm font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums block leading-none">
                            {formatBDT(rec.estimatedEarnings, lang, true)}
                          </span>
                        </div>

                        {/* 2. Beside it: Plus/Minus -> Edit Icon/Button -> Delete Icon */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 shadow-2xs">
                            <button
                              type="button"
                              data-testid={`decrease-ot-record-${rec.date}`}
                              onClick={() => handleQuickAdjustRecordHours(rec, -1)}
                              disabled={rec.approvedHours <= 0.5}
                              title={lang === 'bn' ? '১ ঘণ্টা কমান' : 'Decrease 1 hr'}
                              className="w-7 h-7 rounded-lg text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                            >
                              −
                            </button>
                            <span className="px-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                              {formatNumber(rec.approvedHours, lang, 1)}
                              {lang === 'bn' ? 'ঘঃ' : 'h'}
                            </span>
                            <button
                              type="button"
                              data-testid={`increase-ot-record-${rec.date}`}
                              onClick={() => handleQuickAdjustRecordHours(rec, 1)}
                              disabled={rec.approvedHours >= 24}
                              title={lang === 'bn' ? '১ ঘণ্টা বাড়ান' : 'Increase 1 hr'}
                              className="w-7 h-7 rounded-lg text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            data-testid={`edit-ot-record-${rec.date}`}
                            onClick={() => handleEditRecord(rec)}
                            aria-label={`Edit overtime for ${rec.date}`}
                            title={lang === 'bn' ? 'এডিট করুন' : 'Edit'}
                            className={`min-h-[32px] px-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                              isBeingEdited
                                ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400'
                            }`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'এডিট' : 'Edit'}</span>
                          </button>

                          <button
                            type="button"
                            data-testid={`delete-ot-record-${rec.date}`}
                            onClick={() => deleteOvertime(rec.id)}
                            aria-label={`Delete overtime for ${rec.date}`}
                            title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                            className="min-h-[32px] min-w-[32px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-500 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {displayedRecords.length > 0 && (
            <div className="pt-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl">
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                {lang === 'bn'
                  ? `সর্বমোট ওভারটাইম: ${formatNumber(displayedTotalHours, 'bn', 1)} ঘণ্টা`
                  : `Total Overtime: ${displayedTotalHours} hrs`}
              </span>
              <span className="text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {lang === 'bn' ? 'সর্বমোট টাকা: ' : 'Total Amount: '}
                {formatBDT(displayedTotalEarnings, lang, true)}
              </span>
            </div>
          )}
        </div>
      </div>


    </div>
  );
};
