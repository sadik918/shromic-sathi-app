import type {
  AttendanceRecord,
  EditHistoryEntry,
  ExpenseRecord,
  GarmentWorkplace,
  OvertimeRecord,
  PersonalLoan,
  ReminderItem,
  SalaryPayment,
  SalaryRecord,
  SavingsGoal,
  SupportFeedback,
  VaultDocument,
  WorkerContact,
  WorkerProfile,
} from '../types';

export const DEMO_STORAGE_KEY = 'shromik_sathi_isolated_demo_v1';
export const PUBLIC_DEMO_CONFIG_KEY = 'shromik_sathi_public_demo_config_v1';

export const PUBLIC_DEMO_EMAIL = 'demo@therate.gmail.com';
export const DEMO_READ_ONLY_BANNER_BN =
  'ডেমো মোড চালু আছে — আপনি তথ্য দেখতে পারবেন, কিন্তু পরিবর্তন করতে পারবেন না।';
export const DEMO_READ_ONLY_BANNER_EN =
  'Demo Mode Active — You can view information, but cannot make changes.';
export const DEMO_WRITE_BLOCKED_NOTICE_BN =
  'এই সুবিধাটি ডেমো মোডে বন্ধ আছে। নিজের অ্যাকাউন্ট তৈরি করে ব্যবহার করুন।';
export const DEMO_WRITE_BLOCKED_NOTICE_EN =
  'This feature is disabled in Demo Mode. Please create a personal account to use it.';
export const DEMO_SAMPLE_DATA_BADGE = 'Sample Data — ডেমো তথ্য';

export interface PublicDemoSystemConfig {
  enabled: boolean;
  demoEmail: string;
  maintenanceMessageBn: string;
  maintenanceMessageEn: string;
  lastResetAt: string;
  totalDemoSessions: number;
  blockedWriteAttempts: number;
  lastVisitedAt: string;
}

export interface DemoStoreState {
  profile: WorkerProfile;
  overtime: OvertimeRecord[];
  salaryRecords: SalaryRecord[];
  payments: SalaryPayment[];
  attendance: AttendanceRecord[];
  expenses: ExpenseRecord[];
  savings: SavingsGoal[];
  documents: VaultDocument[];
  reminders: ReminderItem[];
  feedback: SupportFeedback[];
  loans: PersonalLoan[];
  editHistory: EditHistoryEntry[];
  workplaces: GarmentWorkplace[];
  contacts: WorkerContact[];
}

