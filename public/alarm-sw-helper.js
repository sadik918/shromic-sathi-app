/* eslint-disable no-restricted-globals */
/**
 * Shromik Sathi — Offline Navigation Safety Net & Background Alarm Service Worker Helper
 * Imported into the Workbox Service Worker via workbox.importScripts: ['/alarm-sw-helper.js']
 */

const SW_ALARM_DB_NAME = 'ShromikSathiSWAlarmsDB';
const SW_ALARM_STORE = 'alarms_state';
const SW_NAV_SHELL_CACHE = 'shromik-sathi-nav-shell-v2';

// Offline Navigation Safety Net:
// Always keep the SPA shell (/index.html) cached so reloading on Firebase Hosting
// while offline or on a weak mobile connection immediately boots the app and user data
// instead of showing the browser "You are offline" error screen.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SW_NAV_SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled([
          cache.add(new Request('/index.html', { cache: 'reload' })),
          cache.add(new Request('/', { cache: 'reload' })),
        ])
      )
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('shromik-sathi-nav-shell-') && k !== SW_NAV_SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .catch(() => {})
  );
});

async function matchCachedAppShell() {
  // 1. Prefer Workbox precache first so index.html always matches precached hashed JS/CSS chunks
  try {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name.startsWith('workbox-precache')) {
        const wbCache = await caches.open(name);
        const wbMatch =
          (await wbCache.match('/index.html', { ignoreSearch: true })) ||
          (await wbCache.match('index.html', { ignoreSearch: true }));
        if (wbMatch) return wbMatch;
      }
    }
  } catch {
    // ignore workbox cache lookup errors
  }

  // 2. Fall back to our dedicated navigation shell cache
  try {
    const shellCache = await caches.open(SW_NAV_SHELL_CACHE);
    const fromShell =
      (await shellCache.match('/index.html', { ignoreSearch: true })) ||
      (await shellCache.match('/', { ignoreSearch: true }));
    if (fromShell) return fromShell;
  } catch {
    // ignore shell cache lookup errors
  }

  // 3. Final sweep across all caches
  try {
    const fromAny =
      (await caches.match('/index.html', { ignoreSearch: true })) ||
      (await caches.match('index.html', { ignoreSearch: true })) ||
      (await caches.match('/', { ignoreSearch: true }));
    if (fromAny) return fromAny;
  } catch {
    // ignore global cache lookup errors
  }

  return null;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;

  const isNavigation =
    req.mode === 'navigate' ||
    (req.destination === 'document' &&
      (req.headers.get('accept') || '').includes('text/html'));

  if (!isNavigation) return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/') ||
    url.pathname === '/robots.txt' ||
    url.pathname === '/sitemap.xml'
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      // Instant 0ms offline reload: boot directly from cached SPA shell so user sees their data immediately
      if (typeof self.navigator !== 'undefined' && self.navigator.onLine === false) {
        const instantShell = await matchCachedAppShell();
        if (instantShell) return instantShell;
      }

      // Online: try live network with a short timeout, falling back seamlessly to cached SPA shell
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
      try {
        const networkResponse = await fetch(req, controller ? { signal: controller.signal } : undefined);
        if (timeoutId) clearTimeout(timeoutId);
        if (
          networkResponse &&
          networkResponse.ok &&
          (networkResponse.headers.get('content-type') || '').includes('text/html')
        ) {
          const clonedA = networkResponse.clone();
          const clonedB = networkResponse.clone();
          caches
            .open(SW_NAV_SHELL_CACHE)
            .then((cache) => Promise.allSettled([cache.put('/index.html', clonedA), cache.put('/', clonedB)]))
            .catch(() => {});
          return networkResponse;
        }
        const cachedFallback = await matchCachedAppShell();
        if (cachedFallback) return cachedFallback;
        return networkResponse;
      } catch {
        if (timeoutId) clearTimeout(timeoutId);
        const cachedShell = await matchCachedAppShell();
        if (cachedShell) return cachedShell;
        return Response.error();
      }
    })()
  );
});

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

