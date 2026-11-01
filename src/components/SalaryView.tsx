import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  Eye,
  FileText,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useData } from '../context/DataContext';
import type { PaymentMethod, SalaryPayment } from '../types';
import {
  calculateAttendanceBonusEligibility,
  calculateSalaryTotals,
  computeDailyEarnedSalary,
  formatBDT,
  formatNumber,
  getPreviousMonth,
  getRecentMonthsList,
  isFutureMonth,
  isOtherIncomePayment,
  roundCurrency,
  summarizeAttendanceForMonth,
  summarizeMonthlyPayments,
  summarizeOvertimeRecords,
} from '../utils/calculations';
import { formatDateReadable, formatDateSlashDMY, formatMonthLabel, T } from '../utils/i18n';
import { DateInputDMY } from './DateInputDMY';

const PAYMENT_METHODS: Array<{ id: PaymentMethod; labelBn: string; labelEn: string }> = [
  { id: 'bkash', labelBn: 'বিকাশ (bKash)', labelEn: 'bKash' },
  { id: 'nagad', labelBn: 'নগদ (Nagad)', labelEn: 'Nagad' },
  { id: 'cash', labelBn: 'হাতে নগদ (Cash)', labelEn: 'Cash' },
  { id: 'rocket', labelBn: 'রকেট (Rocket)', labelEn: 'Rocket' },
  { id: 'bank', labelBn: 'ব্যাংক (Bank)', labelEn: 'Bank' },
];

