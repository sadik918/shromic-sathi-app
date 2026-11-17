import React, { useState } from 'react';
import {
  Calculator as CalcIcon,
  CheckCircle2,
  Edit3,
  Plus,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import {
  loadAdminCalculatorConfig,
  saveAdminCalculatorConfig,
  type AdminCalculatorConfigStore,
  type BenefitCalculatorId,
  type CalculatorCatalogMeta,
  type LegalRuleVersion,
} from '../utils/garmentBenefitsEngine';
import type { AdminAuditLog, AdminRole, AuditActionType } from '../utils/adminLogic';
import { toBengaliDigits } from '../utils/calculations';

interface AdminCalculatorGovernanceSectionProps {
  effectiveRole: AdminRole | null;
  actorEmail: string;
  todayISO: string;
  lang: 'bn' | 'en';
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

export const AdminCalculatorGovernanceSection: React.FC<
  AdminCalculatorGovernanceSectionProps
> = ({
  effectiveRole,
  actorEmail,
  todayISO,
  lang,
  showToast,
  showError,
  recordAudit,
}) => {
  const [config, setConfig] = useState<AdminCalculatorConfigStore>(() =>
    loadAdminCalculatorConfig()
  );
  const [editingCalcId, setEditingCalcId] = useState<BenefitCalculatorId | null>(null);
  const [draftTitleBn, setDraftTitleBn] = useState('');
  const [draftDescBn, setDraftDescBn] = useState('');
  const [draftHelpBn, setDraftHelpBn] = useState('');

  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [newRuleVersionId, setNewRuleVersionId] = useState('');
  const [newRuleTitleBn, setNewRuleTitleBn] = useState('');
  const [newRuleEffectiveDate, setNewRuleEffectiveDate] = useState(todayISO);
  const [newRuleNotesBn, setNewRuleNotesBn] = useState('');
  const [newRuleAccidentGrant, setNewRuleAccidentGrant] = useState('200000');

  const canModifyLegalRules =
    effectiveRole === 'super_admin' || effectiveRole === 'admin';

  const handleToggleCalculatorEnabled = (calc: CalculatorCatalogMeta) => {
    if (!canModifyLegalRules) {
      recordAudit({
        actionType: 'policy_updated',
        targetId: calc.id,
        targetLabel: calc.titleBn,
        outcome: 'denied',
        reason: 'Moderator attempted to enable/disable calculator without legal rule permission.',
      });
      showError(
        lang === 'bn'
          ? 'অ্যাক্সেস প্রত্যাখ্যাত: মডারেটর রোলে ক্যালকুলেটর বা আইনি সূত্র পরিবর্তনের অনুমতি নেই।'
          : 'Permission denied: Support moderators cannot alter calculators or legal rules.'
      );
      return;
    }

    const nextEnabled = !calc.enabled;
    const nextStore: AdminCalculatorConfigStore = {
      ...config,
      catalog: config.catalog.map((c) =>
        c.id === calc.id ? { ...c, enabled: nextEnabled } : c
      ),
      updatedAt: todayISO,
      updatedBy: actorEmail,
    };
    setConfig(nextStore);
    saveAdminCalculatorConfig(nextStore);

    recordAudit({
      actionType: 'policy_updated',
      targetId: calc.id,
      targetLabel: calc.titleBn,
      reason: `${nextEnabled ? 'Enabled' : 'Disabled'} calculator ${calc.id}`,
      metadata: { enabled: nextEnabled },
    });

    showToast(
      lang === 'bn'
        ? `"${calc.titleBn}" ক্যালকুলেটর ${nextEnabled ? 'চালু' : 'বন্ধ'} করা হয়েছে।`
        : `Calculator "${calc.titleEn}" ${nextEnabled ? 'enabled' : 'disabled'}.`
    );
  };

  const handleStartEditCalculator = (calc: CalculatorCatalogMeta) => {
    setEditingCalcId(calc.id);
    setDraftTitleBn(calc.titleBn);
    setDraftDescBn(calc.shortDescBn);
    setDraftHelpBn(calc.helpTextBn);
  };

  const handleSaveCalculatorMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCalcId) return;

    if (!canModifyLegalRules) {
      showError(
        lang === 'bn'
          ? 'অ্যাক্সেস প্রত্যাখ্যাত: মডারেটর রোলে ক্যালকুলেটর বিবরণ সম্পাদনার অনুমতি নেই।'
          : 'Permission denied.'
      );
      return;
    }

    const nextStore: AdminCalculatorConfigStore = {
      ...config,
      catalog: config.catalog.map((c) =>
        c.id === editingCalcId
          ? {
              ...c,
              titleBn: draftTitleBn.trim() || c.titleBn,
              shortDescBn: draftDescBn.trim() || c.shortDescBn,
              helpTextBn: draftHelpBn.trim() || c.helpTextBn,
            }
          : c
      ),
      updatedAt: todayISO,
      updatedBy: actorEmail,
    };
    setConfig(nextStore);
    saveAdminCalculatorConfig(nextStore);

    recordAudit({
      actionType: 'policy_updated',
      targetId: editingCalcId,
      targetLabel: draftTitleBn,
      reason: 'Updated calculator Bengali title, description, and help text.',
    });

    setEditingCalcId(null);
    showToast('ক্যালকুলেটরের শিরোনাম ও সহায়িকা সফলভাবে আপডেট করা হয়েছে।');
  };

  const handleActivateRuleVersion = (versionId: string) => {
    if (!canModifyLegalRules) {
      showError(
        lang === 'bn'
          ? 'অ্যাক্সেস প্রত্যাখ্যাত: মডারেটর রোলে শ্রম আইন সংস্করণ পরিবর্তনের অনুমতি নেই।'
          : 'Permission denied: Moderators cannot change legal rule versions.'
      );
      return;
    }

    const nextStore: AdminCalculatorConfigStore = {
      ...config,
      activeRuleVersionId: versionId,
      updatedAt: todayISO,
      updatedBy: actorEmail,
    };
    setConfig(nextStore);
    saveAdminCalculatorConfig(nextStore);

    recordAudit({
      actionType: 'policy_updated',
      targetId: versionId,
      targetLabel: `Active Legal Rule Version -> ${versionId}`,
      reason: `Switched active garment benefits legal rule version to ${versionId}`,
    });

    showToast(`সক্রিয় শ্রম আইন সংস্করণ "${versionId}"-এ পরিবর্তন করা হয়েছে।`);
  };

  const handlePublishNewRuleVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifyLegalRules) {
      showError('অ্যাক্সেস প্রত্যাখ্যাত: মডারেটর রোলে নতুন আইনি সংস্করণ প্রকাশের অনুমতি নেই।');
      return;
    }

    const trimmedId = newRuleVersionId.trim();
    const trimmedTitle = newRuleTitleBn.trim();
    if (!trimmedId || !trimmedTitle) {
      showError('অনুগ্রহ করে সংস্করণ আইডি এবং শিরোনাম পূরণ করুন।');
      return;
    }

    const baseVersion = config.ruleVersions[0];
    const newVersion: LegalRuleVersion = {
      versionId: trimmedId,
      titleBn: trimmedTitle,
      titleEn: trimmedTitle,
      actNameBn: baseVersion.actNameBn,
      actNameEn: baseVersion.actNameEn,
      effectiveFrom: newRuleEffectiveDate || todayISO,
      verifiedBy: actorEmail,
      verifiedAt: todayISO,
      isPublished: true,
      notesBn:
        newRuleNotesBn.trim() ||
        'অ্যাডমিন প্যানেল থেকে যাচাইকৃত ও প্রকাশিত নতুন শ্রম আইন সংস্করণ।',
      parameters: {
        ...baseVersion.parameters,
        workplaceAccidentDeathGrantBDT:
          Number(newRuleAccidentGrant) || baseVersion.parameters.workplaceAccidentDeathGrantBDT,
      },
    };

    const nextStore: AdminCalculatorConfigStore = {
      ...config,
      activeRuleVersionId: newVersion.versionId,
      ruleVersions: [newVersion, ...config.ruleVersions],
      updatedAt: todayISO,
      updatedBy: actorEmail,
    };
    setConfig(nextStore);
    saveAdminCalculatorConfig(nextStore);

    recordAudit({
      actionType: 'policy_updated',
      targetId: newVersion.versionId,
      targetLabel: newVersion.titleBn,
      reason: `Published verified legal rule version (${newVersion.effectiveFrom})`,
    });

    setShowNewRuleForm(false);
    setNewRuleVersionId('');
    setNewRuleTitleBn('');
    setNewRuleNotesBn('');
    showToast('নতুন যাচাইকৃত শ্রম আইন সংস্করণ প্রকাশিত ও সক্রিয় করা হয়েছে!');
  };

  return (
    <div
      data-testid="admin-calculator-governance-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <CalcIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              বেতন ও সুবিধা ক্যালকুলেটর এবং শ্রম আইন নিয়ন্ত্রণ
            </h3>
          </div>
        </div>

        {!canModifyLegalRules && (
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>মডারেটর: শুধুমাত্র দেখার অনুমতি</span>
          </span>
        )}
      </div>

      {/* 1. Legal Rule Versions Governance */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>বাংলাদেশ শ্রম আইন সংস্করণ ইতিহাস</span>
          </h4>
          {canModifyLegalRules && (
            <button
              type="button"
              data-testid="admin-open-new-rule-version-btn"
              onClick={() => setShowNewRuleForm((prev) => !prev)}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>নতুন আইন সংস্করণ</span>
            </button>
          )}
        </div>

        {showNewRuleForm && canModifyLegalRules && (
          <form
            onSubmit={handlePublishNewRuleVersion}
            className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">সংস্করণ কোড *</label>
                <input
                  type="text"
                  required
                  placeholder="BLA-2006-REV-2026"
                  value={newRuleVersionId}
                  onChange={(e) => setNewRuleVersionId(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">কার্যকর তারিখ *</label>
                <input
                  type="date"
                  required
                  value={newRuleEffectiveDate}
                  onChange={(e) => setNewRuleEffectiveDate(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">দুর্ঘটনায় মৃত্যু অনুদান (৳)</label>
                <input
                  type="number"
                  value={newRuleAccidentGrant}
                  onChange={(e) => setNewRuleAccidentGrant(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">আইন সংস্করণের শিরোনাম *</label>
                <input
                  type="text"
                  required
                  placeholder="বাংলাদেশ শ্রম আইন ও গার্মেন্টস মজুরি গেজেট..."
                  value={newRuleTitleBn}
                  onChange={(e) => setNewRuleTitleBn(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">গেজেট বা সংশোধনী নোট</label>
                <input
                  type="text"
                  placeholder="প্রজ্ঞাপন সূত্র ও অডিট নোট..."
                  value={newRuleNotesBn}
                  onChange={(e) => setNewRuleNotesBn(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewRuleForm(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
              >
                যাচাই ও প্রকাশ করুন
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {config.ruleVersions.map((rv) => {
            const isActive = rv.versionId === config.activeRuleVersionId;
            return (
              <div
                key={rv.versionId}
                className={`p-3.5 rounded-xl border space-y-1.5 ${
                  isActive
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                    {rv.versionId}
                  </span>
                  {isActive ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>সক্রিয় সংস্করণ</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canModifyLegalRules}
                      onClick={() => handleActivateRuleVersion(rv.versionId)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      সক্রিয় করুন
                    </button>
                  )}
                </div>
                <p className="font-bold text-slate-900 dark:text-white">{rv.titleBn}</p>
                <p className="text-slate-600 dark:text-slate-300">{rv.notesBn}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  কার্যকর: {rv.effectiveFrom} · যাচাইকারী: {rv.verifiedBy}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Individual Calculator Enable/Disable & Content Editor */}
      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            সকল ক্যালকুলেটর ({toBengaliDigits(config.catalog.length)}টি)
          </h4>
        </div>

        {editingCalcId && (
          <form
            onSubmit={handleSaveCalculatorMeta}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 space-y-3 text-xs"
          >
            <p className="font-bold text-slate-900 dark:text-white">
              ক্যালকুলেটর সম্পাদনা
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">বাংলা শিরোনাম</label>
                <input
                  type="text"
                  value={draftTitleBn}
                  onChange={(e) => setDraftTitleBn(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">সংক্ষিপ্ত বিবরণ</label>
                <input
                  type="text"
                  value={draftDescBn}
                  onChange={(e) => setDraftDescBn(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">সহায়িকা ও আইনি ব্যাখ্যা</label>
              <textarea
                rows={2}
                value={draftHelpBn}
                onChange={(e) => setDraftHelpBn(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCalcId(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1 text-xs">
          {config.catalog.map((calc) => (
            <div
              key={calc.id}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/30"
            >
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  {calc.titleBn}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{calc.legalSectionBn}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {canModifyLegalRules && (
                  <button
                    type="button"
                    onClick={() => handleStartEditCalculator(calc)}
                    className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white cursor-pointer"
                    title="সম্পাদনা করুন"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  data-testid={`admin-toggle-calc-${calc.id}`}
                  onClick={() => handleToggleCalculatorEnabled(calc)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                    calc.enabled
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600'
                  }`}
                >
                  {calc.enabled ? 'চালু' : 'বন্ধ'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
