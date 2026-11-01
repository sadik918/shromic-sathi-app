import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  Filter,
  HandCoins,
  History,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import type {
  LoanRepayment,
  LoanRepaymentFrequency,
  LoanRepaymentMethod,
  LoanStatus,
  PersonalLoan,
  PersonalLoanDirection,
} from '../types';
import {
  formatBDT,
  formatNumber,
  getLoanDirection,
  getLoanOriginalAmount,
  getLoanPersonName,
  getLoanRemainingBalance,
  getLoanRepaymentsTotal,
  getLoanStatusKey,
  getTodayISO,
  summarizeAllPersonalLoans,
} from '../utils/calculations';
import { formatDateReadable, formatDateSlashDMY } from '../utils/i18n';
import { DateInputDMY } from './DateInputDMY';

export const PersonalLoanView: React.FC = () => {
  const {
    loans,
    lang,
    saveLoan,
    addLoanRepayment,
    deleteLoanRepayment,
    settleLoan,
    archiveLoan,
    deleteLoan,
  } = useData();

  const todayISO = getTodayISO();

  // Primary navigation tab
  const [activeTab, setActiveTab] = useState<
    'lent' | 'borrowed' | 'due_today' | 'person_ledger' | 'reports'
  >('lent');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LoanStatus>('all');
  const [showArchived, setShowArchived] = useState(false);

  // New Loan Modal state
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [modalDirection, setModalDirection] = useState<PersonalLoanDirection>('lent');
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  // Loan Form Fields
  const [personName, setPersonName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [transactionDate, setTransactionDate] = useState<string>(todayISO);
  const [expectedRepaymentDate, setExpectedRepaymentDate] = useState<string>('');
  const [reason, setReason] = useState('');
  const [repaymentArrangement, setRepaymentArrangement] =
    useState<LoanRepaymentFrequency>('lump_sum');
  const [notes, setNotes] = useState('');

  // Repayment Modal state
  const [repaymentModalLoan, setRepaymentModalLoan] = useState<PersonalLoan | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState<number>(0);
  const [repaymentDate, setRepaymentDate] = useState<string>(todayISO);
  const [repaymentMethod, setRepaymentMethod] = useState<LoanRepaymentMethod>('cash');
  const [repaymentNotes, setRepaymentNotes] = useState<string>('');

  // Detail Drawer state
  const [detailLoan, setDetailLoan] = useState<PersonalLoan | null>(null);

  // Notification Banner permission state
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'));

  const [toastNotice, setToastNotice] = useState<string>('');

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(''), 3500);
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        showToast(
          lang === 'bn'
            ? 'ব্রাউজার নোটিফিকেশন সফলভাবে চালু করা হয়েছে!'
            : 'Browser notifications enabled!'
        );
      } else {
        showToast(
          lang === 'bn'
            ? 'নোটিফিকেশন অনুমতি পাওয়া যায়নি।'
            : 'Notification permission not granted.'
        );
      }
    }
  };

  // Summaries
  const metrics = useMemo(() => summarizeAllPersonalLoans(loans, todayISO), [loans, todayISO]);

  // Filtered Loans based on current tab, search, status, and archive
  const activeLoansList = useMemo(() => {
    return loans.filter((l) => {
      // Archive filter
      if (!showArchived && l.isArchived) return false;

      // Tab filter
      const dir = getLoanDirection(l);
      if (activeTab === 'lent' && dir !== 'lent') return false;
      if (activeTab === 'borrowed' && dir !== 'borrowed') return false;

      const statusKey = getLoanStatusKey(l, todayISO);
      if (activeTab === 'due_today' && statusKey !== 'due_today' && statusKey !== 'overdue') {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && statusKey !== statusFilter) return false;

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const pName = getLoanPersonName(l).toLowerCase();
        const phone = (l.contactNumber || '').toLowerCase();
        const rsn = (l.reason || l.notes || '').toLowerCase();
        if (!pName.includes(q) && !phone.includes(q) && !rsn.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [loans, showArchived, activeTab, statusFilter, searchQuery, todayISO]);

  // Person-Wise Ledger Aggregation
  const personLedgers = useMemo(() => {
    const map = new Map<
      string,
      {
        personName: string;
        contactNumber: string;
        totalLent: number;
        totalBorrowed: number;
        totalReceived: number;
        totalPaid: number;
        loans: PersonalLoan[];
      }
    >();

    for (const l of loans) {
      if (!showArchived && l.isArchived) continue;
      const pName = getLoanPersonName(l).trim();
      const normKey = pName.toLowerCase();
      if (!normKey) continue;

      let entry = map.get(normKey);
      if (!entry) {
        entry = {
          personName: pName,
          contactNumber: l.contactNumber || '',
          totalLent: 0,
          totalBorrowed: 0,
          totalReceived: 0,
          totalPaid: 0,
          loans: [],
        };
        map.set(normKey, entry);
      }

      if (l.contactNumber && !entry.contactNumber) {
        entry.contactNumber = l.contactNumber;
      }

      const origAmt = getLoanOriginalAmount(l);
      const dir = getLoanDirection(l);
      if (dir === 'lent') {
        entry.totalLent += origAmt;
      } else {
        entry.totalBorrowed += origAmt;
      }

      const reps = l.repayments || [];
      for (const r of reps) {
        if (r.direction === 'received') {
          entry.totalReceived += r.amount;
        } else {
          entry.totalPaid += r.amount;
        }
      }

      entry.loans.push(l);
    }

    let list = Array.from(map.values());
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.personName.toLowerCase().includes(q) || p.contactNumber.toLowerCase().includes(q)
      );
    }

    return list;
  }, [loans, showArchived, searchQuery]);

  // Handlers
  const handleOpenAddModal = (dir: PersonalLoanDirection) => {
    setEditingLoanId(null);
    setModalDirection(dir);
    setPersonName('');
    setContactNumber('');
    setAmount(0);
    setTransactionDate(todayISO);
    setExpectedRepaymentDate('');
    setReason('');
    setRepaymentArrangement('lump_sum');
    setNotes('');
    setShowLoanModal(true);
  };

  const handleEditLoan = (l: PersonalLoan) => {
    setEditingLoanId(l.id);
    setModalDirection(getLoanDirection(l));
    setPersonName(getLoanPersonName(l));
    setContactNumber(l.contactNumber || '');
    setAmount(getLoanOriginalAmount(l));
    setTransactionDate(l.transactionDate || todayISO);
    setExpectedRepaymentDate(l.expectedRepaymentDate || l.nextDueDate || '');
    setReason(l.reason || '');
    setRepaymentArrangement((l.repaymentArrangement as LoanRepaymentFrequency) || 'lump_sum');
    setNotes(l.notes || '');
    setShowLoanModal(true);
  };

  const handleSaveLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || amount <= 0) return;

    await saveLoan(
      {
        personName: personName.trim(),
        title: personName.trim(),
        contactNumber: contactNumber.trim(),
        direction: modalDirection,
        originalAmount: Number(amount),
        totalLoanAmount: Number(amount),
        transactionDate,
        expectedRepaymentDate: expectedRepaymentDate || undefined,
        nextDueDate: expectedRepaymentDate || undefined,
        reason: reason.trim(),
        repaymentArrangement,
        notes: notes.trim(),
        repayments: editingLoanId
          ? loans.find((x) => x.id === editingLoanId)?.repayments || []
          : [],
        status: editingLoanId
          ? loans.find((x) => x.id === editingLoanId)?.status || 'pending'
          : 'pending',
      },
      editingLoanId || undefined
    );

    setShowLoanModal(false);
    showToast(
      lang === 'bn'
        ? modalDirection === 'lent'
          ? 'টাকা দেওয়ার হিসাব সফলভাবে সংরক্ষিত হয়েছে!'
          : 'ধার নেওয়ার হিসাব সফলভাবে সংরক্ষিত হয়েছে!'
        : 'Loan entry saved successfully!'
    );
  };

  const handleOpenRepaymentModal = (l: PersonalLoan) => {
    setRepaymentModalLoan(l);
    const rem = getLoanRemainingBalance(l);
    setRepaymentAmount(rem);
    setRepaymentDate(todayISO);
    setRepaymentMethod('cash');
    setRepaymentNotes('');
  };

  const handleSaveRepaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repaymentModalLoan || repaymentAmount <= 0) return;

    const rem = getLoanRemainingBalance(repaymentModalLoan);
    if (repaymentAmount > rem) {
      const confirmExceed = window.confirm(
        lang === 'bn'
          ? `অবশিষ্ট বকেয়া ৳${rem}-এর চেয়ে পরিশোধের পরিমাণ ৳${repaymentAmount} বেশি। আপনি কি অতিরিক্ত কিস্তি যোগ করতে চান?`
          : `Amount ৳${repaymentAmount} exceeds remaining balance ৳${rem}. Do you want to proceed?`
      );
      if (!confirmExceed) return;
    }

    const dir = getLoanDirection(repaymentModalLoan);
    const repDir = dir === 'lent' ? 'received' : 'paid';

    await addLoanRepayment(repaymentModalLoan.id, {
      amount: Number(repaymentAmount),
      repaymentDate,
      paymentDate: repaymentDate,
      repaymentMethod,
      paymentMethod: repaymentMethod,
      direction: repDir,
      notes: repaymentNotes.trim(),
    });

    setRepaymentModalLoan(null);
    showToast(
      lang === 'bn'
        ? dir === 'lent'
          ? 'পাওনা টাকা আদায়ের কিস্তি যুক্ত হয়েছে!'
          : 'ধার পরিশোধের কিস্তি যুক্ত হয়েছে!'
        : 'Repayment recorded!'
    );
  };

  const handleExportCSV = () => {
    const rows = [
      [
        'Direction',
        'Person Name',
        'Contact Number',
        'Original Amount (BDT)',
        'Total Repaid (BDT)',
        'Remaining Balance (BDT)',
        'Transaction Date',
        'Expected Repayment Date',
        'Status',
        'Reason',
      ],
      ...loans.map((l) => [
        getLoanDirection(l) === 'lent' ? 'Money Lent (আমি পাব)' : 'Money Borrowed (আমি দেব)',
        `"${getLoanPersonName(l).replace(/"/g, '""')}"`,
        `"${(l.contactNumber || '').replace(/"/g, '""')}"`,
        String(getLoanOriginalAmount(l)),
        String(getLoanRepaymentsTotal(l)),
        String(getLoanRemainingBalance(l)),
        l.transactionDate || '',
        l.expectedRepaymentDate || l.nextDueDate || '',
        getLoanStatusKey(l, todayISO),
        `"${(l.reason || l.notes || '').replace(/"/g, '""')}"`,
      ]),
    ];

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shromik_sathi_loans_ledger_${todayISO}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(lang === 'bn' ? 'ধার-দেনা লেজার CSV ডাউনলোড সম্পন্ন!' : 'CSV exported!');
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Toast Notice Banner */}
      {toastNotice && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* Header & Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <HandCoins className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{lang === 'bn' ? 'ধার-দেনা ও ঋণ হিসাব' : 'Personal Loans & Debt Tracker'}</span>
            </h1>
          </div>
        </div>

        {/* Browser Notification Permission Toggle & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={handleRequestNotificationPermission}
              className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'অ্যালার্ট নোটিফিকেশন চালুর অনুমতি দিন' : 'Enable Notifications'}</span>
            </button>
          )}

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              data-testid="add-lent-money-btn"
              onClick={() => handleOpenAddModal('lent')}
              className="w-full sm:w-auto justify-center px-3.5 py-2.5 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'bn' ? '+ টাকা পাব' : '+ Give Loan'}</span>
            </button>

            <button
              type="button"
              data-testid="add-borrowed-money-btn"
              onClick={() => handleOpenAddModal('borrowed')}
              className="w-full sm:w-auto justify-center px-3.5 py-2.5 sm:py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'bn' ? '+ ধার নিয়েছি' : '+ Borrow Money'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN DASHBOARD — 4 SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: আমি পাব (Money Others Owe Me) */}
        <div
          data-testid="card-money-to-receive"
          className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {lang === 'bn' ? 'আমি পাব' : 'Money to Receive'}
            </span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {formatNumber(metrics.lentActiveCount, lang)}টি বাকি
            </span>
          </div>
          <p className="text-lg sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatBDT(metrics.totalToReceive, lang)}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {lang === 'bn' ? 'অন্যরা যে টাকা আমায় ফেরত দেবে' : 'Outstanding lent balance'}
          </p>
        </div>

        {/* Card 2: আমি দেব (Money I Owe Others) */}
        <div
          data-testid="card-money-to-repay"
          className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-purple-200/80 dark:border-purple-900/60 shadow-xs space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              {lang === 'bn' ? 'আমি দেব' : 'Money to Repay'}
            </span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              {formatNumber(metrics.borrowedActiveCount, lang)}টি দেনা
            </span>
          </div>
          <p className="text-lg sm:text-2xl font-black text-purple-700 dark:text-purple-400 tabular-nums">
            {formatBDT(metrics.totalToRepay, lang)}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {lang === 'bn' ? 'আমার থেকে অন্যরা যে টাকা পাবে' : 'Outstanding borrowed debt'}
          </p>
        </div>

        {/* Card 3: এই মাসে পেয়েছি (Received This Month) */}
        <div
          data-testid="card-received-this-month"
          className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-teal-200/80 dark:border-teal-900/60 shadow-xs space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              {lang === 'bn' ? 'এই মাসে পেয়েছি' : 'Received This Month'}
            </span>
            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
              {todayISO.slice(0, 7)}
            </span>
          </div>
          <p className="text-lg sm:text-2xl font-black text-teal-700 dark:text-teal-400 tabular-nums">
            +{formatBDT(metrics.monthlyReceived, lang)}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {lang === 'bn' ? 'পাওনা টাকা উদ্ধার করা হয়েছে' : 'Repayments collected this month'}
          </p>
        </div>

        {/* Card 4: এই মাসে দিয়েছি (Paid This Month) */}
        <div
          data-testid="card-paid-this-month"
          className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-rose-200/80 dark:border-rose-900/60 shadow-xs space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              {lang === 'bn' ? 'এই মাসে দিয়েছি' : 'Paid This Month'}
            </span>
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
              {todayISO.slice(0, 7)}
            </span>
          </div>
          <p className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
            -{formatBDT(metrics.monthlyPaid, lang)}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {lang === 'bn' ? 'ধার শোধ করা হয়েছে' : 'Debts repaid this month'}
          </p>
        </div>
      </div>

      {/* Due Today / Overdue Banner Warning */}
      {(metrics.dueTodayCount > 0 || metrics.overdueCount > 0) && (
        <div
          data-testid="loan-overdue-alert-banner"
          className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-extrabold text-amber-900 dark:text-amber-200">
                {lang === 'bn'
                  ? `মনোযোগ দিন! ${formatNumber(metrics.overdueCount, lang)}টি বকেয়া ঋণ মেয়াদোত্তীর্ণ এবং ${formatNumber(metrics.dueTodayCount, lang)}টির তাগাদা আজ রয়েছে।`
                  : `Attention: ${metrics.overdueCount} overdue and ${metrics.dueTodayCount} due today.`}
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                {lang === 'bn'
                  ? 'দেরি না করে লেনদেন সম্পন্ন করে হিসাব হালনাগাদ করুন।'
                  : 'Settle or follow up on due transactions today.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('due_today')}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 self-start sm:self-center transition-colors"
          >
            {lang === 'bn' ? 'আজকের বকেয়া দেখুন' : 'View Due Items'}
          </button>
        </div>
      )}

      {/* Primary Section Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'lent', labelBn: 'টাকা পাব (Lent)', labelEn: 'Money Owed To Me', count: metrics.lentActiveCount },
          { id: 'borrowed', labelBn: 'টাকা দেব (Borrowed)', labelEn: 'Money I Owe', count: metrics.borrowedActiveCount },
          {
            id: 'due_today',
            labelBn: 'আজকের পাওনা ও বকেয়া',
            labelEn: 'Due Today & Overdue',
            count: metrics.dueTodayCount + metrics.overdueCount,
            badgeColor: 'bg-amber-500 text-white',
          },
          { id: 'person_ledger', labelBn: 'ব্যক্তিভিত্তিক লেজার', labelEn: 'Person Ledger', count: personLedgers.length },
          { id: 'reports', labelBn: 'রিপোর্ট ও এক্সপোর্ট', labelEn: 'Reports & Export' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`loan-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-emerald-400'
            }`}
          >
            <span>{lang === 'bn' ? tab.labelBn : tab.labelEn}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  tab.badgeColor ||
                  (activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300')
                }`}
              >
                {formatNumber(tab.count, lang)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter & Search Bar for Lists */}
      {(activeTab === 'lent' || activeTab === 'borrowed' || activeTab === 'due_today') && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-800">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              data-testid="loan-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'নাম, মোবাইল বা কারণ দিয়ে খুঁজুন...'
                  : 'Search by person name or contact...'
              }
              className="w-full pl-9 pr-8 py-2 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:flex-initial flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 sm:p-1 rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full bg-transparent border-0 text-xs font-semibold text-slate-700 dark:text-slate-200 pr-1 focus:ring-0"
              >
                <option value="all">{lang === 'bn' ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
                <option value="pending">{lang === 'bn' ? 'বকেয়া (Pending)' : 'Pending'}</option>
                <option value="partially_repaid">{lang === 'bn' ? 'আংশিক শোধ' : 'Partial'}</option>
                <option value="due_today">{lang === 'bn' ? 'আজকের মেয়াদের' : 'Due Today'}</option>
                <option value="overdue">{lang === 'bn' ? 'মেয়াদোত্তীর্ণ' : 'Overdue'}</option>
                <option value="fully_settled">{lang === 'bn' ? 'নিষ্পত্তি সম্পন্ন' : 'Settled'}</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded text-emerald-600"
              />
              <span>{lang === 'bn' ? 'আর্কাইভ' : 'Archived'}</span>
            </label>
          </div>
        </div>
      )}

      {/* SECTION CONTENT A & B: LOANS LIST (Lent / Borrowed / Due Today) */}
      {(activeTab === 'lent' || activeTab === 'borrowed' || activeTab === 'due_today') && (
        <div className="space-y-3">
          {activeLoansList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <HandCoins className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {lang === 'bn'
                  ? 'কোনো লেনদেনের রেকর্ড পাওয়া যায়নি।'
                  : 'No loan transaction records found.'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {lang === 'bn'
                  ? 'নতুন কোনো লেনদেন এন্ট্রি করতে ওপরের “+ টাকা পাব” বা “+ ধার নিয়েছি” বাটনে ট্যাপ করুন।'
                  : 'Tap "+ Give Loan" or "+ Borrow Money" to record a new entry.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeLoansList.map((loan) => {
                const origAmt = getLoanOriginalAmount(loan);
                const repaid = getLoanRepaymentsTotal(loan);
                const rem = getLoanRemainingBalance(loan);
                const dir = getLoanDirection(loan);
                const pName = getLoanPersonName(loan);
                const statusKey = getLoanStatusKey(loan, todayISO);
                const pct = origAmt > 0 ? Math.min(100, Math.round((repaid / origAmt) * 100)) : 100;

                return (
                  <div
                    key={loan.id}
                    data-testid={`loan-card-${loan.id}`}
                    className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all space-y-3 ${
                      statusKey === 'overdue'
                        ? 'border-rose-300 dark:border-rose-900/80 bg-rose-50/20'
                        : statusKey === 'due_today'
                        ? 'border-amber-300 dark:border-amber-900/80 bg-amber-50/20'
                        : 'border-slate-200/90 dark:border-slate-800 shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Person & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                              dir === 'lent'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`}
                          >
                            {dir === 'lent'
                              ? lang === 'bn'
                                ? 'আমি পাব'
                                : 'Lent'
                              : lang === 'bn'
                              ? 'আমি দেব'
                              : 'Borrowed'}
                          </span>

                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                            {pName}
                          </h3>
                        </div>

                        {loan.contactNumber && (
                          <a
                            href={`tel:${loan.contactNumber}`}
                            className="text-[11px] text-slate-500 hover:text-emerald-600 inline-flex items-center gap-1 mt-1 tabular-nums"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{loan.contactNumber}</span>
                          </a>
                        )}
                      </div>

                      {/* Status Tag */}
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold shrink-0 ${
                          statusKey === 'fully_settled'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : statusKey === 'overdue'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : statusKey === 'due_today'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : statusKey === 'partially_repaid'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {statusKey === 'fully_settled'
                          ? lang === 'bn'
                            ? 'নিষ্পত্তি সম্পন্ন'
                            : 'Settled'
                          : statusKey === 'overdue'
                          ? lang === 'bn'
                            ? 'মেয়াদোত্তীর্ণ'
                            : 'Overdue'
                          : statusKey === 'due_today'
                          ? lang === 'bn'
                            ? 'আজ পরিশোধের মেয়াদ'
                            : 'Due Today'
                          : statusKey === 'partially_repaid'
                          ? lang === 'bn'
                            ? 'আংশিক শোধ'
                            : 'Partially Repaid'
                          : lang === 'bn'
                          ? 'বকেয়া (Pending)'
                          : 'Pending'}
                      </span>
                    </div>

                    {/* Amount & Progress */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-slate-50 dark:bg-slate-800/60 p-2 sm:p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block font-semibold truncate">
                          {lang === 'bn' ? 'মূল পরিমাণ' : 'Original'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums text-xs sm:text-sm truncate block">
                          {formatBDT(origAmt, lang)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block font-semibold truncate">
                          {lang === 'bn' ? 'পরিশোধিত' : 'Repaid'}
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-xs sm:text-sm truncate block">
                          {formatBDT(repaid, lang)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block font-semibold truncate">
                          {lang === 'bn' ? 'অবশিষ্ট বকেয়া' : 'Remaining'}
                        </span>
                        <span
                          className={`font-black tabular-nums text-xs sm:text-sm truncate block ${
                            rem > 0
                              ? dir === 'lent'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-purple-700 dark:text-purple-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatBDT(rem, lang)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                        <span>
                          {lang === 'bn' ? 'পরিশোধের অগ্রগতি' : 'Repayment Progress'} ({pct}%)
                        </span>
                        <span>
                          {loan.transactionDate &&
                            `${lang === 'bn' ? 'তারিখ:' : 'Date:'} ${formatDateSlashDMY(
                              loan.transactionDate,
                              lang
                            )}`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct === 100
                              ? 'bg-emerald-500'
                              : dir === 'lent'
                              ? 'bg-emerald-600'
                              : 'bg-purple-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta Dates & Reason */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800 gap-2">
                      <span className="truncate max-w-[60%]">
                        {loan.reason || loan.notes || (lang === 'bn' ? 'সাধারণ লেনদেন' : 'General')}
                      </span>

                      {(loan.expectedRepaymentDate || loan.nextDueDate) && (
                        <span className="font-semibold tabular-nums shrink-0">
                          {lang === 'bn' ? 'মেয়াদ:' : 'Due:'}{' '}
                          {formatDateReadable(
                            loan.expectedRepaymentDate || loan.nextDueDate || '',
                            lang
                          )}
                        </span>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setDetailLoan(loan)}
                        className="px-2.5 py-1.5 sm:py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'বিস্তারিত' : 'Details'}</span>
                      </button>

                      <div className="flex items-center gap-1 sm:gap-1.5">
                        {rem > 0 && (
                          <button
                            type="button"
                            data-testid={`pay-repayment-btn-${loan.id}`}
                            onClick={() => handleOpenRepaymentModal(loan)}
                            className={`px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-xl text-white text-[11px] font-extrabold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                              dir === 'lent'
                                ? 'bg-emerald-700 hover:bg-emerald-800'
                                : 'bg-purple-700 hover:bg-purple-800'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>
                              {dir === 'lent'
                                ? lang === 'bn'
                                  ? 'টাকা পেলাম'
                                  : 'Collect'
                                : lang === 'bn'
                                ? 'পরিশোধ করলাম'
                                : 'Pay Back'}
                            </span>
                          </button>
                        )}

                        {rem > 0 && (
                          <button
                            type="button"
                            onClick={() => settleLoan(loan.id)}
                            title={lang === 'bn' ? 'সম্পূর্ণ নিষ্পত্তি' : 'Settle All'}
                            className="p-1.5 sm:p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleEditLoan(loan)}
                          className="p-1.5 sm:p-1 text-slate-400 hover:text-emerald-600 rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => archiveLoan(loan.id)}
                          title={loan.isArchived ? 'আর্কাইভ থেকে তুলুন' : 'আর্কাইভ করুন'}
                          className="p-1.5 sm:p-1 text-slate-400 hover:text-amber-600 rounded-lg cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteLoan(loan.id)}
                          className="p-1.5 sm:p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION CONTENT C: PERSON-WISE LEDGER (ব্যক্তিভিত্তিক লেজার) */}
      {activeTab === 'person_ledger' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'bn' ? 'ব্যক্তিভিত্তিক হিসাবের খাতা' : 'Person Ledger Accounts'}</span>
            </h2>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'ব্যক্তির নাম দিয়ে খুঁজুন...'
                    : 'Search person ledger by name...'
                }
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {personLedgers.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">
              {lang === 'bn' ? 'কোনো ব্যক্তির লেজার রেকর্ড পাওয়া যায়নি।' : 'No person ledgers found.'}
            </p>
          ) : (
            <div className="space-y-3">
              {personLedgers.map((p, idx) => {
                const netLentRem = p.totalLent - p.totalReceived;
                const netBorrowedRem = p.totalBorrowed - p.totalPaid;
                const netBalance = netLentRem - netBorrowedRem;

                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{p.personName}</span>
                          {p.contactNumber && (
                            <span className="text-xs font-normal text-slate-500 tabular-nums">
                              ({p.contactNumber})
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {lang === 'bn'
                            ? `মোট ${formatNumber(p.loans.length, lang)}টি লেনদেন রেকর্ড`
                            : `${p.loans.length} transaction entries`}
                        </p>
                      </div>

                      {/* Net Status Indicator */}
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-bold">
                          {lang === 'bn' ? 'নিট হিসাব' : 'Net Balance'}
                        </span>
                        <span
                          className={`text-sm font-black tabular-nums ${
                            netBalance > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : netBalance < 0
                              ? 'text-purple-600 dark:text-purple-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {netBalance > 0
                            ? `${lang === 'bn' ? 'আমি পাব:' : 'Net Receive:'} ${formatBDT(netBalance, lang)}`
                            : netBalance < 0
                            ? `${lang === 'bn' ? 'আমি দেব:' : 'Net Repay:'} ${formatBDT(Math.abs(netBalance), lang)}`
                            : lang === 'bn'
                            ? 'হিসাব সমান (০)'
                            : 'Settled (0)'}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Numbers */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          {lang === 'bn' ? 'মোট দেওয়া হয়েছে' : 'Total Lent'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatBDT(p.totalLent, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          {lang === 'bn' ? 'ফেরত পেয়েছি' : 'Collected'}
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatBDT(p.totalReceived, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          {lang === 'bn' ? 'মোট নেওয়া ধার' : 'Total Borrowed'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatBDT(p.totalBorrowed, lang)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          {lang === 'bn' ? 'শোধ করেছি' : 'Paid Back'}
                        </span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {formatBDT(p.totalPaid, lang)}
                        </span>
                      </div>
                    </div>

                    {/* Associated Loan Items */}
                    <div className="space-y-1.5 pt-1">
                      {p.loans.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded mr-1.5 ${
                                getLoanDirection(item) === 'lent'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              }`}
                            >
                              {getLoanDirection(item) === 'lent' ? 'পাব' : 'দেব'}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {item.reason || item.notes || (lang === 'bn' ? 'ধার' : 'Loan')}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-2">
                              {formatDateSlashDMY(item.transactionDate || todayISO, lang)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-bold tabular-nums">
                              {formatBDT(getLoanOriginalAmount(item), lang)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDetailLoan(item)}
                              className="p-1 text-slate-400 hover:text-emerald-600 cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION CONTENT D: REPORTS & EXPORT */}
      {activeTab === 'reports' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>{lang === 'bn' ? 'ধার-দেনা রিপোর্ট ও প্রিন্ট' : 'Loan Summary & Reports'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'bn'
                  ? 'আপনার সমস্ত পাওনা ও ধারের বিবরণী প্রিন্ট করুন বা CSV ব্যাকআপ হিসেবে সেভ করুন'
                  : 'Download or print complete ledger summary for accounting'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'bn' ? 'CSV এক্সপোর্ট' : 'Export CSV'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'bn' ? 'প্রিন্ট / PDF' : 'Print PDF'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
            <div>
              <span className="text-slate-400 block font-semibold">
                {lang === 'bn' ? 'মোট পাওনা (অন্যদের কাছে)' : 'Total Receivable'}
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {formatBDT(metrics.totalToReceive, lang)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">
                {lang === 'bn' ? 'মোট দেনা (আমার কাছে)' : 'Total Payable'}
              </span>
              <span className="text-base font-black text-purple-600 dark:text-purple-400">
                {formatBDT(metrics.totalToRepay, lang)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">
                {lang === 'bn' ? 'এই মাসে আদায়' : 'Received This Month'}
              </span>
              <span className="text-base font-black text-teal-600 dark:text-teal-400">
                {formatBDT(metrics.monthlyReceived, lang)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">
                {lang === 'bn' ? 'এই মাসে পরিশোধ' : 'Paid This Month'}
              </span>
              <span className="text-base font-black text-rose-600 dark:text-rose-400">
                {formatBDT(metrics.monthlyPaid, lang)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT LOAN RECORD MODAL */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <HandCoins className="w-5 h-5 text-emerald-600" />
                <span>
                  {editingLoanId
                    ? lang === 'bn'
                      ? 'লেনদেনের তথ্য সম্পাদনা'
                      : 'Edit Loan Record'
                    : modalDirection === 'lent'
                    ? lang === 'bn'
                      ? 'নতুন টাকা দেওয়ার হিসাব (আমি পাব)'
                      : 'Add Money Lent (I will receive)'
                    : lang === 'bn'
                    ? 'নতুন ধার নেওয়ার হিসাব (আমি দেব)'
                    : 'Add Borrowed Money (I owe)'}
                </span>
              </h2>

              <button
                type="button"
                onClick={() => setShowLoanModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLoanSubmit} className="space-y-3.5">
              {/* Direction Switcher */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setModalDirection('lent')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalDirection === 'lent'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'bn' ? 'টাকা অন্যকে দিয়েছি (আমি পাব)' : 'I Lent Money'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalDirection('borrowed')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalDirection === 'borrowed'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'bn' ? 'ধার নিয়েছি (আমি দেব)' : 'I Borrowed Money'}
                </button>
              </div>

              {/* Person Name & Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {modalDirection === 'lent'
                      ? lang === 'bn'
                        ? 'গ্রহীতার নাম (যে টাকা নিয়েছে)'
                        : 'Borrower Name'
                      : lang === 'bn'
                      ? 'দাতাদের নাম (যার থেকে টাকা নিয়েছি)'
                      : 'Lender Name'}
                  </label>
                  <input
                    type="text"
                    data-testid="modal-person-name"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder={
                      lang === 'bn' ? 'যেমন: রফিক (সুইং সেকশন)' : 'e.g. Rafiq (Sewing)'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর (ঐচ্ছিক)' : 'Contact Number'}
                  </label>
                  <input
                    type="text"
                    data-testid="modal-contact-number"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="01712000000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'মূল টাকার পরিমাণ (৳)' : 'Original Amount (৳)'}
                  </label>
                  <input
                    type="number"
                    data-testid="modal-loan-amount"
                    min={1}
                    value={amount || ''}
                    placeholder="2000"
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'লেনদেনের তারিখ' : 'Transaction Date'}
                  </label>
                  <DateInputDMY
                    value={transactionDate}
                    lang={lang}
                    onChange={setTransactionDate}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Expected Repayment Date & Arrangement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'পরিশোধের সম্ভাব্য তারিখ' : 'Expected Repayment Date'}
                  </label>
                  <DateInputDMY
                    value={expectedRepaymentDate}
                    lang={lang}
                    onChange={setExpectedRepaymentDate}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'পরিশোধের পদ্ধতি / চুক্তি' : 'Repayment Arrangement'}
                  </label>
                  <select
                    value={repaymentArrangement}
                    onChange={(e) =>
                      setRepaymentArrangement(e.target.value as LoanRepaymentFrequency)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="lump_sum">{lang === 'bn' ? 'একবারে শোধ (Lump Sum)' : 'Lump Sum'}</option>
                    <option value="weekly">{lang === 'bn' ? 'সাপ্তাহিক কিস্তি' : 'Weekly'}</option>
                    <option value="monthly">{lang === 'bn' ? 'মাসিক কিস্তি' : 'Monthly'}</option>
                    <option value="custom">{lang === 'bn' ? 'সুবিধাজনক সময়ে' : 'Custom / Whenever possible'}</option>
                  </select>
                </div>
              </div>

              {/* Reason & Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'ধার নেওয়ার/দেওয়ার কারণ' : 'Reason / Note'}
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: মেসের বাজার খরচ, গ্রামে অসুস্থতায় পাঠানো...'
                      : 'e.g. Mess groceries, medical emergency'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  data-testid="modal-save-loan-submit-btn"
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-xs ${
                    modalDirection === 'lent'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-purple-700 hover:bg-purple-800'
                  }`}
                >
                  {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD REPAYMENT MODAL */}
      {repaymentModalLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>
                    {getLoanDirection(repaymentModalLoan) === 'lent'
                      ? lang === 'bn'
                        ? 'পাওনা টাকা আদায় রেকর্ড'
                        : 'Record Collected Repayment'
                      : lang === 'bn'
                      ? 'ধার পরিশোধ রেকর্ড'
                      : 'Record Debt Payment'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getLoanPersonName(repaymentModalLoan)} · {lang === 'bn' ? 'বকেয়া বাকি:' : 'Due:'}{' '}
                  <strong>{formatBDT(getLoanRemainingBalance(repaymentModalLoan), lang)}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRepaymentModalLoan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRepaymentSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'পরিশোধের পরিমাণ (৳)' : 'Repayment Amount (৳)'}
                </label>
                <input
                  type="number"
                  data-testid="repayment-amount-input"
                  min={1}
                  value={repaymentAmount || ''}
                  onChange={(e) => setRepaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'তারিখ' : 'Date'}
                  </label>
                  <DateInputDMY
                    value={repaymentDate}
                    lang={lang}
                    onChange={setRepaymentDate}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'মাধ্যম' : 'Method'}
                  </label>
                  <select
                    value={repaymentMethod}
                    onChange={(e) => setRepaymentMethod(e.target.value as LoanRepaymentMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="cash">{lang === 'bn' ? 'নগদ (Cash)' : 'Cash'}</option>
                    <option value="bkash">{lang === 'bn' ? 'বিকাশ (bKash)' : 'bKash'}</option>
                    <option value="nagad">{lang === 'bn' ? 'নগদ (Nagad)' : 'Nagad'}</option>
                    <option value="bank">{lang === 'bn' ? 'ব্যাংক ট্রান্সফার' : 'Bank'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'নোট বা রসিদ বিবরণ' : 'Note (optional)'}
                </label>
                <input
                  type="text"
                  value={repaymentNotes}
                  onChange={(e) => setRepaymentNotes(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: হাত নগদ পরিশোধ করা হলো' : 'e.g. Paid in cash'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRepaymentModalLoan(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  data-testid="repayment-submit-btn"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs"
                >
                  {lang === 'bn' ? 'কিস্তি যোগ করুন' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL 3: DETAIL VIEW & REPAYMENT TIMELINE */}
      {detailLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <span>{getLoanPersonName(detailLoan)} — লেনদেন টাইমলাইন</span>
                </h2>
                {detailLoan.contactNumber && (
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {detailLoan.contactNumber}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailLoan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overview Box */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">
                  {lang === 'bn' ? 'মূল টাকা' : 'Original'}
                </span>
                <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formatBDT(getLoanOriginalAmount(detailLoan), lang)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">
                  {lang === 'bn' ? 'পরিশোধিত' : 'Repaid'}
                </span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatBDT(getLoanRepaymentsTotal(detailLoan), lang)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">
                  {lang === 'bn' ? 'অবশিষ্ট বকেয়া' : 'Remaining'}
                </span>
                <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatBDT(getLoanRemainingBalance(detailLoan), lang)}
                </span>
              </div>
            </div>

            {/* Repayments Timeline List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {lang === 'bn' ? 'পরিশোধ ও কিস্তির হিস্ট্রি' : 'Repayment History'}
              </h3>

              {(!detailLoan.repayments || detailLoan.repayments.length === 0) ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  {lang === 'bn' ? 'এখনো কোনো কিস্তি যোগ করা হয়নি।' : 'No repayments logged yet.'}
                </p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                  {detailLoan.repayments.map((rep) => (
                    <div
                      key={rep.id}
                      className="py-2 flex items-center justify-between text-xs font-medium"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white">
                            ৳{rep.amount}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                            {rep.repaymentMethod}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDateReadable(rep.repaymentDate || rep.paymentDate || todayISO, lang)}{' '}
                          {rep.notes && `· ${rep.notes}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          await deleteLoanRepayment(detailLoan.id, rep.id);
                          // Refresh active detail
                          const updated = loans.find((x) => x.id === detailLoan.id);
                          setDetailLoan(updated || null);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title={lang === 'bn' ? 'কিস্তি মুছুন' : 'Delete Repayment'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDetailLoan(null);
                  handleOpenRepaymentModal(detailLoan);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'bn' ? 'নতুন কিস্তি যোগ করুন' : 'Add Repayment'}</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailLoan(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
