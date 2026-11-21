# Shromik Sathi — Audit Report
Site: https://gen-lang-client-0524311670.web.app/
Date checked: 20 November 2026
Scope: Public (login/signup) screens checked live in a browser + full frontend code/bundle inspection (Part 1), and inside (logged-in) screens checked with a test account (Part 2, below). Both parts are complete.

## App summary (from code + terms)
A rich garments-worker assistant in Bengali (with full English mode and dark mode):
salary & overtime calculation (OT = basic ÷ 208 × 2, which matches the standard formula), attendance calendar, leave / earned leave, payslip / job card / salary reports, increment, service benefit, maternity benefit, death compensation, expenses & budget, loans/debts, duty alarms with custom ringtones, calendar tasks/events/birthdays, contacts book with Google Contacts sync, Google backup, analytics charts (pie + 6-month trends), support tickets, announcements, and an admin panel (user directory, tickets, announcements).

## Bugs found

### Serious
1. **Google sign-in cancels → login form gets stuck.** Closing the Google sign-in tab without finishing leaves the login button stuck on "প্রবেশ করা হচ্ছে..." (Logging in...), disabled, with the Google button also disabled — no error, no cancel option. Only a full page reload recovers it.
2. **No "Forgot password" anywhere.** A worker who forgets their password has no visible recovery route on the login screen — for this user group that likely means a lost account and lost salary history.
3. **Very slow first load (~5 MB).** Logo image alone is 1.4 MB (1254×1254 px, preloaded on every visit), JavaScript totals ~3.3 MB (main 1.53 MB + Firebase 643 KB + charts 487 KB + analytics 390 KB + React 219 KB), CSS 190 KB. Target users are workers on low-cost phones and slow mobile data — many will give up before the login page appears.

### Medium
4. **Validation messages are in English in Bengali mode.** Submitting empty login/signup shows the browser's English "Please fill in this field." bubble. There are no in-page Bengali error messages — build custom validation messages in the selected language.
5. **Signup screen labels are wrong.** The divider still says "অথবা গুগল ছাড়া লগইন" (Or log in without Google) and the Google button still says "Continue with Google" — the signup screen never actually says "sign up".
6. **Google sign-in shows a raw Firebase domain.** The Google account chooser says "to continue to gen-lang-client-0524311670.firebaseapp.com" instead of "Shromik Sathi". Unfamiliar and unbranded — it can scare or confuse first-time users. Fix with a custom auth domain / branding.
7. **No public landing page.** A first-time visitor sees only a login form — no feature list, screenshots, About, Help or contact info. This hurts trust and signups. The desktop page is also mostly empty space around the card, which looks unfinished.
8. **Placeholder mismatch between languages.** Bengali identifier placeholder suggests username or mobile number ("rahim01 বা 017XXXXXXXXX"); English suggests username or email ("worker01 or email@example.com"). Users get different guidance depending on language.

### Small / technical
9. **Dev code shipped to production.** index.html contains a Vite HMR (dev-server) WebSocket mock script — remove it from the production build.
10. **PWA manifest inconsistencies.** Manifest says `"lang": "en"` while the app is primarily Bengali; the same 1254×1254 icon file is declared as 192×192 and 512×512, and as maskable without a maskable-safe version. Create properly resized icons (192/512, ~20–50 KB each, WebP/PNG).
11. **No real robots.txt / sitemap.xml.** Both return the SPA's index.html (hosting fallback), so search engines get HTML where they expect text/XML.
12. **Minor language inconsistencies.** English greeting is "Welcome Back" on login but "Welcome to Shromik Sathi" on signup; some English terms phrasing is awkward; the terms modal is long with no section links.
13. **No password rules shown.** No minimum-length or strength hint on signup — users can likely set very weak passwords (the test account uses a 6-digit one). Add a clear rule (e.g. minimum 8 characters) and show it before submission.

## Improvements (priority order)
1. Compress/resize the logo & icons and lazy-load the charts/analytics bundles (load them only when the user opens Analytics) — aim for under 1 MB total first load.
2. Fix the stuck Google sign-in state: reset the loading state when the popup/tab closes or auth returns no user, and show a Bengali message like "লগইন বাতিল হয়েছে, আবার চেষ্টা করুন".
3. Add Forgot Password (email / mobile OTP) — critical for this audience.
4. Add a simple public landing section above/around the login card: what the app does, 3–4 feature bullets, a screenshot, support contact.
5. Custom in-language validation and error messages everywhere (login, signup, all forms inside).
6. Custom domain + Firebase auth domain branding so Google sign-in shows the app's own name.
7. Remove the Vite dev script from production; add real robots.txt.
8. Add section links / accordion in the Terms modal.

