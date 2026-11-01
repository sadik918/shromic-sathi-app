export type SubscriptionPlanTier = 'starter_free' | 'pro' | 'pro_vip' | 'custom';
export type BillingDuration = 'monthly' | 'yearly' | 'lifetime' | 'custom';
export type PlanStatus = 'draft' | 'published' | 'archived';

export function toBengaliDigits(n: number | string): string {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(n).replace(/\d/g, (d) => bn[Number(d)] || d);
}

export type SubscriptionStatus =
  | 'free'
  | 'active'
  | 'pending'
  | 'expired'
  | 'cancelled'
  | 'suspended'
  | 'complimentary';

export type FeatureKey =
  | 'salary'
  | 'overtime'
  | 'attendance'
  | 'expenses'
  | 'savings'
  | 'loans'
  | 'workplace'
  | 'contacts'
  | 'reports'
  | 'vault'
  | 'voice_entry'
  | 'calculator';

export interface PlanFeatureRule {
  enabled: boolean;
  maxRecords?: number | null; // null or undefined means unlimited
  allowExport?: boolean;
  allowAdvanced?: boolean;
  customRestrictionNoteBn?: string;
  customRestrictionNoteEn?: string;
}

export interface CouponCode {
  id: string;
  code: string; // e.g. 'SHROMIK50'
  discountType: 'percentage' | 'fixed_bdt';
  discountValue: number;
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: string | null; // YYYY-MM-DD
  isActive: boolean;
  applicablePlanId?: string; // 'all' or specific plan ID e.g. 'pro', 'pro_vip'
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionPaymentRequest {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  amountBdt: number;
  discountAmountBdt?: number;
  finalAmountBdt?: number;
  couponCode?: string;
  isRenewal?: boolean;
  paymentMethod: 'bkash' | 'nagad' | 'bank' | 'manual';
  transactionId: string;
  senderPhone: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  verifiedAt?: string;
  verifiedByAdminUid?: string;
  adminNotes?: string;
  notes?: string;
}

export interface SubscriptionAuditLog {
  id: string;
  timestamp: string;
  actorUid: string;
  action: string;
  targetId: string;
  details?: Record<string, unknown>;
}

export interface FeatureAccessCheckResult {
  allowed: boolean;
  reasonBn?: string;
  reasonEn?: string;
  upgradeRequired?: boolean;
  maxRecords?: number | null;
  currentCount?: number;
  currentQuota?: number;
}

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionPlanTier;
  nameBn: string;
  nameEn: string;
  descriptionBn: string;
  descriptionEn: string;
  priceBDT: number; // 0 for Starter Free
  billingDuration: BillingDuration;
  displayOrder: number;
  status: PlanStatus;
  isPopular?: boolean;
  badgeTextBn?: string;
  badgeTextEn?: string;
  benefitsBn: string[];
  benefitsEn: string[];
  limitationsBn: string[];
  limitationsEn: string[];
  features: Record<FeatureKey, PlanFeatureRule>;
  // UI & convenience aliases
  pricing: {
    isFree: boolean;
    monthlyPriceBdt: number;
    yearlyPriceBdt: number;
    currency: string;
  };
  durationDays?: number;
  billingCycle?: BillingDuration;
  featureMatrix?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSubscriptionRecord {
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate?: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  gracePeriodDays?: number;
  isComplimentary?: boolean;
  paymentMethod?: 'bkash' | 'nagad' | 'rocket' | 'bank' | 'cash' | 'complimentary' | 'manual';
  paymentReference?: string;
  requestedPlanId?: string;
  grantedByAdminUid?: string;
  grantedByAdminEmail?: string;
  grantedReason?: string;
  complimentaryReason?: string;
  notes?: string;
  activePlanId?: string;
  tier?: SubscriptionPlanTier;
  userEmail?: string;
  userDisplayName?: string;
  billingCycle?: BillingDuration | 'monthly' | 'yearly' | 'custom' | 'lifetime';
  startedAt?: string;
  expiresAt?: string | null;
  pendingRequest?: SubscriptionPaymentRequest;
  paymentHistory?: SubscriptionPaymentRequest[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GlobalSubscriptionConfig {
  enabled: boolean; // Master Switch
  renewalWarningDays?: number; // Days before expiration to show renewal notice (default: 5)
  defaultPlanId: string;
  gracePeriodDays: number;
  paymentInstructionsBn: string;
  paymentNumberBkash: string;
  paymentNumberNagad: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SubFeatureMeta {
  key: string;
  nameBn: string;
  nameEn: string;
  descriptionBn?: string;
  descriptionEn?: string;
}

export interface FeatureMeta {
  key: FeatureKey;
  nameBn: string;
  nameEn: string;
  descriptionBn: string;
  descriptionEn: string;
  supportsRecordLimit: boolean;
  supportsExport: boolean;
  supportsAdvanced: boolean;
  subFeatures: SubFeatureMeta[];
}

export function formatBdtPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || price === 0) return 'ফ্রি (৳০)';
  return `৳${toBengaliDigits(price)}`;
}

export function getBengaliPlanName(idOrTier: string): string {
  switch (idOrTier) {
    case 'starter_free':
      return 'Starter Free (ফ্রি)';
    case 'pro':
      return 'Pro (প্রো)';
    case 'pro_vip':
      return 'Pro VIP (ভিআইপি)';
    default:
      return idOrTier;
  }
}

export const APP_FEATURES_CATALOG: FeatureMeta[] = [
  {
    key: 'salary',
    nameBn: 'বেতন হিসাব ও পে-স্লিপ',
    nameEn: 'Salary Calculation & Pay Slip',
    descriptionBn: 'মূল বেতন, বাড়িভাড়া, বোনাস ও কর্তন সমন্বিত মাসিক বেতনের হিসাব',
    descriptionEn: 'Basic, allowances, bonuses, and estimated take-home pay',
    supportsRecordLimit: true,
    supportsExport: true,
    supportsAdvanced: true,
    subFeatures: [
      { key: 'allowBasicSalaryBreakdown', nameBn: 'মৌলিক বেতন ও ৫ প্রকার ভাতা বিভাজন', nameEn: 'Basic & Allowance Breakdown' },
      { key: 'allowAttendanceBonus', nameBn: 'হাজিরা বোনাস ও কাস্টম বোনাস যুক্তকরণ', nameEn: 'Attendance & Festive Bonus' },
      { key: 'allowPayslipPdf', nameBn: 'অফিসিয়াল পে-স্লিপ পিডিএফ তৈরি ও ডাউনলোড', nameEn: 'Official Pay Slip PDF Export' },
      { key: 'allowAdvanceDeduction', nameBn: 'অগ্রিম বেতন ও কিস্তি কর্তন সমন্বয়', nameEn: 'Advance Salary & Deductions' },
      { key: 'allowBulkSalaryExport', nameBn: 'সকল মাসের বেতন রেজিস্টার এক্সেল জেনারেট', nameEn: 'Monthly Salary Register Excel' },
    ],
  },
  {
    key: 'overtime',
    nameBn: 'ওভারটাইম ট্র্যাকার',
    nameEn: 'Overtime Tracking & Rates',
    descriptionBn: 'শ্রম আইন অনুযায়ী দ্বিগুণ হারে ওভারটাইম ঘণ্টা ও আয়ের হিসাব',
    descriptionEn: '2x legal overtime rate calculation and daily logs',
    supportsRecordLimit: true,
    supportsExport: true,
    supportsAdvanced: true,
    subFeatures: [
      { key: 'allowLegalDoubleRate', nameBn: 'শ্রম আইন ২০০৬ অনুযায়ী দ্বিগুণ ওভারটাইম রেট', nameEn: 'Legal 2x Overtime Rate' },
      { key: 'allowCustomHourlyRate', nameBn: 'কাস্টম ওটি টাকার হার ম্যানুয়ালি পরিবর্তন', nameEn: 'Custom Hourly Rate Override' },
      { key: 'allowShiftNightAllowance', nameBn: 'নাইট শিফট ও টিফিন এলাউন্স হিসাব', nameEn: 'Night Shift & Tiffin Allowance' },
      { key: 'allowOtPdfSummary', nameBn: 'দৈনিক ওটি বিবরণী পিডিএফ ডাউনলোড', nameEn: 'Daily Overtime PDF Summary' },
      { key: 'allowOtExcelExport', nameBn: 'মাসিক ওভারটাইম এন্ট্রি এক্সেল ফাইল ডাউনলোড', nameEn: 'Monthly Overtime Excel Export' },
    ],
  },
  {
    key: 'attendance',
    nameBn: 'হাজিরা ও শিফট ক্যালেন্ডার',
    nameEn: 'Attendance & Shift Calendar',
    descriptionBn: 'দিন ও নাইট শিফট রোস্টার, উপস্থিতি বোনাস এবং ছুটির ট্র্যাকিং',
    descriptionEn: 'Day & night shift rosters, attendance bonus, and leaves',
    supportsRecordLimit: true,
    supportsExport: true,
    supportsAdvanced: true,
    subFeatures: [
      { key: 'allowShiftRoster', nameBn: 'ডে ও নাইট রোটেশন শিফট ট্র্যাকিং', nameEn: 'Day/Night Shift Rotation Roster' },
      { key: 'allowBonusCutoffTimes', nameBn: 'ডে ও নাইট শিফটের বোনাস কাট-অফ সময় সেটিং', nameEn: 'Custom Shift Bonus Cutoff Times' },
      { key: 'allowAutoPopulateHolidays', nameBn: 'সরকারি ও শুক্রবারের ছুটি অটো মার্কিং', nameEn: 'Auto-populate Govt/Friday Holidays' },
      { key: 'allowAttendanceCardExport', nameBn: 'ডিজিটাল হাজিরা কার্ড প্রিন্ট ও পিডিএফ', nameEn: 'Digital Attendance Card Print/PDF' },
    ],
  },
  {
    key: 'expenses',
    nameBn: 'মাসিক খরচ হিসাব',
    nameEn: 'Expense Tracking',
    descriptionBn: 'দৈনন্দিন পারিবারিক খরচ, খাদ্য, ঘরভাড়া ও হাতখরচের তালিকা',
    descriptionEn: 'Daily household expenses, groceries, and rent tracker',
    supportsRecordLimit: true,
    supportsExport: true,
    supportsAdvanced: false,
    subFeatures: [
      { key: 'allowDailyTracking', nameBn: 'দৈনন্দিন পারিবারিক খরচ ও ক্যাটাগরি ট্র্যাকিং', nameEn: 'Daily Household Expenses' },
      { key: 'allowMonthlyBudgetLimit', nameBn: 'মাসিক কাস্টম বাজেট সীমা', nameEn: 'Monthly Custom Budget Limit' },
      { key: 'allowReceiptUpload', nameBn: 'খরচের ভাউচার ছবি বা রসিদ যুক্তকরণ', nameEn: 'Expense Receipt Image Attachment' },
      { key: 'allowExpenseAnalytics', nameBn: 'খরচের গ্রাফিকাল ও ক্যাটাগরি রিপোর্ট', nameEn: 'Expense Analytics & Categories' },
    ],
  },
  {
    key: 'savings',
    nameBn: 'সঞ্চয় লক্ষ্যমাত্রা',
    nameEn: 'Savings Goals',
    descriptionBn: 'ভবিষ্যতের জন্য মাসিক সঞ্চয় ও জমার লক্ষ্য নির্ধারণ',
    descriptionEn: 'Monthly savings targets and emergency funds',
    supportsRecordLimit: true,
    supportsExport: false,
    supportsAdvanced: false,
    subFeatures: [
      { key: 'allowTargetSavingsGoal', nameBn: 'মাসিক সঞ্চয়ের লক্ষ্য ও প্রোগ্রেস বার', nameEn: 'Monthly Target Savings Goal' },
      { key: 'allowEmergencyFund', nameBn: 'জরুরি ফান্ডের জমা-খরচ ট্র্যাকার', nameEn: 'Emergency Fund Tracker' },
      { key: 'allowSavingsReminders', nameBn: 'সঞ্চয় জমার তাগাদা নোটিফিকেশন', nameEn: 'Savings Deposit Reminders' },
    ],
  },
  {
    key: 'loans',
    nameBn: 'ধার-দেনা ও ঋণ ট্র্যাকার',
    nameEn: 'Personal Loans & Debts',
    descriptionBn: 'সহকর্মী ও পরিবারের সাথে পাওনা টাকা ও কিস্তির হিসাব',
    descriptionEn: 'Lent and borrowed money with installment repayment tracking',
    supportsRecordLimit: true,
    supportsExport: true,
    supportsAdvanced: true,
    subFeatures: [
      { key: 'allowLentBorrowedRecords', nameBn: 'পাওনা ও দেনা টাকার তালিকা', nameEn: 'Lent & Borrowed Ledger' },
      { key: 'allowInstallmentCalculator', nameBn: 'মাসিক কিস্তি হিসাব ও পেমেন্ট হিস্ট্রি', nameEn: 'Installment & Payment History' },
      { key: 'allowLoanVoucherPdf', nameBn: 'ডিজিটাল জমার রসিদ ভাউচার জেনারেট', nameEn: 'Digital Repayment Voucher PDF' },
    ],
  },
  {
    key: 'workplace',
    nameBn: 'গার্মেন্টস তথ্য ও চাকরি ইতিহাস',
    nameEn: 'Workplace & Factory Tenure',
    descriptionBn: 'বর্তমান ও পূর্ববর্তী কারখানার সার্ভিস রেকর্ড ও বকেয়া স্ট্যাটাস',
    descriptionEn: 'Factory history, floor/line, and tenure analytics',
    supportsRecordLimit: true,
    supportsExport: true,
    supportsAdvanced: true,
    subFeatures: [
      { key: 'allowCurrentWorkplace', nameBn: 'বর্তমান কারখানার ফ্লোর, লাইন ও ডিরেক্টরি', nameEn: 'Current Workplace Directory' },
      { key: 'allowPastWorkplaceHistory', nameBn: 'অতীত কারখানার চাকরির সময়কাল ও ইতিহাস', nameEn: 'Past Workplace Service History' },
      { key: 'allowSeveranceGratuityCalc', nameBn: 'সার্ভিস বেনিফিট ও সেভারেন্স আনুমানিক হিসাব', nameEn: 'Estimated Service Benefit & Gratuity' },
    ],
  },
  {
    key: 'contacts',
    nameBn: 'কন্টাক্ট বুক ও গুগল সিঙ্ক',
    nameEn: 'Contact Book & Google Sync',
    descriptionBn: 'সুপারভাইজার, পিএম ও কলিগদের নম্বর এবং ২-মুখী গুগল ব্যাকআপ',
    descriptionEn: 'Factory contact phonebook with 2-way Google Contacts backup',
    supportsRecordLimit: true,
    supportsExport: false,
    supportsAdvanced: true,
    subFeatures: [
      { key: 'allowFactoryDirectory', nameBn: 'সুপারভাইজার, পিএম ও অফিসারদের ডিরেক্টরি', nameEn: 'Factory Officers Phonebook' },
      { key: 'allow2WayGoogleSync', nameBn: '২-মুখী গুগল কন্ট্যাক্টস অটো ক্লাউড ব্যাকআপ', nameEn: '2-Way Google Contacts Sync & Backup' },
      { key: 'allowOneTapCopyCall', nameBn: '১-ট্যাপে সরাসরি ফোনকল ও পরিষ্কার নম্বর কপি', nameEn: '1-Tap Direct Calling & Copy' },
      { key: 'allowDuplicateMerge', nameBn: 'স্বয়ংক্রিয় ডুপ্লিকেট নম্বর শনাক্ত ও মার্জ', nameEn: 'Automatic Duplicate Number Merge' },
    ],
  },
  {
    key: 'reports',
    nameBn: 'বিস্তারিত রিপোর্ট ও ডাউনলোড',
    nameEn: 'Detailed Reports & PDF/Excel',
    descriptionBn: 'মাসিক হাজিরা, বেতন ও ওভারটাইমের প্রিন্ট ও এক্সেল/পিডিএফ কপি',
    descriptionEn: 'Printable pay-slips and exported Excel/PDF summaries',
    supportsRecordLimit: false,
    supportsExport: true,
    supportsAdvanced: true,
    subFeatures: [
      { key: 'allowMonthlyPdfReport', nameBn: 'মাসিক এক নজরে সামারি রিপোর্ট', nameEn: 'Monthly Summary PDF Report' },
      { key: 'allowPayslipItemizedPdf', nameBn: 'বিস্তারিত আইটেমাইজড বেতন ও ওটি স্লিপ', nameEn: 'Itemized Salary & OT Slip PDF' },
      { key: 'allowExcelExportBulk', nameBn: 'সকল ডেটার ফাইল এক ক্লিকে এক্সেল ব্যাকআপ', nameEn: 'Bulk Data Excel Backup' },
      { key: 'allowFullJsonBackup', nameBn: 'সকল ডাটাবেসের এনক্রিপ্টেড জেএসওএন ক্লাউড ব্যাকআপ', nameEn: 'Full Encrypted JSON Cloud Backup' },
    ],
  },
  {
    key: 'vault',
    nameBn: 'ডকুমেন্ট ভল্ট (কাগজপত্র)',
    nameEn: 'Document Vault',
    descriptionBn: 'আইডি কার্ড, নিয়োগপত্র, পে-স্লিপের নিরাপদ স্টোরেজ',
    descriptionEn: 'Secure encrypted storage for factory ID card and slips',
    supportsRecordLimit: true,
    supportsExport: true,
    supportsAdvanced: true,
    subFeatures: [
      { key: 'allowIdCardDocument', nameBn: 'ফ্যাক্টরি আইডি কার্ড ও নিয়োগপত্রের কপি', nameEn: 'Factory ID & Appointment Letter Storage' },
      { key: 'allowMaxFileSize', nameBn: 'সর্বোচ্চ ফাইল আপলোড সাইজ (2MB / 10MB / 50MB)', nameEn: 'Max Upload File Size' },
      { key: 'allowEncryptedVault', nameBn: 'এনক্রিপ্টেড সেফ ফাইল স্টোরেজ', nameEn: 'Encrypted Safe Cloud Storage' },
    ],
  },
  {
    key: 'voice_entry',
    nameBn: 'ভয়েস / কণ্ঠস্বর এন্ট্রি',
    nameEn: 'Voice Entry Assistant',
    descriptionBn: 'মুখে বলে দ্রুত হাজিরা, ওভারটাইম ও খরচের হিসাব যুক্ত করা',
    descriptionEn: 'Bengali speech recognition for hands-free daily entries',
    supportsRecordLimit: false,
    supportsExport: false,
    supportsAdvanced: true,
    subFeatures: [
      { key: 'allowBengaliVoiceAssistance', nameBn: 'বাংলা কণ্ঠে হাজিরা ও ওটি এন্ট্রি', nameEn: 'Bengali Voice Entry Assistant' },
      { key: 'allowHandsFreeMultiField', nameBn: 'মুখে বলে সরাসরি ফরম পূরণ', nameEn: 'Hands-free Multi-field Entry' },
    ],
  },
  {
    key: 'calculator',
    nameBn: 'গার্মেন্টস শ্রম আইন ক্যালকুলেটর',
    nameEn: 'Garment Labor Law Calculator',
    descriptionBn: 'সার্ভিস বেনিফিট, মাতৃত্বকালীন ছুটি ও বকেয়া বেতন ক্যালকুলেটর',
    descriptionEn: 'Legal severance pay, maternity benefits, and notice pay',
    supportsRecordLimit: false,
    supportsExport: true,
    supportsAdvanced: false,
    subFeatures: [
      { key: 'allowLaborLawNoticePay', nameBn: 'শ্রম আইন অনুযায়ী নোটিশ পে ও লে-অফ হিসাব', nameEn: 'Labor Law Severance & Notice Pay' },
      { key: 'allowMaternityBenefitCalc', nameBn: 'মাতৃত্বকালীন ছুটির সরকারি টাকার হিসাব', nameEn: 'Maternity Benefit Government Calc' },
      { key: 'allowLegalClaimExport', nameBn: 'বকেয়া দাবিনামার প্রস্তুতকৃত আইনি ক্লেইম শিট', nameEn: 'Legal Claim Document Sheet Export' },
    ],
  },
];

export const DEFAULT_GLOBAL_SUBSCRIPTION_CONFIG: GlobalSubscriptionConfig = {
  enabled: true, // Admin Subscription Mode enabled by default
  renewalWarningDays: 5, // Show renewal warning when <= 5 days remain
  defaultPlanId: 'starter_free',
  gracePeriodDays: 7,
  paymentInstructionsBn:
    'বিকাশ অথবা নগদ অ্যাপের মাধ্যমে "Send Money" করে ট্রানজেকশন আইডি (TrxID) নিচে প্রদান করুন। অ্যাডমিন কর্তৃক যাচাইয়ের পর আপনার প্ল্যানটি সক্রিয় করা হবে।',
  paymentNumberBkash: '01XXXXXXXXX',
  paymentNumberNagad: '01XXXXXXXXX',
};

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter_free',
    tier: 'starter_free',
    nameBn: 'স্টার্টার ফ্রি',
    nameEn: 'Starter Free',
    descriptionBn: 'সকল নতুন ও সাধারণ শ্রমিকদের জন্য আজীবন বিনামূল্যে ব্যবহার্য বেসিক প্ল্যান',
    descriptionEn: 'Free lifetime plan for every garment worker with standard daily tracking',
    priceBDT: 0,
    billingDuration: 'lifetime',
    displayOrder: 1,
    status: 'published',
    isPopular: false,
    badgeTextBn: 'আজীবন ফ্রি',
    badgeTextEn: 'Free Forever',
    benefitsBn: [
      'মাসিক মূল বেতন ও ওভারটাইমের হিসাব',
      'দৈনিক হাজিরা ও ওটি এন্ট্রি (প্রতি মাসে সর্বোচ্চ ৬০টি রেকর্ড)',
      'জরুরি হটলাইন ও জরুরি ফোনবুক (সর্বোচ্চ ২০টি কন্ট্যাক্ট)',
      'ব্যক্তিগত খরচ ও ধার-দেনা ট্র্যাকার',
      'শ্রম আইন ভিত্তিক ওভারটাইম রেট ক্যালকুলেটর',
    ],
    benefitsEn: [
      'Basic monthly salary & overtime calculations',
      'Up to 60 daily records per month',
      'Factory emergency contacts (up to 20)',
      'Household expense & loan tracker',
      'Bangladesh Labor Act rate calculator',
    ],
    limitationsBn: [
      'উন্নত পিডিএফ ও এক্সেল রিপোর্ট ডাউনলোড সীমাবদ্ধ',
      'ডকুমেন্ট ভল্টে সর্বোচ্চ ৩টি ফাইল',
      'গুগল কন্ট্যাক্টস ২-মুখী ক্লাউড ব্যাকআপ বন্ধ',
    ],
    limitationsEn: [
      'PDF & Excel export limited',
      'Maximum 3 files in document vault',
      'Google contacts cloud backup restricted',
    ],
    features: {
      salary: { enabled: true, maxRecords: 24, allowExport: false, allowAdvanced: false },
      overtime: { enabled: true, maxRecords: 60, allowExport: false, allowAdvanced: false },
      attendance: { enabled: true, maxRecords: 60, allowExport: false, allowAdvanced: false },
      expenses: { enabled: true, maxRecords: 50, allowExport: false, allowAdvanced: false },
      savings: { enabled: true, maxRecords: 3, allowExport: false, allowAdvanced: false },
      loans: { enabled: true, maxRecords: 10, allowExport: false, allowAdvanced: false },
      workplace: { enabled: true, maxRecords: 2, allowExport: false, allowAdvanced: false },
      contacts: { enabled: true, maxRecords: 20, allowExport: false, allowAdvanced: false },
      reports: { enabled: true, allowExport: false, allowAdvanced: false },
      vault: { enabled: true, maxRecords: 3, allowExport: false, allowAdvanced: false },
      voice_entry: { enabled: true, allowAdvanced: false },
      calculator: { enabled: true, allowExport: false },
    },
    pricing: {
      isFree: true,
      monthlyPriceBdt: 0,
      yearlyPriceBdt: 0,
      currency: 'BDT',
    },
    featureMatrix: {
      salary: { enabled: true, allowed: true, maxRecords: 24 },
      overtime: { enabled: true, allowed: true, maxRecords: 60 },
      attendance: { enabled: true, allowed: true, maxRecords: 60 },
      expenses: { enabled: true, allowed: true, maxRecords: 50 },
      savings: { enabled: true, allowed: true, maxRecords: 3 },
      loans: { enabled: true, allowed: true, maxRecords: 10 },
      workplace: { enabled: true, allowed: true, maxRecords: 2 },
      contacts: { enabled: true, allowed: true, maxRecords: 20 },
      reports: { enabled: true, allowed: true, maxRecords: -1 },
      vault: { enabled: true, allowed: true, maxRecords: 3 },
      voice_entry: { enabled: true, allowed: true, maxRecords: -1 },
      calculator: { enabled: true, allowed: true, maxRecords: -1 },
    },
  },
  {
    id: 'pro',
    tier: 'pro',
    nameBn: 'প্রো প্ল্যান',
    nameEn: 'Pro Plan',
    descriptionBn: 'উন্নত বেতন স্লিপ ডাউনলোড, আনলিমিটেড এন্ট্রি ও ক্লাউড ব্যাকআপের সুবিধা',
    descriptionEn: 'Full data records, downloadable salary slips, and extended tools',
    priceBDT: 49,
    billingDuration: 'monthly',
    displayOrder: 2,
    status: 'published',
    isPopular: true,
    badgeTextBn: 'জনপ্রিয় (Best Value)',
    badgeTextEn: 'Popular',
    benefitsBn: [
      'আনলিমিটেড দৈনিক হাজিরা ও ওভারটাইম রেকর্ড',
      'অফিসিয়াল পে-স্লিপ ও হাজিরা রিপোর্ট PDF ডাউনলোড',
      'গুগল কন্ট্যাক্টস ২-মুখী স্বয়ংক্রিয় ব্যাকআপ ও সিঙ্ক',
      'ধার-দেনা ও কিস্তি পরিশোধের বিস্তারিত হিসাব',
      'ডকুমেন্ট ভল্টে সর্বোচ্চ ২৫টি গুরুত্বপূর্ণ ফাইল সেভ',
      'ডেটা এডিটিং হিস্ট্রি ও ভুল সংশোধন রিস্টোর',
    ],
    benefitsEn: [
      'Unlimited daily records and attendance',
      'Official salary slips and attendance PDF export',
      '2-way Google Contacts sync and cloud backup',
      'Detailed loan installment tracking and receipts',
      'Up to 25 files in document vault',
      'Data editing history with instant restore',
    ],
    limitationsBn: [
      'ভিআইপি প্রায়োরিটি সাপোর্ট এবং ডেডিকেটেড ব্যাকআপ এক্সপোর্ট অন্তর্ভুক্ত নয়',
    ],
    limitationsEn: [
      'VIP priority phone support and dedicated exports not included',
    ],
    features: {
      salary: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      overtime: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      attendance: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      expenses: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      savings: { enabled: true, maxRecords: 20, allowExport: true, allowAdvanced: true },
      loans: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      workplace: { enabled: true, maxRecords: 10, allowExport: true, allowAdvanced: true },
      contacts: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      reports: { enabled: true, allowExport: true, allowAdvanced: true },
      vault: { enabled: true, maxRecords: 25, allowExport: true, allowAdvanced: true },
      voice_entry: { enabled: true, allowAdvanced: true },
      calculator: { enabled: true, allowExport: true },
    },
    pricing: {
      isFree: false,
      monthlyPriceBdt: 49,
      yearlyPriceBdt: 490,
      currency: 'BDT',
    },
    featureMatrix: {
      salary: { enabled: true, allowed: true, maxRecords: -1 },
      overtime: { enabled: true, allowed: true, maxRecords: -1 },
      attendance: { enabled: true, allowed: true, maxRecords: -1 },
      expenses: { enabled: true, allowed: true, maxRecords: -1 },
      savings: { enabled: true, allowed: true, maxRecords: 20 },
      loans: { enabled: true, allowed: true, maxRecords: -1 },
      workplace: { enabled: true, allowed: true, maxRecords: 10 },
      contacts: { enabled: true, allowed: true, maxRecords: -1 },
      reports: { enabled: true, allowed: true, maxRecords: -1 },
      vault: { enabled: true, allowed: true, maxRecords: 25 },
      voice_entry: { enabled: true, allowed: true, maxRecords: -1 },
      calculator: { enabled: true, allowed: true, maxRecords: -1 },
    },
  },
  {
    id: 'pro_vip',
    tier: 'pro_vip',
    nameBn: 'প্রো ভিআইপি (VIP)',
    nameEn: 'Pro VIP Plan',
    descriptionBn: 'সর্বোচ্চ অগ্রাধিকার, আনলিমিটেড ডকুমেন্ট ভল্ট, এক্সেল এক্সপোর্ট ও প্রিমিয়াম সাপোর্ট',
    descriptionEn: 'Highest limits, unlimited document vault, Excel export, and VIP support',
    priceBDT: 99,
    billingDuration: 'monthly',
    displayOrder: 3,
    status: 'published',
    isPopular: false,
    badgeTextBn: 'সর্বোচ্চ ফিচার',
    badgeTextEn: 'VIP Access',
    benefitsBn: [
      'অ্যাপের সকল বর্তমান ও ভবিষ্যৎ ফিচার সম্পূর্ণ আনলিমিটেড',
      'এক্সেল (Excel), সিএসভি (CSV) এবং ফুল ব্যাকআপ এক্সপোর্ট',
      'আনলিমিটেড ডকুমেন্ট ভল্ট ও আইডি কার্ডের ক্লাউড কপি',
      'ভয়েস এন্ট্রি ও এআই ক্যালকুলেটরের পূর্ণ এক্সেস',
      'অ্যাডমিন ও হেল্পডেস্ক থেকে সর্বোচ্চ প্রায়োরিটি সাপোর্ট',
      'সকল কারখানার অতীতের চাকরির বিস্তারিত হিসেব ও গ্র্যাচুইটি অডিট',
    ],
    benefitsEn: [
      'Completely unlimited access to all app capabilities',
      'Excel, CSV, and full JSON data backup exports',
      'Unlimited document vault and ID storage',
      'Full voice entry and smart calculation access',
      'Highest priority administrative support',
      'Past factory severance and legal tenure audit exports',
    ],
    limitationsBn: [],
    limitationsEn: [],
    features: {
      salary: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      overtime: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      attendance: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      expenses: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      savings: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      loans: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      workplace: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      contacts: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      reports: { enabled: true, allowExport: true, allowAdvanced: true },
      vault: { enabled: true, maxRecords: null, allowExport: true, allowAdvanced: true },
      voice_entry: { enabled: true, allowAdvanced: true },
      calculator: { enabled: true, allowExport: true },
    },
    pricing: {
      isFree: false,
      monthlyPriceBdt: 99,
      yearlyPriceBdt: 990,
      currency: 'BDT',
    },
    featureMatrix: {
      salary: { enabled: true, allowed: true, maxRecords: -1 },
      overtime: { enabled: true, allowed: true, maxRecords: -1 },
      attendance: { enabled: true, allowed: true, maxRecords: -1 },
      expenses: { enabled: true, allowed: true, maxRecords: -1 },
      savings: { enabled: true, allowed: true, maxRecords: -1 },
      loans: { enabled: true, allowed: true, maxRecords: -1 },
      workplace: { enabled: true, allowed: true, maxRecords: -1 },
      contacts: { enabled: true, allowed: true, maxRecords: -1 },
      reports: { enabled: true, allowed: true, maxRecords: -1 },
      vault: { enabled: true, allowed: true, maxRecords: -1 },
      voice_entry: { enabled: true, allowed: true, maxRecords: -1 },
      calculator: { enabled: true, allowed: true, maxRecords: -1 },
    },
  },
];

