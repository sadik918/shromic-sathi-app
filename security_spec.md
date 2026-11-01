# Shromik Sathi — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Strict Worker Ownership Invariant**: Every worker profile (`/users/{userId}`) and all subcollection records (`overtime`, `salaryRecords`, `payments`, `attendance`, `expenses`, `savings`, `documents`, `reminders`) belong exclusively to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **Relational Parent Gate Invariant**: No subcollection document under `/users/{userId}/{sub}/{id}` can be created, updated, read (single doc), or deleted unless the parent `/users/{userId}` document exists and its `userId` matches `request.auth.uid`.
3. **Zero Cross-Worker PII or Financial Exposure**: Neither other workers nor administrators have blanket read access to `/users/{userId}` or any financial/document subcollection. Administrators can only view and resolve `/feedback/{feedbackId}` items.
4. **Temporal & Identity Immutability**: `userId` and `createdAt` are immutable across all updates (`incoming().userId == existing().userId && incoming().createdAt == existing().createdAt`). `createdAt` (on create) and `updatedAt` (on create and update) must equal `request.time`.
5. **Volumetric & Schema Guard**: Every string field enforces strict `.size() <= maxLength` matching `firebase-blueprint.json`. Document IDs must match `^[a-zA-Z0-9_\-]+$` with `.size() <= 128`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Identity Spoofing (Profile Creation)**: Authenticated user `worker_A` attempts to create `/users/worker_B` or sets `userId: "worker_B"`. -> `PERMISSION_DENIED`
2. **Unverified Email Spoofing**: User with `email: "sadikulislam45974@gmail.com"` but `email_verified: false` attempts to read/write `/feedback/fb_1` as admin or write `/users/u1`. -> `PERMISSION_DENIED`
3. **Shadow Field Injection (Overtime)**: User creates `/users/u1/overtime/ot_1` with an extra undeclared field `isPayrollApproved: true`. -> `PERMISSION_DENIED`
4. **Orphaned Subcollection Write**: User `u1` attempts to create `/users/u1/overtime/ot_1` before `/users/u1` profile document exists. -> `PERMISSION_DENIED`
5. **Cross-Tenant Subcollection Read (PII/Salary Leak)**: User `u2` attempts `get` or `list` on `/users/u1/salaryRecords`. -> `PERMISSION_DENIED`
6. **Immutable Field Mutation**: User `u1` updates `/users/u1/payments/pay_1` and alters `createdAt` or `userId`. -> `PERMISSION_DENIED`
7. **Client Timestamp Forgery**: User `u1` sends a backdated `updatedAt` timestamp not equal to `request.time`. -> `PERMISSION_DENIED`
8. **ID Poisoning Attack**: User `u1` attempts to create `/users/u1/expenses/bad$id!with spaces` or a 200-char ID. -> `PERMISSION_DENIED`
9. **Value Poisoning (Denial of Wallet)**: User `u1` updates `notes` on an overtime record with a 10,000-character string (exceeding `maxLength: 300`). -> `PERMISSION_DENIED`
10. **Enum Bypass Attack**: User `u1` creates an attendance record with `status: "hacked_status"`. -> `PERMISSION_DENIED`
11. **Terminal State Bypass on Feedback**: Non-admin user attempts to reopen a `resolved` feedback document or modify another worker's feedback. -> `PERMISSION_DENIED`
12. **Document Vault Oversize Payload**: User `u1` uploads a `VaultDocument` with `fileData` exceeding `750000` characters or negative `fileSize`. -> `PERMISSION_DENIED`

## 3. Red Team Audit & Conflict Report

| Collection | Identity Spoofing | State Shortcutting | Resource / Value Poisoning | `isValid[Entity]` in Update | Audit Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/users/{userId}` | Blocked (`userId == request.auth.uid`) | N/A | Blocked (all strings size-bounded) | Present at root of `allow update` | PASS |
| `/users/{userId}/overtime/{overtimeId}` | Blocked (Owner + Parent Gate) | N/A | Blocked (`notes <= 300`, numeric bounds) | Present at root of `allow update` | PASS |
| `/users/{userId}/salaryRecords/{salaryId}` | Blocked (Owner + Parent Gate) | N/A | Blocked (`notes <= 400`, numeric bounds) | Present at root of `allow update` | PASS |
| `/users/{userId}/payments/{paymentId}` | Blocked (Owner + Parent Gate) | N/A | Blocked (`referenceNote <= 300`, enum check) | Present at root of `allow update` | PASS |
| `/users/{userId}/attendance/{attendanceId}` | Blocked (Owner + Parent Gate) | N/A | Blocked (enum + string bounds) | Present at root of `allow update` | PASS |
| `/users/{userId}/expenses/{expenseId}` | Blocked (Owner + Parent Gate) | N/A | Blocked (enum + `description <= 250`) | Present at root of `allow update` | PASS |
| `/users/{userId}/savings/{savingId}` | Blocked (Owner + Parent Gate) | N/A | Blocked (`title <= 120`, `notes <= 250`) | Present at root of `allow update` | PASS |
| `/users/{userId}/documents/{docId}` | Blocked (Owner + Parent Gate) | N/A | Blocked (`fileData <= 750000`, `fileSize <= 524288`) | Present at root of `allow update` | PASS |
| `/users/{userId}/reminders/{reminderId}` | Blocked (Owner + Parent Gate) | N/A | Blocked (`title <= 150`, `notes <= 250`) | Present at root of `allow update` | PASS |
| `/feedback/{feedbackId}` | Blocked (`userId == request.auth.uid`) | Terminal lock on `resolved` for non-admins | Blocked (`message <= 1000`) | Present at root of `allow update` | PASS |
