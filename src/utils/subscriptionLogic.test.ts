import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessFeature,
  resolveUserActivePlan,
  validatePlanInput,
  computeSubscriptionMetrics,
  filterPublishedPlans,
  computeSubscriptionRenewalNotice,
  createDefaultExpiringSubscription,
  DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG,
  DEFAULT_SUBSCRIPTION_PLANS,
  type UserSubscriptionRecord,
  type SubscriptionPlan,
} from './subscriptionLogic';

test('1. When master switch is DISABLED: all features, limits, and exports are 100% UNRESTRICTED', () => {
  const result = canAccessFeature({
    isSystemEnabled: false,
    userSub: null,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    feature: 'salary',
    currentCount: 99999, // Way above any quota
    requireExport: true,
    requireAdvanced: true,
  });

  assert.equal(result.allowed, true, 'Access must be allowed unconditionally when system is disabled');
  assert.equal(result.upgradeRequired, undefined);

  const resolved = resolveUserActivePlan({
    isSystemEnabled: false,
    userSub: null,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
  });

  assert.equal(resolved.isUnrestricted, true);
  assert.equal(resolved.isPaidActive, true);
});

test('2. When master switch is ENABLED: users without subscription get Starter Free plan', () => {
  const resolved = resolveUserActivePlan({
    isSystemEnabled: true,
    userSub: null,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
  });

  assert.equal(resolved.plan.id, 'starter_free');
  assert.equal(resolved.status, 'free');
  assert.equal(resolved.isUnrestricted, false);
  assert.equal(resolved.isPaidActive, false);
});

test('3. Starter Free plan enforces max record quotas when enabled', () => {
  // Free plan has maxRecords: 60 for overtime
  const allowedCheck = canAccessFeature({
    isSystemEnabled: true,
    userSub: null,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    feature: 'overtime',
    currentCount: 59,
  });
  assert.equal(allowedCheck.allowed, true, 'Should allow record 60 when current is 59');

  const blockedCheck = canAccessFeature({
    isSystemEnabled: true,
    userSub: null,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    feature: 'overtime',
    currentCount: 60,
  });
  assert.equal(blockedCheck.allowed, false, 'Should block when quota reached');
  assert.equal(blockedCheck.upgradeRequired, true);
  assert.match(blockedCheck.reasonBn || '', /সর্বোচ্চ ৬০ টি রেকর্ড/);
});

test('4. Starter Free plan restricts reports export, while Pro plan permits it', () => {
  const freeExport = canAccessFeature({
    isSystemEnabled: true,
    userSub: null,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    feature: 'reports',
    requireExport: true,
  });
  assert.equal(freeExport.allowed, false, 'Free plan must block export');

  const proSub: UserSubscriptionRecord = {
    userId: 'user-123',
    planId: 'pro',
    status: 'active',
    startDate: '2026-10-01',
    endDate: '2026-11-01',
  };

  const proExport = canAccessFeature({
    isSystemEnabled: true,
    userSub: proSub,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    feature: 'reports',
    requireExport: true,
  });
  assert.equal(proExport.allowed, true, 'Pro plan must permit export');
});

test('5. Pro VIP plan has unlimited quotas and all capabilities', () => {
  const vipSub: UserSubscriptionRecord = {
    userId: 'vip-user',
    planId: 'pro_vip',
    status: 'active',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
  };

  const vipVault = canAccessFeature({
    isSystemEnabled: true,
    userSub: vipSub,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    feature: 'vault',
    currentCount: 500, // Large number
    requireAdvanced: true,
    requireExport: true,
  });
  assert.equal(vipVault.allowed, true);
});

test('6. Expired subscription safely drops user to Starter Free without losing data', () => {
  const expiredSub: UserSubscriptionRecord = {
    userId: 'exp-user',
    planId: 'pro',
    status: 'active',
    startDate: '2026-08-01',
    endDate: '2026-09-01', // Expired
    gracePeriodDays: 3,
  };

  const resolved = resolveUserActivePlan({
    isSystemEnabled: true,
    userSub: expiredSub,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    todayISO: '2026-10-28',
  });

  assert.equal(resolved.status, 'expired');
  assert.equal(resolved.plan.id, 'starter_free');
  assert.equal(resolved.isPaidActive, false);
});

