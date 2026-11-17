import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Bell,
  CalendarCheck2,
  Check,
  Clock,
  Mic,
  MicOff,
  RotateCcw,
  Wallet,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type {
  ExpenseCategory,
  MoreSubView,
  NavTab,
  PaymentMethod,
  ProposedVoiceEntry,
} from '../types';
import {
  calculateOvertimeEstimate,
  formatBDT,
  formatNumber,
  getDefaultDateForMonth,
  isFutureDate,
  parseBengaliVoiceEntryLocal,
} from '../utils/calculations';
import { formatDateSlashDMY } from '../utils/i18n';
import { DateInputDMY } from './DateInputDMY';

interface VoiceEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
  onNavigateTab?: (tab: NavTab, sub?: MoreSubView) => void;
}

const ENTRY_TYPE_META: Record<
  ProposedVoiceEntry['entryType'],
  {
    labelBn: string;
    labelEn: string;
    targetTab: NavTab;
    targetSub?: MoreSubView;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  overtime: {
    labelBn: 'ওভারটাইম হিসাব',
    labelEn: 'Overtime Entry',
    targetTab: 'overtime',
    icon: Clock,
  },
  attendance: {
    labelBn: 'হাজিরা ও ছুটি',
    labelEn: 'Attendance Entry',
    targetTab: 'attendance',
    icon: CalendarCheck2,
  },
  expense: {
    labelBn: 'দৈনিক খরচ ও বাজার',
    labelEn: 'Daily Expense',
    targetTab: 'expenses',
    icon: Wallet,
  },
  payment: {
    labelBn: 'প্রাপ্ত বেতন ও জমা',
    labelEn: 'Salary Payment',
    targetTab: 'salary',
    icon: Banknote,
  },
  reminder: {
    labelBn: 'রিমাইন্ডার',
    labelEn: 'Reminder',
    targetTab: 'more',
    targetSub: 'reminders',
    icon: Bell,
  },
};

