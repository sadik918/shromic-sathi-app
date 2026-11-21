import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAllSmartSearchItems,
  normalizeSearchText,
  parseSmartDateQuery,
  runSmartSearch,
  type SmartSearchDataset,
} from './smartSearch';
import type { WorkerProfile } from '../types';

const SAMPLE_PROFILE: WorkerProfile = {
  userId: 'u1',
  fullName: 'মোঃ রহিম উদ্দিন',
  photoUrl: '',
  phone: '01700000000',
  address: 'গাজীপুর',
  emergencyContact: '',
  factoryName: 'সবুজ বাংলা গার্মেন্টস লিঃ',
  factoryBranch: '',
  department: 'সুইং',
  designation: 'সিনিয়র অপারেটর',
  employeeId: 'EMP-101',
  employmentType: 'permanent',
  joiningDate: '2024-01-01',
  salaryGrade: 'Grade 4',
  basicSalary: 10000,
  houseRentAllowance: 5000,
  medicalAllowance: 750,
  transportAllowance: 450,
  foodAllowance: 1250,
  attendanceBonus: 1000,
  grossSalary: 17450,
  otWageBase: 'basic',
  otDivisor: 208,
  otMultiplier: 2,
  effectiveFrom: '2024-01-01',
  language: 'bn',
  privacyConsent: true,
};

function makeSampleDataset(): SmartSearchDataset {
  return {
    lang: 'bn',
    selectedMonth: '2026-11',
    todayISO: '2026-11-21',
    isAdminUser: false,
    profile: SAMPLE_PROFILE,
    overtime: [
      {
        id: 'ot-1',
        userId: 'u1',
        date: '2026-11-19',
        month: '2026-11',
        startTime: '17:00',
        endTime: '20:00',
        breakMinutes: 0,
        totalMinutes: 180,
        approvedHours: 3,
        basicSalarySnapshot: 10000,
        divisorSnapshot: 208,
        multiplierSnapshot: 2,
        hourlyRateSnapshot: 96.15,
        estimatedEarnings: 288,
        notes: 'নাইট শিপমেন্ট ওভারটাইম',
      },
      {
        id: 'ot-prev',
        userId: 'u1',
        date: '2026-10-19',
        month: '2026-10',
        startTime: '17:00',
        endTime: '19:00',
        breakMinutes: 0,
        totalMinutes: 120,
        approvedHours: 2,
        basicSalarySnapshot: 10000,
        divisorSnapshot: 208,
        multiplierSnapshot: 2,
        hourlyRateSnapshot: 96.15,
        estimatedEarnings: 192,
        notes: 'অক্টোবর ১৯ ওটি',
      },
    ],
    attendance: [
      {
        id: 'att-1',
        userId: 'u1',
        date: '2026-11-10',
        month: '2026-11',
        status: 'late',
        leaveCategory: 'none',
        checkIn: '08:25',
        checkOut: '17:00',
        notes: 'রাস্তায় জ্যাম ছিল',
      },
      {
        id: 'att-19',
        userId: 'u1',
        date: '2026-11-19',
        month: '2026-11',
        status: 'present',
        leaveCategory: 'none',
        checkIn: '07:55',
        checkOut: '20:00',
        notes: '',
      },
    ],
    salaryRecords: [],
    payments: [
      {
        id: 'pay-1',
        userId: 'u1',
        month: '2026-11',
        paymentDate: '2026-11-07',
        amountReceived: 14500,
        paymentMethod: 'bkash',
        isPartial: false,
        referenceNote: 'অক্টোবর মাসের বেতন',
      },
    ],
    expenses: [
      {
        id: 'exp-1',
        userId: 'u1',
        date: '2026-11-15',
        month: '2026-11',
        category: 'rent',
        amount: 5500,
        description: 'গাজীপুর বাসা ভাড়া',
      },
    ],
    savings: [
      {
        id: 'sav-1',
        userId: 'u1',
        title: 'ঈদ সঞ্চয় ফান্ড',
        targetAmount: 20000,
        savedAmount: 6500,
        monthlyBudget: 2000,
        deadline: '2027-04-01',
        notes: 'বিকাশ সেভিংস',
      },
    ],
    loans: [
      {
        id: 'loan-1',
        userId: 'u1',
        personName: 'করিম ভাই',
        direction: 'lent',
        originalAmount: 3000,
        reason: 'চিকিৎসার জন্য ধার',
      },
    ],
    contacts: [
      {
        id: 'c-1',
        userId: 'u1',
        fullName: 'সুপারভাইজার হাসান',
        phone: '01711223344',
        category: 'supervisor',
        isFavorite: true,
        isEmergency: false,
      },
    ],
    workplaces: [],
    reminders: [
      {
        id: 'rem-1',
        userId: 'u1',
        title: 'বিদ্যুৎ বিল জমা দিতে হবে',
        category: 'bill_payment',
        dueDate: '2026-11-25',
        isCompleted: false,
        notes: '',
      },
    ],
    documents: [],
    alarms: [
      {
        id: 'al-1',
        time: '06:30',
        label: 'ফজরের পর ডিউটি অ্যালার্ম',
        isEnabled: true,
        repeatDays: [0, 1, 2, 3, 4, 6],
        toneId: 'morning_bell',
      },
    ],
    leaveApplications: [],
    publishedAnnouncements: [
      {
        id: 'ann-1',
        titleBn: 'ঈদের ছুটির নোটিশ',
        titleEn: 'Eid Holiday Notice',
        messageBn: 'আগামী সপ্তাহে কারখানা বন্ধ থাকবে।',
        messageEn: 'Factory closed next week.',
        category: 'general',
        status: 'published',
        audience: 'all',
        publishedBy: 'Admin',
        publishedAt: '2026-11-18',
        startDate: '2026-11-18',
        endDate: '2026-12-18',
        createdAt: '2026-11-18T00:00:00Z',
        updatedAt: '2026-11-18T00:00:00Z',
      },
    ],
    feedbackList: [],
  };
}

