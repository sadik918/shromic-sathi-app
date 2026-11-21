import type { AttendanceRecord, EmploymentType, WorkerProfile } from '../types';
import {
  deriveBangladeshRMGBreakdownFromGross,
  getSalaryStructure,
  roundCurrency,
  toBengaliDigits,
} from './calculations';

export type BenefitCalculatorId =
  | 'annual_leave'
  | 'maternity_benefit'
  | 'service_benefit'
  | 'retrenchment_benefit'
  | 'termination_benefit'
  | 'death_compensation'
  | 'final_settlement'
  | 'monthly_salary'
  | 'increment_calc'
  | 'daily_wage'
  | 'hourly_wage'
  | 'overtime_calc'
  | 'special_overtime'
  | 'absence_deduction'
  | 'holiday_work'
  | 'festival_holiday_wage'
  | 'festival_bonus'
  | 'notice_pay'
  | 'layoff_compensation'
  | 'discharge_benefit'
  | 'resignation_benefit';

export type CalculatorCategoryGroup =
  | 'primary_benefits'
  | 'regular_wages'
  | 'leave_and_bonus'
  | 'separation_settlement';

export interface LegalRuleVersion {
  versionId: string;
  titleBn: string;
  titleEn: string;
  actNameBn: string;
  actNameEn: string;
  effectiveFrom: string; // YYYY-MM-DD
  verifiedBy: string;
  verifiedAt: string;
  isPublished: boolean;
  notesBn: string;
  parameters: {
    annualLeaveDaysPerWorkDays: number; // 1 day per 18 work days (Sec 117)
    annualLeaveMaxCapFactory: number; // 40 days max accumulation (Sec 117(5))
    casualLeaveEntitlement: number; // 10 days (Sec 115, non-encashable)
    sickLeaveEntitlement: number; // 14 days (Sec 116, non-encashable)
    festivalHolidaysPerYear: number; // 11 days (Sec 118)
    maternityLeaveWeeks: number; // 16 weeks = 112 days (Sec 46)
    maternityMinServiceMonths: number; // 6 months (Sec 46(1))
    maternityMaxLivingChildren: number; // < 2 surviving children (Sec 46(2))
    serviceBenefitTier1MinYears: number; // 5 years (Sec 27(4))
    serviceBenefitTier1DaysPerYear: number; // 14 days basic per year (5 to <10 yrs)
    serviceBenefitTier2MinYears: number; // 10 years (Sec 27(4))
    serviceBenefitTier2DaysPerYear: number; // 30 days basic per year (10+ yrs)
    gratuityDaysPerYearStandard: number; // 30 days basic per year (Sec 2(10))
    gratuityDaysPerYearOver10Yrs: number; // 45 days basic per year (>10 yrs)
    retrenchmentMinServiceYears: number; // 1 year (Sec 20)
    retrenchmentDaysPerYear: number; // 30 days basic per year
    retrenchmentNoticeDays: number; // 30 days notice (Sec 20(2)(a))
    terminationNoticeDaysPermanent: number; // 120 days (Sec 26(1)(a))
    terminationNoticeDaysTemporary: number; // 30 days (Sec 26(1)(b))
    terminationDaysPerYear: number; // 30 days basic per year
    dischargeMinServiceYears: number; // 1 year (Sec 22)
    dischargeDaysPerYear: number; // 30 days basic per year
    resignationNoticeDaysPermanent: number; // 60 days (Sec 27(1))
    deathBenefitMinServiceYears: number; // 2 years (Sec 19)
    deathNormalDaysPerYear: number; // 30 days basic per year (Sec 19)
    deathDutyAccidentDaysPerYear: number; // 45 days basic per year (Sec 19)
    workplaceAccidentDeathGrantBDT: number; // 200,000 BDT (Sec 150 & 5th Schedule)
    layoffFirst45DaysBasicPct: number; // 50% of basic (Sec 16)
    layoffNext15DaysBasicPct: number; // 25% of basic (Sec 16)
    overtimeStandardDivisor: number; // 208 hours (Sec 108)
    overtimeStandardMultiplier: number; // 2.0x (Sec 108)
  };
}

export interface CalculatorCatalogMeta {
  id: BenefitCalculatorId;
  group: CalculatorCategoryGroup;
  isPrimarySix: boolean;
  titleBn: string;
  titleEn: string;
  shortDescBn: string;
  shortDescEn: string;
  legalSectionBn: string;
  legalSectionEn: string;
  helpTextBn: string;
  enabled: boolean;
}

export interface ServiceDurationResult {
  valid: boolean;
  totalCalendarDays: number;
  completedYears: number;
  additionalMonths: number;
  additionalDays: number;
  gratuityRoundedYears: number; // > 6 additional months rounds up to next year under Sec 2(10)
  totalMonthsApprox: number;
  formattedBn: string;
  formattedEn: string;
}

export interface BreakdownLineItem {
  labelBn: string;
  labelEn: string;
  formulaBn: string;
  amountBDT: number;
  isDeduction?: boolean;
  isExcluded?: boolean;
  exclusionReasonBn?: string;
}

export interface BenefitCalculationOutput {
  calculatorId: BenefitCalculatorId;
  calculatorTitleBn: string;
  calculatorTitleEn: string;
  calculationDate: string;
  workerName: string;
  factoryName: string;
  department: string;
  designation: string;
  isComplete: boolean;
  incompleteMessageBn?: string;
  isEligible: boolean;
  eligibilityStatusBn: string;
  eligibilityExplanationBn: string;
  serviceDuration?: ServiceDurationResult;
  wageBasisLabelBn: string;
  wageBasisAmountBDT: number;
  dailyRateUsedBDT: number;
  totalEstimatedPayableBDT: number;
  breakdownItems: BreakdownLineItem[];
  summaryHighlights: Array<{ labelBn: string; valueBn: string }>;
  legalInfo: {
    sectionBn: string;
    ruleVersionId: string;
    effectiveFrom: string;
    assumptionsBn: string[];
    limitationsBn: string[];
    explanationBn: string;
  };
}

export interface SavedBenefitCalculationRecord {
  id: string;
  userId: string;
  calculatorId: BenefitCalculatorId;
  calculatorTitleBn: string;
  calculationDate: string;
  createdAtISO: string;
  inputs: Record<string, string | number | boolean>;
  output: BenefitCalculationOutput;
}

export const INSUFFICIENT_INFO_MESSAGE_BN =
  'এই হিসাবটি সম্পূর্ণ করতে আরও তথ্য অথবা প্রযোজ্য আইন যাচাই করা প্রয়োজন।';

export const EXPORT_DISCLAIMER_BN =
  'এটি প্রদত্ত তথ্য ও নির্বাচিত আইনি নিয়মের ভিত্তিতে তৈরি একটি আনুমানিক হিসাব। চূড়ান্ত পাওনা নির্ধারণের জন্য প্রতিষ্ঠানের নথি এবং প্রযোজ্য আইন যাচাই করুন।';

export const DEFAULT_LEGAL_RULE_VERSIONS: LegalRuleVersion[] = [
  {
    versionId: 'BLA-2006-AMEND-2018-WAGE-2024',
    titleBn: 'বাংলাদেশ শ্রম আইন ২০০৬ (২০১৮ সংশোধনী) ও গার্মেন্টস মজুরি গেজেট ২০২৩/২০২৪',
    titleEn: 'Bangladesh Labour Act 2006 (2018 Amendment) & RMG Wage Gazette 2023/2024',
    actNameBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ এবং বাংলাদেশ শ্রম বিধিমালা, ২০১৫',
    actNameEn: 'Bangladesh Labour Act, 2006 & Bangladesh Labour Rules, 2015',
    effectiveFrom: '2023-12-01',
    verifiedBy: 'sadikulislam45974@gmail.com',
    verifiedAt: '2026-01-01',
    isPublished: true,
    notesBn:
      'ধারা ১৬, ১৯, ২০, ২২, ২৬, ২৭, ৪৫-৫০, ১০৮, ১১৫-১১৯ এবং ১৫০ অনুযায়ী যাচাইকৃত শ্রম আইন নিয়মাবলী।',
    parameters: {
      annualLeaveDaysPerWorkDays: 18,
      annualLeaveMaxCapFactory: 40,
      casualLeaveEntitlement: 10,
      sickLeaveEntitlement: 14,
      festivalHolidaysPerYear: 11,
      maternityLeaveWeeks: 16,
      maternityMinServiceMonths: 6,
      maternityMaxLivingChildren: 2,
      serviceBenefitTier1MinYears: 5,
      serviceBenefitTier1DaysPerYear: 14,
      serviceBenefitTier2MinYears: 10,
      serviceBenefitTier2DaysPerYear: 30,
      gratuityDaysPerYearStandard: 30,
      gratuityDaysPerYearOver10Yrs: 45,
      retrenchmentMinServiceYears: 1,
      retrenchmentDaysPerYear: 30,
      retrenchmentNoticeDays: 30,
      terminationNoticeDaysPermanent: 120,
      terminationNoticeDaysTemporary: 30,
      terminationDaysPerYear: 30,
      dischargeMinServiceYears: 1,
      dischargeDaysPerYear: 30,
      resignationNoticeDaysPermanent: 60,
      deathBenefitMinServiceYears: 2,
      deathNormalDaysPerYear: 30,
      deathDutyAccidentDaysPerYear: 45,
      workplaceAccidentDeathGrantBDT: 200000,
      layoffFirst45DaysBasicPct: 50,
      layoffNext15DaysBasicPct: 25,
      overtimeStandardDivisor: 208,
      overtimeStandardMultiplier: 2.0,
    },
  },
  {
    versionId: 'BLA-2006-HISTORICAL-2018',
    titleBn: 'বাংলাদেশ শ্রম আইন ২০০৬ (২০১৮ পূর্ববর্তী ঐতিহাসিক সংস্করণ)',
    titleEn: 'Bangladesh Labour Act 2006 (2018 Historical Archive)',
    actNameBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ (ঐতিহাসিক রেকর্ড)',
    actNameEn: 'Bangladesh Labour Act, 2006 (Historical)',
    effectiveFrom: '2018-10-01',
    verifiedBy: 'System Legal Archive',
    verifiedAt: '2023-11-30',
    isPublished: true,
    notesBn: 'পূর্ববর্তী হিসাব ও ঐতিহাসিক রেফারেন্স যাচাইয়ের জন্য সংরক্ষিত।',
    parameters: {
      annualLeaveDaysPerWorkDays: 18,
      annualLeaveMaxCapFactory: 40,
      casualLeaveEntitlement: 10,
      sickLeaveEntitlement: 14,
      festivalHolidaysPerYear: 11,
      maternityLeaveWeeks: 16,
      maternityMinServiceMonths: 6,
      maternityMaxLivingChildren: 2,
      serviceBenefitTier1MinYears: 5,
      serviceBenefitTier1DaysPerYear: 14,
      serviceBenefitTier2MinYears: 10,
      serviceBenefitTier2DaysPerYear: 30,
      gratuityDaysPerYearStandard: 30,
      gratuityDaysPerYearOver10Yrs: 45,
      retrenchmentMinServiceYears: 1,
      retrenchmentDaysPerYear: 30,
      retrenchmentNoticeDays: 30,
      terminationNoticeDaysPermanent: 120,
      terminationNoticeDaysTemporary: 30,
      terminationDaysPerYear: 30,
      dischargeMinServiceYears: 1,
      dischargeDaysPerYear: 30,
      resignationNoticeDaysPermanent: 60,
      deathBenefitMinServiceYears: 2,
      deathNormalDaysPerYear: 30,
      deathDutyAccidentDaysPerYear: 45,
      workplaceAccidentDeathGrantBDT: 200000,
      layoffFirst45DaysBasicPct: 50,
      layoffNext15DaysBasicPct: 25,
      overtimeStandardDivisor: 208,
      overtimeStandardMultiplier: 2.0,
    },
  },
];

