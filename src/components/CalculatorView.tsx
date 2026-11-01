import React, { useState } from 'react';
import {
  Calculator as CalcIcon,
  Check,
  Clock,
  Copy,
  Delete,
  Equal,
  FileSpreadsheet,
  Globe,
  History,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatBDT, formatNumber, toBengaliDigits } from '../utils/calculations';

type CalcMode = 'standard' | 'garments';

export const CalculatorView: React.FC = () => {
  const { profile, lang } = useData();

  const [mode, setMode] = useState<CalcMode>('standard');
  const [useBengaliDigits, setUseBengaliDigits] = useState(true);
  const [displayValue, setDisplayValue] = useState('0');
  const [formula, setFormula] = useState('');
  const [history, setHistory] = useState<Array<{ expr: string; result: string }>>([]);
  const [copied, setCopied] = useState(false);

  // Garment Quick Calculator State
  // 1. Overtime Tool
  const defaultOtRate = profile.basicSalary && profile.otDivisor
    ? Math.round(((profile.basicSalary / profile.otDivisor) * (profile.otMultiplier || 2)) * 100) / 100
    : 100;
  const [otHours, setOtHours] = useState('2');
  const [otMinutes, setOtMinutes] = useState('30');
  const [otRate, setOtRate] = useState(String(defaultOtRate));

  // 2. Daily Wage Tool
  const [wageBase, setWageBase] = useState(String(profile.basicSalary || 8000));
  const [monthWorkingDays, setMonthWorkingDays] = useState('26');
  const [absentDays, setAbsentDays] = useState('1');

  // 3. Festival Bonus Tool
  const [bonusSalary, setBonusSalary] = useState(String(profile.basicSalary || 8000));
  const [bonusPercent, setBonusPercent] = useState('50');

  // Convert digits for display
  const renderDisplay = (val: string) => {
    if (!useBengaliDigits) return val;
    return toBengaliDigits(val);
  };

  const handleDigit = (digit: string) => {
    setDisplayValue((prev) => {
      if (prev === '0' || prev === 'Error') {
        return digit;
      }
      if (prev.length >= 14) return prev; // max length
      return prev + digit;
    });
  };

  const handleDecimal = () => {
    setDisplayValue((prev) => {
      if (prev.includes('.')) return prev;
      return prev + '.';
    });
  };

  const handleOperator = (op: string) => {
    if (displayValue === 'Error') return;
    setFormula(`${displayValue} ${op} `);
    setDisplayValue('0');
  };

  const handleClear = () => {
    setDisplayValue('0');
    setFormula('');
  };

  const handleBackspace = () => {
    setDisplayValue((prev) => {
      if (prev === 'Error' || prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handlePercentage = () => {
    const num = parseFloat(displayValue);
    if (isNaN(num)) return;
    const res = String(num / 100);
    setDisplayValue(res);
  };

  const handleToggleSign = () => {
    const num = parseFloat(displayValue);
    if (isNaN(num) || num === 0) return;
    setDisplayValue(String(-num));
  };

  const handleEquals = () => {
    if (!formula) return;
    const parts = formula.trim().split(' ');
    if (parts.length < 2) return;

    const op1 = parseFloat(parts[0]);
    const op = parts[1];
    const op2 = parseFloat(displayValue);

    if (isNaN(op1) || isNaN(op2)) return;

    let res = 0;
    switch (op) {
      case '+':
        res = op1 + op2;
        break;
      case '-':
        res = op1 - op2;
        break;
      case '×':
      case '*':
        res = op1 * op2;
        break;
      case '÷':
      case '/':
        if (op2 === 0) {
          setDisplayValue('Error');
          setFormula('');
          return;
        }
        res = op1 / op2;
        break;
      default:
        return;
    }

    // Format clean float
    const resStr = String(Math.round(res * 10000) / 10000);
    const fullExpr = `${parts[0]} ${op} ${displayValue}`;

    setHistory((prev) => [{ expr: fullExpr, result: resStr }, ...prev.slice(0, 9)]);
    setFormula('');
    setDisplayValue(resStr);
  };

  const handleCopyResult = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Garment Calculations
  const calcOtTotal = () => {
    const h = parseFloat(otHours) || 0;
    const m = parseFloat(otMinutes) || 0;
    const r = parseFloat(otRate) || 0;
    const totalH = h + m / 60;
    return Math.round(totalH * r * 100) / 100;
  };

  const calcDailyWage = () => {
    const base = parseFloat(wageBase) || 0;
    const days = parseFloat(monthWorkingDays) || 26;
    if (days === 0) return 0;
    return Math.round((base / days) * 100) / 100;
  };

  const calcAbsentDeduction = () => {
    const daily = calcDailyWage();
    const absent = parseFloat(absentDays) || 0;
    return Math.round(daily * absent);
  };

  const calcFestivalBonus = () => {
    const base = parseFloat(bonusSalary) || 0;
    const pct = parseFloat(bonusPercent) || 50;
    return Math.round((base * pct) / 100);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
            <CalcIcon className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold">ক্যালকুলেটর</h2>
          </div>
        </div>

        {/* Bengali/English Digit Toggle */}
        <button
          type="button"
          data-testid="toggle-calc-digits-btn"
          onClick={() => setUseBengaliDigits((prev) => !prev)}
          className="min-h-[34px] px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-300" />
          <span>{useBengaliDigits ? 'সংখ্যা: বাংলা' : 'Digits: EN'}</span>
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          data-testid="calc-tab-standard"
          onClick={() => setMode('standard')}
          className={`min-h-[40px] py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mode === 'standard'
              ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <CalcIcon className="w-4 h-4" />
          <span>সাধারণ ক্যালকুলেটর</span>
        </button>

        <button
          type="button"
          data-testid="calc-tab-garments"
          onClick={() => setMode('garments')}
          className={`min-h-[40px] py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mode === 'garments'
              ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>গার্মেন্টস কুইক হিসাব</span>
        </button>
      </div>

      {/* 1. STANDARD CALCULATOR */}
      {mode === 'standard' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
          {/* Display Window */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 text-right">
            <div className="min-h-[20px] text-xs font-mono font-medium text-slate-400 dark:text-slate-500 overflow-x-auto [scrollbar-width:none]">
              {formula ? renderDisplay(formula) : ' '}
            </div>
            <div
              data-testid="calc-display"
              className="text-3xl sm:text-4xl font-mono font-black text-slate-900 dark:text-white tracking-tight overflow-x-auto [scrollbar-width:none] py-1"
            >
              {renderDisplay(displayValue)}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
              <span className="text-[11px] text-slate-400">
                {copied ? '✓ কপি করা হয়েছে!' : 'ফলাফল কপি করতে ট্যাপ করুন'}
              </span>
              <button
                type="button"
                data-testid="calc-copy-btn"
                onClick={() => handleCopyResult(displayValue)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>কপি</span>
              </button>
            </div>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
            {/* Row 1 */}
            <button
              type="button"
              data-testid="calc-key-clear"
              onClick={handleClear}
              className="min-h-[50px] rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-extrabold text-base transition-colors"
            >
              C
            </button>
            <button
              type="button"
              data-testid="calc-key-backspace"
              onClick={handleBackspace}
              className="min-h-[50px] rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center transition-colors"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              type="button"
              data-testid="calc-key-percent"
              onClick={handlePercentage}
              className="min-h-[50px] rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-base transition-colors"
            >
              %
            </button>
            <button
              type="button"
              data-testid="calc-key-divide"
              onClick={() => handleOperator('÷')}
              className="min-h-[50px] rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-lg transition-colors"
            >
              ÷
            </button>

            {/* Row 2 */}
            <button
              type="button"
              data-testid="calc-key-7"
              onClick={() => handleDigit('7')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('7')}
            </button>
            <button
              type="button"
              data-testid="calc-key-8"
              onClick={() => handleDigit('8')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('8')}
            </button>
            <button
              type="button"
              data-testid="calc-key-9"
              onClick={() => handleDigit('9')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('9')}
            </button>
            <button
              type="button"
              data-testid="calc-key-multiply"
              onClick={() => handleOperator('×')}
              className="min-h-[52px] rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-lg transition-colors"
            >
              ×
            </button>

            {/* Row 3 */}
            <button
              type="button"
              data-testid="calc-key-4"
              onClick={() => handleDigit('4')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('4')}
            </button>
            <button
              type="button"
              data-testid="calc-key-5"
              onClick={() => handleDigit('5')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('5')}
            </button>
            <button
              type="button"
              data-testid="calc-key-6"
              onClick={() => handleDigit('6')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('6')}
            </button>
            <button
              type="button"
              data-testid="calc-key-minus"
              onClick={() => handleOperator('-')}
              className="min-h-[52px] rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xl transition-colors"
            >
              -
            </button>

            {/* Row 4 */}
            <button
              type="button"
              data-testid="calc-key-1"
              onClick={() => handleDigit('1')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('1')}
            </button>
            <button
              type="button"
              data-testid="calc-key-2"
              onClick={() => handleDigit('2')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('2')}
            </button>
            <button
              type="button"
              data-testid="calc-key-3"
              onClick={() => handleDigit('3')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('3')}
            </button>
            <button
              type="button"
              data-testid="calc-key-plus"
              onClick={() => handleOperator('+')}
              className="min-h-[52px] rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xl transition-colors"
            >
              +
            </button>

            {/* Row 5 */}
            <button
              type="button"
              data-testid="calc-key-sign"
              onClick={handleToggleSign}
              className="min-h-[52px] rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm transition-colors"
            >
              ±
            </button>
            <button
              type="button"
              data-testid="calc-key-0"
              onClick={() => handleDigit('0')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg shadow-2xs transition-colors"
            >
              {renderDisplay('0')}
            </button>
            <button
              type="button"
              data-testid="calc-key-dot"
              onClick={handleDecimal}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-xl shadow-2xs transition-colors"
            >
              .
            </button>
            <button
              type="button"
              data-testid="calc-key-equals"
              onClick={handleEquals}
              className="min-h-[52px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-black text-2xl shadow-md transition-all"
            >
              =
            </button>
          </div>

          {/* History Tape */}
          {history.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  <span>পূর্ববর্তী হিসাবের হিস্টোরি</span>
                </span>
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-[11px] text-red-500 hover:underline"
                >
                  ক্লিয়ার করুন
                </button>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto [scrollbar-width:none]">
                {history.map((h, i) => (
                  <div
                    key={i}
                    onClick={() => setDisplayValue(h.result)}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer text-xs transition-colors"
                  >
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {renderDisplay(h.expr)} =
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {renderDisplay(h.result)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. GARMENT WORKER QUICK CALCULATOR */}
      {mode === 'garments' && (
        <div className="space-y-4">
          {/* Tool 1: Overtime Earnings */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ১. ওভারটাইম মোট টাকা হিসাব
                </h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold">
                আইনসম্মত ২ গুণ হার
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  মোট ঘণ্টা
                </label>
                <input
                  type="number"
                  min="0"
                  value={otHours}
                  onChange={(e) => setOtHours(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  অতিরিক্ত মিনিট
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="15"
                  value={otMinutes}
                  onChange={(e) => setOtMinutes(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  ঘণ্টা প্রতি রেট (৳)
                </label>
                <input
                  type="number"
                  value={otRate}
                  onChange={(e) => setOtRate(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Overtime Result Card */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold block">
                  মোট ওভারটাইম আয়:
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-900 dark:text-emerald-100">
                  {formatBDT(calcOtTotal(), lang)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyResult(String(calcOtTotal()))}
                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>কপি</span>
              </button>
            </div>
          </div>

          {/* Tool 2: Daily Wage & Absence Deduction */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                ২. দৈনিক হাজিরা বেতন ও অনুপস্থিতি কর্তন
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  মাসিক বেতন (৳)
                </label>
                <input
                  type="number"
                  value={wageBase}
                  onChange={(e) => setWageBase(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  মাসের দিন (২৬/৩০)
                </label>
                <select
                  value={monthWorkingDays}
                  onChange={(e) => setMonthWorkingDays(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                >
                  <option value="30">৩০ দিন (ক্যালেন্ডার মাস)</option>
                  <option value="26">২৬ দিন (কার্যদিবস)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  অনুপস্থিত দিন
                </label>
                <input
                  type="number"
                  min="0"
                  value={absentDays}
                  onChange={(e) => setAbsentDays(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  ১ দিনের মজুরি:
                </span>
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {formatBDT(calcDailyWage(), lang)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <span className="text-[11px] text-amber-700 dark:text-amber-300 block font-medium">
                  {toBengaliDigits(absentDays)} দিনের অনুপস্থিতি কর্তন:
                </span>
                <span className="text-base sm:text-lg font-black text-amber-900 dark:text-amber-100">
                  {formatBDT(calcAbsentDeduction(), lang)}
                </span>
              </div>
            </div>
          </div>

          {/* Tool 3: Festival/Eid Bonus */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                ৩. উৎসব ও ঈদ বোনাস হিসাব
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  মূল বেতন (Basic Salary)
                </label>
                <input
                  type="number"
                  value={bonusSalary}
                  onChange={(e) => setBonusSalary(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  বোনাস হার (%)
                </label>
                <div className="flex items-center gap-1.5">
                  {[50, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setBonusPercent(String(pct))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        bonusPercent === String(pct)
                          ? 'bg-purple-700 text-white border-purple-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold block">
                  প্রত্যাশিত উৎসব বোনাস ({toBengaliDigits(bonusPercent)}%):
                </span>
                <span className="text-xl sm:text-2xl font-black text-purple-900 dark:text-purple-100">
                  {formatBDT(calcFestivalBonus(), lang)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyResult(String(calcFestivalBonus()))}
                className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>কপি</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
