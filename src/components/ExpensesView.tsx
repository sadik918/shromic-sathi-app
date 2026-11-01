import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Coins,
  Edit2,
  Flame,
  Home,
  PiggyBank,
  Plus,
  ShoppingBag,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type {
  ExpenseCategory,
  ExpenseRecord,
  RentAdvanceInstallment,
  SalaryPayment,
  SavingsCommissionType,
  SavingsFrequency,
  SavingsGoal,
} from '../types';
import {
  calculateSalaryTotals,
  computeNextSavingsDueDate,
  evaluateBudgetAlert,
  formatBDT,
  formatNumber,
  getRecentMonthsList,
  isOtherIncomePayment,
  parseOtherIncomeSource,
  roundCurrency,
  summarizeOvertimeRecords,
  summarizePersonalFinances,
  getSavedRentRuleConfig,
  saveRentRuleForMonth,
  resolveRentRuleForMonth,
  matchesRentExpenseTargetMonth,
  getRentBillItemLabelBn,
  buildRentDueDescription,
  isRentDueRecord,
  parseRentDueDescription,
  buildRentAdvanceDescription,
  isRentAdvanceRecord,
  parseRentAdvanceDescription,
  buildMonthlyRentUtilityTableRows,
  getNextMonthISO,
  toBengaliDigits,
  type RentRuleConfig,
  type MonthlyRentRuleEntry,
  type RentBillItemType,
  type MonthlyRentUtilityTableRow,
} from '../utils/calculations';
import { formatDateReadable, formatDateShortBn, formatDateSlashDMY, formatMonthLabel, T } from '../utils/i18n';
import { DateInputDMY } from './DateInputDMY';

const EXPENSE_CATEGORIES: Array<{
  id: ExpenseCategory;
  labelBn: string;
  labelEn: string;
  color: string;
}> = [
  { id: 'food', labelBn: 'বাজার সদাই ও খাবার', labelEn: 'Bazar & Groceries', color: 'bg-emerald-500' },
  { id: 'rent', labelBn: 'বাসা ভাড়া ও বিল', labelEn: 'House Rent & Bills', color: 'bg-blue-500' },
  { id: 'transport', labelBn: 'যাতায়াত ভাড়া', labelEn: 'Transport', color: 'bg-amber-500' },
  { id: 'family', labelBn: 'পরিবার ও বাড়িতে পাঠানো', labelEn: 'Family / Remittance', color: 'bg-purple-500' },
  { id: 'medical', labelBn: 'চিকিৎসা ও ওষুধ', labelEn: 'Medical', color: 'bg-rose-500' },
  { id: 'education', labelBn: 'শিক্ষা ও সন্তান', labelEn: 'Education', color: 'bg-indigo-500' },
  { id: 'other', labelBn: 'অন্যান্য খরচ', labelEn: 'Other Expense', color: 'bg-slate-500' },
];

const OTHER_INCOME_SOURCES: Array<{
  id: string;
  labelBn: string;
  labelEn: string;
}> = [
  { id: 'ওভারটাইম / টিফিন ভাতা', labelBn: 'ওভারটাইম / টিফিন নগদ ভাতা', labelEn: 'OT / Tiffin Cash Allowance' },
  { id: 'পার্ট-টাইম / সেলাই কাজ', labelBn: 'পার্ট-টাইম / সেলাই কাজ', labelEn: 'Part-time / Tailoring Work' },
  { id: 'প্রোডাকশন / হাজিরা বোনাস', labelBn: 'প্রোডাকশন / স্পেশাল বোনাস', labelEn: 'Production / Special Bonus' },
  { id: 'পরিবার / বাড়ি থেকে প্রাপ্ত', labelBn: 'পরিবার / বাড়ি থেকে প্রাপ্ত', labelEn: 'Received from Family' },
  { id: 'বিকাশ / ক্যাশব্যাক ও লাভ', labelBn: 'বিকাশ ক্যাশব্যাক / সঞ্চয় লাভ', labelEn: 'Cashback / Savings Profit' },
  { id: 'ক্ষুদ্র ব্যবসা / দোকান', labelBn: 'ক্ষুদ্র ব্যবসা / বাড়তি আয়', labelEn: 'Small Business / Side Income' },
  { id: 'অন্যান্য সোর্স', labelBn: 'অন্যান্য সোর্স', labelEn: 'Other Source' },
];

const SAVINGS_STORAGE_PRESETS: Array<{ bn: string; en: string }> = [
  { bn: 'বিকাশ ডিপিএস', en: 'bKash DPS' },
  { bn: 'ব্যাংক একাউন্ট', en: 'Bank Account' },
  { bn: 'সমিতি / এনজিও', en: 'Somiti / NGO' },
  { bn: 'নগদ ডিপিএস', en: 'Nagad DPS' },
  { bn: 'হাতে ক্যাশ / মাটির ব্যাংক', en: 'Cash / Piggy Bank' },
];

const RENT_MONTH_OPTIONS = [
  '2027-02',
  '2027-01',
  '2026-12',
  '2026-11',
  '2026-10',
  '2026-09',
  '2026-08',
  '2026-07',
  '2026-06',
  '2026-05',
  '2026-04',
  '2026-03',
  '2026-02',
  '2026-01',
  '2025-12',
  '2025-11',
];

export type RentPaymentStatus = 'running' | 'due' | 'advance';

export interface ParsedRentMeta {
  rentTargetMonth: string;
  rentPaymentStatus: RentPaymentStatus;
  extraStatusAmount: number;
  extraStatusMonth: string;
}

export function parseRentDescriptionMeta(
  desc: string | undefined,
  fallbackMonth: string
): ParsedRentMeta {
  if (!desc) {
    return {
      rentTargetMonth: fallbackMonth,
      rentPaymentStatus: 'running',
      extraStatusAmount: 0,
      extraStatusMonth: fallbackMonth,
    };
  }
  const monthMatch = desc.match(/মাস:(\d{4}-\d{2})/);
  const statusMatch = desc.match(/অবস্থা:(running|due|advance)/);
  const dueAmtMatch = desc.match(/বকেয়া:(\d+)/);
  const advAmtMatch = desc.match(/অগ্রিম:(\d+)/);
  const extraMonthMatch = desc.match(/সংশ্লিষ্টমাস:(\d{4}-\d{2})/);

  const rentPaymentStatus: RentPaymentStatus =
    statusMatch && (statusMatch[1] === 'due' || statusMatch[1] === 'advance')
      ? statusMatch[1]
      : 'running';

  const extraStatusAmount =
    rentPaymentStatus === 'due'
      ? Number(dueAmtMatch?.[1] || 0)
      : rentPaymentStatus === 'advance'
      ? Number(advAmtMatch?.[1] || 0)
      : 0;

  return {
    rentTargetMonth: monthMatch?.[1] || fallbackMonth,
    rentPaymentStatus,
    extraStatusAmount,
    extraStatusMonth: extraMonthMatch?.[1] || monthMatch?.[1] || fallbackMonth,
  };
}

