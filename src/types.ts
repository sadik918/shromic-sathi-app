export type Language = 'bn' | 'en';

export type EmploymentType = 'permanent' | 'probation' | 'contractual' | 'piece_rate' | 'helper';
export type OtWageBase = 'basic' | 'gross';
export type OtCalculationMode = 'formula' | 'manual';
export type WorkShiftPattern = 'day' | 'night' | 'weekly_rotation' | 'general';
export type WeeklyHolidayDay =
  | 'friday'
  | 'saturday'
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday';

export interface PublicHolidayInfo {
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  titleBn: string;
  titleEn: string;
  type: 'national' | 'religious' | 'labor';
  isTentative?: boolean;
}

export interface WorkerProfile {
  userId: string;
  fullName: string;
  photoUrl: string;
  phone: string;
  address: string;
  emergencyContact: string;
  factoryName: string;
  factoryBranch: string;
  department: string;
  designation: string;
  employeeId: string;
  employmentType: EmploymentType;
  joiningDate: string;
  salaryGrade: string;
  basicSalary: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
  attendanceBonus: number;
  hasAttendanceBonus?: boolean;
  attendanceBonusAmount?: number;
  attendanceBonusDays?: number; // e.g. 30, 26, 25
  maxConsecutiveAbsences?: number; // e.g. 0 or 1
  bonusCutoffTimeEnabled?: boolean;
  latePenaltyEnabled?: boolean;
  maxLateDaysForBonus?: number; // e.g. 1, 2, 3
  grossSalary: number;
  otWageBase: OtWageBase;
  otDivisor: number;
  otMultiplier: number;
  otCalculationMode?: OtCalculationMode;
  otCustomHourlyRate?: number;
  shiftPattern?: WorkShiftPattern;
  dayShiftStartTime?: string; // e.g. '08:00'
  nightShiftStartTime?: string; // e.g. '20:00'
  rotationStartDate?: string; // e.g. '2026-10-01'
  attendanceWindowStartDay?: string; // e.g. '07:50'
  attendanceWindowEndDay?: string; // e.g. '08:05'
  attendanceWindowStartNight?: string; // e.g. '19:50'
  attendanceWindowEndNight?: string; // e.g. '20:05'
  dayBonusCutoffTime?: string; // e.g. '08:05'
  nightBonusCutoffTime?: string; // e.g. '20:05'
  weeklyHolidayDay?: WeeklyHolidayDay;
  expectedPayDay?: number; // e.g. 7, 10, 15, or custom 1-31
  monthlyBudgetTarget?: number; // 0 when not set
  openingCashBalance?: number; // Initial/custom cash in hand when starting account
  effectiveFrom: string;
  language: Language;
  privacyConsent: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OvertimeRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  totalMinutes: number;
  approvedHours: number;
  basicSalarySnapshot: number;
  divisorSnapshot: number;
  multiplierSnapshot: number;
  hourlyRateSnapshot: number;
  estimatedEarnings: number;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SalaryRecord {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  effectiveDate: string; // YYYY-MM-DD
  basicSalary: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
  attendanceBonus: number;
  overtimeHours: number;
  overtimeEarnings: number;
  festivalBonus: number;
  otherAllowances: number;
  advanceDeduction: number;
  absenceDeduction: number;
  otherDeductions: number;
  adjustments: number;
  estimatedGross: number;
  estimatedNetPayable: number;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'bank';

export interface SalaryPayment {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  paymentDate: string; // YYYY-MM-DD
  amountReceived: number;
  paymentMethod: PaymentMethod;
  isPartial: boolean;
  referenceNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'weekly_holiday'
  | 'public_holiday'
  | 'approved_leave'
  | 'late';

export type LeaveCategory =
  | 'none'
  | 'casual'
  | 'sick'
  | 'earned'
  | 'maternity'
  | 'festival'
  | 'unpaid';

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  status: AttendanceStatus;
  leaveCategory: LeaveCategory;
  checkIn: string;
  checkOut: string;
  notes: string;
  hasAttendanceBonus?: boolean; // Manual attendance bonus eligibility toggle
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ExpenseCategory =
  | 'food'
  | 'rent'
  | 'transport'
  | 'family'
  | 'medical'
  | 'education'
  | 'other';

export interface ExpenseRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  category: ExpenseCategory;
  amount: number;
  description: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type SavingsCommissionType = 'commission' | 'non_commission';
export type SavingsFrequency = 'monthly' | 'weekly' | 'daily';

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  monthlyBudget: number;
  deadline: string;
  notes: string;
  storageLocation?: string;
  commissionType?: SavingsCommissionType;
  commissionAmount?: number;
  frequency?: SavingsFrequency;
  lastDepositDate?: string; // YYYY-MM-DD
  nextDueDate?: string; // YYYY-MM-DD
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DocumentCategory =
  | 'id_card'
  | 'appointment_letter'
  | 'payslip'
  | 'increment_letter'
  | 'leave_approval'
  | 'other';

export interface VaultDocument {
  id: string;
  userId: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
  issueDate: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ReminderCategory = 'salary_date' | 'bill_payment' | 'monthly_review' | 'other';

export interface ReminderItem {
  id: string;
  userId: string;
  title: string;
  category: ReminderCategory;
  dueDate: string;
  isCompleted: boolean;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type FeedbackCategory = 'calculation_help' | 'bug_report' | 'feature_request' | 'general';

export interface SupportFeedback {
  id: string;
  userId: string;
  workerName: string;
  category: FeedbackCategory;
  message: string;
  status: 'open' | 'resolved';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProposedVoiceEntry {
  entryType: 'overtime' | 'expense' | 'payment' | 'attendance' | 'reminder';
  date: string;
  amountOrHours: number;
  categoryOrStatus: string;
  notes: string;
  rawTranscript: string;
}

export type LenderType = 'factory_advance' | 'ngo_loan' | 'cooperative' | 'family_loan';
export type PersonalLoanDirection = 'lent' | 'borrowed'; // 'lent' = টাকা পাব; 'borrowed' = টাকা দেব
export type LoanRepaymentDirection = 'received' | 'paid'; // 'received' = পেয়েছি; 'paid' = দিয়েছি
export type LoanRepaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'bank' | 'other';
export type LoanRepaymentFrequency = 'lump_sum' | 'weekly' | 'monthly' | 'custom';
export type LoanStatus = 'pending' | 'partially_repaid' | 'fully_settled' | 'overdue' | 'due_today' | 'archived';

export interface LoanRepayment {
  id: string;
  userId: string;
  loanId: string;
  amount: number; // in ৳ BDT
  repaymentDate?: string; // YYYY-MM-DD
  paymentDate?: string; // YYYY-MM-DD
  direction: LoanRepaymentDirection;
  repaymentMethod?: LoanRepaymentMethod;
  paymentMethod?: LoanRepaymentMethod;
  referenceNumber?: string;
  notes?: string;
  receivedByPerson?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PersonalLoan {
  id: string;
  userId: string;
  personName?: string;
  contactNumber?: string;
  direction?: PersonalLoanDirection;
  originalAmount?: number; // in ৳ BDT
  transactionDate?: string; // YYYY-MM-DD
  expectedRepaymentDate?: string; // YYYY-MM-DD
  reason?: string;
  repaymentArrangement?: LoanRepaymentFrequency | string;
  notes?: string;
  installmentAmount?: number;
  repaymentFrequency?: LoanRepaymentFrequency;
  nextInstallmentDate?: string; // YYYY-MM-DD
  reminderEnabled?: boolean;
  status?: LoanStatus;
  repayments?: LoanRepayment[];
  isArchived?: boolean;
  // Backwards compatibility legacy fields
  title?: string;
  lenderType?: LenderType | string;
  totalLoanAmount?: number;
  paidAmount?: number;
  monthlyInstallment?: number;
  nextDueDate?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DutyShiftType = 'shift_a' | 'shift_b' | 'shift_c' | 'general';

export type RecoverableEntityType =
  | 'overtime'
  | 'salary'
  | 'payment'
  | 'attendance'
  | 'expense'
  | 'savings'
  | 'loan'
  | 'reminder'
  | 'workplace'
  | 'contact';

export interface EditHistoryEntry {
  id: string;
  userId: string;
  timestamp: string; // ISO string
  action: 'create' | 'update' | 'delete' | 'restore';
  entityType: RecoverableEntityType;
  recordId?: string;
  summaryBn: string;
  summaryEn: string;
  recoverablePayload?: unknown;
  isRestored?: boolean;
}

export interface GarmentWorkplace {
  id: string;
  userId: string;
  factoryName: string;
  factoryAddress: string;
  factoryArea: string; // e.g. গাজীপুর, আশুলিয়া, সাভার, মিরপুর, চট্টগ্রাম ইপিজেড, নারায়ণগঞ্জ
  department: string; // e.g. সুইং (Sewing), কাটিং, ফিনিশিং, কোয়ালিটি
  floorNumber: string; // e.g. ৩য় তলা
  lineNumber: string; // e.g. লাইন-১২
  designation: string; // e.g. সিনিয়র অপারেটর
  employeeId?: string;
  supervisorName?: string;
  joiningDate?: string; // YYYY-MM-DD
  leavingDate?: string; // YYYY-MM-DD (for past workplaces)
  leavingReason?: string;
  factoryPhone?: string;
  notes?: string;
  isCurrent: boolean;
  shiftPattern?: WorkShiftPattern;
  grossSalary?: number;
  basicSalary?: number;
  totalReceivedSalary?: number;
  totalExpectedSalary?: number;
  totalOvertimeHours?: number;
  totalOvertimeEarnings?: number;
  totalPresentDays?: number;
  totalAbsentDays?: number;
  totalLeaveDays?: number;
  monthsWorked?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type WorkerContactCategory =
  | 'supervisor'
  | 'line_chief'
  | 'production_manager'
  | 'hr_admin'
  | 'security'
  | 'coworker'
  | 'emergency'
  | 'other'
  | 'google';

export interface WorkerContact {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  designation?: string;
  category: WorkerContactCategory | string;
  customCategory?: string;
  department?: string;
  lineNumber?: string;
  notes?: string;
  isFavorite: boolean;
  isEmergency: boolean;
  isPinned?: boolean;
  source?: 'google' | 'manual';
  googleResourceName?: string;
  isSyncedToGoogle?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NavTab =
  | 'dashboard'
  | 'overtime'
  | 'salary'
  | 'attendance'
  | 'expenses'
  | 'more'
  | 'admin';

export type MoreSubView =
  | 'profile'
  | 'contacts'
  | 'factory'
  | 'salary'
  | 'finance'
  | 'personal_loans'
  | 'documents'
  | 'reports'
  | 'reminders'
  | 'support'
  | 'alarm'
  | 'calculator'
  | 'subscriptions'
  | 'admin_panel';

export interface AlarmItem {
  id: string;
  time: string; // 'HH:mm'
  label: string;
  isEnabled: boolean;
  repeatDays: number[]; // 0=রবি, 1=সোম, 2=মঙ্গল, 3=বুধ, 4=বৃহস্পতি, 5=শুক্র, 6=শনি
  toneId: 'factory_siren' | 'digital_beep' | 'gentle_chime' | 'morning_bell' | 'custom_device';
  customToneName?: string;
  customToneId?: string;
  lastTriggeredDate?: string; // YYYY-MM-DD to avoid double trigger in same minute
}

export interface RentAdvanceInstallment {
  date: string; // YYYY-MM-DD
  amount: number;
  note?: string;
}


