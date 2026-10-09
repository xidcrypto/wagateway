'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BookUser,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { ApiError, api, clearToken, getSiteInfo, getToken } from '@/lib/client/api';
import { ToastHost } from '@/components/ui/Toast';

type NavItem = { href: string; label: string; icon: ReactNode; adminOnly?: boolean };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/sessions', label: 'Sessions', icon: <Smartphone size={18} /> },
  { href: '/chat', label: 'Chat', icon: <MessagesSquare size={18} /> },
  { href: '/messages', label: 'Pesan', icon: <MessageSquare size={18} /> },
  { href: '/groups', label: 'Grup', icon: <Users size={18} /> },
  { href: '/contacts', label: 'Kontak', icon: <BookUser size={18} /> },
  { href: '/blast', label: 'Blast', icon: <Megaphone size={18} /> },
  { href: '/admin', label: 'Admin', icon: <ShieldCheck size={18} />, adminOnly: true },
  { href: '/settings', label: 'Pengaturan', icon: <Settings size={18} /> },
];

type MeUser = {
  username: string;
  fullName: string;
  role: 'admin' | 'user';
};

function SidebarBody({
  pathname,
  user,
  siteName,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  user: MeUser | null;
  siteName: string;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const items = NAV.filter((n) => !n.adminOnly || user?.role === 'admin');
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="px-4 pb-4 pt-5 text-lg font-bold text-zinc-50"
      >
        {siteName}
      </Link>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {items.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? 'bg-emerald-950 font-semibold text-emerald-300'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
            >
              {n.icon}
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 p-3">
        <p className="truncate px-1 text-xs text-zinc-500">
          {user ? `${user.fullName} (${user.role})` : '…'}
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <LogOut size={16} />
          Keluar
        </button>
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
      router.replace('/dashboard');
    }
  }, [ready, user, pathname, router]);

  function handleLogout(): void {
    clearToken();
    router.replace('/login');
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <p className="text-zinc-400">Memuat…</p>
      </main>
    );
  }

  return (
    <ToastHost>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        {/* Sidebar desktop */}
        <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-zinc-800 bg-zinc-900 md:block">
          <SidebarBody
            pathname={pathname}
            user={user}
            siteName={siteName}
            onNavigate={() => {}}
            onLogout={handleLogout}
          />
        </aside>

        {/* Drawer mobile */}
        {drawer ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setDrawer(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-64 bg-zinc-900">
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setDrawer(false)}
                className="absolute right-2 top-3 rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X size={18} />
              </button>
              <SidebarBody
                pathname={pathname}
                user={user}
                siteName={siteName}
                onNavigate={() => setDrawer(false)}
                onLogout={handleLogout}
              />
            </aside>
          </div>
        ) : null}

        {/* Konten */}
        <div className="md:pl-60">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur md:hidden">
            <button
              type="button"
              aria-label="Buka menu"
              onClick={() => setDrawer(true)}
              className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-800"
            >
              <Menu size={20} />
            </button>
            <span className="font-bold">{siteName}</span>
          </header>
          <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
        </div>
      </div>
    </ToastHost>
  );
}
