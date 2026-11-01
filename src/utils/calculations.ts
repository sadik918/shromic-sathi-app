import type {
  AttendanceRecord,
  AttendanceStatus,
  DutyShiftType,
  EditHistoryEntry,
  ExpenseCategory,
  ExpenseRecord,
  GarmentWorkplace,
  Language,
  LoanRepayment,
  OvertimeRecord,
  PersonalLoan,
  ProposedVoiceEntry,
  PublicHolidayInfo,
  ReminderItem,
  SalaryPayment,
  SalaryRecord,
  SavingsGoal,
  VaultDocument,
  WorkerContact,
  WorkerContactCategory,
  WorkerProfile,
  WorkShiftPattern,
} from '../types';

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)] ?? d);
}

export function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (ch) => {
    const idx = BENGALI_DIGITS.indexOf(ch);
    return idx >= 0 ? String(idx) : ch;
  });
}

export const DEFAULT_RMG_HOURLY_OT_RATE = 64.42;

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatBDT(amount: number, lang: Language = 'bn', showDecimals?: boolean): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const rounded = Math.round((safe + Number.EPSILON) * 100) / 100;
  const hasPaisa = Math.abs(rounded - Math.trunc(rounded)) > 0.0001;
  const displayDecimals = showDecimals !== undefined ? showDecimals : hasPaisa;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: displayDecimals ? 2 : 0,
    maximumFractionDigits: displayDecimals ? 2 : 0,
  }).format(rounded);

  if (lang === 'bn') {
    return `৳ ${toBengaliDigits(formatted)}`;
  }
  return `৳ ${formatted}`;
}

export function formatTakaPaisaLabel(amount: number, lang: Language = 'bn'): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const totalPaisa = Math.round((safe + Number.EPSILON) * 100);
  const taka = Math.floor(totalPaisa / 100);
  const paisa = totalPaisa % 100;
  if (lang === 'bn') {
    if (paisa > 0) {
      return `${toBengaliDigits(taka)} টাকা ${toBengaliDigits(paisa)} পয়সা`;
    }
    return `${toBengaliDigits(taka)} টাকা`;
  }
  if (paisa > 0) {
    return `${taka} Taka ${paisa} Paisa`;
  }
  return `${taka} Taka`;
}

export function computeOnboardingOvertimeBreakdown(params: {
  grossSalary: number;
  basicSalary: number;
  customOtRate?: number;
}): {
  effectiveBasic: number;
  hourlyOtRate: number;
  oneHourOt: number;
  twoHoursOt: number;
} {
  const parsedGross = Math.max(0, Number(params.grossSalary) || 0);
  const parsedBasic = Math.max(0, Number(params.basicSalary) || 0);
  const parsedCustomRate = Math.max(0, Number(params.customOtRate) || 0);

  const derivedBasic =
    parsedBasic > 0
      ? parsedBasic
      : parsedGross >= 2450
      ? deriveBangladeshRMGBreakdownFromGross(parsedGross).basicSalary
      : 0;

  const hourlyOtRate =
    parsedCustomRate > 0
      ? roundCurrency(parsedCustomRate)
      : derivedBasic > 0
      ? roundCurrency((derivedBasic / 208) * 2)
      : DEFAULT_RMG_HOURLY_OT_RATE;

  const oneHourOt = roundCurrency(hourlyOtRate * 1);
  const twoHoursOt = roundCurrency(hourlyOtRate * 2);

  return {
    effectiveBasic: derivedBasic,
    hourlyOtRate,
    oneHourOt,
    twoHoursOt,
  };
}

export function formatNumber(num: number, lang: Language = 'bn', decimals = 0): string {
  const safe = Number.isFinite(num) ? num : 0;
  const fixed = decimals > 0 ? safe.toFixed(decimals).replace(/\.0+$/, '') : String(Math.round(safe));
  return lang === 'bn' ? toBengaliDigits(fixed) : fixed;
}

export const BANGLADESH_WAGE_GRADES = [
  {
    id: 'grade_1',
    labelBn: 'গ্রেড ১ (সিনিয়র অপারেটর)',
    labelEn: 'Grade 1 (Senior Operator)',
    grossSalary: 14750,
    basicSalary: 8200,
    houseRentAllowance: 4100,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
  },
  {
    id: 'grade_2',
    labelBn: 'গ্রেড ২ (হাই স্কিলড অপারেটর)',
    labelEn: 'Grade 2 (High Skilled)',
    grossSalary: 14150,
    basicSalary: 7800,
    houseRentAllowance: 3900,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
  },
  {
    id: 'grade_3',
    labelBn: 'গ্রেড ৩ (সিনিয়র মেশিন অপারেটর)',
    labelEn: 'Grade 3 (Sr. Machine Operator)',
    grossSalary: 13025,
    basicSalary: 7050,
    houseRentAllowance: 3525,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
  },
  {
    id: 'grade_4',
    labelBn: 'গ্রেড ৪ (মেশিন অপারেটর — নূন্যতম মজুরি)',
    labelEn: 'Grade 4 (Machine Operator)',
    grossSalary: 12500,
    basicSalary: 6700,
    houseRentAllowance: 3350,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
  },
];

export const BANGLADESH_PUBLIC_HOLIDAYS: PublicHolidayInfo[] = [
  {
    date: '2026-02-04',
    month: '2026-02',
    titleBn: 'পবিত্র শবে বরাত (সম্ভাব্য ছুটি)',
    titleEn: 'Shab-e-Barat (Tentative)',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-02-21',
    month: '2026-02',
    titleBn: 'শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস',
    titleEn: 'International Mother Language Day',
    type: 'national',
  },
  {
    date: '2026-03-17',
    month: '2026-03',
    titleBn: 'পবিত্র শবে কদর (সম্ভাব্য ছুটি)',
    titleEn: 'Shab-e-Qadr (Tentative)',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-03-20',
    month: '2026-03',
    titleBn: 'পবিত্র ঈদুল ফিতর ছুটি (সম্ভাব্য)',
    titleEn: 'Eid-ul-Fitr Holiday',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-03-21',
    month: '2026-03',
    titleBn: 'পবিত্র ঈদুল ফিতর (মূল দিন - সম্ভাব্য)',
    titleEn: 'Eid-ul-Fitr Day',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-03-26',
    month: '2026-03',
    titleBn: 'মহান স্বাধীনতা ও জাতীয় দিবস',
    titleEn: 'Independence & National Day',
    type: 'national',
  },
  {
    date: '2026-04-14',
    month: '2026-04',
    titleBn: 'পহেলা বৈশাখ (বাংলা নববর্ষ)',
    titleEn: 'Pahela Baishakh (Bengali New Year)',
    type: 'national',
  },
  {
    date: '2026-05-01',
    month: '2026-05',
    titleBn: 'মহান মে দিবস (আন্তর্জাতিক শ্রমিক দিবস)',
    titleEn: 'May Day (International Workers Day)',
    type: 'labor',
  },
  {
    date: '2026-05-27',
    month: '2026-05',
    titleBn: 'পবিত্র ঈদুল আযহা ছুটি (সম্ভাব্য)',
    titleEn: 'Eid-ul-Adha Holiday',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-05-28',
    month: '2026-05',
    titleBn: 'পবিত্র ঈদুল আযহা (মূল দিন - সম্ভাব্য)',
    titleEn: 'Eid-ul-Adha Day',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-06-26',
    month: '2026-06',
    titleBn: 'পবিত্র আশুরা (১০ মহররম - সম্ভাব্য)',
    titleEn: 'Holy Ashura (Tentative)',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-08-05',
    month: '2026-08',
    titleBn: 'জুলাই গণঅভ্যুত্থান দিবস (সরকারি ছুটি)',
    titleEn: 'July Mass Uprising Day',
    type: 'national',
  },
  {
    date: '2026-08-25',
    month: '2026-08',
    titleBn: 'পবিত্র ঈদে মিলাদুন্নবী (সা.) (সম্ভাব্য ছুটি)',
    titleEn: 'Eid-e-Miladunnabi (Tentative)',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-09-04',
    month: '2026-09',
    titleBn: 'শুভ জন্মাষ্টমী (সরকারি ছুটি)',
    titleEn: 'Shubho Janmashtami',
    type: 'religious',
  },
  {
    date: '2026-10-20',
    month: '2026-10',
    titleBn: 'শারদীয় দুর্গাপূজা (মহানবমী - সম্ভাব্য ছুটি)',
    titleEn: 'Durga Puja (Mahanavami)',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-10-21',
    month: '2026-10',
    titleBn: 'শারদীয় দুর্গাপূজা (বিজয়া দশমী - সরকারি ছুটি)',
    titleEn: 'Durga Puja (Bijoya Dashami)',
    type: 'religious',
  },
  {
    date: '2026-10-30',
    month: '2026-10',
    titleBn: 'কোজাগরী লক্ষ্মীপূজা ও সমাপনী উৎসব ছুটি (সম্ভাব্য)',
    titleEn: 'Kojagori Lakshmi Puja (Tentative Holiday)',
    type: 'religious',
    isTentative: true,
  },
  {
    date: '2026-11-07',
    month: '2026-11',
    titleBn: 'জাতীয় বিপ্লব ও সংহতি দিবস (সম্ভাব্য ছুটি)',
    titleEn: 'National Revolution & Solidarity Day',
    type: 'national',
    isTentative: true,
  },
  {
    date: '2026-12-16',
    month: '2026-12',
    titleBn: 'মহান বিজয় দিবস (সরকারি ছুটি)',
    titleEn: 'Victory Day of Bangladesh',
    type: 'national',
  },
  {
    date: '2026-12-25',
    month: '2026-12',
    titleBn: 'শুভ বড়দিন (সরকারি ছুটি)',
    titleEn: 'Christmas Day',
    type: 'religious',
  },
];

export function getPublicHolidaysForMonth(month: string): PublicHolidayInfo[] {
  const mm = month.slice(5, 7);
  const direct = BANGLADESH_PUBLIC_HOLIDAYS.filter((h) => h.month === month);
  if (direct.length > 0) return direct;
  // Fallback by month-day for any other year
  return BANGLADESH_PUBLIC_HOLIDAYS.filter((h) => h.date.slice(5, 7) === mm).map((h) => ({
    ...h,
    date: `${month}-${h.date.slice(8, 10)}`,
    month,
  }));
}

export function getPublicHolidayForDate(date: string): PublicHolidayInfo | undefined {
  const exact = BANGLADESH_PUBLIC_HOLIDAYS.find((h) => h.date === date);
  if (exact) return exact;
  const mmdd = date.slice(5, 10);
  const byMonthDay = BANGLADESH_PUBLIC_HOLIDAYS.find((h) => h.date.slice(5, 10) === mmdd);
  if (byMonthDay) {
    return {
      ...byMonthDay,
      date,
      month: date.slice(0, 7),
    };
  }
  return undefined;
}

/**
 * Calculates standard Bangladesh RMG salary allowances from Gross or Basic.
 * Under 2023/2024 Bangladesh Minimum Wage Board standard for Garment Sector:
 * Gross = Basic + House Rent (50% of Basic) + Medical (750) + Transport (450) + Food (1250)
 * => Basic = (Gross - 2450) / 1.5
 */
export function deriveBangladeshRMGBreakdownFromGross(grossSalary: number): {
  basicSalary: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
} {
  const fixedAllowances = 750 + 450 + 1250; // 2450 BDT
  if (grossSalary <= fixedAllowances) {
    return {
      basicSalary: roundCurrency(grossSalary),
      houseRentAllowance: 0,
      medicalAllowance: 0,
      transportAllowance: 0,
      foodAllowance: 0,
    };
  }
  const basicSalary = Math.round((grossSalary - fixedAllowances) / 1.5);
  const houseRentAllowance = grossSalary - fixedAllowances - basicSalary;
  return {
    basicSalary,
    houseRentAllowance,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
  };
}

/**
 * Validates start and end time strings (HH:mm) and computes total net minutes and hours.
 */
export function calculateDurationMinutes(
  startTime: string,
  endTime: string,
  breakMinutes: number
): { valid: boolean; totalMinutes: number; calculatedHours: number; error?: string } {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { valid: false, totalMinutes: 0, calculatedHours: 0, error: 'INVALID_TIME_FORMAT' };
  }
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes > 360) {
    return { valid: false, totalMinutes: 0, calculatedHours: 0, error: 'INVALID_BREAK' };
  }

  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);

  const startTotal = sh * 60 + sm;
  let endTotal = eh * 60 + em;

  if (endTotal === startTotal) {
    return { valid: false, totalMinutes: 0, calculatedHours: 0, error: 'ZERO_DURATION' };
  }
  // Support overnight overtime shift (e.g., 20:00 to 02:00)
  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }

  const rawSpan = endTotal - startTotal;
  if (rawSpan > 16 * 60) {
    return { valid: false, totalMinutes: 0, calculatedHours: 0, error: 'EXCEEDS_MAX_SHIFT' };
  }

  const netMinutes = rawSpan - breakMinutes;
  if (netMinutes <= 0) {
    return { valid: false, totalMinutes: 0, calculatedHours: 0, error: 'BREAK_EXCEEDS_DURATION' };
  }

  const calculatedHours = roundCurrency(netMinutes / 60);
  return { valid: true, totalMinutes: netMinutes, calculatedHours };
}

/**
 * Adds hours (supports fractional hours like 1.5) to an HH:mm time string and wraps around 24h.
 */
export function addHoursToTime(timeStr: string, hoursToAdd: number): string {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const base = timeRegex.test(timeStr) ? timeStr : '08:00';
  const [h, m] = base.split(':').map(Number);
  const totalMins = (h * 60 + m + Math.round((Number(hoursToAdd) || 0) * 60) + 24 * 60) % (24 * 60);
  const nextH = Math.floor(totalMins / 60);
  const nextM = totalMins % 60;
  return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
}

/**
 * Resolves the worker's active shift ('day', 'night', or 'general'), office start time, and default end time
 * for a given date based on their configured shift pattern (day, night, weekly alternating rotation, or general).
 */
export function resolveWorkerShiftForDate(
  profile: Partial<WorkerProfile>,
  dateStr: string,
  approvedOtHours = 2
): {
  activeShift: 'day' | 'night' | 'general';
  officeStartTime: string;
  defaultEndTime: string;
  shiftLabelBn: string;
  shiftLabelEn: string;
} {
  const pattern = profile.shiftPattern || 'day';
  const dayStart =
    profile.dayShiftStartTime && /^([01]\d|2[0-3]):([0-5]\d)$/.test(profile.dayShiftStartTime)
      ? profile.dayShiftStartTime
      : '08:00';
  const nightStart =
    profile.nightShiftStartTime && /^([01]\d|2[0-3]):([0-5]\d)$/.test(profile.nightShiftStartTime)
      ? profile.nightShiftStartTime
      : '20:00';

  let activeShift: 'day' | 'night' | 'general' = 'day';
  if (pattern === 'night') {
    activeShift = 'night';
  } else if (pattern === 'general') {
    activeShift = 'general';
  } else if (pattern === 'weekly_rotation') {
    const refStr = profile.rotationStartDate || '2026-10-01';
    const refTime = new Date(`${refStr}T00:00:00Z`).getTime();
    const targetTime = new Date(`${dateStr}T00:00:00Z`).getTime();
    if (!Number.isNaN(refTime) && !Number.isNaN(targetTime)) {
      const diffDays = Math.floor((targetTime - refTime) / (24 * 60 * 60 * 1000));
      const weekIndex = Math.floor(Math.abs(diffDays) / 7);
      activeShift = weekIndex % 2 === 0 ? 'day' : 'night';
    }
  }

  const officeStartTime =
    activeShift === 'day' ? dayStart : activeShift === 'night' ? nightStart : '08:00';
  // Standard 9h factory span (8h duty + 1h break) + overtime hours, or direct overtime span
  const defaultEndTime = addHoursToTime(officeStartTime, 9 + Math.max(0, approvedOtHours));

  return {
    activeShift,
    officeStartTime,
    defaultEndTime,
    shiftLabelBn:
      activeShift === 'day'
        ? `নিয়মিত ডে শিফট (সকাল ${officeStartTime})`
        : activeShift === 'night'
        ? `নিয়মিত নাইট শিফট (রাত ${officeStartTime})`
        : `জেনারেল শিফট (সকাল ${officeStartTime})`,
    shiftLabelEn:
      activeShift === 'day'
        ? `Regular Day Shift (${officeStartTime})`
        : activeShift === 'night'
        ? `Regular Night Shift (${officeStartTime})`
        : `General Shift (${officeStartTime})`,
  };
}

