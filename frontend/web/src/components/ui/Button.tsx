'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'rounded' | 'pill';

/* ------------------------------------------------------------------ classes
   Single source of truth for button styling across the app. Use `buttonClass`
   on <button>, <Link> and <a> so every action looks identical. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  shape: ButtonShape = 'rounded',
  className = ''
) {
  return `${BASE} ${SIZES[size]} ${SHAPES[shape]} ${VARIANTS[variant]} ${className}`.trim();
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer select-none';

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[36px]',
  md: 'px-5 py-2.5 text-xs sm:text-sm min-h-[44px]',
  lg: 'px-6 py-3.5 text-sm sm:text-base min-h-[50px]',
};

const SHAPES: Record<ButtonShape, string> = {
  rounded: 'rounded-xl',
  pill: 'rounded-full',
};

/* All class names must be static literals (or reference @theme tokens from
   globals.css) so Tailwind can discover them at build time — never interpolate
   hex values into class names. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-brand-from to-brand-to text-on-brand shadow-lg shadow-cyan-500/20 hover:brightness-110 hover:shadow-brand-from/30 active:scale-[0.99]',
  secondary:
    'bg-surface-2 text-ink border border-line-strong hover:bg-surface-3 hover:border-line-strong',
  outline:
    'border border-line-strong bg-surface text-ink hover:border-accent-cyan/50 hover:bg-surface-2',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  destructive: 'bg-rose-500 text-white hover:bg-rose-600 shadow-md shadow-rose-500/20',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      shape = 'rounded',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={buttonClass(variant, size, shape, className)}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 animate-spin shrink-0 text-current" />
          <span>{'Loading...'}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  )
);

Button.displayName = 'Button';