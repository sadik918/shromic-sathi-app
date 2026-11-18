/**
 * Custom Phone Ringtone Cache & Playback Engine for Shromik Sathi
 *
 * - Stores user-uploaded audio files in both IndexedDB (`ShromikSathiAlarmDB`) and
 *   Browser Cache Storage (`shromik-sathi-alarm-audio-v1`) so the ringtone works 100% offline
 *   directly from the phone's local cache.
 * - Plays the full duration of the uploaded audio at 100% volume without artificial cutoffs.
 */

export type AlarmToneId =
  | 'factory_siren'
  | 'digital_beep'
  | 'gentle_chime'
  | 'morning_bell'
  | 'custom_device';

export interface AlarmToneOption {
  id: AlarmToneId;
  nameBn: string;
  nameEn: string;
  descriptionBn: string;
}

// Only custom device audio is offered; no pre-selected default synthesized tones.
export const ALARM_TONE_OPTIONS: AlarmToneOption[] = [
  {
    id: 'custom_device',
    nameBn: 'ফোন থেকে আপলোড করা রিংটোন',
    nameEn: 'Custom Ringtone from Phone',
    descriptionBn: 'আপনার ফোনের মেমোরি থেকে আপলোড করা অডিও ক্যাশ থেকে সম্পূর্ণ বাজবে',
  },
];

const DB_NAME = 'ShromikSathiAlarmDB';
const STORE_NAME = 'custom_tones';
const AUDIO_CACHE_NAME = 'shromik-sathi-alarm-audio-v1';
export const LATEST_CUSTOM_TONE_KEY = 'latest_custom_tone';

let activeAudioElement: HTMLAudioElement | null = null;
let activeAudioContext: AudioContext | null = null;
let activeOscillators: OscillatorNode[] = [];
let activeGainNodes: GainNode[] = [];
let audioLoopInterval: ReturnType<typeof setInterval> | null = null;

// Stop any currently playing sound
export function stopAlarmSound(): void {
  if (audioLoopInterval) {
    clearInterval(audioLoopInterval);
    audioLoopInterval = null;
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.onended = null;
      activeAudioElement.onerror = null;
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      // Ignore abort
    }
    activeAudioElement = null;
  }

  activeOscillators.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {
      // Ignore
    }
  });
  activeOscillators = [];

  activeGainNodes.forEach((gain) => {
    try {
      gain.disconnect();
    } catch {
      // Ignore
    }
  });
  activeGainNodes = [];

  if (activeAudioContext && activeAudioContext.state !== 'closed') {
    try {
      void activeAudioContext.close();
    } catch {
      // Ignore
    }
    activeAudioContext = null;
  }
}

/**
 * Play the user's uploaded custom ringtone from phone cache for its FULL duration at 100% volume.
 * - When `loop = true` (active alarm ringing), the full audio track repeats after finishing until dismissed.
 * - When `loop = false` (previewing in UI), the full audio track plays from start to finish and triggers `onEnded`.
 */
export function playAlarmTone(
  _toneId: AlarmToneId,
  customAudioDataUrl?: string,
  loop = true,
  onEnded?: () => void
): void {
  stopAlarmSound();

  const startPlayback = (audioUrl: string) => {
    try {
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      audio.loop = loop;
      audio.volume = 1.0;
      activeAudioElement = audio;

      audio.onended = () => {
        if (!loop) {
          activeAudioElement = null;
          onEnded?.();
        }
      };

      audio.onerror = () => {
        if (!loop) {
          activeAudioElement = null;
          onEnded?.();
        }
      };

      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          if (!loop) {
            onEnded?.();
          }
        });
      }
    } catch {
      if (!loop) {
        onEnded?.();
      }
    }
  };

  if (customAudioDataUrl) {
    startPlayback(customAudioDataUrl);
    return;
  }

  // Automatically resolve from phone cache (IndexedDB / CacheStorage) if URL was not passed inline
  void getCustomToneFromStorage(LATEST_CUSTOM_TONE_KEY).then((stored) => {
    if (stored?.dataUrl) {
      startPlayback(stored.dataUrl);
    } else {
      onEnded?.();
    }
  });
}

function openTonesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToneToCacheStorage(
  id: string,
  name: string,
  dataUrl: string
): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const payload = JSON.stringify({ id, name, dataUrl, savedAt: Date.now() });
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    await cache.put(
      `/__cached_alarm_audio__/${encodeURIComponent(id)}`,
      new Response(payload, { headers })
    );
    await cache.put(
      `/__cached_alarm_audio__/${LATEST_CUSTOM_TONE_KEY}`,
      new Response(payload, { headers })
    );
  } catch {
    // Ignore CacheStorage quota errors
  }
}

async function loadToneFromCacheStorage(
  id: string
): Promise<{ id: string; name: string; dataUrl: string } | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const res =
      (await cache.match(`/__cached_alarm_audio__/${encodeURIComponent(id)}`)) ||
      (await cache.match(`/__cached_alarm_audio__/${LATEST_CUSTOM_TONE_KEY}`));
    if (!res) return null;
    const parsed = await res.json();
    if (parsed && typeof parsed.dataUrl === 'string' && parsed.dataUrl.length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveCustomToneToStorage(
  id: string,
  name: string,
  dataUrl: string
): Promise<void> {
  const record = { id, name, dataUrl, savedAt: Date.now() };

  // 1. Save in Cache Storage for fast offline & Service Worker access
  await saveToneToCacheStorage(id, name, dataUrl);

  // 2. Save in IndexedDB under both the specific tone ID and LATEST_CUSTOM_TONE_KEY
  try {
    const db = await openTonesDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record, id);
      store.put(record, LATEST_CUSTOM_TONE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    try {
      if (dataUrl.length < 3 * 1024 * 1024) {
        localStorage.setItem(`shromik_custom_tone_${id}`, JSON.stringify(record));
        localStorage.setItem(
          `shromik_custom_tone_${LATEST_CUSTOM_TONE_KEY}`,
          JSON.stringify(record)
        );
      }
    } catch {
      // Quota exceeded
    }
  }
}

export async function getCustomToneFromStorage(
  id?: string
): Promise<{ id: string; name: string; dataUrl: string } | null> {
  const lookupKey = id && id.trim() ? id.trim() : LATEST_CUSTOM_TONE_KEY;

  // 1. Try IndexedDB first
  try {
    const db = await openTonesDB();
    const fromIdb = await new Promise<{ id: string; name: string; dataUrl: string } | null>(
      (resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(lookupKey);
        req.onsuccess = () => {
          if (req.result && typeof req.result.dataUrl === 'string') {
            resolve(req.result);
          } else if (lookupKey !== LATEST_CUSTOM_TONE_KEY) {
            const fallbackReq = store.get(LATEST_CUSTOM_TONE_KEY);
            fallbackReq.onsuccess = () => resolve(fallbackReq.result || null);
            fallbackReq.onerror = () => resolve(null);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      }
    );
    if (fromIdb) return fromIdb;
  } catch {
    // Fall through to Cache Storage
  }

  // 2. Try Browser Cache Storage
  const fromCache = await loadToneFromCacheStorage(lookupKey);
  if (fromCache) return fromCache;

  // 3. Try localStorage fallback
  try {
    const item =
      localStorage.getItem(`shromik_custom_tone_${lookupKey}`) ||
      localStorage.getItem(`shromik_custom_tone_${LATEST_CUSTOM_TONE_KEY}`);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}
