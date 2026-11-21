import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Banknote,
  Bell,
  BellRing,
  BookOpen,
  Building2,
  Calculator,
  Calendar,
  CalendarCheck,
  ChevronRight,
  Clock,
  Download,
  FolderLock,
  HelpCircle,
  Layers,
  Megaphone,
  Mic,
  PiggyBank,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { MoreSubView, NavTab } from '../types';
import {
  buildAllSmartSearchItems,
  runSmartSearch,
  type SmartSearchDataset,
  type SmartSearchIconKey,
  type SmartSearchItem,
} from '../utils/smartSearch';

export interface HomeSmartSearchBarProps {
  onNavigateTab: (tab: NavTab, subView?: MoreSubView, focusDate?: string) => void;
  onOpenVoiceModal: () => void;
  isProfileSetupIncomplete: boolean;
  reopenOnboarding: () => void;
}

const renderSearchIcon = (icon: SmartSearchIconKey) => {
  const cls = 'w-4 h-4 shrink-0';
  switch (icon) {
    case 'date_report':
      return <Calendar className={cls} />;
    case 'overtime':
      return <Clock className={cls} />;
    case 'attendance':
      return <CalendarCheck className={cls} />;
    case 'salary':
      return <Banknote className={cls} />;
    case 'expenses':
      return <Wallet className={cls} />;
    case 'savings':
      return <PiggyBank className={cls} />;
    case 'profile':
      return <UserCheck className={cls} />;
    case 'alarm':
      return <BellRing className={cls} />;
    case 'calculator':
      return <Calculator className={cls} />;
    case 'contacts':
      return <BookOpen className={cls} />;
    case 'factory':
      return <Building2 className={cls} />;
    case 'loans':
      return <Scale className={cls} />;
    case 'documents':
      return <FolderLock className={cls} />;
    case 'reports':
      return <Download className={cls} />;
    case 'reminders':
      return <Bell className={cls} />;
    case 'announcements':
      return <Megaphone className={cls} />;
    case 'support':
      return <HelpCircle className={cls} />;
    case 'subscriptions':
      return <Layers className={cls} />;
    case 'voice':
      return <Mic className={cls} />;
    case 'admin':
      return <ShieldCheck className={cls} />;
    default:
      return <Search className={cls} />;
  }
};

