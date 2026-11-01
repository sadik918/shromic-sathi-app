import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addHoursToTime,
  calculateDurationMinutes,
  calculateOvertimeEstimate,
  calculateSalaryTotals,
  calculateSmartSalaryComparison,
  deriveBangladeshRMGBreakdownFromGross,
  DUTY_SHIFTS,
  evaluateBudgetAlert,
  formatBDT,
  formatPhoneForCall,
  formatWhatsAppUrl,
  getEffectiveHourlyOtRate,
  getMissingRecordsForMonth,
  getPreviousMonth,
  getPublicHolidayForDate,
  getPublicHolidaysForMonth,
  getDefaultDateForMonth,
  hasDuplicateOvertimeDate,
  isDailyQuickEntryCompleted,
  isFutureDate,
  isFutureMonth,
  isValidBangladeshiPhone,
  mergeBackupRecordsNonDestructive,
  normalizePhoneNumber,
  parseBengaliVoiceEntryLocal,
  resolveWorkerShiftForDate,
  shouldShowQuickDailyActions,
  summarizeAttendanceForMonth,
  summarizeMonthlyPayments,
  summarizeOvertimeRecords,
  summarizePersonalFinances,
  summarizePersonalLoans,
  validateVaultFile,
  VERIFIED_WORKER_HELPLINES,
  getAttendanceBonusWindowForShift,
  computeWorkplaceTenureAnalytics,
  buildJobTransitionArchive,
  computeNextSavingsDueDate,
  getRecentMonthsList,
  computeDailyEarnedSalary,
  calculateAttendanceBonusEligibility,
} from './calculations';
import { formatDateSlashDMY } from './i18n';
import type {
  AttendanceRecord,
  OvertimeRecord,
  SalaryPayment,
  ExpenseRecord,
  SavingsGoal,
  PersonalLoan,
  WorkerProfile,
} from '../types';

test('Bangladesh Minimum Wage Grade 4 breakdown (12,500 BDT Gross -> 6,700 Basic)', () => {
  const breakdown = deriveBangladeshRMGBreakdownFromGross(12500);
  assert.equal(breakdown.basicSalary, 6700);
  assert.equal(breakdown.houseRentAllowance, 3350);
  assert.equal(breakdown.medicalAllowance, 750);
  assert.equal(breakdown.transportAllowance, 450);
  assert.equal(breakdown.foodAllowance, 1250);
  const sum =
    breakdown.basicSalary +
    breakdown.houseRentAllowance +
    breakdown.medicalAllowance +
    breakdown.transportAllowance +
    breakdown.foodAllowance;
  assert.equal(sum, 12500);
});

test('Overtime calculation follows Bangladesh Labor Law ((Basic / 208) * 2 * Hours) or custom manual rate', () => {
  // For Basic = 6,700 BDT: hourly OT rate = (6700 / 208) * 2 = 64.42307... -> 64.42 BDT
  const res = calculateOvertimeEstimate(6700, 208, 2, 2);
  assert.equal(res.hourlyRate, 64.42);
  assert.equal(res.estimatedEarnings, 128.85);

  // Manual hourly rate override (e.g. 100 BDT/hour for 5 hours = 500 BDT)
  const manualRes = calculateOvertimeEstimate(6700, 208, 2, 5, 100);
  assert.equal(manualRes.hourlyRate, 100);
  assert.equal(manualRes.estimatedEarnings, 500);

  assert.equal(
    getEffectiveHourlyOtRate({
      basicSalary: 6700,
      otCalculationMode: 'manual',
      otCustomHourlyRate: 85,
      otDivisor: 208,
      otMultiplier: 2,
    } as any),
    85
  );
  assert.equal(
    getEffectiveHourlyOtRate({
      basicSalary: 6700,
      otCalculationMode: 'formula',
      otCustomHourlyRate: 85,
      otDivisor: 208,
      otMultiplier: 2,
    } as any),
    64.42
  );
});

test('Bangladesh Public Holidays lookup returns official and festival holidays for month and date', () => {
  const octHolidays = getPublicHolidaysForMonth('2026-10');
  assert.equal(octHolidays.length >= 1, true);
  const durgaPuja = getPublicHolidayForDate('2026-10-21');
  assert.equal(durgaPuja?.titleBn, 'শারদীয় দুর্গাপূজা (বিজয়া দশমী - সরকারি ছুটি)');
});

test('Duration calculation validates time boundaries, breaks, and overnight shifts', () => {
  const normal = calculateDurationMinutes('17:00', '19:30', 30);
  assert.equal(normal.valid, true);
  assert.equal(normal.totalMinutes, 120);
  assert.equal(normal.calculatedHours, 2);

  const overnight = calculateDurationMinutes('22:00', '01:00', 0);
  assert.equal(overnight.valid, true);
  assert.equal(overnight.totalMinutes, 180);
  assert.equal(overnight.calculatedHours, 3);

  const invalidBreak = calculateDurationMinutes('17:00', '18:00', 90);
  assert.equal(invalidBreak.valid, false);
  assert.equal(invalidBreak.error, 'BREAK_EXCEEDS_DURATION');
});

test('Duplicate overtime date detection identifies existing entries on the same date', () => {
  const records: OvertimeRecord[] = [
    {
      id: 'ot_1',
      userId: 'u1',
      date: '2026-10-25',
      month: '2026-10',
      startTime: '17:00',
      endTime: '19:00',
      breakMinutes: 0,
      totalMinutes: 120,
      approvedHours: 2,
      basicSalarySnapshot: 6700,
      divisorSnapshot: 208,
      multiplierSnapshot: 2,
      hourlyRateSnapshot: 64.42,
      estimatedEarnings: 128.85,
      notes: '',
    },
  ];
  assert.equal(hasDuplicateOvertimeDate(records, '2026-10-25'), true);
  assert.equal(hasDuplicateOvertimeDate(records, '2026-10-25', 'ot_1'), false);
  assert.equal(hasDuplicateOvertimeDate(records, '2026-10-26'), false);
});

test('Monthly salary statement and partial payment tracking computes accurate balances', () => {
  const totals = calculateSalaryTotals({
    basicSalary: 6700,
    houseRentAllowance: 3350,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
    attendanceBonus: 500,
    overtimeEarnings: 2576.92,
    festivalBonus: 0,
    otherAllowances: 0,
    advanceDeduction: 1000,
    absenceDeduction: 0,
    otherDeductions: 0,
    adjustments: 0,
  });

  assert.equal(totals.baseGross, 12500);
  assert.equal(totals.estimatedGross, 15576.92);
  assert.equal(totals.estimatedNetPayable, 14576.92);

  const payments: SalaryPayment[] = [
    {
      id: 'pay_1',
      userId: 'u1',
      month: '2026-10',
      paymentDate: '2026-10-10',
      amountReceived: 10000,
      paymentMethod: 'bkash',
      isPartial: true,
      referenceNote: 'প্রথম কিস্তি',
    },
  ];

  const summary = summarizeMonthlyPayments(totals.estimatedNetPayable, payments);
  assert.equal(summary.totalReceived, 10000);
  assert.equal(summary.outstandingBalance, 4576.92);
  assert.equal(summary.status, 'partial');
});