export interface MissingDateEntry {
  date: string; // YYYY-MM-DD
  isAttendanceMissing: boolean;
  isOvertimeMissing: boolean;
  existingAttendanceStatus?: AttendanceStatus;
  existingOtHours?: number;
}

/**
 * Returns the real-time local date as YYYY-MM-DD (e.g., 2026-10-27).
 */
export function getTodayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the real-time current month as YYYY-MM (e.g., 2026-10).
 */
export function getCurrentMonthISO(todayISO: string = getTodayISO()): string {
  return todayISO.slice(0, 7);
}

/**
 * Checks if a target month (YYYY-MM) is an upcoming future month relative to currentMonthISO.
 */
export function isFutureMonth(
  monthISO: string,
  currentMonthISO: string = getCurrentMonthISO()
): boolean {
  return Boolean(monthISO && currentMonthISO && monthISO > currentMonthISO);
}

/**
 * Checks if a target date (YYYY-MM-DD) is a future date relative to todayISO.
 */
export function isFutureDate(
  dateISO: string,
  todayISO: string = getTodayISO()
): boolean {
  return Boolean(dateISO && todayISO && dateISO > todayISO);
}

/**
 * Shifts an ISO date string (YYYY-MM-DD) by offsetDays.
 */
export function shiftDateISO(dateStr: string, offsetDays: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves the appropriate default date for a selected month relative to todayISO.
 */
export function getDefaultDateForMonth(
  selectedMonth: string,
  todayISO: string = getTodayISO()
): string {
  const currentMonth = todayISO.slice(0, 7);
  if (selectedMonth === currentMonth) {
    return todayISO;
  }
  if (selectedMonth > currentMonth) {
    return `${selectedMonth}-01`;
  }
  // For past months, default to the 26th (or last day of month)
  const [y, m] = selectedMonth.split('-').map(Number);
  const lastDay = y && m ? new Date(y, m, 0).getDate() : 28;
  return `${selectedMonth}-${String(Math.min(26, lastDay)).padStart(2, '0')}`;
}

/**
 * Detects missing attendance or missing overtime dates in a target month.
 * Upcoming future months (targetMonth > currentMonth) return an empty list.
 * In the current running month, only dates up to today are checked.
 */
export function getMissingRecordsForMonth(
  targetMonth: string,
  attendanceList: AttendanceRecord[],
  overtimeList: OvertimeRecord[],
  joiningDate?: string,
  currentDateStr: string = getTodayISO()
): MissingDateEntry[] {
  const currentMonth = currentDateStr.slice(0, 7);
  // Upcoming months have not happened yet -> no missing records
  if (targetMonth > currentMonth) {
    return [];
  }

  const [yNum, mNum] = targetMonth.split('-').map(Number);
  const daysInTargetMonth = yNum && mNum ? new Date(yNum, mNum, 0).getDate() : 28;

  const todayDay = currentDateStr.startsWith(targetMonth)
    ? Math.min(daysInTargetMonth, Math.max(1, Number(currentDateStr.slice(8, 10)) || 26))
    : Math.min(daysInTargetMonth, 28);

  if (joiningDate && joiningDate.slice(0, 7) > targetMonth) {
    return [];
  }

  let startDay = 1;
  if (joiningDate && joiningDate.startsWith(targetMonth)) {
    const jDay = Number(joiningDate.slice(8, 10));
    if (jDay > todayDay) {
      return [];
    }
    if (jDay > 1 && jDay <= todayDay) {
      startDay = jDay;
    }
  }

  const missingList: MissingDateEntry[] = [];

  for (let day = startDay; day <= todayDay; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${targetMonth}-${dayStr}`;

    const att = attendanceList.find((a) => a.date === dateStr);
    const otEntries = overtimeList.filter((o) => o.date === dateStr);
    const totalOtHours = otEntries.reduce((s, o) => s + o.approvedHours, 0);

    const isAttendanceMissing = !att;
    const isOvertimeMissing =
      otEntries.length === 0 && (!att || att.status === 'present' || att.status === 'late');

    if (isAttendanceMissing || isOvertimeMissing) {
      missingList.push({
        date: dateStr,
        isAttendanceMissing,
        isOvertimeMissing,
        existingAttendanceStatus: att?.status,
        existingOtHours: totalOtHours,
      });
    }
  }

  return missingList;
}


/**
 * Returns the active hourly overtime rate for a worker profile (supports manual custom rate or formula rate).
 */
export function getEffectiveHourlyOtRate(profile: WorkerProfile): number {
  if (profile.otCalculationMode === 'manual' && Number(profile.otCustomHourlyRate) > 0) {
    return roundCurrency(Number(profile.otCustomHourlyRate));
  }
  const wageBaseAmount =
    profile.otWageBase === 'gross' ? profile.grossSalary : profile.basicSalary;
  if (wageBaseAmount > 0) {
    const divisor = profile.otDivisor > 0 ? profile.otDivisor : 208;
    const multiplier = profile.otMultiplier > 0 ? profile.otMultiplier : 2;
    return roundCurrency((wageBaseAmount / divisor) * multiplier);
  }
  if (Number(profile.otCustomHourlyRate) > 0) {
    return roundCurrency(Number(profile.otCustomHourlyRate));
  }
  return DEFAULT_RMG_HOURLY_OT_RATE;
}

/**
 * Calculates estimated overtime rate and earnings.
 * Under Bangladesh Labor Act 2006 Section 108:
 * Hourly OT Rate = (Basic Salary / 208) * 2, or a manual custom hourly rate if specified.
 */
export function calculateOvertimeEstimate(
  wageBaseAmount: number,
  divisor: number,
  multiplier: number,
  approvedHours: number,
  customHourlyRate?: number
): { hourlyRate: number; estimatedEarnings: number } {
  if (approvedHours <= 0) {
    const fallbackRate =
      customHourlyRate && customHourlyRate > 0
        ? roundCurrency(customHourlyRate)
        : wageBaseAmount > 0 && divisor > 0 && multiplier > 0
        ? roundCurrency((wageBaseAmount / divisor) * multiplier)
        : 0;
    return { hourlyRate: fallbackRate, estimatedEarnings: 0 };
  }

  if (customHourlyRate && customHourlyRate > 0) {
    const hourlyRate = roundCurrency(customHourlyRate);
    const estimatedEarnings = roundCurrency(hourlyRate * approvedHours);
    return { hourlyRate, estimatedEarnings };
  }

  if (wageBaseAmount <= 0 || divisor <= 0 || multiplier <= 0) {
    return { hourlyRate: 0, estimatedEarnings: 0 };
  }
  const hourlyRate = roundCurrency((wageBaseAmount / divisor) * multiplier);
  const estimatedEarnings = roundCurrency((wageBaseAmount / divisor) * multiplier * approvedHours);
  return { hourlyRate, estimatedEarnings };
}

/**
 * Checks whether an overtime entry for the same date already exists (excluding an optional edit ID).
 */
export function hasDuplicateOvertimeDate(
  records: OvertimeRecord[],
  date: string,
  excludeId?: string
): boolean {
  return records.some((r) => r.date === date && r.id !== excludeId);
}

/**
 * Summarizes overtime records for a given date/week/month/year.
 */
export function summarizeOvertimeRecords(records: OvertimeRecord[], targetMonth: string, targetDate?: string) {
  const targetYear = targetMonth.slice(0, 4);
  let dailyHours = 0;
  let dailyEarnings = 0;
  let weeklyHours = 0;
  let weeklyEarnings = 0;
  let monthlyHours = 0;
  let monthlyEarnings = 0;
  let yearlyHours = 0;
  let yearlyEarnings = 0;

  // Determine 7-day window ending at targetDate (or end of targetMonth)
  const refDateStr = targetDate || `${targetMonth}-28`;
  const refTime = new Date(`${refDateStr}T00:00:00Z`).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  for (const r of records) {
    if (r.date.startsWith(targetYear)) {
      yearlyHours = roundCurrency(yearlyHours + r.approvedHours);
      yearlyEarnings = roundCurrency(yearlyEarnings + r.estimatedEarnings);
    }
    if (r.month === targetMonth) {
      monthlyHours = roundCurrency(monthlyHours + r.approvedHours);
      monthlyEarnings = roundCurrency(monthlyEarnings + r.estimatedEarnings);
    }
    if (targetDate && r.date === targetDate) {
      dailyHours = roundCurrency(dailyHours + r.approvedHours);
      dailyEarnings = roundCurrency(dailyEarnings + r.estimatedEarnings);
    }
    const rTime = new Date(`${r.date}T00:00:00Z`).getTime();
    if (!Number.isNaN(refTime) && !Number.isNaN(rTime) && rTime <= refTime && refTime - rTime < sevenDaysMs) {
      weeklyHours = roundCurrency(weeklyHours + r.approvedHours);
      weeklyEarnings = roundCurrency(weeklyEarnings + r.estimatedEarnings);
    }
  }

  return {
    dailyHours,
    dailyEarnings,
    weeklyHours,
    weeklyEarnings,
    monthlyHours,
    monthlyEarnings,
    yearlyHours,
    yearlyEarnings,
  };
}

/**
 * Calculates monthly salary statement totals from component values.
 */
export function calculateSalaryTotals(components: {
  basicSalary: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
  attendanceBonus: number;
  overtimeEarnings: number;
  festivalBonus: number;
  otherAllowances: number;
  advanceDeduction: number;
  absenceDeduction: number;
  otherDeductions: number;
  adjustments: number;
}): {
  baseGross: number;
  estimatedGross: number;
  totalDeductions: number;
  estimatedNetPayable: number;
} {
  const baseGross = roundCurrency(
    (components.basicSalary || 0) +
      (components.houseRentAllowance || 0) +
      (components.medicalAllowance || 0) +
      (components.transportAllowance || 0) +
      (components.foodAllowance || 0)
  );

  const estimatedGross = roundCurrency(
    baseGross +
      (components.attendanceBonus || 0) +
      (components.overtimeEarnings || 0) +
      (components.festivalBonus || 0) +
      (components.otherAllowances || 0)
  );

  const totalDeductions = roundCurrency(
    (components.advanceDeduction || 0) +
      (components.absenceDeduction || 0) +
      (components.otherDeductions || 0)
  );

  const estimatedNetPayable = roundCurrency(
    estimatedGross - totalDeductions + (components.adjustments || 0)
  );

  return {
    baseGross,
    estimatedGross,
    totalDeductions,
    estimatedNetPayable,
  };
}

export function isOtherIncomePayment(payment: SalaryPayment): boolean {
  return Boolean(payment.referenceNote && payment.referenceNote.startsWith('[অন্যান্য আয়'));
}

export function parseOtherIncomeSource(referenceNote: string): {
  source: string;
  note: string;
} {
  if (!referenceNote || !referenceNote.startsWith('[অন্যান্য আয়')) {
    return { source: 'বেতন', note: referenceNote || '' };
  }
  const match = referenceNote.match(/^\[অন্যান্য আয়:\s*([^\]]+)\]\s*(.*)$/);
  if (match) {
    return {
      source: match[1].trim() || 'অন্যান্য সোর্স',
      note: match[2].trim(),
    };
  }
  return {
    source: 'অন্যান্য সোর্স',
    note: referenceNote.replace(/^\[অন্যান্য আয়\]\s*/, '').trim(),
  };
}

/**
 * Summarizes actual payments received for a given month and compares against estimated net payable.
 */
export function summarizeMonthlyPayments(
  estimatedNetPayable: number,
  paymentsForMonth: SalaryPayment[]
): {
  totalReceived: number;
  outstandingBalance: number;
  overpaidAmount: number;
  status: 'paid' | 'partial' | 'unpaid';
} {
  const salaryOnlyPayments = paymentsForMonth.filter((p) => !isOtherIncomePayment(p));
  const totalReceived = roundCurrency(
    salaryOnlyPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0)
  );
  const diff = roundCurrency(estimatedNetPayable - totalReceived);
  const outstandingBalance = diff > 0 ? diff : 0;
  const overpaidAmount = diff < 0 ? Math.abs(diff) : 0;

  let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
  if (totalReceived <= 0) {
    status = 'unpaid';
  } else if (outstandingBalance === 0 && estimatedNetPayable > 0) {
    status = 'paid';
  } else {
    status = 'partial';
  }

  return {
    totalReceived,
    outstandingBalance,
    overpaidAmount,
    status,
  };
}

/**
 * Summarizes monthly attendance and leave records without applying automatic unverified deductions.
 */
export function summarizeAttendanceForMonth(recordsForMonth: AttendanceRecord[]) {
  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  let weeklyHolidays = 0;
  let publicHolidays = 0;
  let approvedLeaveDays = 0;

  const leaveBreakdown = {
    casual: 0,
    sick: 0,
    earned: 0,
    maternity: 0,
    festival: 0,
    unpaid: 0,
  };

  for (const r of recordsForMonth) {
    if (r.status === 'present') presentDays++;
    else if (r.status === 'late') lateDays++;
    else if (r.status === 'absent') absentDays++;
    else if (r.status === 'weekly_holiday') weeklyHolidays++;
    else if (r.status === 'public_holiday') publicHolidays++;
    else if (r.status === 'approved_leave') {
      approvedLeaveDays++;
      if (r.leaveCategory !== 'none' && r.leaveCategory in leaveBreakdown) {
        leaveBreakdown[r.leaveCategory as keyof typeof leaveBreakdown]++;
      }
    }
  }

  // Standard Bangladesh Labor Act 2006 annual leave entitlements: Casual 10 days, Sick 14 days
  return {
    presentDays,
    lateDays,
    workingDays: presentDays + lateDays,
    absentDays,
    weeklyHolidays,
    publicHolidays,
    approvedLeaveDays,
    leaveBreakdown,
    casualLeaveRemaining: Math.max(0, 10 - leaveBreakdown.casual),
    sickLeaveRemaining: Math.max(0, 14 - leaveBreakdown.sick),
  };
}

/**
 * Summarizes personal expenses and savings vs actual recorded income.
 */
export function summarizePersonalFinances(
  paymentsForMonth: SalaryPayment[],
  expensesForMonth: ExpenseRecord[],
  savingsGoals: SavingsGoal[]
) {
  const salaryIncome = roundCurrency(
    paymentsForMonth
      .filter((p) => !isOtherIncomePayment(p))
      .reduce((acc, p) => acc + (Number(p.amountReceived) || 0), 0)
  );
  const otherIncome = roundCurrency(
    paymentsForMonth
      .filter((p) => isOtherIncomePayment(p))
      .reduce((acc, p) => acc + (Number(p.amountReceived) || 0), 0)
  );
  const actualIncome = roundCurrency(salaryIncome + otherIncome);
  const totalExpenses = roundCurrency(
    expensesForMonth.reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
  );
  const remainingBalance = roundCurrency(actualIncome - totalExpenses);

  const byCategory: Record<ExpenseCategory, number> = {
    food: 0,
    rent: 0,
    transport: 0,
    family: 0,
    medical: 0,
    education: 0,
    other: 0,
  };

  for (const e of expensesForMonth) {
    if (e.category in byCategory) {
      byCategory[e.category] = roundCurrency(byCategory[e.category] + (Number(e.amount) || 0));
    }
  }

  const rentAndBillsTotal = byCategory.rent;
  const bazarTotal = byCategory.food;
  const otherExpensesTotal = roundCurrency(
    byCategory.transport +
      byCategory.family +
      byCategory.medical +
      byCategory.education +
      byCategory.other
  );

  const totalSaved = roundCurrency(
    savingsGoals.reduce((acc, g) => acc + (Number(g.savedAmount) || 0), 0)
  );
  const totalSavingsTarget = roundCurrency(
    savingsGoals.reduce((acc, g) => acc + (Number(g.targetAmount) || 0), 0)
  );
  const totalMonthlyBudget = roundCurrency(
    savingsGoals.reduce((acc, g) => acc + (Number(g.monthlyBudget) || 0), 0)
  );

  return {
    salaryIncome,
    otherIncome,
    actualIncome,
    totalExpenses,
    remainingBalance,
    byCategory,
    rentAndBillsTotal,
    bazarTotal,
    otherExpensesTotal,
    totalSaved,
    totalSavingsTarget,
    totalMonthlyBudget,
  };
}

/**
 * Validates file uploads for the private Document Vault.
 */
export function validateVaultFile(fileName: string, fileType: string, fileSize: number): {
  valid: boolean;
  error?: string;
} {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!fileName || fileName.trim().length === 0 || fileName.length > 150) {
    return { valid: false, error: 'INVALID_FILENAME' };
  }
  if (!allowedTypes.includes(fileType)) {
    return { valid: false, error: 'UNSUPPORTED_FILE_TYPE' };
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 512 * 1024) {
    return { valid: false, error: 'FILE_TOO_LARGE' };
  }
  return { valid: true };
}

/**
 * Deterministic Bengali & English voice/text parser so speech entry works reliably
/**
 * Deterministic Bengali & English voice/text parser so speech entry works reliably
 * even offline or without external AI latency. Automatically detects entry type AND date.
 */
export function parseBengaliVoiceEntryLocal(
  rawTranscript: string,
  defaultDate: string = getTodayISO()
): ProposedVoiceEntry {
  const text = rawTranscript.trim();
  const normalized = toEnglishDigits(text).toLowerCase();

  // 1. Detect relative or explicit date from voice command
  let resolvedDate = defaultDate;
  let cleanedForNum = normalized;

  // Check explicit day-of-month like "25 তারিখ" or "20 তারিখে"
  const explicitDayMatch = normalized.match(/(\d{1,2})\s*তারিখ/);
  if (explicitDayMatch) {
    const dayVal = Number(explicitDayMatch[1]);
    if (dayVal >= 1 && dayVal <= 31) {
      const candidate = `${defaultDate.slice(0, 7)}-${String(dayVal).padStart(2, '0')}`;
      resolvedDate = candidate > defaultDate ? defaultDate : candidate;
      cleanedForNum = cleanedForNum.replace(explicitDayMatch[0], ' ');
    }
  } else if (
    normalized.includes('গতকাল') ||
    normalized.includes('কালকে') ||
    normalized.includes('yesterday')
  ) {
    resolvedDate = shiftDateISO(defaultDate, -1);
  } else if (normalized.includes('পরশু')) {
    resolvedDate = shiftDateISO(defaultDate, -2);
  } else if (normalized.includes('আজ') || normalized.includes('today')) {
    resolvedDate = defaultDate;
  }

  // Extract first number after removing date prefix (supports decimals like 2.5)
  const numMatch = cleanedForNum.match(/(\d+(?:\.\d+)?)/);
  const extractedNum = numMatch ? Number(numMatch[1]) : 0;

  // 2. Detect Overtime
  if (
    normalized.includes('ওভারটাইম') ||
    normalized.includes('ওটি') ||
    normalized.includes('overtime') ||
    normalized.includes('ঘণ্টা') ||
    normalized.includes('ঘন্টা') ||
    normalized.includes('hour')
  ) {
    const hours = extractedNum > 0 && extractedNum <= 16 ? extractedNum : 2;
    return {
      entryType: 'overtime',
      date: resolvedDate,
      amountOrHours: hours,
      categoryOrStatus: 'approved',
      notes: text || `${toBengaliDigits(hours)} ঘণ্টা ওভারটাইম`,
      rawTranscript: text,
    };
  }

  // 3. Detect Salary Payment received
  if (
    normalized.includes('বেতন পেয়েছি') ||
    normalized.includes('বেতন পেয়েছি') ||
    normalized.includes('বেতন জমা') ||
    normalized.includes('বিকাশ') ||
    normalized.includes('নগদ') ||
    normalized.includes('salary received') ||
    normalized.includes('payment')
  ) {
    let method: string = 'cash';
    if (normalized.includes('বিকাশ') || normalized.includes('bkash')) method = 'bkash';
    else if (normalized.includes('নগদ') || normalized.includes('nagad')) method = 'nagad';
    else if (normalized.includes('রকেট') || normalized.includes('rocket')) method = 'rocket';
    else if (normalized.includes('ব্যাংক') || normalized.includes('bank')) method = 'bank';

    return {
      entryType: 'payment',
      date: resolvedDate,
      amountOrHours: extractedNum > 0 ? extractedNum : 12500,
      categoryOrStatus: method,
      notes: text,
      rawTranscript: text,
    };
  }

  // 4. Detect Attendance
  if (
    normalized.includes('হাজিরা') ||
    normalized.includes('উপস্থিত') ||
    normalized.includes('অনুপস্থিত') ||
    normalized.includes('দেরি') ||
    normalized.includes('ছুটি') ||
    normalized.includes('present') ||
    normalized.includes('absent')
  ) {
    let status = 'present';
    if (normalized.includes('অনুপস্থিত') || normalized.includes('absent')) status = 'absent';
    else if (normalized.includes('দেরি') || normalized.includes('late')) status = 'late';
    else if (normalized.includes('সরকারি ছুটি')) status = 'public_holiday';
    else if (normalized.includes('শুক্রবার')) status = 'weekly_holiday';
    else if (normalized.includes('ছুটি') || normalized.includes('leave')) status = 'approved_leave';
    return {
      entryType: 'attendance',
      date: resolvedDate,
      amountOrHours: 1,
      categoryOrStatus: status,
      notes: text,
      rawTranscript: text,
    };
  }

  // 5. Detect Reminder
  if (
    normalized.includes('রিমাইন্ডার') ||
    normalized.includes('মনে করিয়ে') ||
    normalized.includes('মনে করিয়ে') ||
    normalized.includes('reminder')
  ) {
    return {
      entryType: 'reminder',
      date: resolvedDate,
      amountOrHours: 0,
      categoryOrStatus: 'salary_date',
      notes: text,
      rawTranscript: text,
    };
  }

  // 6. Default to Expense
  let category: ExpenseCategory = 'other';
  if (
    normalized.includes('খাবার') ||
    normalized.includes('বাজার') ||
    normalized.includes('চাল') ||
    normalized.includes('সবজি') ||
    normalized.includes('food')
  ) {
    category = 'food';
  } else if (
    normalized.includes('বাসা ভাড়া') ||
    normalized.includes('বাসা ভাড়া') ||
    normalized.includes('ঘর ভাড়া') ||
    normalized.includes('ঘর ভাড়া') ||
    normalized.includes('বিদ্যুৎ') ||
    normalized.includes('কারেন্ট') ||
    normalized.includes('গ্যাস') ||
    normalized.includes('পানি') ||
    normalized.includes('rent')
  ) {
    category = 'rent';
  } else if (
    normalized.includes('গাড়ি') ||
    normalized.includes('গাড়ি') ||
    normalized.includes('রিকশা') ||
    normalized.includes('ভাড়া') ||
    normalized.includes('ভাড়া') ||
    normalized.includes('transport')
  ) {
    category = 'transport';
  } else if (
    normalized.includes('ওষুধ') ||
    normalized.includes('ডাক্তার') ||
    normalized.includes('চিকিৎসা') ||
    normalized.includes('medical')
  ) {
    category = 'medical';
  } else if (
    normalized.includes('বাড়ি') ||
    normalized.includes('বাড়ি') ||
    normalized.includes('পরিবার') ||
    normalized.includes('family')
  ) {
    category = 'family';
  } else if (
    normalized.includes('স্কুল') ||
    normalized.includes('পড়াশোনা') ||
    normalized.includes('পড়াশোনা') ||
    normalized.includes('education')
  ) {
    category = 'education';
  }

  let resolvedExpenseAmount = extractedNum > 0 ? extractedNum : 100;
  let resolvedExpenseNotes = text;

  if (category === 'rent') {
    const savedRule = getSavedRentRuleConfig();
    const isHouseRentCommand =
      normalized.includes('বাসা ভাড়া') ||
      normalized.includes('বাসা ভাড়া') ||
      normalized.includes('ঘর ভাড়া') ||
      normalized.includes('ঘর ভাড়া') ||
      normalized.includes('house rent');
    if (isHouseRentCommand && extractedNum <= 0 && savedRule.fixedBaseRent > 0) {
      resolvedExpenseAmount = savedRule.fixedBaseRent;
    }
    if (isHouseRentCommand && !text.startsWith('[বাসা ভাড়া]')) {
      const ruleBadges: string[] = [];
      if (savedRule.electricityAttachedToRent) ruleBadges.push('কারেন্ট বিল যুক্ত');
      if (savedRule.gasMode === 'attached') ruleBadges.push('গ্যাস লাইন যুক্ত');
      const badgeSuffix = ruleBadges.length > 0 ? ` (${ruleBadges.join(', ')})` : '';
      resolvedExpenseNotes = `[বাসা ভাড়া] ${text || 'মাসিক বাসা ভাড়া পরিশোধ'}${badgeSuffix}`;
    }
  }

  return {
    entryType: 'expense',
    date: resolvedDate,
    amountOrHours: resolvedExpenseAmount,
    categoryOrStatus: category,
    notes: resolvedExpenseNotes,
    rawTranscript: text,
  };
}


/**
 * Non-destructively merges imported backup records with existing records.
 * Never overwrites or deletes existing records with matching IDs.
 */
export function mergeBackupRecordsNonDestructive<T extends { id: string }>(
  existingRecords: T[],
  importedRecords: T[]
): { merged: T[]; addedCount: number; skippedCount: number } {
  const existingIds = new Set(existingRecords.map((r) => r.id));
  const merged = [...existingRecords];
  let addedCount = 0;
  let skippedCount = 0;

  for (const item of importedRecords) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) {
      skippedCount++;
      continue;
    }
    if (existingIds.has(item.id)) {
      skippedCount++;
    } else {
      merged.push(item);
      existingIds.add(item.id);
      addedCount++;
    }
  }

  return { merged, addedCount, skippedCount };
}

export interface BackupBundle {
  version: number;
  exportedAt: string;
  profile?: WorkerProfile;
  overtime: OvertimeRecord[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
  attendance: AttendanceRecord[];
  expenses: ExpenseRecord[];
  savings: SavingsGoal[];
  documents: VaultDocument[];
  reminders: ReminderItem[];
  loans?: PersonalLoan[];
  editHistory?: EditHistoryEntry[];
}

export function getPreviousMonth(month: string): string {
  const [yStr, mStr] = month.split('-');
  const y = Number(yStr) || 2026;
  const m = Number(mStr) || 1;
  if (m <= 1) {
    return `${y - 1}-12`;
  }
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export interface SmartSalaryComparisonResult {
  netDiff: number;
  netDiffPercent: number;
  otHoursDiff: number;
  otEarningsDiff: number;
  attendanceBonusSafe: boolean;
  attendanceBonusEligible: boolean;
  insightBn: string;
  insightEn: string;
  insightsBn: string[];
  insightsEn: string[];
}

export function calculateSmartSalaryComparison(params: {
  currentMonthNet: number;
  previousMonthNet: number;
  currentOtHours: number;
  previousOtHours: number;
  currentOtEarnings: number;
  previousOtEarnings: number;
  absentDays: number;
  lateDays: number;
  attendanceBonusAmount: number;
}): SmartSalaryComparisonResult {
  const prevNet = Math.max(0, Number(params.previousMonthNet) || 0);
  const currNet = Math.max(0, Number(params.currentMonthNet) || 0);
  const netDiff = roundCurrency(prevNet > 0 ? currNet - prevNet : 0);
  const netDiffPercent =
    prevNet > 0 ? Math.round(((currNet - prevNet) / prevNet) * 1000) / 10 : 0;

  const otHoursDiff = roundCurrency(
    (Number(params.currentOtHours) || 0) - (Number(params.previousOtHours) || 0)
  );
  const otEarningsDiff = roundCurrency(
    (Number(params.currentOtEarnings) || 0) - (Number(params.previousOtEarnings) || 0)
  );

  const attendanceBonusSafe =
    (Number(params.absentDays) || 0) === 0 && (Number(params.lateDays) || 0) < 3;

  const insightsBn: string[] = [];
  const insightsEn: string[] = [];

  if (prevNet > 0) {
    if (netDiff > 0) {
      insightsBn.push(
        `গত মাসের তুলনায় এই মাসে আপনার সম্ভাব্য বেতন ${formatBDT(netDiff, 'bn')} (+${toBengaliDigits(netDiffPercent)}%) বেশি`
      );
      insightsEn.push(
        `Expected net salary is higher by ${formatBDT(netDiff, 'en')} (+${netDiffPercent}%) vs last month`
      );
    } else if (netDiff < 0) {
      insightsBn.push(
        `গত মাসের তুলনায় এই মাসে সম্ভাব্য বেতন ${formatBDT(Math.abs(netDiff), 'bn')} কম`
      );
      insightsEn.push(
        `Expected net salary is ${formatBDT(Math.abs(netDiff), 'en')} lower than last month`
      );
    } else {
      insightsBn.push('গত মাসের এবং এই মাসের সম্ভাব্য নিট বেতন সমান পর্যায়ে রয়েছে');
      insightsEn.push('Expected net salary matches last month');
    }
  }

  if (attendanceBonusSafe) {
    insightsBn.push(
      `পূর্ণ হাজিরা বোনাস (${formatBDT(params.attendanceBonusAmount, 'bn')}) পাওয়ার যোগ্য!`
    );
    insightsEn.push(
      `Eligible for full Attendance Bonus (${formatBDT(params.attendanceBonusAmount, 'en')})!`
    );
  } else {
    insightsBn.push(
      `অনুপস্থিতি (${toBengaliDigits(params.absentDays)} দিন) বা দেরি (${toBengaliDigits(params.lateDays)} দিন) থাকায় হাজিরা বোনাস ঝুঁকিতে রয়েছে।`
    );
    insightsEn.push(
      `Attendance bonus at risk due to ${params.absentDays} absent / ${params.lateDays} late day(s).`
    );
  }

  return {
    netDiff,
    netDiffPercent,
    otHoursDiff,
    otEarningsDiff,
    attendanceBonusSafe,
    attendanceBonusEligible: attendanceBonusSafe,
    insightBn: insightsBn.join(' — '),
    insightEn: insightsEn.join(' — '),
    insightsBn,
    insightsEn,
  };
}

export interface BudgetAlertSummary {
  monthlyBudget: number;
  totalExpenses: number;
  remainingBudget: number;
  exceededBy: number;
  usagePercent: number;
  status: 'safe' | 'warning' | 'exceeded';
  alertLevel: 'safe' | 'warning' | 'exceeded';
  messageBn: string;
  messageEn: string;
}

export function evaluateBudgetAlert(
  totalExpenses: number,
  monthlyBudget: number
): BudgetAlertSummary {
  const safeBudget = monthlyBudget > 0 ? monthlyBudget : 9000;
  const safeExp = Math.max(0, totalExpenses);
  const remainingBudget = roundCurrency(safeBudget - safeExp);
  const exceededBy = roundCurrency(Math.max(0, safeExp - safeBudget));
  const usagePercent = Math.min(999, Math.round((safeExp / safeBudget) * 100));

  if (usagePercent >= 100) {
    return {
      monthlyBudget: safeBudget,
      totalExpenses: safeExp,
      remainingBudget,
      exceededBy,
      usagePercent,
      status: 'exceeded',
      alertLevel: 'exceeded',
      messageBn: `সতর্কতা: আপনার মাসিক বাজেট সীমা (${formatBDT(safeBudget, 'bn')}) অতিক্রম করেছে! অতিরিক্ত খরচ: ${formatBDT(exceededBy, 'bn')}`,
      messageEn: `Alert: Monthly budget (${formatBDT(safeBudget, 'en')}) exceeded by ${formatBDT(exceededBy, 'en')}!`,
    };
  }

  if (usagePercent >= 80) {
    return {
      monthlyBudget: safeBudget,
      totalExpenses: safeExp,
      remainingBudget,
      exceededBy: 0,
      usagePercent,
      status: 'warning',
      alertLevel: 'warning',
      messageBn: `সতর্কতা: মাসিক বাজেটের ${toBengaliDigits(usagePercent)}% খরচ হয়ে গেছে। বাকি বাজেট মাত্র ${formatBDT(remainingBudget, 'bn')}।`,
      messageEn: `Heads up: ${usagePercent}% of your monthly budget is used. Remaining: ${formatBDT(remainingBudget, 'en')}.`,
    };
  }

  return {
    monthlyBudget: safeBudget,
    totalExpenses: safeExp,
    remainingBudget,
    exceededBy: 0,
    usagePercent,
    status: 'safe',
    alertLevel: 'safe',
    messageBn: `আপনার খরচ বাজেটের নিয়ন্ত্রণে আছে (${toBengaliDigits(usagePercent)}% ব্যবহৃত, হাতে বাজেট বাকি ${formatBDT(remainingBudget, 'bn')})।`,
    messageEn: `Expenses are within budget (${usagePercent}% used, ${formatBDT(remainingBudget, 'en')} remaining).`,
  };
}

export function summarizePersonalLoans(loans: PersonalLoan[]) {
  let totalBorrowed = 0;
  let totalPaid = 0;
  let monthlyInstallmentTotal = 0;
  let activeLoansCount = 0;

  for (const loan of loans) {
    const borrowed = Math.max(0, Number(loan.totalLoanAmount) || 0);
    const paid = Math.min(borrowed, Math.max(0, Number(loan.paidAmount) || 0));
    totalBorrowed += borrowed;
    totalPaid += paid;
    if (borrowed > paid) {
      activeLoansCount++;
      monthlyInstallmentTotal += Math.max(0, Number(loan.monthlyInstallment) || 0);
    }
  }

  const totalRemaining = roundCurrency(Math.max(0, totalBorrowed - totalPaid));
  return {
    totalBorrowed: roundCurrency(totalBorrowed),
    totalPaid: roundCurrency(totalPaid),
    totalRemaining,
    monthlyInstallmentTotal: roundCurrency(monthlyInstallmentTotal),
    activeLoansCount,
  };
}

export const DUTY_SHIFTS: Array<{
  id: DutyShiftType;
  labelBn: string;
  labelEn: string;
  startTime: string;
  endTime: string;
  checkIn: string;
  checkOut: string;
  gateReminderTime: string;
  gateReminderBn: string;
}> = [
  {
    id: 'shift_a',
    labelBn: 'সকাল শিফট A (৬টা - ২টা)',
    labelEn: 'Morning Shift A (06:00 - 14:00)',
    startTime: '06:00',
    endTime: '14:00',
    checkIn: '06:00',
    checkOut: '14:00',
    gateReminderTime: '05:45',
    gateReminderBn: 'সকাল ৫:৪৫ মিনিটের মধ্যে ফ্যাক্টরি গেটে পাঞ্চ করুন',
  },
  {
    id: 'general',
    labelBn: 'জেনারেল শিফট (৮টা - ৫টা)',
    labelEn: 'General Shift (08:00 - 17:00)',
    startTime: '08:00',
    endTime: '17:00',
    checkIn: '08:00',
    checkOut: '17:00',
    gateReminderTime: '07:45',
    gateReminderBn: 'সকাল ৭:৪৫ মিনিটের মধ্যে ফ্যাক্টরি গেটে প্রবেশ করুন',
  },
  {
    id: 'shift_b',
    labelBn: 'দুপুর শিফট B (২টা - ১০টা)',
    labelEn: 'Afternoon Shift B (14:00 - 22:00)',
    startTime: '14:00',
    endTime: '22:00',
    checkIn: '14:00',
    checkOut: '22:00',
    gateReminderTime: '13:45',
    gateReminderBn: 'দুপুর ১:৪৫ মিনিটের মধ্যে লাইনে উপস্থিত থাকুন',
  },
  {
    id: 'shift_c',
    labelBn: 'রাত শিফট C (১০টা - ৬টা)',
    labelEn: 'Night Shift C (22:00 - 06:00)',
    startTime: '22:00',
    endTime: '06:00',
    checkIn: '22:00',
    checkOut: '06:00',
    gateReminderTime: '21:45',
    gateReminderBn: 'রাত ৯:৪৫ মিনিটের মধ্যে নাইট শিফটে রিপোর্ট করুন',
  },
];

export const VERIFIED_WORKER_HELPLINES = [
  {
    id: 'dife',
    numberBn: '১৬৩৫৭',
    numberEn: '16357',
    numberRaw: '16357',
    nameBn: 'শ্রমিক হেল্পলাইন (কলকারখানা পরিদর্শন অধিদপ্তর - DIFE)',
    nameEn: 'Ministry of Labour / DIFE Toll-Free Helpline',
    titleBn: 'শ্রমিক হেল্পলাইন (কলকারখানা পরিদর্শন অধিদপ্তর - DIFE)',
    titleEn: 'Ministry of Labour / DIFE Toll-Free Helpline',
    descBn: 'বকেয়া বেতন, ওভারটাইম বঞ্চনা, ছুটি বা কর্মক্ষেত্রে নিরাপত্তার অভিযোগের সরকারি টোল-ফ্রি নম্বর',
    descEn: 'Official toll-free government helpline for wage disputes, overtime & workplace safety',
  },
  {
    id: 'emergency_999',
    numberBn: '৯৯৯',
    numberEn: '999',
    numberRaw: '999',
    nameBn: 'জাতীয় জরুরি সেবা (পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স)',
    nameEn: 'National Emergency Service (Police, Fire & Ambulance)',
    titleBn: 'জাতীয় জরুরি সেবা (পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স)',
    titleEn: 'National Emergency Service (Police, Fire & Ambulance)',
    descBn: 'যেকোনো জরুরি দুর্ঘটনা, আগুন বা তাৎক্ষণিক বিপদে ২৪ ঘণ্টা বিনামূল্যে কল করুন',
    descEn: '24/7 toll-free national emergency response',
  },
  {
    id: 'women_109',
    numberBn: '১০৯',
    numberEn: '109',
    numberRaw: '109',
    nameBn: 'নারী ও শিশু নির্যাতন প্রতিরোধ হেল্পলাইন',
    nameEn: 'Women & Child Protection Helpline',
    titleBn: 'নারী ও শিশু নির্যাতন প্রতিরোধ হেল্পলাইন',
    titleEn: 'Women & Child Protection Helpline',
    descBn: 'নারী শ্রমিকদের যেকোনো হয়রানি বা সহিংসতা প্রতিরোধে ২৪ ঘণ্টা সরকারি সহায়তা',
    descEn: '24/7 helpline for harassment protection and support for women workers',
  },
  {
    id: 'legal_16430',
    numberBn: '১৬৪৩০',
    numberEn: '16430',
    numberRaw: '16430',
    nameBn: 'জাতীয় আইনগত সহায়তা সংস্থা (বিনামূল্যে আইনি পরামর্শ)',
    nameEn: 'National Legal Aid Services Helpline',
    titleBn: 'জাতীয় আইনগত সহায়তা সংস্থা (বিনামূল্যে আইনি পরামর্শ)',
    titleEn: 'National Legal Aid Services Helpline',
    descBn: 'শ্রমিকদের শ্রম আদালত ও আইনি অধিকার বিষয়ে সরকারি বিনামূল্যে পরামর্শ',
    descEn: 'Free government legal aid and labor law consultation',
  },
];

export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  const eng = toEnglishDigits(raw.trim());
  return eng.replace(/[^\d+]/g, '');
}

const KNOWN_BD_HOTLINES = new Set(['999', '109', '16107', '16430', '333', '1090', '106']);

export function isValidBangladeshiPhone(raw: string): boolean {
  const normalized = normalizePhoneNumber(raw);
  if (!normalized) return false;
  // Known national emergency hotlines
  if (KNOWN_BD_HOTLINES.has(normalized)) return true;
  // Mobile numbers: 01XXXXXXXXX (11 digits), +8801XXXXXXXXX (14 chars), 8801XXXXXXXXX (13 digits)
  // Operators in BD: 013, 014, 015, 016, 017, 018, 019
  return /^(?:\+?880|0)?1[3-9]\d{8}$/.test(normalized);
}

export function formatPhoneForCall(raw: string): string {
  const normalized = normalizePhoneNumber(raw);
  return `tel:${normalized}`;
}

export function formatWhatsAppUrl(raw: string, message?: string): string {
  const normalized = normalizePhoneNumber(raw);
  // Extract pure digits
  const digits = normalized.replace(/\D/g, '');
  let waNumber = '';
  if (digits.startsWith('01') && digits.length === 11) {
    waNumber = `88${digits}`;
  } else if (digits.startsWith('8801') && digits.length === 13) {
    waNumber = digits;
  } else if (digits.length >= 10) {
    waNumber = digits;
  }
  if (!waNumber) return '';
  const base = `https://wa.me/${waNumber}`;
  if (message) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }
  return base;
}

export const WORKER_CONTACT_CATEGORIES: {
  id: WorkerContactCategory;
  labelBn: string;
  labelEn: string;
  color: string;
  iconName: string;
}[] = [
  {
    id: 'supervisor',
    labelBn: 'সুপারভাইজার',
    labelEn: 'Supervisor',
    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    iconName: 'UserCheck',
  },
  {
    id: 'line_chief',
    labelBn: 'লাইন চিফ',
    labelEn: 'Line Chief',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
    iconName: 'Shield',
  },
  {
    id: 'production_manager',
    labelBn: 'পিএম / ম্যানেজার',
    labelEn: 'Production Manager',
    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
    iconName: 'Briefcase',
  },
  {
    id: 'hr_admin',
    labelBn: 'এইচআর ও এডমিন',
    labelEn: 'HR & Admin',
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    iconName: 'Building',
  },
  {
    id: 'security',
    labelBn: 'নিরাপত্তা ও গেট',
    labelEn: 'Security & Gate',
    color: 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-800/40 dark:text-stone-300 dark:border-stone-700',
    iconName: 'Lock',
  },
  {
    id: 'coworker',
    labelBn: 'সহকর্মী ও বন্ধু',
    labelEn: 'Coworker & Friend',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    iconName: 'Users',
  },
  {
    id: 'emergency',
    labelBn: 'জরুরি যোগাযোগ',
    labelEn: 'Emergency',
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
    iconName: 'AlertCircle',
  },
  {
    id: 'other',
    labelBn: 'অন্যান্য',
    labelEn: 'Other',
    color: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700',
    iconName: 'Phone',
  },
  {
    id: 'google',
    labelBn: 'ফ্রম গুগল',
    labelEn: 'From Google',
    color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    iconName: 'Globe',
  },
];

export function getContactCategoryLabel(category: WorkerContactCategory, lang: Language = 'bn'): string {
  const item = WORKER_CONTACT_CATEGORIES.find((c) => c.id === category);
  if (!item) return category;
  return lang === 'bn' ? item.labelBn : item.labelEn;
}

/**
 * Personal Loan & Debt Tracker Helper Calculations
 */
export function getLoanOriginalAmount(loan: PersonalLoan): number {
  return roundCurrency(loan.originalAmount ?? loan.totalLoanAmount ?? 0);
}

export function getLoanRepaymentsTotal(loan: PersonalLoan): number {
  if (Array.isArray(loan.repayments) && loan.repayments.length > 0) {
    const sum = loan.repayments.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return roundCurrency(sum);
  }
  return roundCurrency(loan.paidAmount ?? 0);
}

export function getLoanRemainingBalance(loan: PersonalLoan): number {
  const original = getLoanOriginalAmount(loan);
  const repaid = getLoanRepaymentsTotal(loan);
  return Math.max(0, roundCurrency(original - repaid));
}

export function getLoanDirection(loan: PersonalLoan): 'lent' | 'borrowed' {
  return loan.direction || 'borrowed';
}

export function getLoanPersonName(loan: PersonalLoan): string {
  return loan.personName || loan.title || 'অনির্দিষ্ট ব্যক্তি';
}

export function getLoanStatusKey(loan: PersonalLoan, todayISO: string = getTodayISO()): 'pending' | 'partially_repaid' | 'fully_settled' | 'due_today' | 'overdue' | 'archived' {
  const balance = getLoanRemainingBalance(loan);
  if (balance <= 0 || loan.status === 'fully_settled') {
    return 'fully_settled';
  }
  if (loan.status === 'archived') {
    return 'archived';
  }
  const dueDate = loan.expectedRepaymentDate || loan.nextDueDate;
  if (dueDate) {
    if (dueDate === todayISO) return 'due_today';
    if (dueDate < todayISO) return 'overdue';
  }
  const repaid = getLoanRepaymentsTotal(loan);
  if (repaid > 0) return 'partially_repaid';
  return 'pending';
}

export interface LoanSummaryMetrics {
  totalToReceive: number; // আমি পাব (Outstanding lent)
  totalToRepay: number; // আমি দেব (Outstanding borrowed)
  receivedThisMonth: number; // এই মাসে পেয়েছি
  paidThisMonth: number; // এই মাসে দিয়েছি
  monthlyReceived: number; // Alias for receivedThisMonth
  monthlyPaid: number; // Alias for paidThisMonth
  lentActiveCount: number;
  borrowedActiveCount: number;
  overdueCount: number;
  dueTodayCount: number;
}

export function summarizeAllPersonalLoans(
  loans: PersonalLoan[],
  todayISO: string = getTodayISO()
): LoanSummaryMetrics {
  let totalToReceive = 0;
  let totalToRepay = 0;
  let receivedThisMonth = 0;
  let paidThisMonth = 0;
  let lentActiveCount = 0;
  let borrowedActiveCount = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;

  const currentMonthISO = todayISO.slice(0, 7);

  for (const loan of loans) {
    const dir = getLoanDirection(loan);
    const balance = getLoanRemainingBalance(loan);
    const status = getLoanStatusKey(loan, todayISO);

    if (status === 'overdue') overdueCount++;
    if (status === 'due_today') dueTodayCount++;

    if (!loan.isArchived && balance > 0) {
      if (dir === 'lent') {
        totalToReceive += balance;
        lentActiveCount++;
      } else {
        totalToRepay += balance;
        borrowedActiveCount++;
      }
    }

    // Monthly repayments
    if (Array.isArray(loan.repayments)) {
      for (const rep of loan.repayments) {
        const pDate = rep.repaymentDate || rep.paymentDate;
        if (pDate && pDate.startsWith(currentMonthISO)) {
          if (rep.direction === 'received' || dir === 'lent') {
            receivedThisMonth += Number(rep.amount) || 0;
          } else {
            paidThisMonth += Number(rep.amount) || 0;
          }
        }
      }
    }
  }

  return {
    totalToReceive: roundCurrency(totalToReceive),
    totalToRepay: roundCurrency(totalToRepay),
    receivedThisMonth: roundCurrency(receivedThisMonth),
    paidThisMonth: roundCurrency(paidThisMonth),
    monthlyReceived: roundCurrency(receivedThisMonth),
    monthlyPaid: roundCurrency(paidThisMonth),
    lentActiveCount,
    borrowedActiveCount,
    overdueCount,
    dueTodayCount,
  };
}

/**
 * Determines whether today's / selected date's quick entry (attendance + out-time/overtime)
 * has already been completed on the Home dashboard.
 */
export function isDailyQuickEntryCompleted(params: {
  attendanceRecord?: { status: AttendanceStatus; checkOut?: string } | null;
  overtimeRecord?: { approvedHours: number } | null;
  noOvertimeConfirmed?: boolean;
}): boolean {
  const { attendanceRecord, overtimeRecord, noOvertimeConfirmed } = params;
  if (!attendanceRecord) {
    return false;
  }
  if (attendanceRecord.status !== 'present' && attendanceRecord.status !== 'late') {
    return true;
  }
  if (overtimeRecord && Number(overtimeRecord.approvedHours) >= 0) {
    return true;
  }
  if (noOvertimeConfirmed) {
    return true;
  }
  if (attendanceRecord.checkOut && attendanceRecord.checkOut.trim().length > 0) {
    return true;
  }
  return false;
}

/**
 * Determines whether the "আজকের দ্রুত হিসাব" (Quick Daily Actions) card should be rendered on the Home page.
 * - Shows automatically when the daily entry is NOT yet completed.
 * - Hides automatically once the daily entry IS completed, unless the user clicked Edit ("এডিট করুন") on "আজকের হিসাব".
 */
export function shouldShowQuickDailyActions(params: {
  isCompleted: boolean;
  isEditing: boolean;
}): boolean {
  if (params.isEditing) {
    return true;
  }
  return !params.isCompleted;
}

export interface AttendanceBonusWindowInfo {
  activeShiftType: 'day' | 'night' | 'both';
  shiftLabelBn: string;
  shiftLabelEn: string;
  windowLabelBn: string;
  windowLabelEn: string;
  ruleNoteBn: string;
  ruleNoteEn: string;
  dayWindowStart: string;
  dayWindowEnd: string;
  nightWindowStart: string;
  nightWindowEnd: string;
  dayWindowTextBn: string;
  nightWindowTextBn: string;
  summaryBn: string;
  summaryEn: string;
  lateRuleBn: string;
  lateRuleEn: string;
}

function formatClock12Bn(time24: string): string {
  const [hStr, mStr] = (time24 || '08:00').split(':');
  const h = Number(hStr);
  const m = Number(mStr || '0');
  if (Number.isNaN(h)) return toBengaliDigits(time24);
  const periodBn = h >= 19 || h < 4 ? 'রাত' : h < 12 ? 'সকাল' : h < 16 ? 'দুপুর' : 'বিকাল';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, '0');
  return `${periodBn} ${toBengaliDigits(`${h12}:${mm}`)}`;
}

