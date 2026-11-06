'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, RefreshCw, KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { apiFetch, persistSession } from '@/lib/api';
import { AuthCard, buttonClass, inputClass } from '@/components/ui';
import { RESEND_CODE } from '@/constants/ui_strings';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // SECURITY: the real OTP is never rendered, stored, or logged on the client.
  // Only the 6 user-typed digits (for submission) exist in component state.


  const rawEmail = searchParams.get('email');
  const email = (rawEmail || '').trim().toLowerCase();
  const purpose = searchParams.get('purpose') || 'REGISTRATION_VERIFY';

  // Redirect to /register if email query param is missing
  useEffect(() => {
    if (!email) {
      router.replace('/register?error=' + encodeURIComponent('Please register or provide your email to verify your account.'));
    }
  }, [email, router]);

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
    if (!email) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const res = await apiFetch(
          `/api/auth/otp-status?email=${encodeURIComponent(email)}&purpose=${encodeURIComponent(purpose)}`,
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
      const res = await apiFetch('/api/auth/verify-otp', {
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

      // A REGISTRATION_VERIFY OTP is what completes signup, so the response now
      // carries the minted access/refresh pair. It has to be persisted here or the
      // redirect target immediately bounces back to /login for lack of a session.
      // A FORGOT_PASSWORD OTP deliberately returns no session — that user must log
      // in with the new password.
      if (purpose === 'REGISTRATION_VERIFY') {
        const token = data.access_token || data.token;
        if (token || data.user) {
          persistSession(token, undefined, data.user || {});
        }
      }

      setSuccessMsg('Email verified successfully! Redirecting...');
      setOtp(Array(6).fill(''));
      setTimeout(() => {
        const dest = data.redirectUrl || '/candidate/dashboard';
        if (typeof window !== 'undefined') {
          window.location.assign(dest);
        } else {
          router.push(dest);
        }
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verification failed. Please try again.');
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
      const res = await apiFetch('/api/auth/resend-otp', {
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
      setCooldown(typeof data.cooldownSec === 'number' ? data.cooldownSec : 120);
      setIsExpired(false);
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col justify-center items-center p-4">
        <AuthCard className="max-w-md" innerClassName="text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-accent-amber mx-auto" />
          <h2 className="text-xl font-bold text-ink">Verification Email Required</h2>
          <p className="text-sm text-ink-muted">
            No email address was provided for verification. Redirecting to registration...
          </p>
        </AuthCard>
      </div>
    );
  }

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
            {purpose === 'FORGOT_PASSWORD' ? 'Reset Password Verification' : 'Verify Your Email'}
          </h1>
          <p className="text-body text-sm text-ink-muted max-w-xs mx-auto">
            We sent a 6-digit numeric verification code to{' '}
            <span className="text-ink font-semibold underline decoration-cyan-500/40">{email}</span>.
          </p>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-accent-rose text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-accent-rose shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {(isExpired || countdown <= 0) && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-accent-amber text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
            <span>Verification code has expired. Please click &quot;Resend New 6-Digit Code&quot; below.</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-accent-emerald text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
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
                className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono bg-inset border border-line rounded-xl text-accent-cyan focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all shadow-inner disabled:opacity-40"
              />
            ))}
          </div>

          {/* Timers Row */}
          <div className="flex items-center justify-between text-caption text-xs font-mono pt-1 text-ink-muted">
            <div className="flex items-center gap-1.5">
              <span>Code expires in:</span>
              <span className={`font-semibold ${countdown < 30 ? 'text-accent-rose animate-pulse' : 'text-accent-cyan'}`}>
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
          className={buttonClass('primary', 'lg', 'pill', 'w-full disabled:opacity-50 disabled:cursor-not-allowed')}
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
        <div className="pt-2 border-t border-line text-center space-y-2">
          <p className="text-body text-xs text-ink-muted">
            Didn&apos;t receive the code or expired?
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-cyan disabled:text-ink-faint disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
            {cooldown > 0 ? (
              <span>{RESEND_CODE} in {formatTime(cooldown)}</span>
            ) : (
              <span>Resend New 6-Digit Code</span>
            )}
          </button>
        </div>

        {/* Back Link */}
        <div className="text-center pt-1">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-caption text-xs text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>
      </AuthCard>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center text-ink-muted text-sm">
          LOADING_VERIFICATION
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
