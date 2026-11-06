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
      className={`inline-flex items-center gap-2 sm:gap-2.5 group cursor-pointer select-none whitespace-nowrap shrink-0 ${className}`}
      title="Progeni Atlas"
      aria-label="Progeni Atlas"
    >
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#185adb] to-[#0891b2] shadow-sm transition-transform duration-200 group-hover:scale-105 sm:h-9 sm:w-9 sm:rounded-xl">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 sm:h-5 sm:w-5"
          aria-hidden="true"
        >
          <path
            d="M9 25h8l4-9 7 17 4-9h7"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="39" cy="24" r="2" fill="#a5f3fc" />
        </svg>
      </div>

      {/* Wordmark: clean bold text "talentpulse" strictly single line */}
      <div className={`${hideTextOnMobile ? 'hidden sm:flex' : 'flex'} items-center gap-1 sm:gap-1.5 whitespace-nowrap`}>
        <span className="text-lg sm:text-2xl font-bold tracking-tight text-[#1b2437]  font-sans whitespace-nowrap">
          talent<span className="text-[#185adb] ">pulse</span>
        </span>

        {badge && (
          <span className="hidden sm:inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100  text-blue-700  border border-blue-200  ml-1 whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
};
