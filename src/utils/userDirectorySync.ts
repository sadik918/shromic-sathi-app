import type { Language } from '../types';
import {
  buildUserDirectoryCreatePayload,
  buildUserDirectoryOwnerUpdatePayload,
  getBstTodayISO,
  isOfflineOrTransientFirestoreError,
  type AuthUserSummaryForDirectory,
} from './cloudSyncHelpers';
import {
  clearOfflineMutation,
  enqueueOfflineMutation,
  loadOfflineQueue,
  type OfflineMutation,
} from './offlineSync';

export interface UserDirectorySyncOptions {
  displayName?: string;
  language?: Language;
  offlineSyncState?: 'synced' | 'pending' | 'error';
  todayISO?: string;
}

export interface UserDirectoryDocSnapshot {
  exists: boolean;
  data?: Record<string, unknown>;
}

export interface UserDirectoryFirestoreAdapter {
  getDocFromServer: (uid: string) => Promise<UserDirectoryDocSnapshot>;
  getDocFromCache: (uid: string) => Promise<UserDirectoryDocSnapshot>;
  createDoc: (uid: string, payload: Record<string, unknown>) => Promise<void>;
  updateDoc: (uid: string, payload: Record<string, unknown>) => Promise<void>;
}

export interface UserDirectoryOfflineQueueAdapter {
  loadQueue: (uid: string) => OfflineMutation[];
  enqueueRetry: (uid: string, payload: Record<string, unknown>) => void;
  clearRetry: (uid: string) => void;
}

export interface UserDirectorySyncResult {
  status: 'created' | 'updated' | 'queued_retry' | 'failed' | 'skipped';
  uid: string;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  retriedQueuedDelta?: boolean;
}

export interface SyncUserDirectoryParams {
  user: AuthUserSummaryForDirectory;
  options?: UserDirectorySyncOptions;
  adapter: UserDirectoryFirestoreAdapter;
  queueAdapter?: UserDirectoryOfflineQueueAdapter;
  onSyncCompleted?: (uid: string, result: UserDirectorySyncResult) => void;
  onError?: (err: unknown, context: { uid: string; operation: 'read' | 'create' | 'update' }) => void;
}

const defaultQueueAdapter: UserDirectoryOfflineQueueAdapter = {
  loadQueue: (uid: string) => loadOfflineQueue(uid),
  enqueueRetry: (uid: string, payload: Record<string, unknown>) => {
    enqueueOfflineMutation(uid, {
      collection: 'userDirectory',
      docId: uid,
      action: 'upsert',
      payload,
    });
  },
  clearRetry: (uid: string) => {
    clearOfflineMutation(uid, 'userDirectory', uid);
  },
};

function hasMeaningfulOptionDelta(
  activeOpts: UserDirectorySyncOptions,
  nextOpts: UserDirectorySyncOptions
): boolean {
  const nextName = (nextOpts.displayName || '').trim();
  const activeName = (activeOpts.displayName || '').trim();
  if (nextName && nextName !== activeName) return true;

  if (nextOpts.language && nextOpts.language !== activeOpts.language) return true;

  if (
    nextOpts.offlineSyncState &&
    nextOpts.offlineSyncState !== activeOpts.offlineSyncState
  ) {
    return true;
  }
  return false;
}

function mergeSyncOptions(
  baseOpts: UserDirectorySyncOptions,
  incomingOpts: UserDirectorySyncOptions
): UserDirectorySyncOptions {
  const incomingName = (incomingOpts.displayName || '').trim();
  const baseName = (baseOpts.displayName || '').trim();
  return {
    displayName: incomingName || baseName || undefined,
    language: incomingOpts.language || baseOpts.language,
    offlineSyncState: incomingOpts.offlineSyncState || baseOpts.offlineSyncState,
    todayISO: incomingOpts.todayISO || baseOpts.todayISO,
  };
}

function extractErrorMeta(err: unknown): { code: string; message: string } {
  const code = String((err as { code?: unknown })?.code || '').trim() || 'unknown';
  const message =
    err instanceof Error
      ? err.message
      : String((err as { message?: unknown })?.message || err || 'Unknown error');
  return { code, message };
}

