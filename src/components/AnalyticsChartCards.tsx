import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Clock,
  HandCoins,
  PieChart as PieChartIcon,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { Language } from '../types';
import { formatBDT, formatNumber, toBengaliDigits } from '../utils/calculations';
import { formatMonthLabel } from '../utils/i18n';
import type {
  AnalyticsPieSlice,
  ExpenseRentTrendPoint,
  FactoryComparisonAnalytics,
  LoanPortfolioAnalytics,
  OvertimePieAnalytics,
  RecentActivityPieAnalytics,
} from '../utils/homeAnalytics';

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  borderColor: '#334155',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: 700,
  color: '#f8fafc',
};

interface AttendancePieChartCardProps {
  titleBn?: string;
  titleEn?: string;
  selectedMonth: string;
  lang: Language;
  slices: AnalyticsPieSlice[];
  totalTrackedDays: number;
  attendanceRatePct: number;
  centerLabelBn?: string;
  centerLabelEn?: string;
  latestPopulatedAttendanceMonth?: string | null;
  onSelectMonth?: (monthISO: string) => void;
  onActionClick?: () => void;
  actionLabelBn?: string;
  actionLabelEn?: string;
  onSeedSampleData?: () => void;
  dataTestId?: string;
}

export const AttendancePieChartCard: React.FC<AttendancePieChartCardProps> = ({
  titleBn = 'উপস্থিতি, সাপ্তাহিক ও সরকারি ছুটি এবং অনুপস্থিতি',
  titleEn = 'Attendance, Holidays & Absence Breakdown',
  selectedMonth,
  lang,
  slices,
  totalTrackedDays,
  attendanceRatePct,
  centerLabelBn = 'উপস্থিতি',
  centerLabelEn = 'Present',
  latestPopulatedAttendanceMonth,
  onSelectMonth,
  onActionClick,
  actionLabelBn = 'হাজিরা যোগ করুন',
  actionLabelEn = 'Mark Attendance',
  onSeedSampleData,
  dataTestId = 'attendance-pie-card',
}) => {
  return (
    <div
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5 sm:space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <PieChartIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
            {lang === 'bn' ? titleBn : titleEn}
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap shrink-0">
          {lang === 'bn'
            ? `মোট ${formatNumber(totalTrackedDays, 'bn')} দিন`
            : `${totalTrackedDays} days`}
        </span>
      </div>

      {slices.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-center">
          <div className="sm:col-span-5 relative h-[158px] sm:h-[186px] w-full max-w-[220px] mx-auto sm:max-w-none min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey={lang === 'bn' ? 'nameBn' : 'nameEn'}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const num = Number(value) || 0;
                    return [
                      lang === 'bn' ? `${toBengaliDigits(num)} দিন` : `${num} days`,
                      String(name || ''),
                    ];
                  }}
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
              <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums leading-none">
                {formatNumber(attendanceRatePct, lang)}%
              </span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'bn' ? centerLabelBn : centerLabelEn}
              </span>
            </div>
          </div>

          <div className="sm:col-span-7 space-y-2.5">
            {slices.map((slice) => {
              const sub = lang === 'bn' ? slice.subLabelBn : slice.subLabelEn;
              return (
                <div key={slice.key} className="space-y-1">
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                        style={{ backgroundColor: slice.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 leading-snug break-words block">
                          {lang === 'bn' ? slice.nameBn : slice.nameEn}
                        </span>
                        {sub && (
                          <span className="text-[10px] font-medium text-sky-700 dark:text-sky-400 leading-snug break-words block mt-0.5">
                            {sub}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {formatNumber(slice.value, lang)} {lang === 'bn' ? 'দিন' : 'd'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-9 text-right">
                        {formatNumber(slice.percent, lang)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, Math.min(100, slice.percent))}%`,
                        backgroundColor: slice.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-6 px-3 text-center space-y-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {lang === 'bn'
              ? `${formatMonthLabel(selectedMonth, 'bn')} মাসে এখনো হাজিরা রেকর্ড নেই।`
              : `No attendance logged for ${formatMonthLabel(selectedMonth, 'en')}.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onActionClick && (
              <button
                type="button"
                onClick={onActionClick}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>{lang === 'bn' ? actionLabelBn : actionLabelEn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onSelectMonth &&
              latestPopulatedAttendanceMonth &&
              latestPopulatedAttendanceMonth !== selectedMonth && (
                <button
                  type="button"
                  onClick={() => onSelectMonth(latestPopulatedAttendanceMonth)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  {lang === 'bn'
                    ? `${formatMonthLabel(latestPopulatedAttendanceMonth, 'bn')} দেখুন`
                    : `View ${formatMonthLabel(latestPopulatedAttendanceMonth, 'en')}`}
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

interface SalaryMixPieChartCardProps {
  titleBn?: string;
  titleEn?: string;
  lang: Language;
  slices: AnalyticsPieSlice[];
  dataTestId?: string;
}

export const SalaryMixPieChartCard: React.FC<SalaryMixPieChartCardProps> = ({
  titleBn = 'বেতন, ভাতা ও ওভারটাইম বিভাজন',
  titleEn = 'Salary & Earnings Breakdown',
  lang,
  slices,
  dataTestId = 'salary-pie-card',
}) => {
  const totalSalaryMix = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <div
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5 sm:space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <PieChartIcon className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
            {lang === 'bn' ? titleBn : titleEn}
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap shrink-0">
          {formatBDT(totalSalaryMix, lang)}
        </span>
      </div>

      {slices.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-center">
          <div className="sm:col-span-5 relative h-[158px] sm:h-[186px] w-full max-w-[220px] mx-auto sm:max-w-none min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey={lang === 'bn' ? 'nameBn' : 'nameEn'}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={3}
                  cornerRadius={5}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    formatBDT(Number(value) || 0, lang),
                    String(name || ''),
                  ]}
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                {formatBDT(totalSalaryMix, lang)}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'bn' ? 'মোট কাঠামো' : 'Total Mix'}
              </span>
            </div>
          </div>

          <div className="sm:col-span-7 space-y-2.5">
            {slices.map((slice) => (
              <div key={slice.key} className="space-y-1">
                <div className="flex items-start justify-between gap-2 text-xs">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-200 leading-snug break-words">
                      {lang === 'bn' ? slice.nameBn : slice.nameEn}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {formatBDT(slice.value, lang)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-9 text-right">
                      {formatNumber(slice.percent, lang)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, Math.min(100, slice.percent))}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-slate-500">
          {lang === 'bn' ? 'বেতনের তথ্য সেটআপ করুন।' : 'Set up your salary profile.'}
        </div>
      )}
    </div>
  );
};

export interface EarnedSalarySummaryPieCardProps {
  selectedMonth: string;
  lang: Language;
  totalEarnedSalary: number;
  earnedBasePay: number;
  attendedDaysCount: number;
  dailyWageRate: number;
  receivedSalary: number;
  outstandingBalance: number;
  otHours: number;
  otEarnings: number;
  bonusAndAllowances: number;
  isAttendanceBonusEligible: boolean;
  dataTestId?: string;
}

export const EarnedSalarySummaryPieCard: React.FC<EarnedSalarySummaryPieCardProps> = ({
  selectedMonth,
  lang,
  totalEarnedSalary,
  earnedBasePay,
  attendedDaysCount,
  dailyWageRate,
  receivedSalary,
  outstandingBalance,
  otHours,
  otEarnings,
  bonusAndAllowances,
  isAttendanceBonusEligible,
  dataTestId = 'home-earned-salary-pie-card',
}) => {
  const rawSlices = [
    {
      key: 'earned_base',
      nameBn: `চলতি অর্জিত বেতন (${formatNumber(attendedDaysCount, 'bn')} দিন)`,
      nameEn: `Earned Base Pay (${attendedDaysCount}d)`,
      subLabelBn: `দৈনিক ${formatBDT(dailyWageRate, 'bn')} হিসেবে হাজিরা আয়`,
      subLabelEn: `${formatBDT(dailyWageRate, 'en')}/day attendance pay`,
      value: Math.max(0, Math.round(earnedBasePay)),
      color: '#059669',
    },
    {
      key: 'overtime',
      nameBn: `মূল ওভারটাইম (${formatNumber(otHours, 'bn', 1)} ঘণ্টা)`,
      nameEn: `Overtime (${otHours} hrs)`,
      subLabelBn: `মোট ${formatNumber(otHours, 'bn', 1)} ঘণ্টা ওভারটাইম আয়`,
      subLabelEn: `Total ${otHours} hrs overtime pay`,
      value: Math.max(0, Math.round(otEarnings)),
      color: '#D97706',
    },
    {
      key: 'payable_due',
      nameBn: 'হাতে প্রাপ্য বেতন (বকেয়া)',
      nameEn: 'Payable Salary (Due)',
      subLabelBn: 'চলতি অর্জিত বেতন হতে হাতে প্রাপ্য',
      subLabelEn: 'Net payable from earned salary',
      value: Math.max(0, Math.round(outstandingBalance)),
      color: '#2563EB',
    },
    {
      key: 'received_pay',
      nameBn: 'হাতে প্রাপ্ত বেতন',
      nameEn: 'Received Salary',
      subLabelBn: 'ইতিমধ্যে হাতে প্রাপ্ত টাকা',
      subLabelEn: 'Salary already received',
      value: Math.max(0, Math.round(receivedSalary)),
      color: '#0D9488',
    },
    {
      key: 'bonus_allowance',
      nameBn: 'হাজিরা বোনাস ও ভাতা',
      nameEn: 'Attendance Bonus & Allowances',
      subLabelBn: isAttendanceBonusEligible ? 'হাজিরা বোনাস বহাল' : 'ভাতা ও বোনাস',
      subLabelEn: isAttendanceBonusEligible ? 'Attendance bonus active' : 'Allowances',
      value: Math.max(0, Math.round(bonusAndAllowances)),
      color: '#7C3AED',
    },
  ].filter((s) => s.value > 0);

  const sliceSum = rawSlices.reduce((sum, s) => sum + s.value, 0);
  const slices: AnalyticsPieSlice[] = rawSlices.map((s) => ({
    ...s,
    percent: sliceSum > 0 ? Math.round((s.value / sliceSum) * 100) : 0,
  }));

  return (
    <section
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 space-y-3.5 sm:space-y-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shrink-0">
            <PieChartIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
              {lang === 'bn'
                ? 'চলতি অর্জিত বেতন, হাতে প্রাপ্য ও ওভারটাইম বিভাজন'
                : 'Earned Salary, Payable & Overtime Breakdown'}
            </h3>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {formatMonthLabel(selectedMonth, lang)} ·{' '}
              {lang === 'bn'
                ? `ওভারটাইম ${formatNumber(otHours, 'bn', 1)} ঘণ্টা`
                : `Overtime ${otHours} hrs`}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums whitespace-nowrap shrink-0">
          {formatBDT(totalEarnedSalary, lang)}
        </span>
      </div>

      {slices.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-5 items-center">
            {/* Donut Pie */}
            <div className="sm:col-span-5 relative h-[164px] sm:h-[192px] w-full max-w-[225px] mx-auto sm:max-w-none min-w-0 [&_svg]:outline-none [&_.recharts-wrapper]:outline-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey={lang === 'bn' ? 'nameBn' : 'nameEn'}
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={72}
                    paddingAngle={2.5}
                    cornerRadius={5}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      formatBDT(Number(value) || 0, lang),
                      String(name || ''),
                    ]}
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                  {formatBDT(totalEarnedSalary, lang)}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {lang === 'bn' ? 'চলতি অর্জিত বেতন' : 'Earned Salary'}
                </span>
              </div>
            </div>

            {/* Scannable Legend Bars */}
            <div className="sm:col-span-7 space-y-2.5">
              {slices.map((slice) => {
                const sub = lang === 'bn' ? slice.subLabelBn : slice.subLabelEn;
                return (
                  <div key={slice.key} className="space-y-1">
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                          style={{ backgroundColor: slice.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200 leading-snug break-words block">
                            {lang === 'bn' ? slice.nameBn : slice.nameEn}
                          </span>
                          {sub && (
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-snug break-words block mt-0.5">
                              {sub}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {formatBDT(slice.value, lang)}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-9 text-right">
                          {formatNumber(slice.percent, lang)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, Math.min(100, slice.percent))}%`,
                          backgroundColor: slice.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom 3-Column Summary Strip: চলতি অর্জিত বেতন | হাতে প্রাপ্য বেতন | মূল ওভারটাইম (এত ঘণ্টা) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-[11px] sm:text-xs">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block leading-tight">
                {lang === 'bn' ? 'চলতি অর্জিত বেতন' : 'Earned Salary'}
              </span>
              <span className="mt-0.5 font-extrabold text-slate-900 dark:text-white tabular-nums block">
                {formatBDT(totalEarnedSalary, lang)}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/50">
              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 block leading-tight">
                {lang === 'bn' ? 'হাতে প্রাপ্য বেতন' : 'Payable Due'}
              </span>
              <span className="mt-0.5 font-extrabold text-slate-900 dark:text-white tabular-nums block">
                {formatBDT(outstandingBalance, lang)}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block leading-tight">
                {lang === 'bn'
                  ? `ওভারটাইম (${formatNumber(otHours, 'bn', 1)} ঘঃ)`
                  : `Overtime (${otHours}h)`}
              </span>
              <span className="mt-0.5 font-extrabold text-slate-900 dark:text-white tabular-nums block">
                {formatBDT(otEarnings, lang)}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? 'এই মাসে এখনো হাজিরা বা ওভারটাইম যোগ করা হয়নি।'
            : 'No earned salary or overtime recorded for this month yet.'}
        </div>
      )}
    </section>
  );
};

interface ExpenseCashflowAnalyticsCardProps {
  selectedMonth: string;
  lang: Language;
  expenseCategorySlices: AnalyticsPieSlice[];
  salaryCollectionPct: number;
  savingsProgressPct: number;
  latestPopulatedExpenseMonth?: string | null;
  onSelectMonth?: (monthISO: string) => void;
  dataTestId?: string;
}

export const ExpenseCashflowAnalyticsCard: React.FC<ExpenseCashflowAnalyticsCardProps> = ({
  selectedMonth,
  lang,
  expenseCategorySlices,
  salaryCollectionPct,
  savingsProgressPct,
  latestPopulatedExpenseMonth,
  onSelectMonth,
  dataTestId = 'expense-cashflow-card',
}) => {
  const totalExpenses = expenseCategorySlices.reduce((sum, s) => sum + s.value, 0);

  return (
    <div
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5 sm:space-y-4"
    >
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <PieChartIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
              {lang === 'bn' ? 'খরচ ও বাসা ভাড়ার পাই চার্ট' : 'Expenses & Rent Breakdown'}
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
            {formatMonthLabel(selectedMonth, lang)}
          </span>
        </div>

        {expenseCategorySlices.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-center">
            <div className="sm:col-span-5 relative h-[156px] sm:h-[182px] w-full max-w-[220px] mx-auto sm:max-w-none min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategorySlices}
                    dataKey="value"
                    nameKey={lang === 'bn' ? 'nameBn' : 'nameEn'}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={3}
                    cornerRadius={5}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {expenseCategorySlices.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      formatBDT(Number(value) || 0, lang),
                      String(name || ''),
                    ]}
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                  {formatBDT(totalExpenses, lang)}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'bn' ? 'মোট ব্যয়' : 'Total Spent'}
                </span>
              </div>
            </div>

            <div className="sm:col-span-7 space-y-2">
              {expenseCategorySlices.slice(0, 6).map((cat) => (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-start justify-between text-xs gap-2">
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug break-words">
                        {lang === 'bn' ? cat.nameBn : cat.nameEn}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                      {formatBDT(cat.value, lang)} · {formatNumber(cat.percent, lang)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, Math.min(100, cat.percent))}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6 px-3 text-center space-y-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {lang === 'bn'
                ? `${formatMonthLabel(selectedMonth, 'bn')} মাসে এখনো খরচ যোগ করা হয়নি।`
                : `No expenses recorded in ${formatMonthLabel(selectedMonth, 'en')}.`}
            </p>
            {onSelectMonth &&
              latestPopulatedExpenseMonth &&
              latestPopulatedExpenseMonth !== selectedMonth && (
                <button
                  type="button"
                  onClick={() => onSelectMonth(latestPopulatedExpenseMonth)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {lang === 'bn'
                    ? `${formatMonthLabel(latestPopulatedExpenseMonth, 'bn')} দেখুন`
                    : `View ${formatMonthLabel(latestPopulatedExpenseMonth, 'en')}`}
                </button>
              )}
          </div>
        )}
      </div>

      {/* Salary Collection & Savings Target Progress Meters */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-600 dark:text-slate-400 leading-tight">
              {lang === 'bn' ? 'বেতন আদায়' : 'Pay Collected'}
            </span>
            <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatNumber(salaryCollectionPct, lang)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{ width: `${Math.min(100, salaryCollectionPct)}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-600 dark:text-slate-400 leading-tight">
              {lang === 'bn' ? 'সঞ্চয় লক্ষ্য' : 'Savings Goal'}
            </span>
            <span className="font-extrabold text-indigo-700 dark:text-indigo-400 tabular-nums">
              {formatNumber(savingsProgressPct, lang)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600"
              style={{ width: `${Math.min(100, savingsProgressPct)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface ExpenseRentTrendChartCardProps {
  lang: Language;
  rentTrend: ExpenseRentTrendPoint[];
  dataTestId?: string;
}

export const ExpenseRentTrendChartCard: React.FC<ExpenseRentTrendChartCardProps> = ({
  lang,
  rentTrend,
  dataTestId = 'expense-rent-trend-card',
}) => {
  const formatAxisTick = (val: number) => {
    const formatted = new Intl.NumberFormat('en-IN').format(Math.round(val));
    return lang === 'bn' ? toBengaliDigits(formatted) : formatted;
  };

  return (
    <div
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <BarChart3 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
            {lang === 'bn' ? 'বাসা ভাড়া, বাজার ও আয়ের গ্রাফ' : 'Monthly Rent, Food & Income'}
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[11px] font-bold text-teal-800 dark:text-teal-300 whitespace-nowrap shrink-0">
          {lang === 'bn' ? '৬ মাস' : '6 Months'}
        </span>
      </div>

      <div className="h-[175px] sm:h-[205px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rentTrend} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.22} vertical={false} />
            <XAxis
              dataKey="label"
              interval={0}
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={44}
              tickFormatter={formatAxisTick}
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => [
                formatBDT(Number(value) || 0, lang),
                String(name || ''),
              ]}
              contentStyle={TOOLTIP_STYLE}
              itemStyle={{ color: '#f8fafc' }}
            />
            <Bar
              dataKey="totalIncome"
              name={lang === 'bn' ? 'মোট আয়' : 'Income'}
              fill="#059669"
              radius={[5, 5, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
            <Bar
              dataKey="rentAndBills"
              name={lang === 'bn' ? 'বাসা ভাড়া ও বিল' : 'Rent & Bills'}
              fill="#0D9488"
              radius={[5, 5, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
            <Bar
              dataKey="bazarFood"
              name={lang === 'bn' ? 'বাজার ও খাবার' : 'Food & Bazar'}
              fill="#D97706"
              radius={[5, 5, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
            <Bar
              dataKey="otherExpenses"
              name={lang === 'bn' ? 'অন্যান্য খরচ' : 'Other'}
              fill="#E11D48"
              radius={[5, 5, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
          <span>{lang === 'bn' ? 'মোট আয়' : 'Income'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-teal-600" />
          <span>{lang === 'bn' ? 'বাসা ভাড়া' : 'Rent & Bills'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-amber-600" />
          <span>{lang === 'bn' ? 'বাজার' : 'Food'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
          <span>{lang === 'bn' ? 'অন্যান্য' : 'Other'}</span>
        </span>
      </div>
    </div>
  );
};

interface FactoryComparisonChartsCardProps {
  lang: Language;
  analytics: FactoryComparisonAnalytics;
  dataTestId?: string;
}

export const FactoryComparisonChartsCard: React.FC<FactoryComparisonChartsCardProps> = ({
  lang,
  analytics,
  dataTestId = 'factory-comparison-charts-card',
}) => {
  const [pieTab, setPieTab] = useState<'salary' | 'attendance'>('salary');
  const activeSlices =
    pieTab === 'salary'
      ? analytics.salaryCompositionSlices
      : analytics.attendanceBalanceSlices;
  const activeTotal = activeSlices.reduce((s, item) => s + item.value, 0);

  const barData = analytics.comparisonBars.map((b) => ({
    label: lang === 'bn' ? b.labelBn : b.labelEn,
    currentVal: b.currentVal,
    previousVal: b.previousVal,
  }));

  const formatAxisTick = (val: number) => {
    const formatted = new Intl.NumberFormat('en-IN').format(Math.round(val));
    return lang === 'bn' ? toBengaliDigits(formatted) : formatted;
  };

  return (
    <div
      data-testid={dataTestId}
      className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4"
    >
      {/* Left: Current Factory Pie Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5 sm:space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
              {lang === 'bn' ? 'কারখানার বেতন ও হাজিরা পাই চার্ট' : 'Factory Salary & Attendance Pie'}
            </h3>
          </div>

          <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0">
            <button
              type="button"
              data-testid="factory-pie-tab-salary"
              onClick={() => setPieTab('salary')}
              className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                pieTab === 'salary'
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lang === 'bn' ? 'বেতন কাঠামো' : 'Salary'}
            </button>
            <button
              type="button"
              data-testid="factory-pie-tab-attendance"
              onClick={() => setPieTab('attendance')}
              className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                pieTab === 'attendance'
                  ? 'bg-white dark:bg-slate-900 text-sky-800 dark:text-sky-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lang === 'bn' ? 'হাজিরা ও ছুটি' : 'Attendance'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-center">
          <div className="sm:col-span-5 relative h-[156px] sm:h-[180px] w-full max-w-[220px] mx-auto sm:max-w-none min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activeSlices}
                  dataKey="value"
                  nameKey={lang === 'bn' ? 'nameBn' : 'nameEn'}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={3}
                  cornerRadius={5}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {activeSlices.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    pieTab === 'salary'
                      ? formatBDT(Number(value) || 0, lang)
                      : `${formatNumber(Number(value) || 0, lang)} ${lang === 'bn' ? 'দিন' : 'd'}`,
                    String(name || ''),
                  ]}
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                {pieTab === 'salary'
                  ? formatBDT(activeTotal, lang)
                  : `${formatNumber(analytics.attendanceRateCurrentPct, lang)}%`}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {pieTab === 'salary'
                  ? lang === 'bn'
                    ? 'মোট বেতন'
                    : 'Total Pay'
                  : lang === 'bn'
                  ? 'হাজিরা হার'
                  : 'Att. Rate'}
              </span>
            </div>
          </div>

          <div className="sm:col-span-7 space-y-2">
            {activeSlices.map((slice) => (
              <div key={slice.key} className="space-y-1">
                <div className="flex items-start justify-between text-xs gap-2">
                  <div className="flex items-start gap-1.5 min-w-0 flex-1">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug break-words">
                      {lang === 'bn' ? slice.nameBn : slice.nameEn}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                    {pieTab === 'salary'
                      ? formatBDT(slice.value, lang)
                      : `${formatNumber(slice.value, lang)} ${lang === 'bn' ? 'দিন' : 'd'}`}{' '}
                    · {formatNumber(slice.percent, lang)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, Math.min(100, slice.percent))}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Previous vs Current Factory Comparison Graph */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
              {lang === 'bn'
                ? 'আগের কারখানা বনাম বর্তমান কারখানা'
                : 'Previous vs Current Factory'}
            </h3>
          </div>

          <span
            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold tabular-nums whitespace-nowrap shrink-0 ${
              analytics.grossDeltaAmount >= 0
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
            }`}
          >
            {analytics.grossDeltaAmount >= 0 ? '+' : '-'}
            {formatBDT(Math.abs(analytics.grossDeltaAmount), lang)} (
            {analytics.grossGrowthPct >= 0 ? '+' : ''}
            {formatNumber(analytics.grossGrowthPct, lang)}%)
          </span>
        </div>

        <div className="h-[172px] sm:h-[185px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.22} vertical={false} />
              <XAxis
                dataKey="label"
                interval={0}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={44}
                tickFormatter={formatAxisTick}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatBDT(Number(value) || 0, lang),
                  String(name || ''),
                ]}
                contentStyle={TOOLTIP_STYLE}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Bar
                dataKey="previousVal"
                name={analytics.previousFactoryName}
                fill="#94A3B8"
                radius={[6, 6, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
              <Bar
                dataKey="currentVal"
                name={analytics.currentFactoryName}
                fill="#059669"
                radius={[6, 6, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 shrink-0" />
              <span className="leading-tight break-words">{analytics.previousFactoryName}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 shrink-0" />
              <span className="leading-tight break-words">{analytics.currentFactoryName}</span>
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
            {lang === 'bn'
              ? `হাজিরা: ${formatNumber(analytics.attendanceRateCurrentPct, 'bn')}% বনাম ${formatNumber(analytics.attendanceRatePreviousPct, 'bn')}%`
              : `Att: ${analytics.attendanceRateCurrentPct}% vs ${analytics.attendanceRatePreviousPct}%`}
          </span>
        </div>
      </div>
    </div>
  );
};

interface LoanPortfolioChartsCardProps {
  lang: Language;
  portfolio: LoanPortfolioAnalytics;
  dataTestId?: string;
}

export const LoanPortfolioChartsCard: React.FC<LoanPortfolioChartsCardProps> = ({
  lang,
  portfolio,
  dataTestId = 'loan-portfolio-charts-card',
}) => {
  const formatAxisTick = (val: number) => {
    const formatted = new Intl.NumberFormat('en-IN').format(Math.round(val));
    return lang === 'bn' ? toBengaliDigits(formatted) : formatted;
  };

  const hasPieData = portfolio.portfolioPieSlices.length > 0;
  const hasBarData = portfolio.personComparisonBars.length > 0;

  return (
    <div
      data-testid={dataTestId}
      className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4"
    >
      {/* Left: Loan Portfolio Donut Pie Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5 sm:space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <HandCoins className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
              {lang === 'bn' ? 'ধার-দেনা বণ্টন পাই চার্ট' : 'Loans & Debt Breakdown'}
            </h3>
          </div>
          <span
            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold tabular-nums whitespace-nowrap shrink-0 ${
              portfolio.netPosition >= 0
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
            }`}
          >
            {lang === 'bn' ? 'নিট:' : 'Net:'}{' '}
            {portfolio.netPosition >= 0 ? '+' : '-'}
            {formatBDT(Math.abs(portfolio.netPosition), lang)}
          </span>
        </div>

        {hasPieData ? (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-center">
            <div className="sm:col-span-5 relative h-[156px] sm:h-[180px] w-full max-w-[220px] mx-auto sm:max-w-none min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolio.portfolioPieSlices}
                    dataKey="value"
                    nameKey={lang === 'bn' ? 'nameBn' : 'nameEn'}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={3}
                    cornerRadius={5}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {portfolio.portfolioPieSlices.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      formatBDT(Number(value) || 0, lang),
                      String(name || ''),
                    ]}
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                <span
                  className={`text-xs sm:text-sm font-black tabular-nums leading-tight ${
                    portfolio.netPosition >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {portfolio.netPosition >= 0 ? '+' : '-'}
                  {formatBDT(Math.abs(portfolio.netPosition), lang)}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'bn' ? 'নিট স্থিতি' : 'Net Balance'}
                </span>
              </div>
            </div>

            <div className="sm:col-span-7 space-y-2">
              {portfolio.portfolioPieSlices.map((slice) => (
                <div key={slice.key} className="space-y-1">
                  <div className="flex items-start justify-between text-xs gap-2">
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 leading-snug break-words">
                        {lang === 'bn' ? slice.nameBn : slice.nameEn}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                      {formatBDT(slice.value, lang)} · {formatNumber(slice.percent, lang)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, Math.min(100, slice.percent))}%`,
                        backgroundColor: slice.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'ধার বা পাওনা লেনদেন যোগ করলে এখানে পাই চার্ট দেখাবে।'
              : 'Add loan entries to see the portfolio breakdown.'}
          </div>
        )}
      </div>

      {/* Right: Person-wise Loan Grouped Bar Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
              {lang === 'bn'
                ? 'ব্যক্তিভিত্তিক আসল, পরিশোধ ও বকেয়া'
                : 'Person-wise Principal, Repaid & Due'}
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            {lang === 'bn'
              ? `${formatNumber(portfolio.personComparisonBars.length, 'bn')} জন`
              : `${portfolio.personComparisonBars.length} entries`}
          </span>
        </div>

        {hasBarData ? (
          <>
            <div className="h-[172px] sm:h-[185px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={portfolio.personComparisonBars}
                  margin={{ top: 8, right: 6, left: -8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#94a3b8"
                    strokeOpacity={0.22}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    width={44}
                    tickFormatter={formatAxisTick}
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatBDT(Number(value) || 0, lang),
                      String(name || ''),
                    ]}
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Bar
                    dataKey="principal"
                    name={lang === 'bn' ? 'মূল টাকা' : 'Principal'}
                    fill="#4F46E5"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={18}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="repaid"
                    name={lang === 'bn' ? 'পরিশোধ/আদায়' : 'Repaid'}
                    fill="#059669"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={18}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="remaining"
                    name={lang === 'bn' ? 'বাকি বকেয়া' : 'Remaining'}
                    fill="#E11D48"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={18}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
                <span>{lang === 'bn' ? 'মূল টাকা' : 'Principal'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                <span>{lang === 'bn' ? 'পরিশোধ/আদায়' : 'Repaid'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
                <span>{lang === 'bn' ? 'বাকি বকেয়া' : 'Remaining'}</span>
              </span>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'ব্যক্তিভিত্তিক তুলনা দেখতে ধার বা পাওনা এন্ট্রি যোগ করুন।'
              : 'Add entries to view person-wise loan graph.'}
          </div>
        )}
      </div>
    </div>
  );
};

interface OvertimeAnalyticsPieCardProps {
  selectedMonth: string;
  lang: Language;
  analytics: OvertimePieAnalytics;
  onSelectMonth?: (monthISO: string) => void;
  dataTestId?: string;
}

export const OvertimeAnalyticsPieCard: React.FC<OvertimeAnalyticsPieCardProps> = ({
  selectedMonth,
  lang,
  analytics,
  onSelectMonth,
  dataTestId = 'overtime-pie-card',
}) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');

  const isMonthly = viewMode === 'monthly';
  const activeSlices = isMonthly ? analytics.monthlySlices : analytics.weeklySlices;
  const usesHoursFallback = isMonthly
    ? analytics.monthlyUsesHoursFallback
    : analytics.weeklyUsesHoursFallback;
  const totalHours = isMonthly ? analytics.sixMonthHours : analytics.selectedMonthHours;
  const totalEarnings = isMonthly
    ? analytics.sixMonthEarnings
    : analytics.selectedMonthEarnings;
  const totalDays = isMonthly ? analytics.sixMonthDays : analytics.selectedMonthDays;

  return (
    <section
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 space-y-3.5 sm:space-y-4"
    >
      {/* Clean Header + Monthly/Weekly Segmented Pill Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
              {lang === 'bn' ? 'ওভারটাইম অ্যানালিটিক্স (পাই চার্ট)' : 'Overtime Analytics (Pie Chart)'}
            </h3>
          </div>
          <span className="sm:hidden px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap shrink-0">
            {isMonthly
              ? lang === 'bn'
                ? `গত ৬ মাস · ${formatNumber(totalDays, 'bn')} দিন`
                : `Last 6 Mo · ${totalDays} d`
              : lang === 'bn'
              ? `${formatMonthLabel(selectedMonth, 'bn')} · ${formatNumber(totalDays, 'bn')} দিন`
              : `${formatMonthLabel(selectedMonth, 'en')} · ${totalDays} d`}
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <span className="hidden sm:inline-block px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
            {isMonthly
              ? lang === 'bn'
                ? `গত ৬ মাস · ${formatNumber(totalDays, 'bn')} দিন`
                : `Last 6 Mo · ${totalDays} d`
              : lang === 'bn'
              ? `${formatMonthLabel(selectedMonth, 'bn')} · ${formatNumber(totalDays, 'bn')} দিন`
              : `${formatMonthLabel(selectedMonth, 'en')} · ${totalDays} d`}
          </span>

          <div
            role="tablist"
            aria-label={lang === 'bn' ? 'ওভারটাইম চার্টের ধরন' : 'Overtime chart view'}
            className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isMonthly}
              data-testid="ot-pie-mode-monthly"
              onClick={() => setViewMode('monthly')}
              className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                isMonthly
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {lang === 'bn' ? 'মাসভিত্তিক' : 'Monthly'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isMonthly}
              data-testid="ot-pie-mode-weekly"
              onClick={() => setViewMode('weekly')}
              className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                !isMonthly
                  ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {lang === 'bn' ? 'সপ্তাহভিত্তিক' : 'Weekly'}
            </button>
          </div>
        </div>
      </div>

      {activeSlices.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-center">
          {/* Left: Clean Donut Pie */}
          <div className="sm:col-span-5 relative h-[158px] sm:h-[186px] w-full max-w-[220px] mx-auto sm:max-w-none min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activeSlices}
                  dataKey="value"
                  nameKey={lang === 'bn' ? 'nameBn' : 'nameEn'}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {activeSlices.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    usesHoursFallback
                      ? `${formatNumber(Number(value) || 0, lang, 1)} ${lang === 'bn' ? 'ঘণ্টা' : 'hrs'}`
                      : formatBDT(Number(value) || 0, lang),
                    String(name || ''),
                  ]}
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                {usesHoursFallback
                  ? `${formatNumber(totalHours, lang, 1)} ${lang === 'bn' ? 'ঘঃ' : 'h'}`
                  : formatBDT(totalEarnings, lang)}
              </span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                {formatNumber(totalHours, lang, 1)} {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
              </span>
            </div>
          </div>

          {/* Right: Crisp Scannable Legend Bars */}
          <div className="sm:col-span-7 space-y-2.5">
            {activeSlices.map((slice) => {
              const sub = lang === 'bn' ? slice.subLabelBn : slice.subLabelEn;
              return (
                <div key={slice.key} className="space-y-1">
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                        style={{ backgroundColor: slice.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 leading-snug break-words block">
                          {lang === 'bn' ? slice.nameBn : slice.nameEn}
                        </span>
                        {sub && (
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-snug break-words block tabular-nums mt-0.5">
                            {sub}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {usesHoursFallback
                          ? `${formatNumber(slice.value, lang, 1)} ${lang === 'bn' ? 'ঘঃ' : 'h'}`
                          : formatBDT(slice.value, lang)}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-9 text-right">
                        {formatNumber(slice.percent, lang)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, Math.min(100, slice.percent))}%`,
                        backgroundColor: slice.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-6 px-3 text-center space-y-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {isMonthly
              ? lang === 'bn'
                ? 'গত ৬ মাসে এখনো কোনো ওভারটাইম রেকর্ড পাওয়া যায়নি।'
                : 'No overtime records found in the last 6 months.'
              : lang === 'bn'
              ? `${formatMonthLabel(selectedMonth, 'bn')} মাসে এখনো ওভারটাইম রেকর্ড নেই।`
              : `No overtime recorded for ${formatMonthLabel(selectedMonth, 'en')}.`}
          </p>
          {onSelectMonth &&
            analytics.latestPopulatedOtMonth &&
            analytics.latestPopulatedOtMonth !== selectedMonth && (
              <button
                type="button"
                data-testid="ot-pie-jump-month-btn"
                onClick={() => onSelectMonth(analytics.latestPopulatedOtMonth!)}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                {lang === 'bn'
                  ? `${formatMonthLabel(analytics.latestPopulatedOtMonth, 'bn')} দেখুন`
                  : `View ${formatMonthLabel(analytics.latestPopulatedOtMonth, 'en')}`}
              </button>
            )}
        </div>
      )}
    </section>
  );
};

interface RecentActivityPieChartCardProps {
  selectedMonth: string;
  lang: Language;
  analytics: RecentActivityPieAnalytics;
  onSelectMonth?: (monthISO: string) => void;
  onAddOvertimeClick?: () => void;
  onAddExpenseClick?: () => void;
  dataTestId?: string;
}

export const RecentActivityPieChartCard: React.FC<RecentActivityPieChartCardProps> = ({
  selectedMonth,
  lang,
  analytics,
  onSelectMonth,
  onAddOvertimeClick,
  onAddExpenseClick,
  dataTestId = 'home-recent-activity-pie-card',
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'expenses'>('all');
  const [clickedSliceIndex, setClickedSliceIndex] = useState<number | null>(null);
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);
  const {
    slices,
    expenseSlices,
    totalTransactionsCount,
    totalVolumeAmount,
    paymentTotal,
    overtimeTotal,
    expenseTotal,
    expenseCount,
    netBalance,
  } = analytics;

  const isExpensesOnly = filterMode === 'expenses' && expenseSlices.length > 0;
  const activeSlices = isExpensesOnly ? expenseSlices : slices;
  const activeCenterTotal = isExpensesOnly ? expenseTotal : totalVolumeAmount;
  const activeCount = isExpensesOnly ? expenseCount : totalTransactionsCount;

  const effectiveSliceIndex =
    hoveredSliceIndex !== null ? hoveredSliceIndex : clickedSliceIndex;
  const selectedSlice =
    effectiveSliceIndex !== null && activeSlices[effectiveSliceIndex]
      ? activeSlices[effectiveSliceIndex]
      : null;

  return (
    <div
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 space-y-3.5 sm:space-y-4"
    >
      {/* Clean Header:
          Line 1: সাম্প্রতিক হিসাব ও লেনদেন (without 'পাই চার্ট')
          Line 2: ৮টি খাত · ৪টি এন্ট্রি on a single line
          Followed by: সব হিসাব | খরচ খাতসমূহ toggle */}
      <div className="space-y-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shrink-0">
              <PieChartIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                {lang === 'bn'
                  ? 'সাম্প্রতিক হিসাব ও লেনদেন'
                  : 'Recent Activity & Transactions'}
              </h3>
              <p
                data-testid="recent-pie-summary-count"
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap mt-0.5"
              >
                {lang === 'bn'
                  ? `${formatNumber(activeSlices.length, 'bn')}টি খাত · ${formatNumber(activeCount, 'bn')}টি এন্ট্রি`
                  : `${activeSlices.length} categories · ${activeCount} entries`}
              </p>
            </div>
          </div>

          {slices.length > 0 && (
            <div
              role="tablist"
              aria-label={lang === 'bn' ? 'হিসাবের ধরন' : 'Transaction filter'}
              className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isExpensesOnly}
                data-testid="recent-pie-mode-all"
                onClick={() => {
                  setFilterMode('all');
                  setClickedSliceIndex(null);
                  setHoveredSliceIndex(null);
                }}
                className={`min-h-[30px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  !isExpensesOnly
                    ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {lang === 'bn' ? 'সব হিসাব' : 'All Items'}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isExpensesOnly}
                data-testid="recent-pie-mode-expenses"
                disabled={expenseSlices.length === 0}
                onClick={() => {
                  if (expenseSlices.length > 0) {
                    setFilterMode('expenses');
                    setClickedSliceIndex(null);
                    setHoveredSliceIndex(null);
                  }
                }}
                className={`min-h-[30px] px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  expenseSlices.length === 0
                    ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    : isExpensesOnly
                    ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs cursor-pointer'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer'
                }`}
              >
                {lang === 'bn' ? 'খরচ খাতসমূহ' : 'Expenses Only'}
              </button>
            </div>
          )}
        </div>
      </div>

      {activeSlices.length > 0 ? (
        <>
          {/* Centered Donut Pie Chart — Click/Tap or Hover on any colored slice to view details */}
          <div className="relative flex flex-col items-center [&_svg]:outline-none [&_svg]:focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-sector]:outline-none [&_path]:outline-none">
            <div className="relative h-[200px] sm:h-[220px] w-full max-w-[260px] mx-auto min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart style={{ outline: 'none' }}>
                  <Pie
                    data={activeSlices}
                    dataKey="value"
                    nameKey={lang === 'bn' ? 'nameBn' : 'nameEn'}
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={84}
                    paddingAngle={2.5}
                    cornerRadius={6}
                    stroke="none"
                    isAnimationActive={false}
                    onMouseEnter={(_, index) => setHoveredSliceIndex(index)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                    onClick={(_, index) =>
                      setClickedSliceIndex((prev) => (prev === index ? null : index))
                    }
                  >
                    {activeSlices.map((slice, idx) => (
                      <Cell
                        key={slice.key}
                        fill={slice.color}
                        stroke={effectiveSliceIndex === idx ? '#ffffff' : 'none'}
                        strokeWidth={effectiveSliceIndex === idx ? 2.5 : 0}
                        style={{ outline: 'none' }}
                        className="cursor-pointer focus:outline-none"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                  {formatBDT(activeCenterTotal, lang)}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {isExpensesOnly
                    ? lang === 'bn'
                      ? 'মোট খরচ'
                      : 'Total Expense'
                    : lang === 'bn'
                    ? 'মোট লেনদেন'
                    : 'Total Volume'}
                </span>
              </div>

              {/* Floating Slice Details Tooltip when clicking/tapping or hovering a color on the Pie Chart */}
              {selectedSlice && (
                <div
                  data-testid="recent-pie-selected-tooltip"
                  style={TOOLTIP_STYLE}
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-xl shadow-lg border border-slate-700/90 pointer-events-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: selectedSlice.color }}
                    />
                    <span className="font-extrabold text-white">
                      {lang === 'bn' ? selectedSlice.nameBn : selectedSlice.nameEn}
                    </span>
                    <span className="font-bold text-emerald-300 tabular-nums">
                      {formatBDT(selectedSlice.value, lang)} ({formatNumber(selectedSlice.percent, lang)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
            <div>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block leading-tight">
                {lang === 'bn' ? 'প্রাপ্ত ও ওটি আয়' : 'Inflow & OT'}
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                + {formatBDT(paymentTotal + overtimeTotal, lang)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block leading-tight">
                {lang === 'bn' ? 'মোট খরচ' : 'Total Outflow'}
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                - {formatBDT(expenseTotal, lang)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block leading-tight">
                {lang === 'bn' ? 'নিট ব্যালেন্স' : 'Net Balance'}
              </span>
              <span
                className={`font-bold tabular-nums ${
                  netBalance >= 0
                    ? 'text-slate-900 dark:text-white'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatBDT(netBalance, lang)}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="py-6 px-3 text-center space-y-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {lang === 'bn'
              ? `${formatMonthLabel(selectedMonth, 'bn')} মাসে এখনো কোনো হিসাব বা লেনদেন যোগ করা হয়নি।`
              : `No recent transactions recorded in ${formatMonthLabel(selectedMonth, 'en')}.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onAddOvertimeClick && (
              <button
                type="button"
                onClick={onAddOvertimeClick}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                {lang === 'bn' ? 'ওভারটাইম যোগ করুন' : 'Add Overtime'}
              </button>
            )}
            {onAddExpenseClick && (
              <button
                type="button"
                onClick={onAddExpenseClick}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {lang === 'bn' ? 'খরচ যোগ করুন' : 'Add Expense'}
              </button>
            )}
            {onSelectMonth &&
              analytics.latestPopulatedActivityMonth &&
              analytics.latestPopulatedActivityMonth !== selectedMonth && (
                <button
                  type="button"
                  onClick={() => onSelectMonth(analytics.latestPopulatedActivityMonth!)}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                >
                  {lang === 'bn'
                    ? `${formatMonthLabel(analytics.latestPopulatedActivityMonth, 'bn')} দেখুন`
                    : `View ${formatMonthLabel(analytics.latestPopulatedActivityMonth, 'en')}`}
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
