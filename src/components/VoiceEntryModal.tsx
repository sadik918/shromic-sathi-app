import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Mic, MicOff, RotateCcw, Sparkles, X } from 'lucide-react';
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
  { labelBn: string; labelEn: string; targetLabelBn: string; targetTab: NavTab; targetSub?: MoreSubView }
> = {
  overtime: {
    labelBn: 'ওভারটাইম হিসাব',
    labelEn: 'Overtime Entry',
    targetLabelBn: 'ওভারটাইম পাতা',
    targetTab: 'overtime',
  },
  attendance: {
    labelBn: 'হাজিরা ও ছুটি',
    labelEn: 'Attendance Entry',
    targetLabelBn: 'হাজিরা ক্যালেন্ডার পাতা',
    targetTab: 'attendance',
  },
  expense: {
    labelBn: 'দৈনিক খরচ ও বাজার',
    labelEn: 'Daily Expense',
    targetLabelBn: 'হিসাব ও খরচ পাতা',
    targetTab: 'expenses',
  },
  payment: {
    labelBn: 'প্রাপ্ত বেতন ও জমা',
    labelEn: 'Salary Payment',
    targetLabelBn: 'বেতন ও পে-স্লিপ পাতা',
    targetTab: 'salary',
  },
  reminder: {
    labelBn: 'রিমাইন্ডার',
    labelEn: 'Reminder',
    targetLabelBn: 'রিমাইন্ডার পাতা',
    targetTab: 'more',
    targetSub: 'reminders',
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

    // Immediately compute deterministic local Bengali parse so it's instant & reliable
    const localProposal = parseBengaliVoiceEntryLocal(clean, defaultDate);

    try {
      const resp = await fetch('/api/gemini/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: clean, currentDate: defaultDate }),
      });

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
      recognition.interimResults = false;
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
              ? 'মাইক্রোফোন অনুমতি পাওয়া যায়নি। অনুগ্রহ করে ব্রাউজারে মাইক্রোফোন Allow করুন অথবা নিচে লিখুন।'
              : 'Microphone access was denied. Please allow microphone access or type below.'
          );
          return;
        }
        setSpeechError(
          lang === 'bn'
            ? 'কণ্ঠস্বর শোনা যায়নি। আবার মাইক্রোফোন বাটনে ট্যাপ করে বলুন অথবা বাংলায় লিখুন।'
            : 'Could not capture audio. Please tap the mic button to speak again or type below.'
        );
      };
      recognition.onresult = (event: any) => {
        const spoken = event.results?.[0]?.[0]?.transcript || '';
        if (spoken) {
          setTranscript(spoken);
          void parseAndShowProposal(spoken);
        }
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleRequestAndAllowMicrophone = async () => {
    setSpeechError('');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release the test audio stream tracks immediately so SpeechRecognition can use the mic cleanly
        stream.getTracks().forEach((track) => track.stop());
      }
      persistMicPermissionGranted();
      startWebSpeech();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setSpeechError(
          lang === 'bn'
            ? 'মাইক্রোফোন অনুমতি পাওয়া যায়নি। কথা বলতে চাইলে অনুগ্রহ করে মাইক্রোফোন Allow করুন অথবা নিচে লিখুন।'
            : 'Microphone permission was not granted. Please allow microphone access to speak, or type below.'
        );
        return;
      }
      // If getUserMedia is unavailable in this frame/browser, fall back to Web Speech API directly
      persistMicPermissionGranted();
      startWebSpeech();
    }
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="voice-entry-modal"
      aria-label={lang === 'bn' ? 'বাংলা কণ্ঠস্বর এন্ট্রি' : 'Bengali Voice Entry'}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'বাংলা কণ্ঠস্বর ও দ্রুত এন্ট্রি' : 'Bengali Voice & Quick Entry'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'bn'
                ? 'কথা বলুন বা বাক্য নির্বাচন করুন — অটোমেটিক তারিখ ও হিসাব শনাক্ত হবে'
                : 'Speak or select a phrase — date and category are detected automatically'}
            </p>
          </div>
          <button
            type="button"
            data-testid="close-voice-modal-btn"
            onClick={() => {
              stopWebSpeech();
              onClose();
            }}
            aria-label="বন্ধ করুন"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!proposal ? (
          <form onSubmit={handleAnalyzeTranscript} className="mt-4 space-y-4">
            {!hasMicPermission && (
              <div
                data-testid="voice-mic-permission-banner"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70"
              >
                <div className="text-xs text-indigo-950 dark:text-indigo-200">
                  <p className="font-bold">
                    {lang === 'bn'
                      ? 'কণ্ঠস্বরে এন্ট্রির জন্য মাইক্রোফোন এক্সেস প্রয়োজন'
                      : 'Microphone access required for Voice Entry'}
                  </p>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                    {lang === 'bn'
                      ? 'একবার এলাও (Allow) করলে পরবর্তীতে স্বয়ংক্রিয়ভাবে চালু থাকবে, বারবার চাইবে না।'
                      : 'Once enabled, microphone access stays enabled automatically.'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="voice-mic-allow-once-btn"
                  onClick={() => void handleRequestAndAllowMicrophone()}
                  className="shrink-0 min-h-[38px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'মাইক্রোফোন এলাও করুন' : 'Allow Microphone'}</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70">
              <button
                type="button"
                data-testid="voice-mic-toggle-btn"
                onClick={() => {
                  if (isListening) {
                    stopWebSpeech();
                  } else if (!hasMicPermission) {
                    void handleRequestAndAllowMicrophone();
                  } else {
                    startWebSpeech();
                  }
                }}
                className={`min-h-[44px] px-4 rounded-xl font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors ${
                  isListening
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>
                  {isListening
                    ? lang === 'bn'
                      ? 'মাইক্রোফোন চালু আছে... বলুন'
                      : 'Listening... Speak now'
                    : !hasMicPermission
                    ? lang === 'bn'
                      ? 'মাইক্রোফোন এক্সেস দিন ও কথা বলুন'
                      : 'Enable Mic & Speak'
                    : lang === 'bn'
                    ? 'মাইক্রোফোন চালু করুন'
                    : 'Start Microphone'}
                </span>
              </button>
              <span
                data-testid="voice-auto-mic-status"
                className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300"
              >
                {isListening
                  ? lang === 'bn'
                    ? 'সরাসরি বাংলা কণ্ঠস্বর শুনছে'
                    : 'Auto-listening active'
                  : hasMicPermission
                  ? lang === 'bn'
                    ? 'মাইক্রোফোন সক্রিয় আছে — কথা বলুন বা ট্যাপ করুন'
                    : 'Mic enabled — speak or tap below'
                  : lang === 'bn'
                  ? 'কথা বলতে মাইক্রোফোন এলাও করুন'
                  : 'Allow mic to speak'}
              </span>
            </div>

            {speechError && (
              <p
                data-testid="voice-speech-notice"
                className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3"
              >
                {speechError}
              </p>
            )}


            <div>
              <label
                htmlFor="voice-transcript-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {lang === 'bn' ? 'কী হিসাব যোগ করতে চান?' : 'What would you like to record?'}
              </label>
              <textarea
                id="voice-transcript-input"
                data-testid="voice-transcript-input"
                rows={2}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'উদাহরণ: আজ ৩ ঘণ্টা ওভারটাইম করেছি অথবা খাবার খরচ ২৫০ টাকা'
                    : 'Example: 3 hours overtime today or food expense 250 taka'
                }
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                {lang === 'bn' ? 'বাতিল করুন' : 'Cancel'}
              </button>
              <button
                type="submit"
                data-testid="voice-analyze-btn"
                disabled={!transcript.trim() || isParsing}
                className="min-h-[42px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isParsing
                    ? lang === 'bn'
                      ? 'শনাক্ত করা হচ্ছে...'
                      : 'Analyzing...'
                    : lang === 'bn'
                    ? 'হিসাব যাচাই ও নিশ্চিত করুন'
                    : 'Review Entry'}
                </span>
              </button>
            </div>
          </form>
        ) : (
          <div data-testid="voice-confirmation-screen" className="mt-4 space-y-4">
            <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-200/60 dark:border-emerald-800/60">
                <div>
                  <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200 block">
                    {lang === 'bn'
                      ? 'নিশ্চিতকরণ স্ক্রিন (স্বয়ংক্রিয় শনাক্তকৃত হিসাব)'
                      : 'Proposed Entry Confirmation'}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {lang === 'bn'
                      ? `সংরক্ষণের পর গন্তব্য: ${ENTRY_TYPE_META[proposal.entryType].targetLabelBn}`
                      : `Navigates to: ${ENTRY_TYPE_META[proposal.entryType].labelEn}`}
                  </span>
                </div>
                <span
                  data-testid="voice-confirmed-date-badge"
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums"
                >
                  {formatDateSlashDMY(proposal.date, lang)}
                </span>
              </div>

              {isFutureBlockedForProposal && (
                <div
                  data-testid="voice-future-date-warning"
                  className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {lang === 'bn'
                      ? 'ভবিষ্যৎ তারিখের ওভারটাইম বা হাজিরা যোগ করা যাবে না। আজ বা আগের তারিখ দিন।'
                      : 'Future date overtime/attendance cannot be added.'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                    className="mt-1 w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-white"
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
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'তারিখ (দিন/মাস/বছর)' : 'Date (DD/MM/YYYY)'}
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'বিবরণ / নোট' : 'Notes'}
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
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                data-testid="voice-back-edit-btn"
                onClick={() => {
                  setProposal(null);
                  startWebSpeech();
                }}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'আবার বলুন / পরিবর্তন' : 'Speak Again'}</span>
              </button>
              <button
                type="button"
                data-testid="voice-confirm-save-btn"
                disabled={Boolean(isFutureBlockedForProposal)}
                onClick={handleConfirmSave}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>
                  {lang === 'bn'
                    ? 'নিশ্চিত ও সংরক্ষণ করুন'
                    : 'Confirm & Save'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
