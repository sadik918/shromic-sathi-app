import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Baby,
  Banknote,
  Briefcase,
  Calculator as CalcIcon,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Delete,
  FileCheck2,
  Globe,
  HeartHandshake,
  HelpCircle,
  History,
  Printer,
  RotateCcw,
  Save,
  Scale,
  Search,
  Share2,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatBDT, toBengaliDigits } from '../utils/calculations';
import {
  buildWorkerPrefillInputs,
  calculateExactServiceDuration,
  deleteUserCalculationRecord,
  executeGarmentBenefitCalculation,
  EXPORT_DISCLAIMER_BN,
  INSUFFICIENT_INFO_MESSAGE_BN,
  loadAdminCalculatorConfig,
  loadUserCalculationHistory,
  resolveStatutoryWageBasis,
  saveUserCalculationRecord,
  type BenefitCalculatorId,
  type CalculatorCatalogMeta,
  type CalculatorCategoryGroup,
  type SavedBenefitCalculationRecord,
} from '../utils/garmentBenefitsEngine';
import { printElementSafely } from '../utils/printHelper';
import { calculateRMGIncrement } from '../utils/featureHelpers';
import { FinalSettlementWizardModal } from './FinalSettlementWizardModal';

type TopModuleTab = 'guided_benefits' | 'saved_history' | 'standard_keypad';
type CategoryFilter = 'all' | 'primary_six' | CalculatorCategoryGroup;

const GROUP_LABELS: Record<CategoryFilter, { bn: string; en: string }> = {
  all: { bn: 'সব হিসাব', en: 'All' },
  primary_six: { bn: 'প্রধান ৬টি', en: 'Primary 6' },
  separation_settlement: { bn: 'চূড়ান্ত ও অবসান', en: 'Settlement' },
  regular_wages: { bn: 'বেতন ও ওটি', en: 'Salary & OT' },
  leave_and_bonus: { bn: 'ছুটি ও বোনাস', en: 'Leave & Bonus' },
  primary_benefits: { bn: 'আইনগত সুবিধা', en: 'Benefits' },
};

const CLEAN_TITLES_BN: Partial<Record<BenefitCalculatorId, string>> = {
  final_settlement: 'চাকরি শেষে মোট পাওনা হিসাব',
  special_overtime: 'বিশেষ ও ডাবল ওভারটাইম হিসাব',
};

function getCleanTitle(calc: CalculatorCatalogMeta): string {
  return CLEAN_TITLES_BN[calc.id] || calc.titleBn;
}

function cleanDisplayText(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
}

function getCalculatorIcon(id: BenefitCalculatorId) {
  switch (id) {
    case 'annual_leave':
      return <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-400" />;
    case 'maternity_benefit':
      return <Baby className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 dark:text-pink-400" />;
    case 'service_benefit':
      return <Award className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700 dark:text-teal-400" />;
    case 'retrenchment_benefit':
      return <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-amber-700 dark:text-amber-400" />;
    case 'termination_benefit':
      return <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-700 dark:text-indigo-400" />;
    case 'death_compensation':
      return <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5 text-rose-700 dark:text-rose-400" />;
    case 'final_settlement':
      return <FileCheck2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-400" />;
    case 'overtime_calc':
    case 'special_overtime':
    case 'hourly_wage':
      return <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-400" />;
    case 'festival_bonus':
    case 'festival_holiday_wage':
    case 'holiday_work':
      return <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-700 dark:text-purple-400" />;
    default:
      return <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-400" />;
  }
}