## New feature ideas
1. **Payslip photo/PDF check:** worker uploads a photo of the factory payslip and the app compares it line-by-line with the app's own calculation and flags differences — this is the single most valuable trust feature for workers.
2. **Bangladesh Labour Act helper in plain Bengali:** a Q&A / guide section (overtime limits, weekly holiday, earned leave, maternity, resignation/service benefit, festival bonus) with the relevant rules in simple language.
3. **SMS / offline fallback:** monthly summary by SMS, and make sure core entry (attendance, OT) works fully offline and syncs later — factory areas often have poor network.
4. **Family / shared view:** optional read-only sharing of the monthly summary with a family member.
5. **bKash/Nagad salary record:** already partially present (payment method defaults to bKash) — extend it to keep a received-salary history with dates, so workers can prove payment delays.
6. **Voice input in Bengali** for expenses and notes — many users are faster speaking than typing.
7. **Factory-change / job-switch wizard:** when a worker changes factory, carry over service history and compute final settlement (service benefit, earned leave encashment) automatically.
8. **Reminder pack:** salary-day reminder, attendance-bonus risk warning ("আর ১ দিন অনুপস্থিত থাকলে হাজিরা বোনাস কাটা যাবে") — the data for this already exists in the app.

## What was verified as working well
- Language switch (Bengali ↔ English) is instant, no reload, and the Terms modal is fully translated.
- Dark mode contrast is good.
- Show/hide password toggle works.
- Terms modal "আমি একমত" correctly ticks the signup agreement checkbox.
- OT formula (basic ÷ 208 × 2) and the 12,500 BDT default gross (current minimum wage) are correct in code.
- Support email in terms: support@shromiksathi.org; terms effective date 16 November 2026.

## Pending — needs a logged-in session (completed in Part 2)
At the time Part 1 was written, the logged-in screens were still unchecked because the browser's credential service blocked the automated sign-in for the first test account (policy denial — not a fault of the app). This was later completed: a new test account ("test 10") was created and the full inside audit was done — see Part 2 below. Only the items listed under "Not tested" in Part 2 remain unchecked.

---

# Part 2 — Logged-in audit (test account "test 10", test10@gmail.com)
Completed 20 November 2026. Account created, setup wizard completed, every feature tested with neutral test data, logged out and back in — all test data persisted correctly.

## Works well
Signup (instant, no email verification), setup wizard step 2/3 data, daily quick calculation (Friday holiday handled correctly), voice entry typed fallback (parsed "বাজার ২০০ টাকা" correctly), overtime add (2 hrs × ৳61.22 = ৳122.44 correct), payslip layout (professional, with signature lines), CSV download, JSON backup download, expenses arithmetic (daily average and month-end projection correct), duty alarm save, contacts local save, support ticket create/list, service-benefit and maternity eligibility logic (correctly ৳0 for 0 years), logout/login persistence, mobile responsive layout with bottom nav, dark mode inside the app.

