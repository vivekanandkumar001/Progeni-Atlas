'use client';

import React from 'react';

export type InputAccent = 'cyan' | 'indigo';

/* Single source of truth for text-field styling. Use `inputClass`
   for raw <input>/<textarea>/<select> and the <Input> component for the common case.
   Class names must stay static literals (or @theme token references) so Tailwind
   can discover them at build time — never interpolate hex values. */
export function inputClass(hasError = false, accent: InputAccent = 'cyan', className = '') {
  // Single-border focus with soft diffused bottom elevation (--input-glow-*).
  // No outer ring or outline next to the border — never draws a second line.
  const errorState = hasError
    ? 'border-accent-rose/80 focus:border-accent-rose focus:[box-shadow:var(--input-glow-rose)]'
    : accent === 'indigo'
      ? 'border-line hover:border-line-strong focus:border-accent-indigo focus:bg-surface focus:[box-shadow:var(--input-glow-indigo)]'
      : 'border-line hover:border-line-strong focus:border-accent-cyan focus:bg-surface focus:[box-shadow:var(--input-glow-cyan)]';

  return `w-full px-3.5 py-2.5 rounded-xl bg-inset border text-sm text-ink placeholder-ink-muted focus:outline-none transition-[border-color,box-shadow,background-color] duration-150 ${errorState} ${className}`.trim();
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  accent?: InputAccent;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ hasError = false, accent = 'cyan', className = '', placeholder, ...props }, ref) => {
    return (
      <input ref={ref} className={inputClass(hasError, accent, className)} placeholder={placeholder} {...props} />
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
  accent?: InputAccent;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ hasError = false, accent = 'cyan', className = '', placeholder, ...props }, ref) => {
    return (
      <textarea ref={ref} className={inputClass(hasError, accent, className)} placeholder={placeholder} {...props} />
    );
  }
);

Textarea.displayName = 'Textarea';