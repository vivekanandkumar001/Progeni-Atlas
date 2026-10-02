'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export const Navbar: React.FC = () => {
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const sectionIds = ['hero', 'live-demo', 'how-it-works', 'benefits', 'scorecard', 'pricing', 'faq'];

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;
      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-slate-950/85 border-b border-slate-800/80 px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo (Left) */}
        <a href="#hero" className="flex items-center space-x-3 group cursor-pointer">
          <div className="cyan-pulse-dot" />
          <span className="text-xl font-bold tracking-tight text-white font-sans">
            TalentPulse<span className="text-[#38bdf8]">.AI</span>
          </span>
        </a>

        {/* Center Nav Anchor Links */}
        <nav className="hidden lg:flex items-center space-x-6">
          <a
            href="#how-it-works"
            className={`text-sm font-medium transition-colors ${
              activeSection === 'how-it-works' ? 'text-[#38bdf8] font-semibold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            How It Works
          </a>
          <a
            href="#live-demo"
            className={`text-sm font-medium transition-colors ${
              activeSection === 'live-demo' ? 'text-[#38bdf8] font-semibold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Interview Demo
          </a>
          <a
            href="#benefits"
            className={`text-sm font-medium transition-colors ${
              activeSection === 'benefits' ? 'text-[#38bdf8] font-semibold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Why TalentPulse
          </a>
          <a
            href="#pricing"
            className={`text-sm font-medium transition-colors ${
              activeSection === 'pricing' ? 'text-[#38bdf8] font-semibold' : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Plans
          </a>
          <Link
            href="/candidate/dashboard"
            className="text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Candidate Portal
          </Link>
          <Link
            href="/recruiter/dashboard"
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Recruiter Portal
          </Link>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-3">
          <Link
            href="/login"
            className="text-xs font-semibold text-[#94a3b8] hover:text-white transition-colors px-3 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-full text-xs font-bold text-white btn-primary-gradient shadow-md cursor-pointer whitespace-nowrap"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </header>
  );
};
