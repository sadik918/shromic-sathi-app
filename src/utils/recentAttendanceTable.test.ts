import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecentAttendanceRows,
  filterRecentAttendanceRows,
} from './recentAttendanceTable';
import type { AttendanceRecord, OvertimeRecord } from '../types';
import type { MissingDateEntry } from './calculations';

test('buildRecentAttendanceRows merges recorded entries and missing workdays while ignoring Friday/holiday auto-offs', () => {
  const monthAttendance: AttendanceRecord[] = [
    {
      id: 'att-1',
      userId: 'u1',
      date: '2026-11-15',
      month: '2026-11',
      status: 'present',
      leaveCategory: 'none',
      checkIn: '08:00',
      checkOut: '17:00',
      notes: '',
      hasAttendanceBonus: true,
    },
    {
      id: 'att-2',
      userId: 'u1',
      date: '2026-11-11',
      month: '2026-11',
      status: 'absent',
      leaveCategory: 'none',
      checkIn: '',
      checkOut: '',
      notes: '',
    },
    {
      id: 'att-3',
      userId: 'u1',
      date: '2026-11-09',
      month: '2026-11',
      status: 'present',
      leaveCategory: 'none',
      checkIn: '08:15',
      checkOut: '17:00',
      notes: '',
      hasAttendanceBonus: false,
    },
  ];

  // 2026-11-13 is Friday (excluded from missing workday alert)
  // 2026-11-07 is a public holiday in BANGLADESH_PUBLIC_HOLIDAYS (excluded)
  // 2026-11-12 is Thursday (regular workday -> included as missing)
  const missingEntries: MissingDateEntry[] = [
    { date: '2026-11-13', isAttendanceMissing: true, isOvertimeMissing: true },
    { date: '2026-11-12', isAttendanceMissing: true, isOvertimeMissing: true },
    { date: '2026-11-07', isAttendanceMissing: true, isOvertimeMissing: true },
  ];

  const overtime: OvertimeRecord[] = [
    {
      id: 'ot-1',
      userId: 'u1',
      date: '2026-11-15',
      month: '2026-11',
      startTime: '17:00',
      endTime: '19:00',
      breakMinutes: 0,
      totalMinutes: 120,
      approvedHours: 2,
      basicSalarySnapshot: 8000,
      divisorSnapshot: 208,
      multiplierSnapshot: 2,
      hourlyRateSnapshot: 76.92,
      estimatedEarnings: 153.84,
      notes: '',
    },
  ];

  const result = buildRecentAttendanceRows({
    selectedMonth: '2026-11',
    monthAttendance,
    overtime,
    missingEntries,
    profile: { latePenaltyEnabled: false },
  });

  assert.deepEqual(
    result.rows.map((r) => ({ date: r.date, status: r.status, bonusAffected: r.isBonusAffected })),
    [
      { date: '2026-11-15', status: 'present', bonusAffected: false },
      { date: '2026-11-12', status: 'missing', bonusAffected: true },
      { date: '2026-11-11', status: 'absent', bonusAffected: true },
      { date: '2026-11-09', status: 'present', bonusAffected: true },
    ]
  );

  assert.equal(result.rows[0].otHours, 2);
  assert.equal(result.missedSummary.missingWorkdaysCount, 1);
  assert.equal(result.missedSummary.absentDaysCount, 1);
  assert.equal(result.missedSummary.bonusUntickedDaysCount, 1);
  assert.equal(result.missedSummary.bonusAffectedTotalCount, 3);
  assert.deepEqual(result.missedSummary.bonusAffectedDates, [
    '2026-11-12',
    '2026-11-11',
    '2026-11-09',
  ]);
});

test('filterRecentAttendanceRows filters down to missed/absent/bonus-affected rows when missed_only is active', () => {
  const result = buildRecentAttendanceRows({
    selectedMonth: '2026-11',
    monthAttendance: [
      {
        id: 'a1',
        userId: 'u1',
        date: '2026-11-14',
        month: '2026-11',
        status: 'present',
        leaveCategory: 'none',
        checkIn: '08:00',
        checkOut: '17:00',
        notes: '',
        hasAttendanceBonus: true,
      },
      {
        id: 'a2',
        userId: 'u1',
        date: '2026-11-10',
        month: '2026-11',
        status: 'late',
        leaveCategory: 'none',
        checkIn: '08:30',
        checkOut: '17:00',
        notes: '',
      },
    ],
    overtime: [],
    missingEntries: [
      { date: '2026-11-12', isAttendanceMissing: true, isOvertimeMissing: true },
    ],
    profile: { latePenaltyEnabled: true },
  });

  const allRows = filterRecentAttendanceRows(result.rows, 'all');
  const missedOnly = filterRecentAttendanceRows(result.rows, 'missed_only');

  assert.equal(allRows.length, 3);
  assert.deepEqual(
    missedOnly.map((r) => r.date),
    ['2026-11-12', '2026-11-10']
  );
});