const HomeSmartSearchBarImpl: React.FC<HomeSmartSearchBarProps> = ({
  onNavigateTab,
  onOpenVoiceModal,
  isProfileSetupIncomplete,
  reopenOnboarding,
}) => {
  const {
    lang,
    selectedMonth,
    todayISO,
    isAdminUser,
    profile,
    overtime,
    attendance,
    salaryRecords,
    payments,
    expenses,
    savings,
    loans,
    contacts,
    workplaces,
    reminders,
    documents,
    alarms,
    leaveApplications,
    publishedAnnouncements,
    feedbackList,
    setSelectedMonth,
  } = useData();

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shouldBuildIndex = isOpen || deferredQuery.trim().length > 0;

  const dataset = useMemo<SmartSearchDataset | null>(() => {
    if (!shouldBuildIndex) return null;
    return {
      lang,
      selectedMonth,
      todayISO,
      isAdminUser,
      profile,
      overtime,
      attendance,
      salaryRecords,
      payments,
      expenses,
      savings,
      loans,
      contacts,
      workplaces,
      reminders,
      documents,
      alarms,
      leaveApplications,
      publishedAnnouncements,
      feedbackList,
    };
  }, [
    shouldBuildIndex,
    lang,
    selectedMonth,
    todayISO,
    isAdminUser,
    profile,
    overtime,
    attendance,
    salaryRecords,
    payments,
    expenses,
    savings,
    loans,
    contacts,
    workplaces,
    reminders,
    documents,
    alarms,
    leaveApplications,
    publishedAnnouncements,
    feedbackList,
  ]);

  // Lazy-build index ONLY when search is open or active — zero Home initial mount cost
  const allItems = useMemo(() => {
    if (!dataset) return [];
    return buildAllSmartSearchItems(dataset);
  }, [dataset]);

  const { dateReports, features, data } = useMemo(() => {
    if (!dataset) {
      return { dateReports: [], features: [], data: [] };
    }
    return runSmartSearch(allItems, deferredQuery, {
      maxFeatures: 8,
      maxData: 12,
      dataset,
    });
  }, [allItems, deferredQuery, dataset]);

  const flatResults = useMemo(
    () => [...dateReports, ...features, ...data],
    [dateReports, features, data]
  );

  // Collapse dropdown cleanly on outside tap/click
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  const handleSelectItem = (item: SmartSearchItem) => {
    // Collapse search results immediately on click
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();

    if (item.actionType === 'open_voice') {
      if (isProfileSetupIncomplete) {
        reopenOnboarding();
        return;
      }
      onOpenVoiceModal();
      return;
    }

    if (item.targetMonth && /^\d{4}-\d{2}$/.test(item.targetMonth)) {
      setSelectedMonth(item.targetMonth);
    }

    onNavigateTab(item.targetTab, item.targetSubView, item.focusDate);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatResults.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatResults.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? flatResults.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        e.preventDefault();
        handleSelectItem(flatResults[activeIndex]);
      } else if (flatResults.length > 0 && query.trim()) {
        e.preventDefault();
        handleSelectItem(flatResults[0]);
      }
    }
  };

  const hasQuery = query.trim().length > 0;
  const totalCount = flatResults.length;

  return (
    <div
      ref={containerRef}
      data-testid="home-smart-action-bar"
      className="relative w-full lg:w-[390px] xl:w-[440px] shrink-0"
    >
      {/* Compact Single-Row Control Strip: Smart Search + Voice Icon + Red Plus Overtime Icon */}
      <div className="flex items-center gap-2 w-full">
        {/* Clean Smart Search Input */}
        <div
          className={`flex-1 min-w-0 h-11 rounded-xl bg-slate-50 dark:bg-slate-800/80 border transition-colors flex items-center gap-2 px-3 ${
            isOpen
              ? 'border-emerald-600 dark:border-emerald-500 bg-white dark:bg-slate-900 ring-2 ring-emerald-500/15'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          <Search
            className={`w-4 h-4 shrink-0 transition-colors ${
              isOpen
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-400 dark:text-slate-500'
            }`}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="home-smart-search-results"
            aria-autocomplete="list"
            data-testid="home-smart-search-input"
            value={query}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={
              lang === 'bn'
                ? 'ফিচার, তারিখ (যেমন ১৯) বা তথ্য খুঁজুন...'
                : 'Search feature, date (e.g. 19) or data...'
            }
            className="w-full min-w-0 bg-transparent text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          {hasQuery && (
            <button
              type="button"
              data-testid="home-smart-search-clear-btn"
              onClick={() => {
                setQuery('');
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              aria-label={lang === 'bn' ? 'সার্চ মুছুন' : 'Clear search'}
              className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Voice Entry — Icon Only */}
        <button
          type="button"
          data-testid="open-voice-modal-btn"
          onClick={() => {
            setIsOpen(false);
            if (isProfileSetupIncomplete) {
              reopenOnboarding();
              return;
            }
            onOpenVoiceModal();
          }}
          aria-label={lang === 'bn' ? 'ভয়েস এন্ট্রি' : 'Voice Entry'}
          title={lang === 'bn' ? 'ভয়েস এন্ট্রি' : 'Voice Entry'}
          className="w-11 h-11 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800 flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
        >
          <Mic className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Add Overtime — Red Plus Icon Only */}
        <button
          type="button"
          data-testid="dashboard-add-overtime-btn"
          onClick={() => {
            setIsOpen(false);
            if (isProfileSetupIncomplete) {
              reopenOnboarding();
              return;
            }
            onNavigateTab('overtime');
          }}
          aria-label={lang === 'bn' ? 'ওভারটাইম যোগ করুন' : 'Add Overtime'}
          title={lang === 'bn' ? 'ওভারটাইম যোগ করুন' : 'Add Overtime'}
          className="w-11 h-11 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shrink-0 shadow-xs transition-transform cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
        </button>
      </div>

      {/* Floating Smart Search Results Panel (Auto-hides on selection, outside tap, or Esc) */}
      {isOpen && (
        <div
          id="home-smart-search-results"
          role="listbox"
          data-testid="home-smart-search-results"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
        >
          <div className="max-h-[62vh] sm:max-h-[400px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {totalCount === 0 ? (
              <div className="px-4 py-7 text-center">
                <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'bn'
                    ? `"${query.trim()}" দিয়ে কোনো ফিচার, তারিখ বা তথ্য পাওয়া যায়নি`
                    : `No features, dates, or records found for "${query.trim()}"`}
                </p>
              </div>
            ) : (
              <>
                {/* Smart Date Quick Reports Section (Current Month + Other Months) */}
                {dateReports.length > 0 && (
                  <div className="p-2">
                    <div className="px-2.5 py-1 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        {lang === 'bn' ? 'তারিখ অনুযায়ী রিপোর্ট' : 'Date Quick Reports'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setActiveIndex(-1);
                          inputRef.current?.blur();
                        }}
                        className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {lang === 'bn' ? 'লুকান' : 'Hide'}
                      </button>
                    </div>

                    <div className="mt-0.5 space-y-0.5">
                      {dateReports.map((item, idx) => {
                        const isHighlighted = activeIndex === idx;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            data-testid={`search-result-${item.id}`}
                            onClick={() => handleSelectItem(item)}
                            className={`w-full min-h-[48px] px-2.5 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
                              isHighlighted
                                ? 'bg-emerald-50 dark:bg-emerald-950/60'
                                : 'hover:bg-emerald-50/60 dark:hover:bg-slate-800/70'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                                {renderSearchIcon(item.icon)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {lang === 'bn' ? item.titleBn : item.titleEn}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                                  {lang === 'bn' ? item.metaBn : item.metaEn}
                                </p>
                              </div>
                            </div>

                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                              <span>
                                {lang === 'bn'
                                  ? item.ctaLabelBn || 'রিপোর্ট দেখুন'
                                  : item.ctaLabelEn || 'View'}
                              </span>
                              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Features / Pages Section */}
                {features.length > 0 && (
                  <div className="p-2">
                    <div className="px-2.5 py-1 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                        {hasQuery
                          ? lang === 'bn'
                            ? 'ফিচার ও পেজ'
                            : 'Features & Pages'
                          : lang === 'bn'
                          ? 'দ্রুত যান'
                          : 'Quick Jump'}
                      </span>
                      {dateReports.length === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            setActiveIndex(-1);
                            inputRef.current?.blur();
                          }}
                          className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {lang === 'bn' ? 'লুকান' : 'Hide'}
                        </button>
                      )}
                    </div>

                    <div className="mt-0.5 space-y-0.5">
                      {features.map((item, idx) => {
                        const globalIdx = dateReports.length + idx;
                        const isHighlighted = activeIndex === globalIdx;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            data-testid={`search-result-${item.id}`}
                            onClick={() => handleSelectItem(item)}
                            className={`w-full min-h-[44px] px-2.5 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
                              isHighlighted
                                ? 'bg-emerald-50 dark:bg-emerald-950/60'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                                {renderSearchIcon(item.icon)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {lang === 'bn' ? item.titleBn : item.titleEn}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {lang === 'bn' ? item.metaBn : item.metaEn}
                                </p>
                              </div>
                            </div>

                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                              <span>{lang === 'bn' ? 'যান' : 'Open'}</span>
                              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Saved User Data Matches Section */}
                {data.length > 0 && (
                  <div className="p-2">
                    <div className="px-2.5 py-1 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                        {lang === 'bn' ? 'আপনার সংরক্ষিত তথ্য' : 'Your Saved Data'}
                      </span>
                      {dateReports.length === 0 && features.length === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            setActiveIndex(-1);
                            inputRef.current?.blur();
                          }}
                          className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {lang === 'bn' ? 'লুকান' : 'Hide'}
                        </button>
                      )}
                    </div>

                    <div className="mt-0.5 space-y-0.5">
                      {data.map((item, idx) => {
                        const globalIdx = dateReports.length + features.length + idx;
                        const isHighlighted = activeIndex === globalIdx;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            data-testid={`search-result-${item.id}`}
                            onClick={() => handleSelectItem(item)}
                            className={`w-full min-h-[46px] px-2.5 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
                              isHighlighted
                                ? 'bg-emerald-50 dark:bg-emerald-950/60'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                                {renderSearchIcon(item.icon)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {lang === 'bn' ? item.titleBn : item.titleEn}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                                  <span>
                                    {lang === 'bn' ? item.sectionLabelBn : item.sectionLabelEn}
                                  </span>
                                  {((lang === 'bn' ? item.metaBn : item.metaEn) || '') && (
                                    <>
                                      <span aria-hidden="true"> · </span>
                                      <span>{lang === 'bn' ? item.metaBn : item.metaEn}</span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>

                            <ChevronRight
                              className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0"
                              aria-hidden="true"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const HomeSmartSearchBar = React.memo(HomeSmartSearchBarImpl);
