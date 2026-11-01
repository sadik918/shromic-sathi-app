import React, { useState } from 'react';
import { AlertCircle, Check, Clock, CalendarCheck, Sparkles, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { AttendanceStatus } from '../types';
import {
  getMissingRecordsForMonth,
  getEffectiveHourlyOtRate,
  calculateOvertimeEstimate,
  resolveWorkerShiftForDate,
} from '../utils/calculations';
import { formatDateReadable } from '../utils/i18n';

interface MissingRecordsSectionProps {
  onSelectDate?: (dateStr: string) => void;
  className?: string;
}

const ATTENDANCE_DROPDOWN_OPTIONS: Array<{ value: AttendanceStatus; labelBn: string; labelEn: string }> = [
  { value: 'present', labelBn: 'উপস্থিত', labelEn: 'Present' },
  { value: 'absent', labelBn: 'অনুপস্থিত', labelEn: 'Absent' },
  { value: 'approved_leave', labelBn: 'অনুমোদিত ছুটি', labelEn: 'Leave' },
  { value: 'weekly_holiday', labelBn: 'সাপ্তাহিক ছুটি', labelEn: 'Weekly Off' },
  { value: 'public_holiday', labelBn: 'সরকারি ছুটি', labelEn: 'Govt Holiday' },
];

export const MissingRecordsSection: React.FC<MissingRecordsSectionProps> = ({
  onSelectDate,
  className = '',
}) => {
  const {
    profile,
    lang,
    todayISO,
    selectedMonth,
    attendance,
    overtime,
    saveAttendance,
    saveOvertime,
  } = useData();

  const [isExpanded, setIsExpanded] = useState(false);

  // Per-date state for quick inline fill
  const [formState, setFormState] = useState<
    Record<
      string,
      {
        status: AttendanceStatus;
        otHours: number;
        hasBonus: boolean;
      }
    >
  >({});

  const [savedNotice, setSavedNotice] = useState('');

  const missingEntries = getMissingRecordsForMonth(
    selectedMonth,
    attendance,
    overtime,
    profile.joiningDate,
    todayISO
  );

  if (missingEntries.length === 0) {
    return null;
  }

  const getItemState = (dateStr: string) => {
    return (
      formState[dateStr] || {
        status: 'present',
        otHours: 2,
        hasBonus: true,
      }
    );
  };

  const updateItemState = (
    dateStr: string,
    updates: Partial<{ status: AttendanceStatus; otHours: number; hasBonus: boolean }>
  ) => {
    setFormState((prev) => ({
      ...prev,
      [dateStr]: {
        ...getItemState(dateStr),
        ...updates,
      },
    }));
  };

  const handleSaveItem = async (dateStr: string, isAttMissing: boolean, isOtMissing: boolean) => {
    const item = getItemState(dateStr);

    // Save attendance if missing or changed
    await saveAttendance({
      date: dateStr,
      month: dateStr.slice(0, 7),
      status: item.status,
      leaveCategory: item.status === 'approved_leave' ? 'casual' : 'none',
      checkIn: item.status === 'present' || item.status === 'late' ? '08:00' : '',
      checkOut: item.status === 'present' || item.status === 'late' ? '17:00' : '',
      hasAttendanceBonus: item.status === 'present' || item.status === 'late' ? item.hasBonus : undefined,
      notes: lang === 'bn' ? 'মিসিং রেকর্ড হতে সংরক্ষিত' : 'Saved from missing records',
    });

    // Save overtime if hours > 0 or if overtime was missing
    if (item.otHours > 0 || isOtMissing) {
      const activeRate = getEffectiveHourlyOtRate(profile);
      const wageBase = profile.otWageBase === 'gross' ? profile.grossSalary : profile.basicSalary;
      const computed = calculateOvertimeEstimate(
        wageBase,
        profile.otDivisor || 208,
        profile.otMultiplier || 2,
        item.otHours,
        activeRate
      );
      const shiftInfo = resolveWorkerShiftForDate(profile, dateStr, item.otHours);

      await saveOvertime({
        date: dateStr,
        month: dateStr.slice(0, 7),
        startTime: shiftInfo.officeStartTime,
        endTime: shiftInfo.defaultEndTime,
        breakMinutes: 0,
        totalMinutes: Math.round(item.otHours * 60),
        approvedHours: item.otHours,
        basicSalarySnapshot: wageBase,
        divisorSnapshot: profile.otDivisor || 208,
        multiplierSnapshot: profile.otMultiplier || 2,
        hourlyRateSnapshot: computed.hourlyRate,
        estimatedEarnings: computed.estimatedEarnings,
        notes: lang === 'bn' ? 'মিসিং রেকর্ড হতে যোগকৃত' : 'Added from missing records',
      });
    }

    setSavedNotice(
      lang === 'bn'
        ? `${formatDateReadable(dateStr, 'bn')} তারিখের তথ্য সফলভাবে জমা হয়েছে!`
        : `Record saved for ${dateStr}`
    );
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const displayEntries = isExpanded ? missingEntries : missingEntries.slice(0, 3);
  const remainingCount = missingEntries.length - 3;

  return (
    <section
      data-testid="missing-records-section"
      className={`p-4 sm:p-5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-3.5 shadow-2xs ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold shadow-2xs">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
              <span>{lang === 'bn' ? 'মিসিং রেকর্ড' : 'Missing Records'}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-xs font-extrabold tabular-nums">
                {missingEntries.length}
              </span>
            </h2>
          </div>
        </div>
      </div>

      {savedNotice && (
        <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Missing Items List */}
      <div className="space-y-3">
        {displayEntries.map((entry) => {
          const state = getItemState(entry.date);

          return (
            <div
              key={entry.date}
              data-testid={`missing-item-${entry.date}`}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 space-y-3 shadow-2xs"
            >
              {/* Date, Badges & Edit Link Row (Strictly 1 Line on Mobile) */}
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <CalendarCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    {formatDateReadable(entry.date, lang)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {entry.isAttendanceMissing && (
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 text-[10px] sm:text-[11px] font-bold shrink-0">
                        {lang === 'bn' ? 'হাজিরা' : 'Att'}
                      </span>
                    )}
                    {entry.isOvertimeMissing && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 text-[10px] sm:text-[11px] font-bold shrink-0">
                        {lang === 'bn' ? 'ওভারটাইম' : 'OT'}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectDate?.(entry.date)}
                  className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold shrink-0 inline-flex items-center gap-1 border border-emerald-200/80 dark:border-emerald-800 transition-colors"
                  title={lang === 'bn' ? 'ভিতরে গিয়ে বিস্তারিত লিখুন' : 'Edit details in main view'}
                >
                  <span>{lang === 'bn' ? 'ভিতরে যান' : 'Edit'}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {/* Inline Controls: Attendance Dropdown + Overtime Buttons + Save Button */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 items-center">
                {/* Attendance Status Dropdown */}
                <div className="sm:col-span-5 flex items-center gap-1.5">
                  <label htmlFor={`att-drop-${entry.date}`} className="text-[11px] font-bold text-slate-600 dark:text-slate-400 shrink-0">
                    {lang === 'bn' ? 'হাজিরা:' : 'Status:'}
                  </label>
                  <select
                    id={`att-drop-${entry.date}`}
                    value={state.status}
                    onChange={(e) => {
                      const nextSt = e.target.value as AttendanceStatus;
                      let autoBonus = true;
                      if (nextSt === 'late' || nextSt === 'absent') {
                        autoBonus = false;
                      }
                      updateItemState(entry.date, {
                        status: nextSt,
                        hasBonus: autoBonus,
                        otHours: nextSt === 'present' || nextSt === 'late' ? state.otHours : 0,
                      });
                    }}
                    className="w-full min-h-[36px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {ATTENDANCE_DROPDOWN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {lang === 'bn' ? opt.labelBn : opt.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Overtime OT Select Buttons & Bonus Checkbox */}
                <div className="sm:col-span-4 flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                  {state.status === 'present' || state.status === 'late' ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 shrink-0 mr-0.5">
                        {lang === 'bn' ? 'ওটি:' : 'OT:'}
                      </span>
                      {[0, 1, 2, 3, 4].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => updateItemState(entry.date, { otHours: h })}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold tabular-nums transition-colors cursor-pointer ${
                            state.otHours === h
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-100'
                          }`}
                        >
                          {h === 0
                            ? lang === 'bn'
                              ? '০ঘঃ'
                              : '0h'
                            : `${h}${lang === 'bn' ? 'ঘঃ' : 'h'}`}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {state.status === 'absent'
                        ? lang === 'bn' ? 'অনুপস্থিতিতে ওটি নেই' : 'No OT on absent'
                        : lang === 'bn' ? 'ছুটিতে ওটি প্রযোজ্য নয়' : 'No OT on leave'}
                    </span>
                  )}

                  {/* Bonus Toggle Checkbox */}
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={state.hasBonus !== false}
                      onChange={(e) => updateItemState(entry.date, { hasBonus: e.target.checked })}
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                    />
                    <span>{lang === 'bn' ? 'বোনাস' : 'Bonus'}</span>
                  </label>
                </div>

                {/* Save Action */}
                <div className="sm:col-span-3 flex items-center justify-end w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveItem(entry.date, entry.isAttendanceMissing, entry.isOvertimeMissing)
                    }
                    className="min-h-[36px] px-3.5 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1 w-full sm:w-auto transition-colors shadow-2xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'সংরক্ষণ' : 'Save'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline See More / C More Toggle */}
      {missingEntries.length > 3 && (
        <div className="pt-1 text-center">
          <button
            type="button"
            data-testid="missing-records-see-more-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-100/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 text-amber-700" />
                <span>{lang === 'bn' ? 'কমিয়ে আনুন' : 'Show Less'}</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-amber-700" />
                <span>
                  {lang === 'bn'
                    ? `সি মোর (আরও ${remainingCount}টি তারিখ দেখুন)`
                    : `See More (${remainingCount} more)`}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
};
