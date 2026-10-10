'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Select, TextInput } from '@/components/ui/Fields';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { TicketThread } from '@/components/support/TicketThread';
import { TicketComposer } from '@/components/support/TicketComposer';
import { errMsg, formatDateTime, ADMIN_PAGE } from '@/components/admin/shared';
import { toast } from '@/components/ui/Toast';
import {
  useLiveEvents,
  type LiveNotificationEvent,
  type LiveTicketMessageEvent,
  type LiveTicketTypingEvent,
} from '@/lib/client/use-live';
import {
  getAdminTicket,
  listAdminTickets,
  replyAdminTicket,
  sendTicketTyping,
  setAdminTicketStatus,
  uploadTicketImage,
  type AdminTicketDetail,
  type AdminTicketListItem,
  type TicketMessage,
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
  const [sending, setSending] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const typingTimer = useRef<number | null>(null);
  const typingSentAt = useRef(0);
  const selectedRef = useRef<number | null>(null);

  // Sinkron ref di effect (bukan saat render) — dipakai callback SSE.
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

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
      setPeerTyping(false);
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

  // Hilangkan indikator typing 5 dtk setelah sinyal terakhir.
  function pokeTyping(): void {
    setPeerTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setPeerTyping(false), 5000);
  }

  // Realtime: tiket baru / balasan user → daftar + thread tanpa refetch.
  useLiveEvents({
    onNotification: (ev: LiveNotificationEvent) => {
      if (ev.data.kind !== 'ticket_new') return;
      void loadList(0, false);
      const m = ev.data.link?.match(/[?&]id=(\d+)/);
      const tid = m ? Number(m[1]) : null;
      if (tid && tid === selectedRef.current) {
        getAdminTicket(tid)
          .then((r) => setDetail(r.ticket))
          .catch(() => {});
      }
    },
    onTicketMessage: (ev: LiveTicketMessageEvent) => {
      if (ev.ticketId !== selectedRef.current) {
        // Tiket lain: cukup segarkan daftar (badge Baru).
        void loadList(0, false);
        return;
      }
      const msg = ev.data as TicketMessage;
      if (!msg || !msg.id) return;
      setDetail((prev) => {
        if (!prev || prev.id !== ev.ticketId) return prev;
        if (prev.messages.some((x) => x.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
      void loadList(0, false);
    },
    onTicketTyping: (ev: LiveTicketTypingEvent) => {
      // Hanya typing DARI user yang ditampilkan di sisi admin.
      if (ev.ticketId !== selectedRef.current || ev.fromAdmin) return;
      pokeTyping();
    },
    onPoll: () => {
      void loadList(0, false);
      const tid = selectedRef.current;
      if (tid) {
        getAdminTicket(tid)
          .then((r) => setDetail(r.ticket))
          .catch(() => {});
      }
    },
  });

  // Bersihkan timer typing saat unmount.
  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, []);

  function openTicket(id: number): void {
    setDetailError(null);
    setPeerTyping(false);
    router.push(`/admin/tickets?id=${id}`);
  }

  function backToList(): void {
    setDetail(null);
    setDetailError(null);
    setPeerTyping(false);
    router.push('/admin/tickets');
  }

  /** Kirim teks ke user (dari composer). */
  async function sendText(text: string): Promise<void> {
    if (!detail || !text || sending) return;
    setSending(true);
    try {
      const r = await replyAdminTicket(detail.id, text);
      // Optimistic via respons (SSE ticket.message jadi dedup).
      setDetail((prev) => {
        if (!prev || prev.id !== detail.id) return prev;
        if (prev.messages.some((x) => x.id === r.message.id)) return prev;
        return { ...prev, messages: [...prev.messages, r.message], status: 'answered' };
      });
      await loadList(0, false);
      toast('success', r.reopened ? 'Tiket dibuka lagi dan balasan terkirim.' : 'Balasan terkirim ke user.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengirim balasan.'));
    } finally {
      setSending(false);
    }
  }

  /** Beri tahu user "CS sedang mengetik" (debounce 3 dtk). */
  function handleTypingPing(): void {
    if (!selectedId) return;
    const now = Date.now();
    if (now - typingSentAt.current < 3000) return;
    typingSentAt.current = now;
    sendTicketTyping(selectedId).catch(() => {});
  }

  /** Kirim gambar + caption ke user (dari composer, setelah pratinjau). */
  async function sendImage(file: File, caption: string): Promise<void> {
    if (!detail || uploading) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const r = await uploadTicketImage(detail.id, file, caption || undefined, (p) =>
        setUploadProgress(p),
      );
      setDetail((prev) => {
        if (!prev || prev.id !== detail.id) return prev;
        if (prev.messages.some((x) => x.id === r.message.id)) return prev;
        return { ...prev, messages: [...prev.messages, r.message], status: 'answered' };
      });
      handleTypingPing();
      await loadList(0, false);
      toast('success', 'Gambar terkirim ke user.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengunggah gambar.'));
    } finally {
      setUploading(false);
      setUploadProgress(null);
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
            <TicketThread
              messages={detail.messages}
              peerReadAt={detail.peerReadAt}
              isAdminView
              peerTyping={peerTyping}
              peerName={detail.user.username}
            />
            {detail.status === 'closed' ? (
              <div className="mt-4 flex flex-col gap-2">
                <p className="rounded-control border border-border bg-muted/50 px-3 py-2.5 text-[13px] leading-5 text-muted-foreground">
                  Tiket ini ditutup. Balas untuk membukanya lagi, atau buka manual.
                </p>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busyStatus}
                    onClick={() => void handleStatus('open')}
                  >
                    Buka lagi
                  </Button>
                </div>
              </div>
            ) : null}
            <TicketComposer
              placeholder="Tulis balasan ke user… (gambar ≤10 MB)"
              sending={sending}
              uploading={uploading}
              progress={uploadProgress}
              sendLabel="Kirim balasan"
              showClose={detail.status !== 'closed'}
              onCloseTicket={() => setConfirmClose(true)}
              onSendText={(text) => void sendText(text)}
              onSendImage={(file, caption) => void sendImage(file, caption)}
              onTypingPing={handleTypingPing}
              onError={(msg) => toast('error', msg)}
            />
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
