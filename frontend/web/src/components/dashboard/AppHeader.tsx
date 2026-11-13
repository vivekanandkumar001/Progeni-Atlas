'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Menu,
  X,
  LogOut,
  ChevronDown,
  User,
  Wallet,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';

export interface AppHeaderNavLink {
  name: string;
  href: string;
  icon?: LucideIcon;
}

export interface AppHeaderProps {
  /** Link target of the brand logo. */
  brandHref: string;
  /** Optional badge rendered next to the brand wordmark (e.g. "Enterprise"). */
  brandBadge?: string;
  /** Navigation links rendered in the desktop nav and the mobile drawer. */
  navLinks: AppHeaderNavLink[];
  /** Optional wallet credit indicator pill */
  walletBadge?: {
    credits: number;
    inr: number;
    href: string;
  };
  /** Indicator rendered inside the notification bell (count badge, status dot, ...). */
  notificationIndicator?: React.ReactNode;
  /** Heading shown in the notifications dropdown. */
  notificationTitle: string;
  /** Extra classes for the notifications dropdown header row (preserves exact padding). */
  notificationHeaderClassName: string;
  /** Extra classes for the notifications dropdown body wrapper (preserves exact sizing). */
  notificationBodyClassName: string;
  /** Content of the notifications dropdown body. */
  notificationBody?: React.ReactNode;
  /** Called with the new open state whenever the notifications dropdown toggles. */
  onNotificationsOpenChange?: (open: boolean) => void;
  /** Link target of the profile pill / drawer profile card. */
  profileHref: string;
  /** Tooltip shown on the desktop profile pill. */
  profileTitle: string;
  /** Background classes for the avatar circles (desktop pill and drawer card). */
  profileAvatarClassName: string;
  /** Initials rendered inside the avatar circles. */
  profileInitials: React.ReactNode;
  /** Display name shown on the desktop pill and the drawer card. */
  profileName: React.ReactNode;
  /** Subtitle shown on the desktop profile pill. */
  profileSubtitle: React.ReactNode;
  /** Extra classes inside the desktop subtitle span (e.g. "truncate"/"font-mono"). */
  profileSubtitleClassName: string;
  /** Subtitle content shown in the drawer profile card. */
  drawerProfileSubtitle: React.ReactNode;
  /** Extra classes inside the drawer subtitle paragraph (e.g. "text-xs truncate"). */
  drawerProfileSubtitleClassName: string;
  /** Label of the logout buttons (desktop title/aria-label and drawer text). */
  logoutLabel: string;
  /** Logout action shared by the desktop and drawer logout buttons. */
  onLogout: () => void | Promise<void>;
  /** Optional extra drawer content rendered after the nav links; receives a close callback. */
  drawerExtra?: (closeMobileMenu: () => void) => React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  brandHref,
  brandBadge,
  navLinks,
  walletBadge,
  notificationIndicator,
  notificationTitle,
  notificationHeaderClassName,
  notificationBodyClassName,
  notificationBody,
  onNotificationsOpenChange,
  profileHref,
  profileTitle,
  profileAvatarClassName,
  profileInitials,
  profileName,
  profileSubtitle,
  profileSubtitleClassName,
  drawerProfileSubtitle,
  drawerProfileSubtitleClassName,
  logoutLabel,
  onLogout,
  drawerExtra,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const pathname = usePathname();

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
        onNotificationsOpenChange?.(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onNotificationsOpenChange]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const toggleNotifications = () => {
    const nextState = !notificationsOpen;
    setNotificationsOpen(nextState);
    if (nextState) setProfileDropdownOpen(false);
    onNotificationsOpenChange?.(nextState);
  };