test('7. Plan input validation rejects invalid prices and tiers', () => {
  const invalidFree = validatePlanInput({
    id: 'starter_free',
    nameBn: 'ফ্রি প্ল্যান',
    tier: 'starter_free',
    priceBDT: 50, // Starter free MUST be 0
  });
  assert.equal(invalidFree.valid, false);
  assert.match(invalidFree.errors[0], /স্টার্টার ফ্রি প্ল্যানের মূল্য অবশ্যই ৳০ হতে হবে/);

  const missingName = validatePlanInput({
    id: 'custom_pro',
    nameBn: '',
    tier: 'pro',
    priceBDT: 30,
  });
  assert.equal(missingName.valid, false);
});

test('8. filterPublishedPlans returns only published plans sorted by displayOrder', () => {
  const customPlans: SubscriptionPlan[] = [
    { ...DEFAULT_SUBSCRIPTION_PLANS[1], displayOrder: 2, status: 'published' },
    { ...DEFAULT_SUBSCRIPTION_PLANS[0], displayOrder: 1, status: 'published' },
    { ...DEFAULT_SUBSCRIPTION_PLANS[2], displayOrder: 3, status: 'draft' }, // Draft!
  ];

  const published = filterPublishedPlans(customPlans);
  assert.equal(published.length, 2);
  assert.equal(published[0].id, 'starter_free');
  assert.equal(published[1].id, 'pro');
});

test('9. computeSubscriptionMetrics aggregates counts and revenue accurately', () => {
  const subs: Record<string, UserSubscriptionRecord> = {
    u1: { userId: 'u1', planId: 'starter_free', status: 'free', startDate: '2026-01-01' },
    u2: { userId: 'u2', planId: 'pro', status: 'active', startDate: '2026-10-01' },
    u3: { userId: 'u3', planId: 'pro_vip', status: 'active', startDate: '2026-10-01' },
    u4: { userId: 'u4', planId: 'pro', status: 'pending', startDate: '2026-10-28' },
    u5: { userId: 'u5', planId: 'pro', status: 'complimentary', startDate: '2026-10-28', isComplimentary: true },
  };

  const metrics = computeSubscriptionMetrics({
    totalUsersCount: 10,
    userSubs: subs,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
  });

  assert.equal(metrics.activeCount, 2); // u2 (pro), u3 (vip)
  assert.equal(metrics.pendingCount, 1); // u4
  assert.equal(metrics.complimentaryCount, 1); // u5
  // u2 (49) + u3 (99) = 148 BDT
  assert.equal(metrics.estimatedMonthlyRevenueBDT, 148);
  // Unassigned users (10 - 5 = 5) + u1 (1) = 6 on Starter Free
  assert.equal(metrics.planCounts['starter_free'], 6);
  assert.equal(metrics.planCounts['pro'], 3);
  assert.equal(metrics.planCounts['pro_vip'], 1);
});

test('10. Admin subscription mode is enabled by default with 5-day renewal warning threshold', () => {
  assert.equal(DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG.enabled, true);
  assert.equal(DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG.renewalWarningDays, 5);
});

test('11. MAIN RULE — When Admin Master Switch is DISABLED, no banner ever shows for any user', () => {
  // Unsubscribed user when system disabled
  const unsubDisabled = computeSubscriptionRenewalNotice({
    isSystemEnabled: false,
    userSub: null,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    todayISO: '2026-10-31',
    warningThresholdDays: 5,
  });
  assert.equal(unsubDisabled.shouldShowBanner, false);
  assert.equal(unsubDisabled.shouldShowRenewal, false);
  assert.equal(unsubDisabled.shouldShowSubscribePrompt, false);
  assert.equal(unsubDisabled.bannerMode, 'none');

  // Expiring user (5 days left) when system disabled
  const subAtDay25 = createDefaultExpiringSubscription('worker-3', '2026-10-31', 25, 30);
  const expiringDisabled = computeSubscriptionRenewalNotice({
    isSystemEnabled: false,
    userSub: subAtDay25,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    todayISO: '2026-10-31',
    warningThresholdDays: 5,
  });
  assert.equal(expiringDisabled.shouldShowBanner, false);
  assert.equal(expiringDisabled.shouldShowRenewal, false);
  assert.equal(expiringDisabled.bannerMode, 'none');
});

