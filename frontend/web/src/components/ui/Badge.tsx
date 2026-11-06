'use client';

import React from 'react';

export type BadgeVariant = 'cyan' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'neutral';
export type BadgeSize = 'sm' | 'md';
export type BadgeShape = 'rounded' | 'pill';

/* Single source of truth for status/metadata badges. Matches the dominant
   in-app look: mono, pill, tinted (bg-<c>-500/10 + text-accent-<c> + border). */
export function badgeClass(
  variant: BadgeVariant = 'cyan',
  size: BadgeSize = 'md',
  shape: BadgeShape = 'pill',
  iconSize: keyof typeof ICON_SIZES = 'md',
  className = ''
) {
  return `${BASE} ${ICON_SIZES[iconSize]} ${SIZES[size]} ${SHAPES[shape]} ${VARIANTS[variant]} ${className}`.trim();
}

const BASE = 'inline-flex items-center gap-1.5 font-mono font-bold transition-colors';

const ICON_SIZES = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const SIZES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px] sm:text-[11px]',
  md: 'px-2.5 py-0.5 text-[11px]',
};

const SHAPES: Record<BadgeShape, string> = {
  rounded: 'rounded-lg',
  pill: 'rounded-full',
};

/* Variants must stay static literals (or @theme token references from
   globals.css) so Tailwind can discover them at build time — never
   interpolate hex values into class names. */
const VARIANTS: Record<BadgeVariant, string> = {
  cyan: 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30',
  indigo: 'bg-accent-indigo/10 text-accent-indigo border border-accent-indigo/30',
  emerald: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30',
  amber: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30',
  rose: 'bg-accent-rose/10 text-accent-rose border border-accent-rose/30',
  neutral: 'bg-surface text-ink-muted border border-line',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  shape?: BadgeShape;
  iconSize?: 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'cyan',
  size = 'md',
  shape = 'pill',
  iconSize = 'md',
  className = '',
  ...props
}) => (
  <span className={badgeClass(variant, size, shape, iconSize, className)} {...props}>
    {children}
  </span>
);

Badge.displayName = 'Badge';