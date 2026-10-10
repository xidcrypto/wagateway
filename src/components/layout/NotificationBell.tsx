'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/client/api';
import { useLiveEvents } from '@/lib/client/use-live';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/client/cn';

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'baru saja';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/**
 * Bell inbox notifikasi di topbar: badge belum-dibaca, bubble 10 terbaru
 * (klik item → tandai dibaca + buka tautan), tombol "Lihat semua" → /notifikasi.
 * Realtime via SSE (event 'notification') + toast tiap ada yang baru.
 *
 * Responsif: di HP bubble jadi lembar penuh selebar layar di bawah topbar
 * (fixed inset-x-2, tanpa hitung posisi JS); di desktop jadi dropdown
 * menempel di bawah bell. Tidak ada listener scroll yang menutup sendiri,
 * jadi daftar bisa di-scroll tanpa bubble hilang.
 */
export function NotificationBell() {
  const router = useRouter();
  // mounted = bubble ada di DOM; visible = animasi buka selesai.
  // Tutup = visible=false dulu (animasi keluar 150ms), baru unmount.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  function openBubble(): void {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setMounted(true);
    // Dua frame agar class awal sempat ter-render sebelum transisi jalan.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    void refresh();
  }

  function closeBubble(): void {
    setVisible(false);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setMounted(false);
      closeTimer.current = null;
    }, 160);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  async function refresh(): Promise<void> {
    try {
      const r = await listNotifications(10, 0);
      setItems(r.notifications);
      setUnread(r.unread);
    } catch {
      // Token invalid ditangani guard shell; abaikan di sini.
    }
  }

  useEffect(() => {
    let cancelled = false;
    listNotifications(10, 0)
      .then((r) => {
        if (cancelled) return;
        setItems(r.notifications);
        setUnread(r.unread);
      })
      .catch(() => {
        // Token invalid ditangani guard shell; abaikan di sini.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tutup saat klik di luar, tekan Escape, atau resize (tanpa tutup saat scroll).
  useEffect(() => {
    if (!mounted) return;
    function onDoc(e: MouseEvent): void {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        closeBubble();
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') closeBubble();
    }
    function onResize(): void {
      closeBubble();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
    // closeBubble stabil (tak depend state) — sengaja tanpa deps tambahan.
  }, [mounted ]);

  useLiveEvents({
    onNotification: (ev) => {
      const d = ev.data;
      setItems((prev) =>
        [
          {
            id: d.id,
            userId: d.userId,
            kind: d.kind,
            title: d.title,
            body: d.body,
            link: d.link,
            readAt: null,
            createdAt: d.createdAt,
          },
          ...prev,
        ].slice(0, 10),
      );
      setUnread((u) => u + 1);
      toast('info', d.title);
    },
  });

  async function openItem(n: NotificationItem): Promise<void> {
    closeBubble();
    if (!n.readAt) {
      try {
        await markNotificationRead(n.id);
      } catch {
        // Tetap lanjut buka tautan.
      }
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
    }
    router.push(n.link || '/notifikasi');
  }

  async function readAll(): Promise<void> {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? now })));
      setUnread(0);
      toast('success', 'Semua notifikasi ditandai dibaca.');
    } catch {
      toast('error', 'Gagal menandai notifikasi.');
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifikasi (${unread} belum dibaca)` : 'Notifikasi'}
        aria-expanded={mounted}
        title="Notifikasi"
        onClick={() => {
          if (mounted && visible) closeBubble();
          else openBubble();
        }}
        className="pressable relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-control p-2.5 text-foreground hover:bg-muted"
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="notif-badge tnum absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-failed px-1 text-[10px] font-bold leading-none text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {mounted ? (
        <>
          {/* Backdrop khusus HP: redupkan latar + area ketuk untuk tutup. */}
          <button
            type="button"
            aria-label="Tutup notifikasi"
            tabIndex={-1}
            onClick={() => closeBubble()}
            className={cn(
              'fixed inset-0 z-40 cursor-default bg-black/30 transition-opacity duration-150 sm:hidden',
              visible ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          />
          <div
            role="menu"
            aria-label="Notifikasi terbaru"
            className={cn(
              'fixed inset-x-2 top-[4.5rem] z-50 flex max-h-[19rem] flex-col overflow-hidden rounded-card border border-border bg-card shadow-3 transition-all duration-150 ease-out sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80',
              visible
                ? 'translate-y-0 scale-100 opacity-100'
                : 'pointer-events-none -translate-y-1.5 scale-[0.98] opacity-0',
            )}
            style={{ transformOrigin: 'top right' }}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-border px-3 py-2">
              <p className="text-sm font-semibold">Notifikasi</p>
              <div className="flex flex-wrap items-center gap-1">
                {unread > 0 ? (
                  <button
                    type="button"
                    onClick={() => void readAll()}
                    title="Tandai semua dibaca"
                    className="pressable inline-flex min-h-9 items-center gap-1 rounded-control px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <CheckCheck size={14} />
                    Baca semua
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    closeBubble();
                    router.push('/notifikasi');
                  }}
                  className="pressable inline-flex min-h-9 items-center rounded-control px-2 text-xs font-medium text-primary hover:bg-muted"
                >
                  Lihat semua
                </button>
              </div>
            </div>
            {/* Daftar bisa di-scroll: tinggi pasti + scroll vertikal saja. */}
            <div
              className="max-h-60 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Belum ada notifikasi.
                </p>
              ) : (
                items.map((n, i) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void openItem(n)}
                    style={i < 10 ? { animationDelay: `${i * 35}ms` } : undefined}
                    className={cn(
                      'notif-item flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted',
                      !n.readAt && 'bg-muted/40',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        n.readAt ? 'bg-border' : 'notif-dot bg-primary',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
