'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Menu,
  X,
  Briefcase,
  Building2,
  Sparkles,
  Users,
  FileCheck,
  ShieldCheck,
  Award,
  Video,
  FileText,
  Compass,
  CreditCard,
  PhoneCall,
  CheckCircle2,
  Mail,
  Send,
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
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check stored user session reactively, suppressing logged-in state on auth routes
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

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
    setTimeout(() => {
      setContactSubmitted(false);
      setContactModalOpen(false);
      setContactName('');
      setContactEmail('');
      setContactMsg('');
    }, 2200);
  };

  return (
    <>
      {/* 
        HEADER DESIGN MATCHING SCREENSHOT:
        - Dark navy top border strip (border-t-4 border-[#072448])
        - Clean white background (bg-white )
        - Typography: Bold dark navy font (text-[#072448] font-bold text-[15px])
        - Menu Items: Home, About Us ˅, Services ˅, Portfolio ˅, Pay Us Now, Career, Contact Us
      */}
      <header className="sticky top-0 z-50 w-full border-t-4 border-[#072448]  border-b border-line bg-white/95  backdrop-blur-md shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            
            {/* ================= LEFT SECTION: BRAND LOGO ================= */}
            <div className="flex items-center gap-6 lg:gap-10">
              <BrandLogo href="/" />

              {/* ================= CENTER SECTION: NAVIGATION MENU FROM SCREENSHOT ================= */}
              <nav ref={dropdownRef} className="hidden lg:flex items-center gap-7 xl:gap-8">
                
                {/* 1. Home */}
                <Link
                  href="/"
                  className="text-[15px] font-semibold text-[#072448]  hover:text-[#185adb]  transition-colors py-2 whitespace-nowrap shrink-0"
                >
                  Home
                </Link>

                {/* 2. About Us ˅ */}
                <div
                  className="relative py-3 whitespace-nowrap shrink-0 group"
                  onMouseEnter={() => setActiveDropdown('about')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    href="/about"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-center gap-1 text-[15px] font-semibold text-[#072448]  hover:text-[#185adb]  transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="whitespace-nowrap">About Us</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#072448]  transition-transform duration-200 ${
                        activeDropdown === 'about' ? 'rotate-180 text-[#185adb]' : 'group-hover:rotate-180'
                      }`}
                    />
                  </Link>

                  {activeDropdown === 'about' && (
                    <div className="absolute left-0 top-full -mt-1 w-72 rounded-2xl bg-white  border border-slate-200  p-3 shadow-2xl backdrop-blur-xl animate-fadeIn z-50">
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                        About Progeni Atlas
                      </p>
                      <Link
                        href="/about#mission"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <Award className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            Our Mission &amp; Vision
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Merit-driven automated AI interview intelligence
                          </p>
                        </div>
                      </Link>
                      <Link
                        href="/about#integrity"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            Anti-Bias &amp; Integrity
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Transparent rubrics and compliant evaluation
                          </p>
                        </div>
                      </Link>
                      <Link
                        href="/about#team"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <Users className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            Leadership &amp; Team
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Pioneering AI researchers &amp; system builders
                          </p>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 3. Services ˅ */}
                <div
                  className="relative py-3 whitespace-nowrap shrink-0 group"
                  onMouseEnter={() => setActiveDropdown('services')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    href="/services"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-center gap-1 text-[15px] font-semibold text-[#072448]  hover:text-[#185adb]  transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="whitespace-nowrap">Services</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#072448]  transition-transform duration-200 ${
                        activeDropdown === 'services' ? 'rotate-180 text-[#185adb]' : 'group-hover:rotate-180'
                      }`}
                    />
                  </Link>

                  {activeDropdown === 'services' && (
                    <div className="absolute left-0 top-full -mt-1 w-80 rounded-2xl bg-white  border border-slate-200  p-3 shadow-2xl backdrop-blur-xl animate-fadeIn z-50">
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                        AI Services &amp; Solutions
                      </p>
                      <Link
                        href="/services#interviewer"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <Sparkles className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            AI Voice &amp; Video Interviewer
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Adaptive real-time proctored evaluation
                          </p>
                        </div>
                      </Link>
                      <Link
                        href="/services#coding"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <FileText className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            Live Coding &amp; Sandboxes
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Multi-language runtime &amp; whiteboard
                          </p>
                        </div>
                      </Link>
                      <Link
                        href="/services#dossiers"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <Briefcase className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            Candidate Dossiers &amp; Reports
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Full-turn transcripts, scoring, &amp; metrics
                          </p>
                        </div>
                      </Link>
                      <Link
                        href="/services#rubrics"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <FileCheck className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            Custom Evaluation Rubrics
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Tailor weights for tech, soft skills, and logic
                          </p>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 4. Portfolio ˅ */}
                <div
                  className="relative py-3 whitespace-nowrap shrink-0 group"
                  onMouseEnter={() => setActiveDropdown('portfolio')}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    href="/portfolio"
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-center gap-1 text-[15px] font-semibold text-[#072448]  hover:text-[#185adb]  transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="whitespace-nowrap">Portfolio</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#072448]  transition-transform duration-200 ${
                        activeDropdown === 'portfolio' ? 'rotate-180 text-[#185adb]' : 'group-hover:rotate-180'
                      }`}
                    />
                  </Link>

                  {activeDropdown === 'portfolio' && (
                    <div className="absolute left-0 top-full -mt-1 w-72 rounded-2xl bg-white  border border-slate-200  p-3 shadow-2xl backdrop-blur-xl animate-fadeIn z-50">
                      <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                        Platform Showcase
                      </p>
                      <Link
                        href="/portfolio#showcase"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <Video className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            Interactive Platform Tour
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Experience the full interview suite
                          </p>
                        </div>
                      </Link>
                      <Link
                        href="/portfolio#case-studies"
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <Building2 className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            Client Case Studies
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Enterprise metrics and proven results
                          </p>
                        </div>
                      </Link>
                      <Link
                        href="/candidate/practice"
                        prefetch={false}
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50  transition-colors group"
                      >
                        <Compass className="w-4 h-4 text-[#185adb] mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900  group-hover:text-[#185adb] whitespace-nowrap">
                            Practice Drill Lab
                          </p>
                          <p className="text-[11px] text-slate-500 ">
                            Interactive scenario library for applicants
                          </p>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>

                {/* 5. Pay Us Now */}
                <Link
                  href="/pricing"
                  className="flex items-center gap-1 text-[15px] font-semibold text-[#072448]  hover:text-[#185adb]  transition-colors py-2 whitespace-nowrap shrink-0"
                >
                  <span className="whitespace-nowrap">Pay Us Now</span>
                </Link>

                {/* 6. Career */}
                <Link
                  href="/career"
                  className="text-[15px] font-semibold text-[#072448]  hover:text-[#185adb]  transition-colors py-2 whitespace-nowrap shrink-0"
                >
                  Career
                </Link>

                {/* 7. Contact Us */}
                <Link
                  href="/contact"
                  className="text-[15px] font-semibold text-[#072448]  hover:text-[#185adb]  transition-colors py-2 whitespace-nowrap shrink-0"
                >
                  Contact Us
                </Link>

              </nav>
            </div>

            {/* ================= RIGHT SECTION: ACTION BUTTONS + MENU TOGGLE ================= */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Action buttons (tablet & desktop) */}
              <div className="hidden sm:flex items-center gap-3">
                {!isAuthPage && currentUser ? (
                  <>
                    <Link
                      href={getDashboardLink(currentUser.role)}
                      prefetch={false}
                      className="inline-flex items-center justify-center rounded-full bg-[#072448] hover:bg-[#0c3666]   text-white px-5 py-1.5 text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        try { await logout(); } catch {}
                        setCurrentUser(null);
                        window.location.href = '/login?logout=1';
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300  hover:bg-slate-100  text-slate-700  px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center rounded-full border-2 border-[#072448]  text-[#072448]  hover:bg-slate-100  px-5 py-1.5 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
                    >
                      Login
                    </Link>

                    <Link
                      href="/register"
                      className="inline-flex items-center justify-center rounded-full bg-[#072448] hover:bg-[#0c3666]   text-white px-5 py-1.5 text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      Register
                    </Link>
                  </>
                )}
              </div>

              {/* ================= MOBILE / TABLET HAMBURGER TOGGLE ================= */}
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  aria-label="Toggle navigation menu"
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="rounded-xl border border-line p-1.5 sm:p-2 text-[#072448]  hover:bg-slate-100  transition-colors cursor-pointer shrink-0"
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ================= MOBILE DRAWER MENU ================= */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-line bg-white/98  px-4 py-4 space-y-3 animate-fadeIn z-50">
            <div className="space-y-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448]  hover:bg-slate-100  rounded-lg"
              >
                Home
              </Link>
              <Link
                href="/about"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448]  hover:bg-slate-100  rounded-lg"
              >
                About Us
              </Link>
              <Link
                href="/services"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448]  hover:bg-slate-100  rounded-lg"
              >
                Services
              </Link>
              <Link
                href="/portfolio"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448]  hover:bg-slate-100  rounded-lg"
              >
                Portfolio
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448]  hover:bg-slate-100  rounded-lg"
              >
                Pay Us Now
              </Link>
              <Link
                href="/career"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448]  hover:bg-slate-100  rounded-lg"
              >
                Career
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-semibold text-[#072448]  hover:bg-slate-100  rounded-lg"
              >
                Contact Us
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
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setMobileOpen(false);
                      try { await logout(); } catch {}
                      setCurrentUser(null);
                      window.location.href = '/login?logout=1';
                    }}
                    className="text-center rounded-full border border-slate-300  text-slate-700  px-4 py-2 text-xs font-bold"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="text-center rounded-full border-2 border-[#072448]  text-[#072448]  px-4 py-2 text-xs font-bold"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="text-center rounded-full bg-[#072448] text-white px-4 py-2 text-xs font-bold"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ================= CONTACT US MODAL ================= */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-white  border border-slate-200  p-6 sm:p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setContactModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600  hover:bg-slate-100  transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#072448] text-white flex items-center justify-center shadow-md">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#072448] ">Contact Us</h3>
                <p className="text-xs text-slate-500">Reach our team for inquiries &amp; enterprise support</p>
              </div>
            </div>

            {contactSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <h4 className="text-lg font-bold text-slate-900 ">Message Received!</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Thank you for contacting Progeni Atlas. Our support team will reach out within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700  mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Please enter your name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300  bg-slate-50  text-sm text-slate-900  focus:outline-none focus:ring-2 focus:ring-[#185adb]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700  mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Please enter your email address"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300  bg-slate-50  text-sm text-slate-900  focus:outline-none focus:ring-2 focus:ring-[#185adb]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700  mb-1">
                    Message / Requirement
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={contactMsg}
                    onChange={(e) => setContactMsg(e.target.value)}
                    placeholder="Please describe how we can help you..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300  bg-slate-50  text-sm text-slate-900  focus:outline-none focus:ring-2 focus:ring-[#185adb]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#072448] hover:bg-[#0c3666] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Inquiry</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
