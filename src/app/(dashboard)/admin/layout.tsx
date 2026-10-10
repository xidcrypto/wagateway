'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Globe, Inbox, LayoutDashboard, Smartphone, Users } from 'lucide-react';
import { cn } from '@/lib/client/cn';

const ITEMS = [
  { href: '/admin', label: 'Ringkasan', icon: <LayoutDashboard size={17} />, exact: true },
  { href: '/admin/users', label: 'Pengguna', icon: <Users size={17} />, exact: false },
  { href: '/admin/sessions', label: 'Session', icon: <Smartphone size={17} />, exact: false },
  { href: '/admin/audit', label: 'Audit pesan', icon: <Inbox size={17} />, exact: false },
  { href: '/admin/web', label: 'Web', icon: <Globe size={17} />, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Statistik sistem, kelola pengguna, session, audit pesan, dan pengaturan web.
        </p>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <nav
          aria-label="Navigasi admin"
          className="flex gap-1 overflow-x-auto rounded-card border border-border bg-card p-1 lg:sticky lg:top-20 lg:w-52 lg:shrink-0 lg:flex-col"
        >
          {ITEMS.map((n) => {
            const active = isActive(pathname, n.href, n.exact);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'pressable flex min-h-10 flex-1 items-center gap-2.5 whitespace-nowrap rounded-control px-3 text-sm transition lg:flex-none',
                  active
                    ? 'bg-muted font-semibold text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {n.icon}
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1" key={pathname}>
          <div className="page-enter flex flex-col gap-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
