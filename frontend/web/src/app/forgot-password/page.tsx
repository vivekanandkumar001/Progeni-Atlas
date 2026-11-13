'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Mail, KeyRound, AlertCircle, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AuthCard, buttonClass, inputClass } from '@/components/ui';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.has('password') ||
      urlParams.has('newPassword') ||
      urlParams.has('pass') ||
      urlParams.has('pwd')
    ) {
      urlParams.delete('password');
      urlParams.delete('newPassword');
      urlParams.delete('pass');
      urlParams.delete('pwd');
      const cleanSearch = urlParams.toString();
      const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

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
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Failed to request password reset.');
      }

      setSuccessMsg('Verification code sent to your email. Please enter the 6-digit code and your new password below.');
      setStep('reset');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong. Please try again.');
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
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otpCode, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Password reset failed.');
      }

      setSuccessMsg('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Reset failed. Please check your code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-cyan-500/30 selection:text-accent-cyan">
      {/* Ambient Radial Background Glows */}
      <div className="fixed top-1/4 left-1/3 w-[30rem] h-[30rem] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-1/4 right-1/3 w-[25rem] h-[25rem] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Glassmorphic Form Card */}
      <AuthCard className="max-w-md" innerClassName="space-y-6">
        {/* Top Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-accent-cyan mb-2 shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-heading text-2xl font-bold text-ink tracking-tight">
            Reset Password
          </h1>
          <p className="text-body text-sm text-ink-muted max-w-xs mx-auto">
            {step === 'email'
              ? 'Enter your registered email address to receive a 2-minute verification code.'
              : 'Enter the verification code and your new account password.'}
          </p>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-accent-rose text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-accent-rose shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-accent-emerald text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 'email' ? (
          <form action="#" method="POST" onSubmit={handleRequestOtp} className="space-y-4" noValidate>
            <div>
              <label className="inline-flex items-center gap-1.5 text-body text-xs font-medium text-ink mb-1.5">
                <Mail className="w-4 h-4 text-accent-cyan shrink-0" />
                <span>Work or Academic Email Address</span>
                <span className="text-accent-rose font-bold">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="Please enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass(false, 'cyan')}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className={buttonClass('primary', 'lg', 'pill', 'w-full disabled:opacity-50 disabled:cursor-not-allowed')}
            >
              {isLoading ? (
                <span>Sending Code...</span>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  </>
              )}
            </button>
          </form>
        ) : (
          <form action="#" method="POST" onSubmit={handleResetPassword} className="space-y-4" noValidate>
            <div>
              <label className="inline-flex items-center gap-1.5 text-body text-xs font-medium text-ink mb-1.5">
                <KeyRound className="w-4 h-4 text-accent-cyan shrink-0" />
                <span>6-Digit Verification Code</span>
                <span className="text-accent-rose font-bold">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Please enter 6-digit verification code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className={inputClass(false, 'cyan', 'font-mono text-center tracking-widest text-lg')}
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-1.5 text-body text-xs font-medium text-ink mb-1.5">
                <Lock className="w-4 h-4 text-accent-cyan shrink-0" />
                <span>New Account Password</span>
                <span className="text-accent-rose font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Please enter your new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputClass(false, 'cyan')} pr-12`}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword((prev) => !prev);
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 pointer-events-none" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4 pointer-events-none" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !otpCode || !newPassword}
              className={buttonClass('primary', 'lg', 'pill', 'w-full disabled:opacity-50 disabled:cursor-not-allowed')}
            >
              {isLoading ? (
                <span>Resetting Password...</span>
              ) : (
                <>
                  <span>Save New Password</span>
                  </>
              )}
            </button>
          </form>
        )}

        {/* Back Link */}
        <div className="text-center pt-2 border-t border-line">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-caption text-xs text-ink-muted hover:text-ink transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </AuthCard>
    </div>
  );
}
