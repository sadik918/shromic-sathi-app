import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bug,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock,
  HelpCircle,
  MessageSquare,
  PhoneCall,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { FeedbackCategory, Language, SupportFeedback } from '../types';
import { formatNumber, VERIFIED_WORKER_HELPLINES } from '../utils/calculations';
import { formatDateReadable } from '../utils/i18n';
import { loadAdminStore } from '../utils/adminLogic';
import {
  filterWorkerFeedback,
  getFeedbackCategoryLabel,
  SUPPORT_CATEGORIES,
  SUPPORT_FAQS,
  SUPPORT_QUICK_PROMPTS,
} from '../utils/supportHelpers';

interface SupportFeedbackViewProps {
  lang: Language;
  todayISO: string;
  feedbackList: SupportFeedback[];
  isAdminUser: boolean;
  onSubmitFeedback: (category: FeedbackCategory, message: string) => Promise<void>;
  onResolveFeedback: (id: string) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onSuccessToast: (msg: string) => void;
}

export const SupportFeedbackView: React.FC<SupportFeedbackViewProps> = ({
  lang,
  todayISO,
  feedbackList,
  isAdminUser,
  onSubmitFeedback,
  onResolveFeedback,
  onDeleteAccount,
  onSuccessToast,
}) => {
  const [fbCategory, setFbCategory] = useState<FeedbackCategory>('calculation_help');
  const [fbMessage, setFbMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [openFaqId, setOpenFaqId] = useState<string | null>(SUPPORT_FAQS[0]?.id || null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const selectedCategoryMeta =
    SUPPORT_CATEGORIES.find((c) => c.id === fbCategory) || SUPPORT_CATEGORIES[0];

  // Match any admin ticket replies from the local admin store mirror
  const adminTicketRepliesMap = useMemo(() => {
    const adminStore = loadAdminStore(todayISO);
    const map = new Map<
      string,
      Array<{ id: string; authorName: string; message: string; createdAt: string }>
    >();
    for (const t of adminStore.tickets) {
      if (t.replies && t.replies.length > 0) {
        map.set(t.id, t.replies);
      }
    }
    return map;
  }, [todayISO, feedbackList]);

  const filteredHistory = useMemo(
    () => filterWorkerFeedback(feedbackList, historyFilter),
    [feedbackList, historyFilter]
  );

  const getCategoryIcon = (id: FeedbackCategory) => {
    switch (id) {
      case 'calculation_help':
        return <Calculator className="w-4 h-4 shrink-0" />;
      case 'bug_report':
        return <Bug className="w-4 h-4 shrink-0" />;
      case 'feature_request':
        return <Sparkles className="w-4 h-4 shrink-0" />;
      case 'general':
        return <MessageSquare className="w-4 h-4 shrink-0" />;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fbMessage.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmitFeedback(fbCategory, trimmed);
      setFbMessage('');
      onSuccessToast(
        lang === 'bn'
          ? 'আপনার বার্তাটি সহায়তা টিমের কাছে পাঠানো হয়েছে।'
          : 'Your support message has been submitted.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="support-feedback-view" className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* LEFT COLUMN: Smart Support Composer + Submitted Ticket History */}
      <div className="xl:col-span-7 space-y-5">
        {/* 1. Support Request Composer */}
        <section
          data-testid="support-submit-card"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                {lang === 'bn' ? 'সহায়তা ও মতামত পাঠান' : 'Support & Feedback'}
              </h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Clean 2x2 Category Selector Buttons */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'কোন বিষয়ে সহায়তা প্রয়োজন?' : 'Select Topic'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUPPORT_CATEGORIES.map((cat) => {
                  const isActive = fbCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      data-testid={`support-cat-${cat.id}`}
                      onClick={() => setFbCategory(cat.id)}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                          : 'bg-slate-50/80 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {getCategoryIcon(cat.id)}
                      <span className="truncate">
                        {lang === 'bn' ? cat.labelBn : cat.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1-Tap Quick Problem Chips */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                {lang === 'bn' ? 'দ্রুত সমস্যা নির্বাচন (এক ট্যাপে লিখুন)' : 'Quick Issue Templates'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORT_QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.id}
                    type="button"
                    data-testid={`support-quick-chip-${qp.id}`}
                    onClick={() => {
                      setFbCategory(qp.category);
                      setFbMessage(lang === 'bn' ? qp.templateBn : qp.templateEn);
                    }}
                    className="min-h-[34px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {lang === 'bn' ? qp.chipBn : qp.chipEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="support-message-textarea"
                  className="font-bold text-slate-700 dark:text-slate-300"
                >
                  {lang === 'bn' ? 'বিস্তারিত বার্তা' : 'Your Message'}
                </label>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatNumber(fbMessage.length, lang)}/{formatNumber(1000, lang)}
                </span>
              </div>
              <textarea
                id="support-message-textarea"
                data-testid="support-message-input"
                rows={4}
                maxLength={1000}
                value={fbMessage}
                onChange={(e) => setFbMessage(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? selectedCategoryMeta.placeholderBn
                    : selectedCategoryMeta.placeholderEn
                }
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {fbMessage.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setFbMessage('')}
                  className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {lang === 'bn' ? 'মুছে ফেলুন' : 'Clear'}
                </button>
              )}

              <button
                type="submit"
                data-testid="support-submit-btn"
                disabled={submitting || !fbMessage.trim()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 ml-auto cursor-pointer transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>
                  {submitting
                    ? lang === 'bn'
                      ? 'পাঠানো হচ্ছে...'
                      : 'Sending...'
                    : lang === 'bn'
                    ? 'মতামত পাঠান'
                    : 'Send Message'}
                </span>
              </button>
            </div>
          </form>
        </section>

        {/* 2. Worker's Submitted Messages & Support Replies */}
        <section
          data-testid="support-my-tickets-card"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'আমার পাঠানো বার্তা ও উত্তর' : 'My Support Requests'}
            </h3>

            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              {(
                [
                  { id: 'all', bn: 'সব', en: 'All' },
                  { id: 'open', bn: 'অপেক্ষমাণ', en: 'Pending' },
                  { id: 'resolved', bn: 'সমাধানকৃত', en: 'Resolved' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryFilter(tab.id)}
                  className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    historyFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {lang === 'bn' ? tab.bn : tab.en}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="py-6 px-3 text-center rounded-xl bg-slate-50/70 dark:bg-slate-800/40 space-y-1">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {feedbackList.length === 0
                  ? lang === 'bn'
                    ? 'আপনি এখনো কোনো সহায়তা বার্তা পাঠাননি।'
                    : 'No support messages sent yet.'
                  : lang === 'bn'
                  ? 'এই ফিল্টারে কোনো বার্তা পাওয়া যায়নি।'
                  : 'No messages match this filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => {
                const replies = adminTicketRepliesMap.get(item.id) || [];
                const createdStr =
                  typeof item.createdAt === 'string'
                    ? formatDateReadable(item.createdAt.slice(0, 10), lang)
                    : formatDateReadable(todayISO, lang);
                const isResolved = item.status === 'resolved';

                return (
                  <div
                    key={item.id}
                    data-testid={`support-history-item-${item.id}`}
                    className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {getFeedbackCategoryLabel(item.category, lang)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                          {createdStr}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                            isResolved
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {isResolved ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isResolved
                              ? lang === 'bn'
                                ? 'সমাধান হয়েছে'
                                : 'Resolved'
                              : lang === 'bn'
                              ? 'অপেক্ষমাণ'
                              : 'Pending'}
                          </span>
                        </span>

                        {isAdminUser && !isResolved && (
                          <button
                            type="button"
                            onClick={() => onResolveFeedback(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer"
                          >
                            {lang === 'bn' ? 'সমাধান' : 'Resolve'}
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      {item.message}
                    </p>

                    {replies.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                        {replies.map((rep) => (
                          <div
                            key={rep.id}
                            className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-xs space-y-0.5"
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                              <span>{rep.authorName}</span>
                              <span className="tabular-nums font-medium">{rep.createdAt}</span>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200">{rep.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* RIGHT COLUMN: Interactive FAQ + Emergency Helplines + Privacy & Account Deletion */}
      <div className="xl:col-span-5 space-y-5">
        {/* 3. Quick Answers (FAQ Accordion) */}
        <section
          data-testid="support-faq-card"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2.5 border-b border-slate-100 dark:border-slate-800">
            {lang === 'bn' ? 'সচরাচর জিজ্ঞাসিত প্রশ্ন' : 'Frequently Asked Questions'}
          </h3>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {SUPPORT_FAQS.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id} className="py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full py-1 text-left flex items-center justify-between gap-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer"
                  >
                    <span>{lang === 'bn' ? faq.questionBn : faq.questionEn}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
                        isOpen ? 'rotate-180 text-emerald-700 dark:text-emerald-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {lang === 'bn' ? faq.answerBn : faq.answerEn}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Verified Worker Emergency Helplines */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pb-2.5 border-b border-slate-100 dark:border-slate-800">
            {lang === 'bn' ? 'শ্রমিক সহায়তা হেল্পলাইন' : 'Worker Helplines'}
          </h3>

          <div className="space-y-2">
            {VERIFIED_WORKER_HELPLINES.slice(0, 3).map((hl) => (
              <div
                key={hl.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {lang === 'bn' ? hl.nameBn : hl.nameEn}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {lang === 'bn' ? hl.descBn : hl.descEn}
                  </p>
                </div>
                <a
                  href={`tel:${hl.numberEn}`}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 tabular-nums"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? hl.numberBn : hl.numberEn}</span>
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Privacy Policy & Safe Account Deletion */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'তথ্য নিরাপত্তা ও অ্যাকাউন্ট নিয়ন্ত্রণ' : 'Privacy & Account Control'}
            </h3>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              {lang === 'bn'
                ? '১. শ্রমিক সাথী কখনোই আপনার এনআইডি নম্বর, বিকাশ/নগদ পিন বা ব্যাংক পাসওয়ার্ড সংগ্রহ করে না।'
                : '1. Shromik Sathi never asks for your NID number, mobile banking PIN, or bank passwords.'}
            </p>
            <p>
              {lang === 'bn'
                ? '২. আপনার বেতন, ওভারটাইম, হাজিরা ও ব্যক্তিগত কাগজপত্র শুধুমাত্র আপনার অ্যাকাউন্টেই সুরক্ষিত থাকে।'
                : '2. Your salary, overtime, and document vault records are strictly isolated to your account.'}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            {!confirmDeleteOpen ? (
              <button
                type="button"
                data-testid="support-delete-account-trigger"
                onClick={() => setConfirmDeleteOpen(true)}
                className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'bn'
                    ? 'অ্যাকাউন্ট ও সকল তথ্য মুছে ফেলুন'
                    : 'Delete Account & All Data'}
                </span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 leading-relaxed">
                    {lang === 'bn'
                      ? 'আপনি কি নিশ্চিত যে আপনার অ্যাকাউন্ট ও সকল সংরক্ষিত রেকর্ড স্থায়ীভাবে মুছে ফেলতে চান?'
                      : 'Are you sure you want to permanently delete your account and all records?'}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    className="min-h-[36px] px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {lang === 'bn' ? 'না, ফিরে যান' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteAccount}
                    className="min-h-[36px] px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {lang === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
