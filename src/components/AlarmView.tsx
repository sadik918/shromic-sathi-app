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
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import type { AlarmItem } from '../types';
import {
  ALARM_TONE_OPTIONS,
  type AlarmToneId,
  getCustomToneFromStorage,
  playAlarmTone,
  saveCustomToneToStorage,
  stopAlarmSound,
} from '../utils/alarmAudio';
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

const DEFAULT_ALARMS: AlarmItem[] = [
  {
    id: 'default-1',
    time: '07:00',
    label: 'সকাল শিফট ও কারখানায় রওনা',
    isEnabled: true,
    repeatDays: [6, 0, 1, 2, 3, 4], // Saturday to Thursday
    toneId: 'factory_siren',
  },
  {
    id: 'default-2',
    time: '17:00',
    label: 'ওভারটাইম ডিউটি শুরু',
    isEnabled: true,
    repeatDays: [6, 0, 1, 2, 3, 4],
    toneId: 'digital_beep',
  },
];

// Load alarms from storage
export function loadSavedAlarms(): AlarmItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ALARMS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ALARMS;
  } catch {
    return DEFAULT_ALARMS;
  }
}

// Save alarms to storage
export function persistAlarms(alarms: AlarmItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
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
  const { isReadOnlyDemo, triggerReadOnlyBlock } = useData();
  const [alarms, setAlarms] = useState<AlarmItem[]>(() => loadSavedAlarms());
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isOnlineTimeSynced, setIsOnlineTimeSynced] = useState<boolean>(false);
  const [isSyncingTime, setIsSyncingTime] = useState<boolean>(false);
  const [editingAlarm, setEditingAlarm] = useState<AlarmItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewingToneId, setPreviewingToneId] = useState<string | null>(null);
  const [customToneCache, setCustomToneCache] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState('');

  // Form State
  const [formTime, setFormTime] = useState('07:00');
  const [formLabel, setFormLabel] = useState('সকাল শিফট শুরু');
  const [formRepeatDays, setFormRepeatDays] = useState<number[]>([6, 0, 1, 2, 3, 4]);
  const [formToneId, setFormToneId] = useState<AlarmToneId>('factory_siren');
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
  // Immune to broken local device clocks
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
    // Re-sync with online server every 2 minutes to prevent any drift
    const resyncInterval = setInterval(() => {
      syncOnlineAccurateTime().then(() => updateClock());
    }, 120000);

    return () => {
      mounted = false;
      clearInterval(clockInterval);
      clearInterval(resyncInterval);
    };
  }, []);

  // Preload custom tones into cache for instant playback
  useEffect(() => {
    alarms.forEach(async (a) => {
      if (a.toneId === 'custom_device' && a.customToneId && !customToneCache[a.customToneId]) {
        const stored = await getCustomToneFromStorage(a.customToneId);
        if (stored) {
          setCustomToneCache((prev) => ({ ...prev, [stored.id]: stored.dataUrl }));
        }
      }
    });
  }, [alarms]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleToggleAlarm = (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    setAlarms((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, isEnabled: !a.isEnabled } : a));
      persistAlarms(updated);
      return updated;
    });
  };

  const handleDeleteAlarm = (id: string) => {
    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }
    setAlarms((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      persistAlarms(updated);
      return updated;
    });
    showToast('অ্যালার্ম মুছে ফেলা হয়েছে');
  };

  const handleOpenNewModal = () => {
    setEditingAlarm(null);
    setFormTime('07:00');
    setFormLabel('সকাল শিফট শুরু');
    setFormRepeatDays([6, 0, 1, 2, 3, 4]);
    setFormToneId('factory_siren');
    setFormCustomToneName('');
    setFormCustomToneDataUrl('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (alarm: AlarmItem) => {
    setEditingAlarm(alarm);
    setFormTime(alarm.time);
    setFormLabel(alarm.label);
    setFormRepeatDays([...alarm.repeatDays]);
    setFormToneId(alarm.toneId);
    setFormCustomToneName(alarm.customToneName || '');
    if (alarm.toneId === 'custom_device' && alarm.customToneId) {
      const tone = await getCustomToneFromStorage(alarm.customToneId);
      if (tone) {
        setFormCustomToneDataUrl(tone.dataUrl);
      }
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

    if (file.size > 15 * 1024 * 1024) {
      showToast('ফাইলের সাইজ ১৫MB এর কম হতে হবে');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const toneId = `custom_${Date.now()}`;
      await saveCustomToneToStorage(toneId, file.name, result);
      setFormToneId('custom_device');
      setFormCustomToneName(file.name);
      setFormCustomToneDataUrl(result);
      setCustomToneCache((prev) => ({ ...prev, [toneId]: result }));
      showToast(`কাস্টম অডিও যুক্ত হয়েছে: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleTestTone = (toneId: AlarmToneId, customUrl?: string) => {
    if (previewingToneId === toneId) {
      stopAlarmSound();
      setPreviewingToneId(null);
    } else {
      setPreviewingToneId(toneId);
      playAlarmTone(toneId, customUrl || formCustomToneDataUrl, false);
      setTimeout(() => {
        setPreviewingToneId(null);
      }, 4000);
    }
  };

  const handleSaveAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    stopAlarmSound();
    if (isReadOnlyDemo) {
      setIsModalOpen(false);
      triggerReadOnlyBlock();
      return;
    }

    let customToneId: string | undefined = editingAlarm?.customToneId;
    if (formToneId === 'custom_device' && formCustomToneDataUrl) {
      if (!customToneId) {
        customToneId = `tone_${Date.now()}`;
      }
      await saveCustomToneToStorage(customToneId, formCustomToneName || 'Custom Ringtone', formCustomToneDataUrl);
      setCustomToneCache((prev) => ({ ...prev, [customToneId!]: formCustomToneDataUrl }));
    }

    const newAlarm: AlarmItem = {
      id: editingAlarm ? editingAlarm.id : `alarm_${Date.now()}`,
      time: formTime,
      label: formLabel.trim() || 'ডিউটি অ্যালার্ম',
      isEnabled: true,
      repeatDays: formRepeatDays,
      toneId: formToneId,
      customToneName: formToneId === 'custom_device' ? formCustomToneName : undefined,
      customToneId: formToneId === 'custom_device' ? customToneId : undefined,
    };

    setAlarms((prev) => {
      const updated = editingAlarm
        ? prev.map((a) => (a.id === editingAlarm.id ? newAlarm : a))
        : [...prev, newAlarm];
      persistAlarms(updated);
      return updated;
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
    <div className="space-y-4 max-w-4xl mx-auto">
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
            <BellRing className="w-6 h-6 text-emerald-200 animate-pulse" />
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
                    isOnlineTimeSynced ? 'bg-emerald-300 animate-pulse' : 'bg-amber-300'
                  }`}
                />
                {isOnlineTimeSynced
                  ? 'অনলাইন সঠিক সময় (গুগল সিঙ্কড)'
                  : 'বাংলাদেশ মান সময় (BST)'}
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
            আপনার সকালের শিফট, ওভারটাইম শুরু বা টিফিনের সময় সহজেই মনে রাখতে নতুন অ্যালার্ম যুক্ত করুন।
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alarms.map((alarm) => {
            const toneObj = ALARM_TONE_OPTIONS.find((t) => t.id === alarm.toneId);
            const isCustom = alarm.toneId === 'custom_device';
            const toneDisplay = isCustom
              ? alarm.customToneName || 'ডিভাইস অডিও'
              : toneObj?.nameBn || 'ফ্যাক্টরি সাইরেন';
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

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Test Audio Button */}
                    <button
                      type="button"
                      data-testid={`preview-alarm-${alarm.id}`}
                      onClick={() => {
                        const customUrl = alarm.customToneId ? customToneCache[alarm.customToneId] : undefined;
                        handleTestTone(alarm.id as AlarmToneId, customUrl);
                      }}
                      title="রিংটোন পরীক্ষা করুন"
                      className={`min-h-[30px] px-2 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                        isToneTesting
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isToneTesting ? <Pause className="w-3 h-3 text-amber-600" /> : <Play className="w-3 h-3 text-emerald-600" />}
                      <span className="text-[11px]">{isToneTesting ? 'থামান' : 'শুনুন'}</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      data-testid={`edit-alarm-${alarm.id}`}
                      onClick={() => handleOpenEditModal(alarm)}
                      title="অ্যালার্ম পরিবর্তন করুন"
                      className="min-h-[30px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
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
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-medium">বাংলা সময়</span>
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

              {/* 4. Tone Selector (Built-in + Custom Device Tone) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  অ্যালার্মের রিংটোন নির্বাচন করুন
                </label>

                <div className="space-y-2">
                  {ALARM_TONE_OPTIONS.map((opt) => {
                    const isSelected = formToneId === opt.id;
                    const isTesting = previewingToneId === opt.id;

                    if (opt.id === 'custom_device') {
                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-2xl border transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 cursor-pointer min-w-0">
                              <input
                                type="radio"
                                name="alarm_tone"
                                value={opt.id}
                                checked={isSelected}
                                onChange={() => setFormToneId('custom_device')}
                                className="text-emerald-600 focus:ring-emerald-500 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <Music className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{opt.nameBn}</span>
                                </span>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {formCustomToneName ? `ফাইল: ${formCustomToneName}` : opt.descriptionBn}
                                </p>
                              </div>
                            </label>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Audio Upload File Trigger */}
                              <label
                                data-testid="upload-custom-tone-btn"
                                className="min-h-[30px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <Upload className="w-3 h-3 text-emerald-600" />
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
                                  onClick={() => handleTestTone('custom_device', formCustomToneDataUrl)}
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                    isTesting
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  }`}
                                >
                                  {isTesting ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1">
                          <input
                            type="radio"
                            name="alarm_tone"
                            value={opt.id}
                            checked={isSelected}
                            onChange={() => setFormToneId(opt.id)}
                            className="text-emerald-600 focus:ring-emerald-500 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                              {opt.nameBn}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                              {opt.descriptionBn}
                            </span>
                          </div>
                        </label>

                        {/* Test Button */}
                        <button
                          type="button"
                          onClick={() => handleTestTone(opt.id)}
                          title="টোন শুনুন"
                          className={`min-h-[30px] px-2.5 py-1 rounded-xl text-xs font-medium inline-flex items-center gap-1 transition-colors shrink-0 ${
                            isTesting
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {isTesting ? <Pause className="w-3 h-3 text-amber-600" /> : <Play className="w-3 h-3 text-emerald-600" />}
                          <span className="text-[11px]">{isTesting ? 'থামান' : 'শুনুন'}</span>
                        </button>
                      </div>
                    );
                  })}
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
