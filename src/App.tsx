import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  Home,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  UserPlus,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import { DataProvider, useData } from './context/DataContext';
import {
  DEMO_READ_ONLY_BANNER_BN,
  DEMO_READ_ONLY_BANNER_EN,
  DEMO_SAMPLE_DATA_BADGE,
} from './utils/demoData';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BrandWordmark } from './components/BrandWordmark';
import { AuthWelcomeView } from './components/AuthWelcomeView';
import { OnboardingView } from './components/OnboardingView';
import { DashboardView } from './components/DashboardView';
import { OvertimeView } from './components/OvertimeView';
import { SalaryView } from './components/SalaryView';
import { AttendanceView } from './components/AttendanceView';
import { ExpensesView } from './components/ExpensesView';
import { MoreHubView } from './components/MoreHubView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { VoiceEntryModal } from './components/VoiceEntryModal';
import { AlarmRingingOverlay, loadSavedAlarms } from './components/AlarmView';
import { getCustomToneFromStorage, playAlarmTone, stopAlarmSound } from './utils/alarmAudio';
import { getAccurateBstNow, syncOnlineAccurateTime } from './utils/networkTime';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type { AlarmItem, MoreSubView, NavTab } from './types';
import { formatShortMonthName, T } from './utils/i18n';
import { parseCalendarReminderMeta } from './utils/calendarReminders';
import { toBengaliDigits } from './utils/subscriptionLogic';

const AVAILABLE_MONTHS = [
  '2027-03',
  '2027-02',
  '2027-01',
  '2026-12',
  '2026-11',
  '2026-10',
  '2026-09',
  '2026-08',
  '2026-07',
  '2026-06',
  '2026-05',
  '2026-04',
  '2026-03',
  '2026-02',
  '2026-01',
];

