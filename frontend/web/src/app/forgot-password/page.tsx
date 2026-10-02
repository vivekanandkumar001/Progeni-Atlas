'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Mail, ArrowRight, ArrowLeft, KeyRound, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Step 1: Request Password Reset OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(getApiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to request password reset.');
      }

      setSuccessMsg('Verification code sent to your email. Redirecting to OTP verification...');
      setTimeout(() => {
        router.push(`/verify-otp?email=${encodeURIComponent(email)}&purpose=FORGOT_PASSWORD`);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Reset Password with OTP
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !newPassword) {
      setErrorMsg('OTP code and new password are required.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otpCode, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Password reset failed.');
      }

      setSuccessMsg('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Reset failed. Please check your code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Ambient Radial Background Glows */}
      <div className="fixed top-1/4 left-1/3 w-[30rem] h-[30rem] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-1/4 right-1/3 w-[25rem] h-[25rem] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Glassmorphic Form Card */}
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Top Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400 mb-2 shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-heading text-2xl font-bold text-slate-100 tracking-tight">
            Reset Password
          </h1>
          <p className="text-body text-sm text-slate-400 max-w-xs mx-auto">
            {step === 'email'
              ? 'Enter your registered email address to receive a 2-minute verification code.'
              : 'Enter the verification code and your new account password.'}
          </p>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="inline-flex items-center gap-1.5 text-body text-xs font-medium text-slate-300 mb-1.5">
                <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Work or Academic Email Address</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-cyan-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Sending Code...</span>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="inline-flex items-center gap-1.5 text-body text-xs font-medium text-slate-300 mb-1.5">
                <KeyRound className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>6-Digit Verification Code</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full px-4 py-3 font-mono text-center tracking-widest text-lg rounded-xl bg-slate-950/60 border border-slate-800 text-cyan-300 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-1.5 text-body text-xs font-medium text-slate-300 mb-1.5">
                <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>New Account Password</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !otpCode || !newPassword}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-cyan-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Resetting Password...</span>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Back Link */}
        <div className="text-center pt-2 border-t border-slate-800/80">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-caption text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
