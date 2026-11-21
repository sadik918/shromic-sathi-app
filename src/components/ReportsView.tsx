import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  FileSpreadsheet,
  Flag,
  Info,
  Plus,
  Printer,
  Timer,
  X,
  XCircle,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { AttendanceStatus, LeaveCategory } from '../types';
import {
  formatBDT,
  formatNumber,
  getDefaultDateForMonth,
  isFutureDate,
  toBengaliDigits,
} from '../utils/calculations';
import { stepMonthISO } from '../utils/calendarReminders';
import { formatDateReadable, formatMonthLabel } from '../utils/i18n';
import {
  buildMonthlyAttendanceReport,
  buildMonthlyLeaveReport,
  buildMonthlySalaryReport,
  filterAttendanceReportRows,
  formatTime12h,
  type ReportStatusFilter,
} from '../utils/reportsEngine';
import { DateInputDMY } from './DateInputDMY';
import { printElementSafely } from '../utils/printHelper';
import { AttendancePieChartCard, SalaryMixPieChartCard } from './AnalyticsChartCards';
import type { AnalyticsPieSlice } from '../utils/homeAnalytics';

interface ReportsViewProps {
  onExportCSV: () => void;
}

type ReportTab = 'attendance' | 'leave' | 'salary';

const STATUS_BADGE_CLASSES: Record<AttendanceStatus | 'unmarked', string> = {
  present:
    'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
  late: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
  absent:
    'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70',
  approved_leave:
    'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70',
  weekly_holiday:
    'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  public_holiday:
    'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/70',
  unmarked:
    'bg-slate-50 text-slate-500 border-slate-200/70 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/70',
};

const FILTER_OPTIONS: Array<{ id: ReportStatusFilter; bn: string; en: string }> = [
  { id: 'all', bn: 'সবগুলো', en: 'All' },
  { id: 'present', bn: 'উপস্থিত', en: 'Present' },
  { id: 'late', bn: 'দেরি', en: 'Late' },
  { id: 'absent', bn: 'অনুপস্থিত', en: 'Absent' },
  { id: 'leave', bn: 'ছুটি', en: 'Leave' },
  { id: 'holiday', bn: 'সরকারি/সাপ্তাহিক', en: 'Holidays' },
];

const QUICK_STATUS_OPTIONS: Array<{ id: AttendanceStatus; bn: string; en: string }> = [
  { id: 'present', bn: 'উপস্থিত', en: 'Present' },
  { id: 'late', bn: 'দেরি', en: 'Late' },
  { id: 'absent', bn: 'অনুপস্থিত', en: 'Absent' },
  { id: 'approved_leave', bn: 'ছুটি', en: 'Leave' },
  { id: 'weekly_holiday', bn: 'সাপ্তাহিক ছুটি', en: 'Weekly Off' },
  { id: 'public_holiday', bn: 'সরকারি ছুটি', en: 'Govt Holiday' },
];

const LEAVE_CAT_OPTIONS: Array<{ id: LeaveCategory; bn: string; en: string }> = [
  { id: 'casual', bn: 'নৈমিত্তিক ছুটি', en: 'Casual Leave' },
  { id: 'sick', bn: 'অসুস্থতাজনিত ছুটি', en: 'Sick Leave' },
  { id: 'earned', bn: 'অর্জিত ছুটি', en: 'Earned Leave' },
  { id: 'festival', bn: 'উৎসব ছুটি', en: 'Festival Leave' },
  { id: 'maternity', bn: 'মাতৃত্বকালীন ছুটি', en: 'Maternity Leave' },
  { id: 'unpaid', bn: 'বিনা বেতনে ছুটি', en: 'Unpaid Leave' },
];

