'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, X, GraduationCap, Video, BarChart2, BookOpen, ChevronRight } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Overview', href: '/candidate/dashboard', icon: BarChart2 },
  { name: 'My Interviews', href: '/candidate/interviews', icon: Video },
  { name: 'Skill Insights', href: '/candidate/skills', icon: GraduationCap },
  { name: 'Practice Drills', href: '/candidate/practice', icon: BookOpen },
];

export const DashboardHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-slate-950/85 border-b border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* LEFT: BRAND LOGO */}
          <div className="flex items-center gap-3">
            <Link className="flex items-center gap-2 group" href="/candidate/dashboard">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
              <span className="text-body font-bold text-slate-100 tracking-tight text-base sm:text-lg">
                TalentPulse<span className="text-cyan-400">.AI</span>
              </span>
            </Link>
          </div>

          {/* CENTER: DESKTOP NAVIGATION TABS (HIDDEN ON MOBILE) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800/80">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-all shadow-sm ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: NOTIFICATIONS, PROFILE & MOBILE HAMBURGER */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification Bell */}
            <button
              type="button"
              aria-label="View notifications"
              className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-500 ring-2 ring-slate-950"></span>
            </button>

            {/* Profile Strip (Clickable to /candidate/profile) */}
            <Link
              href="/candidate/profile"
              className="flex items-center gap-2.5 pl-1 sm:pl-2 hover:opacity-90 transition-opacity cursor-pointer group"
              title="View & Edit Candidate Profile"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xs sm:text-sm shadow-md shadow-cyan-500/10 group-hover:ring-2 group-hover:ring-cyan-400 transition-all">
                VK
              </div>

              {/* Name & Academic details hidden on mobile screen to prevent wrap */}
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-body font-semibold text-slate-200 text-xs sm:text-sm leading-tight group-hover:text-cyan-300 transition-colors">
                  Vivekanand Kumar
                </span>
                <span className="text-caption text-slate-400 text-[11px] leading-tight">
                  B.Tech CSE • 4th Year
                </span>
              </div>
            </Link>

            {/* HAMBURGER TOGGLE BUTTON (MOBILE ONLY) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 transition-colors ml-1 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* MOBILE ACCORDION / DRAWER MENU */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl px-4 py-4 space-y-2 animate-fadeIn">
          {/* User mini strip inside mobile drawer */}
          <div className="p-3 mb-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white text-sm">
              VK
            </div>
            <div>
              <p className="text-body font-semibold text-slate-100 text-sm">Vivekanand Kumar</p>
              <p className="text-caption text-cyan-400 text-xs">B.Tech CSE • 4th Year (Candidate)</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-body text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-cyan-400" />
                    <span>{item.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
