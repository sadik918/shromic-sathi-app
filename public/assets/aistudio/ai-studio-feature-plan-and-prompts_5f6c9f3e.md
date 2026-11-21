# Shromik Sathi — Notun Feature Build Plan + Google AI Studio Prompts

Sadik er jonno, 20 November 2026 er full audit er upor vitti kore.
Kivabe use korba: **Ekbare ekta prompt diba.** Build sesh hole test 10 account diye test korba, tarpor porer prompt. Proti prompt er vitorei UI rules deya ache, tai UI clean + consistent thakbe. Prompt gulo English e lekha (AI Studio English prompt e bhalo kaj kore), kintu app er UI text Bangla/English duitai dite bola ache.

---

## MASTER PLAN — kon order e banaba

**Phase 0 (age, 1 din):** Backup + P0 fix
- App er ekta full backup nao (JSON export + AI Studio project er copy).
- Fix-plan checklist er P0 (salary source-of-truth, house rent) age thik koro — karon Increment, Settlement, Comparison shoho ordhek notun feature oi hisab er upor dariye ache. Bhul base er upor feature banale double kaj hobe.

**Phase 1 (promise kora missing feature — 4 ta):**
1. Increment Calculator
2. Leave Application Screen
3. Forgot Password
4. Announcements (user side)

**Phase 2 (trust feature — user dhore rakhe):**
5. Payslip Photo Compare
6. Hajira Bonus Risk Warning + Salary Day Reminder
7. Salary Received History (beton pawyar proman)

**Phase 3 (boro subidha):**
8. Job Change / Final Settlement Wizard
9. Family Sharing (read-only summary)
10. Savings / Eid Plan

**Phase 4 (polish + smart):**
11. Offline-first + Sync Indicator Fix
12. Labour Act Helper Improvement
13. Real Anonymous Comparison (shob seshe — data lagbe)

**Proti phase sesh e regression check:** Home vs Salary page er number mile kina, logout-login kore data thake kina, dark mode + English mode thik ache kina.

---

## UI REFERENCE — prottek prompt e ei style follow hobe

(Ei section ta jana thakle tumi nijeo bujhba prompt gulo ki bolche. Prompt er vitorei eta deya ache, alada kore dite hobe na.)

- **Theme:** Primary emerald/teal `#047857`, background slate-50 `#f8fafc`, white rounded-2xl cards, slate-900 text, slate-500 secondary text — existing app er motoi.
- **Font:** Bangla text e Hind Siliguri / Noto Sans Bengali, English e Inter. Number sob somoy clear, boro, tabular.
- **Language:** Default Bangla. Proti notun string er Bangla + English dui version — language toggle e jeno ordhek Bangla theke na jay.
- **Dark mode:** Proti notun screen e dark mode support (existing dark class pattern).
- **Layout:** Mobile-first. Bottom navigation (Home / OT / Hajira / More) change hobe na — notun feature More menu ba related page theke dhukbe. Desktop e existing sidebar layout.
- **Clean UI rules:** Ek screen e ekta primary green button. Card er baire clutter na. Empty state e Bangla text + chhoto icon. Loading state dekhate hobe. Toast message Banglay. Kono banano/demo data dekhano jabe na.
- **Data rules:** Shob hisab existing profile + salary structure theke asbe. Notun kore hardcode kora number na. Firestore + localStorage er existing pattern follow korbe, logout-login e data thakbe.

---

## PROMPT 0 — Prothome ekbar diba (context set korar jonno, er por 1 theke)

```
I am building on my existing app "Shromik Sathi" (শ্রমিক সাথী), a Bengali-first React PWA for Bangladeshi garment workers. It uses Firebase (Auth + Firestore), Tailwind CSS, and already has: salary & overtime calculation, attendance calendar, expenses, loans, alarms, contacts, analytics charts, support tickets, calculators hub, profile with salary structure (gross, basic, house rent, medical 750, transport 450, food 1250, OT rate = basic / 208 * 2).

Rules for EVERY change from now on:
1. Keep the existing UI style exactly: primary color #047857, background #f8fafc, white rounded-2xl cards, Hind Siliguri / Noto Sans Bengali font for Bengali, Inter for English, full dark-mode support, mobile bottom navigation (Home / OT / Hajira / More) unchanged.
2. Every new UI string must have BOTH a Bengali and an English version, controlled by the existing language toggle. Bengali is the default.
3. Every money calculation must come from the user's saved profile/salary structure through one shared helper — never hardcode salary numbers and never calculate the same thing differently on different screens.
4. Keep the UI clean: one primary green button per screen, no clutter, clear empty states in Bengali, toast confirmations in Bengali.
5. Do not break or redesign existing features. Add new features inside the existing navigation (More menu or the related existing page).
6. All dates must be validated: no entries before the user's joining date.
Confirm you understand these rules, then wait for my next instruction.
```

