import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MORE_NAV_GROUPS,
  MORE_NAV_ITEMS,
  buildGroupedMoreNav,
} from './moreNavigation';

test('buildGroupedMoreNav separates standard items into three distinct groups without admin', () => {
  const visibleItems = MORE_NAV_ITEMS.filter((item) => !item.requiresAdmin);
  const grouped = buildGroupedMoreNav(visibleItems, false);

  assert.equal(grouped.length, MORE_NAV_GROUPS.length);
  assert.deepEqual(
    grouped.map((g) => g.id),
    ['personal_tools', 'finance_docs', 'rules_account']
  );

  const flatIds = grouped.flatMap((g) => g.items.map((item) => item.id));
  assert.equal(flatIds.includes('alarm'), true);
  assert.equal(flatIds.includes('calculator'), true);
  assert.equal(flatIds.includes('admin_panel'), false);
  assert.equal(flatIds.length, 13);
});

test('buildGroupedMoreNav includes admin_panel under rules_account when isAdminUser is true', () => {
  const grouped = buildGroupedMoreNav(MORE_NAV_ITEMS, true);
  const accountSection = grouped.find((g) => g.id === 'rules_account');

  assert.ok(accountSection);
  assert.equal(
    accountSection.items.some((item) => item.id === 'admin_panel'),
    true
  );
  const totalCount = grouped.reduce((sum, section) => sum + section.items.length, 0);
  assert.equal(totalCount, 14);
});

test('buildGroupedMoreNav keeps personal_tools ordering with profile, alarm, and calculator at top', () => {
  const grouped = buildGroupedMoreNav(MORE_NAV_ITEMS, false);
  const personalSection = grouped.find((g) => g.id === 'personal_tools');

  assert.ok(personalSection);
  assert.deepEqual(
    personalSection.items.map((i) => i.id),
    ['profile', 'alarm', 'calculator', 'contacts', 'factory']
  );
});
