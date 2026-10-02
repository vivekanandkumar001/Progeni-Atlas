'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, RefreshCw, KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // SECURITY: the real OTP is never rendered, stored, or logged on the client.
  // Only the 6 user-typed digits (for submission) exist in component state.


  const email = searchParams.get('email') || 'candidate@example.com';
  const purpose = searchParams.get('purpose') || 'REGISTRATION_VERIFY';

  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [countdown, setCountdown] = useState<number>(120); // synced from server on mount
  const [cooldown, setCooldown] = useState<number>(0);     // synced from server; resend allowed when 0
  const [isResending, setIsResending] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Sync timers with server truth on mount (fixes stale 02:00 display when
  // the OTP already expired server-side, and unblocks resend correctly).
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const res = await fetch(
          getApiUrl(`/api/auth/otp-status?email=${encodeURIComponent(email)}&purpose=${encodeURIComponent(purpose)}`),
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCountdown(typeof data.expiresInSec === 'number' ? data.expiresInSec : 0);
        setCooldown(typeof data.cooldownRemainingSec === 'number' ? data.cooldownRemainingSec : 0);
        setIsExpired(Boolean(data.expired) || (data.expiresInSec ?? 0) <= 0);
        if (data.expired) {
          setErrorMsg('This verification code has expired. Please request a new code below.');
        }
      } catch {
        // Keep local defaults; backend remains the source of truth on verify.
      }
    };
    sync();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, purpose]);

  // Expiry countdown timer (UI indicator only — backend enforces expiry)
  useEffect(() => {
    if (countdown <= 0) {
      setIsExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle single digit input and auto-advance
  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits entered
    if (newOtp.every((digit) => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split('');
      setOtp(digits);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  // Submit OTP Verification (code is user-typed only; never rendered by the app)
  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || otp.join('');
    if (!/^\d{6}$/.test(code)) {
      setErrorMsg('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(getApiUrl('/api/auth/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code, purpose }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.expired) {
          setIsExpired(true);
          setCountdown(0);
        }
        throw new Error(data.error || 'Verification failed.');
      }

      setSuccessMsg('Email verified successfully! Redirecting...');
      setOtp(Array(6).fill(''));
      setTimeout(() => {
        router.push(data.redirectUrl || '/candidate/dashboard');
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP Code (rate-limited server-side; old code invalidated)
  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(getApiUrl('/api/auth/resend-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (typeof data.cooldownRemainingSec === 'number') {
          setCooldown(data.cooldownRemainingSec);
        }
        throw new Error(data.error || 'Failed to resend code.');
      }

      // Success is shown ONLY after the backend confirms provider handoff.
      setSuccessMsg('A new 6-digit code has been sent to your email.');
      setCountdown(typeof data.expiresInSec === 'number' ? data.expiresInSec : 120);
      setCooldown(typeof data.cooldownSec === 'number' ? data.cooldownSec : 30);
      setIsExpired(false);
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
            {purpose === 'FORGOT_PASSWORD' ? 'Reset Password Verification' : 'Verify Your Email'}
          </h1>
          <p className="text-body text-sm text-slate-400 max-w-xs mx-auto">
            We sent a 6-digit numeric verification code to{' '}
            <span className="text-slate-200 font-semibold underline decoration-cyan-500/40">{email}</span>.
          </p>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {(isExpired || countdown <= 0) && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Verification code has expired. Please click &quot;Resend New 6-Digit Code&quot; below.</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 6-Digit PIN Inputs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={isExpired || countdown <= 0}
                className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono bg-slate-950/70 border border-slate-800 rounded-xl text-cyan-300 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all shadow-inner disabled:opacity-40"
              />
            ))}
          </div>

          {/* Timers Row */}
          <div className="flex items-center justify-between text-caption text-xs font-mono pt-1 text-slate-400">
            <div className="flex items-center gap-1.5">
              <span>Code expires in:</span>
              <span className={`font-semibold ${countdown < 30 ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`}>
                {formatTime(countdown)}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Verify Button */}
        <button
          type="button"
          onClick={() => handleVerify()}
          disabled={isVerifying || otp.some((d) => !d) || countdown <= 0 || isExpired}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-cyan-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isVerifying ? (
            <span>Verifying Code...</span>
          ) : (
            <>
              <span>Verify & Continue</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Resend Code Section */}
        <div className="pt-2 border-t border-slate-800/80 text-center space-y-2">
          <p className="text-body text-xs text-slate-400">
            Didn&apos;t receive the code or expired?
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
            {cooldown > 0 ? (
              <span>Resend Code in {formatTime(cooldown)}</span>
            ) : (
              <span>Resend New 6-Digit Code</span>
            )}
          </button>
        </div>

        {/* Back Link */}
        <div className="text-center pt-1">
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

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400 text-sm">
          Loading verification...
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