/**
 * Resolves the attendance bonus punctuality window (in-time requirement & missing-bonus cutoff)
 * based on whether the worker is on Day Shift, Night Shift, or Weekly Rotation.
 */
export function getAttendanceBonusWindowForShift(params: {
  shiftPattern?: WorkShiftPattern;
  dayWindowStart?: string;
  dayWindowEnd?: string;
  nightWindowStart?: string;
  nightWindowEnd?: string;
  bonusAmount?: number;
}): AttendanceBonusWindowInfo {
  const shiftPattern = params.shiftPattern || 'day';
  const dayWindowStart = params.dayWindowStart || '07:50';
  const dayWindowEnd = params.dayWindowEnd || '08:05';
  const nightWindowStart = params.nightWindowStart || '19:50';
  const nightWindowEnd = params.nightWindowEnd || '20:05';
  const bonusAmt = params.bonusAmount ?? 600;

  const dayStartBn = formatClock12Bn(dayWindowStart);
  const dayEndBn = toBengaliDigits(
    (() => {
      const [hStr, mStr] = dayWindowEnd.split(':');
      const h = Number(hStr);
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${String(Number(mStr || '0')).padStart(2, '0')}`;
    })()
  );

  const nightStartBn = formatClock12Bn(nightWindowStart);
  const nightEndBn = toBengaliDigits(
    (() => {
      const [hStr, mStr] = nightWindowEnd.split(':');
      const h = Number(hStr);
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${String(Number(mStr || '0')).padStart(2, '0')}`;
    })()
  );

  const dayWindowTextBn = `${dayStartBn} থেকে ${dayEndBn}`;
  const nightWindowTextBn = `${nightStartBn} থেকে ${nightEndBn}`;

  const activeShiftType: 'day' | 'night' | 'both' =
    shiftPattern === 'night'
      ? 'night'
      : shiftPattern === 'weekly_rotation'
      ? 'both'
      : 'day';

  let shiftLabelBn = 'ডে শিফট';
  let shiftLabelEn = 'Day Shift';
  let windowLabelBn = dayWindowTextBn;
  let windowLabelEn = `${dayWindowStart} - ${dayWindowEnd}`;
  let summaryBn = '';
  let summaryEn = '';
  let lateRuleBn = '';
  let lateRuleEn = '';

  if (activeShiftType === 'day') {
    shiftLabelBn = 'ডে শিফট';
    shiftLabelEn = 'Day Shift';
    windowLabelBn = `${dayWindowTextBn} মিনিট`;
    windowLabelEn = `${dayWindowStart} to ${dayWindowEnd}`;
    summaryBn = `ডে শিফটে হাজিরা বোনাস (৳${toBengaliDigits(bonusAmt)}) পেতে প্রতিদিন ${dayWindowTextBn} মিনিটের মধ্যে উপস্থিত থাকতে হবে।`;
    summaryEn = `For Day Shift Attendance Bonus (৳${bonusAmt}), check in between ${dayWindowStart} and ${dayWindowEnd}.`;
    lateRuleBn = `${dayEndBn} মিনিটের পরে প্রবেশ করলে 'দেরি (Late)' গণ্য হবে (মাসে ৩ দিন দেরি বা ১ দিন অনুপস্থিতিতে বোনাস মিস হতে পারে)।`;
    lateRuleEn = `Checking in after ${dayWindowEnd} counts as Late (3 late days or 1 absence may forfeit the bonus).`;
  } else if (activeShiftType === 'night') {
    shiftLabelBn = 'নাইট শিফট';
    shiftLabelEn = 'Night Shift';
    windowLabelBn = `${nightWindowTextBn} মিনিট`;
    windowLabelEn = `${nightWindowStart} to ${nightWindowEnd}`;
    summaryBn = `নাইট শিফটে হাজিরা বোনাস (৳${toBengaliDigits(bonusAmt)}) পেতে প্রতিদিন ${nightWindowTextBn} মিনিটের মধ্যে উপস্থিত থাকতে হবে।`;
    summaryEn = `For Night Shift Attendance Bonus (৳${bonusAmt}), check in between ${nightWindowStart} and ${nightWindowEnd}.`;
    lateRuleBn = `রাত ${nightEndBn} মিনিটের পরে প্রবেশ করলে 'দেরি (Late)' গণ্য হবে (মাসে ৩ দিন দেরি বা ১ দিন অনুপস্থিতিতে বোনাস মিস হতে পারে)।`;
    lateRuleEn = `Checking in after ${nightWindowEnd} counts as Late (3 late days or 1 absence may forfeit the bonus).`;
  } else {
    shiftLabelBn = 'রোস্টার শিফট';
    shiftLabelEn = 'Roster Shift';
    windowLabelBn = `ডে: ${dayWindowTextBn} • নাইট: ${nightWindowTextBn}`;
    windowLabelEn = `Day: ${dayWindowStart}-${dayWindowEnd} • Night: ${nightWindowStart}-${nightWindowEnd}`;
    summaryBn = `রোস্টার শিফটে হাজিরা বোনাস (৳${toBengaliDigits(bonusAmt)}) পেতে ডে সপ্তাহে ${dayWindowTextBn} এবং নাইট সপ্তাহে ${nightWindowTextBn} মিনিটের মধ্যে উপস্থিত থাকতে হবে।`;
    summaryEn = `For Roster Shift Attendance Bonus (৳${bonusAmt}), check in ${dayWindowStart}-${dayWindowEnd} (Day) or ${nightWindowStart}-${nightWindowEnd} (Night).`;
    lateRuleBn = `নির্ধারিত সময়ের (${dayEndBn} / রাত ${nightEndBn}) পরে প্রবেশ করলে 'দেরি (Late)' গণ্য হবে এবং হাজিরা বোনাস মিস হতে পারে।`;
    lateRuleEn = `Checking in after the cutoff time counts as Late and may forfeit the attendance bonus.`;
  }

  return {
    activeShiftType,
    shiftLabelBn,
    shiftLabelEn,
    windowLabelBn,
    windowLabelEn,
    ruleNoteBn: `${summaryBn} ${lateRuleBn}`,
    ruleNoteEn: `${summaryEn} ${lateRuleEn}`,
    dayWindowStart,
    dayWindowEnd,
    nightWindowStart,
    nightWindowEnd,
    dayWindowTextBn,
    nightWindowTextBn,
    summaryBn,
    summaryEn,
    lateRuleBn,
    lateRuleEn,
  };
}