export const DEFAULT_CALCULATOR_CATALOG: CalculatorCatalogMeta[] = [
  // 6 Primary Required Calculators (A - F)
  {
    id: 'annual_leave',
    group: 'primary_benefits',
    isPrimarySix: true,
    titleBn: 'বাৎসরিক ছুটির টাকা হিসাব',
    titleEn: 'Annual Leave Payment Calculator',
    shortDescBn: 'অব্যবহৃত অর্জিত ছুটির নগদায়ন ও ছুটির দিনের মজুরি হিসাব করুন।',
    shortDescEn: 'Calculate unused earned leave encashment and daily leave wage.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ১১৭ ও ১১৯',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Sections 117 & 119',
    helpTextBn: 'কারখানার শ্রমিক প্রতি ১৮ দিন কাজের জন্য ১ দিন অর্জিত ছুটি পান (সর্বোচ্চ ৪০ দিন জমা রাখা যায়)। নৈমিত্তিক বা অসুস্থতার ছুটি নগদায়নযোগ্য নয়।',
    enabled: true,
  },
  {
    id: 'maternity_benefit',
    group: 'primary_benefits',
    isPrimarySix: true,
    titleBn: 'মাতৃত্বকালীন সুবিধা হিসাব',
    titleEn: 'Maternity Benefit Calculator',
    shortDescBn: '১৬ সপ্তাহের (১১২ দিন) মাতৃত্বকালীন ছুটি ও সুবিধার টাকা হিসাব করুন।',
    shortDescEn: 'Calculate 16-week (112 days) maternity benefit and eligibility.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ৪৫ থেকে ৫০',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Sections 45 to 50',
    helpTextBn: 'সন্তান প্রসবের পূর্বে অন্তত ৬ মাস চাকরি এবং জীবিত সন্তান ২ জনের কম থাকলে পূর্ণ গড় মজুরিতে ১৬ সপ্তাহের সুবিধা প্রযোজ্য।',
    enabled: true,
  },
  {
    id: 'service_benefit',
    group: 'primary_benefits',
    isPrimarySix: true,
    titleBn: 'সার্ভিস বেনিফিট হিসাব',
    titleEn: 'Service Benefit Calculator',
    shortDescBn: 'চাকরির মেয়াদের ভিত্তিতে সার্ভিস বেনিফিট ও গ্র্যাচুইটি তুলনা করুন।',
    shortDescEn: 'Calculate service benefit and gratuity comparison by tenure.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ২৭ ও ধারা ২(১০)',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Section 27 & Section 2(10)',
    helpTextBn: 'স্থায়ী শ্রমিকের ৫–৯ বছর পূর্ণ চাকরিতে প্রতি বছর ১৪ দিনের মূল বেতন এবং ১০ বছর বা তদূর্ধ্ব চাকরিতে প্রতি বছর ৩০ দিনের মূল বেতন বা গ্র্যাচুইটি প্রযোজ্য।',
    enabled: true,
  },
  {
    id: 'retrenchment_benefit',
    group: 'primary_benefits',
    isPrimarySix: true,
    titleBn: 'ছাঁটাইকৃত বেনিফিট হিসাব',
    titleEn: 'Retrenchment Benefit Calculator',
    shortDescBn: 'প্রয়োজনাতিরিক্ত কারণে ছাঁটাই হলে নোটিশ পে, ক্ষতিপূরণ ও ছুটির পাওনা হিসাব করুন।',
    shortDescEn: 'Calculate redundancy retrenchment compensation, notice pay, and leave dues.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ২০',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Section 20',
    helpTextBn: 'অন্তত ১ বছর চাকরির পর ছাঁটাই হলে ১ মাসের নোটিশ (বা নোটিশ পে) এবং প্রতি পূর্ণ বছরের জন্য ৩০ দিনের মূল বেতন বা গ্র্যাচুইটি প্রাপ্য।',
    enabled: true,
  },
  {
    id: 'termination_benefit',
    group: 'primary_benefits',
    isPrimarySix: true,
    titleBn: 'টার্মিনেশন বেনিফিট হিসাব',
    titleEn: 'Termination Benefit Calculator',
    shortDescBn: 'মালিকপক্ষ কর্তৃক চাকরি অবসান (ধারা ২৬) বা অন্যান্য অবসানের পাওনা হিসাব করুন।',
    shortDescEn: 'Calculate employer termination compensation, notice pay, and dues.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ২৬, ২৩ ও ২২',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Sections 26, 23 & 22',
    helpTextBn: 'ধারা ২৬ অনুযায়ী স্থায়ী শ্রমিককে ১২০ দিনের নোটিশ (বা ৪ মাসের মূল বেতন) এবং প্রতি পূর্ণ বছরের জন্য ৩০ দিনের মূল বেতন বা গ্র্যাচুইটি প্রদান করতে হয়।',
    enabled: true,
  },
  {
    id: 'death_compensation',
    group: 'primary_benefits',
    isPrimarySix: true,
    titleBn: 'মৃত্যুর ক্ষেত্রে ক্ষতিপূরণ হিসাব',
    titleEn: 'Death Compensation Calculator',
    shortDescBn: 'চাকরিরত অবস্থায় স্বাভাবিক মৃত্যু বা কর্মক্ষেত্রে দুর্ঘটনায় মৃত্যুর ক্ষতিপূরণ হিসাব।',
    shortDescEn: 'Calculate death-in-service benefit and workplace accident compensation.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ১৯ ও ধারা ১৫০ (তফসিল ৫)',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Section 19 & Section 150',
    helpTextBn: '২ বছরের অধিক চাকরিতে স্বাভাবিক মৃত্যুতে প্রতি বছর ৩০ দিনের (অথবা কর্তব্যরত দুর্ঘটনায় ৪৫ দিনের) মূল বেতন এবং দুর্ঘটনাজনিত মৃত্যুতে তফসিল ৫ অনুযায়ী এককালীন ২,০০,০০০ টাকা প্রযোজ্য।',
    enabled: true,
  },

  // Combined Final Settlement Calculator (#8 & #3.14)
  {
    id: 'final_settlement',
    group: 'separation_settlement',
    isPrimarySix: false,
    titleBn: 'চাকরি শেষে মোট পাওনা হিসাব (চূড়ান্ত পাওনা)',
    titleEn: 'Combined Final Settlement Calculator',
    shortDescBn: 'বকেয়া বেতন, ওভারটাইম, অর্জিত ছুটি, সার্ভিস বেনিফিট ও নোটিশ পে একত্রে হিসাব করুন।',
    shortDescEn: 'Combine unpaid salary, OT, unused leave, and separation benefits without double counting.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ২০, ২২, ২৬, ২৭, ১১৭ ও ১২৩',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Sections 20, 22, 26, 27, 117 & 123',
    helpTextBn: 'চাকরি ছাড়ার বা অবসানের পর কর্মচারীর সকল বৈধ পাওনা এবং অগ্রিম কর্তন একসাথে স্বচ্ছভাবে হিসাব করে (ডাবল কাউন্টিং ছাড়া)।',
    enabled: true,
  },

  // 13 Additional Garments Calculators
  {
    id: 'monthly_salary',
    group: 'regular_wages',
    isPrimarySix: false,
    titleBn: 'মাসিক বেতন হিসাব',
    titleEn: 'Monthly Salary Calculator',
    shortDescBn: 'মূল বেতন, বাড়ি ভাড়া, চিকিৎসা, যাতায়াত, খাদ্য ভাতা, ওভারটাইম ও কর্তনসহ নিট বেতন।',
    shortDescEn: 'Calculate net monthly pay from basic, allowances, overtime, bonus, and deductions.',
    legalSectionBn: 'গার্মেন্টস ন্যূনতম মজুরি গেজেট ২০২৩ ও শ্রম আইন ধারা ১২০-১২৫',
    legalSectionEn: 'RMG Minimum Wage Gazette 2023 & Labour Act Sec 120-125',
    helpTextBn: 'মাসিক গ্রস বেতন, হাজিরা বোনাস, ওভারটাইম এবং অনুপস্থিতি বা অগ্রিম কর্তন বাদ দিয়ে হাতে পাওয়ার নিট বেতন বের করুন।',
    enabled: true,
  },
  {
    id: 'increment_calc',
    group: 'regular_wages',
    isPrimarySix: false,
    titleBn: 'ইনক্রিমেন্ট হিসাব',
    titleEn: 'Increment Calculator',
    shortDescBn: 'শতাংশ (%) বা নির্দিষ্ট টাকা ইনক্রিমেন্টে নতুন মোট বেতন, মূল বেতন, বাড়ি ভাড়া ও ওটি হার বের করুন।',
    shortDescEn: 'Calculate new gross, basic split, house rent, and updated OT rate from % or BDT increment.',
    legalSectionBn: 'গার্মেন্টস ন্যূনতম মজুরি গেজেট — বাৎসরিক ইনক্রিমেন্ট বিধি',
    legalSectionEn: 'RMG Minimum Wage Gazette — Annual Increment Rule',
    helpTextBn: 'গার্মেন্টস খাতে সাধারণত প্রতি বছর মূল বেতনের উপর ন্যূনতম ৫% (বা কারখানার নীতিমালা অনুযায়ী বেশি) ইনক্রিমেন্ট যুক্ত হয়, যার ফলে বাড়ি ভাড়া ও ওভারটাইম হারও বৃদ্ধি পায়।',
    enabled: true,
  },
  {
    id: 'daily_wage',
    group: 'regular_wages',
    isPrimarySix: false,
    titleBn: 'দৈনিক মজুরি হিসাব',
    titleEn: 'Daily Wage Calculator',
    shortDescBn: 'মাসিক মূল ও মোট বেতন থেকে ৩০ দিন ও ২৬ কার্যদিবস ভিত্তিক ১ দিনের মজুরি।',
    shortDescEn: 'Calculate daily basic and gross wage rates across 30-day and 26-day bases.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ২(৪৫) ও ধারা ১২৬',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Section 2(45) & Section 126',
    helpTextBn: '১ দিনের মূল মজুরি এবং ১ দিনের মোট (গ্রস) মজুরি উভয় পদ্ধতিতে তুলনা করুন।',
    enabled: true,
  },
  {
    id: 'hourly_wage',
    group: 'regular_wages',
    isPrimarySix: false,
    titleBn: 'ঘণ্টাপ্রতি মজুরি হিসাব',
    titleEn: 'Hourly Wage Calculator',
    shortDescBn: '২০৮ ঘণ্টা শ্রম আইন মানদণ্ড অনুযায়ী প্রতি ঘণ্টার সাধারণ ও ওভারটাইম মজুরি।',
    shortDescEn: 'Calculate normal hourly rate and overtime hourly rate based on 208 monthly hours.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ১০০ ও ধারা ১০৮',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Sections 100 & 108',
    helpTextBn: 'দৈনিক ৮ ঘণ্টা ও মাসে ২৬ কার্যদিবস (মোট ২০৮ ঘণ্টা) হিসেবে প্রতি ঘণ্টার মজুরি নির্ণয়।',
    enabled: true,
  },
  {
    id: 'overtime_calc',
    group: 'regular_wages',
    isPrimarySix: false,
    titleBn: 'ওভারটাইম হিসাব',
    titleEn: 'Overtime Calculator',
    shortDescBn: 'শ্রম আইন ধারা ১০৮ অনুযায়ী দ্বিগুণ হারে মাসিক বা দৈনিক ওভারটাইম টাকা হিসাব।',
    shortDescEn: 'Calculate daily or monthly overtime earnings at statutory 2x basic rate.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ১০৮',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Section 108',
    helpTextBn: 'ওভারটাইম প্রতি ঘণ্টা = (মূল বেতন ÷ ২০৮) × ২। ঘণ্টা ও মিনিট দিয়ে মোট টাকা বের করুন।',
    enabled: true,
  },
  {
    id: 'special_overtime',
    group: 'regular_wages',
    isPrimarySix: false,
    titleBn: 'ডাবল ওভারটাইম বা প্রযোজ্য বিশেষ হার হিসাব',
    titleEn: 'Special / Double Overtime Rate Calculator',
    shortDescBn: 'শ্রম আইনসম্মত দ্বিগুণ ওভারটাইম হার বনাম কারখানার বিশেষ ভাতা বা কাস্টম হার তুলনা।',
    shortDescEn: 'Compare statutory double overtime rate with special shift/night allowances.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ১০৮ ও ১০৯',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Sections 108 & 109',
    helpTextBn: 'আইনগত দ্বিগুণ ওভারটাইম হার এবং রাতের শিফট বা বিশেষ টিফিন ভাতা প্রযোজ্য হলে তার হিসাব।',
    enabled: true,
  },
  {
    id: 'absence_deduction',
    group: 'regular_wages',
    isPrimarySix: false,
    titleBn: 'অনুপস্থিতির কারণে বেতন কর্তন',
    titleEn: 'Absence Deduction Calculator',
    shortDescBn: 'ধারা ১২৬ অনুযায়ী অনুপস্থিত দিনের বৈধ মূল বেতন কর্তন ও হাজিরা বোনাস প্রভাব।',
    shortDescEn: 'Calculate lawful basic wage deduction for absence under Sec 126 and attendance bonus impact.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ১২৫ ও ১২৬',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Sections 125 & 126',
    helpTextBn: 'শ্রম আইন অনুযায়ী অনুপস্থিতির জন্য শুধুমাত্র মূল বেতন (Basic ÷ ৩০) থেকে কর্তন বৈধ; বাড়ি ভাড়া বা চিকিৎসা ভাতা কাটা যায় না।',
    enabled: true,
  },
  {
    id: 'holiday_work',
    group: 'leave_and_bonus',
    isPrimarySix: false,
    titleBn: 'ছুটির দিনের কাজের মজুরি',
    titleEn: 'Holiday Work Payment Calculator',
    shortDescBn: 'সাপ্তাহিক বা সরকারি ছুটির দিনে কাজ করলে অতিরিক্ত মজুরি ও বিকল্প ছুটির হিসাব।',
    shortDescEn: 'Calculate payment and compensatory leave for working on weekly or public holidays.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ১০৩, ১০৪ ও ১১৮',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Sections 103, 104 & 118',
    helpTextBn: 'ছুটির দিনে কাজ করলে বিকল্প ছুটিসহ বা দ্বিগুণ হারে মজুরি প্রাপ্যতার হিসাব।',
    enabled: true,
  },
  {
    id: 'festival_holiday_wage',
    group: 'leave_and_bonus',
    isPrimarySix: false,
    titleBn: 'উৎসব ছুটির মজুরি',
    titleEn: 'Festival Holiday Wage Calculator',
    shortDescBn: 'বছরে ১১ দিনের সবেতন উৎসব ছুটি এবং উৎসব ছুটিতে কাজ করলে ২ দিনের অতিরিক্ত মজুরি।',
    shortDescEn: 'Calculate 11-day annual festival holiday pay and 2x extra pay for working on festival days.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ১১৮(৩)',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Section 118(3)',
    helpTextBn: 'ধারা ১১৮(৩) অনুযায়ী উৎসব ছুটির দিনে কাজ করলে ১ দিনের বিকল্প ছুটি এবং ২ দিনের পূর্ণ মজুরির সমান অতিরিক্ত ভাতা প্রাপ্য।',
    enabled: true,
  },
  {
    id: 'festival_bonus',
    group: 'leave_and_bonus',
    isPrimarySix: false,
    titleBn: 'উৎসব বোনাস হিসাব',
    titleEn: 'Festival Bonus Calculator',
    shortDescBn: 'চাকরির মেয়াদের ভিত্তিতে ঈদ বা উৎসব বোনাসের প্রাপ্য টাকা হিসাব করুন।',
    shortDescEn: 'Calculate Eid or Festival Bonus based on basic salary and service duration.',
    legalSectionBn: 'বাংলাদেশ শ্রম বিধিমালা, ২০১৫ — বিধি ১১১(৫)',
    legalSectionEn: 'Bangladesh Labour Rules 2015 — Rule 111(5)',
    helpTextBn: 'নিরবচ্ছিন্ন ১ বছর চাকরি পূর্ণ হলে সাধারণত মূল বেতনের সমান (বা কারখানার নিয়ম অনুযায়ী ৫০%-১০০%) উৎসব বোনাস প্রদান করা হয়।',
    enabled: true,
  },
  {
    id: 'notice_pay',
    group: 'separation_settlement',
    isPrimarySix: false,
    titleBn: 'নোটিশ পে হিসাব',
    titleEn: 'Notice Pay Calculator',
    shortDescBn: 'মালিকপক্ষ বা শ্রমিক কর্তৃক নোটিশ না দিলে প্রদেয় বা কর্তনযোগ্য নোটিশ পে হিসাব।',
    shortDescEn: 'Calculate notice pay receivable from employer or payable by worker upon resignation.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ২০, ২৬ ও ২৭',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Sections 20, 26 & 27',
    helpTextBn: 'মালিকপক্ষ ধারা ২৬-এ অবসান করলে ১২০ দিন, ছাঁটাইয়ে ৩০ দিন এবং শ্রমিক পদত্যাগ করলে ৬০ দিনের নোটিশ প্রযোজ্য।',
    enabled: true,
  },
  {
    id: 'layoff_compensation',
    group: 'separation_settlement',
    isPrimarySix: false,
    titleBn: 'লে-অফ ক্ষতিপূরণ হিসাব',
    titleEn: 'Lay-off Compensation Calculator',
    shortDescBn: 'কাঁচামাল বা বিদ্যুৎ সংকটে কারখানা সাময়িক লে-অফ থাকলে প্রাপ্য ক্ষতিপূরণ হিসাব।',
    shortDescEn: 'Calculate lay-off compensation (50% basic + 100% house rent for first 45 days).',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ১৬',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Section 16',
    helpTextBn: 'প্রথম ৪৫ দিন লে-অফে মূল বেতনের ৫০% + পূর্ণ বাড়ি ভাড়া ভাতা এবং পরবর্তী প্রতি ১৫ দিনে মূল বেতনের ২৫% + পূর্ণ বাড়ি ভাড়া প্রাপ্য (মাস্টার রোলে অন্তত ১ বছর চাকরির শর্তে)।',
    enabled: true,
  },
  {
    id: 'discharge_benefit',
    group: 'separation_settlement',
    isPrimarySix: false,
    titleBn: 'ডিসচার্জ বেনিফিট হিসাব',
    titleEn: 'Discharge Benefit Calculator',
    shortDescBn: 'শারীরিক বা মানসিক অক্ষমতার কারণে চাকরি থেকে অব্যাহতি (ডিসচার্জ) পেলে প্রাপ্য সুবিধা।',
    shortDescEn: 'Calculate discharge compensation for physical or mental incapacity after 1+ year of service.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ২২',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Section 22',
    helpTextBn: 'অন্তত ১ বছর নিরবচ্ছিন্ন চাকরির পর রেজিস্টার্ড চিকিৎসকের প্রত্যয়ন অনুযায়ী অক্ষমতাজনিত ডিসচার্জে প্রতি পূর্ণ বছরের জন্য ৩০ দিনের মূল বেতন বা গ্র্যাচুইটি প্রাপ্য।',
    enabled: true,
  },
  {
    id: 'resignation_benefit',
    group: 'separation_settlement',
    isPrimarySix: false,
    titleBn: 'পদত্যাগের পাওনা হিসাব',
    titleEn: 'Resignation Benefit Calculator',
    shortDescBn: 'স্বেচ্ছায় পদত্যাগ (ইস্তফা) করলে নোটিশ মেয়াদ, সার্ভিস বেনিফিট ও ছুটির টাকা হিসাব।',
    shortDescEn: 'Calculate resignation entitlements, notice compliance, service benefit, and unused leave.',
    legalSectionBn: 'বাংলাদেশ শ্রম আইন, ২০০৬ — ধারা ২৭',
    legalSectionEn: 'Bangladesh Labour Act 2006 — Section 27',
    helpTextBn: 'স্থায়ী শ্রমিক ৬০ দিনের নোটিশ দিয়ে পদত্যাগ করলে ৫–৯ বছর চাকরিতে প্রতি বছর ১৪ দিনের এবং ১০+ বছর চাকরিতে ৩০ দিনের মূল বেতন বা গ্র্যাচুইটি পান।',
    enabled: true,
  },
];

export interface AdminCalculatorConfigStore {
  activeRuleVersionId: string;
  ruleVersions: LegalRuleVersion[];
  catalog: CalculatorCatalogMeta[];
  updatedAt: string;
  updatedBy: string;
}

const ADMIN_CALC_CONFIG_KEY = 'shromik_sathi_admin_calc_config_v1';
const USER_CALC_HISTORY_PREFIX = 'shromik_sathi_calc_history_v1_';

export function loadAdminCalculatorConfig(): AdminCalculatorConfigStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ADMIN_CALC_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminCalculatorConfigStore;
        if (parsed && Array.isArray(parsed.catalog) && Array.isArray(parsed.ruleVersions)) {
          return parsed;
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    activeRuleVersionId: DEFAULT_LEGAL_RULE_VERSIONS[0].versionId,
    ruleVersions: DEFAULT_LEGAL_RULE_VERSIONS,
    catalog: DEFAULT_CALCULATOR_CATALOG,
    updatedAt: '2026-10-28',
    updatedBy: 'sadikulislam45974@gmail.com',
  };
}

export function saveAdminCalculatorConfig(store: AdminCalculatorConfigStore): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ADMIN_CALC_CONFIG_KEY, JSON.stringify(store));
    }
  } catch {
    // ignore storage errors
  }
}

export function loadUserCalculationHistory(userId: string): SavedBenefitCalculationRecord[] {
  if (!userId) return [];
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`${USER_CALC_HISTORY_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedBenefitCalculationRecord[];
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => item && item.userId === userId);
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveUserCalculationRecord(
  userId: string,
  record: SavedBenefitCalculationRecord
): SavedBenefitCalculationRecord[] {
  if (!userId || record.userId !== userId) {
    return [];
  }
  const existing = loadUserCalculationHistory(userId);
  const filtered = existing.filter((r) => r.id !== record.id);
  const next = [record, ...filtered].slice(0, 50);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${USER_CALC_HISTORY_PREFIX}${userId}`, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
  return next;
}

export function deleteUserCalculationRecord(
  userId: string,
  recordId: string
): SavedBenefitCalculationRecord[] {
  if (!userId) return [];
  const existing = loadUserCalculationHistory(userId);
  const next = existing.filter((r) => r.id !== recordId);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${USER_CALC_HISTORY_PREFIX}${userId}`, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
  return next;
}

/**
 * Leap-year aware exact calendar duration between two YYYY-MM-DD dates.
 */
export function calculateExactServiceDuration(
  startDateISO: string,
  endDateISO: string
): ServiceDurationResult {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDateISO) || !dateRegex.test(endDateISO)) {
    return {
      valid: false,
      totalCalendarDays: 0,
      completedYears: 0,
      additionalMonths: 0,
      additionalDays: 0,
      gratuityRoundedYears: 0,
      totalMonthsApprox: 0,
      formattedBn: 'অসম্পূর্ণ তারিখ',
      formattedEn: 'Invalid date',
    };
  }

  const start = new Date(`${startDateISO}T00:00:00Z`);
  const end = new Date(`${endDateISO}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return {
      valid: false,
      totalCalendarDays: 0,
      completedYears: 0,
      additionalMonths: 0,
      additionalDays: 0,
      gratuityRoundedYears: 0,
      totalMonthsApprox: 0,
      formattedBn: 'শেষ তারিখ যোগদানের তারিখের আগে হতে পারে না',
      formattedEn: 'End date cannot precede joining date',
    };
  }

  const totalCalendarDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let months = end.getUTCMonth() - start.getUTCMonth();
  let days = end.getUTCDate() - start.getUTCDate();

  if (days < 0) {
    months -= 1;
    // Days in the month preceding end's month
    const prevMonthEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0));
    days += prevMonthEnd.getUTCDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // Under BLA Sec 2(10) for Gratuity, > 6 months in excess of completed years counts as +1 year
  const exceedsSixMonths = months > 6 || (months === 6 && days > 0);
  const gratuityRoundedYears = years >= 1 && exceedsSixMonths ? years + 1 : years;
  const totalMonthsApprox = years * 12 + months + (days >= 15 ? 1 : 0);

  return {
    valid: true,
    totalCalendarDays,
    completedYears: years,
    additionalMonths: months,
    additionalDays: days,
    gratuityRoundedYears,
    totalMonthsApprox,
    formattedBn: `${toBengaliDigits(years)} বছর ${toBengaliDigits(months)} মাস ${toBengaliDigits(days)} দিন`,
    formattedEn: `${years} yr ${months} mo ${days} d`,
  };
}

export interface WageComponentsInput {
  basicSalary: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
  otherAllowances?: number;
}

