import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Link2,
  MessageCircle,
  MessageSquare,
  Send,
  Share2,
  X,
} from 'lucide-react';
import type { Language } from '../types';
import {
  buildShareChannelUrls,
  buildSharePayload,
  copyTextToClipboard,
} from '../utils/shareApp';

export interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
}

export const ShareAppModal: React.FC<ShareAppModalProps> = ({
  isOpen,
  onClose,
  lang = 'bn',
}) => {
  const [copied, setCopied] = useState(false);
  const [sharedNative, setSharedNative] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const payload = useMemo(() => buildSharePayload(lang), [lang]);
  const channels = useMemo(() => buildShareChannelUrls(payload), [payload]);

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setSharedNative(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const handleCopyLink = async () => {
    const ok = await copyTextToClipboard(payload.url);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) {
      await handleCopyLink();
      return;
    }
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      setSharedNative(true);
      window.setTimeout(() => setSharedNative(false), 2200);
    } catch (err) {
      // Ignore user cancellation; fall back to copying link for other errors
      const errName = err instanceof Error ? err.name : '';
      if (errName !== 'AbortError') {
        await handleCopyLink();
      }
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-testid="share-app-modal"
      aria-label={lang === 'bn' ? 'অ্যাপ শেয়ার করুন' : 'Share App'}
      onClick={onClose}
      className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-0 sm:p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-2.5 pb-0.5 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Clean Header — Title Only, Zero Subtitle */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center shrink-0 overflow-hidden p-1">
              {!logoError ? (
                <img
                  src="/pwa-192x192.png"
                  alt={payload.title}
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <Share2 className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {lang === 'bn' ? 'অ্যাপ শেয়ার করুন' : 'Share App'}
            </h3>
          </div>

          <button
            type="button"
            data-testid="close-share-modal-btn"
            onClick={onClose}
            aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            className="w-9 h-9 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Shareable Link Box + One-Tap Copy */}
          <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80">
            <Link2 className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <span
              data-testid="share-app-link-text"
              className="flex-1 min-w-0 text-xs font-medium text-slate-700 dark:text-slate-200 truncate select-all"
            >
              {payload.url}
            </span>
            <button
              type="button"
              data-testid="copy-share-link-btn"
              onClick={handleCopyLink}
              className={`min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98] ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xs'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'bn' ? 'কপি হয়েছে' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>{lang === 'bn' ? 'লিংক কপি' : 'Copy Link'}</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Direct Share Channels — Clean 4-Column Grid, No Subtitles */}
          <div className="grid grid-cols-4 gap-2.5">
            <a
              href={channels.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="share-channel-whatsapp"
              className="min-h-[68px] flex flex-col items-center justify-center gap-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200/70 dark:border-emerald-800/60 p-2.5 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                <MessageCircle className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {lang === 'bn' ? 'হোয়াটসঅ্যাপ' : 'WhatsApp'}
              </span>
            </a>

            <a
              href={channels.facebook}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="share-channel-facebook"
              className="min-h-[68px] flex flex-col items-center justify-center gap-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 border border-blue-200/70 dark:border-blue-800/60 p-2.5 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xs font-extrabold text-sm">
                f
              </span>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {lang === 'bn' ? 'ফেসবুক' : 'Facebook'}
              </span>
            </a>

            <a
              href={channels.telegram}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="share-channel-telegram"
              className="min-h-[68px] flex flex-col items-center justify-center gap-1.5 rounded-xl bg-sky-50/80 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 border border-sky-200/70 dark:border-sky-800/60 p-2.5 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-2xs">
                <Send className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {lang === 'bn' ? 'টেলিগ্রাম' : 'Telegram'}
              </span>
            </a>

            <a
              href={channels.sms}
              data-testid="share-channel-sms"
              className="min-h-[68px] flex flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 p-2.5 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center shadow-2xs">
                <MessageSquare className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {lang === 'bn' ? 'মেসেজ' : 'SMS'}
              </span>
            </a>
          </div>

          {/* Primary Native Share Action (falls back cleanly to copy on desktop browsers without Web Share API) */}
          <button
            type="button"
            data-testid="primary-share-now-btn"
            onClick={handleNativeShare}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            {sharedNative || (!canNativeShare && copied) ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span>
                  {sharedNative
                    ? lang === 'bn'
                      ? 'শেয়ার সম্পন্ন'
                      : 'Shared'
                    : lang === 'bn'
                    ? 'লিংক কপি হয়েছে'
                    : 'Link Copied'}
                </span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 shrink-0" />
                <span>
                  {canNativeShare
                    ? lang === 'bn'
                      ? 'এখনই শেয়ার করুন'
                      : 'Share Now'
                    : lang === 'bn'
                    ? 'শেয়ার লিংক কপি করুন'
                    : 'Copy Share Link'}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Safe bottom spacing for mobile home indicator */}
        <div className="sm:hidden h-2" />
      </div>
    </div>,
    document.body
  );
};
