import React, { useEffect, useState } from 'react';
import {
  Banknote,
  Bell,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  FileSpreadsheet,
  FolderLock,
  HelpCircle,
  BellRing,
  Calculator as CalcIcon,
  Check,
  History,
  KeyRound,
  Lock,
  LogOut,
  Menu,
  PhoneCall,
  Printer,
  RotateCcw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Wallet,
  X,
  Layers,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { SalaryView } from './SalaryView';
import { ExpensesView } from './ExpensesView';
import { GarmentContactBookView } from './GarmentContactBookView';
import { FactoryShiftCareerView } from './FactoryShiftCareerView';
import { AlarmView } from './AlarmView';
import { CalculatorView } from './CalculatorView';
import { PersonalLoanView } from './PersonalLoanView';
import { AdminDashboardView } from './AdminDashboardView';
import { UserSubscriptionView } from './UserSubscriptionView';
import { DateInputDMY } from './DateInputDMY';
import { parseCalendarReminderMeta } from '../utils/calendarReminders';
import type {
  DocumentCategory,
  EmploymentType,
  FeedbackCategory,
  MoreSubView,
  NavTab,
  ReminderCategory,
  WorkShiftPattern,
} from '../types';
import {
  deriveBangladeshRMGBreakdownFromGross,
  formatBDT,
  formatNumber,
  getTodayISO,
  resolveWorkerShiftForDate,
  shiftDateISO,
  validateVaultFile,
  VERIFIED_WORKER_HELPLINES,
  type BackupBundle,
} from '../utils/calculations';
import { formatDateReadable, formatDateSlashDMY } from '../utils/i18n';

interface MoreHubViewProps {
  activeSubView: MoreSubView;
  onChangeSubView: (sub: MoreSubView) => void;
  onNavigateTab?: (tab: NavTab, sub?: MoreSubView) => void;
  openDrawerTrigger?: number;
  openRenewalTrigger?: number;
}

export const MoreHubView: React.FC<MoreHubViewProps> = ({
  activeSubView,
  onChangeSubView,
  openDrawerTrigger = 0,
  openRenewalTrigger = 0,
}) => {
  const {
    user,
    profile,
    lang,
    selectedMonth,
    overtime,
    salaryRecords,
    payments,
    attendance,
    expenses,
    savings,
    documents,
    reminders,
    loans,
    editHistory,
    feedbackList,
    isAdminUser,
    updateProfile,
    saveVaultDocument,
    deleteVaultDocument,
    saveReminder,
    toggleReminder,
    deleteReminder,
    restoreDeletedRecord,
    submitFeedback,
    resolveFeedback,
    importBackupNonDestructive,
    deleteAccountAndData,
    changeUserPassword,
    logout,
  } = useData();

  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(() => openDrawerTrigger > 0);

  // Password Change state & handler
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);
  const [changePassError, setChangePassError] = useState('');
  const [changePassSuccess, setChangePassSuccess] = useState('');

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError('');
    setChangePassSuccess('');
    if (newPassword.length < 4) {
      setChangePassError(
        lang === 'bn'
          ? 'নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।'
          : 'New password must be at least 4 characters long.'
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePassError(
        lang === 'bn'
          ? 'উভয় ঘরে পাসওয়ার্ড মিলছে না। অনুগ্রহ করে যাচাই করে পুনরায় লিখুন।'
          : 'Passwords do not match. Please verify and re-enter.'
      );
      return;
    }
    setIsUpdatingPass(true);
    try {
      await changeUserPassword(newPassword);
      setChangePassSuccess(
        lang === 'bn'
          ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!'
          : 'Password changed successfully!'
      );
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setShowChangePasswordForm(false);
        setChangePassSuccess('');
      }, 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setChangePassError(msg);
    } finally {
      setIsUpdatingPass(false);
    }
  };

  useEffect(() => {
    if (openDrawerTrigger > 0) {
      setIsDrawerOpen(true);
    }
  }, [openDrawerTrigger]);

  // Profile Form state
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [emergencyContact, setEmergencyContact] = useState(profile.emergencyContact);
  const [factoryName, setFactoryName] = useState(profile.factoryName);
  const [factoryBranch, setFactoryBranch] = useState(profile.factoryBranch);
  const [department, setDepartment] = useState(profile.department);
  const [designation, setDesignation] = useState(profile.designation);
  const [employeeId, setEmployeeId] = useState(profile.employeeId);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(profile.employmentType);
  const [joiningDate, setJoiningDate] = useState(profile.joiningDate);
  const [salaryGrade, setSalaryGrade] = useState(profile.salaryGrade);
  const [basicSalary, setBasicSalary] = useState(profile.basicSalary);
  const [grossSalary, setGrossSalary] = useState(profile.grossSalary);
  const [houseRentAllowance, setHouseRentAllowance] = useState(profile.houseRentAllowance);
  const [medicalAllowance, setMedicalAllowance] = useState(profile.medicalAllowance);
  const [transportAllowance, setTransportAllowance] = useState(profile.transportAllowance);
  const [foodAllowance, setFoodAllowance] = useState(profile.foodAllowance);
  const [attendanceBonus, setAttendanceBonus] = useState(profile.attendanceBonus);
  const [otCustomHourlyRate, setOtCustomHourlyRate] = useState(profile.otCustomHourlyRate || 0);
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

  useEffect(() => {
    setFullName(profile.fullName || '');
    setPhone(profile.phone || '');
    setAddress(profile.address || '');
    setEmergencyContact(profile.emergencyContact || '');
    setFactoryName(profile.factoryName || '');
    setFactoryBranch(profile.factoryBranch || '');
    setDepartment(profile.department || '');
    setDesignation(profile.designation || '');
    setEmployeeId(profile.employeeId || '');
    setEmploymentType(profile.employmentType || 'permanent');
    setJoiningDate(profile.joiningDate || '2025-01-01');
    setSalaryGrade(profile.salaryGrade || '');
    setBasicSalary(profile.basicSalary || 0);
    setGrossSalary(profile.grossSalary || 0);
    setHouseRentAllowance(profile.houseRentAllowance || 0);
    setMedicalAllowance(profile.medicalAllowance || 0);
    setTransportAllowance(profile.transportAllowance || 0);
    setFoodAllowance(profile.foodAllowance || 0);
    setAttendanceBonus(profile.attendanceBonus || 0);
    setOtCustomHourlyRate(profile.otCustomHourlyRate || 0);
    setShiftPattern(profile.shiftPattern || 'day');
    setDayShiftStartTime(profile.dayShiftStartTime || '08:00');
    setNightShiftStartTime(profile.nightShiftStartTime || '20:00');
    setRotationStartDate(profile.rotationStartDate || '2026-10-01');
  }, [profile]);

  // Document Vault state
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('payslip');
  const [docIssueDate, setDocIssueDate] = useState(`${selectedMonth}-05`);
  const [docNotes, setDocNotes] = useState('');

  // Reminder state
  const [remTitle, setRemTitle] = useState('');
  const [remCategory, setRemCategory] = useState<ReminderCategory>('salary_date');
  const [remDate, setRemDate] = useState(`${selectedMonth}-10`);
  const [remNotes, setRemNotes] = useState('');

  // Labor Law / High-Thinking Advisor state
  const [advisorQuery, setAdvisorQuery] = useState('');
  const [advisorAnswer, setAdvisorAnswer] = useState('');
  const [advisorLoading, setAdvisorLoading] = useState(false);

  // Support Feedback state
  const [fbCategory, setFbCategory] = useState<FeedbackCategory>('calculation_help');
  const [fbMessage, setFbMessage] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<'personal' | 'job' | 'salary' | null>(null);

  const getEmploymentTypeLabel = (type: EmploymentType) => {
    if (lang !== 'bn') return type;
    switch (type) {
      case 'permanent':
        return 'স্থায়ী';
      case 'probation':
        return 'শিক্ষানবিশ';
      case 'contractual':
        return 'চুক্তিভিত্তিক';
      case 'piece_rate':
        return 'পিস রেট';
      case 'helper':
        return 'হেল্পার';
      default:
        return 'স্থায়ী';
    }
  };

  const handleAutoSplitGross = () => {
    const split = deriveBangladeshRMGBreakdownFromGross(grossSalary);
    setBasicSalary(split.basicSalary);
    setHouseRentAllowance(split.houseRentAllowance);
    setMedicalAllowance(split.medicalAllowance);
    setTransportAllowance(split.transportAllowance);
    setFoodAllowance(split.foodAllowance);
    setNotice(
      lang === 'bn'
        ? `মোট বেতন ${formatBDT(grossSalary, 'bn')} হতে বাংলাদেশ গার্মেন্টস মজুরি কাঠামো অনুযায়ী মূল বেতন ${formatBDT(split.basicSalary, 'bn')} ও ভাতাসমূহ নির্ধারণ করা হয়েছে।`
        : `Calculated Basic Salary (${formatBDT(split.basicSalary, 'en')}) and standard allowances from Gross Salary.`
    );
  };

  const handleSavePersonal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    await updateProfile({
      fullName,
      phone,
      address,
      emergencyContact,
    });
    setEditingSection(null);
    setNotice(
      lang === 'bn'
        ? 'ব্যক্তিগত তথ্য সফলভাবে সংরক্ষিত হয়েছে।'
        : 'Personal information saved successfully.'
    );
  };

  const handleSaveJob = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    await updateProfile({
      factoryName,
      factoryBranch,
      department,
      designation,
      employeeId,
      employmentType,
      joiningDate,
      salaryGrade,
    });
    setEditingSection(null);
    setNotice(
      lang === 'bn'
        ? 'চাকরির পদবী ও বিবরণ সফলভাবে সংরক্ষিত হয়েছে।'
        : 'Job details saved successfully.'
    );
  };

  const handleSaveSalary = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    await updateProfile({
      basicSalary,
      grossSalary,
      houseRentAllowance,
      medicalAllowance,
      transportAllowance,
      foodAllowance,
      attendanceBonus,
      otCustomHourlyRate,
      otCalculationMode: otCustomHourlyRate > 0 ? 'manual' : profile.otCalculationMode,
    });
    setEditingSection(null);
    setNotice(
      lang === 'bn'
        ? 'বেতন ও ভাতার হিসাব সফলভাবে সংরক্ষিত হয়েছে।'
        : 'Salary structure saved successfully.'
    );
  };

  const handleSaveWorkerProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    await updateProfile({
      fullName,
      phone,
      address,
      emergencyContact,
      factoryName,
      factoryBranch,
      department,
      designation,
      employeeId,
      employmentType,
      joiningDate,
      salaryGrade,
      basicSalary,
      grossSalary,
      houseRentAllowance,
      medicalAllowance,
      transportAllowance,
      foodAllowance,
      attendanceBonus,
      otCustomHourlyRate,
      otCalculationMode: otCustomHourlyRate > 0 ? 'manual' : profile.otCalculationMode,
    });
    setEditingSection(null);
    setNotice(
      lang === 'bn'
        ? 'প্রোফাইল ও বেতন বিবরণ সফলভাবে সংরক্ষিত হয়েছে।'
        : 'Worker profile and salary structure saved successfully.'
    );
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    setNotice('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg(
        lang === 'bn'
          ? 'অনুগ্রহ করে একটি বৈধ ছবির ফাইল (PNG, JPG, WEBP) নির্বাচন করুন।'
          : 'Please select a valid image file (PNG, JPG, WEBP).'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_SIDE = 128;
          let width = img.width || MAX_SIDE;
          let height = img.height || MAX_SIDE;
          if (width > height) {
            if (width > MAX_SIDE) {
              height = Math.max(1, Math.round((height * MAX_SIDE) / width));
              width = MAX_SIDE;
            }
          } else if (height > MAX_SIDE) {
            width = Math.max(1, Math.round((width * MAX_SIDE) / height));
            height = MAX_SIDE;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          let finalDataUrl = rawDataUrl;
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            finalDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          }
          await updateProfile({ photoUrl: finalDataUrl });
          setNotice(
            lang === 'bn'
              ? 'আপনার প্রোফাইল ছবি সফলভাবে সংরক্ষিত হয়েছে!'
              : 'Your profile photo has been updated!'
          );
        } catch {
          await updateProfile({ photoUrl: rawDataUrl.slice(0, 145000) });
          setNotice(
            lang === 'bn'
              ? 'আপনার প্রোফাইল ছবি সফলভাবে সংরক্ষিত হয়েছে!'
              : 'Your profile photo has been updated!'
          );
        }
      };
      img.onerror = async () => {
        await updateProfile({ photoUrl: rawDataUrl.slice(0, 145000) });
        setNotice(
          lang === 'bn'
            ? 'আপনার প্রোফাইল ছবি সফলভাবে সংরক্ষিত হয়েছে!'
            : 'Your profile photo has been updated!'
        );
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProfilePhoto = async () => {
    await updateProfile({ photoUrl: '' });
    setNotice(
      lang === 'bn'
        ? 'প্রোফাইল ছবি সরানো হয়েছে।'
        : 'Profile photo removed.'
    );
  };

  const [showFactoryForm, setShowFactoryForm] = useState(false);

  const handleSaveFactorySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    await updateProfile({
      factoryName,
      factoryBranch,
      department,
      designation,
      employeeId,
      shiftPattern,
      dayShiftStartTime,
      nightShiftStartTime,
      rotationStartDate,
    });
    setShowFactoryForm(false);
    setNotice(
      lang === 'bn'
        ? 'কারখানা ও শিফট সেটিংস সফলভাবে সংরক্ষিত হয়েছে।'
        : 'Factory information and shift settings saved successfully.'
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    setNotice('');
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateVaultFile(file.name, file.type, file.size);
    if (!validation.valid) {
      setErrorMsg(
        lang === 'bn'
          ? 'শুধুমাত্র PNG, JPG, WEBP বা PDF ফাইল (সর্বোচ্চ ৫০০ কিলোবাইট) আপলোড করা যাবে।'
          : 'Only PNG, JPG, WEBP, or PDF files up to 500 KB are permitted.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      await saveVaultDocument({
        title: docTitle.trim() || file.name,
        category: docCategory,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: dataUrl,
        issueDate: docIssueDate,
        notes: docNotes.trim(),
      });
      setDocTitle('');
      setDocNotes('');
      setNotice(
        lang === 'bn'
          ? 'নথিটি আপনার ব্যক্তিগত ভল্টে নিরাপদে সংরক্ষিত হয়েছে।'
          : 'Document securely saved in your private vault.'
      );
    };
    reader.readAsDataURL(file);
  };

  const handleExportCSV = () => {
    const rows = [
      ['Type', 'Date/Month', 'Category/Hours', 'Amount(BDT)', 'Notes'],
      ...overtime.map((o) => [
        'Overtime',
        o.date,
        `${o.approvedHours} hrs`,
        String(o.estimatedEarnings),
        `"${(o.notes || '').replace(/"/g, '""')}"`,
      ]),
      ...payments.map((p) => [
        'SalaryPayment',
        p.paymentDate,
        p.paymentMethod,
        String(p.amountReceived),
        `"${(p.referenceNote || '').replace(/"/g, '""')}"`,
      ]),
      ...expenses.map((e) => [
        'Expense',
        e.date,
        e.category,
        String(e.amount),
        `"${(e.description || '').replace(/"/g, '""')}"`,
      ]),
      ...attendance.map((a) => [
        'Attendance',
        a.date,
        a.status,
        '0',
        `"${(a.notes || '').replace(/"/g, '""')}"`,
      ]),
      ...loans.map((l) => [
        'Loan',
        l.nextDueDate || l.transactionDate || '',
        l.lenderType || l.direction || '',
        String(Math.max(0, (l.totalLoanAmount || l.originalAmount || 0) - (l.paidAmount || 0))),
        `"${(l.title || l.personName || '').replace(/"/g, '""')}"`,
      ]),
    ];
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shromik_sathi_report_${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(
      lang === 'bn' ? 'CSV রিপোর্ট ডাউনলোড শুরু হয়েছে।' : 'CSV report downloaded.'
    );
  };

  const handleExportBackupJSON = () => {
    const bundle: BackupBundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      overtime,
      salaryRecords,
      payments,
      attendance,
      expenses,
      savings,
      documents,
      reminders,
      loans,
      editHistory,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shromik_sathi_backup_${selectedMonth}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(
      lang === 'bn'
        ? 'সম্পূর্ণ ব্যাকআপ ফাইল (.json) ডাউনলোড সম্পন্ন হয়েছে।'
        : 'Backup file downloaded.'
    );
  };

  const handleImportBackupJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupBundle;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON');
      }
      const res = await importBackupNonDestructive(parsed);
      setNotice(
        lang === 'bn'
          ? `ব্যাকআপ পুনরুদ্ধার সম্পন্ন: ${formatNumber(res.added, 'bn')}টি নতুন রেকর্ড যোগ হয়েছে (${formatNumber(res.skipped, 'bn')}টি পূর্ববর্তী রেকর্ড অপরিবর্তিত রাখা হয়েছে)।`
          : `Backup restored: ${res.added} new records added (${res.skipped} existing records preserved).`
      );
    } catch {
      setErrorMsg(
        lang === 'bn'
          ? 'ব্যাকআপ ফাইলটি সঠিক নয়। অনুগ্রহ করে বৈধ JSON ব্যাকআপ ফাইল নির্বাচন করুন।'
          : 'Invalid backup file format.'
      );
    }
  };

  const handleAskAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advisorQuery.trim()) return;
    setAdvisorLoading(true);
    setAdvisorAnswer('');

    try {
      const resp = await fetch('/api/gemini/analyze-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: advisorQuery.trim(),
          contextSummary: {
            basicSalary: profile.basicSalary,
            grossSalary: profile.grossSalary,
            otDivisor: profile.otDivisor,
            otMultiplier: profile.otMultiplier,
          },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.answer) {
          setAdvisorAnswer(data.answer);
          setAdvisorLoading(false);
          return;
        }
      }
    } catch {
      // Fallback to built-in labor law calculation explanation
    }

    const hourlyOt = ((profile.basicSalary / profile.otDivisor) * profile.otMultiplier).toFixed(2);
    setAdvisorAnswer(
      lang === 'bn'
        ? `বাংলাদেশ শ্রম আইন ২০০৬ (ধারা ১০৮) অনুযায়ী:\n• আপনার মূল বেতন (Basic): ৳ ${profile.basicSalary}\n• প্রতি ঘণ্টার ওভারটাইম হার = (মূল বেতন ÷ ২০৮) × ২ = ৳ ${hourlyOt}\n• বাৎসরিক ছুটি: নৈমিত্তিক ছুটি ১০ দিন (পূর্ণ বেতনে), অসুস্থতাজনিত ছুটি ১৪ দিন (পূর্ণ বেতনে), এবং প্রতি ১৮ দিন কাজের জন্য ১ দিন অর্জিত ছুটি।\n(বিঃদ্রঃ এটি ব্যক্তিগত হিসাবের সহায়িকা, কারখানার চূড়ান্ত পে-স্লিপের সাথে মিলিয়ে নিন।)`
        : `Under Bangladesh Labor Act 2006 (Sec 108):\n• Your Basic Salary: ৳ ${profile.basicSalary}\n• Hourly Overtime Rate = (Basic ÷ 208) × 2 = ৳ ${hourlyOt}\n• Annual Leave Entitlements: 10 days Casual Leave, 14 days Sick Leave, and 1 day Earned Leave per 18 working days.`
    );
    setAdvisorLoading(false);
  };

  const subTabs: Array<{
    id: MoreSubView;
    labelBn: string;
    labelEn: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'profile',
      labelBn: 'শ্রমিক প্রোফাইল',
      labelEn: 'Worker Profile',
      icon: <UserCheck className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'alarm',
      labelBn: 'অ্যালার্ম',
      labelEn: 'Alarm',
      icon: <BellRing className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'calculator',
      labelBn: 'ক্যালকুলেটর',
      labelEn: 'Calculator',
      icon: <CalcIcon className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'contacts',
      labelBn: 'গার্মেন্টস ও কন্ট্যাক্ট বুক',
      labelEn: 'Garment & Contacts',
      icon: <BookOpen className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'factory',
      labelBn: 'কারখানা ও শিফট',
      labelEn: 'Factory & Shift',
      icon: <Building2 className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'salary',
      labelBn: 'বেতন ও পে-স্লিপ',
      labelEn: 'Salary & Payslip',
      icon: <Banknote className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'finance',
      labelBn: 'ব্যক্তিগত হিসাব',
      labelEn: 'Personal Finance',
      icon: <Wallet className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'personal_loans',
      labelBn: 'ধার-দেনা ও ঋণ হিসাব',
      labelEn: 'Personal Loans & Debt',
      icon: <Scale className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'documents',
      labelBn: 'কাগজপত্র ভল্ট',
      labelEn: 'Document Vault',
      icon: <FolderLock className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'reports',
      labelBn: 'রিপোর্ট ও ব্যাকআপ',
      labelEn: 'Reports & Backup',
      icon: <Download className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'reminders',
      labelBn: 'রিমাইন্ডার ও আইন',
      labelEn: 'Reminders & Law',
      icon: <Bell className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'support',
      labelBn: 'সহায়তা ও নীতিমালা',
      labelEn: 'Support & Privacy',
      icon: <HelpCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'subscriptions',
      labelBn: 'সাবস্ক্রিপশন ও প্ল্যান',
      labelEn: 'Subscriptions & Plans',
      icon: <Layers className="w-3.5 h-3.5 shrink-0" />,
    },
    ...(isAdminUser
      ? [
          {
            id: 'admin_panel' as MoreSubView,
            labelBn: 'অ্যাডমিন ড্যাশবোর্ড',
            labelEn: 'Admin Dashboard',
            icon: <ShieldCheck className="w-3.5 h-3.5 shrink-0" />,
          },
        ]
      : []),
  ];

  const currentTabInfo = subTabs.find((s) => s.id === activeSubView);

  return (
    <div className="space-y-5">
      {/* Mobile-Only Minimal Slide Menu Bar (Always accessible on Mobile across all More sub-views) */}
      <div className="md:hidden flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-2 no-print">
        <button
          type="button"
          data-testid="open-slide-menu-btn"
          onClick={() => setIsDrawerOpen(true)}
          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
        >
          <Menu className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'সব মেনু তালিকা' : 'All Menus'}</span>
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-slate-400 shrink-0">
            {lang === 'bn' ? 'শাখা:' : 'Section:'}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
            {lang === 'bn' ? currentTabInfo?.labelBn : currentTabInfo?.labelEn}
          </span>
        </div>
      </div>

      {/* Desktop Sub-navigation Bar — Wrapped Multi-Row Pill Grid so ALL options (Profile, Vault, Reports, Reminders, Support, etc.) are 100% visible simultaneously */}
      <div
        data-testid="more-desktop-subnav"
        className="hidden md:flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl no-print shadow-2xs"
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {subTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`more-subtab-${t.id}`}
              onClick={() => {
                onChangeSubView(t.id);
                setNotice('');
                setErrorMsg('');
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                activeSubView === t.id
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-slate-50/80 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70'
              }`}
            >
              {t.icon}
              <span>{lang === 'bn' ? t.labelBn : t.labelEn}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={logout}
          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/70 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'লগআউট' : 'Logout'}</span>
        </button>
      </div>

      {/* Mobile-Only Compact Minimal Slide-Over Drawer (No Scrollbar, Lightweight Typography) */}
      {isDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex no-print">
          {/* Backdrop */}
          <div
            data-testid="slide-menu-backdrop"
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity"
          />

          {/* Compact Minimal Slide-In Sidebar */}
          <div
            data-testid="slide-menu-drawer"
            className="relative w-[240px] max-w-[78vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl flex flex-col h-full z-10 overflow-hidden"
          >
            {/* Compact Drawer Header */}
            <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {lang === 'bn' ? 'শ্রমিক সাথী' : 'Shromik Sathi'}
                </span>
              </div>

              <button
                type="button"
                data-testid="close-slide-menu-btn"
                onClick={() => setIsDrawerOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Minimal Feature List — Scrollbar Hidden & Compact Single-Line Items */}
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-2 space-y-0.5">
              {subTabs.map((item) => {
                const isCurrent = activeSubView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`drawer-item-${item.id}`}
                    onClick={() => {
                      onChangeSubView(item.id);
                      setIsDrawerOpen(false);
                      setNotice('');
                      setErrorMsg('');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between gap-2 ${
                      isCurrent
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-medium'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-normal'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          isCurrent
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.icon}
                      </div>
                      <span className="text-xs truncate">
                        {lang === 'bn' ? item.labelBn : item.labelEn}
                      </span>
                    </div>

                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isCurrent
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Bottom Profile & Logout Bar */}
            <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onChangeSubView('profile');
                  setIsDrawerOpen(false);
                }}
                className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-xl p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {profile.photoUrl || user?.photoURL ? (
                  <img
                    src={profile.photoUrl || user?.photoURL || ''}
                    alt={profile.fullName || 'প্রোফাইল'}
                    className="w-8 h-8 rounded-full object-cover border border-emerald-200 dark:border-emerald-800 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {(profile.fullName || user?.displayName || 'শ্র').charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {profile.fullName || user?.displayName || (lang === 'bn' ? 'শ্রমিক প্রোফাইল' : 'Worker Profile')}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {lang === 'bn' ? 'প্রোফাইল দেখুন' : 'View Profile'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                data-testid="drawer-logout-btn"
                onClick={() => {
                  setIsDrawerOpen(false);
                  logout();
                }}
                title={lang === 'bn' ? 'লগআউট করুন' : 'Sign Out'}
                aria-label={lang === 'bn' ? 'লগআউট করুন' : 'Sign Out'}
                className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 border border-red-200/80 dark:border-red-800/70 text-red-700 dark:text-red-300 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'bn' ? 'লগআউট' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-300"
        >
          {errorMsg}
        </div>
      )}

      {/* 1. WORKER PROFILE SUBVIEW */}
      {activeSubView === 'profile' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap overflow-hidden">
            <div className="flex items-center gap-2.5 min-w-0 truncate">
              {/* User Profile Photo Avatar */}
              <div
                data-testid="profile-user-avatar-box"
                className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-emerald-500/80 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 flex items-center justify-center shrink-0 shadow-2xs"
              >
                {profile.photoUrl || user?.photoURL ? (
                  <img
                    src={profile.photoUrl || user?.photoURL || ''}
                    alt={profile.fullName || 'প্রোফাইল ছবি'}
                    data-testid="profile-user-photo-img"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    data-testid="profile-user-photo-fallback"
                    className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200"
                  >
                    {(profile.fullName || user?.displayName || 'শ্র').trim().charAt(0)}
                  </span>
                )}
              </div>

              <h2
                data-testid="worker-profile-heading"
                className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 truncate"
              >
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span className="truncate">
                  {lang === 'bn' ? 'প্রোফাইল' : 'Profile'}
                </span>
              </h2>
            </div>

            {/* Profile Photo Controls & Profile Edit Icon Button */}
            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
              <label
                data-testid="profile-photo-upload-label"
                title={
                  lang === 'bn'
                    ? profile.photoUrl
                      ? 'ছবি পরিবর্তন করুন'
                      : 'প্রোফাইল ছবি যুক্ত করুন'
                    : 'Upload/Change Photo'
                }
                className="min-h-[36px] w-[36px] flex items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 cursor-pointer transition-colors shrink-0"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <input
                  data-testid="profile-photo-upload-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleProfilePhotoUpload}
                  className="hidden"
                />
              </label>

              {profile.photoUrl && (
                <button
                  type="button"
                  data-testid="profile-photo-remove-btn"
                  onClick={handleRemoveProfilePhoto}
                  title={lang === 'bn' ? 'ছবি মুছুন' : 'Remove Photo'}
                  className="min-h-[36px] w-[36px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                </button>
              )}

              <button
                type="button"
                data-testid="edit-worker-profile-btn"
                onClick={() => setEditingSection(editingSection === 'personal' ? null : 'personal')}
                title={lang === 'bn' ? 'প্রোফাইল এডিট করুন' : 'Edit Profile'}
                className="min-h-[36px] w-[36px] flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <Edit2 className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* SECTION 1: PERSONAL INFORMATION */}
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'ব্যক্তিগত তথ্য' : 'Personal Information'}
                </h3>
                {editingSection !== 'personal' ? (
                  <button
                    type="button"
                    data-testid="edit-personal-section-btn"
                    onClick={() => setEditingSection('personal')}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'এডিট করুন' : 'Edit'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingSection(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                )}
              </div>

              {editingSection === 'personal' ? (
                <form onSubmit={handleSavePersonal} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone Number'}
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'জরুরি যোগাযোগ' : 'Emergency Contact'}
                      </label>
                      <input
                        type="text"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'বর্তমান ঠিকানা' : 'Present Address'}
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingSection(null)}
                      className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      data-testid="save-personal-section-btn"
                      className="min-h-[40px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer"
                    >
                      {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Personal Info'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-white dark:bg-slate-800/80 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/70">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {fullName || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone Number'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {phone || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'জরুরি যোগাযোগ' : 'Emergency Contact'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {emergencyContact || '—'}
                    </p>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'বর্তমান ঠিকানা' : 'Present Address'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {address || '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ACCOUNT & PASSWORD SECURITY (পাসওয়ার্ড পরিবর্তন) */}
            <div
              data-testid="profile-password-security-section"
              className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'অ্যাকাউন্ট ও পাসওয়ার্ড নিরাপত্তা' : 'Account & Password Security'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user?.email || profile.userId || (lang === 'bn' ? 'লগইন অ্যাকাউন্ট' : 'Active Account')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="toggle-change-password-btn"
                  onClick={() => {
                    setShowChangePasswordForm((v) => !v);
                    setChangePassError('');
                    setChangePassSuccess('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {showChangePasswordForm
                      ? lang === 'bn' ? 'বাতিল' : 'Cancel'
                      : lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Change Password'}
                  </span>
                </button>
              </div>

              {showChangePasswordForm && (
                <form
                  onSubmit={handlePasswordChangeSubmit}
                  className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-3"
                >
                  {changePassError && (
                    <div
                      role="alert"
                      className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
                    >
                      {changePassError}
                    </div>
                  )}
                  {changePassSuccess && (
                    <div
                      role="alert"
                      className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{changePassSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password'}
                      </label>
                      <input
                        data-testid="new-password-input"
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={lang === 'bn' ? 'কমপক্ষে ৪ অক্ষর লিখুন' : 'At least 4 chars'}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
                      </label>
                      <input
                        data-testid="confirm-new-password-input"
                        type="password"
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder={lang === 'bn' ? 'পাসওয়ার্ডটি আবার লিখুন' : 'Re-enter password'}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isUpdatingPass}
                      data-testid="submit-change-password-btn"
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>
                        {isUpdatingPass
                          ? lang === 'bn' ? 'আপডেট হচ্ছে...' : 'Updating...'
                          : lang === 'bn' ? 'পাসওয়ার্ড আপডেট করুন' : 'Update Password'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowChangePasswordForm(false)}
                      className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* SECTION 2: JOB & DESIGNATION DETAILS */}
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'চাকরির পদবী ও বিবরণ' : 'Designation & Employment Details'}
                </h3>
                {editingSection !== 'job' ? (
                  <button
                    type="button"
                    data-testid="edit-job-section-btn"
                    onClick={() => setEditingSection('job')}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'এডিট করুন' : 'Edit'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingSection(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                )}
              </div>

              {editingSection === 'job' ? (
                <form onSubmit={handleSaveJob} className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'কারখানার নাম' : 'Factory Name'}
                      </label>
                      <input
                        type="text"
                        data-testid="profile-factory-name-input"
                        value={factoryName}
                        onChange={(e) => setFactoryName(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'এলাকা / শাখা' : 'Area / Branch'}
                      </label>
                      <input
                        type="text"
                        data-testid="profile-factory-branch-input"
                        value={factoryBranch}
                        onChange={(e) => setFactoryBranch(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'সেকশন / লাইন' : 'Department / Line'}
                      </label>
                      <input
                        type="text"
                        data-testid="profile-department-input"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'পদবী' : 'Designation'}
                      </label>
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'কার্ড / আইডি নম্বর' : 'Employee ID'}
                      </label>
                      <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'চাকরির ধরন' : 'Employment Type'}
                      </label>
                      <select
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium"
                      >
                        <option value="permanent">{lang === 'bn' ? 'স্থায়ী' : 'Permanent'}</option>
                        <option value="probation">{lang === 'bn' ? 'শিক্ষানবিশ' : 'Probation'}</option>
                        <option value="contractual">{lang === 'bn' ? 'চুক্তিভিত্তিক' : 'Contractual'}</option>
                        <option value="piece_rate">{lang === 'bn' ? 'পিস রেট' : 'Piece Rate'}</option>
                        <option value="helper">{lang === 'bn' ? 'হেল্পার' : 'Helper'}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}
                      </label>
                      <DateInputDMY
                        dataTestId="profile-joining-date-input"
                        value={joiningDate}
                        lang={lang}
                        onChange={setJoiningDate}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'বেতন গ্রেড' : 'Salary Grade'}
                      </label>
                      <input
                        type="text"
                        value={salaryGrade}
                        onChange={(e) => setSalaryGrade(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingSection(null)}
                      className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      data-testid="save-job-section-btn"
                      className="min-h-[40px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer"
                    >
                      {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Job Details'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-800/80 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/70">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'কারখানার নাম' : 'Factory Name'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {factoryName || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'এলাকা / শাখা' : 'Area / Branch'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {factoryBranch || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'সেকশন / লাইন' : 'Department / Line'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {department || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'পদবী' : 'Designation'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {designation || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'কার্ড / আইডি নম্বর' : 'Employee ID'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {employeeId || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'চাকরির ধরন' : 'Employment Type'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {getEmploymentTypeLabel(employmentType)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {joiningDate ? formatDateSlashDMY(joiningDate, lang) : '—'}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'বেতন গ্রেড' : 'Salary Grade'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {salaryGrade || '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: SALARY & ALLOWANCE SETUP */}
            <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-4">
              <div
                data-testid="profile-salary-header-row"
                className="flex items-center justify-between gap-2"
              >
                <h3
                  data-testid="profile-salary-title"
                  className="text-sm font-bold text-slate-900 dark:text-white"
                >
                  {lang === 'bn' ? 'বেতন ও ভাতার হিসাব' : 'Salary Structure'}
                </h3>
                {editingSection !== 'salary' ? (
                  <button
                    type="button"
                    data-testid="edit-salary-section-btn"
                    onClick={() => setEditingSection('salary')}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'এডিট করুন' : 'Edit'}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="profile-auto-split-gross-btn"
                      onClick={handleAutoSplitGross}
                      className="min-h-[30px] px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                      {lang === 'bn'
                        ? 'মোট বেতন থেকে অটো হিসাব'
                        : 'Auto-Calculate Basic'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSection(null)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>

              {editingSection === 'salary' ? (
                <form onSubmit={handleSaveSalary} className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'মোট বেতন' : 'Gross Salary'}
                      </label>
                      <input
                        type="number"
                        value={grossSalary}
                        onChange={(e) => setGrossSalary(Number(e.target.value) || 0)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'মূল বেতন' : 'Basic Salary'}
                      </label>
                      <input
                        type="number"
                        value={basicSalary}
                        onChange={(e) => setBasicSalary(Number(e.target.value) || 0)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'বাড়ি ভাড়া ভাতা' : 'House Rent'}
                      </label>
                      <input
                        type="number"
                        value={houseRentAllowance}
                        onChange={(e) => setHouseRentAllowance(Number(e.target.value) || 0)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm tabular-nums font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'চিকিৎসা ভাতা' : 'Medical Allowance'}
                      </label>
                      <input
                        type="number"
                        value={medicalAllowance}
                        onChange={(e) => setMedicalAllowance(Number(e.target.value) || 0)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm tabular-nums font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'যাতায়াত ও খাদ্য ভাতা' : 'Transport & Food'}
                      </label>
                      <input
                        type="number"
                        value={transportAllowance + foodAllowance}
                        onChange={(e) => {
                          const total = Number(e.target.value) || 0;
                          setTransportAllowance(Math.min(450, total));
                          setFoodAllowance(Math.max(0, total - Math.min(450, total)));
                        }}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm tabular-nums font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'হাজিরা বোনাস' : 'Attendance Bonus'}
                      </label>
                      <input
                        type="number"
                        value={attendanceBonus}
                        onChange={(e) => setAttendanceBonus(Number(e.target.value) || 0)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm tabular-nums font-medium"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'ওভারটাইম ঘণ্টা প্রতি হার (৳)' : 'Hourly OT Rate (৳)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        data-testid="profile-ot-rate-input"
                        value={otCustomHourlyRate}
                        onChange={(e) => setOtCustomHourlyRate(Number(e.target.value) || 0)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm tabular-nums font-bold text-emerald-700 dark:text-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingSection(null)}
                      className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      data-testid="save-salary-section-btn"
                      className="min-h-[40px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer"
                    >
                      {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Salary Setup'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-800/80 rounded-xl p-3.5 border border-emerald-200/60 dark:border-emerald-900/40">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'মোট বেতন' : 'Gross Salary'}
                    </span>
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {formatBDT(grossSalary, lang)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'মূল বেতন' : 'Basic Salary'}
                    </span>
                    <p className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                      {formatBDT(basicSalary, lang)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'বাড়ি ভাড়া ভাতা' : 'House Rent'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {formatBDT(houseRentAllowance, lang)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'চিকিৎসা ভাতা' : 'Medical Allowance'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {formatBDT(medicalAllowance, lang)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'যাতায়াত ও খাদ্য ভাতা' : 'Transport & Food'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {formatBDT(transportAllowance + foodAllowance, lang)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'হাজিরা বোনাস' : 'Attendance Bonus'}
                    </span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {formatBDT(attendanceBonus, lang)}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'ওভারটাইম ঘণ্টা প্রতি হার' : 'Hourly OT Rate'}
                    </span>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                      {formatBDT(
                        otCustomHourlyRate > 0
                          ? otCustomHourlyRate
                          : Math.round(((basicSalary / 208) * 2) * 100) / 100,
                        lang,
                        true
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. GARMENT & CONTACT BOOK SUBVIEW */}
      {activeSubView === 'contacts' && <GarmentContactBookView />}

      {/* 3. FACTORY & SHIFT SETTINGS + PREVIOUS GARMENTS CAREER HISTORY SUBVIEW */}
      {activeSubView === 'factory' && (
        <FactoryShiftCareerView onShowNotice={setNotice} />
      )}

      {/* 3. SALARY & PAYSLIP SUBVIEW INSIDE MORE */}
      {activeSubView === 'salary' && (
        <div className="space-y-4">
          <SalaryView />
        </div>
      )}

      {/* 4. PERSONAL FINANCE & LOANS SUBVIEW INSIDE MORE */}
      {activeSubView === 'finance' && (
        <div className="space-y-4">
          <ExpensesView />
        </div>
      )}
      {/* 2. PRIVATE DOCUMENT VAULT */}
      {activeSubView === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <FolderLock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>
                {lang === 'bn' ? 'ব্যক্তিগত ডকুমেন্ট ভল্টে যোগ করুন' : 'Add to Private Document Vault'}
              </span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'bn' ? 'নথির শিরোনাম' : 'Document Title'}
              </label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder={
                  lang === 'bn' ? 'যেমন: নিয়োগপত্র বা আইডি কার্ড' : 'e.g. Appointment Letter'
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'ধরন (Category)' : 'Category'}
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                >
                  <option value="id_card">{lang === 'bn' ? 'পরিচয়পত্র (ID Card)' : 'ID Card'}</option>
                  <option value="appointment_letter">
                    {lang === 'bn' ? 'নিয়োগপত্র (Appointment Letter)' : 'Appointment Letter'}
                  </option>
                  <option value="payslip">{lang === 'bn' ? 'পে-স্লিপ (Payslip)' : 'Payslip'}</option>
                  <option value="increment_letter">
                    {lang === 'bn' ? 'ইনক্রিমেন্ট লেটার' : 'Increment Letter'}
                  </option>
                  <option value="leave_approval">
                    {lang === 'bn' ? 'ছুটির অনুমোদনপত্র' : 'Leave Approval'}
                  </option>
                  <option value="other">{lang === 'bn' ? 'অন্যান্য' : 'Other'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'ইস্যু তারিখ' : 'Issue Date'}
                </label>
                <DateInputDMY
                  value={docIssueDate}
                  lang={lang}
                  onChange={setDocIssueDate}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'bn' ? 'নোট (ঐচ্ছিক)' : 'Notes'}
              </label>
              <input
                type="text"
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm"
              />
            </div>

            <label className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span>
                {lang === 'bn' ? 'ফাইল নির্বাচন ও সংরক্ষণ করুন' : 'Select & Upload File'}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              {lang === 'bn' ? 'সংরক্ষিত ব্যক্তিগত কাগজপত্র' : 'Saved Private Documents'}
            </h3>

            {documents.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-500">
                {lang === 'bn' ? 'কোনো ডকুমেন্ট সংরক্ষিত নেই।' : 'No documents stored yet.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {documents.map((d) => (
                  <div
                    key={d.id}
                    className="py-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {d.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {d.fileName} · {Math.round(d.fileSize / 1024)} KB ·{' '}
                        {formatDateReadable(d.issueDate, lang)}
                      </p>
                      {d.notes && <p className="text-xs text-slate-600 mt-1">{d.notes}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      {d.fileData && (
                        <a
                          href={d.fileData}
                          download={d.fileName}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteVaultDocument(d.id)}
                        aria-label={`Delete document ${d.title}`}
                        className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. REPORTS, EXPORTS, NON-DESTRUCTIVE BACKUP & DATA EDITING HISTORY RECOVERY */}
      {activeSubView === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                {lang === 'bn' ? 'রিপোর্ট ডাউনলোড (CSV ও প্রিন্ট PDF)' : 'Export Reports (CSV & PDF)'}
              </h2>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'CSV রিপোর্ট ডাউনলোড করুন' : 'Download CSV Report'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'PDF / প্রিন্ট বিবরণী' : 'Print / Save as PDF'}</span>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                {lang === 'bn'
                  ? 'নিরাপদ ডেটা ব্যাকআপ ও পুনরুদ্ধার (Non-Destructive)'
                  : 'Safe Backup & Non-Destructive Restore'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'ব্যাকআপ ইমপোর্ট করার সময় আপনার বিদ্যমান কোনো রেকর্ড মুছে যাবে না বা ওভাররাইট হবে না — শুধুমাত্র নতুন অনুপস্থিত রেকর্ডগুলো যুক্ত হবে।'
                  : 'Restoring a backup never overwrites or deletes your existing records — only missing records are merged.'}
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportBackupJSON}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'ব্যাকআপ ডাউনলোড (.json)' : 'Download JSON Backup'}</span>
                </button>

                <label className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'ব্যাকআপ ইমপোর্ট করুন' : 'Restore from JSON'}</span>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={handleImportBackupJSON}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Priority Feature 8: Data Editing History & 1-Tap Safe Record Recovery */}
          <div
            data-testid="edit-history-recovery-card"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>
                    {lang === 'bn'
                      ? 'তথ্য সম্পাদনা ইতিহাস ও মুছে ফেলা রেকর্ড পুনরুদ্ধার'
                      : 'Data Editing History & Safe Record Recovery'}
                  </span>
                </h2>
              </div>
            </div>

            {editHistory.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                {lang === 'bn'
                  ? 'এখনো কোনো সম্পাদনা বা মুছে ফেলার ইতিহাস নেই।'
                  : 'No editing or deletion history recorded yet.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {editHistory.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            item.action === 'delete'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : item.action === 'restore'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.action === 'delete'
                            ? lang === 'bn'
                              ? 'মুছে ফেলা হয়েছে'
                              : 'Deleted'
                            : item.action === 'restore'
                            ? lang === 'bn'
                              ? 'পুনরুদ্ধার সম্পন্ন'
                              : 'Restored'
                            : lang === 'bn'
                            ? 'আপডেট'
                            : 'Updated'}
                        </span>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {formatDateReadable(item.timestamp.slice(0, 10), lang)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                        {lang === 'bn' ? item.summaryBn : item.summaryEn}
                      </p>
                    </div>

                    {Boolean(item.recoverablePayload) && (
                      <button
                        type="button"
                        data-testid={`restore-record-${item.id}`}
                        onClick={async () => {
                          const ok = await restoreDeletedRecord(item.id);
                          if (ok) {
                            setNotice(
                              lang === 'bn'
                                ? 'মুছে ফেলা রেকর্ডটি সফলভাবে পুনরুদ্ধার করা হয়েছে!'
                                : 'Deleted record restored!'
                            );
                          }
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 self-start sm:self-center"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'পুনরুদ্ধার করুন' : 'Restore Record'}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. REMINDERS & LABOR LAW ADVISOR */}
      {activeSubView === 'reminders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>{lang === 'bn' ? 'রিমাইন্ডার ব্যবস্থাপনা' : 'Reminders'}</span>
            </h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!remTitle.trim()) return;
                await saveReminder({
                  title: remTitle.trim(),
                  category: remCategory,
                  dueDate: remDate,
                  isCompleted: false,
                  notes: remNotes.trim(),
                });
                setRemTitle('');
                setRemNotes('');
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={remTitle}
                onChange={(e) => setRemTitle(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'যেমন: ৭ তারিখে পে-স্লিপ ও ওভারটাইম মিলিয়ে দেখা'
                    : 'e.g. Check payslip on the 7th'
                }
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={remCategory}
                  onChange={(e) => setRemCategory(e.target.value as ReminderCategory)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                >
                  <option value="salary_date">
                    {lang === 'bn' ? 'বেতন তারিখ (Salary Date)' : 'Salary Date'}
                  </option>
                  <option value="bill_payment">
                    {lang === 'bn' ? 'বিল ও ভাড়া পরিশোধ' : 'Bill Payment'}
                  </option>
                  <option value="monthly_review">
                    {lang === 'bn' ? 'মাসিক হিসাব যাচাই' : 'Monthly Review'}
                  </option>
                  <option value="other">{lang === 'bn' ? 'অন্যান্য' : 'Other'}</option>
                </select>
                <DateInputDMY
                  value={remDate}
                  lang={lang}
                  onChange={setRemDate}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold"
              >
                {lang === 'bn' ? 'রিমাইন্ডার যোগ করুন' : 'Add Reminder'}
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
              {reminders.map((r) => {
                const parsed = parseCalendarReminderMeta(r);
                return (
                  <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={r.isCompleted}
                        onChange={(e) => toggleReminder(r.id, e.target.checked)}
                        className="mt-1 w-4 h-4 rounded text-emerald-700"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p
                            className={`text-sm font-medium ${
                              r.isCompleted
                                ? 'line-through text-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {r.title}
                          </p>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${parsed.eventBadgeColor}`}
                          >
                            {lang === 'bn' ? parsed.eventKindLabelBn : parsed.eventKindLabelEn}
                          </span>
                        </div>
                        {parsed.cleanNotes && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            {parsed.cleanNotes}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDateSlashDMY(r.dueDate, lang)} ({formatDateReadable(r.dueDate, lang)})
                          {parsed.alarmEnabled && (
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold ml-1.5">
                              · 🔔 {lang === 'bn' ? parsed.offsetLabelBn : parsed.offsetLabelEn} ({formatDateSlashDMY(parsed.triggerDate, lang)} · {parsed.triggerTime})
                            </span>
                          )}
                        </p>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => deleteReminder(r.id)}
                      aria-label={`Delete reminder ${r.title}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* High-Thinking Labor Law & Salary Calculation Advisor */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>
                {lang === 'bn'
                  ? 'শ্রম আইন ও বেতন হিসাব সহায়িকা (High-Thinking Mode)'
                  : 'Labor Law & Calculation Advisor'}
              </span>
            </h2>

            <form onSubmit={handleAskAdvisor} className="space-y-3">
              <textarea
                rows={3}
                value={advisorQuery}
                onChange={(e) => setAdvisorQuery(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'আপনার প্রশ্ন লিখুন: যেমন— আমার মূল বেতন ৬,৭০০ টাকা হলে ৪০ ঘণ্টা ওভারটাইমে কত টাকা পাব?'
                    : 'Ask a complex salary, overtime, or maternity/earned leave question...'
                }
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm"
              />
              <button
                type="submit"
                disabled={advisorLoading}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {advisorLoading
                    ? lang === 'bn'
                      ? 'হিসাব বিশ্লেষণ করা হচ্ছে...'
                      : 'Thinking...'
                    : lang === 'bn'
                    ? 'সমাধান ও ব্যাখ্যা দেখুন'
                    : 'Analyze Calculation'}
                </span>
              </button>
            </form>

            {advisorAnswer && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {advisorAnswer}
              </div>
            )}

            {/* Priority Feature 9: Verified Worker Rights & Emergency Helplines */}
            <div
              data-testid="verified-worker-helplines"
              className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3"
            >
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>
                  {lang === 'bn'
                    ? 'যাচাইকৃত শ্রমিক অধিকার ও সরকারি জরুরি হেল্পলাইন'
                    : 'Verified Worker Rights & Official Emergency Helplines'}
                </span>
              </h3>

              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 text-xs text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed">
                <p>
                  •{' '}
                  <strong>
                    {lang === 'bn' ? 'ওভারটাইম অধিকার (ধারা ১০৮):' : 'Overtime Right (Sec 108):'}
                  </strong>{' '}
                  {lang === 'bn'
                    ? 'মূল বেতনের দ্বিগুণ হারে [(মূল বেতন ÷ ২০৮) × ২] ওভারটাইম ভাতা প্রাপ্য।'
                    : 'Entitled to 2x hourly basic wage [(Basic ÷ 208) × 2].'}
                </p>
                <p>
                  •{' '}
                  <strong>
                    {lang === 'bn' ? 'বেতন পরিশোধের সময়সীমা (ধারা ১২৩):' : 'Wage Payment (Sec 123):'}
                  </strong>{' '}
                  {lang === 'bn'
                    ? 'মাস শেষ হওয়ার পরবর্তী ৭ কর্মদিবসের মধ্যে বেতন পরিশোধ বাধ্যতামূলক।'
                    : 'Wages must be paid within 7 working days after the wage period ends.'}
                </p>
                <p>
                  •{' '}
                  <strong>
                    {lang === 'bn'
                      ? 'বার্ষিক ছুটি ও মাতৃত্বকালীন সুবিধা (ধারা ৪৬, ১১৫-১১৭):'
                      : 'Leave & Maternity (Sec 46, 115-117):'}
                  </strong>{' '}
                  {lang === 'bn'
                    ? 'নৈমিত্তিক ১০ দিন, অসুস্থতা ১৪ দিন, উৎসব ১১ দিন এবং সবেতন মাতৃত্বকালীন ছুটি ১৬ সপ্তাহ (১১২ দিন)।'
                    : '10d Casual, 14d Sick, 11d Festival, and 16 weeks (112d) paid Maternity Leave.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {VERIFIED_WORKER_HELPLINES.map((hl) => (
                  <div
                    key={hl.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {lang === 'bn' ? hl.nameBn : hl.nameEn}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {lang === 'bn' ? hl.descBn : hl.descEn}
                      </p>
                    </div>
                    <a
                      href={`tel:${hl.numberEn}`}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 tabular-nums"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? hl.numberBn : hl.numberEn}</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUPPORT, PRIVACY POLICY & ACCOUNT DELETION */}
      {activeSubView === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <HelpCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>{lang === 'bn' ? 'সহায়তা ও মতামত পাঠান' : 'Support & Feedback'}</span>
            </h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!fbMessage.trim()) return;
                await submitFeedback(fbCategory, fbMessage.trim());
                setFbMessage('');
                setNotice(
                  lang === 'bn'
                    ? 'আপনার বার্তাটি সহায়তা টিমের কাছে পাঠানো হয়েছে।'
                    : 'Your feedback has been submitted.'
                );
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'বিষয় (Category)' : 'Topic'}
                </label>
                <select
                  value={fbCategory}
                  onChange={(e) => setFbCategory(e.target.value as FeedbackCategory)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                >
                  <option value="calculation_help">
                    {lang === 'bn' ? 'বেতন বা ওভারটাইম হিসাব সহায়তা' : 'Calculation Help'}
                  </option>
                  <option value="bug_report">
                    {lang === 'bn' ? 'অ্যাপের কারিগরি সমস্যা' : 'Bug Report'}
                  </option>
                  <option value="feature_request">
                    {lang === 'bn' ? 'নতুন সুবিধার অনুরোধ' : 'Feature Request'}
                  </option>
                  <option value="general">{lang === 'bn' ? 'সাধারণ মতামত' : 'General Feedback'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'আপনার বার্তা' : 'Message'}
                </label>
                <textarea
                  rows={3}
                  value={fbMessage}
                  onChange={(e) => setFbMessage(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'আপনার সমস্যা বা পরামর্শ বিস্তারিত লিখুন...'
                      : 'Describe your question or suggestion...'
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{lang === 'bn' ? 'মতামত পাঠান' : 'Submit Feedback'}</span>
              </button>
            </form>

            {isAdminUser && feedbackList.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {lang === 'bn'
                    ? 'সহায়তা টিকিট তালিকা (Least-Privilege Support Queue)'
                    : 'Support Ticket Queue'}
                </h3>
                {feedbackList.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {f.workerName} · {f.category}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">{f.message}</p>
                    </div>
                    {f.status !== 'resolved' ? (
                      <button
                        type="button"
                        onClick={() => resolveFeedback(f.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-semibold shrink-0"
                      >
                        {lang === 'bn' ? 'সমাধান' : 'Resolve'}
                      </button>
                    ) : (
                      <span className="text-emerald-700 font-semibold">Resolved</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 self-start">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <ShieldAlert className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>
                {lang === 'bn'
                  ? 'গোপনীয়তা নীতি ও অ্যাকাউন্ট নিয়ন্ত্রণ'
                  : 'Privacy Policy & Account Control'}
              </span>
            </h2>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>
                {lang === 'bn'
                  ? '১. শ্রমিক সাথী অ্যাপ কখনোই আপনার জাতীয় পরিচয়পত্র (NID) নম্বর, বিকাশ/নগদ পিন বা ব্যাংক পাসওয়ার্ড সংগ্রহ করে না।'
                  : '1. Shromik Sathi never asks for your National ID (NID) number, mobile banking PIN, or bank passwords.'}
              </p>
              <p>
                {lang === 'bn'
                  ? '২. আপনার বেতন, ওভারটাইম, হাজিরা ও ব্যক্তিগত খরচের তথ্য শুধুমাত্র আপনার নিজের ইউজার আইডিতে সংরক্ষিত থাকে। অন্য কোনো ব্যবহারকারী বা অ্যাডমিন আপনার ব্যক্তিগত ভল্ট বা আর্থিক তথ্য দেখতে পান না।'
                  : '2. Your salary, overtime, and document vault records are strictly isolated to your user ID.'}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              {!confirmDeleteOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  {lang === 'bn'
                    ? 'অ্যাকাউন্ট ও সকল তথ্য স্থায়ীভাবে মুছে ফেলুন'
                    : 'Delete Account & All Personal Data'}
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-3">
                  <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                    {lang === 'bn'
                      ? 'আপনি কি নিশ্চিত যে আপনার অ্যাকাউন্ট ও সকল সংরক্ষিত রেকর্ড মুছে ফেলতে চান?'
                      : 'Are you sure you want to permanently delete your account and all records?'}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(false)}
                      className="min-h-[38px] px-3 rounded-lg bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {lang === 'bn' ? 'না, ফিরে যান' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={deleteAccountAndData}
                      className="min-h-[38px] px-3 rounded-lg bg-red-600 text-white text-xs font-semibold"
                    >
                      {lang === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 10. ALARM SUBVIEW */}
      {activeSubView === 'alarm' && <AlarmView />}

      {/* 11. CALCULATOR SUBVIEW */}
      {activeSubView === 'calculator' && <CalculatorView />}

      {/* 12. PERSONAL LOANS SUBVIEW */}
      {activeSubView === 'personal_loans' && <PersonalLoanView />}

      {/* 13. SUBSCRIPTION & PLANS SUBVIEW */}
      {activeSubView === 'subscriptions' && (
        <UserSubscriptionView
          onBack={() => onChangeSubView('profile')}
          openRenewalTrigger={openRenewalTrigger}
        />
      )}

      {/* 14. SUPER ADMIN DASHBOARD SUBVIEW (Strictly for sadikulislam45974@gmail.com) */}
      {isAdminUser && activeSubView === 'admin_panel' && (
        <AdminDashboardView onExitAdmin={() => onChangeSubView('profile')} />
      )}
    </div>
  );
};