async function saveLastRingingAlarmInSW(alarm) {
  try {
    const db = await openSwAlarmDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SW_ALARM_STORE, 'readwrite');
      tx.objectStore(SW_ALARM_STORE).put(
        alarm ? { alarm, triggeredAt: Date.now() } : null,
        'last_ringing_alarm'
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
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

  const repeatDays =
    Array.isArray(alarm.repeatDays) && alarm.repeatDays.length > 0
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
    if (targetUtcMs > nowMs + 1000) {
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
        body: `সময়: ${alarm.time} — শ্রমিক সাথী অ্যালার্ম বাজছে!`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `shromik-scheduled-alarm-${alarm.id}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [800, 200, 800, 200, 1000, 200, 1000, 200, 1200],
        showTrigger: new self.TimestampTrigger(nextMs),
        data: {
          url: `/?tab=more&sub=alarm&ring=1&alarmId=${encodeURIComponent(alarm.id)}`,
          alarmId: alarm.id,
        },
        actions: [
          { action: 'dismiss', title: 'অ্যালার্ম বন্ধ করুন' },
          { action: 'snooze_5', title: '৫ মিনিট স্নুজ' },
        ],
      });
    }
  } catch {
    // TimestampTrigger fallback handled by SW precision timers below
  }
}

let lastSwTriggeredKey = '';
let swPrecisionTimer = null;
let swIntervalTimer = null;

async function fireSwAlarmNotificationAndWakeClients(matching, dateISO) {
  await saveLastRingingAlarmInSW(matching);

  await self.registration.showNotification(`⏰ ${matching.label || 'ডিউটি অ্যালার্ম'}`, {
    body: `সময়: ${matching.time} — আপনার নির্ধারিত অ্যালার্ম বাজছে!`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `shromik-live-alarm-${matching.id}-${dateISO}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [800, 200, 800, 200, 1000, 200, 1000, 200, 1200],
    data: {
      url: `/?tab=more&sub=alarm&ring=1&alarmId=${encodeURIComponent(matching.id)}`,
      alarmId: matching.id,
    },
    actions: [
      { action: 'dismiss', title: 'অ্যালার্ম বন্ধ করুন' },
      { action: 'snooze_5', title: '৫ মিনিট স্নুজ' },
    ],
  });

  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clientList.length > 0) {
    for (const client of clientList) {
      client.postMessage({
        type: 'SW_ALARM_TRIGGERED',
        alarm: matching,
      });
    }
  } else if (self.clients.openWindow) {
    try {
      await self.clients.openWindow(
        `/?tab=more&sub=alarm&ring=1&alarmId=${encodeURIComponent(matching.id)}`
      );
    } catch {
      // Browser may require notification tap to open window
    }
  }
}

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
      await fireSwAlarmNotificationAndWakeClients(matching, bst.dateISO);
    }
  } catch {
    // ignore errors
  }
}

function armSwPrecisionTimers(alarms) {
  if (swPrecisionTimer) {
    clearTimeout(swPrecisionTimer);
    swPrecisionTimer = null;
  }
  if (swIntervalTimer) {
    clearInterval(swIntervalTimer);
    swIntervalTimer = null;
  }

  const enabledAlarms = Array.isArray(alarms) ? alarms.filter((a) => a && a.isEnabled) : [];
  if (enabledAlarms.length === 0) return;

  // Periodic 5s check while SW stays alive
  swIntervalTimer = setInterval(() => {
    void checkAndFireSwAlarms();
  }, 5000);

  // Find the nearest upcoming alarm timestamp and set an exact timeout
  let nearestMs = null;
  for (const alarm of enabledAlarms) {
    const nextMs = computeNextTriggerTimestampMs(alarm);
    if (nextMs && (nearestMs === null || nextMs < nearestMs)) {
      nearestMs = nextMs;
    }
  }

  if (nearestMs !== null) {
    const delayMs = Math.max(500, nearestMs - Date.now());
    if (delayMs <= 24 * 60 * 60 * 1000) {
      swPrecisionTimer = setTimeout(() => {
        void checkAndFireSwAlarms().then(() => {
          void loadAlarmsFromSW().then((latest) => armSwPrecisionTimers(latest));
        });
      }, delayMs);
    }
  }
}

// Re-arm timers whenever the Service Worker wakes up
void loadAlarmsFromSW().then((alarms) => {
  armSwPrecisionTimers(alarms);
  void checkAndFireSwAlarms();
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SYNC_ALARMS') {
    const alarms = Array.isArray(data.alarms) ? data.alarms : [];
    event.waitUntil(
      (async () => {
        await saveAlarmsInSW(alarms);
        armSwPrecisionTimers(alarms);
        await scheduleHardwareNotificationTriggers(alarms);
        await checkAndFireSwAlarms();
      })()
    );
  } else if (data.type === 'SHOW_ALARM_NOTIFICATION' && data.alarm) {
    const alarm = data.alarm;
    event.waitUntil(
      (async () => {
        await saveLastRingingAlarmInSW(alarm);
        await self.registration.showNotification(`⏰ ${alarm.label || 'ডিউটি অ্যালার্ম'}`, {
          body: `সময়: ${alarm.time} — শ্রমিক সাথী অ্যালার্ম বাজছে!`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `shromik-ringing-${alarm.id}`,
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [800, 200, 800, 200, 1000, 200, 1000, 200, 1200],
          data: {
            url: `/?tab=more&sub=alarm&ring=1&alarmId=${encodeURIComponent(alarm.id)}`,
            alarmId: alarm.id,
          },
          actions: [
            { action: 'dismiss', title: 'অ্যালার্ম বন্ধ করুন' },
            { action: 'snooze_5', title: '৫ মিনিট স্নুজ' },
          ],
        });
      })()
    );
  } else if (data.type === 'CLEAR_RINGING_ALARM') {
    event.waitUntil(saveLastRingingAlarmInSW(null));
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
      if (action === 'dismiss') {
        await saveLastRingingAlarmInSW(null);
      }
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
      if (action !== 'dismiss' && self.clients.openWindow) {
        await self.clients.openWindow(notifData.url || '/?tab=more&sub=alarm&ring=1');
      }
    })()
  );
});
