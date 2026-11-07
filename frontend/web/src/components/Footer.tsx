'use client';

import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/common/BrandLogo';
import { ArrowUpRight, ShieldCheck, Sparkles, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-line bg-surface-deep text-ink">
      {/* Upper Main Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          
          {/* Brand Column (2 cols wide on desktop) */}
          <div className="lg:col-span-2 space-y-4">
            <BrandLogo href="/" />
            <p className="text-sm leading-relaxed text-ink-muted max-w-sm">
              Progeni Atlas is the AI mock interview platform for candidates and students to practice speaking out loud, solve live coding problems, and build confidence before real placement and tech interviews.
            </p>

            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-accent-emerald font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Interview AI Online
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-accent-cyan font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                100% Private &amp; Secure
              </span>
            </div>
          </div>

          {/* Navigation Links: Practice Rounds */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#072448] mb-4">
              Practice Rounds
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/candidate/practice" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  Live DSA &amp; Coding Round
                </Link>
              </li>
              <li>
                <Link href="/candidate/practice" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  Resume &amp; Project Defense
                </Link>
              </li>
              <li>
                <Link href="/candidate/practice" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  System Design &amp; Scaling
                </Link>
              </li>
              <li>
                <Link href="/candidate/practice" className="text-ink-muted hover:text-[#185adb] transition-colors flex items-center gap-1">
                  Behavioral &amp; HR Round
                  <ArrowUpRight className="w-3 h-3 opacity-60" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Navigation Links: Company Prep & Pricing */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#072448] mb-4">
              Packs &amp; Company Tracks
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/pricing" className="text-ink-muted hover:text-[#185adb] transition-colors font-semibold text-emerald-600">
                  Practice Packs (from ₹49)
                </Link>
              </li>
              <li>
                <Link href="/candidate/practice" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  FAANG &amp; Product Companies
                </Link>
              </li>
              <li>
                <Link href="/candidate/practice" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  Campus Placement Drives
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  How A Round Works
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  Candidate FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Navigation Links: Candidate Portal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#072448] mb-4">
              Candidate Portal
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/candidate/dashboard" className="text-ink-muted hover:text-[#185adb] transition-colors font-medium">
                  My Dashboard
                </Link>
              </li>
              <li>
                <Link href="/candidate/practice" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  Start New Mock Call
                </Link>
              </li>
              <li>
                <Link href="/candidate/skills" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  Skills &amp; Performance
                </Link>
              </li>
              <li>
                <Link href="/candidate/wallet" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  Credits &amp; Wallet
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-ink-muted hover:text-[#185adb] transition-colors">
                  Help &amp; Support
                </Link>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom Sub-Footer Bar */}
      <div className="border-t border-line/60 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted">
          <div className="flex items-center gap-2">
            <span>© 2026 Progeni Atlas. All rights reserved.</span>
            <span className="text-slate-300">·</span>
            <span>Made for candidates &amp; engineers</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/#how-it-works" className="hover:text-accent-cyan transition-colors">
              How It Works
            </Link>
            <Link href="/pricing" className="hover:text-accent-cyan transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="hover:text-accent-cyan transition-colors">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
