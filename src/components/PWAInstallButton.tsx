import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  Download,
  Loader2,
  MoreVertical,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { Language } from '../types';

export interface PWAInstallButtonProps {
  lang?: Language;
  variant?: 'header' | 'menu-item' | 'compact';
  onActionComplete?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang = 'bn',
  variant = 'header',
  onActionComplete,
}) => {
  const { isInstallable, isInstalled, isInstalling, isIOS, isAndroid, install } =
    usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Never show any install button when already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  // In header, show immediately when native auto-install prompt is ready OR on mobile browsers
  if (variant === 'header' && !isInstallable && !isIOS && !isAndroid) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstalling) return;
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        onActionComplete?.();
        return;
      }
      if (outcome === 'unavailable') {
        setShowGuideModal(true);
      }
      return;
    }
    setShowGuideModal(true);
  };

  const renderGuideModal = () => {
    if (!showGuideModal || typeof document === 'undefined') return null;

    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        data-testid="pwa-install-guide-modal"
        aria-label={lang === 'bn' ? 'অ্যাপ ইনস্টল নির্দেশনা' : 'App Install Instructions'}
        onClick={() => setShowGuideModal(false)}
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                <img
                  src="/pwa-192x192.png"
                  alt="শ্রমিক সাথী"
                  className="w-full h-full object-contain rounded-lg"
                />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step-by-step browser instructions */}
          <div className="p-5 space-y-3">
            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {lang === 'bn' ? '১' : '1'}
                  </span>
                  <span className="leading-snug">
                    {lang === 'bn' ? (
                      <>
                        সাফারি ব্রাউজারের নিচে{' '}
                        <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-white">
                          <Share className="w-3.5 h-3.5 text-emerald-600" /> Share
                        </strong>{' '}
                        বাটনে ট্যাপ করুন।
                      </>
                    ) : (
                      <>
                        Tap the{' '}
                        <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-white">
                          <Share className="w-3.5 h-3.5 text-emerald-600" /> Share
                        </strong>{' '}
                        button in Safari.
                      </>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {lang === 'bn' ? '২' : '2'}
                  </span>
                  <span className="leading-snug">
                    {lang === 'bn' ? (
                      <>
                        <strong>Add to Home Screen</strong> নির্বাচন করে <strong>Add</strong> চাপুন।
                      </>
                    ) : (
                      <>
                        Select <strong>Add to Home Screen</strong> and tap <strong>Add</strong>.
                      </>
                    )}
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {lang === 'bn' ? '১' : '1'}
                  </span>
                  <span className="leading-snug">
                    {lang === 'bn' ? (
                      <>
                        ব্রাউজারের উপরের ডান কোণায়{' '}
                        <strong className="inline-flex items-center gap-0.5 text-slate-900 dark:text-white">
                          <MoreVertical className="w-3.5 h-3.5 text-emerald-600" /> মেনু
                        </strong>{' '}
                        আইকনে ট্যাপ করুন।
                      </>
                    ) : (
                      <>
                        Tap the browser{' '}
                        <strong className="inline-flex items-center gap-0.5 text-slate-900 dark:text-white">
                          <MoreVertical className="w-3.5 h-3.5 text-emerald-600" /> More
                        </strong>{' '}
                        menu icon at top right.
                      </>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {lang === 'bn' ? '২' : '2'}
                  </span>
                  <span className="leading-snug">
                    {lang === 'bn' ? (
                      <>
                        <strong>Install app</strong> বা <strong>Add to Home screen</strong> ট্যাপ করুন।
                      </>
                    ) : (
                      <>
                        Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                      </>
                    )}
                  </span>
                </li>
              </ol>
            )}
          </div>

          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
            <button
              type="button"
              onClick={() => {
                setShowGuideModal(false);
                onActionComplete?.();
              }}
              className="w-full min-h-[42px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-sm font-bold text-white transition-colors cursor-pointer"
            >
              {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (variant === 'menu-item') {
    return (
      <>
        <button
          type="button"
          data-testid="more-install-app-btn"
          disabled={isInstalling}
          onClick={handleInstallClick}
          className="w-full min-h-[40px] px-2.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 border border-emerald-200/90 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-60"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              {isInstalling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Smartphone className="w-3.5 h-3.5" />
              )}
            </span>
            <span className="truncate whitespace-nowrap">
              {isInstalling
                ? lang === 'bn'
                  ? 'ইনস্টল হচ্ছে...'
                  : 'Installing...'
                : lang === 'bn'
                ? 'অ্যাপ ইনস্টল করুন'
                : 'Install App'}
            </span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        </button>
        {renderGuideModal()}
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          data-testid="compact-install-app-btn"
          disabled={isInstalling}
          onClick={handleInstallClick}
          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs disabled:opacity-60"
        >
          {isInstalling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{lang === 'bn' ? 'ইনস্টল' : 'Install'}</span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  // Default: Header smart install button (auto-installs on click when browser prompt is ready)
  return (
    <>
      <button
        type="button"
        data-testid="header-pwa-install-btn"
        disabled={isInstalling}
        onClick={handleInstallClick}
        aria-label={lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
        title={lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
        className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 shadow-xs cursor-pointer disabled:opacity-60"
      >
        {isInstalling ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>
          {isInstalling
            ? lang === 'bn'
              ? 'ইনস্টল হচ্ছে...'
              : 'Installing...'
            : lang === 'bn'
            ? 'ইনস্টল'
            : 'Install'}
        </span>
      </button>
      {renderGuideModal()}
    </>
  );
};