export interface WorkplaceTenureAnalytics {
  joiningDate: string;
  leavingDate: string;
  monthsWorked: number;
  grossSalary: number;
  basicSalary: number;
  totalReceivedSalary: number;
  totalExpectedSalary: number;
  outstandingBalance: number;
  totalOvertimeHours: number;
  totalOvertimeEarnings: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalLeaveDays: number;
}

/**
 * Computes financial, overtime, and attendance analytics for a garment workplace tenure
 * (works for both active current factory and archived previous factories).
 */
export function computeWorkplaceTenureAnalytics(params: {
  workplace: Partial<GarmentWorkplace>;
  profile?: Partial<WorkerProfile>;
  payments: SalaryPayment[];
  overtime: OvertimeRecord[];
  attendance: AttendanceRecord[];
  salaryRecords?: SalaryRecord[];
  todayISO?: string;
}): WorkplaceTenureAnalytics {
  const {
    workplace,
    profile,
    payments,
    overtime,
    attendance,
    salaryRecords = [],
    todayISO = getTodayISO(),
  } = params;

  const isCurrent = Boolean(workplace.isCurrent);
  const joiningDate =
    workplace.joiningDate ||
    (isCurrent ? profile?.joiningDate : '') ||
    '2023-01-01';
  const leavingDate = isCurrent ? todayISO : workplace.leavingDate || todayISO;

  const startMonth = joiningDate.slice(0, 7);
  const endMonth = leavingDate.slice(0, 7);

  // Calculate approximate months worked between joiningDate and leavingDate
  const [jy, jm] = startMonth.split('-').map(Number);
  const [ly, lm] = endMonth.split('-').map(Number);
  const computedMonths =
    jy && jm && ly && lm ? Math.max(1, (ly - jy) * 12 + (lm - jm) + 1) : 1;
  const monthsWorked = workplace.monthsWorked || computedMonths;

  const grossSalary =
    workplace.grossSalary ||
    (isCurrent ? profile?.grossSalary : 0) ||
    12500;
  const basicSalary =
    workplace.basicSalary ||
    (isCurrent ? profile?.basicSalary : 0) ||
    deriveBangladeshRMGBreakdownFromGross(grossSalary).basicSalary;

  // Filter live records that fall within [joiningDate, leavingDate]
  const matchingPayments = payments.filter((p) => {
    const pDate = p.paymentDate || `${p.month}-01`;
    return pDate >= joiningDate && pDate <= leavingDate;
  });
  const matchingOt = overtime.filter(
    (o) => o.date >= joiningDate && o.date <= leavingDate
  );
  const matchingAtt = attendance.filter(
    (a) => a.date >= joiningDate && a.date <= leavingDate
  );
  const matchingSal = salaryRecords.filter(
    (s) => s.month >= startMonth && s.month <= endMonth
  );

  const liveReceived = roundCurrency(
    matchingPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0)
  );
  const liveOtHours = roundCurrency(
    matchingOt.reduce((sum, o) => sum + (Number(o.approvedHours) || 0), 0)
  );
  const liveOtEarnings = roundCurrency(
    matchingOt.reduce((sum, o) => sum + (Number(o.estimatedEarnings) || 0), 0)
  );
  const livePresentDays = matchingAtt.filter(
    (a) => a.status === 'present' || a.status === 'late'
  ).length;
  const liveAbsentDays = matchingAtt.filter((a) => a.status === 'absent').length;
  const liveLeaveDays = matchingAtt.filter(
    (a) => a.status === 'approved_leave'
  ).length;

  const liveExpectedFromSal = roundCurrency(
    matchingSal.reduce((sum, s) => sum + (Number(s.estimatedNetPayable) || 0), 0)
  );

  const totalReceivedSalary = Math.max(
    Number(workplace.totalReceivedSalary) || 0,
    liveReceived
  );
  const totalOvertimeHours = Math.max(
    Number(workplace.totalOvertimeHours) || 0,
    liveOtHours
  );
  const totalOvertimeEarnings = Math.max(
    Number(workplace.totalOvertimeEarnings) || 0,
    liveOtEarnings
  );
  const totalPresentDays = Math.max(
    Number(workplace.totalPresentDays) || 0,
    livePresentDays
  );
  const totalAbsentDays = Math.max(
    Number(workplace.totalAbsentDays) || 0,
    liveAbsentDays
  );
  const totalLeaveDays = Math.max(
    Number(workplace.totalLeaveDays) || 0,
    liveLeaveDays
  );

  const fallbackExpected =
    totalReceivedSalary > 0
      ? Math.max(totalReceivedSalary, roundCurrency(grossSalary + totalOvertimeEarnings))
      : roundCurrency(grossSalary + totalOvertimeEarnings);

  const totalExpectedSalary = Math.max(
    Number(workplace.totalExpectedSalary) || 0,
    liveExpectedFromSal,
    fallbackExpected
  );

  const outstandingBalance = roundCurrency(
    Math.max(0, totalExpectedSalary - totalReceivedSalary)
  );

  return {
    joiningDate,
    leavingDate,
    monthsWorked,
    grossSalary,
    basicSalary,
    totalReceivedSalary,
    totalExpectedSalary,
    outstandingBalance,
    totalOvertimeHours,
    totalOvertimeEarnings,
    totalPresentDays,
    totalAbsentDays,
    totalLeaveDays,
  };
}

