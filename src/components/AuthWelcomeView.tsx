import React, { useEffect, useRef, useState } from 'react';
import {
  Banknote,
  Calculator,
  CalendarCheck2,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  User,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { PWAInstallButton } from './PWAInstallButton';
import { BrandWordmark } from './BrandWordmark';
import { TermsPrivacyModal } from './TermsPrivacyModal';
import { validateSignupTermsAcceptance } from '../utils/termsContent';

export const AuthWelcomeView: React.FC = () => {
  const {
    loginWithGoogle,
    loginWithCredentials,
    signUpWithCredentials,
    sendPasswordReset,
    initialAuthMode,
    clearInitialAuthMode,
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
  } = useData();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialAuthMode || 'signin');
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    identifier?: string;
    password?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Forgot Password modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const googleAttemptIdRef = useRef(0);

  useEffect(() => {
    if (initialAuthMode) {
      setAuthMode(initialAuthMode);
      clearInitialAuthMode();
    }
  }, [initialAuthMode, clearInitialAuthMode]);

  // Recover automatically if Google popup is closed or blocked without rejecting promptly
  useEffect(() => {
    if (!isGoogleSubmitting || typeof window === 'undefined') return;
    const attemptId = googleAttemptIdRef.current;
    let focusTimer: number | null = null;

    const onWindowFocus = () => {
      if (focusTimer) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (googleAttemptIdRef.current === attemptId) {
          setIsGoogleSubmitting(false);
          setIsSubmitting(false);
          setAuthError(
            lang === 'bn'
              ? 'লগইন বাতিল হয়েছে, আবার চেষ্টা করুন।'
              : 'Sign-in was cancelled. Please try again.'
          );
        }
      }, 2200);
    };

    const hardTimeout = window.setTimeout(() => {
      if (googleAttemptIdRef.current === attemptId) {
        setIsGoogleSubmitting(false);
        setIsSubmitting(false);
        setAuthError(
          lang === 'bn'
            ? 'গুগল লগইন সম্পন্ন হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
            : 'Google sign-in did not complete. Please try again.'
        );
      }
    }, 25000);

    window.addEventListener('focus', onWindowFocus);
    return () => {
      window.removeEventListener('focus', onWindowFocus);
      if (focusTimer) window.clearTimeout(focusTimer);
      window.clearTimeout(hardTimeout);
    };
  }, [isGoogleSubmitting, lang]);

  const handleCancelGoogleSignIn = () => {
    googleAttemptIdRef.current += 1;
    setIsGoogleSubmitting(false);
    setIsSubmitting(false);
    setAuthError(
      lang === 'bn'
        ? 'লগইন বাতিল হয়েছে, আবার চেষ্টা করুন।'
        : 'Sign-in was cancelled. Please try again.'
    );
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setFieldErrors({});
    const currentAttempt = googleAttemptIdRef.current + 1;
    googleAttemptIdRef.current = currentAttempt;
    setIsSubmitting(true);
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogle(authMode);
    } catch (err) {
      if (googleAttemptIdRef.current === currentAttempt) {
        const msg = err instanceof Error ? err.message : String(err);
        setAuthError(msg);
      }
    } finally {
      if (googleAttemptIdRef.current === currentAttempt) {
        setIsGoogleSubmitting(false);
        setIsSubmitting(false);
      }
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const nextFieldErrors: { fullName?: string; identifier?: string; password?: string } = {};

    if (authMode === 'signup' && !fullName.trim()) {
      nextFieldErrors.fullName =
        lang === 'bn' ? 'অনুগ্রহ করে আপনার নাম লিখুন।' : 'Please enter your full name.';
    }
    if (!identifier.trim()) {
      nextFieldErrors.identifier =
        lang === 'bn'
          ? 'অনুগ্রহ করে ইমেইল, মোবাইল নম্বর বা ইউজারনেম লিখুন।'
          : 'Please enter your email, phone number, or username.';
    }
    if (!password) {
      nextFieldErrors.password =
        lang === 'bn' ? 'অনুগ্রহ করে পাসওয়ার্ড লিখুন।' : 'Please enter your password.';
    } else if (authMode === 'signup' && password.length < 8) {
      nextFieldErrors.password =
        lang === 'bn'
          ? 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'
          : 'Password must be at least 8 characters long.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setAuthError(
        lang === 'bn'
          ? 'অনুগ্রহ করে প্রয়োজনীয় ঘরগুলো সঠিকভাবে পূরণ করুন।'
          : 'Please fill in the required fields correctly.'
      );
      return;
    }

    setFieldErrors({});
    const termsError = validateSignupTermsAcceptance(authMode, acceptedTerms, lang);
    if (termsError) {
      setAuthError(termsError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'signup') {
        await signUpWithCredentials(fullName, identifier, password);
      } else {
        await loginWithCredentials(identifier, password);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [resetNeedsSupport, setResetNeedsSupport] = useState(false);

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setResetNeedsSupport(false);
    if (!resetIdentifier.trim()) {
      setResetError(
        lang === 'bn'
          ? 'অনুগ্রহ করে আপনার ইমেইল, মোবাইল নম্বর বা ইউজারনেম লিখুন।'
          : 'Please enter your email, phone number, or username.'
      );
      return;
    }
    setResetSubmitting(true);
    try {
      const res = await sendPasswordReset(resetIdentifier);
      if (res.status === 'needs_support_recovery') {
        setResetNeedsSupport(true);
        setResetError(lang === 'bn' ? res.messageBn : res.messageEn);
      } else {
        setResetSuccess(lang === 'bn' ? res.messageBn : res.messageEn);
      }
    } catch (err) {
      setResetError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetSubmitting(false);
    }
  };

  const featureHighlights = [
    {
      icon: Banknote,
      titleBn: 'বেতন ও ওভারটাইম হিসাব',
      titleEn: 'Salary & Overtime Tracking',
      descBn: 'দৈনিক ওভারটাইম, বোনাস, পে-স্লিপ ও শ্রম আইন অনুযায়ী সঠিক হিসাব।',
      descEn: 'Daily OT, attendance bonus, printable payslips, and labour law accuracy.',
    },
    {
      icon: CalendarCheck2,
      titleBn: 'হাজিরা ও ছুটির আবেদন',
      titleEn: 'Attendance & Leave Tracker',
      descBn: 'মাসিক হাজিরা ক্যালেন্ডার, ছুটির আবেদন ও সাপ্তাহিক ছুটির দ্বিগুণ রেট।',
      descEn: 'Monthly calendar, leave requests, and automatic holiday rate detection.',
    },
    {
      icon: Wallet,
      titleBn: 'খরচ, সঞ্চয় ও ব্যক্তিগত ঋণ',
      titleEn: 'Expenses, Savings & Loans',
      descBn: 'মাসিক আয়-ব্যয়ের ভারসাম্য, বাজেট সতর্কতা এবং নিরাপদ অফলাইন ডাটা।',
      descEn: 'Monthly budget balance, alerts, and reliable offline-first storage.',
    },
    {
      icon: Calculator,
      titleBn: '২১+ শ্রম আইন ক্যালকুলেটর',
      titleEn: '21+ Labour Law Calculators',
      descBn: 'ইনক্রিমেন্ট, অর্জিত ছুটি, সার্ভিস বেনিফিট ও ওভারটাইম সহায়িকা।',
      descEn: 'Increment, earned leave, service benefit, and instant law helper.',
    },
  ];

  return (
    <div
      data-testid="auth-welcome-view"
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between"
    >
      {/* Clean Minimal Top Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md sticky top-0 z-20">
        <a
          href="#top"
          aria-label="শ্রমিক সাথী"
          className="inline-flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/80 p-0.5 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src="/logo-128.png"
              alt="শ্রমিক সাথী লোগো"
              data-testid="auth-header-logo"
              width={32}
              height={32}
              decoding="async"
              className="w-full h-full object-contain rounded-full"
            />
          </span>
          <BrandWordmark size="header" dataTestId="auth-header-wordmark" />
        </a>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton lang={lang} variant="header" />
          <button
            type="button"
            data-testid="auth-lang-toggle-btn"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            aria-label="Switch Language"
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
          </button>
          <button
            type="button"
            data-testid="auth-theme-toggle-btn"
            onClick={toggleDarkMode}
            aria-label="Toggle Dark Mode"
            className="min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Public Overview + Auth Card */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* Auth Card (First on mobile for instant access, right side on desktop) */}
          <div className="lg:col-span-6 lg:order-2 flex justify-center">
            <div
              data-testid="auth-card"
              className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5"
            >
              {/* Brand Header inside Card */}
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/80 p-0.5 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs flex items-center justify-center mb-1.5 overflow-hidden">
                  <img
                    src="/logo-128.png"
                    alt="শ্রমিক সাথী লোগো"
                    data-testid="auth-card-logo"
                    width={52}
                    height={52}
                    decoding="async"
                    className="w-full h-full object-cover scale-105 rounded-full"
                  />
                </div>
                <BrandWordmark size="lg" dataTestId="auth-card-wordmark" className="mb-1" />
                <h1
                  data-testid="auth-heading"
                  className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white"
                >
                  {authMode === 'signin'
                    ? lang === 'bn'
                      ? 'শ্রমিক সাথী-তে লগইন করুন'
                      : 'Sign in to Shromik Sathi'
                    : lang === 'bn'
                    ? 'নতুন অ্যাকাউন্ট তৈরি করুন'
                    : 'Create your account'}
                </h1>
              </div>

              {authError && (
                <div
                  role="alert"
                  data-testid="auth-error-banner"
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-800 dark:text-rose-200"
                >
                  {authError}
                </div>
              )}

              {/* 1. Google Button */}
              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="google-signin-btn"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
                    />
                  </svg>
                  <span>
                    {isGoogleSubmitting
                      ? lang === 'bn'
                        ? 'গুগল পপআপ অপেক্ষা করছে...'
                        : 'Waiting for Google...'
                      : authMode === 'signup'
                      ? lang === 'bn'
                        ? 'গুগল দিয়ে সাইন আপ করুন'
                        : 'Sign up with Google'
                      : lang === 'bn'
                      ? 'গুগল দিয়ে লগইন করুন'
                      : 'Continue with Google'}
                  </span>
                </button>

                {isGoogleSubmitting && (
                  <button
                    type="button"
                    data-testid="cancel-google-signin-btn"
                    onClick={handleCancelGoogleSignIn}
                    className="w-full py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    {lang === 'bn' ? 'বাতিল করুন' : 'Cancel Google sign-in'}
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                  {authMode === 'signup'
                    ? lang === 'bn'
                      ? 'অথবা গুগল ছাড়া সাইন আপ'
                      : 'OR SIGN UP WITHOUT GOOGLE'
                    : lang === 'bn'
                    ? 'অথবা গুগল ছাড়া লগইন'
                    : 'OR WITHOUT GOOGLE'}
                </span>
                <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              </div>

              {/* 2. Non-Google Sign In / Sign Up Form (noValidate for localized inline Bengali/English errors) */}
              <form
                data-testid="credentials-auth-form"
                noValidate
                onSubmit={handleCredentialsSubmit}
                className="space-y-3.5"
              >
                {authMode === 'signup' && (
                  <div>
                    <label
                      htmlFor="auth-fullname"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      {lang === 'bn' ? 'আপনার নাম' : 'Full Name'}
                      <span className="text-rose-600 ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="auth-fullname"
                        data-testid="auth-fullname-input"
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: undefined }));
                        }}
                        aria-invalid={Boolean(fieldErrors.fullName)}
                        placeholder={lang === 'bn' ? 'যেমন: মো: রফিকুল ইসলাম' : 'e.g., Rafiqul Islam'}
                        className={`w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800/80 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                          fieldErrors.fullName
                            ? 'border-rose-500 focus:ring-rose-500'
                            : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-600'
                        }`}
                      />
                    </div>
                    {fieldErrors.fullName && (
                      <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        {fieldErrors.fullName}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-identifier"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {lang === 'bn'
                      ? 'ইমেইল, মোবাইল নম্বর বা ইউজারনেম'
                      : 'Email, Phone or Username'}
                    <span className="text-rose-600 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-identifier"
                      data-testid="auth-identifier-input"
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (fieldErrors.identifier) setFieldErrors((p) => ({ ...p, identifier: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors.identifier)}
                      placeholder={
                        lang === 'bn'
                          ? 'যেমন: rahim01, ইমেইল বা 017XXXXXXXX'
                          : 'e.g., worker01, email, or 017XXXXXXXX'
                      }
                      className={`w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800/80 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                        fieldErrors.identifier
                          ? 'border-rose-500 focus:ring-rose-500'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-600'
                      }`}
                    />
                  </div>
                  {fieldErrors.identifier && (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      {fieldErrors.identifier}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                      htmlFor="auth-password"
                      className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
                      <span className="text-rose-600 ml-0.5">*</span>
                    </label>
                    {authMode === 'signin' && (
                      <button
                        type="button"
                        data-testid="forgot-password-btn"
                        onClick={() => {
                          setResetIdentifier(identifier);
                          setResetError('');
                          setResetSuccess('');
                          setShowResetModal(true);
                        }}
                        className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-password"
                      data-testid="auth-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors.password)}
                      placeholder={
                        authMode === 'signup'
                          ? lang === 'bn'
                            ? 'কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন'
                            : 'At least 8 characters'
                          : lang === 'bn'
                          ? 'পাসওয়ার্ড লিখুন'
                          : 'Enter password'
                      }
                      className={`w-full min-h-[44px] pl-9 pr-10 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800/80 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                        fieldErrors.password
                          ? 'border-rose-500 focus:ring-rose-500'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {authMode === 'signup' && !fieldErrors.password && (
                    <p
                      data-testid="password-rule-hint"
                      className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400"
                    >
                      {lang === 'bn' ? 'কমপক্ষে ৮ অক্ষর' : 'Minimum 8 characters'}
                    </p>
                  )}
                  {fieldErrors.password && (
                    <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {authMode === 'signup' && (
                  <div
                    data-testid="auth-terms-box"
                    className={`rounded-xl border px-3 py-2.5 transition-colors ${
                      authError && !acceptedTerms
                        ? 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/30'
                        : 'border-slate-200/90 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        id="auth-terms-checkbox"
                        data-testid="auth-terms-checkbox"
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => {
                          setAcceptedTerms(e.target.checked);
                          if (e.target.checked && authError) {
                            setAuthError('');
                          }
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer shrink-0 accent-emerald-700"
                      />
                      <label
                        htmlFor="auth-terms-checkbox"
                        className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 select-none cursor-pointer"
                      >
                        {lang === 'bn' ? (
                          <>
                            আমি{' '}
                            <button
                              type="button"
                              data-testid="open-terms-modal-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowTermsModal(true);
                              }}
                              className="font-extrabold text-emerald-700 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-800 dark:hover:text-emerald-300 cursor-pointer"
                            >
                              শর্তাবলী এবং গোপনীয়তা নীতি
                            </button>{' '}
                            পড়েছি এবং সম্মত আছি।
                          </>
                        ) : (
                          <>
                            I have read and agree to the{' '}
                            <button
                              type="button"
                              data-testid="open-terms-modal-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowTermsModal(true);
                              }}
                              className="font-extrabold text-emerald-700 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-800 dark:hover:text-emerald-300 cursor-pointer"
                            >
                              Terms &amp; Conditions and Privacy Policy
                            </button>
                            .
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  data-testid="auth-submit-btn"
                  disabled={isSubmitting}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  {authMode === 'signin' ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>
                        {isSubmitting && !isGoogleSubmitting
                          ? lang === 'bn'
                            ? 'প্রবেশ করা হচ্ছে...'
                            : 'Logging in...'
                          : lang === 'bn'
                          ? 'লগইন করুন'
                          : 'Login'}
                      </span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {isSubmitting && !isGoogleSubmitting
                          ? lang === 'bn'
                            ? 'অ্যাকাউন্ট তৈরি হচ্ছে...'
                            : 'Creating account...'
                          : lang === 'bn'
                          ? 'সাইন আপ করুন'
                          : 'Sign Up'}
                      </span>
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Mode Switcher */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {authMode === 'signin' ? (
                    <>
                      {lang === 'bn' ? 'কোনো অ্যাকাউন্ট নেই?' : "Don't have an account?"}{' '}
                      <button
                        type="button"
                        data-testid="auth-bottom-switch-signup"
                        onClick={() => {
                          setAuthMode('signup');
                          setAuthError('');
                          setFieldErrors({});
                          setAcceptedTerms(false);
                        }}
                        className="font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline ml-1 cursor-pointer"
                      >
                        {lang === 'bn' ? 'সাইন আপ করুন' : 'Sign Up'}
                      </button>
                    </>
                  ) : (
                    <>
                      {lang === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে?' : 'Already have an account?'}{' '}
                      <button
                        type="button"
                        data-testid="auth-bottom-switch-signin"
                        onClick={() => {
                          setAuthMode('signin');
                          setAuthError('');
                          setFieldErrors({});
                        }}
                        className="font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline ml-1 cursor-pointer"
                      >
                        {lang === 'bn' ? 'লগইন করুন' : 'Login'}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Public Product Overview Panel (Informative, Clean, Trustworthy) */}
          <section
            data-testid="auth-public-overview"
            className="lg:col-span-6 lg:order-1 space-y-5"
          >
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/70 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {lang === 'bn'
                    ? 'গার্মেন্টস শ্রমিকদের ব্যক্তিগত আর্থিক সহকারী'
                    : 'Personal Finance Assistant for Garment Workers'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white leading-snug">
                {lang === 'bn'
                  ? 'বেতন, ওভারটাইম ও হাজিরার নির্ভুল হিসাব — এখন আপনার হাতের মুঠোয়'
                  : 'Accurate Salary, Overtime & Attendance — Right in Your Pocket'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'বাংলাদেশ শ্রম আইন অনুযায়ী প্রতি ঘণ্টার ওভারটাইম, হাজিরা বোনাস, ছুটি, খরচ এবং প্রিন্টযোগ্য পে-স্লিপ সহজেই সংরক্ষণ করুন — অফলাইন এবং অনলাইন উভয় অবস্থাতেই।'
                  : 'Track hourly overtime, attendance bonus, leave, expenses, and printable payslips following Bangladesh Labour Law — seamlessly offline and online.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {featureHighlights.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-2xs flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {lang === 'bn' ? item.titleBn : item.titleEn}
                      </h3>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {lang === 'bn' ? item.descBn : item.descEn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lang === 'bn' ? '১০০% ব্যক্তিগত ও সুরক্ষিত ডাটা' : '100% Private & Secure Data'}
              </span>
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="underline underline-offset-2 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer"
              >
                {lang === 'bn' ? 'শর্তাবলী ও গোপনীয়তা নীতি' : 'Terms & Privacy Policy'}
              </button>
              <a
                href="mailto:support@shromiksathi.org"
                className="inline-flex items-center gap-1 hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>support@shromiksathi.org</span>
              </a>
            </div>
          </section>
        </div>
      </main>

      <footer className="py-3.5 px-4 text-center text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-200/70 dark:border-slate-800/70">
        {lang === 'bn'
          ? 'শ্রমিক সাথী · আপনার ব্যক্তিগত বেতন ও ওভারটাইম সহকারী'
          : 'Shromik Sathi · Personal Salary & Overtime Assistant'}
      </footer>

      {/* Forgot Password Modal */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="forgot-password-modal"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'পাসওয়ার্ড রিসেট করুন' : 'Reset Password'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowResetModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-900 dark:text-amber-200 space-y-2"
              >
                <p>{resetError}</p>
                {resetNeedsSupport && (
                  <a
                    href="mailto:sadikulislam45974@gmail.com?subject=Shromik%20Sathi%20Account%20Recovery"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-[11px] font-bold hover:bg-emerald-800"
                  >
                    {lang === 'bn' ? 'সাপোর্টে ইমেইল করুন' : 'Contact Support'}
                  </a>
                )}
              </div>
            )}

            {resetSuccess && (
              <div
                role="status"
                className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200"
              >
                {resetSuccess}
              </div>
            )}

            <form noValidate onSubmit={handlePasswordResetSubmit} className="space-y-3">
              <input
                type="text"
                data-testid="reset-identifier-input"
                value={resetIdentifier}
                onChange={(e) => {
                  setResetIdentifier(e.target.value);
                  setResetNeedsSupport(false);
                }}
                placeholder={
                  lang === 'bn'
                    ? 'ইমেইল, মোবাইল নম্বর বা ইউজারনেম'
                    : 'Email, phone number, or username'
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </button>
                <button
                  type="submit"
                  data-testid="reset-submit-btn"
                  disabled={resetSubmitting}
                  className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                >
                  {resetSubmitting
                    ? lang === 'bn'
                      ? 'পাঠানো হচ্ছে...'
                      : 'Sending...'
                    : lang === 'bn'
                    ? 'রিসেট লিংক পাঠান'
                    : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TermsPrivacyModal
        open={showTermsModal}
        lang={lang}
        onAccept={() => {
          setAcceptedTerms(true);
          setAuthError('');
          setShowTermsModal(false);
        }}
        onClose={() => setShowTermsModal(false)}
      />
    </div>
  );
};
