import React from 'react';
import type { Metadata } from 'next';
import SuperAdminShell from '@/components/super-admin/SuperAdminShell';

export const metadata: Metadata = {
  title: 'Administration',
  description: 'Super-administration console for Progeni Atlas organizations, billing and platform configuration.',
  robots: { index: false, follow: false },
};

/**
 * Super Admin area layout.
 *
 * The shell owns the single authoritative role gate (server truth via
 * `/api/auth/me`), the sidebar navigation, the privileged support-grant modal
 * and the toast channel. Individual pages only render their own data surface.
 */
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminShell>{children}</SuperAdminShell>;
}
