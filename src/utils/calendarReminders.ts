import type { ReminderCategory, ReminderItem } from '../types';
import { toBengaliDigits } from './calculations';

export type PrimaryCalendarItemType = 'task' | 'event' | 'birthday' | 'note';

export type CalendarEventKind =
  | PrimaryCalendarItemType
  | 'destination'
  | 'personal_note'
  | 'salary_date'
  | 'bill_payment'
  | 'monthly_review'
  | 'other';

export type ReminderOffsetType = 'on_time' | 'hours_before' | 'days_before';

export type CalendarAlarmToneId =
  | 'gentle_chime'
  | 'morning_bell'
  | 'digital_beep'
  | 'factory_siren';

export interface CalendarReminderMeta {
  eventKind: CalendarEventKind;
  eventTime: string; // HH:mm or '' when no time is set
  hasTime?: boolean;
  offsetType: ReminderOffsetType;
  offsetValue: number;
  alarmEnabled: boolean;
  reminderEnabled?: boolean;
  reminderHoursBefore?: number;
  toneId: CalendarAlarmToneId;
  cleanNotes: string;
}

export interface ParsedCalendarReminder extends CalendarReminderMeta {
  primaryType: PrimaryCalendarItemType;
  hasTime: boolean;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  triggerDate: string; // YYYY-MM-DD
  triggerTime: string; // HH:mm
  offsetLabelBn: string;
  offsetLabelEn: string;
  eventKindLabelBn: string;
  eventKindLabelEn: string;
  shortLabelBn: string;
  shortLabelEn: string;
  eventBadgeColor: string;
}

export interface PrimaryCategoryConfig {
  id: PrimaryCalendarItemType;
  labelBn: string;
  labelEn: string;
  shortBn: string;
  shortEn: string;
  badgeColor: string;
  cellBadgeColor: string;
  cardBorderColor: string;
  addHeaderBn: string;
  addHeaderEn: string;
  editHeaderBn: string;
  editHeaderEn: string;
  titleLabelBn: string;
  titleLabelEn: string;
  titlePlaceholderBn: string;
  titlePlaceholderEn: string;
  notesLabelBn: string;
  notesLabelEn: string;
  notesPlaceholderBn: string;
  notesPlaceholderEn: string;
  dateLabelBn: string;
  dateLabelEn: string;
  suggestionsBn: string[];
}