export function resolveStatutoryWageBasis(wages: WageComponentsInput): {
  basicSalary: number;
  grossSalary: number;
  statutoryLeaveWageMonthly: number; // Sec 119: Basic + House Rent + Medical + Food (excludes transport & bonus)
  dailyBasic30: number;
  dailyBasic26: number;
  dailyGross30: number;
  dailyGross26: number;
  dailyStatutoryLeaveWage30: number;
  hourlyBasic208: number;
  hourlyOtRate2x: number;
} {
  const basicSalary = Math.max(0, roundCurrency(Number(wages.basicSalary) || 0));
  const houseRent = Math.max(0, roundCurrency(Number(wages.houseRentAllowance) || 0));
  const medical = Math.max(0, roundCurrency(Number(wages.medicalAllowance) || 0));
  const transport = Math.max(0, roundCurrency(Number(wages.transportAllowance) || 0));
  const food = Math.max(0, roundCurrency(Number(wages.foodAllowance) || 0));
  const other = Math.max(0, roundCurrency(Number(wages.otherAllowances) || 0));

  const grossSalary = roundCurrency(basicSalary + houseRent + medical + transport + food + other);
  // Section 119(1): Leave wage includes full time-rate wage and dearness/food/house/medical allowances, excluding bonus, overtime, and transport allowance
  const statutoryLeaveWageMonthly = roundCurrency(basicSalary + houseRent + medical + food);

  return {
    basicSalary,
    grossSalary,
    statutoryLeaveWageMonthly,
    dailyBasic30: roundCurrency(basicSalary / 30),
    dailyBasic26: roundCurrency(basicSalary / 26),
    dailyGross30: roundCurrency(grossSalary / 30),
    dailyGross26: roundCurrency(grossSalary / 26),
    dailyStatutoryLeaveWage30: roundCurrency(statutoryLeaveWageMonthly / 30),
    hourlyBasic208: roundCurrency(basicSalary / 208),
    hourlyOtRate2x: roundCurrency((basicSalary / 208) * 2),
  };
}

export function buildWorkerPrefillInputs(
  profile: Partial<WorkerProfile>,
  todayISO: string,
  attendanceRecords: AttendanceRecord[] = []
): Record<string, string | number | boolean> {
  const structure = getSalaryStructure(profile);
  const attendanceBonus =
    profile.hasAttendanceBonus === false
      ? 0
      : Math.max(0, Number(profile.attendanceBonusAmount ?? profile.attendanceBonus) || 0);

  const joiningDate = (profile.joiningDate || '').trim();
  const effectiveToday = (todayISO || '').trim();
  const tenure = joiningDate && effectiveToday
    ? calculateExactServiceDuration(joiningDate, effectiveToday)
    : null;

  // Derive real worked days & used leave from actual attendance records (never invent 288/4/10 for new joiners!)
  const validAttSinceJoin = attendanceRecords.filter((r) =>
    !joiningDate || !r.date ? true : r.date >= joiningDate
  );
  const recordedWorkedDays = validAttSinceJoin.filter(
    (r) => r.status === 'present' || r.status === 'late'
  ).length;
  const recordedEarnedLeaveUsed = validAttSinceJoin.filter(
    (r) => r.status === 'approved_leave' && r.leaveCategory === 'earned'
  ).length;

  let derivedDaysWorked = recordedWorkedDays;
  if (derivedDaysWorked === 0 && tenure?.valid && tenure.totalCalendarDays >= 30) {
    // Only estimate worked days if worker has >= 1 month of service and no attendance entries yet
    const approxYearDays = Math.min(365, tenure.totalCalendarDays);
    derivedDaysWorked = Math.max(0, Math.round((approxYearDays * 26) / 30));
  }
  const derivedEarnedLeave = Math.floor((derivedDaysWorked / 18) * 100) / 100;
  const derivedUnusedLeave = Math.max(
    0,
    Math.min(40, Math.floor(derivedEarnedLeave - recordedEarnedLeaveUsed))
  );

  return {
    workerName: profile.fullName || 'শ্রমিক ব্যবহারকারী',
    factoryName: profile.factoryName || '',
    department: profile.department || '',
    designation: profile.designation || '',
    employmentType: (profile.employmentType || 'permanent') as EmploymentType,
    joiningDate: joiningDate || effectiveToday || '2026-01-01',
    calculationDate: effectiveToday || '2026-10-28',
    basicSalary: structure.basicSalary,
    houseRentAllowance: structure.houseRentAllowance,
    medicalAllowance: structure.medicalAllowance,
    transportAllowance: structure.transportAllowance,
    foodAllowance: structure.foodAllowance,
    attendanceBonus,
    // Annual leave defaults strictly derived from actual joining date + attendance
    totalDaysWorkedInPeriod: derivedDaysWorked,
    manualLeaveEarned: 0,
    leaveUsedDays: recordedEarnedLeaveUsed,
    leaveWageBasisMode: 'gross_30', // Unified daily rate = Gross ÷ 30 across Home, Salary, Payslip & Calculators
    // Maternity defaults
    expectedDeliveryDate: effectiveToday || '2026-10-28',
    livingChildrenCount: 0,
    priorThreeMonthsTotalWages: 0,
    priorThreeMonthsDaysWorked: 78,
    noticeGivenToEmployer: true,
    // Service / Gratuity defaults
    hasGratuityPolicy: false,
    alreadyPaidAdvanceBDT: 0,
    // Retrenchment / Termination / Resignation defaults
    noticeProvidedByEmployer: false,
    noticeDaysServedOrGiven: 0,
    terminationCategory: 'employer_section_26_permanent',
    unusedAnnualLeaveDays: derivedUnusedLeave,
    unpaidSalaryDays: 0,
    unpaidOvertimeHours: 0,
    otherLawfulDuesBDT: 0,
    lawfulAdvanceDeductionBDT: 0,
    // Death compensation defaults
    deathDuringEmployment: true,
    deathByWorkplaceAccident: false,
    nomineeRelation: 'স্বামী/স্ত্রী বা বৈধ নমিনি',
    // Increment calculator defaults
    incrementMode: 'percent', // 'percent' | 'amount'
    incrementPercent: 5,
    incrementAmountBDT: 0,
    incrementEffectiveDate: effectiveToday || '2026-11-01',
    // Additional calculators defaults
    overtimeHours: 0,
    overtimeMinutes: 0,
    specialNightAllowancePerDay: 100,
    specialNightDays: 0,
    absentDays: 0,
    holidayWorkDays: 0,
    compensatoryLeaveGiven: false,
    festivalBonusPct: 100,
    layoffDaysTotal: 0,
    medicalIncapacityCertified: true,
    separationModeForFinalSettlement: 'resignation',
  };
}

/**
 * Main Dispatcher: Runs any of the 21 calculators deterministically using the active LegalRuleVersion.
 */
