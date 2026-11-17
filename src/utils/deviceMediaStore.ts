/**
 * IndexedDB-backed device media storage for offline-first contact photos.
 * Keeps contact avatars off localStorage quota while providing zero-data offline reads
 * and lightweight (<60KB) compressed data URLs suitable for optional Firestore cloud sync.
 */

const DB_NAME = 'shromik_sathi_device_media_v1';
const DB_VERSION = 1;
const CONTACT_PHOTO_STORE = 'contact_photos';
export const CONTACT_PHOTO_EVENT = 'shromik-sathi-contact-photo-updated';

const memoryPhotoFallback = new Map<string, string>();

function openMediaDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CONTACT_PHOTO_STORE)) {
          db.createObjectStore(CONTACT_PHOTO_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function emitPhotoUpdated(contactId: string, photoUrl: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CONTACT_PHOTO_EVENT, {
        detail: { contactId, photoUrl },
      })
    );
  }
}

export async function saveContactPhotoToDevice(
  contactId: string,
  photoDataUrl: string
): Promise<void> {
  const cleanId = (contactId || '').trim();
  if (!cleanId) return;

  if (!photoDataUrl) {
    await deleteContactPhotoFromDevice(cleanId);
    return;
  }

  memoryPhotoFallback.set(cleanId, photoDataUrl);
  emitPhotoUpdated(cleanId, photoDataUrl);

  const db = await openMediaDB();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(CONTACT_PHOTO_STORE, 'readwrite');
      const store = tx.objectStore(CONTACT_PHOTO_STORE);
      store.put({ id: cleanId, dataUrl: photoDataUrl, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadContactPhotoFromDevice(
  contactId: string
): Promise<string | null> {
  const cleanId = (contactId || '').trim();
  if (!cleanId) return null;

  const mem = memoryPhotoFallback.get(cleanId);
  if (mem) return mem;

  const db = await openMediaDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CONTACT_PHOTO_STORE, 'readonly');
      const store = tx.objectStore(CONTACT_PHOTO_STORE);
      const req = store.get(cleanId);
      req.onsuccess = () => {
        const val = req.result as { id: string; dataUrl?: string } | undefined;
        if (val?.dataUrl) {
          memoryPhotoFallback.set(cleanId, val.dataUrl);
          resolve(val.dataUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadAllContactPhotosFromDevice(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [k, v] of memoryPhotoFallback.entries()) {
    result[k] = v;
  }

  const db = await openMediaDB();
  if (!db) return result;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CONTACT_PHOTO_STORE, 'readonly');
      const store = tx.objectStore(CONTACT_PHOTO_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as Array<{ id: string; dataUrl?: string }>;
        for (const row of rows) {
          if (row?.id && row?.dataUrl) {
            result[row.id] = row.dataUrl;
            memoryPhotoFallback.set(row.id, row.dataUrl);
          }
        }
        resolve(result);
      };
      req.onerror = () => resolve(result);
    } catch {
      resolve(result);
    }
  });
}

export async function deleteContactPhotoFromDevice(contactId: string): Promise<void> {
  const cleanId = (contactId || '').trim();
  if (!cleanId) return;

  memoryPhotoFallback.delete(cleanId);
  emitPhotoUpdated(cleanId, '');

  const db = await openMediaDB();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(CONTACT_PHOTO_STORE, 'readwrite');
      const store = tx.objectStore(CONTACT_PHOTO_STORE);
      store.delete(cleanId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Compresses an uploaded image file to a lightweight square-fitted JPEG DataURL
 * (<= ~50KB) so it stores quickly on-device in IndexedDB and fits safely in Firestore.
 */
export async function compressImageFileToContactDataUrl(
  file: File,
  maxDimension = 180,
  initialQuality = 0.74
): Promise<string> {
  const readAsDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });

  const rawDataUrl = await readAsDataUrl();
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return rawDataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
      const targetW = Math.max(1, Math.round((img.width || maxDimension) * scale));
      const targetH = Math.max(1, Math.round((img.height || maxDimension) * scale));

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(img, 0, 0, targetW, targetH);

      let quality = initialQuality;
      let output = canvas.toDataURL('image/jpeg', quality);
      // Shrink quality iteratively if still over 65KB
      while (output.length > 65_000 && quality > 0.35) {
        quality -= 0.1;
        output = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(output);
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}