export const PRIMARY_CALENDAR_CATEGORIES: PrimaryCategoryConfig[] = [
  {
    id: 'task',
    labelBn: 'টাস্ক',
    labelEn: 'Task',
    shortBn: 'টাস্ক',
    shortEn: 'Task',
    badgeColor:
      'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    cellBadgeColor: 'bg-amber-600 text-white',
    cardBorderColor: 'border-amber-200/90 dark:border-amber-800/70',
    addHeaderBn: 'টাস্ক যোগ করুন',
    addHeaderEn: 'Add Task',
    editHeaderBn: 'টাস্ক এডিট করুন',
    editHeaderEn: 'Edit Task',
    titleLabelBn: 'টাস্কের নাম (চেকবক্সে টিক দেওয়া যাবে)',
    titleLabelEn: 'Task Title (Checkable item)',
    titlePlaceholderBn: 'কী কাজ করতে হবে লিখুন...',
    titlePlaceholderEn: 'Enter task to complete...',
    notesLabelBn: 'টাস্কের বিস্তারিত বিবরণ (ঐচ্ছিক)',
    notesLabelEn: 'Task Details (Optional)',
    notesPlaceholderBn: 'টাস্ক সম্পর্কে অতিরিক্ত তথ্য থাকলে লিখুন...',
    notesPlaceholderEn: 'Add any extra task details...',
    dateLabelBn: 'টাস্কের তারিখ',
    dateLabelEn: 'Task Date',
    suggestionsBn: ['জরুরি ব্যক্তিগত কাজ', 'বাসা ভাড়া ও বিল পরিশোধ', 'অফিসে কাগজ জমা দেওয়া'],
  },
  {
    id: 'event',
    labelBn: 'ইভেন্ট',
    labelEn: 'Event',
    shortBn: 'ইভেন্ট',
    shortEn: 'Event',
    badgeColor:
      'bg-sky-100 text-sky-900 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300 dark:border-sky-800',
    cellBadgeColor: 'bg-sky-600 text-white',
    cardBorderColor: 'border-sky-200/90 dark:border-sky-800/70',
    addHeaderBn: 'ইভেন্ট যোগ করুন',
    addHeaderEn: 'Add Event',
    editHeaderBn: 'ইভেন্ট এডিট করুন',
    editHeaderEn: 'Edit Event',
    titleLabelBn: 'ইভেন্টের নাম ও উপলক্ষ',
    titleLabelEn: 'Event Name & Occasion',
    titlePlaceholderBn: 'ইভেন্টের নাম লিখুন (যেমন: দাওয়াত / মিটিং / ভ্রমণ)...',
    titlePlaceholderEn: 'Enter event name...',
    notesLabelBn: 'ইভেন্টের স্থান বা বিস্তারিত (ঐচ্ছিক)',
    notesLabelEn: 'Event Location / Details (Optional)',
    notesPlaceholderBn: 'ইভেন্ট কোথায় হবে বা বিস্তারিত তথ্য লিখুন...',
    notesPlaceholderEn: 'Write event location or details...',
    dateLabelBn: 'ইভেন্টের তারিখ',
    dateLabelEn: 'Event Date',
    suggestionsBn: ['বিশেষ দাওয়াত বা অনুষ্ঠান', 'গ্রামে / বাড়িতে যাওয়া', 'ডাক্তারের অ্যাপয়েন্টমেন্ট'],
  },
  {
    id: 'birthday',
    labelBn: 'জন্মদিন',
    labelEn: 'Birthday',
    shortBn: 'জন্মদিন',
    shortEn: 'Birthday',
    badgeColor:
      'bg-pink-100 text-pink-900 dark:bg-pink-950/80 dark:text-pink-300 border-pink-300 dark:border-pink-800',
    cellBadgeColor: 'bg-pink-600 text-white',
    cardBorderColor: 'border-pink-200/90 dark:border-pink-800/70',
    addHeaderBn: 'জন্মদিন যোগ করুন',
    addHeaderEn: 'Add Birthday',
    editHeaderBn: 'জন্মদিন এডিট করুন',
    editHeaderEn: 'Edit Birthday',
    titleLabelBn: 'কার জন্মদিন? (প্রিয়জনের নাম বা সম্পর্ক)',
    titleLabelEn: 'Whose Birthday? (Name or Relation)',
    titlePlaceholderBn: 'কার জন্মদিন লিখুন (যেমন: মা, বাবা, আদনান, প্রিয়জন)...',
    titlePlaceholderEn: 'Whose birthday is it? (e.g. Mother, Father, Child)...',
    notesLabelBn: 'জন্মদিনের নোট বা উপহারের পরিকল্পনা (ঐচ্ছিক)',
    notesLabelEn: 'Birthday Note / Gift Plan (Optional)',
    notesPlaceholderBn: 'শুভেচ্ছা জানানো বা উপহারের কথা লিখে রাখুন...',
    notesPlaceholderEn: 'Add birthday wishes or gift plans...',
    dateLabelBn: 'কত তারিখ জন্মদিন?',
    dateLabelEn: 'Birthday Date',
    suggestionsBn: ['মায়ের জন্মদিন', 'বাবার জন্মদিন', 'সন্তানের জন্মদিন', 'প্রিয়জনের জন্মদিন'],
  },
  {
    id: 'note',
    labelBn: 'নোট',
    labelEn: 'Note',
    shortBn: 'নোট',
    shortEn: 'Note',
    badgeColor:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    cellBadgeColor: 'bg-emerald-600 text-white',
    cardBorderColor: 'border-emerald-200/90 dark:border-emerald-800/70',
    addHeaderBn: 'নোট যোগ করুন',
    addHeaderEn: 'Add Note',
    editHeaderBn: 'নোট এডিট করুন',
    editHeaderEn: 'Edit Note',
    titleLabelBn: 'নোটের শিরোনাম বা বিষয়',
    titleLabelEn: 'Note Title',
    titlePlaceholderBn: 'এখানে আপনার নোট লিখুন...',
    titlePlaceholderEn: 'Write your note title...',
    notesLabelBn: 'বিস্তারিত নোট (ঐচ্ছিক)',
    notesLabelEn: 'Detailed Note (Optional)',
    notesPlaceholderBn: 'বিস্তারিত ডায়েরি বা নোট এখানে লিখুন...',
    notesPlaceholderEn: 'Write detailed note here...',
    dateLabelBn: 'নোটের তারিখ',
    dateLabelEn: 'Note Date',
    suggestionsBn: ['জরুরি ব্যক্তিগত নোট', 'বাড়িতে টাকা পাঠানোর হিসাব', 'প্রয়োজনীয় ডায়েরি নোট'],
  },
];

