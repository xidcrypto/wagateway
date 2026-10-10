import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';

/** Seluruh area aplikasi (dashboard + admin + docs internal) tidak boleh terindex. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
