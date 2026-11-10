'use client';

import React from 'react';

export type InputAccent = 'cyan' | 'indigo';

/* Single source of truth for text-field styling. Use `inputClass`
   for raw <input>/<textarea>/<select> and the <Input> component for the common case.
   Class names must stay static literals (or @theme token references) so Tailwind
   can discover them at build time — never interpolate hex values. */
export function inputClass(hasError = false, accent: InputAccent = 'cyan', className = '') {
  // Industry-standard focus: the border itself changes colour. No outer ring
  // (box-shadow) next to the border — that draws a second line around the box.
  const errorState = hasError
    ? 'border-accent-rose/80 focus:border-accent-rose shadow-[0_0_10px_rgba(244,63,94,0.2)]'
    : accent === 'indigo'
      ? 'border-line focus:border-accent-indigo'
      : 'border-line focus:border-accent-cyan';

  return `w-full px-3.5 py-2.5 rounded-xl bg-inset border text-sm text-ink placeholder-ink-muted focus:outline-none transition-all ${errorState} ${className}`.trim();
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