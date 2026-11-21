import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  Loader2,
  Save,
  Share2,
  Upload,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { PayslipParsedFields } from '../types';
import {
  calculateAttendanceBonusEligibility,
  computeDailyEarnedSalary,
  formatBDT,
  formatNumber,
  getSalaryStructure,
  roundCurrency,
  summarizeAttendanceForMonth,
  summarizeOvertimeRecords,
  toBengaliDigits,
} from '../utils/calculations';
import {
  buildFamilyShareText,
  comparePayslipWithApp,
  renderSummaryCardToPngBlob,
} from '../utils/featureHelpers';
import { formatMonthLabel } from '../utils/i18n';

interface PayslipCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMonth: string;
}

const EMPTY_PARSED: PayslipParsedFields = {
  grossSalary: null,
  basicSalary: null,
  houseRentAllowance: null,
  medicalAllowance: null,
  transportAllowance: null,
  foodAllowance: null,
  presentDays: null,
  absentDays: null,
  otHours: null,
  otAmount: null,
  attendanceBonus: null,
  otherAllowances: null,
  advanceDeduction: null,
  absentDeduction: null,
  otherDeductions: null,
  netPayable: null,
};

function compressImageFile(file: File): Promise<{ dataUrl: string; mimeType: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('IMAGE_INVALID'));
      img.onload = () => {
        const maxDim = 1600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: String(reader.result || ''),
            mimeType: file.type || 'image/jpeg',
            size: file.size,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({
          dataUrl,
          mimeType: 'image/jpeg',
          size: Math.round((dataUrl.length * 3) / 4),
        });
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export const PayslipCheckModal: React.FC<PayslipCheckModalProps> = ({
  isOpen,
  onClose,
  defaultMonth,
}) => {
  const {
    lang,
    profile,
    overtime,
    attendance,
    salaryRecords,
    isOnline,
    todayISO,
    savePayslipCheck,
    saveVaultDocument,
  } = useData();

  const [step, setStep] = useState<'upload' | 'review' | 'result'>('upload');
  const [month, setMonth] = useState(defaultMonth);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [photoFileName, setPhotoFileName] = useState<string>('');
  const [photoSize, setPhotoSize] = useState<number>(0);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [parsed, setParsed] = useState<PayslipParsedFields>({ ...EMPTY_PARSED });
  const [savedToast, setSavedToast] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [vaultSaved, setVaultSaved] = useState(false);
  const [sharing, setSharing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const appMonthData = useMemo(() => {
    const savedRec = salaryRecords.find((s) => s.month === month);
    const struct = getSalaryStructure(profile, savedRec);
    const monthAtt = attendance.filter((a) => a.month === month);
    const attSum = summarizeAttendanceForMonth(monthAtt);
    const otSum = summarizeOvertimeRecords(overtime, month);
    const attBonusAmt =
      profile.hasAttendanceBonus === false
        ? 0
        : savedRec
        ? savedRec.attendanceBonus
        : profile.attendanceBonusAmount ?? profile.attendanceBonus ?? 0;
    const bonusEval = calculateAttendanceBonusEligibility({
      recordsForMonth: monthAtt,
      profile,
    });
    const effectiveBonus = bonusEval.isEligible ? attBonusAmt : 0;
    const otherAllow = (savedRec?.festivalBonus || 0) + (savedRec?.otherAllowances || 0);
    const advDed = savedRec?.advanceDeduction || 0;
    const absDed =
      savedRec?.absenceDeduction ??
      roundCurrency((struct.basicSalary / 30) * attSum.absentDays);
    const otherDed = savedRec?.otherDeductions || 0;

    const earned = computeDailyEarnedSalary({
      monthlyWage: struct.grossSalary,
      attendanceRecords: monthAtt,
      overtimeEarnings: otSum.monthlyEarnings,
      attendanceBonus: attBonusAmt,
      isAttendanceBonusEligible: bonusEval.isEligible,
      otherAllowances: otherAllow,
      deductions: advDed + absDed + otherDed,
      adjustments: savedRec?.adjustments || 0,
    });

    const netPayable =
      savedRec?.estimatedNetPayable ??
      (monthAtt.length > 0
        ? earned.totalEarnedSalary
        : roundCurrency(
            struct.grossSalary +
              otSum.monthlyEarnings +
              effectiveBonus +
              otherAllow -
              advDed -
              absDed -
              otherDed
          ));

    return {
      grossSalary: struct.grossSalary,
      basicSalary: struct.basicSalary,
      houseRentAllowance: struct.houseRentAllowance,
      medicalAllowance: struct.medicalAllowance,
      transportAllowance: struct.transportAllowance,
      foodAllowance: struct.foodAllowance,
      presentDays: attSum.presentDays + attSum.lateDays,
      absentDays: attSum.absentDays,
      otHours: otSum.monthlyHours,
      otAmount: otSum.monthlyEarnings,
      attendanceBonus: effectiveBonus,
      otherAllowances: otherAllow,
      advanceDeduction: advDed,
      absentDeduction: absDed,
      otherDeductions: otherDed,
      netPayable,
    };
  }, [month, profile, attendance, overtime, salaryRecords]);

  const comparison = useMemo(
    () => comparePayslipWithApp({ parsed, appData: appMonthData }),
    [parsed, appMonthData]
  );

  if (!isOpen) return null;

  const handleFileSelected = async (file?: File | null) => {
    if (!file) return;
    setErrorMsg('');
    setScanning(true);
    try {
      const compressed = await compressImageFile(file);
      setPhotoDataUrl(compressed.dataUrl);
      setPhotoFileName(file.name || `payslip_${month}.jpg`);
      setPhotoSize(compressed.size);

      if (!isOnline) {
        setErrorMsg(
          lang === 'bn'
            ? 'আপনি অফলাইনে আছেন। ছবির সংখ্যাগুলো নিচে হাতে লিখে যাচাই করুন।'
            : 'You are offline. Enter the payslip numbers manually below.'
        );
        setStep('review');
        setScanning(false);
        return;
      }

      const resp = await fetch('/api/gemini/parse-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: compressed.dataUrl,
          mimeType: compressed.mimeType,
        }),
      });
      const json = await resp.json();
      if (json.ok && json.parsed) {
        setParsed({ ...EMPTY_PARSED, ...json.parsed });
        setStep('review');
      } else {
        setErrorMsg(
          lang === 'bn'
            ? json.messageBn || 'ছবি থেকে সংখ্যা পড়া যায়নি। হাতে লিখে যাচাই করুন।'
            : json.messageEn || 'Could not read photo. Please enter numbers manually.'
        );
        setStep('review');
      }
    } catch {
      setErrorMsg(
        lang === 'bn'
          ? 'ছবিটি প্রসেস করা যায়নি। নিচে হাতে সংখ্যা লিখে যাচাই করুন।'
          : 'Unable to process image. You can enter numbers manually below.'
      );
      setStep('review');
    } finally {
      setScanning(false);
    }
  };

  const handleFieldChange = (key: keyof PayslipParsedFields, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      setParsed((prev) => ({ ...prev, [key]: null }));
      return;
    }
    const num = Number(trimmed);
    if (Number.isFinite(num) && num >= 0) {
      setParsed((prev) => ({ ...prev, [key]: num }));
    }
  };

  const handleSaveCheck = async () => {
    await savePayslipCheck({
      month,
      checkedAtISO: new Date().toISOString(),
      parsed,
      appNetPayable: comparison.appNet,
      payslipNetPayable: comparison.payslipNet,
      netDifference: comparison.netDiff,
    });
    setIsSaved(true);
    setSavedToast(lang === 'bn' ? 'যাচাইয়ের ইতিহাস সংরক্ষিত হয়েছে' : 'Payslip check saved');
    window.setTimeout(() => setSavedToast(''), 2500);
  };

  const handleSaveToVault = async () => {
    if (!photoDataUrl) return;
    await saveVaultDocument({
      title: `${lang === 'bn' ? 'পে-স্লিপ' : 'Payslip'} — ${formatMonthLabel(month, lang)}`,
      category: 'payslip',
      fileName: photoFileName || `payslip_${month}.jpg`,
      fileType: 'image/jpeg',
      fileSize: Math.min(photoSize || 120000, 950000),
      fileData: photoDataUrl.slice(0, 950000),
      issueDate: todayISO,
      notes: lang === 'bn' ? comparison.headlineBn : comparison.headlineEn,
    });
    setVaultSaved(true);
    setSavedToast(lang === 'bn' ? 'ডকুমেন্ট ভল্টে সংরক্ষিত হয়েছে' : 'Saved to Documents Vault');
    window.setTimeout(() => setSavedToast(''), 2500);
  };

  const handleShareResult = async () => {
    setSharing(true);
    try {
      const mLabel = formatMonthLabel(month, lang);
      const lines = [
        {
          label: lang === 'bn' ? 'পে-স্লিপ অনুযায়ী প্রদেয়' : 'Payslip Net Payable',
          value: formatBDT(comparison.payslipNet, lang),
        },
        {
          label: lang === 'bn' ? 'অ্যাপের হিসাব অনুযায়ী' : 'App Calculated Net',
          value: formatBDT(comparison.appNet, lang),
        },
        {
          label: lang === 'bn' ? 'মোট পার্থক্য' : 'Net Difference',
          value:
            comparison.netDiff === 0
              ? '৳ ০'
              : `${comparison.netDiff > 0 ? '+' : '-'}${formatBDT(Math.abs(comparison.netDiff), lang)}`,
          highlight: true,
        },
        ...comparison.rows
          .filter((r) => r.status === 'mismatch' && r.key !== 'netPayable')
          .slice(0, 5)
          .map((r) => ({
            label: lang === 'bn' ? r.labelBn : r.labelEn,
            value:
              r.unit === 'bdt'
                ? `${formatBDT(r.payslipVal || 0, lang)} vs ${formatBDT(r.appVal, lang)}`
                : `${formatNumber(r.payslipVal || 0, lang)} vs ${formatNumber(r.appVal, lang)}`,
          })),
      ];

      const title = lang === 'bn' ? 'পে-স্লিপ যাচাই ফলাফল' : 'Payslip Verification';
      const shareText = buildFamilyShareText({ title, monthLabel: mLabel, lines, lang });
      const blob = await renderSummaryCardToPngBlob({
        title,
        monthLabel: mLabel,
        lines,
        footerText: lang === 'bn' ? 'শ্রমিক সাথী' : 'Shromik Sathi',
      });

      if (blob && typeof navigator !== 'undefined' && navigator.share) {
        const file = new File([blob], `payslip-check-${month}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title, text: shareText, files: [file] });
          setSharing(false);
          return;
        }
        await navigator.share({ title, text: shareText });
        setSharing(false);
        return;
      }

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payslip-check-${month}.png`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      }
      setSavedToast(lang === 'bn' ? 'ফলাফল ডাউনলোড হয়েছে' : 'Result downloaded');
      window.setTimeout(() => setSavedToast(''), 2500);
    } catch {
      // user cancelled share
    } finally {
      setSharing(false);
    }
  };

  const editableFields: Array<{
    key: keyof PayslipParsedFields;
    labelBn: string;
    labelEn: string;
  }> = [
    { key: 'basicSalary', labelBn: 'মূল বেতন (৳)', labelEn: 'Basic Salary (৳)' },
    { key: 'houseRentAllowance', labelBn: 'বাড়ি ভাড়া (৳)', labelEn: 'House Rent (৳)' },
    { key: 'medicalAllowance', labelBn: 'চিকিৎসা ভাতা (৳)', labelEn: 'Medical (৳)' },
    { key: 'transportAllowance', labelBn: 'যাতায়াত ভাতা (৳)', labelEn: 'Transport (৳)' },
    { key: 'foodAllowance', labelBn: 'খাদ্য ভাতা (৳)', labelEn: 'Food (৳)' },
    { key: 'presentDays', labelBn: 'উপস্থিত দিন', labelEn: 'Present Days' },
    { key: 'absentDays', labelBn: 'অনুপস্থিত দিন', labelEn: 'Absent Days' },
    { key: 'otHours', labelBn: 'ওভারটাইম ঘণ্টা', labelEn: 'OT Hours' },
    { key: 'otAmount', labelBn: 'ওভারটাইম টাকা (৳)', labelEn: 'OT Earnings (৳)' },
    { key: 'attendanceBonus', labelBn: 'হাজিরা বোনাস (৳)', labelEn: 'Attendance Bonus (৳)' },
    { key: 'otherAllowances', labelBn: 'অন্যান্য ভাতা (৳)', labelEn: 'Other Allowances (৳)' },
    { key: 'advanceDeduction', labelBn: 'অগ্রিম কর্তন (৳)', labelEn: 'Advance Deduction (৳)' },
    { key: 'absentDeduction', labelBn: 'অনুপস্থিতি কর্তন (৳)', labelEn: 'Absence Deduction (৳)' },
    { key: 'otherDeductions', labelBn: 'অন্যান্য কর্তন (৳)', labelEn: 'Other Deductions (৳)' },
    { key: 'netPayable', labelBn: 'মোট প্রদেয় (৳)', labelEn: 'Net Payable (৳)' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[92dvh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Clean Header (No Subtitle) */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
              {step === 'upload'
                ? lang === 'bn'
                  ? 'পে-স্লিপ যাচাই'
                  : 'Payslip Check'
                : step === 'review'
                ? lang === 'bn'
                  ? 'আগে সংখ্যাগুলো মিলিয়ে নিন'
                  : 'Verify Extracted Numbers'
                : lang === 'bn'
                ? 'তুলনার ফলাফল'
                : 'Comparison Result'}
            </h2>
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {savedToast && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{savedToast}</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD PHOTO */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {lang === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Month'}
                </label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void handleFileSelected(e.target.files?.[0])}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFileSelected(e.target.files?.[0])}
              />

              {scanning ? (
                <div className="py-12 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-emerald-700 dark:text-emerald-400 animate-spin" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {lang === 'bn' ? 'পে-স্লিপ পড়া হচ্ছে...' : 'Reading payslip...'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="h-28 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-sm">
                      {lang === 'bn' ? 'ছবি তুলুন' : 'Take Photo'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-28 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Upload className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
                    <span className="text-sm">
                      {lang === 'bn' ? 'গ্যালারি থেকে দিন' : 'Upload from Gallery'}
                    </span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setStep('review');
                }}
                className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {lang === 'bn' ? 'ছবি ছাড়াই হাতে সংখ্যা লিখুন' : 'Enter numbers manually'}
              </button>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                {lang === 'bn'
                  ? 'ছবি শুধুমাত্র সংখ্যা পড়ার জন্য ব্যবহৃত হয়; আপনার অনুমতি ছাড়া সংরক্ষণ করা হয় না।'
                  : 'Your photo is only used to read numbers and is never stored without your permission.'}
              </p>
            </div>
          )}

          {/* STEP 2: EDITABLE REVIEW */}
          {step === 'review' && (
            <div className="space-y-4">
              {photoDataUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-40 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <img
                    src={photoDataUrl}
                    alt="Payslip"
                    className="max-h-40 w-auto object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {editableFields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 truncate">
                      {lang === 'bn' ? f.labelBn : f.labelEn}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder="—"
                      value={parsed[f.key] === null ? '' : String(parsed[f.key])}
                      onChange={(e) => handleFieldChange(f.key, e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: COMPARISON RESULT */}
          {step === 'result' && (
            <div className="space-y-4">
              {/* Big Net Difference Banner */}
              <div
                className={`rounded-2xl p-4 border ${
                  comparison.isMatched
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                    : comparison.netDiff < 0
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-lg sm:text-xl font-extrabold ${
                      comparison.isMatched
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : comparison.netDiff < 0
                        ? 'text-rose-800 dark:text-rose-200'
                        : 'text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {lang === 'bn' ? comparison.headlineBn : comparison.headlineEn}
                  </p>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatMonthLabel(month, lang)}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-white/80 dark:bg-slate-900/60 p-2.5">
                    <span className="text-slate-500 dark:text-slate-400 block">
                      {lang === 'bn' ? 'পে-স্লিপে' : 'On Payslip'}
                    </span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {formatBDT(comparison.payslipNet, lang)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/80 dark:bg-slate-900/60 p-2.5">
                    <span className="text-slate-500 dark:text-slate-400 block">
                      {lang === 'bn' ? 'অ্যাপের হিসাবে' : 'App Calculation'}
                    </span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {formatBDT(comparison.appNet, lang)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-2.5 px-3 font-bold">
                        {lang === 'bn' ? 'বিষয়' : 'Item'}
                      </th>
                      <th className="text-right py-2.5 px-2.5 font-bold">
                        {lang === 'bn' ? 'পে-স্লিপে' : 'Payslip'}
                      </th>
                      <th className="text-right py-2.5 px-2.5 font-bold">
                        {lang === 'bn' ? 'অ্যাপের হিসাবে' : 'App'}
                      </th>
                      <th className="text-right py-2.5 px-3 font-bold">
                        {lang === 'bn' ? 'পার্থক্য' : 'Diff'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {comparison.rows
                      .filter((r) => r.payslipVal !== null || r.appVal > 0)
                      .map((row) => {
                        const fmt = (v: number | null) => {
                          if (v === null) return '—';
                          if (row.unit === 'bdt') return formatBDT(v, lang);
                          return lang === 'bn' ? toBengaliDigits(v) : String(v);
                        };
                        return (
                          <tr
                            key={row.key}
                            className={
                              row.key === 'netPayable'
                                ? 'bg-slate-50/70 dark:bg-slate-800/40 font-extrabold'
                                : ''
                            }
                          >
                            <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-semibold">
                              {lang === 'bn' ? row.labelBn : row.labelEn}
                            </td>
                            <td className="py-2.5 px-2.5 text-right tabular-nums text-slate-900 dark:text-white">
                              {fmt(row.payslipVal)}
                            </td>
                            <td className="py-2.5 px-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                              {fmt(row.appVal)}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums font-bold">
                              {row.status === 'missing' ? (
                                <span className="text-slate-400">—</span>
                              ) : row.status === 'match' ? (
                                <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span
                                  className={
                                    (row.diff || 0) < 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }
                                >
                                  {(row.diff || 0) > 0 ? '+' : '-'}
                                  {fmt(Math.abs(row.diff || 0))}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Optional Save Photo to Vault */}
              {photoDataUrl && !vaultSaved && (
                <button
                  type="button"
                  onClick={() => void handleSaveToVault()}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>
                    {lang === 'bn'
                      ? 'পে-স্লিপের ছবি ডকুমেন্ট ভল্টে সংরক্ষণ করুন'
                      : 'Save payslip photo to Documents Vault'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Clean Sticky Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2.5 shrink-0">
          {step === 'review' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {lang === 'bn' ? 'পেছনে' : 'Back'}
              </button>
              <button
                type="button"
                onClick={() => setStep('result')}
                className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold cursor-pointer"
              >
                {lang === 'bn' ? 'তুলনা দেখুন' : 'Compare Now'}
              </button>
            </>
          )}

          {step === 'result' && (
            <>
              <button
                type="button"
                onClick={() => setStep('review')}
                className="h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {lang === 'bn' ? 'সম্পাদনা' : 'Edit'}
              </button>
              <button
                type="button"
                disabled={sharing}
                onClick={() => void handleShareResult()}
                className="h-11 px-4 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                <span>{lang === 'bn' ? 'শেয়ার করুন' : 'Share'}</span>
              </button>
              <button
                type="button"
                disabled={isSaved}
                onClick={() => void handleSaveCheck()}
                className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>
                  {isSaved
                    ? lang === 'bn'
                      ? 'সংরক্ষিত'
                      : 'Saved'
                    : lang === 'bn'
                    ? 'সংরক্ষণ করুন'
                    : 'Save'}
                </span>
              </button>
            </>
          )}

          {step === 'upload' && (
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
