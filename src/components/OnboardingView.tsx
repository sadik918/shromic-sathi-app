import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  Banknote,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Moon,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { WeeklyHolidayDay, WorkShiftPattern } from '../types';
import {
  DEFAULT_RMG_HOURLY_OT_RATE,
  computeOnboardingOvertimeBreakdown,
  deriveBangladeshRMGBreakdownFromGross,
  formatBDT,
  formatTakaPaisaLabel,
  roundCurrency,
  toBengaliDigits,
  validateOnboardingStepTransition,
} from '../utils/calculations';
import { DateInputDMY } from './DateInputDMY';

type OnboardingStep = 1 | 2 | 3;

const ALL_WEEKDAYS: Array<{ id: WeeklyHolidayDay; bn: string; en: string }> = [
  { id: 'friday', bn: 'শুক্রবার', en: 'Friday' },
  { id: 'saturday', bn: 'শনিবার', en: 'Saturday' },
  { id: 'sunday', bn: 'রবিবার', en: 'Sunday' },
  { id: 'monday', bn: 'সোমবার', en: 'Monday' },
  { id: 'tuesday', bn: 'মঙ্গলবার', en: 'Tuesday' },
  { id: 'wednesday', bn: 'বুধবার', en: 'Wednesday' },
  { id: 'thursday', bn: 'বৃহস্পতিবার', en: 'Thursday' },
];