test('Attendance summary tracks working days and leave balances without automatic salary deduction', () => {
  const records: AttendanceRecord[] = [
    { id: 'a1', userId: 'u1', date: '2026-10-01', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '08:00', checkOut: '17:00', notes: '' },
    { id: 'a2', userId: 'u1', date: '2026-10-02', month: '2026-10', status: 'weekly_holiday', leaveCategory: 'none', checkIn: '', checkOut: '', notes: 'শুক্রবার' },
    { id: 'a3', userId: 'u1', date: '2026-10-03', month: '2026-10', status: 'approved_leave', leaveCategory: 'sick', checkIn: '', checkOut: '', notes: 'জ্বর' },
    { id: 'a4', userId: 'u1', date: '2026-10-04', month: '2026-10', status: 'absent', leaveCategory: 'none', checkIn: '', checkOut: '', notes: '' },
  ];

  const summary = summarizeAttendanceForMonth(records);
  assert.equal(summary.workingDays, 1);
  assert.equal(summary.weeklyHolidays, 1);
  assert.equal(summary.approvedLeaveDays, 1);
  assert.equal(summary.absentDays, 1);
  assert.equal(summary.sickLeaveRemaining, 13);
});

test('Personal finance summary keeps expenses separate from factory salary calculation', () => {
  const payments: SalaryPayment[] = [
    { id: 'p1', userId: 'u1', month: '2026-10', paymentDate: '2026-10-07', amountReceived: 14500, paymentMethod: 'bkash', isPartial: false, referenceNote: '' },
  ];
  const expenses: ExpenseRecord[] = [
    { id: 'e1', userId: 'u1', date: '2026-10-08', month: '2026-10', category: 'rent', amount: 4500, description: 'বাসা ভাড়া' },
    { id: 'e2', userId: 'u1', date: '2026-10-09', month: '2026-10', category: 'food', amount: 3000, description: 'মাসিক বাজার' },
  ];
  const savings: SavingsGoal[] = [
    { id: 's1', userId: 'u1', title: 'জরুরি তহবিল', targetAmount: 20000, savedAmount: 5000, monthlyBudget: 10000, deadline: '2027-06-01', notes: '' },
  ];

  const fin = summarizePersonalFinances(payments, expenses, savings);
  assert.equal(fin.actualIncome, 14500);
  assert.equal(fin.totalExpenses, 7500);
  assert.equal(fin.remainingBalance, 7000);
  assert.equal(fin.byCategory.rent, 4500);
  assert.equal(fin.byCategory.food, 3000);
});

test('Bengali voice entry parser extracts overtime, expenses, and payments accurately', () => {
  const ot = parseBengaliVoiceEntryLocal('আজ ৩ ঘণ্টা ওভারটাইম করেছি', '2026-10-26');
  assert.equal(ot.entryType, 'overtime');
  assert.equal(ot.amountOrHours, 3);

  const exp = parseBengaliVoiceEntryLocal('খাবার খরচ ২৫০ টাকা', '2026-10-26');
  assert.equal(exp.entryType, 'expense');
  assert.equal(exp.amountOrHours, 250);
  assert.equal(exp.categoryOrStatus, 'food');

  const pay = parseBengaliVoiceEntryLocal('বেতন পেয়েছি ১২৫০০ টাকা বিকাশে', '2026-10-26');
  assert.equal(pay.entryType, 'payment');
  assert.equal(pay.amountOrHours, 12500);
  assert.equal(pay.categoryOrStatus, 'bkash');
});

test('Non-destructive backup merge never overwrites existing records', () => {
  const existing = [{ id: 'rec_1', val: 'original' }];
  const incoming = [
    { id: 'rec_1', val: 'attempted_overwrite' },
    { id: 'rec_2', val: 'new_record' },
  ];
  const res = mergeBackupRecordsNonDestructive(existing, incoming);
  assert.equal(res.addedCount, 1);
  assert.equal(res.skippedCount, 1);
  assert.equal(res.merged.length, 2);
  assert.equal(res.merged[0].val, 'original');
  assert.equal(res.merged[1].val, 'new_record');
});

test('Document vault file validation enforces allowed MIME types and size limits', () => {
  assert.equal(validateVaultFile('payslip.pdf', 'application/pdf', 120000).valid, true);
  assert.equal(validateVaultFile('script.exe', 'application/x-msdownload', 1000).valid, false);
  assert.equal(validateVaultFile('huge.png', 'image/png', 900000).valid, false);
});

test('Currency formatter renders Bengali and English BDT strings', () => {
  assert.equal(formatBDT(12500, 'bn'), '৳ ১২,৫০০');
  assert.equal(formatBDT(12500, 'en'), '৳ 12,500');
});

test('Smart salary comparison and previous month helper compute accurate trends and attendance bonus eligibility', () => {
  assert.equal(getPreviousMonth('2026-10'), '2026-09');
  assert.equal(getPreviousMonth('2026-01'), '2025-12');

  const cmp = calculateSmartSalaryComparison({
    currentMonthNet: 14132.7,
    previousMonthNet: 14293.75,
    currentOtHours: 16,
    previousOtHours: 18.5,
    currentOtEarnings: 1030.72,
    previousOtEarnings: 1191.77,
    absentDays: 0,
    lateDays: 1,
    attendanceBonusAmount: 600,
  });
  assert.equal(cmp.netDiff, -161.05);
  assert.equal(cmp.otHoursDiff, -2.5);
  assert.equal(cmp.attendanceBonusSafe, true);
  assert.equal(cmp.insightBn.includes('পূর্ণ হাজিরা বোনাস'), true);
});

test('Budget alert evaluator flags safe, 80% warning, and 100% exceeded states accurately', () => {
  const safe = evaluateBudgetAlert(6500, 9000);
  assert.equal(safe.status, 'safe');
  assert.equal(safe.remainingBudget, 2500);

  const warn = evaluateBudgetAlert(7500, 9000);
  assert.equal(warn.status, 'warning');
  assert.equal(warn.usagePercent, 83);

  const exceeded = evaluateBudgetAlert(9500, 9000);
  assert.equal(exceeded.status, 'exceeded');
  assert.equal(exceeded.exceededBy, 500);
});

test('Personal loan summary, duty shifts, and verified worker helplines are properly structured', () => {
  const loans: PersonalLoan[] = [
    {
      id: 'l1',
      userId: 'u1',
      personName: 'কারখানা অগ্রিম',
      direction: 'borrowed',
      originalAmount: 3000,
      transactionDate: '2026-10-01',
      status: 'pending',
      title: 'কারখানা অগ্রিম',
      lenderType: 'factory_advance',
      totalLoanAmount: 3000,
      paidAmount: 2000,
      monthlyInstallment: 1000,
      nextDueDate: '2026-11-07',
      notes: '',
    },
    {
      id: 'l2',
      userId: 'u1',
      personName: 'সমিতি ঋণ',
      direction: 'borrowed',
      originalAmount: 10000,
      transactionDate: '2026-10-01',
      status: 'pending',
      title: 'সমিতি ঋণ',
      lenderType: 'cooperative',
      totalLoanAmount: 10000,
      paidAmount: 6000,
      monthlyInstallment: 1000,
      nextDueDate: '2026-11-15',
      notes: '',
    },
  ];
  const summary = summarizePersonalLoans(loans);
  assert.equal(summary.totalBorrowed, 13000);
  assert.equal(summary.totalPaid, 8000);
  assert.equal(summary.totalRemaining, 5000);
  assert.equal(summary.monthlyInstallmentTotal, 2000);
  assert.equal(summary.activeLoansCount, 2);

  assert.equal(DUTY_SHIFTS.length, 4);
  assert.equal(VERIFIED_WORKER_HELPLINES.some((h) => h.numberEn === '16357'), true);
});

