/**
 * Audio synthesis and custom tone playback engine for Shromik Sathi
 * Supports:
 * 1. Web Audio API synthesized tones (Factory Siren, Digital Beep, Gentle Chime, Morning Bell)
 * 2. Custom device audio files (uploaded via <input type="file" accept="audio/*">)
 */

export type AlarmToneId = 'factory_siren' | 'digital_beep' | 'gentle_chime' | 'morning_bell' | 'custom_device';

export interface AlarmToneOption {
  id: AlarmToneId;
  nameBn: string;
  nameEn: string;
  descriptionBn: string;
}

export const ALARM_TONE_OPTIONS: AlarmToneOption[] = [
  {
    id: 'factory_siren',
    nameBn: 'ফ্যাক্টরি সাইরেন (জোরালো)',
    nameEn: 'Factory Siren (Loud)',
    descriptionBn: 'গার্মেন্টস শিফট ও ওভারটাইম শুরুর স্পষ্ট জোরালো শব্দ',
  },
  {
    id: 'digital_beep',
    nameBn: 'ডিজিটাল বীপ বীপ',
    nameEn: 'Digital Beep Beep',
    descriptionBn: 'ক্লাসিক ইলেকট্রনিক ঘড়ির পরিচিত অ্যালার্ম',
  },
  {
    id: 'gentle_chime',
    nameBn: 'মিষ্টি সুরের ঘণ্টা',
    nameEn: 'Gentle Bell Chime',
    descriptionBn: 'ঘুম ভাঙানোর জন্য নরম ও শ্রুতিমধুর সুর',
  },
  {
    id: 'morning_bell',
    nameBn: 'সকালের কর্মব্যস্ত বেল',
    nameEn: 'Morning Active Bell',
    descriptionBn: 'কাজে যাওয়ার জন্য উৎসাহব্যঞ্জক রিংটোন',
  },
  {
    id: 'custom_device',
    nameBn: 'ডিভাইস থেকে নিজস্ব রিংটোন',
    nameEn: 'Custom Tone from Device',
    descriptionBn: 'আপনার ফোনের মেমোরি থেকে যেকোনো প্রিয় গান বা রিংটোন',
  },
];

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
      activeAudioContext.close();
    } catch {
      // Ignore
    }
    activeAudioContext = null;
  }
}

// Get or resume AudioContext
function getAudioContext(): AudioContext {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!activeAudioContext || activeAudioContext.state === 'closed') {
    activeAudioContext = new AudioCtx();
  }
  if (activeAudioContext.state === 'suspended') {
    activeAudioContext.resume();
  }
  return activeAudioContext;
}

// Play Web Audio Tone
function playSynthesizedTone(toneId: AlarmToneId): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  if (toneId === 'factory_siren') {
    // Two-tone rising/falling siren
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.4);
    osc.frequency.linearRampToValueAtTime(520, now + 0.8);
    osc.frequency.linearRampToValueAtTime(880, now + 1.2);
    osc.frequency.linearRampToValueAtTime(520, now + 1.6);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.8);
    activeOscillators.push(osc);
    activeGainNodes.push(gain);
  } else if (toneId === 'digital_beep') {
    // High-pitched double pulse beep
    const beeps = [0, 0.15, 0.45, 0.6];
    beeps.forEach((startOffset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1040, now + startOffset);

      gain.gain.setValueAtTime(0.2, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + 0.09);
      activeOscillators.push(osc);
      activeGainNodes.push(gain);
    });
  } else if (toneId === 'gentle_chime') {
    // Gentle melodic bell chords (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.2);

      gain.gain.setValueAtTime(0.3, now + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.85);
      activeOscillators.push(osc);
      activeGainNodes.push(gain);
    });
  } else {
    // morning_bell - vibrant repeating bell
    [0, 0.25, 0.5].forEach((startOffset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now + startOffset);
      osc.frequency.exponentialRampToValueAtTime(400, now + startOffset + 0.2);

      gain.gain.setValueAtTime(0.35, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.005, now + startOffset + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + 0.23);
      activeOscillators.push(osc);
      activeGainNodes.push(gain);
    });
  }
}

/**
 * Play Alarm Tone (either loop for ringing, or single/burst for preview)
 */
export function playAlarmTone(
  toneId: AlarmToneId,
  customAudioDataUrl?: string,
  loop = true
): void {
  stopAlarmSound();

  // If custom audio file uploaded from worker's device
  if (toneId === 'custom_device' && customAudioDataUrl) {
    try {
      const audio = new Audio(customAudioDataUrl);
      audio.loop = loop;
      audio.volume = 1.0;
      activeAudioElement = audio;
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Fallback to synthesized siren if browser autoplay blocks custom file
          playSynthesizedTone('factory_siren');
        });
      }
      return;
    } catch {
      // Fallback
    }
  }

  // Synthesized tone
  playSynthesizedTone(toneId === 'custom_device' ? 'factory_siren' : toneId);

  if (loop) {
    // Loop every 2.1 seconds
    audioLoopInterval = setInterval(() => {
      playSynthesizedTone(toneId === 'custom_device' ? 'factory_siren' : toneId);
    }, 2100);
  }
}

// IndexedDB Storage for custom device ringtone to prevent LocalStorage quota limits
const DB_NAME = 'ShromikSathiAlarmDB';
const STORE_NAME = 'custom_tones';

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

export async function saveCustomToneToStorage(id: string, name: string, dataUrl: string): Promise<void> {
  try {
    const db = await openTonesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id, name, dataUrl, savedAt: Date.now() }, id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback: localStorage if IndexedDB is unavailable
    try {
      if (dataUrl.length < 2 * 1024 * 1024) {
        localStorage.setItem(`shromik_custom_tone_${id}`, JSON.stringify({ id, name, dataUrl }));
      }
    } catch {
      // Quota exceeded
    }
  }
}

export async function getCustomToneFromStorage(id: string): Promise<{ id: string; name: string; dataUrl: string } | null> {
  try {
    const db = await openTonesDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    try {
      const item = localStorage.getItem(`shromik_custom_tone_${id}`);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }
}