export interface NewGarmentJobTransitionInput {
  leavingDate: string;
  leavingReason?: string;
  newFactoryName: string;
  newFactoryBranch?: string;
  newFactoryArea?: string;
  newDepartment?: string;
  newDesignation: string;
  newEmployeeId?: string;
  newJoiningDate: string;
  newGrossSalary: number;
  newBasicSalary?: number;
  newShiftPattern: WorkShiftPattern;
}

/**
 * Builds the archived workplace snapshot for the outgoing garment factory
 * and the new current workplace + profile patch for the incoming garment factory.
 */
export function buildJobTransitionArchive(params: {
  profile: WorkerProfile;
  workplaces: GarmentWorkplace[];
  payments: SalaryPayment[];
  overtime: OvertimeRecord[];
  attendance: AttendanceRecord[];
  salaryRecords?: SalaryRecord[];
  input: NewGarmentJobTransitionInput;
  todayISO?: string;
}): {
  archivedExistingId?: string;
  archivedPastWorkplace: Omit<GarmentWorkplace, 'id' | 'userId'>;
  newCurrentWorkplace: Omit<GarmentWorkplace, 'id' | 'userId'>;
  updatedProfilePatch: Partial<WorkerProfile>;
} {
  const {
    profile,
    workplaces,
    payments,
    overtime,
    attendance,
    salaryRecords = [],
    input,
    todayISO = getTodayISO(),
  } = params;

  const existingCurrentWp = workplaces.find((w) => w.isCurrent);
  const outgoingJoiningDate =
    existingCurrentWp?.joiningDate || profile.joiningDate || '2023-01-01';
  const outgoingLeavingDate = input.leavingDate || todayISO;

  const analytics = computeWorkplaceTenureAnalytics({
    workplace: {
      ...(existingCurrentWp || {}),
      isCurrent: false,
      joiningDate: outgoingJoiningDate,
      leavingDate: outgoingLeavingDate,
      grossSalary: profile.grossSalary,
      basicSalary: profile.basicSalary,
    },
    profile,
    payments,
    overtime,
    attendance,
    salaryRecords,
    todayISO: outgoingLeavingDate,
  });

  const archivedPastWorkplace: Omit<GarmentWorkplace, 'id' | 'userId'> = {
    factoryName:
      existingCurrentWp?.factoryName ||
      profile.factoryName ||
      'পূর্ববর্তী গার্মেন্টস',
    factoryAddress: existingCurrentWp?.factoryAddress || profile.address || '',
    factoryArea:
      existingCurrentWp?.factoryArea ||
      profile.factoryBranch ||
      'গাজীপুর',
    department:
      existingCurrentWp?.department ||
      profile.department ||
      'সুইং সেকশন',
    floorNumber: existingCurrentWp?.floorNumber || '',
    lineNumber: existingCurrentWp?.lineNumber || '',
    designation:
      existingCurrentWp?.designation ||
      profile.designation ||
      'মেশিন অপারেটর',
    employeeId: existingCurrentWp?.employeeId || profile.employeeId || '',
    supervisorName: existingCurrentWp?.supervisorName || '',
    joiningDate: outgoingJoiningDate,
    leavingDate: outgoingLeavingDate,
    leavingReason: (input.leavingReason || 'নতুন গার্মেন্টসে যোগদান').trim(),
    factoryPhone: existingCurrentWp?.factoryPhone || '',
    notes:
      input.leavingReason?.trim() ||
      existingCurrentWp?.notes ||
      `চাকরির মেয়াদ: ${outgoingJoiningDate} হতে ${outgoingLeavingDate}`,
    isCurrent: false,
    shiftPattern: profile.shiftPattern || 'day',
    grossSalary: analytics.grossSalary,
    basicSalary: analytics.basicSalary,
    totalReceivedSalary: analytics.totalReceivedSalary,
    totalExpectedSalary: analytics.totalExpectedSalary,
    totalOvertimeHours: analytics.totalOvertimeHours,
    totalOvertimeEarnings: analytics.totalOvertimeEarnings,
    totalPresentDays: analytics.totalPresentDays,
    totalAbsentDays: analytics.totalAbsentDays,
    totalLeaveDays: analytics.totalLeaveDays,
    monthsWorked: analytics.monthsWorked,
  };

  const split = deriveBangladeshRMGBreakdownFromGross(
    Math.max(2450, Number(input.newGrossSalary) || 12500)
  );
  const resolvedNewBasic =
    input.newBasicSalary && input.newBasicSalary > 0
      ? input.newBasicSalary
      : split.basicSalary;
  const resolvedNewGross = Math.max(0, Number(input.newGrossSalary) || 12500);
  const resolvedOtRate = Number(((resolvedNewBasic / 208) * 2).toFixed(2));

  const newCurrentWorkplace: Omit<GarmentWorkplace, 'id' | 'userId'> = {
    factoryName: input.newFactoryName.trim(),
    factoryAddress: (input.newFactoryArea || input.newFactoryBranch || '').trim(),
    factoryArea: (input.newFactoryArea || input.newFactoryBranch || 'গাজীপুর').trim(),
    department: (input.newDepartment || 'সুইং সেকশন').trim(),
    floorNumber: '',
    lineNumber: (input.newDepartment || '').trim(),
    designation: (input.newDesignation || 'মেশিন অপারেটর').trim(),
    employeeId: (input.newEmployeeId || '').trim(),
    supervisorName: '',
    joiningDate: input.newJoiningDate || todayISO,
    factoryPhone: '',
    notes: 'বর্তমান কর্মরত গার্মেন্টস',
    isCurrent: true,
    shiftPattern: input.newShiftPattern || 'day',
    grossSalary: resolvedNewGross,
    basicSalary: resolvedNewBasic,
  };

  const updatedProfilePatch: Partial<WorkerProfile> = {
    factoryName: input.newFactoryName.trim(),
    factoryBranch: (input.newFactoryBranch || input.newFactoryArea || '').trim(),
    department: (input.newDepartment || '').trim(),
    designation: (input.newDesignation || 'মেশিন অপারেটর').trim(),
    employeeId: (input.newEmployeeId || '').trim(),
    joiningDate: input.newJoiningDate || todayISO,
    grossSalary: resolvedNewGross,
    basicSalary: resolvedNewBasic,
    houseRentAllowance: split.houseRentAllowance,
    medicalAllowance: split.medicalAllowance,
    transportAllowance: split.transportAllowance,
    foodAllowance: split.foodAllowance,
    otCustomHourlyRate: resolvedOtRate,
    shiftPattern: input.newShiftPattern || 'day',
  };

  return {
    archivedExistingId: existingCurrentWp?.id,
    archivedPastWorkplace,
    newCurrentWorkplace,
    updatedProfilePatch,
  };
}

