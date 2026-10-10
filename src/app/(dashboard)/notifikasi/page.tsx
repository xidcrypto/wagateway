'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { useLiveEvents, type LiveNotificationEvent } from '@/lib/client/use-live';
import {
  ApiError,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/client/api';
import { cn } from '@/lib/client/cn';

const PAGE_SIZE = 20;

function fullDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'session_logged_out':
      return 'Session keluar';
    case 'session_deleted':
      return 'Session dihapus';
    case 'session_connected':
      return 'Session terhubung';
    case 'blast_done':
      return 'Blast selesai';
    case 'blast_failed':
      return 'Blast gagal';
    case 'broadcast':
      return 'Pengumuman';
    default:
      return kind;
  }
}

export default function NotifikasiPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const r = await listNotifications(PAGE_SIZE, offset);
      setTotal(r.total);
      setUnread(r.unread);
      setItems((prev) => (append ? [...prev, ...r.notifications] : r.notifications));
    } catch (e) {
      if (!append) {
        setError(e instanceof ApiError ? e.message : 'Gagal memuat notifikasi.');
      } else {
        toast('error', e instanceof ApiError ? e.message : 'Gagal memuat lagi.');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listNotifications(PAGE_SIZE, 0)
      .then((r) => {
        if (cancelled) return;
        setTotal(r.total);
        setUnread(r.unread);
        setItems(r.notifications);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Gagal memuat notifikasi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime: notifikasi baru masuk paling atas + hitung unread.
  useLiveEvents({
    onNotification: (ev: LiveNotificationEvent) => {
      const d = ev.data;
      setItems((prev) =>
        prev.some((x) => x.id === d.id)
          ? prev
          : [
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
            ],
      );
      setTotal((t) => t + 1);
      setUnread((u) => u + 1);
    },
  });

  async function openItem(n: NotificationItem): Promise<void> {
    if (!n.readAt) {
      try {
        await markNotificationRead(n.id);
      } catch {
        // Tetap lanjut.
      }
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: now } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) router.push(n.link);
  }

  async function readAll(): Promise<void> {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? now })));
      setUnread(0);
      toast('success', 'Semua notifikasi ditandai dibaca.');
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Gagal menandai notifikasi.');
    }
  }

  if (loading) {
    return (
      <div className="flex max-w-3xl flex-col gap-3" aria-label="Memuat notifikasi">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl">
        <ErrorState message="Gagal memuat notifikasi." hint={error} onRetry={() => void load(0, false)} />
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifikasi</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {total === 0
              ? 'Semua aktivitas penting tampil di sini.'
              : `${total} notifikasi${unread > 0 ? ` · ${unread} belum dibaca` : ''}.`}
          </p>
        </div>
        {unread > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => void readAll()}>
            <CheckCheck size={14} /> Tandai semua dibaca
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Belum ada notifikasi"
          hint="Session yang keluar, blast yang selesai, dan pengumuman admin akan tampil di sini."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void openItem(n)}
              className={cn(
                'flex w-full items-start gap-3 rounded-card border border-border bg-card p-4 text-left shadow-1 hover:bg-muted/40',
                !n.readAt && 'border-primary/40',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                  n.readAt ? 'bg-border' : 'bg-primary',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{n.title}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {kindLabel(n.kind)}
                  </span>
                </span>
                {n.body ? (
                  <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">
                    {n.body}
                  </span>
                ) : null}
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {fullDate(n.createdAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {items.length < total ? (
        <div>
          <Button variant="secondary" disabled={loadingMore} onClick={() => void load(items.length, true)}>
            {loadingMore ? 'Memuat…' : `Muat lagi (${total - items.length} sisa)`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
