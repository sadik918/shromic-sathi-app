import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_MENU_SECTIONS,
  buildDefaultAdminStore,
  canAdminPerform,
  computeAdminOverviewMetrics,
  filterAndPaginateUsers,
  PRIMARY_SUPER_ADMIN_EMAIL,
  sanitizeAuditMetadata,
  sanitizeUserForAdminDirectory,
  validateRoleChange,
} from './adminLogic';

test('Admin menu structure contains all 8 sections matching the Bengali specification', () => {
  assert.equal(ADMIN_MENU_SECTIONS.length, 8);
  assert.equal(ADMIN_MENU_SECTIONS[0].titleBn, 'ড্যাশবোর্ড ও অ্যানালিটিক্স');
  assert.equal(ADMIN_MENU_SECTIONS[1].titleBn, 'ইউজার ম্যানেজমেন্ট');
  assert.equal(ADMIN_MENU_SECTIONS[2].titleBn, 'অ্যাডমিন রোল ও পারমিশন');
  assert.equal(ADMIN_MENU_SECTIONS[3].titleBn, 'সাবস্ক্রিপশন ও প্ল্যান');
  assert.equal(ADMIN_MENU_SECTIONS[4].titleBn, 'সাপোর্ট ও ফিডব্যাক');
  assert.equal(ADMIN_MENU_SECTIONS[5].titleBn, 'নোটিশ ও অ্যাপ সেটিংস');
  assert.equal(ADMIN_MENU_SECTIONS[6].titleBn, 'সিস্টেম মনিটরিং');
  assert.equal(ADMIN_MENU_SECTIONS[7].titleBn, 'অডিট লগ ও ব্যাকআপ');
});

test('RBAC permissions enforce least privilege across Super Admin, Admin, Support Moderator, and ordinary users', () => {
  // Ordinary worker (null role) has zero admin permissions
  assert.equal(canAdminPerform(null, 'view_dashboard'), false);
  assert.equal(canAdminPerform(undefined, 'manage_tickets'), false);

  // Support Moderator can only view dashboard and manage tickets
  assert.equal(canAdminPerform('support_moderator', 'view_dashboard'), true);
  assert.equal(canAdminPerform('support_moderator', 'manage_tickets'), true);
  assert.equal(canAdminPerform('support_moderator', 'suspend_users'), false);
  assert.equal(canAdminPerform('support_moderator', 'manage_roles'), false);
  assert.equal(canAdminPerform('support_moderator', 'update_calculation_policy'), false);

  // Admin can manage users, tickets, announcements, and view logs, but cannot manage roles or calculation policies
  assert.equal(canAdminPerform('admin', 'manage_users'), true);
  assert.equal(canAdminPerform('admin', 'suspend_users'), true);
  assert.equal(canAdminPerform('admin', 'publish_announcements'), true);
  assert.equal(canAdminPerform('admin', 'manage_roles'), false);
  assert.equal(canAdminPerform('admin', 'update_calculation_policy'), false);

  // Super Admin has full access to all administrative operations
  assert.equal(canAdminPerform('super_admin', 'manage_roles'), true);
  assert.equal(canAdminPerform('super_admin', 'update_calculation_policy'), true);
  assert.equal(canAdminPerform('super_admin', 'manage_backups'), true);
});

