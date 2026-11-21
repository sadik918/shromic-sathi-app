import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __shromikDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
    __shromikAppInstalled?: boolean;
  }
}

interface PWAInstallSnapshot {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isInstalling: boolean;
}

const listeners = new Set<() => void>();
let initialized = false;

function detectStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean(window.__shromikAppInstalled) ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

let snapshot: PWAInstallSnapshot = {
  deferredPrompt:
    typeof window !== 'undefined' ? window.__shromikDeferredInstallPrompt ?? null : null,
  isInstalled: detectStandaloneMode(),
  isInstalling: false,
};

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function updateSnapshot(partial: Partial<PWAInstallSnapshot>) {
  snapshot = { ...snapshot, ...partial };
  notify();
}

function ensureGlobalListeners() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (window.__shromikDeferredInstallPrompt && !snapshot.deferredPrompt) {
    snapshot = {
      ...snapshot,
      deferredPrompt: window.__shromikDeferredInstallPrompt,
    };
  }
  if (detectStandaloneMode() && !snapshot.isInstalled) {
    snapshot = {
      ...snapshot,
      isInstalled: true,
      deferredPrompt: null,
    };
  }

  const syncFromWindowPrompt = () => {
    const captured = window.__shromikDeferredInstallPrompt ?? null;
    if (captured && captured !== snapshot.deferredPrompt) {
      updateSnapshot({ deferredPrompt: captured, isInstalled: false });
    }
  };

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    const promptEvent = e as BeforeInstallPromptEvent;
    window.__shromikDeferredInstallPrompt = promptEvent;
    updateSnapshot({ deferredPrompt: promptEvent, isInstalled: false });
  };

  const handleAppInstalled = () => {
    window.__shromikDeferredInstallPrompt = null;
    window.__shromikAppInstalled = true;
    updateSnapshot({ deferredPrompt: null, isInstalled: true, isInstalling: false });
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  window.addEventListener('shromik:pwa-prompt-ready', syncFromWindowPrompt);
  window.addEventListener('shromik:pwa-installed', handleAppInstalled);

  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  const handleDisplayModeChange = (event: MediaQueryListEvent) => {
    if (event.matches) {
      handleAppInstalled();
    }
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleDisplayModeChange);
  }
}

export type PWAInstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export function usePWAInstall() {
  ensureGlobalListeners();

  const [state, setState] = useState<PWAInstallSnapshot>(() => ({
    deferredPrompt:
      snapshot.deferredPrompt ??
      (typeof window !== 'undefined' ? window.__shromikDeferredInstallPrompt ?? null : null),
    isInstalled: snapshot.isInstalled || detectStandaloneMode(),
    isInstalling: snapshot.isInstalling,
  }));

  const [deviceInfo] = useState(() => {
    if (typeof window === 'undefined') {
      return { isIOS: false, isAndroid: false };
    }
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS =
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes('macintosh') && 'ontouchend' in document);
    const isAndroid = /android/.test(ua);
    return { isIOS, isAndroid };
  });

  useEffect(() => {
    ensureGlobalListeners();
    const sync = () => {
      setState({
        deferredPrompt: snapshot.deferredPrompt,
        isInstalled: snapshot.isInstalled || detectStandaloneMode(),
        isInstalling: snapshot.isInstalling,
      });
    };
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const install = useCallback(async (): Promise<PWAInstallOutcome> => {
    const activePrompt =
      snapshot.deferredPrompt ??
      (typeof window !== 'undefined' ? window.__shromikDeferredInstallPrompt ?? null : null);

    if (!activePrompt) {
      return 'unavailable';
    }

    updateSnapshot({ isInstalling: true });
    try {
      await activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      // Each BeforeInstallPromptEvent can only be prompted once per browser spec
      window.__shromikDeferredInstallPrompt = null;
      if (outcome === 'accepted') {
        window.__shromikAppInstalled = true;
        updateSnapshot({
          deferredPrompt: null,
          isInstalled: true,
          isInstalling: false,
        });
        return 'accepted';
      }
      updateSnapshot({
        deferredPrompt: null,
        isInstalling: false,
      });
      return 'dismissed';
    } catch {
      updateSnapshot({ isInstalling: false });
      return 'unavailable';
    }
  }, []);

  return {
    isInstallable: Boolean(state.deferredPrompt) && !state.isInstalled,
    isInstalled: state.isInstalled,
    isInstalling: state.isInstalling,
    isIOS: deviceInfo.isIOS,
    isAndroid: deviceInfo.isAndroid,
    install,
  };
}
