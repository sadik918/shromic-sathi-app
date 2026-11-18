import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExpenseRentTrend,
  buildFactoryComparisonAnalytics,
  buildHomeOverviewAnalytics,
  buildLoanPortfolioAnalytics,
  buildOvertimePieAnalytics,
  buildRecentActivityPieAnalytics,
  getTimeOfDayGreeting,
  resolveWorkerDisplayName,
} from './homeAnalytics';
import { getInitialDemoState } from './demoData';

describe('Home Overview Analytics Aggregation', () => {
  it('computes accurate attendance slices, attendance rate, and salary breakdown for populated month (2026-10 & 2026-11)', () => {
    const demo = getInitialDemoState();
    const res = buildHomeOverviewAnalytics({
      selectedMonth: '2026-10',
      lang: 'bn',
      profile: demo.profile,
      attendance: demo.attendance,
      overtime: demo.overtime,
      salaryRecords: demo.salaryRecords,
      payments: demo.payments,
      expenses: demo.expenses,
      savings: demo.savings,
      loans: demo.loans,
    });

    assert.equal(res.selectedMonth, '2026-10');
    assert.ok(res.kpis.totalTrackedDays > 0);
    assert.ok(res.kpis.presentDays > 0);
    assert.ok(res.kpis.absentDays > 0);
    assert.ok(res.kpis.attendanceRatePct > 0 && res.kpis.attendanceRatePct <= 100);

    // Attendance pie slices include present, absent, and holidays with subLabel breakdown
    assert.ok(res.attendanceSlices.some((s) => s.key === 'present'));
    assert.ok(res.attendanceSlices.some((s) => s.key === 'absent'));
    const holidaySlice = res.attendanceSlices.find((s) => s.key === 'holidays');
    assert.ok(holidaySlice && holidaySlice.subLabelBn?.includes('সাপ্তাহিক'));

    // Salary breakdown includes basic, house_rent, allowances, and overtime
    assert.ok(res.salarySlices.some((s) => s.key === 'basic' && s.value === 6700));
    assert.ok(res.salarySlices.some((s) => s.key === 'house_rent' && s.value === 3350));
    assert.ok(res.salarySlices.some((s) => s.key === 'overtime' && s.value > 0));

    // Expense breakdown is sorted descending by amount
    assert.ok(res.expenseCategorySlices.length >= 2);
    for (let i = 1; i < res.expenseCategorySlices.length; i++) {
      assert.ok(res.expenseCategorySlices[i - 1].value >= res.expenseCategorySlices[i].value);
    }

    // 6-month trend ends at selectedMonth
    assert.equal(res.monthlyTrend.length, 6);
    assert.equal(res.monthlyTrend[5].month, '2026-10');
    assert.equal(res.monthlyTrend[0].month, '2026-05');
    // Empty months without attendance, salary records, or payments must be 0
    assert.equal(res.monthlyTrend[0].earnedSalary, 0);
    assert.equal(res.monthlyTrend[1].earnedSalary, 0);
    // August & September have saved SalaryRecord entries
    assert.ok(res.monthlyTrend[3].earnedSalary >= 12000);
    assert.ok(res.monthlyTrend[4].earnedSalary >= 12000);

    // November 2026 is also richly populated for initial Home dashboard display
    const novRes = buildHomeOverviewAnalytics({
      selectedMonth: '2026-11',
      lang: 'bn',
      profile: demo.profile,
      attendance: demo.attendance,
      overtime: demo.overtime,
      salaryRecords: demo.salaryRecords,
      payments: demo.payments,
      expenses: demo.expenses,
      savings: demo.savings,
      loans: demo.loans,
    });
    assert.ok(novRes.kpis.totalTrackedDays >= 15);
    assert.ok(novRes.attendanceSlices.length >= 4);
    assert.ok(novRes.expenseCategorySlices.some((s) => s.key === 'rent' && s.value > 0));
  });

  it('handles empty future/new month gracefully and detects latest populated months', () => {
    const demo = getInitialDemoState();
    const res = buildHomeOverviewAnalytics({
      selectedMonth: '2026-12',
      lang: 'bn',
      profile: demo.profile,
      attendance: demo.attendance,
      overtime: demo.overtime,
      salaryRecords: demo.salaryRecords,
      payments: demo.payments,
      expenses: demo.expenses,
      savings: demo.savings,
      loans: demo.loans,
    });

    assert.equal(res.kpis.totalTrackedDays, 0);
    assert.equal(res.attendanceSlices.length, 0);
    assert.equal(res.expenseCategorySlices.length, 0);
    assert.ok(res.salarySlices.some((s) => s.key === 'basic' && s.value === 6700));
    assert.equal(res.latestPopulatedAttendanceMonth, '2026-11');
    assert.equal(res.latestPopulatedExpenseMonth, '2026-11');
  });

  it('computes 6-month expense and rent trend accurately', () => {
    const demo = getInitialDemoState();
    const trend = buildExpenseRentTrend({
      selectedMonth: '2026-11',
      lang: 'bn',
      expenses: demo.expenses,
      payments: demo.payments,
    });
    assert.equal(trend.length, 6);
    const nov = trend.find((p) => p.month === '2026-11');
    assert.ok(nov);
    assert.equal(nov.rentAndBills, 3600);
    assert.equal(nov.bazarFood, 2150);
    assert.equal(nov.totalIncome, 7500);
    assert.ok(nov.totalExpenses > 7000);
  });

  it('computes Factory Comparison analytics between previous and current factory', () => {
    const demo = getInitialDemoState();
    const fac = buildFactoryComparisonAnalytics({
      profile: demo.profile,
      workplaces: demo.workplaces,
      salaryRecords: demo.salaryRecords,
      payments: demo.payments,
      overtime: demo.overtime,
      attendance: demo.attendance,
      todayISO: '2026-11-15',
    });

    assert.equal(fac.hasPastFactory, true);
    assert.equal(fac.grossDeltaAmount, 2000); // 12500 - 10500
    assert.ok(fac.grossGrowthPct > 0);
    assert.ok(fac.salaryCompositionSlices.some((s) => s.key === 'basic'));
    assert.ok(fac.attendanceBalanceSlices.some((s) => s.key === 'curr_present'));
    assert.equal(fac.comparisonBars.length, 3);
  });

  it('computes Personal Loan portfolio pie slices and person comparison bars', () => {
    const demo = getInitialDemoState();
    const loanStats = buildLoanPortfolioAnalytics(demo.loans, '2026-11-15');

    assert.ok(loanStats.totalLentDue > 0);
    assert.ok(loanStats.totalBorrowedDue > 0);
    assert.ok(loanStats.portfolioPieSlices.some((s) => s.key === 'lent_due'));
    assert.ok(loanStats.portfolioPieSlices.some((s) => s.key === 'borrowed_due'));
    assert.ok(loanStats.personComparisonBars.length >= 4 && loanStats.personComparisonBars.length <= 6);
  });

  it('returns accurate Bengali greetings based on time of day without স্বাগতম', () => {
    const cases: Array<[number, string]> = [
      [7, 'আসসালামু আলাইকুম, শুভ সকাল'],
      [11, 'আসসালামু আলাইকুম, শুভ সকাল'],
      [12, 'আসসালামু আলাইকুম, শুভ দুপুর'],
      [14, 'আসসালামু আলাইকুম, শুভ দুপুর'],
      [15, 'আসসালামু আলাইকুম, শুভ বিকাল'],
      [17, 'আসসালামু আলাইকুম, শুভ বিকাল'],
      [18, 'আসসালামু আলাইকুম, শুভ সন্ধ্যা'],
      [20, 'আসসালামু আলাইকুম, শুভ সন্ধ্যা'],
      [22, 'আসসালামু আলাইকুম, শুভ রাত'],
      [2, 'আসসালামু আলাইকুম, শুভ রাত'],
    ];
    for (const [hour, expected] of cases) {
      const greeting = getTimeOfDayGreeting(hour, 'bn');
      assert.equal(greeting, expected);
      assert.equal(greeting.includes('স্বাগতম'), false);
    }
    assert.equal(getTimeOfDayGreeting(13, 'en'), 'Good Noon');
    assert.equal(getTimeOfDayGreeting(22, 'en'), 'Good Night');
  });

  it('resolves worker display name without letting generic placeholders hide Google or registered names', () => {
    assert.equal(
      resolveWorkerDisplayName({
        profileFullName: 'মোসাঃ নাসরিন আক্তার',
        authDisplayName: 'Google Name',
        email: 'demo@therate.gmail.com',
        lang: 'bn',
      }),
      'মোসাঃ নাসরিন আক্তার'
    );

    assert.equal(
      resolveWorkerDisplayName({
        profileFullName: 'শ্রমিক ব্যবহারকারী',
        authDisplayName: 'Sadikul Islam Google',
        localAccountName: 'সাদিকুল ইসলাম',
        email: 'sadikulislam45974@gmail.com',
        lang: 'bn',
      }),
      'Sadikul Islam Google'
    );

    assert.equal(
      resolveWorkerDisplayName({
        profileFullName: 'শ্রমিক ব্যবহারকারী',
        authDisplayName: '',
        localAccountName: 'রফিকুল ইসলাম',
        email: 'rafiq@example.com',
        lang: 'bn',
      }),
      'রফিকুল ইসলাম'
    );

    assert.equal(
      resolveWorkerDisplayName({
        profileFullName: 'শ্রমিক ব্যবহারকারী',
        authDisplayName: null,
        localAccountName: null,
        email: 'sadikulislam45974@gmail.com',
        lang: 'bn',
      }),
      'সাদিকুল ইসলাম'
    );

    assert.equal(
      resolveWorkerDisplayName({
        profileFullName: 'শ্রমিক ব্যবহারকারী',
        authDisplayName: null,
        localAccountName: null,
        email: 'kamal.hossain12@gmail.com',
        lang: 'bn',
      }),
      'Kamal Hossain'
    );

    assert.equal(
      resolveWorkerDisplayName({
        profileFullName: 'শ্রমিক',
        authDisplayName: 'আয়েশা মুক্তা',
        localAccountName: null,
        email: 'aishamukta000@gmail.com',
        lang: 'bn',
      }),
      'আয়েশা মুক্তা'
    );

    assert.equal(
      resolveWorkerDisplayName({
        profileFullName: 'aishamukta000',
        authDisplayName: 'Aisha Mukta',
        localAccountName: null,
        email: 'aishamukta000@gmail.com',
        lang: 'bn',
      }),
      'Aisha Mukta'
    );
  });

  it('computes Overtime Pie Analytics monthly and weekly distributions cleanly', () => {
    const demo = getInitialDemoState();
    const otPie = buildOvertimePieAnalytics({
      selectedMonth: '2026-11',
      lang: 'bn',
      overtime: demo.overtime,
    });

    // Monthly slices across populated demo months (2026-11 and 2026-10)
    assert.ok(otPie.monthlySlices.length >= 2);
    assert.equal(otPie.monthlySlices[0].key, '2026-11');
    assert.ok(otPie.sixMonthHours > 20);
    assert.ok(otPie.sixMonthEarnings > 1000);
    assert.ok(otPie.monthlySlices[0].subLabelBn?.includes('ঘণ্টা'));

    // Weekly slices inside 2026-11 (Days 1-7 and Days 8-14)
    assert.equal(otPie.weeklySlices.length, 2);
    assert.equal(otPie.weeklySlices[0].key, 'week_1');
    assert.equal(otPie.weeklySlices[1].key, 'week_2');
    assert.equal(otPie.selectedMonthHours, 12.5);
    assert.equal(otPie.selectedMonthDays, 5);
    assert.equal(otPie.latestPopulatedOtMonth, '2026-11');

    // Empty month handles weeklySlices=[] while preserving latestPopulatedOtMonth & 6-month window
    const emptyMonthOt = buildOvertimePieAnalytics({
      selectedMonth: '2026-12',
      lang: 'bn',
      overtime: demo.overtime,
    });
    assert.equal(emptyMonthOt.weeklySlices.length, 0);
    assert.equal(emptyMonthOt.selectedMonthHours, 0);
    assert.ok(emptyMonthOt.monthlySlices.length >= 2);
    assert.equal(emptyMonthOt.latestPopulatedOtMonth, '2026-11');
  });

  it('computes Recent Activity & Transactions pie chart breakdown with separate non-merged expense slices', () => {
    const demo = getInitialDemoState();
    const recentPie = buildRecentActivityPieAnalytics({
      selectedMonth: '2026-11',
      overtime: demo.overtime,
      payments: demo.payments,
      expenses: demo.expenses,
    });

    assert.equal(recentPie.selectedMonth, '2026-11');
    assert.ok(recentPie.totalTransactionsCount > 0);
    assert.ok(recentPie.paymentTotal > 0);
    assert.ok(recentPie.overtimeTotal > 0);
    assert.ok(recentPie.expenseTotal > 0);
    // In 2026-11 demo data: salary payment + overtime + 5 distinct expense categories (rent, food, family, transport, medical) = 7 separate slices
    assert.equal(recentPie.slices.length, 7);
    assert.equal(recentPie.expenseSlices.length, 5);
    const sliceKeys = recentPie.slices.map((s) => s.key);
    assert.ok(sliceKeys.includes('payment_salary'));
    assert.ok(sliceKeys.includes('overtime'));
    assert.ok(sliceKeys.includes('expense_rent'));
    assert.ok(sliceKeys.includes('expense_food'));
    assert.ok(sliceKeys.includes('expense_family'));
    assert.ok(sliceKeys.includes('expense_transport'));
    assert.ok(sliceKeys.includes('expense_medical'));

    const emptyPie = buildRecentActivityPieAnalytics({
      selectedMonth: '2026-12',
      overtime: demo.overtime,
      payments: demo.payments,
      expenses: demo.expenses,
    });
    assert.equal(emptyPie.slices.length, 0);
    assert.equal(emptyPie.expenseSlices.length, 0);
    assert.equal(emptyPie.totalTransactionsCount, 0);
    assert.equal(emptyPie.latestPopulatedActivityMonth, '2026-11');
  });
});

