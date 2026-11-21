import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Loader2, Share2, X } from 'lucide-react';
import type { Language } from '../types';
import { formatBDT, formatNumber, toBengaliDigits } from '../utils/calculations';
import {
  buildFamilyShareText,
  renderSummaryCardToPngBlob,
  type FamilyShareLine,
} from '../utils/featureHelpers';
import { formatMonthLabel } from '../utils/i18n';

interface FamilyShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  monthISO: string;
  presentDays: number;
  otHours: number;
  earnedSalary: number;
  receivedSalary: number;
  totalExpenses: number;
  totalSaved: number;
}

type ShareFieldKey =
  | 'presentDays'
  | 'otHours'
  | 'earnedSalary'
  | 'receivedSalary'
  | 'totalExpenses'
  | 'totalSaved';

export const FamilyShareModal: React.FC<FamilyShareModalProps> = ({
  isOpen,
  onClose,
  lang,
  monthISO,
  presentDays,
  otHours,
  earnedSalary,
  receivedSalary,
  totalExpenses,
  totalSaved,
}) => {
  const [selected, setSelected] = useState<Record<ShareFieldKey, boolean>>({
    presentDays: true,
    otHours: true,
    earnedSalary: true,
    receivedSalary: true,
    totalExpenses: true,
    totalSaved: true,
  });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const monthLabel = formatMonthLabel(monthISO, lang);

  const items = useMemo(
    () => [
      {
        key: 'presentDays' as ShareFieldKey,
        label: lang === 'bn' ? 'উপস্থিত দিন' : 'Days Present',
        value:
          lang === 'bn'
            ? `${toBengaliDigits(presentDays)} দিন`
            : `${presentDays} days`,
      },
      {
        key: 'otHours' as ShareFieldKey,
        label: lang === 'bn' ? 'ওভারটাইম' : 'Overtime',
        value:
          lang === 'bn'
            ? `${formatNumber(otHours, 'bn', 1)} ঘণ্টা`
            : `${formatNumber(otHours, 'en', 1)} hrs`,
      },
      {
        key: 'earnedSalary' as ShareFieldKey,
        label: lang === 'bn' ? 'অর্জিত বেতন' : 'Earned Salary',
        value: formatBDT(earnedSalary, lang),
        highlight: true,
      },
      {
        key: 'receivedSalary' as ShareFieldKey,
        label: lang === 'bn' ? 'বেতন পেয়েছেন' : 'Salary Received',
        value: formatBDT(receivedSalary, lang),
      },
      {
        key: 'totalExpenses' as ShareFieldKey,
        label: lang === 'bn' ? 'মোট খরচ' : 'Total Expenses',
        value: formatBDT(totalExpenses, lang),
      },
      {
        key: 'totalSaved' as ShareFieldKey,
        label: lang === 'bn' ? 'সঞ্চয়' : 'Savings',
        value: formatBDT(totalSaved, lang),
      },
    ],
    [lang, presentDays, otHours, earnedSalary, receivedSalary, totalExpenses, totalSaved]
  );

  const activeLines: FamilyShareLine[] = useMemo(
    () =>
      items
        .filter((it) => selected[it.key])
        .map((it) => ({ label: it.label, value: it.value, highlight: it.highlight })),
    [items, selected]
  );

  if (!isOpen) return null;

  const title = lang === 'bn' ? 'মাসিক হিসাব সারাংশ' : 'Monthly Summary';

  const toggleField = (key: ShareFieldKey) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyText = async () => {
    if (activeLines.length === 0) return;
    const text = buildFamilyShareText({ title, monthLabel, lines: activeLines, lang });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleShareCard = async () => {
    if (activeLines.length === 0) return;
    setBusy(true);
    try {
      const shareText = buildFamilyShareText({ title, monthLabel, lines: activeLines, lang });
      const blob = await renderSummaryCardToPngBlob({
        title,
        monthLabel,
        lines: activeLines,
        footerText: lang === 'bn' ? 'শ্রমিক সাথী' : 'Shromik Sathi',
      });

      if (blob && typeof navigator !== 'undefined' && navigator.share) {
        const file = new File([blob], `shromik-sathi-${monthISO}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title, text: shareText, files: [file] });
          setBusy(false);
          return;
        }
        await navigator.share({ title, text: shareText });
        setBusy(false);
        return;
      }

      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `shromik-sathi-${monthISO}.png`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        await handleCopyText();
      }
    } catch {
      // user cancelled
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92dvh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Clean Header (No Subtitle) */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            {lang === 'bn' ? 'পরিবারের সাথে শেয়ার' : 'Share with Family'}
          </h2>
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
          {/* Toggle Checkboxes */}
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => {
              const checked = selected[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleField(item.key)}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                    checked
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                      checked
                        ? 'bg-emerald-700 border-emerald-700 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Live Minimalist Share Card Preview */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-950 shadow-xs">
            <div className="bg-emerald-700 px-4 py-3 text-white flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold">{title}</span>
              <span className="text-xs font-semibold text-emerald-100">{monthLabel}</span>
            </div>
            <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {activeLines.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">
                  {lang === 'bn' ? 'অন্তত একটি তথ্য নির্বাচন করুন' : 'Select at least one item'}
                </p>
              ) : (
                activeLines.map((line) => (
                  <div
                    key={line.label}
                    className={`py-2 flex items-center justify-between gap-2 text-xs ${
                      line.highlight
                        ? 'text-emerald-800 dark:text-emerald-300 font-extrabold'
                        : 'text-slate-700 dark:text-slate-200 font-semibold'
                    }`}
                  >
                    <span>{line.label}</span>
                    <span className="tabular-nums font-extrabold text-slate-900 dark:text-white">
                      {line.value}
                    </span>
                  </div>
                ))
              )}
              <div className="pt-2.5 text-center text-[10px] font-semibold text-slate-400">
                {lang === 'bn' ? 'শ্রমিক সাথী' : 'Shromik Sathi'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
          <button
            type="button"
            disabled={activeLines.length === 0}
            onClick={() => void handleCopyText()}
            className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>
              {copied
                ? lang === 'bn'
                  ? 'কপি হয়েছে'
                  : 'Copied'
                : lang === 'bn'
                ? 'কপি'
                : 'Copy'}
            </span>
          </button>
          <button
            type="button"
            disabled={busy || activeLines.length === 0}
            onClick={() => void handleShareCard()}
            className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
              <Share2 className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {lang === 'bn' ? 'কার্ড শেয়ার করুন' : 'Share Summary Card'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
