import test from 'node:test';
import assert from 'node:assert/strict';
import { getInitialDemoState } from './demoData';
import {
  buildMonthlyAttendanceReport,
  buildMonthlyLeaveReport,
  buildMonthlySalaryReport,
  filterAttendanceReportRows,
  formatTime12h,
} from './reportsEngine';

test('formatTime12h formats 24h strings and handles empty values', () => {
  assert.equal(formatTime12h('08:00'), '08:00 AM');
  assert.equal(formatTime12h('17:00'), '05:00 PM');
  assert.equal(formatTime12h('20:26'), '08:26 PM');
  assert.equal(formatTime12h('00:15'), '12:15 AM');
  assert.equal(formatTime12h(''), '--:--');
});

test('buildMonthlyAttendanceReport computes exact summary & rows for populated month', () => {
  const demo = getInitialDemoState();
  const report = buildMonthlyAttendanceReport({
    month: '2026-10',
    attendance: demo.attendance,
    overtime: demo.overtime,
    profile: demo.profile,
    lang: 'bn',
    todayISO: '2026-10-31',
  });

  // Demo 2026-10 has 26 records: 17 present + 1 late = 18 working/present days
  assert.equal(report.summary.totalPresent, 18);
  assert.equal(report.summary.onTimePresent, 17);
  assert.equal(report.summary.totalLate, 1);
  assert.equal(report.summary.totalAbsent, 2);
  assert.equal(report.summary.totalApprovedLeave, 1);
  assert.equal(report.summary.totalWeeklyHolidays, 4);
  assert.equal(report.summary.totalPublicHolidays, 1);
  assert.equal(report.summary.totalWorkingDays, 20);
  assert.equal(report.summary.totalOvertimeHours, 15.43);
  assert.ok(report.summary.totalLateMinutes >= 15);
  assert.equal(report.rows.length, 26);

  // Check Oct 20 has 2h overtime merged into the row
  const oct20 = report.rows.find((r) => r.date === '2026-10-20');
  assert.ok(oct20);
  assert.equal(oct20.otHours, 2);
  assert.equal(oct20.inTimeDisplay, '07:55 AM');
  assert.equal(oct20.outTimeDisplay, '07:00 PM');

  // Check filtering works cleanly
  assert.equal(filterAttendanceReportRows(report.rows, 'absent').length, 2);
  assert.equal(filterAttendanceReportRows(report.rows, 'late').length, 1);
  assert.equal(filterAttendanceReportRows(report.rows, 'holiday').length, 5);
});

test('buildMonthlyAttendanceReport handles empty month cleanly with zero counts', () => {
  const demo = getInitialDemoState();
  const report = buildMonthlyAttendanceReport({
    month: '2026-12',
    attendance: demo.attendance,
    overtime: demo.overtime,
    profile: demo.profile,
    lang: 'bn',
    todayISO: '2026-12-15',
  });

  assert.equal(report.summary.totalPresent, 0);
  assert.equal(report.summary.totalAbsent, 0);
  assert.equal(report.summary.totalOvertimeHours, 0);
  assert.equal(report.rows.length, 0);
});

test('buildMonthlyLeaveReport and buildMonthlySalaryReport compute accurate balances', () => {
  const demo = getInitialDemoState();
  const leaveRep = buildMonthlyLeaveReport({
    month: '2026-10',
    attendance: demo.attendance,
    lang: 'bn',
  });

  assert.equal(leaveRep.monthlySummary.approvedLeaveDays, 1);
  assert.equal(leaveRep.monthlySummary.sickUsedInMonth, 1);
  assert.equal(leaveRep.annualSummary.sickRemaining, 13);
  assert.equal(leaveRep.annualSummary.casualRemaining, 9);
  assert.equal(leaveRep.annualSummary.earnedAccruedEst, 1);
  assert.equal(leaveRep.rows.length, 8); // 1 leave + 4 weekly + 1 public + 2 absent

  const salaryRep = buildMonthlySalaryReport({
    month: '2026-10',
    profile: demo.profile,
    attendance: demo.attendance,
    overtime: demo.overtime,
    salaryRecords: demo.salaryRecords,
    payments: demo.payments,
  });

  assert.equal(salaryRep.workedDays, 18);
  assert.equal(salaryRep.absentDays, 2);
  assert.equal(salaryRep.overtimeHours, 15.43);
  assert.equal(salaryRep.totalReceived, 9500);
  assert.ok(salaryRep.estimatedNetPayable > 0);
  assert.equal(salaryRep.payments.length, 1);
});
