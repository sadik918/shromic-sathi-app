# Shromik Sathi — Fix Plan & Checklist
Based on the full audit of 20 November 2026. Work top-down: P0 first (wrong money = lost trust), then P1, then P2.
Tick each box only after the "Verify" step passes on a real Android phone + desktop.

---

## P0 — Money hisab thik koro (shobcheye joruri)

### 1. Ekta matro salary source-of-truth banao
- [ ] Problem: Daily rate 4 jaygay 4 rokom — Home ৳400, Salary ৳293.90, maternity ৳400.03, death/leave ৳385.03. Ek e masher earned salary Home e ৳2,122.44, Salary page e ৳1,591.94.
- [ ] Fix: Ekta common function banao, jemon `getSalaryStructure(profile)` + `getDailyRate(profile)` — Home, Salary, payslip, shob calculator sudhu eta thekei number nibe. Kono page nije nije gross/basic theke alada hisab korbe na.
- [ ] Age decision nao: Daily rate er base ki hobe — gross ÷ 30, naki (basic + house rent) ÷ 30? Labour practice onujayi ekta thik kore shob jaygay setai use koro, ar app e ek line e likhe dao hisab ta kivabe hoy.
- [ ] Verify: Test account (gross ৳12,000) diye Home, Salary, payslip, maternity, leave — 5 jaygay daily rate ar earned salary ek e number dekhabe.

### 2. House rent save bug fix koro
- [ ] Problem: Setup e house rent ৳0 save hoyeche (total ৳8,817), kintu calculator e ৳3,184 (total ৳12,001 — gross er cheye ৳1 beshi, rounding error).
- [ ] Fix: Setup wizard step 1 e gross theke auto-split (basic 55% / house rent basic er 50% / medical 750 / transport 450 / food 1,250 — jeta rule) thik moto profile e save hocche kina check koro. Save er por Profile page thekei abar pore verify koro. Rounding: shob component jog kore gross er sathe milte hobe, ৳1 edik-odik hole shesh component (food allowance) theke adjust koro.
- [ ] Verify: Notun account khule gross ৳12,000 dile Profile + Salary + payslip — tin jaygay house rent ৳3,184 (ba tomar rule er number) ar total thik ৳12,000.

### 3. Print / PDF fix koro
- [ ] Problem: Payslip e "প্রিন্ট / পিডিএফ" click korle tab ~25 minute freeze hoye gechilo, kono dialog ashe ni.
- [ ] Fix: Print er jonno alada print-friendly view/window use koro (main app er state freeze kore emon kichu na). Boro table/chart print er somoy hide koro. `window.print()` er age ekta chhoto delay + loading state dao, jate user bujhe kaj hocche.
- [ ] Verify: Android phone er Chrome e payslip theke Print → PDF save kore dekho, file ta khule shob section asche kina check koro. Desktop eo ekbar.

### 4. Calculator der bhul default bondho koro
- [ ] Problem: Annual leave calculator default 288 working days + 4 used days dhore ajke join kora lok ke ৳4,620.36 dekhay. Death calculator eo default 10 unused days.
- [ ] Fix: Working days, used leave, service length — shob profile er joining date + attendance records theke calculate koro. Data na thakle field khali rakho ar user ke input dite bolo, banano default bosabe na.
- [ ] Verify: Ajke join kora notun account e annual leave calculator e pawna ৳0 (ba khub kom) dekhabe, ৳4,620 na.

---

## P1 — Missing feature + date/form somossa

### 5. Increment calculator add koro
- [ ] Terms e promise kora ache, app e nai. Calculator hub e "ইনক্রিমেন্ট হিসাব" add koro: current gross, increment % ba taka, notun gross/basic split, karjokor er tarikh.
- [ ] Verify: Calculator search e "ইনক্রিমেন্ট" likhle result ashe, ekta sample hisab hate-kolome miliye dekho.

### 6. Leave application screen banao
- [ ] Ekhon chuti sudhu attendance status. Alada "ছুটির আবেদন" list/screen banao: tarikh, dhoron (casual/sick/festival/earned), karon, status. Attendance er sathe link thakbe.
- [ ] Verify: Ekta chuti add kore attendance calendar eo seta dekhay kina.

### 7. Date picker + pre-joining date block
- [ ] Problem: Ei browser e date pick korle field e boshe ni (setup, loan form). Joining er ager date e hajira/khoroch/beton sob save hoye jay.
- [ ] Fix: Native `<input type="date">` ba reliable picker use koro; pick korlei field update hoy kina phone + desktop e test koro. Joining date er ager date attendance/expense/income/salary-received e dile warning dao: "যোগদানের আগের তারিখে এন্ট্রি করা যাবে না" — ar save block koro.
- [ ] Verify: 19 Nov (joining 20 Nov) hajira dite gele block/warning ashe. Loan form e date pick kore entry complete kora jay.

### 8. Required field thik moto bojha jay emon koro
- [ ] Problem: Loan form e repayment date required, kintu * nai; khali submit korle sudhu English browser bubble ashe. Setup eo joining date * thaka sotteo khali rekhe next step e jawa jay.
- [ ] Fix: Shob required field e * dao, wizard e required khali thakle next step block koro, ar nijer Bangla error message dao field er niche (browser bubble er upor nirbhor na).
- [ ] Verify: Bangla mode e khali form submit korle Bangla message ashe.

