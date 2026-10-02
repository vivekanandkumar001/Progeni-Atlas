'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Zap,
  User,
  Building2,
  Loader2,
} from 'lucide-react';
import { LoginValidationSchema, LoginFormData } from '@/lib/validations/login';

// Reusable Form Label Component with Mandatory Red Asterisk (*) & Inline Icon
interface FormLabelProps {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
}

export const FormLabel = ({ label, required = true, icon }: FormLabelProps) => (
  <label className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 mb-1.5">
    {icon && <span className="text-cyan-400 shrink-0">{icon}</span>}
    <span>{label}</span>
    {required && <span className="text-rose-500 font-bold">*</span>}
  </label>
);

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginValidationSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      role: 'candidate',
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const values = watch();
  const activeRole = values.role || 'candidate';
  const watchedEmail = values.email || '';
  const watchedPassword = values.password || '';

  // Form is filled when email and password are non-empty
  const isFormFilled = Boolean(watchedEmail.trim() && watchedPassword);

  const handleRoleToggle = (newRole: 'candidate' | 'recruiter') => {
    setValue('role', newRole);
  };

  const handleAutoFillCandidate = () => {
    setValue('role', 'candidate');
    setValue('email', 'candidate.demo@talentpulse.ai');
    setValue('password', 'DemoPass123!');
  };

  const handleAutoFillRecruiter = () => {
    setValue('role', 'recruiter');
    setValue('email', 'recruiter.lead@techcorp.io');
    setValue('password', 'RecruiterPass123!');
  };

  const [loginErrorMsg, setLoginErrorMsg] = useState<string>('');

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setLoginErrorMsg('');
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await res.json();

      if (res.status === 403 || result.isUnverified) {
        setLoginErrorMsg('Your email address is not verified yet. Redirecting to OTP verification...');
        setTimeout(() => {
          router.push(result.redirectUrl || `/verify-otp?email=${encodeURIComponent(data.email)}&purpose=REGISTRATION_VERIFY`);
        }, 1200);
        return;
      }

      if (!res.ok) {
        throw new Error(result.error || 'Invalid credentials. Please check your email and password.');
      }

      router.push(result.redirectUrl || (data.role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard'));
    } catch (err: any) {
      setLoginErrorMsg(err.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] font-sans flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glow gradients */}
      <div className="absolute top-0 left-0 w-full h-full ambient-glow-cyan pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-full h-full ambient-glow-indigo pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Minimal Navigation Bar */}
        <header className="w-full border-b border-slate-800/80 px-6 py-4 backdrop-blur-md bg-slate-950/80">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="cyan-pulse-dot" />
              <span className="text-xl font-bold tracking-tight text-white font-sans">
                TalentPulse<span className="text-[#38bdf8]">.AI</span>
              </span>
            </Link>

            <div className="text-xs font-medium text-[#94a3b8]">
              Don't have an account?{' '}
              <Link
                href="/register"
                className="text-[#38bdf8] font-semibold hover:underline inline-flex items-center space-x-1 ml-1"
              >
                <span>Register</span>
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content (Responsive Two-Column Layout) */}
        <main className="flex-grow max-w-6xl w-full mx-auto px-6 py-12 flex items-center">
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 w-full items-start">
            
            {/* SECTION A: LOGIN FORM CONTAINER (ORDER 1 ON MOBILE, RIGHT COL ON DESKTOP) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full order-1 lg:order-2 lg:col-span-7"
            >
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
                
                {/* Role Switcher Pill (Candidate vs Recruiter) */}
                <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleRoleToggle('candidate')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                      activeRole === 'candidate'
                        ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-semibold shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Candidate Portal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleToggle('recruiter')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                      activeRole === 'recruiter'
                        ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-semibold shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Recruiter / Admin</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {activeRole === 'candidate' ? 'Candidate Sign In' : 'Recruiter & Admin Sign In'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Enter your credentials to access your interviewing dashboard.
                  </p>
                </div>

                {loginErrorMsg && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{loginErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  
                  {/* Email Address Field */}
                  <div>
                    <FormLabel label="Email Address" required />
                    <input
                      {...register('email')}
                      onChange={(e) => setValue('email', e.target.value.toLowerCase().replace(/\s/g, ''))}
                      type="email"
                      placeholder={
                        activeRole === 'candidate'
                          ? 'candidate@example.com'
                          : 'recruiter@company.com'
                      }
                      className={`w-full px-4 py-3 rounded-xl bg-slate-950/60 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all ${
                        isSubmitted && errors.email
                          ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                          : 'border-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/20'
                      }`}
                    />
                    {isSubmitted && errors.email && (
                      <p className="text-xs text-rose-400 mt-1.5 block animate-fadeIn">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <FormLabel label="Password" required />
                    <div className="relative">
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        className={`w-full px-4 py-3 rounded-xl bg-slate-950/60 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all pr-11 ${
                          isSubmitted && errors.password
                            ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                            : 'border-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {isSubmitted && errors.password && (
                      <p className="text-xs text-rose-400 mt-1.5 block animate-fadeIn">
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  {/* Form Utility Row (Remember Me & Forgot Password) */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        {...register('rememberMe')}
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/20 cursor-pointer"
                      />
                      <span className="text-xs text-slate-400">Remember this device for 30 days</span>
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium cursor-pointer"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!isFormFilled || isSubmitting}
                    className={`w-full py-3.5 px-6 rounded-full font-bold text-sm transition-all duration-200 flex items-center justify-center space-x-2 ${
                      isFormFilled
                        ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white cursor-pointer shadow-lg shadow-cyan-500/20 hover:scale-[1.01]'
                        : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-50 pointer-events-none'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <span>Sign In to Account →</span>
                    )}
                  </button>

                  {/* Quick Demo Logins (For 1-Click Testing) */}
                  <div className="pt-2">
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-slate-800"></div>
                      <span className="flex-shrink mx-3 text-xs font-mono text-slate-500">Quick Demo Access</span>
                      <div className="flex-grow border-t border-slate-800"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <button
                        type="button"
                        onClick={handleAutoFillCandidate}
                        className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-xs text-slate-300 font-mono transition-all hover:bg-slate-900 flex items-center justify-center space-x-1.5"
                      >
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Demo Candidate</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAutoFillRecruiter}
                        className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-xs text-slate-300 font-mono transition-all hover:bg-slate-900 flex items-center justify-center space-x-1.5"
                      >
                        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Demo Recruiter</span>
                      </button>
                    </div>
                  </div>

                </form>
              </div>
            </motion.div>

            {/* SECTION B: VALUE PROPOSITION & SECURITY REASSURANCE (ORDER 2 ON MOBILE, LEFT COL ON DESKTOP) */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full order-2 lg:order-1 lg:col-span-5 space-y-6"
            >
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                  SECURE PLATFORM ACCESS
                </span>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight mt-2">
                  Welcome Back to TalentPulse AI
                </h1>

                <p className="text-sm text-slate-400 leading-relaxed font-normal mt-2">
                  Log in to access your interview schedule, practice sessions, and evaluation scorecards.
                </p>
              </div>

              {/* 2 Security Trust Cards */}
              <div className="space-y-4 pt-2">
                
                {/* Trust Card 1 */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Encrypted Authentication</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      AES-256 session management & secure JWT tokens ensure your identity remains protected.
                    </p>
                  </div>
                </div>

                {/* Trust Card 2 */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-start space-x-3.5">
                  <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Instant Sync</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Seamless progress restore across desktop and mobile devices for uninterrupted interviews.
                    </p>
                  </div>
                </div>

              </div>
            </motion.div>

          </div>
        </main>
      </div>
    </div>
  );
}
