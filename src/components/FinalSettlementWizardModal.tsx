import React, { useMemo, useState } from 'react';
import { Check, Copy, Printer, Save, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  buildWorkerPrefillInputs,
  calculateExactServiceDuration,
  DEFAULT_LEGAL_RULE_VERSIONS,
  executeGarmentBenefitCalculation,
  EXPORT_DISCLAIMER_BN,
  saveUserCalculationRecord,
} from '../utils/garmentBenefitsEngine';
import {
  computeDailyEarnedSalary,
  formatBDT,
  getLoanRemainingBalance,
  getSalaryStructure,
  roundCurrency,
  summarizeOvertimeRecords,
  toBengaliDigits,
} from '../utils/calculations';
import { printElementSafely } from '../utils/printHelper';

interface FinalSettlementWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavedCalculation?: () => void;
}

type SeparationReason = 'resignation' | 'termination' | 'retrenchment' | 'retirement';

export const FinalSettlementWizardModal: React.FC<FinalSettlementWizardModalProps> = ({
  isOpen,
  onClose,
  onSavedCalculation,
}) => {
  const {
    lang,
    user,
    profile,
    attendance,
    overtime,
    salaryRecords,
    loans,
    todayISO,
    currentMonthISO,
  } = useData();

  const defaults = useMemo(
    () => buildWorkerPrefillInputs(profile, todayISO, attendance),
    [profile, attendance, todayISO]
  );

  // Sum active factory advances from app records
  const defaultAdvanceDeduction = useMemo(() => {
    const recAdv = salaryRecords.find((s) => s.month === currentMonthISO)?.advanceDeduction || 0;
    const factoryLoans = loans
      .filter((l) => !l.isArchived && l.lenderType === 'factory_advance')
      .reduce((sum, l) => sum + getLoanRemainingBalance(l), 0);
    return Math.round(recAdv + factoryLoans);
  }, [salaryRecords, currentMonthISO, loans]);

  // Compute current month's real earned salary + OT
  const currentMonthEarned = useMemo(() => {
    const struct = getSalaryStructure(profile);
    const monthAtt = attendance.filter((a) => a.month === currentMonthISO);
    const otSum = summarizeOvertimeRecords(overtime, currentMonthISO);
    if (monthAtt.length === 0 && otSum.monthlyEarnings === 0) return 0;
    const earned = computeDailyEarnedSalary({
      monthlyWage: struct.grossSalary,
      attendanceRecords: monthAtt,
      overtimeEarnings: otSum.monthlyEarnings,
      attendanceBonus: 0,
      isAttendanceBonusEligible: false,
    });
    return Math.round(earned.totalEarnedSalary);
  }, [profile, attendance, overtime, currentMonthISO]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState<SeparationReason>('resignation');
  const [joiningDate, setJoiningDate] = useState(String(defaults.joiningDate || todayISO));
  const [lastWorkingDate, setLastWorkingDate] = useState(todayISO);
  const [basicSalary, setBasicSalary] = useState(Number(defaults.basicSalary) || 0);
  const [houseRent, setHouseRent] = useState(Number(defaults.houseRentAllowance) || 0);
  const [medical, setMedical] = useState(Number(defaults.medicalAllowance) || 750);
  const [transport, setTransport] = useState(Number(defaults.transportAllowance) || 450);
  const [food, setFood] = useState(Number(defaults.foodAllowance) || 1250);
  const [unusedEarnedLeave, setUnusedEarnedLeave] = useState(
    Number(defaults.unusedAnnualLeaveDays) || 0
  );
  const [noticeGivenByWorkerOrEmployer, setNoticeGivenByWorkerOrEmployer] = useState(true);
  const [currentMonthPay, setCurrentMonthPay] = useState(currentMonthEarned);
  const [festivalBonusDue, setFestivalBonusDue] = useState(0);
  const [advanceDeduction, setAdvanceDeduction] = useState(defaultAdvanceDeduction);
  const [dateError, setDateError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const settlement = useMemo(() => {
    const ruleVersion = DEFAULT_LEGAL_RULE_VERSIONS[0];
    const duration = calculateExactServiceDuration(joiningDate, lastWorkingDate);
    const commonInputs: Record<string, string | number | boolean> = {
      workerName: profile.fullName || 'শ্রমিক',
      factoryName: profile.factoryName || '',
      department: profile.department || '',
      designation: profile.designation || '',
      employmentType: profile.employmentType || 'permanent',
      joiningDate,
      calculationDate: lastWorkingDate,
      basicSalary,
      houseRentAllowance: houseRent,
      medicalAllowance: medical,
      transportAllowance: transport,
      foodAllowance: food,
      unusedAnnualLeaveDays: unusedEarnedLeave,
      manualLeaveEarned: unusedEarnedLeave,
      leaveUsedDays: 0,
      leaveWageBasisMode: 'gross_30',
      noticeProvidedByEmployer: noticeGivenByWorkerOrEmployer,
      noticeDaysServedOrGiven: noticeGivenByWorkerOrEmployer ? 60 : 0,
    };

    // Reuse existing calculators from garmentBenefitsEngine (no duplicate formulas)
    let serviceBenefitBDT = 0;
    let serviceNoteBn = '';
    let serviceNoteEn = '';
    let noticeAdjustmentBDT = 0; // positive = receivable, negative = deduction

    if (reason === 'resignation') {
      const res = executeGarmentBenefitCalculation('resignation_benefit', commonInputs, ruleVersion);
      const svcItem = res.breakdownItems.find((b) => !b.isDeduction && b.amountBDT > 0);
      const dedItem = res.breakdownItems.find((b) => b.isDeduction && b.amountBDT > 0);
      serviceBenefitBDT = svcItem?.amountBDT || 0;
      serviceNoteBn =
        duration.completedYears < 5
          ? '৫ বছরের কম চাকরিতে স্বেচ্ছায় পদত্যাগে সার্ভিস বেনিফিট প্রযোজ্য নয়'
          : `${toBengaliDigits(duration.completedYears)} বছর চাকরির সার্ভিস বেনিফিট`;
      serviceNoteEn =
        duration.completedYears < 5
          ? 'Not eligible under 5 completed years for resignation'
          : `Service benefit for ${duration.completedYears} years`;
      if (!noticeGivenByWorkerOrEmployer && dedItem) {
        noticeAdjustmentBDT = -Math.abs(dedItem.amountBDT);
      }
    } else if (reason === 'retrenchment') {
      const res = executeGarmentBenefitCalculation('retrenchment_benefit', commonInputs, ruleVersion);
      const comp = res.breakdownItems.find((b) => b.labelEn.toLowerCase().includes('compensation'));
      const notice = res.breakdownItems.find((b) => b.labelEn.toLowerCase().includes('notice'));
      serviceBenefitBDT = comp?.amountBDT || 0;
      noticeAdjustmentBDT = !noticeGivenByWorkerOrEmployer ? notice?.amountBDT || 0 : 0;
      serviceNoteBn = 'ছাঁটাই ক্ষতিপূরণ (ধারা ২০)';
      serviceNoteEn = 'Retrenchment compensation (Sec 20)';
    } else if (reason === 'termination') {
      const res = executeGarmentBenefitCalculation('termination_benefit', commonInputs, ruleVersion);
      const comp = res.breakdownItems.find((b) => b.labelEn.toLowerCase().includes('benefit') || b.labelEn.toLowerCase().includes('compensation'));
      const notice = res.breakdownItems.find((b) => b.labelEn.toLowerCase().includes('notice'));
      serviceBenefitBDT = comp?.amountBDT || 0;
      noticeAdjustmentBDT = !noticeGivenByWorkerOrEmployer ? notice?.amountBDT || 0 : 0;
      serviceNoteBn = 'চাকরিচ্যুতি ক্ষতিপূরণ (ধারা ২৬)';
      serviceNoteEn = 'Termination compensation (Sec 26)';
    } else {
      const res = executeGarmentBenefitCalculation('service_benefit', commonInputs, ruleVersion);
      serviceBenefitBDT = res.totalEstimatedPayableBDT || 0;
      serviceNoteBn = 'অবসরকালীন সার্ভিস বেনিফিট';
      serviceNoteEn = 'Retirement service benefit';
    }

    const leaveRes = executeGarmentBenefitCalculation('annual_leave', commonInputs, ruleVersion);
    const leaveEncashBDT = leaveRes.totalEstimatedPayableBDT || 0;

    const grossTotal = roundCurrency(
      serviceBenefitBDT +
        leaveEncashBDT +
        Math.max(0, noticeAdjustmentBDT) +
        Math.max(0, currentMonthPay) +
        Math.max(0, festivalBonusDue)
    );
    const totalDeductions = roundCurrency(
      Math.max(0, advanceDeduction) + Math.abs(Math.min(0, noticeAdjustmentBDT))
    );
    const netEstimatedPayable = roundCurrency(Math.max(0, grossTotal - totalDeductions));

    return {
      duration,
      serviceBenefitBDT,
      serviceNoteBn,
      serviceNoteEn,
      leaveEncashBDT,
      noticeAdjustmentBDT,
      currentMonthPay: Math.max(0, currentMonthPay),
      festivalBonusDue: Math.max(0, festivalBonusDue),
      advanceDeduction: Math.max(0, advanceDeduction),
      grossTotal,
      totalDeductions,
      netEstimatedPayable,
      commonInputs,
    };
  }, [
    reason,
    joiningDate,
    lastWorkingDate,
    basicSalary,
    houseRent,
    medical,
    transport,
    food,
    unusedEarnedLeave,
    noticeGivenByWorkerOrEmployer,
    currentMonthPay,
    festivalBonusDue,
    advanceDeduction,
    profile,
  ]);

  if (!isOpen) return null;

  const reasonOptions: Array<{ id: SeparationReason; bn: string; en: string }> = [
    { id: 'resignation', bn: 'স্বেচ্ছায় পদত্যাগ', en: 'Voluntary Resignation' },
    { id: 'termination', bn: 'চাকরিচ্যুত', en: 'Termination' },
    { id: 'retrenchment', bn: 'ছাঁটাই', en: 'Retrenchment' },
    { id: 'retirement', bn: 'অবসর', en: 'Retirement' },
  ];

  const handleNextFromStep2 = () => {
    if (joiningDate && lastWorkingDate && lastWorkingDate < joiningDate) {
      setDateError(
        lang === 'bn'
          ? 'শেষ কর্মদিবস যোগদানের তারিখের আগে হতে পারবে না।'
          : 'Last working day cannot be before joining date.'
      );
      return;
    }
    setDateError('');
    setStep(3);
  };

  const handleCopySummary = async () => {
    const text = [
      lang === 'bn' ? 'চাকরি শেষের আনুমানিক হিসাব' : 'Final Settlement Estimate',
      `${lang === 'bn' ? 'চাকরিকাল' : 'Tenure'}: ${
        lang === 'bn' ? settlement.duration.formattedBn : settlement.duration.formattedEn
      }`,
      `${lang === 'bn' ? 'সার্ভিস বেনিফিট' : 'Service Benefit'}: ${formatBDT(settlement.serviceBenefitBDT, lang)}`,
      `${lang === 'bn' ? 'অর্জিত ছুটির টাকা' : 'Earned Leave Encashment'}: ${formatBDT(settlement.leaveEncashBDT, lang)}`,
      `${lang === 'bn' ? 'চলতি মাসের বেতন ও ওটি' : 'Current Month Pay & OT'}: ${formatBDT(settlement.currentMonthPay, lang)}`,
      settlement.noticeAdjustmentBDT !== 0
        ? `${lang === 'bn' ? 'নোটিশ সমন্বয়' : 'Notice Adjustment'}: ${settlement.noticeAdjustmentBDT > 0 ? '+' : '-'}${formatBDT(Math.abs(settlement.noticeAdjustmentBDT), lang)}`
        : null,
      settlement.festivalBonusDue > 0
        ? `${lang === 'bn' ? 'উৎসব বোনাস' : 'Festival Bonus'}: ${formatBDT(settlement.festivalBonusDue, lang)}`
        : null,
      settlement.advanceDeduction > 0
        ? `${lang === 'bn' ? 'অগ্রিম/ঋণ কর্তন' : 'Advance Deduction'}: -${formatBDT(settlement.advanceDeduction, lang)}`
        : null,
      '',
      `${lang === 'bn' ? 'মোট আনুমানিক পাওনা' : 'Total Estimated Due'}: ${formatBDT(settlement.netEstimatedPayable, lang)}`,
      '',
      EXPORT_DISCLAIMER_BN,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  };

  const handleSaveResult = () => {
    const output = executeGarmentBenefitCalculation('final_settlement', {
      ...settlement.commonInputs,
      separationModeForFinalSettlement: reason === 'retirement' ? 'resignation' : reason,
      otherLawfulDuesBDT: settlement.currentMonthPay + settlement.festivalBonusDue,
      lawfulAdvanceDeductionBDT: settlement.advanceDeduction,
    });
    saveUserCalculationRecord(user?.uid || profile.userId || 'local', {
      id: `calc_wizard_${Date.now()}`,
      userId: user?.uid || profile.userId || 'local',
      calculatorId: 'final_settlement',
      calculatorTitleBn: 'চাকরি শেষের হিসাব',
      calculationDate: lastWorkingDate,
      createdAtISO: new Date().toISOString(),
      inputs: settlement.commonInputs,
      output: {
        ...output,
        totalEstimatedPayableBDT: settlement.netEstimatedPayable,
      },
    });
    setSaved(true);
    onSavedCalculation?.();
  };

  const handlePrint = () => {
    const el = document.getElementById('final-settlement-print-sheet');
    if (el) {
      void printElementSafely({
        element: el,
        title: lang === 'bn' ? 'চাকরি শেষের হিসাব' : 'Final Settlement',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-xl max-h-[92dvh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Clean Header (No Subtitle) */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
              {lang === 'bn' ? 'চাকরি শেষের হিসাব' : 'Final Settlement'}
            </h2>
            <div className="flex items-center gap-1">
              {([1, 2, 3] as const).map((s) => (
                <span
                  key={s}
                  className={`w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center ${
                    step === s
                      ? 'bg-emerald-700 text-white'
                      : step > s
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {lang === 'bn' ? toBengaliDigits(s) : s}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            className="w-10 h-10 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* STEP 1: REASON & SALARY */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'bn' ? 'চাকরি ছাড়ার কারণ' : 'Reason for Leaving'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {reasonOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReason(opt.id)}
                      className={`min-h-[46px] px-3 py-2.5 rounded-xl border text-xs font-bold text-center transition-colors cursor-pointer ${
                        reason === opt.id
                          ? 'bg-emerald-700 border-emerald-700 text-white'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {lang === 'bn' ? opt.bn : opt.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}
                  </label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'মূল বেতন (৳)' : 'Basic Salary (৳)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={basicSalary}
                    onChange={(e) => {
                      const b = Math.max(0, Number(e.target.value) || 0);
                      setBasicSalary(b);
                      setHouseRent(Math.round(b * 0.5));
                    }}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'বাড়ি ভাড়া' : 'House Rent'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={houseRent}
                    onChange={(e) => setHouseRent(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'চিকিৎসা' : 'Medical'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={medical}
                    onChange={(e) => setMedical(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'যাতায়াত' : 'Transport'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={transport}
                    onChange={(e) => setTransport(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'খাদ্য' : 'Food'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={food}
                    onChange={(e) => setFood(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LAST DAY, LEAVE, DUES & DEDUCTIONS */}
          {step === 2 && (
            <div className="space-y-4">
              {dateError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3.5 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                  {dateError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'শেষ কর্মদিবস' : 'Last Working Day'}
                  </label>
                  <input
                    type="date"
                    value={lastWorkingDate}
                    min={joiningDate || undefined}
                    onChange={(e) => {
                      setLastWorkingDate(e.target.value);
                      setDateError('');
                    }}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'অব্যবহৃত অর্জিত ছুটি (দিন)' : 'Unused Earned Leave (days)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={unusedEarnedLeave}
                    onChange={(e) => setUnusedEarnedLeave(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'চলতি মাসের বেতন ও ওটি (৳)' : 'Current Month Pay & OT (৳)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={currentMonthPay}
                    onChange={(e) => setCurrentMonthPay(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'উৎসব বোনাস (যদি থাকে)' : 'Festival Bonus (if any)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={festivalBonusDue}
                    onChange={(e) => setFestivalBonusDue(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'অগ্রিম / ঋণ কর্তন (৳)' : 'Advance / Loan Deduction (৳)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={advanceDeduction}
                    onChange={(e) => setAdvanceDeduction(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold tabular-nums"
                  />
                </div>
              </div>

              {reason !== 'retirement' && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noticeGivenByWorkerOrEmployer}
                    onChange={(e) => setNoticeGivenByWorkerOrEmployer(e.target.checked)}
                    className="w-4 h-4 accent-emerald-700"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {reason === 'resignation'
                      ? lang === 'bn'
                        ? 'আইনি নোটিশ (৬০ দিন) দিয়ে পদত্যাগ করছি'
                        : 'Serving statutory notice period (60 days)'
                      : lang === 'bn'
                      ? 'প্রতিষ্ঠান আগে থেকে নোটিশ দিয়েছে'
                      : 'Employer provided advance notice'}
                  </span>
                </label>
              )}
            </div>
          )}

          {/* STEP 3: PAYSLIP-STYLE FINAL SETTLEMENT RESULT */}
          {step === 3 && (
            <div id="final-settlement-print-sheet" className="space-y-4">
              <div className="rounded-2xl bg-emerald-700 text-white p-5">
                <div className="flex items-center justify-between text-xs text-emerald-100 font-semibold">
                  <span>{lang === 'bn' ? 'মোট আনুমানিক পাওনা' : 'Total Estimated Due'}</span>
                  <span>
                    {lang === 'bn' ? settlement.duration.formattedBn : settlement.duration.formattedEn}
                  </span>
                </div>
                <p className="mt-1.5 text-3xl font-extrabold tabular-nums">
                  {formatBDT(settlement.netEstimatedPayable, lang)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'সার্ভিস বেনিফিট' : 'Service Benefit'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? settlement.serviceNoteBn : settlement.serviceNoteEn}
                    </p>
                  </div>
                  <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {formatBDT(settlement.serviceBenefitBDT, lang)}
                  </span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? `অর্জিত ছুটির টাকা (${toBengaliDigits(unusedEarnedLeave)} দিন)`
                      : `Earned Leave Encashment (${unusedEarnedLeave} d)`}
                  </span>
                  <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {formatBDT(settlement.leaveEncashBDT, lang)}
                  </span>
                </div>

                {settlement.noticeAdjustmentBDT !== 0 && (
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {settlement.noticeAdjustmentBDT > 0
                        ? lang === 'bn'
                          ? 'নোটিশ বেতন (পাওনা)'
                          : 'Notice Pay (Receivable)'
                        : lang === 'bn'
                        ? 'নোটিশ কর্তন'
                        : 'Notice Pay Deduction'}
                    </span>
                    <span
                      className={`font-extrabold tabular-nums ${
                        settlement.noticeAdjustmentBDT < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {settlement.noticeAdjustmentBDT > 0 ? '+' : '-'}
                      {formatBDT(Math.abs(settlement.noticeAdjustmentBDT), lang)}
                    </span>
                  </div>
                )}

                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'চলতি মাসের অর্জিত বেতন ও ওটি' : 'Current Month Pay & OT'}
                  </span>
                  <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {formatBDT(settlement.currentMonthPay, lang)}
                  </span>
                </div>

                {settlement.festivalBonusDue > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'উৎসব বোনাস' : 'Festival Bonus'}
                    </span>
                    <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {formatBDT(settlement.festivalBonusDue, lang)}
                    </span>
                  </div>
                )}

                {settlement.advanceDeduction > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <span className="font-bold text-rose-700 dark:text-rose-300">
                      {lang === 'bn' ? 'অগ্রিম / ঋণ কর্তন' : 'Advance / Loan Deduction'}
                    </span>
                    <span className="font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                      -{formatBDT(settlement.advanceDeduction, lang)}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {EXPORT_DISCLAIMER_BN}
              </p>
            </div>
          )}
        </div>

        {/* Clean Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold cursor-pointer"
              >
                {lang === 'bn' ? 'পরবর্তী' : 'Next'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                {lang === 'bn' ? 'পেছনে' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleNextFromStep2}
                className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold cursor-pointer"
              >
                {lang === 'bn' ? 'হিসাব দেখুন' : 'Calculate'}
              </button>
            </>
          )}

          {step === 3 && (
            <div className="w-full flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {lang === 'bn' ? 'সম্পাদনা' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => void handleCopySummary()}
                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : lang === 'bn' ? 'কপি' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
              </button>
              <button
                type="button"
                disabled={saved}
                onClick={handleSaveResult}
                className="flex-1 h-10 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>
                  {saved
                    ? lang === 'bn'
                      ? 'সংরক্ষিত'
                      : 'Saved'
                    : lang === 'bn'
                    ? 'সংরক্ষণ করুন'
                    : 'Save'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