## Major bugs (inside)
1. **Four different daily salary rates for the same worker:** Home ৳400.00 (12,000÷30), Salary/payslip ৳293.90 (8,817÷30), maternity ৳400.03 (12,001÷30), death/leave calculators ৳385.03 (11,551÷30). Result: same month's earned salary is ৳2,122.44 on Home but ৳1,591.94 on the Salary page. This is the #1 fix.
2. **House rent saved as ৳0.** Profile, Salary and payslip all show house rent ৳0 (salary total ৳8,817 instead of ৳12,000), while calculators/factory pages show ৳3,184 and a total of ৳12,001 (৳1 rounding error over gross).
3. **Increment calculator missing** although the Terms promise "ইনক্রিমেন্ট হিসাব ও রিপোর্টিং" — searching calculators for ইনক্রিমেন্ট returns "কোনো ক্যালকুলেটর পাওয়া যায়নি।"
4. **Print/PDF froze the tab** for ~25 minutes in this browser after clicking "প্রিন্ট / পিডিএফ" on the payslip — no dialog, no response. Must be verified on a real phone; CSV and JSON worked.
5. **Wrong calculator defaults for new joiners:** annual-leave calculator defaults to 288 working days and 4 used days, showing a worker who joined today ৳4,620.36 leave money; death calculator defaults to 10 unused leave days. Defaults must come from the real joining date and attendance.
6. **Invented comparisons for new accounts:** Home "smart comparison" invents a previous month (৳8,817, -75.9%) and a "previous factory" comparison that is really a minimum-wage benchmark; "best performance month" shown for an account with 2 present days; month selector lists March/February/January twice (15 options, no years).
7. **Pre-joining dates accepted everywhere:** attendance marked present on 19 Nov (joining 20 Nov), plus expense (15 Nov), income (12 Nov) and salary-received (10 Nov) default dates — all before joining, all saved without warning. Block or warn on pre-joining dates.
8. **Date picker problem:** in this browser, picking a date did not fill the field (setup joining date, loan repayment date) — the joining date was actually saved correctly (20/11/2026), so it may be display-only here, but the loan entry could not be completed because of it. Verify on a real phone/desktop.
9. **Friday overtime paid at normal rate** from the Overtime page, while the Home daily calculator says regular OT does not apply on a holiday. Clarify/apply double rate for weekly-holiday work.

## Medium bugs (inside)
- Home pie percentages wrong (৳2,000 shown as 84% of ৳2,122.44); Salary page donut percentages are correct.
- Attendance bonus eligibility shows "প্রাপ্য (৳০)" even when the bonus was switched OFF in setup.
- Salary page contradicts itself: "১০০% প্রাপ্ত (আংশিক পরিশোধিত)" in one place, "২৬% প্রাপ্ত" with ৳0.34 due in another; deductions shown as negative amounts; present days shown as "২/০ দিন" while the calculation uses 5 days; 6-month average is really 1 month's average.
- Note/reminder timestamps say "২ ঘণ্টা আগে" (2 hours ago) for items created seconds earlier.
- Profile says "১ মাস কর্মরত" (1 month working) for a worker who joined today.
- Payslip auto-assigns Grade-4 although grade was blank and Profile shows "—".
- Loan form: repayment date is required but has no * mark; empty submit shows only the English browser bubble.
- Contacts: "save to Google too" is ticked by default and hijacks the save with a Google sign-in popup for email/password accounts — untick by default.
- Law helper ignores the numbers in the question: asked basic ৳6,700 × 40 OT hours, it answered with profile values and never gave the total. The correct total at the asked rate is ৳2,577 (6,700 ÷ 208 × 2 × 40 = ৳2,576.92). Corrected 21 Nov 2026: an earlier version of this line said ৳2,448.80 — that was the profile rate's figure (৳61.22 × 40), not the asked rate's.
- Sync indicators disagree: top bar "সিঙ্ক হচ্ছে (…বাকি)" while Profile says "সিঙ্ক সম্পূর্ণ / 100%".
- Expenses allow cash to go negative with no warning.
- Subscription table contradicts itself (Free "সীমাহীন ✓" in headings, Free ✕ in sub-features); VIP annual ৳1,500/year looks mispriced next to Pro ৳149/month.
- Change-password minimum is only 4 characters — too weak.
- English mode inside the app is partial — many strings stay Bengali.
- Setup: joining date marked * but not enforced; OT rate stored as 61.220001220703125; house-rent placeholder text garbled.
- Announcements section not found anywhere in the app, despite existing in the code/admin side.
- No leave-application screen — leave is only an attendance status.

## Not tested
Documents vault file upload (no test file), live microphone (browser permission — typed fallback worked), whether alarms actually ring, backup import, print output itself (button froze the tab), and each of the ~20 calculators individually (3 tested in depth + annual leave; they share one template).

## Priority fix list
1. Unify daily-rate base and house-rent saving everywhere (one source of truth for salary structure).
2. Add increment calculator + a real leave-application screen.
3. Derive calculator defaults from joining date/attendance; remove invented comparisons for new accounts.
4. Fix date picker, enforce required joining date, block pre-joining entries, mark required fields with *.
5. Fix Print/PDF; verify on a real Android phone.
6. Fix law helper to calculate with the numbers asked; fix "২ ঘণ্টা আগে" timestamps, "১ মাস কর্মরত", Home percentages, and the salary-page % contradictions.
7. Untick Google-save by default; dedupe month lists; fix subscription table/pricing; raise password minimum to 8; add announcements UI or remove the feature.