export interface AttendanceBonusEvaluationResult {
  hasBonusConfigured: boolean;
  bonusAmount: number;
  requiredDays: number;
  maxConsecutiveAbsencesAllowed: number;
  activeDaysCount: number;
  absentDaysCount: number;
  maxConsecutiveAbsencesFound: number;
  isEligible: boolean;
  earnedAmount: number;
  statusBadgeBn: string;
  statusBadgeEn: string;
  reasonBn?: string;
  reasonEn?: string;
}

/**
 * Calculates monthly Attendance Bonus eligibility based on factory profile settings and month attendance.
 */
export function calculateAttendanceBonusEligibility(params: {
  recordsForMonth: AttendanceRecord[];
  profile: Partial<WorkerProfile>;
}): AttendanceBonusEvaluationResult {
  const hasConfig = params.profile.hasAttendanceBonus !== false;
  const bonusAmt = params.profile.attendanceBonusAmount ?? params.profile.attendanceBonus ?? 0;
  const requiredDays = params.profile.attendanceBonusDays || 30;
  const maxConsecutiveAbsencesAllowed = params.profile.maxConsecutiveAbsences || 0;
  const latePenaltyEnabled = Boolean(params.profile.latePenaltyEnabled);
  const maxLateDaysLimit = Math.max(1, Number(params.profile.maxLateDaysForBonus) || 3);

  if (!hasConfig || bonusAmt <= 0) {
    return {
      hasBonusConfigured: false,
      bonusAmount: 0,
      requiredDays,
      maxConsecutiveAbsencesAllowed,
      activeDaysCount: 0,
      absentDaysCount: 0,
      maxConsecutiveAbsencesFound: 0,
      isEligible: false,
      earnedAmount: 0,
      statusBadgeBn: 'হাজিরা বোনাস বন্ধ',
      statusBadgeEn: 'Bonus Disabled',
      reasonBn: 'আপনার কারখানায় হাজিরা বোনাস চালু করা নেই।',
      reasonEn: 'Attendance bonus is not enabled for your factory.',
    };
  }

  const sorted = [...params.recordsForMonth].sort((a, b) => a.date.localeCompare(b.date));

  let activeDaysCount = 0;
  let absentDaysCount = 0;
  let lateDaysCount = 0;
  let maxConsecutiveFound = 0;
  let currentConsecutive = 0;

  let isEligible = true;
  const reasonsBn: string[] = [];
  const reasonsEn: string[] = [];

  for (const r of sorted) {
    if (r.status === 'absent') {
      absentDaysCount++;
      currentConsecutive++;
      if (currentConsecutive > maxConsecutiveFound) {
        maxConsecutiveFound = currentConsecutive;
      }
    } else {
      currentConsecutive = 0;
      if (r.status === 'late') {
        lateDaysCount++;
      }
      if (
        r.status === 'present' ||
        r.status === 'late' ||
        r.status === 'approved_leave' ||
        r.status === 'weekly_holiday' ||
        r.status === 'public_holiday'
      ) {
        activeDaysCount++;
      }
    }

    if (r.hasAttendanceBonus === false) {
      isEligible = false;
      const parts = r.date.split('-');
      const dmy = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : r.date;
      reasonsBn.push(`${toBengaliDigits(dmy)} তারিখে হাজিরা বোনাস টিকমার্ক সরানো হয়েছিল`);
      reasonsEn.push(`Attendance bonus unticked on ${r.date}`);
    }
  }

  if (absentDaysCount > maxConsecutiveAbsencesAllowed) {
    isEligible = false;
    reasonsBn.push(`অনুপস্থিতি (${toBengaliDigits(absentDaysCount)} দিন) নির্ধারিত সীমার (${toBengaliDigits(maxConsecutiveAbsencesAllowed)} দিন) চেয়ে বেশি`);
    reasonsEn.push(`Absent days (${absentDaysCount}) exceeds threshold`);
  }

  if (maxConsecutiveFound > maxConsecutiveAbsencesAllowed) {
    isEligible = false;
    reasonsBn.push(`একটানা অনুপস্থিতি (${toBengaliDigits(maxConsecutiveFound)} দিন) থাকার কারণে বোনাস বাতিল`);
    reasonsEn.push(`Consecutive unexcused absences (${maxConsecutiveFound}) exceeded limit`);
  }

  if (latePenaltyEnabled && lateDaysCount >= maxLateDaysLimit) {
    isEligible = false;
    reasonsBn.push(`মাসে ${toBengaliDigits(lateDaysCount)} দিন লেট হওয়ায় বোনাস বাতিল (সীমা: ${toBengaliDigits(maxLateDaysLimit)} দিন)`);
    reasonsEn.push(`Late entries (${lateDaysCount} days) reached penalty limit (${maxLateDaysLimit} days)`);
  }

  const earnedAmount = isEligible ? bonusAmt : 0;

  return {
    hasBonusConfigured: true,
    bonusAmount: bonusAmt,
    requiredDays,
    maxConsecutiveAbsencesAllowed,
    activeDaysCount,
    absentDaysCount,
    maxConsecutiveAbsencesFound: maxConsecutiveFound,
    isEligible,
    earnedAmount,
    statusBadgeBn: isEligible ? `অর্জিত ${formatBDT(earnedAmount, 'bn')}` : 'শর্ত অসম্পূর্ণ / বাতিল',
    statusBadgeEn: isEligible ? `Earned ${formatBDT(earnedAmount, 'en')}` : 'Ineligible',
    reasonBn: isEligible
      ? `আপনার উপস্থিতি সম্পূর্ণ এবং শর্ত পূরণ থাকায় ${formatBDT(bonusAmt, 'bn')} হাজিরা বোনাস যুক্ত হবে।`
      : reasonsBn.join('; '),
    reasonEn: isEligible
      ? `Criteria met for Attendance Bonus (${formatBDT(bonusAmt, 'en')}).`
      : reasonsEn.join('; '),
  };
}

/**
 * Compares check-in time with shift start/cutoff time to evaluate punctuality.
 */
export function evaluateCheckInPunctuality(params: {
  checkInTime: string;
  shiftStartTime: string;
  bonusCutoffTime?: string;
}): {
  isOnTime: boolean;
  lateMinutes: number;
  labelBn: string;
  labelEn: string;
  badgeClass: string;
} {
  const { checkInTime, shiftStartTime, bonusCutoffTime } = params;
  const targetTime = bonusCutoffTime || shiftStartTime;
  if (!checkInTime || !targetTime) {
    return {
      isOnTime: true,
      lateMinutes: 0,
      labelBn: 'প্রবেশ সময় পছন্দ করুন',
      labelEn: 'Set Check-in',
      badgeClass: 'bg-slate-100 text-slate-700',
    };
  }

  const [ch, cm] = checkInTime.split(':').map(Number);
  const [sh, sm] = targetTime.split(':').map(Number);

  if (Number.isNaN(ch) || Number.isNaN(cm) || Number.isNaN(sh) || Number.isNaN(sm)) {
    return {
      isOnTime: true,
      lateMinutes: 0,
      labelBn: 'সময় বিন্যাস সঠিক নয়',
      labelEn: 'Invalid time format',
      badgeClass: 'bg-slate-100 text-slate-700',
    };
  }

  const checkInMins = ch * 60 + cm;
  const targetMins = sh * 60 + sm;

  if (checkInMins <= targetMins) {
    return {
      isOnTime: true,
      lateMinutes: 0,
      labelBn: 'সময়ানুগ (সময়মতো প্রবেশ)',
      labelEn: 'On Time Entry',
      badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    };
  }

  const diff = checkInMins - targetMins;
  return {
    isOnTime: false,
    lateMinutes: diff,
    labelBn: `দেরিতে প্রবেশ (${toBengaliDigits(diff)} মিনিট লেট)`,
    labelEn: `Late Entry (${diff}m late)`,
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-emerald-300',
  };
}

/**
 * Calculates the next scheduled savings deposit date based on depositDate (YYYY-MM-DD)
 * and frequency ('monthly' | 'weekly' | 'daily').
 */
export function computeNextSavingsDueDate(
  depositDate: string,
  frequency: 'monthly' | 'weekly' | 'daily' = 'monthly'
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(depositDate)) return depositDate;
  const [yStr, mStr, dStr] = depositDate.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const day = Number(dStr);

  if (frequency === 'daily') {
    const dt = new Date(Date.UTC(year, monthIndex, day + 1));
    return dt.toISOString().slice(0, 10);
  }
  if (frequency === 'weekly') {
    const dt = new Date(Date.UTC(year, monthIndex, day + 7));
    return dt.toISOString().slice(0, 10);
  }
  // monthly: same day of next month (clamped to end of next month)
  const targetYear = monthIndex === 11 ? year + 1 : year;
  const targetMonthIndex = (monthIndex + 1) % 12;
  const maxDaysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDaysInTargetMonth);
  const nextDt = new Date(Date.UTC(targetYear, targetMonthIndex, clampedDay));
  return nextDt.toISOString().slice(0, 10);
}

/**
 * Generates an array of `count` consecutive YYYY-MM strings in descending order,
 * starting at `anchorMonthISO` (e.g. '2026-10' -> ['2026-10', '2026-09', '2026-08', ...]).
 */
export function getRecentMonthsList(anchorMonthISO: string, count = 12): string[] {
  if (!/^\d{4}-\d{2}$/.test(anchorMonthISO) || count <= 0) return [anchorMonthISO];
  const result: string[] = [];
  let cur = anchorMonthISO;
  for (let i = 0; i < count; i++) {
    result.push(cur);
    cur = getPreviousMonth(cur);
  }
  return result;
}

export function isWorkerSetupCompleted(
  profile: Pick<WorkerProfile, 'grossSalary' | 'basicSalary'> | null | undefined
): boolean {
  if (!profile) return false;
  return (Number(profile.grossSalary) || 0) > 0 || (Number(profile.basicSalary) || 0) > 0;
}

export const POPULAR_GARMENT_AREAS: Array<{ bn: string; en: string }> = [
  { bn: 'গাজীপুর', en: 'Gazipur' },
  { bn: 'আশুলিয়া', en: 'Ashulia' },
  { bn: 'সাভার', en: 'Savar' },
  { bn: 'নারায়ণগঞ্জ', en: 'Narayanganj' },
  { bn: 'মিরপুর', en: 'Mirpur' },
  { bn: 'টঙ্গী', en: 'Tongi' },
  { bn: 'চট্টগ্রাম', en: 'Chattogram' },
];

export interface OnboardingStepValidationInput {
  step: 1 | 2 | 3;
  isManualSetupMode: boolean;
  grossSalaryInput: string;
  basicSalaryInput?: string;
  joiningDate?: string;
  otRateInput?: string;
  isOtRateConfirmed?: boolean;
  factoryName: string;
  factoryBranch: string;
  lang?: Language;
}

export interface OnboardingStepValidationResult {
  canAdvance: boolean;
  grossSalaryError?: string;
  joiningDateError?: string;
  otRateError?: string;
  factoryNameError?: string;
  factoryBranchError?: string;
  focusField?:
    | 'grossSalary'
    | 'joiningDate'
    | 'otRate'
    | 'otRateConfirm'
    | 'factoryName'
    | 'factoryBranch';
}

export function validateOnboardingStepTransition(
  input: OnboardingStepValidationInput
): OnboardingStepValidationResult {
  const isBn = (input.lang || 'bn') === 'bn';

  // During initial onboarding, allow free step navigation without blocking
  if (!input.isManualSetupMode) {
    return { canAdvance: true };
  }

  if (input.step === 1) {
    const parsedGross = Math.max(0, Number(input.grossSalaryInput) || 0);
    const cleanJoiningDate =
      input.joiningDate !== undefined ? input.joiningDate.trim() : 'provided';
    const parsedOtRate =
      input.otRateInput !== undefined ? Math.max(0, Number(input.otRateInput) || 0) : 1;
    const isOtConfirmed =
      input.isOtRateConfirmed !== undefined ? input.isOtRateConfirmed : true;

    let grossSalaryError: string | undefined;
    let joiningDateError: string | undefined;
    let otRateError: string | undefined;
    let focusField: OnboardingStepValidationResult['focusField'];

    if (parsedGross <= 0) {
      grossSalaryError = isBn
        ? 'পরবর্তী ধাপে যেতে এখানে আপনার মোট বেতন লিখুন'
        : 'Please enter your gross salary here to continue';
      focusField = 'grossSalary';
    }

    if (input.joiningDate !== undefined && !cleanJoiningDate) {
      joiningDateError = isBn
        ? 'এখানে আপনার যোগদানের তারিখ সিলেক্ট করুন'
        : 'Please select your joining date here';
      if (!focusField) {
        focusField = 'joiningDate';
      }
    }

    if (input.otRateInput !== undefined) {
      if (parsedOtRate <= 0) {
        otRateError = isBn
          ? 'এখানে আপনার প্রতি ঘণ্টা ওভারটাইম হার লিখুন'
          : 'Please enter your hourly overtime rate';
        if (!focusField) {
          focusField = 'otRate';
        }
      } else if (!isOtConfirmed) {
        otRateError = isBn
          ? 'ওভারটাইম হার চেক করে পাশে ওকে বাটনে ক্লিক করুন'
          : 'Please check the overtime rate and click OK';
        if (!focusField) {
          focusField = 'otRateConfirm';
        }
      }
    }

    if (grossSalaryError || joiningDateError || otRateError) {
      return {
        canAdvance: false,
        grossSalaryError,
        joiningDateError,
        otRateError,
        focusField,
      };
    }

    return { canAdvance: true };
  }

  if (input.step === 2) {
    const cleanFactory = (input.factoryName || '').trim();
    const cleanBranch = (input.factoryBranch || '').trim();

    if (!cleanFactory && !cleanBranch) {
      return {
        canAdvance: false,
        factoryNameError: isBn
          ? 'এখানে আপনার কারখানার নাম লিখুন'
          : 'Please enter your factory name here',
        factoryBranchError: isBn
          ? 'এখানে আপনার এলাকার নাম লিখুন'
          : 'Please enter your area/branch name',
        focusField: 'factoryName',
      };
    }

    if (!cleanFactory) {
      return {
        canAdvance: false,
        factoryNameError: isBn
          ? 'এখানে আপনার কারখানার নাম লিখুন'
          : 'Please enter your factory name here',
        focusField: 'factoryName',
      };
    }

    if (!cleanBranch) {
      return {
        canAdvance: false,
        factoryBranchError: isBn
          ? 'এখানে আপনার এলাকার নাম লিখুন'
          : 'Please enter your area/branch name',
        focusField: 'factoryBranch',
      };
    }

    return { canAdvance: true };
  }

  return { canAdvance: true };
}


