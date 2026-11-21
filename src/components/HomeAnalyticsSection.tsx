import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarCheck2,
  Clock,
  Eye,
  EyeOff,
  PiggyBank,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type {
  AnonymousGradeAreaBenchmark,
  AttendanceRecord,
  ExpenseRecord,
  GarmentWorkplace,
  Language,
  MoreSubView,
  NavTab,
  OvertimeRecord,
  PersonalLoan,
  SalaryPayment,
  SalaryRecord,
  SavingsGoal,
  WorkerProfile,
} from '../types';
import { formatBDT, formatNumber, getSalaryStructure, toBengaliDigits } from '../utils/calculations';
import { buildAnonymousComparisonData } from '../utils/featureHelpers';
import { formatMonthLabel } from '../utils/i18n';
import {
  buildExpenseRentTrend,
  buildFactoryComparisonAnalytics,
  buildHomeOverviewAnalytics,
  buildLoanPortfolioAnalytics,
  buildOvertimePieAnalytics,
} from '../utils/homeAnalytics';
import {
  AttendancePieChartCard,
  ExpenseCashflowAnalyticsCard,
  ExpenseRentTrendChartCard,
  FactoryComparisonChartsCard,
  LoanPortfolioChartsCard,
  OvertimeAnalyticsPieCard,
  SalaryMixPieChartCard,
} from './AnalyticsChartCards';

export type HomeAnalyticsZone =
  | 'salary_overview'
  | 'factory_comparison'
  | 'attendance_overtime'
  | 'expense_loans';