export const ReportsView: React.FC<ReportsViewProps> = ({ onExportCSV }) => {
  const {
    lang,
    selectedMonth,
    setSelectedMonth,
    todayISO,
    profile,
    attendance,
    overtime,
    salaryRecords,
    payments,
    saveAttendance,
    seedSampleDemoData,
    isReadOnlyDemo,
  } = useData();

  const [activeTab, setActiveTab] = useState<ReportTab>('attendance');
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('all');
  const [includeAllMonthDays, setIncludeAllMonthDays] = useState(false);
  const [expandFullTable, setExpandFullTable] = useState(false);

  // Quick Attendance Modal state
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(() =>
    getDefaultDateForMonth(selectedMonth, todayISO)
  );
  const [modalStatus, setModalStatus] = useState<AttendanceStatus>('present');
  const [modalLeaveCat, setModalLeaveCat] = useState<LeaveCategory>('casual');
  const [modalInTime, setModalInTime] = useState(profile.dayShiftStartTime || '08:00');
  const [modalOutTime, setModalOutTime] = useState('17:00');
  const [modalNotes, setModalNotes] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  const attendanceReport = useMemo(
    () =>
      buildMonthlyAttendanceReport({
        month: selectedMonth,
        attendance,
        overtime,
        profile,
        lang,
        todayISO,
        includeAllMonthDays,
      }),
    [selectedMonth, attendance, overtime, profile, lang, todayISO, includeAllMonthDays]
  );

  const leaveReport = useMemo(
    () =>
      buildMonthlyLeaveReport({
        month: selectedMonth,
        attendance,
        lang,
      }),
    [selectedMonth, attendance, lang]
  );

  const salaryReport = useMemo(
    () =>
      buildMonthlySalaryReport({
        month: selectedMonth,
        profile,
        attendance,
        overtime,
        salaryRecords,
        payments,
      }),
    [selectedMonth, profile, attendance, overtime, salaryRecords, payments]
  );

  const filteredAttendanceRows = useMemo(
    () => filterAttendanceReportRows(attendanceReport.rows, statusFilter),
    [attendanceReport.rows, statusFilter]
  );

  // Detect latest month that has attendance data for easy jump when empty
  const latestPopulatedMonth = useMemo(() => {
    const months = Array.from(new Set(attendance.map((a) => a.month))).sort((a, b) =>
      b.localeCompare(a)
    );
    return months.find((m) => m !== selectedMonth) || null;
  }, [attendance, selectedMonth]);

  const openAttendanceModalForDate = (targetDate?: string) => {
    const safeDate =
      targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
        ? targetDate
        : getDefaultDateForMonth(selectedMonth, todayISO);
    const existing = attendance.find((a) => a.date === safeDate);
    setModalDate(safeDate);
    setModalStatus(existing?.status || 'present');
    setModalLeaveCat(
      existing?.leaveCategory && existing.leaveCategory !== 'none'
        ? existing.leaveCategory
        : 'casual'
    );
    setModalInTime(existing?.checkIn || profile.dayShiftStartTime || '08:00');
    setModalOutTime(existing?.checkOut || '17:00');
    setModalNotes(existing?.notes || '');
    setModalError('');
    setIsAttendanceModalOpen(true);
  };

  const handleSaveAttendanceFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (isFutureDate(modalDate, todayISO)) {
      setModalError(
        lang === 'bn'
          ? 'ভবিষ্যতের তারিখে হাজিরা যুক্ত করা যাবে না।'
          : 'Cannot record attendance for a future date.'
      );
      return;
    }

    const existing = attendance.find((a) => a.date === modalDate);
    const isWorkingStatus = modalStatus === 'present' || modalStatus === 'late';
    const leaveCategory: LeaveCategory =
      modalStatus === 'approved_leave'
        ? modalLeaveCat
        : modalStatus === 'absent'
        ? 'unpaid'
        : 'none';

    setModalSaving(true);
    try {
      await saveAttendance(
        {
          date: modalDate,
          month: modalDate.slice(0, 7),
          status: modalStatus,
          leaveCategory,
          checkIn: isWorkingStatus ? modalInTime : '',
          checkOut: isWorkingStatus ? modalOutTime : '',
          notes: modalNotes.trim(),
        },
        existing?.id
      );
      setIsAttendanceModalOpen(false);
    } finally {
      setModalSaving(false);
    }
  };

  const summary = attendanceReport.summary;

  const { reportAttendanceSlices, reportAttendanceRatePct, reportTrackedDays } = useMemo(() => {
    const holidays = summary.totalWeeklyHolidays + summary.totalPublicHolidays;
    const holidaySubBn =
      summary.totalWeeklyHolidays > 0 || summary.totalPublicHolidays > 0
        ? `সাপ্তাহিক ${formatNumber(summary.totalWeeklyHolidays, 'bn')} + সরকারি ${formatNumber(summary.totalPublicHolidays, 'bn')}`
        : undefined;
    const holidaySubEn =
      summary.totalWeeklyHolidays > 0 || summary.totalPublicHolidays > 0
        ? `Weekly ${summary.totalWeeklyHolidays} + Govt ${summary.totalPublicHolidays}`
        : undefined;
    const raw: Array<Omit<AnalyticsPieSlice, 'percent'>> = [
      { key: 'present', nameBn: 'উপস্থিত', nameEn: 'Present', value: summary.totalPresent, color: '#059669' },
      {
        key: 'holidays',
        nameBn: 'সাপ্তাহিক ও সরকারি ছুটি',
        nameEn: 'Weekly & Govt Holidays',
        subLabelBn: holidaySubBn,
        subLabelEn: holidaySubEn,
        value: holidays,
        color: '#0EA5E9',
      },
      {
        key: 'approved_leave',
        nameBn: 'অনুমোদিত ছুটি',
        nameEn: 'Approved Leave',
        value: summary.totalApprovedLeave,
        color: '#4F46E5',
      },
      { key: 'late', nameBn: 'দেরি', nameEn: 'Late', value: summary.totalLate, color: '#D97706' },
      { key: 'absent', nameBn: 'অনুপস্থিত', nameEn: 'Absent', value: summary.totalAbsent, color: '#DC2626' },
    ].filter((s) => s.value > 0);
    const total = raw.reduce((acc, s) => acc + s.value, 0);
    const slices: AnalyticsPieSlice[] = raw.map((s) => ({
      ...s,
      percent: total > 0 ? Math.round((s.value / total) * 100) : 0,
    }));
    const workOpp = summary.totalPresent + summary.totalLate + summary.totalAbsent;
    const rate = workOpp > 0 ? Math.round(((summary.totalPresent + summary.totalLate) / workOpp) * 100) : 0;
    return {
      reportAttendanceSlices: slices,
      reportAttendanceRatePct: rate,
      reportTrackedDays: total,
    };
  }, [summary]);

  const { reportLeaveSlices, reportLeaveTotalDays, reportLeaveOffPct } = useMemo(() => {
    const ms = leaveReport.monthlySummary;
    const raw = [
      {
        key: 'approved_leave',
        nameBn: 'অনুমোদিত ছুটি',
        nameEn: 'Approved Leave',
        value: ms.approvedLeaveDays,
        color: '#4F46E5',
      },
      {
        key: 'weekly_holiday',
        nameBn: 'সাপ্তাহিক ছুটি',
        nameEn: 'Weekly Offs',
        value: ms.weeklyHolidays,
        color: '#0D9488',
      },
      {
        key: 'public_holiday',
        nameBn: 'সরকারি ছুটি',
        nameEn: 'Govt Holidays',
        value: ms.publicHolidays,
        color: '#D97706',
      },
      {
        key: 'absent',
        nameBn: 'অনুপস্থিত',
        nameEn: 'Absent',
        value: ms.absentDays,
        color: '#DC2626',
      },
    ].filter((s) => s.value > 0);
    const total = raw.reduce((acc, s) => acc + s.value, 0);
    const slices: AnalyticsPieSlice[] = raw.map((s) => ({
      ...s,
      percent: total > 0 ? Math.round((s.value / total) * 100) : 0,
    }));
    const paidOffs = ms.approvedLeaveDays + ms.weeklyHolidays + ms.publicHolidays;
    const pct = total > 0 ? Math.round((paidOffs / total) * 100) : 0;
    return {
      reportLeaveSlices: slices,
      reportLeaveTotalDays: total,
      reportLeaveOffPct: pct,
    };
  }, [leaveReport.monthlySummary]);

  const reportSalarySlices = useMemo<AnalyticsPieSlice[]>(() => {
    const fixedAllowances =
      salaryReport.medicalAllowance +
      salaryReport.transportAllowance +
      salaryReport.foodAllowance;
    const bonuses =
      salaryReport.attendanceBonus +
      salaryReport.festivalBonus +
      salaryReport.otherAllowances;
    const raw = [
      { key: 'basic', nameBn: 'মূল বেতন', nameEn: 'Basic Salary', value: salaryReport.basicSalary, color: '#059669' },
      {
        key: 'house_rent',
        nameBn: 'বাড়ি ভাড়া',
        nameEn: 'House Rent',
        value: salaryReport.houseRentAllowance,
        color: '#0D9488',
      },
      {
        key: 'allowances',
        nameBn: 'চিকিৎসা, যাতায়াত ও খাদ্য',
        nameEn: 'Allowances',
        value: fixedAllowances,
        color: '#2563EB',
      },
      {
        key: 'overtime',
        nameBn: 'ওভারটাইম আয়',
        nameEn: 'Overtime Pay',
        value: salaryReport.overtimeEarnings,
        color: '#D97706',
      },
      {
        key: 'bonuses',
        nameBn: 'হাজিরা ও অন্যান্য বোনাস',
        nameEn: 'Bonuses',
        value: bonuses,
        color: '#7C3AED',
      },
    ].filter((s) => s.value > 0);
    const total = raw.reduce((acc, s) => acc + s.value, 0);
    return raw.map((s) => ({
      ...s,
      percent: total > 0 ? Math.round((s.value / total) * 100) : 0,
    }));
  }, [salaryReport]);

  const summaryCards = [
    {
      id: 'present',
      value: `${formatNumber(summary.totalPresent, lang)} ${lang === 'bn' ? 'দিন' : 'd'}`,
      label: lang === 'bn' ? 'মোট উপস্থিত' : 'Total Present',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400',
      valueColor: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      id: 'working',
      value: `${formatNumber(summary.totalWorkingDays, lang)} ${lang === 'bn' ? 'দিন' : 'd'}`,
      label: lang === 'bn' ? 'মোট কর্মদিবস' : 'Working Days',
      icon: CalendarDays,
      iconBg: 'bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400',
      valueColor: 'text-slate-900 dark:text-white',
    },
    {
      id: 'absent',
      value: `${formatNumber(summary.totalAbsent, lang)} ${lang === 'bn' ? 'দিন' : 'd'}`,
      label: lang === 'bn' ? 'মোট অনুপস্থিত' : 'Total Absent',
      icon: XCircle,
      iconBg: 'bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400',
      valueColor: 'text-rose-700 dark:text-rose-300',
    },
    {
      id: 'late',
      value: `${formatNumber(summary.totalLate, lang)} ${lang === 'bn' ? 'দিন' : 'd'}`,
      label:
        summary.totalLateMinutes > 0
          ? lang === 'bn'
            ? `মোট বিলম্ব (${toBengaliDigits(summary.totalLateMinutes)} মি.)`
            : `Total Late (${summary.totalLateMinutes}m)`
          : lang === 'bn'
          ? 'মোট বিলম্ব'
          : 'Total Late',
      icon: Clock,
      iconBg: 'bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400',
      valueColor: 'text-amber-700 dark:text-amber-300',
    },
    {
      id: 'leave',
      value: `${formatNumber(summary.totalApprovedLeave, lang)} ${lang === 'bn' ? 'দিন' : 'd'}`,
      label: lang === 'bn' ? 'মোট ছুটি' : 'Approved Leave',
      icon: CalendarCheck2,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400',
      valueColor: 'text-indigo-700 dark:text-indigo-300',
    },
    {
      id: 'public_holiday',
      value: `${formatNumber(summary.totalPublicHolidays, lang)} ${lang === 'bn' ? 'দিন' : 'd'}`,
      label: lang === 'bn' ? 'মোট সরকারি ছুটি' : 'Govt Holidays',
      icon: Flag,
      iconBg: 'bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400',
      valueColor: 'text-purple-700 dark:text-purple-300',
    },
    {
      id: 'weekly_holiday',
      value: `${formatNumber(summary.totalWeeklyHolidays, lang)} ${lang === 'bn' ? 'দিন' : 'd'}`,
      label: lang === 'bn' ? 'মোট সাপ্তাহিক ছুটি' : 'Weekly Offs',
      icon: Coffee,
      iconBg: 'bg-teal-50 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400',
      valueColor: 'text-teal-700 dark:text-teal-300',
    },
    {
      id: 'overtime',
      value: `${formatNumber(summary.totalOvertimeHours, lang, 1)} ${
        lang === 'bn' ? 'ঘণ্টা' : 'hrs'
      }`,
      label: lang === 'bn' ? 'মোট ওভারটাইম' : 'Total Overtime',
      icon: Timer,
      iconBg: 'bg-violet-50 dark:bg-violet-950/70 text-violet-600 dark:text-violet-400',
      valueColor: 'text-violet-700 dark:text-violet-300',
    },
  ];

  return (
    <section id="printable-monthly-report" data-testid="reports-view" className="space-y-4">
      {/* Header + Month Stepper + Quick Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                {lang === 'bn' ? 'রিপোর্টসমূহ' : 'Monthly Reports'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {profile.factoryName || (lang === 'bn' ? 'মাসিক হাজিরা, ছুটি ও বেতন বিবরণী' : 'Attendance, leave & salary records')}
              </p>
            </div>

            {/* Inline Month Switcher */}
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-1 shrink-0">
              <button
                type="button"
                data-testid="reports-prev-month-btn"
                aria-label={lang === 'bn' ? 'আগের মাস' : 'Previous month'}
                onClick={() => setSelectedMonth(stepMonthISO(selectedMonth, -1))}
                className="w-7 h-7 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span
                data-testid="reports-active-month-label"
                className="px-2 text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap"
              >
                {formatMonthLabel(selectedMonth, lang)}
              </span>
              <button
                type="button"
                data-testid="reports-next-month-btn"
                aria-label={lang === 'bn' ? 'পরের মাস' : 'Next month'}
                onClick={() => setSelectedMonth(stepMonthISO(selectedMonth, 1))}
                className="w-7 h-7 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap no-print">
            <button
              type="button"
              data-testid="reports-mark-attendance-btn"
              onClick={() => openAttendanceModalForDate()}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'bn' ? 'হাজিরা দিন' : 'Mark Attendance'}</span>
            </button>

            <button
              type="button"
              data-testid="reports-export-csv-btn"
              onClick={onExportCSV}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              data-testid="reports-print-pdf-btn"
              onClick={() =>
                printElementSafely({
                  elementId: 'printable-monthly-report',
                  title: `${lang === 'bn' ? 'মাসিক রিপোর্ট' : 'Monthly Report'} - ${formatMonthLabel(
                    selectedMonth,
                    lang
                  )}`,
                })
              }
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0" />
              <span>{lang === 'bn' ? 'প্রিন্ট / PDF' : 'Print / PDF'}</span>
            </button>
          </div>
        </div>

        {/* 3 Segmented Sub-Tabs: হাজিরা রিপোর্ট | ছুটির রিপোর্ট | বেতন রিপোর্ট */}
        <div
          role="tablist"
          aria-label={lang === 'bn' ? 'রিপোর্ট ক্যাটাগরি' : 'Report Categories'}
          className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/80 no-print"
        >
          {(
            [
              {
                id: 'attendance',
                bn: 'হাজিরা রিপোর্ট',
                en: 'Attendance',
              },
              {
                id: 'leave',
                bn: 'ছুটির রিপোর্ট',
                en: 'Leave',
              },
              {
                id: 'salary',
                bn: 'বেতন রিপোর্ট',
                en: 'Salary',
              },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`report-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[38px] px-2 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs border border-emerald-200/60 dark:border-emerald-800/60'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {lang === 'bn' ? tab.bn : tab.en}
              </button>
            );
          })}
        </div>

        {/* Shift & Active Duty Info Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold tabular-nums">
            <Clock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>{attendanceReport.scheduledShiftWindow}</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span>{formatMonthLabel(selectedMonth, lang)}</span>
          </div>

          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
            {lang === 'bn'
              ? `${attendanceReport.scheduledShiftLabelBn} · অন-ডিউটি`
              : `${attendanceReport.scheduledShiftLabelEn} · On-Duty`}
          </span>
        </div>
      </div>

      {/* TAB 1: ATTENDANCE REPORT TABLE + 8-CARD ATTENDANCE SUMMARY */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Attendance Report Table Card */}
          <div
            data-testid="attendance-report-table-card"
            className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'হাজিরা রিপোর্ট টেবিল' : 'Attendance Report Table'}
                </h2>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatNumber(filteredAttendanceRows.length, lang)}{' '}
                  {lang === 'bn' ? 'দিন' : 'days'}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap no-print">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="reports-show-all-days-toggle"
                    checked={includeAllMonthDays}
                    onChange={(e) => setIncludeAllMonthDays(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-700 border-slate-300 dark:border-slate-600 cursor-pointer"
                  />
                  <span>
                    {lang === 'bn' ? 'মাসের সব দিন দেখুন' : 'Show all month days'}
                  </span>
                </label>

                {filteredAttendanceRows.length > 7 && (
                  <button
                    type="button"
                    data-testid="reports-toggle-table-expand-btn"
                    onClick={() => setExpandFullTable((v) => !v)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                  >
                    {expandFullTable
                      ? lang === 'bn'
                        ? 'সংক্ষিপ্ত ভিউ'
                        : 'Compact View'
                      : lang === 'bn'
                      ? 'সবগুলো দেখুন'
                      : 'Expand All'}
                  </button>
                )}
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 no-print">
              {FILTER_OPTIONS.map((opt) => {
                const active = statusFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`report-filter-${opt.id}`}
                    onClick={() => setStatusFilter(opt.id)}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {lang === 'bn' ? opt.bn : opt.en}
                  </button>
                );
              })}
            </div>

            {filteredAttendanceRows.length === 0 ? (
              <div
                data-testid="attendance-report-empty-state"
                className="py-10 px-4 text-center rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-3"
              >
                <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'bn'
                    ? `${formatMonthLabel(selectedMonth, 'bn')} মাসে নির্বাচিত ক্যাটাগরিতে কোনো হাজিরার তথ্য পাওয়া যায়নি।`
                    : `No attendance records found for ${formatMonthLabel(selectedMonth, 'en')}.`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 no-print">
                  {statusFilter !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {lang === 'bn' ? 'সবগুলো দেখান' : 'Show All'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openAttendanceModalForDate()}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'হাজিরা দিন' : 'Mark Attendance'}</span>
                      </button>
                      {latestPopulatedMonth && (
                        <button
                          type="button"
                          data-testid="reports-jump-populated-month-btn"
                          onClick={() => setSelectedMonth(latestPopulatedMonth)}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold cursor-pointer"
                        >
                          {lang === 'bn'
                            ? `${formatMonthLabel(latestPopulatedMonth, 'bn')} দেখুন`
                            : `View ${formatMonthLabel(latestPopulatedMonth, 'en')}`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 ${
                  expandFullTable ? '' : 'max-h-[320px] sm:max-h-[360px] overflow-y-auto print:max-h-none print:overflow-visible'
                }`}
              >
                <table
                  data-testid="attendance-report-table"
                  className="w-full text-left border-collapse"
                >
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-2 whitespace-nowrap">
                        {lang === 'bn' ? 'তারিখ' : 'Date'}
                      </th>
                      <th className="py-2.5 px-1.5 sm:px-3 whitespace-nowrap">
                        {lang === 'bn' ? 'ইন' : 'In'}
                      </th>
                      <th className="py-2.5 px-1.5 sm:px-3 whitespace-nowrap">
                        {lang === 'bn' ? 'আউট' : 'Out'}
                      </th>
                      <th className="py-2.5 px-1.5 sm:px-3 whitespace-nowrap">
                        {lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}
                      </th>
                      <th className="py-2.5 px-1.5 sm:px-3 whitespace-nowrap text-right">
                        {lang === 'bn' ? 'ওটি' : 'OT'}
                      </th>
                      <th className="py-2.5 pl-1.5 sm:pl-3 whitespace-nowrap text-right">
                        {lang === 'bn' ? 'দেরি' : 'Late'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-[11px] sm:text-xs">
                    {filteredAttendanceRows.map((row) => (
                      <tr
                        key={row.date}
                        data-testid={`report-row-${row.date}`}
                        onClick={() => openAttendanceModalForDate(row.date)}
                        className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 pr-2 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                          <span>{row.dateLabel}</span>
                          <span className="hidden sm:inline text-slate-400 dark:text-slate-500 font-medium ml-1.5">
                            ({row.dayShortLabel})
                          </span>
                        </td>
                        <td className="py-2.5 px-1.5 sm:px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 tabular-nums">
                          {row.inTimeDisplay}
                        </td>
                        <td className="py-2.5 px-1.5 sm:px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 tabular-nums">
                          {row.outTimeDisplay}
                        </td>
                        <td className="py-2.5 px-1.5 sm:px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-bold ${
                              STATUS_BADGE_CLASSES[row.status]
                            }`}
                          >
                            {lang === 'bn' ? row.statusLabelBn : row.statusLabelEn}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 px-1.5 sm:px-3 whitespace-nowrap text-right font-bold tabular-nums ${
                            row.otHours > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {row.otDisplay}
                        </td>
                        <td
                          className={`py-2.5 pl-1.5 sm:pl-3 whitespace-nowrap text-right font-bold tabular-nums ${
                            row.lateMinutes > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {row.lateDisplay}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Report Analytics Pie Chart ("রিপোর্ট অ্যানালিটিক্স") */}
          <AttendancePieChartCard
            titleBn="রিপোর্ট অ্যানালিটিক্স · উপস্থিতি ও ছুটি"
            titleEn="Report Analytics · Attendance & Holidays"
            selectedMonth={selectedMonth}
            lang={lang}
            slices={reportAttendanceSlices}
            totalTrackedDays={reportTrackedDays}
            attendanceRatePct={reportAttendanceRatePct}
            latestPopulatedAttendanceMonth={latestPopulatedMonth}
            onSelectMonth={setSelectedMonth}
            onActionClick={() => openAttendanceModalForDate()}
            actionLabelBn="হাজিরা দিন"
            actionLabelEn="Mark Attendance"
            onSeedSampleData={!isReadOnlyDemo ? () => void seedSampleDemoData() : undefined}
            dataTestId="reports-attendance-pie-card"
          />

          {/* Attendance Summary 8-Card Grid ("হাজিরা সারাংশ") */}
          <div data-testid="attendance-summary-grid-section" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'হাজিরা সারাংশ' : 'Attendance Summary'}
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {formatMonthLabel(selectedMonth, lang)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {summaryCards.map((card) => {
                const IconComp = card.icon;
                return (
                  <div
                    key={card.id}
                    data-testid={`attendance-summary-card-${card.id}`}
                    className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col items-center text-center shadow-2xs"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 ${card.iconBg}`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <p
                      className={`text-sm sm:text-base font-extrabold tabular-nums leading-tight ${card.valueColor}`}
                    >
                      {card.value}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-snug">
                      {card.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LEAVE REPORT ("ছুটির রিপোর্ট") */}
      {activeTab === 'leave' && (
        <div data-testid="leave-report-section" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'নৈমিত্তিক ছুটি' : 'Casual Leave'}
                </span>
                <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatNumber(leaveReport.annualSummary.casualRemaining, lang)} /{' '}
                  {formatNumber(leaveReport.annualSummary.casualEntitled, lang)}{' '}
                  {lang === 'bn' ? 'বাকি' : 'left'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (leaveReport.annualSummary.casualUsed /
                        leaveReport.annualSummary.casualEntitled) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? `এই বছর ব্যবহৃত: ${formatNumber(leaveReport.annualSummary.casualUsed, lang)} দিন`
                  : `Used this year: ${leaveReport.annualSummary.casualUsed} days`}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'অসুস্থতার ছুটি' : 'Sick Leave'}
                </span>
                <span className="text-[11px] font-extrabold text-sky-700 dark:text-sky-400 tabular-nums">
                  {formatNumber(leaveReport.annualSummary.sickRemaining, lang)} /{' '}
                  {formatNumber(leaveReport.annualSummary.sickEntitled, lang)}{' '}
                  {lang === 'bn' ? 'বাকি' : 'left'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-600 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (leaveReport.annualSummary.sickUsed /
                        leaveReport.annualSummary.sickEntitled) *
                        100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? `এই বছর ব্যবহৃত: ${formatNumber(leaveReport.annualSummary.sickUsed, lang)} দিন`
                  : `Used this year: ${leaveReport.annualSummary.sickUsed} days`}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'অর্জিত ছুটি (আনুমানিক)' : 'Earned Leave (Est.)'}
              </p>
              <p className="text-base font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums">
                {formatNumber(leaveReport.annualSummary.earnedRemaining, lang)}{' '}
                {lang === 'bn' ? 'দিন' : 'days'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? `মোট ${formatNumber(leaveReport.annualSummary.yearWorkingDays, lang)} কর্মদিবসে অর্জিত`
                  : `From ${leaveReport.annualSummary.yearWorkingDays} worked days`}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'মাসিক ছুটি ও অনুপস্থিতি' : 'Month Leaves & Offs'}
              </p>
              <p className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                {formatNumber(
                  leaveReport.monthlySummary.approvedLeaveDays +
                    leaveReport.monthlySummary.weeklyHolidays +
                    leaveReport.monthlySummary.publicHolidays,
                  lang
                )}{' '}
                {lang === 'bn' ? 'দিন ছুটি' : 'days off'}
              </p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                {lang === 'bn'
                  ? `অনুপস্থিত: ${formatNumber(leaveReport.monthlySummary.absentDays, lang)} দিন`
                  : `Absent: ${leaveReport.monthlySummary.absentDays} days`}
              </p>
            </div>
          </div>

          {/* Leave & Offs Pie Chart ("রিপোর্ট অ্যানালিটিক্স") */}
          <AttendancePieChartCard
            titleBn="রিপোর্ট অ্যানালিটিক্স · ছুটি ও বন্ধ"
            titleEn="Report Analytics · Leave & Offs"
            selectedMonth={selectedMonth}
            lang={lang}
            slices={reportLeaveSlices}
            totalTrackedDays={reportLeaveTotalDays}
            attendanceRatePct={reportLeaveOffPct}
            centerLabelBn="বৈধ ছুটি"
            centerLabelEn="Paid Offs"
            latestPopulatedAttendanceMonth={latestPopulatedMonth}
            onSelectMonth={setSelectedMonth}
            onActionClick={() => openAttendanceModalForDate()}
            actionLabelBn="ছুটি যোগ করুন"
            actionLabelEn="Log Leave"
            onSeedSampleData={!isReadOnlyDemo ? () => void seedSampleDemoData() : undefined}
            dataTestId="reports-leave-pie-card"
          />

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'মাসিক ছুটি ও অনুপস্থিতির বিবরণ' : 'Monthly Leave & Absence Breakdown'}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {formatNumber(leaveReport.rows.length, lang)} {lang === 'bn' ? 'দিন' : 'entries'}
              </span>
            </div>

            {leaveReport.rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'এই মাসে কোনো ছুটি বা অনুপস্থিতির রেকর্ড নেই।'
                  : 'No leave, holiday, or absence records in this month.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaveReport.rows.map((item) => (
                  <div
                    key={item.date}
                    onClick={() => openAttendanceModalForDate(item.date)}
                    className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-lg px-1 transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {item.dateLabel}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                            STATUS_BADGE_CLASSES[item.status]
                          }`}
                        >
                          {lang === 'bn' ? item.typeLabelBn : item.typeLabelEn}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {lang === 'bn' ? item.categoryLabelBn : item.categoryLabelEn}
                        {item.notes ? ` · ${item.notes}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SALARY REPORT ("বেতন রিপোর্ট") */}
      {activeTab === 'salary' && (
        <div data-testid="salary-report-section" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'নিট প্রাপ্য বেতন' : 'Est. Net Payable'}
              </p>
              <p className="text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatBDT(salaryReport.estimatedNetPayable, lang)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? `উপস্থিত ${formatNumber(salaryReport.workedDays, lang)} দিন · অনুপস্থিত ${formatNumber(salaryReport.absentDays, lang)} দিন`
                  : `${salaryReport.workedDays} worked · ${salaryReport.absentDays} absent`}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'ওভারটাইম আয়' : 'Overtime Earnings'}
              </p>
              <p className="text-base sm:text-lg font-extrabold text-amber-700 dark:text-amber-300 tabular-nums">
                {formatBDT(salaryReport.overtimeEarnings, lang)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatNumber(salaryReport.overtimeHours, lang, 1)}{' '}
                {lang === 'bn' ? 'ঘণ্টা' : 'hrs'} · {formatBDT(salaryReport.overtimeHourlyRate, lang)}/
                {lang === 'bn' ? 'ঘ.' : 'hr'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'মোট প্রাপ্ত বেতন' : 'Total Received'}
              </p>
              <p className="text-base sm:text-lg font-extrabold text-sky-700 dark:text-sky-300 tabular-nums">
                {formatBDT(salaryReport.totalReceived, lang)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {salaryReport.paymentStatus === 'paid'
                  ? lang === 'bn'
                    ? 'সম্পূর্ণ পরিশোধিত'
                    : 'Fully Paid'
                  : salaryReport.paymentStatus === 'partial'
                  ? lang === 'bn'
                    ? 'আংশিক পরিশোধিত'
                    : 'Partially Paid'
                  : lang === 'bn'
                  ? 'অপরিশোধিত'
                  : 'Unpaid'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'বকেয়া বেতন' : 'Outstanding'}
              </p>
              <p className="text-base sm:text-lg font-extrabold text-rose-700 dark:text-rose-300 tabular-nums">
                {formatBDT(salaryReport.outstandingBalance, lang)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {salaryReport.attendanceBonusEligible
                  ? lang === 'bn'
                    ? 'হাজিরা বোনাস বহাল'
                    : 'Attendance bonus kept'
                  : lang === 'bn'
                  ? 'হাজিরা বোনাস বাতিল'
                  : 'Bonus missed'}
              </p>
            </div>
          </div>

          {/* Salary Mix Pie Chart ("রিপোর্ট অ্যানালিটিক্স") */}
          <SalaryMixPieChartCard
            titleBn="রিপোর্ট অ্যানালিটিক্স · বেতন ও ভাতা"
            titleEn="Report Analytics · Salary Mix"
            lang={lang}
            slices={reportSalarySlices}
            dataTestId="reports-salary-pie-card"
          />

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>{lang === 'bn' ? 'মাসিক বেতন ও ভাতার বিবরণী' : 'Salary & Allowance Breakdown'}</span>
              </h2>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {formatMonthLabel(selectedMonth, lang)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="space-y-2">
                {[
                  { labelBn: 'মূল বেতন (Basic)', labelEn: 'Basic Salary', val: salaryReport.basicSalary },
                  { labelBn: 'বাড়ি ভাড়া ভাতা', labelEn: 'House Rent', val: salaryReport.houseRentAllowance },
                  { labelBn: 'চিকিৎসা ভাতা', labelEn: 'Medical Allowance', val: salaryReport.medicalAllowance },
                  { labelBn: 'যাতায়াত ভাতা', labelEn: 'Transport Allowance', val: salaryReport.transportAllowance },
                  { labelBn: 'খাদ্য ভাতা', labelEn: 'Food Allowance', val: salaryReport.foodAllowance },
                ].map((item) => (
                  <div
                    key={item.labelEn}
                    className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/70"
                  >
                    <span className="text-slate-600 dark:text-slate-300">
                      {lang === 'bn' ? item.labelBn : item.labelEn}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatBDT(item.val, lang)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {[
                  {
                    labelBn: 'হাজিরা বোনাস',
                    labelEn: 'Attendance Bonus',
                    val: salaryReport.attendanceBonus,
                    tone: 'text-emerald-700 dark:text-emerald-400',
                  },
                  {
                    labelBn: 'ওভারটাইম আয়',
                    labelEn: 'Overtime Pay',
                    val: salaryReport.overtimeEarnings,
                    tone: 'text-amber-700 dark:text-amber-400',
                  },
                  {
                    labelBn: 'উৎসব ও অন্যান্য ভাতা',
                    labelEn: 'Festival & Other',
                    val: salaryReport.festivalBonus + salaryReport.otherAllowances,
                    tone: 'text-slate-900 dark:text-white',
                  },
                  {
                    labelBn: 'মোট কর্তন (অগ্রিম/অনুপস্থিতি)',
                    labelEn: 'Total Deductions',
                    val: -salaryReport.totalDeductions,
                    tone: 'text-rose-700 dark:text-rose-400',
                  },
                ].map((item) => (
                  <div
                    key={item.labelEn}
                    className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/70"
                  >
                    <span className="text-slate-600 dark:text-slate-300">
                      {lang === 'bn' ? item.labelBn : item.labelEn}
                    </span>
                    <span className={`font-bold tabular-nums ${item.tone}`}>
                      {item.val < 0 ? `- ${formatBDT(Math.abs(item.val), lang)}` : formatBDT(item.val, lang)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'হিসাবকৃত নিট বেতন' : 'Estimated Net Salary'}
                  </span>
                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {formatBDT(salaryReport.estimatedNetPayable, lang)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK MARK ATTENDANCE MODAL ("হাজিরা দিন") */}
      {isAttendanceModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mark-attendance-modal-title"
          data-testid="mark-attendance-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4 no-print"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div>
                <h2
                  id="mark-attendance-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  {lang === 'bn' ? 'হাজিরা দিন' : 'Mark Attendance'}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'তারিখ, ইন-টাইম এবং আউট-টাইম নির্বাচন করুন'
                    : 'Select date, status, check-in and check-out time'}
                </p>
              </div>
              <button
                type="button"
                aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                onClick={() => setIsAttendanceModalOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendanceFromModal} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/70 flex items-start gap-2.5 text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
                <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <span>
                  {lang === 'bn'
                    ? 'সঠিক হাজিরা দেওয়ার জন্য তারিখ এবং সময় নির্বাচন করুন। ইন-টাইম এবং আউট-টাইম সঠিকভাবে দিন।'
                    : 'Select accurate date and check-in / check-out times so your monthly attendance report stays up to date.'}
                </span>
              </div>

              {isReadOnlyDemo && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 text-[11px] font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {lang === 'bn'
                      ? 'ডেমো মোডে পরিবর্তন সংরক্ষণ করা যাবে না।'
                      : 'Changes are not saved in Demo Mode.'}
                  </span>
                </div>
              )}

              {modalError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  {modalError}
                </div>
              )}

              <div>
                <label
                  htmlFor="report-modal-date"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  {lang === 'bn' ? 'তারিখ নির্বাচন করুন' : 'Select Date'} ({formatDateReadable(modalDate, lang)})
                </label>
                <DateInputDMY
                  id="report-modal-date"
                  value={modalDate}
                  max={todayISO}
                  onChange={(val) => setModalDate(val)}
                  lang={lang}
                  className="w-full"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === 'bn' ? 'উপস্থিতির ধরন' : 'Attendance Status'}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {QUICK_STATUS_OPTIONS.map((st) => {
                    const active = modalStatus === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        data-testid={`modal-status-${st.id}`}
                        onClick={() => setModalStatus(st.id)}
                        className={`min-h-[36px] px-2 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {lang === 'bn' ? st.bn : st.en}
                      </button>
                    );
                  })}
                </div>
              </div>

              {modalStatus === 'approved_leave' && (
                <div>
                  <label
                    htmlFor="report-modal-leave-cat"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    {lang === 'bn' ? 'ছুটির ধরন' : 'Leave Category'}
                  </label>
                  <select
                    id="report-modal-leave-cat"
                    value={modalLeaveCat}
                    onChange={(e) => setModalLeaveCat(e.target.value as LeaveCategory)}
                    className="w-full h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {LEAVE_CAT_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {lang === 'bn' ? c.bn : c.en}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(modalStatus === 'present' || modalStatus === 'late') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="report-modal-in-time"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {lang === 'bn' ? 'সিলেক্ট ইন-টাইম' : 'Check-in Time'}
                    </label>
                    <input
                      id="report-modal-in-time"
                      type="time"
                      value={modalInTime}
                      onChange={(e) => setModalInTime(e.target.value)}
                      className="w-full h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block tabular-nums">
                      {formatTime12h(modalInTime)}
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="report-modal-out-time"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {lang === 'bn' ? 'সিলেক্ট আউট-টাইম' : 'Check-out Time'}
                    </label>
                    <input
                      id="report-modal-out-time"
                      type="time"
                      value={modalOutTime}
                      onChange={(e) => setModalOutTime(e.target.value)}
                      className="w-full h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block tabular-nums">
                      {formatTime12h(modalOutTime)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="report-modal-notes"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {lang === 'bn' ? 'নোট (ঐচ্ছিক)' : 'Notes (Optional)'}
                </label>
                <input
                  id="report-modal-notes"
                  type="text"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: নিয়মিত ডিউটি বা ছুটির কারণ...' : 'Optional note...'}
                  className="w-full h-[42px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={modalSaving}
                  data-testid="modal-submit-attendance-btn"
                  className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  {modalSaving
                    ? lang === 'bn'
                      ? 'সংরক্ষণ হচ্ছে...'
                      : 'Saving...'
                    : lang === 'bn'
                    ? 'হাজিরা দিন'
                    : 'Save Attendance'}
                </button>
                <button
                  type="button"
                  data-testid="modal-cancel-attendance-btn"
                  onClick={() => setIsAttendanceModalOpen(false)}
                  className="w-full min-h-[42px] rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  {lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
