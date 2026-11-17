import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkerPrefillInputs,
  calculateExactServiceDuration,
  DEFAULT_CALCULATOR_CATALOG,
  DEFAULT_LEGAL_RULE_VERSIONS,
  executeGarmentBenefitCalculation,
  EXPORT_DISCLAIMER_BN,
  INSUFFICIENT_INFO_MESSAGE_BN,
  resolveStatutoryWageBasis,
} from './garmentBenefitsEngine';

describe('Garments Salary, Wage & Employee Benefits Calculation Engine', () => {
  it('calculates leap-year aware service duration accurately and rounds gratuity years when >6 months', () => {
    const dur1 = calculateExactServiceDuration('2020-02-29', '2026-09-15');
    assert.equal(dur1.valid, true);
    assert.equal(dur1.completedYears, 6);
    assert.equal(dur1.additionalMonths, 6);
    assert.ok(dur1.additionalDays > 0);
    // 6 years + 6 months + 17 days -> exceeds 6 months -> gratuityRoundedYears = 7
    assert.equal(dur1.gratuityRoundedYears, 7);

    // Invalid date or end < start
    const durInvalid = calculateExactServiceDuration('2026-10-01', '2024-01-01');
    assert.equal(durInvalid.valid, false);
  });

  it('resolves statutory wage bases (Basic, Gross, Sec 119 Leave Wage, Daily & Hourly rates)', () => {
    const basis = resolveStatutoryWageBasis({
      basicSalary: 6700,
      houseRentAllowance: 3350,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
    });

    assert.equal(basis.basicSalary, 6700);
    assert.equal(basis.grossSalary, 12500);
    // Sec 119 excludes transport allowance (450) -> 12500 - 450 = 12050
    assert.equal(basis.statutoryLeaveWageMonthly, 12050);
    assert.equal(basis.dailyBasic30, 223.33);
    assert.equal(basis.dailyGross30, 416.67);
    assert.equal(basis.hourlyOtRate2x, 64.42);
  });

  it('A. Annual Leave Payment Calculator (Sec 117 & 119) calculates unused leave encashment and caps at 40 days', () => {
    const res = executeGarmentBenefitCalculation('annual_leave', {
      basicSalary: 6700,
      houseRentAllowance: 3350,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
      totalDaysWorkedInPeriod: 288, // 288 / 18 = 16 days earned
      manualLeaveEarned: 0,
      leaveUsedDays: 4, // 12 unused days
      leaveWageBasisMode: 'statutory_sec119',
    });

    assert.equal(res.isComplete, true);
    assert.equal(res.isEligible, true);
    // 12 days * (12050 / 30 = 401.67) = 4820.04
    assert.equal(res.totalEstimatedPayableBDT, 4820.04);
  });

  it('B. Maternity Benefit Calculator (Sec 45-50) enforces >=6 months service and <2 living children eligibility', () => {
    // Eligible case: 2 years service, 1 living child
    const eligibleRes = executeGarmentBenefitCalculation('maternity_benefit', {
      basicSalary: 6700,
      houseRentAllowance: 3350,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
      joiningDate: '2024-01-01',
      expectedDeliveryDate: '2026-10-01',
      livingChildrenCount: 1,
      priorThreeMonthsTotalWages: 37500,
      priorThreeMonthsDaysWorked: 75, // 500 BDT/day -> 112 days = 56,000 BDT
      noticeGivenToEmployer: true,
    });

    assert.equal(eligibleRes.isComplete, true);
    assert.equal(eligibleRes.isEligible, true);
    assert.equal(eligibleRes.totalEstimatedPayableBDT, 56000);

    // Ineligible case: 2 or more living children
    const ineligibleRes = executeGarmentBenefitCalculation('maternity_benefit', {
      basicSalary: 6700,
      houseRentAllowance: 3350,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
      joiningDate: '2024-01-01',
      expectedDeliveryDate: '2026-10-01',
      livingChildrenCount: 2,
    });
    assert.equal(ineligibleRes.isEligible, false);
    assert.equal(ineligibleRes.totalEstimatedPayableBDT, 0);
  });

  it('C. Service Benefit Calculator (Sec 27(4) & Sec 2(10)) handles <5 yrs, 5-9 yrs (14d/yr), and 10+ yrs (30d/yr)', () => {
    // 6 years service -> 6 * 14 days basic
    const tier1 = executeGarmentBenefitCalculation('service_benefit', {
      basicSalary: 6000, // dailyBasic30 = 200
      houseRentAllowance: 3000,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
      joiningDate: '2020-01-01',
      calculationDate: '2026-03-01',
      employmentType: 'permanent',
      hasGratuityPolicy: false,
      alreadyPaidAdvanceBDT: 800,
    });
    assert.equal(tier1.isEligible, true);
    // 6 * 14 * 200 = 16,800 - 800 advance = 16,000
    assert.equal(tier1.totalEstimatedPayableBDT, 16000);

    // 11 years service -> 11 * 30 days basic = 66,000
    const tier2 = executeGarmentBenefitCalculation('service_benefit', {
      basicSalary: 6000,
      houseRentAllowance: 3000,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
      joiningDate: '2015-01-01',
      calculationDate: '2026-03-01',
      employmentType: 'permanent',
      hasGratuityPolicy: false,
      alreadyPaidAdvanceBDT: 0,
    });
    assert.equal(tier2.totalEstimatedPayableBDT, 66000);
  });

  it('D. Retrenchment & E. Termination Calculators compute statutory notice pay and compensation', () => {
    // Retrenchment without notice after 3 years (Basic 6000 -> dailyBasic 200)
    // Compensation: 3 * 30 * 200 = 18,000 + Notice Pay (6,000) = 24,000
    const retrench = executeGarmentBenefitCalculation('retrenchment_benefit', {
      basicSalary: 6000,
      houseRentAllowance: 3000,
      medicalAllowance: 0,
      transportAllowance: 0,
      foodAllowance: 0,
      joiningDate: '2023-01-01',
      calculationDate: '2026-02-01',
      noticeProvidedByEmployer: false,
      unusedAnnualLeaveDays: 0,
    });
    assert.equal(retrench.isEligible, true);
    assert.equal(retrench.totalEstimatedPayableBDT, 24000);

    // Termination Sec 26 Permanent without notice after 4 years
    // 120 days notice (24,000) + 4 * 30 * 200 (24,000) = 48,000
    const term = executeGarmentBenefitCalculation('termination_benefit', {
      basicSalary: 6000,
      houseRentAllowance: 3000,
      medicalAllowance: 0,
      transportAllowance: 0,
      foodAllowance: 0,
      joiningDate: '2022-01-01',
      calculationDate: '2026-02-01',
      terminationCategory: 'employer_section_26_permanent',
      noticeProvidedByEmployer: false,
      unusedAnnualLeaveDays: 0,
    });
    assert.equal(term.isEligible, true);
    assert.equal(term.totalEstimatedPayableBDT, 48000);
  });

  it('F. Death Compensation Calculator (Sec 19 & Sec 150) computes normal vs workplace accident death compensation', () => {
    // Workplace accident after 3 years (Basic 6000 -> daily 200)
    // Sec 19 duty accident: 3 * 45 * 200 = 27,000 + Sec 150 grant 200,000 = 227,000
    const deathAcc = executeGarmentBenefitCalculation('death_compensation', {
      basicSalary: 6000,
      houseRentAllowance: 3000,
      medicalAllowance: 0,
      transportAllowance: 0,
      foodAllowance: 0,
      joiningDate: '2023-01-01',
      calculationDate: '2026-02-01',
      deathDuringEmployment: true,
      deathByWorkplaceAccident: true,
      unusedAnnualLeaveDays: 0,
    });
    assert.equal(deathAcc.isEligible, true);
    assert.equal(deathAcc.totalEstimatedPayableBDT, 227000);
  });

  it('Combined Final Settlement Calculator prevents double-counting of separation benefits', () => {
    const settlement = executeGarmentBenefitCalculation('final_settlement', {
      basicSalary: 6000,
      houseRentAllowance: 3000,
      medicalAllowance: 0,
      transportAllowance: 0,
      foodAllowance: 0,
      joiningDate: '2020-01-01',
      calculationDate: '2026-02-01', // 6 years
      separationModeForFinalSettlement: 'resignation',
      unpaidSalaryDays: 15, // 15 * (9000/30 = 300) = 4500
      unpaidOvertimeHours: 0,
      unusedAnnualLeaveDays: 0,
      lawfulAdvanceDeductionBDT: 500,
    });

    assert.equal(settlement.isComplete, true);
    // Resignation at 6 yrs = 6 * 14 * 200 = 16,800 + 4,500 unpaid salary - 500 advance = 20,800
    assert.equal(settlement.totalEstimatedPayableBDT, 20800);
    // Must include an explicit exclusion item showing double counting was prevented
    assert.ok(settlement.breakdownItems.some((item) => item.isExcluded));
  });

  it('returns the exact required Bengali insufficient info safeguard when basic salary or dates are invalid', () => {
    const invalid = executeGarmentBenefitCalculation('service_benefit', {
      basicSalary: 0,
      joiningDate: 'invalid-date',
    });
    assert.equal(invalid.isComplete, false);
    assert.equal(invalid.incompleteMessageBn, INSUFFICIENT_INFO_MESSAGE_BN);
    assert.ok(EXPORT_DISCLAIMER_BN.includes('আনুমানিক হিসাব'));
    assert.equal(DEFAULT_CALCULATOR_CATALOG.length, 20);
    assert.ok(DEFAULT_LEGAL_RULE_VERSIONS.length >= 2);

    const prefill = buildWorkerPrefillInputs({ fullName: 'রহিমা আক্তার', basicSalary: 6700 }, '2026-10-28');
    assert.equal(prefill.workerName, 'রহিমা আক্তার');
  });
});
