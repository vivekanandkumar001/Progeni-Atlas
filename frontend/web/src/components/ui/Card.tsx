'use client';

import React from 'react';

/* Default surface card used across the app: consistent radius, hairline border,
   soft shadow and glass blur. Class names must stay static literals (or @theme
   token references) so Tailwind can discover them at build time. */
export function cardClass(className = '') {
  return `rounded-2xl border border-line bg-surface shadow-lg backdrop-blur-md ${className} transition-colors`.trim();
}

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div className={cardClass(className)} {...props}>
    {children}
  </div>
);

/* Featured card with a cyan→indigo gradient hairline ring. Used for the
   authentication screens so they share one premium treatment. */
export interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  children,
  className = '',
  innerClassName = ''
}) => (
  <div
    className={`w-full rounded-3xl bg-gradient-to-br from-brand-from/50 via-[#8b5cf6]/50 to-brand-to/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_-24px_rgba(6,182,212,0.45)] ${className} transition-colors hover:bg-surface/95`}
  >
    <div className={`rounded-[29px] bg-surface p-6 sm:p-8 ${innerClassName}`.trim()}>
      {children}
    </div>
  </div>
);