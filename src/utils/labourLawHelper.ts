import type { Language, WorkerProfile } from '../types';
import {
  formatBDT,
  formatNumber,
  getSalaryStructure,
  roundCurrency,
  toBengaliDigits,
  toEnglishDigits,
} from './calculations';

export interface LabourLawAnswerResult {
  computedHeadlineBn?: string;
  computedHeadlineEn?: string;
  computedTotalBDT?: number;
  usedQuestionNumbers: boolean;
  answerBn: string;
  answerEn: string;
}

function parseNumericToken(raw: string): number {
  const cleaned = toEnglishDigits(raw).replace(/[,৳\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function extractMatchNumber(text: string, patterns: RegExp[]): number | null {
  for (const regex of patterns) {
    const m = text.match(regex);
    if (m && m[1]) {
      const val = parseNumericToken(m[1]);
      if (val > 0) return val;
    }
  }
  return null;
}

/**
 * Parses numeric inputs directly from a worker's Bengali or English Labour Act question
 * (e.g., "Basic 6,700 হলে 40 ঘণ্টা OT কত?" or "মূল বেতন ৭৫০০, ৩০ ঘণ্টা ওভারটাইম কত টাকা?")
 * and computes the exact answer FIRST before showing the statutory rule.
 */
export function answerLabourLawQuestion(
  rawQuery: string,
  profile: Partial<WorkerProfile>,
  lang: Language = 'bn'
): LabourLawAnswerResult {
  const q = rawQuery.trim();
  const normalized = toEnglishDigits(q).toLowerCase();
  const salaryStruct = getSalaryStructure(profile);
  const safeDivisor = Number(profile.otDivisor) > 0 ? Number(profile.otDivisor) : 208;
  const safeMultiplier = Number(profile.otMultiplier) > 0 ? Number(profile.otMultiplier) : 2;

  // 1. Extract explicit numbers from the question
  const askedBasic = extractMatchNumber(normalized, [
    /(?:basic|বেসিক|মূল\s*বেতন|মুল\s*বেতন)[^\d]{0,16}(\d[\d,]*(?:\.\d+)?)/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:টাকা|taka|bdt)?\s*(?:basic|বেসিক|মূল\s*বেতন)/i,
  ]);
  const askedGross = extractMatchNumber(normalized, [
    /(?:gross|গ্রস|মোট\s*বেতন)[^\d]{0,16}(\d[\d,]*(?:\.\d+)?)/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:টাকা|taka|bdt)?\s*(?:gross|গ্রস|মোট\s*বেতন)/i,
  ]);
  const askedHours = extractMatchNumber(normalized, [
    /(\d+(?:\.\d+)?)\s*(?:ঘণ্টা|ঘন্টা|hours?|hrs?|h\b)/i,
    /(?:ot|ওটি|ওভারটাইম|overtime)[^\d]{0,12}(\d+(?:\.\d+)?)\s*(?:ঘণ্টা|ঘন্টা|hours?|hrs?)?/i,
  ]);
  const askedYears = extractMatchNumber(normalized, [
    /(\d+(?:\.\d+)?)\s*(?:বছর|years?|yrs?)/i,
  ]);
  const askedDays = extractMatchNumber(normalized, [
    /(\d+(?:\.\d+)?)\s*(?:দিন|কার্যদিবস|days?)/i,
  ]);
  const askedPct = extractMatchNumber(normalized, [
    /(\d+(?:\.\d+)?)\s*(?:%|শতাংশ|পার্সেন্ট|percent)/i,
  ]);

  const effectiveBasic =
    askedBasic ??
    (askedGross && askedGross > 2450
      ? Math.round((askedGross - 2450) / 1.5)
      : salaryStruct.basicSalary);
  const effectiveGross = askedGross ?? salaryStruct.grossSalary;
  const usedQuestionNumbers = Boolean(
    askedBasic || askedGross || askedHours || askedYears || askedDays || askedPct
  );

  // A. Overtime Question (Sec 108)
  const isOvertimeIntent =
    /overtime|\bot\b|ওভারটাইম|ওটি|ঘণ্টা|ঘন্টা|208/.test(normalized) ||
    Boolean(askedHours);

  if (isOvertimeIntent) {
    const isHolidayDouble = /শুক্রবার|ছুটির দিন|holiday|friday|সাপ্তাহিক ছুটি/.test(normalized);
    const hourlyRateRaw = (effectiveBasic / safeDivisor) * safeMultiplier;
    const hourlyRateRounded = roundCurrency(hourlyRateRaw);
    const effectiveRateRaw = isHolidayDouble ? hourlyRateRaw * 2 : hourlyRateRaw;
    const effectiveRateRounded = roundCurrency(effectiveRateRaw);
    const hours = askedHours ?? 0;

    if (hours > 0) {
      const exactTotal = roundCurrency(effectiveRateRaw * hours);
      const roundedDisplay = Math.round(exactTotal);
      const headlineBn = `মোট ওভারটাইম পাওনা: ${formatBDT(exactTotal, 'bn', true)} (প্রায় ${formatBDT(roundedDisplay, 'bn')})`;
      const headlineEn = `Total Overtime Pay: ${formatBDT(exactTotal, 'en', true)} (approx. ${formatBDT(roundedDisplay, 'en')})`;

      const holidayNoteBn = isHolidayDouble
        ? `\n• সাপ্তাহিক/সরকারি ছুটির দিনে কাজ করলে সাধারণত দ্বিগুণ হার (৳${toBengaliDigits(effectiveRateRounded.toFixed(2))}/ঘণ্টা) বা বিকল্প ছুটি প্রযোজ্য।`
        : '';
      const holidayNoteEn = isHolidayDouble
        ? `\n• Weekly/public holiday work generally carries 2x holiday rate (৳${effectiveRateRounded.toFixed(2)}/hr) or compensatory leave.`
        : '';

      const answerBn = [
        `📌 ${headlineBn}`,
        ``,
        `হিসাবের ধাপ (বাংলাদেশ শ্রম আইন ২০০৬, ধারা ১০৮):`,
        `• ব্যবহৃত মূল বেতন (Basic): ${formatBDT(effectiveBasic, 'bn')}${askedBasic ? ' (আপনার প্রশ্ন থেকে নেওয়া)' : ' (আপনার প্রোফাইল থেকে নেওয়া)'}`,
        `• প্রতি ঘণ্টার ওটি হার: (${formatNumber(effectiveBasic, 'bn')} ÷ ${toBengaliDigits(safeDivisor)}) × ${toBengaliDigits(safeMultiplier)} = ৳${toBengaliDigits(hourlyRateRounded.toFixed(2))}${isHolidayDouble ? ` × ২ = ৳${toBengaliDigits(effectiveRateRounded.toFixed(2))}` : ''}`,
        `• ${toBengaliDigits(hours)} ঘণ্টার মোট ওটি: ৳${toBengaliDigits(effectiveRateRaw.toFixed(4))} × ${toBengaliDigits(hours)} = ${formatBDT(exactTotal, 'bn', true)}`,
        holidayNoteBn,
        ``,
        `আইনি নিয়ম: শ্রম আইন ধারা ১০৮ অনুযায়ী দৈনিক ৮ ঘণ্টা বা সাপ্তাহিক ৪৮ ঘণ্টার অতিরিক্ত কাজের জন্য শ্রমিক সাধারণ মূল মজুরি হারের দ্বিগুণ হারে ওভারটাইম ভাতা প্রাপ্য।`,
      ]
        .filter((line) => line !== undefined)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');

      const answerEn = [
        `📌 ${headlineEn}`,
        ``,
        `Calculation (Bangladesh Labor Act 2006, Section 108):`,
        `• Basic Salary used: ${formatBDT(effectiveBasic, 'en')}${askedBasic ? ' (from your question)' : ' (from your profile)'}`,
        `• Hourly OT Rate: (${effectiveBasic} ÷ ${safeDivisor}) × ${safeMultiplier} = ৳${hourlyRateRounded.toFixed(2)}${isHolidayDouble ? ` × 2 = ৳${effectiveRateRounded.toFixed(2)}` : ''}`,
        `• Total for ${hours} hrs: ${formatBDT(exactTotal, 'en', true)}`,
        holidayNoteEn,
        ``,
        `Statutory Rule: Under Section 108, work beyond 8 hours/day or 48 hours/week is paid at twice the ordinary basic hourly rate.`,
      ]
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');

      return {
        computedHeadlineBn: headlineBn,
        computedHeadlineEn: headlineEn,
        computedTotalBDT: exactTotal,
        usedQuestionNumbers,
        answerBn,
        answerEn,
      };
    }

    const headlineBn = `প্রতি ঘণ্টার ওভারটাইম হার: ৳${toBengaliDigits(hourlyRateRounded.toFixed(2))}`;
    const headlineEn = `Hourly Overtime Rate: ৳${hourlyRateRounded.toFixed(2)}`;
    return {
      computedHeadlineBn: headlineBn,
      computedHeadlineEn: headlineEn,
      computedTotalBDT: hourlyRateRounded,
      usedQuestionNumbers,
      answerBn: `📌 ${headlineBn}\n\n• ব্যবহৃত মূল বেতন (Basic): ${formatBDT(effectiveBasic, 'bn')}\n• সূত্র (ধারা ১০৮): (${formatNumber(effectiveBasic, 'bn')} ÷ ${toBengaliDigits(safeDivisor)}) × ${toBengaliDigits(safeMultiplier)} = ৳${toBengaliDigits(hourlyRateRounded.toFixed(2))}/ঘণ্টা।\n• নির্দিষ্ট ঘণ্টার মোট জানতে লিখুন যেমন: "Basic 6,700 হলে 40 ঘণ্টা OT কত?"`,
      answerEn: `📌 ${headlineEn}\n\n• Basic Salary used: ${formatBDT(effectiveBasic, 'en')}\n• Formula (Sec 108): (${effectiveBasic} ÷ ${safeDivisor}) × ${safeMultiplier} = ৳${hourlyRateRounded.toFixed(2)}/hr.\n• To get a total, include hours (e.g., "Basic 6,700 and 40 hours OT").`,
    };
  }

  // B. Increment Question
  if (/increment|ইনক্রিমেন্ট|বেতন বাড়|বেতন বৃদ্ধি|raise/.test(normalized)) {
    const pct = askedPct ?? 5;
    const newBasic = roundCurrency(effectiveBasic * (1 + pct / 100));
    const raiseAmount = roundCurrency(newBasic - effectiveBasic);
    const newHouseRent = Math.round(newBasic * 0.5);
    const newGross = roundCurrency(newBasic + newHouseRent + 750 + 450 + 1250);
    const newOtRate = roundCurrency((newBasic / safeDivisor) * safeMultiplier);
    const headlineBn = `${toBengaliDigits(pct)}% ইনক্রিমেন্টে নতুন মূল বেতন ${formatBDT(newBasic, 'bn')} ও আনুমানিক গ্রস ${formatBDT(newGross, 'bn')}`;
    const headlineEn = `At ${pct}% increment: New Basic ${formatBDT(newBasic, 'en')}, Est. Gross ${formatBDT(newGross, 'en')}`;

    return {
      computedHeadlineBn: headlineBn,
      computedHeadlineEn: headlineEn,
      computedTotalBDT: newGross,
      usedQuestionNumbers,
      answerBn: `📌 ${headlineBn}\n\n• বর্তমান মূল বেতন: ${formatBDT(effectiveBasic, 'bn')}\n• মূল বেতন বৃদ্ধি (${toBengaliDigits(pct)}%): +${formatBDT(raiseAmount, 'bn')}\n• নতুন বাড়ি ভাড়া (৫০%): ${formatBDT(newHouseRent, 'bn')}\n• নতুন ওটি হার: ৳${toBengaliDigits(newOtRate.toFixed(2))}/ঘণ্টা\n\nনিয়ম: গার্মেন্টস খাতে প্রতি বছর ন্যূনতম ৫% বাৎসরিক ইনক্রিমেন্ট মূল বেতনের উপর হিসাব করা হয়। বিস্তারিত হিসাব করতে "ইনক্রিমেন্ট হিসাব" ক্যালকুলেটর দেখুন।`,
      answerEn: `📌 ${headlineEn}\n\n• Current Basic: ${formatBDT(effectiveBasic, 'en')}\n• Basic Increase (${pct}%): +${formatBDT(raiseAmount, 'en')}\n• New House Rent (50%): ${formatBDT(newHouseRent, 'en')}\n• New Hourly OT Rate: ৳${newOtRate.toFixed(2)}/hr\n\nRule: Annual RMG increment (typically 5% minimum) applies to Basic Salary.`,
    };
  }

  // C. Maternity Benefit Question (Sec 45-48) - check before generic 'ছুটি' leave matcher
  if (/মাতৃত্ব|maternity|সন্তান|ডেলিভারি/.test(normalized)) {
    const dailyGross = roundCurrency(effectiveGross / 30);
    const total112 = roundCurrency(dailyGross * 112);
    const headlineBn = `১৬ সপ্তাহ (১১২ দিন) মাতৃত্বকালীন আনুমানিক ভাতা: ${formatBDT(total112, 'bn')}`;
    const headlineEn = `16 weeks (112 days) est. maternity benefit: ${formatBDT(total112, 'en')}`;
    return {
      computedHeadlineBn: headlineBn,
      computedHeadlineEn: headlineEn,
      computedTotalBDT: total112,
      usedQuestionNumbers,
      answerBn: `📌 ${headlineBn}\n\n• ব্যবহৃত মোট বেতন: ${formatBDT(effectiveGross, 'bn')}${askedGross ? ' (আপনার প্রশ্ন থেকে)' : ' (আপনার প্রোফাইল থেকে)'}\n• দৈনিক হার (মোট বেতন ÷ ৩০): ${formatBDT(dailyGross, 'bn', true)}\n• শ্রম আইন ধারা ৪৬: ন্যূনতম ৬ মাস চাকরি ও ২টির কম জীবিত সন্তান থাকলে প্রসবের আগে ৮ সপ্তাহ + পরে ৮ সপ্তাহ মোট ১৬ সপ্তাহ পূর্ণ বেতনে ছুটি প্রাপ্য।`,
      answerEn: `📌 ${headlineEn}\n\n• Gross Salary used: ${formatBDT(effectiveGross, 'en')}${askedGross ? ' (from your question)' : ' (from your profile)'}\n• Daily Rate (Gross ÷ 30): ${formatBDT(dailyGross, 'en', true)}\n• BLA Sec 46: 16 weeks (8 before + 8 after delivery) paid leave with 6+ months service and fewer than 2 surviving children.`,
    };
  }

  // D. Earned / Annual Leave Question (Sec 117 & 119)
  if (/ছুটি|leave|অর্জিত|earned|নৈমিত্তিক|casual|sick|অসুস্থ/.test(normalized)) {
    const dailyRate = roundCurrency(effectiveGross / 30);
    if (askedDays && askedDays > 0) {
      const earnedDays = roundCurrency(Math.floor((askedDays / 18) * 100) / 100);
      const encashValue = roundCurrency(earnedDays * dailyRate);
      const headlineBn = `${toBengaliDigits(askedDays)} কার্যদিবসে অর্জিত ছুটি ${toBengaliDigits(earnedDays)} দিন (আনুমানিক মূল্য ${formatBDT(encashValue, 'bn', true)})`;
      const headlineEn = `${askedDays} working days → ${earnedDays} earned leave days (est. ${formatBDT(encashValue, 'en', true)})`;
      return {
        computedHeadlineBn: headlineBn,
        computedHeadlineEn: headlineEn,
        computedTotalBDT: encashValue,
        usedQuestionNumbers,
        answerBn: `📌 ${headlineBn}\n\n• হিসাব (ধারা ১১৭): ${toBengaliDigits(askedDays)} ÷ ১৮ = ${toBengaliDigits(earnedDays)} দিন অর্জিত ছুটি।\n• দৈনিক হার (মোট বেতন ÷ ৩০): ${formatBDT(dailyRate, 'bn', true)}\n• অন্যান্য বাৎসরিক ছুটি: নৈমিত্তিক ১০ দিন (ধারা ১১৫), অসুস্থতা ১৪ দিন (ধারা ১১৬), উৎসব ছুটি কমপক্ষে ১১ দিন (ধারা ১১৮)।`,
        answerEn: `📌 ${headlineEn}\n\n• Formula (Sec 117): ${askedDays} ÷ 18 = ${earnedDays} earned leave days.\n• Daily Rate (Gross ÷ 30): ${formatBDT(dailyRate, 'en', true)}\n• Other statutory leave: 10 Casual days (Sec 115), 14 Sick days (Sec 116), 11+ Festival days (Sec 118).`,
      };
    }

    return {
      usedQuestionNumbers,
      answerBn: `📌 বাৎসরিক ছুটির আইনি নিয়ম (বাংলাদেশ শ্রম আইন ২০০৬):\n• নৈমিত্তিক ছুটি (ধারা ১১৫): বছরে ১০ দিন পূর্ণ বেতনে (বছর শেষে জমা থাকে না)।\n• অসুস্থতাজনিত ছুটি (ধারা ১১৬): বছরে ১৪ দিন পূর্ণ বেতনে (ডাক্তারি সনদ সাপেক্ষে)।\n• অর্জিত ছুটি (ধারা ১১৭): কারখানায় প্রতি ১৮ দিন কাজের জন্য ১ দিন (সর্বোচ্চ ৪০ দিন পর্যন্ত জমা ও নগদায়নযোগ্য)।\n• উৎসব ছুটি (ধারা ১১৮): বছরে কমপক্ষে ১১ দিন।`,
      answerEn: `📌 Annual Leave Entitlements (Bangladesh Labor Act 2006):\n• Casual Leave (Sec 115): 10 paid days/year (non-cumulative).\n• Sick Leave (Sec 116): 14 paid days/year (with medical certificate).\n• Earned Leave (Sec 117): 1 day per 18 working days (accumulates up to 40 days).\n• Festival Holidays (Sec 118): At least 11 paid days/year.`,
    };
  }

  // E. Service Benefit / Resignation / Gratuity Question (Sec 27 & Sec 2(10))
  if (/সার্ভিস|service|রিজাইন|resign|পদত্যাগ|গ্র্যাচুইটি|gratuity/.test(normalized)) {
    const yrs = askedYears ?? 0;
    const dailyBasic = roundCurrency(effectiveBasic / 30);
    if (yrs > 0) {
      const daysPerYear = yrs >= 10 ? 30 : yrs >= 5 ? 14 : 0;
      const total = roundCurrency(yrs * daysPerYear * dailyBasic);
      const headlineBn =
        daysPerYear > 0
          ? `${toBengaliDigits(yrs)} বছর চাকরিতে সার্ভিস বেনিফিট: ${formatBDT(total, 'bn', true)}`
          : `${toBengaliDigits(yrs)} বছর চাকরিতে স্বেচ্ছায় পদত্যাগে সার্ভিস বেনিফিট প্রযোজ্য নয় (৫+ বছর প্রয়োজন)`;
      const headlineEn =
        daysPerYear > 0
          ? `Service Benefit for ${yrs} yrs: ${formatBDT(total, 'en', true)}`
          : `No resignation service benefit under 5 completed years (${yrs} yrs)`;
      return {
        computedHeadlineBn: headlineBn,
        computedHeadlineEn: headlineEn,
        computedTotalBDT: total,
        usedQuestionNumbers,
        answerBn: `📌 ${headlineBn}\n\n• মূল বেতন: ${formatBDT(effectiveBasic, 'bn')}${askedBasic ? ' (আপনার প্রশ্ন থেকে)' : ' (আপনার প্রোফাইল থেকে)'}\n• দৈনিক মূল বেতন: ${formatBDT(dailyBasic, 'bn', true)}\n• হার (ধারা ২৭(৪)): ৫–৯ বছরে প্রতি বছর ১৪ দিন, ১০+ বছরে প্রতি বছর ৩০ দিনের মূল বেতন।\n• হিসাব: ${toBengaliDigits(yrs)} × ${toBengaliDigits(daysPerYear)} × ${formatBDT(dailyBasic, 'bn', true)} = ${formatBDT(total, 'bn', true)}`,
        answerEn: `📌 ${headlineEn}\n\n• Basic Salary: ${formatBDT(effectiveBasic, 'en')}${askedBasic ? ' (from your question)' : ' (from your profile)'}\n• Daily Basic: ${formatBDT(dailyBasic, 'en', true)}\n• Rate (Sec 27(4)): 14 days/yr for 5–9 yrs, 30 days/yr for 10+ yrs.\n• Total: ${yrs} × ${daysPerYear} × ${formatBDT(dailyBasic, 'en', true)} = ${formatBDT(total, 'en', true)}`,
      };
    }
  }

  // F. Absence Deduction / Daily Wage Question (Sec 125 & Daily Rate)
  if (/অনুপস্থিত|absent|কাটা|কর্তন|দৈনিক|daily\s*wage|হাজিরা\s*কাট/.test(normalized)) {
    const dailyGross = roundCurrency(effectiveGross / 30);
    const dailyBasic = roundCurrency(effectiveBasic / 30);
    const days = askedDays ?? 1;
    const deductionBasic = roundCurrency(dailyBasic * days);
    const headlineBn =
      /অনুপস্থিত|absent|কাটা|কর্তন/.test(normalized)
        ? `${toBengaliDigits(days)} দিন অনুপস্থিতির আনুমানিক কর্তন: ${formatBDT(deductionBasic, 'bn', true)}`
        : `দৈনিক বেতনের হার: ${formatBDT(dailyGross, 'bn', true)} (মূল বেতন অনুযায়ী ${formatBDT(dailyBasic, 'bn', true)})`;
    const headlineEn =
      /অনুপস্থিত|absent|কাটা|কর্তন/.test(normalized)
        ? `Est. deduction for ${days} absent day(s): ${formatBDT(deductionBasic, 'en', true)}`
        : `Daily Wage Rate: ${formatBDT(dailyGross, 'en', true)} (Basic daily: ${formatBDT(dailyBasic, 'en', true)})`;

    return {
      computedHeadlineBn: headlineBn,
      computedHeadlineEn: headlineEn,
      computedTotalBDT: /অনুপস্থিত|absent|কাটা|কর্তন/.test(normalized) ? deductionBasic : dailyGross,
      usedQuestionNumbers,
      answerBn: `📌 ${headlineBn}\n\n• ব্যবহৃত মূল বেতন: ${formatBDT(effectiveBasic, 'bn')}${askedBasic ? ' (আপনার প্রশ্ন থেকে)' : ' (আপনার প্রোফাইল থেকে)'}\n• ব্যবহৃত মোট বেতন: ${formatBDT(effectiveGross, 'bn')}${askedGross ? ' (আপনার প্রশ্ন থেকে)' : ' (আপনার প্রোফাইল থেকে)'}\n• দৈনিক মূল বেতন (Basic ÷ ৩০): ${formatBDT(dailyBasic, 'bn', true)}\n• দৈনিক মোট বেতন (Gross ÷ ৩০): ${formatBDT(dailyGross, 'bn', true)}\n• শ্রম আইন ধারা ১২৫: বিনা অনুমতিতে অনুপস্থিত থাকলে সংশ্লিষ্ট দিনের মূল মজুরি (Basic ÷ ৩০) কর্তন করা যায়।`,
      answerEn: `📌 ${headlineEn}\n\n• Basic Salary used: ${formatBDT(effectiveBasic, 'en')}${askedBasic ? ' (from your question)' : ' (from your profile)'}\n• Gross Salary used: ${formatBDT(effectiveGross, 'en')}${askedGross ? ' (from your question)' : ' (from your profile)'}\n• Daily Basic (Basic ÷ 30): ${formatBDT(dailyBasic, 'en', true)}\n• Daily Gross (Gross ÷ 30): ${formatBDT(dailyGross, 'en', true)}\n• BLA Sec 125: Unauthorized absence deduction is based on Basic ÷ 30 per absent day.`,
    };
  }

  // G. Default general summary using canonical salary structure
  const hourlyOt = roundCurrency((effectiveBasic / safeDivisor) * safeMultiplier);
  const dailyGross = roundCurrency(effectiveGross / 30);
  const defaultBn = [
    `আপনার প্রোফাইল অনুযায়ী সারসংক্ষেপ:`,
    `• মোট বেতন: ${formatBDT(effectiveGross, 'bn')} | মূল বেতন: ${formatBDT(effectiveBasic, 'bn')}`,
    `• দৈনিক হার (মোট বেতন ÷ ৩০): ${formatBDT(dailyGross, 'bn', true)}`,
    `• ওভারটাইম হার (ধারা ১০৮): (${formatNumber(effectiveBasic, 'bn')} ÷ ${toBengaliDigits(safeDivisor)}) × ${toBengaliDigits(safeMultiplier)} = ৳${toBengaliDigits(hourlyOt.toFixed(2))}/ঘণ্টা`,
    `• বাৎসরিক ছুটি: নৈমিত্তিক ১০, অসুস্থতা ১৪, উৎসব ১১ ও প্রতি ১৮ কাজে ১ দিন অর্জিত ছুটি।`,
  ].join('\n');

  const defaultEn = [
    `Summary from your profile:`,
    `• Gross Salary: ${formatBDT(effectiveGross, 'en')} | Basic Salary: ${formatBDT(effectiveBasic, 'en')}`,
    `• Daily Rate (Gross ÷ 30): ${formatBDT(dailyGross, 'en', true)}`,
    `• Hourly OT Rate (Sec 108): (${effectiveBasic} ÷ ${safeDivisor}) × ${safeMultiplier} = ৳${hourlyOt.toFixed(2)}/hr`,
    `• Annual Leave: 10 Casual, 14 Sick, 11 Festival, and 1 Earned Leave day per 18 work days.`,
  ].join('\n');

  return {
    usedQuestionNumbers,
    answerBn: defaultBn,
    answerEn: defaultEn,
  };
}