export type RentGasRuleMode = 'attached' | 'line_separate' | 'cylinder';

export interface MonthlyRentRuleEntry {
  fixedBaseRent: number;
  electricityAttachedToRent: boolean;
  defaultElectricityAmount: number;
  gasMode: RentGasRuleMode;
  defaultGasAmount: number;
  waterAttachedToRent: boolean;
  defaultWaterAmount: number;
}

export interface RentRuleConfig extends MonthlyRentRuleEntry {
  monthlyRules?: Record<string, MonthlyRentRuleEntry>;
}

export const DEFAULT_RENT_RULE_CONFIG: RentRuleConfig = {
  fixedBaseRent: 0,
  electricityAttachedToRent: false,
  defaultElectricityAmount: 0,
  gasMode: 'attached',
  defaultGasAmount: 0,
  waterAttachedToRent: true,
  defaultWaterAmount: 0,
  monthlyRules: {},
};

const RENT_RULE_STORAGE_KEY_PREFIX = 'shromik_sathi_rent_rule_v1';

function sanitizeMonthlyRentRuleEntry(
  raw: Partial<MonthlyRentRuleEntry> | undefined
): MonthlyRentRuleEntry {
  return {
    fixedBaseRent: Math.max(0, roundCurrency(Number(raw?.fixedBaseRent) || 0)),
    electricityAttachedToRent: Boolean(raw?.electricityAttachedToRent),
    defaultElectricityAmount: Math.max(
      0,
      roundCurrency(Number(raw?.defaultElectricityAmount) || 0)
    ),
    gasMode:
      raw?.gasMode === 'line_separate' || raw?.gasMode === 'cylinder'
        ? raw.gasMode
        : 'attached',
    defaultGasAmount: Math.max(0, roundCurrency(Number(raw?.defaultGasAmount) || 0)),
    waterAttachedToRent:
      raw?.waterAttachedToRent !== undefined ? Boolean(raw.waterAttachedToRent) : true,
    defaultWaterAmount: Math.max(0, roundCurrency(Number(raw?.defaultWaterAmount) || 0)),
  };
}

export function resolveRentRuleForMonth(
  rentRule: RentRuleConfig,
  month: string
): MonthlyRentRuleEntry {
  const monthSpecific = rentRule.monthlyRules?.[month];
  if (monthSpecific) {
    return sanitizeMonthlyRentRuleEntry(monthSpecific);
  }
  return sanitizeMonthlyRentRuleEntry(rentRule);
}

export function applyMonthlyRentRuleUpdate(params: {
  currentConfig: RentRuleConfig;
  targetMonth: string;
  patch: Partial<MonthlyRentRuleEntry>;
  updateDefaultRule?: boolean;
  preserveMonthsCount?: number;
}): RentRuleConfig {
  const {
    currentConfig,
    targetMonth,
    patch,
    updateDefaultRule = true,
    preserveMonthsCount = 8,
  } = params;

  const baseEntry = sanitizeMonthlyRentRuleEntry(currentConfig);
  const nextMonthlyRules: Record<string, MonthlyRentRuleEntry> = {};

  if (currentConfig.monthlyRules) {
    for (const [mKey, val] of Object.entries(currentConfig.monthlyRules)) {
      if (/^\d{4}-\d{2}$/.test(mKey) && val) {
        nextMonthlyRules[mKey] = sanitizeMonthlyRentRuleEntry(val);
      }
    }
  }

  // Freeze/snapshot prior recent months before targetMonth so changing targetMonth's rule
  // (e.g. changing electricity from attached to separate in current month) never alters previous months!
  if (/^\d{4}-\d{2}$/.test(targetMonth)) {
    const priorMonths = getRecentMonthsList(targetMonth, preserveMonthsCount);
    for (const m of priorMonths) {
      if (m !== targetMonth && !nextMonthlyRules[m]) {
        nextMonthlyRules[m] = sanitizeMonthlyRentRuleEntry(currentConfig);
      }
    }
  }

  const currentMonthEntry = resolveRentRuleForMonth(currentConfig, targetMonth);
  const updatedMonthEntry = sanitizeMonthlyRentRuleEntry({
    ...currentMonthEntry,
    ...patch,
  });

  if (/^\d{4}-\d{2}$/.test(targetMonth)) {
    nextMonthlyRules[targetMonth] = updatedMonthEntry;
  }

  const nextDefaultEntry = updateDefaultRule ? updatedMonthEntry : baseEntry;

  return {
    ...nextDefaultEntry,
    monthlyRules: nextMonthlyRules,
  };
}

export function getSavedRentRuleConfig(userId?: string): RentRuleConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_RENT_RULE_CONFIG, monthlyRules: {} };
  }
  try {
    const raw =
      (userId && window.localStorage.getItem(`${RENT_RULE_STORAGE_KEY_PREFIX}_${userId}`)) ||
      window.localStorage.getItem(RENT_RULE_STORAGE_KEY_PREFIX);
    if (!raw) return { ...DEFAULT_RENT_RULE_CONFIG, monthlyRules: {} };
    const parsed = JSON.parse(raw) as Partial<RentRuleConfig>;
    const sanitizedBase = sanitizeMonthlyRentRuleEntry(parsed);
    const monthlyRules: Record<string, MonthlyRentRuleEntry> = {};
    if (parsed.monthlyRules && typeof parsed.monthlyRules === 'object') {
      for (const [m, entry] of Object.entries(parsed.monthlyRules)) {
        if (/^\d{4}-\d{2}$/.test(m) && entry) {
          monthlyRules[m] = sanitizeMonthlyRentRuleEntry(entry);
        }
      }
    }
    return {
      ...sanitizedBase,
      monthlyRules,
    };
  } catch {
    return { ...DEFAULT_RENT_RULE_CONFIG, monthlyRules: {} };
  }
}

export function saveRentRuleConfig(config: RentRuleConfig, userId?: string): RentRuleConfig {
  const sanitizedBase = sanitizeMonthlyRentRuleEntry(config);
  const monthlyRules: Record<string, MonthlyRentRuleEntry> = {};
  if (config.monthlyRules && typeof config.monthlyRules === 'object') {
    for (const [m, entry] of Object.entries(config.monthlyRules)) {
      if (/^\d{4}-\d{2}$/.test(m) && entry) {
        monthlyRules[m] = sanitizeMonthlyRentRuleEntry(entry);
      }
    }
  }
  const sanitized: RentRuleConfig = {
    ...sanitizedBase,
    monthlyRules,
  };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const json = JSON.stringify(sanitized);
      if (userId) {
        window.localStorage.setItem(`${RENT_RULE_STORAGE_KEY_PREFIX}_${userId}`, json);
      }
      window.localStorage.setItem(RENT_RULE_STORAGE_KEY_PREFIX, json);
    } catch {
      // ignore storage quota errors
    }
  }
  return sanitized;
}

export function saveRentRuleForMonth(params: {
  currentConfig: RentRuleConfig;
  targetMonth: string;
  patch: Partial<MonthlyRentRuleEntry>;
  updateDefaultRule?: boolean;
  userId?: string;
}): RentRuleConfig {
  const updated = applyMonthlyRentRuleUpdate({
    currentConfig: params.currentConfig,
    targetMonth: params.targetMonth,
    patch: params.patch,
    updateDefaultRule: params.updateDefaultRule,
  });
  return saveRentRuleConfig(updated, params.userId);
}

export type RentBillItemType = 'house_rent' | 'electricity' | 'gas' | 'water_other' | 'combined';

export interface RentDueEntryMeta {
  itemType: RentBillItemType;
  items?: RentBillItemType[];
  months: string[];
  dueAmount: number;
  isPaid: boolean;
  note?: string;
}

export function getRentBillItemLabelBn(itemType: RentBillItemType): string {
  switch (itemType) {
    case 'house_rent':
      return 'বাসা ভাড়া';
    case 'electricity':
      return 'কারেন্ট / বিদ্যুৎ বিল';
    case 'gas':
      return 'গ্যাস বিল';
    case 'water_other':
      return 'পানি ও অন্যান্য বিল';
    case 'combined':
      return 'বাসা ভাড়া ও বিল একসাথে';
  }
}

export function buildRentDueDescription(meta: RentDueEntryMeta): string {
  const cleanMonths = meta.months.filter(Boolean);
  const monthsJoined = cleanMonths.join(',');
  const amt = Math.max(0, Math.round(Number(meta.dueAmount) || 0));
  const itemsList = meta.items && meta.items.length > 0 ? meta.items : [meta.itemType];
  const itemsJoined = itemsList.join(',');
  const label = itemsList.map(getRentBillItemLabelBn).join(', ');
  const statusTag = meta.isPaid ? 'PAID' : 'UNPAID';
  const noteSuffix = meta.note?.trim() ? ` · নোট:${meta.note.trim()}` : '';
  return `[ভাড়া ও বিল বকেয়া] ${label} [ধরন:${meta.itemType}|আইটেম:${itemsJoined}|মাস:${monthsJoined}|টাকা:${amt}|অবস্থা:${statusTag}]${noteSuffix}`.slice(
    0,
    245
  );
}

export function isRentDueRecord(desc: string | undefined): boolean {
  return Boolean(desc && desc.startsWith('[ভাড়া ও বিল বকেয়া]'));
}

export function parseRentDueDescription(
  desc: string | undefined,
  fallbackMonth: string
): RentDueEntryMeta | null {
  if (!desc || !desc.startsWith('[ভাড়া ও বিল বকেয়া]')) return null;
  const typeMatch = desc.match(/ধরন:(house_rent|electricity|gas|water_other|combined)/);
  const itemsMatch = desc.match(/আইটেম:([a-z_,]+)/);
  const monthsMatch = desc.match(/মাস:([0-9,-]+)/);
  const amtMatch = desc.match(/টাকা:(\d+)/);
  const statusMatch = desc.match(/অবস্থা:(PAID|UNPAID)/);
  const noteMatch = desc.match(/নোট:(.+)$/);

  const months = monthsMatch?.[1]
    ? monthsMatch[1]
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    : [fallbackMonth];

  const validTypes: RentBillItemType[] = [
    'house_rent',
    'electricity',
    'gas',
    'water_other',
    'combined',
  ];
  const parsedItems = (itemsMatch?.[1]?.split(',') || []).filter((t): t is RentBillItemType =>
    validTypes.includes(t as RentBillItemType)
  );
  const fallbackType = (typeMatch?.[1] as RentBillItemType) || 'house_rent';

  return {
    itemType: fallbackType,
    items: parsedItems.length > 0 ? parsedItems : [fallbackType],
    months: months.length > 0 ? months : [fallbackMonth],
    dueAmount: Math.max(0, Number(amtMatch?.[1] || 0)),
    isPaid: statusMatch?.[1] === 'PAID',
    note: noteMatch?.[1]?.trim() || '',
  };
}

export interface RentAdvanceInstallment {
  date: string; // YYYY-MM-DD
  amount: number;
  note?: string;
}

export interface RentAdvanceEntryMeta {
  items: RentBillItemType[];
  months: string[];
  monthsCount: number;
  totalBill?: number;
  advanceAmount: number;
  remainingDue?: number;
  deductedFromCash: boolean;
  installments?: RentAdvanceInstallment[];
  note?: string;
}

export function buildRentAdvanceDescription(meta: RentAdvanceEntryMeta): string {
  const cleanItems = meta.items.length > 0 ? meta.items : (['house_rent'] as RentBillItemType[]);
  const itemsJoined = cleanItems.join(',');
  const cleanMonths = meta.months.filter(Boolean);
  const monthsJoined = cleanMonths.join(',');
  const count = Math.max(1, Number(meta.monthsCount) || cleanMonths.length || 1);
  const amt = Math.max(0, Math.round(Number(meta.advanceAmount) || 0));
  const tot = Math.max(0, Math.round(Number(meta.totalBill ?? meta.advanceAmount) || 0));
  const rem = Math.max(0, Math.round(Number(meta.remainingDue ?? Math.max(0, tot - amt)) || 0));
  const modeTag = meta.deductedFromCash ? 'PAID_NOW' : 'RECORD_ONLY';
  const itemLabels = cleanItems.map(getRentBillItemLabelBn).join(', ');
  const historyJoined = (meta.installments || [])
    .map((inst) => `${inst.date}=${inst.amount}${inst.note ? `(${inst.note.replace(/[:=|,;]/g, '_')})` : ''}`)
    .join(';');
  const historyTag = historyJoined ? `|হিস্ট্রি:${historyJoined}` : '';
  const noteSuffix = meta.note?.trim() ? ` · নোট:${meta.note.trim()}` : '';

  return `[অগ্রিম ভাড়া ও বিল] ${itemLabels} (${toBengaliDigits(count)} মাস) [বাবদ:${itemsJoined}|মাসসমূহ:${monthsJoined}|মাসসংখ্যা:${count}|টাকা:${amt}|মোটনির্ধারিত:${tot}|বাকিপাওনা:${rem}|মোড:${modeTag}${historyTag}]${noteSuffix}`.slice(
    0,
    245
  );
}

export function isRentAdvanceRecord(desc: string | undefined): boolean {
  return Boolean(desc && desc.startsWith('[অগ্রিম ভাড়া ও বিল]'));
}

export function parseRentAdvanceDescription(
  desc: string | undefined,
  fallbackMonth: string
): RentAdvanceEntryMeta | null {
  if (!desc || !desc.startsWith('[অগ্রিম ভাড়া ও বিল]')) return null;
  const itemsMatch = desc.match(/বাবদ:([a-z_,]+)/);
  const monthsMatch = desc.match(/মাসসমূহ:([0-9,-]+)/);
  const countMatch = desc.match(/মাসসংখ্যা:(\d+)/);
  const amtMatch = desc.match(/টাকা:(\d+)/);
  const totMatch = desc.match(/মোটনির্ধারিত:(\d+)/);
  const remMatch = desc.match(/বাকিপাওনা:(\d+)/);
  const modeMatch = desc.match(/মোড:(PAID_NOW|RECORD_ONLY)/);
  const historyMatch = desc.match(/হিস্ট্রি:([^\]\|]+)/);
  const noteMatch = desc.match(/নোট:(.+)$/);

  const validTypes: RentBillItemType[] = [
    'house_rent',
    'electricity',
    'gas',
    'water_other',
    'combined',
  ];
  const parsedItems = (itemsMatch?.[1]?.split(',') || []).filter((t): t is RentBillItemType =>
    validTypes.includes(t as RentBillItemType)
  );
  const parsedMonths = (monthsMatch?.[1]?.split(',') || [])
    .map((m) => m.trim())
    .filter(Boolean);

  const advAmt = Math.max(0, Number(amtMatch?.[1] || 0));
  const totAmt = totMatch?.[1] ? Number(totMatch[1]) : advAmt;
  const remAmt = remMatch?.[1] ? Number(remMatch[1]) : Math.max(0, totAmt - advAmt);

  const parsedInstallments: RentAdvanceInstallment[] = [];
  if (historyMatch?.[1]) {
    historyMatch[1].split(';').forEach((chunk) => {
      const parts = chunk.split('=');
      if (parts.length >= 2) {
        const d = parts[0].trim();
        const amtPart = parts[1].trim();
        const nMatch = amtPart.match(/^(\d+)(?:\((.*)\))?$/);
        const a = Number(nMatch?.[1] || amtPart || 0);
        const n = nMatch?.[2] || '';
        if (d && a > 0) {
          parsedInstallments.push({ date: d, amount: a, note: n });
        }
      }
    });
  }

  if (parsedInstallments.length === 0 && advAmt > 0) {
    parsedInstallments.push({
      date: `${parsedMonths[0] || fallbackMonth}-05`,
      amount: advAmt,
    });
  }

  return {
    items: parsedItems.length > 0 ? parsedItems : ['house_rent'],
    months: parsedMonths.length > 0 ? parsedMonths : [fallbackMonth],
    monthsCount: Math.max(1, Number(countMatch?.[1] || parsedMonths.length || 1)),
    totalBill: totAmt,
    advanceAmount: advAmt,
    remainingDue: remAmt,
    deductedFromCash: modeMatch?.[1] === 'PAID_NOW',
    installments: parsedInstallments,
    note: noteMatch?.[1]?.trim() || '',
  };
}

