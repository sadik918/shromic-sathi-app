import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSmartSalaryComparison,
  computeWorkplaceTenureAnalytics,
  getDailyRate,
  getSalaryStructure,
  isWeeklyOrPublicHoliday,
  validateNotBeforeJoiningDate,
} from './calculations';
import { answerLabourLawQuestion } from './labourLawHelper';
import { DEFAULT_SUBSCRIPTION_PLANS } from './subscriptionLogic';
import type { WorkerProfile } from '../types';

const mockProfile: WorkerProfile = {
  userId: 'u_test',
  fullName: 'মোঃ রহিম',
  phone: '01711000000',
  address: 'গাজীপুর',
  emergencyContact: '01811000000',
  factoryName: 'ডেল্টা নিটওয়্যার',
  factoryBranch: 'গাজীপুর',
  department: 'সুইং',
  designation: 'অপারেটর',
  employeeId: 'EMP-101',
  employmentType: 'permanent',
  joiningDate: '2026-11-20',
  salaryGrade: 'গ্রেড-৪',
  basicSalary: 6366,
  grossSalary: 12000,
  houseRentAllowance: 0, // legacy corrupt zero value to test auto-heal
  medicalAllowance: 750,
  transportAllowance: 450,
  foodAllowance: 1250,
  attendanceBonus: 500,
  otCalculationMode: 'formula',
  otWageBase: 'basic',
  otDivisor: 208,
  otMultiplier: 2,
  otCustomHourlyRate: 0,
  photoUrl: '',
  effectiveFrom: '2026-11-20',
  privacyConsent: true,
  language: 'bn',
  monthlyBudgetTarget: 10000,
  updatedAt: '2026-11-20T00:00:00.000Z',
};

describe('Audit Fixes Verification Suite', () => {
  it('getSalaryStructure auto-heals missing houseRentAllowance so Gross = Basic + Allowances exactly', () => {
    const s = getSalaryStructure(mockProfile);
    assert.equal(s.grossSalary, 12000);
    assert.equal(s.basicSalary, 6366);
    assert.equal(s.houseRentAllowance, 3184);
    assert.equal(
      s.basicSalary +
        s.houseRentAllowance +
        s.medicalAllowance +
        s.transportAllowance +
        s.foodAllowance,
      12000
    );
    assert.equal(getDailyRate(mockProfile), 400);
  });

  it('validateNotBeforeJoiningDate blocks dates prior to joiningDate and allows on/after joiningDate', () => {
    const invalid = validateNotBeforeJoiningDate('2026-11-19', '2026-11-20', 'bn');
    assert.equal(invalid.valid, false);
    assert.ok(invalid.error && invalid.error.length > 0);

    const sameDay = validateNotBeforeJoiningDate('2026-11-20', '2026-11-20', 'bn');
    assert.equal(sameDay.valid, true);

    const afterDay = validateNotBeforeJoiningDate('2026-11-25', '2026-11-20', 'en');
    assert.equal(afterDay.valid, true);
  });

  it('isWeeklyOrPublicHoliday detects Friday weekly holiday and Bangladesh public holidays', () => {
    // 2026-11-20 is a Friday
    const fri = isWeeklyOrPublicHoliday('2026-11-20');
    assert.equal(fri.isHoliday, true);
    assert.equal(fri.isWeeklyHoliday, true);

    // 2026-11-21 is a Saturday (normal working day)
    const sat = isWeeklyOrPublicHoliday('2026-11-21');
    assert.equal(sat.isHoliday, false);

    // 2026-12-16 Victory Day
    const victory = isWeeklyOrPublicHoliday('2026-12-16');
    assert.equal(victory.isHoliday, true);
    assert.equal(victory.isPublicHoliday, true);
  });

  it('computeWorkplaceTenureAnalytics shows day-1 tenure cleanly instead of 0 months', () => {
    const day1 = computeWorkplaceTenureAnalytics({
      workplace: {
        id: 'wp_1',
        factoryName: 'ডেল্টা নিটওয়্যার',
        designation: 'অপারেটর',
        joiningDate: '2026-11-20',
        isCurrent: true,
        grossSalary: 12000,
        basicSalary: 6366,
        createdAt: '2026-11-20',
      },
      profile: mockProfile,
      payments: [],
      overtime: [],
      attendance: [],
      todayISO: '2026-11-20',
    });
    assert.equal(day1.daysWorked, 1);
    assert.equal(day1.monthsWorked, 0);
    assert.equal(day1.formattedTenureBn, '১ দিন কর্মরত');
    assert.equal(day1.formattedTenureEn, '1 day tenure');
  });

  it('calculateSmartSalaryComparison omits attendance bonus praise when bonus amount is 0', () => {
    const res = calculateSmartSalaryComparison({
      currentMonthNet: 12612,
      previousMonthNet: 12612,
      currentOtHours: 10,
      previousOtHours: 10,
      currentOtEarnings: 612,
      previousOtEarnings: 612,
      absentDays: 0,
      lateDays: 0,
      attendanceBonusAmount: 0,
    });
    assert.ok(!res.insightsBn.some((r) => r.includes('হাজিরা বোনাস পুরোপুরি')));
  });

  it('answerLabourLawQuestion computes exact BDT total for Basic 6,700 & 40h OT', () => {
    const resBn = answerLabourLawQuestion('Basic 6,700 হলে 40 ঘণ্টা OT কত?', mockProfile, 'bn');
    assert.equal(resBn.usedQuestionNumbers, true);
    assert.equal(resBn.computedTotalBDT, 2576.92);
    assert.ok(resBn.answerBn.includes('২,৫৭৬.৯২') || resBn.answerBn.includes('2,576.92'));

    const resEn = answerLabourLawQuestion('Basic 6700 and 40 hours OT?', mockProfile, 'en');
    assert.equal(resEn.computedTotalBDT, 2576.92);
    assert.ok(resEn.answerEn.includes('2,576.92'));
  });

  it('DEFAULT_SUBSCRIPTION_PLANS starter_free has explicit subFeatures matching feature matrix honesty', () => {
    const starter = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.tier === 'starter_free');
    assert.ok(starter);
    assert.ok(starter.featureMatrix);
    assert.ok(starter.featureMatrix.salary.subFeatures);
    assert.equal(starter.featureMatrix.salary.subFeatures?.allowBasicSalaryBreakdown, true);
    assert.equal(starter.featureMatrix.salary.subFeatures?.allowPayslipPdf, false);
  });
});
