import React, { useState } from 'react';
import {
  Layers,
  Power,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Check,
  X,
  AlertTriangle,
  Gift,
  Search,
  Shield,
  Crown,
  Sparkles,
  CreditCard,
  UserCheck,
  Calendar,
  Save,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Tag,
  Percent,
  RefreshCw,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  APP_FEATURE_CATALOG,
  DEFAULT_SUBSCRIPTION_PLANS,
  formatBdtPrice,
  getBengaliPlanName,
  toBengaliDigits,
  validatePlanInput,
  type CouponCode,
  type FeatureKey,
  type PlanFeatureRule,
  type SubscriptionPaymentRequest,
  type SubscriptionPlan,
  type SubscriptionPlanTier,
} from '../utils/subscriptionLogic';

interface AdminSubscriptionSectionProps {
  effectiveRole: string | null;
  actorUid: string;
  actorName: string;
  lang: 'bn' | 'en';
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
  recordAudit: (params: {
    actionType: any;
    targetId: string;
    targetLabel: string;
    reason: string;
    metadata?: Record<string, any>;
  }) => any;
}

export const AdminSubscriptionSection: React.FC<AdminSubscriptionSectionProps> = ({
  effectiveRole,
  actorUid,
  actorName,
  lang,
  showToast,
  showError,
  recordAudit,
}) => {
  const {
    subscriptionConfig,
    subscriptionPlans,
    updateGlobalSubscriptionConfig,
    saveSubscriptionPlan,
    deleteSubscriptionPlan,
    adminAssignUserPlan,
    adminProcessPaymentRequest,
    userSubscription,
    coupons,
    saveCoupon,
    deleteCoupon,
  } = useData();

  const isSuperAdmin = effectiveRole === 'super_admin';
  const isAdmin = effectiveRole === 'admin' || isSuperAdmin;

  // Active sub-tab in Admin Subscriptions
  const [subTab, setSubTab] = useState<'plans' | 'matrix' | 'coupons' | 'requests' | 'assign'>('plans');

  // Coupon Edit / Create State
  const [editingCoupon, setEditingCoupon] = useState<CouponCode | null>(null);
  const [isSavingCoupon, setIsSavingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Plan Edit / Create Modal State
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [previewPlan, setPreviewPlan] = useState<SubscriptionPlan | null>(null);
  const [planFormError, setPlanFormError] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // New Benefit / Limitation item inputs inside Edit Modal
  const [newBenefitInput, setNewBenefitInput] = useState('');
  const [newLimitationInput, setNewLimitationInput] = useState('');

  // User Assignment State
  const [assignTargetUid, setAssignTargetUid] = useState('current');
  const [assignPlanId, setAssignPlanId] = useState('pro');
  const [assignCycle, setAssignCycle] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly');
  const [assignCustomDaysRemaining, setAssignCustomDaysRemaining] = useState<string>('30');
  const [assignIsComplimentary, setAssignIsComplimentary] = useState(false);
  const [assignReason, setAssignReason] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Renewal warning threshold days state
  const [warningDaysInput, setWarningDaysInput] = useState<number>(
    subscriptionConfig.renewalWarningDays ?? 5
  );

  React.useEffect(() => {
    setWarningDaysInput(subscriptionConfig.renewalWarningDays ?? 5);
  }, [subscriptionConfig.renewalWarningDays]);

  const handleSaveWarningDays = async (daysVal: number) => {
    const cleanDays = Math.max(1, Math.min(365, Math.round(Number(daysVal) || 5)));
    setWarningDaysInput(cleanDays);
    try {
      await updateGlobalSubscriptionConfig({ renewalWarningDays: cleanDays });
      recordAudit({
        actionType: 'settings_updated',
        targetId: 'subscription_renewal_warning_days',
        targetLabel: 'Subscription Renewal Warning Threshold',
        reason: `Updated renewal warning threshold to ${cleanDays} days`,
        metadata: { renewalWarningDays: cleanDays },
      });
      showToast(
        lang === 'bn'
          ? `রিনিউ নোটিশ সময়সীমা ${toBengaliDigits(cleanDays)} দিন সেট করা হয়েছে।`
          : `Renewal warning threshold set to ${cleanDays} days.`
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'সময়সীমা সংরক্ষণ ব্যর্থ হয়েছে');
    }
  };

  // Feature Matrix in-memory edits
  const [matrixPlans, setMatrixPlans] = useState<SubscriptionPlan[]>(subscriptionPlans);

  // Keep matrixPlans in sync with context
  React.useEffect(() => {
    setMatrixPlans(subscriptionPlans);
  }, [subscriptionPlans]);

  // Master Switch Toggle with Audit
  const handleToggleMasterSwitch = async () => {
    if (!isAdmin) {
      showError(lang === 'bn' ? 'অনুমতি নেই: শুধুমাত্র অ্যাডমিনরা সিস্টেম স্ট্যাটাস পরিবর্তন করতে পারেন।' : 'Permission denied.');
      return;
    }
    const nextState = !subscriptionConfig.enabled;
    try {
      await updateGlobalSubscriptionConfig({ enabled: nextState });
      recordAudit({
        actionType: 'settings_updated',
        targetId: 'subscription_master_switch',
        targetLabel: 'Subscription System Master Switch',
        reason: nextState
          ? 'Enabled subscription limits & plan gating'
          : 'Disabled subscription limits; full free access for all users',
        metadata: { newState: nextState },
      });
      showToast(
        nextState
          ? (lang === 'bn' ? 'সাবস্ক্রিপশন সিস্টেম সক্রিয় করা হয়েছে।' : 'Subscription system enabled.')
          : (lang === 'bn' ? 'সাবস্ক্রিপশন সিস্টেম বন্ধ করা হয়েছে — সকল ইউজার এখন আনলিমিটেড ফ্রি।' : 'Subscription system disabled; all users unrestricted.')
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'সিস্টেম স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে');
    }
  };

  // Plan Edit Handlers
  const handleOpenEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(JSON.parse(JSON.stringify(plan)));
    setPlanFormError('');
    setNewBenefitInput('');
    setNewLimitationInput('');
  };

  const handleAddNewPlan = () => {
    const newId = `custom_tier_${Date.now()}`;
    const basePro = DEFAULT_SUBSCRIPTION_PLANS[1];
    const newPlan: SubscriptionPlan = {
      id: newId,
      tier: 'pro',
      nameBn: 'নতুন কাস্টম প্ল্যান',
      nameEn: 'New Custom Tier',
      descriptionBn: 'এই প্ল্যানের বিবরণ লিখুন',
      descriptionEn: 'Description of the tier',
      priceBDT: 150,
      pricing: {
        isFree: false,
        monthlyPriceBdt: 150,
        yearlyPriceBdt: 1500,
        currency: 'BDT',
      },
      features: { ...basePro.features },
      featureMatrix: { ...(basePro.featureMatrix || {}) },
      billingDuration: 'monthly',
      durationDays: 30,
      billingCycle: 'monthly',
      status: 'draft',
      displayOrder: subscriptionPlans.length + 1,
      benefitsBn: ['সকল প্রিমিয়াম ফিচার আনলক'],
      benefitsEn: ['All premium features unlocked'],
      limitationsBn: [],
      limitationsEn: [],
    };
    setEditingPlan(newPlan);
    setPlanFormError('');
  };

  const handleSavePlanForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    const val = validatePlanInput(editingPlan);
    if (!val.valid) {
      setPlanFormError(val.errorBn || 'প্ল্যান তথ্য সঠিক নয়');
      return;
    }

    setIsSavingPlan(true);
    setPlanFormError('');
    try {
      await saveSubscriptionPlan(editingPlan);
      recordAudit({
        actionType: 'settings_updated',
        targetId: editingPlan.id,
        targetLabel: `Subscription Plan: ${editingPlan.nameBn}`,
        reason: 'Updated plan pricing and parameters',
        metadata: {
          monthlyBdt: editingPlan.pricing?.monthlyPriceBdt ?? editingPlan.priceBDT,
          yearlyBdt: editingPlan.pricing?.yearlyPriceBdt ?? editingPlan.priceBDT * 10,
          status: editingPlan.status,
        },
      });
      showToast(lang === 'bn' ? 'প্ল্যান সফলভাবে সংরক্ষিত হয়েছে।' : 'Plan saved successfully.');
      setEditingPlan(null);
    } catch (err) {
      setPlanFormError(err instanceof Error ? err.message : 'সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleDeletePlan = async (plan: SubscriptionPlan) => {
    if (['starter_free', 'pro', 'pro_vip'].includes(plan.id)) {
      showError(lang === 'bn' ? 'মূল ডিফল্ট প্ল্যানগুলো মুছে ফেলা যাবে না, আপনি এগুলো সম্পাদনা বা ড্রাফট করতে পারেন।' : 'Default core plans cannot be deleted.');
      return;
    }
    if (!window.confirm(`আপনি কি সত্যিই "${plan.nameBn}" প্ল্যানটি মুছে ফেলতে চান?`)) {
      return;
    }
    try {
      await deleteSubscriptionPlan(plan.id);
      recordAudit({
        actionType: 'settings_updated',
        targetId: plan.id,
        targetLabel: `Deleted Plan: ${plan.nameBn}`,
        reason: 'Plan archived/deleted by administrator',
      });
      showToast(lang === 'bn' ? 'প্ল্যান মুছে ফেলা হয়েছে।' : 'Plan deleted.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'প্ল্যান মোছা ব্যর্থ হয়েছে');
    }
  };

  // Feature Matrix Toggle & Save
  const [expandedMatrixModule, setExpandedMatrixModule] = useState<string | null>('salary');

  const handleMatrixCellChange = (
    planId: string,
    featureKey: FeatureKey,
    allowed: boolean,
    maxRecords: number
  ) => {
    setMatrixPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const currentMatrix = p.featureMatrix || {};
        const currentRule = (currentMatrix as any)[featureKey] || { allowed: true, maxRecords: -1, subFeatures: {} };
        const updatedRule = {
          ...currentRule,
          allowed,
          enabled: allowed,
          maxRecords,
        };
        const updatedFeatures = {
          ...(p.features || {}),
          [featureKey]: {
            ...((p.features || {})[featureKey] || { enabled: true }),
            enabled: allowed,
            maxRecords: maxRecords === -1 ? null : maxRecords,
          },
        };
        return {
          ...p,
          features: updatedFeatures as any,
          featureMatrix: {
            ...currentMatrix,
            [featureKey]: updatedRule,
          },
        };
      })
    );
  };

  const handleSubFeatureToggle = (
    planId: string,
    featureKey: FeatureKey,
    subFeatureKey: string,
    enabled: boolean
  ) => {
    setMatrixPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const currentMatrix = p.featureMatrix || {};
        const currentRule = (currentMatrix as any)[featureKey] || { allowed: true, maxRecords: -1, subFeatures: {} };
        const currentSubFeatures = currentRule.subFeatures || {};
        const updatedSubFeatures = {
          ...currentSubFeatures,
          [subFeatureKey]: enabled,
        };
        const updatedRule = {
          ...currentRule,
          subFeatures: updatedSubFeatures,
        };
        return {
          ...p,
          featureMatrix: {
            ...currentMatrix,
            [featureKey]: updatedRule,
          },
        };
      })
    );
  };

  const handleSaveFeatureMatrix = async () => {
    try {
      for (const p of matrixPlans) {
        await saveSubscriptionPlan(p);
      }
      recordAudit({
        actionType: 'settings_updated',
        targetId: 'feature_matrix',
        targetLabel: 'Feature Matrix Update',
        reason: 'Updated feature matrix allowances and quotas across plans',
      });
      showToast(lang === 'bn' ? 'ফিচার ম্যাট্রিক্স সফলভাবে সংরক্ষিত হয়েছে।' : 'Feature matrix saved successfully.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'ম্যাট্রিক্স সংরক্ষণ ব্যর্থ হয়েছে');
    }
  };

  // User Assignment Handler
  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = assignTargetUid.trim() || 'current';
    const reasonText = assignReason.trim() || 'অ্যাডমিন প্যানেল থেকে বরাদ্দ';

    setIsAssigning(true);
    try {
      const isFreeSelected = assignPlanId === 'starter_free';
      const parsedCustomDays =
        !isFreeSelected && assignCycle !== 'lifetime' && assignCustomDaysRemaining.trim() !== ''
          ? Math.max(0, parseInt(assignCustomDaysRemaining, 10))
          : null;

      await adminAssignUserPlan(target, {
        planId: assignPlanId,
        billingCycle: isFreeSelected ? 'lifetime' : assignCycle,
        reason: reasonText,
        customDaysRemaining:
          parsedCustomDays !== null && !Number.isNaN(parsedCustomDays) ? parsedCustomDays : null,
        isComplimentary: assignIsComplimentary,
      });

      recordAudit({
        actionType: 'user_updated',
        targetId: target,
        targetLabel: `Assigned Plan ${assignPlanId}`,
        reason: reasonText,
        metadata: {
          planId: assignPlanId,
          cycle: assignCycle,
          customDaysRemaining: parsedCustomDays,
          complimentary: assignIsComplimentary,
        },
      });

      showToast(
        isFreeSelected
          ? 'ইউজারের পেইড সাবস্ক্রিপশন সরিয়ে ফ্রি মোডে নেওয়া হয়েছে।'
          : `ইউজারকে প্ল্যান সফলভাবে বরাদ্দ করা হয়েছে${
              parsedCustomDays !== null ? ` (${toBengaliDigits(parsedCustomDays)} দিন বাকি)` : ''
            }।`
      );
      setAssignReason('');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'প্ল্যান বরাদ্দ ব্যর্থ হয়েছে');
    } finally {
      setIsAssigning(false);
    }
  };

  // Coupon Handlers
  const handleCreateNewCoupon = () => {
    setEditingCoupon({
      id: `coupon_${Date.now()}`,
      code: '',
      discountType: 'percentage',
      discountValue: 20,
      maxUses: 100,
      usedCount: 0,
      expiresAt: '2026-12-31',
      isActive: true,
      applicablePlanId: 'all',
      createdAt: new Date().toISOString(),
    });
    setCouponError('');
  };

  const handleSaveCouponForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    if (!editingCoupon.code.trim()) {
      setCouponError('কুপন কোড প্রদান করা আবশ্যক');
      return;
    }
    if (editingCoupon.discountValue <= 0) {
      setCouponError('ছাড়ের পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে');
      return;
    }
    setIsSavingCoupon(true);
    setCouponError('');
    try {
      await saveCoupon(editingCoupon);
      recordAudit({
        actionType: 'settings_updated',
        targetId: editingCoupon.id,
        targetLabel: `Coupon Code: ${editingCoupon.code}`,
        reason: 'Saved/Updated discount coupon code',
      });
      showToast(lang === 'bn' ? 'কুপন কোড সফলভাবে সংরক্ষিত হয়েছে।' : 'Coupon code saved.');
      setEditingCoupon(null);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'কুপন সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSavingCoupon(false);
    }
  };

  const handleDeleteCouponItem = async (c: CouponCode) => {
    if (!window.confirm(`আপনি কি সত্যিই "${c.code}" কুপনটি মুছে ফেলতে চান?`)) return;
    try {
      await deleteCoupon(c.id);
      showToast(lang === 'bn' ? 'কুপন মুছে ফেলা হয়েছে।' : 'Coupon deleted.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'কুপন মোছা ব্যর্থ হয়েছে');
    }
  };

  const getTierIcon = (tier: SubscriptionPlanTier) => {
    switch (tier) {
      case 'pro_vip':
        return <Crown className="w-4 h-4 text-amber-500" />;
      case 'pro':
        return <Sparkles className="w-4 h-4 text-emerald-600" />;
      default:
        return <Shield className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* MASTER ENABLE / DISABLE SWITCH BANNER + RENEWAL THRESHOLD RULE */}
      {/* ===================================================================== */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3.5 ${
        subscriptionConfig.enabled
          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
          : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-3 h-3 rounded-full ${
              subscriptionConfig.enabled ? 'bg-emerald-600 animate-ping' : 'bg-amber-500'
            }`} />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              মাস্টার সাবস্ক্রিপশন কন্ট্রোল (Master Switch)
            </h3>
            <span
              data-testid="admin-sub-master-status-badge"
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                subscriptionConfig.enabled
                  ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
                  : 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
              }`}
            >
              {subscriptionConfig.enabled ? 'সক্রিয় (ENABLED)' : 'বন্ধ (DISABLED)'}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              data-testid="admin-sub-master-toggle-btn"
              onClick={handleToggleMasterSwitch}
              className={`min-h-[42px] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                subscriptionConfig.enabled
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>
                {subscriptionConfig.enabled
                  ? 'সিস্টেম বন্ধ করুন'
                  : 'সিস্টেম চালু করুন'}
              </span>
            </button>
          </div>
        </div>

        {/* Admin Configurable Renewal Warning Threshold Rule */}
        <div className="pt-3 border-t border-emerald-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              রিনিউ নোটিশ রুল: মেয়াদ শেষ হওয়ার{' '}
              <strong className="text-emerald-700 dark:text-emerald-300">
                {toBengaliDigits(subscriptionConfig.renewalWarningDays ?? 5)} দিন
              </strong>{' '}
              বাকি থাকতে ব্যানার শো করবে (এর আগে শো করবে না)
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[3, 5, 7, 10].map((d) => {
              const isSelected = (subscriptionConfig.renewalWarningDays ?? 5) === d;
              return (
                <button
                  key={d}
                  type="button"
                  data-testid={`admin-warning-days-preset-${d}`}
                  onClick={() => handleSaveWarningDays(d)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50'
                  }`}
                >
                  {toBengaliDigits(d)} দিন
                </button>
              );
            })}
            <div className="flex items-center gap-1 ml-1">
              <input
                type="number"
                min={1}
                max={365}
                data-testid="admin-warning-days-input"
                value={warningDaysInput}
                onChange={(e) => setWarningDaysInput(parseInt(e.target.value, 10) || 1)}
                className="w-14 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-bold text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                data-testid="admin-warning-days-save-btn"
                onClick={() => handleSaveWarningDays(warningDaysInput)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-bold cursor-pointer"
              >
                সেট
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('plans')}
          className={`px-3.5 py-2 rounded-lg transition shrink-0 ${
            subTab === 'plans'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          প্ল্যান ও মূল্য তালিকা ({toBengaliDigits(subscriptionPlans.length)})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('matrix')}
          className={`px-3.5 py-2 rounded-lg transition shrink-0 ${
            subTab === 'matrix'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          ফিচার ও কোটা ম্যাট্রিক্স (12 Modules)
        </button>
        <button
          type="button"
          onClick={() => setSubTab('coupons')}
          className={`px-3.5 py-2 rounded-lg transition shrink-0 ${
            subTab === 'coupons'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          কুপন কোড ম্যানেজার ({toBengaliDigits(coupons.length)})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('requests')}
          className={`px-3.5 py-2 rounded-lg transition shrink-0 ${
            subTab === 'requests'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          পেমেন্ট ও রিনিউয়াল ট্র্যাকার
        </button>
        <button
          type="button"
          onClick={() => setSubTab('assign')}
          className={`px-3.5 py-2 rounded-lg transition shrink-0 ${
            subTab === 'assign'
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          ইউজার প্ল্যান বরাদ্দ ও গিফট গ্রান্ট
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: PLANS MANAGEMENT */}
      {/* ===================================================================== */}
      {subTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
              কনফিগার করা সাবস্ক্রিপশন প্ল্যানসমূহ
            </h4>
            <button
              type="button"
              onClick={handleAddNewPlan}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              নতুন প্ল্যান যোগ করুন
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subscriptionPlans.map((plan) => (
              <div
                key={plan.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {getTierIcon(plan.tier)}
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {plan.nameBn}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {plan.nameEn} ({plan.tier})
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      plan.status === 'published'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : plan.status === 'draft'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {plan.status === 'published' ? 'প্রকাশিত' : plan.status === 'draft' ? 'ড্রাফট' : 'আর্কাইভ'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {plan.descriptionBn}
                  </p>

                  <div className="py-2 border-y border-slate-100 dark:border-slate-800">
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {formatBdtPrice(plan.pricing.monthlyPriceBdt)}
                      {!plan.pricing.isFree && <span className="text-xs font-normal text-slate-400"> / মাস</span>}
                    </div>
                    {!plan.pricing.isFree && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        বার্ষিক: {formatBdtPrice(plan.pricing.yearlyPriceBdt)} / বছর
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500">সুবিধাসমূহ:</span>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                      {plan.benefitsBn?.slice(0, 3).map((b, i) => (
                        <li key={i} className="flex items-center gap-1.5 truncate">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPreviewPlan(plan)}
                    className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    প্রিভিউ
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditPlan(plan)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      সম্পাদনা
                    </button>
                    {!['starter_free', 'pro', 'pro_vip'].includes(plan.id) && (
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(plan)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: FEATURE MATRIX EDITOR */}
      {/* ===================================================================== */}
      {subTab === 'matrix' && (
        <div className="space-y-4">
          {/* Section Header & Save Action */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>১২টি মডিউলের ফিচার ম্যাট্রিক্স ও পারমিশন কন্ট্রোল</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                প্রতিটি প্ল্যান টায়ারের জন্য মডিউলের রেকর্ড সীমা এবং সাব-ফিচার এক্সেস আলাদাভাবে সেট করুন
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveFeatureMatrix}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ম্যাট্রিক্স পরিবর্তন সংরক্ষণ করুন</span>
            </button>
          </div>

          {/* Module Cards Grid */}
          <div className="space-y-3">
            {APP_FEATURE_CATALOG.map((feat) => {
              const isExpanded = expandedMatrixModule === feat.key;

              return (
                <div
                  key={feat.key}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl transition-all shadow-2xs overflow-hidden ${
                    isExpanded
                      ? 'border-emerald-500/60 dark:border-emerald-600/60 ring-1 ring-emerald-500/20'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Module Header Row */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200/80 dark:border-emerald-800">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {feat.nameBn}
                          </h5>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {feat.subFeatures.length}টি সাব-ফিচার
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {feat.descriptionBn}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMatrixModule((prev) => (prev === feat.key ? null : feat.key))
                        }
                        className={`min-h-[34px] px-3.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer border ${
                          isExpanded
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{isExpanded ? 'সাব-ফিচার কমান' : 'সাব-ফিচার এডিট'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* 3 Tier Master Controls Grid */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    {(
                      [
                        { key: 'starter_free', title: 'Starter Free', color: 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40' },
                        { key: 'pro', title: 'Pro Plan', color: 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/30' },
                        { key: 'pro_vip', title: 'Pro VIP', color: 'border-amber-200 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/30' },
                      ] as const
                    ).map((tierItem) => {
                      const targetPlan = matrixPlans.find((p) => p.tier === tierItem.key) || matrixPlans[0];
                      const rule = (targetPlan?.featureMatrix as any)?.[feat.key] || {
                        allowed: true,
                        enabled: true,
                        maxRecords: -1,
                        subFeatures: {},
                      };
                      const isAllowed = Boolean(rule.allowed ?? rule.enabled ?? true);

                      return (
                        <div
                          key={tierItem.key}
                          className={`p-3 rounded-xl border space-y-2.5 ${tierItem.color}`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {tierItem.title}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                isAllowed
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {isAllowed ? 'চালু' : 'বন্ধ'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isAllowed}
                                onChange={(e) =>
                                  handleMatrixCellChange(
                                    targetPlan.id,
                                    feat.key,
                                    e.target.checked,
                                    rule.maxRecords ?? -1
                                  )
                                }
                                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                              />
                              <span>মডিউল সক্রিয়</span>
                            </label>

                            {isAllowed && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-500">সীমা:</span>
                                <input
                                  type="number"
                                  aria-label={`${feat.nameBn} limit for ${tierItem.title}`}
                                  value={rule.maxRecords ?? -1}
                                  onChange={(e) =>
                                    handleMatrixCellChange(
                                      targetPlan.id,
                                      feat.key,
                                      true,
                                      parseInt(e.target.value, 10) || 0
                                    )
                                  }
                                  className="w-16 min-h-[30px] px-2 py-0.5 text-center font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                  title="-1 = আনলিমিটেড"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Expanded Detailed Sub-Features Panel */}
                  {isExpanded && feat.subFeatures && feat.subFeatures.length > 0 && (
                    <div className="p-4 border-t border-emerald-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 dark:border-slate-800 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                        <span>“{feat.nameBn}” মডিউলের বিস্তারিত পারমিশন রুলস:</span>
                        <span className="text-[11px] font-normal text-slate-500">প্রতিটি প্ল্যান টায়ারের জন্য আলাদা অন/অফ করুন</span>
                      </div>

                      <div className="space-y-1.5">
                        {feat.subFeatures.map((sub) => (
                          <div
                            key={sub.key}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-bold text-slate-900 dark:text-white min-w-0 sm:w-1/2 truncate">
                              • {sub.nameBn}
                            </span>

                            <div className="grid grid-cols-3 gap-1.5 sm:w-1/2 shrink-0">
                              {(['starter_free', 'pro', 'pro_vip'] as const).map((tierKey) => {
                                const targetPlan = matrixPlans.find((p) => p.tier === tierKey) || matrixPlans[0];
                                const rule = (targetPlan?.featureMatrix as any)?.[feat.key] || {};
                                const subState = Boolean(rule?.subFeatures?.[sub.key] ?? (tierKey !== 'starter_free'));

                                return (
                                  <button
                                    key={tierKey}
                                    type="button"
                                    onClick={() =>
                                      handleSubFeatureToggle(
                                        targetPlan.id,
                                        feat.key,
                                        sub.key,
                                        !subState
                                      )
                                    }
                                    className={`py-1 px-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer border ${
                                      subState
                                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    <span>{tierKey === 'starter_free' ? 'Free' : tierKey === 'pro' ? 'Pro' : 'VIP'}</span>
                                    <span>{subState ? '✓' : '✕'}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: USER PLAN ASSIGNMENT */}
      {/* ===================================================================== */}
      {subTab === 'assign' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 max-w-xl">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-600" />
            ব্যবহারকারীকে প্ল্যান বরাদ্দ বা মেয়াদ নির্ধারণ
          </h4>

          {/* Quick 1-Tap Assignment Presets for Current User */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              বর্তমান ইউজারের মেয়াদ কুইক সেট করুন:
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                data-testid="quick-assign-no-sub"
                onClick={() =>
                  adminAssignUserPlan('current', {
                    planId: 'starter_free',
                    billingCycle: 'lifetime',
                    reason: 'সাবস্ক্রিপশন নেই (ফ্রি মোড)',
                  }).then(() => showToast('ইউজার এখন সাবস্ক্রিপশন ছাড়া (ফ্রি) অবস্থায় আছেন।'))
                }
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                সাবস্ক্রিপশন নেই (ফ্রি)
              </button>
              <button
                type="button"
                data-testid="quick-assign-20d"
                onClick={() =>
                  adminAssignUserPlan('current', {
                    planId: 'pro',
                    billingCycle: 'monthly',
                    customDaysRemaining: 20,
                    reason: '৩০ দিনের প্ল্যানে ১০ দিন ব্যবহৃত (২০ দিন বাকি)',
                  }).then(() => showToast('ইউজারকে ২০ দিন বাকি থাকা সাবস্ক্রিপশন দেওয়া হয়েছে (ব্যানার হাইড থাকবে)।'))
                }
                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 cursor-pointer"
              >
                ২০ দিন বাকি (১০ দিন ব্যবহৃত)
              </button>
              <button
                type="button"
                data-testid="quick-assign-5d"
                onClick={() =>
                  adminAssignUserPlan('current', {
                    planId: 'pro',
                    billingCycle: 'monthly',
                    customDaysRemaining: 5,
                    reason: '৩০ দিনের প্ল্যানে ২৫ দিন ব্যবহৃত (৫ দিন বাকি)',
                  }).then(() => showToast('ইউজারকে ৫ দিন বাকি থাকা সাবস্ক্রিপশন দেওয়া হয়েছে (রিনিউ ব্যানার শো করবে)।'))
                }
                className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-100 cursor-pointer"
              >
                ৫ দিন বাকি (২৫ দিন ব্যবহৃত)
              </button>
              <button
                type="button"
                data-testid="quick-assign-30d"
                onClick={() =>
                  adminAssignUserPlan('current', {
                    planId: 'pro',
                    billingCycle: 'monthly',
                    customDaysRemaining: 30,
                    reason: 'নতুন ১ মাসের (৩০ দিন) সাবস্ক্রিপশন',
                  }).then(() => showToast('ইউজারকে নতুন ৩০ দিনের সাবস্ক্রিপশন দেওয়া হয়েছে।'))
                }
                className="px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-300 dark:border-teal-700 font-bold text-teal-800 dark:text-teal-200 hover:bg-teal-100 cursor-pointer"
              >
                নতুন ১ মাস (৩০ দিন বাকি)
              </button>
            </div>
          </div>

          <form onSubmit={handleAssignUser} className="space-y-3.5 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                টার্গেট ইউজারের UID অথবা ইমেইল (বর্তমান ইউজারের জন্য &apos;current&apos;) *
              </label>
              <input
                type="text"
                required
                placeholder="current অথবা worker@gmail.com"
                value={assignTargetUid}
                onChange={(e) => setAssignTargetUid(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  প্ল্যান নির্বাচন করুন
                </label>
                <select
                  value={assignPlanId}
                  onChange={(e) => setAssignPlanId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
                >
                  {subscriptionPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameBn} ({formatBdtPrice(p.pricing.monthlyPriceBdt)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  মেয়াদকাল (Duration)
                </label>
                <select
                  value={assignCycle}
                  onChange={(e) => {
                    const nextCycle = e.target.value as any;
                    setAssignCycle(nextCycle);
                    if (nextCycle === 'monthly') setAssignCustomDaysRemaining('30');
                    if (nextCycle === 'yearly') setAssignCustomDaysRemaining('365');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
                >
                  <option value="monthly">১ মাস (Monthly)</option>
                  <option value="yearly">১ বছর (Yearly)</option>
                  <option value="lifetime">আজীবন (Lifetime)</option>
                </select>
              </div>

              {assignPlanId !== 'starter_free' && assignCycle !== 'lifetime' && (
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    কতদিন মেয়াদ বাকি আছে
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="3650"
                    value={assignCustomDaysRemaining}
                    onChange={(e) => setAssignCustomDaysRemaining(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold"
                  />
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={assignIsComplimentary}
                  onChange={(e) => setAssignIsComplimentary(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>কমপ্লিমেন্টারি গ্রান্ট / বিশেষ উপহার (৳০ টাকা ধার্য)</span>
              </label>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                বরাদ্দের কারণ (Audit Reason)
              </label>
              <input
                type="text"
                placeholder="e.g. পোশাক কর্মী ইউনিয়ন প্রতিনিধি বা সেরা ব্যবহারকারী"
                value={assignReason}
                onChange={(e) => setAssignReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isAssigning}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isAssigning ? 'বরাদ্দ করা হচ্ছে...' : 'প্ল্যান নিশ্চিত করুন'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB: COUPON CODES MANAGER */}
      {/* ===================================================================== */}
      {subTab === 'coupons' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-600" />
              কুপন কোড ও ডিসকাউন্ট তালিকা
            </h4>
            <button
              type="button"
              onClick={handleCreateNewCoupon}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              নতুন কুপন কোড তৈরি করুন
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {coupons.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-extrabold px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 tracking-wider">
                      {c.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        c.isActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {c.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </span>
                  </div>

                  <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                    {c.discountType === 'percentage'
                      ? `${toBengaliDigits(c.discountValue)}% ছাড়`
                      : `৳${toBengaliDigits(c.discountValue)} ছাড়`}
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      প্রযোজ্য প্ল্যান:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {c.applicablePlanId === 'all'
                          ? 'সকল প্ল্যান'
                          : getBengaliPlanName(c.applicablePlanId as any)}
                      </strong>
                    </div>
                    <div>
                      ব্যবহার করা হয়েছে:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {toBengaliDigits(c.usedCount)} / {c.maxUses ? toBengaliDigits(c.maxUses) : 'সীমাহীন'} বার
                      </strong>
                    </div>
                    {c.expiresAt && (
                      <div>
                        মেয়াদ শেষ: <strong className="text-slate-800 dark:text-slate-200">{c.expiresAt}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCoupon({ ...c });
                      setCouponError('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    সম্পাদনা
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCouponItem(c)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB: PAYMENT & RENEWAL TRACKER QUEUE */}
      {/* ===================================================================== */}
      {subTab === 'requests' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              পেমেন্ট ও রিনিউয়াল ভেরিফিকেশন কিউ
            </h4>
          </div>

          {userSubscription?.pendingRequest && userSubscription.pendingRequest.status === 'pending' ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      ইউজার: {userSubscription.userDisplayName || userSubscription.userId}
                    </span>
                    {userSubscription.pendingRequest.isRenewal ? (
                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        রিনিউয়াল অনুরোধ
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        নতুন সাবস্ক্রিপশন
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <div>
                      প্ল্যান: <strong className="text-emerald-600">{getBengaliPlanName(userSubscription.pendingRequest.planId as any)}</strong> ({userSubscription.pendingRequest.billingCycle === 'yearly' ? 'বার্ষিক' : 'মাসিক'})
                    </div>
                    <div className="flex items-center gap-2">
                      <span>মূল্য: ৳{toBengaliDigits(userSubscription.pendingRequest.amountBdt)}</span>
                      {userSubscription.pendingRequest.discountAmountBdt ? (
                        <span className="text-emerald-600 font-bold">
                          (কুপন ছাড় ৳{toBengaliDigits(userSubscription.pendingRequest.discountAmountBdt)} → পরিশোধনীয়: ৳{toBengaliDigits(userSubscription.pendingRequest.finalAmountBdt ?? 0)})
                        </span>
                      ) : null}
                    </div>
                    {userSubscription.pendingRequest.couponCode && (
                      <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                        ব্যবহৃত কুপন: {userSubscription.pendingRequest.couponCode}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                    TrxID: {userSubscription.pendingRequest.transactionId}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    প্রেরক: {userSubscription.pendingRequest.senderPhone} ({userSubscription.pendingRequest.paymentMethod.toUpperCase()})
                  </div>
                </div>
              </div>

              {userSubscription.pendingRequest.notes && (
                <div className="text-xs text-slate-500 italic bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                  নোট: {userSubscription.pendingRequest.notes}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => adminProcessPaymentRequest(userSubscription.userId, false, 'TrxID অমিল')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 cursor-pointer"
                >
                  প্রত্যাখ্যান করুন
                </button>
                <button
                  type="button"
                  onClick={() => adminProcessPaymentRequest(userSubscription.userId, true, 'পেমেন্ট ভেরিফাইড')}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                >
                  অনুমোদন ও প্ল্যান চালু করুন
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              বর্তমানে কোনো নতুন পেন্ডিং পেমেন্ট বা রিনিউয়াল রিকোয়েস্ট নেই।
            </div>
          )}

          {/* Payment History Log */}
          {userSubscription?.paymentHistory && userSubscription.paymentHistory.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                পূর্ববর্তী পেমেন্ট ও রিনিউয়াল ইতিহাস ({toBengaliDigits(userSubscription.paymentHistory.length)})
              </h5>
              <div className="space-y-1.5">
                {userSubscription.paymentHistory.map((historyItem) => (
                  <div
                    key={historyItem.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {getBengaliPlanName(historyItem.planId as any)} ({historyItem.billingCycle === 'yearly' ? 'বার্ষিক' : 'মাসিক'})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        পরিমাণ: ৳{toBengaliDigits(historyItem.finalAmountBdt ?? historyItem.amountBdt)} | TrxID: {historyItem.transactionId}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        historyItem.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {historyItem.status === 'approved' ? 'অনুমোদিত' : 'বাতিল'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* EDIT / CREATE PLAN MODAL */}
      {/* ===================================================================== */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                প্ল্যান সম্পাদনা: {editingPlan.nameBn}
              </h4>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlanForm} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    প্ল্যানের নাম (বাংলা) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPlan.nameBn}
                    onChange={(e) => setEditingPlan({ ...editingPlan, nameBn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Plan Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPlan.nameEn}
                    onChange={(e) => setEditingPlan({ ...editingPlan, nameEn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  প্ল্যানের বিবরণ (বাংলা) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={editingPlan.descriptionBn}
                  onChange={(e) => setEditingPlan({ ...editingPlan, descriptionBn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={editingPlan.pricing.isFree}
                    onChange={(e) => {
                      const curPricing = editingPlan.pricing || { isFree: false, monthlyPriceBdt: 50, yearlyPriceBdt: 500, currency: 'BDT' };
                      setEditingPlan({
                        ...editingPlan,
                        pricing: {
                          currency: 'BDT',
                          isFree: e.target.checked,
                          monthlyPriceBdt: e.target.checked ? 0 : curPricing.monthlyPriceBdt || 50,
                          yearlyPriceBdt: e.target.checked ? 0 : curPricing.yearlyPriceBdt || 500,
                        },
                      });
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>সম্পূর্ণ ফ্রি প্ল্যান (৳০ টাকা)</span>
                </label>

                {!editingPlan.pricing?.isFree && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        মাসিক মূল্য (BDT ৳) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={editingPlan.pricing?.monthlyPriceBdt ?? 0}
                        onChange={(e) => {
                          const curPricing = editingPlan.pricing || { isFree: false, monthlyPriceBdt: 0, yearlyPriceBdt: 0, currency: 'BDT' };
                          setEditingPlan({
                            ...editingPlan,
                            pricing: {
                              ...curPricing,
                              monthlyPriceBdt: parseInt(e.target.value, 10) || 0,
                            },
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        বার্ষিক মূল্য (BDT ৳) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={editingPlan.pricing?.yearlyPriceBdt ?? 0}
                        onChange={(e) => {
                          const curPricing = editingPlan.pricing || { isFree: false, monthlyPriceBdt: 0, yearlyPriceBdt: 0, currency: 'BDT' };
                          setEditingPlan({
                            ...editingPlan,
                            pricing: {
                              ...curPricing,
                              yearlyPriceBdt: parseInt(e.target.value, 10) || 0,
                            },
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    স্ট্যাটাস
                  </label>
                  <select
                    value={editingPlan.status}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="published">প্রকাশিত (Published)</option>
                    <option value="draft">ড্রাফট (Draft)</option>
                    <option value="archived">আর্কাইভড (Archived)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    ব্যাজ টেক্সট (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. জনপ্রিয় / সেরা চয়েস"
                    value={editingPlan.badgeTextBn || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, badgeTextBn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Benefits Editor */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  সুবিধাসমূহ (Benefits):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="নতুন সুবিধা লিখুন..."
                    value={newBenefitInput}
                    onChange={(e) => setNewBenefitInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newBenefitInput.trim()) return;
                      setEditingPlan({
                        ...editingPlan,
                        benefitsBn: [...(editingPlan.benefitsBn || []), newBenefitInput.trim()],
                      });
                      setNewBenefitInput('');
                    }}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 font-bold rounded-lg hover:bg-slate-300"
                  >
                    যোগ করুন
                  </button>
                </div>
                <div className="space-y-1 pt-1 max-h-24 overflow-y-auto">
                  {editingPlan.benefitsBn?.map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded text-[11px]">
                      <span>{b}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingPlan({
                            ...editingPlan,
                            benefitsBn: editingPlan.benefitsBn.filter((_, idx) => idx !== i),
                          })
                        }
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {planFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  {planFormError}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSavingPlan ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LIVE PLAN PREVIEW MODAL */}
      {/* ===================================================================== */}
      {previewPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase">
                শ্রমিক প্রিভিউ ভিউ
              </span>
              <button
                type="button"
                onClick={() => setPreviewPlan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-400 dark:border-emerald-600 shadow-sm space-y-3">
              <div className="flex items-center gap-1.5">
                {getTierIcon(previewPlan.tier)}
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {previewPlan.nameBn}
                </h4>
              </div>
              <p className="text-xs text-slate-500">{previewPlan.descriptionBn}</p>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-50">
                {formatBdtPrice(previewPlan.pricing.monthlyPriceBdt)}
                {!previewPlan.pricing.isFree && <span className="text-xs font-normal text-slate-400"> / মাস</span>}
              </div>
              <div className="space-y-1 text-xs">
                {previewPlan.benefitsBn?.map((b, i) => (
                  <div key={i} className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPreviewPlan(null)}
              className="w-full py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}
      {/* EDIT / CREATE COUPON MODAL */}
      {editingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                কুপন কোড সম্পাদনা / তৈরি
              </h4>
              <button
                type="button"
                onClick={() => setEditingCoupon(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCouponForm} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  কুপন কোড (ইংরেজি বড় হাতের অক্ষর) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SHROMIK50, EID2026"
                  value={editingCoupon.code}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    ছাড়ের ধরন (Type)
                  </label>
                  <select
                    value={editingCoupon.discountType}
                    onChange={(e) =>
                      setEditingCoupon({ ...editingCoupon, discountType: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100"
                  >
                    <option value="percentage">শতকরা (%)</option>
                    <option value="fixed_bdt">নির্দিষ্ট BDT (৳)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    ছাড়ের পরিমাণ *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingCoupon.discountValue}
                    onChange={(e) =>
                      setEditingCoupon({ ...editingCoupon, discountValue: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    প্রযোজ্য প্ল্যান
                  </label>
                  <select
                    value={editingCoupon.applicablePlanId || 'all'}
                    onChange={(e) =>
                      setEditingCoupon({ ...editingCoupon, applicablePlanId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-100"
                  >
                    <option value="all">সকল প্ল্যান</option>
                    {subscriptionPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    সর্বোচ্চ ব্যবহারের সীমা
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 100 (অথবা খালি রাখুন)"
                    value={editingCoupon.maxUses ?? ''}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        maxUses: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    মেয়াদ শেষের তারিখ
                  </label>
                  <input
                    type="date"
                    value={editingCoupon.expiresAt || ''}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    স্ট্যাটাস
                  </label>
                  <select
                    value={editingCoupon.isActive ? 'active' : 'inactive'}
                    onChange={(e) =>
                      setEditingCoupon({ ...editingCoupon, isActive: e.target.value === 'active' })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                  >
                    <option value="active">সক্রিয় (Active)</option>
                    <option value="inactive">নিষ্ক্রিয় (Inactive)</option>
                  </select>
                </div>
              </div>

              {couponError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs">
                  {couponError}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCoupon(null)}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingCoupon}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSavingCoupon ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
