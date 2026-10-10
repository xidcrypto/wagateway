'use client';

import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Bell,
  BookOpenText,
  BookUser,
  Gauge,
  Globe,
  Headset,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Moon,
  Plus,
  Settings,
  Smartphone,
  Sun,
  Users,
} from 'lucide-react';
import { clearToken } from '@/lib/client/api';

const PAGES = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sessions', label: 'Sessions', icon: Smartphone },
  { href: '/chat', label: 'Chat', icon: MessagesSquare },
  { href: '/messages', label: 'Pesan', icon: MessageSquare },
  { href: '/groups', label: 'Grup', icon: Users },
  { href: '/contacts', label: 'Kontak', icon: BookUser },
  { href: '/blast', label: 'Blast', icon: Megaphone },
  { href: '/docs', label: 'API Docs', icon: BookOpenText },
  { href: '/cs', label: 'Hubungi CS', icon: Headset },
  { href: '/notifikasi', label: 'Notifikasi', icon: Bell },
  { href: '/admin', label: 'Dashboard admin', icon: Gauge, adminOnly: true },
  { href: '/admin/tickets', label: 'Tiket CS (admin)', icon: Headset, adminOnly: true },
  { href: '/admin/users', label: 'Pengguna (admin)', icon: Users, adminOnly: true },
  { href: '/admin/sessions', label: 'Semua session (admin)', icon: Smartphone, adminOnly: true },
  { href: '/admin/audit', label: 'Audit pesan (admin)', icon: Inbox, adminOnly: true },
  { href: '/admin/web', label: 'Pengaturan web (admin)', icon: Globe, adminOnly: true },
  { href: '/settings', label: 'Pengaturan', icon: Settings },
];

/** Command palette Ctrl/Cmd+K: lompat halaman, buat session, ganti tema, logout. */
export function CommandPalette({
  isAdmin,
  onCreateSession,
}: {
  isAdmin: boolean;
  onCreateSession: () => void;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function go(href: string): void {
    setOpen(false);
    router.push(href);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Perintah cepat"
      className="fixed left-1/2 top-[18vh] z-[60] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-panel border border-border bg-card shadow-3"
      overlayClassName="fixed inset-0 z-[55] bg-black/55"
    >
      <Command.Input
        placeholder="Ketik perintah atau cari halaman…"
        className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Command.List className="max-h-72 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          Tidak ada hasil.
        </Command.Empty>
        <Command.Group heading="Halaman" className="px-2 py-1 text-xs text-muted-foreground">
          {PAGES.filter((p) => !p.adminOnly || isAdmin).map((p) => (
            <Command.Item
              key={p.href}
              value={p.label}
              onSelect={() => go(p.href)}
              className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control px-3 text-sm text-foreground aria-selected:bg-muted"
            >
              <p.icon size={16} className="text-muted-foreground" />
              {p.label}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Aksi" className="px-2 py-1 text-xs text-muted-foreground">
          <Command.Item
            value="Buat session"
            onSelect={() => {
              setOpen(false);
              onCreateSession();
            }}
            className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control px-3 text-sm text-foreground aria-selected:bg-muted"
          >
            <Plus size={16} className="text-muted-foreground" />
            Buat session
          </Command.Item>
          <Command.Item
            value="Tema terang"
            onSelect={() => {
              setTheme('light');
              setOpen(false);
            }}
            className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control px-3 text-sm text-foreground aria-selected:bg-muted"
          >
            <Sun size={16} className="text-muted-foreground" />
            Tema terang
          </Command.Item>
          <Command.Item
            value="Tema gelap"
            onSelect={() => {
              setTheme('dark');
              setOpen(false);
            }}
            className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control px-3 text-sm text-foreground aria-selected:bg-muted"
          >
            <Moon size={16} className="text-muted-foreground" />
            Tema gelap
          </Command.Item>
          <Command.Item
            value="Keluar"
            onSelect={() => {
              clearToken();
              setOpen(false);
              router.replace('/login');
            }}
            className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control px-3 text-sm text-status-failed aria-selected:bg-muted"
          >
            <LogOut size={16} />
            Keluar
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
