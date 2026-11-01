# Implementation Plan — Personal Loan, Debt & Transaction Management ("ধার-দেনা ও ঋণ হিসাব")

## 1. Data Model & Types (`src/types.ts`)
- Enhance `PersonalLoan` and define `LoanRepayment` interface with full fields:
  - `personName`, `contactNumber`, `direction` (`'lent'` | `'borrowed'`), `originalAmount`, `transactionDate`, `expectedRepaymentDate`, `reason`, `repaymentArrangement`, `notes`, `installmentAmount`, `repaymentFrequency`, `nextInstallmentDate`, `reminderEnabled`, `status` (`'pending'` | `'partially_repaid'` | `'fully_settled'` | `'archived'`), and `repayments` array (`LoanRepayment[]`).
  - Keep backward-compatibility fields (`title`, `lenderType`, `totalLoanAmount`, `paidAmount`) so existing data remains safe and functional.

## 2. Calculation Utilities & Demo Data (`src/utils/calculations.ts` & `src/utils/demoData.ts`)
- Add loan summary calculator:
  - `I Will Receive` (আমি পাব - total outstanding lent balance).
  - `I Will Repay` (আমি দেব - total outstanding borrowed balance).
  - `Received This Month` (এই মাসে পেয়েছি).
  - `Paid This Month` (এই মাসে দিয়েছি).
- Add loan status evaluator: detects `due_today`, `overdue`, `partially_repaid`, `fully_settled`, `pending`.
- Seed rich Bangladeshi garment worker demo transactions for lent and borrowed records with repayment logs.

## 3. Context & Persistence Engine (`src/context/DataContext.tsx`)
- Implement:
  - `saveLoan`: Create or update loan.
  - `addLoanRepayment`: Add installment, validate repayment amount against remaining balance, recalculate remaining balance automatically, update status (`fully_settled` when remaining = 0), and update local mirror + Firestore.
  - `deleteLoanRepayment`: Remove repayment entry and recalculate balance/status.
  - `settleLoan` / `archiveLoan`: Explicit full settlement or archival.
  - `deleteLoan`: Reversible deletion with history log.

## 4. Main Component (`src/components/PersonalLoanView.tsx`)
- Build a responsive, mobile-first Bengali UI:
  1. **Dashboard Summary Cards**: 4 summary cards for Receive, Repay, Received This Month, Paid This Month in ৳ BDT.
  2. **Main Tabs**:
     - **টাকা পাব (Money Others Owe Me)**: List of lent records, progress bars, "+ নতুন টাকা পাব" form.
     - **টাকা দেব (Money I Owe Others)**: List of borrowed records, progress bars, "+ নতুন ধার নিয়েছি" form.
     - **আজকের পাওনা ও বকেয়া (Upcoming & Overdue)**: Focus on due today & overdue items.
     - **ব্যক্তিভিত্তিক লেজার (Person-Wise Ledger)**: Searchable ledger by person name, showing lent, borrowed, repayments, net balance.
     - **রিপোর্ট ও এক্সপোর্ট (Reports & Export)**: Export to CSV and Print/PDF.
  3. **Detailed Loan Drawer / Modal**: Complete chronological repayment timeline, "+ পরিশোধ যোগ করুন" modal, edit & settlement actions, audit history.
  4. **Reminders & PWA Notifications**: In-app notifications & permission toggle.

## 5. Hub Integration & Security Rules (`src/components/MoreHubView.tsx` & `firestore.rules`)
- Integrate "ধার-দেনা ও ঋণ হিসাব" into `MoreHubView.tsx` under Finance & Loans tab or as a dedicated section.
- Update `isValidPersonalLoan` in `firestore.rules` and `firebase-blueprint.json` to allow new loan fields while maintaining strict user ownership (`request.auth.uid == userId`).