export const SalaryView: React.FC = () => {
  const {
    profile,
    selectedMonth,
    setSelectedMonth,
    currentMonthISO,
    lang,
    attendance,
    overtime,
    salaryRecords,
    payments,
    saveSalaryRecord,
    savePayment,
    deletePayment,
    updateProfile,
  } = useData();

  const dict = T[lang];
  const isUpcomingMonth = isFutureMonth(selectedMonth, currentMonthISO);

  const otSummary = summarizeOvertimeRecords(overtime, selectedMonth);
  const existingSalaryRec = salaryRecords.find((s) => s.month === selectedMonth);
  const monthAttendance = attendance.filter((a) => a.month === selectedMonth);
  const monthPayments = payments
    .filter((p) => p.month === selectedMonth && !isOtherIncomePayment(p))
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  // Salary Breakdown state (automatically populated from saved record or user's onboarding/profile)
  const [basicSalary, setBasicSalary] = useState(
    existingSalaryRec?.basicSalary || profile.basicSalary
  );
  const [houseRentAllowance, setHouseRentAllowance] = useState(
    existingSalaryRec?.houseRentAllowance || profile.houseRentAllowance
  );
  const [medicalAllowance, setMedicalAllowance] = useState(
    existingSalaryRec?.medicalAllowance || profile.medicalAllowance
  );
  const [transportAllowance, setTransportAllowance] = useState(
    existingSalaryRec?.transportAllowance || profile.transportAllowance
  );
  const [foodAllowance, setFoodAllowance] = useState(
    existingSalaryRec?.foodAllowance || profile.foodAllowance
  );
  const [attendanceBonus, setAttendanceBonus] = useState(
    existingSalaryRec?.attendanceBonus ?? profile.attendanceBonus
  );
  const [overtimeHours, setOvertimeHours] = useState(
    otSummary.monthlyHours > 0
      ? otSummary.monthlyHours
      : existingSalaryRec?.overtimeHours ?? 0
  );
  const [overtimeEarnings, setOvertimeEarnings] = useState(
    otSummary.monthlyEarnings > 0
      ? otSummary.monthlyEarnings
      : existingSalaryRec?.overtimeEarnings ?? 0
  );
  const [festivalBonus, setFestivalBonus] = useState(existingSalaryRec?.festivalBonus ?? 0);
  const [otherAllowances, setOtherAllowances] = useState(
    existingSalaryRec?.otherAllowances ?? 0
  );
  const [advanceDeduction, setAdvanceDeduction] = useState(
    existingSalaryRec?.advanceDeduction ?? 0
  );
  const [absenceDeduction, setAbsenceDeduction] = useState(
    existingSalaryRec?.absenceDeduction ?? 0
  );
  const [otherDeductions, setOtherDeductions] = useState(
    existingSalaryRec?.otherDeductions ?? 0
  );
  const [adjustments, setAdjustments] = useState(existingSalaryRec?.adjustments ?? 0);
  const [notes, setNotes] = useState(existingSalaryRec?.notes ?? '');
  const [statusMessage, setStatusMessage] = useState('');
  const [showDeductionsSection, setShowDeductionsSection] = useState(true);
  const [isEditingSalaryStatement, setIsEditingSalaryStatement] = useState(false);
  const [showPayslipReportModal, setShowPayslipReportModal] = useState(false);

  // Past Month Salary Record Entry Modal State & Handlers
  const [showPastMonthModal, setShowPastMonthModal] = useState(false);
  const [pastMonthTarget, setPastMonthTarget] = useState<string>(() =>
    getPreviousMonth(currentMonthISO)
  );
  const [pastMonthBasic, setPastMonthBasic] = useState<number>(profile.basicSalary || 12500);
  const [pastMonthGross, setPastMonthGross] = useState<number>(
    profile.grossSalary || profile.basicSalary || 12500
  );
  const [pastMonthAttendedDays, setPastMonthAttendedDays] = useState<number>(26);
  const [pastMonthOtHours, setPastMonthOtHours] = useState<number>(0);
  const [pastMonthOtEarnings, setPastMonthOtEarnings] = useState<number>(0);
  const [pastMonthBonus, setPastMonthBonus] = useState<number>(profile.attendanceBonus || 0);
  const [pastMonthDeductions, setPastMonthDeductions] = useState<number>(0);
  const [pastMonthReceived, setPastMonthReceived] = useState<number>(0);
  const [pastMonthPaymentMethod, setPastMonthPaymentMethod] = useState<PaymentMethod>('bkash');
  const [pastMonthPaymentDate, setPastMonthPaymentDate] = useState<string>('');
  const [pastMonthNotes, setPastMonthNotes] = useState<string>('');
  const [switchMonthOnSave, setSwitchMonthOnSave] = useState(false);

  // Inspected month for the overall performance breakdown (does not mutate global selectedMonth)
  const [inspectedMonth, setInspectedMonth] = useState<string | null>(currentMonthISO);
  // Custom Month-to-Month Comparison & Multi-Month Period Filter states
  const [compareMonthA, setCompareMonthA] = useState<string>(currentMonthISO);
  const [compareMonthB, setCompareMonthB] = useState<string>(() =>
    getPreviousMonth(currentMonthISO)
  );
  const [historyPeriodCount, setHistoryPeriodCount] = useState<3 | 6 | 12 | 'all'>(6);

  // Actual Payment Form state
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(`${selectedMonth}-10`);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [referenceNote, setReferenceNote] = useState('');

  const handleOpenPastMonthModal = (targetMonth?: string) => {
    const monthToUse = targetMonth || getPreviousMonth(currentMonthISO);
    setPastMonthTarget(monthToUse);
    const existingRec = salaryRecords.find((s) => s.month === monthToUse);
    const existingPay = payments.find((p) => p.month === monthToUse && !isOtherIncomePayment(p));
    if (existingRec) {
      setPastMonthBasic(existingRec.basicSalary || profile.basicSalary || 12500);
      setPastMonthGross(existingRec.estimatedGross || profile.grossSalary || 12500);
      setPastMonthOtHours(existingRec.overtimeHours || 0);
      setPastMonthOtEarnings(existingRec.overtimeEarnings || 0);
      setPastMonthBonus(existingRec.attendanceBonus || 0);
      setPastMonthDeductions(
        (existingRec.advanceDeduction || 0) +
        (existingRec.absenceDeduction || 0) +
        (existingRec.otherDeductions || 0)
      );
      setPastMonthNotes(existingRec.notes || '');
    } else {
      setPastMonthBasic(profile.basicSalary || 12500);
      setPastMonthGross(profile.grossSalary || profile.basicSalary || 12500);
      setPastMonthOtHours(0);
      setPastMonthOtEarnings(0);
      setPastMonthBonus(profile.attendanceBonus || 0);
      setPastMonthDeductions(0);
      setPastMonthNotes('');
    }

    if (existingPay) {
      setPastMonthReceived(existingPay.amountReceived);
      setPastMonthPaymentMethod(existingPay.paymentMethod);
      setPastMonthPaymentDate(existingPay.paymentDate);
    } else {
      const defaultPayable = existingRec?.estimatedNetPayable ?? (profile.grossSalary || profile.basicSalary || 12500);
      setPastMonthReceived(defaultPayable);
      setPastMonthPaymentMethod('bkash');
      setPastMonthPaymentDate(`${monthToUse}-10`);
    }

    setPastMonthAttendedDays(26);
    setShowPastMonthModal(true);
  };

  const handlePastMonthTargetChange = (newMonth: string) => {
    setPastMonthTarget(newMonth);
    const existingRec = salaryRecords.find((s) => s.month === newMonth);
    const existingPay = payments.find((p) => p.month === newMonth && !isOtherIncomePayment(p));
    if (existingRec) {
      setPastMonthBasic(existingRec.basicSalary || profile.basicSalary || 12500);
      setPastMonthGross(existingRec.estimatedGross || profile.grossSalary || 12500);
      setPastMonthOtHours(existingRec.overtimeHours || 0);
      setPastMonthOtEarnings(existingRec.overtimeEarnings || 0);
      setPastMonthBonus(existingRec.attendanceBonus || 0);
      setPastMonthDeductions(
        (existingRec.advanceDeduction || 0) +
        (existingRec.absenceDeduction || 0) +
        (existingRec.otherDeductions || 0)
      );
      setPastMonthNotes(existingRec.notes || '');
    }
    if (existingPay) {
      setPastMonthReceived(existingPay.amountReceived);
      setPastMonthPaymentMethod(existingPay.paymentMethod);
      setPastMonthPaymentDate(existingPay.paymentDate);
    } else {
      setPastMonthPaymentDate(`${newMonth}-10`);
    }
  };

  const handlePastMonthOtHoursChange = (hours: number) => {
    const safeHours = Math.max(0, hours);
    setPastMonthOtHours(safeHours);
    const hourlyRate =
      profile.otCustomHourlyRate ||
      (pastMonthBasic ? roundCurrency((pastMonthBasic / (profile.otDivisor || 208)) * (profile.otMultiplier || 2)) : 64.42);
    setPastMonthOtEarnings(roundCurrency(safeHours * hourlyRate));
  };

  const handleSavePastMonthRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastMonthTarget) return;

    const calcNet = Math.max(
      0,
      pastMonthGross + pastMonthOtEarnings + pastMonthBonus - pastMonthDeductions
    );
    const existingRec = salaryRecords.find((s) => s.month === pastMonthTarget);
    const existingPay = payments.find((p) => p.month === pastMonthTarget && !isOtherIncomePayment(p));

    await saveSalaryRecord(
      {
        month: pastMonthTarget,
        effectiveDate: `${pastMonthTarget}-01`,
        basicSalary: pastMonthBasic,
        houseRentAllowance: profile.houseRentAllowance || 0,
        medicalAllowance: profile.medicalAllowance || 0,
        transportAllowance: profile.transportAllowance || 0,
        foodAllowance: profile.foodAllowance || 0,
        attendanceBonus: pastMonthBonus,
        overtimeHours: pastMonthOtHours,
        overtimeEarnings: pastMonthOtEarnings,
        festivalBonus: 0,
        otherAllowances: 0,
        advanceDeduction: pastMonthDeductions,
        absenceDeduction: 0,
        otherDeductions: 0,
        adjustments: 0,
        estimatedGross: pastMonthGross + pastMonthOtEarnings + pastMonthBonus,
        estimatedNetPayable: calcNet,
        notes:
          pastMonthNotes ||
          (lang === 'bn'
            ? `${formatMonthLabel(pastMonthTarget, 'bn')} মাসের সংরক্ষিত বেতন রেকর্ড`
            : `Recorded salary for ${formatMonthLabel(pastMonthTarget, 'en')}`),
      },
      existingRec?.id
    );

    if (pastMonthReceived > 0) {
      await savePayment(
        {
          month: pastMonthTarget,
          paymentDate: pastMonthPaymentDate || `${pastMonthTarget}-10`,
          amountReceived: pastMonthReceived,
          paymentMethod: pastMonthPaymentMethod,
          isPartial: pastMonthReceived < calcNet,
          referenceNote:
            pastMonthNotes ||
            (lang === 'bn'
              ? `${formatMonthLabel(pastMonthTarget, 'bn')} মাসের বেতন প্রাপ্তি`
              : `Salary payment for ${formatMonthLabel(pastMonthTarget, 'en')}`),
        },
        existingPay?.id
      );
    }

    if (switchMonthOnSave) {
      setSelectedMonth(pastMonthTarget);
    }

    setShowPastMonthModal(false);
    setStatusMessage(
      lang === 'bn'
        ? `${formatMonthLabel(pastMonthTarget, 'bn')} মাসের বেতন ও ওভারটাইম রেকর্ড (${formatBDT(calcNet, 'bn')}) সফলভাবে যোগ হয়েছে!`
        : `Salary record for ${formatMonthLabel(pastMonthTarget, 'en')} saved!`
    );
  };

  // Auto-sync salary from profile/record AND auto-sync Overtime Hours & Earnings whenever OT changes
  useEffect(() => {
    const rec = salaryRecords.find((s) => s.month === selectedMonth);
    if (rec) {
      setBasicSalary(rec.basicSalary || profile.basicSalary);
      setHouseRentAllowance(rec.houseRentAllowance || profile.houseRentAllowance);
      setMedicalAllowance(rec.medicalAllowance || profile.medicalAllowance);
      setTransportAllowance(rec.transportAllowance || profile.transportAllowance);
      setFoodAllowance(rec.foodAllowance || profile.foodAllowance);
      setAttendanceBonus(rec.attendanceBonus ?? profile.attendanceBonus);
      // Automatically sync with Overtime Tracker if OT records exist for this month
      setOvertimeHours(
        otSummary.monthlyHours > 0 ? otSummary.monthlyHours : rec.overtimeHours
      );
      setOvertimeEarnings(
        otSummary.monthlyEarnings > 0 ? otSummary.monthlyEarnings : rec.overtimeEarnings
      );
      setFestivalBonus(rec.festivalBonus);
      setOtherAllowances(rec.otherAllowances);
      setAdvanceDeduction(rec.advanceDeduction);
      setAbsenceDeduction(rec.absenceDeduction);
      setOtherDeductions(rec.otherDeductions);
      setAdjustments(rec.adjustments);
      setNotes(rec.notes);
    } else {
      setBasicSalary(profile.basicSalary);
      setHouseRentAllowance(profile.houseRentAllowance);
      setMedicalAllowance(profile.medicalAllowance);
      setTransportAllowance(profile.transportAllowance);
      setFoodAllowance(profile.foodAllowance);
      setAttendanceBonus(profile.attendanceBonus);
      setOvertimeHours(otSummary.monthlyHours);
      setOvertimeEarnings(otSummary.monthlyEarnings);
      setFestivalBonus(0);
      setOtherAllowances(0);
      setAdvanceDeduction(0);
      setAbsenceDeduction(0);
      setOtherDeductions(0);
      setAdjustments(0);
      setNotes('');
    }
  }, [selectedMonth, salaryRecords, profile, otSummary.monthlyHours, otSummary.monthlyEarnings]);

  const totals = calculateSalaryTotals({
    basicSalary,
    houseRentAllowance,
    medicalAllowance,
    transportAllowance,
    foodAllowance,
    attendanceBonus,
    overtimeEarnings,
    festivalBonus,
    otherAllowances,
    advanceDeduction,
    absenceDeduction,
    otherDeductions,
    adjustments,
  });

  // Evaluate whether the worker is eligible for attendance bonus this month or if it was missed
  const attBonusEval = calculateAttendanceBonusEligibility({
    recordsForMonth: monthAttendance,
    profile: {
      ...profile,
      hasAttendanceBonus: (attendanceBonus || 0) > 0 && profile.hasAttendanceBonus !== false,
      attendanceBonus: attendanceBonus || 0,
      attendanceBonusAmount: attendanceBonus || 0,
    },
  });

  const effectiveAttendanceBonus = attBonusEval.isEligible ? (attendanceBonus || 0) : 0;

  // Base fixed monthly salary (e.g., 12,500 BDT) from statement breakdown or profile
  const wageBase =
    totals.baseGross > 0
      ? totals.baseGross
      : profile.grossSalary || profile.basicSalary || 12500;

  const earnedDailyBreakdown = computeDailyEarnedSalary({
    monthlyWage: wageBase,
    attendanceRecords: monthAttendance,
    overtimeEarnings: overtimeEarnings || otSummary.monthlyEarnings,
    attendanceBonus: effectiveAttendanceBonus,
    isAttendanceBonusEligible: attBonusEval.isEligible,
    otherAllowances: (festivalBonus || 0) + (otherAllowances || 0),
    deductions: totals.totalDeductions,
    adjustments: adjustments || 0,
  });

  // Net payable for the month is strictly based on daily attendance + eligible attendance bonus + overtime - deductions
  const effectiveNetPayable = earnedDailyBreakdown.totalEarnedSalary;
  const effectiveGrossEarned = earnedDailyBreakdown.totalEarnedGross;

  const extraEarningsTotal = roundCurrency(
    effectiveAttendanceBonus +
      (overtimeEarnings || 0) +
      (festivalBonus || 0) +
      (otherAllowances || 0)
  );

  const paymentSummary = summarizeMonthlyPayments(effectiveNetPayable, monthPayments);
  const paidPercent =
    effectiveNetPayable > 0
      ? Math.min(100, Math.round((paymentSummary.totalReceived / effectiveNetPayable) * 100))
      : 0;

  const handleSaveSalaryStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSalaryRecord(
      {
        month: selectedMonth,
        effectiveDate: `${selectedMonth}-01`,
        basicSalary,
        houseRentAllowance,
        medicalAllowance,
        transportAllowance,
        foodAllowance,
        attendanceBonus,
        overtimeHours,
        overtimeEarnings,
        festivalBonus,
        otherAllowances,
        advanceDeduction,
        absenceDeduction,
        otherDeductions,
        adjustments,
        estimatedGross: effectiveGrossEarned,
        estimatedNetPayable: effectiveNetPayable,
        notes,
      },
      existingSalaryRec?.id
    );
    await updateProfile({
      basicSalary,
      houseRentAllowance,
      medicalAllowance,
      transportAllowance,
      foodAllowance,
      attendanceBonus,
      grossSalary: wageBase,
    });
    setIsEditingSalaryStatement(false);
    setStatusMessage(
      lang === 'bn'
        ? `মাসিক বেতন বিবরণী (${formatBDT(effectiveNetPayable, 'bn')}) সফলভাবে সংরক্ষিত হয়েছে!`
        : 'Monthly salary statement saved!'
    );
  };

  // Once salary is set (either saved for this month or configured in profile), keep the statement locked until Edit is clicked
  const isSalaryStatementConfigured = Boolean(
    existingSalaryRec || profile.basicSalary > 0 || profile.grossSalary > 0
  );
  const isSalaryStatementLocked = isSalaryStatementConfigured && !isEditingSalaryStatement;

  const [shortfallReason, setShortfallReason] = useState('');

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountReceived <= 0) return;
    if (isUpcomingMonth) {
      setStatusMessage(
        lang === 'bn'
          ? 'আসন্ন মাসে অগ্রিম প্রাপ্ত বেতন যোগ করা যাবে না।'
          : 'Cannot add salary for upcoming months.'
      );
      return;
    }
    const isPartial = amountReceived < effectiveNetPayable;
    const finalNote = shortfallReason.trim()
      ? `[কর্তন/কম: ${shortfallReason.trim()}] ${referenceNote.trim()}`.trim()
      : referenceNote.trim();

    await savePayment(
      {
        month: selectedMonth,
        paymentDate,
        amountReceived,
        paymentMethod,
        isPartial,
        referenceNote: finalNote,
      },
      editingPaymentId || undefined
    );
    setEditingPaymentId(null);
    setAmountReceived(0);
    setReferenceNote('');
    setShortfallReason('');
    setStatusMessage(
      lang === 'bn'
        ? `প্রাপ্ত বেতনের এন্ট্রি (${formatBDT(amountReceived, 'bn')}) সফলভাবে সংরক্ষিত হয়েছে!`
        : 'Actual salary payment recorded!'
    );
  };

  const handleEditPayment = (pay: SalaryPayment) => {
    setEditingPaymentId(pay.id);
    setPaymentDate(pay.paymentDate);
    setAmountReceived(pay.amountReceived);
    setPaymentMethod(pay.paymentMethod);
    const rawNote = pay.referenceNote || '';
    const match = rawNote.match(/\[(?:কর্তন\/কম|কম পাওয়ার কারণ):\s*([^\]]+)\]/);
    if (match) {
      setShortfallReason(match[1]);
      setReferenceNote(rawNote.replace(match[0], '').trim());
    } else {
      setShortfallReason('');
      setReferenceNote(rawNote);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 w-full min-w-0 max-w-full overflow-x-hidden">
      {/* Clean Top Summary Banner with Payment Progress */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white p-0.5 border border-emerald-100 dark:border-slate-700 shadow-2xs flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png"
                alt="শ্রমিক সাথী লোগো"
                data-testid="salary-brand-logo"
                width={40}
                height={40}
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span className="truncate">
                  {lang === 'bn'
                    ? `বেতন ও পে-স্লিপ — ${formatMonthLabel(selectedMonth, 'bn')}`
                    : `Salary & Payslip — ${formatMonthLabel(selectedMonth, 'en')}`}
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                {lang === 'bn'
                  ? 'চলতি ও পূর্বের যেকোনো মাসের বেতন বিবরণী ও হিসাব'
                  : 'Monthly salary records & performance'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto no-print">
            <button
              type="button"
              data-testid="header-add-past-salary-btn"
              onClick={() => handleOpenPastMonthModal()}
              className="min-h-[36px] sm:min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
              title={lang === 'bn' ? 'জয়েনিং বা পূর্বের মাসের বেতন যোগ করুন' : 'Add past month salary record'}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'bn' ? 'পূর্বের মাসের রেকর্ড' : 'Add Past Month'}</span>
            </button>

            <button
              type="button"
              data-testid="open-payslip-report-btn"
              onClick={() => setShowPayslipReportModal(true)}
              className="min-h-[36px] sm:min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors shadow-xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-white shrink-0" />
              <span>{lang === 'bn' ? 'পে-স্লিপ রিপোর্ট' : 'Download Payslip'}</span>
            </button>
          </div>
        </div>

        {/* Attendance-Based Daily Earned Salary Summary Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200/60 dark:border-emerald-800/40">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-sm sm:text-base font-bold text-emerald-950 dark:text-emerald-100">
                  {lang === 'bn' ? 'উপস্থিতি অনুযায়ী চলতি অর্জিত বেতন' : 'Current Earned Salary (Attendance)'}
                </h3>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                  {lang === 'bn'
                    ? `দৈনিক বেতন = মূল/মোট বেতন (${formatBDT(earnedDailyBreakdown.monthlyWage, 'bn')}) ÷ ৩০ দিন = ${formatBDT(earnedDailyBreakdown.dailyWageRate, 'bn')}/দিন`
                    : `Daily Rate = Monthly (${formatBDT(earnedDailyBreakdown.monthlyWage, 'en')}) ÷ 30 days = ${formatBDT(earnedDailyBreakdown.dailyWageRate, 'en')}/day`}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80 block font-semibold">
                {lang === 'bn' ? 'চলতি অর্জিত মোট টাকা' : 'Earned So Far'}
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-200 tabular-nums">
                {formatBDT(earnedDailyBreakdown.totalEarnedSalary, lang)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                {lang === 'bn' ? 'উপস্থিতি / কাজের দিন' : 'Attended Days'}
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white tabular-nums text-sm">
                {formatNumber(earnedDailyBreakdown.attendedDaysCount, lang)} {lang === 'bn' ? 'দিন' : 'days'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                {lang === 'bn' ? 'অর্জিত মূল বেতন' : 'Earned Base'}
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white tabular-nums text-sm">
                {formatBDT(earnedDailyBreakdown.earnedBaseSalary, lang)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                {lang === 'bn' ? 'ওটি + হাজিরা বোনাস' : 'OT + Bonus'}
              </span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums text-sm">
                +{formatBDT(earnedDailyBreakdown.overtimeEarnings + earnedDailyBreakdown.earnedAttendanceBonus, lang)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                {lang === 'bn' ? 'সম্ভাব্য পূর্ণ বেতন (৩০ দিন)' : 'Full Month (30d)'}
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white tabular-nums text-sm">
                {formatBDT(earnedDailyBreakdown.fullExpectedMonthlySalary, lang)}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Clean Comparison Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              {lang === 'bn' ? 'মোট প্রাপ্য নিট বেতন (উপস্থিতি অনুযায়ী)' : 'Estimated Net Payable'}
            </span>
            <p
              data-testid="salary-estimated-net"
              className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums"
            >
              {formatBDT(effectiveNetPayable, lang)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              {lang === 'bn' ? 'অর্জিত মোট:' : 'Earned Gross:'} {formatBDT(effectiveGrossEarned, lang)} ·{' '}
              {lang === 'bn' ? 'কর্তন:' : 'Ded:'} {formatBDT(totals.totalDeductions, lang)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/70">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 block">
              {lang === 'bn' ? 'হাতে প্রাপ্ত বেতন' : 'Actual Salary Received'}
            </span>
            <p
              data-testid="salary-actual-received"
              className="mt-1 text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
            >
              {formatBDT(paymentSummary.totalReceived, lang)}
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
              {paymentSummary.status === 'paid'
                ? lang === 'bn'
                  ? 'সম্পূর্ণ বেতন পরিশোধিত'
                  : 'Paid in full'
                : paymentSummary.status === 'partial'
                ? lang === 'bn'
                  ? `${formatNumber(paidPercent, 'bn')}% প্রাপ্ত (আংশিক পরিশোধিত)`
                  : `${paidPercent}% received (Partial)`
                : lang === 'bn'
                ? 'এখনো পেমেন্ট এন্ট্রি করা হয়নি'
                : 'No payment recorded yet'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              {lang === 'bn' ? 'বকেয়া বেতন স্থিতি' : 'Outstanding Balance'}
            </span>
            <p
              data-testid="salary-outstanding"
              className={`mt-1 text-xl sm:text-2xl font-bold tabular-nums ${
                paymentSummary.outstandingBalance > 0
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {formatBDT(paymentSummary.outstandingBalance, lang)}
            </p>
            <div className="mt-2 w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${paidPercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {statusMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2 no-print"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Split: Clean Salary Statement Builder (Left) + Actual Payment Tracker (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Read-Only Saved Salary Statement Summary OR Editable Form when Edit is clicked */}
        {isSalaryStatementLocked ? (
          <div
            data-testid="saved-salary-statement-card"
            className="lg:col-span-7 bg-white dark:bg-slate-900 border border-emerald-200/90 dark:border-emerald-800/80 rounded-2xl p-4 sm:p-5 space-y-4 self-start shadow-2xs"
          >
            {/* Header with Edit Button */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 no-print">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {lang === 'bn' ? 'বেতন ও ভাতার হিসাব (সংরক্ষিত)' : 'Salary & Allowances (Saved)'}
                  </h2>
                  <p className="text-[11px] text-slate-500 truncate">
                    {lang === 'bn'
                      ? 'পরিবর্তন করতে ডান পাশের "এডিট করুন" বাটনে ক্লিক করুন'
                      : 'Click "Edit" to modify salary or allowances'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="edit-salary-statement-btn"
                onClick={() => setIsEditingSalaryStatement(true)}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'এডিট করুন' : 'Edit'}</span>
              </button>
            </div>

            {/* 1. Saved Basic Salary & Fixed Allowances */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? '১. মূল বেতন ও নিয়মিত ভাতাসমূহ' : '1. Basic Salary & Fixed Allowances'}
                </h3>
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {lang === 'bn' ? 'নির্ধারিত মোট (৩০ দিন):' : 'Fixed 30d Gross:'} {formatBDT(wageBase, lang)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'bn' ? 'মূল বেতন' : 'Basic Salary'}
                  </span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatBDT(basicSalary, lang)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'bn' ? 'বাড়ি ভাড়া ভাতা' : 'House Rent'}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatBDT(houseRentAllowance, lang)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'bn' ? 'চিকিৎসা ভাতা' : 'Medical'}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatBDT(medicalAllowance, lang)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'bn' ? 'যাতায়াত ভাতা' : 'Transport'}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatBDT(transportAllowance, lang)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'bn' ? 'খাদ্য ভাতা' : 'Food'}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatBDT(foodAllowance, lang)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 block">
                    {lang === 'bn' ? 'নির্ধারিত মোট বেতন' : 'Base Gross'}
                  </span>
                  <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums">
                    {formatBDT(wageBase, lang)}
                  </span>
                </div>
              </div>

              {/* Daily Attendance Earned Salary Calculation Box */}
              <div
                data-testid="statement-daily-attendance-calc"
                className="p-3 rounded-xl bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
                    {lang === 'bn'
                      ? `উপস্থিতির ভিত্তিতে অর্জিত বেতন (${formatNumber(earnedDailyBreakdown.attendedDaysCount, 'bn')} দিন উপস্থিত)`
                      : `Attendance-Based Earned Salary (${earnedDailyBreakdown.attendedDaysCount} days)`}
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 tabular-nums">
                    {lang === 'bn'
                      ? `দৈনিক হার: ${formatBDT(wageBase, 'bn')} ÷ ৩০ = ${formatBDT(earnedDailyBreakdown.dailyWageRate, 'bn')}/দিন × ${formatNumber(earnedDailyBreakdown.attendedDaysCount, 'bn')} দিন`
                      : `Daily rate: ${formatBDT(wageBase, 'en')} ÷ 30 = ${formatBDT(earnedDailyBreakdown.dailyWageRate, 'en')}/day × ${earnedDailyBreakdown.attendedDaysCount}d`}
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 block">
                    {lang === 'bn' ? 'উপস্থিতির অর্জিত বেতন' : 'Earned Base Salary'}
                  </span>
                  <span
                    data-testid="statement-earned-base-salary"
                    className="text-base font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums"
                  >
                    {formatBDT(earnedDailyBreakdown.earnedBaseSalary, lang, true)}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Overtime & Bonuses (Auto-Synced) */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? '২. ওভারটাইম টাকা ও বোনাসসমূহ' : '2. Overtime Pay & Bonuses'}
                  </h3>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {lang === 'bn'
                      ? `অতিরিক্ত উপার্জন মোট: ${formatBDT(extraEarningsTotal, 'bn')}`
                      : `Extra Earnings: ${formatBDT(extraEarningsTotal, 'en')}`}
                  </p>
                </div>

                <span
                  data-testid="ot-auto-sync-badge"
                  className="min-h-[28px] px-2.5 py-1 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/70 border border-emerald-300/70 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    {lang === 'bn'
                      ? `অটো সিঙ্ক (${formatNumber(overtimeHours, 'bn', 1)} ঘঃ)`
                      : `Auto Synced (${overtimeHours}h)`}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800/60">
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'bn' ? 'ওভারটাইম টাকা' : 'Overtime Pay'}
                  </span>
                  <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatBDT(overtimeEarnings, lang)}
                  </span>
                </div>
                <div
                  data-testid="statement-attendance-bonus-box"
                  className={`p-2.5 rounded-xl bg-white dark:bg-slate-900 border ${
                    !attBonusEval.isEligible && (attendanceBonus || 0) > 0
                      ? 'border-rose-200 dark:border-rose-800/70'
                      : 'border-slate-200/70 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-slate-500 block truncate">
                      {lang === 'bn' ? 'হাজিরা বোনাস' : 'Attendance Bonus'}
                    </span>
                    {!attBonusEval.isEligible && (attendanceBonus || 0) > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 shrink-0">
                        {lang === 'bn' ? 'মিস (বাদ)' : 'Missed'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        !attBonusEval.isEligible && (attendanceBonus || 0) > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {formatBDT(effectiveAttendanceBonus, lang)}
                    </span>
                    {!attBonusEval.isEligible && (attendanceBonus || 0) > 0 && (
                      <span className="text-[11px] text-slate-400 line-through tabular-nums">
                        {formatBDT(attendanceBonus, lang)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'bn' ? 'ঈদ / উৎসব বোনাস' : 'Festival Bonus'}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatBDT(festivalBonus, lang)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">
                    {lang === 'bn' ? 'অন্যান্য ভাতা' : 'Other Allowances'}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatBDT(otherAllowances, lang)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Deductions & Total Net Payable Footer */}
            {(totals.totalDeductions > 0 || adjustments !== 0) && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'bn' ? '৩. অগ্রিম ও মোট কর্তন:' : '3. Total Deductions:'}{' '}
                  <strong className="text-rose-600 dark:text-rose-400">
                    -{formatBDT(totals.totalDeductions, lang)}
                  </strong>
                </span>
                {adjustments !== 0 && (
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {lang === 'bn' ? 'সমন্বয়:' : 'Adjustment:'}{' '}
                    <strong>{formatBDT(adjustments, lang)}</strong>
                  </span>
                )}
              </div>
            )}

            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs text-slate-300">
                  {lang === 'bn'
                    ? 'এই মাসের সর্বমোট প্রাপ্য নিট বেতন'
                    : 'Total Estimated Net Payable'}
                </p>
                <p
                  data-testid="statement-net-payable-amount"
                  className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums"
                >
                  {formatBDT(effectiveNetPayable, lang, true)}
                </p>
                <p className="text-[11px] text-slate-300 tabular-nums">
                  {lang === 'bn'
                    ? `উপস্থিতির বেতন (${formatBDT(earnedDailyBreakdown.earnedBaseSalary, 'bn')}) + হাজিরা বোনাস (${formatBDT(effectiveAttendanceBonus, 'bn')}) + ওভারটাইম (${formatBDT(overtimeEarnings, 'bn')})${totals.totalDeductions > 0 ? ` − কর্তন (${formatBDT(totals.totalDeductions, 'bn')})` : ''}`
                    : `Attendance (${formatBDT(earnedDailyBreakdown.earnedBaseSalary, 'en')}) + Bonus (${formatBDT(effectiveAttendanceBonus, 'en')}) + OT (${formatBDT(overtimeEarnings, 'en')})`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingSalaryStatement(true)}
                className="min-h-[40px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer no-print"
              >
                <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{lang === 'bn' ? 'হিসাব এডিট করুন' : 'Edit Statement'}</span>
              </button>
            </div>
          </div>
        ) : (
        <form
          onSubmit={handleSaveSalaryStatement}
          className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 no-print">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>
                {lang === 'bn'
                  ? 'বেতন ও ভাতার হিসাব'
                  : 'Monthly Salary & Allowances'}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200/70 dark:border-emerald-800/70 tabular-nums">
                {formatBDT(effectiveNetPayable, lang)}
              </span>
              {isSalaryStatementConfigured && (
                <button
                  type="button"
                  onClick={() => setIsEditingSalaryStatement(false)}
                  className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
              )}
            </div>
          </div>

          {/* Section 1: Core Salary & Fixed Allowances (Clean 2x3 Grid) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? '১. মূল বেতন ও নিয়মিত ভাতাসমূহ' : '1. Basic Salary & Fixed Allowances'}
              </h3>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
                {lang === 'bn' ? 'নির্ধারিত মোট (৩০ দিন):' : 'Subtotal:'} {formatBDT(wageBase, lang)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'মূল বেতন' : 'Basic Salary'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'বাড়ি ভাড়া ভাতা (৫০%)' : 'House Rent'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    value={houseRentAllowance}
                    onChange={(e) => setHouseRentAllowance(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm font-semibold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'চিকিৎসা ভাতা' : 'Medical Allowance'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    value={medicalAllowance}
                    onChange={(e) => setMedicalAllowance(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm font-semibold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'যাতায়াত ভাতা' : 'Transport Allowance'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    aria-label="Transport Allowance"
                    value={transportAllowance}
                    onChange={(e) => setTransportAllowance(Number(e.target.value) || 0)}
                    title={lang === 'bn' ? 'যাতায়াত ভাতা' : 'Transport'}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm font-semibold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'খাদ্য ভাতা' : 'Food Allowance'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    aria-label="Food Allowance"
                    value={foodAllowance}
                    onChange={(e) => setFoodAllowance(Number(e.target.value) || 0)}
                    title={lang === 'bn' ? 'খাদ্য ভাতা' : 'Food'}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm font-semibold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 truncate">
                  {lang === 'bn' ? 'নির্ধারিত মোট বেতন' : 'Base Gross'}
                </span>
                <div className="min-h-[40px] rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 flex items-center text-sm font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                  {formatBDT(wageBase, lang)}
                </div>
              </div>
            </div>

            {/* Daily Attendance Earned Salary Calculation Box in Edit Mode */}
            <div
              data-testid="statement-daily-attendance-calc-edit"
              className="p-3 rounded-xl bg-emerald-100/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
                  {lang === 'bn'
                    ? `উপস্থিতির ভিত্তিতে অর্জিত বেতন (${formatNumber(earnedDailyBreakdown.attendedDaysCount, 'bn')} দিন উপস্থিত)`
                    : `Attendance-Based Earned Salary (${earnedDailyBreakdown.attendedDaysCount} days)`}
                </p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 tabular-nums">
                  {lang === 'bn'
                    ? `দৈনিক হার: ${formatBDT(wageBase, 'bn')} ÷ ৩০ = ${formatBDT(earnedDailyBreakdown.dailyWageRate, 'bn')}/দিন × ${formatNumber(earnedDailyBreakdown.attendedDaysCount, 'bn')} দিন`
                    : `Daily rate: ${formatBDT(wageBase, 'en')} ÷ 30 = ${formatBDT(earnedDailyBreakdown.dailyWageRate, 'en')}/day × ${earnedDailyBreakdown.attendedDaysCount}d`}
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 block">
                  {lang === 'bn' ? 'উপস্থিতির অর্জিত বেতন' : 'Earned Base Salary'}
                </span>
                <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums">
                  {formatBDT(earnedDailyBreakdown.earnedBaseSalary, lang, true)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Overtime & Bonuses (Automatically Synced) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {lang === 'bn' ? '২. ওভারটাইম টাকা ও বোনাসসমূহ' : '2. Overtime Pay & Bonuses'}
                </h3>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {lang === 'bn'
                    ? `অতিরিক্ত উপার্জন মোট: ${formatBDT(extraEarningsTotal, 'bn')}`
                    : `Extra Earnings Subtotal: ${formatBDT(extraEarningsTotal, 'en')}`}
                </p>
              </div>

              <span
                data-testid="ot-auto-sync-badge"
                className="min-h-[30px] px-2.5 py-1 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/70 border border-emerald-300/70 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 no-print"
              >
                <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {lang === 'bn'
                    ? `অটো সিঙ্ক (${formatNumber(overtimeHours, 'bn', 1)} ঘঃ)`
                    : `Auto Synced (${overtimeHours}h)`}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'ওভারটাইম টাকা' : 'Overtime Pay'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">
                    ৳
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={overtimeEarnings}
                    onChange={(e) => setOvertimeEarnings(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {lang === 'bn' ? 'হাজিরা বোনাস' : 'Attendance Bonus'}
                  </label>
                  {!attBonusEval.isEligible && (attendanceBonus || 0) > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 shrink-0">
                      {lang === 'bn' ? 'মিস (৳ ০)' : 'Missed'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    value={attendanceBonus}
                    onChange={(e) => setAttendanceBonus(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm font-semibold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'ঈদ / উৎসব বোনাস' : 'Festival Bonus'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    value={festivalBonus}
                    onChange={(e) => setFestivalBonus(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm font-semibold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'অন্যান্য ভাতা' : 'Other Allowances'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    value={otherAllowances}
                    onChange={(e) => setOtherAllowances(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm font-semibold tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Deductions & Adjustments (Clean Collapsible Section) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <button
              type="button"
              onClick={() => setShowDeductionsSection((v: boolean) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn'
                    ? '৩. অগ্রিম টাকা, কর্তন ও সমন্বয়'
                    : '3. Advances, Deductions & Adjustments'}
                </h3>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {lang === 'bn'
                    ? `মোট কর্তন: ${formatBDT(totals.totalDeductions, 'bn')}`
                    : `Total Deductions: ${formatBDT(totals.totalDeductions, 'en')}`}
                </p>
              </div>
              {showDeductionsSection ? (
                <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
              )}
            </button>

            {showDeductionsSection && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 truncate">
                    {lang === 'bn' ? 'অগ্রিম গ্রহণ' : 'Advance Taken'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ৳
                    </span>
                    <input
                      type="number"
                      value={advanceDeduction}
                      onChange={(e) => setAdvanceDeduction(Number(e.target.value) || 0)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 truncate">
                    {lang === 'bn' ? 'অনুপস্থিতি কর্তন' : 'Absence Deduction'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ৳
                    </span>
                    <input
                      type="number"
                      value={absenceDeduction}
                      onChange={(e) => setAbsenceDeduction(Number(e.target.value) || 0)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 truncate">
                    {lang === 'bn' ? 'অন্যান্য কর্তন' : 'Other Deductions'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ৳
                    </span>
                    <input
                      type="number"
                      value={otherDeductions}
                      onChange={(e) => setOtherDeductions(Number(e.target.value) || 0)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 truncate">
                    {lang === 'bn' ? 'সমন্বয় (+/−)' : 'Adjustments (+/-)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ৳
                    </span>
                    <input
                      type="number"
                      value={adjustments}
                      onChange={(e) => setAdjustments(Number(e.target.value) || 0)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-6 pr-2.5 text-sm tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save Salary Statement Footer */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-slate-300">
                {lang === 'bn'
                  ? 'এই মাসের সর্বমোট প্রাপ্য নিট বেতন'
                  : 'Total Estimated Net Payable'}
              </p>
              <p
                data-testid="statement-net-payable-amount"
                className="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums"
              >
                {formatBDT(effectiveNetPayable, lang, true)}
              </p>
              <p className="text-[11px] text-slate-300 tabular-nums">
                {lang === 'bn'
                  ? `উপস্থিতির বেতন (${formatBDT(earnedDailyBreakdown.earnedBaseSalary, 'bn')}) + হাজিরা বোনাস (${formatBDT(effectiveAttendanceBonus, 'bn')}) + ওভারটাইম (${formatBDT(overtimeEarnings, 'bn')})${totals.totalDeductions > 0 ? ` − কর্তন (${formatBDT(totals.totalDeductions, 'bn')})` : ''}`
                  : `Attendance (${formatBDT(earnedDailyBreakdown.earnedBaseSalary, 'en')}) + Bonus (${formatBDT(effectiveAttendanceBonus, 'en')}) + OT (${formatBDT(overtimeEarnings, 'en')})`}
              </p>
            </div>
            <button
              type="submit"
              data-testid="save-salary-statement-btn"
              className="w-full sm:w-auto min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors no-print cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{lang === 'bn' ? 'বেতন বিবরণী সংরক্ষণ করুন' : 'Save Salary Statement'}</span>
            </button>
          </div>
        </form>
        )}
        {/* Right Column: Record Actual Salary Payments & Installment History */}
        <div className="lg:col-span-5 space-y-6 no-print">
          {isUpcomingMonth ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {lang === 'bn' ? `${formatMonthLabel(selectedMonth, 'bn')} আসন্ন মাস (লক)` : `${formatMonthLabel(selectedMonth, 'en')} is an Upcoming Month`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'আসন্ন মাসের অগ্রিম প্রাপ্ত বেতন যোগ করা যাবে না। মাস সম্পন্ন হলে এখানে প্রাপ্ত বেতন সংরক্ষণ করতে পারবেন।'
                  : 'Cannot record salary for future months in advance.'}
              </p>
            </div>
          ) : monthPayments.length > 0 && !editingPaymentId ? (
            <div className="bg-white dark:bg-slate-900 border border-emerald-200/90 dark:border-emerald-800/80 rounded-2xl p-5 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {lang === 'bn' ? `${formatMonthLabel(selectedMonth, 'bn')} মাসের বেতন সংরক্ষণ সম্পন্ন` : `${formatMonthLabel(selectedMonth, 'en')} Salary Saved`}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">
                      {formatDateSlashDMY(monthPayments[0].paymentDate, lang)} ({formatDateReadable(monthPayments[0].paymentDate, lang)})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="edit-salary-payment-btn"
                  onClick={() => handleEditPayment(monthPayments[0])}
                  className="min-h-[34px] px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'এডিট করুন' : 'Edit'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                    {lang === 'bn' ? 'হাতে পাওয়া বেতন' : 'Received Amount'}
                  </span>
                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatBDT(monthPayments[0].amountReceived, lang)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                    {lang === 'bn' ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                    {monthPayments[0].paymentMethod}
                  </span>
                </div>
              </div>

              {/* Shortfall or Deductions note */}
              {effectiveNetPayable > monthPayments[0].amountReceived && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-800 dark:text-rose-300">
                      {lang === 'bn' ? 'কর্তন / না পাওয়ার পরিমাণ:' : 'Deduction / Shortfall:'}
                    </span>
                    <span className="font-extrabold text-rose-700 dark:text-rose-400 tabular-nums">
                      - {formatBDT(effectiveNetPayable - monthPayments[0].amountReceived, lang)}
                    </span>
                  </div>
                  {monthPayments[0].referenceNote && (
                    <p className="text-[11px] text-rose-700 dark:text-rose-300/90">
                      <span className="font-semibold">{lang === 'bn' ? 'কারণ: ' : 'Reason: '}</span>
                      {monthPayments[0].referenceNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleAddPayment}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>
                      {editingPaymentId
                        ? lang === 'bn'
                          ? 'প্রাপ্ত বেতনের তথ্য সংশোধন'
                          : 'Edit Salary Payment'
                        : lang === 'bn'
                        ? 'হাতে পাওয়া বেতন জমা লিখুন'
                        : 'Record Actual Salary Received'}
                    </span>
                  </h2>
                </div>
                {editingPaymentId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPaymentId(null);
                      setAmountReceived(0);
                      setReferenceNote('');
                      setShortfallReason('');
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                )}
              </div>

              {/* Total Expected Salary info */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  {lang === 'bn' ? 'এই মাসের মোট প্রাপ্য নিট বেতন:' : 'Expected Net Payable:'}
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatBDT(effectiveNetPayable, lang)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="payment-date-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'টাকা পাওয়ার তারিখ' : 'Payment Date'}
                  </label>
                  <DateInputDMY
                    id="payment-date-input"
                    dataTestId="payment-date-input"
                    value={paymentDate}
                    lang={lang}
                    onChange={setPaymentDate}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="payment-amount-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'প্রাপ্ত টাকার পরিমাণ (৳)' : 'Amount Received (৳)'}
                  </label>
                  <input
                    id="payment-amount-input"
                    type="number"
                    min={1}
                    step="1"
                    value={amountReceived || ''}
                    onChange={(e) => setAmountReceived(Number(e.target.value) || 0)}
                    placeholder="যেমন: 12500"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                    required
                  />
                </div>
              </div>

              {/* Shortfall Detection Banner & Reason Input if received < expected */}
              {amountReceived > 0 && amountReceived < effectiveNetPayable && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900 dark:text-amber-200">
                      {lang === 'bn' ? 'প্রাপ্য থেকে কম হয়েছে:' : 'Shortfall from Expected:'}
                    </span>
                    <span className="font-extrabold text-rose-600 dark:text-rose-400 tabular-nums text-sm">
                      - {formatBDT(effectiveNetPayable - amountReceived, lang)}
                    </span>
                  </div>
                  <div>
                    <label htmlFor="shortfall-reason-input" className="block text-[11px] font-semibold text-amber-900 dark:text-amber-200 mb-1">
                      {lang === 'bn' ? 'টাকা কম পাওয়ার কারণ বা কর্তন (যেমন: লেট ফাইন, অ্যাডভান্স কর্তন বা ছুটি):' : 'Reason for shortfall / deduction:'}
                    </label>
                    <input
                      id="shortfall-reason-input"
                      type="text"
                      value={shortfallReason}
                      onChange={(e) => setShortfallReason(e.target.value)}
                      placeholder={lang === 'bn' ? 'যেমন: ৩০০ টাকা লেট জরিমানা কাটা গেছে' : 'e.g. 300 BDT deducted for late arrival'}
                      className="w-full min-h-[38px] rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Clean Payment Method Pill Selector */}
              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === 'bn' ? 'কোন মাধ্যমে টাকা পেয়েছেন?' : 'Payment Method'}
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                        paymentMethod === pm.id
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {lang === 'bn' ? pm.labelBn.split(' ')[0] : pm.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="payment-note-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {lang === 'bn' ? 'নোট / বিকাশ রেফারেন্স (ঐচ্ছিক)' : 'Reference / Note'}
                </label>
                <input
                  id="payment-note-input"
                  type="text"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: ১ম কিস্তি বা মূল বেতন প্রাপ্তি'
                      : 'e.g. First installment or full pay'
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                {editingPaymentId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPaymentId(null);
                      setAmountReceived(0);
                      setReferenceNote('');
                      setShortfallReason('');
                    }}
                    className="min-h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                )}
                <button
                  type="submit"
                  data-testid="save-payment-btn"
                  className="flex-1 min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {editingPaymentId
                      ? lang === 'bn'
                        ? 'পেমেন্ট আপডেট করুন'
                        : 'Update Payment'
                      : lang === 'bn'
                      ? 'প্রাপ্ত বেতন সংরক্ষণ করুন'
                      : 'Record Payment Received'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Recorded Payments List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'প্রাপ্ত বেতনের কিস্তি ও ইতিহাস' : 'Recorded Salary Payments'}
              </h2>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatBDT(paymentSummary.totalReceived, lang)}
              </span>
            </div>

            {monthPayments.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {lang === 'bn'
                  ? 'এই মাসে এখনো কোনো প্রাপ্ত বেতনের এন্ট্রি যোগ করা হয়নি।'
                  : 'No salary payments recorded for this month yet.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {monthPayments.map((pay) => (
                  <div
                    key={pay.id}
                    className="py-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatDateSlashDMY(pay.paymentDate, lang)} ({formatDateReadable(pay.paymentDate, lang)})
                        </span>
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
                          · {pay.paymentMethod}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {pay.referenceNote ||
                          (pay.isPartial
                            ? lang === 'bn'
                              ? 'আংশিক কিস্তি প্রাপ্তি'
                              : 'Partial payment'
                            : lang === 'bn'
                            ? 'বেতন প্রাপ্তি'
                            : 'Salary received')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatBDT(pay.amountReceived, lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEditPayment(pay)}
                        aria-label={`Edit payment ${pay.id}`}
                        className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePayment(pay.id)}
                        aria-label={`Delete payment ${pay.id}`}
                        className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Overall Monthly Salary & Overtime Performance History + Custom Month Comparison & 3/6/7/12-Month Range */}
      {(() => {
        const prevMonthISO = getPreviousMonth(currentMonthISO);
        const prev2MonthISO = getPreviousMonth(prevMonthISO);
        const prev3MonthISO = getPreviousMonth(prev2MonthISO);

        const buildMonthPerformance = (m: string) => {
          const salRec = salaryRecords.find((s) => s.month === m);
          const mOt = summarizeOvertimeRecords(overtime, m);
          const mAtt = summarizeAttendanceForMonth(
            attendance.filter((a) => (a.month || a.date.slice(0, 7)) === m)
          );
          const mPayList = payments.filter(
            (p) => (p.month || p.paymentDate.slice(0, 7)) === m && !isOtherIncomePayment(p)
          );
          const mReceived = mPayList.reduce((s, p) => s + p.amountReceived, 0);

          const hasSavedRecord = Boolean(salRec);
          const hasLoggedActivity =
            mAtt.presentDays > 0 || mAtt.workingDays > 0 || mAtt.absentDays > 0 || mOt.monthlyHours > 0 || mPayList.length > 0;
          const isCurrentOrActiveMonth = m === currentMonthISO || m === selectedMonth;
          const hasRecord = hasSavedRecord || hasLoggedActivity || isCurrentOrActiveMonth;

          // If a past month has no saved record, no activity, and is not current/selected month:
          if (!hasRecord) {
            return {
              month: m,
              hasRecord: false,
              baseGross: 0,
              otHours: 0,
              otEarnings: 0,
              bonusTotal: 0,
              totalDeductions: 0,
              netPayable: 0,
              received: 0,
              due: 0,
              attendance: mAtt,
            };
          }

          const mOtHours =
            mOt.monthlyHours > 0 ? mOt.monthlyHours : salRec?.overtimeHours ?? 0;
          const mOtEarnings =
            mOt.monthlyEarnings > 0 ? mOt.monthlyEarnings : salRec?.overtimeEarnings ?? 0;
          const mAttBonus = salRec?.attendanceBonus ?? profile.attendanceBonus ?? 0;
          const mFestivalBonus = salRec?.festivalBonus ?? 0;
          const mOtherAllowances = salRec?.otherAllowances ?? 0;

          const mTotals = calculateSalaryTotals({
            basicSalary: salRec?.basicSalary || profile.basicSalary,
            houseRentAllowance: salRec?.houseRentAllowance || profile.houseRentAllowance,
            medicalAllowance: salRec?.medicalAllowance || profile.medicalAllowance,
            transportAllowance: salRec?.transportAllowance || profile.transportAllowance,
            foodAllowance: salRec?.foodAllowance || profile.foodAllowance,
            attendanceBonus: mAttBonus,
            overtimeEarnings: mOtEarnings,
            festivalBonus: mFestivalBonus,
            otherAllowances: mOtherAllowances,
            advanceDeduction: salRec?.advanceDeduction ?? 0,
            absenceDeduction: salRec?.absenceDeduction ?? 0,
            otherDeductions: salRec?.otherDeductions ?? 0,
            adjustments: salRec?.adjustments ?? 0,
          });

          const isSelectedCurrent = m === selectedMonth;
          const mBonusTotal = isSelectedCurrent
            ? effectiveAttendanceBonus + mFestivalBonus + mOtherAllowances
            : mAttBonus + mFestivalBonus + mOtherAllowances;
          const mNetPayable = isSelectedCurrent
            ? effectiveNetPayable
            : salRec?.estimatedNetPayable ?? mTotals.estimatedNetPayable;
          const mBaseGross = isSelectedCurrent
            ? earnedDailyBreakdown.earnedBaseSalary
            : salRec?.estimatedGross ?? mTotals.baseGross;
          const mDue = Math.max(0, mNetPayable - mReceived);

          return {
            month: m,
            hasRecord: true,
            baseGross: mBaseGross,
            otHours: mOtHours,
            otEarnings: mOtEarnings,
            bonusTotal: mBonusTotal,
            totalDeductions: salRec
              ? (salRec.advanceDeduction || 0) +
                (salRec.absenceDeduction || 0) +
                (salRec.otherDeductions || 0)
              : mTotals.totalDeductions,
            netPayable: mNetPayable,
            received: mReceived,
            due: mDue,
            attendance: mAtt,
          };
        };

        // Generate complete 12-month history + any additional recorded months
        const monthSet = new Set<string>(getRecentMonthsList(currentMonthISO, 12));
        if (selectedMonth) monthSet.add(selectedMonth);
        payments.forEach((p) => {
          if (p.paymentDate) monthSet.add(p.paymentDate.slice(0, 7));
          if (p.month) monthSet.add(p.month);
        });
        salaryRecords.forEach((s) => {
          if (s.month) monthSet.add(s.month);
        });
        overtime.forEach((o) => {
          if (o.month) monthSet.add(o.month);
          else if (o.date) monthSet.add(o.date.slice(0, 7));
        });

        const allHistoricalMonths = Array.from(monthSet)
          .filter(Boolean)
          .sort((a, b) => b.localeCompare(a));

        const displayedHistoricalMonths =
          historyPeriodCount === 'all'
            ? allHistoricalMonths
            : allHistoricalMonths.slice(0, historyPeriodCount);

        // Two-month comparison data (Month A vs Month B)
        const perfA = buildMonthPerformance(compareMonthA);
        const perfB = buildMonthPerformance(compareMonthB);

        const netPayableDiff = roundCurrency(perfA.netPayable - perfB.netPayable);
        const otHoursDiff = roundCurrency(perfA.otHours - perfB.otHours);
        const otEarningsDiff = roundCurrency(perfA.otEarnings - perfB.otEarnings);
        const receivedDiff = roundCurrency(perfA.received - perfB.received);
        const bonusDiff = roundCurrency(perfA.bonusTotal - perfB.bonusTotal);

        // Multi-month aggregated performance for the selected period (e.g. 6, 7, 12 months)
        const periodPerfList = displayedHistoricalMonths.map((m) => buildMonthPerformance(m));
        const recordedPerfList = periodPerfList.filter((p) => p.hasRecord);
        const periodTotalNetPayable = roundCurrency(
          periodPerfList.reduce((sum, p) => sum + p.netPayable, 0)
        );
        const periodAvgNetPayable =
          recordedPerfList.length > 0
            ? roundCurrency(periodTotalNetPayable / recordedPerfList.length)
            : 0;
        const periodTotalOtHours = roundCurrency(
          periodPerfList.reduce((sum, p) => sum + p.otHours, 0)
        );
        const periodTotalOtEarnings = roundCurrency(
          periodPerfList.reduce((sum, p) => sum + p.otEarnings, 0)
        );
        const periodTotalReceived = roundCurrency(
          periodPerfList.reduce((sum, p) => sum + p.received, 0)
        );
        const periodTotalBonus = roundCurrency(
          periodPerfList.reduce((sum, p) => sum + p.bonusTotal, 0)
        );
        const periodTotalPresentDays = recordedPerfList.reduce(
          (sum, p) => sum + p.attendance.presentDays,
          0
        );
        const bestPerformingMonth = [...recordedPerfList].sort(
          (a, b) => b.netPayable - a.netPayable
        )[0];

        return (
          <section
            data-testid="salary-history-comparison-section"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5 no-print"
          >
            {/* Header with Add Past Record CTA */}
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>
                    {lang === 'bn'
                      ? 'বিগত মাসের বেতন ও ওভারটাইম সার্বিক হিসাব ও তুলনা'
                      : 'Monthly Salary & Overtime Performance & Comparison'}
                  </span>
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  data-testid="section-add-past-salary-btn"
                  onClick={() => handleOpenPastMonthModal()}
                  className="min-h-[32px] sm:min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'bn' ? 'পূর্বের মাসের রেকর্ড যোগ করুন' : 'Add Past Month Record'}</span>
                </button>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
                  <span>{lang === 'bn' ? 'বর্তমান মাস:' : 'Current:'}</span>
                  <span>{formatMonthLabel(currentMonthISO, lang)}</span>
                </span>
              </div>
            </div>

            {/* PART A: ANY MONTH vs ANY MONTH DETAILED COMPARISON BOX */}
            <div
              data-testid="custom-month-comparison-card"
              className="rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-emerald-200/80 dark:border-emerald-900/60 p-3.5 sm:p-4 space-y-3.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'যেকোনো মাসের সাথে যেকোনো মাসের বিস্তারিত তুলনা'
                      : 'Compare Any Month with Any Month'}
                  </h3>
                </div>

                {/* Quick 1-Tap Comparison Presets (Oct vs Sep, Oct vs Aug, Oct vs Jul) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    {
                      mA: currentMonthISO,
                      mB: prevMonthISO,
                      labelBn: `${formatMonthLabel(currentMonthISO, 'bn').split(' ')[0]} বনাম ${formatMonthLabel(prevMonthISO, 'bn').split(' ')[0]}`,
                      labelEn: `${formatMonthLabel(currentMonthISO, 'en').split(' ')[0]} vs ${formatMonthLabel(prevMonthISO, 'en').split(' ')[0]}`,
                    },
                    {
                      mA: currentMonthISO,
                      mB: prev2MonthISO,
                      labelBn: `${formatMonthLabel(currentMonthISO, 'bn').split(' ')[0]} বনাম ${formatMonthLabel(prev2MonthISO, 'bn').split(' ')[0]}`,
                      labelEn: `${formatMonthLabel(currentMonthISO, 'en').split(' ')[0]} vs ${formatMonthLabel(prev2MonthISO, 'en').split(' ')[0]}`,
                    },
                    {
                      mA: currentMonthISO,
                      mB: prev3MonthISO,
                      labelBn: `${formatMonthLabel(currentMonthISO, 'bn').split(' ')[0]} বনাম ${formatMonthLabel(prev3MonthISO, 'bn').split(' ')[0]}`,
                      labelEn: `${formatMonthLabel(currentMonthISO, 'en').split(' ')[0]} vs ${formatMonthLabel(prev3MonthISO, 'en').split(' ')[0]}`,
                    },
                  ].map((preset) => {
                    const isActive =
                      compareMonthA === preset.mA && compareMonthB === preset.mB;
                    return (
                      <button
                        key={`${preset.mA}-${preset.mB}`}
                        type="button"
                        onClick={() => {
                          setCompareMonthA(preset.mA);
                          setCompareMonthB(preset.mB);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        {lang === 'bn' ? preset.labelBn : preset.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Month A and Month B Dropdown Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 shrink-0">
                    {lang === 'bn' ? '১ম মাস' : 'Month 1'}
                  </span>
                  <select
                    data-testid="select-compare-month-a"
                    value={compareMonthA}
                    onChange={(e) => setCompareMonthA(e.target.value)}
                    className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    {allHistoricalMonths.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthLabel(m, lang)}
                        {m === currentMonthISO
                          ? lang === 'bn'
                            ? ' (বর্তমান মাস)'
                            : ' (Current)'
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 shrink-0">
                    {lang === 'bn' ? 'তুলনার মাস' : 'Compare With'}
                  </span>
                  <select
                    data-testid="select-compare-month-b"
                    value={compareMonthB}
                    onChange={(e) => setCompareMonthB(e.target.value)}
                    className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    {allHistoricalMonths.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthLabel(m, lang)}
                        {m === currentMonthISO
                          ? lang === 'bn'
                            ? ' (বর্তমান মাস)'
                            : ' (Current)'
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notice if either compared month has no record saved yet */}
              {(!perfA.hasRecord || !perfB.hasRecord) && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      {!perfB.hasRecord && !perfA.hasRecord
                        ? lang === 'bn'
                          ? `${formatMonthLabel(compareMonthA, 'bn')} ও ${formatMonthLabel(compareMonthB, 'bn')} কোনোটিরই বেতন রেকর্ড যোগ করা নেই।`
                          : `Neither month has a salary record saved yet.`
                        : !perfB.hasRecord
                        ? lang === 'bn'
                          ? `${formatMonthLabel(compareMonthB, 'bn')} মাসের কোনো বেতন রেকর্ড যোগ করা নেই (জয়েনিংয়ের আগের মাস)।`
                          : `No salary record found for ${formatMonthLabel(compareMonthB, 'en')} (pre-joining).`
                        : lang === 'bn'
                        ? `${formatMonthLabel(compareMonthA, 'bn')} মাসের কোনো বেতন রেকর্ড যোগ করা নেই।`
                        : `No salary record found for ${formatMonthLabel(compareMonthA, 'en')}.`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenPastMonthModal(!perfB.hasRecord ? compareMonthB : compareMonthA)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer w-fit shrink-0 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {lang === 'bn'
                        ? `${formatMonthLabel(!perfB.hasRecord ? compareMonthB : compareMonthA, 'bn')} রেকর্ড যোগ করুন`
                        : `Add Record`}
                    </span>
                  </button>
                </div>
              )}

              {/* 3 Detailed Comparison Cards: Net Payable, Overtime (Hours & Taka), Received Salary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Net Payable Comparison */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {lang === 'bn' ? 'মোট প্রাপ্য নিট বেতন' : 'Net Payable Salary'}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md tabular-nums ${
                        netPayableDiff > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : netPayableDiff < 0
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {netPayableDiff > 0
                        ? `+${formatBDT(netPayableDiff, lang)} ${lang === 'bn' ? 'বেশি' : 'more'}`
                        : netPayableDiff < 0
                        ? `-${formatBDT(Math.abs(netPayableDiff), lang)} ${lang === 'bn' ? 'কম' : 'less'}`
                        : lang === 'bn'
                        ? 'সমান'
                        : 'Equal'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 pt-1">
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatMonthLabel(compareMonthA, lang)}
                      </p>
                      <p className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(perfA.netPayable, lang)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                        {formatMonthLabel(compareMonthB, lang)}
                      </p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        {formatBDT(perfB.netPayable, lang)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Overtime Hours & Taka Comparison */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {lang === 'bn' ? 'ওভারটাইম (ঘণ্টা ও টাকা)' : 'Overtime (Hours & Pay)'}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md tabular-nums ${
                        otEarningsDiff > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : otEarningsDiff < 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {otHoursDiff > 0
                        ? `+${formatNumber(otHoursDiff, lang, 1)}${lang === 'bn' ? 'ঘঃ' : 'h'} (+${formatBDT(otEarningsDiff, lang)})`
                        : otHoursDiff < 0
                        ? `-${formatNumber(Math.abs(otHoursDiff), lang, 1)}${lang === 'bn' ? 'ঘঃ' : 'h'} (-${formatBDT(Math.abs(otEarningsDiff), lang)})`
                        : lang === 'bn'
                        ? 'সমান ওটি'
                        : 'Same OT'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 pt-1">
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatMonthLabel(compareMonthA, lang)} ({formatNumber(perfA.otHours, lang, 1)} {lang === 'bn' ? 'ঘঃ' : 'h'})
                      </p>
                      <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatBDT(perfA.otEarnings, lang)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                        {formatMonthLabel(compareMonthB, lang)} ({formatNumber(perfB.otHours, lang, 1)} {lang === 'bn' ? 'ঘঃ' : 'h'})
                      </p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        {formatBDT(perfB.otEarnings, lang)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Received Salary & Bonuses Comparison */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {lang === 'bn' ? 'হাতে প্রাপ্ত বেতন ও বোনাস' : 'Received & Bonuses'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                      {lang === 'bn' ? 'বোনাস পার্থক্য:' : 'Bonus diff:'}{' '}
                      {bonusDiff >= 0 ? `+${formatBDT(bonusDiff, lang)}` : `-${formatBDT(Math.abs(bonusDiff), lang)}`}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 pt-1">
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatMonthLabel(compareMonthA, lang)}
                      </p>
                      <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatBDT(perfA.received, lang)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                        {formatMonthLabel(compareMonthB, lang)}
                      </p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        {formatBDT(perfB.received, lang)}
                      </p>
                    </div>
                  </div>
                  {receivedDiff !== 0 && (
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      {lang === 'bn'
                        ? `প্রাপ্ত বেতনের পার্থক্য: ${receivedDiff > 0 ? '+' : '-'}${formatBDT(Math.abs(receivedDiff), 'bn')}`
                        : `Received diff: ${receivedDiff > 0 ? '+' : '-'}${formatBDT(Math.abs(receivedDiff), 'en')}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Detailed Side-by-Side Breakdown Bar (Base Gross, Bonuses, Deductions, Attendance) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'নির্ধারিত বেতন:' : 'Base:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatBDT(perfA.baseGross, lang)} / {formatBDT(perfB.baseGross, lang)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'মোট বোনাস:' : 'Bonus:'}</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatBDT(perfA.bonusTotal, lang)} / {formatBDT(perfB.bonusTotal, lang)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'মোট কর্তন:' : 'Ded:'}</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatBDT(perfA.totalDeductions, lang)} / {formatBDT(perfB.totalDeductions, lang)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'উপস্থিত দিন:' : 'Present:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatNumber(perfA.attendance.presentDays, lang)} / {formatNumber(perfB.attendance.presentDays, lang)} {lang === 'bn' ? 'দিন' : 'd'}
                  </span>
                </div>
              </div>
            </div>

            {/* PART B: MULTI-MONTH RANGE SELECTOR (3 / 6 / 12 / ALL MONTHS) & AGGREGATED PERFORMANCE */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'বহু-মাসের সার্বিক পারফরম্যান্স ও ইতিহাস (৩ / ৬ / ১২ মাস)'
                      : 'Multi-Month Overall Performance & History'}
                  </h3>
                </div>

                <div
                  data-testid="history-period-selector"
                  className="inline-flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl"
                >
                  {(
                    [
                      { id: 3, bn: '৩ মাস', en: '3M' },
                      { id: 6, bn: '৬ মাস', en: '6M' },
                      { id: 12, bn: '১২ মাস', en: '12M' },
                      { id: 'all', bn: 'সব মাস', en: 'All' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={String(p.id)}
                      type="button"
                      data-testid={`period-btn-${p.id}`}
                      onClick={() => setHistoryPeriodCount(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition-colors cursor-pointer ${
                        historyPeriodCount === p.id
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {lang === 'bn' ? p.bn : p.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Recharts Line Chart for Salary & Overtime Trends */}
              <div
                data-testid="salary-trends-line-chart-container"
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 no-print"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'bn'
                        ? `বেতন ও ওভারটাইম ট্রেন্ড চার্ট (${formatNumber(displayedHistoricalMonths.length, 'bn')} মাস)`
                        : `Salary & Overtime Trends Chart (${displayedHistoricalMonths.length} Months)`}
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {lang === 'bn' ? 'নিট প্রাপ্য, ওভারটাইম ও প্রাপ্তির তুলনামূলক গ্রাফ' : 'Net Payable vs Overtime vs Received'}
                  </span>
                </div>

                <div className="w-full min-w-0 overflow-hidden h-60 sm:h-72 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[...displayedHistoricalMonths].reverse().map((m) => {
                        const perf = buildMonthPerformance(m);
                        return {
                          monthLabel: formatMonthLabel(m, lang),
                          rawMonth: m,
                          netPayable: perf.netPayable,
                          overtimeEarnings: perf.otEarnings,
                          received: perf.received,
                        };
                      })}
                      margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="monthLabel"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        stroke="#cbd5e1"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        stroke="#cbd5e1"
                        tickFormatter={(v) => `৳${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: any) => [
                          formatBDT(Number(value) || 0, lang),
                          name === 'netPayable'
                            ? lang === 'bn'
                              ? 'নিট প্রাপ্য বেতন'
                              : 'Net Payable'
                            : name === 'overtimeEarnings'
                            ? lang === 'bn'
                              ? 'ওভারটাইম টাকা'
                              : 'Overtime Pay'
                            : lang === 'bn'
                            ? 'প্রাপ্ত বেতন'
                            : 'Received Salary',
                        ]}
                      />
                      <Legend
                        formatter={(value) =>
                          value === 'netPayable'
                            ? lang === 'bn'
                              ? 'নিট প্রাপ্য'
                              : 'Net Payable'
                            : value === 'overtimeEarnings'
                            ? lang === 'bn'
                              ? 'ওভারটাইম'
                              : 'Overtime'
                            : lang === 'bn'
                            ? 'হাতে প্রাপ্ত'
                            : 'Received'
                        }
                        wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="netPayable"
                        stroke="#059669"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#059669' }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="overtimeEarnings"
                        stroke="#d97706"
                        strokeWidth={2}
                        dot={{ r: 3.5, fill: '#d97706' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="received"
                        stroke="#2563eb"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3.5, fill: '#2563eb' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Multi-Month Aggregated Performance Summary Cards */}
              <div
                data-testid="multi-month-performance-summary"
                className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/70"
              >
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    {lang === 'bn'
                      ? `${formatNumber(displayedHistoricalMonths.length, 'bn')} মাসের মোট নিট বেতন`
                      : `${displayedHistoricalMonths.length}-Month Net Payable`}
                  </span>
                  <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums block mt-0.5">
                    {formatBDT(periodTotalNetPayable, lang)}
                  </span>
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    {lang === 'bn' ? 'মাসিক গড়:' : 'Avg/mo:'} {formatBDT(periodAvgNetPayable, lang)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    {lang === 'bn'
                      ? `${formatNumber(displayedHistoricalMonths.length, 'bn')} মাসের মোট ওভারটাইম`
                      : `${displayedHistoricalMonths.length}-Month Total OT`}
                  </span>
                  <span className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums block mt-0.5">
                    {formatBDT(periodTotalOtEarnings, lang)}
                  </span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                    {lang === 'bn'
                      ? `মোট ${formatNumber(periodTotalOtHours, 'bn', 1)} ঘণ্টা`
                      : `Total ${periodTotalOtHours} hrs`}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    {lang === 'bn'
                      ? 'সর্বমোট হাতে প্রাপ্ত ও বোনাস'
                      : 'Total Received & Bonuses'}
                  </span>
                  <span className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums block mt-0.5">
                    {formatBDT(periodTotalReceived, lang)}
                  </span>
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    {lang === 'bn' ? 'মোট বোনাস:' : 'Bonuses:'} {formatBDT(periodTotalBonus, lang)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    {lang === 'bn' ? 'সেরা পারফরম্যান্স মাস' : 'Top Performing Month'}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5 truncate">
                    {bestPerformingMonth
                      ? formatMonthLabel(bestPerformingMonth.month, lang)
                      : '—'}
                  </span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                    {bestPerformingMonth
                      ? `${formatBDT(bestPerformingMonth.netPayable, lang)} · উপস্থিত ${formatNumber(periodTotalPresentDays, lang)} দিন`
                      : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Historical Month-by-Month Summary Table with Inline Overall Performance Inspector & 1-Tap Compare */}
            <div className="pt-1 space-y-3 w-full min-w-0">
              <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs sm:text-sm table-auto">
                  <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white font-extrabold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-2 sm:p-3 text-xs sm:text-sm font-extrabold">{lang === 'bn' ? 'মাস' : 'Month'}</th>
                      <th className="py-2.5 px-1.5 sm:p-3 text-right text-xs sm:text-sm font-extrabold">{lang === 'bn' ? 'নিট প্রাপ্য' : 'Net'}</th>
                      <th className="py-2.5 px-1.5 sm:p-3 text-right text-xs sm:text-sm font-extrabold">{lang === 'bn' ? 'ওভারটাইম' : 'Overtime'}</th>
                      <th className="py-2.5 px-1.5 sm:p-3 text-right text-xs sm:text-sm font-extrabold">{lang === 'bn' ? 'প্রাপ্ত বেতন' : 'Received'}</th>
                      <th className="py-2.5 px-1.5 sm:p-3 text-center text-xs sm:text-sm font-extrabold">{lang === 'bn' ? 'তুলনা / অ্যাকশন' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {displayedHistoricalMonths.map((m) => {
                      const perf = buildMonthPerformance(m);
                      const isActualCurrentMonth = m === currentMonthISO;
                      const isInspected = inspectedMonth === m;
                      const isComparedMonth = m === compareMonthB || m === compareMonthA;

                      return (
                        <React.Fragment key={m}>
                          <tr
                            className={
                              isActualCurrentMonth
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/30 font-semibold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }
                          >
                            <td className="py-2.5 px-2 sm:p-3 font-bold">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 min-w-0">
                                <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                  {formatMonthLabel(m, lang)}
                                </span>
                                {isActualCurrentMonth && (
                                  <span
                                    data-testid="current-month-permanent-badge"
                                    className="w-fit px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] sm:text-xs font-bold"
                                  >
                                    {lang === 'bn' ? 'চলতি' : 'Current'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-1.5 sm:p-3 text-right font-extrabold text-slate-900 dark:text-white tabular-nums text-xs sm:text-sm">
                              {perf.hasRecord ? (
                                formatBDT(perf.netPayable, lang)
                              ) : (
                                <span className="text-slate-400 text-xs font-medium">{lang === 'bn' ? 'খালি' : 'None'}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-1.5 sm:p-3 text-right tabular-nums text-xs sm:text-sm">
                              {perf.hasRecord ? (
                                <div>
                                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400 block sm:inline">
                                    {formatBDT(perf.otEarnings, lang)}
                                  </span>
                                  {perf.otHours > 0 && (
                                    <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 block sm:inline sm:ml-1 font-medium">
                                      ({formatNumber(perf.otHours, lang, 1)}{lang === 'bn' ? 'ঘঃ' : 'h'})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-1.5 sm:p-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums text-xs sm:text-sm">
                              {perf.hasRecord ? (
                                formatBDT(perf.received, lang)
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-1.5 sm:p-3 text-center">
                              {perf.hasRecord ? (
                                <div className="inline-flex flex-wrap items-center justify-center gap-1">
                                  {m !== compareMonthA && (
                                    <button
                                      type="button"
                                      data-testid={`compare-with-month-btn-${m}`}
                                      onClick={() => setCompareMonthB(m)}
                                      className={`px-2 py-1 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                                        compareMonthB === m
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                      }`}
                                      title={
                                        lang === 'bn'
                                          ? `${formatMonthLabel(compareMonthA, 'bn')} এর সাথে তুলনা করুন`
                                          : `Compare with ${compareMonthA}`
                                      }
                                    >
                                      {compareMonthB === m
                                        ? lang === 'bn'
                                          ? 'যুক্ত'
                                          : 'Comp'
                                        : lang === 'bn'
                                        ? 'তুলনা'
                                        : 'Comp'}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    data-testid={`inspect-month-btn-${m}`}
                                    onClick={() =>
                                      setInspectedMonth((prev) => (prev === m ? null : m))
                                    }
                                    className={`px-2 py-1 rounded-lg text-xs font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                                      isInspected
                                        ? 'bg-emerald-700 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    <Eye className="w-3.5 h-3.5 shrink-0" />
                                    <span className="hidden sm:inline">
                                      {isInspected
                                        ? lang === 'bn'
                                          ? 'লুকান'
                                          : 'Hide'
                                        : lang === 'bn'
                                        ? 'দেখুন'
                                        : 'View'}
                                    </span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  data-testid={`add-past-record-btn-${m}`}
                                  onClick={() => handleOpenPastMonthModal(m)}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap"
                                  title={
                                    lang === 'bn'
                                      ? `${formatMonthLabel(m, 'bn')} এর বেতন রেকর্ড যোগ করুন`
                                      : `Add salary for ${formatMonthLabel(m, 'en')}`
                                  }
                                >
                                  <Plus className="w-3 h-3 shrink-0" />
                                  <span>{lang === 'bn' ? 'যোগ' : 'Add'}</span>
                                </button>
                              )}
                            </td>
                          </tr>

                          {isInspected && (
                            <tr className="bg-emerald-50/30 dark:bg-slate-800/60">
                              <td colSpan={5} className="p-3.5 sm:p-4">
                                <div
                                  data-testid={`month-performance-detail-${m}`}
                                  className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 p-3.5 sm:p-4 space-y-3 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                        {lang === 'bn'
                                          ? `${formatMonthLabel(m, 'bn')} — সার্বিক পারফরম্যান্স ও বেতন বিবরণী`
                                          : `${formatMonthLabel(m, 'en')} — Overall Performance Breakdown`}
                                      </span>
                                      {isActualCurrentMonth && (
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                                          {lang === 'bn' ? 'চলতি মাস' : 'Running Month'}
                                        </span>
                                      )}
                                      {isComparedMonth && (
                                        <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-bold">
                                          {lang === 'bn' ? 'তুলনায় নির্বাচিত' : 'In Comparison'}
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                                        perf.received >= perf.netPayable && perf.netPayable > 0
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                          : perf.received > 0
                                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                      }`}
                                    >
                                      {perf.received >= perf.netPayable && perf.netPayable > 0
                                        ? lang === 'bn'
                                          ? 'সম্পূর্ণ পরিশোধিত'
                                          : 'Paid in Full'
                                        : perf.received > 0
                                        ? lang === 'bn'
                                          ? `আংশিক প্রাপ্ত (বকেয়া: ${formatBDT(perf.due, 'bn')})`
                                          : `Partial (Due: ${formatBDT(perf.due, 'en')})`
                                        : lang === 'bn'
                                        ? 'এখনো পেমেন্ট এন্ট্রি হয়নি'
                                        : 'Unpaid'}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700">
                                      <span className="text-[11px] text-slate-500 block">
                                        {lang === 'bn' ? 'নির্ধারিত মোট বেতন' : 'Base Gross Salary'}
                                      </span>
                                      <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                        {formatBDT(perf.baseGross, lang)}
                                      </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
                                      <span className="text-[11px] text-emerald-800 dark:text-emerald-300 block">
                                        {lang === 'bn'
                                          ? `ওভারটাইম (${formatNumber(perf.otHours, 'bn', 1)} ঘণ্টা)`
                                          : `Overtime (${perf.otHours}h)`}
                                      </span>
                                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                        {formatBDT(perf.otEarnings, lang)}
                                      </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700">
                                      <span className="text-[11px] text-slate-500 block">
                                        {lang === 'bn' ? 'হাজিরা ও অন্যান্য বোনাস' : 'Bonuses & Extra'}
                                      </span>
                                      <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                        {formatBDT(perf.bonusTotal, lang)}
                                      </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white">
                                      <span className="text-[11px] text-slate-300 block">
                                        {lang === 'bn' ? 'সর্বমোট প্রাপ্য নিট বেতন' : 'Total Net Payable'}
                                      </span>
                                      <span className="text-sm font-extrabold text-emerald-400 tabular-nums">
                                        {formatBDT(perf.netPayable, lang)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Attendance & Work Summary Bar */}
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span>
                                        {lang === 'bn' ? 'উপস্থিত:' : 'Present:'}{' '}
                                        <strong className="text-emerald-700 dark:text-emerald-400">
                                          {formatNumber(perf.attendance.presentDays, lang)} {lang === 'bn' ? 'দিন' : 'd'}
                                        </strong>
                                      </span>
                                      <span>
                                        {lang === 'bn' ? 'বিলম্ব (লেট):' : 'Late:'}{' '}
                                        <strong className="text-amber-700 dark:text-amber-400">
                                          {formatNumber(perf.attendance.lateDays, lang)} {lang === 'bn' ? 'দিন' : 'd'}
                                        </strong>
                                      </span>
                                      <span>
                                        {lang === 'bn' ? 'অনুপস্থিত:' : 'Absent:'}{' '}
                                        <strong className="text-rose-600 dark:text-rose-400">
                                          {formatNumber(perf.attendance.absentDays, lang)} {lang === 'bn' ? 'দিন' : 'd'}
                                        </strong>
                                      </span>
                                      <span>
                                        {lang === 'bn' ? 'ছুটি:' : 'Leave/Holiday:'}{' '}
                                        <strong>
                                          {formatNumber(
                                            perf.attendance.approvedLeaveDays +
                                              perf.attendance.weeklyHolidays +
                                              perf.attendance.publicHolidays,
                                            lang
                                          )}{' '}
                                          {lang === 'bn' ? 'দিন' : 'd'}
                                        </strong>
                                      </span>
                                    </div>
                                    <div className="font-semibold">
                                      {lang === 'bn' ? 'হাতে প্রাপ্ত:' : 'Received:'}{' '}
                                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                        {formatBDT(perf.received, lang)}
                                      </span>
                                      {perf.totalDeductions > 0 && (
                                        <span className="ml-2 text-rose-600 dark:text-rose-400">
                                          ({lang === 'bn' ? 'কর্তন:' : 'Ded:'} {formatBDT(perf.totalDeductions, lang)})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })()}
      {/* Printable / Downloadable Structured Payslip Report Modal */}
      {showPayslipReportModal && (
        <div
          data-testid="payslip-report-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-5 shadow-2xl relative">
            {/* Modal Header & Actions (Hidden on Print) */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 no-print">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'পে-স্লিপ ও বেতন বিবরণী রিপোর্ট' : 'Payslip & Salary Statement Report'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'প্রিন্ট / PDF ডাউনলোড' : 'Print / Save PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPayslipReportModal(false)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Report Content Card */}
            <div
              id="printable-payslip-report"
              className="p-5 sm:p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-300 dark:border-slate-700 space-y-5"
            >
              {/* Document Header */}
              <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-4 space-y-1">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-wide uppercase text-slate-900 dark:text-white">
                  {profile.factoryName || (lang === 'bn' ? 'পোশাক শিল্প কারখানা / ফ্যাক্টরি' : 'Garments Factory Ltd.')}
                </h2>
                {profile.factoryBranch && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {profile.factoryBranch}
                  </p>
                )}
                <div className="inline-block mt-1 px-3 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold rounded-md">
                  {lang === 'bn'
                    ? `মাসিক বেতন ও ভাতা বিবরণী — ${formatMonthLabel(selectedMonth, 'bn')}`
                    : `Monthly Salary Slip — ${formatMonthLabel(selectedMonth, 'en')}`}
                </div>
              </div>

              {/* Worker & Employment Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-500 block">{lang === 'bn' ? 'শ্রমিকের নাম:' : 'Employee Name:'}</span>
                  <strong className="text-slate-900 dark:text-white text-sm">{profile.fullName || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">{lang === 'bn' ? 'আইডি কার্ড নং:' : 'Employee ID:'}</span>
                  <strong className="text-slate-900 dark:text-white text-sm">{profile.employeeId || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">{lang === 'bn' ? 'পদবী ও সেকশন:' : 'Designation & Dept:'}</span>
                  <strong className="text-slate-900 dark:text-white">
                    {profile.designation || 'অপারেটর'} ({profile.department || 'প্রোডাকশন'})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">{lang === 'bn' ? 'যোগদানের তারিখ:' : 'Joining Date:'}</span>
                  <strong>{profile.joiningDate ? formatDateSlashDMY(profile.joiningDate, lang) : '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">{lang === 'bn' ? 'বেতন গ্রেড:' : 'Grade:'}</span>
                  <strong>{profile.salaryGrade || 'গ্রেড-৪'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">{lang === 'bn' ? 'মোবাইল নম্বর:' : 'Phone:'}</span>
                  <strong>{profile.phone || '—'}</strong>
                </div>
              </div>

              {/* Salary Breakdown Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b pb-1">
                  {lang === 'bn' ? '১. বেতন ও ভাতাসমূহের বিবরণ' : '1. Earnings & Allowances Breakdown'}
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 border-b">
                      <tr>
                        <th className="p-2.5">{lang === 'bn' ? 'খাত / বিষয়' : 'Item Description'}</th>
                        <th className="p-2.5 text-right">{lang === 'bn' ? 'পরিমাণ (টাকা)' : 'Amount (BDT)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="p-2 font-medium">{lang === 'bn' ? 'মূল বেতন (Basic Salary)' : 'Basic Salary'}</td>
                        <td className="p-2 text-right font-bold tabular-nums">{formatBDT(basicSalary, lang)}</td>
                      </tr>
                      <tr>
                        <td className="p-2">{lang === 'bn' ? 'বাড়ি ভাড়া ভাতা' : 'House Rent Allowance'}</td>
                        <td className="p-2 text-right font-semibold tabular-nums">{formatBDT(houseRentAllowance, lang)}</td>
                      </tr>
                      <tr>
                        <td className="p-2">{lang === 'bn' ? 'চিকিৎসা ভাতা' : 'Medical Allowance'}</td>
                        <td className="p-2 text-right font-semibold tabular-nums">{formatBDT(medicalAllowance, lang)}</td>
                      </tr>
                      <tr>
                        <td className="p-2">{lang === 'bn' ? 'যাতায়াত ভাতা' : 'Transport Allowance'}</td>
                        <td className="p-2 text-right font-semibold tabular-nums">{formatBDT(transportAllowance, lang)}</td>
                      </tr>
                      <tr>
                        <td className="p-2">{lang === 'bn' ? 'খাদ্য ভাতা' : 'Food Allowance'}</td>
                        <td className="p-2 text-right font-semibold tabular-nums">{formatBDT(foodAllowance, lang)}</td>
                      </tr>
                      <tr className="bg-emerald-50/40 dark:bg-emerald-950/20 font-bold">
                        <td className="p-2 text-slate-800 dark:text-slate-200">
                          {lang === 'bn'
                            ? `উপস্থিতির অর্জিত বেতন (${formatNumber(earnedDailyBreakdown.attendedDaysCount, 'bn')} দিন × ${formatBDT(earnedDailyBreakdown.dailyWageRate, 'bn')})`
                            : `Attendance Earned Base (${earnedDailyBreakdown.attendedDaysCount}d × ${formatBDT(earnedDailyBreakdown.dailyWageRate, 'en')})`}
                        </td>
                        <td className="p-2 text-right text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {formatBDT(earnedDailyBreakdown.earnedBaseSalary, lang)}
                        </td>
                      </tr>
                      <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 font-bold">
                        <td className="p-2 text-emerald-800 dark:text-emerald-300">
                          {lang === 'bn'
                            ? `ওভারটাইম টাকা (${formatNumber(overtimeHours, 'bn', 1)} ঘণ্টা)`
                            : `Overtime Pay (${overtimeHours} hours)`}
                        </td>
                        <td className="p-2 text-right text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {formatBDT(overtimeEarnings, lang)}
                        </td>
                      </tr>
                      {attendanceBonus > 0 && (
                        <tr>
                          <td className="p-2">
                            {lang === 'bn' ? 'হাজিরা বোনাস' : 'Attendance Bonus'}
                            {!attBonusEval.isEligible && (
                              <span className="ml-1.5 text-[10px] font-bold text-rose-600">
                                ({lang === 'bn' ? 'মিস হয়েছে — বাদ' : 'Missed'})
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-semibold tabular-nums">
                            {formatBDT(effectiveAttendanceBonus, lang)}
                          </td>
                        </tr>
                      )}
                      {festivalBonus > 0 && (
                        <tr>
                          <td className="p-2">{lang === 'bn' ? 'উৎসব / ঈদ বোনাস' : 'Festival Bonus'}</td>
                          <td className="p-2 text-right font-semibold tabular-nums">{formatBDT(festivalBonus, lang)}</td>
                        </tr>
                      )}
                      {otherAllowances > 0 && (
                        <tr>
                          <td className="p-2">{lang === 'bn' ? 'অন্যান্য বিশেষ ভাতা' : 'Other Allowances'}</td>
                          <td className="p-2 text-right font-semibold tabular-nums">{formatBDT(otherAllowances, lang)}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 dark:bg-slate-800 font-extrabold">
                        <td className="p-2.5 text-slate-900 dark:text-white">
                          {lang === 'bn' ? 'সর্বমোট অর্জিত উপার্জন (Earned Gross)' : 'Total Earned Gross'}
                        </td>
                        <td className="p-2.5 text-right text-slate-900 dark:text-white tabular-nums">
                          {formatBDT(effectiveGrossEarned, lang)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deductions & Net Payable Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Deductions */}
                <div className="space-y-2">
                  <h4 className="font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 border-b pb-1">
                    {lang === 'bn' ? '২. কর্তন সমূহের বিবরণ' : '2. Deductions Summary'}
                  </h4>
                  <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900/50 space-y-1.5">
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'অগ্রিম বেতন কর্তন:' : 'Advance Deduction:'}</span>
                      <strong className="tabular-nums">{formatBDT(advanceDeduction, lang)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'অনুপস্থিতি কর্তন:' : 'Absence Deduction:'}</span>
                      <strong className="tabular-nums">{formatBDT(absenceDeduction, lang)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'অন্যান্য কর্তন:' : 'Other Deductions:'}</span>
                      <strong className="tabular-nums">{formatBDT(otherDeductions, lang)}</strong>
                    </div>
                    {adjustments !== 0 && (
                      <div className="flex justify-between">
                        <span>{lang === 'bn' ? 'সমন্বয়:' : 'Adjustments:'}</span>
                        <strong className="tabular-nums">{formatBDT(adjustments, lang)}</strong>
                      </div>
                    )}
                    <div className="flex justify-between pt-1.5 border-t border-rose-200 dark:border-rose-800 font-bold text-rose-800 dark:text-rose-300">
                      <span>{lang === 'bn' ? 'মোট কর্তন:' : 'Total Deductions:'}</span>
                      <strong className="tabular-nums">-{formatBDT(totals.totalDeductions, lang)}</strong>
                    </div>
                  </div>
                </div>

                {/* Net Payable & Payment Summary */}
                <div className="space-y-2">
                  <h4 className="font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b pb-1">
                    {lang === 'bn' ? '৩. চূড়ান্ত নিট প্রাপ্তি ও পেমেন্ট' : '3. Final Net Payable & Payment'}
                  </h4>
                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/80 space-y-2">
                    <div className="flex justify-between text-sm font-extrabold">
                      <span>{lang === 'bn' ? 'সর্বমোট নিট প্রাপ্য:' : 'Estimated Net Payable:'}</span>
                      <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatBDT(effectiveNetPayable, lang)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>{lang === 'bn' ? 'হাতে প্রাপ্ত নগদ/ডিজিটাল:' : 'Actual Received:'}</span>
                      <strong className="text-slate-900 dark:text-white tabular-nums">
                        {formatBDT(paymentSummary.totalReceived, lang)}
                      </strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-emerald-200 dark:border-emerald-800 font-bold">
                      <span>{lang === 'bn' ? 'অবশিষ্ট বকেয়া স্থিতি:' : 'Outstanding Balance:'}</span>
                      <strong className={paymentSummary.outstandingBalance > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}>
                        {formatBDT(paymentSummary.outstandingBalance, lang)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Signature Section for Print Authorization */}
              <div className="pt-8 grid grid-cols-3 gap-4 text-center text-xs text-slate-600 dark:text-slate-400">
                <div>
                  <div className="border-t border-slate-400 dark:border-slate-600 pt-1 font-semibold">
                    {lang === 'bn' ? 'শ্রমিকের স্বাক্ষর' : 'Worker Signature'}
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-400 dark:border-slate-600 pt-1 font-semibold">
                    {lang === 'bn' ? 'ক্যাশিয়ার / একাউন্টস' : 'Accounts Officer'}
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-400 dark:border-slate-600 pt-1 font-semibold">
                    {lang === 'bn' ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Authorized Signature'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Past Month Salary & Overtime Record Entry Modal */}
      {showPastMonthModal && (
        <div
          data-testid="past-month-salary-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'পূর্বের মাসের বেতন ও ওভারটাইম রেকর্ড যোগ করুন'
                      : 'Add Past Month Salary & Overtime Record'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'bn'
                      ? 'জয়েনিং বা পূর্ববর্তী মাসের বেতন যোগ করলে তা বহু-মাসের তুলনায় যুক্ত হবে'
                      : 'Past records will be included in trends & comparisons'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="close-past-month-modal-btn"
                onClick={() => setShowPastMonthModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePastMonthRecord} className="space-y-4">
              {/* Month Selector */}
              <div>
                <label
                  htmlFor="past-month-select"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {lang === 'bn' ? 'কোন মাসের বেতন রেকর্ড যোগ করবেন?' : 'Select Past Month'}
                </label>
                <select
                  id="past-month-select"
                  data-testid="past-month-select"
                  value={pastMonthTarget}
                  onChange={(e) => handlePastMonthTargetChange(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-white"
                  required
                >
                  {getRecentMonthsList(currentMonthISO, 24).map((m) => {
                    const hasSaved = salaryRecords.some((s) => s.month === m);
                    return (
                      <option key={m} value={m}>
                        {formatMonthLabel(m, lang)}
                        {m === currentMonthISO
                          ? lang === 'bn'
                            ? ' (বর্তমান মাস)'
                            : ' (Current)'
                          : hasSaved
                          ? lang === 'bn'
                            ? ' (রেকর্ড সংরক্ষিত আছে - আপডেট করতে পারবেন)'
                            : ' (Already recorded - can update)'
                          : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Basic Salary & Gross Salary */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="past-month-basic"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'মূল বেতন (৳)' : 'Basic Salary (৳)'}
                  </label>
                  <input
                    id="past-month-basic"
                    type="number"
                    min={0}
                    step="1"
                    value={pastMonthBasic || ''}
                    onChange={(e) => setPastMonthBasic(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="past-month-gross"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'নির্ধারিত মোট বেতন (৳)' : 'Gross Base (৳)'}
                  </label>
                  <input
                    id="past-month-gross"
                    type="number"
                    min={0}
                    step="1"
                    value={pastMonthGross || ''}
                    onChange={(e) => setPastMonthGross(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                    required
                  />
                </div>
              </div>

              {/* Attendance Days & Overtime Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="past-month-attended"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'উপস্থিতির দিন' : 'Attended Days'}
                  </label>
                  <input
                    id="past-month-attended"
                    type="number"
                    min={0}
                    max={31}
                    value={pastMonthAttendedDays || ''}
                    onChange={(e) => setPastMonthAttendedDays(Number(e.target.value) || 0)}
                    placeholder="যেমন: ২৬"
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="past-month-ot-hours"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'ওভারটাইম ঘণ্টা' : 'OT Hours'}
                  </label>
                  <input
                    id="past-month-ot-hours"
                    type="number"
                    min={0}
                    step="0.5"
                    value={pastMonthOtHours || ''}
                    onChange={(e) => handlePastMonthOtHoursChange(Number(e.target.value) || 0)}
                    placeholder="যেমন: ৫০"
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              {/* Overtime Pay & Bonuses */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="past-month-ot-earnings"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'ওভারটাইম টাকা (৳)' : 'OT Pay (৳)'}
                  </label>
                  <input
                    id="past-month-ot-earnings"
                    type="number"
                    min={0}
                    step="1"
                    value={pastMonthOtEarnings || ''}
                    onChange={(e) => setPastMonthOtEarnings(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="past-month-bonus"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'হাজিরা ও অন্যান্য বোনাস (৳)' : 'Bonus Total (৳)'}
                  </label>
                  <input
                    id="past-month-bonus"
                    type="number"
                    min={0}
                    step="1"
                    value={pastMonthBonus || ''}
                    onChange={(e) => setPastMonthBonus(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                  />
                </div>
              </div>

              {/* Deductions & Actual Received */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="past-month-deductions"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'কর্তন / অগ্রিম বাদ (৳)' : 'Deductions (৳)'}
                  </label>
                  <input
                    id="past-month-deductions"
                    type="number"
                    min={0}
                    step="1"
                    value={pastMonthDeductions || ''}
                    onChange={(e) => setPastMonthDeductions(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="past-month-received"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn' ? 'হাতে প্রাপ্ত বেতন (৳)' : 'Amount Received (৳)'}
                  </label>
                  <input
                    id="past-month-received"
                    type="number"
                    min={0}
                    step="1"
                    value={pastMonthReceived || ''}
                    onChange={(e) => setPastMonthReceived(Number(e.target.value) || 0)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                  />
                </div>
              </div>

              {/* Live Net Payable Calculation Summary Banner */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                  {lang === 'bn' ? 'হিসাবকৃত মোট প্রাপ্য নিট বেতন:' : 'Calculated Net Payable:'}
                </span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatBDT(
                    Math.max(
                      0,
                      pastMonthGross + pastMonthOtEarnings + pastMonthBonus - pastMonthDeductions
                    ),
                    lang
                  )}
                </span>
              </div>

              {/* Payment Method & Date */}
              {pastMonthReceived > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="past-month-payment-date"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {lang === 'bn' ? 'টাকা পাওয়ার তারিখ' : 'Payment Date'}
                    </label>
                    <DateInputDMY
                      id="past-month-payment-date"
                      dataTestId="past-month-payment-date"
                      value={pastMonthPaymentDate || `${pastMonthTarget}-10`}
                      lang={lang}
                      onChange={setPastMonthPaymentDate}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="past-month-payment-method"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {lang === 'bn' ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
                    </label>
                    <select
                      id="past-month-payment-method"
                      value={pastMonthPaymentMethod}
                      onChange={(e) => setPastMonthPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {lang === 'bn' ? pm.labelBn : pm.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label
                  htmlFor="past-month-notes"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {lang === 'bn' ? 'সংক্ষিপ্ত নোট (ঐচ্ছিক)' : 'Notes (Optional)'}
                </label>
                <input
                  id="past-month-notes"
                  type="text"
                  value={pastMonthNotes}
                  onChange={(e) => setPastMonthNotes(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: আগের কারখানার বেতন বা জয়েনিংয়ের পূর্বের রেকর্ড'
                      : 'e.g., Previous workplace salary record'
                  }
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Switch month checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={switchMonthOnSave}
                  onChange={(e) => setSwitchMonthOnSave(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  {lang === 'bn'
                    ? 'সংরক্ষণের পর প্রধান বেতন ভিউতে এই মাসটি নির্বাচন করুন'
                    : 'Switch active view to this month upon save'}
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPastMonthModal(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  data-testid="submit-past-month-salary-btn"
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'রেকর্ড সংরক্ষণ করুন' : 'Save Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