export function getInitialDemoState(): DemoStoreState {
  const profile: WorkerProfile = {
    userId: 'demo_worker_01',
    fullName: 'মোসাঃ নাসরিন আক্তার',
    photoUrl: '',
    phone: '01712-345678',
    address: 'কোনাবাড়ী, গাজীপুর সদর, গাজীপুর',
    emergencyContact: 'মোঃ রফিকুল ইসলাম (স্বামী) - 01819-223344',
    factoryName: 'পদ্মা নিটওয়্যার অ্যান্ড অ্যাপারেলস লিঃ',
    factoryBranch: 'গাজীপুর ইউনিট-২',
    department: 'সুইং (Sewing Line - B4)',
    designation: 'সিনিয়র সুইং মেশিন অপারেটর',
    employeeId: 'PKA-4092',
    employmentType: 'permanent',
    joiningDate: '2023-01-15',
    salaryGrade: 'গ্রেড ৪ (Grade 4)',
    basicSalary: 6700,
    houseRentAllowance: 3350,
    medicalAllowance: 750,
    transportAllowance: 450,
    foodAllowance: 1250,
    attendanceBonus: 600,
    grossSalary: 12500,
    otWageBase: 'basic',
    otDivisor: 208,
    otMultiplier: 2,
    otCalculationMode: 'formula',
    otCustomHourlyRate: 64.42,
    shiftPattern: 'day',
    dayShiftStartTime: '08:00',
    nightShiftStartTime: '20:00',
    rotationStartDate: '2026-10-01',
    attendanceWindowStartDay: '07:50',
    attendanceWindowEndDay: '08:05',
    attendanceWindowStartNight: '19:50',
    attendanceWindowEndNight: '20:05',
    weeklyHolidayDay: 'friday',
    expectedPayDay: 7,
    monthlyBudgetTarget: 9000,
    effectiveFrom: '2026-01-01',
    language: 'bn',
    privacyConsent: true,
  };

  // Hourly OT rate = (6700 / 208) * 2 = 64.42 BDT
  const overtime: OvertimeRecord[] = [
    {
      id: 'demo_ot_1',
      userId: 'demo_worker_01',
      date: '2026-10-20',
      month: '2026-10',
      startTime: '17:00',
      endTime: '19:00',
      breakMinutes: 0,
      totalMinutes: 120,
      approvedHours: 2,
      basicSalarySnapshot: 6700,
      divisorSnapshot: 208,
      multiplierSnapshot: 2,
      hourlyRateSnapshot: 64.42,
      estimatedEarnings: 128.85,
      notes: 'বায়ার শিপমেন্ট অর্ডার (Line B4)',
    },
    {
      id: 'demo_ot_2',
      userId: 'demo_worker_01',
      date: '2026-10-21',
      month: '2026-10',
      startTime: '17:00',
      endTime: '20:30',
      breakMinutes: 30,
      totalMinutes: 180,
      approvedHours: 3,
      basicSalarySnapshot: 6700,
      divisorSnapshot: 208,
      multiplierSnapshot: 2,
      hourlyRateSnapshot: 64.42,
      estimatedEarnings: 193.27,
      notes: 'সন্ধ্যার নাস্তা বিরতি ৩০ মিনিট বাদে ৩ ঘণ্টা',
    },
    {
      id: 'demo_ot_3',
      userId: 'demo_worker_01',
      date: '2026-10-22',
      month: '2026-10',
      startTime: '17:00',
      endTime: '19:00',
      breakMinutes: 0,
      totalMinutes: 120,
      approvedHours: 2,
      basicSalarySnapshot: 6700,
      divisorSnapshot: 208,
      multiplierSnapshot: 2,
      hourlyRateSnapshot: 64.42,
      estimatedEarnings: 128.85,
      notes: 'নিয়মিত ২ ঘণ্টা ওভারটাইম',
    },
    {
      id: 'demo_ot_4',
      userId: 'demo_worker_01',
      date: '2026-10-24',
      month: '2026-10',
      startTime: '17:00',
      endTime: '20:00',
      breakMinutes: 0,
      totalMinutes: 180,
      approvedHours: 3,
      basicSalarySnapshot: 6700,
      divisorSnapshot: 208,
      multiplierSnapshot: 2,
      hourlyRateSnapshot: 64.42,
      estimatedEarnings: 193.27,
      notes: 'জরুরি ফিনিশিং সাপোর্ট',
    },
    {
      id: 'demo_ot_5',
      userId: 'demo_worker_01',
      date: '2026-10-25',
      month: '2026-10',
      startTime: '17:00',
      endTime: '19:00',
      breakMinutes: 0,
      totalMinutes: 120,
      approvedHours: 2,
      basicSalarySnapshot: 6700,
      divisorSnapshot: 208,
      multiplierSnapshot: 2,
      hourlyRateSnapshot: 64.42,
      estimatedEarnings: 128.85,
      notes: 'নিয়মিত ২ ঘণ্টা ওভারটাইম',
    },
    {
      id: 'demo_ot_6',
      userId: 'demo_worker_01',
      date: '2026-10-26',
      month: '2026-10',
      startTime: '17:00',
      endTime: '20:26',
      breakMinutes: 0,
      totalMinutes: 206,
      approvedHours: 3.43,
      basicSalarySnapshot: 6700,
      divisorSnapshot: 208,
      multiplierSnapshot: 2,
      hourlyRateSnapshot: 64.42,
      estimatedEarnings: 220.96,
      notes: 'জরুরি ওভারটাইম (৩ ঘণ্টা ২৬ মিনিট)',
    },
  ];

  const salaryRecords: SalaryRecord[] = [
    {
      id: 'demo_sal_2026_10',
      userId: 'demo_worker_01',
      month: '2026-10',
      effectiveDate: '2026-10-01',
      basicSalary: 6700,
      houseRentAllowance: 3350,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
      attendanceBonus: 600,
      overtimeHours: 12,
      overtimeEarnings: 773.09,
      festivalBonus: 0,
      otherAllowances: 0,
      advanceDeduction: 500,
      absenceDeduction: 0,
      otherDeductions: 0,
      adjustments: 0,
      estimatedGross: 13873.09,
      estimatedNetPayable: 13373.09,
      notes: 'অক্টোবর ২০২৬ মাসের আনুমানিক বেতন বিবরণী',
    },
    {
      id: 'demo_sal_2026_09',
      userId: 'demo_worker_01',
      month: '2026-09',
      effectiveDate: '2026-09-01',
      basicSalary: 6700,
      houseRentAllowance: 3350,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
      attendanceBonus: 600,
      overtimeHours: 42,
      overtimeEarnings: 2705.64,
      festivalBonus: 0,
      otherAllowances: 0,
      advanceDeduction: 0,
      absenceDeduction: 0,
      otherDeductions: 0,
      adjustments: 0,
      estimatedGross: 15805.64,
      estimatedNetPayable: 15805.64,
      notes: 'সেপ্টেম্বর ২০২৬ মাসের পূর্ণ বেতন পরিশোধিত',
    },
    {
      id: 'demo_sal_2026_08',
      userId: 'demo_worker_01',
      month: '2026-08',
      effectiveDate: '2026-08-01',
      basicSalary: 6700,
      houseRentAllowance: 3350,
      medicalAllowance: 750,
      transportAllowance: 450,
      foodAllowance: 1250,
      attendanceBonus: 600,
      overtimeHours: 38,
      overtimeEarnings: 2447.96,
      festivalBonus: 0,
      otherAllowances: 0,
      advanceDeduction: 0,
      absenceDeduction: 0,
      otherDeductions: 0,
      adjustments: 0,
      estimatedGross: 15547.96,
      estimatedNetPayable: 15547.96,
      notes: 'আগস্ট ২০২৬ মাসের পূর্ণ বেতন ও ৩৮ ঘণ্টা ওটি পরিশোধিত',
    },
  ];

  const payments: SalaryPayment[] = [
    {
      id: 'demo_pay_1',
      userId: 'demo_worker_01',
      month: '2026-10',
      paymentDate: '2026-10-10',
      amountReceived: 9500,
      paymentMethod: 'bkash',
      isPartial: true,
      referenceNote: 'বিকাশ পেট্রোল অ্যাকাউন্টে প্রথম কিস্তি প্রাপ্তি',
    },
    {
      id: 'demo_pay_09',
      userId: 'demo_worker_01',
      month: '2026-09',
      paymentDate: '2026-10-05',
      amountReceived: 15805.64,
      paymentMethod: 'bkash',
      isPartial: false,
      referenceNote: 'সেপ্টেম্বর মাসের সম্পূর্ণ বেতন ও ওটি প্রাপ্তি',
    },
    {
      id: 'demo_pay_08',
      userId: 'demo_worker_01',
      month: '2026-08',
      paymentDate: '2026-09-06',
      amountReceived: 15547.96,
      paymentMethod: 'bkash',
      isPartial: false,
      referenceNote: 'আগস্ট মাসের সম্পূর্ণ বেতন ও ওটি প্রাপ্তি',
    },
  ];

  const attendance: AttendanceRecord[] = [
    { id: 'att_01', userId: 'demo_worker_01', date: '2026-10-01', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:55', checkOut: '17:00', notes: '' },
    { id: 'att_02', userId: 'demo_worker_01', date: '2026-10-02', month: '2026-10', status: 'weekly_holiday', leaveCategory: 'none', checkIn: '', checkOut: '', notes: 'শুক্রবার সাপ্তাহিক ছুটি' },
    { id: 'att_03', userId: 'demo_worker_01', date: '2026-10-03', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:58', checkOut: '17:00', notes: '' },
    { id: 'att_04', userId: 'demo_worker_01', date: '2026-10-04', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:50', checkOut: '17:00', notes: '' },
    { id: 'att_05', userId: 'demo_worker_01', date: '2026-10-05', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:56', checkOut: '17:00', notes: '' },
    { id: 'att_06', userId: 'demo_worker_01', date: '2026-10-06', month: '2026-10', status: 'approved_leave', leaveCategory: 'sick', checkIn: '', checkOut: '', notes: 'ডাক্তার দেখানোর জন্য অনুমোদিত অসুস্থতাজনিত ছুটি' },
    { id: 'att_07', userId: 'demo_worker_01', date: '2026-10-07', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:54', checkOut: '17:00', notes: '' },
    { id: 'att_08', userId: 'demo_worker_01', date: '2026-10-08', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:55', checkOut: '17:00', notes: '' },
    { id: 'att_09', userId: 'demo_worker_01', date: '2026-10-09', month: '2026-10', status: 'weekly_holiday', leaveCategory: 'none', checkIn: '', checkOut: '', notes: 'শুক্রবার সাপ্তাহিক ছুটি' },
    { id: 'att_10', userId: 'demo_worker_01', date: '2026-10-10', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:52', checkOut: '17:00', notes: '' },
    { id: 'att_11', userId: 'demo_worker_01', date: '2026-10-11', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:56', checkOut: '17:00', notes: '' },
    { id: 'att_12', userId: 'demo_worker_01', date: '2026-10-12', month: '2026-10', status: 'absent', leaveCategory: 'unpaid', checkIn: '', checkOut: '', notes: 'পারিবারিক জরুরি কারণে অনুপস্থিত' },
    { id: 'att_13', userId: 'demo_worker_01', date: '2026-10-13', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:55', checkOut: '17:00', notes: '' },
    { id: 'att_14', userId: 'demo_worker_01', date: '2026-10-14', month: '2026-10', status: 'late', leaveCategory: 'none', checkIn: '08:20', checkOut: '17:00', notes: 'যানজটের কারণে ২০ মিনিট দেরি' },
    { id: 'att_15', userId: 'demo_worker_01', date: '2026-10-15', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:54', checkOut: '17:00', notes: '' },
    { id: 'att_16', userId: 'demo_worker_01', date: '2026-10-16', month: '2026-10', status: 'weekly_holiday', leaveCategory: 'none', checkIn: '', checkOut: '', notes: 'শুক্রবার সাপ্তাহিক ছুটি' },
    { id: 'att_17', userId: 'demo_worker_01', date: '2026-10-17', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:55', checkOut: '17:00', notes: '' },
    { id: 'att_18', userId: 'demo_worker_01', date: '2026-10-18', month: '2026-10', status: 'absent', leaveCategory: 'unpaid', checkIn: '', checkOut: '', notes: 'অনুপস্থিত' },
    { id: 'att_19', userId: 'demo_worker_01', date: '2026-10-19', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:57', checkOut: '17:00', notes: '' },
    { id: 'att_20', userId: 'demo_worker_01', date: '2026-10-20', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:55', checkOut: '19:00', notes: '২ ঘণ্টা ওটি' },
    { id: 'att_21', userId: 'demo_worker_01', date: '2026-10-21', month: '2026-10', status: 'public_holiday', leaveCategory: 'festival', checkIn: '', checkOut: '', notes: 'শারদীয় দুর্গাপূজা (বিজয়া দশমী)' },
    { id: 'att_22', userId: 'demo_worker_01', date: '2026-10-22', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:58', checkOut: '19:00', notes: '২ ঘণ্টা ওটি' },
    { id: 'att_23', userId: 'demo_worker_01', date: '2026-10-23', month: '2026-10', status: 'weekly_holiday', leaveCategory: 'none', checkIn: '', checkOut: '', notes: 'শুক্রবার সাপ্তাহিক ছুটি' },
    { id: 'att_24', userId: 'demo_worker_01', date: '2026-10-24', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:54', checkOut: '20:00', notes: '৩ ঘণ্টা ওটি' },
    { id: 'att_25', userId: 'demo_worker_01', date: '2026-10-25', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:55', checkOut: '19:00', notes: '২ ঘণ্টা ওটি' },
    { id: 'att_26', userId: 'demo_worker_01', date: '2026-10-26', month: '2026-10', status: 'present', leaveCategory: 'none', checkIn: '07:55', checkOut: '20:26', notes: '৩ ঘণ্টা ২৬ মিনিট ওটি' },
  ];

  const expenses: ExpenseRecord[] = [
    {
      id: 'exp_1',
      userId: 'demo_worker_01',
      date: '2026-10-10',
      month: '2026-10',
      category: 'rent',
      amount: 3500,
      description: 'অক্টোবর মাসের বাসা ভাড়া ও গ্যাস বিল',
    },
    {
      id: 'exp_2',
      userId: 'demo_worker_01',
      date: '2026-10-12',
      month: '2026-10',
      category: 'food',
      amount: 2200,
      description: 'চাল, ডাল, তেল ও কাঁচাবাজার',
    },
    {
      id: 'exp_3',
      userId: 'demo_worker_01',
      date: '2026-10-15',
      month: '2026-10',
      category: 'family',
      amount: 1500,
      description: 'গ্রামে মায়ের ওষুধ ও খরচের জন্য বিকাশ প্রেরণ',
    },
    {
      id: 'exp_4',
      userId: 'demo_worker_01',
      date: '2026-10-20',
      month: '2026-10',
      category: 'education',
      amount: 600,
      description: 'মেয়ের স্কুলের খাতা ও টিউশন ফি',
    },
  ];

  const savings: SavingsGoal[] = [
    {
      id: 'sav_1',
      userId: 'demo_worker_01',
      title: 'পরিবারের জরুরি চিকিৎসা ও ভবিষ্যৎ তহবিল',
      targetAmount: 30000,
      savedAmount: 11500,
      monthlyBudget: 9500,
      deadline: '2027-06-30',
      notes: 'প্রতি মাসে বেতন পাওয়ার পর ১,৫০০ টাকা ডিপিএস সঞ্চয়',
    },
  ];

  const documents: VaultDocument[] = [
    {
      id: 'doc_1',
      userId: 'demo_worker_01',
      title: 'কারখানার পরিচয়পত্র (ID Card - PKA-4092)',
      category: 'id_card',
      fileName: 'factory_id_card_pka4092.png',
      fileType: 'image/png',
      fileSize: 42500,
      fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      issueDate: '2023-01-15',
      notes: 'পদ্মা নিটওয়্যার ইউনিট-২ এর মূল পরিচয়পত্রের কপি',
    },
    {
      id: 'doc_2',
      userId: 'demo_worker_01',
      title: 'সেপ্টেম্বর ২০২৬ মাসের পে-স্লিপ রশিদ',
      category: 'payslip',
      fileName: 'payslip_sept_2026.png',
      fileType: 'image/png',
      fileSize: 38200,
      fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      issueDate: '2026-10-05',
      notes: 'সেপ্টেম্বর মাসের পূর্ণ পে-স্লিপ কপি',
    },
  ];

  const reminders: ReminderItem[] = [
    {
      id: 'rem_1',
      userId: 'demo_worker_01',
      title: 'অক্টোবর মাসের বকেয়া বেতন ও ওটি মিলিয়ে নেওয়া',
      category: 'salary_date',
      dueDate: '2026-11-07',
      isCompleted: false,
      notes: 'পে-স্লিপের সাথে অ্যাপের ১২ ঘণ্টা ওভারটাইম হিসাব মিলিয়ে দেখা',
    },
    {
      id: 'rem_2',
      userId: 'demo_worker_01',
      title: 'বাসা ভাড়া ও বিদ্যুৎ বিল পরিশোধ',
      category: 'bill_payment',
      dueDate: '2026-11-10',
      isCompleted: false,
      notes: 'বাড়িওয়ালাকে রশিদসহ ভাড়া প্রদান',
    },
  ];

  const feedback: SupportFeedback[] = [];

  const loans: PersonalLoan[] = [
    {
      id: 'loan_lent_1',
      userId: 'demo_worker_01',
      personName: 'মোসাঃ পারভীন আক্তার (সহকর্মী)',
      contactNumber: '01711-889900',
      direction: 'lent',
      originalAmount: 3000,
      transactionDate: '2026-10-05',
      expectedRepaymentDate: '2026-10-28',
      reason: 'জরুরি পারিবারিক প্রয়োজনে হাওলাদ দেওয়া',
      repaymentArrangement: 'বেতন পাওয়ার পর ২ কিস্তিতে ফেরত দেবে',
      notes: 'অক্টোবর ১০ তারিখে ১ম কিস্তি ১,০০০ টাকা প্রাপ্তি',
      installmentAmount: 1000,
      repaymentFrequency: 'monthly',
      reminderEnabled: true,
      status: 'partially_repaid',
      repayments: [
        {
          id: 'rep_lent_1_1',
          userId: 'demo_worker_01',
          loanId: 'loan_lent_1',
          amount: 1000,
          paymentDate: '2026-10-10',
          direction: 'received',
          paymentMethod: 'bkash',
          referenceNumber: 'TRX9920381',
          notes: 'বিকাশে ১ম কিস্তি পাঠিয়েছে',
        },
      ],
      title: 'পারভীন আক্তারকে ধার দেওয়া',
      totalLoanAmount: 3000,
      paidAmount: 1000,
      monthlyInstallment: 1000,
      nextDueDate: '2026-10-28',
    },
    {
      id: 'loan_lent_2',
      userId: 'demo_worker_01',
      personName: 'মোঃ রফিকুল ইসলাম (ছোট ভাই)',
      contactNumber: '01819-223344',
      direction: 'lent',
      originalAmount: 5000,
      transactionDate: '2026-09-15',
      expectedRepaymentDate: '2026-11-05',
      reason: 'গ্রামের বাড়ির কৃষিকাজের ওষুধ ও সার ক্রয়',
      repaymentArrangement: 'ধান বিক্রির পর একবারে শোধ করবে',
      notes: 'নভেম্বর ৫ তারিখে ফেরত দেওয়ার কথা',
      installmentAmount: 5000,
      repaymentFrequency: 'custom',
      reminderEnabled: true,
      status: 'pending',
      repayments: [],
      title: 'ছোট ভাই রফিকুলকে ধান খরচের টাকা দেওয়া',
      totalLoanAmount: 5000,
      paidAmount: 0,
      monthlyInstallment: 5000,
      nextDueDate: '2026-11-05',
    },
    {
      id: 'loan_lent_3',
      userId: 'demo_worker_01',
      personName: 'মোঃ সাইফুল ইসলাম (পাশের লাইনের অপারেটর)',
      contactNumber: '01618-556677',
      direction: 'lent',
      originalAmount: 1500,
      transactionDate: '2026-09-25',
      expectedRepaymentDate: '2026-10-15',
      reason: 'জরুরি বাসা ভাড়া ঘাটতি পূরণে ধার দেওয়া',
      repaymentArrangement: 'অক্টোবর ১৫ তারিখে ফেরত দেওয়ার কথা ছিল (মেয়াদোত্তীর্ণ)',
      notes: '৫০০ টাকা দিয়েছে, ১,০০০ টাকা এখনো বকেয়া (Overdue)',
      installmentAmount: 1000,
      repaymentFrequency: 'lump_sum',
      reminderEnabled: true,
      status: 'overdue',
      repayments: [
        {
          id: 'rep_lent_3_1',
          userId: 'demo_worker_01',
          loanId: 'loan_lent_3',
          amount: 500,
          paymentDate: '2026-10-12',
          direction: 'received',
          paymentMethod: 'cash',
          notes: 'নগদ ৫০০ টাকা ফেরত দিয়েছে',
        },
      ],
      title: 'সাইফুল ইসলামকে ধার দেওয়া (মেয়াদোত্তীর্ণ বকেয়া)',
      totalLoanAmount: 1500,
      paidAmount: 500,
      monthlyInstallment: 1000,
      nextDueDate: '2026-10-15',
    },
    {
      id: 'loan_borrowed_1',
      userId: 'demo_worker_01',
      personName: 'কারখানা এডভান্স (পদ্মা নিটওয়্যার)',
      contactNumber: '01700-112233',
      direction: 'borrowed',
      originalAmount: 4000,
      transactionDate: '2026-10-01',
      expectedRepaymentDate: '2026-11-07',
      reason: 'মেয়ের স্কুলের ভর্তি ও খাতা কেনা',
      repaymentArrangement: 'মাসিক বেতন থেকে ১,০০০ টাকা করে কর্তন',
      notes: 'অক্টোবর মাসে ১,৫০০ টাকা বেতন থেকে কেটে নেওয়া হয়েছে',
      installmentAmount: 1000,
      repaymentFrequency: 'monthly',
      reminderEnabled: true,
      status: 'partially_repaid',
      repayments: [
        {
          id: 'rep_bor_1_1',
          userId: 'demo_worker_01',
          loanId: 'loan_borrowed_1',
          amount: 1500,
          paymentDate: '2026-10-07',
          direction: 'paid',
          paymentMethod: 'cash',
          notes: 'অক্টোবর পে-স্লিপ থেকে এডভান্স কর্তন',
        },
      ],
      title: 'কারখানা হতে বেতন অগ্রিম (Salary Advance)',
      lenderType: 'factory_advance',
      totalLoanAmount: 4000,
      paidAmount: 1500,
      monthlyInstallment: 1000,
      nextDueDate: '2026-11-07',
    },
    {
      id: 'loan_borrowed_2',
      userId: 'demo_worker_01',
      personName: 'মহিলা সমিতি ডিপিএস ও ঋণ',
      contactNumber: '01912-334455',
      direction: 'borrowed',
      originalAmount: 10000,
      transactionDate: '2026-08-10',
      expectedRepaymentDate: '2026-11-10',
      reason: 'জরুরি ঘরের চাল মেরামত ও সেলাই মেশিন কিস্তি',
      repaymentArrangement: 'প্রতি মাসের ১০ তারিখে ২,০০০ টাকা কিস্তি',
      notes: 'আগস্ট, সেপ্টেম্বর ও অক্টোবরে ৬,০০০ টাকা দেওয়া সম্পন্ন',
      installmentAmount: 2000,
      repaymentFrequency: 'monthly',
      reminderEnabled: true,
      status: 'partially_repaid',
      repayments: [
        {
          id: 'rep_bor_2_1',
          userId: 'demo_worker_01',
          loanId: 'loan_borrowed_2',
          amount: 2000,
          paymentDate: '2026-08-10',
          direction: 'paid',
          paymentMethod: 'nagad',
          referenceNumber: 'NGD382109',
          notes: '১ম কিস্তি পরিশোধ',
        },
        {
          id: 'rep_bor_2_2',
          userId: 'demo_worker_01',
          loanId: 'loan_borrowed_2',
          amount: 2000,
          paymentDate: '2026-09-10',
          direction: 'paid',
          paymentMethod: 'nagad',
          referenceNumber: 'NGD491203',
          notes: '২য় কিস্তি পরিশোধ',
        },
        {
          id: 'rep_bor_2_3',
          userId: 'demo_worker_01',
          loanId: 'loan_borrowed_2',
          amount: 2000,
          paymentDate: '2026-10-10',
          direction: 'paid',
          paymentMethod: 'nagad',
          referenceNumber: 'NGD581902',
          notes: '৩য় কিস্তি পরিশোধ',
        },
      ],
      title: 'সমিতি ও পারিবারিক কিস্তি (সেলাই মেশিন ক্রয়)',
      lenderType: 'cooperative',
      totalLoanAmount: 10000,
      paidAmount: 6000,
      monthlyInstallment: 2000,
      nextDueDate: '2026-11-10',
    },
  ];

  const editHistory: EditHistoryEntry[] = [
    {
      id: 'hist_demo_1',
      userId: 'demo_worker_01',
      timestamp: '2026-10-25T19:05:00.000Z',
      action: 'create',
      entityType: 'overtime',
      recordId: 'demo_ot_5',
      summaryBn: 'ওভারটাইম যোগ: ২৫ অক্টোবর, ২০২৬ — ২ ঘণ্টা (৳ ১২৮.৮৫)',
      summaryEn: 'Added Overtime: 2026-10-25 — 2 hrs (৳ 128.85)',
    },
    {
      id: 'hist_demo_2',
      userId: 'demo_worker_01',
      timestamp: '2026-10-20T20:10:00.000Z',
      action: 'create',
      entityType: 'expense',
      recordId: 'exp_4',
      summaryBn: 'খরচ যোগ: মেয়ের স্কুলের খাতা ও টিউশন ফি (৳ ৬০০)',
      summaryEn: 'Added Expense: Education (৳ 600)',
    },
    {
      id: 'hist_demo_del_1',
      userId: 'demo_worker_01',
      timestamp: '2026-10-26T09:15:00.000Z',
      action: 'delete',
      entityType: 'overtime',
      recordId: 'demo_ot_deleted_1',
      summaryBn: 'ওভারটাইম মুছে ফেলা হয়েছে: ২৪ অক্টোবর, ২০২৬ (২ ঘণ্টা)',
      summaryEn: 'Deleted Overtime: 2026-10-24 (2h)',
      recoverablePayload: {
        id: 'demo_ot_deleted_1',
        userId: 'demo_worker_01',
        date: '2026-10-24',
        month: '2026-10',
        year: 2026,
        shiftType: 'regular',
        startTime: '17:00',
        endTime: '19:00',
        breakMinutes: 0,
        calculatedHours: 2,
        approvedHours: 2,
        hourlyRate: 64.42,
        multiplier: 2,
        estimatedEarnings: 128.85,
        notes: 'জরুরি শিপমেন্ট প্যাকিং ওভারটাইম',
      },
    },
  ];

  const workplaces: GarmentWorkplace[] = [
    {
      id: 'demo_wp_current',
      userId: 'demo_worker_01',
      factoryName: 'পদ্মা নিটওয়্যার অ্যান্ড অ্যাপারেলস লিঃ',
      factoryAddress: 'প্লট নং ৪২-৪৪, কোনাবাড়ী বিসিক শিল্প এলাকা',
      factoryArea: 'কোনাবাড়ী, গাজীপুর',
      department: 'সুইং সেকশন (Line B4)',
      floorNumber: '৩য় তলা',
      lineNumber: 'লাইন-বি৪',
      designation: 'সিনিয়র সুইং মেশিন অপারেটর',
      employeeId: 'PKA-4092',
      supervisorName: 'মোঃ জাহিদ হাসান',
      joiningDate: '2023-01-15',
      shiftPattern: 'day',
      grossSalary: 12500,
      basicSalary: 6700,
      factoryPhone: '01712-998877',
      notes: 'বায়ার এইচএন্ডএম ও জারা এক্সপোর্ট অর্ডার সেকশন',
      isCurrent: true,
    },
    {
      id: 'demo_wp_past',
      userId: 'demo_worker_01',
      factoryName: 'অ্যাননটেক্স ফ্যাশনস লিমিটেড',
      factoryAddress: 'টঙ্গী ভারী শিল্প এলাকা',
      factoryArea: 'টঙ্গী, গাজীপুর',
      department: 'সুইং (Sewing)',
      floorNumber: '২য় তলা',
      lineNumber: 'লাইন-০৭',
      designation: 'জুনিয়র অপারেটর',
      employeeId: 'ATF-2180',
      supervisorName: 'মোঃ রফিক শিকদার',
      joiningDate: '2020-03-01',
      leavingDate: '2022-12-31',
      leavingReason: 'উন্নত বেতন ও সিনিয়র অপারেটর পদে পদোন্নতির জন্য নতুন কারখানায় যোগদান',
      shiftPattern: 'day',
      grossSalary: 10500,
      basicSalary: 5367,
      totalReceivedSalary: 378400,
      totalExpectedSalary: 378400,
      totalOvertimeHours: 680,
      totalOvertimeEarnings: 35080,
      totalPresentDays: 842,
      totalAbsentDays: 5,
      totalLeaveDays: 26,
      monthsWorked: 34,
      factoryPhone: '01811-223344',
      notes: 'পূর্ববর্তী কর্মস্থল (মার্চ ২০২০ - ডিসেম্বর ২০২২) — সকল বকেয়া ও সার্ভিস বেনিফিট পরিশোধিত',
      isCurrent: false,
    },
  ];

  const contacts: WorkerContact[] = [
    {
      id: 'demo_ct_1',
      userId: 'demo_worker_01',
      fullName: 'মোঃ জাহিদ হাসান',
      phone: '01712-998877',
      designation: 'সুপারভাইজার',
      category: 'supervisor',
      department: 'সুইং সেকশন',
      lineNumber: 'লাইন-বি৪',
      notes: 'ওভারটাইম ও ডিউটি ছুটি সংক্রান্ত যোগাযোগ',
      isFavorite: true,
      isEmergency: false,
    },
    {
      id: 'demo_ct_2',
      userId: 'demo_worker_01',
      fullName: 'সুলতানা রাজিয়া',
      phone: '01819-334455',
      designation: 'এইচআর ও কমপ্লায়েন্স এক্সিকিউটিভ',
      category: 'hr_admin',
      department: 'এডমিন ও এইচআর',
      lineNumber: 'অফিস ২য় তলা',
      notes: 'সার্ভিস বুক ও মাতৃত্বকালীন ছুটির যোগাযোগ',
      isFavorite: false,
      isEmergency: false,
    },
    {
      id: 'demo_ct_3',
      userId: 'demo_worker_01',
      fullName: 'মোঃ আতিকুল ইসলাম',
      phone: '01711-223344',
      designation: 'লাইন চিফ',
      category: 'line_chief',
      department: 'সুইং ডিপার্টমেন্ট',
      lineNumber: 'লাইন-বি৪',
      notes: 'টার্গেট ও লাইন পারফরম্যান্স সংক্রান্ত',
      isFavorite: true,
      isEmergency: false,
    },
    {
      id: 'demo_ct_4',
      userId: 'demo_worker_01',
      fullName: 'আমিনা খাতুন',
      phone: '01552-112233',
      designation: 'সহকর্মী হেল্পার',
      category: 'coworker',
      department: 'সুইং',
      lineNumber: 'লাইন-বি৪',
      notes: 'একসাথে কাজ করা ঘনিষ্ঠ বন্ধু',
      isFavorite: true,
      isEmergency: false,
    },
    {
      id: 'demo_ct_5',
      userId: 'demo_worker_01',
      fullName: 'ফ্যাক্টরি মেডিকেল রুম ও ক্লিনিক',
      phone: '01912-889900',
      designation: 'ডিউটি নার্স ও ফার্স্ট এইড',
      category: 'emergency',
      department: 'মেডিকেল সেন্টার',
      lineNumber: '১ম তলা (গেট সংলগ্ন)',
      notes: 'অসুস্থতা বা ফ্যাক্টরিতে যেকোনো ইনজুরিতে দ্রুত কল',
      isFavorite: true,
      isEmergency: true,
    },
    {
      id: 'demo_ct_6',
      userId: 'demo_worker_01',
      fullName: 'ফ্যাক্টরি প্রধান গেট নিরাপত্তা',
      phone: '01611-445566',
      designation: 'নিরাপত্তা ইন-চার্জ',
      category: 'security',
      department: 'নিরাপত্তা বিভাগ',
      lineNumber: 'মেইন গেট',
      notes: 'নাইট শিফট এন্ট্রি ও গেট পাস সংক্রান্ত',
      isFavorite: false,
      isEmergency: false,
    },
  ];

  return {
    profile,
    overtime,
    salaryRecords,
    payments,
    attendance,
    expenses,
    savings,
    documents,
    reminders,
    feedback,
    loans,
    editHistory,
    workplaces,
    contacts,
  };
}

export function createEmptyUserStore(uid: string, fullName: string): DemoStoreState {
  const profile: WorkerProfile = {
    userId: uid,
    fullName: (fullName || 'শ্রমিক ব্যবহারকারী').slice(0, 120),
    photoUrl: '',
    phone: '',
    address: '',
    emergencyContact: '',
    factoryName: '',
    factoryBranch: '',
    department: '',
    designation: '',
    employeeId: '',
    employmentType: 'permanent',
    joiningDate: new Date().toISOString().slice(0, 10),
    salaryGrade: '',
    basicSalary: 0,
    houseRentAllowance: 0,
    medicalAllowance: 0,
    transportAllowance: 0,
    foodAllowance: 0,
    attendanceBonus: 0,
    hasAttendanceBonus: false,
    attendanceBonusAmount: 0,
    attendanceBonusDays: 30,
    maxConsecutiveAbsences: 0,
    bonusCutoffTimeEnabled: false,
    latePenaltyEnabled: false,
    maxLateDaysForBonus: 3,
    dayBonusCutoffTime: '08:05',
    nightBonusCutoffTime: '20:05',
    grossSalary: 0,
    otWageBase: 'basic',
    otDivisor: 208,
    otMultiplier: 2,
    otCalculationMode: 'manual',
    otCustomHourlyRate: 0,
    shiftPattern: 'day',
    dayShiftStartTime: '08:00',
    nightShiftStartTime: '20:00',
    rotationStartDate: '2026-10-01',
    attendanceWindowStartDay: '07:50',
    attendanceWindowEndDay: '08:05',
    attendanceWindowStartNight: '19:50',
    attendanceWindowEndNight: '20:05',
    weeklyHolidayDay: 'friday',
    expectedPayDay: 7,
    monthlyBudgetTarget: 0,
    effectiveFrom: new Date().toISOString().slice(0, 7) + '-01',
    language: 'bn',
    privacyConsent: true,
  };

  return {
    profile,
    overtime: [],
    salaryRecords: [],
    payments: [],
    attendance: [],
    expenses: [],
    savings: [],
    documents: [],
    reminders: [],
    feedback: [],
    loans: [],
    editHistory: [],
    workplaces: [],
    contacts: [],
  };
}

export function loadUserStore(userKey: string, fullName?: string): DemoStoreState {
  const cleanKey = (userKey || '').trim().toLowerCase();
  if (!cleanKey || isDemoAccountEmail(cleanKey)) {
    return loadDemoState();
  }
  const storageKey = `shromik_sathi_user_store_${cleanKey}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.profile) {
        const empty = createEmptyUserStore(cleanKey, fullName || parsed.profile.fullName);
        return {
          ...empty,
          ...parsed,
          profile: {
            ...empty.profile,
            ...parsed.profile,
          },
          overtime: Array.isArray(parsed.overtime) ? parsed.overtime : [],
          salaryRecords: Array.isArray(parsed.salaryRecords) ? parsed.salaryRecords : [],
          payments: Array.isArray(parsed.payments) ? parsed.payments : [],
          attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
          expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
          savings: Array.isArray(parsed.savings) ? parsed.savings : [],
          documents: Array.isArray(parsed.documents) ? parsed.documents : [],
          reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
          feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
          loans: Array.isArray(parsed.loans) ? parsed.loans : [],
          editHistory: Array.isArray(parsed.editHistory) ? parsed.editHistory : [],
          workplaces: Array.isArray(parsed.workplaces) ? parsed.workplaces : [],
          contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
        };
      }
    }
  } catch {
    // ignore
  }
  const fresh = createEmptyUserStore(cleanKey, fullName || 'শ্রমিক ব্যবহারকারী');
  saveUserStore(cleanKey, fresh);
  return fresh;
}

export function saveUserStore(userKey: string, state: DemoStoreState): void {
  const cleanKey = (userKey || '').trim().toLowerCase();
  if (!cleanKey || isDemoAccountEmail(cleanKey)) {
    saveDemoState(state);
    return;
  }
  const storageKey = `shromik_sathi_user_store_${cleanKey}`;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function loadDemoState(): DemoStoreState {
  const initial = getInitialDemoState();
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.profile) {
        const existingAtt: AttendanceRecord[] = Array.isArray(parsed.attendance)
          ? parsed.attendance
          : [];
        const existingDates = new Set(existingAtt.map((a) => a.date));
        const mergedAttendance = [
          ...existingAtt,
          ...initial.attendance.filter((a) => !existingDates.has(a.date)),
        ];
        return {
          ...initial,
          ...parsed,
          profile: {
            ...initial.profile,
            ...parsed.profile,
          },
          attendance: mergedAttendance,
          loans: Array.isArray(parsed.loans) ? parsed.loans : initial.loans,
          editHistory: Array.isArray(parsed.editHistory) ? parsed.editHistory : initial.editHistory,
          workplaces: Array.isArray(parsed.workplaces) && parsed.workplaces.length > 0 ? parsed.workplaces : initial.workplaces,
          contacts: Array.isArray(parsed.contacts) && parsed.contacts.length > 0 ? parsed.contacts : initial.contacts,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  saveDemoState(initial);
  return initial;
}

export function saveDemoState(state: DemoStoreState): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function resetDemoState(): DemoStoreState {
  const fresh = getInitialDemoState();
  saveDemoState(fresh);
  return fresh;
}

export function getDefaultPublicDemoConfig(): PublicDemoSystemConfig {
  return {
    enabled: true,
    demoEmail: PUBLIC_DEMO_EMAIL,
    maintenanceMessageBn:
      'ডেমো অ্যাকাউন্ট বর্তমানে রক্ষণাবেক্ষণের জন্য সাময়িকভাবে বন্ধ আছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন অথবা নিজের অ্যাকাউন্ট তৈরি করুন।',
    maintenanceMessageEn:
      'Public Demo Mode is temporarily disabled for maintenance. Please try again later or create a personal account.',
    lastResetAt: '2026-10-28 09:00',
    totalDemoSessions: 24,
    blockedWriteAttempts: 5,
    lastVisitedAt: '2026-10-28 10:15',
  };
}

export function loadPublicDemoConfig(): PublicDemoSystemConfig {
  const defaults = getDefaultPublicDemoConfig();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(PUBLIC_DEMO_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PublicDemoSystemConfig>;
        return {
          ...defaults,
          ...parsed,
          demoEmail: PUBLIC_DEMO_EMAIL,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return defaults;
}

export function savePublicDemoConfig(
  patch: Partial<PublicDemoSystemConfig>
): PublicDemoSystemConfig {
  const current = loadPublicDemoConfig();
  const next: PublicDemoSystemConfig = {
    ...current,
    ...patch,
    demoEmail: PUBLIC_DEMO_EMAIL,
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(PUBLIC_DEMO_CONFIG_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore storage errors
  }
  return next;
}

export function recordDemoSessionStart(): PublicDemoSystemConfig {
  const current = loadPublicDemoConfig();
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return savePublicDemoConfig({
    totalDemoSessions: (current.totalDemoSessions || 0) + 1,
    lastVisitedAt: nowStr,
  });
}

export function recordDemoBlockedWrite(): PublicDemoSystemConfig {
  const current = loadPublicDemoConfig();
  return savePublicDemoConfig({
    blockedWriteAttempts: (current.blockedWriteAttempts || 0) + 1,
  });
}

/**
 * Computes a deterministic DJB2 32-bit digest so demo credential validation never
 * stores or compares plaintext passwords in frontend code.
 */
export function computeCredentialDigest(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

const DEMO_CREDENTIAL_DIGEST = 1509442; // Base-31 polynomial digest of the 4-digit demo PIN

export function isDemoAccountEmail(identifier: string | null | undefined): boolean {
  if (!identifier) return false;
  return identifier.trim().toLowerCase() === PUBLIC_DEMO_EMAIL;
}

export function validateDemoLoginAttempt(params: {
  identifier: string;
  password?: string;
  viaQuickButton?: boolean;
  config?: PublicDemoSystemConfig;
}): {
  allowed: boolean;
  errorBn?: string;
  errorEn?: string;
} {
  const cfg = params.config || loadPublicDemoConfig();
  if (!cfg.enabled) {
    return {
      allowed: false,
      errorBn: cfg.maintenanceMessageBn,
      errorEn: cfg.maintenanceMessageEn,
    };
  }
  if (!isDemoAccountEmail(params.identifier)) {
    return {
      allowed: false,
      errorBn: 'ডেমো ইমেইল সঠিক নয়।',
      errorEn: 'Invalid demo email address.',
    };
  }
  if (params.viaQuickButton) {
    return { allowed: true };
  }
  const cleanPass = (params.password || '').trim();
  if (!cleanPass || computeCredentialDigest(cleanPass) !== DEMO_CREDENTIAL_DIGEST) {
    return {
      allowed: false,
      errorBn: 'ডেমো পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে সঠিক ডেমো পাসওয়ার্ড দিন অথবা "ডেমো দেখুন (Try Demo)" বাটনে ক্লিক করুন।',
      errorEn: 'Incorrect demo password. Please enter the valid demo password or click "Try Demo".',
    };
  }
  return { allowed: true };
}

