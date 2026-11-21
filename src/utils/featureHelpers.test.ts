import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAnonymousComparisonData,
  buildBenchmarkBucketKey,
  buildYearlySalaryReceivedHistory,
  calculateRMGIncrement,
  comparePayslipWithApp,
  computeExpectedPayDateISO,
  computeYearlyLeaveSummary,
  evaluateBonusRiskWarning,
  evaluateSalaryDayReminder,
  evaluateSavingsGoalPlan,
} from './featureHelpers';
import { answerLabourLawQuestion } from './labourLawHelper';
import type { AttendanceRecord, LeaveApplication, SalaryPayment, SavingsGoal, WorkerProfile } from '../types';

const baseProfile: WorkerProfile = {
  userId: 'u_test',
  fullName: 'রহিম',
  photoUrl: '',
  phone: '01700000000',
  address: 'Gazipur',
  emergencyContact: '',
  designation: 'অপারেটর',
  factoryName: 'এবি গার্মেন্টস',
  factoryBranch: 'Gazipur',
  department: 'Sewing',
  employeeId: 'G-101',
  employmentType: 'permanent',
  salaryGrade: 'Grade 4',
  joiningDate: '2024-01-01',
  grossSalary: 12000,
  basicSalary: 6367,
  houseRentAllowance: 3183,
  medicalAllowance: 750,
  transportAllowance: 450,
  foodAllowance: 1250,
  attendanceBonus: 1000,
  hasAttendanceBonus: true,
  attendanceBonusAmount: 1000,
  latePenaltyEnabled: true,
  maxLateDaysForBonus: 3,
  expectedPayDay: 7,
  otCalculationMode: 'formula',
  otWageBase: 'basic',
  otDivisor: 208,
  otMultiplier: 2,
  effectiveFrom: '2024-01-01',
  language: 'bn',
  privacyConsent: true,
  updatedAt: '2026-03-01T00:00:00.000Z',
};

test('RMG Annual Increment matches exact gazette rounding for 6367 + 5%', () => {
  const res = calculateRMGIncrement({
    currentBasic: 6367,
    currentGross: 12000,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
    mode: 'percent',
    incrementPercent: 5,
    incrementAmountBDT: 0,
  });

  assert.equal(res.newBasic, 6685);
  assert.equal(res.newHouseRent, 3343);
  assert.equal(res.newMedical, 750);
  assert.equal(res.newTransport, 450);
  assert.equal(res.newFood, 1250);
  assert.equal(res.newGross, 12478);
  assert.equal(res.newOtRate, 64.28);
  assert.equal(res.basicIncrease, 318);
  assert.equal(res.monthlyGrossIncrease, 478);
});

test('RMG Annual Increment fixed amount mode reconciles 1-taka rounding in food allowance', () => {
  const res = calculateRMGIncrement({
    currentBasic: 6367,
    currentGross: 12000,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
    mode: 'amount',
    incrementPercent: 0,
    incrementAmountBDT: 500,
  });

  assert.equal(res.newGross, 12500);
  assert.equal(
    res.newBasic + res.newHouseRent + res.newMedical + res.newTransport + res.newFood,
    res.newGross
  );
  assert.equal(res.monthlyGrossIncrease, 500);
  assert.equal(res.yearlyGrossIncrease, 6000);
});

test('Yearly Leave Summary calculates 5 leave types including earned and maternity with exceeded flag', () => {
  const attendance: AttendanceRecord[] = Array.from({ length: 38 }, (_, i) => ({
    id: `att_${i}`,
    userId: 'u_test',
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    month: '2026-01',
    status: 'present',
    leaveCategory: 'none',
    checkIn: '08:00',
    checkOut: '17:00',
    notes: '',
    updatedAt: '',
  }));

  const apps: LeaveApplication[] = [
    {
      id: 'l1',
      userId: 'u_test',
      startDate: '2026-02-01',
      endDate: '2026-02-12',
      totalDays: 12,
      leaveType: 'casual',
      reason: 'বাড়ি',
      status: 'taken',
      createdAt: '',
    },
    {
      id: 'l2',
      userId: 'u_test',
      startDate: '2026-03-01',
      endDate: '2026-03-03',
      totalDays: 3,
      leaveType: 'sick',
      reason: 'জ্বর',
      status: 'planned',
      createdAt: '',
    },
  ];

  const rows = computeYearlyLeaveSummary({
    year: 2026,
    leaveApplications: apps,
    attendance,
    joiningDate: '2024-01-01',
  });

  const casual = rows.find((r) => r.type === 'casual')!;
  const sick = rows.find((r) => r.type === 'sick')!;
  const earned = rows.find((r) => r.type === 'earned')!;
  const maternity = rows.find((r) => r.type === 'maternity')!;

  assert.equal(casual.allowed, 10);
  assert.equal(casual.taken, 12);
  assert.equal(casual.remaining, -2);
  assert.equal(casual.isExceeded, true);

  assert.equal(sick.allowed, 14);
  assert.equal(sick.taken, 0);
  assert.equal(sick.planned, 3);
  assert.equal(sick.remaining, 14);

  assert.equal(earned.allowed, 2); // floor(38 / 18) = 2
  assert.equal(maternity.allowed, 112);
});

