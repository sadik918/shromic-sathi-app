import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toBengaliDigits } from '../utils/calculations';
import type { AdminStoreState } from '../utils/adminLogic';
import {
  computeSystemHealthSummary,
  filterSystemErrors,
  translateSystemError,
} from '../utils/adminSystemHelpers';

interface AdminMonitoringSectionProps {
  store: AdminStoreState;
  lang: 'bn' | 'en';
  isOnline: boolean;
  hasAuthSession: boolean;
  isDemoMode: boolean;
  pendingWritesCount: number;
  onResolveErrorLog: (errId: string) => void;
  showToast: (msg: string) => void;
}

function measureLocalStorageKB(): number {
  if (typeof window === 'undefined') return 0;
  try {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k) {
        const v = localStorage.getItem(k) || '';
        totalBytes += (k.length + v.length) * 2;
      }
    }
    return Math.max(1, Math.round(totalBytes / 1024));
  } catch {
    return 0;
  }
}

export const AdminMonitoringSection: React.FC<AdminMonitoringSectionProps> = ({
  store,
  lang,
  isOnline,
  hasAuthSession,
  isDemoMode,
  pendingWritesCount,
  onResolveErrorLog,
  showToast,
}) => {
  const [errorStatusFilter, setErrorStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>(
    'all'
  );
  const [storageUsedKB, setStorageUsedKB] = useState<number>(() => measureLocalStorageKB());
  const [lastCheckTime, setLastCheckTime] = useState<string>(() =>
    new Date().toTimeString().slice(0, 8)
  );

  const unresolvedCount = useMemo(
    () => store.errors.filter((e) => e.resolutionStatus !== 'resolved').length,
    [store.errors]
  );

  const healthSummary = useMemo(
    () =>
      computeSystemHealthSummary({
        isOnline,
        hasAuthSession,
        isDemoMode,
        pendingWritesCount,
        unresolvedErrorsCount: unresolvedCount,
        storageUsedKB,
      }),
    [isOnline, hasAuthSession, isDemoMode, pendingWritesCount, unresolvedCount, storageUsedKB]
  );

  const filteredErrors = useMemo(
    () => filterSystemErrors(store.errors, errorStatusFilter),
    [store.errors, errorStatusFilter]
  );

  const formatNum = (n: number) => (lang === 'bn' ? toBengaliDigits(n) : String(n));

  const handleRunLiveDiagnostics = () => {
    const measuredKB = measureLocalStorageKB();
    setStorageUsedKB(measuredKB);
    setLastCheckTime(new Date().toTimeString().slice(0, 8));
    showToast(
      lang === 'bn'
        ? 'সিস্টেম পরীক্ষা সম্পন্ন হয়েছে — সব তথ্য আপডেট করা হয়েছে।'
        : 'System health check completed.'
    );
  };

  const overallColors =
    healthSummary.overallLevel === 'healthy'
      ? {
          bg: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
          badge: 'text-emerald-700 dark:text-emerald-400',
          iconWrap: 'bg-emerald-700 text-white',
        }
      : healthSummary.overallLevel === 'offline'
      ? {
          bg: 'bg-slate-100 dark:bg-slate-800/70 border-slate-300 dark:border-slate-700',
          badge: 'text-slate-700 dark:text-slate-300',
          iconWrap: 'bg-slate-700 text-white',
        }
      : {
          bg: 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
          badge: 'text-amber-700 dark:text-amber-400',
          iconWrap: 'bg-amber-600 text-white',
        };

  return (
    <div data-testid="admin-monitoring-section" className="space-y-5">
      {/* Plain-Bengali System Health Overview Banner */}
      <div
        data-testid="admin-monitoring-health-banner"
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${overallColors.bg}`}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${overallColors.iconWrap}`}
          >
            {healthSummary.overallLevel === 'healthy' ? (
              <ShieldCheck className="w-5 h-5" />
            ) : healthSummary.overallLevel === 'offline' ? (
              <WifiOff className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`font-bold ${overallColors.badge}`}>
                {lang === 'bn' ? healthSummary.overallLabelBn : healthSummary.overallLabelEn}
              </span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-mono">
                {lang === 'bn'
                  ? `সর্বশেষ যাচাই: ${toBengaliDigits(lastCheckTime)}`
                  : `Checked: ${lastCheckTime}`}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              {lang === 'bn' ? healthSummary.overallDetailBn : healthSummary.overallDetailEn}
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="admin-run-health-check-btn"
          onClick={handleRunLiveDiagnostics}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{lang === 'bn' ? 'এখনই পরীক্ষা করুন' : 'Run Health Check'}</span>
        </button>
      </div>

      {/* 4 Easy-to-Understand Service Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>{lang === 'bn' ? 'অ্যাকাউন্ট লগইন সেবা' : 'Login & Auth Service'}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          </div>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {hasAuthSession
              ? lang === 'bn'
                ? 'লগইন সচল আছে'
                : 'Active & Verified'
              : isDemoMode
              ? lang === 'bn'
                ? 'নিরাপদ লোকাল সেশন'
                : 'Local Demo Active'
              : lang === 'bn'
              ? 'লগইনের জন্য প্রস্তুত'
              : 'Ready'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'bn'
              ? 'কর্মীদের অ্যাকাউন্টে নিরাপদ প্রবেশ যাচাই করে'
              : 'Manages secure worker account sign-in'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>{lang === 'bn' ? 'ক্লাউড ডেটাবেস' : 'Cloud Database'}</span>
            {isOnline ? (
              <Cloud className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            )}
          </div>
          <p
            className={`text-sm font-bold ${
              isOnline
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {isOnline
              ? lang === 'bn'
                ? 'অনলাইনে যুক্ত'
                : 'Connected Online'
              : lang === 'bn'
              ? 'অফলাইন ক্যাশ চালু'
              : 'Offline Cache Active'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'bn'
              ? 'বেতন ও হাজিরার হিসাব নিরাপদে সংরক্ষণ করে'
              : 'Safely stores attendance and wage logs'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>{lang === 'bn' ? 'অফলাইন সিঙ্ক সারি' : 'Offline Sync Queue'}</span>
            <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          </div>
          <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {pendingWritesCount === 0
              ? lang === 'bn'
                ? '০টি বাকি — সব সিঙ্ক হয়েছে'
                : '0 Pending — All Synced'
              : lang === 'bn'
              ? `${formatNum(pendingWritesCount)}টি পাঠানোর বাকি`
              : `${pendingWritesCount} Pending Sync`}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'bn'
              ? 'নেট ছাড়া সেভ করা তথ্য নেট পেলে পাঠায়'
              : 'Queues offline saves for automatic upload'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>{lang === 'bn' ? 'ফোন স্টোরেজ ও মেমোরি' : 'Device Storage Usage'}</span>
            <HardDrive className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          </div>
          <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {formatNum(storageUsedKB)} KB
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === 'bn'
              ? 'দ্রুত লোডিং ও অফলাইন কাজের ব্যবহৃত জায়গা'
              : 'Local space used for fast offline access'}
          </p>
        </div>
      </div>

      {/* 5-Point Live Diagnostic Checklist */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? '৫-দফা সিস্টেম স্বাস্থ্য যাচাই' : '5-Point System Health Check'}
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'তাৎক্ষণিক অবস্থা' : 'Live Status'}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {healthSummary.checks.map((chk) => (
            <div key={chk.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {chk.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : chk.id === 'network' ? (
                  <Wifi className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {lang === 'bn' ? chk.labelBn : chk.labelEn}
                </span>
              </div>
              <span
                className={`font-bold shrink-0 ${
                  chk.ok
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {lang === 'bn' ? chk.statusTextBn : chk.statusTextEn}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Plain-Bengali Error & Sync Diagnostics Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn'
                ? 'অ্যাপের সমস্যা ও সতর্কতা তালিকা'
                : 'Application Alerts & Sync Diagnostics'}
            </h3>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs self-start sm:self-auto">
            {(
              [
                { id: 'all', bn: 'সব', en: 'All' },
                { id: 'unresolved', bn: 'অমীমাংসিত', en: 'Open' },
                { id: 'resolved', bn: 'সমাধানকৃত', en: 'Resolved' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setErrorStatusFilter(f.id)}
                className={`min-h-[30px] px-3 rounded-lg font-semibold cursor-pointer ${
                  errorStatusFilter === f.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {lang === 'bn' ? f.bn : f.en}
              </button>
            ))}
          </div>
        </div>

        {filteredErrors.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            {lang === 'bn'
              ? 'এই তালিকায় কোনো সতর্কতা বা ত্রুটি নেই — সব ঠিক চলছে।'
              : 'No alerts found in this filter — everything looks clean.'}
          </div>
        ) : (
          <>
            {/* Mobile Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredErrors.map((err) => {
                const info = translateSystemError(err);
                const resolved = err.resolutionStatus === 'resolved';
                return (
                  <div key={err.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-500">{err.timestamp}</span>
                      <span
                        className={`font-bold shrink-0 ${
                          resolved
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {resolved
                          ? lang === 'bn'
                            ? 'সমাধানকৃত'
                            : 'Resolved'
                          : lang === 'bn'
                          ? 'অমীমাংসিত'
                          : 'Open'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? info.titleBn : info.titleEn}
                    </p>
                    <p className="text-slate-500 font-semibold">
                      {lang === 'bn' ? info.moduleBn : info.moduleEn}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {lang === 'bn' ? info.detailBn : info.detailEn}
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      {lang === 'bn' ? info.suggestionBn : info.suggestionEn}
                    </p>
                    {!resolved && (
                      <button
                        type="button"
                        onClick={() => onResolveErrorLog(err.id)}
                        className="w-full min-h-[38px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer mt-1"
                      >
                        {lang === 'bn' ? 'সমাধান চিহ্নিত করুন' : 'Mark Resolved'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                    <th className="py-3 px-4">{lang === 'bn' ? 'সময় ও অংশ' : 'Time & Module'}</th>
                    <th className="py-3 px-4">
                      {lang === 'bn' ? 'সহজ ভাষায় বিবরণ ও পরামর্শ' : 'Plain Explanation & Guidance'}
                    </th>
                    <th className="py-3 px-4">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                    <th className="py-3 px-4 text-right">{lang === 'bn' ? 'পদক্ষেপ' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredErrors.map((err) => {
                    const info = translateSystemError(err);
                    const resolved = err.resolutionStatus === 'resolved';
                    return (
                      <tr key={err.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="py-3.5 px-4 align-top">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {lang === 'bn' ? info.moduleBn : info.moduleEn}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {err.timestamp}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 max-w-lg space-y-1">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {lang === 'bn' ? info.titleBn : info.titleEn}
                          </p>
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            {lang === 'bn' ? info.detailBn : info.detailEn}
                          </p>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            {lang === 'bn' ? info.suggestionBn : info.suggestionEn}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className={`font-bold ${
                              resolved
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {resolved
                              ? lang === 'bn'
                                ? 'সমাধানকৃত'
                                : 'Resolved'
                              : lang === 'bn'
                              ? 'অমীমাংসিত'
                              : 'Open'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right align-top">
                          {!resolved ? (
                            <button
                              type="button"
                              onClick={() => onResolveErrorLog(err.id)}
                              className="min-h-[34px] px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
                            >
                              {lang === 'bn' ? 'সমাধান চিহ্নিত করুন' : 'Mark Resolved'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">{err.resolvedBy}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