export class UserDirectorySyncCoordinator {
  private readonly inFlightByUid = new Map<string, Promise<UserDirectorySyncResult>>();
  private readonly activeOptsByUid = new Map<string, UserDirectorySyncOptions>();
  private readonly queuedDeltaByUid = new Map<
    string,
    { user: AuthUserSummaryForDirectory; options: UserDirectorySyncOptions }
  >();

  public isInFlight(uid: string): boolean {
    return this.inFlightByUid.has(uid);
  }

  public sync(params: SyncUserDirectoryParams): Promise<UserDirectorySyncResult> {
    const uid = params.user?.uid;
    if (!uid) {
      return Promise.resolve({ status: 'skipped', uid: '', reason: 'missing_uid' });
    }

    const incomingOpts = params.options || {};
    const existingFlight = this.inFlightByUid.get(uid);
    if (existingFlight) {
      const activeOpts = this.activeOptsByUid.get(uid) || {};
      const queued = this.queuedDeltaByUid.get(uid);
      const baseline = queued?.options || activeOpts;
      if (hasMeaningfulOptionDelta(baseline, incomingOpts)) {
        this.queuedDeltaByUid.set(uid, {
          user: params.user,
          options: mergeSyncOptions(baseline, incomingOpts),
        });
      }
      return existingFlight;
    }

    this.activeOptsByUid.set(uid, incomingOpts);
    const runner = this.runWithCoalescedFollowUp(params).finally(() => {
      this.inFlightByUid.delete(uid);
      this.activeOptsByUid.delete(uid);
      this.queuedDeltaByUid.delete(uid);
    });

    this.inFlightByUid.set(uid, runner);
    return runner;
  }

  private async runWithCoalescedFollowUp(
    initialParams: SyncUserDirectoryParams
  ): Promise<UserDirectorySyncResult> {
    const uid = initialParams.user.uid;
    let result = await this.executeSinglePass(initialParams);

    const queued = this.queuedDeltaByUid.get(uid);
    if (queued) {
      this.queuedDeltaByUid.delete(uid);
      this.activeOptsByUid.set(uid, queued.options);
      const followUpResult = await this.executeSinglePass({
        ...initialParams,
        user: queued.user,
        options: queued.options,
      });
      result = {
        ...followUpResult,
        retriedQueuedDelta: true,
      };
    }

    initialParams.onSyncCompleted?.(uid, result);
    return result;
  }

