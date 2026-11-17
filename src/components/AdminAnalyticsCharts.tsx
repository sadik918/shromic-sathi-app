import React from 'react';
import {
  Area,
  AreaChart,
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
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import type { Language } from '../types';
import { toBengaliDigits } from '../utils/calculations';
import type {
  AdminBarPoint,
  AdminPieSlice,
  AdminTrendPoint,
} from '../utils/adminSystemHelpers';

const ADMIN_TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: '12px',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  backgroundColor: 'rgba(15, 23, 42, 0.96)',
  color: '#f8fafc',
  fontSize: '12px',
  fontWeight: 600,
  padding: '8px 12px',
};

interface AdminPieChartCardProps {
  titleBn: string;
  titleEn: string;
  lang: Language;
  slices: AdminPieSlice[];
  centerValueBn: string;
  centerValueEn: string;
  centerLabelBn: string;
  centerLabelEn: string;
  badgeTextBn?: string;
  badgeTextEn?: string;
  valueSuffixBn?: string;
  valueSuffixEn?: string;
  showValueAsPercent?: boolean;
  stackedLegend?: boolean;
  icon?: React.ReactNode;
  footerSummaryBn?: string;
  footerSummaryEn?: string;
  dataTestId?: string;
}

export const AdminPieChartCard: React.FC<AdminPieChartCardProps> = ({
  titleBn,
  titleEn,
  lang,
  slices,
  centerValueBn,
  centerValueEn,
  centerLabelBn,
  centerLabelEn,
  badgeTextBn,
  badgeTextEn,
  valueSuffixBn = '',
  valueSuffixEn = '',
  showValueAsPercent = false,
  stackedLegend = false,
  icon,
  footerSummaryBn,
  footerSummaryEn,
  dataTestId,
}) => {
  return (
    <div
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="mt-0.5 shrink-0">
            {icon || (
              <PieChartIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
          </span>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
            {lang === 'bn' ? titleBn : titleEn}
          </h3>
        </div>
        {(badgeTextBn || badgeTextEn) && (
          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums shrink-0 whitespace-nowrap">
            {lang === 'bn' ? badgeTextBn : badgeTextEn}
          </span>
        )}
      </div>

      {slices.length > 0 ? (
        <div
          className={
            stackedLegend
              ? 'flex flex-col gap-3.5'
              : 'grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 items-center'
          }
        >
          <div
            className={
              stackedLegend
                ? 'relative h-[152px] sm:h-[164px] w-full max-w-[220px] mx-auto min-w-0'
                : 'md:col-span-5 relative h-[156px] sm:h-[172px] w-full max-w-[220px] mx-auto md:max-w-none min-w-0'
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey={lang === 'bn' ? 'nameBn' : 'nameEn'}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={66}
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
                  formatter={(value, name) => {
                    const num = Number(value) || 0;
                    const formatted =
                      lang === 'bn'
                        ? `${toBengaliDigits(num)}${showValueAsPercent ? '%' : valueSuffixBn}`
                        : `${num}${showValueAsPercent ? '%' : valueSuffixEn}`;
                    return [formatted, String(name || '')];
                  }}
                  contentStyle={ADMIN_TOOLTIP_STYLE}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                {lang === 'bn' ? centerValueBn : centerValueEn}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 leading-tight max-w-[82px]">
                {lang === 'bn' ? centerLabelBn : centerLabelEn}
              </span>
            </div>
          </div>

          <div className={stackedLegend ? 'space-y-2.5' : 'md:col-span-7 space-y-2.5'}>
            {slices.map((slice) => {
              const sub = lang === 'bn' ? slice.subLabelBn : slice.subLabelEn;
              const valDisplay = showValueAsPercent
                ? lang === 'bn'
                  ? `${toBengaliDigits(slice.percent)}%`
                  : `${slice.percent}%`
                : lang === 'bn'
                ? `${toBengaliDigits(slice.value)}${valueSuffixBn}`
                : `${slice.value}${valueSuffixEn}`;
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
                    <div className="flex items-center gap-1 tabular-nums whitespace-nowrap shrink-0 pt-0.5">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {valDisplay}
                      </span>
                      {!showValueAsPercent && (
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          ({lang === 'bn' ? toBengaliDigits(slice.percent) : slice.percent}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(5, Math.min(100, slice.percent))}%`,
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
        <div className="py-6 text-center text-xs text-slate-400">
          {lang === 'bn' ? 'কোনো ডেটা পাওয়া যায়নি' : 'No data available'}
        </div>
      )}

      {(footerSummaryBn || footerSummaryEn) && (
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <span>{lang === 'bn' ? footerSummaryBn : footerSummaryEn}</span>
        </div>
      )}
    </div>
  );
};

interface AdminBarChartCardProps {
  titleBn: string;
  titleEn: string;
  lang: Language;
  bars: AdminBarPoint[];
  badgeTextBn?: string;
  badgeTextEn?: string;
  icon?: React.ReactNode;
  dataTestId?: string;
}

export const AdminBarChartCard: React.FC<AdminBarChartCardProps> = ({
  titleBn,
  titleEn,
  lang,
  bars,
  badgeTextBn,
  badgeTextEn,
  icon,
  dataTestId,
}) => {
  const chartRows = bars.map((b) => ({
    ...b,
    displayLabel: lang === 'bn' ? b.labelBn : b.labelEn,
  }));

  return (
    <div
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 flex flex-col justify-between space-y-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="mt-0.5 shrink-0">
            {icon || (
              <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            )}
          </span>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
            {lang === 'bn' ? titleBn : titleEn}
          </h3>
        </div>
        {(badgeTextBn || badgeTextEn) && (
          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums shrink-0 whitespace-nowrap">
            {lang === 'bn' ? badgeTextBn : badgeTextEn}
          </span>
        )}
      </div>

      {chartRows.length > 0 ? (
        <div className="space-y-3">
          <div className="h-[158px] sm:h-[172px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                margin={{ top: 8, right: 6, left: -20, bottom: 2 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(148, 163, 184, 0.18)"
                />
                <XAxis
                  dataKey="displayLabel"
                  interval={0}
                  tickFormatter={(val) => {
                    const str = String(val || '');
                    return str.length > 9 ? str.split(' ')[0] : str;
                  }}
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v) =>
                    lang === 'bn' ? toBengaliDigits(Number(v) || 0) : String(v)
                  }
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value, _name, item) => {
                    const num = Number(value) || 0;
                    const payload = item?.payload as AdminBarPoint | undefined;
                    const unit =
                      lang === 'bn' ? payload?.unitBn || '' : payload?.unitEn || '';
                    return [
                      lang === 'bn'
                        ? `${toBengaliDigits(num)} ${unit}`.trim()
                        : `${num} ${unit}`.trim(),
                      lang === 'bn' ? payload?.labelBn || '' : payload?.labelEn || '',
                    ];
                  }}
                  contentStyle={ADMIN_TOOLTIP_STYLE}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar
                  dataKey="primaryValue"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={34}
                  isAnimationActive={false}
                >
                  {chartRows.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 pt-1">
            {bars.slice(0, 6).map((b) => (
              <div
                key={b.key}
                className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-1.5 text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300 leading-tight break-words">
                    {lang === 'bn' ? b.labelBn : b.labelEn}
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 tabular-nums">
                  {lang === 'bn' ? toBengaliDigits(b.primaryValue) : b.primaryValue}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-slate-400">
          {lang === 'bn' ? 'কোনো ডেটা পাওয়া যায়নি' : 'No data available'}
        </div>
      )}
    </div>
  );
};

interface AdminGrowthTrendCardProps {
  lang: Language;
  trend: AdminTrendPoint[];
  dataTestId?: string;
}

export const AdminGrowthTrendCard: React.FC<AdminGrowthTrendCardProps> = ({
  lang,
  trend,
  dataTestId = 'admin-overview-growth-trend-card',
}) => {
  const chartData = trend.map((pt) => ({
    ...pt,
    displayMonth: lang === 'bn' ? pt.labelBn : pt.labelEn,
  }));

  const latest = trend[trend.length - 1];

  return (
    <div
      data-testid={dataTestId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 space-y-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
            {lang === 'bn'
              ? 'মাসভিত্তিক সক্রিয় শ্রমিক ও সাবস্ক্রিপশন প্রবৃদ্ধি (গ্রাফ চার্ট)'
              : 'Monthly Active Workers & Revenue Growth (Trend Chart)'}
          </h3>
        </div>
        {latest && (
          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0 whitespace-nowrap">
            {lang === 'bn'
              ? `বর্তমান: ৳${toBengaliDigits(latest.revenueThousandBdt)} হাজার MRR`
              : `Current: ৳${latest.revenueThousandBdt}k MRR`}
          </span>
        )}
      </div>

      <div className="h-[164px] sm:h-[188px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -18, bottom: 2 }}
          >
            <defs>
              <linearGradient id="adminActiveWorkersFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(148, 163, 184, 0.18)"
            />
            <XAxis
              dataKey="displayMonth"
              interval={0}
              tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v) =>
                lang === 'bn' ? toBengaliDigits(Number(v) || 0) : String(v)
              }
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => {
                const num = Number(value) || 0;
                const isRev = String(name) === 'revenueThousandBdt';
                if (isRev) {
                  return [
                    lang === 'bn' ? `৳${toBengaliDigits(num)} হাজার` : `৳${num}k`,
                    lang === 'bn' ? 'মাসিক আয় (হাজার ৳)' : 'Revenue (k BDT)',
                  ];
                }
                return [
                  lang === 'bn' ? `${toBengaliDigits(num)} জন` : `${num} workers`,
                  lang === 'bn' ? 'সক্রিয় শ্রমিক' : 'Active Workers',
                ];
              }}
              contentStyle={ADMIN_TOOLTIP_STYLE}
              itemStyle={{ color: '#f8fafc' }}
            />
            <Area
              type="monotone"
              dataKey="activeWorkers"
              stroke="#059669"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#adminActiveWorkersFill)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="revenueThousandBdt"
              stroke="#0EA5E9"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#adminRevenueFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 pt-1 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex min-[380px]:block items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
            {lang === 'bn' ? 'সক্রিয় শ্রমিক (নভেঃ)' : 'Active Workers'}
          </span>
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {lang === 'bn'
              ? `${toBengaliDigits(latest?.activeWorkers || 1245)} জন`
              : `${latest?.activeWorkers || 1245}`}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex min-[380px]:block items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
            {lang === 'bn' ? 'নতুন নিবন্ধন (নভেঃ)' : 'New Signups'}
          </span>
          <span className="font-mono font-bold text-sky-700 dark:text-sky-400 tabular-nums">
            {lang === 'bn'
              ? `+${toBengaliDigits(latest?.newRegistrations || 215)} জন`
              : `+${latest?.newRegistrations || 215}`}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex min-[380px]:block items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
            {lang === 'bn' ? 'মাসিক আয় (MRR)' : 'Monthly Revenue'}
          </span>
          <span className="font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums">
            {lang === 'bn'
              ? `৳${toBengaliDigits(latest?.revenueThousandBdt || 475)} হাজার`
              : `৳${latest?.revenueThousandBdt || 475}k`}
          </span>
        </div>
      </div>
    </div>
  );
};
