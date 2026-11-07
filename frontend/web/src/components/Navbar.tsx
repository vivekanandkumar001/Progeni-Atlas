'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Code2,
  FileText,
  Cpu,
  Users,
  Compass,
  ArrowRight,
  ShieldCheck,
  Building2,
  GraduationCap,
  HelpCircle,
  Tag,
  PhoneCall,
  CheckCircle2,
} from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { logout } from '@/lib/api';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const isAuthPage = Boolean(
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/verify-otp') ||
    pathname?.startsWith('/forgot-password')
  );

  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role?: string; full_name?: string; email?: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check stored user session reactively
  useEffect(() => {
    const syncUser = () => {
      if (isAuthPage) {
        setCurrentUser(null);
        return;
      }
      try {
        const raw = localStorage.getItem('tp_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.email || parsed.id || parsed._id)) {
            setCurrentUser(parsed);
            return;
          }
        }
      } catch {}
      setCurrentUser(null);
    };

    syncUser();
    window.addEventListener('storage', syncUser);
    window.addEventListener('tp_auth_change', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('tp_auth_change', syncUser);
    };
  }, [pathname, isAuthPage]);

  const getDashboardLink = (role?: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'super_admin') return '/super-admin';
    if (r === 'recruiter' || r === 'admin' || r === 'hr') return '/recruiter/dashboard';
    return '/candidate/dashboard';
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-t-4 border-[#072448] border-b border-line bg-white/95 backdrop-blur-md shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            
            {/* ================= LEFT SECTION: BRAND LOGO ================= */}
            <div className="flex items-center gap-6 lg:gap-8">
              <BrandLogo href="/" />

              {/* ================= CENTER SECTION: CANDIDATE-FIRST NAVIGATION ================= */}
              <nav ref={dropdownRef} className="hidden lg:flex items-center gap-6 xl:gap-7">
                
                {/* 1. Home */}
                <Link
                  href="/"
                  className="text-[14px] font-semibold text-[#072448] hover:text-[#185adb] transition-colors py-2 whitespace-nowrap shrink-0"
                >
                  Home
                </Link>

                {/* 2. Practice Rounds ˅ (Candidate Core Feature) */}
                <div
                  className="relative py-3 whitespace-nowrap shrink-0 group"
                  onMouseEnter={() => setActiveDropdown('rounds')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'rounds' ? null : 'rounds')}
                    className="flex items-center gap-1 text-[14px] font-semibold text-[#072448] hover:text-[#185adb] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Practice Rounds</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#072448] transition-transform duration-200 ${
                        activeDropdown === 'rounds' ? 'rotate-180 text-[#185adb]' : 'group-hover:rotate-180'
                      }`}
                    />
                  </button>

                  {activeDropdown === 'rounds' && (
                    <div className="absolute left-0 top-full -mt-1 w-80 rounded-2xl bg-white border border-slate-200 p-3 shadow-2xl backdrop-blur-xl animate-fadeIn z-50">
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                        Select Interview Round
                      </p>
                      
                      <Link
                        href="/candidate/practice"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 group-hover:bg-cyan-500/20">
                          <Code2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-[#185adb] whitespace-nowrap">
                            Live DSA &amp; Coding Round
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Solve problems in Python, C++, Java or JS with adaptive AI hints.
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/candidate/practice"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-[#185adb] whitespace-nowrap">
                            Resume &amp; Project Defense
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Get grilled on the exact tech stack &amp; projects from your resume.
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/candidate/practice"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 group-hover:bg-purple-500/20">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-[#185adb] whitespace-nowrap">
                            System Design Round
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Architecture, caching, databases &amp; scalability trade-offs.
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/candidate/practice"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-[#185adb] whitespace-nowrap">
                            Behavioral &amp; HR Round
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Master STAR method &amp; situational questions without anxiety.
                          </p>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 3. Company Prep ˅ */}
                <div
                  className="relative py-3 whitespace-nowrap shrink-0 group"
                  onMouseEnter={() => setActiveDropdown('companies')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'companies' ? null : 'companies')}
                    className="flex items-center gap-1 text-[14px] font-semibold text-[#072448] hover:text-[#185adb] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Company Prep</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#072448] transition-transform duration-200 ${
                        activeDropdown === 'companies' ? 'rotate-180 text-[#185adb]' : 'group-hover:rotate-180'
                      }`}
                    />
                  </button>

                  {activeDropdown === 'companies' && (
                    <div className="absolute left-0 top-full -mt-1 w-72 rounded-2xl bg-white border border-slate-200 p-3 shadow-2xl backdrop-blur-xl animate-fadeIn z-50">
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                        Targeted Interview Tracks
                      </p>
                      
                      <Link
                        href="/candidate/practice"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                      >
                        <Building2 className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-[#185adb] whitespace-nowrap">
                            FAANG &amp; Product Companies
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Google, Amazon, Microsoft, Uber
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/candidate/practice"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                      >
                        <GraduationCap className="w-4 h-4 text-emerald-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-[#185adb] whitespace-nowrap">
                            Campus Placement Drives
                          </p>
                          <p className="text-[11px] text-slate-500">
                            TCS Digital, Infosys, Wipro, Accenture
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/candidate/practice"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                      >
                        <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 group-hover:text-[#185adb] whitespace-nowrap">
                            High-Growth Startups
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Swiggy, Zomato, Razorpay, Zepto
                          </p>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 4. How It Works */}
                <Link
                  href="/#how-it-works"
                  className="text-[14px] font-semibold text-[#072448] hover:text-[#185adb] transition-colors py-2 whitespace-nowrap shrink-0"
                >
                  How It Works
                </Link>

                {/* 5. Pricing (Student Packs from ₹49) */}
                <Link
                  href="/pricing"
                  className="flex items-center gap-1.5 text-[14px] font-semibold text-[#072448] hover:text-[#185adb] transition-colors py-2 whitespace-nowrap shrink-0"
                >
                  <span>Pricing</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    ₹49 Packs
                  </span>
                </Link>

                {/* 6. FAQ */}
                <Link
                  href="/#faq"
                  className="text-[14px] font-semibold text-[#072448] hover:text-[#185adb] transition-colors py-2 whitespace-nowrap shrink-0"
                >
                  FAQ
                </Link>

              </nav>
            </div>

            {/* ================= RIGHT SECTION: CANDIDATE ACTIONS ================= */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-3">
                {!isAuthPage && currentUser ? (
                  <>
                    <Link
                      href={getDashboardLink(currentUser.role)}
                      prefetch={false}
                      className="inline-flex items-center justify-center rounded-full bg-[#072448] hover:bg-[#0c3666] text-white px-5 py-2 text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      My Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        try { await logout(); } catch {}
                        setCurrentUser(null);
                        window.location.href = '/login?logout=1';
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 hover:bg-slate-100 text-slate-700 px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 hover:border-slate-400 text-[#072448] hover:bg-slate-50 px-5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
                    >
                      Login
                    </Link>

                    {/* Candidate Primary CTA: Start Free Interview */}
                    <Link
                      href="/candidate/practice"
                      prefetch={false}
                      className="sheen-sweeper group inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:brightness-110 text-white px-5 py-2 text-xs sm:text-sm font-bold transition-all shadow-md shadow-cyan-600/20 cursor-pointer whitespace-nowrap"
                    >
                      <span>Start Free Mock</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Hamburger */}
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  aria-label="Toggle navigation menu"
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="rounded-xl border border-line p-1.5 sm:p-2 text-[#072448] hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-line bg-white/98 px-4 py-4 space-y-3 animate-fadeIn z-50">
            <div className="space-y-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448] hover:bg-slate-100 rounded-lg"
              >
                Home
              </Link>
              <Link
                href="/candidate/practice"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448] hover:bg-slate-100 rounded-lg"
              >
                Live Coding &amp; DSA Practice
              </Link>
              <Link
                href="/candidate/practice"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448] hover:bg-slate-100 rounded-lg"
              >
                Resume &amp; Project Defense
              </Link>
              <Link
                href="/candidate/practice"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448] hover:bg-slate-100 rounded-lg"
              >
                Company-Specific Tracks
              </Link>
              <Link
                href="/#how-it-works"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448] hover:bg-slate-100 rounded-lg"
              >
                How It Works
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg font-bold"
              >
                Pricing (Student Packs from ₹49)
              </Link>
              <Link
                href="/#faq"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448] hover:bg-slate-100 rounded-lg"
              >
                FAQ
              </Link>
            </div>

            <div className="pt-3 border-t border-line">
              {!isAuthPage && currentUser ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={getDashboardLink(currentUser.role)}
                    prefetch={false}
                    onClick={() => setMobileOpen(false)}
                    className="text-center rounded-full bg-[#072448] text-white px-4 py-2 text-xs font-bold"
                  >
                    My Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setMobileOpen(false);
                      try { await logout(); } catch {}
                      setCurrentUser(null);
                      window.location.href = '/login?logout=1';
                    }}
                    className="text-center rounded-full border border-slate-300 text-slate-700 px-4 py-2 text-xs font-bold"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="text-center rounded-full border-2 border-[#072448] text-[#072448] px-4 py-2 text-xs font-bold"
                  >
                    Login
                  </Link>
                  <Link
                    href="/candidate/practice"
                    onClick={() => setMobileOpen(false)}
                    className="text-center rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 text-white px-4 py-2 text-xs font-bold shadow-sm"
                  >
                    Start Free Mock
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
};