test('normalizeSearchText converts Bengali digits to ASCII and trims whitespace', () => {
  assert.equal(normalizeSearchText('  ৫৫০০ টাকা  '), '5500 টাকা');
  assert.equal(normalizeSearchText('OT  2026'), 'ot 2026');
});

test('parseSmartDateQuery recognizes Bengali day, tarikh, month+day, slash date, and today/yesterday', () => {
  assert.deepEqual(parseSmartDateQuery('১৯', '2026-11', '2026-11-21'), {
    day: 19,
    wantsReport: false,
  });
  assert.deepEqual(parseSmartDateQuery('১৯ তারিখ রিপোর্ট', '2026-11', '2026-11-21'), {
    day: 19,
    wantsReport: true,
  });
  assert.equal(
    parseSmartDateQuery('১৯ নভেম্বর', '2026-11', '2026-11-21')?.exactDateISO,
    '2026-11-19'
  );
  assert.equal(
    parseSmartDateQuery('19/10', '2026-11', '2026-11-21')?.exactDateISO,
    '2026-10-19'
  );
  assert.equal(parseSmartDateQuery('আজ', '2026-11', '2026-11-21')?.exactDateISO, '2026-11-21');
  assert.equal(
    parseSmartDateQuery('গতকাল', '2026-11', '2026-11-21')?.exactDateISO,
    '2026-11-20'
  );
});

test('runSmartSearch returns quick features when query is empty', () => {
  const dataset = makeSampleDataset();
  const all = buildAllSmartSearchItems(dataset);
  const res = runSmartSearch(all, '', { dataset });
  assert.ok(res.features.length >= 5);
  assert.equal(res.data.length, 0);
  assert.equal(res.dateReports.length, 0);
});

test('runSmartSearch surfaces current-month and other-month date reports and matching records for day queries like ১৯', () => {
  const dataset = makeSampleDataset();
  const all = buildAllSmartSearchItems(dataset);

  const day19 = runSmartSearch(all, '১৯ তারিখ', { dataset });
  assert.equal(day19.dateReports.length, 2);
  // Current month (Nov 19) comes first, other month (Oct 19) second
  assert.equal(day19.dateReports[0].focusDate, '2026-11-19');
  assert.equal(day19.dateReports[0].targetTab, 'attendance');
  assert.ok(day19.dateReports[0].metaBn.includes('উপস্থিত'));
  assert.ok(day19.dateReports[0].metaBn.includes('ওটি'));
  assert.equal(day19.dateReports[1].focusDate, '2026-10-19');
  assert.equal(day19.dateReports[1].targetMonth, '2026-10');

  // Matching individual records across both months are also included
  assert.ok(day19.data.some((d) => d.id === 'data-ot-ot-1'));
  assert.ok(day19.data.some((d) => d.id === 'data-ot-ot-prev'));
  assert.ok(day19.data.some((d) => d.id === 'data-att-att-19'));
});

test('runSmartSearch matches Bengali features, English keywords, and personal records across Bengali/English digits', () => {
  const dataset = makeSampleDataset();
  const all = buildAllSmartSearchItems(dataset);

  const calcRes = runSmartSearch(all, 'ক্যালকুলেটর', { dataset });
  assert.ok(calcRes.features.some((f) => f.targetSubView === 'calculator'));

  const rentRes = runSmartSearch(all, '৫৫০০', { dataset });
  assert.ok(rentRes.data.some((d) => d.id === 'data-exp-exp-1' && d.targetTab === 'expenses'));

  const loanRes = runSmartSearch(all, 'করিম', { dataset });
  assert.ok(
    loanRes.data.some((d) => d.id === 'data-loan-loan-1' && d.targetSubView === 'personal_loans')
  );

  const contactRes = runSmartSearch(all, '0171122', { dataset });
  assert.ok(
    contactRes.data.some((d) => d.id === 'data-contact-c-1' && d.targetSubView === 'contacts')
  );

  const attRes = runSmartSearch(all, 'জ্যাম', { dataset });
  const attHit = attRes.data.find((d) => d.id === 'data-att-att-1');
  assert.ok(attHit);
  assert.equal(attHit.focusDate, '2026-11-10');
  assert.equal(attHit.targetMonth, '2026-11');

  const noticeRes = runSmartSearch(all, 'ঈদের ছুটি', { dataset });
  assert.ok(noticeRes.data.some((d) => d.id === 'data-ann-ann-1' && d.targetSubView === 'announcements'));
});