test('Worker shift resolution supports Day Shift (08:00), Night Shift (20:00), and Weekly Alternating Rotation', () => {
  assert.equal(addHoursToTime('08:00', 11), '19:00');
  assert.equal(addHoursToTime('20:00', 11), '07:00');

  const dayShift = resolveWorkerShiftForDate(
    { shiftPattern: 'day', dayShiftStartTime: '08:00', nightShiftStartTime: '20:00' },
    '2026-10-26',
    2
  );
  assert.equal(dayShift.activeShift, 'day');
  assert.equal(dayShift.officeStartTime, '08:00');
  assert.equal(dayShift.defaultEndTime, '19:00');

  const nightShift = resolveWorkerShiftForDate(
    { shiftPattern: 'night', dayShiftStartTime: '08:00', nightShiftStartTime: '20:00' },
    '2026-10-26',
    2
  );
  assert.equal(nightShift.activeShift, 'night');
  assert.equal(nightShift.officeStartTime, '20:00');
  assert.equal(nightShift.defaultEndTime, '07:00');

  // Weekly rotation starting 2026-10-01:
  // Week 0 (2026-10-03) -> Day shift ('08:00')
  // Week 1 (2026-10-10) -> Night shift ('20:00')
  const rotWeek0 = resolveWorkerShiftForDate(
    {
      shiftPattern: 'weekly_rotation',
      dayShiftStartTime: '08:00',
      nightShiftStartTime: '20:00',
      rotationStartDate: '2026-10-01',
    },
    '2026-10-03',
    2
  );
  assert.equal(rotWeek0.activeShift, 'day');
  assert.equal(rotWeek0.officeStartTime, '08:00');

  const rotWeek1 = resolveWorkerShiftForDate(
    {
      shiftPattern: 'weekly_rotation',
      dayShiftStartTime: '08:00',
      nightShiftStartTime: '20:00',
      rotationStartDate: '2026-10-01',
    },
    '2026-10-10',
    2
  );
  assert.equal(rotWeek1.activeShift, 'night');
  assert.equal(rotWeek1.officeStartTime, '20:00');
});

test('Bangladeshi phone validation and WhatsApp URL generation', () => {
  // Valid numbers
  assert.equal(isValidBangladeshiPhone('01711223344'), true);
  assert.equal(isValidBangladeshiPhone('+8801819334455'), true);
  assert.equal(isValidBangladeshiPhone('8801912889900'), true);
  assert.equal(isValidBangladeshiPhone('০১৭১১-২২৩৩৪৪'), true); // Bengali digits with dash
  assert.equal(isValidBangladeshiPhone('999'), true); // Emergency hotline
  assert.equal(isValidBangladeshiPhone('16430'), true); // Legal aid hotline

  // Invalid numbers
  assert.equal(isValidBangladeshiPhone('123'), false); // Random 3 digits not hotline
  assert.equal(isValidBangladeshiPhone('02711223344'), false); // Starts with 02 (not mobile 013-019)
  assert.equal(isValidBangladeshiPhone(''), false);

  // Call format
  assert.equal(formatPhoneForCall('01711-223344'), 'tel:01711223344');
  assert.equal(formatPhoneForCall('০১৭১১-২২৩৩৪৪'), 'tel:01711223344');

  // WhatsApp formatting
  assert.equal(formatWhatsAppUrl('01711-223344'), 'https://wa.me/8801711223344');
  assert.equal(formatWhatsAppUrl('+8801819-334455'), 'https://wa.me/8801819334455');
  assert.equal(formatWhatsAppUrl('০১৭১১২২৩৩৪৪', 'সালাম'), 'https://wa.me/8801711223344?text=%E0%A6%B8%E0%A6%BE%E0%A6%B2%E0%A6%BE%E0%A6%AE');
});

test('Missing attendance and overtime records detection and General shift resolution', () => {
  const genShift = resolveWorkerShiftForDate({ shiftPattern: 'general' }, '2026-10-26');
  assert.equal(genShift.activeShift, 'general');
  assert.equal(genShift.officeStartTime, '08:00');

  const missing = getMissingRecordsForMonth(
    '2026-10',
    [
      { id: 'a1', userId: 'u1', date: '2026-10-01', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '08:00', checkOut: '17:00', notes: '' },
    ],
    [
      { id: 'o1', userId: 'u1', date: '2026-10-01', month: '2026-10', startTime: '08:00', endTime: '19:00', breakMinutes: 0, totalMinutes: 120, approvedHours: 2, basicSalarySnapshot: 6700, divisorSnapshot: 208, multiplierSnapshot: 2, hourlyRateSnapshot: 64.42, estimatedEarnings: 128.84, notes: '' },
    ],
    '2026-10-01',
    '2026-10-03'
  );

  // Oct 1 is present & has OT => not missing.
  // Oct 2 and Oct 3 are missing!
  assert.equal(missing.some((m) => m.date === '2026-10-01'), false);
  assert.equal(missing.some((m) => m.date === '2026-10-02'), true);
  assert.equal(missing.some((m) => m.date === '2026-10-03'), true);

  // Upcoming future month (e.g. November when today is October) returns no missing records
  const futureMissing = getMissingRecordsForMonth('2026-11', [], [], '2026-01-01', '2026-10-27');
  assert.equal(futureMissing.length, 0);
});

test('DD/MM/YYYY date formatter, future month/date checks, and Bengali voice date detection', () => {
  assert.equal(formatDateSlashDMY('2026-10-27', 'bn'), '২৭/১০/২০২৬');
  assert.equal(formatDateSlashDMY('2026-10-27', 'en'), '27/10/2026');

  assert.equal(isFutureMonth('2026-11', '2026-10'), true);
  assert.equal(isFutureMonth('2026-10', '2026-10'), false);
  assert.equal(isFutureMonth('2026-09', '2026-10'), false);

  assert.equal(isFutureDate('2026-10-28', '2026-10-27'), true);
  assert.equal(isFutureDate('2026-10-27', '2026-10-27'), false);
  assert.equal(isFutureDate('2026-10-26', '2026-10-27'), false);

  assert.equal(getDefaultDateForMonth('2026-10', '2026-10-27'), '2026-10-27');
  assert.equal(getDefaultDateForMonth('2026-11', '2026-10-27'), '2026-11-01');

  // Voice relative date parsing ('গতকাল' -> yesterday, explicit day '২৪ তারিখ' -> 24th)
  const yesterdayOt = parseBengaliVoiceEntryLocal('গতকাল ২ ঘণ্টা ওভারটাইম করেছি', '2026-10-27');
  assert.equal(yesterdayOt.entryType, 'overtime');
  assert.equal(yesterdayOt.date, '2026-10-26');
  assert.equal(yesterdayOt.amountOrHours, 2);

  const explicitDayAtt = parseBengaliVoiceEntryLocal('২৪ তারিখ হাজিরা উপস্থিত', '2026-10-27');
  assert.equal(explicitDayAtt.entryType, 'attendance');
  assert.equal(explicitDayAtt.date, '2026-10-24');
  assert.equal(explicitDayAtt.categoryOrStatus, 'present');
});

