import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_NOTICE_TEMPLATES,
  buildAdminDashboardChartsData,
  computeAnnouncementCounts,
  computeSystemHealthSummary,
  filterAnnouncements,
  filterSystemErrors,
  translateSystemError,
} from './adminSystemHelpers';
import { buildDefaultAdminStore } from './adminLogic';

test('Admin Notices & System Monitoring Pure Helpers', async (t) => {
  const store = buildDefaultAdminStore('2026-11-15');

  await t.test('exposes clean Bengali notice templates and computes announcement counts', () => {
    assert.ok(ADMIN_NOTICE_TEMPLATES.length >= 4);
    for (const tpl of ADMIN_NOTICE_TEMPLATES) {
      assert.ok(tpl.titleBn.length > 5);
      assert.ok(tpl.messageBn.length > 10);
      assert.ok(!tpl.labelBn.includes('('), 'template labels should avoid parenthetical subtitles');
    }

    const counts = computeAnnouncementCounts(store.announcements);
    assert.equal(counts.total, 3);
    assert.equal(counts.published, 2);
    assert.equal(counts.draft, 1);
    assert.equal(counts.archived, 0);

    const drafts = filterAnnouncements(store.announcements, 'draft', '');
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].id, 'ann_03');

    const searchRes = filterAnnouncements(store.announcements, 'all', 'ওভারটাইম');
    assert.equal(searchRes.length, 1);
    assert.equal(searchRes[0].id, 'ann_02');
  });

  await t.test('translates technical error codes into understandable Bengali guidance', () => {
    const syncErr = store.errors[0];
    const translated = translateSystemError(syncErr);
    assert.ok(translated.titleBn.includes('ইন্টারনেট'));
    assert.ok(translated.moduleBn.includes('অফলাইন'));

    const filteredUnresolved = filterSystemErrors(store.errors, 'unresolved');
    assert.equal(filteredUnresolved.length, 1);
    assert.equal(filteredUnresolved[0].id, 'err_501');

    const filteredResolved = filterSystemErrors(store.errors, 'resolved');
    assert.equal(filteredResolved.length, 1);
    assert.equal(filteredResolved[0].id, 'err_502');
  });

  await t.test('computes overall health status and 5 diagnostic checks cleanly', () => {
    const healthy = computeSystemHealthSummary({
      isOnline: true,
      hasAuthSession: true,
      isDemoMode: false,
      pendingWritesCount: 0,
      unresolvedErrorsCount: 0,
      storageUsedKB: 140,
    });
    assert.equal(healthy.overallLevel, 'healthy');
    assert.equal(healthy.checks.length, 5);
    assert.ok(healthy.checks.every((c) => c.ok));

    const attention = computeSystemHealthSummary({
      isOnline: true,
      hasAuthSession: false,
      isDemoMode: true,
      pendingWritesCount: 2,
      unresolvedErrorsCount: 1,
      storageUsedKB: 256,
    });
    assert.equal(attention.overallLevel, 'attention');

    const offline = computeSystemHealthSummary({
      isOnline: false,
      hasAuthSession: true,
      isDemoMode: false,
      pendingWritesCount: 1,
      unresolvedErrorsCount: 0,
      storageUsedKB: 120,
    });
    assert.equal(offline.overallLevel, 'offline');
  });

  await t.test('builds comprehensive Pie, Bar, and Trend chart data for all 8 Admin sections', () => {
    const charts = buildAdminDashboardChartsData({
      store,
      roleFeatureCounts: {
        super_admin: 35,
        admin: 31,
        support_moderator: 22,
        user: 19,
      },
    });

    assert.equal(charts.overview.wageBreakdownPie.length, 4);
    assert.equal(charts.overview.industrialZonePie.length, 5);
    assert.equal(charts.overview.shiftDistributionPie.length, 3);
    assert.equal(charts.overview.subscriptionTierPie.length, 3);
    assert.equal(charts.overview.monthlyGrowthTrend.length, 6);
    assert.equal(charts.overview.cohortRegistrationBar.length, 3);

    assert.ok(charts.users.userAuthAndStatusPie.length >= 2);
    assert.ok(charts.users.userSyncStatePie.length >= 2);
    assert.ok(charts.users.userActivityBar.length >= 4);

    assert.equal(charts.roles.adminRolePie.length, 3);
    assert.equal(charts.roles.rolePermissionsBar.length, 4);

    assert.equal(charts.subscriptions.planSharePie.length, 3);
    assert.equal(charts.subscriptions.planRevenueBar.length, 3);

    assert.ok(charts.support.ticketStatusPie.length >= 3);
    assert.ok(charts.support.ticketCategoryBar.length >= 3);

    assert.ok(charts.settings.noticeStatusPie.length >= 2);
    assert.equal(charts.settings.featureAndCategoryBar.length, 3);

    assert.equal(charts.monitoring.errorStatusPie.length, 2);
    assert.equal(charts.monitoring.moduleHealthBar.length, 4);

    assert.ok(charts.audit.auditActionPie.length >= 3);
    assert.equal(charts.audit.backupAndAuditBar.length, 3);
  });
});