test('12. MAIN RULE — When Admin Master Switch is ENABLED and user has NO paid subscription, shows subscribe prompt (not 5 days remaining)', () => {
  const noticeNull = computeSubscriptionRenewalNotice({
    isSystemEnabled: true,
    userSub: null,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    todayISO: '2026-10-31',
    warningThresholdDays: 5,
  });
  assert.equal(noticeNull.shouldShowBanner, true);
  assert.equal(noticeNull.shouldShowSubscribePrompt, true);
  assert.equal(noticeNull.shouldShowRenewal, false);
  assert.equal(noticeNull.bannerMode, 'no_subscription');

  const freeSub: UserSubscriptionRecord = {
    userId: 'free-worker',
    planId: 'starter_free',
    status: 'free',
  };
  const noticeFree = computeSubscriptionRenewalNotice({
    isSystemEnabled: true,
    userSub: freeSub,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    todayISO: '2026-10-31',
    warningThresholdDays: 5,
  });
  assert.equal(noticeFree.shouldShowBanner, true);
  assert.equal(noticeFree.shouldShowSubscribePrompt, true);
  assert.equal(noticeFree.shouldShowRenewal, false);
  assert.equal(noticeFree.bannerMode, 'no_subscription');
});

test('13. MAIN RULE — Active 30-day subscription with 10 days used (20 days left) hides banner completely when threshold is 5 days', () => {
  const subWith20DaysLeft = createDefaultExpiringSubscription('worker-2', '2026-10-31', 10, 30);
  const noticeEarly = computeSubscriptionRenewalNotice({
    isSystemEnabled: true,
    userSub: subWith20DaysLeft,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    todayISO: '2026-10-31',
    warningThresholdDays: 5,
  });
  assert.equal(noticeEarly.shouldShowBanner, false);
  assert.equal(noticeEarly.shouldShowRenewal, false);
  assert.equal(noticeEarly.shouldShowSubscribePrompt, false);
  assert.equal(noticeEarly.bannerMode, 'none');
  assert.equal(noticeEarly.daysRemaining, 20);
});

test('14. MAIN RULE — Active 30-day subscription with 25 days used (5 days left) shows renewal banner when threshold is 5 days', () => {
  const subAtDay25 = createDefaultExpiringSubscription('worker-1', '2026-10-31', 25, 30);
  const notice = computeSubscriptionRenewalNotice({
    isSystemEnabled: true,
    userSub: subAtDay25,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    todayISO: '2026-10-31',
    warningThresholdDays: 5,
  });

  assert.equal(notice.shouldShowBanner, true);
  assert.equal(notice.shouldShowRenewal, true);
  assert.equal(notice.shouldShowSubscribePrompt, false);
  assert.equal(notice.bannerMode, 'expiring_soon');
  assert.equal(notice.daysRemaining, 5);
  assert.equal(notice.daysElapsed, 25);
  assert.equal(notice.totalDurationDays, 30);
  assert.equal(notice.planId, 'pro');
});

test('15. MAIN RULE — Admin custom warningThresholdDays (e.g., 10 days) controls exactly when the renewal banner appears', () => {
  const subWith8DaysLeft = createDefaultExpiringSubscription('worker-8d', '2026-10-31', 22, 30);

  // With default 5-day threshold, 8 days left should NOT show banner
  const with5DayRule = computeSubscriptionRenewalNotice({
    isSystemEnabled: true,
    userSub: subWith8DaysLeft,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    todayISO: '2026-10-31',
    warningThresholdDays: 5,
  });
  assert.equal(with5DayRule.shouldShowBanner, false);
  assert.equal(with5DayRule.bannerMode, 'none');

  // With Admin setting 10-day threshold, 8 days left SHOULD show banner
  const with10DayRule = computeSubscriptionRenewalNotice({
    isSystemEnabled: true,
    userSub: subWith8DaysLeft,
    plans: DEFAULT_SUBSCRIPTION_PLANS,
    todayISO: '2026-10-31',
    warningThresholdDays: 10,
  });
  assert.equal(with10DayRule.shouldShowBanner, true);
  assert.equal(with10DayRule.shouldShowRenewal, true);
  assert.equal(with10DayRule.bannerMode, 'expiring_soon');
  assert.equal(with10DayRule.daysRemaining, 8);
});


