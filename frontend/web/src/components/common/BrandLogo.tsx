import React from 'react';
import Link from 'next/link';

interface BrandLogoProps {
  href?: string;
  badge?: string;
  className?: string;
  hideTextOnMobile?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  href = '/',
  badge,
  className = '',
  hideTextOnMobile = false,
}) => {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 sm:gap-3 group cursor-pointer select-none whitespace-nowrap shrink-0 ${className}`}
      title="Progeni Atlas — Autonomous AI Interviews"
      aria-label="Progeni Atlas"
    >
      {/* Dynamic Atlas AI Isometric Emblem */}
      <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900 p-1 shadow-sm transition-all duration-200 group-hover:scale-105 border border-blue-400/30">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full drop-shadow-xs"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="logo-facet-top" x1="6" y1="4" x2="42" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="logo-facet-left" x1="6" y1="14" x2="24" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="logo-facet-right" x1="24" y1="14" x2="42" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#1e40af" />
            </linearGradient>
          </defs>

          {/* Hexagonal Isometric Base */}
          <path d="M24 4.5L41 14.2V15L24 24.5L7 15V14.2L24 4.5Z" fill="url(#logo-facet-top)" />
          <path d="M7 15.5L23.5 24.8V43.5L7 34V15.5Z" fill="url(#logo-facet-left)" />
          <path d="M41 15.5L24.5 24.8V43.5L41 34V15.5Z" fill="url(#logo-facet-right)" />

          {/* Facet Highlights */}
          <path d="M24 24.5V43.5" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.35" />
          <path d="M7 15L24 24.5L41 15" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.4" />

          {/* Inner Geometric "A" Crest + Neural Bridge */}
          <path d="M15 32L24 13L33 32" stroke="#ffffff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.5 24.5H29.5" stroke="#bfdbfe" strokeWidth="2.8" strokeLinecap="round" />

          {/* Central AI Nucleus Core */}
          <circle cx="24" cy="18.5" r="3" fill="#ffffff" />
          <circle cx="24" cy="18.5" r="5" stroke="#93c5fd" strokeWidth="1" strokeOpacity="0.9" />
        </svg>
      </div>

      {/* Wordmark: 100% Solid High-Contrast "Progeni Atlas" */}
      <div className={`${hideTextOnMobile ? 'hidden sm:flex' : 'flex'} items-center gap-1.5 whitespace-nowrap`}>
        <span className="text-xl sm:text-2xl font-black tracking-tight font-sans whitespace-nowrap flex items-center">
          <span className="text-slate-900">Progeni</span>
          <span className="ml-1 text-blue-600">Atlas</span>
        </span>

        {/* AI Tech Pill Badge */}
        <span className="inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 ml-0.5 whitespace-nowrap">
          {badge || 'AI'}
        </span>
      </div>
    </Link>
  );
};
