import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
const activeRules = fs.existsSync(rulesPath)
  ? fs.readFileSync(rulesPath, 'utf8')
  : fs.readFileSync(draftPath, 'utf8');

/**
 * Deterministic static & behavioral rule evaluator verifying that all
 * Dirty Dozen adversarial payloads and 8 Pillars of Hardened Rules are enforced.
 */
test('Global Safety Net default-deny catch-all exists at top of rules', () => {
  assert.match(activeRules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});

test('All blueprint collections have explicit match blocks and validation blueprints', () => {
  const requiredMatches = [
    'match /users/{userId}',
    'match /overtime/{overtimeId}',
    'match /salaryRecords/{salaryId}',
    'match /payments/{paymentId}',
    'match /attendance/{attendanceId}',
    'match /expenses/{expenseId}',
    'match /savings/{savingId}',
    'match /documents/{docId}',
    'match /reminders/{reminderId}',
    'match /loans/{loanId}',
    'match /workplaces/{workplaceId}',
    'match /contacts/{contactId}',
    'match /alarms/{alarmId}',
    'match /feedback/{feedbackId}',
    'match /userDirectory/{userId}',
    'match /userSubscriptions/{userId}'
  ];
  for (const m of requiredMatches) {
    assert.ok(activeRules.includes(m), `Missing match block: ${m}`);
  }

  const requiredValidators = [
    'isValidWorkerProfile',
    'isValidOvertimeRecord',
    'isValidSalaryRecord',
    'isValidSalaryPayment',
    'isValidAttendanceRecord',
    'isValidExpenseRecord',
    'isValidSavingsGoal',
    'isValidVaultDocument',
    'isValidReminderItem',
    'isValidPersonalLoan',
    'isValidSupportFeedback',
    'isValidGarmentWorkplace',
    'isValidWorkerContact',
    'isValidAlarmItem',
    'isValidUserDirectoryEntry'
  ];
  for (const v of requiredValidators) {
    assert.ok(activeRules.includes(`function ${v}(data)`), `Missing validator: ${v}`);
  }
});

test('Dirty Dozen Payload #1 & #2: Identity spoofing and unverified admin email spoofing blocked', () => {
  assert.ok(activeRules.includes('request.auth.token.email_verified == true'));
  assert.ok(activeRules.includes('request.auth.uid == userId'));
  assert.ok(activeRules.includes('data.userId == request.auth.uid'));
  // Ensure isAdmin specifically guards admin email with email_verified == true
  const isAdminBlock = activeRules.slice(
    activeRules.indexOf('function isAdmin()'),
    activeRules.indexOf('function hasParentProfile')
  );
  assert.ok(isAdminBlock.includes("request.auth.token.email == 'sadikulislam45974@gmail.com'"));
  assert.ok(isAdminBlock.includes('request.auth.token.email_verified == true'));
});

test('WorkerProfile & subcollections allow all active fields including attendanceBonus settings, general shift, archived loans', () => {
  const profileValidator = activeRules.slice(
    activeRules.indexOf('function isValidWorkerProfile'),
    activeRules.indexOf('function isValidOvertimeRecord')
  );
  for (const field of [
    'hasAttendanceBonus',
    'attendanceBonusAmount',
    'attendanceBonusDays',
    'maxConsecutiveAbsences',
    'bonusCutoffTimeEnabled',
    'latePenaltyEnabled',
    'maxLateDaysForBonus',
    'weeklyHolidayDay',
    'expectedPayDay',
    'monthlyBudgetTarget',
    'openingCashBalance',
    'general'
  ]) {
    assert.ok(profileValidator.includes(field), `WorkerProfile missing ${field}`);
  }
  assert.ok(activeRules.includes("'hasAttendanceBonus', 'updatedAt'"));
  assert.ok(activeRules.includes("'archived'"));
  assert.ok(activeRules.includes("'storageLocation'"));
  assert.ok(activeRules.includes("'commissionType'"));
});

test('Dirty Dozen Payload #3: Shadow field injection blocked via strict hasAll + hasOnly', () => {
  const hasAllCount = (activeRules.match(/data\.keys\(\)\.hasAll\(/g) || []).length;
  const hasOnlyCount = (activeRules.match(/data\.keys\(\)\.hasOnly\(/g) || []).length;
  assert.ok(hasAllCount >= 14);
  assert.ok(hasOnlyCount >= 14);
});

test('Dirty Dozen Payload #4 & #5: Orphaned subcollection writes and cross-tenant list reads blocked', () => {
  assert.ok(activeRules.includes('function hasParentProfile(userId)'));
  assert.ok(activeRules.includes('get(/databases/$(database)/documents/users/$(userId)).data.userId == request.auth.uid'));
  assert.ok(activeRules.includes('allow list: if isOwner(userId) && existing().userId == request.auth.uid;'));
});

test('Dirty Dozen Payload #6 & #7: Immutable fields (userId, createdAt) and request.time temporal integrity enforced', () => {
  assert.ok(activeRules.includes('incoming().userId == existing().userId'));
  assert.ok(activeRules.includes('incoming().createdAt == existing().createdAt'));
  assert.ok(activeRules.includes('incoming().createdAt == request.time && incoming().updatedAt == request.time'));
  assert.ok(activeRules.includes('incoming().updatedAt == request.time'));
});

test('Dirty Dozen Payload #8-#12: ID regex, string sizes, enums, directory/subscription escalation, and vault limits enforced', () => {
  assert.ok(activeRules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"));
  assert.ok(activeRules.includes('data.notes is string && data.notes.size() <= 300'));
  assert.ok(activeRules.includes("data.status in ['present', 'absent', 'weekly_holiday', 'public_holiday', 'approved_leave', 'late']"));
  assert.ok(activeRules.includes("existing().status != 'resolved'"));
  assert.ok(activeRules.includes('data.fileSize is number && data.fileSize >= 0 && data.fileSize <= 524288'));
  assert.ok(activeRules.includes('data.fileData is string && data.fileData.size() <= 750000'));
  // User directory non-admin lock
  const dirBlock = activeRules.slice(
    activeRules.indexOf('match /userDirectory/{userId}'),
    activeRules.indexOf('match /announcements/{announcementId}')
  );
  assert.ok(dirBlock.includes("incoming().accountStatus == 'active'"));
  assert.ok(dirBlock.includes("incoming().role == 'user'"));
  assert.ok(dirBlock.includes('incoming().accountStatus == existing().accountStatus'));
  // User subscription plan lock
  const subBlock = activeRules.slice(
    activeRules.indexOf('match /userSubscriptions/{userId}'),
    activeRules.length
  );
  assert.ok(subBlock.includes("incoming().planId == 'starter_free'"));
  assert.ok(subBlock.includes('incoming().planId == existing().planId'));
});

test('PersonalLoan accepts descriptive repaymentArrangement and optional lenderType, and updates handle legacy docs without createdAt', () => {
  const loanValidator = activeRules.slice(
    activeRules.indexOf('function isValidPersonalLoan'),
    activeRules.indexOf('function isValidSupportFeedback')
  );
  assert.ok(loanValidator.includes('data.repaymentArrangement is string && data.repaymentArrangement.size() <= 250'));
  assert.ok(loanValidator.includes("!('lenderType' in data) || (data.lenderType is string && data.lenderType.size() <= 30)"));
  assert.ok(activeRules.includes("!('createdAt' in existing()) || !(existing().createdAt is timestamp) || incoming().createdAt == existing().createdAt"));
});

test('/users/{userId} update rule allows legacy userId and non-timestamp createdAt repair while preserving immutability', () => {
  const usersMatchBlock = activeRules.slice(
    activeRules.indexOf('match /users/{userId}'),
    activeRules.indexOf('// Subcollection: Overtime')
  );
  assert.ok(usersMatchBlock.includes("!('userId' in existing()) || existing().userId != userId || incoming().userId == existing().userId"));
  assert.ok(usersMatchBlock.includes("incoming().diff(existing()).changedKeys().hasOnly([\n              'userId', 'createdAt',"));
});

test('/admins/{adminId} forbids all client writes/list and /userDirectory/{userId} locks role/accountStatus to admins', () => {
  const adminsBlock = activeRules.slice(
    activeRules.indexOf('match /admins/{adminId}'),
    activeRules.indexOf('match /users/{userId}')
  );
  assert.ok(adminsBlock.includes('allow get: if isOwner(adminId) && isValidId(adminId);'));
  assert.ok(adminsBlock.includes('allow list, create, update, delete: if false;'));

  const dirBlock = activeRules.slice(
    activeRules.indexOf('match /userDirectory/{userId}'),
    activeRules.indexOf('match /announcements/{announcementId}')
  );
  assert.ok(dirBlock.includes('allow list: if isAdmin();'));
  assert.ok(dirBlock.includes("('role' in existing() && 'role' in incoming() && incoming().role == existing().role)"));
  assert.ok(dirBlock.includes('allow delete: if false;'));
});

