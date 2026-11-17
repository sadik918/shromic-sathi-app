/* eslint-disable no-restricted-globals */
/**
 * Shromik Sathi — Offline Navigation Safety Net & Background Alarm Service Worker Helper
 * Imported into the Workbox Service Worker via workbox.importScripts: ['/alarm-sw-helper.js']
 */

const SW_ALARM_DB_NAME = 'ShromikSathiSWAlarmsDB';
const SW_ALARM_STORE = 'alarms_state';

function openSwAlarmDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SW_ALARM_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SW_ALARM_STORE)) {
        db.createObjectStore(SW_ALARM_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveAlarmsInSW(alarms) {
  try {
    const db = await openSwAlarmDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SW_ALARM_STORE, 'readwrite');
      tx.objectStore(SW_ALARM_STORE).put(Array.isArray(alarms) ? alarms : [], 'active_alarms');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore IDB errors
  }
}

async function loadAlarmsFromSW() {
  try {
    const db = await openSwAlarmDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(SW_ALARM_STORE, 'readonly');
      const req = tx.objectStore(SW_ALARM_STORE).get('active_alarms');
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

function getBstNowParts() {
  // Bangladesh Standard Time is UTC+6
  const bstMs = Date.now() + 6 * 60 * 60 * 1000;
  const d = new Date(bstMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return {
    dateISO: `${year}-${month}-${day}`,
    time24: `${hh}:${mm}`,
    dayOfWeek: d.getUTCDay(),
  };
}

function computeNextTriggerTimestampMs(alarm) {
  if (!alarm || !alarm.isEnabled || typeof alarm.time !== 'string') return null;
  const parts = alarm.time.split(':');
  const targetH = parseInt(parts[0], 10);
  const targetM = parseInt(parts[1], 10);
  if (isNaN(targetH) || isNaN(targetM)) return null;

  const repeatDays = Array.isArray(alarm.repeatDays) && alarm.repeatDays.length > 0
    ? alarm.repeatDays
    : [0, 1, 2, 3, 4, 5, 6];

  const nowMs = Date.now();
  const bstOffsetMs = 6 * 60 * 60 * 1000;
  const bstNow = new Date(nowMs + bstOffsetMs);

  for (let offsetDays = 0; offsetDays <= 7; offsetDays++) {
    const candidateBst = new Date(bstNow.getTime() + offsetDays * 86400000);
    const dayOfWeek = candidateBst.getUTCDay();
    if (!repeatDays.includes(dayOfWeek)) continue;

    const targetBstMs = Date.UTC(
      candidateBst.getUTCFullYear(),
      candidateBst.getUTCMonth(),
      candidateBst.getUTCDate(),
      targetH,
      targetM,
      0,
      0
    );
    const targetUtcMs = targetBstMs - bstOffsetMs;
    if (targetUtcMs > nowMs + 5000) {
      return targetUtcMs;
    }
  }
  return null;
}

async function scheduleHardwareNotificationTriggers(alarms) {
  try {
    if (
      typeof self.Notification === 'undefined' ||
      !('showTrigger' in self.Notification.prototype) ||
      typeof self.TimestampTrigger !== 'function'
    ) {
      return;
    }

    // Clear previously scheduled trigger notifications first
    const existing = await self.registration.getNotifications({ includeTriggered: true });
    for (const notif of existing) {
      if (notif.tag && notif.tag.startsWith('shromik-scheduled-alarm-')) {
        notif.close();
      }
    }

    for (const alarm of alarms) {
      if (!alarm || !alarm.isEnabled) continue;
      const nextMs = computeNextTriggerTimestampMs(alarm);
      if (!nextMs) continue;

      await self.registration.showNotification(`⏰ ${alarm.label || 'ডিউটি অ্যালার্ম'}`, {
        body: `সময়: ${alarm.time} — শ্রমিক সাথী অ্যালার্ম বাজছে! অ্যাপ খুলে বন্ধ বা স্নুজ করুন।`,
        icon: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
        badge: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
        tag: `shromik-scheduled-alarm-${alarm.id}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [500, 200, 500, 200, 800, 200, 800],
        showTrigger: new self.TimestampTrigger(nextMs),
        data: {
          url: '/?tab=more&sub=alarm&ring=1',
          alarmId: alarm.id,
        },
        actions: [
          { action: 'dismiss', title: 'অ্যালার্ম বন্ধ করুন' },
          { action: 'snooze_5', title: '৫ মিনিট স্নুজ' },
        ],
      });
    }
  } catch {
    // TimestampTrigger is experimental on some browsers; fallback handled below
  }
}

let lastSwTriggeredKey = '';

async function checkAndFireSwAlarms() {
  try {
    const alarms = await loadAlarmsFromSW();
    if (!alarms || alarms.length === 0) return;

    const bst = getBstNowParts();
    const triggerKey = `${bst.dateISO}_${bst.time24}`;
    if (triggerKey === lastSwTriggeredKey) return;

    const matching = alarms.find(
      (a) =>
        a &&
        a.isEnabled &&
        a.time === bst.time24 &&
        Array.isArray(a.repeatDays) &&
        a.repeatDays.includes(bst.dayOfWeek)
    );

    if (matching) {
      lastSwTriggeredKey = triggerKey;
      await self.registration.showNotification(`⏰ ${matching.label || 'ডিউটি অ্যালার্ম'}`, {
        body: `সময়: ${matching.time} — আপনার নির্ধারিত অ্যালার্ম বাজছে!`,
        icon: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
        badge: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
        tag: `shromik-live-alarm-${matching.id}-${bst.dateISO}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [600, 200, 600, 200, 900, 200, 900],
        data: {
          url: '/?tab=more&sub=alarm&ring=1',
          alarmId: matching.id,
        },
        actions: [
          { action: 'dismiss', title: 'অ্যালার্ম বন্ধ করুন' },
          { action: 'snooze_5', title: '৫ মিনিট স্নুজ' },
        ],
      });

      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({
          type: 'SW_ALARM_TRIGGERED',
          alarm: matching,
        });
      }
    }
  } catch {
    // ignore errors
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SYNC_ALARMS') {
    const alarms = Array.isArray(data.alarms) ? data.alarms : [];
    event.waitUntil(
      (async () => {
        await saveAlarmsInSW(alarms);
        await scheduleHardwareNotificationTriggers(alarms);
        await checkAndFireSwAlarms();
      })()
    );
  } else if (data.type === 'SHOW_ALARM_NOTIFICATION' && data.alarm) {
    const alarm = data.alarm;
    event.waitUntil(
      self.registration.showNotification(`⏰ ${alarm.label || 'ডিউটি অ্যালার্ম'}`, {
        body: `সময়: ${alarm.time} — শ্রমিক সাথী অ্যালার্ম বাজছে!`,
        icon: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
        badge: '/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png',
        tag: `shromik-ringing-${alarm.id}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [600, 200, 600, 200, 900, 200, 900],
        data: {
          url: '/?tab=more&sub=alarm&ring=1',
          alarmId: alarm.id,
        },
        actions: [
          { action: 'dismiss', title: 'অ্যালার্ম বন্ধ করুন' },
          { action: 'snooze_5', title: '৫ মিনিট স্নুজ' },
        ],
      })
    );
  } else if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'shromik-alarm-periodic-check') {
    event.waitUntil(checkAndFireSwAlarms());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'shromik-alarm-sync-check') {
    event.waitUntil(checkAndFireSwAlarms());
  }
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notifData = event.notification.data || {};
  event.notification.close();

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({
          type: 'SW_NOTIFICATION_ACTION',
          action: action || 'open',
          alarmId: notifData.alarmId,
        });
        if ('focus' in client) {
          await client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(notifData.url || '/?tab=more&sub=alarm');
      }
    })()
  );
});
