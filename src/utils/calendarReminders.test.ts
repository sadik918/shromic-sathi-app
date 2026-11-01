import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIMARY_CALENDAR_CATEGORIES,
  computeReminderTriggerDateTime,
  doesReminderMatchCalendarDate,
  encodeCalendarReminderNotes,
  getCalendarCellBadgeMeta,
  getDateRemindersSectionTitle,
  getRemindersForCalendarDate,
  getRemindersForCalendarMonth,
  isCategoryAllowedOnDate,
  isPastCalendarDate,
  normalizeToPrimaryCalendarType,
  parseCalendarReminderMeta,
  parseCustomAlarmOffsetInput,
  stepMonthISO,
} from './calendarReminders';

describe('Calendar Reminders & 4-Category Item System (Task, Event, Birthday, Note)', () => {
  it('exposes exactly 4 primary categories: টাস্ক, ইভেন্ট, জন্মদিন, নোট', () => {
    assert.deepEqual(
      PRIMARY_CALENDAR_CATEGORIES.map((c) => c.id),
      ['task', 'event', 'birthday', 'note']
    );
    assert.deepEqual(
      PRIMARY_CALENDAR_CATEGORIES.map((c) => c.labelBn),
      ['টাস্ক', 'ইভেন্ট', 'জন্মদিন', 'নোট']
    );
  });

  it('normalizes legacy and primary event kinds into the 4 primary categories', () => {
    assert.equal(normalizeToPrimaryCalendarType('task'), 'task');
    assert.equal(normalizeToPrimaryCalendarType('event'), 'event');
    assert.equal(normalizeToPrimaryCalendarType('birthday'), 'birthday');
    assert.equal(normalizeToPrimaryCalendarType('note'), 'note');
    assert.equal(normalizeToPrimaryCalendarType('personal_note'), 'note');
    assert.equal(normalizeToPrimaryCalendarType('destination'), 'event');
    assert.equal(normalizeToPrimaryCalendarType('bill_payment'), 'task');
  });

  it('enforces past-date restriction for Task and Event while allowing Birthday and Note on any date', () => {
    const todayISO = '2026-10-31';
    const pastDate = '2026-10-04';
    const futureDate = '2026-11-04';

    assert.equal(isPastCalendarDate(pastDate, todayISO), true);
    assert.equal(isPastCalendarDate(todayISO, todayISO), false);
    assert.equal(isPastCalendarDate(futureDate, todayISO), false);

    // Past date (Oct 4 when today is Oct 31): Task & Event disallowed; Birthday & Note allowed
    assert.equal(isCategoryAllowedOnDate('task', pastDate, todayISO), false);
    assert.equal(isCategoryAllowedOnDate('event', pastDate, todayISO), false);
    assert.equal(isCategoryAllowedOnDate('birthday', pastDate, todayISO), true);
    assert.equal(isCategoryAllowedOnDate('note', pastDate, todayISO), true);

    // Today & Future dates: All 4 categories allowed
    assert.equal(isCategoryAllowedOnDate('task', todayISO, todayISO), true);
    assert.equal(isCategoryAllowedOnDate('event', todayISO, todayISO), true);
    assert.equal(isCategoryAllowedOnDate('task', futureDate, todayISO), true);
    assert.equal(isCategoryAllowedOnDate('event', futureDate, todayISO), true);
  });

  it('repeats Birthday entries every year on the same month and day (MM-DD)', () => {
    const bdayNotes = encodeCalendarReminderNotes(
      {
        eventKind: 'birthday',
        eventTime: '',
        hasTime: false,
        offsetType: 'days_before',
        offsetValue: 3,
        alarmEnabled: true,
        toneId: 'gentle_chime',
      },
      'মায়ের জন্মদিন'
    );
    const taskNotes = encodeCalendarReminderNotes(
      {
        eventKind: 'task',
        eventTime: '10:00',
        hasTime: true,
        offsetType: 'hours_before',
        offsetValue: 2,
        alarmEnabled: true,
        toneId: 'gentle_chime',
      },
      'জরুরি কাজ'
    );

    const bdayItem = { id: 'b1', title: 'মা', category: 'other' as const, dueDate: '1998-10-04', notes: bdayNotes };
    const taskItem = { id: 't1', title: 'অফিস ফাইল', category: 'other' as const, dueDate: '2026-10-31', notes: taskNotes };

    // Birthday set in 1998-10-04 matches 2026-10-04 and 2027-10-04
    assert.equal(doesReminderMatchCalendarDate(bdayItem, '2026-10-04'), true);
    assert.equal(doesReminderMatchCalendarDate(bdayItem, '2027-10-04'), true);
    assert.equal(doesReminderMatchCalendarDate(bdayItem, '2026-10-05'), false);

    // Task only matches exact year-month-day
    assert.equal(doesReminderMatchCalendarDate(taskItem, '2026-10-31'), true);
    assert.equal(doesReminderMatchCalendarDate(taskItem, '2027-10-31'), false);

    const oct4List = getRemindersForCalendarDate([bdayItem, taskItem], '2026-10-04');
    assert.equal(oct4List.length, 1);
    assert.equal(oct4List[0].id, 'b1');

    const oct2027MonthList = getRemindersForCalendarMonth([bdayItem, taskItem], '2027-10');
    assert.equal(oct2027MonthList.length, 1);
    assert.equal(oct2027MonthList[0].effectiveDate, '2027-10-04');
  });

  it('parses custom alarm offset text inputs like 1h, 2h, 1 hour, 3d, 7 days, ২ ঘণ্টা', () => {
    assert.deepEqual(parseCustomAlarmOffsetInput('1h'), { offsetType: 'hours_before', offsetValue: 1 });
    assert.deepEqual(parseCustomAlarmOffsetInput('2h'), { offsetType: 'hours_before', offsetValue: 2 });
    assert.deepEqual(parseCustomAlarmOffsetInput('1 hour'), { offsetType: 'hours_before', offsetValue: 1 });
    assert.deepEqual(parseCustomAlarmOffsetInput('5 hours'), { offsetType: 'hours_before', offsetValue: 5 });
    assert.deepEqual(parseCustomAlarmOffsetInput('৪ ঘণ্টা'), { offsetType: 'hours_before', offsetValue: 4 });
    assert.deepEqual(parseCustomAlarmOffsetInput('3d'), { offsetType: 'days_before', offsetValue: 3 });
    assert.deepEqual(parseCustomAlarmOffsetInput('7 days'), { offsetType: 'days_before', offsetValue: 7 });
    assert.deepEqual(parseCustomAlarmOffsetInput('২ দিন'), { offsetType: 'days_before', offsetValue: 2 });
    assert.deepEqual(parseCustomAlarmOffsetInput('6'), { offsetType: 'hours_before', offsetValue: 6 });
    assert.equal(parseCustomAlarmOffsetInput(''), null);
  });

  it('computes exact trigger date and time when on_time, hours_before, or days_before is selected', () => {
    const res1 = computeReminderTriggerDateTime('2026-11-15', '09:30', 'on_time', 0);
    assert.equal(res1.triggerDate, '2026-11-15');
    assert.equal(res1.triggerTime, '09:30');

    const res2 = computeReminderTriggerDateTime('2026-11-15', '14:00', 'hours_before', 2);
    assert.equal(res2.triggerDate, '2026-11-15');
    assert.equal(res2.triggerTime, '12:00');

    const res3 = computeReminderTriggerDateTime('2026-11-15', '09:00', 'days_before', 3);
    assert.equal(res3.triggerDate, '2026-11-12');
    assert.equal(res3.triggerTime, '09:00');
  });

  it('encodes and decodes calendar reminder metadata with optional time and reminder hours', () => {
    const encodedWithTime = encodeCalendarReminderNotes(
      {
        eventKind: 'birthday',
        eventTime: '10:00',
        hasTime: true,
        offsetType: 'days_before',
        offsetValue: 3,
        alarmEnabled: true,
        reminderEnabled: true,
        reminderHoursBefore: 5,
        toneId: 'morning_bell',
      },
      'মায়ের জন্মদিন, বাড়িতে ফোন দিতে হবে'
    );

    assert.ok(encodedWithTime.length <= 250);

    const parsed = parseCalendarReminderMeta({
      category: 'other',
      dueDate: '2026-11-15',
      notes: encodedWithTime,
    });

    assert.equal(parsed.eventKind, 'birthday');
    assert.equal(parsed.primaryType, 'birthday');
    assert.equal(parsed.eventKindLabelBn, 'জন্মদিন');
    assert.equal(parsed.hasTime, true);
    assert.equal(parsed.eventTime, '10:00');
    assert.equal(parsed.offsetType, 'days_before');
    assert.equal(parsed.offsetValue, 3);
    assert.equal(parsed.alarmEnabled, true);
    assert.equal(parsed.reminderEnabled, true);
    assert.equal(parsed.reminderHoursBefore, 5);
    assert.equal(parsed.toneId, 'morning_bell');
    assert.equal(parsed.cleanNotes, 'মায়ের জন্মদিন, বাড়িতে ফোন দিতে হবে');
    assert.equal(parsed.triggerDate, '2026-11-12');
    assert.equal(parsed.triggerTime, '10:00');

    // Without time
    const encodedNoTime = encodeCalendarReminderNotes(
      {
        eventKind: 'task',
        eventTime: '',
        hasTime: false,
        offsetType: 'hours_before',
        offsetValue: 2,
        alarmEnabled: false,
        reminderEnabled: false,
        reminderHoursBefore: 2,
        toneId: 'gentle_chime',
      },
      'নোট ছাড়া টাস্ক'
    );
    const parsedNoTime = parseCalendarReminderMeta({
      category: 'other',
      dueDate: '2026-11-15',
      notes: encodedNoTime,
    });
    assert.equal(parsedNoTime.hasTime, false);
    assert.equal(parsedNoTime.alarmEnabled, false);
    assert.equal(parsedNoTime.reminderEnabled, false);
  });

  it('generates dynamic section headers based on active category or saved items', () => {
    assert.equal(getDateRemindersSectionTitle([], true, 'birthday', 'bn'), 'এই তারিখের জন্মদিন');
    assert.equal(getDateRemindersSectionTitle([], true, 'task', 'bn'), 'এই তারিখের টাস্ক');
    assert.equal(getDateRemindersSectionTitle([], true, 'event', 'bn'), 'এই তারিখের ইভেন্ট');
    assert.equal(getDateRemindersSectionTitle([], true, 'note', 'bn'), 'এই তারিখের নোট');

    const bdayNotes = encodeCalendarReminderNotes(
      {
        eventKind: 'birthday',
        eventTime: '09:00',
        hasTime: true,
        offsetType: 'days_before',
        offsetValue: 3,
        alarmEnabled: true,
        toneId: 'gentle_chime',
      },
      ''
    );
    assert.equal(
      getDateRemindersSectionTitle(
        [{ category: 'other', dueDate: '2026-10-10', notes: bdayNotes }],
        false,
        'note',
        'bn'
      ),
      'এই তারিখের জন্মদিন'
    );

    const cellBadge = getCalendarCellBadgeMeta([
      { category: 'other', dueDate: '2026-10-10', notes: bdayNotes },
    ]);
    assert.equal(cellBadge.primaryType, 'birthday');
    assert.equal(cellBadge.labelBn, 'জন্মদিন');
  });

  it('steps month ISO forward and backward across year boundaries', () => {
    assert.equal(stepMonthISO('2026-10', 1), '2026-11');
    assert.equal(stepMonthISO('2026-12', 1), '2027-01');
    assert.equal(stepMonthISO('2026-01', -1), '2025-12');
  });
});
