/**
 * Shromik Sathi — Background & Service Worker Alarm Keep-Alive Engine
 *
 * Ensures alarms trigger and play the user's cached custom ringtone even when the app
 * is minimized, screen is locked, or swiped from recent apps.
 */

import type { AlarmItem } from '../types';
import { getCustomToneFromStorage, LATEST_CUSTOM_TONE_KEY, playAlarmTone } from './alarmAudio';
import { getAccurateBstNow } from './networkTime';

const BG_GUARD_STORAGE_KEY = 'shromik_sathi_bg_alarm_guard_v1';

// Tiny valid 1-second silent WAV (8kHz mono PCM) so Android keeps the media session & background timer alive
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let keepAliveAudioEl: HTMLAudioElement | null = null;
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
let activeWakeLock: any = null;
let lastGuardTriggeredKey = '';
let webLockHeld = false;

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
 * Syncs the current alarm list with the active Service Worker so background notifications,
 * precision timers, and TimestampTriggers stay active even when the app is closed.
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
    if ('sync' in reg) {
      try {
        await (reg as any).sync.register('shromik-alarm-sync-check');
      } catch {
        // Background sync optional
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

function acquirePersistentWebLock(): void {
  if (webLockHeld || typeof navigator === 'undefined' || !('locks' in navigator)) return;
  try {
    webLockHeld = true;
    navigator.locks
      .request('shromik_sathi_background_alarm_lock', { mode: 'shared' }, () => {
        return new Promise<void>(() => {
          // Hold lock for lifetime of active alarm session to discourage background tab freeze
        });
      })
      .catch(() => {
        webLockHeld = false;
      });
  } catch {
    webLockHeld = false;
  }
}

function startSilentMediaKeepAliveLoop(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!keepAliveAudioEl) {
      const audio = new Audio(SILENT_WAV_DATA_URI);
      audio.loop = true;
      audio.volume = 0.01;
      keepAliveAudioEl = audio;
    }
    if (keepAliveAudioEl.paused) {
      const p = keepAliveAudioEl.play();
      if (p) {
        p.catch(() => {
          // Will unlock on next user interaction
        });
      }
    }
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
        navigator.mediaSession.playbackState = 'playing';
      } catch {
        // ignore MediaMetadata unsupported
      }
    }
  } catch {
    // ignore
  }
}

if (typeof window !== 'undefined') {
  const unlockOnGesture = () => {
    if (keepAliveAudioEl && keepAliveAudioEl.paused) {
      void keepAliveAudioEl.play().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlockOnGesture, { passive: true });
  window.addEventListener('keydown', unlockOnGesture, { passive: true });
}

/**
 * Starts the continuous background keep-alive guard so alarms ring on time even in background.
 */
export function startBackgroundAlarmGuard(
  getActiveAlarms: () => AlarmItem[],
  onAlarmTriggered?: (alarm: AlarmItem) => void
): void {
  if (typeof window === 'undefined' || !isBackgroundAlarmGuardEnabled()) return;

  try {
    const activeList = getActiveAlarms().filter((a) => a.isEnabled);
    if (activeList.length === 0) {
      stopBackgroundAlarmGuard();
      return;
    }

    startSilentMediaKeepAliveLoop();
    acquirePersistentWebLock();
    void acquireScreenWakeLock();

    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }

    keepAliveInterval = setInterval(async () => {
      const list = getActiveAlarms().filter((a) => a.isEnabled);
      if (list.length === 0) return;

      startSilentMediaKeepAliveLoop();

      const bst = getAccurateBstNow();
      const triggerKey = `${bst.dateISO}_${bst.time24}`;
      if (triggerKey === lastGuardTriggeredKey) return;

      const match = list.find(
        (a) => a.time === bst.time24 && a.repeatDays.includes(bst.dayOfWeek)
      );
      if (match) {
        lastGuardTriggeredKey = triggerKey;
        const stored = await getCustomToneFromStorage(
          match.customToneId || LATEST_CUSTOM_TONE_KEY
        );
        playAlarmTone('custom_device', stored?.dataUrl, true);
        void notifyAlarmRingingViaServiceWorker(match);
        onAlarmTriggered?.(match);
      }
    }, 4000);
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
  if (keepAliveAudioEl) {
    try {
      keepAliveAudioEl.pause();
    } catch {
      // ignore
    }
    keepAliveAudioEl = null;
  }
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function buildAndroidSystemClockIntentUrl(
  alarm: Pick<AlarmItem, 'time' | 'label' | 'repeatDays'>
): string {
  const [hhStr, mmStr] = (alarm.time || '07:00').split(':');
  const hour = Math.max(0, Math.min(23, parseInt(hhStr, 10) || 7));
  const minutes = Math.max(0, Math.min(59, parseInt(mmStr, 10) || 0));
  const message = encodeURIComponent((alarm.label || 'শ্রমিক সাথী ডিউটি অ্যালার্ম').trim());

  return `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minutes};S.android.intent.extra.alarm.MESSAGE=${message};B.android.intent.extra.alarm.SKIP_UI=false;end`;
}

export function generateAlarmIcsContent(
  alarm: Pick<AlarmItem, 'id' | 'time' | 'label' | 'repeatDays'>
): string {
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
  const byDays = (
    alarm.repeatDays && alarm.repeatDays.length > 0 ? alarm.repeatDays : [6, 0, 1, 2, 3, 4]
  )
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

export function registerPhoneSystemHardwareAlarm(
  alarm: Pick<AlarmItem, 'id' | 'time' | 'label' | 'repeatDays'>
): 'android_intent' | 'ics_calendar' {
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
