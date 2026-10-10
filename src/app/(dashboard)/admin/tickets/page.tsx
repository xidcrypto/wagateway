'use client';

import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Select, TextArea, TextInput } from '@/components/ui/Fields';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { TicketThread } from '@/components/support/TicketThread';
import { errMsg, formatDateTime, ADMIN_PAGE } from '@/components/admin/shared';
import { toast } from '@/components/ui/Toast';
import { useLiveEvents, type LiveNotificationEvent } from '@/lib/client/use-live';
import {
  getAdminTicket,
  listAdminTickets,
  replyAdminTicket,
  setAdminTicketStatus,
  type AdminTicketDetail,
  type AdminTicketListItem,
} from '@/lib/client/api';
import { cn } from '@/lib/client/cn';

const STATUS_LABEL: Record<string, string> = {
  open: 'Baru',
  answered: 'Dijawab',
  closed: 'Ditutup',
};

const STATUS_CLASS: Record<string, string> = {
  open: 'bg-status-connecting/15 text-status-connecting border-status-connecting/40',
  answered: 'bg-status-open/15 text-status-open border-status-open/40',
  closed: 'bg-muted text-muted-foreground border-border',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STATUS_CLASS[status] ?? 'bg-muted text-muted-foreground border-border',
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function TicketsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = Number(params.get('id') ?? '') || null;

  const [statusFilter, setStatusFilter] = useState<'' | 'open' | 'answered' | 'closed'>('');
  const [userQuery, setUserQuery] = useState('');
  const [tickets, setTickets] = useState<AdminTicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState<AdminTicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const loadList = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const r = await listAdminTickets({
          status: statusFilter,
          limit: ADMIN_PAGE,
          offset,
        });
        setTotal(r.total);
        setTickets((prev) => (append ? [...prev, ...r.tickets] : r.tickets));
      } catch (e) {
        if (!append) setError(errMsg(e, 'Gagal memuat tiket.'));
        else toast('error', errMsg(e, 'Gagal memuat lagi.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    let cancelled = false;
    listAdminTickets({ status: statusFilter, limit: ADMIN_PAGE, offset: 0 })
      .then((r) => {
        if (cancelled) return;
        setTotal(r.total);
        setTickets(r.tickets);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, 'Gagal memuat tiket.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function fetchDetail(): Promise<void> {
      setDetail(null);
      setDetailLoading(true);
      setDetailError(null);
      try {
        const r = await getAdminTicket(selectedId as number);
        if (cancelled) return;
        setDetail(r.ticket);
        setTickets((prev) =>
          prev.map((t) => (t.id === r.ticket.id ? { ...t, hasUnread: false } : t)),
        );
      } catch (e) {
        if (!cancelled) setDetailError(errMsg(e, 'Gagal memuat tiket.'));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    void fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Realtime: tiket baru / balasan user → refresh daftar + thread bila dibuka.
  useLiveEvents({
    onNotification: (ev: LiveNotificationEvent) => {
      if (ev.data.kind !== 'ticket_new') return;
      void loadList(0, false);
      const m = ev.data.link?.match(/[?&]id=(\d+)/);
      const tid = m ? Number(m[1]) : null;
      if (tid && tid === selectedId) {
        getAdminTicket(tid)
          .then((r) => setDetail(r.ticket))
          .catch(() => {});
      }
    },
  });

  function openTicket(id: number): void {
    setReply('');
    setDetailError(null);
    router.push(`/admin/tickets?id=${id}`);
  }

  function backToList(): void {
    setDetail(null);
    setDetailError(null);
    setReply('');
    router.push('/admin/tickets');
  }

  async function handleReply(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!detail || !reply.trim()) return;
    setSending(true);
    try {
      const r = await replyAdminTicket(detail.id, reply.trim());
      setReply('');
      const d = await getAdminTicket(detail.id);
      setDetail(d.ticket);
      await loadList(0, false);
      toast('success', r.reopened ? 'Tiket dibuka lagi dan balasan terkirim.' : 'Balasan terkirim ke user.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengirim balasan.'));
    } finally {
      setSending(false);
    }
  }

  async function handleStatus(next: 'open' | 'answered' | 'closed'): Promise<void> {
    if (!detail) return;
    setBusyStatus(true);
    try {
      await setAdminTicketStatus(detail.id, next);
      setDetail({ ...detail, status: next });
      setConfirmClose(false);
      await loadList(0, false);
      toast(
        'success',
        next === 'closed' ? 'Tiket ditutup.' : next === 'open' ? 'Tiket dibuka kembali.' : 'Status diubah.',
      );
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengubah status.'));
    } finally {
      setBusyStatus(false);
    }
  }

  const filtered = tickets.filter((t) => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      t.user.username.toLowerCase().includes(q) ||
      t.user.fullName.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-label="Memuat tiket">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (error && tickets.length === 0) {
    return <ErrorState message="Gagal memuat tiket." hint={error} onRetry={() => void loadList(0, false)} />;
  }

  const showThread = selectedId !== null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Daftar tiket */}
      <div className={cn('flex-col gap-3', showThread ? 'hidden lg:flex' : 'flex')}>
        <Card title={`Tiket CS (${total})`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter((e.target.value === '' ? '' : e.target.value) as '' | 'open' | 'answered' | 'closed')
              }
              className="w-auto"
            >
              <option value="">Semua status</option>
              <option value="open">Baru</option>
              <option value="answered">Dijawab</option>
              <option value="closed">Ditutup</option>
            </Select>
            <div className="flex min-w-44 flex-1 items-center gap-2">
              <Search size={15} className="shrink-0 text-muted-foreground" />
              <TextInput
                aria-label="Cari tiket"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Cari user atau judul…"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {filtered.length === 0 ? (
              <EmptyState
                title={userQuery || statusFilter ? 'Tidak ada tiket yang cocok' : 'Belum ada tiket'}
                hint={userQuery || statusFilter ? 'Ubah filter atau kata kunci.' : 'Tiket dari user akan tampil di sini.'}
              />
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t.id)}
                  aria-current={t.id === selectedId ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-card border border-border bg-background p-3 text-left hover:bg-muted/40',
                    t.id === selectedId && 'border-primary/50',
                  )}
                >
                  <Avatar name={t.user.fullName || t.user.username} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        #{t.id} · {t.subject}
                      </span>
                      <StatusPill status={t.status} />
                      {t.hasUnread ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                          Baru
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {t.user.username} · {t.lastExcerpt ?? '—'}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {formatDateTime(t.updatedAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          {tickets.length < total ? (
            <div className="mt-3">
              <Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void loadList(tickets.length, true)}>
                {loadingMore ? 'Memuat…' : `Muat lagi (${total - tickets.length} sisa)`}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Thread + balas */}
      <div className={cn('min-w-0 flex-col', showThread ? 'flex' : 'hidden lg:flex')}>
        {!showThread ? (
          <Card title="Pilih tiket">
            <p className="text-sm leading-6 text-muted-foreground">
              Pilih tiket di kiri untuk membaca dan membalas.
            </p>
          </Card>
        ) : detailLoading ? (
          <div className="flex flex-col gap-2" aria-label="Memuat percakapan">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : detailError || !detail ? (
          <ErrorState
            message="Gagal memuat tiket."
            hint={detailError ?? undefined}
            onRetry={() => (selectedId ? openTicket(selectedId) : backToList())}
          />
        ) : (
          <Card title={`#${detail.id} · ${detail.subject}`} action={<StatusPill status={detail.status} />}>
            <button
              type="button"
              onClick={backToList}
              className="mb-3 text-[13px] font-medium text-primary hover:underline lg:hidden"
            >
              ← Kembali ke daftar
            </button>
            <p className="mb-3 flex items-center gap-2 text-[13px] text-muted-foreground">
              <Avatar name={detail.user.fullName || detail.user.username} size={24} />
              {detail.user.fullName} (@{detail.user.username})
            </p>
            <TicketThread messages={detail.messages} />
            <form onSubmit={(e) => void handleReply(e)} className="mt-4 flex flex-col gap-2">
              <TextArea
                aria-label="Tulis balasan ke user"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  detail.status === 'closed'
                    ? 'Tiket ditutup — balas untuk membukanya lagi…'
                    : 'Tulis balasan ke user…'
                }
                maxLength={2000}
                rows={3}
                required
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex gap-2">
                  {detail.status === 'closed' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busyStatus}
                      onClick={() => void handleStatus('open')}
                    >
                      Buka lagi
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmClose(true)}
                    >
                      Tutup tiket
                    </Button>
                  )}
                </span>
                <Button type="submit" size="sm" disabled={sending || !reply.trim()}>
                  <Send size={14} /> {sending ? 'Mengirim…' : 'Kirim balasan'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      {confirmClose && detail ? (
        <ConfirmDialog
          title="Tutup tiket?"
          message={
            <span>
              Tutup tiket <b>#{detail.id}</b> ({detail.subject}) milik {detail.user.username}?
            </span>
          }
          confirmLabel="Ya, tutup"
          busy={busyStatus}
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => void handleStatus('closed')}
        />
      ) : null}
    </div>
  );
}

export default function AdminTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-2" aria-label="Memuat tiket">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-14" />
        </div>
      }
    >
      <TicketsContent />
    </Suspense>
  );
}
