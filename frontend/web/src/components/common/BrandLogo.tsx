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
      title="Progeni Atlas"
      aria-label="Progeni Atlas"
    >
      {/* Dynamic Atlas AI Emblem */}
      <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0284c7] via-[#2563eb] to-[#4f46e5] shadow-md shadow-blue-500/20 transition-all duration-300 group-hover:scale-105 group-hover:shadow-blue-500/35 border border-white/20">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 sm:h-5.5 sm:w-5.5 drop-shadow-sm"
          aria-hidden="true"
        >
          {/* Left ascending facet / bracket */}
          <path
            d="M13 35L24 11L28 19"
            stroke="#ffffff"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Right descending facet */}
          <path
            d="M35 35L28.5 21"
            stroke="#a5f3fc"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Central data nexus cross-beam */}
          <path
            d="M17.5 27H30.5"
            stroke="#38bdf8"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Glowing AI Intelligence Core Orb */}
          <circle cx="24" cy="19.5" r="2.75" fill="#ffffff" />
          <circle cx="24" cy="19.5" r="4.75" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.8" />
        </svg>
      </div>

      {/* Wordmark: Crystal-clear "Progeni Atlas" with permanent high-contrast colors */}
      <div className={`${hideTextOnMobile ? 'hidden sm:flex' : 'flex'} items-center gap-1.5 whitespace-nowrap`}>
        <span className="text-xl sm:text-2xl font-black tracking-tight font-sans whitespace-nowrap flex items-center">
          <span className="text-[#072448]">Progeni</span>
          <span className="ml-1 bg-gradient-to-r from-[#185adb] via-[#0284c7] to-[#0ea5e9] bg-clip-text text-transparent">
            Atlas
          </span>
        </span>

        {/* AI Tech Badge */}
        <span className="inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-500/10 text-[#185adb] border border-blue-500/25 ml-0.5 whitespace-nowrap shadow-xs">
          {badge || 'AI'}
        </span>
      </div>
    </Link>
  );
};