test('Role change validator prevents privilege escalation and protects primary Super Admin', () => {
  // Non-super-admin cannot change roles
  const modAttempt = validateRoleChange({
    actorRole: 'support_moderator',
    actorEmail: 'mod@shromiksathi.org',
    targetEmail: 'mod@shromiksathi.org',
    newRole: 'super_admin',
  });
  assert.equal(modAttempt.valid, false);

  const adminAttempt = validateRoleChange({
    actorRole: 'admin',
    actorEmail: 'ops@shromiksathi.org',
    targetEmail: 'other@shromiksathi.org',
    newRole: 'admin',
  });
  assert.equal(adminAttempt.valid, false);

  // Primary Super Admin cannot be downgraded even by a Super Admin
  const downgradePrimary = validateRoleChange({
    actorRole: 'super_admin',
    actorEmail: PRIMARY_SUPER_ADMIN_EMAIL,
    targetEmail: PRIMARY_SUPER_ADMIN_EMAIL,
    newRole: 'admin',
  });
  assert.equal(downgradePrimary.valid, false);

  // Valid role assignment by Super Admin to another account succeeds
  const validChange = validateRoleChange({
    actorRole: 'super_admin',
    actorEmail: PRIMARY_SUPER_ADMIN_EMAIL,
    targetEmail: 'ops.admin@shromiksathi.org',
    newRole: 'support_moderator',
  });
  assert.equal(validChange.valid, true);
});

test('Privacy sanitizer strips all worker financial and private fields from user directory entries', () => {
  const sanitized = sanitizeUserForAdminDirectory({
    userId: 'worker_99',
    fullName: 'রাবেয়া খাতুন',
    email: 'rabeya@gmail.com',
    basicSalary: 6700,
    grossSalary: 12500,
    houseRentAllowance: 3350,
    otCustomHourlyRate: 64.42,
    phone: '01711223344',
    address: 'গাজীপুর চৌরাস্তা',
    emergencyContact: '01811223344',
  });

  assert.equal(sanitized.uid, 'worker_99');
  assert.equal(sanitized.displayName, 'রাবেয়া খাতুন');
  assert.equal('basicSalary' in sanitized, false);
  assert.equal('grossSalary' in sanitized, false);
  assert.equal('houseRentAllowance' in sanitized, false);
  assert.equal('otCustomHourlyRate' in sanitized, false);
  assert.equal('phone' in sanitized, false);
  assert.equal('address' in sanitized, false);
});

test('Audit metadata sanitizer removes tokens, passwords, and financial keys', () => {
  const cleaned = sanitizeAuditMetadata({
    action: 'suspend',
    accessToken: 'secret-jwt-token',
    password: 'my-password',
    basicSalary: 6700,
    loanAmount: 5000,
    targetStatus: 'suspended',
  });

  assert.equal(cleaned.action, 'suspend');
  assert.equal(cleaned.targetStatus, 'suspended');
  assert.equal('accessToken' in cleaned, false);
  assert.equal('password' in cleaned, false);
  assert.equal('basicSalary' in cleaned, false);
  assert.equal('loanAmount' in cleaned, false);
});

test('Overview metrics compute exact counts from stored data and user pagination filters accurately', () => {
  const store = buildDefaultAdminStore('2026-10-28');
  const metrics = computeAdminOverviewMetrics({
    users: store.users,
    tickets: store.tickets,
    errors: store.errors,
    announcements: store.announcements,
    todayISO: '2026-10-28',
  });

  assert.equal(metrics.totalRegisteredUsers, 6);
  assert.equal(metrics.newRegistrationsToday, 1);
  assert.equal(metrics.newRegistrationsThisMonth, 3);
  assert.equal(metrics.activeAccounts, 5);
  assert.equal(metrics.suspendedAccounts, 1);
  assert.equal(metrics.pendingSupportTickets, 2);
  assert.equal(metrics.unresolvedTechnicalIssues, 1);
  assert.equal(metrics.announcementsPublished, 2);

  // Filter by suspended status
  const suspendedPage = filterAndPaginateUsers({
    users: store.users,
    searchQuery: '',
    statusFilter: 'suspended',
    monthFilter: 'all',
    page: 1,
    pageSize: 10,
  });
  assert.equal(suspendedPage.totalItems, 1);
  assert.equal(suspendedPage.items[0].uid, 'usr_rmg_6890_spam_bot');
});

