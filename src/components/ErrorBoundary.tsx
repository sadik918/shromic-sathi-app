import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unknown error' };
  }

  private async clearStaleCachesAndReload() {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith('shromik-sathi-static-assets-') || k.includes('workbox-precache'))
            .map((k) => window.caches.delete(k))
        );
      }
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
      }
    } catch {
      // Ignore cleanup errors
    }
    window.location.reload();
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Shromik Sathi ErrorBoundary:', error, info);
    const msg = error?.message || '';
    if (
      typeof window !== 'undefined' &&
      (msg.includes('Minified React error #310') ||
        msg.includes('Minified React error #300') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed'))
    ) {
      try {
        const recoveryKey = 'shromik_sathi_sw_auto_recovered_v3';
        if (!sessionStorage.getItem(recoveryKey)) {
          sessionStorage.setItem(recoveryKey, '1');
          void this.clearStaleCachesAndReload();
        }
      } catch {
        // Ignore sessionStorage errors
      }
    }
  }

  render() {
    if (this.state.hasError) {
      let friendlyDetails = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          friendlyDetails = `${parsed.error} (Operation: ${parsed.operationType || 'unknown'}, Path: ${parsed.path || 'unknown'})`;
        }
      } catch {
        // plain string message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              কিছু একটা সমস্যা হয়েছে (Something went wrong)
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              অনুগ্রহ করে পেজটি রিলোড করুন অথবা আপনার সংযোগ পরীক্ষা করুন।
            </p>
            <div className="mt-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
              {friendlyDetails}
            </div>
            <button
              type="button"
              onClick={() => {
                void this.clearStaleCachesAndReload();
              }}
              className="mt-5 w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              আবার চেষ্টা করুন (Reload)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