test('Quick daily actions visibility: shows when attendance/out-time not added, hides when added, shows when editing from Today summary', () => {
  // 1. Nothing added yet -> not completed -> show quick daily actions
  const emptyComplete = isDailyQuickEntryCompleted({
    attendanceRecord: null,
    overtimeRecord: null,
  });
  assert.equal(emptyComplete, false);
  assert.equal(shouldShowQuickDailyActions({ isCompleted: emptyComplete, isEditing: false }), true);

  // 2. Only marked 'present' without out-time or overtime yet -> not completed -> keep showing so user can add out-time
  const onlyPresentComplete = isDailyQuickEntryCompleted({
    attendanceRecord: { status: 'present', checkOut: '' },
    overtimeRecord: null,
  });
  assert.equal(onlyPresentComplete, false);
  assert.equal(shouldShowQuickDailyActions({ isCompleted: onlyPresentComplete, isEditing: false }), true);

  // 3. Marked 'present' AND overtime/out-time added -> completed -> automatically hide quick daily actions
  const fullEntryComplete = isDailyQuickEntryCompleted({
    attendanceRecord: { status: 'present', checkOut: '19:00' },
    overtimeRecord: { approvedHours: 2 },
  });
  assert.equal(fullEntryComplete, true);
  assert.equal(shouldShowQuickDailyActions({ isCompleted: fullEntryComplete, isEditing: false }), false);

  // 4. Clicking Edit on "আজকের হিসাব" (isEditing: true) -> reveals quick daily actions on Home page even when completed
  assert.equal(shouldShowQuickDailyActions({ isCompleted: fullEntryComplete, isEditing: true }), true);

  // 5. Non-working status (e.g. absent or approved_leave) completes immediately without requiring out-time
  const absentComplete = isDailyQuickEntryCompleted({
    attendanceRecord: { status: 'absent', checkOut: '' },
    overtimeRecord: null,
  });
  assert.equal(absentComplete, true);
  assert.equal(shouldShowQuickDailyActions({ isCompleted: absentComplete, isEditing: false }), false);
});

test('Attendance bonus punctuality window resolves accurately for Day Shift (07:50 - 08:05), Night Shift (19:50 - 20:05), and Roster', () => {
  const dayWin = getAttendanceBonusWindowForShift({ shiftPattern: 'day' });
  assert.equal(dayWin.dayWindowStart, '07:50');
  assert.equal(dayWin.dayWindowEnd, '08:05');
  assert.equal(dayWin.windowLabelBn.includes('৭:৫০'), true);
  assert.equal(dayWin.windowLabelBn.includes('৮:০৫'), true);

  const nightWin = getAttendanceBonusWindowForShift({ shiftPattern: 'night' });
  assert.equal(nightWin.nightWindowStart, '19:50');
  assert.equal(nightWin.nightWindowEnd, '20:05');
  assert.equal(nightWin.windowLabelBn.includes('রাত'), true);

  const rosterWin = getAttendanceBonusWindowForShift({ shiftPattern: 'weekly_rotation' });
  assert.equal(rosterWin.windowLabelBn.includes('ডে:'), true);
  assert.equal(rosterWin.windowLabelBn.includes('নাইট:'), true);
});

test('Job transition archives current garment into past workplaces with full analytics snapshot and activates new garment', () => {
  const mockProfile: WorkerProfile = {
    userId: 'u_test',
    fullName: 'নাসরিন আক্তার',
    photoUrl: '',
    phone: '01712345678',
    address: 'কোনাবাড়ী, গাজীপুর',
    emergencyContact: '',
    factoryName: 'পদ্মা নিটওয়্যার লিঃ',
    factoryBranch: 'গাজীপুর ইউনিট-২',
    department: 'সুইং (Line B4)',
    designation: 'অপারেটর',
    employeeId: 'PKA-101',
    employmentType: 'permanent',
    joiningDate: '2025-01-01',
    salaryGrade: 'গ্রেড ৪',
    basicSalary: 6700,
    houseRentAllowance: 3350,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
    attendanceBonus: 600,
    grossSalary: 12500,
    otWageBase: 'basic',
    otDivisor: 208,
    otMultiplier: 2,
    effectiveFrom: '2025-01-01',
    language: 'bn',
    privacyConsent: true,
  };

  const transition = buildJobTransitionArchive({
    profile: mockProfile,
    workplaces: [
      {
        id: 'wp_current_1',
        userId: 'u_test',
        factoryName: 'পদ্মা নিটওয়্যার লিঃ',
        factoryAddress: 'গাজীপুর',
        factoryArea: 'গাজীপুর ইউনিট-২',
        department: 'সুইং (Line B4)',
        floorNumber: '৩য় তলা',
        lineNumber: 'বি-৪',
        designation: 'অপারেটর',
        supervisorName: 'জাহিদ',
        joiningDate: '2025-01-01',
        factoryPhone: '01700000000',
        notes: '',
        isCurrent: true,
      },
    ],
    input: {
      newFactoryName: 'স্কয়ার ফ্যাশনস লিমিটেড',
      newFactoryBranch: 'ভালুকা, ময়মনসিংহ',
      newDepartment: 'কোয়ালিটি (QC)',
      newDesignation: 'সিনিয়র অপারেটর',
      newEmployeeId: 'SQF-505',
      newJoiningDate: '2026-10-28',
      leavingDate: '2026-10-27',
      leavingReason: 'বেতন বৃদ্ধি ও পদোন্নতি',
      newGrossSalary: 14500,
      newBasicSalary: 7857,
      newShiftPattern: 'day',
    },
    salaryRecords: [],
    payments: [
      {
        id: 'pay_1',
        userId: 'u_test',
        month: '2026-09',
        paymentDate: '2026-10-07',
        amountReceived: 14200,
        paymentMethod: 'bkash',
        isPartial: false,
        referenceNote: '',
      },
    ],
    overtime: [
      {
        id: 'ot_1',
        userId: 'u_test',
        date: '2026-10-10',
        month: '2026-10',
        startTime: '17:00',
        endTime: '19:00',
        breakMinutes: 0,
        totalMinutes: 120,
        approvedHours: 2,
        basicSalarySnapshot: 6700,
        divisorSnapshot: 208,
        multiplierSnapshot: 2,
        hourlyRateSnapshot: 64.42,
        estimatedEarnings: 128.84,
        notes: '',
      },
    ],
    attendance: [
      {
        id: 'att_1',
        userId: 'u_test',
        date: '2026-10-10',
        month: '2026-10',
        status: 'present',
        leaveCategory: 'none',
        checkIn: '07:55',
        checkOut: '19:00',
        notes: '',
      },
    ],
    todayISO: '2026-10-28',
  });

  // Old factory is archived as isCurrent: false with analytics snapshot
  assert.equal(transition.archivedExistingId, 'wp_current_1');
  assert.equal(transition.archivedPastWorkplace.isCurrent, false);
  assert.equal(transition.archivedPastWorkplace.factoryName, 'পদ্মা নিটওয়্যার লিঃ');
  assert.equal(transition.archivedPastWorkplace.leavingDate, '2026-10-27');
  assert.equal((transition.archivedPastWorkplace.totalReceivedSalary || 0) > 0, true);
  assert.equal((transition.archivedPastWorkplace.monthsWorked || 0) >= 20, true);

  // New factory is set as isCurrent: true and updates profile patch
  assert.equal(transition.newCurrentWorkplace.isCurrent, true);
  assert.equal(transition.newCurrentWorkplace.factoryName, 'স্কয়ার ফ্যাশনস লিমিটেড');
  assert.equal(transition.updatedProfilePatch.factoryName, 'স্কয়ার ফ্যাশনস লিমিটেড');
  assert.equal(transition.updatedProfilePatch.grossSalary, 14500);
});

