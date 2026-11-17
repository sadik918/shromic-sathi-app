import type {
  AttendanceRecord,
  AttendanceStatus,
  OvertimeRecord,
  WorkerProfile,
} from '../types';
import { getPublicHolidayForDate, roundCurrency, type MissingDateEntry } from './calculations';

export type RecentAttendanceRowStatus = AttendanceStatus | 'missing';

export interface RecentAttendanceRow {
  id: string;
  date: string; // YYYY-MM-DD
  kind: 'recorded' | 'missing';
  status: RecentAttendanceRowStatus;
  isMissingEntry: boolean;
  isAttendanceMissed: boolean;
  isBonusAffected: boolean;
  bonusMissReasonBn?: string;
  bonusMissReasonEn?: string;
  checkIn?: string;
  checkOut?: string;
  otHours: number;
  record?: AttendanceRecord;
}

export interface RecentAttendanceMissedSummary {
  missingWorkdaysCount: number;
  absentDaysCount: number;
  bonusUntickedDaysCount: number;
  bonusAffectedTotalCount: number;
  bonusAffectedDates: string[]; // newest first YYYY-MM-DD
}

export interface RecentAttendanceTableResult {
  rows: RecentAttendanceRow[];
  missedSummary: RecentAttendanceMissedSummary;
}

export type RecentAttendanceFilter = 'all' | 'missed_only';

function isFridayDate(dateStr: string): boolean {
  const dayObj = new Date(`${dateStr}T00:00:00`);
  return !Number.isNaN(dayObj.getTime()) && dayObj.getDay() === 5;
}

export function buildRecentAttendanceRows(params: {
  selectedMonth: string;
  monthAttendance: readonly AttendanceRecord[];
  overtime: readonly OvertimeRecord[];
  missingEntries: readonly MissingDateEntry[];
  profile: Partial<WorkerProfile>;
}): RecentAttendanceTableResult {
  const { selectedMonth, monthAttendance, overtime, missingEntries, profile } = params;
  const latePenaltyEnabled = Boolean(profile.latePenaltyEnabled);

  const otHoursByDate = new Map<string, number>();
  for (const ot of overtime) {
    if (!ot.date || !ot.date.startsWith(selectedMonth)) continue;
    const prev = otHoursByDate.get(ot.date) || 0;
    otHoursByDate.set(ot.date, roundCurrency(prev + (Number(ot.approvedHours) || 0)));
  }

  const recordedDates = new Set<string>();
  const rows: RecentAttendanceRow[] = [];

  for (const rec of monthAttendance) {
    if (!rec.date || !rec.date.startsWith(selectedMonth)) continue;
    recordedDates.add(rec.date);

    const otHours = otHoursByDate.get(rec.date) || 0;
    const isAbsent = rec.status === 'absent';
    const isUntickedBonus =
      (rec.status === 'present' || rec.status === 'late') && rec.hasAttendanceBonus === false;
    const isLatePenalty = latePenaltyEnabled && rec.status === 'late';
    const isBonusAffected = isAbsent || isUntickedBonus || isLatePenalty;

    let bonusMissReasonBn: string | undefined;
    let bonusMissReasonEn: string | undefined;

    if (isAbsent) {
      bonusMissReasonBn = 'অনুপস্থিত (বোনাস মিস)';
      bonusMissReasonEn = 'Absent (Bonus Missed)';
    } else if (isUntickedBonus) {
      bonusMissReasonBn = 'হাজিরা বোনাস মিস';
      bonusMissReasonEn = 'Bonus Unticked';
    } else if (isLatePenalty) {
      bonusMissReasonBn = 'দেরিতে উপস্থিতি (বোনাস প্রভাব)';
      bonusMissReasonEn = 'Late (Bonus Impact)';
    }

    rows.push({
      id: rec.id,
      date: rec.date,
      kind: 'recorded',
      status: rec.status,
      isMissingEntry: false,
      isAttendanceMissed: isAbsent,
      isBonusAffected,
      bonusMissReasonBn,
      bonusMissReasonEn,
      checkIn: rec.checkIn,
      checkOut: rec.checkOut,
      otHours,
      record: rec,
    });
  }

  // Merge unrecorded past workdays (excluding Fridays & public holidays already shown on calendar)
  for (const entry of missingEntries) {
    if (!entry.isAttendanceMissing || recordedDates.has(entry.date)) continue;
    if (!entry.date.startsWith(selectedMonth)) continue;
    if (isFridayDate(entry.date) || getPublicHolidayForDate(entry.date)) continue;

    rows.push({
      id: `missing-${entry.date}`,
      date: entry.date,
      kind: 'missing',
      status: 'missing',
      isMissingEntry: true,
      isAttendanceMissed: true,
      isBonusAffected: true,
      bonusMissReasonBn: 'হাজিরা এন্ট্রি নেই (মিসিং)',
      bonusMissReasonEn: 'Attendance Not Recorded',
      otHours: otHoursByDate.get(entry.date) ?? entry.existingOtHours ?? 0,
    });
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));

  const missingWorkdaysCount = rows.filter((r) => r.kind === 'missing').length;
  const absentDaysCount = rows.filter((r) => r.status === 'absent').length;
  const bonusUntickedDaysCount = rows.filter(
    (r) =>
      r.kind === 'recorded' &&
      r.status !== 'absent' &&
      r.isBonusAffected
  ).length;
  const bonusAffectedDates = rows.filter((r) => r.isBonusAffected).map((r) => r.date);

  return {
    rows,
    missedSummary: {
      missingWorkdaysCount,
      absentDaysCount,
      bonusUntickedDaysCount,
      bonusAffectedTotalCount: bonusAffectedDates.length,
      bonusAffectedDates,
    },
  };
}

export function filterRecentAttendanceRows(
  rows: readonly RecentAttendanceRow[],
  filter: RecentAttendanceFilter
): RecentAttendanceRow[] {
  if (filter === 'missed_only') {
    return rows.filter((r) => r.isBonusAffected || r.isAttendanceMissed);
  }
  return [...rows];
}
