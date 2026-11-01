import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellOff,
  Cake,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit2,
  FileText,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { ReminderItem } from '../types';
import { formatBengaliTime } from './AlarmView';
import { DateInputDMY } from './DateInputDMY';
import {
  PRIMARY_CALENDAR_CATEGORIES,
  type CalendarAlarmToneId,
  type PrimaryCalendarItemType,
  type ReminderOffsetType,
  computeReminderTriggerDateTime,
  encodeCalendarReminderNotes,
  formatOffsetLabel,
  getDateRemindersSectionTitle,
  getPrimaryCategoryConfig,
  getRemindersForCalendarDate,
  getRemindersForCalendarMonth,
  isCategoryAllowedOnDate,
  isPastCalendarDate,
  mapEventKindToFirestoreCategory,
  parseCalendarReminderMeta,
  parseCustomAlarmOffsetInput,
} from '../utils/calendarReminders';
import { formatNumber, toBengaliDigits } from '../utils/calculations';
import { formatDateReadable, formatDateSlashDMY } from '../utils/i18n';

interface CalendarDateReminderSectionProps {
  selectedDate: string; // YYYY-MM-DD
  selectedMonth: string; // YYYY-MM
  onSelectDate: (dateISO: string) => void;
  testIdPrefix: 'home-cal' | 'att-cal';
  readOnly?: boolean;
}