interface HomeAnalyticsSectionProps {
  zone?: HomeAnalyticsZone;
  selectedMonth: string;
  lang: Language;
  profile: WorkerProfile;
  attendance: AttendanceRecord[];
  overtime: OvertimeRecord[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
  expenses: ExpenseRecord[];
  savings: SavingsGoal[];
  loans: PersonalLoan[];
  workplaces?: GarmentWorkplace[];
  anonymousBenchmark?: AnonymousGradeAreaBenchmark | null;
  todayISO?: string;
  isReadOnlyDemo?: boolean;
  onSeedSampleData?: () => void;
  onSelectMonth: (monthISO: string) => void;
  onNavigateTab: (tab: NavTab, sub?: MoreSubView) => void;
}

type TrendChartMode = 'salary_vs_expense' | 'overtime_trend';

export type HomeChartWidgetId =
  | 'salary_pie'
  | 'trend'
  | 'factory_comparison'
  | 'attendance_pie'
  | 'overtime_pie'
  | 'expense_cashflow'
  | 'expense_rent_graph'
  | 'loan_portfolio';

interface HomeChartLayoutItem {
  id: HomeChartWidgetId;
  visible: boolean;
}

const HOME_CHART_STORAGE_KEY = 'shromik_sathi_home_chart_layout_v3';
const HOME_CHART_SYNC_EVENT = 'shromik-home-chart-layout-sync';

const CHART_META: Record<
  HomeChartWidgetId,
  {
    labelBn: string;
    labelEn: string;
    positionHintBn: string;
    positionHintEn: string;
    span: 'half' | 'full';
    defaultZone: HomeAnalyticsZone;
  }
> = {
  factory_comparison: {
    labelBn: 'কারখানা ও বেতন তুলনা (পাই ও গ্রাফ)',
    labelEn: 'Factory Comparison Pie & Graph',
    positionHintBn: 'গার্মেন্টস ও বেতন অ্যানালিটিক্স সেকশনে',
    positionHintEn: 'In Garment & Salary Analytics Section',
    span: 'full',
    defaultZone: 'salary_overview',
  },
  salary_pie: {
    labelBn: 'বেতন, ভাতা ও ওভারটাইম (পাই চার্ট)',
    labelEn: 'Salary & Earnings Pie',
    positionHintBn: 'বেতন ও আর্থিক অ্যানালিটিক্স সেকশনে',
    positionHintEn: 'In Salary Analytics Section',
    span: 'half',
    defaultZone: 'salary_overview',
  },
  expense_cashflow: {
    labelBn: 'খরচ ও বাসা ভাড়ার পাই চার্ট',
    labelEn: 'Expenses & Rent Pie',
    positionHintBn: 'বেতন ও আর্থিক অ্যানালিটিক্স সেকশনে',
    positionHintEn: 'In Salary Analytics Section',
    span: 'half',
    defaultZone: 'salary_overview',
  },
  attendance_pie: {
    labelBn: 'উপস্থিতি, ছুটি ও অনুপস্থিতি (পাই চার্ট)',
    labelEn: 'Attendance & Holiday Pie',
    positionHintBn: 'হাজিরা ক্যালেন্ডারের নিচে',
    positionHintEn: 'Below Attendance Calendar',
    span: 'half',
    defaultZone: 'attendance_overtime',
  },
  overtime_pie: {
    labelBn: 'ওভারটাইম অ্যানালিটিক্স (পাই চার্ট)',
    labelEn: 'Overtime Analytics Pie',
    positionHintBn: 'হাজিরা ক্যালেন্ডারের নিচে',
    positionHintEn: 'Below Attendance Calendar',
    span: 'half',
    defaultZone: 'attendance_overtime',
  },
  trend: {
    labelBn: '৬ মাসের বেতন, ওটি ও খরচের গ্রাফ',
    labelEn: '6-Month Salary & OT Graph',
    positionHintBn: 'নিচের আর্থিক ট্রেন্ড ও ঋণ সেকশনে',
    positionHintEn: 'In Lower Trend & Loans Section',
    span: 'half',
    defaultZone: 'expense_loans',
  },
  expense_rent_graph: {
    labelBn: 'বাসা ভাড়া, বাজার ও আয়ের গ্রাফ',
    labelEn: 'Monthly Rent & Food Graph',
    positionHintBn: 'নিচের আর্থিক ট্রেন্ড ও ঋণ সেকশনে',
    positionHintEn: 'In Lower Trend & Loans Section',
    span: 'half',
    defaultZone: 'expense_loans',
  },
  loan_portfolio: {
    labelBn: 'ধার-দেনা ও ঋণের পাই চার্ট এবং গ্রাফ',
    labelEn: 'Personal Loans Pie & Graph',
    positionHintBn: 'নিচের আর্থিক ট্রেন্ড ও ঋণ সেকশনে',
    positionHintEn: 'In Lower Trend & Loans Section',
    span: 'full',
    defaultZone: 'expense_loans',
  },
};

const DEFAULT_HOME_CHART_LAYOUT: HomeChartLayoutItem[] = [
  { id: 'factory_comparison', visible: true },
  { id: 'salary_pie', visible: true },
  { id: 'expense_cashflow', visible: true },
  { id: 'attendance_pie', visible: true },
  { id: 'overtime_pie', visible: true },
  { id: 'trend', visible: true },
  { id: 'expense_rent_graph', visible: true },
  { id: 'loan_portfolio', visible: true },
];

function loadHomeChartLayout(): HomeChartLayoutItem[] {
  if (typeof window === 'undefined') return DEFAULT_HOME_CHART_LAYOUT;
  try {
    const raw = window.localStorage.getItem(HOME_CHART_STORAGE_KEY);
    if (!raw) return DEFAULT_HOME_CHART_LAYOUT;
    const parsed = JSON.parse(raw) as HomeChartLayoutItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_HOME_CHART_LAYOUT;
    const validIds = new Set<HomeChartWidgetId>(Object.keys(CHART_META) as HomeChartWidgetId[]);
    const seen = new Set<HomeChartWidgetId>();
    const cleaned: HomeChartLayoutItem[] = [];
    for (const item of parsed) {
      if (item && validIds.has(item.id) && !seen.has(item.id)) {
        seen.add(item.id);
        cleaned.push({ id: item.id, visible: item.visible !== false });
      }
    }
    for (const def of DEFAULT_HOME_CHART_LAYOUT) {
      if (!seen.has(def.id)) {
        cleaned.push(def);
      }
    }
    return cleaned;
  } catch {
    return DEFAULT_HOME_CHART_LAYOUT;
  }
}

function isDefaultZoneOrder(layout: HomeChartLayoutItem[]): boolean {
  if (layout.length !== DEFAULT_HOME_CHART_LAYOUT.length) return false;
  return layout.every((item, index) => item.id === DEFAULT_HOME_CHART_LAYOUT[index].id);
}

const HomeAnalyticsSectionImpl: React.FC<HomeAnalyticsSectionProps> = ({
  zone = 'salary_overview',
  selectedMonth,
  lang,
  profile,
  attendance,
  overtime,
  salaryRecords,
  payments,
  expenses,
  savings,
  loans,
  workplaces = [],
  anonymousBenchmark = null,
  todayISO,
  isReadOnlyDemo = false,
  onSeedSampleData,
  onSelectMonth,
  onNavigateTab,
}) => {
  const [trendMode, setTrendMode] = useState<TrendChartMode>('salary_vs_expense');
  const [chartLayout, setChartLayout] = useState<HomeChartLayoutItem[]>(() =>
    loadHomeChartLayout()
  );
  const [isCustomizingCharts, setIsCustomizingCharts] = useState(false);

  useEffect(() => {
    const handleSync = () => {
      setChartLayout(loadHomeChartLayout());
    };
    window.addEventListener(HOME_CHART_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(HOME_CHART_SYNC_EVENT, handleSync);
  }, []);

  const persistAndBroadcastLayout = (
    updater: (prev: HomeChartLayoutItem[]) => HomeChartLayoutItem[]
  ) => {
    setChartLayout((prev) => {
      const next = updater(prev);
      try {
        window.localStorage.setItem(HOME_CHART_STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(HOME_CHART_SYNC_EVENT));
      } catch {
        // Ignore storage quota issues
      }
      return next;
    });
  };

  const effectiveTodayISO = todayISO || `${selectedMonth}-15`;
  const usingContextualPositions = isDefaultZoneOrder(chartLayout);

  const zoneItems = useMemo(() => {
    if (!usingContextualPositions) {
      return zone === 'salary_overview' ? chartLayout.filter((item) => item.visible) : [];
    }
    return chartLayout.filter(
      (item) => item.visible && CHART_META[item.id].defaultZone === zone
    );
  }, [usingContextualPositions, zone, chartLayout]);

  const activeWidgetIds = useMemo(
    () => new Set(zoneItems.map((item) => item.id)),
    [zoneItems]
  );

  const analytics = useMemo(
    () =>
      buildHomeOverviewAnalytics({
        selectedMonth,
        lang,
        profile,
        attendance,
        overtime,
        salaryRecords,
        payments,
        expenses,
        savings,
        loans,
      }),
    [
      selectedMonth,
      lang,
      profile,
      attendance,
      overtime,
      salaryRecords,
      payments,
      expenses,
      savings,
      loans,
    ]
  );

  const needsOvertimePie = activeWidgetIds.has('overtime_pie');
  const overtimePieAnalytics = useMemo(
    () =>
      needsOvertimePie
        ? buildOvertimePieAnalytics({
            selectedMonth,
            lang,
            overtime,
          })
        : null,
    [needsOvertimePie, selectedMonth, lang, overtime]
  );

  const needsRentTrend = activeWidgetIds.has('expense_rent_graph');
  const rentTrend = useMemo(
    () =>
      needsRentTrend
        ? buildExpenseRentTrend({
            selectedMonth,
            lang,
            expenses,
            payments,
          })
        : [],
    [needsRentTrend, selectedMonth, lang, expenses, payments]
  );

  const needsLoanPortfolio = activeWidgetIds.has('loan_portfolio');
  const loanPortfolio = useMemo(
    () =>
      needsLoanPortfolio
        ? buildLoanPortfolioAnalytics(loans, effectiveTodayISO)
        : null,
    [needsLoanPortfolio, loans, effectiveTodayISO]
  );

  const needsFactoryComparison = activeWidgetIds.has('factory_comparison');
  const factoryAnalytics = useMemo(
    () =>
      needsFactoryComparison
        ? buildFactoryComparisonAnalytics({
            profile,
            workplaces,
            salaryRecords,
            payments,
            overtime,
            attendance,
            todayISO: effectiveTodayISO,
          })
        : null,
    [
      needsFactoryComparison,
      profile,
      workplaces,
      salaryRecords,
      payments,
      overtime,
      attendance,
      effectiveTodayISO,
    ]
  );

  const anonymousComparison = useMemo(
    () =>
      buildAnonymousComparisonData({
        benchmark: anonymousBenchmark,
        userGross: getSalaryStructure(profile).grossSalary,
        userMonthlyOtHours: analytics.kpis.otHours,
        userAttendanceBonus:
          profile.hasAttendanceBonus !== false ? Number(profile.attendanceBonus) || 0 : 0,
      }),
    [anonymousBenchmark, profile, analytics.kpis.otHours]
  );

  const { kpis, monthlyTrend } = analytics;

  const moveChartOrder = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= chartLayout.length) return;
    persistAndBroadcastLayout((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const toggleChartVisibility = (id: HomeChartWidgetId) => {
    persistAndBroadcastLayout((prev) =>
      prev.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item))
    );
  };

  const resetChartLayout = () => {
    persistAndBroadcastLayout(() => DEFAULT_HOME_CHART_LAYOUT);
  };

  const formatAxisTick = (val: number) => {
    const formatted = new Intl.NumberFormat('en-IN').format(Math.round(val));
    return lang === 'bn' ? toBengaliDigits(formatted) : formatted;
  };

  const tooltipStyle = {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#f8fafc',
  };

  const renderChartWidget = (id: HomeChartWidgetId) => {
    const spanClass = CHART_META[id].span === 'full' ? 'lg:col-span-2' : 'lg:col-span-1';

    if (id === 'attendance_pie') {
      return (
        <div key={id} className={spanClass}>
          <AttendancePieChartCard
            selectedMonth={selectedMonth}
            lang={lang}
            slices={analytics.attendanceSlices}
            totalTrackedDays={kpis.totalTrackedDays}
            attendanceRatePct={kpis.attendanceRatePct}
            latestPopulatedAttendanceMonth={analytics.latestPopulatedAttendanceMonth}
            onSelectMonth={onSelectMonth}
            onActionClick={() => onNavigateTab('attendance')}
            dataTestId="home-attendance-pie-card"
          />
        </div>
      );
    }

    if (id === 'overtime_pie') {
      if (!overtimePieAnalytics) return null;
      return (
        <div key={id} className={spanClass}>
          <OvertimeAnalyticsPieCard
            selectedMonth={selectedMonth}
            lang={lang}
            analytics={overtimePieAnalytics}
            onSelectMonth={onSelectMonth}
            dataTestId="home-overtime-pie-card"
          />
        </div>
      );
    }

    if (id === 'salary_pie') {
      return (
        <div key={id} className={spanClass}>
          <SalaryMixPieChartCard
            lang={lang}
            slices={analytics.salarySlices}
            dataTestId="home-salary-pie-card"
          />
        </div>
      );
    }

    if (id === 'trend') {
      return (
        <div key={id} className={spanClass}>
          <div
            data-testid="home-trend-graph-card"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5 h-full"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <BarChart3 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug break-words">
                  {lang === 'bn'
                    ? '৬ মাসের বেতন, ওটি ও খরচের গ্রাফ'
                    : '6-Month Financial Trend'}
                </h3>
              </div>

              <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  data-testid="trend-mode-salary-expense-btn"
                  onClick={() => setTrendMode('salary_vs_expense')}
                  className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    trendMode === 'salary_vs_expense'
                      ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {lang === 'bn' ? 'বেতন ও খরচ' : 'Salary & Expense'}
                </button>
                <button
                  type="button"
                  data-testid="trend-mode-overtime-btn"
                  onClick={() => setTrendMode('overtime_trend')}
                  className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    trendMode === 'overtime_trend'
                      ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {lang === 'bn' ? 'ওভারটাইম আয়' : 'Overtime Trend'}
                </button>
              </div>
            </div>

            <div className="h-[175px] sm:h-[205px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                {trendMode === 'salary_vs_expense' ? (
                  <BarChart data={monthlyTrend} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#94a3b8"
                      strokeOpacity={0.22}
                      vertical={false}
                    />
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
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                    <Bar
                      dataKey="earnedSalary"
                      name={lang === 'bn' ? 'অর্জিত বেতন' : 'Earned Salary'}
                      fill="#059669"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={20}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="receivedSalary"
                      name={lang === 'bn' ? 'প্রাপ্ত বেতন' : 'Received'}
                      fill="#2563EB"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={20}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="expenses"
                      name={lang === 'bn' ? 'মোট খরচ' : 'Expenses'}
                      fill="#E11D48"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={20}
                      isAnimationActive={false}
                    />
                  </BarChart>
                ) : (
                  <BarChart data={monthlyTrend} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#94a3b8"
                      strokeOpacity={0.22}
                      vertical={false}
                    />
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
                      formatter={(value, name) => {
                        const num = Number(value) || 0;
                        const labelStr = String(name || '');
                        return [
                          labelStr.includes('ঘণ্টা') || labelStr.includes('Hours')
                            ? `${formatNumber(num, lang, 1)} ${lang === 'bn' ? 'ঘঃ' : 'h'}`
                            : formatBDT(num, lang),
                          labelStr,
                        ];
                      }}
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                    <Bar
                      dataKey="overtimeEarnings"
                      name={lang === 'bn' ? 'ওভারটাইম আয়' : 'OT Earnings'}
                      fill="#D97706"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {trendMode === 'salary_vs_expense' ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                    <span>{lang === 'bn' ? 'অর্জিত বেতন' : 'Earned Salary'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                    <span>{lang === 'bn' ? 'প্রাপ্ত বেতন' : 'Received Salary'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
                    <span>{lang === 'bn' ? 'মোট খরচ' : 'Total Expenses'}</span>
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-600" />
                  <span>
                    {lang === 'bn'
                      ? 'মাসভিত্তিক ওভারটাইম আয় (৳)'
                      : 'Monthly Overtime Earnings'}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (id === 'expense_cashflow') {
      return (
        <div key={id} className={spanClass}>
          <ExpenseCashflowAnalyticsCard
            selectedMonth={selectedMonth}
            lang={lang}
            expenseCategorySlices={analytics.expenseCategorySlices}
            salaryCollectionPct={kpis.salaryCollectionPct}
            savingsProgressPct={kpis.savingsProgressPct}
            latestPopulatedExpenseMonth={analytics.latestPopulatedExpenseMonth}
            onSelectMonth={onSelectMonth}
            dataTestId="home-expense-cashflow-card"
          />
        </div>
      );
    }

    if (id === 'expense_rent_graph') {
      return (
        <div key={id} className={spanClass}>
          <ExpenseRentTrendChartCard
            lang={lang}
            rentTrend={rentTrend}
            dataTestId="home-expense-rent-trend-card"
          />
        </div>
      );
    }

    if (id === 'loan_portfolio') {
      if (!loanPortfolio) return null;
      return (
        <div key={id} className={spanClass}>
          <LoanPortfolioChartsCard
            lang={lang}
            portfolio={loanPortfolio}
            dataTestId="home-loan-portfolio-charts-card"
          />
        </div>
      );
    }

    if (!factoryAnalytics) return null;
    return (
      <div key={id} className={spanClass}>
        <FactoryComparisonChartsCard
          lang={lang}
          analytics={factoryAnalytics}
          anonymousComparison={anonymousComparison}
          dataTestId="home-factory-comparison-charts-card"
        />
      </div>
    );
  };

  if (zone !== 'salary_overview') {
    if (zoneItems.length === 0) return null;
    return (
      <section
        data-testid={`home-contextual-zone-${zone}`}
        className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4"
      >
        {zoneItems.map((item) => renderChartWidget(item.id))}
      </section>
    );
  }

  return (
    <section
      data-testid="home-overview-analytics-section"
      aria-label={lang === 'bn' ? 'একনজরে ওভারভিউ ও অ্যানালিটিক্স' : 'Overview & Analytics'}
      className="space-y-4"
    >
      {/* Clean Section Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
              {lang === 'bn'
                ? 'মাসিক বেতন ও আর্থিক অ্যানালিটিক্স'
                : 'Monthly Salary & Financial Analytics'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-bold text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
              {formatMonthLabel(selectedMonth, lang)}
            </span>
            {kpis.totalTrackedDays === 0 &&
              analytics.latestPopulatedAttendanceMonth &&
              analytics.latestPopulatedAttendanceMonth !== selectedMonth && (
                <button
                  type="button"
                  data-testid="analytics-jump-latest-month-btn"
                  onClick={() => onSelectMonth(analytics.latestPopulatedAttendanceMonth!)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100/80 hover:bg-emerald-200/80 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 font-bold whitespace-nowrap transition-colors cursor-pointer"
                >
                  {lang === 'bn'
                    ? `${formatMonthLabel(analytics.latestPopulatedAttendanceMonth, 'bn')} দেখুন`
                    : `View ${formatMonthLabel(analytics.latestPopulatedAttendanceMonth, 'en')}`}
                </button>
              )}
            <button
              type="button"
              data-testid="home-customize-charts-btn"
              onClick={() => setIsCustomizingCharts((v) => !v)}
              className={`px-2.5 py-1 rounded-lg border font-bold whitespace-nowrap inline-flex items-center gap-1 transition-colors cursor-pointer ${
                isCustomizingCharts
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3 shrink-0" />
              <span>{lang === 'bn' ? 'চার্ট সাজান' : 'Arrange Charts'}</span>
            </button>
            <button
              type="button"
              data-testid="home-open-reports-btn"
              onClick={() => onNavigateTab('more', 'reports')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold whitespace-nowrap inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{lang === 'bn' ? 'রিপোর্ট দেখুন' : 'View Reports'}</span>
              <ArrowRight className="w-3 h-3 shrink-0" />
            </button>
          </div>
        </div>

        {/* Inline Chart Customizer Drawer ("চার্ট আগে-পরে সাজান") */}
        {isCustomizingCharts && (
          <div
            data-testid="home-chart-customizer-panel"
            className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {lang === 'bn'
                    ? 'হোম পেজের চার্ট ও গ্রাফ নিজের পছন্দমতো দেখান বা সাজান'
                    : 'Customize Home Chart Visibility & Order'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {usingContextualPositions
                    ? lang === 'bn'
                      ? 'ডিফল্ট অবস্থায় প্রতিটি চার্ট তার নিজস্ব সেকশনের সাথে সুন্দরভাবে বসানো আছে।'
                      : 'By default, each chart is placed contextually next to its matching section.'
                    : lang === 'bn'
                    ? 'কাস্টম ক্রম সক্রিয় রয়েছে — ডিফল্ট সেকশন পজিশনে ফিরতে "ডিফল্ট" চাপুন।'
                    : 'Custom order active — click Reset to restore contextual positions.'}
                </p>
              </div>
              <button
                type="button"
                data-testid="home-reset-chart-order-btn"
                onClick={resetChartLayout}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{lang === 'bn' ? 'ডিফল্ট' : 'Reset'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {chartLayout.map((item, idx) => {
                const meta = CHART_META[item.id];
                return (
                  <div
                    key={item.id}
                    data-testid={`chart-order-row-${item.id}`}
                    className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                      item.visible
                        ? 'bg-slate-50/90 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                        : 'bg-slate-50/40 dark:bg-slate-900 border-slate-200/50 dark:border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                        {formatNumber(idx + 1, lang)}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold leading-snug break-words block">
                          {lang === 'bn' ? meta.labelBn : meta.labelEn}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          {lang === 'bn' ? meta.positionHintBn : meta.positionHintEn}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-testid={`chart-move-up-${item.id}`}
                        onClick={() => moveChartOrder(idx, -1)}
                        disabled={idx === 0}
                        aria-label={lang === 'bn' ? 'উপরে নিন' : 'Move up'}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`chart-move-down-${item.id}`}
                        onClick={() => moveChartOrder(idx, 1)}
                        disabled={idx === chartLayout.length - 1}
                        aria-label={lang === 'bn' ? 'নিচে নিন' : 'Move down'}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`chart-toggle-vis-${item.id}`}
                        onClick={() => toggleChartVisibility(item.id)}
                        aria-label={item.visible ? 'Hide' : 'Show'}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${
                          item.visible
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        {item.visible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 1: 5 Color-Coded Analytical Overview KPIs */}
        <div
          data-testid="home-analytics-kpi-grid"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3"
        >
          {/* 1. Attendance Rate (Emerald) */}
          <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-800/60 p-3 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 leading-tight">
                {lang === 'bn' ? 'উপস্থিতির হার' : 'Attendance Rate'}
              </span>
              <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-black text-emerald-950 dark:text-white tabular-nums">
              {formatNumber(kpis.attendanceRatePct, lang)}%
            </p>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 tabular-nums leading-tight">
              {lang === 'bn'
                ? `${formatNumber(kpis.presentDays + kpis.lateDays, 'bn')} উপস্থিত · ${formatNumber(kpis.absentDays, 'bn')} অনু`
                : `${kpis.presentDays + kpis.lateDays} present · ${kpis.absentDays} absent`}
            </p>
          </div>

          {/* 2. Base + Allowances (Teal) */}
          <div className="rounded-xl bg-teal-50/60 dark:bg-teal-950/25 border border-teal-200/80 dark:border-teal-800/60 p-3 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-teal-900 dark:text-teal-300 leading-tight">
                {lang === 'bn' ? 'মূল ও ভাতা বেতন' : 'Base & Allowances'}
              </span>
              <Wallet className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-black text-teal-950 dark:text-white tabular-nums">
              {formatBDT(kpis.basicSalary + kpis.houseRentAllowance + kpis.otherFixedAllowances, lang)}
            </p>
            <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80 tabular-nums leading-tight">
              {lang === 'bn'
                ? `মূল ${formatBDT(kpis.basicSalary, 'bn')}`
                : `Basic ${formatBDT(kpis.basicSalary, 'en')}`}
            </p>
          </div>

          {/* 3. Overtime Earnings (Amber) */}
          <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/60 p-3 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 leading-tight">
                {lang === 'bn' ? 'ওভারটাইম আয়' : 'Overtime Pay'}
              </span>
              <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-black text-amber-950 dark:text-white tabular-nums">
              {formatBDT(kpis.otEarnings, lang)}
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 tabular-nums leading-tight">
              {lang === 'bn'
                ? `${formatNumber(kpis.otHours, 'bn', 1)} ঘঃ · আয়ের ${formatNumber(kpis.otSharePct, 'bn')}%`
                : `${kpis.otHours}h · ${kpis.otSharePct}% of pay`}
            </p>
          </div>

          {/* 4. Monthly Expenses (Rose) */}
          <div className="rounded-xl bg-rose-50/60 dark:bg-rose-950/25 border border-rose-200/80 dark:border-rose-800/60 p-3 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-rose-900 dark:text-rose-300 leading-tight">
                {lang === 'bn' ? 'মাসিক মোট খরচ' : 'Total Expenses'}
              </span>
              <TrendingUp className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-black text-rose-950 dark:text-white tabular-nums">
              {formatBDT(kpis.totalExpenses, lang)}
            </p>
            <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 tabular-nums leading-tight">
              {lang === 'bn'
                ? `আয়ের ${formatNumber(kpis.expenseRatioPct, 'bn')}% ব্যয়`
                : `${kpis.expenseRatioPct}% of income`}
            </p>
          </div>

          {/* 5. Savings & Cashflow (Indigo) */}
          <div className="col-span-2 sm:col-span-1 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-800/60 p-3 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 leading-tight">
                {lang === 'bn' ? 'মোট সঞ্চয় ও জমা' : 'Savings & Balance'}
              </span>
              <PiggyBank className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-black text-indigo-950 dark:text-white tabular-nums">
              {formatBDT(kpis.totalSaved, lang)}
            </p>
            <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 tabular-nums leading-tight">
              {lang === 'bn'
                ? `বেতন আদায় ${formatNumber(kpis.salaryCollectionPct, 'bn')}%`
                : `${kpis.salaryCollectionPct}% collected`}
            </p>
          </div>
        </div>
      </div>

      {/* Contextual Salary Pie + 6-Month Financial Trend Grid */}
      {zoneItems.length > 0 && (
        <div
          data-testid="home-all-charts-grid"
          className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4"
        >
          {zoneItems.map((item) => renderChartWidget(item.id))}
        </div>
      )}
    </section>
  );
};

export const HomeAnalyticsSection = React.memo(HomeAnalyticsSectionImpl);