export type MonthlyRentTableStatus = 'paid' | 'due' | 'advance' | 'unpaid';

export interface MonthlyRentUtilityTableRow {
  month: string;
  isCurrentMonth: boolean;
  rentAmount: number;
  electricityAmount: number;
  electricityAttached: boolean;
  gasAmount: number;
  gasAttached: boolean;
  gasMode: RentGasRuleMode;
  waterOtherAmount: number;
  totalAmount: number;
  status: MonthlyRentTableStatus;
  statusDetailBn: string;
  statusDetailEn: string;
  unpaidDueRecordId?: string;
}

export function matchesRentExpenseTargetMonth(
  rec: Pick<ExpenseRecord, 'month' | 'description'>,
  targetMonth: string
): boolean {
  const mMatch = rec.description?.match(/মাস:(\d{4}-\d{2})/);
  if (mMatch?.[1]) {
    return mMatch[1] === targetMonth;
  }
  return rec.month === targetMonth;
}

export function getPreviousMonthISO(monthISO: string): string {
  const [yStr, mStr] = monthISO.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getNextMonthISO(monthISO: string): string {
  const [yStr, mStr] = monthISO.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function buildMonthlyRentUtilityTableRows(params: {
  expenses: ExpenseRecord[];
  rentRule: RentRuleConfig;
  selectedMonth: string;
  monthsCount?: number;
}): MonthlyRentUtilityTableRow[] {
  const { expenses, rentRule, selectedMonth } = params;
  const monthSet = new Set<string>();
  monthSet.add(selectedMonth);

  const rentExpenses = expenses.filter((e) => e.category === 'rent');

  // Collect any extra months referenced in due or advance records or target month tags
  for (const rec of rentExpenses) {
    if (isRentDueRecord(rec.description)) {
      const dueMeta = parseRentDueDescription(rec.description, rec.month);
      dueMeta?.months.forEach((m) => {
        if (/^\d{4}-\d{2}$/.test(m)) monthSet.add(m);
      });
    } else if (isRentAdvanceRecord(rec.description)) {
      const advMeta = parseRentAdvanceDescription(rec.description, rec.month);
      advMeta?.months.forEach((m) => {
        if (/^\d{4}-\d{2}$/.test(m)) monthSet.add(m);
      });
    } else if (rec.description.startsWith('[বাসা ভাড়া]')) {
      const mMatch = rec.description.match(/মাস:(\d{4}-\d{2})/);
      if (mMatch?.[1]) monthSet.add(mMatch[1]);
    } else if (rec.month) {
      monthSet.add(rec.month);
    }
  }

  // Find earliest month in monthSet and add 1 immediate preceding unrecorded month
  const allRecordedMonths = Array.from(monthSet).sort((a, b) => a.localeCompare(b));
  const earliestMonth = allRecordedMonths[0] || selectedMonth;
  const prevUnrecordedMonth = getPreviousMonthISO(earliestMonth);
  monthSet.add(prevUnrecordedMonth);

  const sortedMonths = Array.from(monthSet)
    .sort((a, b) => b.localeCompare(a));

  return sortedMonths.map((month) => {
    const isCurrentMonth = month === selectedMonth;
    const monthRule = resolveRentRuleForMonth(rentRule, month);

    // 1. Check regular paid records for this month (either recorded in `month` or tagged with `মাস:${month}`)
    const baseRentRec =
      rentExpenses.find(
        (r) =>
          !isRentDueRecord(r.description) &&
          !isRentAdvanceRecord(r.description) &&
          r.description.startsWith('[বাসা ভাড়া]') &&
          matchesRentExpenseTargetMonth(r, month)
      ) ||
      rentExpenses.find(
        (r) =>
          r.month === month &&
          !isRentDueRecord(r.description) &&
          !isRentAdvanceRecord(r.description) &&
          !r.description.startsWith('[বাসা ভাড়া]') &&
          !r.description.startsWith('[বিদ্যুৎ বিল]') &&
          !r.description.startsWith('[গ্যাস বিল') &&
          !r.description.startsWith('[পানি ও অন্যান্য বিল]')
      );

    const elecRec = rentExpenses.find(
      (r) =>
        r.description.startsWith('[বিদ্যুৎ বিল]') &&
        matchesRentExpenseTargetMonth(r, month)
    );
    const gasLineRec = rentExpenses.find(
      (r) =>
        r.description.startsWith('[গ্যাস বিল - লাইন]') &&
        matchesRentExpenseTargetMonth(r, month)
    );
    const gasCylRec = rentExpenses.find(
      (r) =>
        r.description.startsWith('[গ্যাস বিল - সিলিন্ডার]') &&
        matchesRentExpenseTargetMonth(r, month)
    );
    const waterRec = rentExpenses.find(
      (r) =>
        r.description.startsWith('[পানি ও অন্যান্য বিল]') &&
        matchesRentExpenseTargetMonth(r, month)
    );

    // 2. Check unpaid/paid due records covering this month
    const matchingDueRecs = rentExpenses.filter((r) => {
      if (!isRentDueRecord(r.description)) return false;
      const meta = parseRentDueDescription(r.description, r.month);
      return Boolean(meta && meta.months.includes(month));
    });
    const unpaidDueRec = matchingDueRecs.find((r) => {
      const meta = parseRentDueDescription(r.description, r.month);
      return Boolean(meta && !meta.isPaid);
    });
    const paidDueRec = matchingDueRecs.find((r) => {
      const meta = parseRentDueDescription(r.description, r.month);
      return Boolean(meta && meta.isPaid);
    });

    // 3. Check advance records covering this month
    const matchingAdvanceRec = rentExpenses.find((r) => {
      if (!isRentAdvanceRecord(r.description)) return false;
      const meta = parseRentAdvanceDescription(r.description, r.month);
      return Boolean(meta && meta.months.includes(month));
    });

    // Resolve electricityAttached for THIS specific month independently
    let electricityAttached: boolean;
    if (elecRec && elecRec.amount > 0) {
      electricityAttached = false;
    } else if (baseRentRec?.description.includes('কারেন্ট বিল আলাদা')) {
      electricityAttached = false;
    } else if (baseRentRec?.description.includes('কারেন্ট বিল সংযুক্ত')) {
      electricityAttached = true;
    } else {
      electricityAttached = monthRule.electricityAttachedToRent;
    }

    // Resolve gasAttached and gasMode for THIS specific month independently
    let gasAttached: boolean;
    let gasMode: RentGasRuleMode;
    if (gasCylRec) {
      gasAttached = false;
      gasMode = 'cylinder';
    } else if (gasLineRec && gasLineRec.amount > 0) {
      gasAttached = false;
      gasMode = 'line_separate';
    } else if (baseRentRec?.description.includes('সিলিন্ডার গ্যাস')) {
      gasAttached = false;
      gasMode = 'cylinder';
    } else if (baseRentRec?.description.includes('লাইন গ্যাস আলাদা')) {
      gasAttached = false;
      gasMode = 'line_separate';
    } else if (
      baseRentRec?.description.includes('লাইন গ্যাস সংযুক্ত') ||
      baseRentRec?.description.includes('গ্যাস বিল')
    ) {
      gasAttached = true;
      gasMode = 'attached';
    } else {
      gasAttached = monthRule.gasMode === 'attached';
      gasMode = monthRule.gasMode;
    }

    let rentAmount =
      baseRentRec
        ? baseRentRec.amount > 0
          ? baseRentRec.amount
          : monthRule.fixedBaseRent || 3500
        : monthRule.fixedBaseRent || 0;
    let electricityAmount = electricityAttached
      ? 0
      : elecRec?.amount ?? monthRule.defaultElectricityAmount ?? 0;
    let gasAmount = gasAttached
      ? 0
      : gasCylRec?.amount ?? gasLineRec?.amount ?? monthRule.defaultGasAmount ?? 0;
    const waterOtherAmount =
      waterRec?.amount ?? (monthRule.waterAttachedToRent ? 0 : monthRule.defaultWaterAmount ?? 0);

    let status: MonthlyRentTableStatus = 'unpaid';
    let statusDetailBn = 'অপরিশোধিত';
    let statusDetailEn = 'Unpaid';

    if (unpaidDueRec) {
      const dueMeta = parseRentDueDescription(unpaidDueRec.description, unpaidDueRec.month)!;
      const perMonthShare = roundCurrency(
        dueMeta.dueAmount / Math.max(1, dueMeta.months.length)
      );
      if (dueMeta.itemType === 'house_rent' || dueMeta.itemType === 'combined') {
        rentAmount = perMonthShare;
      } else if (dueMeta.itemType === 'electricity') {
        electricityAttached = false;
        electricityAmount = perMonthShare;
      } else if (dueMeta.itemType === 'gas') {
        gasAttached = false;
        gasAmount = perMonthShare;
      }
      status = 'due';
      statusDetailBn = `বকেয়া (${getRentBillItemLabelBn(dueMeta.itemType)})`;
      statusDetailEn = `Arrears (${dueMeta.itemType})`;
    } else if (matchingAdvanceRec) {
      const advMeta = parseRentAdvanceDescription(
        matchingAdvanceRec.description,
        matchingAdvanceRec.month
      )!;
      const perMonthShare = roundCurrency(
        advMeta.advanceAmount / Math.max(1, advMeta.monthsCount)
      );
      if (advMeta.items.includes('house_rent') && !baseRentRec) {
        rentAmount = perMonthShare;
      }
      status = 'advance';
      statusDetailBn = `অগ্রিম (${toBengaliDigits(advMeta.monthsCount)} মাস)`;
      statusDetailEn = `Advance (${advMeta.monthsCount} mo)`;
    } else if (baseRentRec || paidDueRec || elecRec || gasLineRec || gasCylRec) {
      const inlineStatusMatch = baseRentRec?.description.match(/অবস্থা:(running|due|advance)/);
      if (inlineStatusMatch?.[1] === 'due') {
        status = 'due';
        statusDetailBn = 'বকেয়া';
        statusDetailEn = 'Arrears';
      } else if (inlineStatusMatch?.[1] === 'advance') {
        status = 'advance';
        statusDetailBn = 'অগ্রিম পরিশোধিত';
        statusDetailEn = 'Advance Paid';
      } else {
        status = 'paid';
        statusDetailBn = 'পরিশোধিত';
        statusDetailEn = 'Paid';
      }
    }

    const totalAmount = roundCurrency(
      (Number(rentAmount) || 0) +
        (electricityAttached ? 0 : Number(electricityAmount) || 0) +
        (gasAttached ? 0 : Number(gasAmount) || 0) +
        (Number(waterOtherAmount) || 0)
    );

    return {
      month,
      isCurrentMonth,
      rentAmount,
      electricityAmount,
      electricityAttached,
      gasAmount,
      gasAttached,
      gasMode,
      waterOtherAmount,
      totalAmount,
      status,
      statusDetailBn,
      statusDetailEn,
      unpaidDueRecordId: unpaidDueRec?.id,
    };
  });
}

export interface DailyEarnedSalaryResult {
  monthlyWage: number;
  dailyWageRate: number; // monthlyWage / 30
  attendedDaysCount: number; // present, late, approved_leave, weekly_holiday, public_holiday
  earnedBaseSalary: number; // attendedDaysCount * dailyWageRate (capped at monthlyWage)
  overtimeEarnings: number;
  earnedAttendanceBonus: number;
  otherAllowancesTotal: number;
  deductionsTotal: number;
  adjustmentsTotal: number;
  totalEarnedGross: number; // earnedBaseSalary + overtimeEarnings + earnedAttendanceBonus + otherAllowancesTotal
  totalEarnedSalary: number; // totalEarnedGross - deductionsTotal + adjustmentsTotal
  fullExpectedMonthlySalary: number;
  isFullMonthEarned: boolean;
  formulaNoteBn: string;
  formulaNoteEn: string;
}

/**
  * Calculates current earned base salary based on attendance days (monthly wage / 30 days * attended days)
  * plus overtime earnings and eligible attendance bonus (if bonus is missed, it is excluded).
  * When attendance is 0, earned base salary is 0.
  */
export function computeDailyEarnedSalary(params: {
  monthlyWage: number;
  attendanceRecords: AttendanceRecord[];
  overtimeEarnings: number;
  attendanceBonus: number;
  isAttendanceBonusEligible?: boolean;
  otherAllowances?: number;
  deductions?: number;
  adjustments?: number;
}): DailyEarnedSalaryResult {
  const monthlyWage = Math.max(0, Number(params.monthlyWage) || 0);
  const dailyWageRate = monthlyWage > 0 ? Math.round((monthlyWage / 30) * 100) / 100 : 0;

  const attendedDaysCount = (params.attendanceRecords || []).filter(
    (r) =>
      r.status === 'present' ||
      r.status === 'late' ||
      r.status === 'approved_leave' ||
      r.status === 'weekly_holiday' ||
      r.status === 'public_holiday'
  ).length;

  const earnedBaseSalary =
    attendedDaysCount >= 30
      ? monthlyWage
      : Math.min(monthlyWage, roundCurrency(attendedDaysCount * dailyWageRate));

  const overtimeEarnings = Math.max(0, Number(params.overtimeEarnings) || 0);
  const rawAttendanceBonus = Math.max(0, Number(params.attendanceBonus) || 0);
  const earnedAttendanceBonus =
    params.isAttendanceBonusEligible === false ? 0 : rawAttendanceBonus;
  const otherAllowancesTotal = Math.max(0, Number(params.otherAllowances) || 0);
  const deductionsTotal = Math.max(0, Number(params.deductions) || 0);
  const adjustmentsTotal = Number(params.adjustments) || 0;

  const totalEarnedGross = roundCurrency(
    earnedBaseSalary + overtimeEarnings + earnedAttendanceBonus + otherAllowancesTotal
  );

  const totalEarnedSalary = Math.max(
    0,
    roundCurrency(totalEarnedGross - deductionsTotal + adjustmentsTotal)
  );

  const fullExpectedMonthlySalary = Math.max(
    0,
    roundCurrency(
      monthlyWage +
        overtimeEarnings +
        earnedAttendanceBonus +
        otherAllowancesTotal -
        deductionsTotal +
        adjustmentsTotal
    )
  );

  const isFullMonthEarned = attendedDaysCount >= 30;

  return {
    monthlyWage,
    dailyWageRate,
    attendedDaysCount,
    earnedBaseSalary,
    overtimeEarnings,
    earnedAttendanceBonus,
    otherAllowancesTotal,
    deductionsTotal,
    adjustmentsTotal,
    totalEarnedGross,
    totalEarnedSalary,
    fullExpectedMonthlySalary,
    isFullMonthEarned,
    formulaNoteBn: `দৈনিক ৳${formatNumber(dailyWageRate, 'bn', 2)} × ${formatNumber(attendedDaysCount, 'bn')} দিন উপস্থিতি = ${formatBDT(earnedBaseSalary, 'bn')}`,
    formulaNoteEn: `Daily ৳${dailyWageRate.toFixed(2)} × ${attendedDaysCount} days attended = ৳${earnedBaseSalary}`,
  };
}