### 9. Banano tulona notun account e bondho koro
- [ ] Problem: Notun account eo "goto masher tulona", "ager karkhana" (asole minimum wage benchmark), "sera performance mash" dekhay.
- [ ] Fix: Agের masher data na thakle comparison section hide koro, poriborte lekho "তুলনা দেখতে কমপক্ষে ২ মাসের ডাটা লাগবে". Benchmark hole label dao "সরকারি ন্যূনতম বেতনের সাথে তুলনা".
- [ ] Verify: Notun account er Home e kono banano tulona nai.

### 10. Friday/holiday OT rule clear koro
- [ ] Problem: Home bolche chutir dine regular OT hoy na, kintu Overtime page Shukrobar e normal rate e OT diyeche.
- [ ] Fix: Weekly holiday te OT dile double rate apply koro ba ontoto ekta note dao "ছুটির দিনের কাজে ডাবল হার প্রযোজ্য" ar "বিশেষ ও ডাবল ওটি" calculator er dike pathao.
- [ ] Verify: Shukrobar e 2 ghonta OT dile hisab double rate e ashe (ba clear warning ashe).

---

## P2 — Chhoto bug + polish

### 11. Hisab/label er chhoto bhul gulo
- [ ] Note/reminder bananor sathe sathe "২ ঘণ্টা আগে" — timestamp hisab fix koro (timezone UTC vs BST kheyal koro).
- [ ] Ajke join korei "১ মাস কর্মরত" — hobe "১ দিন" / "০ মাস". Din hisab kore lekho.
- [ ] Home pie chart percentage thik koro (Salary page er donut thik ache, setar logic tai Home e nao).
- [ ] Salary page er "১০০% প্রাপ্ত (আংশিক পরিশোধিত)" vs "২৬% প্রাপ্ত" contradiction, negative deduction (-৳) dekhano, ar "২/০ দিন" present count fix koro.
- [ ] 6 masher average ashole joto masher data ache tar upor lekho, label thik koro.
- [ ] Payslip e grade blank thakle Grade-4 bosabe na — Profile er grade tai dekhabe, na thakle "—".
- [ ] Month selector theke duplicate March/February/January sorai, sathe year jog koro (November 2026 emon).

### 12. Form default + safety
- [ ] Contacts e "Google eo save koro" checkbox default OFF rakho.
- [ ] Khoroch e cash negative gele warning dao: "আপনার হাতে টাকা শেষের পথে".
- [ ] Expense/income/salary er default date ajker tarikh dao (10/12/15 tarikh er banano default na).
- [ ] Change password er minimum 4 theke barai 8 character koro, signup eo same rule + rule ta agei dekhiye dao.
- [ ] Profile edit er success banner form er kachei dekhayo (page er ekdom upore na).
- [ ] Sync indicator ek jaygay ek rokom rakho — top bar ar Profile jeno ek e kotha bole.

### 13. Law helper ke proshner number diye hisab koro
- [ ] Problem: "Basic 6,700 hole 40 ghonta OT koto?" — helper profile er number diye generic uttor dey, asol hisab (6,700 ÷ 208 × 2 × 40 = ৳2,577) dey na. Note: audit e bola ৳2,448.80 chilo profile rate er hisab; proshner number diye sothik hobe ৳2,577.
- [ ] Fix: Proshne taka/ghonta thakle sei number diye age hisab kore total ta uttore boro kore dao, tarpor niom ta bojhao.
- [ ] Verify: 3 ta sample proshno diye hate-hisab er sathe milao.

### 14. Subscription page thik koro
- [ ] Comparison table e Free ek jaygay "সীমাহীন ✓", sub-feature e "✕" — asol limit jeta setai shob jaygay.
- [ ] VIP annual ৳1,500/year (Pro monthly ৳149 er tulonay osavabik kom) — pricing ta icha kore emon kina confirm koro, bhul hole fix koro.

### 15. Baki polish
- [ ] Announcements section app er menu te add koro, na hole feature tar kotha plan theke bad dao.
- [ ] English mode e baki Bangla string gulo translate koro (success banner, install instruction shoho).
- [ ] Profile er Android "update" instruction ta ashole install niye kina clear kore Banglay lekho.
- [ ] Forgot Password add koro — login page e link, email/mobile diye reset. (Eta P1 e tulleo rakha jay — worker der jonno khub joruri.)
- [ ] Production theke Vite dev script sorai, manifest lang "bn" koro, sothik size er icon (192/512, chhoto file) banao, logo ta compress kore 1.4 MB theke 100 KB er niche nao, chart/analytics bundle lazy-load koro — prothom load 5 MB theke 1 MB er niche anar target nao.

---

## Suggested order (2 soptaher plan)
- **Din 1–3:** Item 1, 2 (salary source-of-truth + house rent) — bakigulo er upor dariye ache.
- **Din 4–5:** Item 3, 4 (print, calculator defaults).
- **So ptaho 2:** Item 5–10 (increment, leave, date, comparison, OT rule), tarpor somoy thakle P2 ek ek kore.
- Proti fix er por test account (test 10) diye regression check: Home vs Salary number mile kina — sudhu ei ekta check ei beshir bhag P0 dhora pore jabe.
