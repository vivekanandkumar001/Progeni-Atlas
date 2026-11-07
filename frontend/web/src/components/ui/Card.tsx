'use client';

import React from 'react';

/* Default surface card used across the app: consistent radius, hairline border,
   soft shadow and glass blur. Class names must stay static literals (or @theme
   token references) so Tailwind can discover them at build time. */
export function cardClass(className = '') {
  return `rounded-xl border border-slate-200 bg-white shadow-xs ${className} transition-all`.trim();
}

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<CardProps> = ({ className = '', children, ...props }) => (
  <div className={cardClass(className)} {...props}>
    {children}
  </div>
);

/* Clean, modern enterprise auth container */
export interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  children,
  className = '',
  innerClassName = '',
}) => (
  <div
    className={`w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl ${className} transition-all`}
  >
    <div className={`${innerClassName}`.trim()}>
      {children}
    </div>
  </div>
);