---

## PHASE 1 PROMPTS

## PROMPT 1 — Increment Calculator

```
Add an "ইনক্রিমেন্ট হিসাব" (Increment Calculator) to the existing Calculators hub of my Shromik Sathi app, following the rules I gave you (same UI style, Bengali + English strings, dark mode, calculations only from the saved salary profile).

Feature details:
- It must appear in the calculator search and in the "বেতন ও ওটি" filter category.
- Inputs (prefilled from the user's profile): current gross salary, current basic salary, joining date.
- The user enters: increment percentage (default 5, because the yearly increment for garment workers is calculated on the BASIC salary, minimum 5%), OR a fixed increment amount in taka — choosing one updates the other.
- Output, shown as a clean before/after comparison table:
  - New basic salary (old basic + increment)
  - New house rent (50% of new basic, using the same rule as the existing salary structure)
  - Medical 750, transport 450, food 1250 (unchanged, same as existing structure)
  - New gross salary total (must equal the sum of the components exactly — fix any 1-taka rounding difference in the food allowance)
  - New OT hourly rate (new basic / 208 * 2)
  - Monthly increase and yearly increase in taka
- Buttons: "কপি করুন" (copy result, same as other calculators) and "সংরক্ষণ করুন" (save to the existing Saved Calculations list).
- Also add a small note in Bengali: "বার্ষিক ইনক্রিমেন্ট মূল বেতনের উপর হিসাব হয়" with the effective date the user selects.
- Empty/invalid input must show a Bengali error message under the field, not a browser popup.
Test case you must match: basic 6,367 + 5% = new basic 6,685.35 → show 6,685, house rent 3,343 (50%), new gross = 6,685 + 3,343 + 750 + 450 + 1,250 = 12,478, new OT rate = 6,685 / 208 * 2 = 64.28.
```

## PROMPT 2 — Leave Application Screen

```
Add a "ছুটির আবেদন ও রেকর্ড" (Leave Application & Records) screen to my Shromik Sathi app, following the rules I gave you (same UI style, Bengali + English, dark mode, clean UI). Put the entry inside the Attendance (হাজিরা) page as a button/tab, do not change the bottom navigation.

Feature details:
- A worker can add a leave record with: leave type (Casual ছুটি 10 days/year, Sick অসুস্থতা 14 days/year, Festival উৎসব 11 days/year, Earned অর্জিত ছুটি — 1 day for every 18 days worked, Maternity মাতৃত্ব 16 weeks), from date, to date (total days auto-calculated), reason (optional note).
- Date validation: no date before the joining date; to-date cannot be before from-date. Show Bengali error messages under the fields.
- At the top, show a clean summary card for the current year per type: allowed days, taken days (from these records), remaining days. Earned leave must be calculated from the real joining date and attendance records, not a fixed default.
- When a leave is saved, the dates in the attendance calendar must automatically show the ছুটি status for those days.
- List of leave records with edit and delete, grouped by month. Status field the worker can set manually: পরিকল্পিত (planned) / গৃহীত (taken). Do NOT invent any factory approval system — this is the worker's personal record.
- If remaining days for a type becomes negative, show a soft warning in Bengali, but still allow saving.
```

## PROMPT 3 — Forgot Password

```
Add a "পাসওয়ার্ড ভুলে গেছেন?" (Forgot password?) link on the login screen of my Shromik Sathi app, under the login button, following the rules I gave you (same UI style, Bengali + English, dark mode).

Flow:
- Tapping it opens a clean screen/modal with one field: the account identifier (email, mobile number or username — the same identifier field style as login).
- If the account was created with an EMAIL: use Firebase Auth's sendPasswordResetEmail to send a reset email, then show a Bengali success message: "আপনার ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। ইনবক্স/স্প্যাম চেক করুন।" Do not reveal whether the email exists or not — show the same message either way.
- If the account was created with a MOBILE NUMBER or USERNAME only (no email in Firebase Auth): show a clear Bengali message explaining the reset must be done through support, with a button that opens the existing Support section with the topic pre-selected as account recovery. Do not build a fake OTP system.
- Add password rules everywhere a password is set (signup, change password): minimum 8 characters, and show the rule as helper text under the field BEFORE submission, with a Bengali error if it is too short.
- Keep the login form's other behaviour unchanged.
```

## PROMPT 4 — Announcements (User Side)