export const APP_FEATURE_CATALOG = APP_FEATURES_CATALOG;

/**
 * Validates plan input fields before saving draft or publishing.
 */
export function validatePlanInput(plan: Partial<SubscriptionPlan>): { valid: boolean; errors: string[]; errorBn?: string } {
  const errors: string[] = [];

  if (!plan.nameBn || plan.nameBn.trim().length === 0) {
    errors.push('প্ল্যানের বাংলা নাম প্রদান করা আবশ্যক');
  }
  if (!plan.id || plan.id.trim().length === 0) {
    errors.push('প্ল্যান আইডি আবশ্যক');
  }
  const price = plan.pricing ? plan.pricing.monthlyPriceBdt : plan.priceBDT;
  if (typeof price === 'number' && price < 0) {
    errors.push('প্ল্যানের মূল্য অবশ্যই ০ বা তদূর্ধ্ব হতে হবে');
  }
  if (plan.tier === 'starter_free' && price !== undefined && price !== 0) {
    errors.push('স্টার্টার ফ্রি প্ল্যানের মূল্য অবশ্যই ৳০ হতে হবে');
  }

  return { valid: errors.length === 0, errors, errorBn: errors[0] };
}

/**
 * Filter published plans for user display.
 */
export function filterPublishedPlans(plans: SubscriptionPlan[]): SubscriptionPlan[] {
  return plans
    .filter((p) => p.status === 'published')
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Resolves the active subscription plan for a user.
 * CRITICAL RULE: If the master subscription system is DISABLED, returns an unrestricted mock plan.
 */
export function resolveUserActivePlan(params: {
  isSystemEnabled: boolean;
  userSub?: UserSubscriptionRecord | null;
  plans: SubscriptionPlan[];
  todayISO?: string;
}): {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isUnrestricted: boolean;
  isPaidActive: boolean;
} {
  const { isSystemEnabled, userSub, plans, todayISO = new Date().toISOString().slice(0, 10) } = params;

  // 1. SAFEGUARD: When the master subscription system is DISABLED:
  // All users have 100% UNRESTRICTED access to all existing features without paying or choosing a plan.
  if (!isSystemEnabled) {
    const vipFallback = plans.find((p) => p.tier === 'pro_vip') || DEFAULT_SUBSCRIPTION_PLANS[2];
    return {
      plan: vipFallback,
      status: 'free',
      isUnrestricted: true,
      isPaidActive: true,
    };
  }

  const starterFree =
    plans.find((p) => p.tier === 'starter_free') ||
    DEFAULT_SUBSCRIPTION_PLANS[0];

  // 2. If user has no subscription record or status is free:
  if (!userSub) {
    return {
      plan: starterFree,
      status: 'free',
      isUnrestricted: false,
      isPaidActive: false,
    };
  }

  // 3. Check expiration
  if (userSub.endDate && userSub.endDate < todayISO) {
    // Check grace period
    const graceDays = userSub.gracePeriodDays ?? 7;
    const expDate = new Date(userSub.endDate);
    const graceEndDate = new Date(expDate.getTime() + graceDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    if (todayISO > graceEndDate) {
      return {
        plan: starterFree,
        status: 'expired',
        isUnrestricted: false,
        isPaidActive: false,
      };
    }
  }

  // 4. Check active or complimentary status
  if (userSub.status === 'active' || userSub.status === 'complimentary') {
    const assignedPlan = plans.find((p) => p.id === userSub.planId) || starterFree;
    return {
      plan: assignedPlan,
      status: userSub.status,
      isUnrestricted: false,
      isPaidActive: true,
    };
  }

  // 5. Pending, cancelled, or suspended
  return {
    plan: starterFree,
    status: userSub.status || 'free',
    isUnrestricted: false,
    isPaidActive: false,
  };
}

/**
 * Checks whether a specific feature action or quota is permitted.
 */
export function canAccessFeature(params: {
  isSystemEnabled: boolean;
  userSub?: UserSubscriptionRecord | null;
  plans: SubscriptionPlan[];
  feature: FeatureKey;
  currentCount?: number;
  requireExport?: boolean;
  requireAdvanced?: boolean;
  todayISO?: string;
}): {
  allowed: boolean;
  reasonBn?: string;
  reasonEn?: string;
  upgradeRequired?: boolean;
  maxRecords?: number | null;
  currentCount?: number;
} {
  const {
    isSystemEnabled,
    userSub,
    plans,
    feature,
    currentCount,
    requireExport,
    requireAdvanced,
    todayISO,
  } = params;

  // RULE 1: Master switch disabled -> Unconditional Access!
  if (!isSystemEnabled) {
    return { allowed: true };
  }

  const { plan, isPaidActive, status } = resolveUserActivePlan({
    isSystemEnabled,
    userSub,
    plans,
    todayISO,
  });

  const rule: PlanFeatureRule = plan.features?.[feature] || {
    enabled: true,
  };

  // Feature completely disabled in this plan
  if (!rule.enabled) {
    return {
      allowed: false,
      upgradeRequired: true,
      reasonBn: `আপনার বর্তমান প্ল্যানে (${plan.nameBn}) এই ফিচারটি অন্তর্ভুক্ত নয়। ব্যবহারের জন্য প্রো প্ল্যানে আপগ্রেড করুন।`,
      reasonEn: `This feature is not available in your current plan (${plan.nameEn}). Please upgrade to unlock.`,
    };
  }

  // Export permission check
  if (requireExport && rule.allowExport === false) {
    return {
      allowed: false,
      upgradeRequired: true,
      reasonBn: `রিপোর্ট ও পে-স্লিপ ডাউনলোড বা এক্সপোর্ট সুবিধা ${plan.nameBn}-এ সীমাবদ্ধ। প্রো প্ল্যানে আনলিমিটেড ডাউনলোড করুন।`,
      reasonEn: `Export is restricted in ${plan.nameEn}. Upgrade to Pro to download records.`,
    };
  }

  // Advanced features check
  if (requireAdvanced && rule.allowAdvanced === false) {
    return {
      allowed: false,
      upgradeRequired: true,
      reasonBn: `এই উন্নত ফিচারটি ব্যবহার করতে প্রো বা প্রো ভিআইপি সাবস্ক্রিপশন প্রয়োজন।`,
      reasonEn: `This advanced capability requires a Pro or Pro VIP subscription.`,
    };
  }

  // Record quota limit check
  if (
    typeof rule.maxRecords === 'number' &&
    rule.maxRecords > 0 &&
    typeof currentCount === 'number' &&
    currentCount >= rule.maxRecords
  ) {
    return {
      allowed: false,
      upgradeRequired: true,
      maxRecords: rule.maxRecords,
      currentCount,
      reasonBn: `আপনার বর্তমান প্ল্যানে সর্বোচ্চ ${toBengaliDigits(rule.maxRecords)} টি রেকর্ড সংরক্ষণের সীমা পূর্ণ হয়েছে। অতিরিক্ত রেকর্ড যোগ করতে আপগ্রেড করুন।`,
      reasonEn: `You have reached the maximum quota of ${rule.maxRecords} records for this feature. Upgrade to add more.`,
    };
  }

  return { allowed: true, maxRecords: rule.maxRecords, currentCount };
}

/**
 * Computes administrative overview metrics for subscriptions.
 */
export function computeSubscriptionMetrics(params: {
  totalUsersCount: number;
  userSubs: Record<string, UserSubscriptionRecord>;
  plans: SubscriptionPlan[];
}): {
  totalSubscribedUsers: number;
  activeCount: number;
  pendingCount: number;
  expiredCount: number;
  complimentaryCount: number;
  planCounts: Record<string, number>;
  estimatedMonthlyRevenueBDT: number;
} {
  const { totalUsersCount, userSubs, plans } = params;

  let activeCount = 0;
  let pendingCount = 0;
  let expiredCount = 0;
  let complimentaryCount = 0;
  let estimatedMonthlyRevenueBDT = 0;

  const planCounts: Record<string, number> = {
    starter_free: 0,
    pro: 0,
    pro_vip: 0,
  };

  const records = Object.values(userSubs);

  for (const sub of records) {
    if (sub.status === 'active') activeCount++;
    if (sub.status === 'pending') pendingCount++;
    if (sub.status === 'expired') expiredCount++;
    if (sub.status === 'complimentary' || sub.isComplimentary) complimentaryCount++;

    const pId = sub.planId || 'starter_free';
    planCounts[pId] = (planCounts[pId] || 0) + 1;

    if (sub.status === 'active') {
      const matchPlan = plans.find((p) => p.id === pId);
      if (matchPlan && matchPlan.priceBDT > 0) {
        estimatedMonthlyRevenueBDT += matchPlan.priceBDT;
      }
    }
  }

  // Users without explicit records are counted on Starter Free
  const assignedTotal = Object.keys(userSubs).length;
  const unassignedCount = Math.max(0, totalUsersCount - assignedTotal);
  planCounts['starter_free'] = (planCounts['starter_free'] || 0) + unassignedCount;

  return {
    totalSubscribedUsers: assignedTotal,
    activeCount,
    pendingCount,
    expiredCount,
    complimentaryCount,
    planCounts,
    estimatedMonthlyRevenueBDT,
  };
}

export const DEFAULT_COUPON_CODES: CouponCode[] = [
  {
    id: 'coupon_shromik50',
    code: 'SHROMIK50',
    discountType: 'percentage',
    discountValue: 50,
    maxUses: 500,
    usedCount: 18,
    expiresAt: '2026-12-31',
    isActive: true,
    applicablePlanId: 'all',
    createdAt: '2026-01-01',
  },
  {
    id: 'coupon_eid2026',
    code: 'EID2026',
    discountType: 'fixed_bdt',
    discountValue: 20,
    maxUses: 200,
    usedCount: 42,
    expiresAt: '2026-12-31',
    isActive: true,
    applicablePlanId: 'pro',
    createdAt: '2026-01-01',
  },
  {
    id: 'coupon_vipbonus',
    code: 'VIPBONUS',
    discountType: 'percentage',
    discountValue: 30,
    maxUses: 100,
    usedCount: 7,
    expiresAt: '2026-12-31',
    isActive: true,
    applicablePlanId: 'pro_vip',
    createdAt: '2026-01-01',
  },
];

export function validateCouponCode(
  code: string,
  planId: string,
  amountBdt: number,
  couponsList: CouponCode[]
): {
  valid: boolean;
  discountAmountBdt: number;
  finalAmountBdt: number;
  coupon?: CouponCode;
  errorBn?: string;
} {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, discountAmountBdt: 0, finalAmountBdt: amountBdt, errorBn: 'কুপন কোড প্রদান করুন' };
  }

  const match = couponsList.find((c) => c.code.toUpperCase() === cleanCode);
  if (!match) {
    return { valid: false, discountAmountBdt: 0, finalAmountBdt: amountBdt, errorBn: 'অবৈধ বা অকার্যকর কুপন কোড' };
  }

  if (!match.isActive) {
    return { valid: false, discountAmountBdt: 0, finalAmountBdt: amountBdt, errorBn: 'এই কুপন কোডটি বর্তমানে নিষ্ক্রিয়' };
  }

  if (match.expiresAt && match.expiresAt < new Date().toISOString().slice(0, 10)) {
    return { valid: false, discountAmountBdt: 0, finalAmountBdt: amountBdt, errorBn: 'এই কুপনের মেয়াদের তারিখ শেষ' };
  }

  if (typeof match.maxUses === 'number' && match.maxUses > 0 && match.usedCount >= match.maxUses) {
    return { valid: false, discountAmountBdt: 0, finalAmountBdt: amountBdt, errorBn: 'এই কুপনের ব্যবহারের সীমা পূর্ণ হয়ে গেছে' };
  }

  if (match.applicablePlanId && match.applicablePlanId !== 'all' && match.applicablePlanId !== planId) {
    return { valid: false, discountAmountBdt: 0, finalAmountBdt: amountBdt, errorBn: 'এই কুপনটি নির্বাচিত প্ল্যানের জন্য প্রযোজ্য নয়' };
  }

  let discountAmountBdt = 0;
  if (match.discountType === 'percentage') {
    discountAmountBdt = Math.round((amountBdt * match.discountValue) / 100);
  } else {
    discountAmountBdt = match.discountValue;
  }

  discountAmountBdt = Math.min(discountAmountBdt, amountBdt);
  const finalAmountBdt = Math.max(0, amountBdt - discountAmountBdt);

  return {
    valid: true,
    discountAmountBdt,
    finalAmountBdt,
    coupon: match,
  };
}