  const toggleProfileDropdown = () => {
    const nextState = !profileDropdownOpen;
    setProfileDropdownOpen(nextState);
    if (nextState) {
      setNotificationsOpen(false);
      onNotificationsOpenChange?.(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-surface/90 border-b border-line shadow-xs transition-all">
      <div className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-6">

          {/* ================= LEFT SECTION: LOGO + PILL NAV ================= */}
          <div className="flex items-center gap-3 sm:gap-6 lg:gap-8 shrink-0">
            <BrandLogo href={brandHref} badge={brandBadge} hideTextOnMobile />

            {/* Modern Segmented Navigation Bar */}
            <nav className="hidden lg:flex items-center p-1 rounded-xl bg-surface-2 border border-line">
              {navLinks.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/candidate/dashboard' && item.href !== '/recruiter/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                      isActive
                        ? 'bg-surface text-accent-cyan shadow-xs border border-line font-bold'
                        : 'text-ink-muted hover:text-ink hover:bg-surface border border-transparent'
                    }`}
                  >
                    {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent-cyan' : 'text-ink-faint'}`} />}
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ================= RIGHT SECTION: THEME, WALLET BADGE, NOTIF, PROFILE ================= */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">

            <ThemeToggle />

            {/* Optional Live Wallet Pill (Fintech / SaaS standard) */}
            {walletBadge && (
              <Link
                href={walletBadge.href}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-cyan/10 hover:bg-accent-cyan/20 border border-accent-cyan/25 text-xs font-bold text-accent-cyan transition-all group shadow-xs cursor-pointer shrink-0"
                title="Available Interview Balance"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <Wallet className="w-3.5 h-3.5 text-accent-cyan group-hover:scale-110 transition-transform" />
                <span>₹{Math.max(0, walletBadge.inr).toFixed(2)}</span>
                <span className="hidden xl:inline text-[10px] text-ink-muted font-medium">({Math.max(0, walletBadge.credits)} cr)</span>
              </Link>
            )}

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                aria-label="View notifications"
                aria-expanded={notificationsOpen}
                onClick={toggleNotifications}
                className={`relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-all shadow-xs ${notificationsOpen
                    ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan'
                    : 'border-line/80 bg-surface text-ink-muted hover:border-line hover:bg-surface-2 hover:text-ink'
                  }`}
              >
                <Bell className="h-4 w-4 text-current" />
                {notificationIndicator}
              </button>

              {/* Notification Popover */}
              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-[60] w-[calc(100vw-2rem)] max-w-sm sm:w-80 rounded-2xl border border-line bg-surface p-4 shadow-2xl animate-fadeIn">
                  <div className={`flex items-center justify-between border-b border-line ${notificationHeaderClassName}`}>
                    <p className="text-sm font-bold text-ink">{notificationTitle}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        onNotificationsOpenChange?.(false);
                      }}
                      className="text-xs font-semibold text-accent-cyan hover:underline px-2 py-1 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className={`mt-3 space-y-2 ${notificationBodyClassName}`}>
                    {notificationBody}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Menu (Industry Standard) */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={toggleProfileDropdown}
                aria-label={profileTitle}
                aria-expanded={profileDropdownOpen}
                className={`flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl border py-1 pl-1.5 pr-2.5 transition-all shadow-xs ${profileDropdownOpen
                    ? 'border-accent-cyan/40 bg-accent-cyan/10'
                    : 'border-line/80 bg-surface hover:border-line hover:bg-surface-2'
                  }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${profileAvatarClassName} text-xs font-bold text-white shadow-xs ring-1 ring-white/20`}
                >
                  {profileInitials}
                </div>

                <div className="hidden sm:flex flex-col text-left max-w-[140px] whitespace-nowrap">
                  <span className="truncate text-xs font-bold text-ink leading-tight">
                    {profileName}
                  </span>
                  <span className={`truncate text-[10px] text-ink-muted leading-tight ${profileSubtitleClassName}`}>
                    {profileSubtitle}
                  </span>
                </div>

                <ChevronDown
                  className={`hidden sm:block h-3.5 w-3.5 text-ink-muted transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180 text-accent-cyan' : ''
                    }`}
                />
              </button>

              {/* Profile Dropdown Content */}
              {profileDropdownOpen && (
                <div className="absolute right-0 top-12 z-[60] w-64 rounded-2xl border border-line bg-surface p-2 shadow-2xl animate-fadeIn space-y-1">
                  {/* User Header */}
                  <div className="p-3 border-b rounded-xl bg-canvas/40">
                    <p className="text-xs font-bold text-ink truncate">{profileName}</p>
                    <p className="text-[11px] text-ink-muted truncate mt-0.5">{profileSubtitle}</p>
                    {walletBadge && (
                      <div className="mt-2 pt-2 border-t border-line/40 flex items-center justify-between text-xs">
                        <span className="text-ink-muted text-[11px]">Wallet Balance:</span>
                        <span className="font-mono font-bold text-accent-cyan">
                          ₹{Math.max(0, walletBadge.inr).toFixed(2)} ({Math.max(0, walletBadge.credits)} cr)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Links */}
                  <div className="pt-1">
                    <Link
                      href={profileHref}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-ink hover:bg-surface-2 transition cursor-pointer"
                    >
                      <User className="h-3.5 w-3.5 text-ink-muted" />
                      <span>{profileTitle}</span>
                    </Link>

                    <Link
                      href={walletBadge?.href || (brandHref.startsWith('/recruiter') ? '/recruiter/billing' : '/candidate/wallet')}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-ink hover:bg-surface-2 transition cursor-pointer"
                    >
                      <Wallet className="h-3.5 w-3.5 text-ink-muted" />
                      <span>Credits & Passbook</span>
                    </Link>
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-line/60 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        void onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5 text-rose-500" />
                      <span>{logoutLabel}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>



            {/* Hamburger for Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-ink transition hover:bg-surface-2 lg:hidden shadow-xs"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

        </div>
      </div>

      {/* ================= MOBILE DRAWER MENU ================= */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-line bg-surface/98 px-4 py-4 space-y-4 animate-fadeIn shadow-xl">
          {/* Profile Card */}
          <Link
            href={profileHref}
            onClick={closeMobileMenu}
            className="p-3 rounded-2xl bg-canvas border border-line flex items-center justify-between hover:border-accent-cyan/40 transition group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-full ${profileAvatarClassName} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm`}
              >
                {profileInitials}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-ink text-sm truncate group-hover:text-accent-cyan transition">
                  {profileName}
                </p>
                <p className={`text-accent-cyan ${drawerProfileSubtitleClassName}`}>{drawerProfileSubtitle}</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-ink-muted group-hover:text-accent-cyan flex items-center gap-1 shrink-0">
              Profile &rarr;
            </span>
          </Link>

          {/* Wallet summary if available */}
          {walletBadge && (
            <Link
              href={walletBadge.href}
              onClick={closeMobileMenu}
              className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-ink font-semibold"
            >
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-accent-cyan" />
                <span>Wallet Balance</span>
              </div>
              <span className="font-mono font-bold text-accent-cyan">
                ₹{Math.max(0, walletBadge.inr).toFixed(2)} ({Math.max(0, walletBadge.credits)} cr)
              </span>
            </Link>
          )}

          {/* Navigation Links */}
          <div className="space-y-1">
            <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Navigation
            </p>
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition ${isActive
                      ? 'bg-accent-cyan/10 text-accent-cyan font-bold border border-accent-cyan/25'
                      : 'text-ink hover:bg-canvas'
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    {Icon ? <Icon className="w-4 h-4 text-ink-muted" /> : null}
                    <span>{item.name}</span>
                  </div>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />}
                </Link>
              );
            })}

            {drawerExtra?.(closeMobileMenu)}
          </div>

          {/* Mobile Sign Out Button */}
          <div className="pt-2 border-t border-line">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{logoutLabel}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};