```
My Shromik Sathi app already has an admin side that publishes announcements to Firestore (collection: announcements) and the app already stores dismissed announcements locally (key: shromik_sathi_dismissed_announcements_v1), but users cannot see any announcements screen. Add the user side, following the rules I gave you (same UI style, Bengali + English, dark mode, clean UI).

Feature details:
- On the Home page, if there is an active (published, not archived) announcement the user has not dismissed, show ONE slim banner card at the top with the title and a short text, a "বিস্তারিত" button and a dismiss (×) button. Dismissing must save to the existing local dismissed list so it never shows again.
- Add a "নোটিশ / ঘোষণা" item in the More menu that opens a list of all active announcements, newest first, with date. Tapping one opens the full text in a modal.
- If there are no announcements, the More menu item still shows with a clean empty state: "কোনো নোটিশ নেই".
- Announcements must load from the existing Firestore announcements data — do not create a second, separate announcement system, and do not show any demo/placeholder announcements.
- If the device is offline, show the last loaded announcements from local cache.
```

---

## PHASE 2 PROMPTS

## PROMPT 5 — Payslip Photo Compare (shobcheye important notun feature)

```
Add a "পে-স্লিপ যাচাই" (Payslip Check) feature to my Shromik Sathi app, following the rules I gave you (same UI style, Bengali + English, dark mode, clean UI). Entry point: a button on the Salary (বেতন ও পে-স্লিপ) page.

Flow:
1. The user selects the month, then uploads or takes a photo of the factory payslip.
2. Extract these fields from the photo using OCR/vision: gross salary, basic, house rent, medical, transport, food, present days, absent days, OT hours, OT amount, attendance bonus, other allowances, deductions (advance, absent, other), and net payable. If a field cannot be read, leave it blank — never guess a value.
3. IMPORTANT: Before comparing, show an editable review screen "আগে সংখ্যাগুলো মিলিয়ে নিন" with all extracted values in input fields, so the user can correct any wrong reading. Comparison happens only after the user confirms.
4. Compare each confirmed payslip value with the app's own calculation for that same month (from the existing salary/attendance/overtime data — use the shared salary helper, do not recalculate differently here).
5. Result screen: a clean table, one row per item: বিষয় | পে-স্লিপে | অ্যাপের হিসাবে | পার্থক্য. Rows that match show a green ✓, rows that differ show the difference in red with + / − taka. At the top show the total net difference in big numbers, e.g. "পে-স্লিপে ৳৫৩০ কম এসেছে".
6. Buttons: save this check (month, photo optional in the existing Documents Vault, result table) to a history list, and share the result as an image/text through the phone share sheet.
7. Add a privacy note in Bengali: the photo is used only for this check.
Handle errors in Bengali: blurry photo, not a payslip, or no fields found must show a friendly message asking for a clearer photo, not a technical error.
```

## PROMPT 6 — Hajira Bonus Risk Warning + Salary Day Reminder

```
Add smart warnings to my Shromik Sathi app using data that already exists in the user's profile and attendance, following the rules I gave you (same UI style, Bengali + English, dark mode). Do not add new settings — use the existing profile settings: attendance bonus ON/OFF, bonus amount, how many late days cancel the bonus, missing-time settings, weekly holiday, and expected salary date.

Feature details:
- On the Home page, if the attendance bonus is ON, show a small warning card only when the worker is at risk this month. Examples of the logic:
  - If one more late day would cancel the bonus (late days used = allowed late days), show: "সাবধান: আর ১ দিন দেরি হলে এই মাসের হাজিরা বোনাস (৳XXX) কেটে যাবে।"
  - If the worker already lost the bonus this month, show a neutral info card: "এই মাসে হাজিরা বোনাস পাওয়া যাচ্ছে না (কারণ: X দিন দেরি)।"
  - If there is no risk, show nothing (keep Home clean).
- Salary reminder: 1 day before the expected salary date from profile settings, show a Home card: "আগামীকাল বেতন পাওয়ার কথা। বেতন পেলে 'বেতন পেয়েছি' দিয়ে রেকর্ড রাখুন।" with a button that opens the existing salary-received form.
- Both cards must be dismissible for that month, and must never show invented numbers — every number comes from the real profile/attendance data.
```

## PROMPT 7 — Salary Received History (বেতন পাওয়ার প্রমাণ)