export type SubscriptionBannerMode =
  | 'none'
  | 'no_subscription'
  | 'expiring_soon'
  | 'expired';

export interface SubscriptionRenewalNotice {
  shouldShowBanner: boolean;
  shouldShowRenewal: boolean;
  shouldShowSubscribePrompt: boolean;
  bannerMode: SubscriptionBannerMode;
  warningThresholdDays: number;
  daysRemaining: number;
  daysElapsed: number;
  totalDurationDays: number;
  planId: string;
  planNameBn: string;
  planNameEn: string;
  startDateISO: string;
  endDateISO: string;
}

function shiftDateByDaysUTC(dateISO: string, deltaDays: number): string {
  const parts = dateISO.slice(0, 10).split('-').map(Number);
  const y = parts[0] || 2026;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function diffDaysUTC(fromISO: string, toISO: string): number {
  const f = fromISO.slice(0, 10).split('-').map(Number);
  const t = toISO.slice(0, 10).split('-').map(Number);
  const fromMs = Date.UTC(f[0] || 2026, (f[1] || 1) - 1, f[2] || 1);
  const toMs = Date.UTC(t[0] || 2026, (t[1] || 1) - 1, t[2] || 1);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

/**
 * Helper to create an active subscription with specified elapsed and total days.
 */
export function createDefaultExpiringSubscription(
  userId: string,
  todayISO = new Date().toISOString().slice(0, 10),
  daysElapsed = 25,
  totalDurationDays = 30
): UserSubscriptionRecord {
  const cleanToday = todayISO.slice(0, 10);
  const daysRemaining = Math.max(0, totalDurationDays - daysElapsed);
  const startDate = shiftDateByDaysUTC(cleanToday, -daysElapsed);
  const endDate = shiftDateByDaysUTC(cleanToday, daysRemaining);
  return {
    userId: userId || 'worker_default',
    planId: 'pro',
    tier: 'pro',
    status: 'active',
    billingCycle: 'monthly',
    startDate,
    startedAt: `${startDate}T00:00:00.000Z`,
    endDate,
    expiresAt: `${endDate}T23:59:59.000Z`,
  };
}

/**
 * Main Rule for Subscription Banner & Renewal Notice:
 * 1. If Admin Master Switch is DISABLED (`!isSystemEnabled`):
 *    - Never show any banner (`shouldShowBanner: false`, `bannerMode: 'none'`).
 * 2. If Admin Master Switch is ENABLED (`isSystemEnabled === true`):
 *    - If user has NO paid subscription (`!userSub`, `status === 'free'`, or `starter_free` plan):
 *      -> Prompt user to subscribe (`shouldShowBanner: true`, `shouldShowSubscribePrompt: true`, `bannerMode: 'no_subscription'`).
 *    - If user has an active paid subscription with `daysRemaining > warningThresholdDays` (e.g. 20 days left > 5 days threshold):
 *      -> Do NOT show any banner (`shouldShowBanner: false`, `bannerMode: 'none'`).
 *    - If user has an active paid subscription within Admin's `warningThresholdDays` (`1 <= daysRemaining <= warningThresholdDays`, or `0` on expiry day):
 *      -> Show renewal warning with exact remaining days (`shouldShowBanner: true`, `shouldShowRenewal: true`, `bannerMode: 'expiring_soon'`).
 *    - If user's paid subscription has expired (`daysRemaining < 0` or `status === 'expired'`):
 *      -> Show expired renewal notice (`shouldShowBanner: true`, `shouldShowRenewal: true`, `bannerMode: 'expired'`).
 */
export function computeSubscriptionRenewalNotice(params: {
  isSystemEnabled: boolean;
  userSub?: UserSubscriptionRecord | null;
  plans: SubscriptionPlan[];
  todayISO?: string;
  warningThresholdDays?: number;
}): SubscriptionRenewalNotice {
  const {
    isSystemEnabled,
    userSub,
    plans,
    todayISO = new Date().toISOString().slice(0, 10),
    warningThresholdDays = 5,
  } = params;

  const safeThreshold = Math.max(0, Number(warningThresholdDays ?? 5));

  const emptyNotice: SubscriptionRenewalNotice = {
    shouldShowBanner: false,
    shouldShowRenewal: false,
    shouldShowSubscribePrompt: false,
    bannerMode: 'none',
    warningThresholdDays: safeThreshold,
    daysRemaining: 0,
    daysElapsed: 0,
    totalDurationDays: 30,
    planId: 'starter_free',
    planNameBn: 'স্টার্টার ফ্রি',
    planNameEn: 'Starter Free',
    startDateISO: '',
    endDateISO: '',
  };

  // RULE 1: When Master Switch is disabled in Admin Dashboard, NEVER show any banner.
  if (!isSystemEnabled) {
    return emptyNotice;
  }

  // If user already has a pending payment/upgrade/renewal request awaiting admin verification, hide banner
  if (userSub?.pendingRequest && userSub.pendingRequest.status === 'pending') {
    return emptyNotice;
  }

  const matchedPlan = userSub
    ? plans.find((p) => p.id === userSub.planId) ||
      plans.find((p) => p.tier === userSub.tier)
    : undefined;

  const isFreeOrUnsubscribed =
    !userSub ||
    userSub.status === 'free' ||
    userSub.status === 'cancelled' ||
    userSub.planId === 'starter_free' ||
    userSub.tier === 'starter_free' ||
    Boolean(matchedPlan && (matchedPlan.tier === 'starter_free' || matchedPlan.pricing?.isFree));

  // RULE 2: When Master Switch is enabled and user has NO paid subscription -> ask them to subscribe
  if (isFreeOrUnsubscribed) {
    return {
      ...emptyNotice,
      shouldShowBanner: true,
      shouldShowRenewal: false,
      shouldShowSubscribePrompt: true,
      bannerMode: 'no_subscription',
    };
  }

  const plan = matchedPlan || DEFAULT_SUBSCRIPTION_PLANS[1];

  // If user has an explicitly expired status
  if (userSub.status === 'expired' || userSub.status === 'suspended') {
    return {
      ...emptyNotice,
      shouldShowBanner: true,
      shouldShowRenewal: true,
      shouldShowSubscribePrompt: false,
      bannerMode: 'expired',
      daysRemaining: 0,
      planId: plan.id,
      planNameBn: plan.nameBn,
      planNameEn: plan.nameEn,
    };
  }

  // Lifetime paid plans never expire and do not show a renewal banner
  if (userSub.billingCycle === 'lifetime') {
    return {
      ...emptyNotice,
      planId: plan.id,
      planNameBn: plan.nameBn,
      planNameEn: plan.nameEn,
    };
  }

  const cleanToday = todayISO.slice(0, 10);
  const rawEnd = userSub.endDate || (userSub.expiresAt ? userSub.expiresAt.slice(0, 10) : '');
  const rawStart =
    userSub.startDate || (userSub.startedAt ? userSub.startedAt.slice(0, 10) : '');

  if (!rawEnd) {
    return {
      ...emptyNotice,
      planId: plan.id,
      planNameBn: plan.nameBn,
      planNameEn: plan.nameEn,
    };
  }

  const endDateISO = rawEnd.slice(0, 10);
  const startDateISO = rawStart ? rawStart.slice(0, 10) : shiftDateByDaysUTC(endDateISO, -30);

  const daysRemaining = diffDaysUTC(cleanToday, endDateISO);
  const daysElapsed = Math.max(0, diffDaysUTC(startDateISO, cleanToday));
  const totalDurationDays = Math.max(1, diffDaysUTC(startDateISO, endDateISO));

  // Already past expiration date
  if (daysRemaining <= 0) {
    return {
      shouldShowBanner: true,
      shouldShowRenewal: true,
      shouldShowSubscribePrompt: false,
      bannerMode: daysRemaining === 0 ? 'expiring_soon' : 'expired',
      warningThresholdDays: safeThreshold,
      daysRemaining: 0,
      daysElapsed,
      totalDurationDays,
      planId: plan.id,
      planNameBn: plan.nameBn,
      planNameEn: plan.nameEn,
      startDateISO,
      endDateISO,
    };
  }

  // RULE 3: Active paid subscription — ONLY show if daysRemaining <= warningThresholdDays set by Admin
  const shouldShowRenewal = daysRemaining <= safeThreshold;

  return {
    shouldShowBanner: shouldShowRenewal,
    shouldShowRenewal,
    shouldShowSubscribePrompt: false,
    bannerMode: shouldShowRenewal ? 'expiring_soon' : 'none',
    warningThresholdDays: safeThreshold,
    daysRemaining,
    daysElapsed,
    totalDurationDays,
    planId: plan.id,
    planNameBn: plan.nameBn,
    planNameEn: plan.nameEn,
    startDateISO,
    endDateISO,
  };
}