// Keep CALENDAR_EVENT_KINDS exported for backwards compatibility
export const CALENDAR_EVENT_KINDS = PRIMARY_CALENDAR_CATEGORIES;

export function normalizeToPrimaryCalendarType(
  kind: CalendarEventKind | string | undefined
): PrimaryCalendarItemType {
  if (kind === 'birthday') return 'birthday';
  if (kind === 'event' || kind === 'destination') return 'event';
  if (
    kind === 'task' ||
    kind === 'bill_payment' ||
    kind === 'salary_date' ||
    kind === 'monthly_review' ||
    kind === 'other'
  ) {
    return 'task';
  }
  return 'note';
}

export function getPrimaryCategoryConfig(
  kind: CalendarEventKind | string | undefined
): PrimaryCategoryConfig {
  const primary = normalizeToPrimaryCalendarType(kind);
  return (
    PRIMARY_CALENDAR_CATEGORIES.find((c) => c.id === primary) || PRIMARY_CALENDAR_CATEGORIES[3]
  );
}

/**
 * Checks whether a calendar date (YYYY-MM-DD) is strictly in the past compared to todayISO (YYYY-MM-DD).
 */
export function isPastCalendarDate(dateISO: string, todayISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !/^\d{4}-\d{2}-\d{2}$/.test(todayISO)) {
    return false;
  }
  return dateISO < todayISO;
}

/**
 * Determines whether a category can be created/scheduled on the given date.
 * - 'task' (টাস্ক) and 'event' (ইভেন্ট) CANNOT be set on past dates (must be >= todayISO).
 * - 'birthday' (জন্মদিন) and 'note' (নোট) CAN be set on any date (past, present, or future).
 */
export function isCategoryAllowedOnDate(
  category: PrimaryCalendarItemType,
  dateISO: string,
  todayISO: string
): boolean {
  if (category === 'task' || category === 'event') {
    return !isPastCalendarDate(dateISO, todayISO);
  }
  return true;
}

/**
 * Parses user-entered custom alarm offset text like "1h", "2h", "1 hour", "5 hours",
 * "3d", "7 days", "২ ঘণ্টা", "৪ দিন", or a plain number (defaults to hours_before).
 */
export function parseCustomAlarmOffsetInput(
  rawInput: string,
  fallbackUnit: 'hours_before' | 'days_before' = 'hours_before'
): { offsetType: 'hours_before' | 'days_before'; offsetValue: number } | null {
  if (!rawInput || typeof rawInput !== 'string') return null;

  // Convert Bengali digits (০-৯) to ASCII (0-9)
  const normalized = rawInput
    .trim()
    .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
    .toLowerCase();

  const numMatch = normalized.match(/(\d+)/);
  if (!numMatch) return null;

  const val = Math.max(1, Math.min(365, parseInt(numMatch[1], 10)));
  if (!Number.isFinite(val) || val <= 0) return null;

  // Check if user specified days (d, day, days, দিন, দি)
  if (/(?:d|day|days|দিন|দি)\b/.test(normalized) || normalized.includes('দিন') || /\d+\s*d/.test(normalized)) {
    return { offsetType: 'days_before', offsetValue: Math.min(60, val) };
  }

  // Check if user specified hours (h, hr, hrs, hour, hours, ঘণ্টা, ঘন্টা, ঘঃ)
  if (
    /(?:h|hr|hrs|hour|hours)\b/.test(normalized) ||
    normalized.includes('ঘণ্টা') ||
    normalized.includes('ঘন্টা') ||
    normalized.includes('ঘঃ') ||
    /\d+\s*h/.test(normalized)
  ) {
    return { offsetType: 'hours_before', offsetValue: Math.min(168, val) };
  }

  return {
    offsetType: fallbackUnit,
    offsetValue: fallbackUnit === 'days_before' ? Math.min(60, val) : Math.min(168, val),
  };
}

/**
 * Matches whether a saved reminder applies to a specific calendar date (YYYY-MM-DD).
 * - Birthdays ('birthday') repeat EVERY YEAR on the same month and day (MM-DD).
 * - Tasks, Events, and Notes match the exact YYYY-MM-DD date.
 */
