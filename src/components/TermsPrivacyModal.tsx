import React, { useEffect } from 'react';
import { AlertTriangle, Check, FileText, ShieldCheck, X } from 'lucide-react';
import type { Language } from '../types';
import {
  IMPORTANT_NOTICE_BULLETS_BN,
  IMPORTANT_NOTICE_BULLETS_EN,
  PRIVACY_POLICY_SECTIONS,
  TERMS_EFFECTIVE_DATE_BN,
  TERMS_EFFECTIVE_DATE_EN,
  TERMS_HIGHLIGHT_BULLETS_BN,
  TERMS_HIGHLIGHT_BULLETS_EN,
  TERMS_OF_SERVICE_SECTIONS,
} from '../utils/termsContent';

interface TermsPrivacyModalProps {
  open: boolean;
  lang: Language;
  onAccept: () => void;
  onClose: () => void;
}

export const TermsPrivacyModal: React.FC<TermsPrivacyModalProps> = ({
  open,
  lang,
  onAccept,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isBn = lang === 'bn';
  const highlightBullets = isBn ? TERMS_HIGHLIGHT_BULLETS_BN : TERMS_HIGHLIGHT_BULLETS_EN;
  const noticeBullets = isBn ? IMPORTANT_NOTICE_BULLETS_BN : IMPORTANT_NOTICE_BULLETS_EN;

  return (
    <div
      data-testid="terms-privacy-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-xs p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/70 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </span>
            <h2
              id="terms-modal-title"
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate"
            >
              {isBn ? 'শর্তাবলী এবং গোপনীয়তা নীতি' : 'Terms & Conditions & Privacy Policy'}
            </h2>
          </div>
          <button
            type="button"
            data-testid="terms-modal-close-btn"
            onClick={onClose}
            aria-label={isBn ? 'বন্ধ করুন' : 'Close'}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick-Jump Section Navigation */}
        <div
          data-testid="terms-section-jump-nav"
          className="px-4 sm:px-5 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0"
        >
          {[
            { id: 'terms-section-tos', labelBn: 'শর্তাবলী', labelEn: 'Terms of Service' },
            { id: 'terms-section-privacy', labelBn: 'গোপনীয়তা নীতি', labelEn: 'Privacy Policy' },
            { id: 'terms-section-notice', labelBn: 'গুরুত্বপূর্ণ নোটিশ', labelEn: 'Important Notice' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                const target = document.getElementById(item.id);
                target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer shrink-0"
            >
              {isBn ? item.labelBn : item.labelEn}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div
          data-testid="terms-modal-body"
          className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 text-xs sm:text-[13px] leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {/* Intro Highlight Card */}
          <div
            id="terms-section-tos"
            className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 p-4 space-y-3 scroll-mt-3"
          >
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {isBn ? 'শর্তাবলী এবং গোপনীয়তা নীতি' : 'Terms & Conditions and Privacy Policy'}
              </h3>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {isBn
                  ? '"শ্রমিক সাথী" অ্যাপটি ব্যবহার করার মাধ্যমে, আপনি সকল প্রযোজ্য শর্তাবলী মেনে চলতে সম্মত হচ্ছেন।'
                  : 'By using the "Shromik Sathi" app, you agree to comply with all applicable terms and conditions.'}
              </p>
              <ul className="space-y-1.5 pl-4 list-disc text-slate-700 dark:text-slate-300">
                {highlightBullets.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <p className="text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/80 dark:border-slate-700/70">
              {isBn
                ? 'এই অ্যাপস ব্যবহার করার মাধ্যমে আপনি নিম্নে বর্ণিত শর্তাবলীর প্রতি সম্পূর্ণ সম্মতি প্রদান করছেন। অনুগ্রহপূর্বক ব্যবহারের পূর্বে শর্তসমূহ মনোযোগ সহকারে পর্যালোচনা করুন।'
                : 'By using this app, you provide full consent to the terms described below. Please review them carefully before use.'}
            </p>

            {/* Terms Sections 1 - 9 */}
            <div className="space-y-3.5 pt-1">
              {TERMS_OF_SERVICE_SECTIONS.map((sec) => (
                <section key={sec.id} className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 dark:text-white">
                    {isBn ? sec.headingBn : sec.headingEn}
                  </h4>
                  {(isBn ? sec.introBn : sec.introEn) && (
                    <p className="text-slate-700 dark:text-slate-300">
                      {isBn ? sec.introBn : sec.introEn}
                    </p>
                  )}
                  {(isBn ? sec.bulletsBn : sec.bulletsEn)?.length ? (
                    <ul className="space-y-1 pl-4 list-disc text-slate-700 dark:text-slate-300">
                      {(isBn ? sec.bulletsBn : sec.bulletsEn)!.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </div>

          {/* Privacy Policy Card */}
          <div
            id="terms-section-privacy"
            className="rounded-2xl bg-emerald-50/45 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 p-4 space-y-3.5 scroll-mt-3"
          >
            <div className="space-y-1 border-b border-emerald-200/70 dark:border-emerald-900/50 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {isBn ? 'Privacy Policy (গোপনীয়তা নীতি)' : 'Privacy Policy'}
                </h3>
              </div>
              <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                {isBn
                  ? `কার্যকর তারিখ: ${TERMS_EFFECTIVE_DATE_BN}`
                  : `Effective Date: ${TERMS_EFFECTIVE_DATE_EN}`}
              </p>
              <p className="text-slate-700 dark:text-slate-300 pt-0.5">
                {isBn
                  ? 'আপনার ব্যক্তিগত তথ্যের সুরক্ষা ও গোপনীয়তা রক্ষা করা আমাদের সর্বোচ্চ অগ্রাধিকার। নিম্নে আমাদের তথ্য ব্যবস্থাপনা নীতিমালা বর্ণনা করা হলো।'
                  : 'Protecting the security and privacy of your personal data is our top priority. Our data management policy is outlined below.'}
              </p>
            </div>

            <div className="space-y-3.5">
              {PRIVACY_POLICY_SECTIONS.map((sec) => (
                <section key={sec.id} className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 dark:text-white">
                    {isBn ? sec.headingBn : sec.headingEn}
                  </h4>
                  {(isBn ? sec.introBn : sec.introEn) && (
                    <p className="text-slate-700 dark:text-slate-300">
                      {isBn ? sec.introBn : sec.introEn}
                    </p>
                  )}
                  {(isBn ? sec.bulletsBn : sec.bulletsEn)?.length ? (
                    <ul className="space-y-1 pl-4 list-disc text-slate-700 dark:text-slate-300">
                      {(isBn ? sec.bulletsBn : sec.bulletsEn)!.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            {/* Important Announcement */}
            <div
              id="terms-section-notice"
              className="rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200/90 dark:border-amber-800/60 p-3 space-y-1.5 scroll-mt-3"
            >
              <div className="flex items-center gap-1.5 font-extrabold text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{isBn ? 'গুরুত্বপূর্ণ ঘোষণা' : 'Important Notice'}</span>
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {isBn ? 'এই অ্যাপস:' : 'This app:'}
              </p>
              <ul className="space-y-1 pl-4 list-disc text-slate-700 dark:text-slate-300">
                {noticeBullets.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Sticky Action Footer */}
        <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2">
          <button
            type="button"
            data-testid="terms-accept-btn"
            onClick={onAccept}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isBn ? 'আমি একমত' : 'I Agree'}</span>
          </button>
          <button
            type="button"
            data-testid="terms-cancel-btn"
            onClick={onClose}
            className="w-full min-h-[42px] px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition-colors cursor-pointer"
          >
            {isBn ? 'বাতিল করুন' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
