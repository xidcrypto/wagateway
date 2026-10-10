'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookUser,
  BookOpenText,
  ChevronLeft,
  Gauge,
  Globe,
  Headset,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  MessagesSquare,
  Search,
  Settings,
  Smartphone,
  User,
  Users,
  X,
} from 'lucide-react';
import { ApiError, api, clearToken, getSiteInfo, getToken } from '@/lib/client/api';
import { toast } from '@/components/ui/Toast';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { ThemeIconButton } from '@/components/layout/ThemeToggle';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { cn } from '@/lib/client/cn';

type NavItem = { href: string; label: string; icon: ReactNode; adminOnly?: boolean };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={19} /> },
  { href: '/sessions', label: 'Sessions', icon: <Smartphone size={19} /> },
  { href: '/chat', label: 'Chat', icon: <MessagesSquare size={19} /> },
  { href: '/messages', label: 'Pesan', icon: <MessageSquare size={19} /> },
  { href: '/groups', label: 'Grup', icon: <Users size={19} /> },
  { href: '/contacts', label: 'Kontak', icon: <BookUser size={19} /> },
  { href: '/blast', label: 'Blast', icon: <Megaphone size={19} /> },
  { href: '/docs', label: 'API Docs', icon: <BookOpenText size={19} /> },
  { href: '/cs', label: 'Hubungi CS', icon: <Headset size={19} /> },
  { href: '/settings', label: 'Pengaturan', icon: <Settings size={19} /> },
];

/** Seksi khusus admin di sidebar: tiap item = halaman terpisah, tanpa tab. */
const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard admin', icon: <Gauge size={19} />, adminOnly: true },
  { href: '/admin/users', label: 'Pengguna', icon: <Users size={19} />, adminOnly: true },
  { href: '/admin/sessions', label: 'Semua session', icon: <Smartphone size={19} />, adminOnly: true },
  { href: '/admin/audit', label: 'Audit pesan', icon: <Inbox size={19} />, adminOnly: true },
  { href: '/admin/tickets', label: 'Tiket CS', icon: <Headset size={19} />, adminOnly: true },
  { href: '/admin/web', label: 'Pengaturan web', icon: <Globe size={19} />, adminOnly: true },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/sessions': 'Sessions',
  '/chat': 'Chat',
  '/messages': 'Pesan',
  '/groups': 'Grup',
  '/contacts': 'Kontak',
  '/blast': 'Blast',
  '/docs': 'API Docs',
  '/admin': 'Dashboard admin',
  '/admin/users': 'Pengguna',
  '/admin/sessions': 'Semua session',
  '/admin/audit': 'Audit pesan',
  '/admin/tickets': 'Tiket CS',
  '/admin/web': 'Pengaturan web',
  '/cs': 'Hubungi CS',
  '/settings': 'Pengaturan',
  '/notifikasi': 'Notifikasi',
};

type MeUser = {
  username: string;
  fullName: string;
  role: 'admin' | 'user';
};

