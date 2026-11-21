import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  disableNetwork,
  doc,
  enableNetwork,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentSingleTabManager,
  type FirestoreSettings,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId =
  (firebaseConfig as Record<string, any>).firestoreDatabaseId ||
  'ai-studio-bcf4f937-8686-4b7f-8375-af9589cd1cf0';

/**
 * Purges legacy Firestore multi-tab WebStorageSharedClientState keys from localStorage
 * (`firestore_mutations_*`, `firestore_clients_*`, etc.) that previously caused
 * QuotaExceededError + Firestore b815 assertion failures in the 5MB localStorage budget.
 */
function purgeLegacyFirestoreWebStorageKeys() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (
        k &&
        (k.startsWith('firestore_mutations_') ||
          k.startsWith('firestore_clients_') ||
          k.startsWith('firestore_online_state_') ||
          k.startsWith('firestore_sequence_number_'))
      ) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage enumeration issues in restricted environments
  }
}

function initPersistentFirestore() {
  purgeLegacyFirestoreWebStorageKeys();
  const isBrowser = typeof window !== 'undefined';

  // Force HTTP long-polling in browsers to avoid stalled WebChannel streams behind
  // sandboxed iframes, reverse proxies, and mobile ISP gateways (prevents 10s backend timeouts).
  const transportSettings: Partial<FirestoreSettings> = {
    ignoreUndefinedProperties: true,
    ...(isBrowser
      ? {
          experimentalForceLongPolling: true,
          experimentalLongPollingOptions: { timeoutSeconds: 20 },
        }
      : {}),
  };

  try {
    // Use IndexedDB-backed single-tab persistence so pending mutations live in
    // IndexedDB instead of 5MB localStorage (eliminating WebStorage QuotaExceededError).
    return initializeFirestore(
      app,
      {
        ...transportSettings,
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager({ forceOwnership: true }),
        }),
      },
      dbId
    );
  } catch {
    try {
      return initializeFirestore(
        app,
        {
          ...transportSettings,
          localCache: memoryLocalCache(),
        },
        dbId
      );
    } catch {
      return getFirestore(app, dbId);
    }
  }
}

export const db = initPersistentFirestore();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Keep Firestore network state synchronized with browser online/offline transitions
// so offline sessions serve immediately from IndexedDB cache without 10s timeout errors,
// and returning online immediately wakes Firestore without waiting on exponential backoff.
if (typeof window !== 'undefined') {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    void disableNetwork(db).catch(() => {});
  }
  window.addEventListener('offline', () => {
    void disableNetwork(db).catch(() => {});
  });
  window.addEventListener('online', () => {
    void enableNetwork(db).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      typeof navigator !== 'undefined' &&
      navigator.onLine
    ) {
      void enableNetwork(db).catch(() => {});
    }
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'subscriptionConfig', 'global'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      // Offline mode active; Firestore local cache will serve reads and queue writes.
    }
  }
}

testConnection();