const WorkspaceShell: React.FC = () => {
  const {
    user,
    authReady,
    isDemoMode,
    isReadOnlyDemo,
    readOnlyBlockedNotice,
    dismissReadOnlyNotice,
    exitDemoMode,
    exitDemoToSignUp,
    needsOnboarding,
    pendingWritesCount,
    selectedMonth,
    setSelectedMonth,
    darkMode,
    toggleDarkMode,
    lang,
    setLang,
    reminders,
    isAdminUser,
    subscriptionRenewalNotice,
  } = useData();

  const { syncState } = useOnlineStatus(pendingWritesCount);
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'admin' || params.get('tab') === 'admin') {
        return 'admin';
      }
    }
    return 'dashboard';
  });
  const [moreSubView, setMoreSubView] = useState<MoreSubView>('profile');
  const [moreMenuTrigger, setMoreMenuTrigger] = useState(0);
  const [renewalModalTrigger, setRenewalModalTrigger] = useState(0);
  const [attendanceFocusDate, setAttendanceFocusDate] = useState<string | undefined>(undefined);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [lastTriggeredKey, setLastTriggeredKey] = useState<string>('');

  // Synchronize online accurate time on startup and periodically
  useEffect(() => {
    syncOnlineAccurateTime();
    const syncTimer = setInterval(() => {
      syncOnlineAccurateTime();
    }, 120000);
    return () => clearInterval(syncTimer);
  }, []);

  // Global Alarm Interval Check (checks every 2.5s using accurate online-synced Bangladesh Standard Time)
  useEffect(() => {
    const checkAlarms = async () => {
      const bstNow = getAccurateBstNow();
      const currentDay = bstNow.dayOfWeek;
      const currentTimeStr = bstNow.time24;
      const triggerKey = `${bstNow.dateISO}_${currentTimeStr}`;

      if (triggerKey === lastTriggeredKey) return;

      const alarms = loadSavedAlarms();
      const matching = alarms.find(
        (a) => a.isEnabled && a.time === currentTimeStr && a.repeatDays.includes(currentDay)
      );

      if (matching) {
        setLastTriggeredKey(triggerKey);
        setRingingAlarm(matching);
        let customUrl: string | undefined;
        if (matching.toneId === 'custom_device' && matching.customToneId) {
          const stored = await getCustomToneFromStorage(matching.customToneId);
          customUrl = stored?.dataUrl;
        }
        playAlarmTone(matching.toneId, customUrl, true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([400, 200, 400, 200, 400]);
        }
        return;
      }

      // Also check Calendar Notes / Reminders with Advance Alarm enabled
      const matchingCalRem = reminders.find((r) => {
        if (r.isCompleted) return false;
        const parsed = parseCalendarReminderMeta(r);
        return (
          parsed.alarmEnabled &&
          parsed.triggerDate === bstNow.dateISO &&
          parsed.triggerTime === currentTimeStr
        );
      });

      if (matchingCalRem) {
        const parsed = parseCalendarReminderMeta(matchingCalRem);
        setLastTriggeredKey(triggerKey);
        const remAlarmItem: AlarmItem = {
          id: `cal_rem_${matchingCalRem.id}`,
          time: parsed.triggerTime,
          label: `${matchingCalRem.title}${parsed.cleanNotes ? ` — ${parsed.cleanNotes}` : ''} (${parsed.offsetLabelBn})`,
          isEnabled: true,
          repeatDays: [currentDay],
          toneId: parsed.toneId,
        };
        setRingingAlarm(remAlarmItem);
        playAlarmTone(parsed.toneId, undefined, true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([400, 200, 400, 200, 400]);
        }
      }
    };

    const interval = setInterval(checkAlarms, 2500);
    return () => clearInterval(interval);
  }, [lastTriggeredKey, reminders]);

  const handleDismissRingingAlarm = () => {
    stopAlarmSound();
    setRingingAlarm(null);
  };

  const handleSnoozeRingingAlarm = (minutes = 5) => {
    const current = ringingAlarm;
    stopAlarmSound();
    setRingingAlarm(null);
    showToast(lang === 'bn' ? `অ্যালার্ম ${minutes} মিনিটের জন্য স্নুজ করা হয়েছে` : `Alarm snoozed for ${minutes} min`);
    setTimeout(async () => {
      if (current) {
        setRingingAlarm(current);
        let customUrl: string | undefined;
        if (current.toneId === 'custom_device' && current.customToneId) {
          const stored = await getCustomToneFromStorage(current.customToneId);
          customUrl = stored?.dataUrl;
        }
        playAlarmTone(current.toneId, customUrl, true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([400, 200, 400, 200, 400]);
        }
      }
    }, minutes * 60 * 1000);
  };

  const dict = T[lang];

  const handleNavigate = (tab: NavTab, sub?: MoreSubView, targetDateISO?: string) => {
    if (targetDateISO && /^\d{4}-\d{2}-\d{2}$/.test(targetDateISO)) {
      const targetM = targetDateISO.slice(0, 7);
      if (targetM !== selectedMonth) {
        setSelectedMonth(targetM);
      }
      setAttendanceFocusDate(targetDateISO);
    }
    setActiveTab(tab);
    if (sub) {
      setMoreSubView(sub);
    } else if (tab === 'more') {
      setMoreMenuTrigger((prev) => prev + 1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  if (!authReady && !isDemoMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-sm font-medium">
        <div className="w-16 h-16 rounded-full bg-white p-1 shadow-xs border border-emerald-100 dark:border-slate-700 flex items-center justify-center">
          <img
            src="/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png"
            alt="শ্রমিক সাথী লোগো"
            width={60}
            height={60}
            decoding="async"
            className="w-full h-full object-contain"
          />
        </div>
        <span>লোড হচ্ছে... (Loading Shromik Sathi...)</span>
      </div>
    );
  }

  if (!user && !isDemoMode) {
    return <AuthWelcomeView />;
  }

  if (needsOnboarding) {
    return <OnboardingView />;
  }

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: dict.navDashboard, icon: <Home className="w-5 h-5" /> },
    { id: 'overtime', label: dict.navOvertime, icon: <Clock className="w-5 h-5" /> },
    { id: 'salary', label: dict.navSalary, icon: <Banknote className="w-5 h-5" /> },
    { id: 'attendance', label: dict.navAttendance, icon: <Calendar className="w-5 h-5" /> },
    { id: 'expenses', label: dict.navExpenses, icon: <Wallet className="w-5 h-5" /> },
    { id: 'more', label: dict.navMore, icon: <Menu className="w-5 h-5" /> },
    ...(isAdminUser
      ? [
          {
            id: 'admin' as NavTab,
            label: lang === 'bn' ? 'অ্যাডমিন প্যানেল' : 'Admin Panel',
            icon: <ShieldCheck className="w-5 h-5" />,
          },
        ]
      : []),
  ];

  // Strictly 4-tab mobile bottom navigation for garment workers
  const mobileNavItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: dict.navDashboard, icon: <Home className="w-5 h-5" /> },
    { id: 'overtime', label: dict.navOvertime, icon: <Clock className="w-5 h-5" /> },
    { id: 'attendance', label: dict.navAttendance, icon: <Calendar className="w-5 h-5" /> },
    { id: 'more', label: dict.navMore, icon: <Menu className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-20 md:pb-8">
      {/* Top Navigation Bar: Logo + App Title on Left, Desktop Nav in Center, Month + Lang Icon + Theme Icon on Right */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 no-print">
        <div className="max-w-6xl mx-auto h-full px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-6">
          {/* Zone 1: Brand Emblem + Wordmark + Subtle Sync Status Dot */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
            <a
              href="#dashboard"
              data-testid="header-brand-link"
              aria-label={dict.appTitle}
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('dashboard');
              }}
              className="inline-flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0"
            >
              <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/80 p-0.5 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src="/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png"
                  alt="শ্রমিক সাথী লোগো"
                  data-testid="header-brand-logo"
                  width={32}
                  height={32}
                  decoding="async"
                  className="w-full h-full object-contain rounded-full"
                />
              </span>
              <BrandWordmark size="header" dataTestId="header-brand-wordmark" />
            </a>

            <span
              title={
                syncState === 'offline'
                  ? dict.syncOffline
                  : syncState === 'syncing'
                  ? dict.syncPending
                  : dict.syncSynced
              }
              className="inline-flex items-center justify-center shrink-0"
            >
              {syncState === 'offline' ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              ) : syncState === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 text-sky-500 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
            </span>
          </div>

          {/* Zone 2: Desktop single-line navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`nav-${item.id}`}
                onClick={() => handleNavigate(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  activeTab === item.id
                    ? 'border-emerald-700 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 font-bold'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Compact Month Badge (অক্টোবর) + Language Icon + Dark/Light Mode Icon */}
          <div
            data-testid="header-quick-controls"
            className="flex items-center gap-1 sm:gap-2 shrink-0"
          >
            {/* 1. Compact Month Selector (shows short month name e.g. অক্টোবর) */}
            <div className="h-8 sm:h-9 px-1.5 sm:px-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 inline-flex items-center gap-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <label htmlFor="global-month-select" className="sr-only">
                {lang === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Month'}
              </label>
              <select
                id="global-month-select"
                aria-label={lang === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Month'}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-emerald-950 dark:text-emerald-200 focus:outline-none cursor-pointer pr-0.5"
              >
                {AVAILABLE_MONTHS.map((m) => (
                  <option
                    key={m}
                    value={m}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {formatShortMonthName(m, lang)}
                  </option>
                ))}
              </select>
            </div>

            {/* Admin Quick-Toggle Button (Visible to Super Admin / Admin) */}
            {isAdminUser && (
              <button
                type="button"
                data-testid="header-admin-btn"
                onClick={() =>
                  handleNavigate(activeTab === 'admin' ? 'dashboard' : 'admin')
                }
                aria-label={lang === 'bn' ? 'অ্যাডমিন ড্যাশবোর্ড' : 'Admin Dashboard'}
                title={lang === 'bn' ? 'অ্যাডমিন ড্যাশবোর্ড' : 'Admin Dashboard'}
                className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 transition-colors shrink-0 ${
                  activeTab === 'admin'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                    : 'bg-emerald-50/90 hover:bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden min-[360px]:inline">
                  {lang === 'bn' ? 'অ্যাডমিন' : 'Admin'}
                </span>
              </button>
            )}

            {/* 2. Language Toggle (Icon Only) */}
            <button
              type="button"
              data-testid="header-lang-toggle-btn"
              onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
              aria-label={lang === 'bn' ? 'Switch to English' : 'বাংলায় পরিবর্তন করুন'}
              title={lang === 'bn' ? 'Switch to English' : 'বাংলায় পরিবর্তন করুন'}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100/90 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0"
            >
              <Globe className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </button>

            {/* 3. Dark / Light Theme Toggle (Icon Only) */}
            <button
              type="button"
              data-testid="header-theme-toggle-btn"
              onClick={toggleDarkMode}
              aria-label={
                darkMode
                  ? lang === 'bn'
                    ? 'লাইট মোড চালু করুন'
                    : 'Switch to Light Mode'
                  : lang === 'bn'
                  ? 'ডার্ক মোড চালু করুন'
                  : 'Switch to Dark Mode'
              }
              title={
                darkMode
                  ? lang === 'bn'
                    ? 'লাইট মোড চালু করুন'
                    : 'Switch to Light Mode'
                  : lang === 'bn'
                  ? 'ডার্ক মোড চালু করুন'
                  : 'Switch to Dark Mode'
              }
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100/90 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Persistent Read-Only Demo Mode Banner */}
      {isReadOnlyDemo && (
        <div
          data-testid="readonly-demo-banner"
          role="region"
          aria-label="Read-Only Demo Mode"
          className="bg-amber-50/95 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800/80 px-3 sm:px-6 py-2.5 no-print"
        >
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-950 dark:text-amber-100">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-bold text-[11px] shrink-0">
                <Eye className="w-3 h-3 shrink-0" />
                <span>{DEMO_SAMPLE_DATA_BADGE}</span>
              </span>
              <span className="font-semibold">
                {lang === 'bn' ? DEMO_READ_ONLY_BANNER_BN : DEMO_READ_ONLY_BANNER_EN}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="demo-create-account-btn"
                onClick={exitDemoToSignUp}
                className="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'bn' ? 'নিজের অ্যাকাউন্ট খুলুন' : 'Create Personal Account'}</span>
              </button>

              <button
                type="button"
                data-testid="exit-demo-btn"
                onClick={exitDemoMode}
                className="min-h-[34px] px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'bn' ? 'ডেমো বন্ধ করুন' : 'Exit Demo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Read-Only Blocked Write Notice Banner */}
      {readOnlyBlockedNotice && (
        <div
          role="alert"
          data-testid="readonly-blocked-banner"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-lg rounded-2xl bg-rose-900/95 text-white px-4 py-3 text-xs font-semibold shadow-xl border border-rose-700 flex items-center justify-between gap-3 no-print"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{readOnlyBlockedNotice}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={exitDemoToSignUp}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] whitespace-nowrap cursor-pointer"
            >
              {lang === 'bn' ? 'নিজের অ্যাকাউন্ট খুলুন' : 'Sign Up'}
            </button>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={dismissReadOnlyNotice}
              className="p-1 rounded-lg hover:bg-rose-800 text-rose-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className="fixed top-16 right-4 z-50 rounded-xl bg-emerald-800 text-white px-4 py-2.5 text-xs font-semibold shadow-lg no-print"
        >
          {toastMsg}
        </div>
      )}

      {/* Clean, Subtitle-Free Responsive Subscription Banner (Main Rule: only when Admin Mode is ON and user is unsubscribed or within Admin's renewal threshold) */}
      {subscriptionRenewalNotice.shouldShowBanner && activeTab !== 'admin' && (
        <div
          data-testid="subscription-renewal-banner"
          data-banner-mode={subscriptionRenewalNotice.bannerMode}
          role="region"
          aria-label={lang === 'bn' ? 'সাবস্ক্রিপশন নোটিশ' : 'Subscription Notice'}
          className="w-full max-w-6xl mx-auto px-2.5 sm:px-6 pt-2.5 sm:pt-3 no-print"
        >
          <div className="rounded-2xl bg-gradient-to-r from-amber-50/95 via-white to-emerald-50/90 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-emerald-950/60 border border-amber-300/90 dark:border-amber-500/40 px-2.5 py-2 sm:px-5 sm:py-3 shadow-xs dark:shadow-[0_4px_20px_-4px_rgba(245,158,11,0.14)] flex items-center justify-between gap-1.5 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              <span className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-100/90 dark:bg-amber-500/15 border border-amber-300/80 dark:border-amber-400/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                <Clock className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
              </span>
              <span
                data-testid="subscription-renewal-text"
                className="text-[12px] sm:text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-snug whitespace-nowrap"
              >
                {subscriptionRenewalNotice.bannerMode === 'no_subscription' ? (
                  lang === 'bn' ? (
                    <>
                      আপনার কোনো{' '}
                      <span className="text-amber-700 dark:text-amber-300">
                        সাবস্ক্রিপশন নেওয়া নেই
                      </span>
                    </>
                  ) : (
                    <>
                      No active{' '}
                      <span className="text-amber-700 dark:text-amber-300">
                        subscription
                      </span>
                    </>
                  )
                ) : subscriptionRenewalNotice.bannerMode === 'expired' ? (
                  lang === 'bn' ? (
                    <>
                      সাবস্ক্রিপশনের{' '}
                      <span className="text-rose-600 dark:text-rose-400">
                        মেয়াদ শেষ হয়েছে
                      </span>
                    </>
                  ) : (
                    <>
                      Subscription{' '}
                      <span className="text-rose-600 dark:text-rose-400">
                        expired
                      </span>
                    </>
                  )
                ) : lang === 'bn' ? (
                  <>
                    সাবস্ক্রিপশনের{' '}
                    <span className="text-amber-700 dark:text-amber-300">
                      {toBengaliDigits(subscriptionRenewalNotice.daysRemaining)} দিন
                    </span>{' '}
                    বাকি আছে
                  </>
                ) : (
                  <>
                    Subscription:{' '}
                    <span className="text-amber-700 dark:text-amber-300">
                      {subscriptionRenewalNotice.daysRemaining} days
                    </span>{' '}
                    left
                  </>
                )}
              </span>
            </div>

            <button
              type="button"
              data-testid="subscription-renew-cta-btn"
              onClick={() => {
                setActiveTab('more');
                setMoreSubView('subscriptions');
                if (subscriptionRenewalNotice.shouldShowRenewal) {
                  setRenewalModalTrigger((prev) => prev + 1);
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="min-h-[32px] sm:min-h-[38px] px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 dark:from-emerald-500 dark:to-teal-500 dark:hover:from-emerald-400 dark:hover:to-teal-400 text-white dark:text-slate-950 text-[11px] sm:text-[13px] font-extrabold inline-flex items-center justify-center gap-1 sm:gap-1.5 shadow-xs transition-all active:scale-[0.98] cursor-pointer shrink-0 whitespace-nowrap"
            >
              <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>
                {subscriptionRenewalNotice.bannerMode === 'no_subscription'
                  ? lang === 'bn'
                    ? 'সাবস্ক্রিপশন নিন'
                    : 'Get Subscription'
                  : lang === 'bn'
                  ? 'সাবস্ক্রিপশন রিনিউ করুন'
                  : 'Renew Subscription'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-2.5 sm:px-6 py-2.5 sm:py-3">
        {(activeTab === 'dashboard' || (activeTab === 'admin' && !isAdminUser)) && (
          <DashboardView
            onNavigateTab={handleNavigate}
            onOpenVoiceModal={() => setVoiceModalOpen(true)}
          />
        )}
        {activeTab === 'overtime' && <OvertimeView />}
        {activeTab === 'salary' && <SalaryView />}
        {activeTab === 'attendance' && (
          <AttendanceView initialSelectedDate={attendanceFocusDate} />
        )}
        {activeTab === 'expenses' && <ExpensesView />}
        {activeTab === 'more' && (
          <MoreHubView
            activeSubView={moreSubView}
            onChangeSubView={(sub) => setMoreSubView(sub)}
            onNavigateTab={handleNavigate}
            openDrawerTrigger={moreMenuTrigger}
            openRenewalTrigger={renewalModalTrigger}
          />
        )}
        {isAdminUser && activeTab === 'admin' && (
          <AdminDashboardView onExitAdmin={() => handleNavigate('dashboard')} />
        )}
      </main>

      {/* Fixed Mobile Bottom Navigation Bar: Strictly 4 buttons (হোম, ওভারটাইম, হাজিরা, আরও) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 items-center px-2 no-print shadow-lg"
      >
        {mobileNavItems.map((item) => {
          const isActive =
            activeTab === item.id ||
            (item.id === 'more' && (activeTab === 'salary' || activeTab === 'expenses'));
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`mobile-nav-${item.id}`}
              onClick={() => handleNavigate(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-all ${
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold scale-[1.02]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="relative">
                {item.icon}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                )}
              </div>
              <span className="text-xs leading-snug mt-1 whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bengali Voice Entry Modal */}
      <VoiceEntryModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onSuccessToast={showToast}
        onNavigateTab={handleNavigate}
      />

      {/* Global Alarm Ringing Overlay Modal */}
      <AlarmRingingOverlay
        ringingAlarm={ringingAlarm}
        onDismiss={handleDismissRingingAlarm}
        onSnooze={handleSnoozeRingingAlarm}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <WorkspaceShell />
      </DataProvider>
    </ErrorBoundary>
  );
}