export const VoiceEntryModal: React.FC<VoiceEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
  onNavigateTab,
}) => {
  const {
    profile,
    selectedMonth,
    todayISO,
    lang,
    saveOvertime,
    saveExpense,
    savePayment,
    saveAttendance,
    saveReminder,
  } = useData();

  const MIC_PERMISSION_STORAGE_KEY = 'shromik_sathi_mic_permission_granted_v1';

  const defaultDate = getDefaultDateForMonth(selectedMonth, todayISO);
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [proposal, setProposal] = useState<ProposedVoiceEntry | null>(null);
  const [speechError, setSpeechError] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MIC_PERMISSION_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const recognitionRef = useRef<any>(null);

  const persistMicPermissionGranted = () => {
    try {
      localStorage.setItem(MIC_PERMISSION_STORAGE_KEY, 'true');
    } catch {
      // ignore storage error
    }
    setHasMicPermission(true);
  };

  const parseAndShowProposal = async (rawText: string) => {
    const clean = rawText.trim();
    if (!clean) return;
    setIsParsing(true);
    setSpeechError('');

    // Immediately compute deterministic local Bengali parse so it works 100% offline with 0ms latency
    const localProposal = parseBengaliVoiceEntryLocal(clean, defaultDate);

    // When offline, skip the network call immediately so voice entry works instantly offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setProposal(localProposal);
      setIsParsing(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const resp = await fetch('/api/gemini/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: clean, currentDate: defaultDate }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const aiResult = await resp.json();
        if (aiResult && aiResult.entryType) {
          setProposal({
            entryType: aiResult.entryType,
            date: aiResult.date || localProposal.date || defaultDate,
            amountOrHours:
              Number(aiResult.amountOrHours) > 0
                ? Number(aiResult.amountOrHours)
                : localProposal.amountOrHours,
            categoryOrStatus:
              aiResult.categoryOrStatus || localProposal.categoryOrStatus || 'other',
            notes: aiResult.notes || clean,
            rawTranscript: clean,
          });
          setIsParsing(false);
          return;
        }
      }
    } catch {
      // Fallback cleanly to deterministic local parser
    }

    setProposal(localProposal);
    setIsParsing(false);
  };

  const stopWebSpeech = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } catch {
      // ignore
    }
    setIsListening(false);
  };

  const startWebSpeech = () => {
    setSpeechError('');
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsListening(false);
      setSpeechError(
        lang === 'bn'
          ? 'আপনার ব্রাউজারে সরাসরি ভয়েস সাপোর্ট না থাকায় নিচের বক্সে বাংলায় লিখুন।'
          : 'Web Speech API is unavailable in this browser. Please type below.'
      );
      return;
    }

    try {
      stopWebSpeech();
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        persistMicPermissionGranted();
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          setSpeechError(
            lang === 'bn'
              ? 'মাইক্রোফোন অনুমতি পাওয়া যায়নি। অনুগ্রহ করে ব্রাউজারে মাইক্রোফোন Allow করুন অথবা নিচের কুইক বাটন/বক্স ব্যবহার করুন।'
              : 'Microphone access was denied. Please allow microphone access or use quick chips/type below.'
          );
          return;
        }
        if (event?.error === 'network') {
          setSpeechError(
            lang === 'bn'
              ? 'অফলাইন ভয়েস এন্ট্রি চালু আছে — কিবোর্ডের ভয়েস মাইক 🎤 বা নিচের ১-ট্যাপ বাটন/বক্সে বলুন বা লিখুন।'
              : 'Offline Voice Entry active — use your keyboard mic or quick buttons/text box below.'
          );
          return;
        }
        setSpeechError(
          lang === 'bn'
            ? 'কণ্ঠস্বর শোনা যায়নি। আবার মাইক্রোফোন বাটনে ট্যাপ করে বলুন অথবা নিচের কুইক বাটন ব্যবহার করুন।'
            : 'Could not capture audio. Please tap the mic button to speak again or use quick buttons below.'
        );
      };
      recognition.onresult = (event: any) => {
        let finalSpoken = '';
        let interimSpoken = '';
        for (let i = 0; i < (event.results?.length || 0); i++) {
          const res = event.results[i];
          const textPiece = res?.[0]?.transcript || '';
          if (res?.isFinal) {
            finalSpoken += textPiece;
          } else {
            interimSpoken += textPiece;
          }
        }
        const combined = (finalSpoken || interimSpoken).trim();
        if (combined) {
          setTranscript(combined);
        }
        if (finalSpoken.trim()) {
          void parseAndShowProposal(finalSpoken.trim());
        }
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleRequestAndAllowMicrophone = async () => {
    setSpeechError('');
    // Start SpeechRecognition directly so Android WebView/Chrome doesn't lock the mic hardware with an extra getUserMedia stream
    persistMicPermissionGranted();
    startWebSpeech();
  };

  // When the user opens Voice Entry ("কণ্ঠস্বরে এন্ট্রি"), check or request microphone access here (never on initial app load).
  // Once enabled once, it stays enabled permanently without asking repeatedly.
  useEffect(() => {
    if (!isOpen) {
      stopWebSpeech();
      return;
    }

    setProposal(null);
    setSpeechError('');

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const checkOrRequestPermissionOnVoiceEntry = async () => {
      let alreadyAllowed = hasMicPermission;

      if (!alreadyAllowed && typeof navigator !== 'undefined' && navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          });
          if (status.state === 'granted') {
            alreadyAllowed = true;
            if (!cancelled) {
              persistMicPermissionGranted();
            }
          }
        } catch {
          // ignore permissions query unsupported
        }
      }

      if (!cancelled) {
        if (alreadyAllowed) {
          timer = setTimeout(() => {
            startWebSpeech();
          }, 80);
        } else {
          // Request microphone access only now that the user opened "কণ্ঠস্বরে এন্ট্রি"
          timer = setTimeout(() => {
            void handleRequestAndAllowMicrophone();
          }, 100);
        }
      }
    };

    void checkOrRequestPermissionOnVoiceEntry();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopWebSpeech();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyzeTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcript.trim()) return;
    await parseAndShowProposal(transcript);
  };


  const isFutureBlockedForProposal =
    proposal &&
    (proposal.entryType === 'overtime' || proposal.entryType === 'attendance') &&
    isFutureDate(proposal.date, todayISO);

  const handleConfirmSave = async () => {
    if (!proposal) return;

    if (isFutureBlockedForProposal) {
      setSpeechError(
        lang === 'bn'
          ? 'আগামী/ভবিষ্যৎ তারিখের ওভারটাইম বা হাজিরা যোগ করা যাবে না। আজ বা পূর্ববর্তী তারিখ নির্বাচন করুন।'
          : 'Cannot record overtime or attendance for a future date.'
      );
      return;
    }

    const month = proposal.date.slice(0, 7);

    if (proposal.entryType === 'overtime') {
      const hours = proposal.amountOrHours > 0 ? proposal.amountOrHours : 2;
      const wageBase =
        profile.otWageBase === 'gross' ? profile.grossSalary : profile.basicSalary;
      const customRate =
        profile.otCalculationMode === 'manual' ? profile.otCustomHourlyRate : undefined;
      const { hourlyRate, estimatedEarnings } = calculateOvertimeEstimate(
        wageBase,
        profile.otDivisor,
        profile.otMultiplier,
        hours,
        customRate
      );
      await saveOvertime({
        date: proposal.date,
        month,
        startTime: '17:00',
        endTime: `${17 + Math.min(6, Math.round(hours))}:00`,
        breakMinutes: 0,
        totalMinutes: Math.round(hours * 60),
        approvedHours: hours,
        basicSalarySnapshot: wageBase,
        divisorSnapshot: profile.otDivisor,
        multiplierSnapshot: profile.otMultiplier,
        hourlyRateSnapshot: hourlyRate,
        estimatedEarnings,
        notes: proposal.notes,
      });
      onSuccessToast(
        lang === 'bn'
          ? `${formatDateSlashDMY(proposal.date, 'bn')} তারিখে ${formatNumber(hours, 'bn', 1)} ঘণ্টা ওভারটাইম সংরক্ষিত হয়েছে`
          : `Saved ${hours}h overtime entry`
      );
    } else if (proposal.entryType === 'payment') {
      const validMethods: PaymentMethod[] = ['cash', 'bkash', 'nagad', 'rocket', 'bank'];
      const method: PaymentMethod = validMethods.includes(proposal.categoryOrStatus as PaymentMethod)
        ? (proposal.categoryOrStatus as PaymentMethod)
        : 'bkash';
      await savePayment({
        month,
        paymentDate: proposal.date,
        amountReceived: proposal.amountOrHours,
        paymentMethod: method,
        isPartial: proposal.amountOrHours < profile.grossSalary,
        referenceNote: proposal.notes,
      });
      onSuccessToast(
        lang === 'bn'
          ? `প্রাপ্ত বেতন ${formatBDT(proposal.amountOrHours, 'bn')} সংরক্ষিত হয়েছে`
          : `Saved payment of ${formatBDT(proposal.amountOrHours, 'en')}`
      );
    } else if (proposal.entryType === 'attendance') {
      await saveAttendance({
        date: proposal.date,
        month,
        status:
          proposal.categoryOrStatus === 'absent'
            ? 'absent'
            : proposal.categoryOrStatus === 'approved_leave'
            ? 'approved_leave'
            : 'present',
        leaveCategory: proposal.categoryOrStatus === 'approved_leave' ? 'casual' : 'none',
        checkIn: '08:00',
        checkOut: '17:00',
        notes: proposal.notes,
      });
      onSuccessToast(
        lang === 'bn'
          ? `${formatDateSlashDMY(proposal.date, 'bn')} তারিখের হাজিরা সংরক্ষিত হয়েছে`
          : 'Attendance saved'
      );
    } else if (proposal.entryType === 'reminder') {
      await saveReminder({
        title: proposal.notes,
        category: 'salary_date',
        dueDate: proposal.date,
        isCompleted: false,
        notes: proposal.rawTranscript,
      });
      onSuccessToast(lang === 'bn' ? 'রিমাইন্ডার সংরক্ষিত হয়েছে' : 'Reminder saved');
    } else {
      const validCategories: ExpenseCategory[] = [
        'food',
        'rent',
        'transport',
        'family',
        'medical',
        'education',
        'other',
      ];
      const cat: ExpenseCategory = validCategories.includes(
        proposal.categoryOrStatus as ExpenseCategory
      )
        ? (proposal.categoryOrStatus as ExpenseCategory)
        : 'food';
      await saveExpense({
        date: proposal.date,
        month,
        category: cat,
        amount: proposal.amountOrHours,
        description: proposal.notes,
      });
      onSuccessToast(
        lang === 'bn'
          ? `খরচ ${formatBDT(proposal.amountOrHours, 'bn')} সংরক্ষিত হয়েছে`
          : `Expense ${formatBDT(proposal.amountOrHours, 'en')} saved`
      );
    }

    const meta = ENTRY_TYPE_META[proposal.entryType];
    setProposal(null);
    setTranscript('');
    onClose();

    if (onNavigateTab && meta) {
      onNavigateTab(meta.targetTab, meta.targetSub);
    }
  };


  const renderCategorySelect = () => {
    if (!proposal) return null;

    if (proposal.entryType === 'attendance') {
      return (
        <select
          data-testid="voice-proposal-category-select"
          aria-label="হাজিরার অবস্থা"
          value={proposal.categoryOrStatus}
          onChange={(e) => setProposal({ ...proposal, categoryOrStatus: e.target.value })}
          className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold text-slate-900 dark:text-white"
        >
          <option value="present">{lang === 'bn' ? 'উপস্থিত (হাজির)' : 'Present'}</option>
          <option value="approved_leave">{lang === 'bn' ? 'অনুমোদিত ছুটি' : 'Approved Leave'}</option>
          <option value="absent">{lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}</option>
        </select>
      );
    }

    if (proposal.entryType === 'expense') {
      return (
        <select
          data-testid="voice-proposal-category-select"
          aria-label="খরচের খাত"
          value={proposal.categoryOrStatus}
          onChange={(e) => setProposal({ ...proposal, categoryOrStatus: e.target.value })}
          className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold text-slate-900 dark:text-white"
        >
          <option value="food">{lang === 'bn' ? 'বাজার সদাই ও খাবার' : 'Bazar & Food'}</option>
          <option value="rent">{lang === 'bn' ? 'বাসা ভাড়া ও বিল' : 'House Rent & Bills'}</option>
          <option value="transport">{lang === 'bn' ? 'যাতায়াত ভাড়া' : 'Transport'}</option>
          <option value="family">{lang === 'bn' ? 'পরিবার ও বাড়িতে পাঠানো' : 'Family'}</option>
          <option value="medical">{lang === 'bn' ? 'চিকিৎসা ও ওষুধ' : 'Medical'}</option>
          <option value="education">{lang === 'bn' ? 'শিক্ষা খরচ' : 'Education'}</option>
          <option value="other">{lang === 'bn' ? 'অন্যান্য খরচ' : 'Other'}</option>
        </select>
      );
    }

    if (proposal.entryType === 'payment') {
      return (
        <select
          data-testid="voice-proposal-category-select"
          aria-label="পেমেন্ট মাধ্যম"
          value={proposal.categoryOrStatus}
          onChange={(e) => setProposal({ ...proposal, categoryOrStatus: e.target.value })}
          className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold text-slate-900 dark:text-white"
        >
          <option value="bkash">{lang === 'bn' ? 'বিকাশ' : 'bKash'}</option>
          <option value="nagad">{lang === 'bn' ? 'নগদ' : 'Nagad'}</option>
          <option value="cash">{lang === 'bn' ? 'হাতে নগদ' : 'Cash'}</option>
          <option value="rocket">{lang === 'bn' ? 'রকেট' : 'Rocket'}</option>
          <option value="bank">{lang === 'bn' ? 'ব্যাংক' : 'Bank'}</option>
        </select>
      );
    }

    return (
      <input
        type="text"
        data-testid="voice-proposal-category-input"
        aria-label="বিভাগ"
        value={
          proposal.entryType === 'overtime'
            ? lang === 'bn'
              ? 'ওভারটাইম ঘণ্টা'
              : 'Overtime Hours'
            : proposal.categoryOrStatus
        }
        readOnly={proposal.entryType === 'overtime'}
        onChange={(e) => setProposal({ ...proposal, categoryOrStatus: e.target.value })}
        className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200"
      />
    );
  };

  const ProposalIcon = proposal ? ENTRY_TYPE_META[proposal.entryType].icon : Mic;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="voice-entry-modal"
      aria-label={lang === 'bn' ? 'কণ্ঠস্বর এন্ট্রি' : 'Voice Entry'}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 pt-3 pb-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div
          aria-hidden="true"
          className="sm:hidden w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-3"
        />

        <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {lang === 'bn' ? 'কণ্ঠস্বর এন্ট্রি' : 'Voice Entry'}
            </h2>
          </div>
          <button
            type="button"
            data-testid="close-voice-modal-btn"
            onClick={() => {
              stopWebSpeech();
              onClose();
            }}
            aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            className="min-h-[44px] min-w-[44px] -mr-1.5 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!proposal ? (
          <form onSubmit={handleAnalyzeTranscript} className="mt-5 space-y-5">
            <div className="flex flex-col items-center justify-center py-2">
              <button
                type="button"
                data-testid="voice-mic-toggle-btn"
                aria-label={
                  isListening
                    ? lang === 'bn'
                      ? 'শোনা বন্ধ করুন'
                      : 'Stop listening'
                    : lang === 'bn'
                    ? 'মাইক্রোফোনে কথা বলুন'
                    : 'Speak with microphone'
                }
                onClick={() => {
                  if (isListening) {
                    stopWebSpeech();
                  } else if (!hasMicPermission) {
                    void handleRequestAndAllowMicrophone();
                  } else {
                    startWebSpeech();
                  }
                }}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40 ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 text-white ring-8 ring-rose-500/15 shadow-md'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white ring-8 ring-emerald-600/10 shadow-sm'
                }`}
              >
                {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>
              <span
                data-testid="voice-auto-mic-status"
                className={`mt-3 text-xs font-medium ${
                  isListening
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {isListening
                  ? lang === 'bn'
                    ? 'শুনছে... কথা বলুন'
                    : 'Listening... speak now'
                  : !hasMicPermission
                  ? lang === 'bn'
                    ? 'মাইক্রোফোন চালু করতে ট্যাপ করুন'
                    : 'Tap icon to allow & speak'
                  : lang === 'bn'
                  ? 'কথা বলতে আইকনে ট্যাপ করুন'
                  : 'Tap icon to speak'}
              </span>
            </div>

            {speechError && (
              <div
                data-testid="voice-speech-notice"
                className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl px-3 py-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>{speechError}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="voice-transcript-input"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {lang === 'bn'
                    ? 'কণ্ঠস্বর বা লিখে এন্ট্রি করুন (অফলাইনেও সচল)'
                    : 'Voice or text entry (works offline)'}
                </label>
                <span
                  data-testid="offline-voice-ready-badge"
                  className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                >
                  {lang === 'bn' ? 'অফলাইন ভয়েস রেডি' : 'Offline Ready'}
                </span>
              </div>
              <textarea
                id="voice-transcript-input"
                data-testid="voice-transcript-input"
                rows={2}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'যেমন: আজ ২ ঘণ্টা ওভারটাইম / আজ উপস্থিত / বাজার ২৫০ টাকা'
                    : 'e.g., 2 hours overtime today / present today / food 250'
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600 transition-colors"
              />

              {/* 1-Tap Offline Quick Voice Phrases for Garment Workers */}
              <div className="mt-2.5">
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  {lang === 'bn'
                    ? 'অফলাইন ১-ট্যাপ দ্রুত কমান্ড:'
                    : 'Offline 1-Tap Quick Commands:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'আজ ২ ঘণ্টা ওভারটাইম', cmd: 'আজ ২ ঘণ্টা ওভারটাইম করেছি' },
                    { label: 'আজ ৩ ঘণ্টা ওভারটাইম', cmd: 'আজ ৩ ঘণ্টা ওভারটাইম করেছি' },
                    { label: 'আজ উপস্থিত (হাজির)', cmd: 'আজ উপস্থিত হাজিরা' },
                    { label: 'বাজার ২০০ টাকা', cmd: 'আজ বাজার ২০০ টাকা খরচ' },
                    { label: 'গাড়ি ভাড়া ৫০ টাকা', cmd: 'আজ রিকশা ভাড়া ৫০ টাকা' },
                  ].map((chip) => (
                    <button
                      key={chip.cmd}
                      type="button"
                      onClick={() => {
                        setTranscript(chip.cmd);
                        void parseAndShowProposal(chip.cmd);
                      }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                data-testid="voice-analyze-btn"
                disabled={!transcript.trim() || isParsing}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <span>
                  {isParsing
                    ? lang === 'bn'
                      ? 'যাচাই হচ্ছে...'
                      : 'Checking...'
                    : lang === 'bn'
                    ? 'যাচাই করুন'
                    : 'Review'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <div data-testid="voice-confirmation-screen" className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ProposalIcon className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {lang === 'bn'
                    ? ENTRY_TYPE_META[proposal.entryType].labelBn
                    : ENTRY_TYPE_META[proposal.entryType].labelEn}
                </span>
              </div>
              <span
                data-testid="voice-confirmed-date-badge"
                className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0"
              >
                {formatDateSlashDMY(proposal.date, lang)}
              </span>
            </div>

            {isFutureBlockedForProposal && (
              <div
                data-testid="voice-future-date-warning"
                className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {lang === 'bn'
                    ? 'ভবিষ্যৎ তারিখের ওভারটাইম বা হাজিরা যোগ করা যাবে না।'
                    : 'Future date overtime/attendance cannot be added.'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'bn' ? 'হিসাবের ধরন' : 'Entry Type'}
                </label>
                <select
                  data-testid="voice-proposal-type-select"
                  aria-label="হিসাবের ধরন"
                  value={proposal.entryType}
                  onChange={(e) => {
                    const nextType = e.target.value as ProposedVoiceEntry['entryType'];
                    const defaultCat =
                      nextType === 'attendance'
                        ? 'present'
                        : nextType === 'expense'
                        ? 'food'
                        : nextType === 'payment'
                        ? 'bkash'
                        : nextType === 'overtime'
                        ? 'overtime'
                        : 'salary_date';
                    setProposal({
                      ...proposal,
                      entryType: nextType,
                      categoryOrStatus: defaultCat,
                    });
                  }}
                  className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold text-slate-900 dark:text-white"
                >
                  <option value="overtime">{lang === 'bn' ? 'ওভারটাইম হিসাব' : 'Overtime'}</option>
                  <option value="attendance">{lang === 'bn' ? 'হাজিরা ও ছুটি' : 'Attendance'}</option>
                  <option value="expense">{lang === 'bn' ? 'দৈনিক খরচ ও বাজার' : 'Expense'}</option>
                  <option value="payment">{lang === 'bn' ? 'প্রাপ্ত বেতন জমা' : 'Salary Payment'}</option>
                  <option value="reminder">{lang === 'bn' ? 'রিমাইন্ডার' : 'Reminder'}</option>
                </select>
              </div>

              {proposal.entryType !== 'attendance' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {proposal.entryType === 'overtime'
                      ? lang === 'bn'
                        ? 'ওভারটাইম ঘণ্টা'
                        : 'Overtime Hours'
                      : lang === 'bn'
                      ? 'টাকার পরিমাণ (৳)'
                      : 'Amount (BDT)'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    data-testid="voice-proposal-amount-input"
                    aria-label="পরিমাণ বা ঘণ্টা"
                    value={proposal.amountOrHours}
                    onChange={(e) =>
                      setProposal({ ...proposal, amountOrHours: Number(e.target.value) || 0 })
                    }
                    className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'তারিখ' : 'Date'}
                </label>
                <DateInputDMY
                  dataTestId="voice-proposal-date-input"
                  ariaLabel="প্রস্তাবিত তারিখ"
                  value={proposal.date}
                  max={
                    proposal.entryType === 'overtime' || proposal.entryType === 'attendance'
                      ? todayISO
                      : undefined
                  }
                  lang={lang}
                  onChange={(val) => setProposal({ ...proposal, date: val })}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {proposal.entryType === 'attendance'
                    ? lang === 'bn'
                      ? 'হাজিরার অবস্থা'
                      : 'Attendance Status'
                    : proposal.entryType === 'payment'
                    ? lang === 'bn'
                      ? 'টাকা প্রাপ্তির মাধ্যম'
                      : 'Payment Method'
                    : lang === 'bn'
                    ? 'বিভাগ / খাত'
                    : 'Category'}
                </label>
                {renderCategorySelect()}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {lang === 'bn' ? 'বিবরণ' : 'Notes'}
              </label>
              <input
                type="text"
                data-testid="voice-proposal-notes-input"
                aria-label="বিবরণ"
                value={proposal.notes}
                onChange={(e) => setProposal({ ...proposal, notes: e.target.value })}
                className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                data-testid="voice-back-edit-btn"
                onClick={() => {
                  setProposal(null);
                  startWebSpeech();
                }}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'আবার বলুন' : 'Speak Again'}</span>
              </button>
              <button
                type="button"
                data-testid="voice-confirm-save-btn"
                disabled={Boolean(isFutureBlockedForProposal)}
                onClick={handleConfirmSave}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>{lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