test('computeNextSavingsDueDate calculates next deposit date for monthly, weekly, and daily frequencies', () => {
  assert.equal(computeNextSavingsDueDate('2026-10-07', 'monthly'), '2026-11-07');
  assert.equal(computeNextSavingsDueDate('2026-12-15', 'monthly'), '2027-01-15');
  assert.equal(computeNextSavingsDueDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(computeNextSavingsDueDate('2026-10-07', 'weekly'), '2026-10-14');
  assert.equal(computeNextSavingsDueDate('2026-10-07', 'daily'), '2026-10-08');
});

test('getRecentMonthsList generates consecutive descending months for 6, 7, and 12 month ranges', () => {
  const m6 = getRecentMonthsList('2026-10', 6);
  assert.deepEqual(m6, ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05']);

  const m7 = getRecentMonthsList('2026-10', 7);
  assert.equal(m7.length, 7);
  assert.equal(m7[0], '2026-10');
  assert.equal(m7[2], '2026-08'); // October vs August comparison support
  assert.equal(m7[6], '2026-04');

  const m12 = getRecentMonthsList('2026-10', 12);
  assert.equal(m12.length, 12);
  assert.equal(m12[11], '2025-11');
});

import { computeBstComponentsFromUtcMs } from './networkTime';

test('computeBstComponentsFromUtcMs accurately calculates Bangladesh Standard Time (UTC+6) independent of local device clock', () => {
  // 2026-10-29T01:00:00Z in UTC -> 2026-10-29 07:00:00 in Asia/Dhaka (UTC+6), Thursday (day 4)
  const utcMs = Date.UTC(2026, 9, 29, 1, 0, 0);
  const bst = computeBstComponentsFromUtcMs(utcMs, true, utcMs);
  assert.equal(bst.time24, '07:00');
  assert.equal(bst.time24WithSeconds, '07:00:00');
  assert.equal(bst.dateISO, '2026-10-29');
  assert.equal(bst.dayOfWeek, 4);
  assert.equal(bst.isOnlineSynced, true);

  // 2026-10-28T20:30:15Z in UTC -> 2026-10-29 02:30:15 in Asia/Dhaka (next day in BD!)
  const utcLateMs = Date.UTC(2026, 9, 28, 20, 30, 15);
  const bstNextDay = computeBstComponentsFromUtcMs(utcLateMs, true, utcLateMs);
  assert.equal(bstNextDay.time24, '02:30');
  assert.equal(bstNextDay.time24WithSeconds, '02:30:15');
  assert.equal(bstNextDay.dateISO, '2026-10-29');
});

import {
  buildRentDueDescription,
  parseRentDueDescription,
  isRentDueRecord,
  buildRentAdvanceDescription,
  parseRentAdvanceDescription,
  isRentAdvanceRecord,
} from './calculations';

test('buildRentDueDescription and parseRentDueDescription round-trip multi-month due entries for rent, electricity, and gas', () => {
  const desc = buildRentDueDescription({
    itemType: 'electricity',
    months: ['2026-09', '2026-08', '2026-07'],
    dueAmount: 1950,
    isPaid: false,
    note: '৩ মাসের কারেন্ট বিল বকেয়া',
  });
  assert.equal(isRentDueRecord(desc), true);

  const parsed = parseRentDueDescription(desc, '2026-10');
  assert.ok(parsed);
  assert.equal(parsed.itemType, 'electricity');
  assert.deepEqual(parsed.months, ['2026-09', '2026-08', '2026-07']);
  assert.equal(parsed.dueAmount, 1950);
  assert.equal(parsed.isPaid, false);
  assert.equal(parsed.note, '৩ মাসের কারেন্ট বিল বকেয়া');

  // Mark as paid
  const paidDesc = buildRentDueDescription({ ...parsed, isPaid: true });
  const parsedPaid = parseRentDueDescription(paidDesc, '2026-10');
  assert.ok(parsedPaid);
  assert.equal(parsedPaid.isPaid, true);
  assert.equal(parsedPaid.dueAmount, 1950);
});

test('buildRentAdvanceDescription and parseRentAdvanceDescription round-trip multi-month and multi-item advance entries', () => {
  const desc = buildRentAdvanceDescription({
    items: ['house_rent', 'electricity', 'gas'],
    months: ['2026-11', '2026-12', '2027-01'],
    monthsCount: 3,
    advanceAmount: 12000,
    deductedFromCash: true,
    note: '৩ মাসের অগ্রিম ভাড়া ও বিল',
  });
  assert.equal(isRentAdvanceRecord(desc), true);

  const parsed = parseRentAdvanceDescription(desc, '2026-10');
  assert.ok(parsed);
  assert.deepEqual(parsed.items, ['house_rent', 'electricity', 'gas']);
  assert.deepEqual(parsed.months, ['2026-11', '2026-12', '2027-01']);
  assert.equal(parsed.monthsCount, 3);
  assert.equal(parsed.advanceAmount, 12000);
  assert.equal(parsed.deductedFromCash, true);
  assert.equal(parsed.note, '৩ মাসের অগ্রিম ভাড়া ও বিল');
});

import { buildMonthlyRentUtilityTableRows, DEFAULT_RENT_RULE_CONFIG } from './calculations';

test('buildMonthlyRentUtilityTableRows generates per-month rows tracking paid, due/arrears, and advance statuses', () => {
  const expenses = [
    {
      id: 'exp-oct-rent',
      userId: 'u1',
      date: '2026-10-05',
      month: '2026-10',
      category: 'rent' as const,
      amount: 3500,
      description: '[বাসা ভাড়া] অক্টোবর ২০২৬ [মাস:2026-10 · অবস্থা:running · চলতি পরিশোধ] · লাইন গ্যাস সংযুক্ত',
    },
    {
      id: 'exp-sep-due',
      userId: 'u1',
      date: '2026-10-05',
      month: '2026-10',
      category: 'rent' as const,
      amount: 0,
      description: buildRentDueDescription({
        itemType: 'house_rent',
        months: ['2026-09'],
        dueAmount: 3500,
        isPaid: false,
      }),
    },
    {
      id: 'exp-nov-adv',
      userId: 'u1',
      date: '2026-10-05',
      month: '2026-10',
      category: 'rent' as const,
      amount: 7000,
      description: buildRentAdvanceDescription({
        items: ['house_rent'],
        months: ['2026-11', '2026-12'],
        monthsCount: 2,
        advanceAmount: 7000,
        deductedFromCash: true,
      }),
    },
  ];

  const rows = buildMonthlyRentUtilityTableRows({
    expenses,
    rentRule: { ...DEFAULT_RENT_RULE_CONFIG, fixedBaseRent: 3500, gasMode: 'attached' },
    selectedMonth: '2026-10',
    monthsCount: 4,
  });

  const octRow = rows.find((r) => r.month === '2026-10');
  const sepRow = rows.find((r) => r.month === '2026-09');
  const novRow = rows.find((r) => r.month === '2026-11');

  assert.ok(octRow);
  assert.equal(octRow.status, 'paid');
  assert.equal(octRow.rentAmount, 3500);

  assert.ok(sepRow);
  assert.equal(sepRow.status, 'due');
  assert.equal(sepRow.unpaidDueRecordId, 'exp-sep-due');

  assert.ok(novRow);
  assert.equal(novRow.status, 'advance');
  assert.equal(novRow.rentAmount, 3500);
});

test('computeOnboardingOvertimeBreakdown and formatTakaPaisaLabel preserve exact paisa (64.42 BDT/hr and 128.84 for 2 hrs)', async () => {
  const { computeOnboardingOvertimeBreakdown, formatTakaPaisaLabel } = await import('./calculations');

  // Default rate when no salary entered yet: 64.42 BDT/hr
  const defBreakdown = computeOnboardingOvertimeBreakdown({
    grossSalary: 0,
    basicSalary: 0,
  });
  assert.equal(defBreakdown.hourlyOtRate, 64.42);
  assert.equal(defBreakdown.oneHourOt, 64.42);
  assert.equal(defBreakdown.twoHoursOt, 128.84);

  // Derived from 12,500 BDT Gross -> 6,700 BDT Basic -> 64.42 BDT/hr
  const grade4Breakdown = computeOnboardingOvertimeBreakdown({
    grossSalary: 12500,
    basicSalary: 0,
  });
  assert.equal(grade4Breakdown.effectiveBasic, 6700);
  assert.equal(grade4Breakdown.hourlyOtRate, 64.42);
  assert.equal(grade4Breakdown.oneHourOt, 64.42);
  assert.equal(grade4Breakdown.twoHoursOt, 128.84);

  // Formatting with paisa never drops 42 paisa or 84 paisa
  assert.equal(formatBDT(64.42, 'bn'), '৳ ৬৪.৪২');
  assert.equal(formatBDT(128.84, 'bn'), '৳ ১২৮.৮৪');
  assert.equal(formatTakaPaisaLabel(64.42, 'bn'), '৬৪ টাকা ৪২ পয়সা');
  assert.equal(formatTakaPaisaLabel(128.84, 'bn'), '১২৮ টাকা ৮৪ পয়সা');
});

test('isWorkerSetupCompleted returns false when onboarding was skipped (0 salary) and true after setup', async () => {
  const { isWorkerSetupCompleted } = await import('./calculations');
  assert.equal(isWorkerSetupCompleted({ grossSalary: 0, basicSalary: 0 }), false);
  assert.equal(isWorkerSetupCompleted({ grossSalary: 12500, basicSalary: 6700 }), true);
  assert.equal(isWorkerSetupCompleted({ grossSalary: 0, basicSalary: 6700 }), true);
});

test('applyMonthlyRentRuleUpdate and buildMonthlyRentUtilityTableRows isolate electricity attached vs separate per month', async () => {
  const { applyMonthlyRentRuleUpdate, resolveRentRuleForMonth } = await import('./calculations');

  // Initial rule: September has electricity attached to rent (ভাড়ার সাথে যুক্ত)
  let rule = applyMonthlyRentRuleUpdate({
    currentConfig: DEFAULT_RENT_RULE_CONFIG,
    targetMonth: '2026-09',
    patch: {
      fixedBaseRent: 3500,
      electricityAttachedToRent: true,
      defaultElectricityAmount: 0,
      gasMode: 'attached',
      defaultGasAmount: 0,
      waterAttachedToRent: true,
      defaultWaterAmount: 0,
    },
  });

  // In October, electricity is separate (আলাদা কারেন্ট বিল = 650)
  rule = applyMonthlyRentRuleUpdate({
    currentConfig: rule,
    targetMonth: '2026-10',
    patch: {
      fixedBaseRent: 3500,
      electricityAttachedToRent: false,
      defaultElectricityAmount: 650,
      gasMode: 'attached',
      defaultGasAmount: 0,
      waterAttachedToRent: true,
      defaultWaterAmount: 0,
    },
  });

  const sepRule = resolveRentRuleForMonth(rule, '2026-09');
  const octRule = resolveRentRuleForMonth(rule, '2026-10');

  assert.equal(sepRule.electricityAttachedToRent, true);
  assert.equal(sepRule.defaultElectricityAmount, 0);
  assert.equal(octRule.electricityAttachedToRent, false);
  assert.equal(octRule.defaultElectricityAmount, 650);

  const rows = buildMonthlyRentUtilityTableRows({
    expenses: [],
    rentRule: rule,
    selectedMonth: '2026-10',
    monthsCount: 4,
  });

  const sepRow = rows.find((r) => r.month === '2026-09');
  const octRow = rows.find((r) => r.month === '2026-10');

  assert.ok(sepRow);
  assert.equal(sepRow.electricityAttached, true);
  assert.equal(sepRow.electricityAmount, 0);
  assert.equal(sepRow.totalAmount, 3500);

  assert.ok(octRow);
  assert.equal(octRow.electricityAttached, false);
  assert.equal(octRow.electricityAmount, 650);
  assert.equal(octRow.totalAmount, 4150);
});

test('computeDailyEarnedSalary calculates daily rate (monthly/30) and scales with attendance count', () => {
  const monthlySalary = 14500;
  // 14500 / 30 = 483.33 BDT/day

  // Scenario 1: 0 Attendance Days (জিরো উপস্থিতি -> ০ টাকা)
  const resZero = computeDailyEarnedSalary({
    monthlyWage: monthlySalary,
    attendanceRecords: [],
    overtimeEarnings: 0,
    attendanceBonus: 600,
  });
  assert.equal(resZero.dailyWageRate, 483.33);
  assert.equal(resZero.attendedDaysCount, 0);
  assert.equal(resZero.earnedBaseSalary, 0);
  assert.equal(resZero.totalEarnedSalary, 600); // 0 base + 600 bonus

  // Scenario 2: 1 Attendance Day (১ দিন উপস্থিতি -> ৪৮৩.৩৩ টাকা + ওটি + বোনাস)
  const att1: AttendanceRecord[] = [
    {
      id: 'a1',
      userId: 'u1',
      date: '2026-10-01',
      month: '2026-10',
      status: 'present',
      leaveCategory: 'none',
      checkIn: '08:00',
      checkOut: '19:00',
      notes: '',
    },
  ];
  const resOne = computeDailyEarnedSalary({
    monthlyWage: monthlySalary,
    attendanceRecords: att1,
    overtimeEarnings: 128.84,
    attendanceBonus: 600,
  });
  assert.equal(resOne.attendedDaysCount, 1);
  assert.equal(resOne.earnedBaseSalary, 483.33);
  assert.equal(resOne.totalEarnedSalary, 483.33 + 128.84 + 600);

  // Scenario 3: 2 Attendance Days (২ দিন উপস্থিতি -> ৯৬৬.৬৬/৯৬৬.৬৭ টাকা)
  const att2: AttendanceRecord[] = [
    ...att1,
    {
      id: 'a2',
      userId: 'u1',
      date: '2026-10-02',
      month: '2026-10',
      status: 'present',
      leaveCategory: 'none',
      checkIn: '08:00',
      checkOut: '17:00',
      notes: '',
    },
  ];
  const resTwo = computeDailyEarnedSalary({
    monthlyWage: monthlySalary,
    attendanceRecords: att2,
    overtimeEarnings: 200,
    attendanceBonus: 600,
  });
  assert.equal(resTwo.attendedDaysCount, 2);
  assert.equal(resTwo.earnedBaseSalary, 966.66);
  assert.equal(resTwo.totalEarnedSalary, 1766.66);

  // Scenario 4: 13 Attendance Days
  const att13: AttendanceRecord[] = Array.from({ length: 13 }, (_, i) => ({
    id: `a_${i}`,
    userId: 'u1',
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    month: '2026-10',
    status: 'present',
    leaveCategory: 'none',
    checkIn: '08:00',
    checkOut: '17:00',
    notes: '',
  }));
  const res13 = computeDailyEarnedSalary({
    monthlyWage: monthlySalary,
    attendanceRecords: att13,
    overtimeEarnings: 500,
    attendanceBonus: 600,
  });
  assert.equal(res13.attendedDaysCount, 13);
  assert.equal(res13.earnedBaseSalary, 6283.29);
  assert.equal(res13.fullExpectedMonthlySalary, 14500 + 500 + 600);
});

test('calculateAttendanceBonusEligibility voids bonus when hasAttendanceBonus is unchecked (false)', () => {
  const profile: Partial<WorkerProfile> = {
    hasAttendanceBonus: true,
    attendanceBonus: 750,
    attendanceBonusDays: 30,
    maxConsecutiveAbsences: 0,
  };

  const recordsWithBonusActive: AttendanceRecord[] = [
    {
      id: 'att1',
      userId: 'u1',
      date: '2026-10-01',
      month: '2026-10',
      status: 'present',
      leaveCategory: 'none',
      checkIn: '08:00',
      checkOut: '17:00',
      notes: '',
      hasAttendanceBonus: true,
    },
  ];
  const evalActive = calculateAttendanceBonusEligibility({
    recordsForMonth: recordsWithBonusActive,
    profile,
  });
  assert.equal(evalActive.isEligible, true);
  assert.equal(evalActive.earnedAmount, 750);

  // When user manually unticked bonus (hasAttendanceBonus === false)
  const recordsWithBonusUnticked: AttendanceRecord[] = [
    {
      id: 'att1',
      userId: 'u1',
      date: '2026-10-01',
      month: '2026-10',
      status: 'present',
      leaveCategory: 'none',
      checkIn: '08:00',
      checkOut: '17:00',
      notes: '',
      hasAttendanceBonus: false,
    },
  ];
  const evalUnticked = calculateAttendanceBonusEligibility({
    recordsForMonth: recordsWithBonusUnticked,
    profile,
  });
  assert.equal(evalUnticked.isEligible, false);
  assert.equal(evalUnticked.earnedAmount, 0);
  assert.ok((evalUnticked.reasonBn || '').includes('হাজিরা বোনাস টিকমার্ক সরানো হয়েছিল'));
});

test('getRecentMonthsList correctly generates 24 past months from current month for backfilling past records', () => {
  const months = getRecentMonthsList('2026-10', 24);
  assert.equal(months.length, 24);
  assert.equal(months[0], '2026-10');
  assert.equal(months[1], '2026-09');
  assert.equal(months[2], '2026-08');
  assert.equal(months[12], '2025-10');
  assert.equal(months[23], '2024-11');
});

test('calculateSalaryTotals handles manually recorded past month salaries accurately', () => {
  const septSalary = calculateSalaryTotals({
    basicSalary: 14500,
    houseRentAllowance: 0,
    medicalAllowance: 0,
    transportAllowance: 0,
    foodAllowance: 0,
    attendanceBonus: 800,
    overtimeEarnings: 3221,
    festivalBonus: 0,
    otherAllowances: 0,
    advanceDeduction: 500,
    absenceDeduction: 0,
    otherDeductions: 0,
    adjustments: 0,
  });

  assert.equal(septSalary.baseGross, 14500);
  assert.equal(septSalary.estimatedGross, 18521); // 14500 + 800 + 3221
  assert.equal(septSalary.totalDeductions, 500);
  assert.equal(septSalary.estimatedNetPayable, 18021); // 18521 - 500
});

test('computeDailyEarnedSalary excludes attendance bonus from full expected salary when bonus is missed', () => {
  const records = [
    {
      id: 'att_1',
      userId: 'u1',
      date: '2026-10-01',
      month: '2026-10',
      status: 'present' as const,
      leaveCategory: 'none' as const,
      checkIn: '08:00',
      checkOut: '17:00',
      notes: '',
      hasAttendanceBonus: true,
    },
  ];

  // Case A: Worker is eligible for bonus (500 BDT)
  const earnedEligible = computeDailyEarnedSalary({
    monthlyWage: 14500,
    attendanceRecords: records,
    overtimeEarnings: 200,
    attendanceBonus: 500,
  });
  // 14500 + 200 (OT) + 500 (Bonus) = 15200
  assert.equal(earnedEligible.fullExpectedMonthlySalary, 15200);

  // Case B: Worker missed bonus (0 BDT passed when ineligible)
  const earnedMissed = computeDailyEarnedSalary({
    monthlyWage: 14500,
    attendanceRecords: records,
    overtimeEarnings: 200,
    attendanceBonus: 0,
  });
  // 14500 + 200 (OT) + 0 (Bonus missed) = 14700
  assert.equal(earnedMissed.fullExpectedMonthlySalary, 14700);
  assert.equal(earnedMissed.earnedAttendanceBonus, 0);
});

test('Earned outstanding balance calculates from earned salary so far instead of theoretical full-month salary', () => {
  const records = [
    {
      id: 'att_1',
      userId: 'u1',
      date: '2026-10-01',
      month: '2026-10',
      status: 'present' as const,
      leaveCategory: 'none' as const,
      checkIn: '08:00',
      checkOut: '17:00',
      notes: '',
      hasAttendanceBonus: true,
    },
    {
      id: 'att_2',
      userId: 'u1',
      date: '2026-10-02',
      month: '2026-10',
      status: 'present' as const,
      leaveCategory: 'none' as const,
      checkIn: '08:00',
      checkOut: '17:00',
      notes: '',
      hasAttendanceBonus: true,
    },
  ];

  const earned = computeDailyEarnedSalary({
    monthlyWage: 14500,
    attendanceRecords: records,
    overtimeEarnings: 0,
    attendanceBonus: 0,
  });

  // Daily rate is 14500 / 30 = 483.33
  // 2 days = 966.66
  assert.equal(earned.attendedDaysCount, 2);
  assert.equal(earned.dailyWageRate, 483.33);
  assert.equal(earned.totalEarnedSalary, 966.66);

  // When no payment received, outstanding balance is based on earned salary so far (~967)
  const receivedPayment0 = 0;
  const balance0 = Math.max(0, Math.round(earned.totalEarnedSalary - receivedPayment0));
  assert.equal(balance0, 967);

  // When 500 received, outstanding is 967 - 500 = 467
  const receivedPayment500 = 500;
  const balance500 = Math.max(0, Math.round(earned.totalEarnedSalary - receivedPayment500));
  assert.equal(balance500, 467);

  // When 1000 received, outstanding is 0
  const receivedPayment1000 = 1000;
  const balance1000 = Math.max(0, Math.round(earned.totalEarnedSalary - receivedPayment1000));
  assert.equal(balance1000, 0);
});

test('Toggling attendance bonus checkbox on missed date immediately restores bonus eligibility', () => {
  const profile = {
    hasAttendanceBonus: true,
    attendanceBonus: 800,
    attendanceBonusAmount: 800,
    attendanceBonusDays: 25,
    maxConsecutiveAbsences: 0,
  } as any;

  // Day 1 unticked -> bonus missed
  const missedRecords = [
    {
      id: 'att_1',
      userId: 'u1',
      date: '2026-10-02',
      month: '2026-10',
      status: 'present' as const,
      leaveCategory: 'none' as const,
      checkIn: '08:00',
      checkOut: '17:00',
      notes: '',
      hasAttendanceBonus: false,
    },
  ];
  const evalMissed = calculateAttendanceBonusEligibility({
    recordsForMonth: missedRecords,
    profile,
  });
  assert.equal(evalMissed.isEligible, false);
  assert.equal(evalMissed.earnedAmount, 0);

  // Re-checking the tickmark on that date -> restored
  const restoredRecords = [
    {
      ...missedRecords[0],
      hasAttendanceBonus: true,
    },
  ];
  const evalRestored = calculateAttendanceBonusEligibility({
    recordsForMonth: restoredRecords,
    profile,
  });
  assert.equal(evalRestored.isEligible, true);
  assert.equal(evalRestored.earnedAmount, 800);
});

test('validateOnboardingStepTransition allows free navigation during initial onboarding and enforces basicSalary + workplace during manual setup', async () => {
  const { validateOnboardingStepTransition } = await import('./calculations');

  // 1. Initial onboarding (isManualSetupMode = false): can freely advance even when empty
  const initStep1 = validateOnboardingStepTransition({
    step: 1,
    isManualSetupMode: false,
    grossSalaryInput: '',
    basicSalaryInput: '',
    joiningDate: '',
    otRateInput: '',
    isOtRateConfirmed: false,
    factoryName: '',
    factoryBranch: '',
    lang: 'bn',
  });
  assert.equal(initStep1.canAdvance, true);
  assert.equal(initStep1.grossSalaryError, undefined);

  const initStep2 = validateOnboardingStepTransition({
    step: 2,
    isManualSetupMode: false,
    grossSalaryInput: '',
    basicSalaryInput: '',
    factoryName: '',
    factoryBranch: '',
    lang: 'bn',
  });
  assert.equal(initStep2.canAdvance, true);

  // 2. Manual setup after skipping (isManualSetupMode = true): Step 1 blocks when grossSalary is empty
  const manualStep1Empty = validateOnboardingStepTransition({
    step: 1,
    isManualSetupMode: true,
    grossSalaryInput: '',
    basicSalaryInput: '',
    joiningDate: '',
    otRateInput: '',
    isOtRateConfirmed: false,
    factoryName: '',
    factoryBranch: '',
    lang: 'bn',
  });
  assert.equal(manualStep1Empty.canAdvance, false);
  assert.equal(manualStep1Empty.focusField, 'grossSalary');
  assert.ok(manualStep1Empty.grossSalaryError?.includes('মোট বেতন লিখুন'));
  assert.ok(manualStep1Empty.joiningDateError?.includes('যোগদানের তারিখ'));
  assert.ok(manualStep1Empty.otRateError?.includes('ওভারটাইম হার লিখুন'));

  // 3. Manual setup Step 1: grossSalary filled, joiningDate filled, otRate auto-filled (64.42) but NOT yet confirmed -> blocks and asks user to check & confirm OT rate
  const manualStep1UnconfirmedOt = validateOnboardingStepTransition({
    step: 1,
    isManualSetupMode: true,
    grossSalaryInput: '12500',
    basicSalaryInput: '',
    joiningDate: '2026-10-01',
    otRateInput: '64.42',
    isOtRateConfirmed: false,
    factoryName: '',
    factoryBranch: '',
    lang: 'bn',
  });
  assert.equal(manualStep1UnconfirmedOt.canAdvance, false);
  assert.equal(manualStep1UnconfirmedOt.focusField, 'otRateConfirm');
  assert.ok(manualStep1UnconfirmedOt.otRateError?.includes('চেক করে'));

  // 4. Manual setup Step 1: once OT rate is confirmed (isOtRateConfirmed = true), allows advancing to Step 2 even if basicSalary was left optional/auto
  const manualStep1Confirmed = validateOnboardingStepTransition({
    step: 1,
    isManualSetupMode: true,
    grossSalaryInput: '12500',
    basicSalaryInput: '6700',
    joiningDate: '2026-10-01',
    otRateInput: '64.42',
    isOtRateConfirmed: true,
    factoryName: '',
    factoryBranch: '',
    lang: 'bn',
  });
  assert.equal(manualStep1Confirmed.canAdvance, true);
  assert.equal(manualStep1Confirmed.grossSalaryError, undefined);
  assert.equal(manualStep1Confirmed.joiningDateError, undefined);
  assert.equal(manualStep1Confirmed.otRateError, undefined);

  // 5. Manual setup Step 2: blocks when factoryName or factoryBranch is missing
  const manualStep2Empty = validateOnboardingStepTransition({
    step: 2,
    isManualSetupMode: true,
    grossSalaryInput: '12500',
    basicSalaryInput: '6700',
    factoryName: '',
    factoryBranch: '',
    lang: 'bn',
  });
  assert.equal(manualStep2Empty.canAdvance, false);
  assert.equal(manualStep2Empty.focusField, 'factoryName');
  assert.ok(manualStep2Empty.factoryNameError?.includes('কারখানার নাম লিখুন'));
  assert.ok(manualStep2Empty.factoryBranchError?.includes('এলাকার নাম লিখুন'));

  const manualStep2MissingArea = validateOnboardingStepTransition({
    step: 2,
    isManualSetupMode: true,
    grossSalaryInput: '12500',
    basicSalaryInput: '6700',
    factoryName: 'পদ্মা নিটওয়্যার লিঃ',
    factoryBranch: '',
    lang: 'bn',
  });
  assert.equal(manualStep2MissingArea.canAdvance, false);
  assert.equal(manualStep2MissingArea.focusField, 'factoryBranch');
  assert.equal(manualStep2MissingArea.factoryNameError, undefined);
  assert.ok(manualStep2MissingArea.factoryBranchError?.includes('এলাকার নাম লিখুন'));

  // 6. Manual setup Step 2: filling both factoryName and factoryBranch manually allows advancing to Step 3
  const manualStep2Filled = validateOnboardingStepTransition({
    step: 2,
    isManualSetupMode: true,
    grossSalaryInput: '12500',
    basicSalaryInput: '6700',
    factoryName: 'পদ্মা নিটওয়্যার লিঃ',
    factoryBranch: 'গাজীপুর',
    lang: 'bn',
  });
  assert.equal(manualStep2Filled.canAdvance, true);
  assert.equal(manualStep2Filled.factoryNameError, undefined);
  assert.equal(manualStep2Filled.factoryBranchError, undefined);
});

test('computeDailyEarnedSalary calculates net payable strictly from attended days × daily rate + eligible attendance bonus + overtime (never full 12,500 when present < 30 days)', () => {
  // Make 8 present attendance days
  const eightPresentDays = Array.from({ length: 8 }, (_, idx) => ({
    id: `att_8d_${idx + 1}`,
    userId: 'u1',
    date: `2026-10-0${idx + 1}`,
    month: '2026-10',
    status: 'present' as const,
    leaveCategory: 'none' as const,
    checkIn: '07:55',
    checkOut: '17:00',
    notes: '',
    hasAttendanceBonus: true,
  }));

  // Scenario A: 12,000 BDT gross -> 400 BDT/day, 8 days present = 3,200 BDT + 600 bonus + 200 OT = 4,000 BDT
  const calc400PerDay = computeDailyEarnedSalary({
    monthlyWage: 12000,
    attendanceRecords: eightPresentDays,
    overtimeEarnings: 200,
    attendanceBonus: 600,
    isAttendanceBonusEligible: true,
  });
  assert.equal(calc400PerDay.dailyWageRate, 400);
  assert.equal(calc400PerDay.attendedDaysCount, 8);
  assert.equal(calc400PerDay.earnedBaseSalary, 3200);
  assert.equal(calc400PerDay.earnedAttendanceBonus, 600);
  assert.equal(calc400PerDay.totalEarnedSalary, 4000);

  // Scenario B: 12,500 BDT gross -> 416.67 BDT/day, 8 days present = 3,333.36 BDT
  // When attendance bonus is missed (isAttendanceBonusEligible = false), bonus becomes 0 and net payable = 3,333.36 + 166 OT = 3,499.36 BDT (NOT 13,266)
  const calc12500BonusMissed = computeDailyEarnedSalary({
    monthlyWage: 12500,
    attendanceRecords: eightPresentDays,
    overtimeEarnings: 166,
    attendanceBonus: 600,
    isAttendanceBonusEligible: false,
  });
  assert.equal(calc12500BonusMissed.dailyWageRate, 416.67);
  assert.equal(calc12500BonusMissed.attendedDaysCount, 8);
  assert.equal(calc12500BonusMissed.earnedBaseSalary, 3333.36);
  assert.equal(calc12500BonusMissed.earnedAttendanceBonus, 0);
  assert.equal(calc12500BonusMissed.totalEarnedSalary, 3499.36);
});
