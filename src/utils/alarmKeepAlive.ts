/**
 * Shromik Sathi — Multi-Layer Background & Hardware Alarm Engine
 *
 * Layer 1: Service Worker Notification & TimestampTrigger sync (works when screen is locked or minimized)
 * Layer 2: Background Audio Keep-Alive + MediaSession + Screen WakeLock (prevents Android from killing the background timer)
 * Layer 3: Native Android Clock Intent (`android.intent.action.SET_ALARM`) & `.ics` VALARM Bridge
 *          (ensures the phone's hardware RTC clock rings even if the web app is swiped away from background or phone is restarted/powered off)
 */

import type { AlarmItem } from '../types';
import { playAlarmTone } from './alarmAudio';
import { getAccurateBstNow } from './networkTime';

const BG_GUARD_STORAGE_KEY = 'shromik_sathi_bg_alarm_guard_v1';

let keepAliveAudioCtx: AudioContext | null = null;
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
let activeWakeLock: any = null;
let lastGuardTriggeredKey = '';

export function isBackgroundAlarmGuardEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(BG_GUARD_STORAGE_KEY);
  return raw === null ? true : raw === '1';
}

export function setBackgroundAlarmGuardEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BG_GUARD_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore storage errors
  }
  if (!enabled) {
    stopBackgroundAlarmGuard();
  }
}

export async function requestAlarmNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    return false;
  }
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

/**
 * Syncs the current alarm list with the active Service Worker so background notifications
 * and TimestampTriggers stay up to date even when the app tab is closed.
 */
export async function syncAlarmsWithServiceWorker(alarms: AlarmItem[]): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const target = navigator.serviceWorker.controller || reg.active;
    if (target) {
      target.postMessage({
        type: 'SYNC_ALARMS',
        alarms,
      });
    }
    if ('periodicSync' in reg) {
      try {
        await (reg as any).periodicSync.register('shromik-alarm-periodic-check', {
          minInterval: 60 * 1000,
        });
      } catch {
        // Periodic background sync permission is optional
      }
    }
  } catch {
    // ignore if SW not active in dev
  }
}

/**
 * Dispatches an OS-level persistent alarm notification through the Service Worker when an alarm rings.
 */
export async function notifyAlarmRingingViaServiceWorker(alarm: AlarmItem): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const target = navigator.serviceWorker.controller || reg.active;
      if (target) {
        target.postMessage({
          type: 'SHOW_ALARM_NOTIFICATION',
          alarm,
        });
        return;
      }
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`⏰ ${alarm.label || 'ডিউটি অ্যালার্ম'}`, {
        body: `সময়: ${alarm.time} — শ্রমিক সাথী অ্যালার্ম বাজছে!`,
        icon: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
        requireInteraction: true,
      });
    }
  } catch {
    // ignore notification errors
  }
}

async function acquireScreenWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try {
    if (!activeWakeLock) {
      activeWakeLock = await (navigator as any).wakeLock.request('screen');
      activeWakeLock.addEventListener('release', () => {
        activeWakeLock = null;
      });
    }
  } catch {
    // WakeLock may fail if battery saver is active or tab not visible
  }
}

let userGestureUnlocked = false;
if (typeof window !== 'undefined') {
  const unlockAudioOnGesture = () => {
    userGestureUnlocked = true;
    if (keepAliveAudioCtx && keepAliveAudioCtx.state === 'suspended') {
      void keepAliveAudioCtx.resume();
    }
  };
  window.addEventListener('pointerdown', unlockAudioOnGesture, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudioOnGesture, { once: true, passive: true });
}

/**
 * Starts the ultra-low-power Web Audio + MediaSession background keep-alive guard.
 */
export function startBackgroundAlarmGuard(
  getActiveAlarms: () => AlarmItem[],
  onAlarmTriggered?: (alarm: AlarmItem) => void
): void {
  if (typeof window === 'undefined' || !isBackgroundAlarmGuardEnabled()) return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    // Play a tiny inaudible pulse once every 20 seconds after user gesture so Android Chrome keeps the audio session alive
    const pulseSubtleKeepAlive = () => {
      if (!userGestureUnlocked || !AudioCtx) return;
      if (!keepAliveAudioCtx || keepAliveAudioCtx.state === 'closed') {
        keepAliveAudioCtx = new AudioCtx();
      }
      if (keepAliveAudioCtx.state === 'suspended') {
        void keepAliveAudioCtx.resume();
        return;
      }
      try {
        const osc = keepAliveAudioCtx.createOscillator();
        const gain = keepAliveAudioCtx.createGain();
        osc.frequency.value = 30;
        gain.gain.value = 0.00005; // Completely inaudible
        osc.connect(gain);
        gain.connect(keepAliveAudioCtx.destination);
        const now = keepAliveAudioCtx.currentTime;
        osc.start(now);
        osc.stop(now + 0.05);
      } catch {
        // ignore
      }
    };

    pulseSubtleKeepAlive();
    void acquireScreenWakeLock();

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'শ্রমিক সাথী অ্যালার্ম গার্ড সক্রিয়',
          artist: 'আপনার নির্ধারিত সময়ে অ্যালার্ম বাজবে',
          album: 'Shromik Sathi',
          artwork: [
            {
              src: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        });
      } catch {
        // ignore MediaMetadata unsupported
      }
    }

    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }

    keepAliveInterval = setInterval(() => {
      const list = getActiveAlarms().filter((a) => a.isEnabled);
      if (list.length === 0) return;

      pulseSubtleKeepAlive();

      const bst = getAccurateBstNow();
      const triggerKey = `${bst.dateISO}_${bst.time24}`;
      if (triggerKey === lastGuardTriggeredKey) return;

      const match = list.find(
        (a) => a.time === bst.time24 && a.repeatDays.includes(bst.dayOfWeek)
      );
      if (match) {
        lastGuardTriggeredKey = triggerKey;
        playAlarmTone(match.toneId, undefined, true);
        void notifyAlarmRingingViaServiceWorker(match);
        onAlarmTriggered?.(match);
      }
    }, 10000);
  } catch {
    // ignore audio init restrictions
  }
}

