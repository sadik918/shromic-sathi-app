import React, { useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Eye,
  Megaphone,
  Monitor,
  PhoneCall,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toBengaliDigits } from '../utils/calculations';
import {
  type AdminAuditLog,
  type AdminRole,
  type AdminStoreState,
  type AnnouncementCategory,
  type AuditActionType,
  type PlatformAnnouncement,
  type PlatformConfig,
} from '../utils/adminLogic';
import {
  ADMIN_NOTICE_TEMPLATES,
  computeAnnouncementCounts,
  filterAnnouncements,
  type AdminSettingsSubTab,
  type AnnouncementStatus,
} from '../utils/adminSystemHelpers';
import { AdminCalculatorGovernanceSection } from './AdminCalculatorGovernanceSection';

interface AdminSettingsSectionProps {
  store: AdminStoreState;
  lang: 'bn' | 'en';
  effectiveRole: AdminRole | null;
  actorEmail: string;
  todayISO: string;
  announcementCategoryLabels: Record<AnnouncementCategory, { bn: string; en: string }>;
  annTitleBn: string;
  setAnnTitleBn: (v: string) => void;
  annMessageBn: string;
  setAnnMessageBn: (v: string) => void;
  annCategory: AnnouncementCategory;
  setAnnCategory: (v: AnnouncementCategory) => void;
  annStartDate: string;
  setAnnStartDate: (v: string) => void;
  annEndDate: string;
  setAnnEndDate: (v: string) => void;
  annPreviewDevice: 'mobile' | 'desktop';
  setAnnPreviewDevice: (v: 'mobile' | 'desktop') => void;
  handlePublishAnnouncement: (e: React.FormEvent, asDraft: boolean) => void;
  handleToggleAnnouncementStatus: (
    ann: PlatformAnnouncement,
    nextStatus: 'published' | 'archived'
  ) => void;
  handleDeleteAnnouncement: (ann: PlatformAnnouncement) => void;
  handleToggleFeatureFlag: (key: keyof PlatformConfig['featureFlags']) => void;
  handleToggleMaintenanceMode: () => void;
  handleSavePlatformPreferences: (patch: {
    maintenanceMessageBn: string;
    supportEmail: string;
    supportPhone: string;
    supportHoursBn: string;
  }) => void;
  policyConfirmOpen: boolean;
  setPolicyConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  policyHoursInput: string;
  setPolicyHoursInput: (v: string) => void;
  policyMultiplierInput: string;
  setPolicyMultiplierInput: (v: string) => void;
  policyMinGrossInput: string;
  setPolicyMinGrossInput: (v: string) => void;
  policyReasonInput: string;
  setPolicyReasonInput: (v: string) => void;
  handleConfirmPolicyChange: (e: React.FormEvent) => void;
  publicDemoConfig: {
    enabled: boolean;
    demoEmail: string;
    totalDemoSessions: number;
    blockedWriteAttempts: number;
    lastResetAt: string;
    maintenanceMessageBn: string;
  };
  updatePublicDemoConfig: (patch: { enabled?: boolean; maintenanceMessageBn?: string }) => void;
  resetDemoData: () => void;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
  recordAudit: (params: {
    actionType: AuditActionType;
    targetId: string;
    targetLabel: string;
    outcome?: 'success' | 'denied' | 'failed';
    reason: string;
    metadata?: Record<string, string | number | boolean>;
  }) => AdminAuditLog;
}

