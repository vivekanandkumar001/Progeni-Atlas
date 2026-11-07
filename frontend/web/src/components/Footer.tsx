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
              Progeni Atlas is the enterprise platform for autonomous, two-way technical video interviews. Adaptive AI interviewers evaluate real candidate competency from resume context to live code execution.
            </p>

            <div className="pt-2 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-accent-emerald font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                All Systems Operational
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-accent-cyan font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                SOC-2 &amp; GDPR Compliant
              </span>
            </div>
          </div>

          {/* Navigation Links: Platform & Services */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#072448]  mb-4">
              Platform &amp; Services
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/services" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  AI Video Interviewer
                </Link>
              </li>
              <li>
                <Link href="/services#coding" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  Live Coding Sandbox
                </Link>
              </li>
              <li>
                <Link href="/services#proctoring" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  AI Proctoring Intelligence
                </Link>
              </li>
              <li>
                <Link href="/services#dossiers" className="text-ink-muted hover:text-[#185adb]  transition-colors flex items-center gap-1">
                  Candidate Dossiers
                  <ArrowUpRight className="w-3 h-3 opacity-60" />
                </Link>
              </li>
              <li>
                <Link href="/services#rubrics" className="text-ink-muted hover:text-[#185adb]  transition-colors flex items-center gap-1">
                  Custom Rubrics
                  <ArrowUpRight className="w-3 h-3 opacity-60" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Navigation Links: Showcase & Pricing */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#072448]  mb-4">
              Explore &amp; Plans
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/portfolio" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  Platform Showcase
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-ink-muted hover:text-[#185adb]  transition-colors font-medium">
                  Pay Us Now (Pricing)
                </Link>
              </li>
              <li>
                <Link href="/candidate/practice" prefetch={false} className="text-ink-muted hover:text-[#185adb]  transition-colors flex items-center gap-1">
                  Practice Drill Lab
                  <ArrowUpRight className="w-3 h-3 opacity-60" />
                </Link>
              </li>
              <li>
                <Link href="/portfolio#case-studies" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  Client Case Studies
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
            </ul>
          </div>

          {/* Navigation Links: Company */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#072448]  mb-4">
              Company
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/about" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/career" className="text-ink-muted hover:text-[#185adb]  transition-colors flex items-center gap-1.5 font-medium">
                  Career
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600  font-bold border border-emerald-500/20">
                    We&apos;re Hiring
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  Candidate Login
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-ink-muted hover:text-[#185adb]  transition-colors">
                  Sign Up Free
                </Link>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Lower Copyright & Legal Strip */}
      <div className="border-t border-line bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-faint">
          <p>© {new Date().getFullYear()} Progeni Atlas Technologies Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/about#integrity" className="hover:text-ink transition-colors">Anti-Bias Ethics</Link>
            <Link href="/contact" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-ink transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-ink transition-colors">Security Audit</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
