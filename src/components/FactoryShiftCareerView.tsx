import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Award,
  Banknote,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileSpreadsheet,
  History,
  MapPin,
  PlusCircle,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type { GarmentWorkplace, WorkShiftPattern } from '../types';
import {
  computeWorkplaceTenureAnalytics,
  deriveBangladeshRMGBreakdownFromGross,
  formatBDT,
  formatNumber,
  getAttendanceBonusWindowForShift,
  getTodayISO,
  resolveWorkerShiftForDate,
  shiftDateISO,
} from '../utils/calculations';
import { formatDateReadable } from '../utils/i18n';
import { DateInputDMY } from './DateInputDMY';

interface FactoryShiftCareerViewProps {
  onShowNotice?: (msg: string) => void;
}

export const FactoryShiftCareerView: React.FC<FactoryShiftCareerViewProps> = ({
  onShowNotice,
}) => {
  const {
    profile,
    lang,
    workplaces,
    overtime,
    salaryRecords,
    payments,
    attendance,
    updateProfile,
    saveWorkplace,
    transitionToNewGarmentJob,
    isProfileSetupIncomplete,
    reopenOnboarding,
  } = useData();

  const isBn = lang === 'bn';
  const todayStr = getTodayISO();

  // Edit Current Factory & Shift Form state
  const [showFactoryForm, setShowFactoryForm] = useState(false);
  const [factoryName, setFactoryName] = useState(profile.factoryName);
  const [factoryBranch, setFactoryBranch] = useState(profile.factoryBranch);
  const [department, setDepartment] = useState(profile.department);
  const [designation, setDesignation] = useState(profile.designation);
  const [employeeId, setEmployeeId] = useState(profile.employeeId);
  const [joiningDate, setJoiningDate] = useState(profile.joiningDate || '2025-01-01');
  const [shiftPattern, setShiftPattern] = useState<WorkShiftPattern>(
    profile.shiftPattern || 'day'
  );
  const [dayShiftStartTime, setDayShiftStartTime] = useState(
    profile.dayShiftStartTime || '08:00'
  );
  const [nightShiftStartTime, setNightShiftStartTime] = useState(
    profile.nightShiftStartTime || '20:00'
  );
  const [rotationStartDate, setRotationStartDate] = useState(
    profile.rotationStartDate || '2026-10-01'
  );
  const [attendanceWindowStartDay, setAttendanceWindowStartDay] = useState(
    profile.attendanceWindowStartDay || '07:50'
  );
  const [attendanceWindowEndDay, setAttendanceWindowEndDay] = useState(
    profile.attendanceWindowEndDay || '08:05'
  );
  const [attendanceWindowStartNight, setAttendanceWindowStartNight] = useState(
    profile.attendanceWindowStartNight || '19:50'
  );
  const [attendanceWindowEndNight, setAttendanceWindowEndNight] = useState(
    profile.attendanceWindowEndNight || '20:05'
  );

  useEffect(() => {
    if (!showFactoryForm) {
      setFactoryName(profile.factoryName || '');
      setFactoryBranch(profile.factoryBranch || '');
      setDepartment(profile.department || '');
      setDesignation(profile.designation || '');
      setEmployeeId(profile.employeeId || '');
      setJoiningDate(profile.joiningDate || '2025-01-01');
      setShiftPattern(profile.shiftPattern || 'day');
      setDayShiftStartTime(profile.dayShiftStartTime || '08:00');
      setNightShiftStartTime(profile.nightShiftStartTime || '20:00');
      setRotationStartDate(profile.rotationStartDate || '2026-10-01');
      setAttendanceWindowStartDay(profile.attendanceWindowStartDay || '07:50');
      setAttendanceWindowEndDay(profile.attendanceWindowEndDay || '08:05');
      setAttendanceWindowStartNight(profile.attendanceWindowStartNight || '19:50');
      setAttendanceWindowEndNight(profile.attendanceWindowEndNight || '20:05');
    }
  }, [profile, showFactoryForm]);

  // Join New Garment / Job Transition Form state
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [leavingDate, setLeavingDate] = useState(todayStr);
  const [leavingReason, setLeavingReason] = useState(
    isBn
      ? 'উন্নত বেতন ও নতুন কারখানায় পদোন্নতি'
      : 'Higher salary & promotion at new factory'
  );
  const [newFactoryName, setNewFactoryName] = useState('');
  const [newFactoryBranch, setNewFactoryBranch] = useState(
    isBn ? 'গাজীপুর শিল্প এলাকা' : 'Gazipur Industrial Area'
  );
  const [newFactoryAddress, setNewFactoryAddress] = useState('');
  const [newDepartment, setNewDepartment] = useState(
    profile.department || (isBn ? 'সুইং (Sewing)' : 'Sewing')
  );
  const [newDesignation, setNewDesignation] = useState(
    profile.designation || (isBn ? 'সিনিয়র অপারেটর' : 'Senior Operator')
  );
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newJoiningDate, setNewJoiningDate] = useState(todayStr);
  const [newGrossSalary, setNewGrossSalary] = useState<number>(
    (profile.grossSalary || 12500) + 1500
  );
  const [newBasicSalary, setNewBasicSalary] = useState<number>(() => {
    const split = deriveBangladeshRMGBreakdownFromGross(
      (profile.grossSalary || 12500) + 1500
    );
    return split.basicSalary;
  });
  const [newShiftPattern, setNewShiftPattern] = useState<WorkShiftPattern>(
    profile.shiftPattern || 'day'
  );
  const [jobFormError, setJobFormError] = useState('');

  // Past Garments Expanded Report ID
  const pastWorkplaces = workplaces.filter((w) => !w.isCurrent);
  const currentWorkplaceObj = workplaces.find((w) => w.isCurrent);

  const [expandedPastId, setExpandedPastId] = useState<string | null>(() =>
    pastWorkplaces.length > 0 ? pastWorkplaces[0].id : null
  );

  // Current tenure analytics
  const currentTenureAnalytics = computeWorkplaceTenureAnalytics({
    workplace: {
      ...(currentWorkplaceObj || {}),
      isCurrent: true,
      joiningDate: profile.joiningDate || currentWorkplaceObj?.joiningDate || '2025-01-01',
      grossSalary: profile.grossSalary,
      basicSalary: profile.basicSalary,
    },
    profile,
    salaryRecords,
    payments,
    overtime,
    attendance,
    todayISO: todayStr,
  });

  const shiftWindowInfo = getAttendanceBonusWindowForShift({
    shiftPattern: profile.shiftPattern || 'day',
    dayWindowStart: profile.attendanceWindowStartDay,
    dayWindowEnd: profile.attendanceWindowEndDay,
    nightWindowStart: profile.attendanceWindowStartNight,
    nightWindowEnd: profile.attendanceWindowEndNight,
    bonusAmount: profile.attendanceBonus,
  });

  const handleOpenEditForm = () => {
    if (isProfileSetupIncomplete) {
      onShowNotice?.(
        isBn
          ? 'জব বা গার্মেন্টসের তথ্য যুক্ত করার আগে অনুগ্রহ করে প্রাথমিক বেতন ও ওভারটাইম সেটআপ সম্পন্ন করুন।'
          : 'Please complete your initial salary and overtime setup before admitting or editing your job.'
      );
      reopenOnboarding();
      return;
    }
    setFactoryName(profile.factoryName);
    setFactoryBranch(profile.factoryBranch);
    setDepartment(profile.department);
    setDesignation(profile.designation);
    setEmployeeId(profile.employeeId);
    setJoiningDate(profile.joiningDate || '2025-01-01');
    setShiftPattern(profile.shiftPattern || 'day');
    setDayShiftStartTime(profile.dayShiftStartTime || '08:00');
    setNightShiftStartTime(profile.nightShiftStartTime || '20:00');
    setRotationStartDate(profile.rotationStartDate || '2026-10-01');
    setAttendanceWindowStartDay(profile.attendanceWindowStartDay || '07:50');
    setAttendanceWindowEndDay(profile.attendanceWindowEndDay || '08:05');
    setAttendanceWindowStartNight(profile.attendanceWindowStartNight || '19:50');
    setAttendanceWindowEndNight(profile.attendanceWindowEndNight || '20:05');
    setShowNewJobModal(false);
    setShowFactoryForm(true);
  };

  const handleSaveFactorySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      factoryName,
      factoryBranch,
      department,
      designation,
      employeeId,
      joiningDate,
      shiftPattern,
      dayShiftStartTime,
      nightShiftStartTime,
      rotationStartDate,
      attendanceWindowStartDay,
      attendanceWindowEndDay,
      attendanceWindowStartNight,
      attendanceWindowEndNight,
    });

    if (currentWorkplaceObj) {
      await saveWorkplace(
        {
          ...currentWorkplaceObj,
          factoryName,
          factoryArea: factoryBranch,
          department,
          designation,
          employeeId,
          joiningDate,
          shiftPattern,
          isCurrent: true,
        },
        currentWorkplaceObj.id
      );
    }

    setShowFactoryForm(false);
    onShowNotice?.(
      isBn
        ? 'বর্তমান কারখানা ও শিফট সেটিংস সফলভাবে সংরক্ষিত হয়েছে।'
        : 'Current factory and shift settings saved successfully.'
    );
  };

  const handleNewGrossChange = (val: number) => {
    setNewGrossSalary(val);
    if (val >= 2450) {
      const split = deriveBangladeshRMGBreakdownFromGross(val);
      setNewBasicSalary(split.basicSalary);
    }
  };

  const handleStartNewGarmentJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setJobFormError('');
    if (isProfileSetupIncomplete) {
      setJobFormError(
        isBn
          ? 'জব যুক্ত করার আগে অনুগ্রহ করে আপনার প্রাথমিক বেতন ও ওভারটাইম সেটআপ সম্পন্ন করুন।'
          : 'Please complete your initial salary and overtime setup before admitting your job.'
      );
      reopenOnboarding();
      return;
    }
    if (!newFactoryName.trim()) {
      setJobFormError(
        isBn
          ? 'অনুগ্রহ করে নতুন গার্মেন্টস / কারখানার নাম লিখুন।'
          : 'Please enter the new garment factory name.'
      );
      return;
    }

    const previousFactoryTitle = profile.factoryName;
    const archivedTargetId = currentWorkplaceObj?.id;
    await transitionToNewGarmentJob({
      newFactoryName: newFactoryName.trim(),
      newFactoryBranch: newFactoryBranch.trim(),
      newFactoryArea: newFactoryAddress.trim() || newFactoryBranch.trim(),
      newDepartment: newDepartment.trim(),
      newDesignation: newDesignation.trim(),
      newEmployeeId: newEmployeeId.trim(),
      newJoiningDate: newJoiningDate || todayStr,
      leavingDate: leavingDate || todayStr,
      leavingReason: leavingReason.trim(),
      newGrossSalary: Math.max(0, Number(newGrossSalary) || profile.grossSalary),
      newBasicSalary: Math.max(0, Number(newBasicSalary) || profile.basicSalary),
      newShiftPattern,
    });

    if (archivedTargetId) {
      setExpandedPastId(archivedTargetId);
    }
    setShowNewJobModal(false);
    setNewFactoryName('');
    onShowNotice?.(
      isBn
        ? `অভিনন্দন! “${newFactoryName.trim()}” আপনার বর্তমান গার্মেন্টস হিসেবে যুক্ত হয়েছে এবং “${previousFactoryTitle}” সম্পূর্ণ অ্যানালিটিক্স রিপোর্টসহ ‘আগের গার্মেন্টস’ তালিকায় সংরক্ষিত হয়েছে।`
        : `Switched to "${newFactoryName.trim()}"! "${previousFactoryTitle}" has been archived to Previous Workplaces with its full analytics report.`
    );
  };

  const resolvePastWorkplaceMetrics = (wp: GarmentWorkplace) => {
    if (
      wp.totalReceivedSalary !== undefined &&
      wp.totalOvertimeHours !== undefined &&
      wp.totalPresentDays !== undefined
    ) {
      return {
        monthsWorked: wp.monthsWorked || 12,
        totalReceivedSalary: wp.totalReceivedSalary,
        totalExpectedSalary: wp.totalExpectedSalary || wp.totalReceivedSalary,
        totalOvertimeHours: wp.totalOvertimeHours,
        totalOvertimeEarnings: wp.totalOvertimeEarnings || 0,
        totalPresentDays: wp.totalPresentDays,
        totalAbsentDays: wp.totalAbsentDays || 0,
        totalLeaveDays: wp.totalLeaveDays || 0,
        grossSalary: wp.grossSalary || 10500,
        basicSalary: wp.basicSalary || 5367,
      };
    }

    const computed = computeWorkplaceTenureAnalytics({
      workplace: wp,
      profile,
      salaryRecords,
      payments,
      overtime,
      attendance,
      todayISO: todayStr,
    });
    return {
      ...computed,
      grossSalary: wp.grossSalary || profile.grossSalary,
      basicSalary: wp.basicSalary || profile.basicSalary,
    };
  };

  return (
    <div className="space-y-5">
      {isProfileSetupIncomplete && (
        <div
          data-testid="job-setup-required-banner"
          role="region"
          className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {isBn
                  ? 'প্রথমে আপনার বেতন ও ওভারটাইম সেটআপ সম্পন্ন করুন'
                  : 'Complete your salary & overtime setup first'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {isBn
                  ? 'প্রাথমিক সেটআপ সম্পন্ন করার পর আপনি আপনার গার্মেন্টস জব এডমিট বা পরিবর্তন করতে পারবেন।'
                  : 'Complete initial setup first before admitting or switching your garment job.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="job-complete-setup-btn"
            onClick={reopenOnboarding}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold whitespace-nowrap cursor-pointer"
          >
            {isBn ? 'প্রথমে সেটআপ করুন' : 'Complete Setup'}
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* 1. CURRENT GARMENT & RUNNING SHIFT SUMMARY OR EDIT FORM          */}
      {/* ================================================================ */}
      {!showFactoryForm ? (
        <div
          data-testid="factory-shift-summary-card"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xs"
        >
          {/* Header with Current Status Badge & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {isBn ? 'বর্তমান গার্মেন্টস ও শিফট' : 'Current Garment & Shift'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {isBn ? 'রানিং কর্মস্থল' : 'Active Job'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isBn
                    ? `যোগদানের তারিখ: ${formatDateReadable(
                        profile.joiningDate || '2023-01-15',
                        'bn'
                      )} (${formatNumber(currentTenureAnalytics.monthsWorked, 'bn')} মাস কর্মরত)`
                    : `Joined: ${formatDateReadable(
                        profile.joiningDate || '2023-01-15',
                        'en'
                      )} (${currentTenureAnalytics.monthsWorked} months)`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                data-testid="edit-factory-settings-btn"
                onClick={handleOpenEditForm}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>{isBn ? 'এডিট / পরিবর্তন করুন' : 'Edit Current'}</span>
              </button>

              <button
                type="button"
                data-testid="start-new-garment-job-btn"
                onClick={() => {
                  if (isProfileSetupIncomplete) {
                    onShowNotice?.(
                      isBn
                        ? 'প্রথমে আপনার বেতন ও ওভারটাইম সেটআপ সম্পন্ন করুন, তারপর জব এডমিট করতে পারবেন।'
                        : 'Please complete your salary & overtime setup first before admitting a job.'
                    );
                    reopenOnboarding();
                    return;
                  }
                  setShowFactoryForm(false);
                  setShowNewJobModal((prev) => !prev);
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>
                  {isBn
                    ? 'নতুন গার্মেন্টসে যোগ দিন (চাকরি পরিবর্তন)'
                    : 'Join New Garment (Switch Job)'}
                </span>
              </button>
            </div>
          </div>

          {/* Factory & Designation details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                {isBn ? 'বর্তমান গার্মেন্টসের নাম' : 'Factory Name'}
              </span>
              <span
                data-testid="current-factory-name-display"
                className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block truncate"
              >
                {profile.factoryName || (isBn ? 'নির্দিষ্ট করা হয়নি' : 'Not specified')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                {isBn ? 'শাখা / সেকশন ও লাইন' : 'Branch / Line'}
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                {[profile.factoryBranch, profile.department].filter(Boolean).join(' • ') ||
                  (isBn ? 'অনির্দিষ্ট' : 'N/A')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                {isBn ? 'পদবী ও গ্রেড' : 'Designation'}
              </span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 block truncate">
                {profile.designation || (isBn ? 'মেশিন অপারেটর' : 'Machine Operator')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                {isBn ? 'কার্ড নম্বর ও মোট বেতন' : 'Employee ID & Gross'}
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                {profile.employeeId || 'N/A'} • {formatBDT(profile.grossSalary, lang)}
              </span>
            </div>
          </div>

          {/* Current Garment Running Tenure Quick Analytics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="px-3 py-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                {isBn ? 'বর্তমান কারখানায় প্রাপ্ত বেতন' : 'Salary Received Here'}
              </span>
              <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                {formatBDT(currentTenureAnalytics.totalReceivedSalary, lang)}
              </span>
            </div>
            <div className="px-3 py-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                {isBn ? 'মোট ওভারটাইম (বর্তমান)' : 'Total Overtime Here'}
              </span>
              <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                {formatNumber(currentTenureAnalytics.totalOvertimeHours, lang)}{' '}
                {isBn ? 'ঘণ্টা' : 'hrs'} (
                {formatBDT(currentTenureAnalytics.totalOvertimeEarnings, lang)})
              </span>
            </div>
            <div className="px-3 py-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                {isBn ? 'হাজিরা বোনাসের সময়সীমা' : 'Attendance Bonus Window'}
              </span>
              <span
                data-testid="factory-attendance-window-summary"
                className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 block truncate"
              >
                {isBn ? shiftWindowInfo.windowLabelBn : shiftWindowInfo.windowLabelEn}
              </span>
            </div>
            <div className="px-3 py-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">
                {isBn ? 'হাজিরা বোনাস পরিমাণ' : 'Attendance Bonus'}
              </span>
              <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                {profile.attendanceBonus > 0
                  ? formatBDT(profile.attendanceBonus, lang)
                  : isBn
                  ? 'বন্ধ'
                  : 'Off'}
              </span>
            </div>
          </div>

          {/* Active Shift Card */}
          {(() => {
            const shiftInfo = resolveWorkerShiftForDate(profile, todayStr);
            const pat = profile.shiftPattern || 'day';

            let rotationText = '';
            if (pat === 'weekly_rotation') {
              const refTime = new Date(
                `${profile.rotationStartDate || '2026-10-01'}T00:00:00Z`
              ).getTime();
              const targetTime = new Date(`${todayStr}T00:00:00Z`).getTime();
              const diffDays = Math.floor((targetTime - refTime) / (24 * 60 * 60 * 1000));
              const safeDiffDays = diffDays >= 0 ? diffDays : 0;
              const weekIndex = Math.floor(safeDiffDays / 7);
              const activeShiftToday = weekIndex % 2 === 0 ? 'day' : 'night';
              const dayInWeek = safeDiffDays % 7;
              const daysRemaining = 7 - dayInWeek;
              const nextShiftStartStr = shiftDateISO(todayStr, daysRemaining);
              const nextShiftName = activeShiftToday === 'day' ? 'নাইট শিফট' : 'ডে শিফট';

              rotationText = isBn
                ? `আজ ${
                    activeShiftToday === 'day' ? 'ডে শিফট' : 'নাইট শিফট'
                  } চলছে (আর ${formatNumber(daysRemaining, 'bn')} দিন বাকি)। ${formatDateReadable(
                    nextShiftStartStr,
                    'bn'
                  )} তারিখ থেকে ${nextShiftName} শুরু হবে।`
                : `Currently ${
                    activeShiftToday === 'day' ? 'Day Shift' : 'Night Shift'
                  } (${daysRemaining} days remaining). ${nextShiftName} starts on ${formatDateReadable(
                    nextShiftStartStr,
                    'en'
                  )}.`;
            }

            return (
              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/80 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                    {isBn ? 'অ্যাক্টিভ শিফট প্যাটার্ন:' : 'Active Shift Pattern:'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-xs font-semibold">
                    {pat === 'day'
                      ? isBn
                        ? 'নিয়মিত ডে শিফট'
                        : 'Regular Day Shift'
                      : pat === 'night'
                      ? isBn
                        ? 'নিয়মিত নাইট শিফট'
                        : 'Regular Night Shift'
                      : pat === 'weekly_rotation'
                      ? isBn
                        ? '১ সপ্তাহ ডে / ১ সপ্তাহ নাইট'
                        : 'Weekly Rotation'
                      : isBn
                      ? 'জেনারেল শিফট'
                      : 'General Shift'}
                  </span>
                </div>

                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {isBn ? shiftInfo.shiftLabelBn : shiftInfo.shiftLabelEn}
                </p>

                <p className="text-xs text-emerald-900 dark:text-emerald-200">
                  {isBn ? shiftWindowInfo.ruleNoteBn : shiftWindowInfo.ruleNoteEn}
                </p>

                {pat === 'weekly_rotation' && (
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    {rotationText}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <form
          onSubmit={handleSaveFactorySettings}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {isBn
                    ? 'বর্তমান কারখানা ও শিফট সেটিংস পরিবর্তন'
                    : 'Edit Current Factory & Shift Settings'}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFactoryForm(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>{isBn ? 'কারখানার বিবরণ ও পদবী' : 'Factory Details & Role'}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'কারখানার নাম (Factory Name)' : 'Factory Name'}
                </label>
                <input
                  type="text"
                  value={factoryName}
                  onChange={(e) => setFactoryName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'ইউনিট / শাখা (Branch)' : 'Branch / Unit'}
                </label>
                <input
                  type="text"
                  value={factoryBranch}
                  onChange={(e) => setFactoryBranch(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'সেকশন / বিভাগ (Department)' : 'Department / Line'}
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'পদবী (যেমন: অপারেটর / হেল্পার)' : 'Designation'}
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'কার্ড / আইডি নম্বর' : 'Employee ID'}
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'যোগদানের তারিখ' : 'Joining Date'}
                </label>
                <DateInputDMY
                  value={joiningDate}
                  lang={lang}
                  onChange={(val) => setJoiningDate(val || '2025-01-01')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Office Start Time, Shift & Attendance Bonus Window */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>
                {isBn
                  ? 'অফিস শুরুর সময়, শিফট ও হাজিরা বোনাসের সময়সীমা'
                  : 'Shift Selection & Attendance Bonus Cutoff Window'}
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                data-testid="profile-shift-day"
                onClick={() => setShiftPattern('day')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  shiftPattern === 'day'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <p className="text-xs sm:text-sm font-bold">
                  {isBn ? 'নিয়মিত ডে শিফট' : 'Regular Day Shift'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isBn
                    ? `হাজিরা বোনাস সময়: ${attendanceWindowStartDay} - ${attendanceWindowEndDay}`
                    : `Window: ${attendanceWindowStartDay} - ${attendanceWindowEndDay}`}
                </p>
              </button>

              <button
                type="button"
                data-testid="profile-shift-night"
                onClick={() => setShiftPattern('night')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  shiftPattern === 'night'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <p className="text-xs sm:text-sm font-bold">
                  {isBn ? 'নিয়মিত নাইট শিফট' : 'Regular Night Shift'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isBn
                    ? `হাজিরা বোনাস সময়: ${attendanceWindowStartNight} - ${attendanceWindowEndNight}`
                    : `Window: ${attendanceWindowStartNight} - ${attendanceWindowEndNight}`}
                </p>
              </button>

              <button
                type="button"
                data-testid="profile-shift-rotation"
                onClick={() => setShiftPattern('weekly_rotation')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  shiftPattern === 'weekly_rotation'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <p className="text-xs sm:text-sm font-bold">
                  {isBn ? '১ সপ্তাহ ডে / ১ সপ্তাহ নাইট' : 'Weekly Alternating Rotation'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isBn ? 'সপ্তাহ অনুযায়ী ডে ও নাইট রোটেশন' : 'Alternates Day & Night weekly'}
                </p>
              </button>

              <button
                type="button"
                data-testid="profile-shift-general"
                onClick={() => setShiftPattern('general')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  shiftPattern === 'general'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <p className="text-xs sm:text-sm font-bold">
                  {isBn ? 'জেনারেল শিফট' : 'General Shift'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isBn ? 'সকাল ৮:০০ - বিকাল ৫:০০' : '08:00 - 17:00'}
                </p>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'ডে শিফট শুরুর সময় (সকাল ৮:০০)' : 'Day Shift Start Time'}
                </label>
                <input
                  type="time"
                  data-testid="profile-day-start-input"
                  value={dayShiftStartTime}
                  onChange={(e) => setDayShiftStartTime(e.target.value || '08:00')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-semibold tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নাইট শিফট শুরুর সময় (রাত ৮:০০)' : 'Night Shift Start Time'}
                </label>
                <input
                  type="time"
                  data-testid="profile-night-start-input"
                  value={nightShiftStartTime}
                  onChange={(e) => setNightShiftStartTime(e.target.value || '20:00')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-semibold tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'রোটেশন শুরুর তারিখ' : 'Rotation Start Date'}
                </label>
                <DateInputDMY
                  value={rotationStartDate}
                  lang={lang}
                  onChange={(val) => setRotationStartDate(val || '2026-10-01')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm tabular-nums"
                />
              </div>
            </div>

            {/* Attendance Bonus Cutoff Window Customization */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'ডে বোনাস উপস্থিতি শুরু (৭:৫০)' : 'Day Bonus Window Start'}
                </label>
                <input
                  type="time"
                  value={attendanceWindowStartDay}
                  onChange={(e) => setAttendanceWindowStartDay(e.target.value || '07:50')}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'ডে বোনাস শেষ সময় (৮:০৫)' : 'Day Bonus Cutoff Time'}
                </label>
                <input
                  type="time"
                  value={attendanceWindowEndDay}
                  onChange={(e) => setAttendanceWindowEndDay(e.target.value || '08:05')}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'নাইট বোনাস উপস্থিতি শুরু (১৯:৫০)' : 'Night Bonus Window Start'}
                </label>
                <input
                  type="time"
                  value={attendanceWindowStartNight}
                  onChange={(e) => setAttendanceWindowStartNight(e.target.value || '19:50')}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isBn ? 'নাইট বোনাস শেষ সময় (২০:০৫)' : 'Night Bonus Cutoff Time'}
                </label>
                <input
                  type="time"
                  value={attendanceWindowEndNight}
                  onChange={(e) => setAttendanceWindowEndNight(e.target.value || '20:05')}
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowFactoryForm(false)}
              className="min-h-[44px] px-5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs"
            >
              {isBn ? 'সংরক্ষণ করুন' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}

      {/* ================================================================ */}
      {/* 2. JOIN NEW GARMENT / SWITCH JOB FORM PANEL                      */}
      {/* ================================================================ */}
      {showNewJobModal && (
        <form
          data-testid="new-garment-job-transition-form"
          onSubmit={handleStartNewGarmentJob}
          className="bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-600/80 dark:border-emerald-700 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {isBn
                    ? 'নতুন গার্মেন্টসে যোগ দিন (চাকরি পরিবর্তন)'
                    : 'Join New Garment Factory (Switch Job)'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {isBn
                    ? `নতুন গার্মেন্টস যোগ করলে আপনার বর্তমান গার্মেন্টস (“${profile.factoryName}”) স্বয়ংক্রিয়ভাবে নিচের ‘আগের গার্মেন্টস’ তালিকায় সম্পূর্ণ বেতন, ওভারটাইম ও হাজিরার অ্যানালিটিক্স রিপোর্টসহ সংরক্ষিত হয়ে যাবে।`
                    : `Switching jobs will automatically archive "${profile.factoryName}" to Previous Workplaces with its complete salary, overtime, and attendance analytics report.`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNewJobModal(false)}
              className="min-h-[34px] px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
            >
              {isBn ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>

          {jobFormError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{jobFormError}</span>
            </div>
          )}

          {/* Step A: Leaving Current Garment Details */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isBn
                ? `১. বর্তমান গার্মেন্টস (${profile.factoryName}) ছাড়ার তথ্য:`
                : `1. Leaving Current Garment (${profile.factoryName}):`}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'পুরাতন কারখানায় শেষ কর্মদিবস' : 'Last Working Date'}
                </label>
                <DateInputDMY
                  dataTestId="new-job-leaving-date-input"
                  value={leavingDate}
                  lang={lang}
                  onChange={(val) => setLeavingDate(val || todayStr)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'চাকরি পরিবর্তনের কারণ (ঐচ্ছিক)' : 'Reason for Switching (Optional)'}
                </label>
                <input
                  type="text"
                  data-testid="new-job-leaving-reason-input"
                  value={leavingReason}
                  onChange={(e) => setLeavingReason(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Step B: New Garment Details */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              {isBn
                ? '২. নতুন গার্মেন্টস ও নতুন বেতনের বিবরণ:'
                : '2. New Garment Factory & Salary Details:'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নতুন গার্মেন্টস / কারখানার নাম *' : 'New Factory Name *'}
                </label>
                <input
                  type="text"
                  data-testid="new-job-factory-name-input"
                  value={newFactoryName}
                  onChange={(e) => setNewFactoryName(e.target.value)}
                  placeholder={
                    isBn
                      ? 'যেমন: স্কয়ার ফ্যাশনস লিমিটেড / হা-মীম ডেনিম'
                      : 'e.g. Square Fashions Ltd.'
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'শাখা / শিল্প এলাকা' : 'Branch / Industrial Area'}
                </label>
                <input
                  type="text"
                  data-testid="new-job-branch-input"
                  value={newFactoryBranch}
                  onChange={(e) => setNewFactoryBranch(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'সেকশন / লাইন' : 'Department / Line'}
                </label>
                <input
                  type="text"
                  data-testid="new-job-department-input"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নতুন পদবী' : 'New Designation'}
                </label>
                <input
                  type="text"
                  data-testid="new-job-designation-input"
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নতুন আইডি কার্ড নম্বর' : 'New Employee ID'}
                </label>
                <input
                  type="text"
                  data-testid="new-job-employee-id-input"
                  value={newEmployeeId}
                  onChange={(e) => setNewEmployeeId(e.target.value)}
                  placeholder="RMG-5021"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নতুন কারখানায় যোগদানের তারিখ' : 'New Joining Date'}
                </label>
                <DateInputDMY
                  dataTestId="new-job-joining-date-input"
                  value={newJoiningDate}
                  lang={lang}
                  onChange={(val) => setNewJoiningDate(val || todayStr)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নতুন মোট মাসিক বেতন / গ্রস (৳)' : 'New Gross Salary (৳)'}
                </label>
                <input
                  type="number"
                  min={0}
                  data-testid="new-job-gross-input"
                  value={newGrossSalary}
                  onChange={(e) => handleNewGrossChange(Number(e.target.value) || 0)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নতুন মূল বেতন / বেসিক (৳)' : 'New Basic Salary (৳)'}
                </label>
                <input
                  type="number"
                  min={0}
                  data-testid="new-job-basic-input"
                  value={newBasicSalary}
                  onChange={(e) => setNewBasicSalary(Number(e.target.value) || 0)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'কারখানার পূর্ণ ঠিকানা (ঐচ্ছিক)' : 'Factory Address (Optional)'}
                </label>
                <input
                  type="text"
                  value={newFactoryAddress}
                  onChange={(e) => setNewFactoryAddress(e.target.value)}
                  placeholder={isBn ? 'যেমন: ভালুকা, ময়মনসিংহ / আশুলিয়া, সাভার' : 'Factory address'}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isBn ? 'নতুন ডিউটি শিফট' : 'New Duty Shift'}
                </label>
                <select
                  data-testid="new-job-shift-select"
                  value={newShiftPattern}
                  onChange={(e) => setNewShiftPattern(e.target.value as WorkShiftPattern)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold"
                >
                  <option value="day">{isBn ? 'ডে শিফট (Day Shift)' : 'Day Shift'}</option>
                  <option value="night">{isBn ? 'নাইট শিফট (Night Shift)' : 'Night Shift'}</option>
                  <option value="weekly_rotation">
                    {isBn ? 'রোস্টার শিফট (Weekly Rotation)' : 'Weekly Rotation'}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowNewJobModal(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300"
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              data-testid="confirm-new-garment-job-btn"
              className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>
                {isBn
                  ? 'নতুন গার্মেন্টস চালু করুন ও আগেরটি আর্কাইভ করুন'
                  : 'Activate New Garment & Archive Current'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* ================================================================ */}
      {/* 3. PREVIOUS GARMENTS HISTORY & ANALYTICS REPORT SECTION          */}
      {/* ================================================================ */}
      <div
        data-testid="past-garments-history-section"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {isBn
                    ? 'আগের গার্মেন্টস (পূর্ববর্তী কর্মস্থলের ইতিহাস ও রিপোর্ট)'
                    : 'Previous Garments (Career History & Analytics Report)'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                  {formatNumber(pastWorkplaces.length, lang)} {isBn ? 'টি' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isBn
                  ? 'যেকোনো পূর্ববর্তী গার্মেন্টসে ক্লিক করে সেখানে কত টাকা বেতন পেয়েছেন, কত ঘণ্টা ওভারটাইম করেছেন এবং মোট হাজিরার পূর্ণাঙ্গ অ্যানালিটিক্স রিপোর্ট দেখুন'
                  : 'Click on any previous garment to inspect its full salary, overtime, and attendance analytics report'}
              </p>
            </div>
          </div>
        </div>

        {pastWorkplaces.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
            <Briefcase className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {isBn
                ? 'এখনো কোনো আগের গার্মেন্টসের ইতিহাস নেই'
                : 'No previous garment workplaces archived yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {isBn
                ? 'উপরে “নতুন গার্মেন্টসে যোগ দিন” বাটনে ক্লিক করে নতুন কারখানায় যোগ দিলে বর্তমান গার্মেন্টসটি স্বয়ংক্রিয়ভাবে এখানে অ্যানালিটিক্স রিপোর্টসহ চলে আসবে।'
                : 'When you join a new garment using the button above, your current garment will automatically move here with its analytics report.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {pastWorkplaces.map((wp) => {
              const metrics = resolvePastWorkplaceMetrics(wp);
              const isExpanded = expandedPastId === wp.id;
              const attendanceRate =
                metrics.totalPresentDays + metrics.totalAbsentDays > 0
                  ? Math.round(
                      (metrics.totalPresentDays /
                        (metrics.totalPresentDays + metrics.totalAbsentDays)) *
                        100
                    )
                  : 98;
              const avgMonthlyEarned =
                metrics.monthsWorked > 0
                  ? Math.round(metrics.totalReceivedSalary / metrics.monthsWorked)
                  : metrics.grossSalary;

              return (
                <div
                  key={wp.id}
                  data-testid={`past-garment-card-${wp.id}`}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 overflow-hidden transition-all"
                >
                  {/* Clickable Card Header */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          {wp.factoryName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold">
                          {isBn ? 'পূর্ববর্তী কর্মস্থল' : 'Past Workplace'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-400">
                          <Briefcase className="w-3.5 h-3.5" />
                          {wp.designation || (isBn ? 'অপারেটর' : 'Operator')}
                        </span>
                        {wp.factoryArea && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {wp.factoryArea}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDateReadable(wp.joiningDate || '2022-01-01', lang)} —{' '}
                          {wp.leavingDate
                            ? formatDateReadable(wp.leavingDate, lang)
                            : isBn
                            ? 'সমাপ্ত'
                            : 'Ended'}{' '}
                          ({formatNumber(metrics.monthsWorked, lang)}{' '}
                          {isBn ? 'মাস' : 'months'})
                        </span>
                      </div>

                      {/* Quick Highlight Chips */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          {isBn ? 'মোট প্রাপ্ত বেতন:' : 'Total Received:'}{' '}
                          {formatBDT(metrics.totalReceivedSalary, lang)}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {isBn ? 'ওভারটাইম:' : 'OT:'}{' '}
                          {formatNumber(metrics.totalOvertimeHours, lang)}{' '}
                          {isBn ? 'ঘণ্টা' : 'hrs'} (
                          {formatBDT(metrics.totalOvertimeEarnings, lang)})
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {isBn ? 'উপস্থিত:' : 'Present:'}{' '}
                          {formatNumber(metrics.totalPresentDays, lang)}{' '}
                          {isBn ? 'দিন' : 'days'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid={`toggle-past-garment-report-${wp.id}`}
                      onClick={() =>
                        setExpandedPastId((prev) => (prev === wp.id ? null : wp.id))
                      }
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer self-start sm:self-center"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>
                        {isExpanded
                          ? isBn
                            ? 'রিপোর্ট সংক্ষিপ্ত করুন'
                            : 'Hide Report'
                          : isBn
                          ? 'অ্যানালিটিক্স ও বেতন রিপোর্ট দেখুন'
                          : 'View Analytics & Salary Report'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Full Analytics & Financial Report */}
                  {isExpanded && (
                    <div
                      data-testid={`past-garment-analytics-report-${wp.id}`}
                      className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <span>
                            {isBn
                              ? `${wp.factoryName} — পূর্ণাঙ্গ অ্যানালিটিক্স ও বেতন রিপোর্ট`
                              : `${wp.factoryName} — Complete Analytics & Salary Report`}
                          </span>
                        </h4>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {isBn ? 'আইডি নম্বর:' : 'Employee ID:'}{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {wp.employeeId || 'N/A'}
                          </strong>
                        </span>
                      </div>

                      {/* 4 Key Financial & Overtime KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                            <Banknote className="w-3.5 h-3.5" />
                            <span>
                              {isBn ? 'মোট প্রাপ্ত বেতন' : 'Total Salary Received'}
                            </span>
                          </div>
                          <p className="text-base sm:text-lg font-extrabold text-emerald-900 dark:text-white mt-1">
                            {formatBDT(metrics.totalReceivedSalary, lang)}
                          </p>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {isBn ? 'মাসিক গড় আয়:' : 'Monthly Avg:'}{' '}
                            {formatBDT(avgMonthlyEarned, lang)}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              {isBn ? 'মোট ওভারটাইম ও আয়' : 'Overtime & Earnings'}
                            </span>
                          </div>
                          <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                            {formatNumber(metrics.totalOvertimeHours, lang)}{' '}
                            {isBn ? 'ঘণ্টা' : 'hrs'}
                          </p>
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            {isBn ? 'ওভারটাইম বাবদ:' : 'OT Earned:'}{' '}
                            {formatBDT(metrics.totalOvertimeEarnings, lang)}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <Award className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              {isBn ? 'উপস্থিতি ও হাজিরা রেকর্ড' : 'Attendance Summary'}
                            </span>
                          </div>
                          <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                            {formatNumber(metrics.totalPresentDays, lang)}{' '}
                            {isBn ? 'দিন উপস্থিত' : 'Days Present'}
                          </p>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {isBn
                              ? `ছুটি: ${formatNumber(
                                  metrics.totalLeaveDays,
                                  'bn'
                                )} দিন • অনুপস্থিত: ${formatNumber(
                                  metrics.totalAbsentDays,
                                  'bn'
                                )} দিন (${formatNumber(attendanceRate, 'bn')}%)`
                              : `Leave: ${metrics.totalLeaveDays}d • Absent: ${metrics.totalAbsentDays}d (${attendanceRate}%)`}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              {isBn ? 'সর্বশেষ বেতন কাঠামো' : 'Last Salary Structure'}
                            </span>
                          </div>
                          <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                            {formatBDT(metrics.grossSalary, lang)}
                          </p>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {isBn ? 'মূল বেতন (বেসিক):' : 'Basic:'}{' '}
                            {formatBDT(metrics.basicSalary, lang)}
                          </span>
                        </div>
                      </div>

                      {/* Additional Job Tenure Details Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                            {isBn ? 'বিভাগ ও লাইন নম্বর:' : 'Department & Line:'}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {[wp.department, wp.lineNumber, wp.floorNumber]
                              .filter(Boolean)
                              .join(' • ') || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                            {isBn ? 'সুপারভাইজার ও যোগাযোগ:' : 'Supervisor & Contact:'}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {[wp.supervisorName, wp.factoryPhone]
                              .filter(Boolean)
                              .join(' — ') || (isBn ? 'সংরক্ষিত নেই' : 'N/A')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                            {isBn ? 'চাকরি পরিবর্তনের কারণ / নোট:' : 'Leaving Reason / Notes:'}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {wp.leavingReason || wp.notes || (isBn ? 'নতুন কর্মস্থলে যোগদান' : 'Job Switch')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
