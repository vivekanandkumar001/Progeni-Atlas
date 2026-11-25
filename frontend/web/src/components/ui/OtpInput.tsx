'use client';

import React, { useEffect, useRef } from 'react';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  /** Increment to programmatically focus the first digit box (e.g. after resend). */
  focusTrigger?: number;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  hasError = false,
  autoFocus = false,
  id,
  className = '',
  focusTrigger,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const normalized = value.replace(/\D/g, '').slice(0, length);
  const digits = Array.from({ length }, (_, idx) => normalized[idx] ?? '');

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (focusTrigger !== undefined && focusTrigger > 0 && !disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [focusTrigger, disabled]);

  const commitDigits = (nextDigits: string[], nextFocusIndex?: number) => {
    const joined = nextDigits.join('').replace(/\D/g, '').slice(0, length);
    onChange(joined);
    if (typeof nextFocusIndex === 'number') {
      const clamped = Math.max(0, Math.min(length - 1, nextFocusIndex));
      inputRefs.current[clamped]?.focus();
    }
    if (joined.length === length) {
      onComplete?.(joined);
    }
  };

  const handleChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      commitDigits(next);
      return;
    }

    // Handle multi-digit autofill (e.g. OS one-time-code fill) or fast typing
    if (clean.length > 1) {
      const next = [...digits];
      const start = clean.length >= length ? 0 : index;
      for (let offset = 0; offset < clean.length && start + offset < length; offset += 1) {
        next[start + offset] = clean[offset];
      }
      const nextFocus = Math.min(length - 1, start + clean.length);
      commitDigits(next, nextFocus);
      return;
    }

    const next = [...digits];
    next[index] = clean;
    commitDigits(next, index < length - 1 ? index + 1 : index);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        commitDigits(next, index);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        commitDigits(next, index - 1);
      }
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      const next = [...digits];
      next[index] = '';
      commitDigits(next, index);
      return;
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      inputRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      inputRefs.current[length - 1]?.focus();
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    const next = Array.from({ length }, () => '');
    const start = pasted.length >= length ? 0 : index;
    if (start > 0) {
      for (let i = 0; i < start; i += 1) {
        next[i] = digits[i];
      }
    }
    for (let offset = 0; offset < pasted.length && start + offset < length; offset += 1) {
      next[start + offset] = pasted[offset];
    }
    const lastFilled = Math.min(length - 1, start + pasted.length - 1);
    commitDigits(next, lastFilled < length - 1 ? lastFilled + 1 : lastFilled);
  };

  return (
    <div
      id={id}
      role="group"
      aria-label={`${length}-digit verification code`}
      className={`flex items-center justify-between gap-1.5 sm:gap-2 ${className}`.trim()}
    >
      {digits.map((digit, idx) => {
        const isFilled = digit !== '';
        const stateClasses = hasError
          ? 'border-accent-rose/80 text-accent-rose focus:border-accent-rose focus:[box-shadow:var(--input-glow-rose)]'
          : isFilled
            ? 'border-accent-cyan/55 bg-surface text-accent-cyan focus:border-accent-cyan focus:[box-shadow:var(--input-glow-cyan)]'
            : 'border-line bg-inset text-ink hover:border-line-strong focus:border-accent-cyan focus:bg-surface focus:[box-shadow:var(--input-glow-cyan)]';

        return (
          <React.Fragment key={idx}>
            <input
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={idx === 0 ? 'one-time-code' : 'off'}
              aria-label={`Verification code digit ${idx + 1} of ${length}`}
              aria-invalid={hasError}
              value={digit}
              disabled={disabled}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={(e) => handlePaste(idx, e)}
              className={`h-12 sm:h-13 min-w-0 flex-1 max-w-[3.125rem] rounded-xl border text-center font-mono text-lg sm:text-xl font-bold tabular-nums focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${stateClasses}`}
            />
            {length === 6 && idx === 2 && (
              <span
                aria-hidden="true"
                className="w-2 h-0.5 shrink-0 rounded-full bg-line-strong mx-0.5"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