  private async executeSinglePass(
    params: SyncUserDirectoryParams
  ): Promise<UserDirectorySyncResult> {
    const {
      user,
      options = {},
      adapter,
      queueAdapter = defaultQueueAdapter,
      onError,
    } = params;
    const uid = user.uid;
    const todayISO = options.todayISO || getBstTodayISO();
    const language: Language = options.language || 'bn';

    const pendingSubcollectionCount = queueAdapter
      .loadQueue(uid)
      .filter((m) => m.collection !== 'userDirectory').length;
    const offlineSyncState: 'synced' | 'pending' | 'error' =
      options.offlineSyncState || (pendingSubcollectionCount > 0 ? 'pending' : 'synced');

    // 1. Authoritative existence check: NEVER treat a failed server read as missing doc
    let existenceState: 'exists' | 'missing' | 'read_error' = 'read_error';
    let existingData: Record<string, unknown> | undefined;
    let readError: unknown;

    try {
      const serverSnap = await adapter.getDocFromServer(uid);
      if (serverSnap.exists) {
        existenceState = 'exists';
        existingData = serverSnap.data;
      } else {
        existenceState = 'missing';
      }
    } catch (serverErr) {
      readError = serverErr;
      try {
        const cacheSnap = await adapter.getDocFromCache(uid);
        if (cacheSnap.exists) {
          existenceState = 'exists';
          existingData = cacheSnap.data;
        } else {
          existenceState = 'read_error';
        }
      } catch {
        existenceState = 'read_error';
      }
    }

    if (existenceState === 'read_error') {
      const { code, message } = extractErrorMeta(readError);
      queueAdapter.enqueueRetry(uid, {
        uid,
        displayName: options.displayName || user.displayName || '',
        language,
        offlineSyncState: 'pending',
        lastAttemptTodayISO: todayISO,
      });
      onError?.(readError, { uid, operation: 'read' });
      return {
        status: 'queued_retry',
        uid,
        reason: 'server_read_failed_preserved_existing',
        errorCode: code,
        errorMessage: message,
      };
    }

    const existingDisplayName =
      typeof existingData?.displayName === 'string' ? existingData.displayName : undefined;

    // 2. Existing document -> strictly owner-safe updateDoc (preserves role, accountStatus, registeredAt, createdAt)
    if (existenceState === 'exists') {
      const payload = buildUserDirectoryOwnerUpdatePayload({
        user,
        displayName: options.displayName,
        existingDisplayName,
        language,
        todayISO,
        offlineSyncState,
      });
      try {
        await adapter.updateDoc(uid, payload);
        queueAdapter.clearRetry(uid);
        return { status: 'updated', uid };
      } catch (updateErr) {
        const { code, message } = extractErrorMeta(updateErr);
        onError?.(updateErr, { uid, operation: 'update' });
        if (isOfflineOrTransientFirestoreError(updateErr)) {
          queueAdapter.enqueueRetry(uid, {
            uid,
            displayName: options.displayName || user.displayName || existingDisplayName || '',
            language,
            offlineSyncState: 'pending',
            lastAttemptTodayISO: todayISO,
          });
          return {
            status: 'queued_retry',
            uid,
            reason: 'transient_update_failure',
            errorCode: code,
            errorMessage: message,
          };
        }
        return {
          status: 'failed',
          uid,
          reason: 'update_rejected',
          errorCode: code,
          errorMessage: message,
        };
      }
    }

    // 3. Server explicitly confirmed doc does not exist -> safe create
    const createPayload = buildUserDirectoryCreatePayload({
      user,
      displayName: options.displayName,
      language,
      todayISO,
      offlineSyncState,
    });

    try {
      await adapter.createDoc(uid, createPayload);
      queueAdapter.clearRetry(uid);
      return { status: 'created', uid };
    } catch (createErr) {
      const { code, message } = extractErrorMeta(createErr);

      // Concurrent multi-device/tab race recovery: re-verify whether doc now exists on server
      if (code === 'already-exists' || code === 'permission-denied') {
        try {
          const recheckSnap = await adapter.getDocFromServer(uid);
          if (recheckSnap.exists) {
            const recheckName =
              typeof recheckSnap.data?.displayName === 'string'
                ? recheckSnap.data.displayName
                : undefined;
            const ownerUpdate = buildUserDirectoryOwnerUpdatePayload({
              user,
              displayName: options.displayName,
              existingDisplayName: recheckName,
              language,
              todayISO,
              offlineSyncState,
            });
            await adapter.updateDoc(uid, ownerUpdate);
            queueAdapter.clearRetry(uid);
            return { status: 'updated', uid, reason: 'recovered_after_concurrent_create' };
          }
        } catch {
          // Fall through to structured error handling
        }
      }

      onError?.(createErr, { uid, operation: 'create' });
      if (isOfflineOrTransientFirestoreError(createErr)) {
        queueAdapter.enqueueRetry(uid, {
          uid,
          displayName: options.displayName || user.displayName || '',
          language,
          offlineSyncState: 'pending',
          lastAttemptTodayISO: todayISO,
        });
        return {
          status: 'queued_retry',
          uid,
          reason: 'transient_create_failure',
          errorCode: code,
          errorMessage: message,
        };
      }

      return {
        status: 'failed',
        uid,
        reason: 'create_rejected',
        errorCode: code,
        errorMessage: message,
      };
    }
  }
}

export const defaultUserDirectorySyncCoordinator = new UserDirectorySyncCoordinator();
