import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Globe,
  Lock,
  LogIn,
  Moon,
  PlayCircle,
  ShieldCheck,
  Sun,
  User,
  UserPlus,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { DEMO_SAMPLE_DATA_BADGE, PUBLIC_DEMO_EMAIL } from '../utils/demoData';
import { PWAInstallButton } from './PWAInstallButton';
import { BrandWordmark } from './BrandWordmark';

export const AuthWelcomeView: React.FC = () => {
  const {
    loginWithGoogle,
    loginWithCredentials,
    signUpWithCredentials,
    enterDemoMode,
    publicDemoConfig,
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialAuthMode) {
      setAuthMode(initialAuthMode);
      clearInitialAuthMode();
    }
  }, [initialAuthMode, clearInitialAuthMode]);

  const handleTryDemo = () => {
    setAuthError('');
    if (!publicDemoConfig.enabled) {
      setAuthError(
        lang === 'bn'
          ? publicDemoConfig.maintenanceMessageBn
          : publicDemoConfig.maintenanceMessageEn
      );
      return;
    }
    enterDemoMode();
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(
        lang === 'bn'
          ? `গুগল লগইন সম্পন্ন হয়নি (${msg})। আপনি ইমেইল/ইউজারনেম ও পাসওয়ার্ড দিয়ে লগইন করতে পারেন।`
          : `Google sign-in could not complete (${msg}). You can sign in with username/email below.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
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

  return (
    <div
      data-testid="auth-welcome-view"
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between"
    >
      {/* Clean Minimal Top Bar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <a
          href="#top"
          aria-label="শ্রমিক সাথী"
          className="inline-flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/80 p-0.5 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src="/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png"
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
          <PWAInstallButton lang={lang} />
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

      {/* Centered Clean Login / Sign Up Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        <div
          data-testid="auth-card"
          className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5"
        >
          {/* Brand Header inside Card */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/80 p-0.5 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs flex items-center justify-center mb-1.5 overflow-hidden">
              <img
                src="/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png"
                alt="শ্রমিক সাথী লোগো"
                data-testid="auth-card-logo"
                width={52}
                height={52}
                decoding="async"
                className="w-full h-full object-cover scale-105 rounded-full"
              />
            </div>
            <BrandWordmark size="lg" dataTestId="auth-card-wordmark" className="mb-1.5" />
            <h1
              data-testid="auth-heading"
              className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white"
            >
              {authMode === 'signin'
                ? lang === 'bn'
                  ? 'লগইন করুন'
                  : 'Login'
                : lang === 'bn'
                ? 'সাইন আপ করুন'
                : 'Sign Up'}
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

          {/* 1. Continue with Google Button */}
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
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-400 whitespace-nowrap">
              {lang === 'bn' ? 'অথবা গুগল ছাড়া লগইন' : 'OR WITHOUT GOOGLE'}
            </span>
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
          </div>

          {/* 2. Non-Google Sign In / Sign Up Form */}
          <form
            data-testid="credentials-auth-form"
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
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-fullname"
                    data-testid="auth-fullname-input"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: মো: রফিকুল ইসলাম' : 'e.g., Rafiqul Islam'}
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
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
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-identifier"
                  data-testid="auth-identifier-input"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: rahim01 বা 017XXXXXXXX'
                      : 'e.g., worker01 or email@example.com'
                  }
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  data-testid="auth-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={lang === 'bn' ? 'পাসওয়ার্ড লিখুন' : 'Enter password'}
                  className="w-full min-h-[44px] pl-9 pr-10 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
            </div>

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
                    {isSubmitting
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
                    {isSubmitting
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

          {/* Read-Only Public Demo Preview CTA */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <button
              type="button"
              data-testid="try-demo-btn"
              onClick={handleTryDemo}
              disabled={isSubmitting}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <PlayCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>
                {lang === 'bn' ? 'ডেমো দেখুন (Try Demo)' : 'Try Demo (Read-Only Preview)'}
              </span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{DEMO_SAMPLE_DATA_BADGE}</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                {PUBLIC_DEMO_EMAIL}
              </span>
            </div>
          </div>

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
      </main>

      <footer className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
        {lang === 'bn'
          ? 'শ্রমিক সাথী · আপনার ব্যক্তিগত বেতন ও ওভারটাইম সহকারী'
          : 'Shromik Sathi · Personal Salary & Overtime Assistant'}
      </footer>
    </div>
  );
};