export const CalculatorView: React.FC = () => {
  const { user, profile, attendance, todayISO, lang } = useData();
  const effectiveUserId = user?.uid || profile.userId || 'demo_worker';

  const [adminCalcConfig, setAdminCalcConfig] = useState(() => loadAdminCalculatorConfig());
  useEffect(() => {
    setAdminCalcConfig(loadAdminCalculatorConfig());
  }, []);

  const activeRuleVersion = useMemo(() => {
    return (
      adminCalcConfig.ruleVersions.find((r) => r.versionId === adminCalcConfig.activeRuleVersionId) ||
      adminCalcConfig.ruleVersions[0]
    );
  }, [adminCalcConfig]);

  const enabledCatalog = useMemo(() => {
    return adminCalcConfig.catalog.filter((c) => c.enabled);
  }, [adminCalcConfig.catalog]);

  const [topTab, setTopTab] = useState<TopModuleTab>('guided_benefits');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');

  const [activeCalculatorId, setActiveCalculatorId] = useState<BenefitCalculatorId | null>(null);
  const [showHelpDetails, setShowHelpDetails] = useState(false);
  const [showSettlementWizard, setShowSettlementWizard] = useState(false);

  const [inputs, setInputs] = useState<Record<string, string | number | boolean>>(() =>
    buildWorkerPrefillInputs(profile, todayISO, attendance)
  );
  const [isUsingProfilePrefill, setIsUsingProfilePrefill] = useState(true);

  useEffect(() => {
    if (isUsingProfilePrefill) {
      setInputs(buildWorkerPrefillInputs(profile, todayISO, attendance));
    }
  }, [profile, todayISO, attendance, isUsingProfilePrefill]);

  const [savedHistory, setSavedHistory] = useState<SavedBenefitCalculationRecord[]>(() =>
    loadUserCalculationHistory(effectiveUserId)
  );
  useEffect(() => {
    setSavedHistory(loadUserCalculationHistory(effectiveUserId));
  }, [effectiveUserId]);

  const [toastNotice, setToastNotice] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Standard Keypad Calculator State
  const [useBengaliDigits, setUseBengaliDigits] = useState(true);
  const [displayValue, setDisplayValue] = useState('0');
  const [formula, setFormula] = useState('');
  const [keypadHistory, setKeypadHistory] = useState<Array<{ expr: string; result: string }>>([]);
  const [copiedKeypad, setCopiedKeypad] = useState(false);

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(''), 3200);
  };

  const updateInput = (key: string, value: string | number | boolean) => {
    setIsUsingProfilePrefill(false);
    setInputs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetToProfilePrefill = () => {
    setInputs(buildWorkerPrefillInputs(profile, todayISO, attendance));
    setIsUsingProfilePrefill(true);
    showToast('প্রোফাইলের তথ্য পুনরায় লোড হয়েছে।');
  };

  const filteredCalculators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enabledCatalog.filter((item) => {
      if (selectedCategory === 'primary_six' && !item.isPrimarySix) return false;
      if (
        selectedCategory !== 'all' &&
        selectedCategory !== 'primary_six' &&
        item.group !== selectedCategory
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.titleBn.toLowerCase().includes(q) ||
        item.titleEn.toLowerCase().includes(q) ||
        item.legalSectionBn.toLowerCase().includes(q)
      );
    });
  }, [enabledCatalog, searchQuery, selectedCategory]);

  const activeCalculatorMeta: CalculatorCatalogMeta | undefined = useMemo(() => {
    if (!activeCalculatorId) return undefined;
    return (
      adminCalcConfig.catalog.find((c) => c.id === activeCalculatorId) ||
      enabledCatalog.find((c) => c.id === activeCalculatorId)
    );
  }, [activeCalculatorId, adminCalcConfig.catalog, enabledCatalog]);

  const calculationOutput = useMemo(() => {
    if (!activeCalculatorId) return null;
    return executeGarmentBenefitCalculation(activeCalculatorId, inputs, activeRuleVersion);
  }, [activeCalculatorId, inputs, activeRuleVersion]);

  const liveWagePreview = useMemo(() => {
    return resolveStatutoryWageBasis({
      basicSalary: Number(inputs.basicSalary) || 0,
      houseRentAllowance: Number(inputs.houseRentAllowance) || 0,
      medicalAllowance: Number(inputs.medicalAllowance) || 0,
      transportAllowance: Number(inputs.transportAllowance) || 0,
      foodAllowance: Number(inputs.foodAllowance) || 0,
    });
  }, [
    inputs.basicSalary,
    inputs.houseRentAllowance,
    inputs.medicalAllowance,
    inputs.transportAllowance,
    inputs.foodAllowance,
  ]);

  const liveDurationPreview = useMemo(() => {
    const endIso =
      activeCalculatorId === 'maternity_benefit'
        ? String(inputs.expectedDeliveryDate || inputs.calculationDate || todayISO)
        : String(inputs.calculationDate || todayISO);
    return calculateExactServiceDuration(String(inputs.joiningDate || ''), endIso);
  }, [activeCalculatorId, inputs.joiningDate, inputs.calculationDate, inputs.expectedDeliveryDate, todayISO]);

  const handleSaveCalculation = () => {
    if (!activeCalculatorId || !calculationOutput || !calculationOutput.isComplete) {
      showToast(INSUFFICIENT_INFO_MESSAGE_BN);
      return;
    }
    const record: SavedBenefitCalculationRecord = {
      id: `calc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: effectiveUserId,
      calculatorId: activeCalculatorId,
      calculatorTitleBn: calculationOutput.calculatorTitleBn,
      calculationDate: calculationOutput.calculationDate,
      createdAtISO: new Date().toISOString(),
      inputs: { ...inputs },
      output: calculationOutput,
    };
    const next = saveUserCalculationRecord(effectiveUserId, record);
    setSavedHistory(next);
    showToast('হিসাবটি সংরক্ষিত হয়েছে।');
  };

  const handleReopenSavedRecord = (rec: SavedBenefitCalculationRecord) => {
    setInputs({ ...rec.inputs });
    setIsUsingProfilePrefill(false);
    setActiveCalculatorId(rec.calculatorId);
    setTopTab('guided_benefits');
  };

  const handleDeleteSavedRecord = (recordId: string) => {
    const next = deleteUserCalculationRecord(effectiveUserId, recordId);
    setSavedHistory(next);
    showToast('সংরক্ষিত হিসাব মুছে ফেলা হয়েছে।');
  };

  const handleShareOrCopySummary = async () => {
    if (!calculationOutput) return;
    const lines = [
      `শ্রমিক সাথী — ${calculationOutput.calculatorTitleBn}`,
      `তারিখ: ${toBengaliDigits(calculationOutput.calculationDate)}`,
      `কর্মী: ${calculationOutput.workerName}${calculationOutput.factoryName ? `, ${calculationOutput.factoryName}` : ''}`,
      calculationOutput.serviceDuration?.valid
        ? `চাকরিকাল: ${calculationOutput.serviceDuration.formattedBn}`
        : '',
      `ফলাফল: ${calculationOutput.eligibilityStatusBn}`,
      `মোট প্রাপ্য: ৳ ${toBengaliDigits(calculationOutput.totalEstimatedPayableBDT)}`,
      `আইন: ${calculationOutput.legalInfo.sectionBn}`,
      EXPORT_DISCLAIMER_BN,
    ].filter(Boolean);

    const text = lines.join('\n');
    try {
      if (navigator.share) {
        await navigator.share({
          title: calculationOutput.calculatorTitleBn,
          text,
        });
        return;
      }
    } catch {
      // fallback to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
      showToast('হিসাব কপি করা হয়েছে।');
    } catch {
      showToast('কপি করা সম্ভব হয়নি।');
    }
  };

  const handlePrintResult = () => {
    printElementSafely({
      elementId: 'printable-calculator-result',
      title: calculationOutput?.calculatorTitleBn || 'শ্রমিক সাথী ক্যালকুলেটর',
    });
  };

  // Standard Keypad handlers
  const renderDisplay = (val: string) => (useBengaliDigits ? toBengaliDigits(val) : val);
  const handleDigit = (digit: string) => {
    setDisplayValue((prev) => {
      if (prev === '0' || prev === 'Error') return digit;
      if (prev.length >= 14) return prev;
      return prev + digit;
    });
  };
  const handleDecimal = () => {
    setDisplayValue((prev) => (prev.includes('.') ? prev : prev + '.'));
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
    setDisplayValue((prev) => (prev === 'Error' || prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };
  const handlePercentage = () => {
    const num = parseFloat(displayValue);
    if (Number.isNaN(num)) return;
    setDisplayValue(String(num / 100));
  };
  const handleToggleSign = () => {
    const num = parseFloat(displayValue);
    if (Number.isNaN(num) || num === 0) return;
    setDisplayValue(String(-num));
  };
  const handleEquals = () => {
    if (!formula) return;
    const parts = formula.trim().split(' ');
    if (parts.length < 2) return;
    const op1 = parseFloat(parts[0]);
    const op = parts[1];
    const op2 = parseFloat(displayValue);
    if (Number.isNaN(op1) || Number.isNaN(op2)) return;

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
    const resStr = String(Math.round(res * 10000) / 10000);
    const fullExpr = `${parts[0]} ${op} ${displayValue}`;
    setKeypadHistory((prev) => [{ expr: fullExpr, result: resStr }, ...prev.slice(0, 9)]);
    setFormula('');
    setDisplayValue(resStr);
  };
  const handleCopyKeypadResult = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKeypad(true);
    setTimeout(() => setCopiedKeypad(false), 2000);
  };

  const needsServiceDates =
    activeCalculatorId &&
    [
      'annual_leave',
      'maternity_benefit',
      'service_benefit',
      'retrenchment_benefit',
      'termination_benefit',
      'death_compensation',
      'final_settlement',
      'festival_bonus',
      'layoff_compensation',
      'discharge_benefit',
      'resignation_benefit',
    ].includes(activeCalculatorId);

  const labelClass =
    'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 whitespace-nowrap truncate';
  const inputClass =
    'w-full h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-900 transition-colors';

  return (
    <div data-testid="garment-benefits-calculator-module" className="w-full space-y-4">
      {/* Clean Minimal Header Bar — Single Line & Clutter-Free */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center shrink-0">
            <CalcIcon className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <h1
            data-testid="calculator-home-title"
            className="text-[15px] sm:text-lg font-extrabold text-slate-900 dark:text-white whitespace-nowrap"
          >
            বেতন ও সুবিধা ক্যালকুলেটর
          </h1>
        </div>

        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 items-center gap-1 whitespace-nowrap shrink-0">
          <Scale className="w-3.5 h-3.5 shrink-0" />
          <span>শ্রম আইন ২০০৬</span>
        </span>
      </div>

      {toastNotice && (
        <div
          role="status"
          data-testid="calculator-toast-notice"
          className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-900 dark:text-emerald-200 flex items-center gap-2 no-print"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{toastNotice}</span>
        </div>
      )}

      {/* Top Module Switcher Tabs — Single Line Text */}
      <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/90 dark:border-slate-700 no-print">
        <button
          type="button"
          data-testid="calc-top-tab-guided"
          onClick={() => setTopTab('guided_benefits')}
          className={`min-h-[40px] px-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            topTab === 'guided_benefits'
              ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Scale className="w-3.5 h-3.5 shrink-0" />
          <span>সুবিধা হিসাব</span>
        </button>

        <button
          type="button"
          data-testid="calc-top-tab-history"
          onClick={() => setTopTab('saved_history')}
          className={`min-h-[40px] px-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            topTab === 'saved_history'
              ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          <span>সংরক্ষিত</span>
        </button>

        <button
          type="button"
          data-testid="calc-top-tab-standard"
          onClick={() => setTopTab('standard_keypad')}
          className={`min-h-[40px] px-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
            topTab === 'standard_keypad'
              ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <CalcIcon className="w-3.5 h-3.5 shrink-0" />
          <span>সাধারণ হিসাব</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CLEAN CALCULATOR HOME DIRECTORY */}
      {/* ===================================================================== */}
      {topTab === 'guided_benefits' && !activeCalculatorId && (
        <div data-testid="calculator-directory-home" className="space-y-4">
          {/* Search & Category Chips */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                data-testid="calculator-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="হিসাবের নাম খুঁজুন..."
                className="w-full min-h-[42px] pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  'all',
                  'primary_six',
                  'separation_settlement',
                  'regular_wages',
                  'leave_and_bonus',
                ] as CategoryFilter[]
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  data-testid={`calc-filter-${cat}`}
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {GROUP_LABELS[cat].bn}
                </button>
              ))}
            </div>
          </div>

          {/* Highlighted Combined Final Settlement Card — Clean & Single Line */}
          {(selectedCategory === 'all' || selectedCategory === 'separation_settlement') &&
            !searchQuery.trim() && (
              <button
                type="button"
                data-testid="featured-final-settlement-card"
                onClick={() => setShowSettlementWizard(true)}
                className="w-full text-left bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <span className="text-sm sm:text-base font-extrabold text-emerald-950 dark:text-emerald-100 truncate">
                    {lang === 'bn' ? 'চাকরি শেষের হিসাব' : 'Final Settlement Wizard'}
                  </span>
                </div>
                <span className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                  <span>{lang === 'bn' ? 'শুরু করুন' : 'Start'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>
            )}

          {/* Primary 6 Calculators Grid — Clean Icon + Single Title */}
          {filteredCalculators.some((c) => c.isPrimarySix) && (
            <section className="space-y-2.5">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 px-1 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>প্রধান সুবিধা ক্যালকুলেটর</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredCalculators
                  .filter((c) => c.isPrimarySix)
                  .map((calc) => (
                    <button
                      key={calc.id}
                      type="button"
                      data-testid={`calc-card-${calc.id}`}
                      onClick={() => {
                        setActiveCalculatorId(calc.id);
                        setShowHelpDetails(false);
                      }}
                      className="text-left bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-600 rounded-2xl p-3.5 transition-all flex items-center justify-between gap-2.5 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/80 flex items-center justify-center shrink-0">
                          {getCalculatorIcon(calc.id)}
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 truncate">
                          {getCleanTitle(calc)}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                    </button>
                  ))}
              </div>
            </section>
          )}

          {/* Other Salary, Overtime, Leave & Separation Calculators — Clean Icon + Title */}
          {filteredCalculators.some((c) => !c.isPrimarySix) && (
            <section className="space-y-2.5">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 px-1 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>অন্যান্য বেতন ও ছুটি হিসাব</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredCalculators
                  .filter((c) => !c.isPrimarySix)
                  .map((calc) => (
                    <button
                      key={calc.id}
                      type="button"
                      data-testid={`calc-card-${calc.id}`}
                      onClick={() => {
                        setActiveCalculatorId(calc.id);
                        setShowHelpDetails(false);
                      }}
                      className="text-left bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-600 rounded-2xl p-3.5 transition-all flex items-center justify-between gap-2.5 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shrink-0">
                          {getCalculatorIcon(calc.id)}
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 truncate">
                          {getCleanTitle(calc)}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                    </button>
                  ))}
              </div>
            </section>
          )}

          {filteredCalculators.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2.5">
              <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                কোনো ক্যালকুলেটর পাওয়া যায়নি।
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                সব হিসাব দেখুন
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ACTIVE CALCULATOR WORKSPACE — CLEAN SINGLE-LINE ALIGNED INPUTS */}
      {/* ===================================================================== */}
      {topTab === 'guided_benefits' && activeCalculatorId && activeCalculatorMeta && (
        <div data-testid="active-calculator-workspace" className="space-y-4">
          {/* Compact Top Navigation Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 no-print">
            <button
              type="button"
              data-testid="back-to-calc-directory-btn"
              onClick={() => setActiveCalculatorId(null)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>সব তালিকা</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span
                data-testid="profile-prefill-indicator"
                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-1 truncate"
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {isUsingProfilePrefill ? 'প্রোফাইল থেকে পূরণকৃত' : 'কাস্টম তথ্য'}
                </span>
              </span>

              <button
                type="button"
                data-testid="reset-prefill-btn"
                onClick={handleResetToProfilePrefill}
                title="প্রোফাইল তথ্য রিসেট করুন"
                className="min-h-[34px] px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">রিসেট</span>
              </button>
            </div>
          </div>

          {/* Clean Active Calculator Title Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3 no-print">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center shrink-0">
                  {getCalculatorIcon(activeCalculatorMeta.id)}
                </div>
                <h2
                  data-testid="active-calculator-heading"
                  className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate"
                >
                  {getCleanTitle(activeCalculatorMeta)}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowHelpDetails((prev) => !prev)}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>{showHelpDetails ? 'বন্ধ করুন' : 'আইনি নিয়ম'}</span>
              </button>
            </div>

            {showHelpDetails && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 space-y-1 leading-relaxed">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">
                  {activeCalculatorMeta.legalSectionBn}
                </p>
                <p>{activeCalculatorMeta.helpTextBn}</p>
              </div>
            )}
          </div>

          {/* CLEAN ALIGNED INPUT FORM */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5 no-print">
            {/* Step 1: Identity & Dates */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                  ১. কর্মীর তথ্য ও সময়কাল
                </h3>
                {needsServiceDates && (
                  <span
                    data-testid="live-service-duration-badge"
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap ${
                      liveDurationPreview.valid
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {liveDurationPreview.formattedBn}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className={labelClass}>কর্মীর নাম</label>
                  <input
                    type="text"
                    value={String(inputs.workerName || '')}
                    onChange={(e) => updateInput('workerName', e.target.value)}
                    className={`${inputClass} font-semibold`}
                  />
                </div>
                <div>
                  <label className={labelClass}>কারখানার নাম</label>
                  <input
                    type="text"
                    value={String(inputs.factoryName || '')}
                    onChange={(e) => updateInput('factoryName', e.target.value)}
                    placeholder="কারখানার নাম"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>চাকরির ধরন</label>
                  <select
                    value={String(inputs.employmentType || 'permanent')}
                    onChange={(e) => updateInput('employmentType', e.target.value)}
                    className={`${inputClass} font-semibold`}
                  >
                    <option value="permanent">স্থায়ী</option>
                    <option value="probation">শিক্ষানবিশ</option>
                    <option value="contractual">অস্থায়ী ও চুক্তিভিত্তিক</option>
                    <option value="piece_rate">পিস রেট</option>
                    <option value="helper">হেল্পার ও অপারেটর</option>
                  </select>
                </div>
              </div>

              {needsServiceDates && (
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className={labelClass}>যোগদানের তারিখ</label>
                    <input
                      type="date"
                      data-testid="calc-input-joining-date"
                      value={String(inputs.joiningDate || '')}
                      onChange={(e) => updateInput('joiningDate', e.target.value)}
                      className={`${inputClass} font-mono font-semibold text-xs sm:text-sm`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      {activeCalculatorId === 'maternity_benefit' ? 'প্রসবের তারিখ' : 'হিসাবের তারিখ'}
                    </label>
                    <input
                      type="date"
                      data-testid="calc-input-end-date"
                      value={String(
                        activeCalculatorId === 'maternity_benefit'
                          ? inputs.expectedDeliveryDate || inputs.calculationDate || ''
                          : inputs.calculationDate || ''
                      )}
                      onChange={(e) => {
                        if (activeCalculatorId === 'maternity_benefit') {
                          updateInput('expectedDeliveryDate', e.target.value);
                        }
                        updateInput('calculationDate', e.target.value);
                      }}
                      className={`${inputClass} font-mono font-semibold text-xs sm:text-sm`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Salary & Allowances */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                  ২. বেতন ও ভাতা
                </h3>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs font-bold whitespace-nowrap">
                  মোট বেতন: ৳ {toBengaliDigits(liveWagePreview.grossSalary)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 items-end">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelClass}>মূল বেতন</label>
                  <input
                    type="number"
                    min="0"
                    data-testid="calc-input-basic-salary"
                    value={String(inputs.basicSalary ?? 0)}
                    onChange={(e) => updateInput('basicSalary', Number(e.target.value))}
                    className={`${inputClass} border-emerald-400 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30 font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className={labelClass}>বাড়ি ভাড়া</label>
                  <input
                    type="number"
                    min="0"
                    value={String(inputs.houseRentAllowance ?? 0)}
                    onChange={(e) => updateInput('houseRentAllowance', Number(e.target.value))}
                    className={`${inputClass} font-mono font-semibold`}
                  />
                </div>
                <div>
                  <label className={labelClass}>চিকিৎসা ভাতা</label>
                  <input
                    type="number"
                    min="0"
                    value={String(inputs.medicalAllowance ?? 0)}
                    onChange={(e) => updateInput('medicalAllowance', Number(e.target.value))}
                    className={`${inputClass} font-mono font-semibold`}
                  />
                </div>
                <div>
                  <label className={labelClass}>যাতায়াত ভাতা</label>
                  <input
                    type="number"
                    min="0"
                    value={String(inputs.transportAllowance ?? 0)}
                    onChange={(e) => updateInput('transportAllowance', Number(e.target.value))}
                    className={`${inputClass} font-mono font-semibold`}
                  />
                </div>
                <div>
                  <label className={labelClass}>খাদ্য ভাতা</label>
                  <input
                    type="number"
                    min="0"
                    value={String(inputs.foodAllowance ?? 0)}
                    onChange={(e) => updateInput('foodAllowance', Number(e.target.value))}
                    className={`${inputClass} font-mono font-semibold`}
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Calculator-Specific Inputs — Strictly 1-Line Labels & Uniform Alignment */}
            <div className="space-y-3">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap truncate">
                ৩. অতিরিক্ত তথ্য
              </h3>

              {activeCalculatorId === 'increment_calc' && (() => {
                const incBasic = Number(inputs.basicSalary) || 0;
                const incMed = Number(inputs.medicalAllowance ?? 750);
                const incTrans = Number(inputs.transportAllowance ?? 450);
                const incFood = Number(inputs.foodAllowance ?? 1250);
                const incHouse = Number(inputs.houseRentAllowance ?? Math.round(incBasic * 0.5));
                const incGross = incBasic + incHouse + incMed + incTrans + incFood;
                const incMode = String(inputs.incrementMode || 'percent') === 'amount' ? 'amount' : 'percent';
                const incPreview = calculateRMGIncrement({
                  currentBasic: incBasic,
                  currentGross: incGross,
                  medicalAllowance: incMed,
                  transportAllowance: incTrans,
                  foodAllowance: incFood,
                  mode: incMode,
                  incrementPercent: Number(inputs.incrementPercent) || 0,
                  incrementAmountBDT: Number(inputs.incrementAmountBDT) || 0,
                });

                return (
                  <div data-testid="increment-calc-inputs" className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className={labelClass}>
                          {lang === 'bn' ? 'ইনক্রিমেন্ট হার (%)' : 'Increment (%)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          data-testid="increment-percent-input"
                          value={
                            incMode === 'percent'
                              ? String(inputs.incrementPercent ?? 5)
                              : String(incPreview.effectivePercent)
                          }
                          onChange={(e) => {
                            const pct = Math.max(0, Number(e.target.value) || 0);
                            const nextCalc = calculateRMGIncrement({
                              currentBasic: incBasic,
                              currentGross: incGross,
                              medicalAllowance: incMed,
                              transportAllowance: incTrans,
                              foodAllowance: incFood,
                              mode: 'percent',
                              incrementPercent: pct,
                              incrementAmountBDT: 0,
                            });
                            setIsUsingProfilePrefill(false);
                            setInputs((prev) => ({
                              ...prev,
                              incrementMode: 'percent',
                              incrementPercent: pct,
                              incrementAmountBDT: nextCalc.monthlyGrossIncrease,
                            }));
                          }}
                          className={`${inputClass} font-mono font-bold tabular-nums`}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          {lang === 'bn' ? 'নির্দিষ্ট বৃদ্ধি (৳)' : 'Fixed Increase (৳)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          data-testid="increment-amount-input"
                          value={
                            incMode === 'amount'
                              ? String(inputs.incrementAmountBDT ?? 0)
                              : String(incPreview.monthlyGrossIncrease)
                          }
                          onChange={(e) => {
                            const amt = Math.max(0, Number(e.target.value) || 0);
                            const nextCalc = calculateRMGIncrement({
                              currentBasic: incBasic,
                              currentGross: incGross,
                              medicalAllowance: incMed,
                              transportAllowance: incTrans,
                              foodAllowance: incFood,
                              mode: 'amount',
                              incrementPercent: 0,
                              incrementAmountBDT: amt,
                            });
                            setIsUsingProfilePrefill(false);
                            setInputs((prev) => ({
                              ...prev,
                              incrementMode: 'amount',
                              incrementAmountBDT: amt,
                              incrementPercent: nextCalc.effectivePercent,
                            }));
                          }}
                          className={`${inputClass} font-mono font-bold tabular-nums`}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          {lang === 'bn' ? 'কার্যকর তারিখ' : 'Effective Date'}
                        </label>
                        <input
                          type="date"
                          value={String(inputs.incrementEffectiveDate || todayISO)}
                          onChange={(e) => updateInput('incrementEffectiveDate', e.target.value)}
                          className={`${inputClass} font-mono font-semibold text-xs sm:text-sm`}
                        />
                      </div>
                    </div>

                    {incBasic <= 0 && (
                      <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        {lang === 'bn'
                          ? 'ইনক্রিমেন্ট হিসাব করতে বর্তমান মূল বেতন দিন।'
                          : 'Enter your current basic salary to calculate increment.'}
                      </p>
                    )}

                    {/* Clean Before / After Comparison Table */}
                    {incBasic > 0 && (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                              <th className="text-left py-2 px-3 font-bold">
                                {lang === 'bn' ? 'বিবরণ' : 'Component'}
                              </th>
                              <th className="text-right py-2 px-3 font-bold">
                                {lang === 'bn' ? 'আগে' : 'Before'}
                              </th>
                              <th className="text-right py-2 px-3 font-bold">
                                {lang === 'bn' ? 'পরে' : 'After'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                {lang === 'bn' ? 'মূল বেতন' : 'Basic'}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                                {formatBDT(incPreview.oldBasic, lang)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                                {formatBDT(incPreview.newBasic, lang)}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                {lang === 'bn' ? 'বাড়ি ভাড়া (৫০%)' : 'House Rent (50%)'}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                                {formatBDT(incPreview.oldHouseRent, lang)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                                {formatBDT(incPreview.newHouseRent, lang)}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                {lang === 'bn' ? 'চিকিৎসা + যাতায়াত + খাদ্য' : 'Fixed Allowances'}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                                {formatBDT(incPreview.oldMedical + incPreview.oldTransport + incPreview.oldFood, lang)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                                {formatBDT(incPreview.newMedical + incPreview.newTransport + incPreview.newFood, lang)}
                              </td>
                            </tr>
                            <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 font-extrabold">
                              <td className="py-2.5 px-3 text-emerald-900 dark:text-emerald-200">
                                {lang === 'bn' ? 'মোট বেতন (Gross)' : 'Gross Salary'}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                {formatBDT(incPreview.oldGross, lang)}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-emerald-800 dark:text-emerald-300">
                                {formatBDT(incPreview.newGross, lang)}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                {lang === 'bn' ? 'ওটি রেট / ঘণ্টা' : 'OT Rate / hr'}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                                {formatBDT(incPreview.oldOtRate, lang, true)}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                                {formatBDT(incPreview.newOtRate, lang, true)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn'
                        ? `বার্ষিক ইনক্রিমেন্ট মূল বেতনের উপর হিসাব হয় · কার্যকর: ${String(inputs.incrementEffectiveDate || todayISO)}`
                        : `Annual increment is calculated on basic salary · Effective: ${String(inputs.incrementEffectiveDate || todayISO)}`}
                    </p>
                  </div>
                );
              })()}

              {activeCalculatorId === 'annual_leave' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className={labelClass}>মোট কর্মদিবস</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.totalDaysWorkedInPeriod ?? 0)}
                      onChange={(e) => updateInput('totalDaysWorkedInPeriod', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>অর্জিত ছুটি</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.manualLeaveEarned ?? 0)}
                      onChange={(e) => updateInput('manualLeaveEarned', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ভোগকৃত ছুটি</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.leaveUsedDays ?? 4)}
                      onChange={(e) => updateInput('leaveUsedDays', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>মজুরির ভিত্তি</label>
                    <select
                      value={String(inputs.leaveWageBasisMode || 'statutory_sec119')}
                      onChange={(e) => updateInput('leaveWageBasisMode', e.target.value)}
                      className={`${inputClass} font-semibold`}
                    >
                      <option value="statutory_sec119">ধারা ১১৯ মজুরি</option>
                      <option value="gross_30">মোট বেতন ভিত্তি</option>
                      <option value="basic_30">মূল বেতন ভিত্তি</option>
                    </select>
                  </div>
                </div>
              )}

              {activeCalculatorId === 'maternity_benefit' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className={labelClass}>জীবিত সন্তান সংখ্যা</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      data-testid="calc-input-living-children"
                      value={String(inputs.livingChildrenCount ?? 1)}
                      onChange={(e) => updateInput('livingChildrenCount', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>৩ মাসের মোট মজুরি</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.priorThreeMonthsTotalWages ?? 0)}
                      onChange={(e) => updateInput('priorThreeMonthsTotalWages', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>৩ মাসের কর্মদিবস</label>
                    <input
                      type="number"
                      min="1"
                      max="92"
                      value={String(inputs.priorThreeMonthsDaysWorked ?? 78)}
                      onChange={(e) => updateInput('priorThreeMonthsDaysWorked', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                  <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(inputs.noticeGivenToEmployer)}
                      onChange={(e) => updateInput('noticeGivenToEmployer', e.target.checked)}
                      className="w-4 h-4 accent-emerald-700 shrink-0"
                    />
                    <span className="truncate">নোটিশ দেওয়া হয়েছে</span>
                  </label>
                </div>
              )}

              {activeCalculatorId === 'service_benefit' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <label className="flex items-center gap-2.5 min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(inputs.hasGratuityPolicy)}
                      onChange={(e) => updateInput('hasGratuityPolicy', e.target.checked)}
                      className="w-4 h-4 accent-emerald-700 shrink-0"
                    />
                    <span className="truncate">কারখানায় গ্র্যাচুইটি নীতি চালু আছে</span>
                  </label>
                  <div>
                    <label className={labelClass}>গৃহীত অগ্রিম বা কর্তন</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.alreadyPaidAdvanceBDT ?? 0)}
                      onChange={(e) => updateInput('alreadyPaidAdvanceBDT', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                </div>
              )}

              {activeCalculatorId === 'retrenchment_benefit' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(inputs.noticeProvidedByEmployer)}
                      onChange={(e) => updateInput('noticeProvidedByEmployer', e.target.checked)}
                      className="w-4 h-4 accent-emerald-700 shrink-0"
                    />
                    <span className="truncate">নোটিশ দেওয়া হয়েছে</span>
                  </label>

                  <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(inputs.hasGratuityPolicy)}
                      onChange={(e) => updateInput('hasGratuityPolicy', e.target.checked)}
                      className="w-4 h-4 accent-emerald-700 shrink-0"
                    />
                    <span className="truncate">গ্র্যাচুইটি তুলনা</span>
                  </label>

                  <div>
                    <label className={labelClass}>অব্যবহৃত ছুটি</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.unusedAnnualLeaveDays ?? 10)}
                      onChange={(e) => updateInput('unusedAnnualLeaveDays', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>অন্যান্য বকেয়া</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.otherLawfulDuesBDT ?? 0)}
                      onChange={(e) => updateInput('otherLawfulDuesBDT', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                </div>
              )}

              {activeCalculatorId === 'termination_benefit' && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>অবসানের ধরন</label>
                    <select
                      data-testid="calc-select-termination-category"
                      value={String(inputs.terminationCategory || 'employer_section_26_permanent')}
                      onChange={(e) => updateInput('terminationCategory', e.target.value)}
                      className={`${inputClass} font-semibold`}
                    >
                      <option value="employer_section_26_permanent">
                        মালিক কর্তৃক স্থায়ী শ্রমিকের টার্মিনেশন
                      </option>
                      <option value="employer_section_26_temporary">
                        মালিক কর্তৃক অস্থায়ী শ্রমিকের টার্মিনেশন
                      </option>
                      <option value="discharge_incapacity_sec_22">
                        শারীরিক ও মানসিক অক্ষমতাজনিত ডিসচার্জ
                      </option>
                      <option value="misconduct_dismissal_sec_23">
                        অসদাচরণের কারণে বরখাস্ত
                      </option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(inputs.noticeProvidedByEmployer)}
                      onChange={(e) => updateInput('noticeProvidedByEmployer', e.target.checked)}
                      className="w-4 h-4 accent-emerald-700 shrink-0"
                    />
                    <span className="truncate">নোটিশ প্রদান হয়েছে</span>
                  </label>

                  <div>
                    <label className={labelClass}>অব্যবহৃত ছুটি</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.unusedAnnualLeaveDays ?? 10)}
                      onChange={(e) => updateInput('unusedAnnualLeaveDays', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                </div>
              )}

              {activeCalculatorId === 'death_compensation' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(inputs.deathDuringEmployment)}
                      onChange={(e) => updateInput('deathDuringEmployment', e.target.checked)}
                      className="w-4 h-4 accent-emerald-700 shrink-0"
                    />
                    <span className="truncate">চাকরিরত অবস্থায় মৃত্যু</span>
                  </label>

                  <label className="flex items-center gap-2 min-h-[42px] px-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 text-xs font-bold text-rose-900 dark:text-rose-200 cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="calc-checkbox-workplace-accident"
                      checked={Boolean(inputs.deathByWorkplaceAccident)}
                      onChange={(e) => updateInput('deathByWorkplaceAccident', e.target.checked)}
                      className="w-4 h-4 accent-rose-600 shrink-0"
                    />
                    <span className="truncate">কর্মক্ষেত্রে দুর্ঘটনায় মৃত্যু</span>
                  </label>

                  <div>
                    <label className={labelClass}>অব্যবহৃত ছুটি</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.unusedAnnualLeaveDays ?? 10)}
                      onChange={(e) => updateInput('unusedAnnualLeaveDays', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>নমিনির সম্পর্ক</label>
                    <input
                      type="text"
                      value={String(inputs.nomineeRelation || '')}
                      onChange={(e) => updateInput('nomineeRelation', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {activeCalculatorId === 'final_settlement' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelClass}>অবসানের কারণ</label>
                    <select
                      data-testid="calc-select-final-separation-mode"
                      value={String(inputs.separationModeForFinalSettlement || 'resignation')}
                      onChange={(e) => updateInput('separationModeForFinalSettlement', e.target.value)}
                      className={`${inputClass} font-semibold`}
                    >
                      <option value="resignation">স্বেচ্ছায় পদত্যাগ</option>
                      <option value="retrenchment">কারখানা ছাঁটাই</option>
                      <option value="termination_sec26">মালিক কর্তৃক অবসান</option>
                      <option value="discharge_sec22">অক্ষমতাজনিত ডিসচার্জ</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>বকেয়া বেতন দিন</label>
                    <input
                      type="number"
                      min="0"
                      max="31"
                      value={String(inputs.unpaidSalaryDays ?? 0)}
                      onChange={(e) => updateInput('unpaidSalaryDays', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>বকেয়া ওভারটাইম ঘণ্টা</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.unpaidOvertimeHours ?? 0)}
                      onChange={(e) => updateInput('unpaidOvertimeHours', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>অব্যবহৃত ছুটি</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.unusedAnnualLeaveDays ?? 10)}
                      onChange={(e) => updateInput('unusedAnnualLeaveDays', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>অন্যান্য পাওনা</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.otherLawfulDuesBDT ?? 0)}
                      onChange={(e) => updateInput('otherLawfulDuesBDT', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>অগ্রিম কর্তন</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.lawfulAdvanceDeductionBDT ?? 0)}
                      onChange={(e) => updateInput('lawfulAdvanceDeductionBDT', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                </div>
              )}

              {(activeCalculatorId === 'monthly_salary' ||
                activeCalculatorId === 'overtime_calc' ||
                activeCalculatorId === 'special_overtime' ||
                activeCalculatorId === 'absence_deduction') && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  {(activeCalculatorId === 'monthly_salary' ||
                    activeCalculatorId === 'overtime_calc' ||
                    activeCalculatorId === 'special_overtime') && (
                    <div>
                      <label className={labelClass}>ওভারটাইম ঘণ্টা</label>
                      <input
                        type="number"
                        min="0"
                        value={String(inputs.overtimeHours ?? 45)}
                        onChange={(e) => updateInput('overtimeHours', Number(e.target.value))}
                        className={`${inputClass} font-mono font-bold`}
                      />
                    </div>
                  )}

                  {(activeCalculatorId === 'overtime_calc' ||
                    activeCalculatorId === 'special_overtime') && (
                    <div>
                      <label className={labelClass}>অতিরিক্ত মিনিট</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={String(inputs.overtimeMinutes ?? 0)}
                        onChange={(e) => updateInput('overtimeMinutes', Number(e.target.value))}
                        className={`${inputClass} font-mono font-bold`}
                      />
                    </div>
                  )}

                  {activeCalculatorId === 'special_overtime' && (
                    <>
                      <div>
                        <label className={labelClass}>নাইট ডিউটির দিন</label>
                        <input
                          type="number"
                          min="0"
                          value={String(inputs.specialNightDays ?? 10)}
                          onChange={(e) => updateInput('specialNightDays', Number(e.target.value))}
                          className={`${inputClass} font-mono font-bold`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>দৈনিক বিশেষ ভাতা</label>
                        <input
                          type="number"
                          min="0"
                          value={String(inputs.specialNightAllowancePerDay ?? 100)}
                          onChange={(e) =>
                            updateInput('specialNightAllowancePerDay', Number(e.target.value))
                          }
                          className={`${inputClass} font-mono font-bold`}
                        />
                      </div>
                    </>
                  )}

                  {(activeCalculatorId === 'monthly_salary' ||
                    activeCalculatorId === 'absence_deduction') && (
                    <div>
                      <label className={labelClass}>অনুপস্থিত দিন</label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={String(inputs.absentDays ?? 2)}
                        onChange={(e) => updateInput('absentDays', Number(e.target.value))}
                        className={`${inputClass} font-mono font-bold`}
                      />
                    </div>
                  )}

                  {activeCalculatorId === 'monthly_salary' && (
                    <>
                      <div>
                        <label className={labelClass}>হাজিরা বোনাস</label>
                        <input
                          type="number"
                          min="0"
                          value={String(inputs.attendanceBonus ?? 700)}
                          onChange={(e) => updateInput('attendanceBonus', Number(e.target.value))}
                          className={`${inputClass} font-mono font-bold`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>অগ্রিম কর্তন</label>
                        <input
                          type="number"
                          min="0"
                          value={String(inputs.lawfulAdvanceDeductionBDT ?? 0)}
                          onChange={(e) =>
                            updateInput('lawfulAdvanceDeductionBDT', Number(e.target.value))
                          }
                          className={`${inputClass} font-mono font-bold`}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {(activeCalculatorId === 'holiday_work' ||
                activeCalculatorId === 'festival_holiday_wage') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className={labelClass}>ছুটির দিনে কাজের দিন</label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={String(inputs.holidayWorkDays ?? 2)}
                      onChange={(e) => updateInput('holidayWorkDays', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                </div>
              )}

              {activeCalculatorId === 'festival_bonus' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className={labelClass}>উৎসব বোনাস হার</label>
                    <select
                      value={String(inputs.festivalBonusPct ?? 100)}
                      onChange={(e) => updateInput('festivalBonusPct', Number(e.target.value))}
                      className={`${inputClass} font-semibold`}
                    >
                      <option value={100}>১০০% — পূর্ণ মূল বেতন</option>
                      <option value={75}>৭৫% — আনুপাতিক</option>
                      <option value={50}>৫০% — অর্ধেক মূল বেতন</option>
                    </select>
                  </div>
                </div>
              )}

              {activeCalculatorId === 'notice_pay' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className={labelClass}>নোটিশের মেয়াদ</label>
                    <select
                      value={String(inputs.noticeDaysServedOrGiven ?? 120)}
                      onChange={(e) => updateInput('noticeDaysServedOrGiven', Number(e.target.value))}
                      className={`${inputClass} font-semibold`}
                    >
                      <option value={120}>১২০ দিন — স্থায়ী অবসান</option>
                      <option value={60}>৬০ দিন — স্থায়ী পদত্যাগ</option>
                      <option value={30}>৩০ দিন — ছাঁটাই ও অস্থায়ী</option>
                      <option value={14}>১৪ দিন — পিস-রেট</option>
                    </select>
                  </div>
                </div>
              )}

              {activeCalculatorId === 'layoff_compensation' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className={labelClass}>মোট লে-অফ দিন</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={String(inputs.layoffDaysTotal ?? 30)}
                      onChange={(e) => updateInput('layoffDaysTotal', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                </div>
              )}

              {(activeCalculatorId === 'discharge_benefit' ||
                activeCalculatorId === 'resignation_benefit') && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className={labelClass}>অব্যবহৃত ছুটি</label>
                    <input
                      type="number"
                      min="0"
                      value={String(inputs.unusedAnnualLeaveDays ?? 10)}
                      onChange={(e) => updateInput('unusedAnnualLeaveDays', Number(e.target.value))}
                      className={`${inputClass} font-mono font-bold`}
                    />
                  </div>
                  {activeCalculatorId === 'resignation_benefit' && (
                    <div>
                      <label className={labelClass}>নোটিশ প্রদানের দিন</label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={String(inputs.noticeDaysServedOrGiven ?? 60)}
                        onChange={(e) =>
                          updateInput('noticeDaysServedOrGiven', Number(e.target.value))
                        }
                        className={`${inputClass} font-mono font-bold`}
                      />
                    </div>
                  )}
                  <label className="col-span-2 sm:col-span-1 flex items-center gap-2 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(inputs.hasGratuityPolicy)}
                      onChange={(e) => updateInput('hasGratuityPolicy', e.target.checked)}
                      className="w-4 h-4 accent-emerald-700 shrink-0"
                    />
                    <span className="truncate">গ্র্যাচুইটি তুলনা</span>
                  </label>
                </div>
              )}

              {(activeCalculatorId === 'daily_wage' || activeCalculatorId === 'hourly_wage') && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  উপরের মূল বেতন ও ভাতার তথ্যের ভিত্তিতে দৈনিক ও ঘণ্টাপ্রতি মজুরি স্বয়ংক্রিয়ভাবে হিসাব হয়েছে।
                </p>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/* CLEAN RESULTS SCREEN */}
          {/* ================================================================= */}
          {calculationOutput && !calculationOutput.isComplete && (
            <div
              role="alert"
              data-testid="calculation-incomplete-safeguard"
              className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
              <p className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100">
                {calculationOutput.incompleteMessageBn || INSUFFICIENT_INFO_MESSAGE_BN}
              </p>
            </div>
          )}

          {calculationOutput && calculationOutput.isComplete && (
            <div
              id="printable-calculator-result"
              data-testid="calculation-results-card"
              className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl overflow-hidden shadow-2xs space-y-4 p-4 sm:p-5"
            >
              {/* Summary Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1 min-w-0">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                      calculationOutput.isEligible
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {cleanDisplayText(calculationOutput.eligibilityStatusBn)}
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                    {getCleanTitle(activeCalculatorMeta)}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                    {calculationOutput.workerName}
                    {calculationOutput.serviceDuration?.valid
                      ? ` · ${calculationOutput.serviceDuration.formattedBn}`
                      : ''}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-left sm:text-right shrink-0">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block whitespace-nowrap">
                    মোট প্রাক্কলিত প্রাপ্য
                  </span>
                  <span
                    data-testid="result-total-payable-bdt"
                    className="text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100 font-mono tabular-nums whitespace-nowrap"
                  >
                    {formatBDT(calculationOutput.totalEstimatedPayableBDT, lang)}
                  </span>
                </div>
              </div>

              {/* Summary Metric Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {calculationOutput.summaryHighlights.map((hl, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800"
                  >
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {cleanDisplayText(hl.labelBn)}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block truncate">
                      {cleanDisplayText(hl.valueBn)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                  হিসাবের বিস্তারিত বিভাজন
                </h4>

                <div className="border border-slate-200/90 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {calculationOutput.breakdownItems.map((item, i) => (
                    <div
                      key={i}
                      className={`p-3 flex items-center justify-between gap-3 text-xs ${
                        item.isExcluded
                          ? 'bg-slate-50/70 dark:bg-slate-800/30 text-slate-500'
                          : item.isDeduction
                          ? 'bg-rose-50/40 dark:bg-rose-950/20'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p
                          className={`font-bold ${
                            item.isDeduction
                              ? 'text-rose-800 dark:text-rose-300'
                              : item.isExcluded
                              ? 'text-slate-600 dark:text-slate-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {cleanDisplayText(item.labelBn)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {item.formulaBn}
                        </p>
                      </div>

                      <div className="text-right font-mono font-extrabold text-sm whitespace-nowrap shrink-0">
                        {item.isExcluded ? (
                          <span className="text-xs font-semibold text-slate-400">৳ ০</span>
                        ) : item.isDeduction ? (
                          <span className="text-rose-700 dark:text-rose-400">
                            - {formatBDT(item.amountBDT, lang)}
                          </span>
                        ) : (
                          <span className="text-slate-900 dark:text-white">
                            {formatBDT(item.amountBDT, lang)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/50 flex items-center justify-between text-xs sm:text-sm font-extrabold text-emerald-950 dark:text-emerald-100">
                    <span>সর্বমোট নিট প্রাপ্য</span>
                    <span className="font-mono text-base sm:text-lg whitespace-nowrap">
                      {formatBDT(calculationOutput.totalEstimatedPayableBDT, lang)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clean Legal Notice & Mandatory Disclaimer */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>{calculationOutput.legalInfo.sectionBn}</span>
                </p>
                <p
                  data-testid="calculation-legal-disclaimer"
                  className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed"
                >
                  {EXPORT_DISCLAIMER_BN}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-1 no-print">
                <button
                  type="button"
                  data-testid="save-benefit-calculation-btn"
                  onClick={handleSaveCalculation}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  <span>সংরক্ষণ করুন</span>
                </button>

                <button
                  type="button"
                  data-testid="share-benefit-calculation-btn"
                  onClick={handleShareOrCopySummary}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {copiedSummary ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Share2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{copiedSummary ? 'কপি হয়েছে' : 'শেয়ার ও কপি'}</span>
                </button>

                <button
                  type="button"
                  data-testid="print-benefit-calculation-btn"
                  onClick={handlePrintResult}
                  className="col-span-2 sm:col-span-1 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>প্রিন্ট ও পিডিএফ</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SAVED CALCULATION HISTORY */}
      {/* ===================================================================== */}
      {topTab === 'saved_history' && (
        <div
          data-testid="saved-calculation-history-view"
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              সংরক্ষিত হিসাব তালিকা
            </h2>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold whitespace-nowrap">
              {toBengaliDigits(savedHistory.length)}টি
            </span>
          </div>

          {savedHistory.length === 0 ? (
            <div className="py-10 text-center space-y-2.5">
              <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
                এখনো কোনো হিসাব সংরক্ষণ করা হয়নি।
              </p>
              <button
                type="button"
                onClick={() => setTopTab('guided_benefits')}
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                ক্যালকুলেটরে যান
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {savedHistory.map((rec) => (
                <div
                  key={rec.id}
                  data-testid={`saved-calc-item-${rec.calculatorId}`}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        {rec.calculatorTitleBn}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {toBengaliDigits(rec.calculationDate)}
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                      {formatBDT(rec.output.totalEstimatedPayableBDT, lang)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReopenSavedRecord(rec)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      পুনরায় দেখুন
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedRecord(rec.id)}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>মুছুন</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: STANDARD KEYPAD CALCULATOR */}
      {/* ===================================================================== */}
      {topTab === 'standard_keypad' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-2xs space-y-4 max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              সাধারণ ক্যালকুলেটর
            </span>
            <button
              type="button"
              data-testid="toggle-calc-digits-btn"
              onClick={() => setUseBengaliDigits((prev) => !prev)}
              className="min-h-[32px] px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>{useBengaliDigits ? 'বাংলা' : 'EN'}</span>
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 text-right">
            <div className="min-h-[20px] text-xs font-mono font-medium text-slate-400 dark:text-slate-500 overflow-x-auto">
              {formula ? renderDisplay(formula) : ' '}
            </div>
            <div
              data-testid="calc-display"
              className="text-3xl sm:text-4xl font-mono font-black text-slate-900 dark:text-white tracking-tight overflow-x-auto py-1"
            >
              {renderDisplay(displayValue)}
            </div>
            <div className="flex items-center justify-end pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
              <button
                type="button"
                data-testid="calc-copy-btn"
                onClick={() => handleCopyKeypadResult(displayValue)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {copiedKeypad ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKeypad ? 'কপি হয়েছে' : 'কপি'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
            <button
              type="button"
              data-testid="calc-key-clear"
              onClick={handleClear}
              className="min-h-[50px] rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-extrabold text-base"
            >
              C
            </button>
            <button
              type="button"
              data-testid="calc-key-backspace"
              onClick={handleBackspace}
              className="min-h-[50px] rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              type="button"
              data-testid="calc-key-percent"
              onClick={handlePercentage}
              className="min-h-[50px] rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-base"
            >
              %
            </button>
            <button
              type="button"
              data-testid="calc-key-divide"
              onClick={() => handleOperator('÷')}
              className="min-h-[50px] rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-lg"
            >
              ÷
            </button>

            {['7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                data-testid={`calc-key-${d}`}
                onClick={() => handleDigit(d)}
                className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg"
              >
                {renderDisplay(d)}
              </button>
            ))}
            <button
              type="button"
              data-testid="calc-key-multiply"
              onClick={() => handleOperator('×')}
              className="min-h-[52px] rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-lg"
            >
              ×
            </button>

            {['4', '5', '6'].map((d) => (
              <button
                key={d}
                type="button"
                data-testid={`calc-key-${d}`}
                onClick={() => handleDigit(d)}
                className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg"
              >
                {renderDisplay(d)}
              </button>
            ))}
            <button
              type="button"
              data-testid="calc-key-minus"
              onClick={() => handleOperator('-')}
              className="min-h-[52px] rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xl"
            >
              -
            </button>

            {['1', '2', '3'].map((d) => (
              <button
                key={d}
                type="button"
                data-testid={`calc-key-${d}`}
                onClick={() => handleDigit(d)}
                className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg"
              >
                {renderDisplay(d)}
              </button>
            ))}
            <button
              type="button"
              data-testid="calc-key-plus"
              onClick={() => handleOperator('+')}
              className="min-h-[52px] rounded-2xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xl"
            >
              +
            </button>

            <button
              type="button"
              data-testid="calc-key-sign"
              onClick={handleToggleSign}
              className="min-h-[52px] rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm"
            >
              ±
            </button>
            <button
              type="button"
              data-testid="calc-key-0"
              onClick={() => handleDigit('0')}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-lg"
            >
              {renderDisplay('0')}
            </button>
            <button
              type="button"
              data-testid="calc-key-dot"
              onClick={handleDecimal}
              className="min-h-[52px] rounded-2xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white font-extrabold text-xl"
            >
              .
            </button>
            <button
              type="button"
              data-testid="calc-key-equals"
              onClick={handleEquals}
              className="min-h-[52px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-2xl"
            >
              =
            </button>
          </div>

          {keypadHistory.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  পূর্ববর্তী হিসাব
                </span>
                <button
                  type="button"
                  onClick={() => setKeypadHistory([])}
                  className="text-[11px] text-red-500 hover:underline cursor-pointer"
                >
                  ক্লিয়ার
                </button>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {keypadHistory.map((h, i) => (
                  <div
                    key={i}
                    onClick={() => setDisplayValue(h.result)}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer text-xs"
                  >
                    <span className="font-mono text-slate-500">{renderDisplay(h.expr)} =</span>
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

      <FinalSettlementWizardModal
        isOpen={showSettlementWizard}
        onClose={() => setShowSettlementWizard(false)}
        onSavedCalculation={() => setSavedHistory(loadUserCalculationHistory(effectiveUserId))}
      />
    </div>
  );
};