export function doesReminderMatchCalendarDate(
  reminder: Pick<ReminderItem, 'category' | 'dueDate' | 'notes'>,
  targetDateISO: string
): boolean {
  if (!reminder?.dueDate || !targetDateISO) return false;
  if (reminder.dueDate === targetDateISO) return true;

  const parsed = parseCalendarReminderMeta(reminder);
  if (parsed.primaryType === 'birthday') {
    // Match MM-DD across any year
    return reminder.dueDate.slice(5, 10) === targetDateISO.slice(5, 10);
  }
  return false;
}

/**
 * Filters all reminders for a given calendar date (including yearly repeating birthdays).
 */
export function getRemindersForCalendarDate<T extends Pick<ReminderItem, 'category' | 'dueDate' | 'notes'>>(
  reminders: T[],
  targetDateISO: string
): T[] {
  return reminders.filter((r) => doesReminderMatchCalendarDate(r, targetDateISO));
}

/**
 * Filters all reminders for a given calendar month (YYYY-MM), including yearly repeating birthdays
 * whose month matches MM, projecting their effective date in that month for sorting/jumping.
 */
export function getRemindersForCalendarMonth<T extends Pick<ReminderItem, 'category' | 'dueDate' | 'notes'>>(
  reminders: T[],
  monthISO: string
): Array<{ item: T; effectiveDate: string }> {
  if (!/^\d{4}-\d{2}$/.test(monthISO)) return [];
  const targetMonthPart = monthISO.slice(5, 7);

  const results: Array<{ item: T; effectiveDate: string }> = [];
  for (const r of reminders) {
    if (!r.dueDate) continue;
    if (r.dueDate.startsWith(monthISO)) {
      results.push({ item: r, effectiveDate: r.dueDate });
      continue;
    }
    const parsed = parseCalendarReminderMeta(r);
    if (parsed.primaryType === 'birthday' && r.dueDate.slice(5, 7) === targetMonthPart) {
      const dayPart = r.dueDate.slice(8, 10);
      results.push({ item: r, effectiveDate: `${monthISO}-${dayPart}` });
    }
  }

  return results.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

export const REMINDER_LEAD_TIME_PRESETS: Array<{
  id: string;
  offsetType: ReminderOffsetType;
  offsetValue: number;
  labelBn: string;
  labelEn: string;
}> = [
  {
    id: 'hours_before_2',
    offsetType: 'hours_before',
    offsetValue: 2,
    labelBn: '২ ঘণ্টা আগে',
    labelEn: '2 hours before',
  },
  {
    id: 'days_before_3',
    offsetType: 'days_before',
    offsetValue: 3,
    labelBn: '৩ দিন আগে',
    labelEn: '3 days before',
  },
];

export function mapEventKindToFirestoreCategory(kind: CalendarEventKind): ReminderCategory {
  if (kind === 'salary_date' || kind === 'bill_payment' || kind === 'monthly_review') {
    return kind;
  }
  return 'other';
}

/**
 * Pure deterministic calculation of exact trigger date (YYYY-MM-DD) and time (HH:mm)
 * given the target event date, event time, and lead-time offset (on_time, hours_before, days_before).
 */
export function computeReminderTriggerDateTime(
  dueDate: string,
  eventTime: string,
  offsetType: ReminderOffsetType,
  offsetValue: number
): { triggerDate: string; triggerTime: string } {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : '2026-10-31';
  const cleanTime = /^\d{2}:\d{2}$/.test(eventTime) ? eventTime : '09:00';
  const safeVal = Math.max(0, Math.floor(Number(offsetValue) || 0));

  if (offsetType === 'on_time' || safeVal === 0) {
    return { triggerDate: cleanDate, triggerTime: cleanTime };
  }

  const [y, m, d] = cleanDate.split('-').map(Number);
  const [hh, mm] = cleanTime.split(':').map(Number);

  // Use UTC timestamp arithmetic so host timezone never skews date/hour subtraction
  const baseMs = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  const subtractMs =
    offsetType === 'days_before'
      ? safeVal * 24 * 60 * 60 * 1000
      : safeVal * 60 * 60 * 1000;

  const targetDt = new Date(baseMs - subtractMs);
  const ty = targetDt.getUTCFullYear();
  const tm = String(targetDt.getUTCMonth() + 1).padStart(2, '0');
  const td = String(targetDt.getUTCDate()).padStart(2, '0');
  const thh = String(targetDt.getUTCHours()).padStart(2, '0');
  const tmm = String(targetDt.getUTCMinutes()).padStart(2, '0');

  return {
    triggerDate: `${ty}-${tm}-${td}`,
    triggerTime: `${thh}:${tmm}`,
  };
}

export function formatOffsetLabel(
  offsetType: ReminderOffsetType,
  offsetValue: number
): { bn: string; en: string } {
  const val = Math.max(0, Math.floor(Number(offsetValue) || 0));
  if (offsetType === 'on_time' || val === 0) {
    return {
      bn: 'নির্ধারিত সময়ে',
      en: 'On time',
    };
  }
  if (offsetType === 'days_before') {
    return {
      bn: `${toBengaliDigits(val)} দিন আগে`,
      en: `${val} day${val > 1 ? 's' : ''} before`,
    };
  }
  return {
    bn: `${toBengaliDigits(val)} ঘণ্টা আগে`,
    en: `${val} hr${val > 1 ? 's' : ''} before`,
  };
}

export function encodeCalendarReminderNotes(
  meta: Omit<CalendarReminderMeta, 'cleanNotes'>,
  userNotes: string
): string {
  const hasExplicitTime =
    meta.hasTime !== undefined
      ? meta.hasTime && /^\d{2}:\d{2}$/.test(meta.eventTime)
      : /^\d{2}:\d{2}$/.test(meta.eventTime);
  const safeTimeToken = hasExplicitTime ? meta.eventTime : 'none';
  const safeVal = Math.max(0, Math.floor(Number(meta.offsetValue) || 0));
  const alarmFlag = meta.alarmEnabled ? '1' : '0';
  const tone = meta.toneId || 'gentle_chime';
  const remFlag = meta.reminderEnabled ? `|R:${Math.max(1, Math.floor(Number(meta.reminderHoursBefore) || 2))}` : '|R:0';
  const prefix = `[CAL:${meta.eventKind}|${safeTimeToken}|${meta.offsetType}:${safeVal}|${alarmFlag}|${tone}${remFlag}]`;
  const trimmedNote = (userNotes || '').trim();
  const combined = trimmedNote ? `${prefix} ${trimmedNote}` : prefix;
  return combined.slice(0, 250);
}

const CAL_META_REGEX =
  /^\[CAL:([a-z_]+)\|(\d{2}:\d{2}|none)\|(on_time|hours_before|days_before):(\d+)\|(0|1)\|([a-z_]+)(?:\|R:(\d+))?\]\s*(.*)$/s;

export function parseCalendarReminderMeta(
  reminder: Pick<ReminderItem, 'category' | 'dueDate' | 'notes'>
): ParsedCalendarReminder {
  const rawNotes = reminder.notes || '';
  const match = rawNotes.match(CAL_META_REGEX);

  let eventKind: CalendarEventKind =
    reminder.category === 'salary_date' ||
    reminder.category === 'bill_payment' ||
    reminder.category === 'monthly_review'
      ? reminder.category
      : 'note';
  let eventTime = '09:00';
  let hasTime = false;
  let offsetType: ReminderOffsetType = 'hours_before';
  let offsetValue = 2;
  let alarmEnabled = false;
  let reminderEnabled = false;
  let reminderHoursBefore = 2;
  let toneId: CalendarAlarmToneId = 'gentle_chime';
  let cleanNotes = rawNotes;

  if (match) {
    eventKind = (match[1] as CalendarEventKind) || 'note';
    const rawTime = match[2] || 'none';
    hasTime = rawTime !== 'none' && /^\d{2}:\d{2}$/.test(rawTime);
    eventTime = hasTime ? rawTime : '09:00';
    offsetType = (match[3] as ReminderOffsetType) || 'hours_before';
    offsetValue = Number(match[4]) || 0;
    alarmEnabled = match[5] === '1';
    toneId = (match[6] as CalendarAlarmToneId) || 'gentle_chime';
    if (match[7] !== undefined) {
      const rHours = Number(match[7]) || 0;
      reminderEnabled = rHours > 0;
      reminderHoursBefore = rHours > 0 ? rHours : 2;
    } else {
      reminderEnabled = false;
      reminderHoursBefore = 2;
    }
    cleanNotes = (match[8] || '').trim();
  }

  const { triggerDate, triggerTime } = computeReminderTriggerDateTime(
    reminder.dueDate,
    eventTime,
    offsetType,
    offsetValue
  );

  const offsetLabels = formatOffsetLabel(offsetType, offsetValue);
  const primaryType = normalizeToPrimaryCalendarType(eventKind);
  const kindMeta = getPrimaryCategoryConfig(primaryType);

  return {
    eventKind,
    primaryType,
    eventTime,
    hasTime,
    offsetType,
    offsetValue,
    alarmEnabled,
    reminderEnabled,
    reminderHoursBefore,
    toneId,
    cleanNotes,
    triggerDate,
    triggerTime,
    offsetLabelBn: offsetLabels.bn,
    offsetLabelEn: offsetLabels.en,
    eventKindLabelBn: kindMeta.labelBn,
    eventKindLabelEn: kindMeta.labelEn,
    shortLabelBn: kindMeta.shortBn,
    shortLabelEn: kindMeta.shortEn,
    eventBadgeColor: kindMeta.badgeColor,
  };
}

/**
 * Computes the dynamic section header for a selected calendar date based on:
 * - whether the Add/Edit form is open and which of the 4 categories is selected
 * - or what items are saved on that date.
 */
export function getDateRemindersSectionTitle(
  dateReminders: Array<Pick<ReminderItem, 'category' | 'dueDate' | 'notes'>>,
  isFormOpen: boolean,
  activeCategory: PrimaryCalendarItemType,
  lang: 'bn' | 'en'
): string {
  if (isFormOpen) {
    const cfg = getPrimaryCategoryConfig(activeCategory);
    return lang === 'bn' ? `এই তারিখের ${cfg.labelBn}` : `${cfg.labelEn} on this Date`;
  }

  if (dateReminders.length > 0) {
    const seen = new Set<PrimaryCalendarItemType>();
    for (const r of dateReminders) {
      const parsed = parseCalendarReminderMeta(r);
      seen.add(parsed.primaryType);
    }
    const ordered = PRIMARY_CALENDAR_CATEGORIES.filter((c) => seen.has(c.id));
    if (ordered.length === 1) {
      return lang === 'bn'
        ? `এই তারিখের ${ordered[0].labelBn}`
        : `${ordered[0].labelEn} on this Date`;
    }
    if (ordered.length > 1) {
      if (lang === 'bn') {
        const names = ordered.map((c) => c.labelBn);
        const last = names[names.length - 1];
        const rest = names.slice(0, -1).join(', ');
        return `এই তারিখের ${rest} ও ${last}`;
      }
      return `${ordered.map((c) => c.labelEn).join(' & ')} on this Date`;
    }
  }

  return lang === 'bn'
    ? 'এই তারিখের টাস্ক, ইভেন্ট, জন্মদিন ও নোট'
    : 'Tasks, Events, Birthdays & Notes on this Date';
}

/**
 * Returns the badge label and color for a calendar cell when one or more items exist on that date.
 */
export function getCalendarCellBadgeMeta(
  dayReminders: Array<Pick<ReminderItem, 'category' | 'dueDate' | 'notes'>>
): {
  primaryType: PrimaryCalendarItemType;
  labelBn: string;
  labelEn: string;
  cellBadgeColor: string;
} {
  if (!dayReminders || dayReminders.length === 0) {
    const fallback = getPrimaryCategoryConfig('note');
    return {
      primaryType: 'note',
      labelBn: fallback.shortBn,
      labelEn: fallback.shortEn,
      cellBadgeColor: fallback.cellBadgeColor,
    };
  }
  // Prioritize birthday > event > task > note when multiple exist on the same cell
  const priorityOrder: PrimaryCalendarItemType[] = ['birthday', 'event', 'task', 'note'];
  const parsedTypes = dayReminders.map((r) => parseCalendarReminderMeta(r).primaryType);
  const chosen =
    priorityOrder.find((p) => parsedTypes.includes(p)) || parsedTypes[0] || 'note';
  const cfg = getPrimaryCategoryConfig(chosen);
  return {
    primaryType: chosen,
    labelBn: cfg.shortBn,
    labelEn: cfg.shortEn,
    cellBadgeColor: cfg.cellBadgeColor,
  };
}

export function stepMonthISO(monthISO: string, deltaMonths: number): string {
  const [yStr, mStr] = monthISO.split('-');
  const y = Number(yStr) || 2026;
  const m = Number(mStr) || 10;
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}