function SidebarBody({
  pathname,
  user,
  siteName,
  collapsed,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  user: MeUser | null;
  siteName: string;
  collapsed: boolean;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const items = NAV;
  const adminItems = ADMIN_NAV.filter(() => user?.role === 'admin');
  // Seksi ala Zenith ("Utama"/"Admin"): label kecil uppercase + item flat.
  const sections: { label: string | null; items: NavItem[] }[] = [{ label: null, items }];
  if (adminItems.length > 0) sections.push({ label: 'Admin', items: adminItems });
  // Item admin aktif bila path persis atau di bawahnya (kecuali /admin yang exact).
  function navActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  function renderItem(n: NavItem) {
    const active = navActive(n.href);
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={onNavigate}
        title={collapsed ? n.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-10 items-center gap-3 rounded-control px-2.5 py-2 text-sm transition-colors',
          collapsed && 'justify-center px-0',
          active
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
      >
        <span className="shrink-0">{n.icon}</span>
        {collapsed ? null : <span>{n.label}</span>}
      </Link>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        title={siteName}
        className={cn(
          'flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary font-display text-base font-bold text-primary-foreground">
          {siteName.trim().charAt(0).toUpperCase() || 'P'}
        </span>
        {collapsed ? null : (
          <span className="truncate text-base font-semibold tracking-tight text-foreground">
            {siteName}
          </span>
        )}
      </Link>
      <nav className="flex flex-1 flex-col gap-4 space-y-0 overflow-y-auto p-3" aria-label="Navigasi utama">
        {sections.map((sec) => (
          <div key={sec.label ?? 'utama'}>
            {sec.label ? (
              collapsed ? (
                <span className="mx-2 my-1 border-t border-sidebar-border" aria-hidden="true" />
              ) : (
                <p className="px-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {sec.label}
                </p>
              )
            ) : null}
            <div className="flex flex-col gap-0.5">{sec.items.map(renderItem)}</div>
          </div>
        ))}
        {adminItems.length > 0 && !collapsed ? (
          <Link
            href="/settings"
            onClick={onNavigate}
            className="mt-1 flex min-h-9 items-center gap-2 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Profil & akun ada di Pengaturan →
          </Link>
        ) : null}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        {collapsed ? (
          <button
            type="button"
            onClick={onLogout}
            title="Keluar"
            aria-label="Keluar"
            className="pressable flex min-h-11 w-full items-center justify-center rounded-control text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut size={18} />
          </button>
        ) : (
          <>
            <p className="truncate px-1 text-xs text-muted-foreground">
              {user ? `${user.fullName} (${user.role})` : '…'}
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="pressable mt-2 flex min-h-10 w-full items-center gap-2 rounded-control px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut size={16} />
              Keluar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<MeUser | null>(null);
  const [ready, setReady] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [siteName, setSiteName] = useState('Pansa Gateway');
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('pansa_sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [userMenu, setUserMenu] = useState(false);

  function toggleCollapse(): void {
    setCollapsed((v) => {
      try {
        window.localStorage.setItem('pansa_sidebar', v ? 'expanded' : 'collapsed');
      } catch {
        // Abaikan.
      }
      return !v;
    });
  }

  useEffect(() => {
    let cancelled = false;
    getSiteInfo()
      .then((info) => {
        if (!cancelled) setSiteName(info.siteName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    api<{ user: MeUser }>('/api/me')
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
          setReady(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace('/login');
        } else {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Halaman /admin hanya untuk admin: non-admin dikembalikan ke dashboard.
  useEffect(() => {
    if (ready && user && pathname.startsWith('/admin') && user.role !== 'admin') {
      toast('error', 'Halaman admin hanya untuk admin.');
      router.replace('/dashboard');
    }
  }, [ready, user, pathname, router]);

  function handleLogout(): void {
    clearToken();
    router.replace('/login');
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-md flex-col gap-3" aria-label="Memuat">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      </main>
    );
  }

  const base = '/' + pathname.split('/')[1];
  const title = TITLES[pathname] ?? TITLES[base] ?? 'Pansa';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette
        isAdmin={user?.role === 'admin'}
        onCreateSession={() => router.push('/sessions')}
      />
      {/* Sidebar desktop */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:block',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <SidebarBody
          pathname={pathname}
          user={user}
          siteName={siteName}
          collapsed={collapsed}
          onNavigate={() => {}}
          onLogout={handleLogout}
        />
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Lebarkan sidebar' : 'Lipatkan sidebar'}
          title={collapsed ? 'Lebarkan' : 'Lipatkan'}
          className="pressable absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={14} className={cn('transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Drawer mobile */}
      <AnimatePresence>
        {drawer ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
            >
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setDrawer(false)}
                className="pressable absolute right-2 top-3 inline-flex min-h-10 min-w-10 items-center justify-center rounded-control p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
              <SidebarBody
                pathname={pathname}
                user={user}
                siteName={siteName}
                collapsed={false}
                onNavigate={() => setDrawer(false)}
                onLogout={handleLogout}
              />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Konten */}
      <div className={cn('pb-20 md:pb-0', collapsed ? 'md:pl-16' : 'md:pl-60')}>
        <header className="sticky top-0 z-30 border-b border-border bg-card">
          <div className="flex h-16 w-full items-center gap-2 px-4 lg:px-6">
            <button
              type="button"
              aria-label="Buka menu"
              onClick={() => setDrawer(true)}
              className="pressable inline-flex min-h-10 min-w-10 items-center justify-center rounded-control p-2.5 text-foreground hover:bg-muted md:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            {/* Desktop: bar pencarian penuh. Mobile: ikon saja (hemat ruang topbar). */}
            <div className="hidden min-w-0 flex-1 justify-start sm:flex">
              <button
                type="button"
                aria-label="Pencarian cepat (Ctrl K)"
                title="Pencarian cepat (Ctrl+K)"
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                className="pressable flex h-9 w-full max-w-md items-center gap-2 rounded-control border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Search size={15} />
                <span className="flex-1 text-left">Cari…</span>
                <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[11px] lg:inline-flex">
                  Ctrl K
                </kbd>
              </button>
            </div>
            <div className="flex min-w-0 flex-1 justify-end sm:hidden">
              <button
                type="button"
                aria-label="Pencarian cepat"
                title="Pencarian cepat"
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
                className="pressable inline-flex min-h-10 min-w-10 items-center justify-center rounded-control p-2.5 text-foreground hover:bg-muted"
              >
                <Search size={18} />
              </button>
            </div>
            <NotificationBell />
            <ThemeIconButton />
            <div className="relative">
              <button
                type="button"
                aria-label="Menu pengguna"
                aria-expanded={userMenu}
                onClick={() => setUserMenu((v) => !v)}
                className="pressable flex min-h-10 items-center gap-2 rounded-control border border-border bg-card px-2.5 text-sm font-medium hover:bg-muted"
              >
                <User size={16} className="text-muted-foreground" />
                <span className="hidden max-w-28 truncate lg:inline">
                  {user?.fullName ?? '…'}
                </span>
              </button>
              {userMenu ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 z-50 mt-1.5 w-52 rounded-card border border-border bg-card p-1 shadow-3">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenu(false);
                        router.push('/settings');
                      }}
                      className="pressable flex min-h-10 w-full items-center gap-2 rounded-control px-3 text-sm hover:bg-muted"
                    >
                      <Settings size={15} className="text-muted-foreground" />
                      Pengaturan
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="pressable flex min-h-10 w-full items-center gap-2 rounded-control px-3 text-sm text-status-failed hover:bg-muted"
                    >
                      <LogOut size={15} />
                      Keluar
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6">
          <div key={pathname} className="page-enter mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom bar mobile */}
      <nav
        aria-label="Navigasi cepat"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card md:hidden"
      >
        {[
          { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
          { href: '/sessions', label: 'Sessions', icon: <Smartphone size={20} /> },
          { href: '/chat', label: 'Chat', icon: <MessagesSquare size={20} /> },
        ].map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]',
                active ? 'font-semibold text-primary' : 'text-muted-foreground',
              )}
            >
              {n.icon}
              {n.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Menu lainnya"
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground"
        >
          <LayoutGrid size={20} />
          Lainnya
        </button>
      </nav>
    </div>
  );
}

export function SessionOrbHeader({ status }: { status: string }) {
  return <StatusOrb status={status} size={8} />;
}