export const OnboardingView: React.FC = () => {
  const { profile, lang, isManualSetupMode, completeOnboarding } = useData();
  const isBn = lang === 'bn';

  const [step, setStep] = useState<OnboardingStep>(1);

  const hasExistingSetup = Boolean(
    (profile.grossSalary && profile.grossSalary > 0) ||
      (profile.basicSalary && profile.basicSalary > 0)
  );

  // Step 1: Salary, Joining Date & Overtime
  const [grossSalaryInput, setGrossSalaryInput] = useState<string>(
    profile.grossSalary && profile.grossSalary > 0 ? String(profile.grossSalary) : ''
  );
  const [basicSalaryInput, setBasicSalaryInput] = useState<string>(
    profile.basicSalary && profile.basicSalary > 0 ? String(profile.basicSalary) : ''
  );
  const [isBasicManuallyEdited, setIsBasicManuallyEdited] = useState<boolean>(
    Boolean(profile.basicSalary && profile.basicSalary > 0)
  );
  const [joiningDate, setJoiningDate] = useState<string>(
    hasExistingSetup && profile.joiningDate ? profile.joiningDate : ''
  );
  const [salaryGrade, setSalaryGrade] = useState<string>(profile.salaryGrade || '');
  const [otRateInput, setOtRateInput] = useState<string>(
    hasExistingSetup && profile.otCustomHourlyRate && profile.otCustomHourlyRate > 0
      ? String(profile.otCustomHourlyRate)
      : ''
  );
  const [isOtRateManuallyEdited, setIsOtRateManuallyEdited] = useState<boolean>(
    Boolean(hasExistingSetup && profile.otCustomHourlyRate && profile.otCustomHourlyRate > 0)
  );
  const [isOtRateConfirmed, setIsOtRateConfirmed] = useState<boolean>(hasExistingSetup);

  // Step 2: Address & Workplace (All empty by default)
  const [factoryName, setFactoryName] = useState<string>(profile.factoryName || '');
  const [factoryBranch, setFactoryBranch] = useState<string>(profile.factoryBranch || '');
  const [department, setDepartment] = useState<string>(profile.department || '');
  const [designation, setDesignation] = useState<string>(profile.designation || '');
  const [employeeId, setEmployeeId] = useState<string>(profile.employeeId || '');
  const [address, setAddress] = useState<string>(profile.address || '');
  const [phone, setPhone] = useState<string>(profile.phone || '');

  // Validation error states (triggered during manual setup mode when required fields are empty)
  const [grossSalaryError, setGrossSalaryError] = useState<string>('');
  const [joiningDateError, setJoiningDateError] = useState<string>('');
  const [otRateError, setOtRateError] = useState<string>('');
  const [factoryNameError, setFactoryNameError] = useState<string>('');
  const [factoryBranchError, setFactoryBranchError] = useState<string>('');

  const grossInputRef = useRef<HTMLInputElement | null>(null);
  const otInputRef = useRef<HTMLInputElement | null>(null);
  const otConfirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const factoryInputRef = useRef<HTMLInputElement | null>(null);
  const branchInputRef = useRef<HTMLInputElement | null>(null);

  // Step 3: Required Settings & Attendance Bonus Rules
  const [shiftPattern, setShiftPattern] = useState<WorkShiftPattern>(
    profile.shiftPattern || 'day'
  );
  const [attendanceBonusEnabled, setAttendanceBonusEnabled] = useState<boolean>(
    Boolean(profile.hasAttendanceBonus && (profile.attendanceBonus || 0) > 0)
  );
  const [attendanceBonusInput, setAttendanceBonusInput] = useState<string>(
    profile.attendanceBonus && profile.attendanceBonus > 0
      ? String(profile.attendanceBonus)
      : ''
  );

  // Cutoff / Missing Time toggle & values (e.g. Day 08:05, Night 20:05)
  const [bonusCutoffEnabled, setBonusCutoffEnabled] = useState<boolean>(
    Boolean(profile.bonusCutoffTimeEnabled)
  );
  const [dayCutoffTime, setDayCutoffTime] = useState<string>(
    profile.dayBonusCutoffTime || profile.attendanceWindowEndDay || '08:05'
  );
  const [nightCutoffTime, setNightCutoffTime] = useState<string>(
    profile.nightBonusCutoffTime || profile.attendanceWindowEndNight || '20:05'
  );

  // Late days penalty toggle & limit (e.g. 1 day or 3 days)
  const [latePenaltyEnabled, setLatePenaltyEnabled] = useState<boolean>(
    Boolean(profile.latePenaltyEnabled)
  );
  const [maxLateDays, setMaxLateDays] = useState<number>(
    profile.maxLateDaysForBonus || 3
  );

  // All 7 days Weekly Holiday
  const [weeklyHolidayDay, setWeeklyHolidayDay] = useState<WeeklyHolidayDay>(
    profile.weeklyHolidayDay || 'friday'
  );

  // Expected Pay Day (7, 10, 15, or custom)
  const initialPayDay = profile.expectedPayDay || 7;
  const isPresetPayDay = [7, 10, 15].includes(initialPayDay);
  const [payDayMode, setPayDayMode] = useState<'preset' | 'custom'>(
    isPresetPayDay ? 'preset' : 'custom'
  );
  const [expectedPayDay, setExpectedPayDay] = useState<number>(initialPayDay);
  const [customPayDayInput, setCustomPayDayInput] = useState<string>(
    isPresetPayDay ? '' : String(initialPayDay)
  );

  // Monthly Expense Budget (Optional, empty by default)
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState<string>(
    profile.monthlyBudgetTarget && profile.monthlyBudgetTarget > 0
      ? String(profile.monthlyBudgetTarget)
      : ''
  );

  const [saving, setSaving] = useState<boolean>(false);

  const parsedGross = Math.max(0, Number(grossSalaryInput) || 0);
  const parsedBasic = Math.max(0, Number(basicSalaryInput) || 0);
  const parsedOtRate = Math.max(0, Number(otRateInput) || 0);
  const parsedBonus = Math.max(0, Number(attendanceBonusInput) || 0);
  const parsedBudget = Math.max(0, Number(monthlyBudgetInput) || 0);

  const otBreakdown = computeOnboardingOvertimeBreakdown({
    grossSalary: parsedGross,
    basicSalary: parsedBasic,
    customOtRate: parsedOtRate > 0 ? parsedOtRate : undefined,
  });

  const displayOtRate = parsedOtRate > 0 ? otBreakdown.hourlyOtRate : 0;

  const handleGrossSalaryChange = (val: string) => {
    setGrossSalaryInput(val);
    const numGross = Math.max(0, Number(val) || 0);
    if (numGross > 0) {
      setGrossSalaryError('');
      const derivedBasic =
        numGross >= 2450
          ? deriveBangladeshRMGBreakdownFromGross(numGross).basicSalary
          : Math.round(numGross * 0.55);
      if (!isBasicManuallyEdited) {
        setBasicSalaryInput(String(derivedBasic));
      }
      if (!isOtRateManuallyEdited) {
        const nextBasic =
          isBasicManuallyEdited && parsedBasic > 0 ? parsedBasic : derivedBasic;
        const exactOt = roundCurrency((nextBasic / 208) * 2);
        setOtRateInput(exactOt.toFixed(2));
        setIsOtRateConfirmed(false);
        setOtRateError('');
      }
    } else {
      if (!isBasicManuallyEdited) {
        setBasicSalaryInput('');
      }
      if (!isOtRateManuallyEdited) {
        setOtRateInput('');
        setIsOtRateConfirmed(false);
      }
    }
  };

  const handleBasicSalaryChange = (val: string) => {
    setBasicSalaryInput(val);
    const hasVal = val.trim().length > 0;
    setIsBasicManuallyEdited(hasVal);
    const numBasic = Math.max(0, Number(val) || 0);
    if (!isOtRateManuallyEdited) {
      if (numBasic > 0) {
        const exactOt = roundCurrency((numBasic / 208) * 2);
        setOtRateInput(exactOt.toFixed(2));
        setIsOtRateConfirmed(false);
      } else if (parsedGross > 0) {
        const derivedBasic =
          parsedGross >= 2450
            ? deriveBangladeshRMGBreakdownFromGross(parsedGross).basicSalary
            : Math.round(parsedGross * 0.55);
        const exactOt = roundCurrency((derivedBasic / 208) * 2);
        setOtRateInput(exactOt.toFixed(2));
        setIsOtRateConfirmed(false);
      } else {
        setOtRateInput('');
        setIsOtRateConfirmed(false);
      }
    }
  };

  const handleOtRateChange = (val: string) => {
    setOtRateInput(val);
    setIsOtRateManuallyEdited(val.trim().length > 0);
    setIsOtRateConfirmed(false);
    if (Number(val) > 0) {
      setOtRateError('');
    }
  };

  const handleConfirmOtRate = () => {
    setIsOtRateConfirmed(true);
    setOtRateError('');
  };

  const handleNextStep = () => {
    const check = validateOnboardingStepTransition({
      step,
      isManualSetupMode,
      grossSalaryInput,
      basicSalaryInput,
      joiningDate,
      otRateInput,
      isOtRateConfirmed,
      factoryName,
      factoryBranch,
      lang,
    });

    if (!check.canAdvance) {
      setGrossSalaryError(check.grossSalaryError || '');
      setJoiningDateError(check.joiningDateError || '');
      setOtRateError(check.otRateError || '');
      setFactoryNameError(check.factoryNameError || '');
      setFactoryBranchError(check.factoryBranchError || '');

      if (check.focusField === 'grossSalary') {
        grossInputRef.current?.focus();
      } else if (check.focusField === 'joiningDate') {
        document.getElementById('onb-joining-date')?.focus();
      } else if (check.focusField === 'otRate') {
        otInputRef.current?.focus();
      } else if (check.focusField === 'otRateConfirm') {
        otConfirmBtnRef.current?.focus();
      } else if (check.focusField === 'factoryName') {
        factoryInputRef.current?.focus();
      } else if (check.focusField === 'factoryBranch') {
        branchInputRef.current?.focus();
      }
      return;
    }

    setGrossSalaryError('');
    setJoiningDateError('');
    setOtRateError('');
    setFactoryNameError('');
    setFactoryBranchError('');

    if (step < 3) {
      setStep((prev) => (prev + 1) as OnboardingStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setGrossSalaryError('');
    setJoiningDateError('');
    setOtRateError('');
    setFactoryNameError('');
    setFactoryBranchError('');
    if (step > 1) {
      setStep((prev) => (prev - 1) as OnboardingStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNextStep();
      return;
    }
    setSaving(true);
    try {
      const split =
        parsedGross >= 2450
          ? deriveBangladeshRMGBreakdownFromGross(parsedGross)
          : {
              basicSalary: parsedBasic > 0 ? parsedBasic : Math.round(parsedGross * 0.55),
              houseRentAllowance: 0,
              medicalAllowance: 0,
              transportAllowance: 0,
              foodAllowance: 0,
            };

      const finalBasic = parsedBasic > 0 ? parsedBasic : split.basicSalary;
      const finalOtRate =
        parsedOtRate > 0 ? otBreakdown.hourlyOtRate : DEFAULT_RMG_HOURLY_OT_RATE;

      const resolvedPayDay =
        payDayMode === 'custom'
          ? Math.min(31, Math.max(1, Number(customPayDayInput) || 7))
          : expectedPayDay;

      await completeOnboarding({
        grossSalary: parsedGross,
        basicSalary: finalBasic,
        houseRentAllowance: parsedGross >= 2450 ? split.houseRentAllowance : 0,
        medicalAllowance: parsedGross >= 2450 ? split.medicalAllowance : 0,
        transportAllowance: parsedGross >= 2450 ? split.transportAllowance : 0,
        foodAllowance: parsedGross >= 2450 ? split.foodAllowance : 0,
        hasAttendanceBonus: attendanceBonusEnabled,
        attendanceBonus: attendanceBonusEnabled ? parsedBonus : 0,
        attendanceBonusAmount: attendanceBonusEnabled ? parsedBonus : 0,
        bonusCutoffTimeEnabled: attendanceBonusEnabled ? bonusCutoffEnabled : false,
        dayBonusCutoffTime: dayCutoffTime || '08:05',
        nightBonusCutoffTime: nightCutoffTime || '20:05',
        attendanceWindowStartDay: '07:30',
        attendanceWindowEndDay: dayCutoffTime || '08:05',
        attendanceWindowStartNight: '19:30',
        attendanceWindowEndNight: nightCutoffTime || '20:05',
        latePenaltyEnabled: attendanceBonusEnabled ? latePenaltyEnabled : false,
        maxLateDaysForBonus: maxLateDays,
        joiningDate: joiningDate || new Date().toISOString().slice(0, 10),
        address: address.trim(),
        phone: phone.trim(),
        factoryName: factoryName.trim(),
        factoryBranch: factoryBranch.trim(),
        department: department.trim(),
        designation: designation.trim(),
        employeeId: employeeId.trim(),
        salaryGrade: salaryGrade.trim(),
        shiftPattern,
        dayShiftStartTime: '08:00',
        nightShiftStartTime: '20:00',
        weeklyHolidayDay,
        expectedPayDay: resolvedPayDay,
        monthlyBudgetTarget: parsedBudget,
        otCalculationMode: 'manual',
        otCustomHourlyRate: finalOtRate,
        privacyConsent: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const stepsMeta: Array<{
    id: OnboardingStep;
    stepBadgeBn: string;
    stepBadgeEn: string;
    shortBn: string;
    shortEn: string;
  }> = [
    {
      id: 1,
      stepBadgeBn: 'ধাপ ১/৩',
      stepBadgeEn: 'Step 1/3',
      shortBn: 'বেতন ও ওভারটাইম',
      shortEn: 'Salary & OT',
    },
    {
      id: 2,
      stepBadgeBn: 'ধাপ ২/৩',
      stepBadgeEn: 'Step 2/3',
      shortBn: 'ঠিকানা ও কর্মস্থল',
      shortEn: 'Workplace',
    },
    {
      id: 3,
      stepBadgeBn: 'ধাপ ৩/৩',
      stepBadgeEn: 'Step 3/3',
      shortBn: 'প্রয়োজনীয় সেটিংস',
      shortEn: 'Settings',
    },
  ];

  const activeStepMeta = stepsMeta[step - 1];

  return (
    <div
      data-testid="onboarding-view"
      className="min-h-screen bg-slate-100/80 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-start sm:justify-center items-center px-2.5 py-3 sm:px-6 sm:py-8"
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
        {/* Smooth Top Progress Bar */}
        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-emerald-600 transition-all duration-300 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5">
          {/* Header Row: Step Page Indicator (ধাপ ১/৩ -> ধাপ ২/৩ -> ধাপ ৩/৩) */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-slate-800 p-1.5 border border-emerald-100 dark:border-slate-700 flex items-center justify-center shrink-0">
                <img
                  src="/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png"
                  alt="শ্রমিক সাথী"
                  width={32}
                  height={32}
                  decoding="async"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    data-testid="onboarding-step-badge"
                    className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold"
                  >
                    {isBn ? activeStepMeta.stepBadgeBn : activeStepMeta.stepBadgeEn}
                  </span>
                </div>
                <h1
                  data-testid="onboarding-heading"
                  className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5"
                >
                  {isBn ? activeStepMeta.shortBn : activeStepMeta.shortEn}
                </h1>
              </div>
            </div>

            {!isManualSetupMode && (
              <button
                type="button"
                data-testid="onboarding-skip-btn"
                onClick={() => completeOnboarding()}
                className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                {isBn ? 'পরে করব' : 'Skip'}
              </button>
            )}
          </div>

          {isManualSetupMode && (
            <div
              data-testid="onboarding-manual-setup-banner"
              className="rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 px-3 py-2.5 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 leading-relaxed">
                {isBn
                  ? 'হিসাব সংরক্ষণ বা সম্পূর্ণ করার আগে প্রথমে আপনার বেতন, ওভারটাইম ও কর্মস্থল সেটআপ পূরণ করুন। একবার সেটআপ সম্পন্ন করলে পরবর্তীতে আর এই প্রথম সেটআপ আসবে না (পরে প্রোফাইল থেকে এডিট করতে পারবেন)।'
                  : 'Please complete your initial salary, overtime & workplace setup first to save your entry. Once completed, this setup will not appear again (you can edit anytime from Profile).'}
              </p>
            </div>
          )}

          <form onSubmit={handleFinalSubmit} className="space-y-4">
            {/* ========================================================== */}
            {/* STEP 1 (ধাপ ১/৩): SALARY, JOINING & OVERTIME (WITH PAISA)   */}
            {/* ========================================================== */}
            {step === 1 && (
              <div data-testid="onboarding-step-1" className="space-y-3 sm:space-y-4">
                {/* Salary & Joining Card */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                  <div
                    data-testid="onboarding-salary-header-row"
                    className="flex items-center gap-2"
                  >
                    <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {isBn ? 'বেতন ও যোগদানের তথ্য' : 'Salary & Joining Details'}
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {/* Gross Salary (Required *) */}
                    <div>
                      <label
                        htmlFor="onb-gross-salary"
                        className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        {isBn ? 'মোট বেতন / গ্রস (৳)' : 'Gross Salary (৳)'}
                        <span className="text-rose-600 dark:text-rose-400 ml-0.5">*</span>
                      </label>
                      <input
                        ref={grossInputRef}
                        id="onb-gross-salary"
                        data-testid="onboarding-gross-input"
                        type="number"
                        min={0}
                        value={grossSalaryInput}
                        onChange={(e) => handleGrossSalaryChange(e.target.value)}
                        placeholder={isBn ? 'মোট বেতন লিখুন' : 'Enter gross'}
                        aria-invalid={Boolean(grossSalaryError)}
                        className={`w-full min-h-[42px] sm:min-h-[44px] rounded-xl border bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                          grossSalaryError
                            ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 focus:ring-rose-500'
                            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-600'
                        }`}
                      />
                    </div>

                    {/* Basic Salary (Optional - Auto-fills from Gross Salary) */}
                    <div>
                      <label
                        htmlFor="onb-basic-salary"
                        className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        {isBn ? 'মূল বেতন / বেসিক (ঐচ্ছিক)' : 'Basic Salary (Optional)'}
                      </label>
                      <input
                        id="onb-basic-salary"
                        data-testid="onboarding-basic-input"
                        type="number"
                        min={0}
                        value={basicSalaryInput}
                        onChange={(e) => handleBasicSalaryChange(e.target.value)}
                        placeholder={isBn ? 'মোট বেতন থেকে অটো বসবে' : 'Auto from gross'}
                        className="w-full min-h-[42px] sm:min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    {grossSalaryError && (
                      <div
                        data-testid="onboarding-gross-error"
                        role="alert"
                        className="col-span-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3 py-2 flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300"
                      >
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>{grossSalaryError}</span>
                      </div>
                    )}

                    {/* Joining Date (Required *) */}
                    <div>
                      <label
                        htmlFor="onb-joining-date"
                        className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          {isBn ? 'যোগদানের তারিখ' : 'Joining Date'}
                          <span className="text-rose-600 dark:text-rose-400 ml-0.5">*</span>
                        </span>
                      </label>
                      <DateInputDMY
                        id="onb-joining-date"
                        dataTestId="onboarding-joining-date-input"
                        value={joiningDate}
                        lang={lang}
                        onChange={(d) => {
                          setJoiningDate(d);
                          if (d) {
                            setJoiningDateError('');
                          }
                        }}
                        className={`w-full min-h-[42px] sm:min-h-[44px] rounded-xl border bg-white dark:bg-slate-900 px-2.5 sm:px-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                          joiningDateError
                            ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 focus:ring-rose-500'
                            : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-600'
                        }`}
                      />
                    </div>

                    {/* Salary Grade */}
                    <div>
                      <label
                        htmlFor="onb-grade"
                        className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        {isBn ? 'বেতন গ্রেড (ঐচ্ছিক)' : 'Grade (Optional)'}
                      </label>
                      <input
                        id="onb-grade"
                        data-testid="onboarding-grade-input"
                        type="text"
                        value={salaryGrade}
                        onChange={(e) => setSalaryGrade(e.target.value)}
                        placeholder={isBn ? 'যেমন: গ্রেড ৪' : 'e.g. Grade 4'}
                        className="w-full min-h-[42px] sm:min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    {joiningDateError && (
                      <div
                        data-testid="onboarding-joining-date-error"
                        role="alert"
                        className="col-span-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3 py-2 flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300"
                      >
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>{joiningDateError}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Clean Overtime Card with Exact Paisa (Default 0, Auto-fill from Gross + Simple OK button) */}
                <div
                  data-testid="onboarding-overtime-sync-card"
                  className="rounded-2xl border border-emerald-200/90 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 p-3 sm:p-4 space-y-2.5 sm:space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {isBn ? 'ওভারটাইম হিসাব (পয়সা সহ)' : 'Overtime Rate (With Paisa)'}
                      </h3>
                    </div>
                    <span
                      data-testid="onboarding-ot-rate-badge"
                      className="px-2 py-0.5 rounded-lg bg-emerald-100/90 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold tabular-nums shrink-0"
                    >
                      {formatTakaPaisaLabel(displayOtRate, lang)}
                    </span>
                  </div>

                  {/* Hourly Rate Input (Required *) + Simple OK Button */}
                  <div>
                    <label
                      htmlFor="onb-ot-rate"
                      className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {isBn
                        ? 'প্রতি ঘণ্টা ওভারটাইম হার (৳ — পয়সা সহ)'
                        : 'Hourly Overtime Rate (৳ — including paisa)'}
                      <span className="text-rose-600 dark:text-rose-400 ml-0.5">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={otInputRef}
                        id="onb-ot-rate"
                        data-testid="onboarding-ot-rate-input"
                        type="number"
                        step="0.01"
                        min={0}
                        value={otRateInput}
                        onChange={(e) => handleOtRateChange(e.target.value)}
                        placeholder="0"
                        aria-invalid={Boolean(otRateError)}
                        className={`flex-1 min-w-0 min-h-[42px] sm:min-h-[44px] rounded-xl border bg-white dark:bg-slate-900 px-3.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums placeholder:font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                          otRateError && parsedOtRate <= 0
                            ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 focus:ring-rose-500'
                            : 'border-emerald-300 dark:border-emerald-800 focus:ring-emerald-600'
                        }`}
                      />
                      <button
                        ref={otConfirmBtnRef}
                        type="button"
                        data-testid="onboarding-ot-confirm-btn"
                        onClick={handleConfirmOtRate}
                        disabled={parsedOtRate <= 0}
                        className={`min-h-[42px] sm:min-h-[44px] px-4 rounded-xl border text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          isOtRateConfirmed && parsedOtRate > 0
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white hover:bg-emerald-50 dark:bg-slate-900 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700'
                        }`}
                      >
                        {isOtRateConfirmed && parsedOtRate > 0 ? (
                          <span>{isBn ? '✓ ওকে' : '✓ OK'}</span>
                        ) : (
                          <span>{isBn ? 'ওকে' : 'OK'}</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {otRateError && (
                    <div
                      data-testid="onboarding-ot-error"
                      role="alert"
                      className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3 py-2 flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>{otRateError}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================== */}
            {/* STEP 2 (ধাপ ২/৩): ADDRESS & WORKPLACE                      */}
            {/* ========================================================== */}
            {step === 2 && (
              <div
                data-testid="onboarding-step-2"
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 sm:p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {isBn ? 'ঠিকানা ও কর্মস্থলের তথ্য' : 'Address & Workplace'}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {/* Factory Name */}
                  <div className="col-span-2">
                    <label
                      htmlFor="onb-factory"
                      className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                    >
                      <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        {isBn ? 'গার্মেন্টস / কারখানার নাম' : 'Factory Name'}
                        <span className="text-rose-600 dark:text-rose-400 ml-0.5">*</span>
                      </span>
                    </label>
                    <input
                      ref={factoryInputRef}
                      id="onb-factory"
                      data-testid="onboarding-factory-input"
                      type="text"
                      value={factoryName}
                      onChange={(e) => {
                        setFactoryName(e.target.value);
                        if (e.target.value.trim()) {
                          setFactoryNameError('');
                        }
                      }}
                      placeholder={isBn ? 'কারখানার নাম লিখুন' : 'Enter factory name'}
                      aria-invalid={Boolean(factoryNameError)}
                      className={`w-full min-h-[42px] sm:min-h-[44px] rounded-xl border bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        factoryNameError
                          ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 focus:ring-rose-500'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-600'
                      }`}
                    />
                    {factoryNameError && (
                      <p
                        data-testid="onboarding-factory-error"
                        role="alert"
                        className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{factoryNameError}</span>
                      </p>
                    )}
                  </div>

                  {/* Branch / Area (Manual Input Only, No Default Chips) */}
                  <div className="col-span-2 sm:col-span-1">
                    <label
                      htmlFor="onb-branch"
                      className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {isBn ? 'এলাকা / শাখা' : 'Area / Branch'}
                      <span className="text-rose-600 dark:text-rose-400 ml-0.5">*</span>
                    </label>
                    <input
                      ref={branchInputRef}
                      id="onb-branch"
                      data-testid="onboarding-branch-input"
                      type="text"
                      value={factoryBranch}
                      onChange={(e) => {
                        setFactoryBranch(e.target.value);
                        if (e.target.value.trim()) {
                          setFactoryBranchError('');
                        }
                      }}
                      placeholder={isBn ? 'এলাকার নাম লিখুন' : 'Area or branch'}
                      aria-invalid={Boolean(factoryBranchError)}
                      className={`w-full min-h-[42px] sm:min-h-[44px] rounded-xl border bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        factoryBranchError
                          ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 focus:ring-rose-500'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-600'
                      }`}
                    />
                    {factoryBranchError && (
                      <p
                        data-testid="onboarding-branch-error"
                        role="alert"
                        className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{factoryBranchError}</span>
                      </p>
                    )}
                  </div>

                  {/* Section / Line */}
                  <div className="col-span-2 sm:col-span-1">
                    <label
                      htmlFor="onb-department"
                      className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {isBn ? 'সেকশন / লাইন' : 'Section / Line'}
                    </label>
                    <input
                      id="onb-department"
                      data-testid="onboarding-department-input"
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder={isBn ? 'সেকশন বা লাইন' : 'Section or line'}
                      className="w-full min-h-[42px] sm:min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Designation */}
                  <div>
                    <label
                      htmlFor="onb-designation"
                      className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {isBn ? 'পদবি' : 'Designation'}
                    </label>
                    <input
                      id="onb-designation"
                      data-testid="onboarding-designation-input"
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder={isBn ? 'আপনার পদবি' : 'Designation'}
                      className="w-full min-h-[42px] sm:min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Employee ID */}
                  <div>
                    <label
                      htmlFor="onb-emp-id"
                      className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {isBn ? 'আইডি নম্বর (ঐচ্ছিক)' : 'ID No. (Optional)'}
                    </label>
                    <input
                      id="onb-emp-id"
                      data-testid="onboarding-employee-id-input"
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder={isBn ? 'কার্ড নম্বর' : 'ID number'}
                      className="w-full min-h-[42px] sm:min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Current Address */}
                  <div>
                    <label
                      htmlFor="onb-address"
                      className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {isBn ? 'বর্তমান ঠিকানা' : 'Current Address'}
                    </label>
                    <input
                      id="onb-address"
                      data-testid="onboarding-address-input"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={isBn ? 'বাসা বা এলাকা' : 'Current address'}
                      className="w-full min-h-[42px] sm:min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label
                      htmlFor="onb-phone"
                      className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{isBn ? 'মোবাইল নম্বর' : 'Mobile Number'}</span>
                    </label>
                    <input
                      id="onb-phone"
                      data-testid="onboarding-phone-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full min-h-[42px] sm:min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================== */}
            {/* STEP 3 (ধাপ ৩/৩): REQUIRED SETTINGS & ATTENDANCE BONUS      */}
            {/* ========================================================== */}
            {step === 3 && (
              <div data-testid="onboarding-step-3" className="space-y-3.5">
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3.5 sm:p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {isBn ? 'প্রয়োজনীয় সেটিংস' : 'Required Settings'}
                    </h2>
                  </div>

                  {/* 1. Duty Shift Selector (Responsive on Mobile) */}
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isBn ? 'ডিউটি শিফট' : 'Duty Shift'}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          {
                            id: 'day',
                            bn: 'ডে শিফট',
                            en: 'Day Shift',
                            icon: <Sun className="w-4 h-4 shrink-0" />,
                          },
                          {
                            id: 'night',
                            bn: 'নাইট শিফট',
                            en: 'Night Shift',
                            icon: <Moon className="w-4 h-4 shrink-0" />,
                          },
                          {
                            id: 'weekly_rotation',
                            bn: 'রোস্টার শিফট',
                            en: 'Roster Shift',
                            icon: <RefreshCw className="w-4 h-4 shrink-0" />,
                          },
                        ] as Array<{
                          id: WorkShiftPattern;
                          bn: string;
                          en: string;
                          icon: React.ReactNode;
                        }>
                      ).map((s) => {
                        const active = shiftPattern === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            data-testid={`onboarding-shift-${s.id}`}
                            onClick={() => setShiftPattern(s.id)}
                            className={`min-h-[52px] sm:min-h-[46px] px-2 py-2 sm:px-3 sm:py-2.5 rounded-xl border text-[11px] sm:text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer text-center ${
                              active
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                            }`}
                          >
                            {s.icon}
                            <span className="leading-tight">{isBn ? s.bn : s.en}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Clean Attendance Bonus Card */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={attendanceBonusEnabled}
                      data-testid="onboarding-toggle-attendance-bonus"
                      onClick={() => setAttendanceBonusEnabled((prev) => !prev)}
                      className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        attendanceBonusEnabled
                          ? 'border-emerald-500/80 bg-emerald-50/40 dark:bg-emerald-950/30 dark:border-emerald-800'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {isBn ? 'হাজিরা বোনাস চালু' : 'Attendance Bonus'}
                        </span>
                      </div>
                      <span
                        className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${
                          attendanceBonusEnabled
                            ? 'bg-emerald-600 justify-end'
                            : 'bg-slate-300 dark:bg-slate-600 justify-start'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                      </span>
                    </button>

                    {attendanceBonusEnabled && (
                      <div
                        data-testid="onboarding-attendance-bonus-details-box"
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 space-y-3.5"
                      >
                        {/* Bonus Amount Input */}
                        <div>
                          <label
                            htmlFor="onb-attendance-bonus"
                            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                          >
                            {isBn ? 'হাজিরা বোনাসের পরিমাণ (৳)' : 'Bonus Amount (৳)'}
                          </label>
                          <input
                            id="onb-attendance-bonus"
                            data-testid="onboarding-bonus-input"
                            type="number"
                            min={0}
                            value={attendanceBonusInput}
                            onChange={(e) => setAttendanceBonusInput(e.target.value)}
                            placeholder={isBn ? 'বোনাসের টাকা লিখুন' : 'Enter bonus amount'}
                            className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-sm font-bold text-slate-900 dark:text-white tabular-nums placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </div>

                        {/* Missing Time / Cutoff Time Toggle */}
                        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>
                                {isBn ? 'শিফটের মিসিং টাইম নির্ধারণ' : 'Shift Missing Cutoff Time'}
                              </span>
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={bonusCutoffEnabled}
                              data-testid="onboarding-toggle-cutoff-time"
                              onClick={() => setBonusCutoffEnabled((prev) => !prev)}
                              className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 shrink-0 cursor-pointer ${
                                bonusCutoffEnabled
                                  ? 'bg-emerald-600 justify-end'
                                  : 'bg-slate-300 dark:bg-slate-600 justify-start'
                              }`}
                            >
                              <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                            </button>
                          </div>

                          {bonusCutoffEnabled && (
                            <div
                              data-testid="onboarding-attendance-window-card"
                              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1"
                            >
                              {(shiftPattern === 'day' || shiftPattern === 'weekly_rotation') && (
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    {isBn ? 'ডে শিফট মিসিং টাইম' : 'Day Shift Missing Time'}
                                  </label>
                                  <input
                                    type="time"
                                    data-testid="onboarding-day-window-end"
                                    value={dayCutoffTime}
                                    onChange={(e) => setDayCutoffTime(e.target.value)}
                                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white"
                                  />
                                </div>
                              )}

                              {(shiftPattern === 'night' || shiftPattern === 'weekly_rotation') && (
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                                    {isBn ? 'নাইট শিফট মিসিং টাইম' : 'Night Shift Missing Time'}
                                  </label>
                                  <input
                                    type="time"
                                    data-testid="onboarding-night-window-end"
                                    value={nightCutoffTime}
                                    onChange={(e) => setNightCutoffTime(e.target.value)}
                                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Late Days Limit Toggle (1, 2, or 3 days) */}
                        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {isBn
                                ? 'লেট করলে হাজিরা বোনাস বাতিল'
                                : 'Forfeit Bonus on Late Days'}
                            </span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={latePenaltyEnabled}
                              data-testid="onboarding-toggle-late-penalty"
                              onClick={() => setLatePenaltyEnabled((prev) => !prev)}
                              className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 shrink-0 cursor-pointer ${
                                latePenaltyEnabled
                                  ? 'bg-emerald-600 justify-end'
                                  : 'bg-slate-300 dark:bg-slate-600 justify-start'
                              }`}
                            >
                              <span className="w-4 h-4 rounded-full bg-white shadow-2xs" />
                            </button>
                          </div>

                          {latePenaltyEnabled && (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {[1, 2, 3].map((days) => {
                                const active = maxLateDays === days;
                                return (
                                  <button
                                    key={days}
                                    type="button"
                                    data-testid={`onboarding-late-days-${days}`}
                                    onClick={() => setMaxLateDays(days)}
                                    className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                      active
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    {isBn ? `${toBengaliDigits(days)} দিন লেট` : `${days} Day(s)`}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Weekly Holiday (Mobile-Responsive Grid for All 7 Weekdays) */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isBn ? 'সাপ্তাহিক ছুটির দিন' : 'Weekly Holiday'}
                    </label>
                    <div
                      data-testid="onboarding-holiday-select"
                      className="grid grid-cols-3 sm:grid-cols-7 gap-1.5"
                    >
                      {ALL_WEEKDAYS.map((day) => {
                        const active = weeklyHolidayDay === day.id;
                        return (
                          <button
                            key={day.id}
                            type="button"
                            data-testid={`onboarding-holiday-${day.id}`}
                            onClick={() => setWeeklyHolidayDay(day.id)}
                            className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                              active
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                            }`}
                          >
                            {isBn ? day.bn : day.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Expected Pay Day & Optional Monthly Expense Budget */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isBn ? 'বেতন পাওয়ার সম্ভাব্য তারিখ' : 'Expected Pay Day'}
                      </label>
                      <div
                        data-testid="onboarding-payday-select"
                        className="grid grid-cols-2 gap-2"
                      >
                        {[7, 10, 15].map((dayNum) => {
                          const active = payDayMode === 'preset' && expectedPayDay === dayNum;
                          return (
                            <button
                              key={dayNum}
                              type="button"
                              onClick={() => {
                                setPayDayMode('preset');
                                setExpectedPayDay(dayNum);
                              }}
                              className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                active
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {isBn
                                ? `${toBengaliDigits(dayNum)} তারিখের মধ্যে`
                                : `By ${dayNum}th`}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          data-testid="onboarding-payday-custom-btn"
                          onClick={() => setPayDayMode('custom')}
                          className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            payDayMode === 'custom'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isBn ? 'কাস্টম তারিখ' : 'Custom'}
                        </button>
                      </div>

                      {payDayMode === 'custom' && (
                        <input
                          type="number"
                          min={1}
                          max={31}
                          data-testid="onboarding-payday-custom-input"
                          value={customPayDayInput}
                          onChange={(e) => setCustomPayDayInput(e.target.value)}
                          placeholder={isBn ? 'তারিখ লিখুন (১ - ৩১)' : 'Day of month (1-31)'}
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-900 dark:text-white mt-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      )}
                    </div>

                    {/* Optional Monthly Budget */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isBn ? 'মাসিক খরচের বাজেট (ঐচ্ছিক)' : 'Monthly Budget (Optional)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        data-testid="onboarding-budget-input"
                        value={monthlyBudgetInput}
                        onChange={(e) => setMonthlyBudgetInput(e.target.value)}
                        placeholder={isBn ? 'বাজেট লিখুন (না দিলেও চলবে)' : 'Optional budget (৳)'}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-bold text-slate-900 dark:text-white tabular-nums placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Footer */}
            <div className="pt-1 flex items-center justify-between gap-2.5">
              {step > 1 ? (
                <button
                  type="button"
                  data-testid="onboarding-prev-step-btn"
                  onClick={handlePrevStep}
                  className="min-h-[44px] sm:min-h-[46px] px-3.5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span>{isBn ? 'পেছনে' : 'Back'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{isBn ? 'তথ্য সম্পূর্ণ নিরাপদ' : 'Your data is secure'}</span>
                </div>
              )}

              {step < 3 ? (
                <button
                  key="onboarding-next-btn"
                  type="button"
                  data-testid="onboarding-next-step-btn"
                  onClick={handleNextStep}
                  className="min-h-[44px] sm:min-h-[46px] px-5 sm:px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors shadow-2xs ml-auto cursor-pointer"
                >
                  <span>
                    {isBn
                      ? `পরবর্তী ধাপ (${stepsMeta[step].shortBn})`
                      : `Next (${stepsMeta[step].shortEn})`}
                  </span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              ) : (
                <button
                  key="onboarding-final-submit-btn"
                  type="submit"
                  disabled={saving}
                  data-testid="onboarding-submit-btn"
                  className="min-h-[44px] sm:min-h-[46px] px-5 sm:px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors shadow-2xs ml-auto cursor-pointer"
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {saving
                      ? isBn
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : isBn
                      ? 'সম্পন্ন করুন'
                      : 'Finish Setup'}
                  </span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
