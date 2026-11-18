import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  Clock,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import type { AlarmItem } from '../types';
import {
  type AlarmToneId,
  getCustomToneFromStorage,
  LATEST_CUSTOM_TONE_KEY,
  playAlarmTone,
  saveCustomToneToStorage,
  stopAlarmSound,
} from '../utils/alarmAudio';
import {
  requestAlarmNotificationPermission,
  startBackgroundAlarmGuard,
  syncAlarmsWithServiceWorker,
} from '../utils/alarmKeepAlive';
import { formatNumber, toBengaliDigits } from '../utils/calculations';
import { getAccurateBstNow, syncOnlineAccurateTime } from '../utils/networkTime';
import { useData } from '../context/DataContext';

const STORAGE_KEY = 'shromik_sathi_alarms_v1';

const BENGALI_DAYS = [
  { day: 6, labelBn: 'শনি', labelEn: 'Sat' },
  { day: 0, labelBn: 'রবি', labelEn: 'Sun' },
  { day: 1, labelBn: 'সোম', labelEn: 'Mon' },
  { day: 2, labelBn: 'মঙ্গল', labelEn: 'Tue' },
  { day: 3, labelBn: 'বুধ', labelEn: 'Wed' },
  { day: 4, labelBn: 'বৃহঃ', labelEn: 'Thu' },
  { day: 5, labelBn: 'শুক্র', labelEn: 'Fri' },
];

const QUICK_LABELS = [
  'সকাল শিফট শুরু',
  'ওভারটাইম শুরু',
  'টিফিন / লাঞ্চ টাইম',
  'ছুটি ও বাসায় ফেরা',
  'ঔষধ খাওয়ার সময়',
  'ঘুম থেকে ওঠা',
];

function getAlarmStorageKey(uid?: string): string {
  return uid ? `${STORAGE_KEY}_${uid}` : STORAGE_KEY;
}

// Load alarms from storage (strictly scoped by UID when authenticated; no pre-set default audio alarms)
export function loadSavedAlarms(uid?: string): AlarmItem[] {
  try {
    const raw = localStorage.getItem(getAlarmStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((a) => a && typeof a.id === 'string' && (!uid || !a.userId || a.userId === uid));
    }
    return [];
  } catch {
    return [];
  }
}

// Save alarms to storage
export function persistAlarms(alarms: AlarmItem[], uid?: string): void {
  try {
    localStorage.setItem(getAlarmStorageKey(uid), JSON.stringify(alarms));
  } catch {
    // Ignore quota issues
  }
}

// Convert 24hr HH:mm to Bengali 12hr format with AM/PM
export function formatBengaliTime(time24: string): string {
  const [hhStr, mmStr] = time24.split(':');
  let hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10);
  if (isNaN(hh) || isNaN(mm)) return time24;

  const isPM = hh >= 12;
  const period = isPM ? 'PM' : 'AM';
  hh = hh % 12;
  if (hh === 0) hh = 12;

  const formattedH = hh < 10 ? `0${hh}` : `${hh}`;
  const formattedM = mm < 10 ? `0${mm}` : `${mm}`;
  return `${toBengaliDigits(formattedH)}:${toBengaliDigits(formattedM)} ${period}`;
}

interface AlarmViewProps {
  onTriggerAlarmModal?: (alarm: AlarmItem) => void;
}

