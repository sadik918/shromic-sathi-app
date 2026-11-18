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
  ArrowLeft,
  ArrowRight,
  Copy,
  Calendar,
  Layers,
  CheckCircle2,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  APP_FEATURE_CATALOG,
  calculateSubscriptionCheckoutSummary,
  filterPublishedPlans,
  formatBdtPrice,
  generateSubscriptionOrderNumber,
  getBengaliPlanName,
  getPaymentGatewayMeta,
  toBengaliDigits,
  type CheckoutPaymentMethod,
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
    coupons,
    validateCoupon,
    salaryRecords,
    overtime,
    documents,
    contacts,
    isReadOnlyDemo,
    triggerReadOnlyBlock,
  } = useData();

  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<SubscriptionPlan | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'order' | 'payment' | 'thank_you'>('order');
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('bkash');
  const [trxId, setTrxId] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [copiedField, setCopiedField] = useState<'amount' | 'number' | null>(null);

  // Coupon state inside Checkout Step 1 (Order)
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
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
    setCheckoutStep('order');
    setIsRenewalMode(isRenewal);
    setSelectedBillingCycle('monthly');
    setPaymentMethod('bkash');
    setTrxId('');
    setSenderPhone('');
    setNotes('');
    setFormError('');
    setCopiedField(null);
    setCouponInput('');
    setAppliedCouponCode('');
    setCouponMsg('');
  };

  React.useEffect(() => {
    if (openRenewalTrigger > 0 && activePlan && !activePlan.pricing.isFree) {
      handleOpenUpgradeModal(activePlan, true);
    }
  }, [openRenewalTrigger, activePlan]);

  const handleCloseUpgradeModal = () => {
    setSelectedPlanForUpgrade(null);
    setCheckoutStep('order');
    setFormError('');
    setCopiedField(null);
    setCouponInput('');
    setAppliedCouponCode('');
    setCouponMsg('');
  };

  const checkoutSummary = React.useMemo(() => {
    if (!selectedPlanForUpgrade) {
      return {
        originalAmountBdt: 0,
        discountAmountBdt: 0,
        finalAmountBdt: 0,
        appliedCouponCode: null,
      };
    }
    return calculateSubscriptionCheckoutSummary({
      plan: selectedPlanForUpgrade,
      billingCycle: selectedBillingCycle,
      couponCode: appliedCouponCode,
      coupons,
    });
  }, [selectedPlanForUpgrade, selectedBillingCycle, appliedCouponCode, coupons]);

  const activeGateway = React.useMemo(
    () =>
      getPaymentGatewayMeta({
        method: paymentMethod,
        config: subscriptionConfig,
      }),
    [paymentMethod, subscriptionConfig]
  );

  const handleCopyText = async (value: string, field: 'amount' | 'number') => {
    if (!value) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 1800);
    } catch {
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === field ? null : prev));
      }, 1800);
    }
  };

  const handleApplyCoupon = () => {
    if (!selectedPlanForUpgrade) return;
    const basePrice =
      selectedBillingCycle === 'yearly'
        ? selectedPlanForUpgrade.pricing.yearlyPriceBdt
        : selectedPlanForUpgrade.pricing.monthlyPriceBdt;

    const cleanCode = couponInput.trim().toUpperCase();
    const res = validateCoupon(cleanCode, selectedPlanForUpgrade.id, basePrice);
    if (!res.valid) {
      setCouponMsg(res.errorBn || 'অবৈধ কুপন কোড');
      setAppliedCouponCode('');
    } else {
      setAppliedCouponCode(cleanCode);
      setCouponMsg(`কুপন প্রয়োগ সফল! ৳${toBengaliDigits(res.discountAmountBdt)} ছাড় পেয়েছেন।`);
    }
  };

  const handleProceedToPayment = () => {
    setFormError('');
    setCheckoutStep('payment');
  };

  const handleSubmitUpgradeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForUpgrade) return;

    if (isReadOnlyDemo) {
      triggerReadOnlyBlock();
      return;
    }

    if (!senderPhone.trim()) {
      setFormError(`অনুগ্রহ করে আপনার ${activeGateway.labelBn} নাম্বার লিখুন`);
      return;
    }
    if (!trxId.trim()) {
      setFormError('লেনদেনের ট্রানজেকশন আইডি (TrxID) লিখুন');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await requestPlanUpgrade({
        planId: selectedPlanForUpgrade.id,
        billingCycle: selectedBillingCycle,
        paymentMethod,
        transactionId: trxId.trim(),
        senderPhone: senderPhone.trim(),
        couponCode: checkoutSummary.appliedCouponCode || undefined,
        discountAmountBdt: checkoutSummary.discountAmountBdt,
        finalAmountBdt: checkoutSummary.finalAmountBdt,
        isRenewal: isRenewalMode,
        notes: notes.trim(),
      });
      setCheckoutStep('thank_you');
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

      {/* 3-Step Subscription Checkout Modal (অর্ডার -> পেমেন্ট -> থ্যাংক ইউ) */}
      {selectedPlanForUpgrade && (
        <div
          data-testid="subscription-checkout-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs overflow-y-auto animate-fadeIn"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[94vh] overflow-y-auto">
            {/* Modal Top Title & Close */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {getTierIcon(selectedPlanForUpgrade.tier)}
                <h4 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  {checkoutStep === 'payment'
                    ? 'পেমেন্ট'
                    : checkoutStep === 'thank_you'
                    ? 'থ্যাংক ইউ'
                    : isRenewalMode
                    ? `${selectedPlanForUpgrade.nameBn} রিনিউ`
                    : `${selectedPlanForUpgrade.nameBn} অর্ডার`}
                </h4>
              </div>
              <button
                type="button"
                aria-label="বন্ধ করুন"
                onClick={handleCloseUpgradeModal}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3-Step Progress Stepper */}
            <div
              data-testid="checkout-stepper"
              className="flex items-center justify-between gap-1.5 px-1 py-1 text-xs"
            >
              {/* Step 1: অর্ডার */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                    checkoutStep === 'order'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {checkoutStep === 'order' ? '১' : <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </span>
                <span
                  className={`font-bold ${
                    checkoutStep === 'order'
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  অর্ডার
                </span>
              </div>

              <div className="flex-1 h-[1.5px] bg-slate-200 dark:bg-slate-700" />

              {/* Step 2: পেমেন্ট */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-colors ${
                    checkoutStep === 'thank_you'
                      ? 'bg-emerald-500 text-white'
                      : checkoutStep === 'payment'
                      ? paymentMethod === 'nagad'
                        ? 'bg-[#F76D1B] text-white shadow-xs'
                        : 'bg-[#E2136E] text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                  }`}
                >
                  {checkoutStep === 'thank_you' ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '২'}
                </span>
                <span
                  className={`font-bold ${
                    checkoutStep === 'payment'
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  পেমেন্ট
                </span>
              </div>

              <div className="flex-1 h-[1.5px] bg-slate-200 dark:bg-slate-700" />

              {/* Step 3: থ্যাংক ইউ */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                    checkoutStep === 'thank_you'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {checkoutStep === 'thank_you' ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '৩'}
                </span>
                <span
                  className={`font-bold ${
                    checkoutStep === 'thank_you'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  থ্যাংক ইউ
                </span>
              </div>
            </div>

            {/* STEP 1: ORDER & COUPON APPLICATION */}
            {checkoutStep === 'order' && (
              <div data-testid="checkout-step-order" className="space-y-4">
                {/* Plan Mini Summary */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      নির্বাচিত প্যাকেজ
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {selectedPlanForUpgrade.nameBn}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold">
                    {isRenewalMode ? 'রিনিউয়াল' : 'আপগ্রেড'}
                  </span>
                </div>

                {/* Billing Cycle Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    মেয়াদ নির্বাচন করুন
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      data-testid="checkout-cycle-monthly"
                      onClick={() => setSelectedBillingCycle('monthly')}
                      className={`p-3 rounded-xl border-2 text-xs text-center transition cursor-pointer ${
                        selectedBillingCycle === 'monthly'
                          ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-extrabold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                      }`}
                    >
                      <div>মাসিক</div>
                      <div className="text-sm font-black mt-0.5">
                        {formatBdtPrice(selectedPlanForUpgrade.pricing.monthlyPriceBdt)}
                      </div>
                    </button>
                    <button
                      type="button"
                      data-testid="checkout-cycle-yearly"
                      onClick={() => setSelectedBillingCycle('yearly')}
                      className={`p-3 rounded-xl border-2 text-xs text-center transition cursor-pointer ${
                        selectedBillingCycle === 'yearly'
                          ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-extrabold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                      }`}
                    >
                      <div>বার্ষিক</div>
                      <div className="text-sm font-black mt-0.5">
                        {formatBdtPrice(selectedPlanForUpgrade.pricing.yearlyPriceBdt)}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Coupon Code Redemption Box */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    কুপন কোড প্রয়োগ করুন (যদি থাকে)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      data-testid="checkout-coupon-input"
                      placeholder="যেমন: SHROMIK50"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponMsg('');
                        if (!e.target.value.trim()) {
                          setAppliedCouponCode('');
                        }
                      }}
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-100 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      data-testid="checkout-apply-coupon-btn"
                      onClick={handleApplyCoupon}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer transition"
                    >
                      আবেদন করুন
                    </button>
                  </div>
                  {couponMsg && (
                    <div
                      data-testid="checkout-coupon-message"
                      className={`text-[11px] font-semibold ${
                        checkoutSummary.appliedCouponCode
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {couponMsg}
                    </div>
                  )}
                </div>

                {/* Order Price Breakdown */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>মূল সার্ভিস ফি ({selectedBillingCycle === 'yearly' ? 'বার্ষিক' : 'মাসিক'}):</span>
                    <span className={checkoutSummary.discountAmountBdt > 0 ? 'line-through' : 'font-bold text-slate-800 dark:text-slate-200'}>
                      ৳{toBengaliDigits(checkoutSummary.originalAmountBdt)}
                    </span>
                  </div>
                  {checkoutSummary.appliedCouponCode && checkoutSummary.discountAmountBdt > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                      <span>কুপন ছাড় ({checkoutSummary.appliedCouponCode}):</span>
                      <span>-৳{toBengaliDigits(checkoutSummary.discountAmountBdt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-black text-slate-900 dark:text-white">
                    <span>মোট পরিশোধনীয়:</span>
                    <span data-testid="checkout-order-total" className="text-base text-emerald-700 dark:text-emerald-400">
                      ৳{toBengaliDigits(checkoutSummary.finalAmountBdt)}
                    </span>
                  </div>
                </div>

                {/* Primary CTA: পেমেন্ট করুন */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    data-testid="checkout-proceed-payment-btn"
                    onClick={handleProceedToPayment}
                    className="w-full min-h-[48px] py-3 px-4 rounded-2xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>পেমেন্ট করুন</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseUpgradeModal}
                    className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    বাতিল করুন
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PAYMENT GATEWAY UI (MATCHING REFERENCE SCREENSHOT) */}
            {checkoutStep === 'payment' && (
              <form
                data-testid="checkout-step-payment"
                onSubmit={handleSubmitUpgradeRequest}
                className="rounded-3xl overflow-hidden border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg"
              >
                {/* Branded Vivid Header Banner */}
                <div
                  className="p-5 pb-8 text-white space-y-3 transition-colors"
                  style={{
                    background:
                      paymentMethod === 'nagad'
                        ? 'linear-gradient(135deg, #EC1C24 0%, #F76D1B 100%)'
                        : 'linear-gradient(135deg, #D12053 0%, #E2136E 100%)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold opacity-95">শ্রমিক সাথী • পেমেন্ট</span>
                    <span className="px-2.5 py-1 rounded-full bg-white/20 text-[11px] font-bold tracking-wide">
                      অর্ডার {generateSubscriptionOrderNumber(selectedPlanForUpgrade.id, selectedBillingCycle)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs opacity-90">আপনাকে পাঠাতে হবে</div>
                      <div
                        data-testid="payment-payable-amount"
                        className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mt-0.5"
                      >
                        ৳{toBengaliDigits(checkoutSummary.finalAmountBdt)}
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid="payment-copy-amount-btn"
                      onClick={() => handleCopyText(String(checkoutSummary.finalAmountBdt), 'amount')}
                      className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      {copiedField === 'amount' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>কপি হয়েছে</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>কপি</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-black/20 text-xs font-semibold">
                    {activeGateway.headerPillBn}
                  </div>
                </div>

                {/* Method Tabs + Numbered Instructions overlapping header cleanly */}
                <div className="px-4 sm:px-5 pb-5 -mt-4 space-y-4">
                  {/* Payment Method Selector Tabs (বিকাশ / নগদ) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      data-testid="payment-method-bkash"
                      onClick={() => setPaymentMethod('bkash')}
                      className={`min-h-[46px] px-3 py-2.5 rounded-2xl border-2 bg-white dark:bg-slate-800 flex items-center justify-center gap-2 text-sm font-extrabold transition cursor-pointer shadow-sm ${
                        paymentMethod === 'bkash'
                          ? 'border-[#E2136E] text-[#D12053] dark:text-[#FF5DA2] ring-2 ring-[#E2136E]/15'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                      }`}
                    >
                      {/* Clean bKash Bird Icon Mark */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 5L12 10L9 17L4 5Z" fill="#E2136E" />
                        <path d="M12 10L20 7L14 19L9 17L12 10Z" fill="#B80B56" />
                      </svg>
                      <span>বিকাশ</span>
                    </button>

                    <button
                      type="button"
                      data-testid="payment-method-nagad"
                      onClick={() => setPaymentMethod('nagad')}
                      className={`min-h-[46px] px-3 py-2.5 rounded-2xl border-2 bg-white dark:bg-slate-800 flex items-center justify-center gap-2 text-sm font-extrabold transition cursor-pointer shadow-sm ${
                        paymentMethod === 'nagad'
                          ? 'border-[#F76D1B] text-[#E52D27] dark:text-[#FF8A3D] ring-2 ring-[#F76D1B]/15'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                      }`}
                    >
                      {/* Clean Nagad Emblem Mark */}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" fill="#F76D1B" />
                        <path d="M8 14C9.5 10.5 14 9 16 12C14.5 15 10 15.5 8 14Z" fill="#FFFFFF" />
                      </svg>
                      <span>নগদ</span>
                    </button>
                  </div>

                  {/* Step ১: এই নাম্বারে টাকা পাঠান */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="w-6 h-6 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: activeGateway.accentHex }}
                      >
                        ১
                      </span>
                      <div>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          এই নাম্বারে টাকা পাঠান
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {activeGateway.sendStepSubtextBn}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`pl-3 pr-2 py-2 rounded-2xl border flex items-center justify-between gap-2 ${
                        paymentMethod === 'nagad'
                          ? 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-200/80 dark:border-orange-800/60'
                          : 'bg-pink-50/80 dark:bg-pink-950/30 border-pink-200/80 dark:border-pink-800/60'
                      }`}
                    >
                      <span
                        data-testid="payment-merchant-number"
                        className="font-mono text-base sm:text-lg font-extrabold tracking-wide text-slate-900 dark:text-white select-all"
                      >
                        {activeGateway.merchantNumber}
                      </span>
                      <button
                        type="button"
                        data-testid="payment-copy-number-btn"
                        onClick={() => handleCopyText(activeGateway.merchantNumber, 'number')}
                        className="px-3.5 py-2 rounded-xl text-white text-xs font-extrabold flex items-center gap-1 transition cursor-pointer shrink-0 shadow-xs"
                        style={{ backgroundColor: activeGateway.accentHex }}
                      >
                        {copiedField === 'number' ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>কপি হয়েছে</span>
                          </>
                        ) : (
                          <span>কপি</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Step ২: আপনার বিকাশ/নগদ নাম্বার দিন */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="w-6 h-6 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: activeGateway.accentHex }}
                      >
                        ২
                      </span>
                      <div>
                        <label
                          htmlFor="checkout-sender-phone"
                          className="text-sm font-extrabold text-slate-900 dark:text-slate-100 block"
                        >
                          {activeGateway.senderInputLabelBn}
                        </label>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          যে নাম্বার থেকে টাকা পাঠিয়েছেন
                        </div>
                      </div>
                    </div>

                    <input
                      id="checkout-sender-phone"
                      data-testid="payment-sender-phone-input"
                      type="tel"
                      inputMode="numeric"
                      required
                      placeholder="01XXXXXXXXX"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-2xl border-2 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none ${
                        paymentMethod === 'nagad'
                          ? 'border-[#F76D1B]/60 focus:border-[#F76D1B]'
                          : 'border-[#E2136E]/60 focus:border-[#E2136E]'
                      }`}
                    />
                  </div>

                  {/* Step ৩: ট্রানজেকশন আইডি (TrxID) দিন */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="w-6 h-6 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: activeGateway.accentHex }}
                      >
                        ৩
                      </span>
                      <div>
                        <label
                          htmlFor="checkout-trx-id"
                          className="text-sm font-extrabold text-slate-900 dark:text-slate-100 block"
                        >
                          ট্রানজেকশন আইডি (TrxID) দিন
                        </label>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          পেমেন্ট শেষে পাওয়া TrxID কোডটি লিখুন
                        </div>
                      </div>
                    </div>

                    <input
                      id="checkout-trx-id"
                      data-testid="payment-trxid-input"
                      type="text"
                      required
                      placeholder="যেমন: 9J28DA10K"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-2xl border-2 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none uppercase ${
                        paymentMethod === 'nagad'
                          ? 'border-slate-200 dark:border-slate-700 focus:border-[#F76D1B]'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#E2136E]'
                      }`}
                    />

                    <input
                      type="text"
                      aria-label="অতিরিক্ত নোট (ঐচ্ছিক)"
                      placeholder="অতিরিক্ত নোট (ঐচ্ছিক)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>

                  {formError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Submit Button: পেমেন্ট কনফার্ম করুন */}
                  <div className="pt-1 space-y-2 text-center">
                    <button
                      type="submit"
                      data-testid="payment-confirm-submit-btn"
                      disabled={isSubmitting}
                      className="w-full min-h-[48px] py-3 px-4 rounded-2xl text-sm font-extrabold text-white shadow-md hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
                      style={{
                        background:
                          paymentMethod === 'nagad'
                            ? 'linear-gradient(135deg, #EC1C24 0%, #F76D1B 100%)'
                            : 'linear-gradient(135deg, #D12053 0%, #E2136E 100%)',
                      }}
                    >
                      {isSubmitting ? 'যাচাইয়ের জন্য পাঠানো হচ্ছে...' : 'পেমেন্ট কনফার্ম করুন'}
                    </button>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      টাকা পাঠানো হলে এখানে চাপুন
                    </p>
                    <button
                      type="button"
                      data-testid="payment-back-to-order-btn"
                      onClick={() => {
                        setFormError('');
                        setCheckoutStep('order');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 pt-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>অর্ডার ও কুপনে ফিরে যান</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 3: THANK YOU CONFIRMATION */}
            {checkoutStep === 'thank_you' && (
              <div data-testid="checkout-step-thank-you" className="py-5 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h5 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                    {isRenewalMode
                      ? 'ধন্যবাদ! রিনিউ অনুরোধ গৃহীত হয়েছে'
                      : 'ধন্যবাদ! পেমেন্ট তথ্য গৃহীত হয়েছে'}
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                    আপনার পেমেন্ট ({activeGateway.labelBn} • ৳{toBengaliDigits(checkoutSummary.finalAmountBdt)} • TrxID:{' '}
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{trxId}</span>) যাচাই করে দ্রুততম সময়ে {selectedPlanForUpgrade.nameBn} সক্রিয় করে দেওয়া হবে।
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="checkout-thank-you-done-btn"
                  onClick={handleCloseUpgradeModal}
                  className="w-full min-h-[44px] py-2.5 bg-emerald-600 text-white rounded-2xl text-sm font-extrabold hover:bg-emerald-700 transition cursor-pointer"
                >
                  ঠিক আছে
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