export function stopBackgroundAlarmGuard(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  if (activeWakeLock) {
    try {
      void activeWakeLock.release();
    } catch {
      // ignore
    }
    activeWakeLock = null;
  }
  if (keepAliveAudioCtx && keepAliveAudioCtx.state !== 'closed') {
    try {
      void keepAliveAudioCtx.close();
    } catch {
      // ignore
    }
    keepAliveAudioCtx = null;
  }
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Builds an Android `intent://` URI that opens the phone's built-in System Clock app
 * (`android.intent.action.SET_ALARM`) pre-filled with the exact hour, minute, and label.
 * Android's native Clock app uses hardware RTC_WAKEUP, which rings even when the browser/app
 * is swiped away from background OR when the phone is powered off!
 */
export function buildAndroidSystemClockIntentUrl(alarm: Pick<AlarmItem, 'time' | 'label' | 'repeatDays'>): string {
  const [hhStr, mmStr] = (alarm.time || '07:00').split(':');
  const hour = Math.max(0, Math.min(23, parseInt(hhStr, 10) || 7));
  const minutes = Math.max(0, Math.min(59, parseInt(mmStr, 10) || 0));
  const message = encodeURIComponent((alarm.label || 'শ্রমিক সাথী ডিউটি অ্যালার্ম').trim());

  // Android Intent URI for SET_ALARM action
  return `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minutes};S.android.intent.extra.alarm.MESSAGE=${message};B.android.intent.extra.alarm.SKIP_UI=false;end`;
}

/**
 * Generates an iCalendar (`.ics`) content string with an embedded hardware `VALARM` audio/display
 * trigger and weekly recurrence rule (`RRULE`) so any phone (Android or iOS) can register a
 * system-level recurring alarm notification.
 */
export function generateAlarmIcsContent(alarm: Pick<AlarmItem, 'id' | 'time' | 'label' | 'repeatDays'>): string {
  const [hhStr, mmStr] = (alarm.time || '07:00').split(':');
  const hour = String(Math.max(0, Math.min(23, parseInt(hhStr, 10) || 7))).padStart(2, '0');
  const minute = String(Math.max(0, Math.min(59, parseInt(mmStr, 10) || 0))).padStart(2, '0');

  const bst = getAccurateBstNow();
  const datePart = bst.dateISO.replace(/-/g, '');
  const dayMap: Record<number, string> = {
    0: 'SU',
    1: 'MO',
    2: 'TU',
    3: 'WE',
    4: 'TH',
    5: 'FR',
    6: 'SA',
  };
  const byDays = (alarm.repeatDays && alarm.repeatDays.length > 0 ? alarm.repeatDays : [6, 0, 1, 2, 3, 4])
    .map((d) => dayMap[d])
    .filter(Boolean)
    .join(',');

  const safeSummary = (alarm.label || 'শ্রমিক সাথী ডিউটি অ্যালার্ম').replace(/[\r\n,;]/g, ' ');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shromik Sathi//Worker Alarm//BN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:shromik-alarm-${alarm.id || Date.now()}@shromiksathi.app`,
    `DTSTAMP:${datePart}T${hour}${minute}00Z`,
    `DTSTART;TZID=Asia/Dhaka:${datePart}T${hour}${minute}00`,
    `DTEND;TZID=Asia/Dhaka:${datePart}T${hour}${minute}00`,
    byDays ? `RRULE:FREQ=WEEKLY;BYDAY=${byDays}` : 'RRULE:FREQ=DAILY',
    `SUMMARY:⏰ ${safeSummary}`,
    'DESCRIPTION:শ্রমিক সাথী ডিউটি অ্যালার্ম',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:⏰ ${safeSummary}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:AUDIO',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Triggers the native Android System Clock alarm on Android devices, or downloads/opens
 * a system `.ics` VALARM file on desktop/iOS devices.
 */
export function registerPhoneSystemHardwareAlarm(alarm: Pick<AlarmItem, 'id' | 'time' | 'label' | 'repeatDays'>): 'android_intent' | 'ics_calendar' {
  if (typeof window === 'undefined') return 'ics_calendar';

  if (isAndroidDevice()) {
    try {
      const intentUrl = buildAndroidSystemClockIntentUrl(alarm);
      const link = document.createElement('a');
      link.href = intentUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
      }, 300);
      return 'android_intent';
    } catch {
      // Fallback to ICS below
    }
  }

  const icsContent = generateAlarmIcsContent(alarm);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shromik-alarm-${(alarm.time || '0700').replace(':', '')}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
  return 'ics_calendar';
}
