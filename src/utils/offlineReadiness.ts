export type StaticCachePolicy = 'no-cache' | 'immutable' | 'default';

const NO_CACHE_EXACT_PATHS = new Set([
  '/',
  '/index.html',
  '/sw.js',
  '/alarm-sw-helper.js',
  '/manifest.webmanifest',
]);

/**
 * Classifies static asset HTTP cache control policy for production serving so
 * app-shell HTML & Service Worker files always revalidate while hashed /assets/* stay immutable.
 */
export function resolveStaticCachePolicy(urlPath: string): StaticCachePolicy {
  const cleanPath = (urlPath || '/').split('?')[0].split('#')[0].trim() || '/';
  if (NO_CACHE_EXACT_PATHS.has(cleanPath)) {
    return 'no-cache';
  }
  if (cleanPath.startsWith('/assets/')) {
    return 'immutable';
  }
  return 'default';
}

export function areRecordListsEquivalent(
  left: ReadonlyArray<Record<string, unknown>>,
  right: ReadonlyArray<Record<string, unknown>>
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  if (left.length === 0) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

/**
 * Avoids redundant localStorage mirror serialization + CustomEvent broadcasts
 * when offline IndexedDB snapshot emissions produce identical collection data.
 */
export function shouldSkipRedundantMirrorWrite(params: {
  isFromServer: boolean;
  localList: ReadonlyArray<Record<string, unknown>>;
  mergedList: ReadonlyArray<Record<string, unknown>>;
}): boolean {
  if (params.isFromServer) return false;
  return areRecordListsEquivalent(params.localList, params.mergedList);
}

/**
 * Determines whether remote time sync requests should execute right now.
 */
export function shouldFetchOnlineTime(navigatorOnLine: boolean | undefined): boolean {
  return navigatorOnLine !== false;
}