```
Extend the existing salary-received feature of my Shromik Sathi app into a proper "বেতন পাওয়ার ইতিহাস" (Salary Received History), following the rules I gave you (same UI style, Bengali + English, dark mode).

Feature details:
- Every salary-received entry (already saved today with amount, method and date) must appear in a history list on the Salary page, month by month: month, amount received, method (বিকাশ / নগদ / ব্যাংক / ক্যাশ), date received, and how much of that month's payable salary it covers (percentage bar).
- For each month, compare the received date with the expected salary date from the profile settings and show: "সময়মতো পেয়েছেন" in green, or "X দিন দেরিতে পেয়েছেন" in orange if late. If salary for a past month was never recorded, show "রেকর্ড নেই" in grey — never invent data.
- A year summary card at the top: total received this year, number of months paid on time, number of months paid late, average delay days.
- Each entry can be edited or deleted (with a Bengali confirmation dialog).
- Add a "সারাংশ শেয়ার করুন" button that creates a clean text/image summary of the year's payment history that the worker can share or save as proof.
- Default dates in the salary-received form must be TODAY's date, never a fixed past date, and a received date before the joining date must show a Bengali warning.
```

---

## PHASE 3 PROMPTS

## PROMPT 8 — Job Change / Final Settlement Wizard

```
Add a "চাকরি শেষের হিসাব" (Final Settlement) wizard to my Shromik Sathi app, inside the existing Calculators hub, following the rules I gave you (same UI style, Bengali + English, dark mode). Reuse the EXISTING calculators (service benefit, earned leave money, notice pay, termination, retrenchment, resignation dues) — do not write new formulas; combine their results into one wizard.

Wizard steps:
1. Reason for leaving (select): স্বেচ্ছায় পদত্যাগ (resignation) / চাকরিচ্যুত (termination) / ছাঁটাই (retrenchment) / অবসর (retirement). Prefill from profile: joining date, gross, basic, salary structure.
2. Last working day (date, validated: not before joining date), and unused earned leave days (prefilled from the earned-leave calculation based on real attendance, editable).
3. Result: one clean summary, in the same visual style as the existing payslip modal, listing each item that applies for the selected reason: service benefit, earned leave encashment, notice pay or notice deduction, current month's earned salary and OT (from real attendance/overtime data), festival bonus if applicable, minus any advance/loan dues recorded in the app. Show a big total: "মোট আনুমানিক পাওনা".
4. A clear Bengali disclaimer: "এটি একটি আনুমানিক হিসাব। কারখানার নীতি অনুযায়ী কিছুটা পার্থক্য হতে পারে।"
5. Buttons: copy, save to Saved Calculations, and print/PDF in the same style as the payslip.
Eligibility rules must match the existing calculators exactly (for example service benefit not applicable under 5 years for resignation — show ৳0 with the same explanation the existing calculator gives).
```

## PROMPT 9 — Family Sharing (Read-only Monthly Summary)

```
Add a safe "পরিবারের সাথে শেয়ার" (Share with Family) feature to my Shromik Sathi app, following the rules I gave you (same UI style, Bengali + English, dark mode).

Do it in the safest simple way:
- From the Home/Salary monthly summary, a "শেয়ার করুন" button generates a clean summary CARD IMAGE (and a text version) containing ONLY: month, days present, OT hours, earned salary, salary received, total expenses, and savings — nothing else. No factory name, no ID number, no mobile number, no loan details.
- The image/text is shared through the phone's native share sheet (WhatsApp etc.) — the user chooses who receives it.
- Before generating, show a preview screen listing exactly what will be included, with checkboxes to remove any item (for example hide expenses).
- Do NOT create public links or give anyone live access to the account in this version.
- All labels in Bengali + English like the rest of the app, amounts in big clear numbers, the app name "শ্রমিক সাথী" small at the bottom of the card.
```

## PROMPT 10 — Savings / Eid Plan

```
Add a "সঞ্চয় লক্ষ্য" (Savings Goal) feature to my Shromik Sathi app, connected to the existing personal accounts (হিসাব) page, following the rules I gave you (same UI style, Bengali + English, dark mode, clean UI).

Feature details:
- The user creates a goal: name (e.g. "ঈদের খরচ", "বাড়ির জন্য", custom), target amount, target date (date picker, must be a future date).
- The app calculates: months remaining, and "প্রতি মাসে রাখতে হবে ৳X" = (target − already saved) / months remaining.
- Saved amount: the user can add savings entries manually, AND the goal can optionally count the positive monthly balance from the existing Hisab page (income − expenses) — ask the user with a simple toggle, default OFF.
- Progress shown as a clean progress bar with percentage and remaining amount, on the Hisab page and as a small card on Home (only if a goal is active).
- If the user falls behind (saved less than the monthly plan by the middle of the month), show one soft Bengali reminder card — no repeated nagging, dismissible.
- Multiple goals allowed, each editable/deletable with confirmation. All numbers must come from real entries — no demo data.
```