export const AlarmView: React.FC<AlarmViewProps> = () => {
  const {
    user,
    isDemoMode,
    isReadOnlyDemo,
    triggerReadOnlyBlock,
    alarms: syncedAlarms,
    saveAlarm,
    deleteAlarm,
  } = useData();
  const [localAlarms, setLocalAlarms] = useState<AlarmItem[]>(() => loadSavedAlarms(user?.uid));
  const isCloudAlarmMode = Boolean(user && !isDemoMode);
  const alarms = isCloudAlarmMode ? syncedAlarms : localAlarms;

  useEffect(() => {
    if (isCloudAlarmMode && user?.uid) {
      persistAlarms(syncedAlarms, user.uid);
    }
    void syncAlarmsWithServiceWorker(alarms);
  }, [alarms, isCloudAlarmMode, syncedAlarms, user?.uid]);

  const [currentTime, setCurrentTime] = useState<string>('');
  const [isOnlineTimeSynced, setIsOnlineTimeSynced] = useState<boolean>(false);
  const [isSyncingTime, setIsSyncingTime] = useState<boolean>(false);
  const [editingAlarm, setEditingAlarm] = useState<AlarmItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewingToneId, setPreviewingToneId] = useState<string | null>(null);
  const [customToneCache, setCustomToneCache] = useState<Record<string, string>>({});
  const [latestCachedTone, setLatestCachedTone] = useState<{
    id: string;
    name: string;
    dataUrl: string;
  } | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // Form State (Always custom_device uploaded from phone cache; no default synthesized tones)
  const [formTime, setFormTime] = useState('07:00');
  const [formLabel, setFormLabel] = useState('সকাল শিফট শুরু');
  const [formRepeatDays, setFormRepeatDays] = useState<number[]>([6, 0, 1, 2, 3, 4]);
  const [formToneId, setFormToneId] = useState<AlarmToneId>('custom_device');
  const [formCustomToneId, setFormCustomToneId] = useState<string>('');
  const [formCustomToneName, setFormCustomToneName] = useState('');
  const [formCustomToneDataUrl, setFormCustomToneDataUrl] = useState('');

  const handleManualSyncTime = async () => {
    setIsSyncingTime(true);
    const ok = await syncOnlineAccurateTime();
    const info = getAccurateBstNow();
    setCurrentTime(info.time24WithSeconds);
    setIsOnlineTimeSynced(info.isOnlineSynced || ok);
    setIsSyncingTime(false);
    if (ok) {
      showToast('অনলাইন গুগল সার্ভারের সঠিক সময়ের সাথে সিঙ্ক হয়েছে');
    }
  };

  // Update live clock using Online Server-Synced Bangladesh Standard Time (Asia/Dhaka, UTC+6)
  useEffect(() => {
    let mounted = true;
    const updateClock = () => {
      const bst = getAccurateBstNow();
      if (mounted) {
        setCurrentTime(bst.time24WithSeconds);
        setIsOnlineTimeSynced(bst.isOnlineSynced);
      }
    };

    syncOnlineAccurateTime().then(() => {
      updateClock();
    });
    updateClock();

    const clockInterval = setInterval(updateClock, 1000);
    const resyncInterval = setInterval(() => {
      syncOnlineAccurateTime().then(() => updateClock());
    }, 120000);

    return () => {
      mounted = false;
      clearInterval(clockInterval);
      clearInterval(resyncInterval);
    };
  }, []);

  // Preload custom tones from phone cache (IndexedDB + CacheStorage) for instant full-duration playback
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const latest = await getCustomToneFromStorage(LATEST_CUSTOM_TONE_KEY);
      if (!cancelled && latest) {
        setLatestCachedTone(latest);
        setCustomToneCache((prev) => ({
          ...prev,
          [latest.id]: latest.dataUrl,
          [LATEST_CUSTOM_TONE_KEY]: latest.dataUrl,
        }));
      }
      for (const a of alarms) {
        if (a.customToneId) {
          const stored = await getCustomToneFromStorage(a.customToneId);
          if (!cancelled && stored) {
            setCustomToneCache((prev) => ({ ...prev, [a.customToneId!]: stored.dataUrl }));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alarms]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleToggleAlarm = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    const target = alarms.find((a) => a.id === id);
    if (!target) return;
    const nextEnabled = !target.isEnabled;
    const updatedItem: AlarmItem = { ...target, isEnabled: nextEnabled };

    if (!nextEnabled) {
      stopAlarmSound();
      if (previewingToneId === id) {
        setPreviewingToneId(null);
      }
    }

    if (isCloudAlarmMode) {
      const nextList = alarms.map((a) => (a.id === id ? updatedItem : a));
      persistAlarms(nextList, user?.uid);
      void syncAlarmsWithServiceWorker(nextList);
      startBackgroundAlarmGuard(() => nextList);
      if (nextEnabled) {
        void requestAlarmNotificationPermission();
      }
      try {
        // Pass `id` as existingId so the exact same alarm is updated in-place without creating a duplicate!
        await saveAlarm(updatedItem, id);
      } catch {
        showToast('অ্যালার্ম সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন');
      }
      return;
    }

    setLocalAlarms((prev) => {
      const updated = prev.map((a) => (a.id === id ? updatedItem : a));
      persistAlarms(updated, user?.uid);
      void syncAlarmsWithServiceWorker(updated);
      startBackgroundAlarmGuard(() => updated);
      if (nextEnabled) {
        void requestAlarmNotificationPermission();
      }
      return updated;
    });
  };

  const handleDeleteAlarm = async (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    if (previewingToneId === id) {
      stopAlarmSound();
      setPreviewingToneId(null);
    }
    if (isCloudAlarmMode) {
      const nextList = alarms.filter((a) => a.id !== id);
      persistAlarms(nextList, user?.uid);
      void syncAlarmsWithServiceWorker(nextList);
      startBackgroundAlarmGuard(() => nextList);
      try {
        await deleteAlarm(id);
        showToast('অ্যালার্ম মুছে ফেলা হয়েছে');
      } catch {
        showToast('অ্যালার্ম মুছে ফেলা যায়নি, আবার চেষ্টা করুন');
      }
      return;
    }

    setLocalAlarms((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      persistAlarms(updated, user?.uid);
      void syncAlarmsWithServiceWorker(updated);
      startBackgroundAlarmGuard(() => updated);
      return updated;
    });
    showToast('অ্যালার্ম মুছে ফেলা হয়েছে');
  };

  const handleOpenNewModal = async () => {
    setEditingAlarm(null);
    setFormTime('07:00');
    setFormLabel('সকাল শিফট শুরু');
    setFormRepeatDays([6, 0, 1, 2, 3, 4]);
    setFormToneId('custom_device');

    const cached = latestCachedTone || (await getCustomToneFromStorage(LATEST_CUSTOM_TONE_KEY));
    if (cached) {
      setFormCustomToneId(cached.id);
      setFormCustomToneName(cached.name);
      setFormCustomToneDataUrl(cached.dataUrl);
    } else {
      setFormCustomToneId('');
      setFormCustomToneName('');
      setFormCustomToneDataUrl('');
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (alarm: AlarmItem) => {
    setEditingAlarm(alarm);
    setFormTime(alarm.time);
    setFormLabel(alarm.label);
    setFormRepeatDays([...alarm.repeatDays]);
    setFormToneId('custom_device');
    setFormCustomToneId(alarm.customToneId || '');
    setFormCustomToneName(alarm.customToneName || '');

    const stored = await getCustomToneFromStorage(alarm.customToneId || LATEST_CUSTOM_TONE_KEY);
    if (stored) {
      setFormCustomToneId(alarm.customToneId || stored.id);
      setFormCustomToneName(alarm.customToneName || stored.name);
      setFormCustomToneDataUrl(stored.dataUrl);
    } else {
      setFormCustomToneDataUrl('');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    stopAlarmSound();
    setPreviewingToneId(null);
    setIsModalOpen(false);
  };

  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      showToast('অনুগ্রহ করে সঠিক অডিও ফাইল নির্বাচন করুন');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('ফাইলের সাইজ ২০MB এর কম হতে হবে');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const toneId = `custom_${Date.now()}`;
      await saveCustomToneToStorage(toneId, file.name, result);
      setFormToneId('custom_device');
      setFormCustomToneId(toneId);
      setFormCustomToneName(file.name);
      setFormCustomToneDataUrl(result);
      setLatestCachedTone({ id: toneId, name: file.name, dataUrl: result });
      setCustomToneCache((prev) => ({
        ...prev,
        [toneId]: result,
        [LATEST_CUSTOM_TONE_KEY]: result,
      }));
      showToast(`ফোনের ক্যাশে রিংটোন সংরক্ষিত হয়েছে: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  // Play the full uploaded audio duration from phone cache without any 4s cutoff
  const handleTestTone = async (previewKey: string, customUrl?: string) => {
    if (previewingToneId === previewKey) {
      stopAlarmSound();
      setPreviewingToneId(null);
      return;
    }

    let resolvedUrl = customUrl || formCustomToneDataUrl;
    if (!resolvedUrl) {
      const cached = await getCustomToneFromStorage(LATEST_CUSTOM_TONE_KEY);
      resolvedUrl = cached?.dataUrl || '';
    }
    if (!resolvedUrl) {
      showToast('প্রথমে আপনার ফোন থেকে একটি অডিও রিংটোন আপলোড করুন');
      return;
    }

    setPreviewingToneId(previewKey);
    playAlarmTone('custom_device', resolvedUrl, false, () => {
      setPreviewingToneId((curr) => (curr === previewKey ? null : curr));
    });
  };

  const handleSaveAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    stopAlarmSound();
    setPreviewingToneId(null);
    if (isReadOnlyDemo) {
      setIsModalOpen(false);
      triggerReadOnlyBlock();
      return;
    }

    let customToneId: string | undefined =
      formCustomToneId || editingAlarm?.customToneId || latestCachedTone?.id;
    const toneName = formCustomToneName || editingAlarm?.customToneName || latestCachedTone?.name;
    const toneDataUrl = formCustomToneDataUrl || latestCachedTone?.dataUrl;

    if (toneDataUrl) {
      if (!customToneId) {
        customToneId = `tone_${Date.now()}`;
      }
      await saveCustomToneToStorage(
        customToneId,
        toneName || 'Custom Ringtone',
        toneDataUrl
      );
      setCustomToneCache((prev) => ({
        ...prev,
        [customToneId!]: toneDataUrl,
        [LATEST_CUSTOM_TONE_KEY]: toneDataUrl,
      }));
    }

    const alarmId = editingAlarm ? editingAlarm.id : `alarm_${Date.now()}`;
    const newAlarm: AlarmItem = {
      id: alarmId,
      time: formTime,
      label: formLabel.trim() || 'ডিউটি অ্যালার্ম',
      isEnabled: editingAlarm ? editingAlarm.isEnabled : true,
      repeatDays: formRepeatDays,
      toneId: 'custom_device',
      customToneName: toneName || undefined,
      customToneId: customToneId || undefined,
    };

    const nextList = editingAlarm
      ? alarms.map((a) => (a.id === editingAlarm.id ? newAlarm : a))
      : [...alarms, newAlarm];

    startBackgroundAlarmGuard(() => nextList);
    void requestAlarmNotificationPermission();

    if (isCloudAlarmMode) {
      persistAlarms(nextList, user?.uid);
      void syncAlarmsWithServiceWorker(nextList);
      try {
        await saveAlarm(newAlarm, alarmId);
        setIsModalOpen(false);
        showToast(editingAlarm ? 'অ্যালার্ম আপডেট করা হয়েছে' : 'নতুন অ্যালার্ম যুক্ত করা হয়েছে');
      } catch {
        showToast('অ্যালার্ম সেভ করা যায়নি, আবার চেষ্টা করুন');
      }
      return;
    }

    setLocalAlarms(() => {
      persistAlarms(nextList, user?.uid);
      void syncAlarmsWithServiceWorker(nextList);
      return nextList;
    });

    setIsModalOpen(false);
    showToast(editingAlarm ? 'অ্যালার্ম আপডেট করা হয়েছে' : 'নতুন অ্যালার্ম যুক্ত করা হয়েছে');
  };

  const toggleRepeatDay = (day: number) => {
    setFormRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const activeCount = alarms.filter((a) => a.isEnabled).length;

  return (
    <div className="w-full space-y-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className="fixed top-16 right-4 z-50 rounded-xl bg-emerald-800 text-white px-4 py-2.5 text-xs font-semibold shadow-lg no-print animate-fade-in"
        >
          {toastMsg}
        </div>
      )}

      {/* Top Banner: Real-time Online-Synced Clock + Active Alarms Summary */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-800 text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
            <BellRing className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold">অ্যালার্ম</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                {formatNumber(activeCount, 'bn')}টি চালু
              </span>
              <span
                data-testid="online-time-sync-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-emerald-100 border border-white/20"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnlineTimeSynced ? 'bg-emerald-300' : 'bg-amber-300'
                  }`}
                />
                {isOnlineTimeSynced
                  ? 'অনলাইন সঠিক সময় (গুগল সিঙ্কড)'
                  : 'বাংলাদেশ মান সময় (BST)'}
              </span>
              <span
                data-testid="background-alarm-guard-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-100 border border-emerald-300/30"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-200" />
                <span>ব্যাকগ্রাউন্ড ও অফলাইন অ্যালার্ম সক্রিয়</span>
              </span>
            </div>
          </div>
        </div>

        {/* Live Digital Clock Badge */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3.5 py-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-100">
            <Clock className="w-4 h-4 text-emerald-300" />
            <span>সঠিক সময়:</span>
          </div>
          <span
            data-testid="alarm-live-clock"
            className="text-sm sm:text-base font-bold font-mono tracking-wider text-white"
          >
            {currentTime ? formatBengaliTime(currentTime.slice(0, 5)) : '--:--'}
          </span>
          <button
            type="button"
            data-testid="sync-online-time-btn"
            onClick={handleManualSyncTime}
            title="অনলাইন গুগল টাইম রিফ্রেশ করুন"
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTime ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Header: Add Alarm Button */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          আপনার শিফট ও ছুটির দিন অনুযায়ী অ্যালার্ম সেট করুন
        </p>
        <button
          type="button"
          data-testid="add-alarm-btn"
          onClick={handleOpenNewModal}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন অ্যালার্ম যোগ করুন</span>
        </button>
      </div>

      {/* Alarms List */}
      {alarms.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <BellOff className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            কোনো অ্যালার্ম সেট করা নেই
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            আপনার সকালের শিফট, ওভারটাইম শুরু বা টিফিনের সময় মনে রাখতে ফোন থেকে রিংটোন আপলোড করে অ্যালার্ম যুক্ত করুন।
          </p>
          <button
            type="button"
            onClick={handleOpenNewModal}
            className="min-h-[36px] px-4 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>প্রথম অ্যালার্ম যোগ করুন</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {alarms.map((alarm) => {
            const toneDisplay =
              alarm.customToneName ||
              latestCachedTone?.name ||
              'ফোন থেকে রিংটোন আপলোড করুন';
            const isToneTesting = previewingToneId === alarm.id;

            return (
              <div
                key={alarm.id}
                data-testid={`alarm-card-${alarm.id}`}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all p-4 flex flex-col justify-between gap-3 shadow-2xs ${
                  alarm.isEnabled
                    ? 'border-emerald-300 dark:border-emerald-800/80 shadow-emerald-500/5'
                    : 'border-slate-200 dark:border-slate-800 opacity-70'
                }`}
              >
                {/* Upper row: Time + Active Toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {formatBengaliTime(alarm.time).split(' ')[0]}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                        {formatBengaliTime(alarm.time).split(' ')[1]}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate mt-0.5">
                      {alarm.label}
                    </p>
                  </div>

                  {/* Tactile Toggle Switch */}
                  <button
                    type="button"
                    data-testid={`toggle-alarm-${alarm.id}`}
                    onClick={() => handleToggleAlarm(alarm.id)}
                    aria-label={alarm.isEnabled ? 'অ্যালার্ম বন্ধ করুন' : 'অ্যালার্ম চালু করুন'}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      alarm.isEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        alarm.isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Days of Week Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {BENGALI_DAYS.map((d) => {
                    const isDayActive = alarm.repeatDays.includes(d.day);
                    return (
                      <span
                        key={d.day}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isDayActive
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {d.labelBn}
                      </span>
                    );
                  })}
                </div>

                {/* Bottom Row: Tone Info + Quick Action Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 text-slate-600 dark:text-slate-400 text-xs truncate">
                    <Volume2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">{toneDisplay}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                    {/* Test Audio Button (Plays full duration from phone cache) */}
                    <button
                      type="button"
                      data-testid={`preview-alarm-${alarm.id}`}
                      onClick={() => {
                        const customUrl =
                          (alarm.customToneId ? customToneCache[alarm.customToneId] : undefined) ||
                          customToneCache[LATEST_CUSTOM_TONE_KEY];
                        void handleTestTone(alarm.id, customUrl);
                      }}
                      title="রিংটোন পরীক্ষা করুন"
                      className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                        isToneTesting
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isToneTesting ? (
                        <Pause className="w-3 h-3 text-amber-600" />
                      ) : (
                        <Play className="w-3 h-3 text-emerald-600" />
                      )}
                      <span className="text-[11px]">{isToneTesting ? 'থামান' : 'শুনুন'}</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      data-testid={`edit-alarm-${alarm.id}`}
                      onClick={() => handleOpenEditModal(alarm)}
                      title="অ্যালার্ম পরিবর্তন করুন"
                      className="min-h-[30px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                    >
                      সম্পাদনা
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      data-testid={`delete-alarm-${alarm.id}`}
                      onClick={() => handleDeleteAlarm(alarm.id)}
                      title="অ্যালার্ম মুছে ফেলুন"
                      className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New / Edit Alarm Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div
            data-testid="alarm-edit-modal"
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingAlarm ? 'অ্যালার্ম সম্পাদনা করুন' : 'নতুন অ্যালার্ম নির্ধারণ করুন'}
                </h3>
              </div>
              <button
                type="button"
                data-testid="close-alarm-modal"
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveAlarm} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* 1. Time Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  অ্যালার্মের সময় (২৪ ঘণ্টা ফরম্যাট)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    data-testid="alarm-time-input"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="flex-1 text-2xl font-mono font-bold tracking-wider px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center shrink-0">
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-medium">
                      বাংলা সময়
                    </span>
                    <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      {formatBengaliTime(formTime)}
                    </span>
                  </div>
                </div>

                {/* Quick Time Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { t: '06:30', l: 'সকাল ৬:৩০' },
                    { t: '07:30', l: 'সকাল ৭:৩০' },
                    { t: '08:00', l: 'সকাল ৮:০০' },
                    { t: '13:00', l: 'দুপুর ১:০০' },
                    { t: '17:00', l: 'বিকাল ৫:০০' },
                    { t: '19:00', l: 'সন্ধ্যা ৭:০০' },
                    { t: '22:00', l: 'রাত ১০:০০' },
                  ].map((preset) => (
                    <button
                      key={preset.t}
                      type="button"
                      onClick={() => setFormTime(preset.t)}
                      className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                        formTime === preset.t
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {preset.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Label & Quick Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  অ্যালার্মের নাম / বিবরণ
                </label>
                <input
                  type="text"
                  data-testid="alarm-label-input"
                  required
                  placeholder="যেমন: সকাল শিফট শুরু"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_LABELS.map((ql) => (
                    <button
                      key={ql}
                      type="button"
                      onClick={() => setFormLabel(ql)}
                      className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                        formLabel === ql
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {ql}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Repeat Days */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    কোন কোন দিন বাজবে (Repeat Days)
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFormRepeatDays([6, 0, 1, 2, 3, 4])}
                      className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                    >
                      শনি-বৃহঃ
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setFormRepeatDays([6, 0, 1, 2, 3, 4, 5])}
                      className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                    >
                      প্রতিদিন
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {BENGALI_DAYS.map((d) => {
                    const isSelected = formRepeatDays.includes(d.day);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => toggleRepeatDay(d.day)}
                        className={`min-h-[36px] rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center border ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span>{d.labelBn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Phone Ringtone Uploader (Cached Locally, Full Length Playback) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  ফোন থেকে অ্যালার্মের রিংটোন আপলোড করুন
                </label>

                <div className="p-3.5 rounded-2xl border border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          {formCustomToneName
                            ? `ফাইল: ${formCustomToneName}`
                            : 'ফোনের মেমোরি থেকে অডিও রিংটোন নির্বাচন করুন'}
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        আপলোড করা রিংটোন ফোনের ক্যাশে সংরক্ষিত থাকবে এবং সম্পূর্ণ সাউন্ড বাজবে
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <label
                        data-testid="upload-custom-tone-btn"
                        className="min-h-[34px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{formCustomToneName ? 'পরিবর্তন' : 'অডিও ফাইল বাছুন'}</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={handleCustomAudioUpload}
                        />
                      </label>

                      {formCustomToneDataUrl && (
                        <button
                          type="button"
                          onClick={() => void handleTestTone('modal_preview', formCustomToneDataUrl)}
                          title={previewingToneId === 'modal_preview' ? 'থামান' : 'শুনুন'}
                          className={`min-h-[34px] px-2.5 rounded-xl flex items-center gap-1 text-xs font-semibold transition-colors ${
                            previewingToneId === 'modal_preview'
                              ? 'bg-amber-600 text-white'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {previewingToneId === 'modal_preview' ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>থামান</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>শুনুন</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  data-testid="save-alarm-submit-btn"
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingAlarm ? 'আপডেট সম্পন্ন করুন' : 'অ্যালার্ম সেভ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Global Ringing Modal Overlay for when alarm triggers anywhere in app
export interface AlarmRingingOverlayProps {
  ringingAlarm: AlarmItem | null;
  onDismiss: () => void;
  onSnooze: (minutes?: number) => void;
}

export const AlarmRingingOverlay: React.FC<AlarmRingingOverlayProps> = ({
  ringingAlarm,
  onDismiss,
  onSnooze,
}) => {
  if (!ringingAlarm) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="alarm-ringing-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in no-print"
    >
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border-2 border-emerald-500 p-6 text-center shadow-2xl space-y-5 animate-scale-up">
        {/* Animated Ringing Bell */}
        <div className="relative w-20 h-20 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center border-2 border-emerald-500 shadow-lg shadow-emerald-500/20">
          <BellRing className="w-10 h-10 text-emerald-700 dark:text-emerald-400 animate-bounce" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
          </span>
        </div>

        <div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 mb-2">
            🔔 অ্যালার্ম বাজছে!
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
            {formatBengaliTime(ringingAlarm.time)}
          </h2>
          <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            {ringingAlarm.label}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            কারখানার কাজের সময় অথবা শিফটের নির্ধারিত অ্যালার্ম
          </p>
        </div>

        {/* Large Tactile Dismiss & Snooze Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            data-testid="dismiss-alarm-btn"
            onClick={onDismiss}
            className="w-full min-h-[48px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-sm font-extrabold shadow-md transition-all cursor-pointer"
          >
            বন্ধ করুন (Dismiss)
          </button>

          <button
            type="button"
            data-testid="snooze-alarm-btn"
            onClick={() => onSnooze(5)}
            className="w-full min-h-[44px] rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>স্নুজ করুন (৫ মিনিট পরে আবার বাজবে)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