test('Hajira Bonus Risk Warning evaluates at_risk, lost, and safe accurately', () => {
  const mkLate = (day: number): AttendanceRecord => ({
    id: `l_${day}`,
    userId: 'u_test',
    date: `2026-03-${String(day).padStart(2, '0')}`,
    month: '2026-03',
    status: 'late',
    leaveCategory: 'none',
    checkIn: '08:15',
    checkOut: '17:00',
    notes: '',
    updatedAt: '',
  });

  const safeRes = evaluateBonusRiskWarning({
    profile: baseProfile,
    attendanceForMonth: [mkLate(1)],
  });
  assert.equal(safeRes.status, 'safe');

  const atRiskRes = evaluateBonusRiskWarning({
    profile: baseProfile,
    attendanceForMonth: [mkLate(1), mkLate(2)],
  });
  assert.equal(atRiskRes.status, 'at_risk');

  const lostRes = evaluateBonusRiskWarning({
    profile: baseProfile,
    attendanceForMonth: [mkLate(1), mkLate(2), mkLate(3)],
  });
  assert.equal(lostRes.status, 'lost');
});

test('Salary Day Reminder shows 1 day before expectedPayDay when unpaid and hides when paid', () => {
  const unpaid = evaluateSalaryDayReminder({
    profile: baseProfile, // expectedPayDay = 7
    payments: [],
    todayISO: '2026-04-06',
  });
  assert.equal(unpaid.shouldShow, true);
  assert.equal(unpaid.expectedPayDay, 7);

  const paid = evaluateSalaryDayReminder({
    profile: baseProfile,
    payments: [
      {
        id: 'p1',
        userId: 'u_test',
        month: '2026-03',
        paymentDate: '2026-04-06',
        amountReceived: 12000,
        paymentMethod: 'bkash',
        isPartial: false,
        referenceNote: '',
        updatedAt: '',
      },
    ],
    todayISO: '2026-04-06',
  });
  assert.equal(paid.shouldShow, false);
});

test('Yearly Salary Received History tracks on-time vs delayed months accurately', () => {
  assert.equal(computeExpectedPayDateISO('2026-01', 7), '2026-02-07');
  const payments: SalaryPayment[] = [
    {
      id: 'p1',
      userId: 'u_test',
      month: '2026-01',
      paymentDate: '2026-02-07',
      amountReceived: 12500,
      paymentMethod: 'bkash',
      isPartial: false,
      referenceNote: '',
      updatedAt: '',
    },
    {
      id: 'p2',
      userId: 'u_test',
      month: '2026-02',
      paymentDate: '2026-03-11', // 4 days after 2026-03-07
      amountReceived: 12000,
      paymentMethod: 'bank',
      isPartial: false,
      referenceNote: '',
      updatedAt: '',
    },
  ];

  const hist = buildYearlySalaryReceivedHistory({
    year: 2026,
    profile: baseProfile,
    payments,
    salaryRecords: [],
    currentMonthISO: '2026-03',
  });

  assert.equal(hist.totalReceivedYear, 24500);
  assert.equal(hist.onTimeMonthsCount, 1);
  assert.equal(hist.lateMonthsCount, 1);
  assert.equal(hist.avgDelayDays, 4);
  assert.equal(hist.rows.find((r) => r.month === '2026-03')?.status, 'no_record');
});

