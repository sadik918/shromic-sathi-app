import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  Home,
  Menu,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import { DataProvider, useData } from './context/DataContext';
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
import { AlarmRingingOverlay, loadSavedAlarms } from './components/AlarmView';

const AdminDashboardView = lazy(() =>
  import('./components/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView }))
);
const VoiceEntryModal = lazy(() =>
  import('./components/VoiceEntryModal').then((m) => ({ default: m.VoiceEntryModal }))
);
import {
  getCustomToneFromStorage,
  LATEST_CUSTOM_TONE_KEY,
  playAlarmTone,
  stopAlarmSound,
} from './utils/alarmAudio';
import {
  notifyAlarmRingingViaServiceWorker,
  startBackgroundAlarmGuard,
  syncAlarmsWithServiceWorker,
} from './utils/alarmKeepAlive';
import { getAccurateBstNow, syncOnlineAccurateTime } from './utils/networkTime';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type { AlarmItem, MoreSubView, NavTab } from './types';
import { formatShortMonthName, T } from './utils/i18n';
import { parseCalendarReminderMeta } from './utils/calendarReminders';
import { toBengaliDigits } from './utils/subscriptionLogic';
import { resolveHeaderSyncStatus } from './utils/syncStatusDisplay';

const VALID_NAV_TABS: NavTab[] = [
  'dashboard',
  'overtime',
  'salary',
  'attendance',
  'expenses',
  'more',
  'admin',
];

const VALID_MORE_SUBVIEWS: MoreSubView[] = [
  'profile',
  'contacts',
  'factory',
  'salary',
  'finance',
  'personal_loans',
  'documents',
  'reports',
  'reminders',
  'support',
  'alarm',
  'calculator',
  'subscriptions',
  'admin_panel',
];

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
    cloudDataLoaded,
    cloudSyncError,
    clearCloudSyncError,
    isDemoMode,
    needsOnboarding,
    pendingWritesCount,
    offlinePendingCount,
    syncOfflineDataToCloud,
    currentMonthISO,
    selectedMonth,
    setSelectedMonth,
    darkMode,
    toggleDarkMode,
    lang,
    setLang,
    overtime,
    attendance,
    salaryRecords,
    payments,
    expenses,
    reminders,
    alarms: syncedAlarms,
    isAdminUser,
    subscriptionRenewalNotice,
  } = useData();

  const totalPendingSyncCount = pendingWritesCount + offlinePendingCount;
  const { syncState } = useOnlineStatus(totalPendingSyncCount);
  const syncStatusUI = resolveHeaderSyncStatus({
    syncState,
    pendingCount: totalPendingSyncCount,
    lang,
  });

  const monthOptions = React.useMemo(() => {
    const set = new Set<string>(AVAILABLE_MONTHS);
    if (currentMonthISO) set.add(currentMonthISO);
    if (selectedMonth) set.add(selectedMonth);
    for (const o of overtime) if (o.month) set.add(o.month);
    for (const a of attendance) if (a.month) set.add(a.month);
    for (const s of salaryRecords) if (s.month) set.add(s.month);
    for (const p of payments) if (p.month) set.add(p.month);
    for (const e of expenses) if (e.month) set.add(e.month);
    return Array.from(set).sort().reverse();
  }, [
    currentMonthISO,
    selectedMonth,
    overtime,
    attendance,
    salaryRecords,
    payments,
    expenses,
  ]);
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab') || params.get('view');
      if (urlTab && VALID_NAV_TABS.includes(urlTab as NavTab)) {
        return urlTab as NavTab;
      }
      const storedTab = localStorage.getItem('shromik_sathi_active_tab');
      if (storedTab && VALID_NAV_TABS.includes(storedTab as NavTab)) {
        return storedTab as NavTab;
      }
    }
    return 'dashboard';
  });
  const [moreSubView, setMoreSubView] = useState<MoreSubView>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSub = params.get('sub');
      if (urlSub && VALID_MORE_SUBVIEWS.includes(urlSub as MoreSubView)) {
        return urlSub as MoreSubView;
      }
      const storedSub = localStorage.getItem('shromik_sathi_more_subview');
      if (storedSub && VALID_MORE_SUBVIEWS.includes(storedSub as MoreSubView)) {
        return storedSub as MoreSubView;
      }
    }
    return 'profile';
  });
  const [moreMenuTrigger, setMoreMenuTrigger] = useState(0);
  const [renewalModalTrigger, setRenewalModalTrigger] = useState(0);
  const [attendanceFocusDate, setAttendanceFocusDate] = useState<string | undefined>(undefined);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimerRef = React.useRef<number | null>(null);
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [lastTriggeredKey, setLastTriggeredKey] = useState<string>('');

  // Persist current tab and sub-view so reloading (online or offline) stays on the exact same page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('shromik_sathi_active_tab', activeTab);
      localStorage.setItem('shromik_sathi_more_subview', moreSubView);
    } catch {
      // ignore storage errors
    }
  }, [activeTab, moreSubView]);

  // Keep Service Worker and Background Alarm Guard synchronized with active alarms
  useEffect(() => {
    const activeAlarms =
      user && !isDemoMode
        ? cloudDataLoaded
          ? syncedAlarms
          : loadSavedAlarms(user.uid)
        : loadSavedAlarms();
    void syncAlarmsWithServiceWorker(activeAlarms);
    const hasEnabled = activeAlarms.some((a) => a.isEnabled);
    if (hasEnabled) {
      startBackgroundAlarmGuard(
        () => activeAlarms,
        (triggered) => {
          setRingingAlarm(triggered);
        }
      );
    }
  }, [user, isDemoMode, cloudDataLoaded, syncedAlarms]);

  // Listen for Service Worker background alarm triggers, notification button actions, and ?ring=1 wakeup URL
  useEffect(() => {
    const triggerRingingWithCachedAudio = async (triggered: AlarmItem) => {
      setRingingAlarm(triggered);
      const stored = await getCustomToneFromStorage(
        triggered.customToneId || LATEST_CUSTOM_TONE_KEY
      );
      playAlarmTone('custom_device', stored?.dataUrl, true);
    };

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('ring') === '1') {
        const alarmId = params.get('alarmId');
        const activeAlarms =
          user && !isDemoMode
            ? cloudDataLoaded
              ? syncedAlarms
              : loadSavedAlarms(user.uid)
            : loadSavedAlarms();
        const found =
          (alarmId ? activeAlarms.find((a) => a.id === alarmId) : undefined) ||
          activeAlarms.find((a) => a.isEnabled);
        if (found) {
          void triggerRingingWithCachedAudio(found);
        }
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('ring');
          url.searchParams.delete('alarmId');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        } catch {
          // ignore
        }
      }
    }

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onSwMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'SW_ALARM_TRIGGERED' && data.alarm) {
        await triggerRingingWithCachedAudio(data.alarm as AlarmItem);
      } else if (data.type === 'SW_NOTIFICATION_ACTION') {
        if (data.action === 'dismiss') {
          stopAlarmSound();
          setRingingAlarm(null);
        } else if (data.action === 'snooze_5') {
          stopAlarmSound();
          setRingingAlarm(null);
        } else if (data.action === 'open' && data.alarmId) {
          const activeAlarms =
            user && !isDemoMode
              ? cloudDataLoaded
                ? syncedAlarms
                : loadSavedAlarms(user.uid)
              : loadSavedAlarms();
          const found = activeAlarms.find((a) => a.id === data.alarmId);
          if (found) {
            await triggerRingingWithCachedAudio(found);
          }
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
    };
  }, [user, isDemoMode, cloudDataLoaded, syncedAlarms]);

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

      const alarms =
        user && !isDemoMode
          ? cloudDataLoaded
            ? syncedAlarms
            : loadSavedAlarms(user.uid)
          : loadSavedAlarms();
      const matching = alarms.find(
        (a) => a.isEnabled && a.time === currentTimeStr && a.repeatDays.includes(currentDay)
      );

      if (matching) {
        setLastTriggeredKey(triggerKey);
        setRingingAlarm(matching);
        void notifyAlarmRingingViaServiceWorker(matching);
        const stored = await getCustomToneFromStorage(
          matching.customToneId || LATEST_CUSTOM_TONE_KEY
        );
        playAlarmTone('custom_device', stored?.dataUrl, true);
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
          toneId: 'custom_device',
        };
        setRingingAlarm(remAlarmItem);
        const stored = await getCustomToneFromStorage(LATEST_CUSTOM_TONE_KEY);
        playAlarmTone('custom_device', stored?.dataUrl, true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([400, 200, 400, 200, 400]);
        }
      }
    };

    const interval = setInterval(checkAlarms, 2500);
    return () => clearInterval(interval);
  }, [lastTriggeredKey, reminders, user, isDemoMode, cloudDataLoaded, syncedAlarms]);

  const handleDismissRingingAlarm = () => {
    stopAlarmSound();
    setRingingAlarm(null);
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          (navigator.serviceWorker.controller || reg.active)?.postMessage({
            type: 'CLEAR_RINGING_ALARM',
          });
        })
        .catch(() => {});
    }
  };

  const handleSnoozeRingingAlarm = (minutes = 5) => {
    const current = ringingAlarm;
    stopAlarmSound();
    setRingingAlarm(null);
    showToast(
      lang === 'bn'
        ? `অ্যালার্ম ${minutes} মিনিটের জন্য স্নুজ করা হয়েছে`
        : `Alarm snoozed for ${minutes} min`
    );
    setTimeout(async () => {
      if (current) {
        setRingingAlarm(current);
        const stored = await getCustomToneFromStorage(
          current.customToneId || LATEST_CUSTOM_TONE_KEY
        );
        playAlarmTone('custom_device', stored?.dataUrl, true);
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
    window.scrollTo(0, 0);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(toastTimerRef.current);
    }
    if (typeof window !== 'undefined') {
      toastTimerRef.current = window.setTimeout(() => {
        setToastMsg('');
        toastTimerRef.current = null;
      }, 3800);
    }
  };

  if ((!authReady || (Boolean(user) && !cloudDataLoaded)) && !isDemoMode) {
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

  const pullStartYRef = React.useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const handleTouchStartPull = (e: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined' || window.scrollY > 2 || isPullRefreshing) {
      pullStartYRef.current = null;
      return;
    }
    const touch = e.touches[0];
    if (touch) {
      pullStartYRef.current = touch.clientY;
    }
  };

  const handleTouchMovePull = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pullStartYRef.current === null || isPullRefreshing) return;
    if (typeof window !== 'undefined' && window.scrollY > 2) {
      pullStartYRef.current = null;
      setPullDistance(0);
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - pullStartYRef.current;
    if (deltaY > 12) {
      const damped = Math.min(84, Math.round((deltaY - 12) * 0.45));
      setPullDistance(damped);
    } else if (pullDistance > 0) {
      setPullDistance(0);
    }
  };

  const handleTouchEndPull = async () => {
    if (pullStartYRef.current === null) return;
    pullStartYRef.current = null;
    if (pullDistance >= 52 && !isPullRefreshing) {
      setIsPullRefreshing(true);
      setPullDistance(48);
      try {
        if (typeof navigator === 'undefined' || navigator.onLine) {
          await syncOfflineDataToCloud(true);
        } else {
          await new Promise((r) => window.setTimeout(r, 350));
        }
        setToastMsg(
          lang === 'bn'
            ? typeof navigator !== 'undefined' && !navigator.onLine
              ? 'অফলাইন ডেটা আপ টু ডেট আছে'
              : 'তথ্য রিফ্রেশ সম্পন্ন হয়েছে'
            : typeof navigator !== 'undefined' && !navigator.onLine
            ? 'Offline data is up to date'
            : 'Data refreshed'
        );
        window.setTimeout(() => setToastMsg(''), 2200);
      } finally {
        setIsPullRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  if (isAdminUser && activeTab === 'admin') {
    return (
      <div
        onTouchStart={handleTouchStartPull}
        onTouchMove={handleTouchMovePull}
        onTouchEnd={handleTouchEndPull}
        className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
      >
        {(pullDistance > 0 || isPullRefreshing) && (
          <div
            data-testid="in-app-pull-refresh-indicator"
            className="flex items-center justify-center overflow-hidden bg-emerald-50/90 dark:bg-emerald-950/70 border-b border-emerald-200/70 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200 text-xs font-bold transition-all no-print"
            style={{ height: `${Math.max(pullDistance, isPullRefreshing ? 40 : 0)}px` }}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isPullRefreshing || pullDistance >= 52 ? 'animate-spin' : ''}`}
            />
            <span>
              {isPullRefreshing
                ? lang === 'bn'
                  ? 'রিফ্রেশ হচ্ছে...'
                  : 'Refreshing...'
                : pullDistance >= 52
                ? lang === 'bn'
                  ? 'ছেড়ে দিলে রিফ্রেশ হবে'
                  : 'Release to refresh'
                : lang === 'bn'
                ? 'রিফ্রেশ করতে নিচে টানুন'
                : 'Pull down to refresh'}
            </span>
          </div>
        )}
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center text-xs font-bold text-slate-500">
              লোড হচ্ছে...
            </div>
          }
        >
          <AdminDashboardView onExitAdmin={() => handleNavigate('dashboard')} />
        </Suspense>

        <AlarmRingingOverlay
          ringingAlarm={ringingAlarm}
          onDismiss={handleDismissRingingAlarm}
          onSnooze={handleSnoozeRingingAlarm}
        />
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStartPull}
      onTouchMove={handleTouchMovePull}
      onTouchEnd={handleTouchEndPull}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-20 md:pb-8"
    >
      {(pullDistance > 0 || isPullRefreshing) && (
        <div
          data-testid="in-app-pull-refresh-indicator"
          className="flex items-center justify-center overflow-hidden bg-emerald-50/90 dark:bg-emerald-950/70 border-b border-emerald-200/70 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200 text-xs font-bold transition-all no-print"
          style={{ height: `${Math.max(pullDistance, isPullRefreshing ? 40 : 0)}px` }}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1.5 ${isPullRefreshing || pullDistance >= 52 ? 'animate-spin' : ''}`}
          />
          <span>
            {isPullRefreshing
              ? lang === 'bn'
                ? 'রিফ্রেশ হচ্ছে...'
                : 'Refreshing...'
              : pullDistance >= 52
              ? lang === 'bn'
                ? 'ছেড়ে দিলে রিফ্রেশ হবে'
                : 'Release to refresh'
              : lang === 'bn'
              ? 'রিফ্রেশ করতে নিচে টানুন'
              : 'Pull down to refresh'}
          </span>
        </div>
      )}
      {/* Top Navigation Bar: Logo + App Title + Sync/Offline Status on Left, Desktop Nav in Center, Month + Lang Icon + Theme Icon on Right */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 no-print">
        <div className="max-w-7xl mx-auto h-full px-2.5 sm:px-6 lg:px-8 flex items-center justify-between gap-1.5 sm:gap-4 lg:gap-6">
          {/* Zone 1: Brand Emblem + Wordmark + Offline Status Badge / Sync Status Icon */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
            <a
              href="#dashboard"
              data-testid="header-brand-link"
              aria-label={dict.appTitle}
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('dashboard');
              }}
              className="inline-flex items-center gap-1 sm:gap-2 text-base sm:text-lg font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0"
            >
              <span className="w-7 h-7 min-[410px]:w-8 min-[410px]:h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/80 p-0.5 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs flex items-center justify-center shrink-0 overflow-hidden">
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

            {syncStatusUI.isOffline ? (
              <button
                type="button"
                data-testid="header-offline-status-badge"
                onClick={() => showToast(syncStatusUI.clickMessage)}
                title={syncStatusUI.tooltip}
                aria-label={syncStatusUI.accessibleLabel}
                className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-full border border-amber-300/90 dark:border-amber-700/80 bg-amber-50 hover:bg-amber-100/90 dark:bg-amber-950/75 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-200 text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
              >
                <WifiOff
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 dark:text-amber-400 shrink-0"
                  aria-hidden="true"
                />
                <span className="sm:hidden md:inline lg:hidden">{syncStatusUI.compactLabel}</span>
                <span className="hidden sm:inline md:hidden lg:inline">{syncStatusUI.fullLabel}</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="header-sync-status-btn"
                onClick={() => {
                  if (typeof navigator === 'undefined' || navigator.onLine) {
                    void syncOfflineDataToCloud(true);
                  }
                }}
                title={syncStatusUI.tooltip}
                aria-label={syncStatusUI.accessibleLabel}
                className="inline-flex items-center justify-center shrink-0 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {syncState === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-sky-500 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2
                    className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                )}
              </button>
            )}
          </div>

          {/* Zone 2: Desktop single-line navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center md:gap-3.5 lg:gap-5 xl:gap-6 text-xs lg:text-sm font-medium text-slate-600 dark:text-slate-300 min-w-0"
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
                {monthOptions.map((m) => (
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

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className="fixed top-16 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 rounded-xl bg-emerald-800 dark:bg-emerald-900 border border-emerald-700/60 text-white px-4 py-2.5 text-xs font-semibold shadow-lg no-print"
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
          className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-3 no-print"
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
        {cloudSyncError && (
          <div
            role="alert"
            data-testid="cloud-sync-error-banner"
            className="mb-3 rounded-2xl border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2.5 no-print"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="font-medium leading-snug">{cloudSyncError}</span>
            </div>
            <button
              type="button"
              onClick={clearCloudSyncError}
              aria-label={lang === 'bn' ? 'সতর্কবার্তা বন্ধ করুন' : 'Dismiss sync error'}
              className="w-7 h-7 rounded-lg text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {(activeTab === 'dashboard' || (activeTab === 'admin' && !isAdminUser)) && (
          <DashboardView
            onNavigateTab={handleNavigate}
            onOpenVoiceModal={() => setVoiceModalOpen(true)}
          />
        )}
        {activeTab === 'overtime' && <OvertimeView />}
        {activeTab === 'salary' && <SalaryView />}
        {activeTab === 'attendance' && (
          <AttendanceView
            initialSelectedDate={attendanceFocusDate}
            onOpenReports={() => handleNavigate('more', 'reports')}
          />
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
          <Suspense
            fallback={
              <div className="py-12 text-center text-xs font-bold text-slate-500">
                লোড হচ্ছে...
              </div>
            }
          >
            <AdminDashboardView onExitAdmin={() => handleNavigate('dashboard')} />
          </Suspense>
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
      {voiceModalOpen && (
        <Suspense fallback={null}>
          <VoiceEntryModal
            isOpen={voiceModalOpen}
            onClose={() => setVoiceModalOpen(false)}
            onSuccessToast={showToast}
            onNavigateTab={handleNavigate}
          />
        </Suspense>
      )}

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