export const AdminSettingsSection: React.FC<AdminSettingsSectionProps> = ({
  store,
  lang,
  effectiveRole,
  actorEmail,
  todayISO,
  announcementCategoryLabels,
  annTitleBn,
  setAnnTitleBn,
  annMessageBn,
  setAnnMessageBn,
  annCategory,
  setAnnCategory,
  annStartDate,
  setAnnStartDate,
  annEndDate,
  setAnnEndDate,
  annPreviewDevice,
  setAnnPreviewDevice,
  handlePublishAnnouncement,
  handleToggleAnnouncementStatus,
  handleDeleteAnnouncement,
  handleToggleFeatureFlag,
  handleToggleMaintenanceMode,
  handleSavePlatformPreferences,
  policyConfirmOpen,
  setPolicyConfirmOpen,
  policyHoursInput,
  setPolicyHoursInput,
  policyMultiplierInput,
  setPolicyMultiplierInput,
  policyMinGrossInput,
  setPolicyMinGrossInput,
  policyReasonInput,
  setPolicyReasonInput,
  handleConfirmPolicyChange,
  publicDemoConfig,
  updatePublicDemoConfig,
  resetDemoData,
  showToast,
  showError,
  recordAudit,
}) => {
  const [subTab, setSubTab] = useState<AdminSettingsSubTab>('notices');
  const [annStatusFilter, setAnnStatusFilter] = useState<AnnouncementStatus | 'all'>('all');
  const [annSearch, setAnnSearch] = useState('');

  const [maintenanceMsgDraft, setMaintenanceMsgDraft] = useState(
    store.config.maintenanceMessageBn
  );
  const [supportEmailDraft, setSupportEmailDraft] = useState(store.config.supportEmail);
  const [supportPhoneDraft, setSupportPhoneDraft] = useState(store.config.supportPhone);
  const [supportHoursDraft, setSupportHoursDraft] = useState(store.config.supportHoursBn);

  const annCounts = useMemo(
    () => computeAnnouncementCounts(store.announcements),
    [store.announcements]
  );

  const filteredAnnouncements = useMemo(
    () => filterAnnouncements(store.announcements, annStatusFilter, annSearch),
    [store.announcements, annStatusFilter, annSearch]
  );

  const formatNum = (val: number) => (lang === 'bn' ? toBengaliDigits(val) : String(val));

  const subTabs: Array<{
    id: AdminSettingsSubTab;
    labelBn: string;
    labelEn: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'notices',
      labelBn: 'ঘোষণা ও নোটিশ',
      labelEn: 'Announcements',
      icon: <Megaphone className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'features',
      labelBn: 'ফিচার ও রক্ষণাবেক্ষণ',
      labelEn: 'Features & Maintenance',
      icon: <Sliders className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'policy',
      labelBn: 'বেতন ও ক্যালকুলেটর নীতি',
      labelEn: 'Wage & Calculator Policy',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  const featureItems: Array<{
    key: keyof PlatformConfig['featureFlags'];
    labelBn: string;
    labelEn: string;
    descBn: string;
    descEn: string;
  }> = [
    {
      key: 'voiceEntry',
      labelBn: 'বাংলা ভয়েস এন্ট্রি',
      labelEn: 'Bengali Voice Entry',
      descBn: 'মুখে বলে ওভারটাইম ও হাজিরা এন্ট্রি',
      descEn: 'Voice-based attendance and overtime input',
    },
    {
      key: 'googleContactsSync',
      labelBn: 'গুগল কন্টাক্ট সিঙ্ক',
      labelEn: 'Google Contacts Sync',
      descBn: 'সহকর্মী ও কারখানার নম্বর সংরক্ষণ',
      descEn: 'Sync supervisor and factory contacts',
    },
    {
      key: 'pdfPayslipExport',
      labelBn: 'পে-স্লিপ ও রিপোর্ট ডাউনলোড',
      labelEn: 'Payslip & Report Export',
      descBn: 'মাসিক বেতন ও হাজিরা রিপোর্ট প্রিন্ট সুবিধা',
      descEn: 'Monthly printable payslip and attendance report',
    },
    {
      key: 'personalLoanTracker',
      labelBn: 'ধার-দেনা ও কিস্তি হিসাব',
      labelEn: 'Personal Loan Tracker',
      descBn: 'ব্যক্তিগত লেনদেন ও কিস্তি রিমাইন্ডার',
      descEn: 'Track personal loans and installments',
    },
    {
      key: 'offlineSyncBanner',
      labelBn: 'অফলাইন সিঙ্ক সূচক',
      labelEn: 'Offline Sync Indicator',
      descBn: 'অফলাইন ও সিঙ্ক সম্পন্ন অবস্থা প্রদর্শন',
      descEn: 'Display offline and sync state badges',
    },
  ];

  const statusTextMap: Record<AnnouncementStatus, { bn: string; en: string; cls: string }> = {
    published: {
      bn: 'প্রকাশিত',
      en: 'Published',
      cls: 'text-emerald-700 dark:text-emerald-400',
    },
    draft: {
      bn: 'খসড়া',
      en: 'Draft',
      cls: 'text-amber-600 dark:text-amber-400',
    },
    archived: {
      bn: 'আর্কাইভ',
      en: 'Archived',
      cls: 'text-slate-500 dark:text-slate-400',
    },
  };

  return (
    <div data-testid="admin-settings-section" className="space-y-5">
      {/* Smart Segmented Sub-Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {subTabs.map((tab) => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`settings-subtab-${tab.id}`}
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              <span>{lang === 'bn' ? tab.labelBn : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* TAB 1: ঘোষণা ও নোটিশ (ANNOUNCEMENTS & NOTICES) */}
      {/* ================================================================= */}
      {subTab === 'notices' && (
        <div className="space-y-5">
          {/* Status Summary Filter Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                id: 'all' as const,
                labelBn: 'মোট নোটিশ',
                labelEn: 'Total Notices',
                count: annCounts.total,
                color: 'text-slate-900 dark:text-white',
              },
              {
                id: 'published' as const,
                labelBn: 'প্রকাশিত',
                labelEn: 'Published',
                count: annCounts.published,
                color: 'text-emerald-700 dark:text-emerald-400',
              },
              {
                id: 'draft' as const,
                labelBn: 'খসড়া',
                labelEn: 'Drafts',
                count: annCounts.draft,
                color: 'text-amber-600 dark:text-amber-400',
              },
              {
                id: 'archived' as const,
                labelBn: 'আর্কাইভ',
                labelEn: 'Archived',
                count: annCounts.archived,
                color: 'text-slate-500 dark:text-slate-400',
              },
            ].map((stat) => {
              const selected = annStatusFilter === stat.id;
              return (
                <button
                  key={stat.id}
                  type="button"
                  onClick={() => setAnnStatusFilter(stat.id)}
                  className={`text-left bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border transition-colors cursor-pointer ${
                    selected
                      ? 'border-emerald-600 dark:border-emerald-500 ring-1 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {lang === 'bn' ? stat.labelBn : stat.labelEn}
                  </p>
                  <p className={`text-xl sm:text-2xl font-bold font-mono tabular-nums mt-1 ${stat.color}`}>
                    {formatNum(stat.count)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Composer & Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'নতুন নোটিশ তৈরি করুন' : 'Create New Announcement'}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'এক ট্যাপে টেমপ্লেট বেছে নিন' : 'One-tap smart templates'}
                </span>
              </div>

              {/* 1-Tap Smart Notice Templates */}
              <div className="flex flex-wrap gap-2">
                {ADMIN_NOTICE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    data-testid={`notice-template-${tpl.id}`}
                    onClick={() => {
                      setAnnCategory(tpl.category);
                      setAnnTitleBn(tpl.titleBn);
                      setAnnMessageBn(tpl.messageBn);
                    }}
                    className="min-h-[34px] px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/50 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>{lang === 'bn' ? tpl.labelBn : tpl.labelEn}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={(e) => handlePublishAnnouncement(e, false)} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === 'bn' ? 'নোটিশের শিরোনাম' : 'Announcement Title'}
                  </label>
                  <input
                    type="text"
                    data-testid="ann-title-input"
                    value={annTitleBn}
                    onChange={(e) => setAnnTitleBn(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'যেমন: ঈদুল ফিতরের সরকারি ছুটির তালিকা যুক্ত হয়েছে'
                        : 'Enter announcement headline...'
                    }
                    className="w-full min-h-[40px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {lang === 'bn' ? 'বিষয়ের ধরন' : 'Category'}
                    </label>
                    <select
                      value={annCategory}
                      onChange={(e) => setAnnCategory(e.target.value as AnnouncementCategory)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white"
                    >
                      {Object.entries(announcementCategoryLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {lang === 'bn' ? v.bn : v.en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {lang === 'bn' ? 'শুরুর তারিখ' : 'Start Date'}
                    </label>
                    <input
                      type="date"
                      value={annStartDate}
                      onChange={(e) => setAnnStartDate(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {lang === 'bn' ? 'শেষ তারিখ' : 'End Date'}
                    </label>
                    <input
                      type="date"
                      value={annEndDate}
                      onChange={(e) => setAnnEndDate(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === 'bn' ? 'বিস্তারিত বার্তা' : 'Announcement Message'}
                  </label>
                  <textarea
                    rows={3}
                    data-testid="ann-message-input"
                    value={annMessageBn}
                    onChange={(e) => setAnnMessageBn(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'শ্রমিকদের জন্য সহজ ও স্পষ্ট বাংলায় বার্তাটি লিখুন...'
                        : 'Write clear announcement details...'
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={(e) => handlePublishAnnouncement(e, true)}
                    className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {lang === 'bn' ? 'খসড়া সংরক্ষণ' : 'Save Draft'}
                  </button>
                  <button
                    type="submit"
                    data-testid="publish-ann-submit"
                    className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                  >
                    {lang === 'bn' ? 'এখনই প্রকাশ করুন' : 'Publish Notice'}
                  </button>
                </div>
              </form>
            </div>

            {/* Live Preview Panel */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'অ্যাপে যেমন দেখাবে' : 'Live Preview'}
                </h3>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setAnnPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 cursor-pointer ${
                      annPreviewDevice === 'mobile'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'মোবাইল' : 'Mobile'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 cursor-pointer ${
                      annPreviewDevice === 'desktop'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'ডেস্কটপ' : 'Desktop'}</span>
                  </button>
                </div>
              </div>

              <div
                className={`mx-auto rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 p-4 space-y-2 ${
                  annPreviewDevice === 'mobile' ? 'max-w-[320px]' : 'w-full'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <span>
                    {lang === 'bn'
                      ? announcementCategoryLabels[annCategory].bn
                      : announcementCategoryLabels[annCategory].en}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{annStartDate}</span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {annTitleBn.trim() ||
                    (lang === 'bn' ? 'নোটিশের শিরোনাম এখানে দেখাবে' : 'Announcement headline preview')}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {annMessageBn.trim() ||
                    (lang === 'bn'
                      ? 'আপনার লেখা বার্তা শ্রমিকদের ফোনে এভাবে প্রদর্শিত হবে।'
                      : 'Your announcement body will appear here.')}
                </p>
              </div>
            </div>
          </div>

          {/* Searchable Announcements List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'সকল নোটিশের তালিকা' : 'Announcements List'}
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={annSearch}
                  onChange={(e) => setAnnSearch(e.target.value)}
                  placeholder={lang === 'bn' ? 'শিরোনাম দিয়ে খুঁজুন...' : 'Search notices...'}
                  className="w-full min-h-[38px] pl-9 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {filteredAnnouncements.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {lang === 'bn' ? 'এই তালিকায় কোনো নোটিশ পাওয়া যায়নি।' : 'No notices found for this filter.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredAnnouncements.map((ann) => {
                  const st = statusTextMap[ann.status];
                  return (
                    <div
                      key={ann.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-slate-500">
                          <span className={`font-bold ${st.cls}`}>
                            {lang === 'bn' ? st.bn : st.en}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {lang === 'bn'
                              ? announcementCategoryLabels[ann.category].bn
                              : announcementCategoryLabels[ann.category].en}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            {ann.startDate} → {ann.endDate}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          {ann.titleBn}
                        </p>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                          {ann.messageBn}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {ann.status !== 'published' && (
                          <button
                            type="button"
                            onClick={() => handleToggleAnnouncementStatus(ann, 'published')}
                            className="min-h-[34px] px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'প্রকাশ করুন' : 'Publish'}</span>
                          </button>
                        )}
                        {ann.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleToggleAnnouncementStatus(ann, 'archived')}
                            className="min-h-[34px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'আর্কাইভ' : 'Archive'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={lang === 'bn' ? 'নোটিশ মুছুন' : 'Delete notice'}
                          onClick={() => handleDeleteAnnouncement(ann)}
                          className="min-h-[34px] px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: অ্যাপ ফিচার ও রক্ষণাবেক্ষণ (FEATURE SWITCHES & SUPPORT INFO) */}
      {/* ================================================================= */}
      {subTab === 'features' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Feature Switches */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'অ্যাপের মূল সুবিধাসমূহ নিয়ন্ত্রণ' : 'App Feature Controls'}
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {featureItems.map((item) => {
                const enabled = store.config.featureFlags[item.key];
                return (
                  <div
                    key={item.key}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {lang === 'bn' ? item.labelBn : item.labelEn}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {lang === 'bn' ? item.descBn : item.descEn}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      data-testid={`feature-switch-${item.key}`}
                      onClick={() => handleToggleFeatureFlag(item.key)}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        enabled ? 'bg-emerald-700' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}

              {/* Maintenance Mode Toggle */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'রক্ষণাবেক্ষণ নোটিশ মোড' : 'Maintenance Banner Mode'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'চালু করলে অ্যাপের ওপর জরুরি সতর্কবার্তা দেখাবে'
                      : 'Displays maintenance notice banner across app'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={store.config.maintenanceMode}
                  data-testid="feature-switch-maintenance"
                  onClick={handleToggleMaintenanceMode}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    store.config.maintenanceMode
                      ? 'bg-amber-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                      store.config.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Support Contact & Maintenance Banner Message Editor */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'সাপোর্ট তথ্য ও সতর্কবার্তা' : 'Support & Banner Settings'}
              </h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSavePlatformPreferences({
                  maintenanceMessageBn: maintenanceMsgDraft,
                  supportEmail: supportEmailDraft,
                  supportPhone: supportPhoneDraft,
                  supportHoursBn: supportHoursDraft,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'রক্ষণাবেক্ষণ সতর্কবার্তা' : 'Maintenance Message'}
                </label>
                <textarea
                  rows={2}
                  value={maintenanceMsgDraft}
                  onChange={(e) => setMaintenanceMsgDraft(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'সাপোর্ট ইমেইল' : 'Support Email'}
                </label>
                <input
                  type="email"
                  value={supportEmailDraft}
                  onChange={(e) => setSupportEmailDraft(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'হেল্পলাইন নম্বর' : 'Helpline Phone'}
                </label>
                <input
                  type="text"
                  value={supportPhoneDraft}
                  onChange={(e) => setSupportPhoneDraft(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'সহায়তা প্রদানের সময়' : 'Support Hours'}
                </label>
                <input
                  type="text"
                  value={supportHoursDraft}
                  onChange={(e) => setSupportHoursDraft(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                data-testid="save-platform-prefs-btn"
                className="w-full min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{lang === 'bn' ? 'সেটিংস সংরক্ষণ করুন' : 'Save Settings'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: বেতন ও ক্যালকুলেটর নীতি (WAGE POLICY & CALCULATOR RULES) */}
      {/* ================================================================= */}
      {subTab === 'policy' && (
        <div className="space-y-5">
          {/* Calculation Policy Governance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'বেতন ও ওভারটাইম হিসাব নীতিমালা' : 'Wage & Overtime Policy'}
              </h3>
              <button
                type="button"
                onClick={() => setPolicyConfirmOpen((p) => !p)}
                className="min-h-[36px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {lang === 'bn' ? 'নতুন সংস্করণ যুক্ত করুন' : 'Update Policy'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 block">
                  {lang === 'bn' ? 'মাসিক কর্মঘণ্টা' : 'Monthly Hours'}
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5 block">
                  {formatNum(store.config.currentCalculationPolicy.standardMonthlyHours)}{' '}
                  {lang === 'bn' ? 'ঘণ্টা' : 'hrs'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 block">
                  {lang === 'bn' ? 'ওভারটাইম গুণক' : 'Overtime Multiplier'}
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                  {store.config.currentCalculationPolicy.overtimeMultiplier}x
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 block">
                  {lang === 'bn' ? 'গ্রেড-৪ ন্যূনতম মজুরি' : 'Grade-4 Minimum Wage'}
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5 block">
                  ৳{formatNum(store.config.currentCalculationPolicy.minimumGrossWageGrade4)}
                </span>
              </div>
            </div>

            {policyConfirmOpen && (
              <form
                onSubmit={handleConfirmPolicyChange}
                className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3 text-xs"
              >
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  {lang === 'bn'
                    ? 'সূত্র পরিবর্তনের আগে গেজেট বা প্রজ্ঞাপনের কারণ লিখুন; পূর্ববর্তী মাসের হিসাব অপরিবর্তিত থাকবে।'
                    : 'Provide gazette reason before changing formula; past month snapshots remain unchanged.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold mb-1">
                      {lang === 'bn' ? 'মাসিক কর্মঘণ্টা' : 'Divisor Hours'}
                    </label>
                    <input
                      type="number"
                      value={policyHoursInput}
                      onChange={(e) => setPolicyHoursInput(e.target.value)}
                      className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">
                      {lang === 'bn' ? 'ওভারটাইম গুণক' : 'Multiplier'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={policyMultiplierInput}
                      onChange={(e) => setPolicyMultiplierInput(e.target.value)}
                      className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">
                      {lang === 'bn' ? 'গ্রেড-৪ মজুরি' : 'Grade-4 Gross'}
                    </label>
                    <input
                      type="number"
                      value={policyMinGrossInput}
                      onChange={(e) => setPolicyMinGrossInput(e.target.value)}
                      className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={policyReasonInput}
                  onChange={(e) => setPolicyReasonInput(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'সরকারি গেজেট বা প্রজ্ঞাপনের বিবরণ লিখুন...'
                      : 'Enter official gazette reference...'
                  }
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPolicyConfirmOpen(false)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="min-h-[36px] px-4 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    {lang === 'bn' ? 'নিশ্চিত ও প্রকাশ করুন' : 'Confirm & Publish'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                {lang === 'bn' ? 'পূর্ববর্তী সংস্করণ ইতিহাস' : 'Policy Version History'}
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {store.config.calculationPolicyHistory.map((pol) => (
                  <div
                    key={pol.version}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono font-bold">
                      <span className="text-emerald-700 dark:text-emerald-400">{pol.version}</span>
                      <span className="text-slate-500">{pol.effectiveFrom}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {pol.changeReason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <AdminCalculatorGovernanceSection
            effectiveRole={effectiveRole}
            actorEmail={actorEmail}
            todayISO={todayISO}
            lang={lang}
            showToast={showToast}
            showError={showError}
            recordAudit={recordAudit}
          />
        </div>
      )}
    </div>
  );
};