export function executeGarmentBenefitCalculation(
  calculatorId: BenefitCalculatorId,
  rawInputs: Record<string, string | number | boolean>,
  ruleVersion: LegalRuleVersion = DEFAULT_LEGAL_RULE_VERSIONS[0]
): BenefitCalculationOutput {
  const catalogMeta =
    DEFAULT_CALCULATOR_CATALOG.find((c) => c.id === calculatorId) || DEFAULT_CALCULATOR_CATALOG[0];

  const workerName = String(rawInputs.workerName || 'শ্রমিক ব্যবহারকারী').trim();
  const factoryName = String(rawInputs.factoryName || '').trim();
  const department = String(rawInputs.department || '').trim();
  const designation = String(rawInputs.designation || '').trim();
  const calculationDate = String(rawInputs.calculationDate || '2026-10-28').trim();
  const joiningDate = String(rawInputs.joiningDate || '').trim();
  const employmentType = String(rawInputs.employmentType || 'permanent') as EmploymentType;

  const basicSalary = Number(rawInputs.basicSalary);
  const houseRentAllowance = Number(rawInputs.houseRentAllowance ?? 0);
  const medicalAllowance = Number(rawInputs.medicalAllowance ?? 0);
  const transportAllowance = Number(rawInputs.transportAllowance ?? 0);
  const foodAllowance = Number(rawInputs.foodAllowance ?? 0);

  // Validate basic salary
  if (!Number.isFinite(basicSalary) || basicSalary <= 0 || houseRentAllowance < 0 || medicalAllowance < 0 || transportAllowance < 0 || foodAllowance < 0) {
    return buildIncompleteResult(catalogMeta, ruleVersion, {
      workerName,
      factoryName,
      department,
      designation,
      calculationDate,
      reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
    });
  }

  const wages = resolveStatutoryWageBasis({
    basicSalary,
    houseRentAllowance,
    medicalAllowance,
    transportAllowance,
    foodAllowance,
  });

  const p = ruleVersion.parameters;

  switch (calculatorId) {
    // =========================================================================
    // A. বাৎসরিক ছুটির টাকা হিসাব (ANNUAL LEAVE PAYMENT CALCULATOR)
    // =========================================================================
    case 'annual_leave': {
      const effectiveJoin = joiningDate || '2024-01-01';
      const duration = calculateExactServiceDuration(effectiveJoin, calculationDate);
      if (!duration.valid) {
        return buildIncompleteResult(catalogMeta, ruleVersion, {
          workerName,
          factoryName,
          department,
          designation,
          calculationDate,
          reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
        });
      }

      const totalDaysWorked = Math.max(0, Number(rawInputs.totalDaysWorkedInPeriod) || 0);
      const manualEarned = Math.max(0, Number(rawInputs.manualLeaveEarned) || 0);
      const leaveUsed = Math.max(0, Number(rawInputs.leaveUsedDays) || 0);
      const wageBasisMode = String(rawInputs.leaveWageBasisMode || 'statutory_sec119');

      // Earned leave: 1 day per 18 days worked (Sec 117(1)(a))
      const computedEarnedFromWork =
        manualEarned > 0
          ? manualEarned
          : roundCurrency(Math.floor((totalDaysWorked / p.annualLeaveDaysPerWorkDays) * 100) / 100);

      const rawRemaining = Math.max(0, roundCurrency(computedEarnedFromWork - leaveUsed));
      // Factory cap is 40 days accumulation under Sec 117(5)
      const encashableRemaining = Math.min(rawRemaining, p.annualLeaveMaxCapFactory);

      const dailyWage =
        wageBasisMode === 'gross_30'
          ? wages.dailyGross30
          : wageBasisMode === 'basic_30'
          ? wages.dailyBasic30
          : wages.dailyStatutoryLeaveWage30;

      const wageBasisLabelBn =
        wageBasisMode === 'gross_30'
          ? 'মোট গ্রস বেতন (Gross ÷ ৩০)'
          : wageBasisMode === 'basic_30'
          ? 'মূল বেতন (Basic ÷ ৩০)'
          : 'ধারা ১১৯ ছুটিকালীন পূর্ণ গড় মজুরি ((মূল + বাড়ি ভাড়া + চিকিৎসা + খাদ্য) ÷ ৩০)';

      const payableAmount = roundCurrency(encashableRemaining * dailyWage);

      const breakdownItems: BreakdownLineItem[] = [
        {
          labelBn: 'অর্জিত বাৎসরিক ছুটি (Earned Annual Leave)',
          labelEn: 'Earned Annual Leave',
          formulaBn:
            manualEarned > 0
              ? `প্রদত্ত অর্জিত ছুটি: ${toBengaliDigits(computedEarnedFromWork)} দিন`
              : `${toBengaliDigits(totalDaysWorked)} কার্যদিবস ÷ ${toBengaliDigits(p.annualLeaveDaysPerWorkDays)} দিন = ${toBengaliDigits(computedEarnedFromWork)} দিন`,
          amountBDT: 0,
        },
        {
          labelBn: 'ইতিমধ্যে ভোগকৃত অর্জিত ছুটি',
          labelEn: 'Leave Already Used',
          formulaBn: `মোট ভোগকৃত ছুটি: ${toBengaliDigits(leaveUsed)} দিন`,
          amountBDT: 0,
        },
        {
          labelBn: 'অব্যবহৃত নগদায়নযোগ্য অর্জিত ছুটির টাকা',
          labelEn: 'Unused Annual Leave Encashment',
          formulaBn: `${toBengaliDigits(encashableRemaining)} দিন × ৳ ${toBengaliDigits(dailyWage)} (দৈনিক হার)`,
          amountBDT: payableAmount,
        },
        {
          labelBn: 'নৈমিত্তিক ছুটি (১০ দিন) ও অসুস্থতার ছুটি (১৪ দিন)',
          labelEn: 'Casual Leave (10d) & Sick Leave (14d)',
          formulaBn: 'ধারা ১১৫ ও ১১৬ অনুযায়ী নগদায়নযোগ্য নয় (অব্যবহৃত থাকলে বছর শেষে তামাদি হয়)',
          amountBDT: 0,
          isExcluded: true,
          exclusionReasonBn: 'শ্রম আইন অনুযায়ী শুধুমাত্র অর্জিত বাৎসরিক ছুটি (Earned Leave) নগদায়নযোগ্য।',
        },
      ];

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: encashableRemaining > 0,
        eligibilityStatusBn:
          encashableRemaining > 0
            ? 'অব্যবহৃত অর্জিত ছুটি নগদায়নের যোগ্য'
            : 'নগদায়নযোগ্য কোনো অব্যবহৃত অর্জিত ছুটি অবশিষ্ট নেই',
        eligibilityExplanationBn:
          rawRemaining > p.annualLeaveMaxCapFactory
            ? `শ্রম আইন ধারা ১১৭(৫) অনুযায়ী কারখানা শ্রমিকের ক্ষেত্রে সর্বোচ্চ ${toBengaliDigits(p.annualLeaveMaxCapFactory)} দিন পর্যন্ত অর্জিত ছুটি জমা থাকে।`
            : 'শ্রম আইন ধারা ১১৭ অনুযায়ী প্রতি ১৮ কার্যদিবসে ১ দিন অর্জিত ছুটি হিসাব করা হয়েছে।',
        serviceDuration: duration,
        wageBasisLabelBn,
        wageBasisAmountBDT:
          wageBasisMode === 'gross_30'
            ? wages.grossSalary
            : wageBasisMode === 'basic_30'
            ? wages.basicSalary
            : wages.statutoryLeaveWageMonthly,
        dailyRateUsedBDT: dailyWage,
        totalEstimatedPayableBDT: payableAmount,
        breakdownItems,
        summaryHighlights: [
          { labelBn: 'মোট অর্জিত ছুটি', valueBn: `${toBengaliDigits(computedEarnedFromWork)} দিন` },
          { labelBn: 'ভোগকৃত ছুটি', valueBn: `${toBengaliDigits(leaveUsed)} দিন` },
          { labelBn: 'অবশিষ্ট নগদায়নযোগ্য ছুটি', valueBn: `${toBengaliDigits(encashableRemaining)} দিন` },
          { labelBn: 'প্রযোজ্য দৈনিক মজুরি', valueBn: `৳ ${toBengaliDigits(dailyWage)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: [
            'কারখানা শ্রমিকের জন্য প্রতি ১৮ দিন কাজের বিপরীতে ১ দিন অর্জিত ছুটি ধরা হয়েছে (ধারা ১১৭)।',
            'ধারা ১১৯(১) অনুযায়ী ছুটিকালীন দৈনিক মজুরিতে মূল বেতন, বাড়ি ভাড়া, চিকিৎসা ও খাদ্য ভাতা অন্তর্ভুক্ত (যাতায়াত ভাতা ও ওভারটাইম ব্যতীত)।',
          ],
          limitationsBn: [
            'নৈমিত্তিক ছুটি (১০ দিন) এবং অসুস্থতাজনিত ছুটি (১৪ দিন) আইনগতভাবে নগদে ভাঙানো বা পরের বছরে জমা করা যায় না।',
            'কারখানার হাজিরা রেজিস্টারে প্রকৃত উপস্থিত কার্যদিবস অনুযায়ী চূড়ান্ত ছুটির দিন নির্ধারিত হবে।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    // =========================================================================
    // B. মাতৃত্বকালীন সুবিধা হিসাব (MATERNITY BENEFIT CALCULATOR)
    // =========================================================================
    case 'maternity_benefit': {
      const deliveryDate = String(rawInputs.expectedDeliveryDate || calculationDate).trim();
      const duration = calculateExactServiceDuration(joiningDate, deliveryDate);
      if (!duration.valid) {
        return buildIncompleteResult(catalogMeta, ruleVersion, {
          workerName,
          factoryName,
          department,
          designation,
          calculationDate,
          reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
        });
      }

      const livingChildren = Math.max(0, Number(rawInputs.livingChildrenCount ?? 0));
      const priorThreeMonthsWages = Math.max(0, Number(rawInputs.priorThreeMonthsTotalWages) || 0);
      const priorThreeMonthsDays = Math.max(1, Number(rawInputs.priorThreeMonthsDaysWorked) || 78);

      const hasSixMonthsTenure =
        duration.completedYears >= 1 ||
        duration.additionalMonths >= p.maternityMinServiceMonths ||
        duration.totalCalendarDays >= 180;
      const underChildLimit = livingChildren < p.maternityMaxLivingChildren;
      const isEligible = hasSixMonthsTenure && underChildLimit;

      // Sec 48 calculation: 3 months total wages / actual days worked in 3 months, or Gross / 26 (or 30)
      const threeMonthTotalUsed =
        priorThreeMonthsWages > 0 ? priorThreeMonthsWages : wages.grossSalary * 3;
      const daysWorkedUsed = priorThreeMonthsWages > 0 ? priorThreeMonthsDays : 90; // 90 calendar days for 3 months standard
      const dailyMaternityRate = roundCurrency(threeMonthTotalUsed / daysWorkedUsed);
      const totalMaternityDays = p.maternityLeaveWeeks * 7; // 112 days
      const firstInstallment8Weeks = isEligible ? roundCurrency(dailyMaternityRate * 56) : 0;
      const secondInstallment8Weeks = isEligible ? roundCurrency(dailyMaternityRate * 56) : 0;
      const totalPayable = roundCurrency(firstInstallment8Weeks + secondInstallment8Weeks);

      let eligibilityStatusBn = 'সবেতন মাতৃত্বকালীন সুবিধার যোগ্য (১৬ সপ্তাহ / ১১২ দিন)';
      let eligibilityExplanationBn =
        'সন্তান প্রসবের পূর্বে প্রতিষ্ঠানে অন্যূন ৬ মাস চাকরিকাল পূর্ণ হয়েছে এবং জীবিত সন্তানের সংখ্যা ২-এর কম।';

      if (!hasSixMonthsTenure) {
        eligibilityStatusBn = 'সবেতন মাতৃত্বকালীন সুবিধার শর্ত পূরণ হয়নি (চাকরিকাল ৬ মাসের কম)';
        eligibilityExplanationBn =
          'বাংলাদেশ শ্রম আইন ধারা ৪৬(১) অনুযায়ী মাতৃত্বকালীন সুবিধা পাওয়ার জন্য প্রসবের তারিখের অব্যবহিত পূর্বে মালিকের অধীনে অন্তত ৬ মাস কাজ করতে হবে।';
      } else if (!underChildLimit) {
        eligibilityStatusBn = 'সবেতন মাতৃত্বকালীন সুবিধা প্রযোজ্য নয় (জীবিত সন্তান ২ বা ততোধিক)';
        eligibilityExplanationBn =
          'ধারা ৪৬(২) অনুযায়ী প্রসবের সময় ২ বা ততোধিক সন্তান জীবিত থাকলে আর্থিক মাতৃত্বকালীন সুবিধা প্রাপ্য হবে না (তবে পাওনা ছুটি থাকলে ভোগ করতে পারবেন)।';
      }

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible,
        eligibilityStatusBn,
        eligibilityExplanationBn,
        serviceDuration: duration,
        wageBasisLabelBn:
          priorThreeMonthsWages > 0
            ? 'পূর্ববর্তী ৩ মাসের প্রকৃত প্রাপ্ত মোট মজুরি ÷ কর্মদিবস (ধারা ৪৮)'
            : 'মাসিক মোট মজুরি (Gross Salary) ভিত্তিক প্রাক্কলিত গড় দৈনিক হার',
        wageBasisAmountBDT: roundCurrency(threeMonthTotalUsed / 3),
        dailyRateUsedBDT: dailyMaternityRate,
        totalEstimatedPayableBDT: totalPayable,
        breakdownItems: [
          {
            labelBn: 'প্রথম কিস্তি: প্রসব-পূর্ব ৮ সপ্তাহ (৫৬ দিন)',
            labelEn: '1st Installment: Pre-delivery 8 weeks (56 days)',
            formulaBn: isEligible
              ? `৫৬ দিন × ৳ ${toBengaliDigits(dailyMaternityRate)} (দৈনিক গড় মজুরি)`
              : 'যোগ্যতার শর্ত অপূর্ণ থাকায় প্রযোজ্য নয়',
            amountBDT: firstInstallment8Weeks,
          },
          {
            labelBn: 'দ্বিতীয় কিস্তি: প্রসব-পরবর্তী ৮ সপ্তাহ (৫৬ দিন)',
            labelEn: '2nd Installment: Post-delivery 8 weeks (56 days)',
            formulaBn: isEligible
              ? `৫৬ দিন × ৳ ${toBengaliDigits(dailyMaternityRate)} (দৈনিক গড় মজুরি)`
              : 'যোগ্যতার শর্ত অপূর্ণ থাকায় প্রযোজ্য নয়',
            amountBDT: secondInstallment8Weeks,
          },
        ],
        summaryHighlights: [
          { labelBn: 'যোগ্যতার ফলাফল', valueBn: isEligible ? 'যোগ্য (Eligible)' : 'অযোগ্য' },
          { labelBn: 'মোট ছুটির মেয়াদ', valueBn: `${toBengaliDigits(p.maternityLeaveWeeks)} সপ্তাহ (${toBengaliDigits(totalMaternityDays)} দিন)` },
          { labelBn: 'দৈনিক গড় মজুরি হার', valueBn: `৳ ${toBengaliDigits(dailyMaternityRate)}` },
          { labelBn: 'প্রতি কিস্তি (৮ সপ্তাহ)', valueBn: `৳ ${toBengaliDigits(firstInstallment8Weeks)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: [
            'ধারা ৪৮ অনুযায়ী পূর্ববর্তী ৩ মাসের মোট প্রাপ্ত মজুরিকে প্রকৃত কর্মদিবস দ্বারা ভাগ করে দৈনিক গড় মজুরি নির্ধারণ করা হয়।',
            'ধারা ৪৯ অনুযায়ী মালিককে অবহিত করার পর প্রসব-পূর্ব ৮ সপ্তাহ এবং প্রসব-পরবর্তী ৮ সপ্তাহ মোট ২ কিস্তিতে এই অর্থ পরিশোধযোগ্য।',
          ],
          limitationsBn: [
            'চাকরিকাল ৬ মাসের কম হলে বা প্রসবের সময় ২ জন জীবিত সন্তান থাকলে এই আর্থিক সুবিধা প্রযোজ্য নয়।',
            'প্রকৃত ৩ মাসের পে-স্লিপ ও হাজিরার দিনের ওপর ভিত্তি করে কারখানার চূড়ান্ত অংক সামান্য কমবেশি হতে পারে।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    // =========================================================================
    // C. সার্ভিস বেনিফিট হিসাব (SERVICE BENEFIT CALCULATOR)
    // =========================================================================
    case 'service_benefit': {
      const duration = calculateExactServiceDuration(joiningDate, calculationDate);
      if (!duration.valid) {
        return buildIncompleteResult(catalogMeta, ruleVersion, {
          workerName,
          factoryName,
          department,
          designation,
          calculationDate,
          reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
        });
      }

      const hasGratuityPolicy = Boolean(rawInputs.hasGratuityPolicy);
      const alreadyPaid = Math.max(0, Number(rawInputs.alreadyPaidAdvanceBDT) || 0);
      const yrs = duration.completedYears;

      // Statutory Sec 27(4) Service Benefit:
      // 5 to <10 completed years: 14 days basic per completed year
      // 10+ completed years: 30 days basic per completed year
      let statutoryDaysPerYear = 0;
      if (employmentType === 'permanent') {
        if (yrs >= p.serviceBenefitTier2MinYears) {
          statutoryDaysPerYear = p.serviceBenefitTier2DaysPerYear;
        } else if (yrs >= p.serviceBenefitTier1MinYears) {
          statutoryDaysPerYear = p.serviceBenefitTier1DaysPerYear;
        }
      }

      const statutoryServiceBenefit = roundCurrency(
        yrs * statutoryDaysPerYear * wages.dailyBasic30
      );

      // Optional Gratuity comparison under Sec 2(10):
      // 30 days basic per year (or 45 days if > 10 years), using gratuityRoundedYears (>6 months rounds up)
      const gratuityRateDays =
        yrs > 10 ? p.gratuityDaysPerYearOver10Yrs : p.gratuityDaysPerYearStandard;
      const gratuityComparisonAmount =
        hasGratuityPolicy && duration.gratuityRoundedYears >= 1
          ? roundCurrency(duration.gratuityRoundedYears * gratuityRateDays * wages.dailyBasic30)
          : 0;

      const grossEntitlement = Math.max(statutoryServiceBenefit, gratuityComparisonAmount);
      const netPayable = Math.max(0, roundCurrency(grossEntitlement - alreadyPaid));
      const isEligible = grossEntitlement > 0;

      const breakdownItems: BreakdownLineItem[] = [
        {
          labelBn: `ধারা ২৭(৪) অনুযায়ী সার্ভিস বেনিফিট (${toBengaliDigits(yrs)} পূর্ণ বছর × ${toBengaliDigits(statutoryDaysPerYear)} দিন)`,
          labelEn: 'Statutory Service Benefit (Sec 27(4))',
          formulaBn:
            statutoryDaysPerYear > 0
              ? `${toBengaliDigits(yrs)} বছর × ${toBengaliDigits(statutoryDaysPerYear)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)} (দৈনিক মূল বেতন)`
              : 'স্থায়ী চাকরিকাল ৫ বছরের কম হওয়ায় ধারা ২৭(৪) প্রযোজ্য নয়',
          amountBDT: statutoryServiceBenefit,
        },
      ];

      if (hasGratuityPolicy) {
        breakdownItems.push({
          labelBn: `গ্র্যাচুইটি তুলনা — ধারা ২(১০) (${toBengaliDigits(duration.gratuityRoundedYears)} বছর × ${toBengaliDigits(gratuityRateDays)} দিন)`,
          labelEn: 'Gratuity Policy Comparison (Sec 2(10))',
          formulaBn: `${toBengaliDigits(duration.gratuityRoundedYears)} হিসাবকৃত বছর × ${toBengaliDigits(gratuityRateDays)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)} (সার্ভিস বেনিফিট ও গ্র্যাচুইটির মধ্যে যেটি বেশি তা প্রাপ্য)`,
          amountBDT: gratuityComparisonAmount,
        });
      }

      if (alreadyPaid > 0) {
        breakdownItems.push({
          labelBn: 'ইতিমধ্যে গৃহীত অগ্রিম বা আংশিক সার্ভিস বেনিফিট কর্তন',
          labelEn: 'Less: Previously Paid Benefit/Advance',
          formulaBn: `পূর্ববর্তী পরিশোধিত অর্থ বাদ দেওয়া হয়েছে`,
          amountBDT: alreadyPaid,
          isDeduction: true,
        });
      }

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible,
        eligibilityStatusBn: isEligible
          ? 'সার্ভিস বেনিফিট / গ্র্যাচুইটি পাওয়ার যোগ্য'
          : 'স্থায়ী চাকরিকাল ৫ বছর পূর্ণ না হওয়ায় স্বেচ্ছায় অবসানে ধারা ২৭(৪) সার্ভিস বেনিফিট প্রযোজ্য নয়',
        eligibilityExplanationBn:
          employmentType !== 'permanent'
            ? 'ধারা ২৭(৪) অনুযায়ী সার্ভিস বেনিফিট মূলত স্থায়ী (Permanent) শ্রমিকদের ক্ষেত্রে প্রযোজ্য।'
            : yrs < 5
            ? `আপনার পূর্ণ চাকরিকাল ${toBengaliDigits(yrs)} বছর। স্বেচ্ছায় পদত্যাগে সার্ভিস বেনিফিটের জন্য ন্যূনতম ৫ বছর পূর্ণ চাকরি প্রয়োজন (তবে ছাঁটাই বা টার্মিনেশনে ১ বছর হলেই ক্ষতিপূরণ প্রযোজ্য)।`
            : yrs < 10
            ? `৫ থেকে ৯ বছর পূর্ণ চাকরির জন্য প্রতি বছর ১৪ দিনের মূল বেতন হারে সার্ভিস বেনিফিট প্রযোজ্য।`
            : `১০ বছর বা তদূর্ধ্ব পূর্ণ চাকরির জন্য প্রতি বছর ৩০ দিনের মূল বেতন বা গ্র্যাচুইটি (যেটি বেশি) প্রযোজ্য।`,
        serviceDuration: duration,
        wageBasisLabelBn: 'সর্বশেষ মাসিক মূল বেতন (Basic Salary ÷ ৩০)',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: netPayable,
        breakdownItems,
        summaryHighlights: [
          { labelBn: 'মোট চাকরির মেয়াদ', valueBn: duration.formattedBn },
          { labelBn: 'পূর্ণ চাকরির বছর', valueBn: `${toBengaliDigits(yrs)} বছর` },
          { labelBn: 'প্রযোজ্য হার (প্রতি বছর)', valueBn: `${toBengaliDigits(Math.max(statutoryDaysPerYear, hasGratuityPolicy ? gratuityRateDays : 0))} দিনের মূল বেতন` },
          { labelBn: 'প্রাক্কলিত নিট সার্ভিস বেনিফিট', valueBn: `৳ ${toBengaliDigits(netPayable)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: [
            'সার্ভিস বেনিফিটের ক্ষেত্রে পূর্ণ বছর (Completed Years) এবং গ্র্যাচুইটির ক্ষেত্রে ৬ মাসের অধিক অতিরিক্ত সময়কে ১ পূর্ণ বছর ধরা হয়েছে (ধারা ২(১০))।',
            'আইন অনুযায়ী সার্ভিস বেনিফিট এবং গ্র্যাচুইটি একসাথে যোগ হয় না; দুটির মধ্যে যেটি শ্রমিকের জন্য বেশি লাভজনক সেটি প্রাপ্য।',
          ],
          limitationsBn: [
            'গ্র্যাচুইটি শুধুমাত্র সেসব প্রতিষ্ঠানে প্রযোজ্য যেখানে অনুমোদিত গ্র্যাচুইটি তহবিল বা নিয়ম চালু রয়েছে।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    // =========================================================================
    // D. ছাঁটাইকৃত বেনিফিট হিসাব (RETRENCHMENT BENEFIT CALCULATOR)
    // =========================================================================
    case 'retrenchment_benefit': {
      const duration = calculateExactServiceDuration(joiningDate, calculationDate);
      if (!duration.valid) {
        return buildIncompleteResult(catalogMeta, ruleVersion, {
          workerName,
          factoryName,
          department,
          designation,
          calculationDate,
          reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
        });
      }

      const yrs = duration.completedYears;
      const isEligibleForRetrenchmentComp = yrs >= p.retrenchmentMinServiceYears;
      const noticeProvided = Boolean(rawInputs.noticeProvidedByEmployer);
      const hasGratuity = Boolean(rawInputs.hasGratuityPolicy);
      const unusedLeaveDays = Math.max(0, Number(rawInputs.unusedAnnualLeaveDays) || 0);
      const otherDues = Math.max(0, Number(rawInputs.otherLawfulDuesBDT) || 0);

      // Sec 20(2)(a): 1 month notice or 1 month's wages in lieu of notice
      const noticePayAmount =
        isEligibleForRetrenchmentComp && !noticeProvided ? wages.basicSalary : 0;

      // Sec 20(2)(b): 30 days' basic wages for every year of service OR gratuity, whichever is higher
      const retrenchmentComp = isEligibleForRetrenchmentComp
        ? roundCurrency(yrs * p.retrenchmentDaysPerYear * wages.dailyBasic30)
        : 0;

      const gratuityRateDays =
        yrs > 10 ? p.gratuityDaysPerYearOver10Yrs : p.gratuityDaysPerYearStandard;
      const gratuityAmount =
        isEligibleForRetrenchmentComp && hasGratuity
          ? roundCurrency(duration.gratuityRoundedYears * gratuityRateDays * wages.dailyBasic30)
          : 0;

      const effectiveCompensation = Math.max(retrenchmentComp, gratuityAmount);
      const leaveEncashment = roundCurrency(unusedLeaveDays * wages.dailyStatutoryLeaveWage30);
      const totalPayable = roundCurrency(
        effectiveCompensation + noticePayAmount + leaveEncashment + otherDues
      );

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: isEligibleForRetrenchmentComp,
        eligibilityStatusBn: isEligibleForRetrenchmentComp
          ? 'ধারা ২০ অনুযায়ী ছাঁটাইজনিত ক্ষতিপূরণ ও নোটিশ পে পাওয়ার যোগ্য'
          : 'চাকরিকাল ১ বছরের কম হওয়ায় ধারা ২০-এর ছাঁটাই ক্ষতিপূরণ প্রযোজ্য নয় (তবে বকেয়া বেতন ও ছুটির টাকা প্রাপ্য)',
        eligibilityExplanationBn:
          'ছাঁটাই (Retrenchment) অর্থ কারখানায় কাজের সংকোচন বা প্রয়োজনাতিরিক্ততার কারণে মালিক কর্তৃক চাকরির অবসান—এটি ডিসমিসাল (বরখাস্ত) বা স্বেচ্ছায় পদত্যাগ নয়।',
        serviceDuration: duration,
        wageBasisLabelBn: 'মাসিক মূল বেতন (Basic Salary) ও ছুটিকালীন গড় মজুরি (ধারা ১১৯)',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: totalPayable,
        breakdownItems: [
          {
            labelBn: `ছাঁটাই ক্ষতিপূরণ (${toBengaliDigits(yrs)} বছর × ৩০ দিনের মূল বেতন)`,
            labelEn: 'Retrenchment Compensation (Sec 20(2)(b))',
            formulaBn: isEligibleForRetrenchmentComp
              ? `${toBengaliDigits(yrs)} পূর্ণ বছর × ৩০ দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`
              : '১ বছর পূর্ণ না হওয়ায় প্রযোজ্য নয়',
            amountBDT: effectiveCompensation,
          },
          {
            labelBn: 'নোটিশ পে (১ মাসের লিখিত নোটিশের পরিবর্তে মজুরি — ধারা ২০(২)(ক))',
            labelEn: 'Notice Pay in Lieu of 1 Month Notice',
            formulaBn: noticeProvided
              ? '১ মাসের লিখিত নোটিশ প্রদান করা হয়েছে (নোটিশ পে প্রযোজ্য নয়)'
              : isEligibleForRetrenchmentComp
              ? 'নোটিশ না দেওয়ায় ১ মাসের মূল বেতন'
              : '১ বছর পূর্ণ না হওয়ায় প্রযোজ্য নয়',
            amountBDT: noticePayAmount,
          },
          {
            labelBn: `অব্যবহৃত অর্জিত ছুটির টাকা (${toBengaliDigits(unusedLeaveDays)} দিন)`,
            labelEn: 'Unused Annual Leave Encashment',
            formulaBn: `${toBengaliDigits(unusedLeaveDays)} দিন × ৳ ${toBengaliDigits(wages.dailyStatutoryLeaveWage30)}`,
            amountBDT: leaveEncashment,
          },
          ...(otherDues > 0
            ? [
                {
                  labelBn: 'অন্যান্য বকেয়া পাওনা (বকেয়া বেতন/ওভারটাইম)',
                  labelEn: 'Other Lawful Outstanding Dues',
                  formulaBn: 'প্রদত্ত বকেয়া হিসাব অনুযায়ী',
                  amountBDT: otherDues,
                },
              ]
            : []),
        ],
        summaryHighlights: [
          { labelBn: 'চাকরিকাল', valueBn: duration.formattedBn },
          { labelBn: 'ছাঁটাই ক্ষতিপূরণ', valueBn: `৳ ${toBengaliDigits(effectiveCompensation)}` },
          { labelBn: 'নোটিশ পে', valueBn: `৳ ${toBengaliDigits(noticePayAmount)}` },
          { labelBn: 'অব্যবহৃত ছুটির টাকা', valueBn: `৳ ${toBengaliDigits(leaveEncashment)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: [
            'ধারা ২০ অনুযায়ী কোনো শ্রমিক কোনো প্রতিষ্ঠানে অন্তত ১ বছর অবিচ্ছিন্নভাবে চাকরিরত থাকলে ছাঁটাইয়ের ক্ষেত্রে ১ মাসের নোটিশ (বা নোটিশ পে) এবং প্রতি বছরের জন্য ৩০ দিনের মূল মজুরি বা গ্র্যাচুইটি (যেটি বেশি) প্রাপ্য।',
          ],
          limitationsBn: [
            'ছাঁটাই (ধারা ২০), মালিক কর্তৃক টার্মিনেশন (ধারা ২৬) এবং অসদাচরণের জন্য বরখাস্ত (ধারা ২৩) আইনগতভাবে আলাদা।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    // =========================================================================
    // E. টার্মিনেশন বেনিফিট হিসাব (TERMINATION BENEFIT CALCULATOR)
    // =========================================================================
    case 'termination_benefit': {
      const duration = calculateExactServiceDuration(joiningDate, calculationDate);
      if (!duration.valid) {
        return buildIncompleteResult(catalogMeta, ruleVersion, {
          workerName,
          factoryName,
          department,
          designation,
          calculationDate,
          reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
        });
      }

      const category = String(
        rawInputs.terminationCategory || 'employer_section_26_permanent'
      );
      const noticeProvided = Boolean(rawInputs.noticeProvidedByEmployer);
      const hasGratuity = Boolean(rawInputs.hasGratuityPolicy);
      const unusedLeaveDays = Math.max(0, Number(rawInputs.unusedAnnualLeaveDays) || 0);
      const otherDues = Math.max(0, Number(rawInputs.otherLawfulDuesBDT) || 0);
      const yrs = duration.completedYears;

      let categoryTitleBn = 'ধারা ২৬ — মালিক কর্তৃক স্থায়ী শ্রমিকের চাকরি অবসান (Termination Simpliciter)';
      let noticeDaysRequired = p.terminationNoticeDaysPermanent; // 120 days
      let compensationDaysPerYear = yrs >= 1 ? p.terminationDaysPerYear : 0; // 30 days per year

      if (category === 'employer_section_26_temporary') {
        categoryTitleBn = 'ধারা ২৬ — অস্থায়ী শ্রমিকের চাকরি অবসান (কাজের প্রকৃতিগত নয়)';
        noticeDaysRequired = p.terminationNoticeDaysTemporary; // 30 days
        compensationDaysPerYear = 0;
      } else if (category === 'misconduct_dismissal_sec_23') {
        categoryTitleBn = 'ধারা ২৩/২৪ — অসদাচরণের কারণে বরখাস্ত (Dismissal for Misconduct)';
        noticeDaysRequired = 0;
        compensationDaysPerYear = 0;
      } else if (category === 'discharge_incapacity_sec_22') {
        categoryTitleBn = 'ধারা ২২ — শারীরিক বা মানসিক অক্ষমতাজনিত ডিসচার্জ (Discharge)';
        noticeDaysRequired = 0;
        compensationDaysPerYear = yrs >= 1 ? p.dischargeDaysPerYear : 0;
      }

      const noticePay =
        !noticeProvided && noticeDaysRequired > 0
          ? roundCurrency(noticeDaysRequired * wages.dailyBasic30)
          : 0;

      const statutoryComp = roundCurrency(yrs * compensationDaysPerYear * wages.dailyBasic30);
      const gratuityRateDays =
        yrs > 10 ? p.gratuityDaysPerYearOver10Yrs : p.gratuityDaysPerYearStandard;
      const gratuityComp =
        hasGratuity && compensationDaysPerYear > 0 && duration.gratuityRoundedYears >= 1
          ? roundCurrency(duration.gratuityRoundedYears * gratuityRateDays * wages.dailyBasic30)
          : 0;

      const effectiveComp = Math.max(statutoryComp, gratuityComp);
      const leaveEncashment = roundCurrency(unusedLeaveDays * wages.dailyStatutoryLeaveWage30);
      const totalPayable = roundCurrency(noticePay + effectiveComp + leaveEncashment + otherDues);

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: totalPayable > 0,
        eligibilityStatusBn: categoryTitleBn,
        eligibilityExplanationBn:
          category === 'misconduct_dismissal_sec_23'
            ? 'ধারা ২৩ অনুযায়ী প্রমাণিত অসদাচরণের কারণে ডিসমিস (বরখাস্ত) হলে নোটিশ পে প্রযোজ্য নয়; তবে অর্জিত ছুটির টাকা ও বকেয়া মজুরি অবশ্যই প্রাপ্য।'
            : 'ধারা ২৬ অনুযায়ী স্থায়ী শ্রমিককে অবসান করতে হলে ১২০ দিনের লিখিত নোটিশ (অথবা ৪ মাসের মূল বেতন) এবং প্রতি পূর্ণ বছরের জন্য ৩০ দিনের মূল বেতন বা গ্র্যাচুইটি প্রাপ্য।',
        serviceDuration: duration,
        wageBasisLabelBn: 'মাসিক মূল বেতন (Basic Salary ÷ ৩০)',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: totalPayable,
        breakdownItems: [
          {
            labelBn: `নোটিশ পে (${toBengaliDigits(noticeDaysRequired)} দিনের নোটিশের পরিবর্তে মূল বেতন)`,
            labelEn: 'Notice Pay',
            formulaBn:
              noticeDaysRequired === 0
                ? 'এই ক্যাটাগরিতে নোটিশ পে প্রযোজ্য নয়'
                : noticeProvided
                ? 'নির্ধারিত নোটিশ প্রদান করা হয়েছে'
                : `${toBengaliDigits(noticeDaysRequired)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`,
            amountBDT: noticePay,
          },
          {
            labelBn: `চাকরি অবসান ক্ষতিপূরণ / গ্র্যাচুইটি (${toBengaliDigits(yrs)} পূর্ণ বছর)`,
            labelEn: 'Termination / Service Compensation',
            formulaBn:
              compensationDaysPerYear > 0
                ? `${toBengaliDigits(yrs)} বছর × ${toBengaliDigits(compensationDaysPerYear)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`
                : 'এই ক্যাটাগরি বা মেয়াদে প্রযোজ্য নয়',
            amountBDT: effectiveComp,
          },
          {
            labelBn: `অব্যবহৃত অর্জিত ছুটির টাকা (${toBengaliDigits(unusedLeaveDays)} দিন)`,
            labelEn: 'Unused Annual Leave Encashment',
            formulaBn: `${toBengaliDigits(unusedLeaveDays)} দিন × ৳ ${toBengaliDigits(wages.dailyStatutoryLeaveWage30)}`,
            amountBDT: leaveEncashment,
          },
          ...(otherDues > 0
            ? [
                {
                  labelBn: 'অন্যান্য বকেয়া পাওনা',
                  labelEn: 'Other Outstanding Dues',
                  formulaBn: 'বকেয়া বেতন ও ওভারটাইম',
                  amountBDT: otherDues,
                },
              ]
            : []),
        ],
        summaryHighlights: [
          { labelBn: 'অবসানের ধরন', valueBn: categoryTitleBn.split('—')[0].trim() },
          { labelBn: 'নোটিশ পে', valueBn: `৳ ${toBengaliDigits(noticePay)}` },
          { labelBn: 'ক্ষতিপূরণ / বেনিফিট', valueBn: `৳ ${toBengaliDigits(effectiveComp)}` },
          { labelBn: 'অব্যবহৃত ছুটির টাকা', valueBn: `৳ ${toBengaliDigits(leaveEncashment)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: [
            'টার্মিনেশনের ধরন (ধারা ২৬, ধারা ২২ বা ধারা ২৩) অনুযায়ী নোটিশ পে এবং ক্ষতিপূরণের হার ভিন্ন হয়।',
            'ধারা ১২৩ অনুযায়ী চাকরি অবসানের পরবর্তী সর্বোচ্চ ৩০ কর্মদিবসের মধ্যে সকল চূড়ান্ত পাওনা পরিশোধ করা বাধ্যতামূলক।',
          ],
          limitationsBn: [
            'অসদাচরণের অভিযোগে বরখাস্তের ক্ষেত্রে আইনানুগ তদন্ত প্রক্রিয়া (ধারা ২৪) অনুসরণ করা হয়েছে কিনা তার ওপর চূড়ান্ত দাবি নির্ভর করে।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    // =========================================================================
    // F. মৃত্যুর ক্ষেত্রে ক্ষতিপূরণ হিসাব (DEATH COMPENSATION CALCULATOR)
    // =========================================================================
    case 'death_compensation': {
      const duration = calculateExactServiceDuration(joiningDate, calculationDate);
      if (!duration.valid) {
        return buildIncompleteResult(catalogMeta, ruleVersion, {
          workerName,
          factoryName,
          department,
          designation,
          calculationDate,
          reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
        });
      }

      const deathInService = Boolean(rawInputs.deathDuringEmployment ?? true);
      const isWorkplaceAccident = Boolean(rawInputs.deathByWorkplaceAccident);
      const hasGratuity = Boolean(rawInputs.hasGratuityPolicy);
      const unusedLeaveDays = Math.max(0, Number(rawInputs.unusedAnnualLeaveDays) || 0);
      const otherDues = Math.max(0, Number(rawInputs.otherLawfulDuesBDT) || 0);
      const yrs = duration.completedYears;

      // Sec 19: If worker dies after > 2 continuous years (or >= 2 completed years):
      // Normal death: 30 days basic per completed year
      // Death while on duty or following workplace accident: 45 days basic per completed year
      // OR Gratuity, whichever is higher
      const qualifiesSec19 =
        deathInService &&
        (yrs > p.deathBenefitMinServiceYears ||
          (yrs === p.deathBenefitMinServiceYears &&
            (duration.additionalMonths > 0 || duration.additionalDays > 0)));

      const sec19DaysPerYear = isWorkplaceAccident
        ? p.deathDutyAccidentDaysPerYear // 45 days
        : p.deathNormalDaysPerYear; // 30 days

      const sec19Amount = qualifiesSec19
        ? roundCurrency(duration.gratuityRoundedYears * sec19DaysPerYear * wages.dailyBasic30)
        : 0;

      const gratuityRateDays =
        yrs > 10 ? p.gratuityDaysPerYearOver10Yrs : p.gratuityDaysPerYearStandard;
      const gratuityAmount =
        qualifiesSec19 && hasGratuity
          ? roundCurrency(duration.gratuityRoundedYears * gratuityRateDays * wages.dailyBasic30)
          : 0;

      const effectiveSec19OrGratuity = Math.max(sec19Amount, gratuityAmount);

      // Sec 150 & Fifth Schedule: Statutory workplace accident death compensation (৳ 2,00,000)
      // Note: Sec 19 explicitly states the death benefit is payable IN ADDITION TO any other benefit to which the deceased worker would have been entitled.
      const fifthScheduleAccidentGrant =
        deathInService && isWorkplaceAccident ? p.workplaceAccidentDeathGrantBDT : 0;

      const leaveEncashment = roundCurrency(unusedLeaveDays * wages.dailyStatutoryLeaveWage30);
      const totalPayable = roundCurrency(
        effectiveSec19OrGratuity + fifthScheduleAccidentGrant + leaveEncashment + otherDues
      );

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: qualifiesSec19 || fifthScheduleAccidentGrant > 0,
        eligibilityStatusBn:
          qualifiesSec19 && isWorkplaceAccident
            ? 'ধারা ১৯ মৃত্যুজনিত সুবিধা এবং ধারা ১৫০ (তফসিল ৫) দুর্ঘটনাজনিত ক্ষতিপূরণ উভয়ের যোগ্য'
            : qualifiesSec19
            ? 'ধারা ১৯ অনুযায়ী চাকরিরত অবস্থায় মৃত্যুজনিত সুবিধার যোগ্য'
            : isWorkplaceAccident
            ? 'তফসিল ৫ অনুযায়ী কর্মক্ষেত্রে দুর্ঘটনাজনিত এককালীন মৃত্যু ক্ষতিপূরণের যোগ্য (চাকরিকাল ২ বছরের কম হওয়ায় ধারা ১৯ প্রযোজ্য নয়)'
            : 'অবিচ্ছিন্ন চাকরিকাল ২ বছরের অধিক না হওয়ায় ধারা ১৯ মৃত্যুজনিত সুবিধা প্রযোজ্য নয় (তবে বকেয়া বেতন ও ছুটির টাকা নমিনি পাবেন)',
        eligibilityExplanationBn:
          'ধারা ১৯ অনুযায়ী কোনো শ্রমিক অবিচ্ছিন্নভাবে ২ বছরের অধিককাল চাকরিরত থাকা অবস্থায় মৃত্যুবরণ করলে প্রতি পূর্ণ বছর বা ৬ মাসের অধিক সময়ের জন্য ৩০ দিনের (অথবা কর্তব্যরত অবস্থায় বা দুর্ঘটনার কারণে মৃত্যু হলে ৪৫ দিনের) মূল মজুরি অথবা গ্র্যাচুইটি (যেটি বেশি) নমিনি বা ওয়ারিশগণ পাবেন।',
        serviceDuration: duration,
        wageBasisLabelBn: 'সর্বশেষ মূল বেতন (Basic Salary ÷ ৩০) ও তফসিল ৫ নির্ধারিত ক্ষতিপূরণ',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: totalPayable,
        breakdownItems: [
          {
            labelBn: `ধারা ১৯ মৃত্যুজনিত সার্ভিস বেনিফিট / গ্র্যাচুইটি (${toBengaliDigits(duration.gratuityRoundedYears)} বছর × ${toBengaliDigits(sec19DaysPerYear)} দিন)`,
            labelEn: 'Section 19 Death-in-Service Benefit',
            formulaBn: qualifiesSec19
              ? `${toBengaliDigits(duration.gratuityRoundedYears)} বছর × ${toBengaliDigits(sec19DaysPerYear)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`
              : 'চাকরিকাল ২ বছরের অধিক না হওয়ায় প্রযোজ্য নয়',
            amountBDT: effectiveSec19OrGratuity,
          },
          {
            labelBn: 'কর্মক্ষেত্রে দুর্ঘটনাজনিত এককালীন মৃত্যু ক্ষতিপূরণ (ধারা ১৫০ ও ৫ম তফসিল)',
            labelEn: 'Workplace Accident Death Compensation (Sec 150 & 5th Schedule)',
            formulaBn: isWorkplaceAccident
              ? 'শ্রম আইনের ৫ম তফসিল অনুযায়ী নির্ধারিত এককালীন ক্ষতিপূরণ'
              : 'স্বাভাবিক মৃত্যুর ক্ষেত্রে ৫ম তফসিলের দুর্ঘটনা ক্ষতিপূরণ প্রযোজ্য নয়',
            amountBDT: fifthScheduleAccidentGrant,
          },
          {
            labelBn: `অব্যবহৃত অর্জিত ছুটির টাকা (${toBengaliDigits(unusedLeaveDays)} দিন)`,
            labelEn: 'Unused Annual Leave Encashment',
            formulaBn: `${toBengaliDigits(unusedLeaveDays)} দিন × ৳ ${toBengaliDigits(wages.dailyStatutoryLeaveWage30)}`,
            amountBDT: leaveEncashment,
          },
          ...(otherDues > 0
            ? [
                {
                  labelBn: 'অন্যান্য বকেয়া বেতন ও ভাতা',
                  labelEn: 'Other Unpaid Salary & Overtime Dues',
                  formulaBn: 'প্রদত্ত বকেয়া হিসাব',
                  amountBDT: otherDues,
                },
              ]
            : []),
        ],
        summaryHighlights: [
          { labelBn: 'হিসাবকৃত চাকরিকাল', valueBn: `${toBengaliDigits(duration.gratuityRoundedYears)} বছর (${duration.formattedBn})` },
          { labelBn: 'ধারা ১৯ মৃত্যু সুবিধা', valueBn: `৳ ${toBengaliDigits(effectiveSec19OrGratuity)}` },
          { labelBn: 'দুর্ঘটনা ক্ষতিপূরণ (তফসিল ৫)', valueBn: `৳ ${toBengaliDigits(fifthScheduleAccidentGrant)}` },
          { labelBn: 'নমিনির প্রাক্কলিত মোট প্রাপ্য', valueBn: `৳ ${toBengaliDigits(totalPayable)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: [
            'ধারা ১৯-এ ৬ মাসের অধিক অতিরিক্ত চাকরিকালকে ১ পূর্ণ বছর হিসেবে গণনা করা হয়েছে।',
            'রপ্তানিমুখী গার্মেন্টস সেক্টরে কেন্দ্রীয় তহবিল (Central Fund) বা গ্রুপ ইন্স্যুরেন্স থাকলে অতিরিক্ত সরকারি অনুদানও নমিনি দাবি করতে পারেন।',
          ],
          limitationsBn: [
            'চূড়ান্ত প্রাপ্যতা মৃত্যু সনদ, নমিনি ফরম এবং দুর্ঘটনাজনিত মৃত্যুর ক্ষেত্রে কারখানা পরিদর্শক/শ্রম আদালতের যাচাইয়ের ওপর নির্ভরশীল।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    // =========================================================================
    // COMBINED: চাকরি শেষে মোট পাওনা হিসাব (FINAL SETTLEMENT CALCULATOR)
    // =========================================================================
    case 'final_settlement': {
      const duration = calculateExactServiceDuration(joiningDate, calculationDate);
      if (!duration.valid) {
        return buildIncompleteResult(catalogMeta, ruleVersion, {
          workerName,
          factoryName,
          department,
          designation,
          calculationDate,
          reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
        });
      }

      const separationMode = String(rawInputs.separationModeForFinalSettlement || 'resignation');
      const unpaidSalaryDays = Math.max(0, Number(rawInputs.unpaidSalaryDays) || 0);
      const unpaidOtHours = Math.max(0, Number(rawInputs.unpaidOvertimeHours) || 0);
      const unusedLeaveDays = Math.max(0, Number(rawInputs.unusedAnnualLeaveDays) || 0);
      const noticeProvided = Boolean(rawInputs.noticeProvidedByEmployer);
      const hasGratuity = Boolean(rawInputs.hasGratuityPolicy);
      const otherDues = Math.max(0, Number(rawInputs.otherLawfulDuesBDT) || 0);
      const advanceDeduction = Math.max(0, Number(rawInputs.lawfulAdvanceDeductionBDT) || 0);
      const yrs = duration.completedYears;

      // 1. Unpaid Salary for worked days in final month
      const unpaidSalaryAmount = roundCurrency(unpaidSalaryDays * wages.dailyGross30);
      // 2. Outstanding Overtime
      const unpaidOtAmount = roundCurrency(unpaidOtHours * wages.hourlyOtRate2x);
      // 3. Unused Earned Annual Leave
      const leaveEncashmentAmount = roundCurrency(
        Math.min(unusedLeaveDays, p.annualLeaveMaxCapFactory) * wages.dailyStatutoryLeaveWage30
      );

      // 4. Separation Benefit (Mutually Exclusive — prevents double counting!)
      let separationBenefitDaysPerYear = 0;
      let separationLabelBn = 'সার্ভিস বেনিফিট (পদত্যাগ — ধারা ২৭)';
      let excludedAlternativeNoteBn =
        'পদত্যাগের ক্ষেত্রে ধারা ২০ (ছাঁটাই) বা ধারা ২৬ (মালিক কর্তৃক টার্মিনেশন) ক্ষতিপূরণ প্রযোজ্য নয় (ডাবল কাউন্টিং রোধ করা হয়েছে)।';
      let noticePayReceivable = 0;

      if (separationMode === 'retrenchment') {
        separationLabelBn = 'ছাঁটাই ক্ষতিপূরণ (ধারা ২০)';
        separationBenefitDaysPerYear = yrs >= 1 ? p.retrenchmentDaysPerYear : 0;
        noticePayReceivable = yrs >= 1 && !noticeProvided ? wages.basicSalary : 0;
        excludedAlternativeNoteBn =
          'ছাঁটাই ক্ষতিপূরণ অন্তর্ভুক্ত করায় পৃথক টার্মিনেশন বা পদত্যাগ বেনিফিট যোগ করা হয়নি।';
      } else if (separationMode === 'termination_sec26') {
        separationLabelBn = 'মালিক কর্তৃক চাকরি অবসান বেনিফিট (ধারা ২৬)';
        separationBenefitDaysPerYear = yrs >= 1 ? p.terminationDaysPerYear : 0;
        noticePayReceivable =
          !noticeProvided ? roundCurrency(p.terminationNoticeDaysPermanent * wages.dailyBasic30) : 0;
        excludedAlternativeNoteBn =
          'ধারা ২৬ অবসান বেনিফিট অন্তর্ভুক্ত করায় পৃথক ছাঁটাই বেনিফিট যোগ করা হয়নি।';
      } else if (separationMode === 'discharge_sec22') {
        separationLabelBn = 'অক্ষমতাজনিত ডিসচার্জ বেনিফিট (ধারা ২২)';
        separationBenefitDaysPerYear = yrs >= 1 ? p.dischargeDaysPerYear : 0;
        noticePayReceivable = 0;
        excludedAlternativeNoteBn =
          'ধারা ২২ ডিসচার্জ বেনিফিট অন্তর্ভুক্ত করায় পৃথক নোটিশ পে প্রযোজ্য নয়।';
      } else {
        // Resignation (Sec 27)
        if (yrs >= 10) separationBenefitDaysPerYear = p.serviceBenefitTier2DaysPerYear;
        else if (yrs >= 5) separationBenefitDaysPerYear = p.serviceBenefitTier1DaysPerYear;
      }

      const statutorySepAmount = roundCurrency(
        yrs * separationBenefitDaysPerYear * wages.dailyBasic30
      );
      const gratuityRateDays =
        yrs > 10 ? p.gratuityDaysPerYearOver10Yrs : p.gratuityDaysPerYearStandard;
      const gratuityAltAmount =
        hasGratuity && separationBenefitDaysPerYear > 0
          ? roundCurrency(duration.gratuityRoundedYears * gratuityRateDays * wages.dailyBasic30)
          : 0;

      const effectiveSeparationBenefit = Math.max(statutorySepAmount, gratuityAltAmount);

      const grossSettlement = roundCurrency(
        unpaidSalaryAmount +
          unpaidOtAmount +
          leaveEncashmentAmount +
          effectiveSeparationBenefit +
          noticePayReceivable +
          otherDues
      );
      const netSettlement = Math.max(0, roundCurrency(grossSettlement - advanceDeduction));

      const breakdownItems: BreakdownLineItem[] = [
        {
          labelBn: `বকেয়া বেতন (${toBengaliDigits(unpaidSalaryDays)} দিনের কাজ)`,
          labelEn: 'Unpaid Salary for Worked Days',
          formulaBn: `${toBengaliDigits(unpaidSalaryDays)} দিন × ৳ ${toBengaliDigits(wages.dailyGross30)}`,
          amountBDT: unpaidSalaryAmount,
        },
        {
          labelBn: `বকেয়া ওভারটাইম মজুরি (${toBengaliDigits(unpaidOtHours)} ঘণ্টা)`,
          labelEn: 'Outstanding Overtime Wages',
          formulaBn: `${toBengaliDigits(unpaidOtHours)} ঘণ্টা × ৳ ${toBengaliDigits(wages.hourlyOtRate2x)}`,
          amountBDT: unpaidOtAmount,
        },
        {
          labelBn: `অব্যবহৃত অর্জিত ছুটির নগদায়ন (${toBengaliDigits(Math.min(unusedLeaveDays, p.annualLeaveMaxCapFactory))} দিন)`,
          labelEn: 'Unused Annual Leave Payment',
          formulaBn: `${toBengaliDigits(Math.min(unusedLeaveDays, p.annualLeaveMaxCapFactory))} দিন × ৳ ${toBengaliDigits(wages.dailyStatutoryLeaveWage30)}`,
          amountBDT: leaveEncashmentAmount,
        },
        {
          labelBn: `${separationLabelBn} ${hasGratuity ? '(গ্র্যাচুইটি তুলনাসহ সর্বোচ্চ)' : ''}`,
          labelEn: 'Applicable Service / Separation Benefit',
          formulaBn:
            separationBenefitDaysPerYear > 0
              ? `${toBengaliDigits(yrs)} পূর্ণ বছর × ${toBengaliDigits(separationBenefitDaysPerYear)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`
              : 'চাকরির মেয়াদ বা শর্ত অনুযায়ী এই খাতে প্রযোজ্য নয়',
          amountBDT: effectiveSeparationBenefit,
        },
        {
          labelBn: 'নোটিশ পে (প্রযোজ্য ক্ষেত্রে)',
          labelEn: 'Notice Pay (if applicable)',
          formulaBn:
            noticePayReceivable > 0
              ? 'মালিকপক্ষ নোটিশ না দেওয়ায় প্রাপ্য নোটিশ পে'
              : 'নোটিশ প্রদান করা হয়েছে অথবা পদত্যাগ/ডিসচার্জের কারণে মালিকের নিকট প্রাপ্য নয়',
          amountBDT: noticePayReceivable,
        },
        {
          labelBn: 'বিকল্প অবসান খাতসমূহ (ডাবল কাউন্টিং প্রতিরোধ)',
          labelEn: 'Mutually Exclusive Separation Benefits Excluded',
          formulaBn: excludedAlternativeNoteBn,
          amountBDT: 0,
          isExcluded: true,
          exclusionReasonBn: excludedAlternativeNoteBn,
        },
      ];

      if (otherDues > 0) {
        breakdownItems.push({
          labelBn: 'অন্যান্য বৈধ পাওনা (বোনাস বা ভাতা)',
          labelEn: 'Other Lawful Dues',
          formulaBn: 'প্রদত্ত অতিরিক্ত পাওনা',
          amountBDT: otherDues,
        });
      }

      if (advanceDeduction > 0) {
        breakdownItems.push({
          labelBn: 'বৈধ অগ্রিম বা ঋণ কর্তন (বাদ)',
          labelEn: 'Less: Lawful Advance Deductions',
          formulaBn: `মোট পাওনা ৳ ${toBengaliDigits(grossSettlement)} থেকে কর্তন`,
          amountBDT: advanceDeduction,
          isDeduction: true,
        });
      }

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: netSettlement > 0,
        eligibilityStatusBn: 'চূড়ান্ত নিষ্পত্তি (Final Settlement) প্রাক্কলন সম্পন্ন',
        eligibilityExplanationBn:
          'বকেয়া বেতন, ওভারটাইম, অর্জিত ছুটি এবং নির্বাচিত চাকরি অবসানের একক বৈধ সুবিধা যোগ করে ও অগ্রিম কর্তন বাদ দিয়ে চূড়ান্ত পাওনা নির্ণয় করা হয়েছে।',
        serviceDuration: duration,
        wageBasisLabelBn: 'মূল বেতন (Basic), ছুটিকালীন মজুরি (ধারা ১১৯) ও মোট বেতন (Gross)',
        wageBasisAmountBDT: wages.grossSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: netSettlement,
        breakdownItems,
        summaryHighlights: [
          { labelBn: 'চাকরিকাল', valueBn: duration.formattedBn },
          { labelBn: 'বকেয়া বেতন ও ওটি', valueBn: `৳ ${toBengaliDigits(roundCurrency(unpaidSalaryAmount + unpaidOtAmount))}` },
          { labelBn: 'বেনিফিট ও নোটিশ পে', valueBn: `৳ ${toBengaliDigits(roundCurrency(effectiveSeparationBenefit + noticePayReceivable))}` },
          { labelBn: 'চূড়ান্ত নিট পাওনা', valueBn: `৳ ${toBengaliDigits(netSettlement)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: [
            'একই সাথে ছাঁটাই, টার্মিনেশন ও পদত্যাগের সুবিধা যোগ করা আইনসম্মত নয়; নির্বাচিত একটি অবসান খাতই হিসাব করা হয়েছে।',
            'ধারা ১২৩ অনুযায়ী চাকরি অবসানের ৩০ কর্মদিবসের মধ্যে চূড়ান্ত পাওনা পরিশোধ করতে হবে।',
          ],
          limitationsBn: [
            'শ্রমিক স্বেচ্ছায় পদত্যাগের সময় ৬০ দিনের নোটিশ না দিলে মালিকপক্ষ নোটিশ মেয়াদের মূল বেতন সমন্বয় করতে পারেন (ধারা ২৭(৩))।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    // =========================================================================
    // ADDITIONAL GARMENTS CALCULATORS (1 to 13)
    // =========================================================================
    case 'monthly_salary': {
      const attBonus = Math.max(0, Number(rawInputs.attendanceBonus) || 0);
      const otHours = Math.max(0, Number(rawInputs.overtimeHours) || 0);
      const absentDays = Math.max(0, Number(rawInputs.absentDays) || 0);
      const advanceDed = Math.max(0, Number(rawInputs.lawfulAdvanceDeductionBDT) || 0);

      const otPay = roundCurrency(otHours * wages.hourlyOtRate2x);
      const effectiveAttBonus = absentDays === 0 ? attBonus : 0;
      const absenceDed = roundCurrency(absentDays * wages.dailyBasic30);
      const grossEarned = roundCurrency(wages.grossSalary + otPay + effectiveAttBonus);
      const netPayable = Math.max(0, roundCurrency(grossEarned - absenceDed - advanceDed));

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: true,
        eligibilityStatusBn: 'মাসিক বেতন ও ভাতার পূর্ণাঙ্গ হিসাব',
        eligibilityExplanationBn:
          absentDays > 0
            ? `${toBengaliDigits(absentDays)} দিন অনুপস্থিতির কারণে ধারা ১২৬ অনুযায়ী মূল বেতন কর্তন হয়েছে এবং হাজিরা বোনাস বাদ পড়েছে।`
            : 'পূর্ণ হাজিরার কারণে হাজিরা বোনাসসহ সম্পূর্ণ বেতন ও ওভারটাইম যুক্ত হয়েছে।',
        wageBasisLabelBn: 'মাসিক মোট বেতন কাঠামো (Gross + OT + Bonus)',
        wageBasisAmountBDT: wages.grossSalary,
        dailyRateUsedBDT: wages.dailyGross30,
        totalEstimatedPayableBDT: netPayable,
        breakdownItems: [
          {
            labelBn: 'মাসিক মোট বেতন (মূল + বাড়ি ভাড়া + চিকিৎসা + যাতায়াত + খাদ্য)',
            labelEn: 'Monthly Gross Salary',
            formulaBn: `৳ ${toBengaliDigits(wages.basicSalary)} + ভাতাসমূহ`,
            amountBDT: wages.grossSalary,
          },
          {
            labelBn: `ওভারটাইম আয় (${toBengaliDigits(otHours)} ঘণ্টা)`,
            labelEn: 'Overtime Earnings',
            formulaBn: `${toBengaliDigits(otHours)} ঘণ্টা × ৳ ${toBengaliDigits(wages.hourlyOtRate2x)}`,
            amountBDT: otPay,
          },
          {
            labelBn: 'হাজিরা বোনাস (Attendance Bonus)',
            labelEn: 'Attendance Bonus',
            formulaBn: absentDays === 0 ? 'পূর্ণ উপস্থিতির জন্য প্রাপ্য' : 'অনুপস্থিতির কারণে প্রযোজ্য নয়',
            amountBDT: effectiveAttBonus,
          },
          ...(absenceDed > 0
            ? [
                {
                  labelBn: `অনুপস্থিতি কর্তন (${toBengaliDigits(absentDays)} দিন — ধারা ১২৬)`,
                  labelEn: 'Absence Deduction (Basic / 30)',
                  formulaBn: `${toBengaliDigits(absentDays)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`,
                  amountBDT: absenceDed,
                  isDeduction: true,
                },
              ]
            : []),
          ...(advanceDed > 0
            ? [
                {
                  labelBn: 'অগ্রিম বেতন বা ঋণ কর্তন',
                  labelEn: 'Advance Deduction',
                  formulaBn: 'প্রদত্ত অগ্রিম কর্তন',
                  amountBDT: advanceDed,
                  isDeduction: true,
                },
              ]
            : []),
        ],
        summaryHighlights: [
          { labelBn: 'মাসিক গ্রস বেতন', valueBn: `৳ ${toBengaliDigits(wages.grossSalary)}` },
          { labelBn: 'ওভারটাইম ও বোনাস', valueBn: `৳ ${toBengaliDigits(roundCurrency(otPay + effectiveAttBonus))}` },
          { labelBn: 'মোট কর্তন', valueBn: `৳ ${toBengaliDigits(roundCurrency(absenceDed + advanceDed))}` },
          { labelBn: 'হাতে পাওয়ার নিট বেতন', valueBn: `৳ ${toBengaliDigits(netPayable)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: [
            'ধারা ১২৩ অনুযায়ী মাস শেষ হওয়ার পরবর্তী ৭ কর্মদিবসের মধ্যে মাসিক মজুরি পরিশোধ করতে হবে।',
          ],
          limitationsBn: ['কারখানার ক্যান্টিন বা প্রভিডেন্ট ফান্ড থাকলে তা পৃথকভাবে সমন্বয় হতে পারে।'],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'daily_wage': {
      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: true,
        eligibilityStatusBn: 'দৈনিক মজুরি হার বিশ্লেষণ সম্পন্ন',
        eligibilityExplanationBn:
          'ক্যালেন্ডার মাস (৩০ দিন) এবং কার্যদিবস (২৬ দিন) উভয় পদ্ধতিতে দৈনিক মূল ও মোট মজুরি নিচে দেখানো হলো।',
        wageBasisLabelBn: 'মাসিক মোট বেতন (Gross) ও মূল বেতন (Basic)',
        wageBasisAmountBDT: wages.grossSalary,
        dailyRateUsedBDT: wages.dailyGross30,
        totalEstimatedPayableBDT: wages.dailyGross30,
        breakdownItems: [
          {
            labelBn: '১ দিনের মোট মজুরি (৩০ দিনের মাস হিসেবে)',
            labelEn: 'Daily Gross Wage (30-Day Basis)',
            formulaBn: `৳ ${toBengaliDigits(wages.grossSalary)} ÷ ৩০ দিন`,
            amountBDT: wages.dailyGross30,
          },
          {
            labelBn: '১ দিনের মোট মজুরি (২৬ কার্যদিবস হিসেবে)',
            labelEn: 'Daily Gross Wage (26-Working-Day Basis)',
            formulaBn: `৳ ${toBengaliDigits(wages.grossSalary)} ÷ ২৬ কার্যদিবস`,
            amountBDT: wages.dailyGross26,
          },
          {
            labelBn: '১ দিনের মূল মজুরি (Basic ÷ ৩০ — কর্তন ও বেনিফিটের ভিত্তি)',
            labelEn: 'Daily Basic Wage (30-Day Basis)',
            formulaBn: `৳ ${toBengaliDigits(wages.basicSalary)} ÷ ৩০ দিন`,
            amountBDT: wages.dailyBasic30,
          },
          {
            labelBn: '১ দিনের ছুটিকালীন গড় মজুরি (ধারা ১১৯)',
            labelEn: 'Daily Statutory Leave Wage (Sec 119)',
            formulaBn: `৳ ${toBengaliDigits(wages.statutoryLeaveWageMonthly)} ÷ ৩০ দিন`,
            amountBDT: wages.dailyStatutoryLeaveWage30,
          },
        ],
        summaryHighlights: [
          { labelBn: 'দৈনিক গ্রস (৩০ দিন)', valueBn: `৳ ${toBengaliDigits(wages.dailyGross30)}` },
          { labelBn: 'দৈনিক গ্রস (২৬ দিন)', valueBn: `৳ ${toBengaliDigits(wages.dailyGross26)}` },
          { labelBn: 'দৈনিক বেসিক (৩০ দিন)', valueBn: `৳ ${toBengaliDigits(wages.dailyBasic30)}` },
          { labelBn: 'দৈনিক ছুটির মজুরি', valueBn: `৳ ${toBengaliDigits(wages.dailyStatutoryLeaveWage30)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['৩০ দিনের ক্যালেন্ডার মাস অনুযায়ী ১ দিনের মোট মজুরিকে প্রধান মানে দেখানো হয়েছে।'],
          limitationsBn: ['ভিন্ন ভিন্ন আইনি সুবিধার ক্ষেত্রে ভিন্ন দৈনিক ভিত্তি (বেসিক বনাম গ্রস) ব্যবহৃত হয়।'],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'hourly_wage': {
      const hourlyGross208 = roundCurrency(wages.grossSalary / 208);
      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: true,
        eligibilityStatusBn: 'ঘণ্টাপ্রতি মজুরি ও ওভারটাইম রেট নির্ণয় সম্পন্ন',
        eligibilityExplanationBn:
          'মাসে ২৬ কার্যদিবস × দৈনিক ৮ ঘণ্টা = ২০৮ ঘণ্টা হিসেবে প্রতি ঘণ্টার মজুরি হিসাব করা হয়েছে।',
        wageBasisLabelBn: '২০৮ কর্মঘণ্টা ভিত্তিক মূল ও মোট বেতন',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.hourlyBasic208,
        totalEstimatedPayableBDT: wages.hourlyOtRate2x,
        breakdownItems: [
          {
            labelBn: 'সাধারণ কর্মঘণ্টার মূল মজুরি (Basic ÷ ২০৮)',
            labelEn: 'Normal Hourly Basic Wage',
            formulaBn: `৳ ${toBengaliDigits(wages.basicSalary)} ÷ ২০৮ ঘণ্টা`,
            amountBDT: wages.hourlyBasic208,
          },
          {
            labelBn: 'সাধারণ কর্মঘণ্টার মোট মজুরি (Gross ÷ ২০৮)',
            labelEn: 'Normal Hourly Gross Wage',
            formulaBn: `৳ ${toBengaliDigits(wages.grossSalary)} ÷ ২০৮ ঘণ্টা`,
            amountBDT: hourlyGross208,
          },
          {
            labelBn: 'আইনসম্মত প্রতি ঘণ্টা ওভারটাইম হার (ধারা ১০৮ — দ্বিগুণ)',
            labelEn: 'Statutory Hourly Overtime Rate (2x Basic)',
            formulaBn: `(৳ ${toBengaliDigits(wages.basicSalary)} ÷ ২০৮) × ২`,
            amountBDT: wages.hourlyOtRate2x,
          },
        ],
        summaryHighlights: [
          { labelBn: 'মাসিক মানদণ্ড', valueBn: '২০৮ ঘণ্টা' },
          { labelBn: 'সাধারণ ঘণ্টা (বেসিক)', valueBn: `৳ ${toBengaliDigits(wages.hourlyBasic208)}` },
          { labelBn: 'সাধারণ ঘণ্টা (গ্রস)', valueBn: `৳ ${toBengaliDigits(hourlyGross208)}` },
          { labelBn: 'ওভারটাইম ঘণ্টা (২ গুণ)', valueBn: `৳ ${toBengaliDigits(wages.hourlyOtRate2x)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['ধারা ১০০ অনুযায়ী দৈনিক স্বাভাবিক কর্মঘণ্টা ৮ ঘণ্টা এবং সপ্তাহে ৪৮ ঘণ্টা (মাসে ২০৮ ঘণ্টা)।'],
          limitationsBn: ['ওভারটাইম সর্বদা মূল বেতনের দ্বিগুণ হারে হিসাব হয়।'],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'overtime_calc':
    case 'special_overtime': {
      const otHours = Math.max(0, Number(rawInputs.overtimeHours) || 0);
      const otMinutes = Math.max(0, Math.min(59, Number(rawInputs.overtimeMinutes) || 0));
      const totalHours = roundCurrency(otHours + otMinutes / 60);
      const statutoryOtPay = roundCurrency(totalHours * wages.hourlyOtRate2x);

      const nightDays =
        calculatorId === 'special_overtime' ? Math.max(0, Number(rawInputs.specialNightDays) || 0) : 0;
      const nightAllowanceRate =
        calculatorId === 'special_overtime'
          ? Math.max(0, Number(rawInputs.specialNightAllowancePerDay) || 0)
          : 0;
      const specialAllowanceTotal = roundCurrency(nightDays * nightAllowanceRate);
      const totalPayable = roundCurrency(statutoryOtPay + specialAllowanceTotal);

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: totalHours > 0 || specialAllowanceTotal > 0,
        eligibilityStatusBn: 'ধারা ১০৮ অনুযায়ী দ্বিগুণ হারে ওভারটাইম হিসাব সম্পন্ন',
        eligibilityExplanationBn:
          'বাংলাদেশ শ্রম আইন ধারা ১০৮ অনুযায়ী স্বাভাবিক ৮ ঘণ্টার অতিরিক্ত প্রতি ঘণ্টার কাজের জন্য মূল বেতনের দ্বিগুণ হারে ভাতা প্রাপ্য।',
        wageBasisLabelBn: 'মূল বেতন (Basic Salary ÷ ২০৮ × ২)',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.hourlyOtRate2x,
        totalEstimatedPayableBDT: totalPayable,
        breakdownItems: [
          {
            labelBn: `আইনসম্মত দ্বিগুণ ওভারটাইম মজুরি (${toBengaliDigits(totalHours)} ঘণ্টা)`,
            labelEn: 'Statutory Double Overtime Pay (Sec 108)',
            formulaBn: `${toBengaliDigits(totalHours)} ঘণ্টা × ৳ ${toBengaliDigits(wages.hourlyOtRate2x)} (প্রতি ঘণ্টা)`,
            amountBDT: statutoryOtPay,
          },
          ...(calculatorId === 'special_overtime'
            ? [
                {
                  labelBn: `বিশেষ নাইট ডিউটি / টিফিন ভাতা (${toBengaliDigits(nightDays)} দিন)`,
                  labelEn: 'Special Night Shift / Tiffin Allowance',
                  formulaBn: `${toBengaliDigits(nightDays)} দিন × ৳ ${toBengaliDigits(nightAllowanceRate)}`,
                  amountBDT: specialAllowanceTotal,
                },
              ]
            : []),
        ],
        summaryHighlights: [
          { labelBn: 'মোট ওভারটাইম সময়', valueBn: `${toBengaliDigits(totalHours)} ঘণ্টা` },
          { labelBn: 'প্রতি ঘণ্টার ওটি রেট', valueBn: `৳ ${toBengaliDigits(wages.hourlyOtRate2x)}` },
          ...(calculatorId === 'special_overtime'
            ? [{ labelBn: 'বিশেষ ভাতা', valueBn: `৳ ${toBengaliDigits(specialAllowanceTotal)}` }]
            : []),
          { labelBn: 'মোট ওভারটাইম প্রাপ্য', valueBn: `৳ ${toBengaliDigits(totalPayable)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['প্রতি ঘণ্টা ওভারটাইম = (মূল বেতন ÷ ২০৮) × ২।'],
          limitationsBn: [
            'ধারা ১০২ অনুযায়ী একজন প্রাপ্তবয়স্ক শ্রমিক সপ্তাহে গড়ে ৫৬ ঘণ্টা (বা সর্বোচ্চ ৬০ ঘণ্টা) পর্যন্ত কাজ করতে পারেন।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'absence_deduction': {
      const absentDays = Math.max(0, Number(rawInputs.absentDays) || 0);
      const lawfulBasicDeduction = roundCurrency(absentDays * wages.dailyBasic30);
      const unlawfulGrossComparison = roundCurrency(absentDays * wages.dailyGross30);
      const overDeductionSaved = roundCurrency(unlawfulGrossComparison - lawfulBasicDeduction);

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: true,
        eligibilityStatusBn: 'ধারা ১২৬ অনুযায়ী বৈধ অনুপস্থিতি কর্তন হিসাব',
        eligibilityExplanationBn:
          'বাংলাদেশ শ্রম আইন ধারা ১২৬ অনুযায়ী বিনা অনুমতিতে অনুপস্থিত থাকলে শুধুমাত্র মূল বেতন (Basic Salary) থেকে কর্তন করা যাবে; বাড়ি ভাড়া বা চিকিৎসা ভাতা কাটা যাবে না।',
        wageBasisLabelBn: 'মাসিক মূল বেতন (Basic Salary ÷ ৩০)',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: lawfulBasicDeduction,
        breakdownItems: [
          {
            labelBn: `আইনসম্মত অনুপস্থিতি কর্তন (${toBengaliDigits(absentDays)} দিন × দৈনিক মূল বেতন)`,
            labelEn: 'Lawful Absence Deduction (Basic / 30)',
            formulaBn: `${toBengaliDigits(absentDays)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`,
            amountBDT: lawfulBasicDeduction,
          },
          {
            labelBn: 'গ্রস বেতন থেকে কাটলে যে অতিরিক্ত টাকা কাটা হতো (অবৈধ কর্তন তুলনা)',
            labelEn: 'Difference if Unlawfully Deducted from Gross',
            formulaBn: `গ্রস কর্তন ৳ ${toBengaliDigits(unlawfulGrossComparison)} - বৈধ বেসিক কর্তন ৳ ${toBengaliDigits(lawfulBasicDeduction)} = ৳ ${toBengaliDigits(overDeductionSaved)} পার্থক্য`,
            amountBDT: 0,
            isExcluded: true,
            exclusionReasonBn: 'শ্রম আইন অনুযায়ী বাড়ি ভাড়া, চিকিৎসা বা খাদ্য ভাতা থেকে অনুপস্থিতির টাকা কাটা বেআইনি।',
          },
        ],
        summaryHighlights: [
          { labelBn: 'অনুপস্থিত দিন', valueBn: `${toBengaliDigits(absentDays)} দিন` },
          { labelBn: '১ দিনের মূল বেতন', valueBn: `৳ ${toBengaliDigits(wages.dailyBasic30)}` },
          { labelBn: 'বৈধ মোট কর্তন', valueBn: `৳ ${toBengaliDigits(lawfulBasicDeduction)}` },
          { labelBn: 'ভাতা সুরক্ষা পার্থক্য', valueBn: `৳ ${toBengaliDigits(overDeductionSaved)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['৩০ দিনের মাস হিসেবে ১ দিনের মূল বেতন = মূল বেতন ÷ ৩০ ধরা হয়েছে।'],
          limitationsBn: [
            'বিনা অনুমতিতে অনুপস্থিত থাকলে কারখানার নিয়ম অনুযায়ী ঐ মাসের হাজিরা বোনাস (Attendance Bonus) বাতিল হতে পারে।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'holiday_work':
    case 'festival_holiday_wage': {
      const holidayDays = Math.max(0, Number(rawInputs.holidayWorkDays) || 1);
      const isFestival = calculatorId === 'festival_holiday_wage';
      // Under Sec 118(3): working on a festival holiday entitles worker to 1 substitute holiday + 2 full days' wages (double extra pay)
      const multiplier = isFestival ? 2 : 2;
      const extraPayAmount = roundCurrency(holidayDays * wages.dailyGross30 * multiplier);

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: holidayDays > 0,
        eligibilityStatusBn: isFestival
          ? 'ধারা ১১৮(৩) অনুযায়ী উৎসব ছুটির দিনে কাজের দ্বিগুণ অতিরিক্ত মজুরি ও বিকল্প ছুটি প্রাপ্য'
          : 'ছুটির দিনে কাজের অতিরিক্ত মজুরি হিসাব সম্পন্ন',
        eligibilityExplanationBn: isFestival
          ? 'উৎসব ছুটির দিনে কাজ করলে নিয়মিত বেতনের অতিরিক্ত ২ দিনের পূর্ণ মজুরি এবং ১ দিনের সবেতন বিকল্প ছুটি প্রাপ্য।'
          : 'সাপ্তাহিক বা সরকারি ছুটির দিনে কাজ করলে বিকল্প ছুটি ও ওভারটাইম/দ্বিগুণ হারের মজুরি প্রাপ্য।',
        wageBasisLabelBn: 'দৈনিক পূর্ণ মজুরি (Gross Salary ÷ ৩০)',
        wageBasisAmountBDT: wages.grossSalary,
        dailyRateUsedBDT: wages.dailyGross30,
        totalEstimatedPayableBDT: extraPayAmount,
        breakdownItems: [
          {
            labelBn: `${toBengaliDigits(holidayDays)} দিন ছুটির দিনে কাজের অতিরিক্ত মজুরি (${toBengaliDigits(multiplier)} গুণ)`,
            labelEn: 'Holiday Work Extra Payment',
            formulaBn: `${toBengaliDigits(holidayDays)} দিন × ৳ ${toBengaliDigits(wages.dailyGross30)} × ${toBengaliDigits(multiplier)}`,
            amountBDT: extraPayAmount,
          },
        ],
        summaryHighlights: [
          { labelBn: 'ছুটির দিনে কাজ', valueBn: `${toBengaliDigits(holidayDays)} দিন` },
          { labelBn: '১ দিনের পূর্ণ মজুরি', valueBn: `৳ ${toBengaliDigits(wages.dailyGross30)}` },
          { labelBn: 'বিকল্প সবেতন ছুটি', valueBn: `${toBengaliDigits(holidayDays)} দিন প্রাপ্য` },
          { labelBn: 'অতিরিক্ত প্রাপ্য টাকা', valueBn: `৳ ${toBengaliDigits(extraPayAmount)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['ধারা ১১৮ অনুযায়ী প্রতি পঞ্জিকা বৎসরে ১১ দিনের সবেতন উৎসব ছুটি নির্ধারিত।'],
          limitationsBn: ['বিকল্প ছুটি প্রদান করা হয়েছে কিনা তার ওপর চূড়ান্ত সমন্বয় নির্ভর করে।'],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'festival_bonus': {
      const duration = calculateExactServiceDuration(joiningDate, calculationDate);
      const bonusPct = Math.max(0, Number(rawInputs.festivalBonusPct) || 100);
      const hasFullYear = duration.valid && duration.completedYears >= 1;
      const effectivePct = Number(rawInputs.festivalBonusPct)
        ? bonusPct
        : hasFullYear
        ? 100
        : 50;
      const bonusAmount = roundCurrency((wages.basicSalary * effectivePct) / 100);

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: true,
        eligibilityStatusBn: hasFullYear
          ? '১ বছর চাকরিকাল পূর্ণ হওয়ায় পূর্ণ উৎসব বোনাসের যোগ্য'
          : 'চাকরিকাল ১ বছরের কম হওয়ায় আনুপাতিক/কারখানা নীতিমালা অনুযায়ী উৎসব বোনাস প্রযোজ্য',
        eligibilityExplanationBn:
          'বাংলাদেশ শ্রম বিধিমালা ২০১৫ (বিধি ১১১(৫)) অনুযায়ী নিরবচ্ছিন্ন ১ বছর চাকরি পূর্ণ হলে প্রতি উৎসবে মূল বেতনের সমান (১০০%) বোনাস প্রচলিত।',
        serviceDuration: duration.valid ? duration : undefined,
        wageBasisLabelBn: `মাসিক মূল বেতন (Basic Salary-এর ${toBengaliDigits(effectivePct)}%)`,
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: bonusAmount,
        breakdownItems: [
          {
            labelBn: `উৎসব বোনাস (মূল বেতনের ${toBengaliDigits(effectivePct)}%)`,
            labelEn: 'Festival / Eid Bonus',
            formulaBn: `৳ ${toBengaliDigits(wages.basicSalary)} × ${toBengaliDigits(effectivePct)}%`,
            amountBDT: bonusAmount,
          },
        ],
        summaryHighlights: [
          { labelBn: 'মূল বেতন (Basic)', valueBn: `৳ ${toBengaliDigits(wages.basicSalary)}` },
          { labelBn: 'বোনাস হার', valueBn: `${toBengaliDigits(effectivePct)}%` },
          { labelBn: 'চাকরিকাল', valueBn: duration.valid ? duration.formattedBn : 'প্রযোজ্য' },
          { labelBn: 'প্রাপ্য উৎসব বোনাস', valueBn: `৳ ${toBengaliDigits(bonusAmount)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['মূল বেতনের শতাংশ হিসেবে উৎসব বোনাস গণনা করা হয়েছে।'],
          limitationsBn: ['বিধি ১১১(৫) অনুযায়ী বোনাসের হার এক মাসের মূল মজুরির বেশি হবে না।'],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'notice_pay': {
      const noticeDays = Math.max(
        0,
        Number(rawInputs.noticeDaysServedOrGiven) || p.terminationNoticeDaysPermanent
      );
      const noticeAmount = roundCurrency(noticeDays * wages.dailyBasic30);

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: true,
        eligibilityStatusBn: 'নোটিশ পে হিসাব সম্পন্ন',
        eligibilityExplanationBn:
          'মালিকপক্ষ ধারা ২৬-এ স্থায়ী শ্রমিককে বিনা নোটিশে অবসান করলে ১২০ দিনের মূল বেতন, ছাঁটাইয়ে (ধারা ২০) ৩০ দিনের মূল বেতন এবং শ্রমিক বিনা নোটিশে পদত্যাগ করলে (ধারা ২৭) ৬০ দিনের মূল বেতন নোটিশ পে হিসেবে প্রযোজ্য।',
        wageBasisLabelBn: 'দৈনিক মূল বেতন (Basic Salary ÷ ৩০)',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: noticeAmount,
        breakdownItems: [
          {
            labelBn: `${toBengaliDigits(noticeDays)} দিনের নোটিশ পে`,
            labelEn: 'Notice Pay Amount',
            formulaBn: `${toBengaliDigits(noticeDays)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)} (দৈনিক মূল বেতন)`,
            amountBDT: noticeAmount,
          },
        ],
        summaryHighlights: [
          { labelBn: 'নোটিশ মেয়াদ', valueBn: `${toBengaliDigits(noticeDays)} দিন` },
          { labelBn: 'দৈনিক মূল বেতন', valueBn: `৳ ${toBengaliDigits(wages.dailyBasic30)}` },
          { labelBn: 'মোট নোটিশ পে', valueBn: `৳ ${toBengaliDigits(noticeAmount)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['শ্রম আইন ধারা ২০, ২৬ ও ২৭ অনুযায়ী নোটিশ পে মূল বেতনের ভিত্তিতে হিসাব করা হয়।'],
          limitationsBn: ['লিখিত নোটিশ প্রদান করে মেয়াদ পূর্ণ করলে নোটিশ পে দিতে হয় না।'],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'layoff_compensation': {
      const duration = calculateExactServiceDuration(joiningDate, calculationDate);
      const layoffDays = Math.max(0, Number(rawInputs.layoffDaysTotal) || 0);
      const hasOneYearMasterRoll = duration.valid && duration.completedYears >= 1;

      const first45Days = Math.min(layoffDays, 45);
      const extraDaysBeyond45 = Math.max(0, layoffDays - 45);

      const dailyHouseRent = roundCurrency(houseRentAllowance / 30);
      const dailyFirst45Rate = roundCurrency(
        wages.dailyBasic30 * (p.layoffFirst45DaysBasicPct / 100) + dailyHouseRent
      );
      const dailyNext15Rate = roundCurrency(
        wages.dailyBasic30 * (p.layoffNext15DaysBasicPct / 100) + dailyHouseRent
      );

      const first45Pay = hasOneYearMasterRoll ? roundCurrency(first45Days * dailyFirst45Rate) : 0;
      const beyond45Pay = hasOneYearMasterRoll
        ? roundCurrency(extraDaysBeyond45 * dailyNext15Rate)
        : 0;
      const totalLayoffPay = roundCurrency(first45Pay + beyond45Pay);

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: hasOneYearMasterRoll && layoffDays > 0,
        eligibilityStatusBn: hasOneYearMasterRoll
          ? 'ধারা ১৬ অনুযায়ী লে-অফ ক্ষতিপূরণ পাওয়ার যোগ্য'
          : 'মাস্টার রোলে অন্তত ১ বছর চাকরি পূর্ণ না হওয়ায় ধারা ১৬ লে-অফ ক্ষতিপূরণ প্রযোজ্য নয়',
        eligibilityExplanationBn:
          'ধারা ১৬ অনুযায়ী পঞ্জিকা বর্ষে প্রথম ৪৫ দিন লে-অফের জন্য মূল বেতনের ৫০% + শতভাগ বাড়ি ভাড়া ভাতা এবং পরবর্তী প্রতি ১৫ দিনের জন্য মূল বেতনের ২৫% + শতভাগ বাড়ি ভাড়া ভাতা প্রাপ্য।',
        serviceDuration: duration.valid ? duration : undefined,
        wageBasisLabelBn: '৫০% মূল বেতন + ১০০% বাড়ি ভাড়া ভাতা (ধারা ১৬)',
        wageBasisAmountBDT: roundCurrency(wages.basicSalary * 0.5 + houseRentAllowance),
        dailyRateUsedBDT: dailyFirst45Rate,
        totalEstimatedPayableBDT: totalLayoffPay,
        breakdownItems: [
          {
            labelBn: `প্রথম দফা লে-অফ ক্ষতিপূরণ (${toBengaliDigits(first45Days)} দিন — ৫০% বেসিক + ১০০% বাড়ি ভাড়া)`,
            labelEn: 'First 45 Days Lay-off Compensation (Sec 16)',
            formulaBn: `${toBengaliDigits(first45Days)} দিন × ৳ ${toBengaliDigits(dailyFirst45Rate)}`,
            amountBDT: first45Pay,
          },
          ...(extraDaysBeyond45 > 0
            ? [
                {
                  labelBn: `অতিরিক্ত লে-অফ দিন (${toBengaliDigits(extraDaysBeyond45)} দিন — ২৫% বেসিক + ১০০% বাড়ি ভাড়া)`,
                  labelEn: 'Extended Lay-off Days Beyond 45 Days',
                  formulaBn: `${toBengaliDigits(extraDaysBeyond45)} দিন × ৳ ${toBengaliDigits(dailyNext15Rate)}`,
                  amountBDT: beyond45Pay,
                },
              ]
            : []),
        ],
        summaryHighlights: [
          { labelBn: 'মোট লে-অফ দিন', valueBn: `${toBengaliDigits(layoffDays)} দিন` },
          { labelBn: 'দৈনিক লে-অফ হার (১ম ৪৫ দিন)', valueBn: `৳ ${toBengaliDigits(dailyFirst45Rate)}` },
          { labelBn: 'মোট লে-অফ ক্ষতিপূরণ', valueBn: `৳ ${toBengaliDigits(totalLayoffPay)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['সাপ্তাহিক ছুটির দিন বাদে প্রকৃত লে-অফ কার্যদিবসের জন্য ক্ষতিপূরণ হিসাব করা হয়।'],
          limitationsBn: [
            '৪৫ দিনের পর আরও ১৫ দিন লে-অফ চললে মালিকপক্ষ ইচ্ছা করলে ধারা ২০ অনুযায়ী ছাঁটাই (Retrenchment) সুবিধা দিয়ে চাকরি অবসান করতে পারেন।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'discharge_benefit': {
      const duration = calculateExactServiceDuration(joiningDate, calculationDate);
      if (!duration.valid) {
        return buildIncompleteResult(catalogMeta, ruleVersion, {
          workerName,
          factoryName,
          department,
          designation,
          calculationDate,
          reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
        });
      }

      const yrs = duration.completedYears;
      const medicalCertified = Boolean(rawInputs.medicalIncapacityCertified ?? true);
      const unusedLeaveDays = Math.max(0, Number(rawInputs.unusedAnnualLeaveDays) || 0);
      const isEligible = yrs >= p.dischargeMinServiceYears && medicalCertified;

      const dischargeComp = isEligible
        ? roundCurrency(yrs * p.dischargeDaysPerYear * wages.dailyBasic30)
        : 0;
      const leaveEncashment = roundCurrency(unusedLeaveDays * wages.dailyStatutoryLeaveWage30);
      const totalPayable = roundCurrency(dischargeComp + leaveEncashment);

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible,
        eligibilityStatusBn: isEligible
          ? 'ধারা ২২ অনুযায়ী অক্ষমতাজনিত ডিসচার্জ বেনিফিটের যোগ্য'
          : 'অন্তত ১ বছর চাকরি ও রেজিস্টার্ড চিকিৎসকের প্রত্যয়ন প্রয়োজন',
        eligibilityExplanationBn:
          'ধারা ২২ অনুযায়ী শারীরিক বা মানসিক অক্ষমতার কারণে ডিসচার্জ করা হলে ১ বছর বা তদূর্ধ্ব চাকরিকালে প্রতি পূর্ণ বছরের জন্য ৩০ দিনের মূল বেতন বা গ্র্যাচুইটি প্রাপ্য।',
        serviceDuration: duration,
        wageBasisLabelBn: 'দৈনিক মূল বেতন (Basic Salary ÷ ৩০)',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: totalPayable,
        breakdownItems: [
          {
            labelBn: `ডিসচার্জ ক্ষতিপূরণ (${toBengaliDigits(yrs)} পূর্ণ বছর × ৩০ দিনের মূল বেতন)`,
            labelEn: 'Discharge Benefit (Sec 22)',
            formulaBn: isEligible
              ? `${toBengaliDigits(yrs)} বছর × ৩০ দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`
              : 'প্রযোজ্য শর্ত পূরণ হয়নি',
            amountBDT: dischargeComp,
          },
          {
            labelBn: `অব্যবহৃত অর্জিত ছুটির টাকা (${toBengaliDigits(unusedLeaveDays)} দিন)`,
            labelEn: 'Unused Annual Leave Encashment',
            formulaBn: `${toBengaliDigits(unusedLeaveDays)} দিন × ৳ ${toBengaliDigits(wages.dailyStatutoryLeaveWage30)}`,
            amountBDT: leaveEncashment,
          },
        ],
        summaryHighlights: [
          { labelBn: 'পূর্ণ চাকরিকাল', valueBn: `${toBengaliDigits(yrs)} বছর` },
          { labelBn: 'ডিসচার্জ বেনিফিট', valueBn: `৳ ${toBengaliDigits(dischargeComp)}` },
          { labelBn: 'অব্যবহৃত ছুটির টাকা', valueBn: `৳ ${toBengaliDigits(leaveEncashment)}` },
          { labelBn: 'মোট প্রাপ্য', valueBn: `৳ ${toBengaliDigits(totalPayable)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['রেজিস্টার্ড চিকিৎসক কর্তৃক অক্ষমতা প্রত্যয়িত ধরা হয়েছে।'],
          limitationsBn: ['চাকরিকাল ১ বছরের কম হলে ডিসচার্জ ক্ষতিপূরণ প্রযোজ্য নয়।'],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    case 'resignation_benefit': {
      const duration = calculateExactServiceDuration(joiningDate, calculationDate);
      if (!duration.valid) {
        return buildIncompleteResult(catalogMeta, ruleVersion, {
          workerName,
          factoryName,
          department,
          designation,
          calculationDate,
          reasonBn: INSUFFICIENT_INFO_MESSAGE_BN,
        });
      }

      const yrs = duration.completedYears;
      const noticeGiven = Boolean(rawInputs.noticeProvidedByEmployer ?? true); // true = worker served 60 days notice
      const unusedLeaveDays = Math.max(0, Number(rawInputs.unusedAnnualLeaveDays) || 0);
      const unpaidSalaryDays = Math.max(0, Number(rawInputs.unpaidSalaryDays) || 0);

      let benefitDaysPerYear = 0;
      if (employmentType === 'permanent') {
        if (yrs >= 10) benefitDaysPerYear = 30;
        else if (yrs >= 5) benefitDaysPerYear = 14;
      }

      const serviceBenefit = roundCurrency(yrs * benefitDaysPerYear * wages.dailyBasic30);
      const leaveEncashment = roundCurrency(unusedLeaveDays * wages.dailyStatutoryLeaveWage30);
      const unpaidSalary = roundCurrency(unpaidSalaryDays * wages.dailyGross30);
      // If permanent worker resigns without giving 60 days notice, employer can deduct 60 days basic under Sec 27(3)
      const noticeShortfallDeduction =
        !noticeGiven && employmentType === 'permanent'
          ? roundCurrency(p.resignationNoticeDaysPermanent * wages.dailyBasic30)
          : 0;

      const grossDue = roundCurrency(serviceBenefit + leaveEncashment + unpaidSalary);
      const netPayable = Math.max(0, roundCurrency(grossDue - noticeShortfallDeduction));

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: netPayable > 0,
        eligibilityStatusBn:
          yrs >= 5
            ? 'ধারা ২৭ অনুযায়ী স্বেচ্ছায় পদত্যাগে সার্ভিস বেনিফিট ও ছুটির টাকার যোগ্য'
            : 'চাকরিকাল ৫ বছরের কম হওয়ায় স্বেচ্ছায় পদত্যাগে সার্ভিস বেনিফিট প্রযোজ্য নয় (তবে বকেয়া বেতন ও অর্জিত ছুটির টাকা প্রাপ্য)',
        eligibilityExplanationBn:
          'স্থায়ী শ্রমিকের ক্ষেত্রে ৬০ দিনের লিখিত নোটিশ দিয়ে পদত্যাগ করলে ৫–৯ বছর চাকরিতে প্রতি বছর ১৪ দিনের এবং ১০+ বছর চাকরিতে ৩০ দিনের মূল বেতন সার্ভিস বেনিফিট হিসেবে প্রাপ্য।',
        serviceDuration: duration,
        wageBasisLabelBn: 'দৈনিক মূল বেতন (Basic ÷ ৩০) ও ছুটিকালীন মজুরি',
        wageBasisAmountBDT: wages.basicSalary,
        dailyRateUsedBDT: wages.dailyBasic30,
        totalEstimatedPayableBDT: netPayable,
        breakdownItems: [
          {
            labelBn: `পদত্যাগজনিত সার্ভিস বেনিফিট (${toBengaliDigits(yrs)} বছর × ${toBengaliDigits(benefitDaysPerYear)} দিন)`,
            labelEn: 'Resignation Service Benefit (Sec 27(4))',
            formulaBn:
              benefitDaysPerYear > 0
                ? `${toBengaliDigits(yrs)} বছর × ${toBengaliDigits(benefitDaysPerYear)} দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`
                : '৫ বছর পূর্ণ না হওয়ায় প্রযোজ্য নয়',
            amountBDT: serviceBenefit,
          },
          {
            labelBn: `অব্যবহৃত অর্জিত ছুটির টাকা (${toBengaliDigits(unusedLeaveDays)} দিন)`,
            labelEn: 'Unused Annual Leave Encashment',
            formulaBn: `${toBengaliDigits(unusedLeaveDays)} দিন × ৳ ${toBengaliDigits(wages.dailyStatutoryLeaveWage30)}`,
            amountBDT: leaveEncashment,
          },
          ...(unpaidSalary > 0
            ? [
                {
                  labelBn: `চলতি মাসের বকেয়া বেতন (${toBengaliDigits(unpaidSalaryDays)} দিন)`,
                  labelEn: 'Unpaid Salary for Worked Days',
                  formulaBn: `${toBengaliDigits(unpaidSalaryDays)} দিন × ৳ ${toBengaliDigits(wages.dailyGross30)}`,
                  amountBDT: unpaidSalary,
                },
              ]
            : []),
          ...(noticeShortfallDeduction > 0
            ? [
                {
                  labelBn: 'নোটিশ না দেওয়ার কারণে কর্তন (৬০ দিনের মূল বেতন — ধারা ২৭(৩))',
                  labelEn: 'Less: Notice Shortfall Deduction (Sec 27(3))',
                  formulaBn: `৬০ দিন × ৳ ${toBengaliDigits(wages.dailyBasic30)}`,
                  amountBDT: noticeShortfallDeduction,
                  isDeduction: true,
                },
              ]
            : []),
        ],
        summaryHighlights: [
          { labelBn: 'চাকরিকাল', valueBn: duration.formattedBn },
          { labelBn: 'সার্ভিস বেনিফিট', valueBn: `৳ ${toBengaliDigits(serviceBenefit)}` },
          { labelBn: 'অর্জিত ছুটির টাকা', valueBn: `৳ ${toBengaliDigits(leaveEncashment)}` },
          { labelBn: 'নিট প্রাপ্য পাওনা', valueBn: `৳ ${toBengaliDigits(netPayable)}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: ['ধারা ২৭ অনুযায়ী স্থায়ী শ্রমিকের জন্য ৬০ দিনের নোটিশ শর্ত বিবেচনা করা হয়েছে।'],
          limitationsBn: ['নোটিশ প্রদান না করলে মালিকপক্ষ নোটিশ মেয়াদের মূল বেতন কর্তন করার আইনগত অধিকার রাখেন।'],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }

    // =========================================================================
    // INCREMENT CALCULATOR (ইনক্রিমেন্ট হিসাব)
    // =========================================================================
    case 'increment_calc': {
      const mode = String(rawInputs.incrementMode || 'percent') === 'amount' ? 'amount' : 'percent';
      const incrementPct = Math.max(0, Number(rawInputs.incrementPercent) || 0);
      const incrementAmt = Math.max(0, Number(rawInputs.incrementAmountBDT) || 0);
      const effectiveDate = String(rawInputs.incrementEffectiveDate || calculationDate).trim();

      const oldBasic = Math.round(wages.basicSalary);
      const oldMedical = Math.round(medicalAllowance || 750);
      const oldTransport = Math.round(transportAllowance || 450);
      const oldFood = Math.round(foodAllowance || 1250);
      const fixedAllowances = oldMedical + oldTransport + oldFood;

      let newBasic = oldBasic;
      let newHouseRent = Math.round(houseRentAllowance);
      const newMedical = oldMedical;
      const newTransport = oldTransport;
      let newFood = oldFood;
      let newGross = Math.round(wages.grossSalary);

      if (mode === 'amount' && incrementAmt > 0) {
        newGross = Math.round(wages.grossSalary + incrementAmt);
        if (newGross > fixedAllowances) {
          newBasic = Math.round((newGross - fixedAllowances) / 1.5);
          newHouseRent = Math.round(newBasic * 0.5);
          const diff = newGross - (newBasic + newHouseRent + newMedical + newTransport + newFood);
          if (Math.abs(diff) <= 2) {
            newFood = Math.max(0, newFood + diff);
          } else {
            newGross = newBasic + newHouseRent + newMedical + newTransport + newFood;
          }
        }
      } else {
        newBasic = Math.round(oldBasic * (1 + incrementPct / 100));
        newHouseRent = Math.round(newBasic * 0.5);
        newGross = newBasic + newHouseRent + newMedical + newTransport + newFood;
      }

      const monthlyRaise = roundCurrency(Math.max(0, newGross - wages.grossSalary));
      const yearlyRaise = roundCurrency(monthlyRaise * 12);
      const oldOtRate = roundCurrency((oldBasic / p.overtimeStandardDivisor) * p.overtimeStandardMultiplier);
      const newOtRate = roundCurrency((newBasic / p.overtimeStandardDivisor) * p.overtimeStandardMultiplier);
      const newDailyRate = roundCurrency(newGross / 30);

      return {
        calculatorId,
        calculatorTitleBn: catalogMeta.titleBn,
        calculatorTitleEn: catalogMeta.titleEn,
        calculationDate: effectiveDate,
        workerName,
        factoryName,
        department,
        designation,
        isComplete: true,
        isEligible: monthlyRaise > 0,
        eligibilityStatusBn:
          monthlyRaise > 0
            ? `কার্যকর তারিখ: ${effectiveDate}`
            : 'ইনক্রিমেন্টের শতাংশ (%) বা টাকার পরিমাণ দিন',
        eligibilityExplanationBn:
          'বার্ষিক ইনক্রিমেন্ট মূল বেতনের উপর হিসাব হয়',
        wageBasisLabelBn: 'নতুন মোট বেতন (দৈনিক হার = মোট বেতন ÷ ৩০)',
        wageBasisAmountBDT: newGross,
        dailyRateUsedBDT: newDailyRate,
        totalEstimatedPayableBDT: newGross,
        breakdownItems: [
          {
            labelBn: 'মূল বেতন (আগে → পরে)',
            labelEn: 'Basic Salary (Before → After)',
            formulaBn: `৳ ${toBengaliDigits(oldBasic)} → ৳ ${toBengaliDigits(newBasic)}`,
            amountBDT: newBasic,
          },
          {
            labelBn: 'বাড়ি ভাড়া (৫০%)',
            labelEn: 'House Rent (50%)',
            formulaBn: `৳ ${toBengaliDigits(Math.round(houseRentAllowance))} → ৳ ${toBengaliDigits(newHouseRent)}`,
            amountBDT: newHouseRent,
          },
          {
            labelBn: 'চিকিৎসা, যাতায়াত ও খাদ্য ভাতা',
            labelEn: 'Medical, Transport & Food',
            formulaBn: `৳ ${toBengaliDigits(newMedical)} + ৳ ${toBengaliDigits(newTransport)} + ৳ ${toBengaliDigits(newFood)}`,
            amountBDT: roundCurrency(newMedical + newTransport + newFood),
          },
          {
            labelBn: 'মাসিক বৃদ্ধি',
            labelEn: 'Monthly Increase',
            formulaBn: `ওটি রেট: ৳ ${toBengaliDigits(oldOtRate.toFixed(2))} → ৳ ${toBengaliDigits(newOtRate.toFixed(2))}/ঘণ্টা`,
            amountBDT: monthlyRaise,
          },
        ],
        summaryHighlights: [
          { labelBn: 'নতুন মোট বেতন', valueBn: `৳ ${toBengaliDigits(newGross)}` },
          { labelBn: 'মাসিক বৃদ্ধি', valueBn: `+৳ ${toBengaliDigits(monthlyRaise)}` },
          { labelBn: 'বার্ষিক বৃদ্ধি', valueBn: `+৳ ${toBengaliDigits(yearlyRaise)}` },
          { labelBn: 'নতুন ওটি রেট', valueBn: `৳ ${toBengaliDigits(newOtRate.toFixed(2))}` },
        ],
        legalInfo: {
          sectionBn: catalogMeta.legalSectionBn,
          ruleVersionId: ruleVersion.versionId,
          effectiveFrom: ruleVersion.effectiveFrom,
          assumptionsBn: [
            'বার্ষিক ইনক্রিমেন্ট মূল বেতনের উপর হিসাব হয়।',
            'নতুন ওভারটাইম হার = (নতুন মূল বেতন ÷ ২০৮) × ২।',
          ],
          limitationsBn: [
            'কারখানার গ্রেড ও নীতিমালা অনুযায়ী চূড়ান্ত হার ভিন্ন হতে পারে।',
          ],
          explanationBn: catalogMeta.helpTextBn,
        },
      };
    }
  }
}

function buildIncompleteResult(
  catalogMeta: CalculatorCatalogMeta,
  ruleVersion: LegalRuleVersion,
  params: {
    workerName: string;
    factoryName: string;
    department: string;
    designation: string;
    calculationDate: string;
    reasonBn: string;
  }
): BenefitCalculationOutput {
  return {
    calculatorId: catalogMeta.id,
    calculatorTitleBn: catalogMeta.titleBn,
    calculatorTitleEn: catalogMeta.titleEn,
    calculationDate: params.calculationDate,
    workerName: params.workerName,
    factoryName: params.factoryName,
    department: params.department,
    designation: params.designation,
    isComplete: false,
    incompleteMessageBn: params.reasonBn,
    isEligible: false,
    eligibilityStatusBn: params.reasonBn,
    eligibilityExplanationBn: params.reasonBn,
    wageBasisLabelBn: 'প্রযোজ্য নয়',
    wageBasisAmountBDT: 0,
    dailyRateUsedBDT: 0,
    totalEstimatedPayableBDT: 0,
    breakdownItems: [],
    summaryHighlights: [],
    legalInfo: {
      sectionBn: catalogMeta.legalSectionBn,
      ruleVersionId: ruleVersion.versionId,
      effectiveFrom: ruleVersion.effectiveFrom,
      assumptionsBn: [],
      limitationsBn: [params.reasonBn],
      explanationBn: catalogMeta.helpTextBn,
    },
  };
}
