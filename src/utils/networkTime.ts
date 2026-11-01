// Accurate Online / Google Server-Synced Time Utility for Shromik Sathi
// Ensures accurate Bangladesh Standard Time (UTC+6) even when the user's device clock or timezone is wrong.

export interface AccurateBstTimeInfo {
  hh: string;
  mm: string;
  ss: string;
  time24: string; // HH:mm
  time24WithSeconds: string; // HH:mm:ss
  dayOfWeek: number; // 0 = Sun ... 6 = Sat
  dateISO: string; // YYYY-MM-DD in Asia/Dhaka
  isOnlineSynced: boolean;
  lastSyncedAtMs: number | null;
}

const BD_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+6 (Bangladesh Standard Time has no DST)

let baseServerUtcMs: number | null = null;
let basePerformanceMs: number = 0;
let lastSyncedTimestamp: number | null = null;
let syncInProgress: Promise<boolean> | null = null;

/**
 * Pure helper: Given a UTC epoch timestamp in milliseconds, computes the exact
 * Bangladesh Standard Time (UTC+6) components without relying on device local timezone.
 */
export function computeBstComponentsFromUtcMs(
  utcEpochMs: number,
  isOnlineSynced = false,
  lastSyncedAtMs: number | null = null
): AccurateBstTimeInfo {
  const bstShifted = new Date(utcEpochMs + BD_OFFSET_MS);
  const hh = String(bstShifted.getUTCHours()).padStart(2, '0');
  const mm = String(bstShifted.getUTCMinutes()).padStart(2, '0');
  const ss = String(bstShifted.getUTCSeconds()).padStart(2, '0');
  const dayOfWeek = bstShifted.getUTCDay();
  const yyyy = bstShifted.getUTCFullYear();
  const month = String(bstShifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(bstShifted.getUTCDate()).padStart(2, '0');

  return {
    hh,
    mm,
    ss,
    time24: `${hh}:${mm}`,
    time24WithSeconds: `${hh}:${mm}:${ss}`,
    dayOfWeek,
    dateISO: `${yyyy}-${month}-${dd}`,
    isOnlineSynced,
    lastSyncedAtMs,
  };
}

/**
 * Returns the current accurate UTC epoch in milliseconds using the monotonic clock
 * anchored to the latest online server timestamp.
 */
export function getAccurateUtcNowMs(): number {
  if (baseServerUtcMs !== null && typeof performance !== 'undefined') {
    const elapsed = performance.now() - basePerformanceMs;
    if (elapsed >= 0) {
      return Math.round(baseServerUtcMs + elapsed);
    }
  }
  return Date.now();
}

/**
 * Returns the current accurate Bangladesh Standard Time (UTC+6) info.
 */
export function getAccurateBstNow(): AccurateBstTimeInfo {
  const utcMs = getAccurateUtcNowMs();
  return computeBstComponentsFromUtcMs(utcMs, baseServerUtcMs !== null, lastSyncedTimestamp);
}

/**
 * Synchronizes time with Google / Server HTTP Date header (and public time API fallback).
 * Immune to misconfigured local device clock or wrong phone timezone.
 */
export async function syncOnlineAccurateTime(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return false;
  }
  if (syncInProgress) {
    return syncInProgress;
  }

  syncInProgress = (async () => {
    try {
      // 1. Primary: Fetch HEAD from same-origin server (Google Cloud Run / NTP-synced server Date header)
      const reqStartPerf = performance.now();
      const response = await fetch(`${window.location.origin}/? _ts=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
      });
      const reqEndPerf = performance.now();
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        const parsedServerMs = Date.parse(dateHeader);
        if (!Number.isNaN(parsedServerMs) && parsedServerMs > 1700000000000) {
          const rttHalf = Math.max(0, (reqEndPerf - reqStartPerf) / 2);
          baseServerUtcMs = parsedServerMs + rttHalf;
          basePerformanceMs = reqEndPerf;
          lastSyncedTimestamp = baseServerUtcMs;
          return true;
        }
      }
    } catch {
      // Proceed to fallback time API if same-origin HEAD fails
    }

    try {
      // 2. Fallback: WorldTimeAPI / TimeAPI for Asia/Dhaka
      const reqStartPerf = performance.now();
      const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Dhaka', {
        cache: 'no-store',
      });
      const reqEndPerf = performance.now();
      if (res.ok) {
        const data = await res.json();
        const unixtimeSec = typeof data?.unixtime === 'number' ? data.unixtime : null;
        if (unixtimeSec && unixtimeSec > 1700000000) {
          const rttHalf = Math.max(0, (reqEndPerf - reqStartPerf) / 2);
          baseServerUtcMs = unixtimeSec * 1000 + rttHalf;
          basePerformanceMs = reqEndPerf;
          lastSyncedTimestamp = baseServerUtcMs;
          return true;
        }
      }
    } catch {
      // Ignore network errors when offline
    }

    return baseServerUtcMs !== null;
  })().finally(() => {
    syncInProgress = null;
  });

  return syncInProgress;
}