export const CalendarDateReminderSection: React.FC<CalendarDateReminderSectionProps> = ({
  selectedDate,
  selectedMonth,
  onSelectDate,
  testIdPrefix,
  readOnly = false,
}) => {
  const isReadOnly = readOnly || testIdPrefix === 'home-cal';
  const { lang, todayISO, reminders, saveReminder, toggleReminder, deleteReminder } = useData();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(selectedDate);
  const [selectedCategory, setSelectedCategory] = useState<PrimaryCalendarItemType>('task');
  const [title, setTitle] = useState('');
  const [userNotes, setUserNotes] = useState('');

  // Optional Time ("টাইম যোগ করুন") — hidden by default until user clicks "টাইম যোগ করুন"
  const [hasCustomTime, setHasCustomTime] = useState(false);
  const [eventTime, setEventTime] = useState('09:00');

  // Alarm ("এলার্ম বাজে?") with Enable/Disable toggle, 2 presets ("২ ঘণ্টা আগে", "৩ দিন আগে"), and "+" custom form
  const [alarmEnabled, setAlarmEnabled] = useState<boolean>(true);
  const [offsetType, setOffsetType] = useState<ReminderOffsetType>('hours_before');
  const [offsetValue, setOffsetValue] = useState<number>(2);
  const [showCustomAlarmForm, setShowCustomAlarmForm] = useState<boolean>(false);
  const [customAlarmText, setCustomAlarmText] = useState<string>('');

  // Reminder ("রিমাইন্ডার") with Enable/Disable toggle and hours-before option
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(false);
  const [reminderHoursBefore, setReminderHoursBefore] = useState<number>(2);

  const [toneId, setToneId] = useState<CalendarAlarmToneId>('gentle_chime');
  const [toastMsg, setToastMsg] = useState('');
  const [formErrorMsg, setFormErrorMsg] = useState('');

  const isTargetDatePast = isPastCalendarDate(targetDate, todayISO);

  // Keep form targetDate synced when user clicks a different date on the calendar (unless editing a specific record)
  useEffect(() => {
    if (!editingReminderId) {
      setTargetDate(selectedDate);
      if (isPastCalendarDate(selectedDate, todayISO)) {
        setSelectedCategory((prev) => (prev === 'task' || prev === 'event' ? 'note' : prev));
      }
    }
  }, [selectedDate, editingReminderId, todayISO]);

  // If targetDate becomes a past date while 'task' or 'event' is selected, switch to 'note'
  useEffect(() => {
    if (isPastCalendarDate(targetDate, todayISO) && (selectedCategory === 'task' || selectedCategory === 'event')) {
      setSelectedCategory('note');
    }
  }, [targetDate, todayISO, selectedCategory]);

  // Include yearly repeating birthdays for the selected date and month
  const dateReminders = getRemindersForCalendarDate(reminders, selectedDate);
  const monthRemindersWithDates = getRemindersForCalendarMonth(reminders, selectedMonth);

  const activeCategoryConfig = getPrimaryCategoryConfig(selectedCategory);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const resetForm = (forDate = selectedDate, requestedCat: PrimaryCalendarItemType = 'task') => {
    const past = isPastCalendarDate(forDate, todayISO);
    const safeCat: PrimaryCalendarItemType =
      past && (requestedCat === 'task' || requestedCat === 'event') ? 'note' : requestedCat;

    setEditingReminderId(null);
    setTargetDate(forDate);
    setSelectedCategory(safeCat);
    setTitle('');
    setUserNotes('');
    setHasCustomTime(false);
    setEventTime('09:00');
    setAlarmEnabled(true);
    setOffsetType('hours_before');
    setOffsetValue(2);
    setShowCustomAlarmForm(false);
    setCustomAlarmText('');
    setReminderEnabled(false);
    setReminderHoursBefore(2);
    setToneId('gentle_chime');
    setFormErrorMsg('');
  };

  const handleOpenAddForm = (initialCat: PrimaryCalendarItemType = selectedCategory) => {
    if (isReadOnly) return;
    resetForm(selectedDate, initialCat);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item: ReminderItem) => {
    if (isReadOnly) return;
    const parsed = parseCalendarReminderMeta(item);
    setEditingReminderId(item.id);
    setTargetDate(item.dueDate);
    setSelectedCategory(parsed.primaryType);
    setTitle(item.title);
    setUserNotes(parsed.cleanNotes);
    setHasCustomTime(parsed.hasTime);
    setEventTime(parsed.eventTime || '09:00');
    setOffsetType(parsed.offsetType === 'on_time' ? 'hours_before' : parsed.offsetType);
    setOffsetValue(parsed.offsetValue > 0 ? parsed.offsetValue : 2);
    setAlarmEnabled(parsed.alarmEnabled);
    setShowCustomAlarmForm(false);
    setCustomAlarmText('');
    setReminderEnabled(parsed.reminderEnabled);
    setReminderHoursBefore(parsed.reminderHoursBefore || 2);
    setToneId(parsed.toneId);
    setFormErrorMsg('');
    setIsFormOpen(true);
  };

  const handleCustomAlarmTextChange = (val: string) => {
    setCustomAlarmText(val);
    const parsed = parseCustomAlarmOffsetInput(val);
    if (parsed) {
      setOffsetType(parsed.offsetType);
      setOffsetValue(parsed.offsetValue);
    }
  };

  const handleSaveCalendarReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setFormErrorMsg('');

    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    // Validate past date rule for Task and Event
    if (!isCategoryAllowedOnDate(selectedCategory, targetDate, todayISO)) {
      setFormErrorMsg(
        lang === 'bn'
          ? 'অতীতের তারিখে টাস্ক বা ইভেন্ট যোগ করা যাবে না। আজ বা সামনের তারিখ নির্বাচন করুন।'
          : 'Tasks and Events cannot be set on past dates. Please choose today or a future date.'
      );
      return;
    }

    const encodedNotes = encodeCalendarReminderNotes(
      {
        eventKind: selectedCategory,
        eventTime: hasCustomTime ? eventTime : '',
        hasTime: hasCustomTime,
        offsetType: alarmEnabled ? offsetType : 'hours_before',
        offsetValue: Math.max(1, Number(offsetValue) || 2),
        alarmEnabled,
        reminderEnabled,
        reminderHoursBefore: Math.max(1, Number(reminderHoursBefore) || 2),
        toneId,
      },
      userNotes
    );

    await saveReminder(
      {
        title: cleanTitle,
        category: mapEventKindToFirestoreCategory(selectedCategory),
        dueDate: targetDate,
        isCompleted: false,
        notes: encodedNotes,
      },
      editingReminderId || undefined
    );

    if (targetDate !== selectedDate) {
      onSelectDate(targetDate);
    }

    const savedCatLabel = activeCategoryConfig.labelBn;
    setIsFormOpen(false);
    setEditingReminderId(null);
    showToast(
      lang === 'bn'
        ? `${formatDateReadable(targetDate, 'bn')} তারিখের ${savedCatLabel} সংরক্ষিত হয়েছে!`
        : `${activeCategoryConfig.labelEn} saved for ${targetDate}!`
    );
  };

  const effectiveTimeForPreview = hasCustomTime ? eventTime : '09:00';
  const previewTrigger = computeReminderTriggerDateTime(
    targetDate,
    effectiveTimeForPreview,
    offsetType,
    Math.max(1, Number(offsetValue) || 2)
  );
  const previewOffsetLabel = formatOffsetLabel(
    offsetType,
    Math.max(1, Number(offsetValue) || 2)
  );

  const isCustomOffsetActive =
    !(offsetType === 'hours_before' && offsetValue === 2) &&
    !(offsetType === 'days_before' && offsetValue === 3);

  const renderCategoryIcon = (type: PrimaryCalendarItemType, className = 'w-4 h-4') => {
    if (type === 'birthday') return <Cake className={className} />;
    if (type === 'event') return <Sparkles className={className} />;
    if (type === 'task') return <CheckSquare className={className} />;
    return <FileText className={className} />;
  };

  // Determine the section header icon based on the active form category or first item on this date
  const dominantType: PrimaryCalendarItemType = isFormOpen
    ? selectedCategory
    : dateReminders.length > 0
    ? parseCalendarReminderMeta(dateReminders[0]).primaryType
    : 'note';

  const sectionHeaderTitle = getDateRemindersSectionTitle(
    dateReminders,
    !isReadOnly && isFormOpen,
    selectedCategory,
    lang
  );

  return (
    <div
      data-testid={`${testIdPrefix}-reminder-section`}
      className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2.5"
    >
      {/* Header Row: Dynamic Title + Add Button (Add Button ONLY on Attendance page, never on Home Calendar) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              dominantType === 'birthday'
                ? 'bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300'
                : dominantType === 'event'
                ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300'
                : dominantType === 'task'
                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {renderCategoryIcon(dominantType, 'w-3.5 h-3.5')}
          </div>
          <div className="min-w-0">
            <h5
              data-testid={`${testIdPrefix}-section-heading`}
              className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap"
            >
              <span>{sectionHeaderTitle}</span>
              {dateReminders.length > 0 && (
                <span
                  data-testid={`${testIdPrefix}-date-reminder-count`}
                  className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold"
                >
                  {formatNumber(dateReminders.length, lang)}টি
                </span>
              )}
            </h5>
          </div>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            data-testid={`${testIdPrefix}-open-reminder-form-btn`}
            onClick={() => {
              if (isFormOpen) {
                setIsFormOpen(false);
                setEditingReminderId(null);
              } else {
                handleOpenAddForm(selectedCategory);
              }
            }}
            className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              isFormOpen
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
            }`}
          >
            {isFormOpen ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'ফর্ম বন্ধ করুন' : 'Close'}</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'যোগ করুন' : 'Add'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {toastMsg && (
        <div
          role="status"
          className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Existing Items for Selected Date — Rendered Distinctly by Type (Task, Event, Birthday, Note) */}
      {dateReminders.length > 0 ? (
        <div data-testid={`${testIdPrefix}-date-reminders-list`} className="space-y-2">
          {dateReminders.map((rem) => {
            const parsed = parseCalendarReminderMeta(rem);
            const catCfg = getPrimaryCategoryConfig(parsed.primaryType);

            return (
              <div
                key={rem.id}
                data-testid={`${testIdPrefix}-reminder-card-${rem.id}`}
                data-item-type={parsed.primaryType}
                className={`p-3 rounded-xl bg-white dark:bg-slate-900 border ${catCfg.cardBorderColor} shadow-2xs space-y-2`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  {/* Type-Specific Content Layout */}
                  <div className="min-w-0 flex-1">
                    {/* 1. TASK (টাস্ক) — Renders with an Interactive Checkbox */}
                    {parsed.primaryType === 'task' && (
                      <label className="flex items-start gap-2.5 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          data-testid={`${testIdPrefix}-task-checkbox-${rem.id}`}
                          checked={rem.isCompleted}
                          onChange={(e) => toggleReminder(rem.id, e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${catCfg.badgeColor}`}
                            >
                              <CheckSquare className="w-3 h-3" />
                              <span>{lang === 'bn' ? 'টাস্ক' : 'Task'}</span>
                            </span>
                            {rem.isCompleted && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold">
                                {lang === 'bn' ? 'সম্পন্ন ✓' : 'Done ✓'}
                              </span>
                            )}
                            {parsed.hasTime && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>
                                  {lang === 'bn'
                                    ? formatBengaliTime(parsed.eventTime)
                                    : parsed.eventTime}
                                </span>
                              </span>
                            )}
                            {parsed.alarmEnabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold">
                                <Bell className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>
                                  {lang === 'bn' ? parsed.offsetLabelBn : parsed.offsetLabelEn}
                                </span>
                              </span>
                            )}
                            {parsed.reminderEnabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>
                                  {lang === 'bn'
                                    ? `রিমাইন্ডার: ${toBengaliDigits(parsed.reminderHoursBefore)} ঘণ্টা আগে`
                                    : `Reminder: ${parsed.reminderHoursBefore}h before`}
                                </span>
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-xs sm:text-sm font-extrabold ${
                              rem.isCompleted
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {rem.title}
                          </p>

                          {parsed.cleanNotes && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/70 dark:border-slate-700/70 whitespace-pre-line">
                              {parsed.cleanNotes}
                            </p>
                          )}
                        </div>
                      </label>
                    )}

                    {/* 2. BIRTHDAY (জন্মদিন) — Repeats Every Year */}
                    {parsed.primaryType === 'birthday' && (
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-950/80 border border-pink-200 dark:border-pink-800 text-pink-600 dark:text-pink-300 flex items-center justify-center shrink-0 shadow-2xs">
                          <Cake className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${catCfg.badgeColor}`}
                            >
                              <Cake className="w-3 h-3" />
                              <span>{lang === 'bn' ? 'জন্মদিন' : 'Birthday'}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 text-[10px] font-bold">
                              <Repeat className="w-2.5 h-2.5" />
                              <span>{lang === 'bn' ? 'প্রতি বছর' : 'Every Year'}</span>
                            </span>
                            {parsed.hasTime && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-pink-600 dark:text-pink-400" />
                                <span>
                                  {lang === 'bn'
                                    ? formatBengaliTime(parsed.eventTime)
                                    : parsed.eventTime}
                                </span>
                              </span>
                            )}
                            {parsed.alarmEnabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-50 dark:bg-pink-950/60 text-pink-800 dark:text-pink-300 border border-pink-200 dark:border-pink-800 text-[10px] font-bold">
                                <Bell className="w-3 h-3 text-pink-600 dark:text-pink-400" />
                                <span>
                                  {lang === 'bn' ? parsed.offsetLabelBn : parsed.offsetLabelEn}
                                </span>
                              </span>
                            )}
                            {parsed.reminderEnabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>
                                  {lang === 'bn'
                                    ? `রিমাইন্ডার: ${toBengaliDigits(parsed.reminderHoursBefore)} ঘণ্টা আগে`
                                    : `Reminder: ${parsed.reminderHoursBefore}h before`}
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                            <div className="px-2.5 py-1.5 rounded-lg bg-pink-50/70 dark:bg-pink-950/40 border border-pink-200/70 dark:border-pink-800/60">
                              <span className="text-[10px] font-bold text-pink-700 dark:text-pink-300 block">
                                {lang === 'bn' ? 'কার জন্মদিন' : 'Whose Birthday'}
                              </span>
                              <span
                                data-testid={`${testIdPrefix}-birthday-person-${rem.id}`}
                                className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5"
                              >
                                {rem.title}
                              </span>
                            </div>

                            <div className="px-2.5 py-1.5 rounded-lg bg-pink-50/70 dark:bg-pink-950/40 border border-pink-200/70 dark:border-pink-800/60">
                              <span className="text-[10px] font-bold text-pink-700 dark:text-pink-300 block">
                                {lang === 'bn' ? 'কত তারিখ জন্মদিন' : 'Birthday Date'}
                              </span>
                              <span
                                data-testid={`${testIdPrefix}-birthday-date-${rem.id}`}
                                className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white block mt-0.5"
                              >
                                {formatDateReadable(rem.dueDate, lang)}
                              </span>
                            </div>
                          </div>

                          {parsed.cleanNotes && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/70 dark:border-slate-700/70 whitespace-pre-line">
                              {parsed.cleanNotes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3. EVENT (ইভেন্ট) — Styled as an Event Card */}
                    {parsed.primaryType === 'event' && (
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${catCfg.badgeColor}`}
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>{lang === 'bn' ? 'ইভেন্ট' : 'Event'}</span>
                            </span>
                            {parsed.hasTime && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                <span>
                                  {lang === 'bn'
                                    ? `সময়: ${formatBengaliTime(parsed.eventTime)}`
                                    : `Time: ${parsed.eventTime}`}
                                </span>
                              </span>
                            )}
                            {parsed.alarmEnabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold">
                                <Bell className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                <span>
                                  {lang === 'bn' ? parsed.offsetLabelBn : parsed.offsetLabelEn}
                                </span>
                              </span>
                            )}
                            {parsed.reminderEnabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>
                                  {lang === 'bn'
                                    ? `রিমাইন্ডার: ${toBengaliDigits(parsed.reminderHoursBefore)} ঘণ্টা আগে`
                                    : `Reminder: ${parsed.reminderHoursBefore}h before`}
                                </span>
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                            {rem.title}
                          </p>

                          {parsed.cleanNotes && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/70 dark:border-slate-700/70 whitespace-pre-line">
                              {parsed.cleanNotes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 4. NOTE (নোট) — Styled as a Note Card */}
                    {parsed.primaryType === 'note' && (
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${catCfg.badgeColor}`}
                            >
                              <FileText className="w-3 h-3" />
                              <span>{lang === 'bn' ? 'নোট' : 'Note'}</span>
                            </span>
                            {parsed.hasTime && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>
                                  {lang === 'bn'
                                    ? formatBengaliTime(parsed.eventTime)
                                    : parsed.eventTime}
                                </span>
                              </span>
                            )}
                            {parsed.alarmEnabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                                <Bell className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>
                                  {lang === 'bn' ? parsed.offsetLabelBn : parsed.offsetLabelEn}
                                </span>
                              </span>
                            )}
                            {parsed.reminderEnabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold">
                                <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>
                                  {lang === 'bn'
                                    ? `রিমাইন্ডার: ${toBengaliDigits(parsed.reminderHoursBefore)} ঘণ্টা আগে`
                                    : `Reminder: ${parsed.reminderHoursBefore}h before`}
                                </span>
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                            {rem.title}
                          </p>

                          {parsed.cleanNotes && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/70 dark:border-slate-700/70 whitespace-pre-line">
                              {parsed.cleanNotes}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Edit & Delete Buttons ONLY on Attendance Page (!isReadOnly) */}
                  {!isReadOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-testid={`${testIdPrefix}-edit-reminder-${rem.id}`}
                        onClick={() => handleOpenEditForm(rem)}
                        title={lang === 'bn' ? 'এডিট করুন' : 'Edit'}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`${testIdPrefix}-delete-reminder-${rem.id}`}
                        onClick={() => deleteReminder(rem.id)}
                        title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !isFormOpen && (
          <div
            data-testid={`${testIdPrefix}-empty-reminder-notice`}
            className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-dashed border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"
          >
            <span className="inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                {lang === 'bn'
                  ? `${formatDateReadable(selectedDate, 'bn')} তারিখে কোনো টাস্ক, ইভেন্ট, জন্মদিন বা নোট নেই।`
                  : `No tasks, events, birthdays, or notes for ${selectedDate}.`}
              </span>
            </span>
            {!isReadOnly && (
              <button
                type="button"
                data-testid={`${testIdPrefix}-empty-add-btn`}
                onClick={() => handleOpenAddForm(selectedCategory)}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-xs font-extrabold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'যোগ করুন' : 'Add'}</span>
              </button>
            )}
          </div>
        )
      )}

      {/* Inline Add / Edit Form (Strictly on Attendance Page when !isReadOnly) */}
      {!isReadOnly && isFormOpen && (
        <form
          data-testid={`${testIdPrefix}-reminder-form`}
          onSubmit={handleSaveCalendarReminder}
          className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-indigo-300 dark:border-indigo-700/80 shadow-sm space-y-3"
        >
          {/* Dynamic Form Header reflecting the currently selected category */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h6
              data-testid={`${testIdPrefix}-form-dynamic-heading`}
              className="text-xs sm:text-sm font-extrabold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5"
            >
              {renderCategoryIcon(selectedCategory, 'w-4 h-4 text-indigo-600 dark:text-indigo-400')}
              <span>
                {editingReminderId
                  ? lang === 'bn'
                    ? activeCategoryConfig.editHeaderBn
                    : activeCategoryConfig.editHeaderEn
                  : lang === 'bn'
                  ? activeCategoryConfig.addHeaderBn
                  : activeCategoryConfig.addHeaderEn}
              </span>
            </h6>
          </div>

          {formErrorMsg && (
            <div
              role="alert"
              data-testid={`${testIdPrefix}-form-error`}
              className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formErrorMsg}</span>
            </div>
          )}

          {/* 1. Strictly 4 Category Options: টাস্ক, ইভেন্ট, জন্মদিন, নোট */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {lang === 'bn' ? '১. কী যোগ করতে চান নির্বাচন করুন' : '1. Choose Type'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIMARY_CALENDAR_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                const allowedOnCurrentDate = isCategoryAllowedOnDate(cat.id, targetDate, todayISO);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`${testIdPrefix}-kind-${cat.id}`}
                    disabled={!allowedOnCurrentDate}
                    onClick={() => {
                      if (!allowedOnCurrentDate) return;
                      setSelectedCategory(cat.id);
                      setFormErrorMsg('');
                    }}
                    className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-extrabold border inline-flex items-center justify-center gap-1.5 transition-all ${
                      !allowedOnCurrentDate
                        ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                        : active
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs scale-[1.01] cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400 cursor-pointer'
                    }`}
                  >
                    {renderCategoryIcon(cat.id, 'w-3.5 h-3.5 shrink-0')}
                    <span className="truncate">{lang === 'bn' ? cat.labelBn : cat.labelEn}</span>
                  </button>
                );
              })}
            </div>

            {/* Past-date notice when targetDate < todayISO explaining why Task/Event are locked */}
            {isTargetDatePast && (
              <div
                data-testid={`${testIdPrefix}-past-date-restriction-notice`}
                className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
              >
                <span className="flex-1 min-w-[180px]">
                  {lang === 'bn'
                    ? 'অতীতের তারিখে টাস্ক বা ইভেন্ট সিলেক্ট করা যাবে না। জন্মদিন ও নোট যেকোনো তারিখে যোগ করা যাবে।'
                    : 'Tasks & Events cannot be set on past dates. Birthdays & Notes can be added on any date.'}
                </span>
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-switch-to-today-btn`}
                  onClick={() => {
                    setTargetDate(todayISO);
                    onSelectDate(todayISO);
                    setSelectedCategory('task');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  {lang === 'bn' ? 'আজকের তারিখ নিন' : 'Use Today'}
                </button>
              </div>
            )}
          </div>

          {/* 2. Dynamic Title Input (Whose Birthday / Task Name / Event Name / Note Title) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {lang === 'bn'
                ? `২. ${activeCategoryConfig.titleLabelBn}`
                : `2. ${activeCategoryConfig.titleLabelEn}`}
            </label>
            <input
              type="text"
              data-testid={`${testIdPrefix}-reminder-title-input`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? activeCategoryConfig.titlePlaceholderBn
                  : activeCategoryConfig.titlePlaceholderEn
              }
              required
              className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {activeCategoryConfig.suggestionsBn.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setTitle(sug)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Date & Optional Time ("টাইম যোগ করুন") */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'bn'
                  ? `৩. ${activeCategoryConfig.dateLabelBn}`
                  : `3. ${activeCategoryConfig.dateLabelEn}`}
              </label>
              <DateInputDMY
                data-testid={`${testIdPrefix}-reminder-date-input`}
                value={targetDate}
                min={
                  selectedCategory === 'task' || selectedCategory === 'event'
                    ? todayISO
                    : undefined
                }
                onChange={(val) => {
                  setTargetDate(val);
                  setFormErrorMsg('');
                }}
                lang={lang}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
              />
              {selectedCategory === 'birthday' && (
                <p className="mt-1 text-[10px] font-semibold text-pink-600 dark:text-pink-400 flex items-center gap-1">
                  <Repeat className="w-3 h-3 shrink-0" />
                  <span>
                    {lang === 'bn'
                      ? 'জন্মদিন প্রতি বছর এই তারিখে স্বয়ংক্রিয়ভাবে ক্যালেন্ডারে দেখাবে'
                      : 'Birthday repeats every year on this date'}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'bn' ? '৪. সময় (ঐচ্ছিক)' : '4. Time (Optional)'}
              </label>
              {!hasCustomTime ? (
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-add-time-btn`}
                  onClick={() => setHasCustomTime(true)}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'টাইম যোগ করুন' : 'Add Time'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    data-testid={`${testIdPrefix}-reminder-time-input`}
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-remove-time-btn`}
                    onClick={() => setHasCustomTime(false)}
                    title={lang === 'bn' ? 'সময় সরান' : 'Remove Time'}
                    className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 text-slate-500 hover:text-rose-600 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4. Optional Details / Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {lang === 'bn'
                ? `৫. ${activeCategoryConfig.notesLabelBn}`
                : `5. ${activeCategoryConfig.notesLabelEn}`}
            </label>
            <textarea
              rows={2}
              data-testid={`${testIdPrefix}-reminder-notes-input`}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? activeCategoryConfig.notesPlaceholderBn
                  : activeCategoryConfig.notesPlaceholderEn
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
            />
          </div>

          {/* 5. Alarm Control ("এলার্ম বাজে?") + Reminder Control ("রিমাইন্ডার") */}
          <div className="space-y-2.5">
            {/* A. "এলার্ম বাজে?" Box */}
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/70 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {alarmEnabled ? (
                    <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  ) : (
                    <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200">
                    {lang === 'bn' ? 'এলার্ম বাজে?' : 'Ring Alarm?'}
                  </span>
                </div>

                {/* Enable/Disable Switch Icon Button */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={alarmEnabled}
                  data-testid={`${testIdPrefix}-alarm-toggle`}
                  onClick={() => setAlarmEnabled((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    alarmEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      alarmEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {alarmEnabled && (
                <div className="space-y-2 pt-0.5">
                  {/* Strictly 2 Preset Buttons ("২ ঘণ্টা আগে" & "৩ দিন আগে") + "+" Custom Button */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid={`${testIdPrefix}-preset-hours_before-2`}
                      onClick={() => {
                        setOffsetType('hours_before');
                        setOffsetValue(2);
                        setShowCustomAlarmForm(false);
                      }}
                      className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        offsetType === 'hours_before' && offsetValue === 2 && !showCustomAlarmForm
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {lang === 'bn' ? '২ ঘণ্টা আগে' : '2 hours before'}
                    </button>

                    <button
                      type="button"
                      data-testid={`${testIdPrefix}-preset-days_before-3`}
                      onClick={() => {
                        setOffsetType('days_before');
                        setOffsetValue(3);
                        setShowCustomAlarmForm(false);
                      }}
                      className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        offsetType === 'days_before' && offsetValue === 3 && !showCustomAlarmForm
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {lang === 'bn' ? '৩ দিন আগে' : '3 days before'}
                    </button>

                    {isCustomOffsetActive && (
                      <span
                        data-testid={`${testIdPrefix}-active-custom-offset-badge`}
                        className="min-h-[34px] px-3 py-1 rounded-xl text-xs font-extrabold bg-indigo-600 text-white border border-indigo-600 inline-flex items-center gap-1"
                      >
                        <span>{lang === 'bn' ? previewOffsetLabel.bn : previewOffsetLabel.en}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      data-testid={`${testIdPrefix}-alarm-custom-plus-btn`}
                      onClick={() => setShowCustomAlarmForm((prev) => !prev)}
                      title={
                        lang === 'bn'
                          ? 'কাস্টম সময় লিখুন (যেমন: 1h, 2h, 1 hour, 7d)'
                          : 'Custom alarm lead time (e.g. 1h, 2h, 7d)'
                      }
                      className={`min-h-[34px] min-w-[34px] px-2.5 py-1 rounded-xl text-xs font-extrabold border inline-flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        showCustomAlarmForm
                          ? 'bg-indigo-700 text-white border-indigo-700'
                          : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mini Custom Alarm Form opened by clicking "+" */}
                  {showCustomAlarmForm && (
                    <div
                      data-testid={`${testIdPrefix}-alarm-custom-form`}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 space-y-2"
                    >
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {lang === 'bn'
                          ? 'কয় ঘণ্টা বা কয় দিন আগে এলার্ম চান লিখুন (যেমন: 1h, 2h, 1 hour, 7d):'
                          : 'Enter hours or days before (e.g. 1h, 2h, 1 hour, 7d):'}
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          data-testid={`${testIdPrefix}-alarm-custom-input`}
                          value={customAlarmText}
                          onChange={(e) => handleCustomAlarmTextChange(e.target.value)}
                          placeholder={
                            lang === 'bn'
                              ? 'যেমন: 1h, 2h, 1 hour, 5d, ৭ দিন...'
                              : 'e.g. 1h, 2h, 1 hour, 5d...'
                          }
                          className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                        />
                        <span className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 shrink-0 text-center">
                          {lang === 'bn'
                            ? `সেট হয়েছে: ${previewOffsetLabel.bn}`
                            : `Set: ${previewOffsetLabel.en}`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div
                    data-testid={`${testIdPrefix}-trigger-preview`}
                    className="px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-indigo-200/70 dark:border-indigo-800/70 flex flex-wrap items-center justify-between gap-1.5 text-[11px]"
                  >
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      {lang === 'bn' ? 'এলার্ম বাজবে:' : 'Alarm will ring:'}
                    </span>
                    <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                      {lang === 'bn'
                        ? `${formatDateReadable(previewTrigger.triggerDate, 'bn')} · ${formatBengaliTime(previewTrigger.triggerTime)} (${previewOffsetLabel.bn})`
                        : `${previewTrigger.triggerDate} at ${previewTrigger.triggerTime} (${previewOffsetLabel.en})`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* B. "রিমাইন্ডার" Box with Enable/Disable Toggle + Hours Before */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock
                    className={`w-4 h-4 shrink-0 ${
                      reminderEnabled
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'রিমাইন্ডার' : 'Reminder'}
                  </span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={reminderEnabled}
                  data-testid={`${testIdPrefix}-reminder-toggle`}
                  onClick={() => setReminderEnabled((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    reminderEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      reminderEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {reminderEnabled && (
                <div
                  data-testid={`${testIdPrefix}-reminder-hours-section`}
                  className="space-y-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/70"
                >
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'bn'
                      ? 'কত ঘণ্টা আগে রিমাইন্ডার সেট করবেন?'
                      : 'How many hours before to set reminder?'}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 4, 6, 12, 24].map((hrs) => (
                      <button
                        key={hrs}
                        type="button"
                        data-testid={`${testIdPrefix}-reminder-hrs-chip-${hrs}`}
                        onClick={() => setReminderHoursBefore(hrs)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          reminderHoursBefore === hrs
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        {lang === 'bn' ? `${toBengaliDigits(hrs)} ঘণ্টা আগে` : `${hrs}h before`}
                      </button>
                    ))}
                    <div className="inline-flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={168}
                        data-testid={`${testIdPrefix}-reminder-hours-input`}
                        value={reminderHoursBefore}
                        onChange={(e) =>
                          setReminderHoursBefore(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-16 min-h-[32px] px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white text-center tabular-nums"
                      />
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {lang === 'bn' ? 'ঘণ্টা আগে' : 'hrs before'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingReminderId(null);
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              data-testid={`${testIdPrefix}-save-reminder-btn`}
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {editingReminderId
                  ? lang === 'bn'
                    ? 'আপডেট সংরক্ষণ করুন'
                    : 'Update'
                  : lang === 'bn'
                  ? 'যোগ করুন'
                  : 'Add'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Month's All Saved Items Quick-Jump Strip */}
      {monthRemindersWithDates.length > 0 && (
        <div
          data-testid={`${testIdPrefix}-month-reminders-strip`}
          className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5"
        >
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'এই মাসের সংরক্ষিত তালিকা (দেখতে ট্যাপ করুন):'
              : 'Saved Items in this Month (Tap to jump):'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {monthRemindersWithDates.map(({ item: r, effectiveDate }) => {
              const parsed = parseCalendarReminderMeta(r);
              const isCurrentDate = effectiveDate === selectedDate;
              return (
                <button
                  key={`${r.id}_${effectiveDate}`}
                  type="button"
                  onClick={() => onSelectDate(effectiveDate)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    isCurrentDate
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-indigo-200 dark:border-indigo-800/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                  }`}
                >
                  {renderCategoryIcon(parsed.primaryType, 'w-3 h-3 shrink-0')}
                  <span>[{parsed.shortLabelBn}]</span>
                  <span>{formatDateSlashDMY(effectiveDate, lang).slice(0, 5)}:</span>
                  <span className="truncate max-w-[140px]">{r.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