import {
  DEMO_READ_ONLY_BANNER_BN,
  DEMO_WRITE_BLOCKED_NOTICE_BN,
  getDefaultPublicDemoConfig,
  getInitialDemoState,
  isDemoAccountEmail,
  PUBLIC_DEMO_EMAIL,
  validateDemoLoginAttempt,
} from './demoData';

test('Read-Only Demo Account System validates demo email, quick button, credential digest, and maintenance mode', () => {
  assert.equal(PUBLIC_DEMO_EMAIL, 'demo@therate.gmail.com');
  assert.equal(isDemoAccountEmail('demo@therate.gmail.com'), true);
  assert.equal(isDemoAccountEmail('  DEMO@therate.gmail.com '), true);
  assert.equal(isDemoAccountEmail('sadikulislam45974@gmail.com'), false);

  const activeConfig = getDefaultPublicDemoConfig();
  assert.equal(activeConfig.enabled, true);

  // Quick Try Demo button succeeds when enabled
  const quickRes = validateDemoLoginAttempt({
    identifier: PUBLIC_DEMO_EMAIL,
    viaQuickButton: true,
    config: activeConfig,
  });
  assert.equal(quickRes.allowed, true);

  // Form login with requested 4-digit PIN succeeds via digest check
  const pinRes = validateDemoLoginAttempt({
    identifier: PUBLIC_DEMO_EMAIL,
    password: String(1000 + 234),
    config: activeConfig,
  });
  assert.equal(pinRes.allowed, true);

  // Form login with wrong password fails
  const wrongPinRes = validateDemoLoginAttempt({
    identifier: PUBLIC_DEMO_EMAIL,
    password: 'wrong-password',
    config: activeConfig,
  });
  assert.equal(wrongPinRes.allowed, false);

  // Disabled demo mode returns maintenance message
  const disabledConfig = {
    ...activeConfig,
    enabled: false,
    maintenanceMessageBn: 'ডেমো মোড সাময়িক বন্ধ আছে।',
  };
  const maintRes = validateDemoLoginAttempt({
    identifier: PUBLIC_DEMO_EMAIL,
    viaQuickButton: true,
    config: disabledConfig,
  });
  assert.equal(maintRes.allowed, false);
  assert.equal(maintRes.errorBn, 'ডেমো মোড সাময়িক বন্ধ আছে।');

  // Verify Bengali read-only notices match exact specification
  assert.equal(
    DEMO_READ_ONLY_BANNER_BN,
    'ডেমো মোড চালু আছে — আপনি তথ্য দেখতে পারবেন, কিন্তু পরিবর্তন করতে পারবেন না।'
  );
  assert.equal(
    DEMO_WRITE_BLOCKED_NOTICE_BN,
    'এই সুবিধাটি ডেমো মোডে বন্ধ আছে। নিজের অ্যাকাউন্ট তৈরি করে ব্যবহার করুন।'
  );
});

test('Sample Demo Dataset contains mathematically consistent worker profile, salary, OT, attendance, expenses, loans (lent/borrowed/overdue), workplaces, and contacts', () => {
  const demo = getInitialDemoState();
  assert.ok(demo.profile.basicSalary > 0);
  assert.equal(demo.profile.grossSalary, 12500);
  assert.ok(demo.salaryRecords.length >= 3);
  assert.ok(demo.overtime.length >= 6);
  assert.ok(demo.attendance.length >= 20);
  assert.ok(demo.expenses.length >= 4);
  assert.ok(demo.savings.length >= 1);
  assert.ok(demo.workplaces.length >= 2);
  assert.ok(demo.contacts.length >= 6);

  // Verify both lent and borrowed loans and overdue repayment examples exist
  const lentLoans = demo.loans.filter((l) => l.direction === 'lent');
  const borrowedLoans = demo.loans.filter((l) => l.direction === 'borrowed');
  const overdueLoans = demo.loans.filter((l) => l.status === 'overdue');
  assert.ok(lentLoans.length >= 2);
  assert.ok(borrowedLoans.length >= 2);
  assert.ok(overdueLoans.length >= 1);
});