test('Payslip comparison flags exact shortage vs matched totals', () => {
  const shortRes = comparePayslipWithApp({
    parsed: {
      grossSalary: null,
      basicSalary: 6367,
      houseRentAllowance: null,
      medicalAllowance: null,
      transportAllowance: null,
      foodAllowance: null,
      presentDays: null,
      absentDays: null,
      otHours: 40,
      otAmount: 2000,
      attendanceBonus: null,
      otherAllowances: null,
      advanceDeduction: null,
      absentDeduction: null,
      otherDeductions: null,
      netPayable: 14000,
    },
    appData: {
      grossSalary: 12000,
      basicSalary: 6367,
      houseRentAllowance: 3183,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
      presentDays: 26,
      absentDays: 0,
      otHours: 40,
      otAmount: 2448.85,
      attendanceBonus: 1000,
      otherAllowances: 0,
      advanceDeduction: 0,
      absentDeduction: 0,
      otherDeductions: 0,
      netPayable: 15448.85,
    },
  });

  assert.equal(shortRes.isMatched, false);
  assert.equal(shortRes.netDiff, -1448.85);
});

test('Savings Goal plan computes monthly target, surplus boost, and mid-month behind flag', () => {
  const goal: SavingsGoal = {
    id: 'g1',
    userId: 'u_test',
    title: 'ঈদের খরচ',
    targetAmount: 12000,
    savedAmount: 2000,
    monthlyBudget: 0,
    deadline: '2026-08-20',
    lastDepositDate: '2026-02-10',
    countMonthlySurplus: true,
    notes: '',
    updatedAt: '',
  };

  const plan = evaluateSavingsGoalPlan({
    goal,
    todayISO: '2026-03-20',
    currentMonthSurplus: 2000,
  });

  assert.equal(plan.effectiveSaved, 4000);
  assert.equal(plan.remainingAmount, 8000);
  assert.equal(plan.monthsRemaining, 5);
  assert.equal(plan.monthlyTargetNeeded, 1600);
  assert.equal(plan.isBehindMidMonth, true);
});

test('Anonymous Comparison strictly returns null when sampleCount < 20 and returns data when >= 20', () => {
  assert.equal(buildBenchmarkBucketKey('Grade 4', 'Gazipur'), 'grade_4__gazipur');

  const tooSmall = buildAnonymousComparisonData({
    benchmark: {
      bucketKey: 'grade_4__gazipur',
      salaryGrade: 'Grade 4',
      area: 'Gazipur',
      sampleCount: 19,
      medianGrossSalary: 13000,
      medianMonthlyOtHours: 36,
      medianAttendanceBonus: 1000,
      updatedAtISO: '',
    },
    userGross: 12500,
    userMonthlyOtHours: 40,
    userAttendanceBonus: 1000,
  });
  assert.equal(tooSmall, null);

  const valid = buildAnonymousComparisonData({
    benchmark: {
      bucketKey: 'grade_4__gazipur',
      salaryGrade: 'Grade 4',
      area: 'Gazipur',
      sampleCount: 20,
      medianGrossSalary: 13000,
      medianMonthlyOtHours: 36,
      medianAttendanceBonus: 1000,
      updatedAtISO: '',
    },
    userGross: 12500,
    userMonthlyOtHours: 40,
    userAttendanceBonus: 1000,
  });
  assert.ok(valid);
  assert.equal(valid.sampleCount, 20);
  assert.equal(valid.metrics.length, 3);
});

test('Labour Law Helper parses question basic & OT hours and attributes source accurately', () => {
  const ans = answerLabourLawQuestion('মূল বেতন ৬৭০০, ৪০ ঘণ্টা ওভারটাইম', baseProfile, 'bn');
  assert.equal(ans.usedQuestionNumbers, true);
  assert.equal(ans.computedTotalBDT, 2576.92);
  assert.match(ans.answerBn, /২,৫৭৬\.৯২|2,576\.92/);
  assert.match(ans.answerBn, /আপনার প্রশ্ন থেকে/);

  const matAns = answerLabourLawQuestion('মাতৃত্বকালীন ছুটি কত দিন?', baseProfile, 'bn');
  assert.match(matAns.answerBn, /ধারা ৪৬/);
  assert.match(matAns.answerBn, /১১২ দিন/);
});