---

## PHASE 4 PROMPTS

## PROMPT 11 — Offline-first + Sync Indicator Fix

```
Improve the offline and sync behaviour of my Shromik Sathi app, following the rules I gave you. Two problems to fix:
1. The sync indicators disagree: the top bar sometimes says syncing with items pending while the Profile page says sync complete 100%. Make ONE single sync state used by both places — one shared sync status (complete / syncing with N pending / offline with N pending / error) shown identically everywhere.
2. Offline use: attendance, overtime, expense and note entries must save instantly to local storage while offline, appear in a visible pending queue count, and sync automatically to Firestore when the connection returns, in order, without duplicates. If a sync fails, keep the item in the queue and show a Bengali message "ইন্টারনেট পেলে আবার চেষ্টা করা হবে" — never lose an entry and never show a technical error.
Also add a slim offline banner when the device has no connection: "আপনি অফলাইনে আছেন — এন্ট্রি ফোনে সেভ হচ্ছে". The banner must disappear automatically when back online.
Do not change the data model or any existing feature's UI beyond the sync indicators and the banner.
```

## PROMPT 12 — Labour Act Helper Improvement

```
Improve the existing labour-law helper (Reminders & Law page) in my Shromik Sathi app, following the rules I gave you (Bengali + English, same UI style).

Current problem: when a worker asks a question WITH numbers, for example "আমার মূল বেতন ৬৭০০ টাকা হলে ৪০ ঘণ্টা ওভারটাইমে কত টাকা পাব?", the helper ignores the asked numbers, uses profile values and gives a generic answer without the total.

Fix it:
- Detect numbers in the question in BOTH English digits (6700, 40) and Bengali digits (৬৭০০, ৪০), and detect what they refer to (basic salary, gross, hours, days, years) from nearby words like বেসিক, মূল বেতন, ঘণ্টা, দিন, বছর.
- If the question contains the numbers needed for a known calculation (overtime, daily wage, absence deduction, earned leave, service benefit, maternity), FIRST show the calculation step by step with the ASKED numbers and the total in big bold text, THEN give the short law explanation with the section reference (like the existing answers do).
- Only use profile values for numbers the question did NOT provide, and clearly say which values came from the profile.
- If the question has no numbers, keep the current answer style.
Test case that must pass: "মূল বেতন ৬৭০০, ৪০ ঘণ্টা ওভারটাইম" → OT rate = 6,700 / 208 * 2 = 64.42, total = 64.42 * 40 = ৳2,577 (show the steps and this total).
Keep all helpline numbers and section references exactly as they are now.
```

## PROMPT 13 — Real Anonymous Comparison (shob seshe banaba)

```
Upgrade the "স্মার্ট তুলনা" (Smart Comparison) in my Shromik Sathi app to use REAL anonymous data instead of benchmarks, following the rules I gave you (Bengali + English, same UI, privacy first).

Rules:
- Compare the user only with the MEDIAN (middle value) of other workers with the same salary grade and same area, using anonymised aggregate data from Firestore. Never show any individual worker's data, name or factory.
- Show the comparison ONLY if there are at least 20 workers in that grade+area group. If there are fewer, hide the section completely and show nothing (do not fall back to invented or benchmark numbers).
- Items to compare: gross salary, OT hours per month, attendance bonus received. Show as simple bars: "আপনি" vs "একই গ্রেডের মাঝামাঝি শ্রমিক".
- Label it honestly in Bengali: "একই গ্রেড ও এলাকার শ্রমিকদের মাঝামাঝি হিসাবের সাথে তুলনা (কমপক্ষে ২০ জনের ডাটা)".
- Remove the current fake "previous factory" and invented "previous month" comparisons for accounts that have no previous month/factory data: for previous month, compare only when the user really has last month's records; otherwise hide it.
- The aggregation must run on aggregated counters/documents, not by downloading other users' records to the phone.
```

---

## Proti prompt deyar por check list (tumar jonno)

- [ ] Build error nai to?
- [ ] Test 10 account e login kore notun feature ta khule dekho
- [ ] Ekta entry diye save, logout, login — data ache kina
- [ ] Home ar Salary page er number age ja chilo tai ache kina (onno feature bhange ni to)
- [ ] English mode + dark mode ekbar toggle kore dekho
- [ ] Phone er chhoto screen e button/text kate jacche kina

**Mone rekho:** Phase 0 er P0 fix (salary hisab) na kore Phase 1 e jeo na. Ar Payslip Photo Compare (Prompt 5) deyar age Documents Vault kaj kore kina sure hoye nio, karon photo save oikhanei hobe.
