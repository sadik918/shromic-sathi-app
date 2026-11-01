import React, { useState } from 'react';
import {
  Shield,
  Crown,
  Sparkles,
  Check,
  X,
  CreditCard,
  Clock,
  AlertCircle,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Send,
  CheckCircle2,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  APP_FEATURE_CATALOG,
  filterPublishedPlans,
  formatBdtPrice,
  getBengaliPlanName,
  toBengaliDigits,
  type SubscriptionPlan,
  type SubscriptionPlanTier,
} from '../utils/subscriptionLogic';

interface UserSubscriptionViewProps {
  onBack?: () => void;
  openRenewalTrigger?: number;
}

export const UserSubscriptionView: React.FC<UserSubscriptionViewProps> = ({
  onBack,
  openRenewalTrigger = 0,
}) => {
  const {
    subscriptionConfig,
    subscriptionPlans,
    userSubscription,
    activePlan,
    isSubscriptionSystemEnabled,
    requestPlanUpgrade,
    validateCoupon,
    salaryRecords,
    overtime,
    documents,
    contacts,
    isReadOnlyDemo,
    triggerReadOnlyBlock,
  } = useData();

  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<SubscriptionPlan | null>(null);
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'bank'>('bkash');
  const [trxId, setTrxId] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // Coupon state inside Checkout Modal
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponInfo, setAppliedCouponInfo] = useState<{
    code: string;
    discountAmountBdt: number;
    finalAmountBdt: number;
  } | null>(null);
  const [couponMsg, setCouponMsg] = useState('');

  const publishedPlans = filterPublishedPlans(subscriptionPlans);

  // Calculate current usage counts for quick metrics
  const salaryCount = salaryRecords?.length || 0;
  const overtimeCount = overtime?.length || 0;
  const vaultCount = documents?.length || 0;
  const contactCount = contacts?.length || 0;

  const getTierRank = (tier: SubscriptionPlanTier) => {
    switch (tier) {
      case 'pro_vip':
        return 3;
      case 'pro':
        return 2;
      default:
        return 1;
    }
  };

  const handleOpenUpgradeModal = (plan: SubscriptionPlan, isRenewal = false) => {
    setSelectedPlanForUpgrade(plan);
    setIsRenewalMode(isRenewal);
    setSelectedBillingCycle('monthly');
    setTrxId('');
    setSenderPhone('');
    setNotes('');
    setFormError('');
    setSubmitSuccess(false);
    setCouponInput('');
    setAppliedCouponInfo(null);
    setCouponMsg('');
  };

  React.useEffect(() => {
    if (openRenewalTrigger > 0 && activePlan && !activePlan.pricing.isFree) {
      handleOpenUpgradeModal(activePlan, true);
    }
  }, [openRenewalTrigger, activePlan]);

  const handleCloseUpgradeModal = () => {
    setSelectedPlanForUpgrade(null);
    setSubmitSuccess(false);
    setFormError('');
    setCouponInput('');
    setAppliedCouponInfo(null);
    setCouponMsg('');
  };

  const handleApplyCoupon = () => {
    if (!selectedPlanForUpgrade) return;
    const basePrice =
      selectedBillingCycle === 'yearly'
        ? selectedPlanForUpgrade.pricing.yearlyPriceBdt
        : selectedPlanForUpgrade.pricing.monthlyPriceBdt;

    const res = validateCoupon(couponInput, selectedPlanForUpgrade.id, basePrice);
    if (!res.valid) {
      setCouponMsg(res.errorBn || 'অবৈধ কুপন কোড');
      setAppliedCouponInfo(null);
    } else {
      setAppliedCouponInfo({
        code: couponInput.trim().toUpperCase(),
        discountAmountBdt: res.discountAmountBdt,
        finalAmountBdt: res.finalAmountBdt,
      });
      setCouponMsg(`কুপন প্রয়োগ সফল! ৳${toBengaliDigits(res.discountAmountBdt)} ছাড় পেয়েছেন।`);
    }
  };

  const handleSubmitUpgradeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForUpgrade) return;

    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }

    if (!senderPhone.trim()) {
      setFormError('অনুগ্রহ করে যে নাম্বার থেকে টাকা পাঠিয়েছেন তা লিখুন');
      return;
    }
    if (!trxId.trim()) {
      setFormError('লেনদেনের ট্রানজেকশন আইডি (TrxID) লিখুন');
      return;
    }

    const basePrice =
      selectedBillingCycle === 'yearly'
        ? selectedPlanForUpgrade.pricing.yearlyPriceBdt
        : selectedPlanForUpgrade.pricing.monthlyPriceBdt;

    const discountAmt = appliedCouponInfo?.discountAmountBdt || 0;
    const finalAmt = appliedCouponInfo?.finalAmountBdt ?? basePrice;

    setIsSubmitting(true);
    setFormError('');
    try {
      await requestPlanUpgrade({
        planId: selectedPlanForUpgrade.id,
        billingCycle: selectedBillingCycle,
        paymentMethod,
        transactionId: trxId.trim(),
        senderPhone: senderPhone.trim(),
        couponCode: appliedCouponInfo?.code,
        discountAmountBdt: discountAmt,
        finalAmountBdt: finalAmt,
        isRenewal: isRenewalMode,
        notes: notes.trim(),
      });
      setSubmitSuccess(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'অনুরোধ পাঠাতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTierIcon = (tier: SubscriptionPlanTier) => {
    switch (tier) {
      case 'pro_vip':
        return <Crown className="w-5 h-5 text-amber-500" />;
      case 'pro':
        return <Sparkles className="w-5 h-5 text-emerald-600" />;
      default:
        return <Shield className="w-5 h-5 text-slate-500" />;
    }
  };

  const pendingRequest = userSubscription?.pendingRequest;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" />
            সাবস্ক্রিপশন ও প্ল্যান
          </h2>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            ফিরে যান
          </button>
        )}
      </div>

      {/* Master Switch Status Banner (if system is disabled) */}
      {!isSubscriptionSystemEnabled && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200">
            <span className="font-bold">আনলিমিটেড ফ্রি অ্যাক্সেস সক্রিয়:</span> বর্তমানে সাবস্ক্রিপশন সিস্টেম উন্মুক্ত অবস্থায় আছে। আপনি অ্যাপের সব ফিচার কোনো বাধা বা সীমা ছাড়াই সম্পূর্ণ বিনামূল্যে ব্যবহার করতে পারছেন।
          </div>
        </div>
      )}

      {/* Pending Payment Notice (if any) */}
      {pendingRequest && pendingRequest.status === 'pending' && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 space-y-1">
            <div className="font-bold flex items-center gap-2">
              পেমেন্ট ভেরিফিকেশন অপেক্ষমান
              <span className="px-2 py-0.5 text-[11px] rounded bg-amber-200/80 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                যাচাই চলছে
              </span>
            </div>
            <p>
              আপনার <span className="font-semibold">{getBengaliPlanName(pendingRequest.planId as SubscriptionPlanTier)}</span> আপগ্রেড অনুরোধটি সুপার অ্যাডমিন পর্যালোচনা করছেন।
            </p>
            <div className="text-[11px] text-amber-700 dark:text-amber-300">
              মেথড: {pendingRequest.paymentMethod.toUpperCase()} | নম্বর: {pendingRequest.senderPhone} | TrxID: {pendingRequest.transactionId}
            </div>
          </div>
        </div>
      )}

      {/* Current Active Plan Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              বর্তমান সক্রিয় প্ল্যান
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
                {activePlan.nameBn}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                {getTierIcon(activePlan.tier)}
                {userSubscription?.isComplimentary ? 'বিশেষ উপহার' : 'সক্রিয়'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activePlan.descriptionBn}
            </p>
          </div>

          <div className="text-right">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatBdtPrice(
                userSubscription?.billingCycle === 'yearly'
                  ? activePlan.pricing.yearlyPriceBdt
                  : activePlan.pricing.monthlyPriceBdt
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {activePlan.pricing.isFree
                ? 'আজীবন ফ্রি'
                : userSubscription?.billingCycle === 'yearly'
                ? 'প্রতি বছর'
                : 'প্রতি মাস'}
            </span>
          </div>
        </div>

        {/* Expiration or Complimentary badge */}
        {isSubscriptionSystemEnabled && !activePlan.pricing.isFree && userSubscription?.expiresAt && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>
              মেয়াদ উত্তীর্ণের তারিখ: <strong className="text-slate-700 dark:text-slate-200">{userSubscription.expiresAt.slice(0, 10)}</strong>
            </span>
          </div>
        )}

        {/* Quick Usage Quotas Summary */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            ব্যবহারের সারাংশ ও কোটা
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">বেতন এন্ট্রি</span>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {toBengaliDigits(salaryCount)}
                <span className="text-xs font-normal text-slate-400">
                  {' '}/ {activePlan.featureMatrix?.salary?.maxRecords === -1 ? 'সীমাহীন' : toBengaliDigits(activePlan.featureMatrix?.salary?.maxRecords ?? 'সীমাহীন')}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">ওভারটাইম হিসাব</span>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {toBengaliDigits(overtimeCount)}
                <span className="text-xs font-normal text-slate-400">
                  {' '}/ {activePlan.featureMatrix?.overtime?.maxRecords === -1 ? 'সীমাহীন' : toBengaliDigits(activePlan.featureMatrix?.overtime?.maxRecords ?? 'সীমাহীন')}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">ডকুমেন্ট ভল্ট</span>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {toBengaliDigits(vaultCount)}
                <span className="text-xs font-normal text-slate-400">
                  {' '}/ {activePlan.featureMatrix?.vault?.maxRecords === -1 ? 'সীমাহীন' : toBengaliDigits(activePlan.featureMatrix?.vault?.maxRecords ?? 'সীমাহীন')}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">কন্টাক্ট সংরক্ষণ</span>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {toBengaliDigits(contactCount)}
                <span className="text-xs font-normal text-slate-400">
                  {' '}/ {activePlan.featureMatrix?.contacts?.maxRecords === -1 ? 'সীমাহীন' : toBengaliDigits(activePlan.featureMatrix?.contacts?.maxRecords ?? 'সীমাহীন')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Available Plans Comparison Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
            উপলব্ধ সাবস্ক্রিপশন প্ল্যানসমূহ
          </h3>
          <span className="text-xs text-slate-500">
            {toBengaliDigits(publishedPlans.length)}টি প্ল্যান সক্রিয়
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {publishedPlans.map((plan) => {
            const isCurrent = activePlan.id === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between p-5 rounded-2xl border transition duration-200 ${
                  isCurrent
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-600 shadow-sm ring-1 ring-emerald-400/50'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                }`}
              >
                {/* Popular or Recommended Badge */}
                {plan.badgeTextBn && (
                  <div className="absolute -top-3 left-4 px-2.5 py-0.5 bg-emerald-600 text-white text-[11px] font-bold rounded-full shadow-sm">
                    {plan.badgeTextBn}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Plan Title & Tier */}
                  <div className="flex items-start justify-between pt-1">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {getTierIcon(plan.tier)}
                        <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                          {plan.nameBn}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {plan.descriptionBn}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="py-2 border-y border-slate-100 dark:border-slate-800">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-slate-50">
                        {formatBdtPrice(plan.pricing.monthlyPriceBdt)}
                      </span>
                      {!plan.pricing.isFree && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          / মাস
                        </span>
                      )}
                    </div>
                    {!plan.pricing.isFree && plan.pricing.yearlyPriceBdt > 0 && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        বার্ষিক প্ল্যান: {formatBdtPrice(plan.pricing.yearlyPriceBdt)} / বছর
                      </div>
                    )}
                  </div>

                  {/* Highlights / Benefits */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      প্ল্যানের সুবিধাসমূহ:
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      {plan.benefitsBn?.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Limitations (if free) */}
                    {plan.limitationsBn && plan.limitationsBn.length > 0 && (
                      <div className="pt-2">
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">
                          সীমাবদ্ধতা:
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-400">
                          {plan.limitationsBn.map((limit, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <X className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span>{limit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action / Upgrade / Renewal Button */}
                <div className="pt-5 mt-4">
                  {(() => {
                    const activeRank = getTierRank(activePlan.tier);
                    const targetRank = getTierRank(plan.tier);

                    // If plan is current active plan
                    if (isCurrent) {
                      if (plan.pricing.isFree) {
                        return (
                          <button
                            disabled
                            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 cursor-default flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            বর্তমান সক্রিয় প্ল্যান (ফ্রি)
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={() => handleOpenUpgradeModal(plan, true)}
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          বর্তমান প্ল্যান রিনিউ করুন
                        </button>
                      );
                    }

                    // If active user is on a higher tier, lower tiers cannot be re-purchased
                    if (activeRank > targetRank || plan.pricing.isFree) {
                      return (
                        <button
                          disabled
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed text-center"
                          title="পূর্বে ব্যবহার করা প্ল্যান / বর্তমান প্ল্যানের নিচের টায়ার কেনা যাবে না"
                        >
                          নিম্নমানের প্ল্যান নেওয়া যাবে না
                        </button>
                      );
                    }

                    // Higher tier -> Upgrade!
                    return (
                      <button
                        onClick={() => handleOpenUpgradeModal(plan, false)}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        আপগ্রেড করুন
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Matrix Breakdown Cards */}
      <div className="space-y-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>১২টি মডিউলের বিস্তারিত সুবিধা ও পারমিশন তুলনা</span>
          </h3>
        </div>

        <div className="space-y-3">
          {APP_FEATURE_CATALOG.map((feat) => {
            const starterPlan = publishedPlans.find((p) => p.tier === 'starter_free');
            const proPlan = publishedPlans.find((p) => p.tier === 'pro');
            const vipPlan = publishedPlans.find((p) => p.tier === 'pro_vip');

            const starterRule = starterPlan?.featureMatrix?.[feat.key];
            const proRule = proPlan?.featureMatrix?.[feat.key];
            const vipRule = vipPlan?.featureMatrix?.[feat.key];

            const formatQuotaBadge = (rule: any, tierName: string) => {
              if (!rule || !rule.allowed) {
                return (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    {tierName}: বন্ধ ✕
                  </span>
                );
              }
              if (rule.maxRecords === -1) {
                return (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {tierName}: সীমাহীন ✓
                  </span>
                );
              }
              if (typeof rule.maxRecords === 'number') {
                return (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    {tierName}: {toBengaliDigits(rule.maxRecords)}টি
                  </span>
                );
              }
              return (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {tierName}: সক্রিয় ✓
                </span>
              );
            };

            return (
              <div
                key={feat.key}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3 transition-colors hover:border-emerald-300 dark:hover:border-emerald-700"
              >
                {/* Card Title & Brief */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{feat.nameBn}</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {feat.descriptionBn}
                    </p>
                  </div>

                  {/* Quota Summary Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {formatQuotaBadge(starterRule, 'Free')}
                    {formatQuotaBadge(proRule, 'Pro')}
                    {formatQuotaBadge(vipRule, 'VIP')}
                  </div>
                </div>

                {/* Granular Sub-Features Breakdown List */}
                {feat.subFeatures && feat.subFeatures.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      অন্তর্ভুক্ত সাব-ফিচার ও পারমিশনস:
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {feat.subFeatures.map((sub) => {
                        const starterSub = starterRule?.subFeatures?.[sub.key] ?? false;
                        const proSub = proRule?.subFeatures?.[sub.key] ?? true;
                        const vipSub = vipRule?.subFeatures?.[sub.key] ?? true;

                        return (
                          <div
                            key={sub.key}
                            className="p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              • {sub.nameBn}
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                  starterSub
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                                }`}
                                title="Starter Free"
                              >
                                Free {starterSub ? '✓' : '✕'}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                  proSub
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                                }`}
                                title="Pro"
                              >
                                Pro {proSub ? '✓' : '✕'}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                  vipSub
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                                }`}
                                title="Pro VIP"
                              >
                                VIP {vipSub ? '✓' : '✕'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Request Modal */}
      {selectedPlanForUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {getTierIcon(selectedPlanForUpgrade.tier)}
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {isRenewalMode
                    ? `${selectedPlanForUpgrade.nameBn} — সাবস্ক্রিপশন রিনিউ`
                    : `${selectedPlanForUpgrade.nameBn} প্ল্যানে আপগ্রেড`}
                </h4>
              </div>
              <button
                onClick={handleCloseUpgradeModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h5 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {isRenewalMode
                    ? 'সাবস্ক্রিপশন রিনিউ অনুরোধ গৃহীত হয়েছে!'
                    : 'আপগ্রেড অনুরোধ সফলভাবে গৃহীত হয়েছে!'}
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                  আপনার পেমেন্ট ট্রানজেকশন যাচাই করে দ্রুততম সময়ে আপনার অ্যাকাউন্টটি {selectedPlanForUpgrade.nameBn} প্ল্যানে {isRenewalMode ? 'রিনিউ' : 'আপগ্রেড'} করে দেওয়া হবে।
                </p>
                <button
                  onClick={handleCloseUpgradeModal}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                >
                  ঠিক আছে
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitUpgradeRequest} className="space-y-4">
                {/* Billing Cycle Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    বিলিং সময়সীমা নির্বাচন করুন
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBillingCycle('monthly')}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${
                        selectedBillingCycle === 'monthly'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      মাসিক ({formatBdtPrice(selectedPlanForUpgrade.pricing.monthlyPriceBdt)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBillingCycle('yearly')}
                      className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${
                        selectedBillingCycle === 'yearly'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      বার্ষিক ({formatBdtPrice(selectedPlanForUpgrade.pricing.yearlyPriceBdt)})
                    </button>
                  </div>
                </div>

                {/* Payment Instructions */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    পেমেন্ট পাঠানোর নিয়মাবলী:
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    নিচের নম্বরে <strong>Send Money</strong> অথবা <strong>Payment</strong> করুন:
                  </p>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs flex items-center justify-between">
                    <span>
                      {paymentMethod.toUpperCase()} (Personal): <strong>01700-000000</strong>
                    </span>
                    <span className="text-[11px] text-emerald-600 font-sans font-bold">
                      {formatBdtPrice(
                        appliedCouponInfo
                          ? appliedCouponInfo.finalAmountBdt
                          : selectedBillingCycle === 'yearly'
                          ? selectedPlanForUpgrade.pricing.yearlyPriceBdt
                          : selectedPlanForUpgrade.pricing.monthlyPriceBdt
                      )}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {(['bkash', 'nagad', 'bank'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition ${
                          paymentMethod === m
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Coupon Code Redemption Box */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    ডিসকাউন্ট কুপন কোড
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. SHROMIK50"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponMsg('');
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-100 uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer"
                    >
                      আবেদন করুন
                    </button>
                  </div>
                  {couponMsg && (
                    <div
                      className={`text-[11px] font-semibold ${
                        appliedCouponInfo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {couponMsg}
                    </div>
                  )}

                  {appliedCouponInfo && (
                    <div className="p-2 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>মূল সার্ভিস ফি:</span>
                        <span className="line-through">
                          ৳{toBengaliDigits(
                            selectedBillingCycle === 'yearly'
                              ? selectedPlanForUpgrade.pricing.yearlyPriceBdt
                              : selectedPlanForUpgrade.pricing.monthlyPriceBdt
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-300 font-bold">
                        <span>কুপন ছাড় ({appliedCouponInfo.code}):</span>
                        <span>-৳{toBengaliDigits(appliedCouponInfo.discountAmountBdt)}</span>
                      </div>
                      <div className="flex justify-between text-slate-900 dark:text-white font-extrabold pt-1 border-t border-emerald-300 dark:border-emerald-800 text-xs">
                        <span>মোট পরিশোধনীয়:</span>
                        <span>৳{toBengaliDigits(appliedCouponInfo.finalAmountBdt)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      যে মোবাইল নম্বর থেকে টাকা পাঠিয়েছেন *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 017xxxxxxxx"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      ট্রানজেকশন আইডি (TrxID) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9J28DA10K"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      অতিরিক্ত তথ্য বা নোট (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ফ্যাক্টরি নাম বা জরুরি আপগ্রেড"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {formError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseUpgradeModal}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      'অনুরোধ পাঠানো হচ্ছে...'
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        অনুরোধ সাবমিট করুন
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