export const ExpensesView: React.FC = () => {
  const {
    profile,
    todayISO,
    selectedMonth,
    lang,
    overtime,
    salaryRecords,
    payments,
    expenses,
    savings,
    saveExpense,
    deleteExpense,
    savePayment,
    deletePayment,
    saveSavingsGoal,
    deleteSavingsGoal,
  } = useData();

  const dict = T[lang];

  const monthPayments = payments.filter((p) => p.month === selectedMonth);
  const monthExpenses = expenses
    .filter((e) => e.month === selectedMonth)
    .sort((a, b) => b.date.localeCompare(a.date));

  const otSummary = summarizeOvertimeRecords(overtime, selectedMonth);
  const savedSalaryRecord = salaryRecords.find((s) => s.month === selectedMonth);
  const computedSalary = calculateSalaryTotals({
    basicSalary: savedSalaryRecord ? savedSalaryRecord.basicSalary : profile.basicSalary,
    houseRentAllowance: savedSalaryRecord
      ? savedSalaryRecord.houseRentAllowance
      : profile.houseRentAllowance,
    medicalAllowance: savedSalaryRecord
      ? savedSalaryRecord.medicalAllowance
      : profile.medicalAllowance,
    transportAllowance: savedSalaryRecord
      ? savedSalaryRecord.transportAllowance
      : profile.transportAllowance,
    foodAllowance: savedSalaryRecord ? savedSalaryRecord.foodAllowance : profile.foodAllowance,
    attendanceBonus: savedSalaryRecord
      ? savedSalaryRecord.attendanceBonus
      : profile.attendanceBonus,
    overtimeEarnings: otSummary.monthlyEarnings,
    festivalBonus: savedSalaryRecord ? savedSalaryRecord.festivalBonus : 0,
    otherAllowances: savedSalaryRecord ? savedSalaryRecord.otherAllowances : 0,
    advanceDeduction: savedSalaryRecord ? savedSalaryRecord.advanceDeduction : 0,
    absenceDeduction: savedSalaryRecord ? savedSalaryRecord.absenceDeduction : 0,
    otherDeductions: savedSalaryRecord ? savedSalaryRecord.otherDeductions : 0,
    adjustments: savedSalaryRecord ? savedSalaryRecord.adjustments : 0,
  });

  const financeSummary = summarizePersonalFinances(monthPayments, monthExpenses, savings);
  const budgetAlert = evaluateBudgetAlert(
    financeSummary.totalExpenses,
    financeSummary.totalMonthlyBudget
  );

  // Cash-in-hand counts starting opening cash balance + actually received salary payments + other income minus actual expenses
  const openingCash = Number(profile.openingCashBalance) || 0;
  const effectiveSalaryInflow = financeSummary.salaryIncome;
  const totalCashInflow = roundCurrency(openingCash + effectiveSalaryInflow + financeSummary.otherIncome);
  const netCashInHand = roundCurrency(totalCashInflow - financeSummary.totalExpenses);

  const [isEditingOpeningCash, setIsEditingOpeningCash] = useState<boolean>(false);
  const [openingCashInput, setOpeningCashInput] = useState<number>(profile.openingCashBalance || 0);

  useEffect(() => {
    setOpeningCashInput(profile.openingCashBalance || 0);
  }, [profile.openingCashBalance]);

  const handleSaveOpeningCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(0, Number(openingCashInput) || 0);
    await updateProfile({ openingCashBalance: amt });
    setIsEditingOpeningCash(false);
    showToast(
      lang === 'bn'
        ? `প্রারম্ভিক ক্যাশ জমা ৳${formatBDT(amt, 'bn')} আপডেট করা হয়েছে!`
        : 'Initial cash balance updated!'
    );
  };

  const rentRecords = monthExpenses.filter((e) => e.category === 'rent');
  const bazarRecords = monthExpenses.filter((e) => e.category === 'food');
  const allRegularRentRecords = expenses.filter(
    (r) =>
      r.category === 'rent' &&
      !isRentDueRecord(r.description) &&
      !isRentAdvanceRecord(r.description)
  );
  const regularRentRecords = allRegularRentRecords.filter((r) =>
    matchesRentExpenseTargetMonth(r, selectedMonth)
  );
  const allRentDueRecords = expenses
    .filter((e) => e.category === 'rent' && isRentDueRecord(e.description))
    .sort((a, b) => b.date.localeCompare(a.date));
  const allRentAdvanceRecords = expenses
    .filter((e) => e.category === 'rent' && isRentAdvanceRecord(e.description))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Saved Rent & Utility Rule state
  const [rentRule, setRentRule] = useState<RentRuleConfig>(() =>
    getSavedRentRuleConfig(profile.userId)
  );
  const [isRentRulePanelOpen, setIsRentRulePanelOpen] = useState<boolean>(false);
  const [ruleTargetMonth, setRuleTargetMonth] = useState<string>(selectedMonth);
  const [ruleDraft, setRuleDraft] = useState<MonthlyRentRuleEntry>(() =>
    resolveRentRuleForMonth(getSavedRentRuleConfig(profile.userId), selectedMonth)
  );
  const [rentSubTab, setRentSubTab] = useState<'pay' | 'due' | 'advance'>('pay');

  const [rentTargetMonth, setRentTargetMonth] = useState<string>(selectedMonth);

  const rentMonthOptions = React.useMemo(() => {
    const list = getRecentMonthsList(selectedMonth, 24);
    const set = new Set<string>(list);
    expenses.forEach((e) => {
      if (e.category === 'rent' && e.month) set.add(e.month);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [selectedMonth, expenses]);

  const getRecordsForTargetMonth = (targetMonth: string) => {
    const targetRegular = allRegularRentRecords.filter((r) =>
      matchesRentExpenseTargetMonth(r, targetMonth)
    );
    const findByPrefix = (prefix: string) =>
      targetRegular.find((r) => r.description.startsWith(prefix));
    const baseRentRec =
      findByPrefix('[বাসা ভাড়া]') ||
      targetRegular.find(
        (r) =>
          !r.description.startsWith('[বিদ্যুৎ বিল]') &&
          !r.description.startsWith('[গ্যাস বিল') &&
          !r.description.startsWith('[পানি ও অন্যান্য বিল]')
      );
    const elecRec = findByPrefix('[বিদ্যুৎ বিল]');
    const gasLineRec = findByPrefix('[গ্যাস বিল - লাইন]');
    const gasCylRec = findByPrefix('[গ্যাস বিল - সিলিন্ডার]');
    const gasRec = gasLineRec || gasCylRec;
    const waterRec = findByPrefix('[পানি ও অন্যান্য বিল]');
    return {
      targetRegular,
      baseRentRec,
      elecRec,
      gasLineRec,
      gasCylRec,
      gasRec,
      waterRec,
    };
  };

  const {
    targetRegular: activeTargetRegularRecords,
    baseRentRec: existingBaseRentRec,
    elecRec: existingElectricRec,
    gasRec: existingGasRec,
    waterRec: existingWaterUtilityRec,
  } = getRecordsForTargetMonth(rentTargetMonth);

  const activeMonthRule = resolveRentRuleForMonth(rentRule, rentTargetMonth);

  const isSavedRentLineGasAttached = existingBaseRentRec
    ? existingBaseRentRec.description.includes('লাইন গ্যাস আলাদা') ||
      existingBaseRentRec.description.includes('সিলিন্ডার গ্যাস')
      ? false
      : existingBaseRentRec.description.includes('লাইন গ্যাস সংযুক্ত') ||
        existingBaseRentRec.description.includes('গ্যাস বিল')
      ? true
      : !existingGasRec && activeMonthRule.gasMode === 'attached'
    : activeMonthRule.gasMode === 'attached';

  const isSavedRentElecAttached = existingBaseRentRec
    ? existingBaseRentRec.description.includes('কারেন্ট বিল আলাদা')
      ? false
      : existingBaseRentRec.description.includes('কারেন্ট বিল সংযুক্ত')
      ? true
      : !existingElectricRec && activeMonthRule.electricityAttachedToRent
    : activeMonthRule.electricityAttachedToRent;

  const savedRentMeta = parseRentDescriptionMeta(
    existingBaseRentRec?.description,
    rentTargetMonth
  );

  const [isEditingRentBills, setIsEditingRentBills] = useState<boolean>(false);
  const [baseRentAmount, setBaseRentAmount] = useState<number>(
    existingBaseRentRec?.amount ?? activeMonthRule.fixedBaseRent ?? 0
  );
  const [rentPaymentStatus, setRentPaymentStatus] = useState<RentPaymentStatus>(
    savedRentMeta.rentPaymentStatus
  );
  const [rentExtraStatusAmount, setRentExtraStatusAmount] = useState<number>(
    savedRentMeta.extraStatusAmount
  );
  const [rentExtraStatusMonth, setRentExtraStatusMonth] = useState<string>(
    savedRentMeta.extraStatusMonth
  );
  const [electricityAttachedToRent, setElectricityAttachedToRent] = useState<boolean>(
    isSavedRentElecAttached
  );
  const [electricityAmount, setElectricityAmount] = useState<number>(
    existingElectricRec?.amount ??
      (isSavedRentElecAttached ? 0 : activeMonthRule.defaultElectricityAmount)
  );
  const [electricityUnitsNote, setElectricityUnitsNote] = useState<string>('');
  const [gasType, setGasType] = useState<'line' | 'cylinder'>(
    existingGasRec?.description.startsWith('[গ্যাস বিল - সিলিন্ডার]') ||
      (!existingGasRec && activeMonthRule.gasMode === 'cylinder')
      ? 'cylinder'
      : 'line'
  );
  const [lineGasAttachedToRent, setLineGasAttachedToRent] = useState<boolean>(
    isSavedRentLineGasAttached
  );
  const [gasAmount, setGasAmount] = useState<number>(
    existingGasRec?.amount ??
      (isSavedRentLineGasAttached ? 0 : activeMonthRule.defaultGasAmount)
  );
  const [cylinderSizeKg, setCylinderSizeKg] = useState<string>('১২ কেজি');
  const [cylinderCount, setCylinderCount] = useState<number>(1);
  const [waterOtherAmount, setWaterOtherAmount] = useState<number>(
    existingWaterUtilityRec?.amount ?? activeMonthRule.defaultWaterAmount ?? 0
  );
  const [billDate, setBillDate] = useState<string>(`${selectedMonth}-05`);
  const [rentDeductFromCash, setRentDeductFromCash] = useState<boolean>(true);

  // Single-month Due Tracker state (Filters out paid months from dropdown)
  const [dueTargetMonth, setDueTargetMonth] = useState<string>(selectedMonth);
  const [dueSelectedItems, setDueSelectedItems] = useState<RentBillItemType[]>([
    'house_rent',
    'electricity',
    'gas',
  ]);
  const [dueEntryAmount, setDueEntryAmount] = useState<number>(0);
  const [dueEntryNote, setDueEntryNote] = useState<string>('');

  // Single-month Advance Tracker state (Supports partial advance tracking & multi-item checkboxes)
  const [advanceTargetMonth, setAdvanceTargetMonth] = useState<string>(
    getNextMonthISO(selectedMonth)
  );
  const [advanceSelectedItems, setAdvanceSelectedItems] = useState<RentBillItemType[]>([
    'house_rent',
  ]);
  const [advanceTotalBill, setAdvanceTotalBill] = useState<number>(
    activeMonthRule.fixedBaseRent || 3500
  );
  const [advanceGivenAmount, setAdvanceGivenAmount] = useState<number>(
    activeMonthRule.fixedBaseRent || 3500
  );
  const [advanceDeductFromCash, setAdvanceDeductFromCash] = useState<boolean>(true);
  const [advanceEntryNote, setAdvanceEntryNote] = useState<string>('');

  const loadMonthRentFormState = (
    targetMonth: string,
    ruleConfig: RentRuleConfig = rentRule
  ) => {
    const monthRule = resolveRentRuleForMonth(ruleConfig, targetMonth);
    const {
      baseRentRec: rentRec,
      elecRec,
      gasLineRec,
      gasCylRec,
      waterRec,
    } = getRecordsForTargetMonth(targetMonth);

    const parsedMeta = parseRentDescriptionMeta(rentRec?.description, targetMonth);
    setBaseRentAmount(rentRec?.amount ?? (monthRule.fixedBaseRent || 0));
    setRentPaymentStatus(parsedMeta.rentPaymentStatus);
    setRentExtraStatusAmount(parsedMeta.extraStatusAmount);
    setRentExtraStatusMonth(parsedMeta.extraStatusMonth);

    const elecAttached = rentRec
      ? rentRec.description.includes('কারেন্ট বিল আলাদা')
        ? false
        : rentRec.description.includes('কারেন্ট বিল সংযুক্ত')
        ? true
        : elecRec
        ? false
        : monthRule.electricityAttachedToRent
      : elecRec
      ? false
      : monthRule.electricityAttachedToRent;
    setElectricityAttachedToRent(elecAttached);
    setElectricityAmount(
      elecRec?.amount ?? (elecAttached ? 0 : monthRule.defaultElectricityAmount || 0)
    );

    const gasAttached = rentRec
      ? rentRec.description.includes('লাইন গ্যাস আলাদা') ||
        rentRec.description.includes('সিলিন্ডার গ্যাস')
        ? false
        : rentRec.description.includes('লাইন গ্যাস সংযুক্ত')
        ? true
        : gasLineRec || gasCylRec
        ? false
        : monthRule.gasMode === 'attached'
      : gasLineRec || gasCylRec
      ? false
      : monthRule.gasMode === 'attached';
    setLineGasAttachedToRent(gasAttached);

    if (gasCylRec) {
      setGasType('cylinder');
      setGasAmount(gasCylRec.amount);
    } else if (gasLineRec) {
      setGasType('line');
      setGasAmount(gasLineRec.amount);
    } else if (monthRule.gasMode === 'cylinder') {
      setGasType('cylinder');
      setGasAmount(monthRule.defaultGasAmount || 0);
    } else {
      setGasType('line');
      setGasAmount(gasAttached ? 0 : monthRule.defaultGasAmount || 0);
    }
    setWaterOtherAmount(waterRec?.amount ?? (monthRule.defaultWaterAmount || 0));
    setBillDate(`${targetMonth}-05`);
  };

  useEffect(() => {
    const loadedRule = getSavedRentRuleConfig(profile.userId);
    setRentRule(loadedRule);
    setRentTargetMonth(selectedMonth);
    setRuleTargetMonth(selectedMonth);
    setRuleDraft(resolveRentRuleForMonth(loadedRule, selectedMonth));
    loadMonthRentFormState(selectedMonth, loadedRule);
  }, [selectedMonth, profile.userId]);

  useEffect(() => {
    loadMonthRentFormState(rentTargetMonth, rentRule);
  }, [rentTargetMonth, expenses]);

  // Collapse Rent & Bills form when saved regular rent records already exist for rentTargetMonth and user is not editing
  const isRentBillsFormCollapsed = activeTargetRegularRecords.length > 0 && !isEditingRentBills;

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expDate, setExpDate] = useState(`${selectedMonth}-15`);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('food');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDescription, setExpDescription] = useState('');
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'food' | 'rent' | 'other'>('all');

  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeEntryMode, setIncomeEntryMode] = useState<'other_income' | 'salary'>('other_income');
  const [incomeSource, setIncomeSource] = useState<string>(OTHER_INCOME_SOURCES[0].id);
  const [incomeAmount, setIncomeAmount] = useState<number>(0);
  const [incomeDate, setIncomeDate] = useState<string>(`${selectedMonth}-12`);
  const [incomeNote, setIncomeNote] = useState<string>('');

  // Savings Goals & Schedule state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState<number>(0);
  const [goalSaved, setGoalSaved] = useState<number>(0);
  const [goalBudget, setGoalBudget] = useState<number>(0);
  const [goalDeadline, setGoalDeadline] = useState('2026-12-31');
  const [goalStorageLocation, setGoalStorageLocation] = useState<string>('বিকাশ ডিপিএস');
  const [goalCommissionType, setGoalCommissionType] = useState<SavingsCommissionType>('commission');
  const [goalCommissionAmount, setGoalCommissionAmount] = useState<number>(0);
  const [goalFrequency, setGoalFrequency] = useState<SavingsFrequency>('monthly');
  const [goalDepositDate, setGoalDepositDate] = useState<string>(todayISO);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isSavingsFormOpen, setIsSavingsFormOpen] = useState<boolean>(false);

  // Check if any saved goal has reached or passed its scheduled nextDueDate
  const dueSavingsGoals = savings.filter(
    (g) => Boolean(g.nextDueDate && todayISO >= g.nextDueDate)
  );
  const isAnySavingsDueToday = dueSavingsGoals.length > 0;

  // Show the savings form if: no goals exist yet, OR user clicked Edit / Add New, OR a goal's due date has arrived
  const shouldShowSavingsForm =
    savings.length === 0 || isSavingsFormOpen || Boolean(editingGoalId) || isAnySavingsDueToday;

  const { updateProfile } = useData();
  const [feedback, setFeedback] = useState('');
  const [activeSectionTab, setActiveSectionTab] = useState<
    'all' | 'rent_bills' | 'bazar_expense' | 'other_income' | 'savings' | 'budget_limit'
  >('all');
  const [spendingLimitInput, setSpendingLimitInput] = useState<number>(
    profile.monthlyBudgetTarget || 12000
  );

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleSaveFixedRentRule = (
    customRule?: Partial<MonthlyRentRuleEntry>,
    targetMonthForRule: string = rentTargetMonth
  ) => {
    const resolvedGasMode =
      customRule?.gasMode ??
      (gasType === 'cylinder'
        ? 'cylinder'
        : lineGasAttachedToRent
        ? 'attached'
        : 'line_separate');
    const ruleEntry: MonthlyRentRuleEntry = {
      fixedBaseRent:
        customRule?.fixedBaseRent !== undefined
          ? Number(customRule.fixedBaseRent)
          : Number(baseRentAmount) || rentRule.fixedBaseRent || 0,
      electricityAttachedToRent:
        customRule?.electricityAttachedToRent !== undefined
          ? customRule.electricityAttachedToRent
          : electricityAttachedToRent,
      defaultElectricityAmount:
        customRule?.defaultElectricityAmount !== undefined
          ? Number(customRule.defaultElectricityAmount)
          : Number(electricityAmount) || 0,
      gasMode: resolvedGasMode,
      defaultGasAmount:
        customRule?.defaultGasAmount !== undefined
          ? Number(customRule.defaultGasAmount)
          : Number(gasAmount) || 0,
      waterAttachedToRent:
        customRule?.waterAttachedToRent !== undefined
          ? customRule.waterAttachedToRent
          : Number(waterOtherAmount) <= 0,
      defaultWaterAmount:
        customRule?.defaultWaterAmount !== undefined
          ? Number(customRule.defaultWaterAmount)
          : Number(waterOtherAmount) || 0,
    };
    const updated = saveRentRuleForMonth({
      currentConfig: rentRule,
      targetMonth: targetMonthForRule,
      patch: ruleEntry,
      userId: profile.userId,
    });
    setRentRule(updated);
    setRuleDraft(ruleEntry);
    if (targetMonthForRule === rentTargetMonth) {
      setBaseRentAmount(ruleEntry.fixedBaseRent);
      setElectricityAttachedToRent(ruleEntry.electricityAttachedToRent);
      if (ruleEntry.electricityAttachedToRent) {
        setElectricityAmount(0);
      } else {
        setElectricityAmount(ruleEntry.defaultElectricityAmount);
      }
      if (ruleEntry.gasMode === 'attached') {
        setGasType('line');
        setLineGasAttachedToRent(true);
        setGasAmount(0);
      } else if (ruleEntry.gasMode === 'line_separate') {
        setGasType('line');
        setLineGasAttachedToRent(false);
        setGasAmount(ruleEntry.defaultGasAmount);
      } else {
        setGasType('cylinder');
        setLineGasAttachedToRent(false);
        setGasAmount(ruleEntry.defaultGasAmount);
      }
    }
    setIsRentRulePanelOpen(false);
    showToast(
      lang === 'bn'
        ? `${formatMonthLabel(targetMonthForRule, 'bn')} মাসের বাসা ভাড়া (${formatBDT(ruleEntry.fixedBaseRent, 'bn')}) ও বিল সংরক্ষিত হয়েছে!`
        : 'Fixed house rent & utility saved!'
    );
  };

  const handleSaveRentAndBills = async (e?: React.FormEvent, useSavedRuleDirectly = false) => {
    if (e) e.preventDefault();
    const targetMonth = rentTargetMonth || selectedMonth;
    const safeDate = billDate.startsWith(targetMonth) ? billDate : `${targetMonth}-05`;
    let savedCount = 0;

    const targetMonthRule = resolveRentRuleForMonth(rentRule, targetMonth);
    const {
      baseRentRec: targetBaseRentRec,
      elecRec: targetElectricRec,
      gasRec: targetGasRec,
      waterRec: targetWaterRec,
    } = getRecordsForTargetMonth(targetMonth);

    const effectiveRentAmt = useSavedRuleDirectly
      ? Number(targetMonthRule.fixedBaseRent) || Number(baseRentAmount) || 0
      : Number(baseRentAmount) || 0;
    const effectiveElecAttached = useSavedRuleDirectly
      ? targetMonthRule.electricityAttachedToRent
      : electricityAttachedToRent;
    const effectiveElecAmt = effectiveElecAttached
      ? 0
      : useSavedRuleDirectly
      ? Number(targetMonthRule.defaultElectricityAmount) || Number(electricityAmount) || 0
      : Number(electricityAmount) || 0;
    const effectiveGasType = useSavedRuleDirectly
      ? targetMonthRule.gasMode === 'cylinder'
        ? 'cylinder'
        : 'line'
      : gasType;
    const effectiveLineGasAttached = useSavedRuleDirectly
      ? targetMonthRule.gasMode === 'attached'
      : effectiveGasType === 'line' && lineGasAttachedToRent;
    const effectiveGasAmt = effectiveLineGasAttached
      ? 0
      : useSavedRuleDirectly
      ? Number(targetMonthRule.defaultGasAmount) || Number(gasAmount) || 0
      : Number(gasAmount) || 0;

    // Persist rule scoped to targetMonth so previous months keep their own electricity/gas setting
    if (effectiveRentAmt > 0) {
      const monthEntry: MonthlyRentRuleEntry = {
        fixedBaseRent: effectiveRentAmt,
        electricityAttachedToRent: effectiveElecAttached,
        defaultElectricityAmount: effectiveElecAmt,
        gasMode:
          effectiveGasType === 'cylinder'
            ? 'cylinder'
            : effectiveLineGasAttached
            ? 'attached'
            : 'line_separate',
        defaultGasAmount: effectiveGasAmt,
        waterAttachedToRent: Number(waterOtherAmount) <= 0,
        defaultWaterAmount: Number(waterOtherAmount) || 0,
      };
      const syncedRule = saveRentRuleForMonth({
        currentConfig: rentRule,
        targetMonth,
        patch: monthEntry,
        userId: profile.userId,
      });
      setRentRule(syncedRule);
      if (ruleTargetMonth === targetMonth) {
        setRuleDraft(monthEntry);
      }
    }

    const hasRentOrStatusEntry =
      effectiveRentAmt > 0 ||
      ((rentPaymentStatus === 'due' || rentPaymentStatus === 'advance') &&
        rentExtraStatusAmount > 0);

    if (hasRentOrStatusEntry) {
      const statusLabelBn =
        rentPaymentStatus === 'due'
          ? `বকেয়া:${Math.round(Number(rentExtraStatusAmount) || effectiveRentAmt || 0)}`
          : rentPaymentStatus === 'advance'
          ? `অগ্রিম:${Math.round(Number(rentExtraStatusAmount) || effectiveRentAmt || 0)}`
          : 'চলতি পরিশোধ';
      const gasTag =
        effectiveGasType === 'cylinder'
          ? ' · সিলিন্ডার গ্যাস'
          : effectiveLineGasAttached
          ? ' · লাইন গ্যাস সংযুক্ত'
          : ' · লাইন গ্যাস আলাদা';
      const elecTag = effectiveElecAttached
        ? ' · কারেন্ট বিল সংযুক্ত'
        : ' · কারেন্ট বিল আলাদা';
      const rentDesc = `[বাসা ভাড়া] ${formatMonthLabel(
        targetMonth,
        'bn'
      )} [মাস:${targetMonth} · অবস্থা:${rentPaymentStatus} · ${statusLabelBn} · সংশ্লিষ্টমাস:${rentExtraStatusMonth}]${gasTag}${elecTag}`.slice(
        0,
        245
      );
      const rentAmtToSave = rentDeductFromCash ? effectiveRentAmt : 0;
      await saveExpense(
        {
          date: safeDate,
          month: targetMonth,
          category: 'rent',
          amount: rentAmtToSave,
          description: rentDesc,
        },
        targetBaseRentRec?.id
      );
      savedCount++;
    } else if (targetBaseRentRec) {
      await deleteExpense(targetBaseRentRec.id);
    }

    if (effectiveElecAmt > 0) {
      const unitInfo = electricityUnitsNote.trim() ? ` (${electricityUnitsNote.trim()})` : '';
      const elecAmtToSave = rentDeductFromCash ? effectiveElecAmt : 0;
      await saveExpense(
        {
          date: safeDate,
          month: targetMonth,
          category: 'rent',
          amount: elecAmtToSave,
          description: `[বিদ্যুৎ বিল] মাসিক বিদ্যুৎ বিল [মাস:${targetMonth}]${unitInfo}`,
        },
        targetElectricRec?.id
      );
      savedCount++;
    } else if (targetElectricRec) {
      await deleteExpense(targetElectricRec.id);
    }

    if (effectiveGasAmt > 0) {
      const gasDesc =
        effectiveGasType === 'cylinder'
          ? `[গ্যাস বিল - সিলিন্ডার] সিলিন্ডার গ্যাস (${cylinderSizeKg} × ${formatNumber(cylinderCount, lang)}টি) [মাস:${targetMonth}]`
          : `[গ্যাস বিল - লাইন] মাসিক লাইন গ্যাস বিল [মাস:${targetMonth}]`;
      const gasAmtToSave = rentDeductFromCash ? effectiveGasAmt : 0;
      await saveExpense(
        {
          date: safeDate,
          month: targetMonth,
          category: 'rent',
          amount: gasAmtToSave,
          description: gasDesc,
        },
        targetGasRec?.id
      );
      savedCount++;
    } else if (targetGasRec) {
      await deleteExpense(targetGasRec.id);
    }

    if (waterOtherAmount > 0) {
      await saveExpense(
        {
          date: safeDate,
          month: targetMonth,
          category: 'rent',
          amount: Number(waterOtherAmount),
          description: `[পানি ও অন্যান্য বিল] পানি, ময়লা ও অন্যান্য বিল [মাস:${targetMonth}]`,
        },
        targetWaterRec?.id
      );
      savedCount++;
    } else if (targetWaterRec) {
      await deleteExpense(targetWaterRec.id);
    }

    setIsEditingRentBills(false);

    showToast(
      lang === 'bn'
        ? savedCount > 0
          ? `${formatMonthLabel(targetMonth, 'bn')} মাসের বাসা ভাড়া ও বিল পরিশোধ সংরক্ষিত হয়েছে!`
          : 'বাসা ভাড়া ও বিলের হিসাব আপডেট হয়েছে।'
        : 'House rent and utility bills saved!'
    );
  };

  const monthlyRentTableRows = buildMonthlyRentUtilityTableRows({
    expenses,
    rentRule,
    selectedMonth,
    monthsCount: 12,
  });

  // Filter out ALREADY PAID or ADVANCE PAID months AND UPCOMING/FUTURE MONTHS so paid & future months NEVER appear in Due Dropdown!
  const unpaidDueMonthOptions = React.useMemo(() => {
    const recent24Months = getRecentMonthsList(selectedMonth, 24);
    const tableRowMap = new Map(monthlyRentTableRows.map((r) => [r.month, r]));

    return recent24Months.filter((m) => {
      // 1. EXCLUDE FUTURE/UPCOMING MONTHS!
      if (m > selectedMonth) return false;

      const row = tableRowMap.get(m);
      if (row) {
        // 2. EXCLUDE FULLY PAID or SETTLED ADVANCE MONTHS!
        if (row.status === 'paid' || row.status === 'advance') {
          return false;
        }
      }

      // Include all unpaid past and current running months!
      return true;
    });
  }, [monthlyRentTableRows, selectedMonth]);

  const advanceMonthOptions = React.useMemo(() => {
    const list: string[] = [selectedMonth];
    let curr = selectedMonth;
    for (let i = 0; i < 12; i++) {
      curr = getNextMonthISO(curr);
      list.push(curr);
    }
    return list;
  }, [selectedMonth]);

  const [isAdvanceFormOpen, setIsAdvanceFormOpen] = useState<boolean>(false);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [advanceInstallments, setAdvanceInstallments] = useState<RentAdvanceInstallment[]>([]);

  const handleToggleDueItem = (item: RentBillItemType) => {
    setDueSelectedItems((prev) => {
      const exists = prev.includes(item);
      const next = exists ? prev.filter((i) => i !== item) : [...prev, item];
      return next.length > 0 ? next : ['house_rent'];
    });
  };

  const handleAddDueEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetMonthToUse =
      dueTargetMonth || unpaidDueMonthOptions[0] || selectedMonth;
    const resolvedAmt = Number(dueEntryAmount) > 0 ? Number(dueEntryAmount) : 0;
    if (resolvedAmt <= 0) return;

    const desc = buildRentDueDescription({
      itemType: dueSelectedItems[0] || 'house_rent',
      items: dueSelectedItems,
      months: [targetMonthToUse],
      dueAmount: resolvedAmt,
      isPaid: false,
      note: dueEntryNote,
    });

    await saveExpense({
      date: todayISO.startsWith(selectedMonth) ? todayISO : `${selectedMonth}-05`,
      month: selectedMonth,
      category: 'rent',
      amount: 0, // Unpaid due is 0 until paid
      description: desc,
    });

    setDueEntryAmount(0);
    setDueEntryNote('');
    showToast(
      lang === 'bn'
        ? `${formatMonthLabel(targetMonthToUse, 'bn')} মাসের বকেয়া (${formatBDT(resolvedAmt, 'bn')}) যোগ হয়েছে!`
        : 'Due entry saved!'
    );
  };

  const handlePayDueRecord = async (rec: ExpenseRecord) => {
    const parsed = parseRentDueDescription(rec.description, rec.month);
    if (!parsed) return;
    const updatedDesc = buildRentDueDescription({
      ...parsed,
      isPaid: true,
    });
    await saveExpense(
      {
        date: todayISO.startsWith(selectedMonth) ? todayISO : rec.date,
        month: selectedMonth,
        category: 'rent',
        amount: parsed.dueAmount,
        description: updatedDesc,
      },
      rec.id
    );
    showToast(
      lang === 'bn'
        ? `${parsed.items ? parsed.items.map(getRentBillItemLabelBn).join(', ') : getRentBillItemLabelBn(parsed.itemType)} বকেয়া ${formatBDT(parsed.dueAmount, 'bn')} পরিশোধ সম্পন্ন হয়েছে!`
        : 'Due bill paid!'
    );
  };

  const handleToggleAdvanceItem = (itemType: RentBillItemType) => {
    setAdvanceSelectedItems((prev) => {
      const exists = prev.includes(itemType);
      const next = exists ? prev.filter((i) => i !== itemType) : [...prev, itemType];
      return next.length > 0 ? next : ['house_rent'];
    });
  };

  const handleEditAdvanceRecord = (rec: ExpenseRecord) => {
    const meta = parseRentAdvanceDescription(rec.description, rec.month);
    if (!meta) return;
    setEditingAdvanceId(rec.id);
    setAdvanceTargetMonth(meta.months[0] || rec.month);
    setAdvanceSelectedItems(meta.items.length > 0 ? meta.items : ['house_rent']);
    const totalB = meta.totalBill ?? meta.advanceAmount;
    setAdvanceTotalBill(totalB);
    setAdvanceGivenAmount(meta.advanceAmount);
    setAdvanceDeductFromCash(meta.deductedFromCash);
    setAdvanceEntryNote(meta.note || '');
    setAdvanceInstallments(
      meta.installments && meta.installments.length > 0
        ? meta.installments
        : [
            {
              date: rec.date || todayISO,
              amount: meta.advanceAmount,
              note: meta.note,
            },
          ]
    );
    setIsAdvanceFormOpen(true);
  };

  const handleAddAdvanceEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetM = advanceTargetMonth || getNextMonthISO(selectedMonth);
    const totalB = Number(advanceTotalBill) > 0 ? Number(advanceTotalBill) : 0;
    
    // Filter out zero amount installments
    let finalInstallments = advanceInstallments.filter((inst) => Number(inst.amount) > 0);
    let cumulativeGiven = finalInstallments.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    if (cumulativeGiven <= 0 && Number(advanceGivenAmount) > 0) {
      cumulativeGiven = Number(advanceGivenAmount);
      finalInstallments = [
        {
          date: todayISO.startsWith(selectedMonth) ? todayISO : `${selectedMonth}-05`,
          amount: cumulativeGiven,
          note: advanceEntryNote || undefined,
        },
      ];
    } else if (cumulativeGiven <= 0 && totalB <= 0) {
      return;
    }

    const remainingD = Math.max(0, totalB - cumulativeGiven);

    const desc = buildRentAdvanceDescription({
      items: advanceSelectedItems,
      months: [targetM],
      monthsCount: 1,
      totalBill: totalB,
      advanceAmount: cumulativeGiven,
      remainingDue: remainingD,
      deductedFromCash: advanceDeductFromCash,
      installments: finalInstallments,
      note: advanceEntryNote,
    });

    await saveExpense(
      {
        date: todayISO.startsWith(selectedMonth) ? todayISO : `${selectedMonth}-05`,
        month: selectedMonth,
        category: 'rent',
        amount: advanceDeductFromCash ? cumulativeGiven : 0,
        description: desc,
      },
      editingAdvanceId || undefined
    );

    setEditingAdvanceId(null);
    setAdvanceEntryNote('');
    setAdvanceInstallments([]);
    setIsAdvanceFormOpen(false);
    showToast(
      lang === 'bn'
        ? editingAdvanceId
          ? `${formatMonthLabel(targetM, 'bn')} মাসের অগ্রিম হিসাব আপডেট করা হয়েছে!`
          : `${formatMonthLabel(targetM, 'bn')} মাসের জন্য ৳${formatBDT(cumulativeGiven, 'bn')} অগ্রিম জমা যোগ হয়েছে!`
        : 'Advance deposit updated!'
    );
  };

  const handleSettleAdvanceRecord = async (rec: ExpenseRecord) => {
    const parsed = parseRentAdvanceDescription(rec.description, rec.month);
    if (!parsed) return;
    const targetM = parsed.months[0] || rec.month;
    const totalB = parsed.totalBill || parsed.advanceAmount;

    const desc = `[বাসা ভাড়া] ${formatMonthLabel(
      targetM,
      'bn'
    )} [মাস:${targetM} · অবস্থা:running · চলতি পরিশোধ · সংশ্লিষ্টমাস:${targetM}] · অগ্রিম সমন্বয় সম্পন্ন`.slice(
      0,
      245
    );

    await saveExpense(
      {
        date: todayISO.startsWith(targetM) ? todayISO : `${targetM}-05`,
        month: targetM,
        category: 'rent',
        amount: totalB,
        description: desc,
      },
      rec.id
    );

    showToast(
      lang === 'bn'
        ? `${formatMonthLabel(targetM, 'bn')} মাসের ভাড়া ও বিল অগ্রিম থেকে চূড়ান্ত পরিশোধিত হিসেবে সেট করা হয়েছে!`
        : 'Advance record settled and marked as paid!'
    );
  };

  const handleMarkTableRowAsPaid = async (row: MonthlyRentUtilityTableRow) => {
    if (row.unpaidDueRecordId) {
      const dueRec = expenses.find((e) => e.id === row.unpaidDueRecordId);
      if (dueRec) {
        await handlePayDueRecord(dueRec);
        return;
      }
    }

    const rowMonthRule = resolveRentRuleForMonth(rentRule, row.month);
    const resolvedRent =
      row.rentAmount > 0
        ? row.rentAmount
        : Number(rowMonthRule.fixedBaseRent) || Number(baseRentAmount) || 3500;
    const gasTag = row.gasAttached ? ' · লাইন গ্যাস সংযুক্ত' : ' · লাইন গ্যাস আলাদা';
    const elecTag = row.electricityAttached
      ? ' · কারেন্ট বিল সংযুক্ত'
      : ' · কারেন্ট বিল আলাদা';
    const rentDesc = `[বাসা ভাড়া] ${formatMonthLabel(
      row.month,
      'bn'
    )} [মাস:${row.month} · অবস্থা:running · চলতি পরিশোধ · সংশ্লিষ্টমাস:${row.month}]${gasTag}${elecTag}`.slice(
      0,
      245
    );

    const { baseRentRec: existingForRow, elecRec: existingElecForRow } =
      getRecordsForTargetMonth(row.month);

    await saveExpense(
      {
        date: todayISO.startsWith(row.month) ? todayISO : `${row.month}-05`,
        month: row.month,
        category: 'rent',
        amount: resolvedRent,
        description: rentDesc,
      },
      existingForRow?.id
    );

    if (!row.electricityAttached && row.electricityAmount > 0 && !existingElecForRow) {
      await saveExpense({
        date: todayISO.startsWith(row.month) ? todayISO : `${row.month}-05`,
        month: row.month,
        category: 'rent',
        amount: row.electricityAmount,
        description: `[বিদ্যুৎ বিল] মাসিক বিদ্যুৎ বিল [মাস:${row.month}]`,
      });
    }

    showToast(
      lang === 'bn'
        ? `${formatMonthLabel(row.month, 'bn')} মাসের ভাড়া পরিশোধ সম্পন্ন হয়েছে!`
        : `${row.month} rent marked as paid!`
    );
  };

  const handleOpenUpdateDetailsForMonth = (monthISO: string) => {
    setRentTargetMonth(monthISO);
    loadMonthRentFormState(monthISO, rentRule);
    setRentSubTab('pay');
    setIsEditingRentBills(true);
  };

  const handleAddOrUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expAmount <= 0) return;

    await saveExpense(
      {
        date: expDate,
        month: expDate.slice(0, 7),
        category: expCategory,
        amount: Number(expAmount),
        description:
          expDescription.trim() ||
          EXPENSE_CATEGORIES.find((c) => c.id === expCategory)?.labelBn ||
          'খরচ',
      },
      editingExpenseId || undefined
    );

    setEditingExpenseId(null);
    setExpAmount(0);
    setExpDescription('');
    showToast(
      lang === 'bn'
        ? editingExpenseId
          ? 'খরচের হিসাব আপডেট করা হয়েছে!'
          : 'খরচ সফলভাবে যোগ করা হয়েছে!'
        : 'Expense saved!'
    );
  };

  const handleEditExpenseRecord = (rec: ExpenseRecord) => {
    setEditingExpenseId(rec.id);
    setExpDate(rec.date);
    setExpCategory(rec.category);
    setExpAmount(rec.amount);
    setExpDescription(rec.description);
  };

  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (incomeAmount <= 0) return;

    const formattedRefNote =
      incomeEntryMode === 'other_income'
        ? `[অন্যান্য আয়: ${incomeSource}] ${incomeNote.trim() || incomeSource}`.slice(0, 290)
        : incomeNote.trim() || 'মাসিক বেতন ও ওভারটাইম প্রাপ্তি';

    await savePayment(
      {
        month: incomeDate.slice(0, 7),
        paymentDate: incomeDate,
        amountReceived: Number(incomeAmount),
        paymentMethod: 'cash',
        isPartial: false,
        referenceNote: formattedRefNote,
      },
      editingIncomeId || undefined
    );

    setEditingIncomeId(null);
    setIncomeAmount(0);
    setIncomeNote('');
    showToast(
      lang === 'bn'
        ? incomeEntryMode === 'other_income'
          ? 'অন্যান্য ইনকাম সফলভাবে যোগ হয়েছে!'
          : 'প্রাপ্ত বেতনের হিসাব সংরক্ষিত হয়েছে!'
        : 'Income saved!'
    );
  };

  const handleEditIncomeRecord = (rec: SalaryPayment) => {
    setEditingIncomeId(rec.id);
    setIncomeDate(rec.paymentDate);
    setIncomeAmount(rec.amountReceived);
    if (isOtherIncomePayment(rec)) {
      const parsed = parseOtherIncomeSource(rec.referenceNote);
      setIncomeEntryMode('other_income');
      setIncomeSource(parsed.source);
      setIncomeNote(parsed.note);
    } else {
      setIncomeEntryMode('salary');
      setIncomeNote(rec.referenceNote);
    }
  };

  const handleEditGoal = (g: SavingsGoal) => {
    setEditingGoalId(g.id);
    setGoalTitle(g.title);
    setGoalTarget(g.targetAmount);
    setGoalSaved(g.savedAmount);
    setGoalBudget(g.monthlyBudget);
    setGoalDeadline(g.deadline || '2026-12-31');
    setGoalStorageLocation(g.storageLocation || 'বিকাশ ডিপিএস');
    setGoalCommissionType(g.commissionType || 'commission');
    setGoalCommissionAmount(g.commissionAmount ?? 0);
    setGoalFrequency(g.frequency || 'monthly');
    setGoalDepositDate(g.lastDepositDate || todayISO);
    setIsSavingsFormOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim() || goalTarget <= 0) return;

    const depositDateToUse = goalDepositDate || todayISO;
    const computedNextDue = computeNextSavingsDueDate(depositDateToUse, goalFrequency);

    await saveSavingsGoal(
      {
        title: goalTitle.trim(),
        targetAmount: Number(goalTarget) || 0,
        savedAmount: Number(goalSaved) || 0,
        monthlyBudget: Number(goalBudget) || 0,
        deadline: goalDeadline || '2026-12-31',
        storageLocation: goalStorageLocation.trim() || 'বিকাশ ডিপিএস',
        commissionType: goalCommissionType,
        commissionAmount:
          goalCommissionType === 'commission' ? Number(goalCommissionAmount) || 0 : 0,
        frequency: goalFrequency,
        lastDepositDate: depositDateToUse,
        nextDueDate: computedNextDue,
        notes: `${goalStorageLocation.trim() || 'বিকাশ ডিপিএস'} · ${
          goalCommissionType === 'commission' ? 'কমিশন/লাভ যুক্ত' : 'নন-কমিশন'
        }`,
      },
      editingGoalId || undefined
    );

    setGoalTitle('');
    setGoalTarget(0);
    setGoalSaved(0);
    setGoalBudget(0);
    setGoalCommissionAmount(0);
    setEditingGoalId(null);
    setIsSavingsFormOpen(false);
    showToast(
      lang === 'bn'
        ? `সঞ্চয় লক্ষ্য সংরক্ষিত হয়েছে! পরবর্তী জমার তারিখ: ${formatDateSlashDMY(computedNextDue, 'bn')}`
        : `Savings goal saved! Next deposit date: ${computedNextDue}`
    );
  };

  const liveRentAndBillsDraftTotal = roundCurrency(
    (Number(baseRentAmount) || 0) +
      (electricityAttachedToRent ? 0 : Number(electricityAmount) || 0) +
      (gasType === 'line' && lineGasAttachedToRent ? 0 : Number(gasAmount) || 0) +
      (Number(waterOtherAmount) || 0)
  );

  const filteredExpensesList = monthExpenses.filter((e) => {
    if (expenseFilter === 'all') return true;
    if (expenseFilter === 'food') return e.category === 'food';
    if (expenseFilter === 'rent') return e.category === 'rent';
    return e.category !== 'food' && e.category !== 'rent';
  });

  const getFrequencyLabel = (freq?: SavingsFrequency) => {
    if (freq === 'daily') return lang === 'bn' ? 'দৈনিক সঞ্চয়' : 'Daily';
    if (freq === 'weekly') return lang === 'bn' ? 'সাপ্তাহিক সঞ্চয়' : 'Weekly';
    return lang === 'bn' ? 'মাসিক সঞ্চয়' : 'Monthly';
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 1. MASTER CASH-IN-HAND SUMMARY CARD ("বর্তমানে হাতে থাকা টাকা") */}
      <div
        data-testid="cash-in-hand-summary-card"
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-emerald-200 dark:border-emerald-900/60 shadow-xs"
      >
        <div className="pb-3 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
              <Wallet className="w-3.5 h-3.5" />
              {lang === 'bn'
                ? `${formatMonthLabel(selectedMonth, lang)} — আমার সম্পূর্ণ হিসাব`
                : `${formatMonthLabel(selectedMonth, lang)} — Personal Cash Summary`}
            </span>
          </div>

          {/* Line 1: "বর্তমানে হাতে থাকা টাকা" on left, "মোট ভাড়া প্রদান করছে" on right corner */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'বর্তমানে হাতে থাকা টাকা:' : 'Current Cash in Hand:'}
                </h2>
                <span
                  data-testid="net-cash-in-hand-amount"
                  className={`text-xl sm:text-2xl font-black tabular-nums ${
                    netCashInHand >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatBDT(netCashInHand, lang)}
                </span>
              </div>

              {/* Right corner: Total Rent Paid */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50/90 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-900 dark:text-blue-200 shadow-2xs">
                <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>
                  {lang === 'bn' ? 'মোট ভাড়া প্রদান করেছে:' : 'Total Rent Paid:'}{' '}
                  <strong className="text-blue-700 dark:text-blue-300 font-extrabold tabular-nums">
                    {formatBDT(financeSummary.rentAndBillsTotal, lang)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Line 2: "প্রারম্ভিক জমা" BELOW "currently in hand" */}
            <div className="pt-0.5">
              <button
                type="button"
                data-testid="edit-opening-cash-trigger-btn"
                onClick={() => setIsEditingOpeningCash((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
              >
                <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {lang === 'bn'
                    ? `প্রারম্ভিক জমা: ${formatBDT(openingCash, 'bn')}`
                    : `Opening Cash: ${formatBDT(openingCash, 'en')}`}
                </span>
                <Edit2 className="w-3 h-3 ml-0.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Form to set/edit Opening Cash Balance */}
        {isEditingOpeningCash && (
          <form
            onSubmit={handleSaveOpeningCash}
            className="mt-3.5 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl flex flex-wrap items-end gap-2.5 shadow-2xs"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                {lang === 'bn'
                  ? 'আপনার প্রারম্ভিক জমা / পকেটে থাকা ক্যাশ ইনপুট দিন (৳)'
                  : 'Enter Starting Cash Balance (৳)'}
              </label>
              <input
                data-testid="input-opening-cash"
                type="number"
                min={0}
                value={openingCashInput || ''}
                placeholder={lang === 'bn' ? 'যেমন: ১৫০০০' : 'e.g. 15000'}
                onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditingOpeningCash(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                {dict.cancel}
              </button>
              <button
                type="submit"
                data-testid="save-opening-cash-btn"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                {lang === 'bn' ? 'জমা সেভ করুন' : 'Save Balance'}
              </button>
            </div>
          </form>
        )}

        {/* Itemized Inflow & Outflow Breakdown Grid: 6 cards in 3 columns on tablet/desktop, 2 columns on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2.5 sm:gap-3 mt-3.5">
          {/* 1. Opening Cash Balance */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl p-2.5 border border-emerald-200 dark:border-emerald-800/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                  {lang === 'bn' ? 'প্রারম্ভিক জমা' : 'Opening Cash'}
                </span>
                <button
                  type="button"
                  data-testid="edit-opening-cash-grid-btn"
                  onClick={() => setIsEditingOpeningCash(true)}
                  className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {lang === 'bn' ? 'সেট' : 'Set'}
                </button>
              </div>
              <p
                data-testid="opening-cash-amount"
                className="text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-300 mt-1 tabular-nums"
              >
                +{formatBDT(openingCash, lang)}
              </p>
            </div>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 block mt-0.5">
              {lang === 'bn' ? 'হাতে পূর্বে থাকা নগদ' : 'Initial Cash'}
            </span>
          </div>

          {/* 2. Salary Inflow (Received Only) */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-700/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'প্রাপ্ত বেতন' : 'Salary Received'}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    financeSummary.salaryIncome > 0
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {financeSummary.salaryIncome > 0
                    ? lang === 'bn'
                      ? 'প্রাপ্ত'
                      : 'Received'
                    : lang === 'bn'
                    ? 'অপেক্ষমান'
                    : 'Pending'}
                </span>
              </div>
              <p
                data-testid="received-salary-inflow"
                className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums"
              >
                +{formatBDT(effectiveSalaryInflow, lang)}
              </p>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
              {financeSummary.salaryIncome > 0
                ? lang === 'bn'
                  ? 'হাতে প্রাপ্ত বেতন'
                  : 'Confirmed in hand'
                : lang === 'bn'
                ? 'বেতন পেলে যুক্ত হবে'
                : 'Added when received'}
            </span>
          </div>

          {/* 3. Other Income Inflow */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-700/70 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                {lang === 'bn' ? 'অন্যান্য ইনকাম' : 'Other Income'}
              </span>
              <p className="text-sm sm:text-base font-extrabold text-teal-700 dark:text-teal-400 mt-1 tabular-nums">
                +{formatBDT(financeSummary.otherIncome, lang)}
              </p>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {lang === 'bn'
                ? `${formatNumber(
                    monthPayments.filter((p) => isOtherIncomePayment(p)).length,
                    lang
                  )}টি সোর্স`
                : 'Extra sources'}
            </span>
          </div>

          {/* 4. House Rent & Utility Bills */}
          <div className="bg-blue-50/50 dark:bg-blue-950/25 rounded-xl p-2.5 border border-blue-200/60 dark:border-blue-900/50 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block">
                {lang === 'bn' ? 'বাসা ভাড়া ও বিল' : 'Rent & Bills'}
              </span>
              <p className="text-sm sm:text-base font-extrabold text-blue-700 dark:text-blue-400 mt-1 tabular-nums">
                -{formatBDT(financeSummary.rentAndBillsTotal, lang)}
              </p>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {lang === 'bn' ? 'ভাড়া, বিদ্যুৎ ও গ্যাস' : 'Rent, Electric & Gas'}
            </span>
          </div>

          {/* 5. Bazar / Groceries */}
          <div className="bg-amber-50/50 dark:bg-amber-950/25 rounded-xl p-2.5 border border-amber-200/60 dark:border-amber-900/50 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
                {lang === 'bn' ? 'বাজার সদাই খরচ' : 'Bazar & Food'}
              </span>
              <p className="text-sm sm:text-base font-extrabold text-amber-700 dark:text-amber-400 mt-1 tabular-nums">
                -{formatBDT(financeSummary.bazarTotal, lang)}
              </p>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {lang === 'bn'
                ? `${formatNumber(bazarRecords.length, lang)} বার বাজার`
                : `${bazarRecords.length} entries`}
            </span>
          </div>

          {/* 6. Other Expenses - Side-by-side alongside Bazar and Rent */}
          <div className="bg-rose-50/50 dark:bg-rose-950/25 rounded-xl p-2.5 border border-rose-200/60 dark:border-rose-900/50 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block">
                {lang === 'bn' ? 'অন্যান্য খরচ' : 'Other Expenses'}
              </span>
              <p className="text-sm sm:text-base font-extrabold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                -{formatBDT(financeSummary.otherExpensesTotal, lang)}
              </p>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {lang === 'bn' ? 'যাতায়াত, পরিবার, চিকিৎসা' : 'Transport, Family, Med'}
            </span>
          </div>
        </div>

        {/* Equation Bar showing exact calculation */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
            <span>
              {lang === 'bn' ? 'হাতে জমা:' : 'Total In:'}{' '}
              <strong className="text-emerald-700 dark:text-emerald-400">
                {formatBDT(totalCashInflow, lang)}
              </strong>
            </span>
            <span>−</span>
            <span>
              {lang === 'bn' ? 'মোট খরচ:' : 'Total Out:'}{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                {formatBDT(financeSummary.totalExpenses, lang)}
              </strong>
            </span>
            <span>=</span>
            <span className="font-extrabold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'হাতে অবশিষ্ট:' : 'In Hand:'}{' '}
              <span
                className={
                  netCashInHand >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }
              >
                {formatBDT(netCashInHand, lang)}
              </span>
            </span>
          </div>

          {financeSummary.salaryIncome === 0 && computedSalary.estimatedNetPayable > 0 && (
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? `সম্ভাব্য নিট বেতন (${formatBDT(computedSalary.estimatedNetPayable, 'bn')}) হাতে পেলে এখানে যুক্ত হবে`
                : `Est. net salary (${formatBDT(computedSalary.estimatedNetPayable, 'en')}) will be added once received`}
            </span>
          )}
        </div>
      </div>

      {/* Quick Category Navigation Tabs for Mobile & Desktop (Loans removed as it has its own tab) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', labelBn: 'সব হিসাব একসাথে', labelEn: 'All Sections' },
          { id: 'rent_bills', labelBn: 'বাসা ভাড়া ও বিল', labelEn: 'Rent & Bills' },
          { id: 'bazar_expense', labelBn: 'বাজার সদাই ও খরচ', labelEn: 'Bazar & Expenses' },
          { id: 'other_income', labelBn: 'অন্যান্য ইনকাম', labelEn: 'Other Income' },
          { id: 'savings', labelBn: 'সঞ্চয় লক্ষ্য', labelEn: 'Savings Goals' },
          { id: 'budget_limit', labelBn: 'মাসিক খরচের সীমা ও বাজেট', labelEn: 'Spending Limit & Budget' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSectionTab(tab.id as typeof activeSectionTab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeSectionTab === tab.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-emerald-400'
            }`}
          >
            {lang === 'bn' ? tab.labelBn : tab.labelEn}
          </button>
        ))}
      </div>

      {/* Budget Alert Banner */}
      {financeSummary.totalMonthlyBudget > 0 && (
        <div
          data-testid="budget-alert-banner"
          className={`rounded-2xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
            budgetAlert.status === 'exceeded'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80 text-rose-900 dark:text-rose-200'
              : budgetAlert.status === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
              : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                budgetAlert.status === 'exceeded'
                  ? 'text-rose-600'
                  : budgetAlert.status === 'warning'
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            />
            <div>
              <h4 className="font-bold text-xs">
                {budgetAlert.status === 'exceeded'
                  ? lang === 'bn'
                    ? `সতর্কতা! মাসিক বাজেট ${formatBDT(budgetAlert.exceededBy, lang)} অতিক্রম করেছে`
                    : `Budget exceeded by ${formatBDT(budgetAlert.exceededBy, lang)}`
                  : budgetAlert.status === 'warning'
                  ? lang === 'bn'
                    ? `বাজেট সতর্কতা: মাসিক বাজেটের ${formatNumber(budgetAlert.usagePercent, lang)}% খরচ হয়েছে`
                    : `Warning: ${budgetAlert.usagePercent}% of monthly budget used`
                  : lang === 'bn'
                  ? `বাজেট নিয়ন্ত্রণে আছে (${formatNumber(budgetAlert.usagePercent, lang)}% ব্যবহৃত)`
                  : `Within Budget (${budgetAlert.usagePercent}% used)`}
              </h4>
              <p className="text-[11px] opacity-85 mt-0.5">
                {lang === 'bn'
                  ? `মাসিক বাজেট: ${formatBDT(financeSummary.totalMonthlyBudget, lang)} · অবশিষ্ট বাজেট: ${formatBDT(budgetAlert.remainingBudget, lang)}`
                  : `Budget: ${formatBDT(financeSummary.totalMonthlyBudget, lang)} · Remaining: ${formatBDT(budgetAlert.remainingBudget, lang)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. HOUSE RENT, ELECTRICITY & GAS BILLS SECTION ("বাসা ভাড়ার হিসাব ও বিল") */}
      {(activeSectionTab === 'all' || activeSectionTab === 'rent_bills') && (
        <div
          data-testid="rent-utility-section"
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3.5"
        >
          {/* Header Row: Title & Total Amount on ONE line */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Home className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn'
                    ? 'বাসা ভাড়া, বিদ্যুৎ ও গ্যাস বিলের হিসাব'
                    : 'Rent, Electricity & Gas Management'}
                </h3>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'bn' ? 'মোট ভাড়া ও বিল: ' : 'Total Rent & Bills: '}
                  <strong className="text-blue-700 dark:text-blue-400 tabular-nums font-bold">
                    {formatBDT(
                      financeSummary.rentAndBillsTotal > 0
                        ? financeSummary.rentAndBillsTotal
                        : liveRentAndBillsDraftTotal,
                      lang
                    )}
                  </strong>
                </p>
              </div>
            </div>
          </div>

          {/* Unified Monthly Rent, Electricity & Gas Status Table (Paid, Unpaid/Arrears, Advance) */}
          <div
            data-testid="rent-monthly-status-table-wrapper"
            className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs"
          >
            <table
              data-testid="rent-monthly-status-table"
              className="w-full text-left border-collapse text-xs"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'মাস' : 'Month'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'মূল ভাড়া' : 'Rent'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'বিদ্যুৎ বিল' : 'Electricity'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'গ্যাস বিল' : 'Gas'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'মোট' : 'Total'}</th>
                  <th className="py-2.5 px-3">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                  <th className="py-2.5 px-3 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {monthlyRentTableRows.map((row) => {
                  const statusBadgeClass =
                    row.status === 'paid'
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : row.status === 'due'
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : row.status === 'advance'
                      ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';

                  const rowStyleClass =
                    row.status === 'due'
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-l-4 border-l-rose-500 font-semibold'
                      : row.isCurrentMonth
                      ? 'bg-blue-50/30 dark:bg-blue-950/20 font-semibold'
                      : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40';

                  return (
                    <tr
                      key={row.month}
                      data-testid={`rent-table-row-${row.month}`}
                      className={rowStyleClass}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                        <span>{formatMonthLabel(row.month, lang)}</span>
                        {row.isCurrentMonth && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                            {lang === 'bn' ? 'চলতি' : 'Current'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap tabular-nums font-bold text-slate-800 dark:text-slate-200">
                        {formatBDT(row.rentAmount, lang)}
                      </td>
                      <td
                        data-testid={`rent-table-elec-${row.month}`}
                        className="py-2.5 px-3 whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-300"
                      >
                        {row.electricityAttached
                          ? lang === 'bn'
                            ? 'ভাড়ার সাথে যুক্ত'
                            : 'Included'
                          : formatBDT(row.electricityAmount, lang)}
                      </td>
                      <td
                        data-testid={`rent-table-gas-${row.month}`}
                        className="py-2.5 px-3 whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-300"
                      >
                        {row.gasAttached
                          ? lang === 'bn'
                            ? 'ভাড়ার সাথে যুক্ত'
                            : 'Included'
                          : formatBDT(row.gasAmount, lang)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap tabular-nums font-extrabold text-slate-900 dark:text-white">
                        {formatBDT(row.totalAmount, lang)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          data-testid={`rent-table-status-${row.month}`}
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${statusBadgeClass}`}
                        >
                          {lang === 'bn' ? row.statusDetailBn : row.statusDetailEn}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {row.status === 'unpaid' ? (
                            <button
                              type="button"
                              data-testid={`table-add-rent-btn-${row.month}`}
                              onClick={() => handleOpenUpdateDetailsForMonth(row.month)}
                              title={
                                lang === 'bn'
                                  ? `${formatMonthLabel(row.month, 'bn')} মাসের ভাড়া বা বিল যোগ করুন`
                                  : 'Add Month Rent'
                              }
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'যোগ করুন' : 'Add Rent'}</span>
                            </button>
                          ) : (
                            <>
                              {row.status !== 'paid' && row.status !== 'advance' && (
                                <button
                                  type="button"
                                  data-testid={`table-mark-paid-btn-${row.month}`}
                                  onClick={() => handleMarkTableRowAsPaid(row)}
                                  title={lang === 'bn' ? 'পরিশোধ' : 'Mark as Paid'}
                                  aria-label={lang === 'bn' ? 'পরিশোধ' : 'Mark as Paid'}
                                  className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                data-testid={`table-update-month-btn-${row.month}`}
                                onClick={() => handleOpenUpdateDetailsForMonth(row.month)}
                                title={
                                  lang === 'bn'
                                    ? 'বাসা ভাড়া বিলের তথ্য আপডেট করুন'
                                    : 'Update Rent/Utility Details'
                                }
                                aria-label={
                                  lang === 'bn'
                                    ? 'বাসা ভাড়া বিলের তথ্য আপডেট করুন'
                                    : 'Update Rent/Utility Details'
                                }
                                className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-400 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 3 Mode Switcher Tabs: (1) চলতি ও মাসিক ভাড়া প্রদান, (2) বকেয়া হিসাব (২-৩+ মাস), (3) অগ্রিম হিসাব (২-৩+ মাস) */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              type="button"
              data-testid="rent-subtab-pay"
              onClick={() => setRentSubTab('pay')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                rentSubTab === 'pay'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {lang === 'bn' ? 'চলতি ভাড়া ও বিল প্রদান' : 'Pay Rent & Bills'}
            </button>
            <button
              type="button"
              data-testid="rent-subtab-due"
              onClick={() => setRentSubTab('due')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                rentSubTab === 'due'
                  ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <span>{lang === 'bn' ? 'বকেয়া হিসাব' : 'Due Tracker'}</span>
              {allRentDueRecords.filter(
                (r) => !parseRentDueDescription(r.description, r.month)?.isPaid
              ).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px]">
                  {toBengaliDigits(
                    allRentDueRecords.filter(
                      (r) => !parseRentDueDescription(r.description, r.month)?.isPaid
                    ).length
                  )}
                </span>
              )}
            </button>
            <button
              type="button"
              data-testid="rent-subtab-advance"
              onClick={() => setRentSubTab('advance')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                rentSubTab === 'advance'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <span>{lang === 'bn' ? 'অগ্রিম হিসাব' : 'Advance Tracker'}</span>
              {allRentAdvanceRecords.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px]">
                  {toBengaliDigits(allRentAdvanceRecords.length)}
                </span>
              )}
            </button>
          </div>

          {/* SUB-TAB 1: PAY RUNNING OR SELECTED MONTH RENT & BILLS */}
          {rentSubTab === 'pay' &&
            (isRentBillsFormCollapsed ? (
              /* Collapsed Summary View after saving Rent & Bills */
              <div
                data-testid="saved-rent-bills-card"
                className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 p-3.5 space-y-3"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        {lang === 'bn' ? 'মূল বাসা ভাড়া' : 'House Rent'}
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        {formatMonthLabel(savedRentMeta.rentTargetMonth, lang)}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                      {formatBDT(existingBaseRentRec?.amount ?? 0, lang)}
                    </span>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span
                        data-testid="saved-rent-status-badge"
                        className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold"
                      >
                        {savedRentMeta.rentTargetMonth === selectedMonth
                          ? lang === 'bn'
                            ? 'চলতি ভাড়া পরিশোধ'
                            : 'Running Paid'
                          : lang === 'bn'
                          ? `${formatMonthLabel(savedRentMeta.rentTargetMonth, 'bn')} পরিশোধ`
                          : 'Paid'}
                      </span>
                      {isSavedRentLineGasAttached && (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {lang === 'bn' ? '· গ্যাস লাইন যুক্ত' : '· Gas attached'}
                        </span>
                      )}
                      {isSavedRentElecAttached && (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {lang === 'bn' ? '· কারেন্ট বিল যুক্ত' : '· Elec attached'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                      {lang === 'bn' ? 'বিদ্যুৎ / কারেন্ট বিল' : 'Electricity Bill'}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                      {isSavedRentElecAttached && !existingElectricRec
                        ? lang === 'bn'
                          ? 'ভাড়ার সাথে সংযুক্ত'
                          : 'Included in Rent'
                        : formatBDT(existingElectricRec?.amount ?? 0, lang)}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                      {existingGasRec?.description.startsWith('[গ্যাস বিল - সিলিন্ডার]')
                        ? lang === 'bn'
                          ? 'সিলিন্ডার গ্যাস'
                          : 'Cylinder Gas'
                        : lang === 'bn'
                        ? 'লাইন গ্যাস বিল'
                        : 'Line Gas Bill'}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                      {isSavedRentLineGasAttached && !existingGasRec
                        ? lang === 'bn'
                          ? 'ভাড়ার সাথে সংযুক্ত'
                          : 'Included in Rent'
                        : formatBDT(existingGasRec?.amount ?? 0, lang)}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                      {lang === 'bn' ? 'পানি ও অন্যান্য বিল' : 'Water & Other'}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                      {formatBDT(existingWaterUtilityRec?.amount ?? 0, lang)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {lang === 'bn'
                      ? `${formatMonthLabel(savedRentMeta.rentTargetMonth, 'bn')} মাসের মূল ভাড়া ${formatBDT(
                          existingBaseRentRec?.amount ?? 0,
                          'bn'
                        )} ও বিল পরিশোধ`
                      : 'Rent & utility bills are saved'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingRentBills(true)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {lang === 'bn'
                      ? 'আপডেট করুন'
                      : 'Update Rent/Utility Details'}
                  </button>
                </div>
              </div>
            ) : (
              /* Expanded Form for Paying Running/Selected Month Rent & Bills */
              <form onSubmit={(e) => handleSaveRentAndBills(e, false)} className="space-y-3.5">
                {/* Which Month's Rent is being paid + Clear Running Month Summary */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                      {lang === 'bn'
                        ? 'কোন মাসের বাসা ভাড়া ও বিল আপডেট বা পরিশোধ করবেন?'
                        : 'Which Month Rent Are You Updating or Paying?'}
                    </label>
                    <select
                      data-testid="select-rent-target-month"
                      value={rentTargetMonth}
                      onChange={(e) => {
                        const nextMonth = e.target.value;
                        setRentTargetMonth(nextMonth);
                        loadMonthRentFormState(nextMonth, rentRule);
                        setRentPaymentStatus('running');
                      }}
                      className="w-full sm:max-w-xs px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      {rentMonthOptions.map((m) => (
                        <option key={m} value={m}>
                          {formatMonthLabel(m, lang)}
                          {m === selectedMonth
                            ? lang === 'bn'
                              ? ' — চলতি মাস (রানিং)'
                              : ' — Current Month'
                            : m < selectedMonth
                            ? lang === 'bn'
                              ? ' — বিগত মাস'
                              : ' — Past Month'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                      {rentTargetMonth === selectedMonth
                        ? lang === 'bn'
                          ? `চলতি ভাড়া পরিশোধ (${formatMonthLabel(rentTargetMonth, 'bn')})`
                          : `Paying Current Month Rent`
                        : lang === 'bn'
                        ? `${formatMonthLabel(rentTargetMonth, 'bn')} মাসের ভাড়া ও বিল`
                        : `Rent & Bills for ${rentTargetMonth}`}
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                      {lang === 'bn'
                        ? `মূল ভাড়া: ${formatBDT(baseRentAmount || activeMonthRule.fixedBaseRent || 0, 'bn')}`
                        : `Base Rent: ${formatBDT(baseRentAmount || activeMonthRule.fixedBaseRent || 0, 'en')}`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* House Rent Input */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/70">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1.5">
                      <Home className="w-3.5 h-3.5 text-blue-600" />
                      {lang === 'bn' ? 'মূল বাসা ভাড়া (৳)' : 'Base House Rent (৳)'}
                    </label>
                    <input
                      data-testid="input-house-rent"
                      type="number"
                      min={0}
                      value={baseRentAmount || ''}
                      placeholder={lang === 'bn' ? 'যেমন: ৩৫০০' : 'e.g. 3500'}
                      onChange={(e) => setBaseRentAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Electricity Bill Input (with Per-Month Attached to Rent vs Separate Toggle) */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/70">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        {lang === 'bn' ? 'কারেন্ট / বিদ্যুৎ বিল' : 'Electricity Bill'}
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      <button
                        type="button"
                        data-testid="elec-attached-toggle-btn"
                        onClick={() => {
                          setElectricityAttachedToRent(true);
                          setElectricityAmount(0);
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          electricityAttachedToRent
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {lang === 'bn' ? 'ভাড়ার সাথে যুক্ত' : 'Attached'}
                      </button>
                      <button
                        type="button"
                        data-testid="elec-separate-toggle-btn"
                        onClick={() => {
                          setElectricityAttachedToRent(false);
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          !electricityAttachedToRent
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {lang === 'bn' ? 'আলাদা কারেন্ট বিল' : 'Separate Bill'}
                      </button>
                    </div>
                    {electricityAttachedToRent ? (
                      <div className="px-2.5 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {lang === 'bn'
                          ? 'কারেন্ট বিল বাসা ভাড়ার সাথে যুক্ত'
                          : 'Electricity included in house rent'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1.5">
                        <input
                          data-testid="input-electricity-bill"
                          type="number"
                          min={0}
                          value={electricityAmount || ''}
                          placeholder={lang === 'bn' ? 'যেমন: ৬৫০' : 'e.g. 650'}
                          onChange={(e) => setElectricityAmount(Number(e.target.value))}
                          className="col-span-3 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={electricityUnitsNote}
                          placeholder={lang === 'bn' ? 'ইউনিট' : 'Units'}
                          onChange={(e) => setElectricityUnitsNote(e.target.value)}
                          className="col-span-2 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200"
                        />
                      </div>
                    )}
                  </div>

                  {/* Gas Bill Input (Line Gas vs Cylinder Gas) */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/70 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        {lang === 'bn' ? 'গ্যাস বিল (লাইন / সিলিন্ডার)' : 'Gas Bill (Line / Cylinder)'}
                      </label>
                      <div className="inline-flex rounded-lg bg-slate-200/80 dark:bg-slate-700 p-0.5">
                        <button
                          type="button"
                          data-testid="gas-type-line-btn"
                          onClick={() => setGasType('line')}
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            gasType === 'line'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {lang === 'bn' ? 'লাইন গ্যাস' : 'Line Gas'}
                        </button>
                        <button
                          type="button"
                          data-testid="gas-type-cylinder-btn"
                          onClick={() => {
                            setGasType('cylinder');
                            setLineGasAttachedToRent(false);
                          }}
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            gasType === 'cylinder'
                              ? 'bg-orange-600 text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {lang === 'bn' ? 'সিলিন্ডার গ্যাস' : 'Cylinder Gas'}
                        </button>
                      </div>
                    </div>

                    {gasType === 'line' ? (
                      <div className="space-y-2">
                        {/* Line Gas Mode Selector: Attached with House Rent vs Separate Line Gas Bill */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            data-testid="line-gas-attached-btn"
                            onClick={() => {
                              setLineGasAttachedToRent(true);
                              setGasAmount(0);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                              lineGasAttachedToRent
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {lang === 'bn' ? '✓ বাসা ভাড়ার সাথে সংযুক্ত' : '✓ Attached with House Rent'}
                          </button>
                          <button
                            type="button"
                            data-testid="line-gas-separate-btn"
                            onClick={() => setLineGasAttachedToRent(false)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                              !lineGasAttachedToRent
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {lang === 'bn' ? 'আলাদা লাইন গ্যাস বিল' : 'Separate Line Gas Bill'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {!lineGasAttachedToRent ? (
                            <input
                              data-testid="input-gas-bill"
                              type="number"
                              min={0}
                              value={gasAmount || ''}
                              placeholder={lang === 'bn' ? 'লাইন গ্যাস বিল (যেমন: ১০৮০)' : 'Line gas amount'}
                              onChange={(e) => setGasAmount(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white"
                            />
                          ) : (
                            <div className="px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center">
                              {lang === 'bn'
                                ? 'লাইন গ্যাস মূল বাসা ভাড়ার সাথে যুক্ত'
                                : 'Line gas included with house rent'}
                            </div>
                          )}
                          <input
                            type="number"
                            min={0}
                            value={waterOtherAmount || ''}
                            placeholder={lang === 'bn' ? 'পানি/ময়লা বিল (ঐচ্ছিক ৳)' : 'Water/Other Bill (৳)'}
                            onChange={(e) => setWaterOtherAmount(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <select
                            value={cylinderSizeKg}
                            onChange={(e) => setCylinderSizeKg(e.target.value)}
                            className="w-full px-2 py-2 rounded-lg border border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                          >
                            <option value="১২ কেজি">{lang === 'bn' ? '১২ কেজি বোতল' : '12 kg'}</option>
                            <option value="১৫ কেজি">{lang === 'bn' ? '১৫ কেজি বোতল' : '15 kg'}</option>
                            <option value="২২ কেজি">{lang === 'bn' ? '২২ কেজি বোতল' : '22 kg'}</option>
                            <option value="ছোট বোতল">{lang === 'bn' ? 'ছোট সিলিন্ডার' : 'Small'}</option>
                          </select>
                        </div>
                        <div>
                          <select
                            value={cylinderCount}
                            onChange={(e) => setCylinderCount(Number(e.target.value))}
                            className="w-full px-2 py-2 rounded-lg border border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                          >
                            <option value={1}>{lang === 'bn' ? '১টি সিলিন্ডার' : '1 Cylinder'}</option>
                            <option value={2}>{lang === 'bn' ? '২টি সিলিন্ডার' : '2 Cylinders'}</option>
                          </select>
                        </div>
                        <div>
                          <input
                            data-testid="input-gas-bill"
                            type="number"
                            min={0}
                            value={gasAmount || ''}
                            placeholder={lang === 'bn' ? 'সিলিন্ডার গ্যাসের দাম (৳)' : 'Cylinder Gas Price (৳)'}
                            onChange={(e) => setGasAmount(Number(e.target.value))}
                            className="w-full px-2.5 py-2 rounded-lg border border-orange-300 dark:border-orange-800 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cash Deduction Tracking Mode */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      {lang === 'bn' ? 'হিসাবের ধরন (ক্যাশ মাইনাস ট্র্যাকিং)' : 'Cash Deduction Mode'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRentDeductFromCash(true)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                          rentDeductFromCash
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {lang === 'bn' ? '✓ চলতি ক্যাশ থেকে কাটুন (চলতি খরচ)' : '✓ Deduct from Cash'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRentDeductFromCash(false)}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                          !rentDeductFromCash
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {lang === 'bn' ? '✓ অ্যাপের পূর্বের/বাহ্যিক (ক্যাশ মাইনাস হবে না)' : '✓ Paid Outside App (No Cash Minus)'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span>
                      {lang === 'bn' ? 'মূল ভাড়া:' : 'Rent:'}{' '}
                      <strong>{formatBDT(baseRentAmount, lang)}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      {lang === 'bn' ? 'কারেন্ট:' : 'Elec:'}{' '}
                      <strong>
                        {electricityAttachedToRent
                          ? lang === 'bn'
                            ? 'ভাড়ার সাথে যুক্ত'
                            : 'Attached'
                          : formatBDT(electricityAmount, lang)}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      {gasType === 'cylinder'
                        ? lang === 'bn'
                          ? `সিলিন্ডার গ্যাস (${cylinderSizeKg}):`
                          : 'Cylinder Gas:'
                        : lang === 'bn'
                        ? 'লাইন গ্যাস:'
                        : 'Line Gas:'}{' '}
                      <strong>
                        {gasType === 'line' && lineGasAttachedToRent
                          ? lang === 'bn'
                            ? 'ভাড়ার সাথে সংযুক্ত'
                            : 'Attached'
                          : formatBDT(gasAmount, lang)}
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeTargetRegularRecords.length > 0 && isEditingRentBills && (
                      <button
                        type="button"
                        onClick={() => setIsEditingRentBills(false)}
                        className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        {dict.cancel}
                      </button>
                    )}
                    <button
                      type="submit"
                      data-testid="save-rent-bills-btn"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                    >
                      {lang === 'bn'
                        ? activeTargetRegularRecords.length > 0 && isEditingRentBills
                          ? 'বাসা ভাড়া বিলের তথ্য আপডেট করুন'
                          : 'পরিশোধ'
                        : 'Pay / Save Rent & Bills'}
                    </button>
                  </div>
                </div>
              </form>
            ))}

          {/* SUB-TAB 2: SINGLE-MONTH & MULTI-ITEM ARREARS / DUE TRACKER ("বকেয়া হিসাব") */}
          {rentSubTab === 'due' && (
            <div data-testid="rent-due-tab-panel" className="space-y-3.5">
              <form
                onSubmit={handleAddDueEntry}
                className="rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 p-3.5 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Single Month Dropdown Selector (Paid months excluded!) */}
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                      {lang === 'bn' ? 'কোন মাসের বকেয়া যোগ করবেন?' : 'Select Month for Due Record'}
                    </label>
                    <select
                      data-testid="due-month-select"
                      value={dueTargetMonth}
                      onChange={(e) => setDueTargetMonth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      {unpaidDueMonthOptions.length === 0 ? (
                        <option value="">{lang === 'bn' ? 'সকল মাসের ভাড়া পরিশোধিত' : 'All Months Paid'}</option>
                      ) : (
                        unpaidDueMonthOptions.map((m) => {
                          const isCurrent = m === selectedMonth;
                          return (
                            <option key={m} value={m}>
                              {formatMonthLabel(m, lang)} {isCurrent ? '(চলতি)' : '(বকেয়া)'}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>

                  {/* Multi-Select Item Checkboxes (House Rent, Electricity, Gas, Water) */}
                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                      {lang === 'bn'
                        ? 'কী কী বিল বকেয়া আছে? (একাধিক সিলেক্ট করতে পারবেন)'
                        : 'Select Due Bill Items'}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'house_rent', labelBn: 'বাসা ভাড়া', labelEn: 'House Rent' },
                          { id: 'electricity', labelBn: 'কারেন্ট বিল', labelEn: 'Electricity' },
                          { id: 'gas', labelBn: 'গ্যাস বিল', labelEn: 'Gas Bill' },
                          { id: 'water_other', labelBn: 'পানি ও অন্যান্য বিল', labelEn: 'Water/Other' },
                        ] as const
                      ).map((item) => {
                        const isChecked = dueSelectedItems.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-testid={`due-item-btn-${item.id}`}
                            onClick={() => handleToggleDueItem(item.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {isChecked ? '✓ ' : ''}
                            {lang === 'bn' ? item.labelBn : item.labelEn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                      {lang === 'bn' ? 'বকেয়া টাকার পরিমাণ (৳)' : 'Due Amount (৳)'}
                    </label>
                    <input
                      data-testid="input-due-entry-amount"
                      type="number"
                      min={0}
                      value={dueEntryAmount || ''}
                      placeholder={lang === 'bn' ? 'যেমন: ৩৫০০' : 'e.g. 3500'}
                      onChange={(e) => setDueEntryAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                      {lang === 'bn' ? 'সংক্ষিপ্ত নোট (ঐচ্ছিক)' : 'Note (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={dueEntryNote}
                      placeholder={
                        lang === 'bn'
                          ? 'যেমন: এই মাসের কারেন্ট বিল বাকি'
                          : 'e.g. Electricity bill pending'
                      }
                      onChange={(e) => setDueEntryNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      data-testid="add-due-entry-btn"
                      className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-2xs"
                    >
                      {lang === 'bn' ? '+ বকেয়া যোগ করুন' : '+ Add Due Entry'}
                    </button>
                  </div>
                </div>
              </form>

              {/* List of Saved Due Records with Individual "প্রদান করুন" Button */}
              <div data-testid="rent-due-records-list" className="space-y-2">
                {allRentDueRecords.length === 0 ? (
                  <div className="text-center py-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {lang === 'bn'
                      ? 'বর্তমানে কোনো বকেয়া বাসা ভাড়া, কারেন্ট বিল বা গ্যাস বিল নেই।'
                      : 'No unpaid rent, electricity, or gas dues recorded.'}
                  </div>
                ) : (
                  allRentDueRecords.map((rec) => {
                    const meta = parseRentDueDescription(rec.description, rec.month);
                    if (!meta) return null;
                    const itemsText = meta.items
                      ? meta.items.map(getRentBillItemLabelBn).join(', ')
                      : getRentBillItemLabelBn(meta.itemType);
                    const monthText = formatMonthLabel(meta.months[0] || rec.month, lang);
                    return (
                      <div
                        key={rec.id}
                        data-testid={`due-record-card-${rec.id}`}
                        className={`rounded-xl p-3 border flex flex-wrap items-center justify-between gap-2.5 ${
                          meta.isPaid
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                            : 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/70'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-bold">
                              {monthText}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                              {itemsText}
                            </span>
                          </div>
                          {meta.note && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {meta.note}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-black tabular-nums ${
                              meta.isPaid
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatBDT(meta.dueAmount, lang)}
                          </span>

                          {!meta.isPaid ? (
                            <button
                              type="button"
                              data-testid="pay-due-item-btn"
                              onClick={() => handlePayDueRecord(rec)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'প্রদান করুন' : 'Pay Now'}</span>
                            </button>
                          ) : (
                            <span
                              data-testid="due-paid-badge"
                              className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {lang === 'bn' ? 'পরিশোধ' : 'Paid'}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => deleteExpense(rec.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            title={dict.delete}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: SINGLE-MONTH & PARTIAL/FULL ADVANCE TRACKER ("অগ্রিম হিসাব") */}
          {rentSubTab === 'advance' && (
            <div data-testid="rent-advance-tab-panel" className="space-y-3.5">
              {!isAdvanceFormOpen && allRentAdvanceRecords.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      {lang === 'bn'
                        ? `মোট ${toBengaliDigits(allRentAdvanceRecords.length)}টি মাসের অগ্রিম জমা হিসাব সংরক্ষিত`
                        : `${allRentAdvanceRecords.length} advance record(s) saved`}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="expand-advance-form-btn"
                    onClick={() => setIsAdvanceFormOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? '＋ আরও অগ্রিম বা আপডেট করুন' : '+ Add / Update Advance'}</span>
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleAddAdvanceEntry}
                  className="rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/60 p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-indigo-100 dark:border-indigo-900/40">
                    <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200">
                      {lang === 'bn' ? 'অগ্রিম ভাড়ার হিসাব লিখুন' : 'Enter Advance Details'}
                    </span>
                    {allRentAdvanceRecords.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsAdvanceFormOpen(false)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {dict.cancel}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Single Month Dropdown Selection */}
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        {lang === 'bn' ? 'কোন মাসের অগ্রিম দিবেন?' : 'Select Month for Advance'}
                      </label>
                      <select
                        data-testid="advance-month-select"
                        value={advanceTargetMonth}
                        onChange={(e) => setAdvanceTargetMonth(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        {advanceMonthOptions.map((m) => (
                          <option key={m} value={m}>
                            {formatMonthLabel(m, lang)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Multi-Select Item Checkboxes */}
                    <div className="sm:col-span-7">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        {lang === 'bn'
                          ? 'কী কী বাবদ অগ্রিম দিচ্ছেন? (একাধিক সিলেক্ট করা যাবে)'
                          : 'Select Items for Advance'}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { id: 'house_rent', labelBn: 'বাসা ভাড়া', labelEn: 'House Rent' },
                            { id: 'electricity', labelBn: 'কারেন্ট বিল', labelEn: 'Electricity' },
                            { id: 'gas', labelBn: 'গ্যাস বিল', labelEn: 'Gas Bill' },
                            { id: 'water_other', labelBn: 'পানি ও অন্যান্য বিল', labelEn: 'Water/Other' },
                          ] as const
                        ).map((item) => {
                          const isChecked = advanceSelectedItems.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              data-testid={`adv-item-${item.id}`}
                              onClick={() => handleToggleAdvanceItem(item.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {isChecked ? '✓ ' : ''}
                              {lang === 'bn' ? item.labelBn : item.labelEn}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Partial vs Full Advance Inputs & Real-time Balance Calculation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        {lang === 'bn' ? 'মোট নির্ধারিত ভাড়া ও বিল (৳)' : 'Total Rent & Bills (৳)'}
                      </label>
                      <input
                        data-testid="input-advance-total-bill"
                        type="number"
                        min={0}
                        value={advanceTotalBill || ''}
                        placeholder={lang === 'bn' ? 'যেমন: ৩৫০০' : 'e.g. 3500'}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setAdvanceTotalBill(val);
                          if (advanceGivenAmount > val) setAdvanceGivenAmount(val);
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        {lang === 'bn' ? 'প্রকৃতপক্ষে অগ্রিম দিচ্ছেন (৳)' : 'Advance Paid Amount (৳)'}
                      </label>
                      <input
                        data-testid="input-advance-given-amount"
                        type="number"
                        min={0}
                        value={advanceGivenAmount || ''}
                        placeholder={lang === 'bn' ? 'যেমন: ৫০০' : 'e.g. 500'}
                        onChange={(e) => setAdvanceGivenAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-900 text-sm font-bold text-indigo-700 dark:text-indigo-400"
                      />
                    </div>
                  </div>

                  {/* Installments Timeline Editor */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        {lang === 'bn' ? 'অগ্রিম কিস্তির হিসাব (তারিখ ও পরিমাণ)' : 'Advance Installment Timeline'}
                      </label>
                      <button
                        type="button"
                        data-testid="add-advance-installment-btn"
                        onClick={() => {
                          const nextList = [
                            ...advanceInstallments,
                            { date: todayISO, amount: 0, note: '' },
                          ];
                          setAdvanceInstallments(nextList);
                          const sum = nextList.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                          if (sum > 0) setAdvanceGivenAmount(sum);
                        }}
                        className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 border border-indigo-200 dark:border-indigo-800"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{lang === 'bn' ? '+ কিস্তি যোগ করুন' : '+ Add Installment'}</span>
                      </button>
                    </div>

                    {advanceInstallments.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {advanceInstallments.map((inst, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800"
                          >
                            <div className="col-span-4">
                              <input
                                type="date"
                                value={inst.date}
                                onChange={(e) => {
                                  const updated = [...advanceInstallments];
                                  updated[index] = { ...updated[index], date: e.target.value };
                                  setAdvanceInstallments(updated);
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                              />
                            </div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                min={0}
                                placeholder="৳"
                                value={inst.amount || ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = [...advanceInstallments];
                                  updated[index] = { ...updated[index], amount: val };
                                  setAdvanceInstallments(updated);
                                  const sum = updated.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                                  setAdvanceGivenAmount(sum);
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-indigo-700 dark:text-indigo-400"
                              />
                            </div>
                            <div className="col-span-4">
                              <input
                                type="text"
                                placeholder={lang === 'bn' ? 'নোট (ঐচ্ছিক)' : 'Note'}
                                value={inst.note || ''}
                                onChange={(e) => {
                                  const updated = [...advanceInstallments];
                                  updated[index] = { ...updated[index], note: e.target.value };
                                  setAdvanceInstallments(updated);
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                            <div className="col-span-1 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = advanceInstallments.filter((_, i) => i !== index);
                                  setAdvanceInstallments(updated);
                                  const sum = updated.reduce((s, i) => s + (Number(i.amount) || 0), 0);
                                  setAdvanceGivenAmount(sum);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Calculation Preview Box (Partial Advance vs Full Advance) */}
                  <div className="p-3 rounded-xl bg-indigo-100/60 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-xs font-bold text-indigo-900 dark:text-indigo-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>
                        {lang === 'bn' ? 'মোট ভাড়া:' : 'Total:'}{' '}
                        <strong>{formatBDT(advanceTotalBill, lang)}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        {lang === 'bn' ? 'অগ্রিম জমা:' : 'Paid:'}{' '}
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {formatBDT(advanceGivenAmount, lang)}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        {lang === 'bn' ? 'অবশিষ্ট বাকি:' : 'Remaining:'}{' '}
                        <strong className="text-rose-700 dark:text-rose-400">
                          {formatBDT(Math.max(0, advanceTotalBill - advanceGivenAmount), lang)}
                        </strong>
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                      advanceGivenAmount < advanceTotalBill
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                    }`}>
                      {advanceGivenAmount < advanceTotalBill
                        ? lang === 'bn' ? `আংশিক অগ্রিম (${formatBDT(Math.max(0, advanceTotalBill - advanceGivenAmount), 'bn')} বাকি)` : 'Partial Advance'
                        : lang === 'bn' ? 'সম্পূর্ণ অগ্রিম পরিশোধ' : 'Full Advance'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        {lang === 'bn' ? 'হিসাবের ধরন' : 'Payment Mode'}
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAdvanceDeductFromCash(false)}
                          className={`py-2 px-2 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            !advanceDeductFromCash
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {lang === 'bn' ? 'আগেই দেওয়া আছে' : 'Already Paid'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdvanceDeductFromCash(true)}
                          className={`py-2 px-2 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            advanceDeductFromCash
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {lang === 'bn' ? 'চলতি ক্যাশ থেকে কাটুন' : 'Deduct Now'}
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        {lang === 'bn' ? 'সংক্ষিপ্ত নোট (ঐচ্ছিক)' : 'Note (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={advanceEntryNote}
                        placeholder={
                          lang === 'bn' ? 'যেমন: আংশিক ৫০০ টাকা জমা' : 'e.g. 500 advance deposit'
                        }
                        onChange={(e) => setAdvanceEntryNote(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        data-testid="add-advance-entry-btn"
                        className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-2xs"
                      >
                        {lang === 'bn' ? '+ অগ্রিম সেভ করুন' : '+ Save Advance'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* List of Saved Advance Records */}
              <div data-testid="rent-advance-records-list" className="space-y-2.5">
                {allRentAdvanceRecords.length === 0 ? (
                  <div className="text-center py-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {lang === 'bn'
                      ? 'বর্তমানে কোনো অগ্রিম বাসা ভাড়া বা বিলের হিসাব যোগ করা নেই।'
                      : 'No advance rent or utility records saved.'}
                  </div>
                ) : (
                  allRentAdvanceRecords.map((rec) => {
                    const meta = parseRentAdvanceDescription(rec.description, rec.month);
                    if (!meta) return null;
                    const itemLabels = meta.items.map(getRentBillItemLabelBn).join(', ');
                    const targetM = meta.months[0] || rec.month;
                    const monthText = formatMonthLabel(targetM, lang);
                    const totalBillVal = meta.totalBill ?? meta.advanceAmount;
                    const givenVal = meta.advanceAmount;
                    const remainingVal = meta.remainingDue ?? Math.max(0, totalBillVal - givenVal);
                    const isPartial = remainingVal > 0;
                    const canSettle = targetM <= selectedMonth;

                    return (
                      <div
                        key={rec.id}
                        data-testid={`advance-record-card-${rec.id}`}
                        className="rounded-xl p-3.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/70 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold">
                                {monthText}
                              </span>
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {itemLabels}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isPartial
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                }`}
                              >
                                {isPartial
                                  ? lang === 'bn'
                                    ? `আংশিক অগ্রিম (${formatBDT(remainingVal, 'bn')} বাকি)`
                                    : `Partial (${formatBDT(remainingVal, 'en')} remaining)`
                                  : lang === 'bn'
                                  ? 'সম্পূর্ণ অগ্রিম'
                                  : 'Full Advance'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                              <span>
                                {lang === 'bn' ? 'মোট:' : 'Total:'}{' '}
                                <strong>{formatBDT(totalBillVal, lang)}</strong>
                              </span>
                              <span>·</span>
                              <span>
                                {lang === 'bn' ? 'মোট জমার পরিমাণ:' : 'Total Paid:'}{' '}
                                <strong className="text-emerald-700 dark:text-emerald-400">
                                  {formatBDT(givenVal, lang)}
                                </strong>
                              </span>
                              {isPartial && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {lang === 'bn' ? 'বাকি:' : 'Remaining:'}{' '}
                                    <strong className="text-rose-600 dark:text-rose-400">
                                      {formatBDT(remainingVal, lang)}
                                    </strong>
                                  </span>
                                </>
                              )}
                              {meta.note && <span>· {meta.note}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {canSettle && (
                              <button
                                type="button"
                                data-testid="settle-advance-record-btn"
                                onClick={() => handleSettleAdvanceRecord(rec)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title={
                                  lang === 'bn'
                                    ? `${formatMonthLabel(targetM, 'bn')} মাসের ভাড়া হিসেবে পরিশোধ চূড়ান্ত করুন`
                                    : 'Settle Advance'
                                }
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{lang === 'bn' ? '✓ পরিশোধ চূড়ান্ত করুন' : '✓ Settle & Mark Paid'}</span>
                              </button>
                            )}

                            <span className="text-sm font-black text-indigo-700 dark:text-indigo-400 tabular-nums">
                              {formatBDT(givenVal, lang)}
                            </span>
                            <button
                              type="button"
                              data-testid={`edit-advance-record-btn-${rec.id}`}
                              onClick={() => handleEditAdvanceRecord(rec)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer"
                              title={lang === 'bn' ? 'অগ্রিম হিসাব এডিট করুন' : 'Edit Advance Record'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteExpense(rec.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                              title={dict.delete}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Installments History Timeline */}
                        {meta.installments && meta.installments.length > 0 && (
                          <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 text-[11px] space-y-1">
                            <span className="font-bold text-slate-700 dark:text-slate-300 block">
                              {lang === 'bn' ? 'অগ্রিম জমার কিস্তির ইতিহাস:' : 'Advance Installments History:'}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {meta.installments.map((inst, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 text-[11px] font-medium text-indigo-900 dark:text-indigo-200"
                                >
                                  <span>{formatDateShortBn(inst.date, lang)}:</span>
                                  <strong className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                    {formatBDT(inst.amount, lang)}
                                  </strong>
                                  {inst.note && <span className="opacity-75">({inst.note})</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. BAZAR & DAILY EXPENSES + OTHER INCOME & SOURCES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left/First Column: Bazar & Daily Expenses Entry (1-Tap Quick Presets Removed) */}
        {(activeSectionTab === 'all' || activeSectionTab === 'bazar_expense') && (
          <div
            data-testid="bazar-expense-section"
            className={`${
              activeSectionTab === 'bazar_expense' ? 'lg:col-span-12' : 'lg:col-span-7'
            } bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3.5`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {lang === 'bn'
                    ? 'বাজার সদাই ও দৈনিক খরচ যোগ করুন'
                    : 'Add Bazar & Daily Expenses'}
                </h3>
              </div>
              <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                {lang === 'bn'
                  ? `বাজার খরচ: ${formatBDT(financeSummary.bazarTotal, lang)}`
                  : `Bazar: ${formatBDT(financeSummary.bazarTotal, lang)}`}
              </span>
            </div>

            <form onSubmit={handleAddOrUpdateExpense} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {dict.date}
                  </label>
                  <DateInputDMY
                    dataTestId="input-expense-date"
                    value={expDate}
                    lang={lang}
                    onChange={setExpDate}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'খরচের খাত / ধরন' : 'Category'}
                  </label>
                  <select
                    data-testid="select-expense-category"
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {lang === 'bn' ? c.labelBn : c.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'টাকার পরিমাণ (৳)' : 'Amount (৳)'}
                  </label>
                  <input
                    data-testid="input-expense-amount"
                    type="number"
                    min={1}
                    value={expAmount || ''}
                    placeholder={lang === 'bn' ? 'যেমন: ৪৫০' : 'e.g. 450'}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  data-testid="input-expense-description"
                  type="text"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'বিবরণ লিখুন (যেমন: কাঁচাবাজার, মাছ-সবজি, অটো ভাড়া...)'
                      : 'Description (e.g. Vegetables, rice, fare...)'
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <div className="flex items-center gap-2">
                  {editingExpenseId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExpenseId(null);
                        setExpAmount(0);
                        setExpDescription('');
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      {dict.cancel}
                    </button>
                  )}
                  <button
                    type="submit"
                    data-testid="submit-expense-btn"
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    {editingExpenseId
                      ? lang === 'bn'
                        ? 'খরচ আপডেট করুন'
                        : 'Update Expense'
                      : lang === 'bn'
                      ? 'খরচ যোগ করুন'
                      : 'Add Expense'}
                  </button>
                </div>
              </div>
            </form>

            {/* Recorded Expenses List with Filter Pills */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {lang === 'bn'
                    ? `এই মাসের খরচের তালিকা (${formatNumber(filteredExpensesList.length, lang)}টি)`
                    : `Expense Entries (${filteredExpensesList.length})`}
                </h4>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'all', labelBn: 'সব', labelEn: 'All' },
                    { id: 'food', labelBn: 'বাজার সদাই', labelEn: 'Bazar' },
                    { id: 'rent', labelBn: 'ভাড়া ও বিল', labelEn: 'Rent/Bills' },
                    { id: 'other', labelBn: 'অন্যান্য', labelEn: 'Other' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setExpenseFilter(f.id as typeof expenseFilter)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                        expenseFilter === f.id
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {lang === 'bn' ? f.labelBn : f.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {filteredExpensesList.length === 0 ? (
                <p className="text-xs text-slate-400 py-5 text-center">
                  {lang === 'bn'
                    ? 'এই ক্যাটাগরিতে এখনো কোনো খরচ যোগ করা হয়নি।'
                    : 'No expenses recorded in this category yet.'}
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {filteredExpensesList.map((item) => {
                    const catMeta = EXPENSE_CATEGORIES.find((c) => c.id === item.category);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                catMeta?.color || 'bg-slate-500'
                              }`}
                            />
                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {item.description}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {formatDateSlashDMY(item.date, lang)} ({formatDateReadable(item.date, lang)}) ·{' '}
                            {lang === 'bn' ? catMeta?.labelBn : catMeta?.labelEn}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-extrabold text-xs text-rose-600 dark:text-rose-400">
                            -{formatBDT(item.amount, lang)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleEditExpenseRecord(item)}
                            className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg cursor-pointer"
                            title={dict.edit}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteExpense(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title={dict.delete}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right/Second Column: OTHER INCOME & SOURCES ("অন্যান্য ইনকাম ও সোর্স") */}
        {(activeSectionTab === 'all' || activeSectionTab === 'other_income') && (
          <div
            data-testid="other-income-section"
            className={`${
              activeSectionTab === 'other_income' ? 'lg:col-span-12' : 'lg:col-span-5'
            } bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3.5`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  {lang === 'bn'
                    ? 'অন্যান্য ইনকাম ও আয়ের সোর্স'
                    : 'Other Income & Cash Sources'}
                </h3>
              </div>
              <span className="text-xs font-extrabold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                +{formatBDT(financeSummary.otherIncome, lang)}
              </span>
            </div>

            {/* Mode Switcher: Other Income vs Salary Received */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setIncomeEntryMode('other_income')}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  incomeEntryMode === 'other_income'
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang === 'bn' ? '+ অন্যান্য ইনকাম সোর্স' : '+ Other Income Source'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIncomeEntryMode('salary');
                  if (!incomeAmount && computedSalary.estimatedNetPayable > 0) {
                    setIncomeAmount(computedSalary.estimatedNetPayable);
                  }
                }}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  incomeEntryMode === 'salary'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang === 'bn' ? '+ প্রাপ্ত বেতন এন্ট্রি' : '+ Salary Received'}
              </button>
            </div>

            <form onSubmit={handleSaveIncome} className="space-y-2.5">
              {incomeEntryMode === 'other_income' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'ইনকামের সোর্স নির্বাচন করুন' : 'Select Income Source'}
                  </label>
                  <select
                    data-testid="select-other-income-source"
                    value={incomeSource}
                    onChange={(e) => setIncomeSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {OTHER_INCOME_SOURCES.map((src) => (
                      <option key={src.id} value={src.id}>
                        {lang === 'bn' ? src.labelBn : src.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'টাকার পরিমাণ (৳)' : 'Amount (৳)'}
                  </label>
                  <input
                    data-testid="input-other-income-amount"
                    type="number"
                    min={1}
                    value={incomeAmount || ''}
                    placeholder={lang === 'bn' ? 'যেমন: ১৫০০' : 'e.g. 1500'}
                    onChange={(e) => setIncomeAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {dict.date}
                  </label>
                  <DateInputDMY
                    dataTestId="input-other-income-date"
                    value={incomeDate}
                    lang={lang}
                    onChange={setIncomeDate}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  data-testid="input-other-income-note"
                  type="text"
                  value={incomeNote}
                  onChange={(e) => setIncomeNote(e.target.value)}
                  placeholder={
                    incomeEntryMode === 'other_income'
                      ? lang === 'bn'
                        ? 'নোট বা সোর্সের বিবরণ (ঐচ্ছিক)'
                        : 'Optional source details'
                      : lang === 'bn'
                      ? 'বেতন নোট (যেমন: বিকাশে বা নগদে প্রাপ্ত)'
                      : 'Salary note'
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  data-testid="submit-other-income-btn"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  {editingIncomeId
                    ? lang === 'bn'
                      ? 'আপডেট করুন'
                      : 'Update'
                    : incomeEntryMode === 'other_income'
                    ? lang === 'bn'
                      ? 'ইনকাম যোগ করুন'
                      : 'Add Income'
                    : lang === 'bn'
                    ? 'বেতন যোগ করুন'
                    : 'Save Salary'}
                </button>
              </div>
            </form>

            {/* List of Recorded Incomes (Salary + Other Sources) */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                {lang === 'bn'
                  ? `এই মাসের জমা ও ইনকাম সোর্স (${formatNumber(monthPayments.length, lang)}টি)`
                  : `Recorded Income Sources (${monthPayments.length})`}
              </h4>
              {monthPayments.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'এখনো কোনো বেতন বা আলাদা ইনকাম এন্ট্রি করা হয়নি। বেতন হাতে পেলে "+ প্রাপ্ত বেতন এন্ট্রি" বা বেতন পাতা থেকে যুক্ত করলে তা বর্তমান হাতে থাকা টাকায় যোগ হবে।'
                    : 'No salary or custom income entries recorded yet. Add salary once received in hand.'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {monthPayments.map((inc) => {
                    const isOther = isOtherIncomePayment(inc);
                    const parsed = parseOtherIncomeSource(inc.referenceNote);
                    return (
                      <div
                        key={inc.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isOther
                                  ? 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {isOther ? parsed.source : lang === 'bn' ? 'বেতন' : 'Salary'}
                            </span>
                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {parsed.note || parsed.source}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatDateReadable(inc.paymentDate, lang)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                            +{formatBDT(inc.amountReceived, lang)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleEditIncomeRecord(inc)}
                            className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg cursor-pointer"
                            title={dict.edit}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePayment(inc.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title={dict.delete}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. ENHANCED SAVINGS GOALS & MONTHLY BUDGET SECTION (Personal Loans Removed) */}
      {(activeSectionTab === 'all' || activeSectionTab === 'savings') && (
        <div
          data-testid="savings-goals-section"
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {lang === 'bn' ? 'সঞ্চয় লক্ষ্য ও মাসিক বাজেট' : 'Savings Goals & Monthly Budget'}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                {lang === 'bn'
                  ? `মোট সঞ্চয়: ${formatBDT(financeSummary.totalSaved, lang)}`
                  : `Saved: ${formatBDT(financeSummary.totalSaved, lang)}`}
              </span>

              {!shouldShowSavingsForm && (
                <button
                  type="button"
                  data-testid="open-savings-form-btn"
                  onClick={() => {
                    setEditingGoalId(null);
                    setGoalTitle('');
                    setGoalDepositDate(todayISO);
                    setIsSavingsFormOpen(true);
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'নতুন সঞ্চয় / এডিট' : 'Add / Edit'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Due Date Auto-Open Banner when a scheduled deposit date arrives */}
          {isAnySavingsDueToday && (
            <div
              data-testid="savings-due-today-banner"
              className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200"
            >
              <div className="flex items-center gap-2 font-bold">
                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {lang === 'bn'
                    ? `আজ আপনার নির্ধারিত সঞ্চয় জমার তারিখ (${dueSavingsGoals
                        .map((g) => g.title)
                        .join(', ')})! নিচের বক্স থেকে কিস্তি জমা বা আপডেট করুন।`
                    : `Your scheduled savings deposit is due today (${dueSavingsGoals
                        .map((g) => g.title)
                        .join(', ')})!`}
                </span>
              </div>
              {!editingGoalId && dueSavingsGoals[0] && (
                <button
                  type="button"
                  onClick={() => handleEditGoal(dueSavingsGoals[0])}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  {lang === 'bn' ? 'এখনই জমা দিন' : 'Deposit Now'}
                </button>
              )}
            </div>
          )}

          {shouldShowSavingsForm && (
            <form
              onSubmit={handleSaveGoal}
              data-testid="savings-goal-form"
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {editingGoalId
                    ? lang === 'bn'
                      ? 'সঞ্চয় তথ্য ও কিস্তি আপডেট করুন'
                      : 'Update Savings Goal'
                    : lang === 'bn'
                    ? 'নতুন সঞ্চয় ও বাজেট যোগ করুন'
                    : 'Add New Savings Goal'}
                </h4>
                {savings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGoalId(null);
                      setIsSavingsFormOpen(false);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    {lang === 'bn' ? 'হাইড করুন' : 'Hide'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Goal Title */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'সঞ্চয় লক্ষ্যের নাম' : 'Savings Goal Title'}
                  </label>
                  <input
                    data-testid="input-savings-title"
                    type="text"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'যেমন: জরুরি তহবিল, ঈদের সঞ্চয়, ভবিষ্যৎ ডিপিএস...'
                        : 'Goal title (e.g. Emergency fund)'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    required
                  />
                </div>

                {/* Where Savings is Stored */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'সঞ্চয় কোথায় রাখছেন?' : 'Where are you saving?'}
                  </label>
                  <input
                    data-testid="input-savings-location"
                    type="text"
                    value={goalStorageLocation}
                    onChange={(e) => setGoalStorageLocation(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'যেমন: বিকাশ ডিপিএস, ব্যাংক, সমিতি, হাতে ক্যাশ...'
                        : 'e.g. bKash DPS, Bank, Somiti, Cash'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {SAVINGS_STORAGE_PRESETS.map((loc) => (
                      <button
                        key={loc.bn}
                        type="button"
                        onClick={() => setGoalStorageLocation(lang === 'bn' ? loc.bn : loc.en)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          goalStorageLocation === (lang === 'bn' ? loc.bn : loc.en)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {lang === 'bn' ? loc.bn : loc.en}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Commission vs Non-Commission + Frequency + Deposit Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Commission Type */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'লাভ / কমিশনের ধরন' : 'Profit / Commission Type'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      data-testid="savings-commission-btn"
                      onClick={() => setGoalCommissionType('commission')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        goalCommissionType === 'commission'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {lang === 'bn' ? 'কমিশন / লাভ যুক্ত' : 'With Profit'}
                    </button>
                    <button
                      type="button"
                      data-testid="savings-non-commission-btn"
                      onClick={() => {
                        setGoalCommissionType('non_commission');
                        setGoalCommissionAmount(0);
                      }}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        goalCommissionType === 'non_commission'
                          ? 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {lang === 'bn' ? 'নন-কমিশন (সাধারণ)' : 'Non-Commission'}
                    </button>
                  </div>
                </div>

                {/* Frequency: Monthly, Weekly, Daily */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'সঞ্চয় জমার ধরন (মাসিক/সাপ্তাহিক/দৈনিক)' : 'Deposit Frequency'}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'monthly', bn: 'মাসিক', en: 'Monthly' },
                        { id: 'weekly', bn: 'সাপ্তাহিক', en: 'Weekly' },
                        { id: 'daily', bn: 'দৈনিক', en: 'Daily' },
                      ] as const
                    ).map((freq) => (
                      <button
                        key={freq.id}
                        type="button"
                        data-testid={`savings-freq-${freq.id}`}
                        onClick={() => setGoalFrequency(freq.id)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          goalFrequency === freq.id
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {lang === 'bn' ? freq.bn : freq.en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deposit Date */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'জমার তারিখ' : 'Deposit Date'}
                  </label>
                  <DateInputDMY
                    dataTestId="input-savings-deposit-date"
                    value={goalDepositDate}
                    lang={lang}
                    onChange={setGoalDepositDate}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Amounts Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                    {dict.targetAmount}
                  </label>
                  <input
                    data-testid="input-savings-target"
                    type="number"
                    min={100}
                    value={goalTarget || ''}
                    placeholder={lang === 'bn' ? 'যেমন: ২০০০০' : 'e.g. 20000'}
                    onChange={(e) => setGoalTarget(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                    {dict.savedAmount}
                  </label>
                  <input
                    data-testid="input-savings-saved"
                    type="number"
                    min={0}
                    value={goalSaved || ''}
                    placeholder={lang === 'bn' ? 'যেমন: ২০০০' : 'e.g. 2000'}
                    onChange={(e) => setGoalSaved(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                    {dict.monthlyBudget}
                  </label>
                  <input
                    data-testid="input-savings-budget"
                    type="number"
                    min={0}
                    value={goalBudget || ''}
                    placeholder={lang === 'bn' ? 'মাসিক খরচ বাজেট (৳)' : 'Monthly budget'}
                    onChange={(e) => setGoalBudget(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                {goalCommissionType === 'commission' ? (
                  <div>
                    <label className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">
                      {lang === 'bn' ? 'কমিশন / লাভের টাকা (ঐচ্ছিক ৳)' : 'Profit / Bonus (৳)'}
                    </label>
                    <input
                      data-testid="input-savings-commission"
                      type="number"
                      min={0}
                      value={goalCommissionAmount || ''}
                      placeholder={lang === 'bn' ? 'যেমন: ৫০০' : 'e.g. 500'}
                      onChange={(e) => setGoalCommissionAmount(Number(e.target.value))}
                      className="w-full px-2.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-xs font-bold text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                ) : (
                  <div className="flex items-end">
                    <div className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/50 text-[11px] font-semibold text-slate-500">
                      {lang === 'bn' ? 'নন-কমিশন সাধারণ জমা' : 'Standard Non-Commission'}
                    </div>
                  </div>
                )}
              </div>

              {/* Next Scheduled Date Preview & Save Button */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === 'bn' ? 'পরবর্তী জমার নির্ধারিত তারিখ হবে: ' : 'Next scheduled deposit date: '}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {formatDateSlashDMY(
                      computeNextSavingsDueDate(goalDepositDate || todayISO, goalFrequency),
                      lang
                    )}
                  </strong>
                </span>

                <button
                  type="submit"
                  data-testid="save-savings-goal-btn"
                  className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                >
                  {editingGoalId
                    ? lang === 'bn'
                      ? 'সঞ্চয় লক্ষ্য আপডেট করুন'
                      : 'Update Savings Goal'
                    : lang === 'bn'
                    ? 'সঞ্চয় লক্ষ্য সংরক্ষণ করুন'
                    : 'Save Savings Goal'}
                </button>
              </div>
            </form>
          )}

          {/* Saved Savings Goals List */}
          {savings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savings.map((g) => {
                const pct =
                  g.targetAmount > 0
                    ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100))
                    : 0;
                const isDueNow = Boolean(g.nextDueDate && todayISO >= g.nextDueDate);

                return (
                  <div
                    key={g.id}
                    data-testid="saved-savings-card"
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      isDueNow
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {g.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {g.storageLocation && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100/80 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                              {g.storageLocation}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-blue-100/80 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-bold">
                            {getFrequencyLabel(g.frequency)}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                            {g.commissionType === 'non_commission'
                              ? lang === 'bn'
                                ? 'নন-কমিশন'
                                : 'Non-Commission'
                              : lang === 'bn'
                              ? `কমিশন যুক্ত${
                                  g.commissionAmount && g.commissionAmount > 0
                                    ? ` (+${formatBDT(g.commissionAmount, 'bn')})`
                                    : ''
                                }`
                              : 'With Commission'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          data-testid="edit-savings-goal-btn"
                          onClick={() => handleEditGoal(g)}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:border-emerald-500 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{lang === 'bn' ? 'এডিট করুন' : 'Edit'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavingsGoal(g.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title={dict.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-emerald-700 dark:text-emerald-400 font-extrabold tabular-nums">
                        {formatBDT(g.savedAmount, lang)} / {formatBDT(g.targetAmount, lang)}
                      </span>
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 tabular-nums">
                        {formatNumber(pct, lang)}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {(g.lastDepositDate || g.nextDueDate) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        {g.lastDepositDate && (
                          <span>
                            {lang === 'bn' ? 'সর্বশেষ জমা: ' : 'Last deposit: '}
                            <strong>{formatDateSlashDMY(g.lastDepositDate, lang)}</strong>
                          </span>
                        )}
                        {g.nextDueDate && (
                          <span
                            className={
                              isDueNow
                                ? 'text-amber-700 dark:text-amber-300 font-extrabold'
                                : 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            }
                          >
                            {lang === 'bn' ? 'পরবর্তী জমার তারিখ: ' : 'Next due: '}
                            <strong>{formatDateSlashDMY(g.nextDueDate, lang)}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. MONTHLY SPENDING LIMIT & BUDGET TRACKER SUB-VIEW */}
      {(activeSectionTab === 'all' || activeSectionTab === 'budget_limit') && (
        <div
          data-testid="monthly-spending-limit-card"
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 text-[11px] font-bold mb-1">
                <PiggyBank className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'বাজেট ট্র্যাকার ও লিমিট' : 'Spending Limit & Budget Tracker'}
              </span>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'মাসিক খরচের বাজেট ট্র্যাকার' : 'Monthly Spending Limit & Tracker'}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                {lang === 'bn' ? 'বর্তমান সেট করা সীমা:' : 'Current Limit:'}
              </span>
              <span className="text-base font-extrabold text-purple-700 dark:text-purple-400 tabular-nums">
                {formatBDT(profile.monthlyBudgetTarget || 12000, lang)}
              </span>
            </div>
          </div>

          {/* 1. Set / Update Budget Limit Form */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              {lang === 'bn' ? 'আপনার মাসিক খরচের সর্বোচ্চ সীমা (বাজেট) পরিবর্তন করুন:' : 'Set Your Monthly Spending Limit (Budget Target):'}
            </label>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {[8000, 10000, 12000, 15000, 20000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  data-testid={`budget-preset-btn-${preset}`}
                  onClick={() => {
                    setSpendingLimitInput(preset);
                    updateProfile({ monthlyBudgetTarget: preset });
                    showToast(
                      lang === 'bn'
                        ? `মাসিক বাজেট ${formatBDT(preset, 'bn')} সেট করা হয়েছে!`
                        : `Monthly budget set to ${formatBDT(preset, 'en')}!`
                    );
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    (profile.monthlyBudgetTarget || 12000) === preset
                      ? 'bg-purple-700 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-purple-400'
                  }`}
                >
                  ৳{formatNumber(preset, lang)}
                </button>
              ))}
            </div>

            {/* Custom Limit Input */}
            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  ৳
                </span>
                <input
                  data-testid="input-custom-spending-limit"
                  type="number"
                  value={spendingLimitInput}
                  onChange={(e) => setSpendingLimitInput(Number(e.target.value) || 0)}
                  placeholder="যেমন: ১২০০০"
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-7 pr-3 text-xs font-bold text-slate-900 dark:text-white tabular-nums"
                />
              </div>

              <button
                type="button"
                data-testid="save-custom-spending-limit-btn"
                onClick={() => {
                  if (spendingLimitInput > 0) {
                    updateProfile({ monthlyBudgetTarget: spendingLimitInput });
                    showToast(
                      lang === 'bn'
                        ? `মাসিক বাজেট ${formatBDT(spendingLimitInput, 'bn')} সফলভাবে সংরক্ষিত হয়েছে!`
                        : `Monthly budget limit saved successfully!`
                    );
                  }
                }}
                className="min-h-[38px] px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'সেভ করুন' : 'Save Limit'}
              </button>
            </div>
          </div>

          {/* 2. Visual Budget Progress Gauge & Metrics */}
          {(() => {
            const currentLimit = profile.monthlyBudgetTarget || 12000;
            const totalSpent = financeSummary.totalExpenses;
            const pctUsed = currentLimit > 0 ? Math.min(100, Math.round((totalSpent / currentLimit) * 100)) : 0;
            const remainingAmt = currentLimit - totalSpent;
            const isExceeded = totalSpent > currentLimit;

            const dayOfMonth = Math.max(1, new Date().getDate());
            const dailyAvg = Math.round(totalSpent / dayOfMonth);
            const projectedEOM = dailyAvg * 30;

            return (
              <div className="space-y-4">
                {/* Progress Gauge */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-slate-400 block">
                        {lang === 'bn' ? 'মাসিক বাজেটের ব্যবহার' : 'Monthly Budget Usage'}
                      </span>
                      <p className="text-lg sm:text-2xl font-black text-white tabular-nums">
                        {formatBDT(totalSpent, lang)} / {formatBDT(currentLimit, lang)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs sm:text-sm font-extrabold px-3 py-1 rounded-full ${
                          isExceeded
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : pctUsed >= 75
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {formatNumber(pctUsed, lang)}% {lang === 'bn' ? 'ব্যবহৃত' : 'Used'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isExceeded
                          ? 'bg-rose-500'
                          : pctUsed >= 75
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, pctUsed)}%` }}
                    />
                  </div>

                  {/* Remaining / Exceeded Status */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                    <span className="text-slate-400">
                      {isExceeded
                        ? lang === 'bn'
                          ? `সীমার চেয়ে অতিরিক্ত খরচ:`
                          : `Exceeded by:`
                        : lang === 'bn'
                        ? `বাজেটের বাকি আছে:`
                        : `Remaining Allowance:`}
                    </span>
                    <strong
                      className={`font-black tabular-nums ${
                        isExceeded ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatBDT(Math.abs(remainingAmt), lang)}
                    </strong>
                  </div>
                </div>

                {/* 3. Category Spending Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'খাতভিত্তিক খরচের অংশ' : 'Category Spending Breakdown'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Bazar & Groceries */}
                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-amber-900 dark:text-amber-200">
                          {lang === 'bn' ? 'বাজার ও খাবার' : 'Bazar & Food'}
                        </span>
                        <strong className="text-amber-800 dark:text-amber-300 tabular-nums">
                          {formatBDT(financeSummary.bazarTotal, lang)}
                        </strong>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-amber-200/70 dark:bg-amber-900 overflow-hidden">
                        <div
                          className="h-full bg-amber-600"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((financeSummary.bazarTotal / (totalSpent || 1)) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-400 block text-right">
                        {totalSpent > 0
                          ? `${formatNumber(
                              Math.round((financeSummary.bazarTotal / totalSpent) * 100),
                              lang
                            )}% খরচের অংশ`
                          : '—'}
                      </span>
                    </div>

                    {/* Rent & Bills */}
                    <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-blue-900 dark:text-blue-200">
                          {lang === 'bn' ? 'বাসা ভাড়া ও বিল' : 'Rent & Bills'}
                        </span>
                        <strong className="text-blue-800 dark:text-blue-300 tabular-nums">
                          {formatBDT(financeSummary.rentAndBillsTotal, lang)}
                        </strong>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-blue-200/70 dark:bg-blue-900 overflow-hidden">
                        <div
                          className="h-full bg-blue-600"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((financeSummary.rentAndBillsTotal / (totalSpent || 1)) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-blue-700/80 dark:text-blue-400 block text-right">
                        {totalSpent > 0
                          ? `${formatNumber(
                              Math.round((financeSummary.rentAndBillsTotal / totalSpent) * 100),
                              lang
                            )}% খরচের অংশ`
                          : '—'}
                      </span>
                    </div>

                    {/* Other Expenses */}
                    <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-purple-900 dark:text-purple-200">
                          {lang === 'bn' ? 'অন্যান্য খরচ' : 'Other Expenses'}
                        </span>
                        <strong className="text-purple-800 dark:text-purple-300 tabular-nums">
                          {formatBDT(financeSummary.otherExpensesTotal, lang)}
                        </strong>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-purple-200/70 dark:bg-purple-900 overflow-hidden">
                        <div
                          className="h-full bg-purple-600"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (financeSummary.otherExpensesTotal / (totalSpent || 1)) * 100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-purple-700/80 dark:text-purple-400 block text-right">
                        {totalSpent > 0
                          ? `${formatNumber(
                              Math.round((financeSummary.otherExpensesTotal / totalSpent) * 100),
                              lang
                            )}% খরচের অংশ`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Daily Spending Velocity & Smart Recommendation */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      {lang === 'bn' ? 'দৈনিক খরচের গড় গতি:' : 'Daily Spend Velocity:'}
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      {lang === 'bn'
                        ? `চলতি মাসে দিনে গড় ${formatBDT(dailyAvg, 'bn')} খরচ হচ্ছে। এই গতিতে মাস শেষে আনুমানিক খরচ হতে পারে ${formatBDT(projectedEOM, 'bn')}`
                        : `Averaging ${formatBDT(dailyAvg, 'en')}/day. Projected month-end spend is ${formatBDT(projectedEOM, 'en')}`}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 text-center ${
                      projectedEOM > currentLimit
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {projectedEOM > currentLimit
                      ? lang === 'bn'
                        ? 'সতর্কতা: খরচের গতি বেশি!'
                        : 'Pace Warning!'
                      : lang === 'bn'
                      ? 'খরচের গতি নিয়ন্ত্রণে আছে'
                      : 'Pace On Track'}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
