'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Headset, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { TextArea, TextInput } from '@/components/ui/Fields';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { TicketThread } from '@/components/support/TicketThread';
import { toast } from '@/components/ui/Toast';
import { useLiveEvents, type LiveNotificationEvent } from '@/lib/client/use-live';
import {
  ApiError,
  closeTicket,
  createTicket,
  getTicket,
  listTickets,
  replyTicket,
  type TicketDetail,
  type TicketListItem,
} from '@/lib/client/api';
import { cn } from '@/lib/client/cn';

const STATUS_LABEL: Record<string, string> = {
  open: 'Menunggu CS',
  answered: 'Dijawab CS',
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

function CsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = Number(params.get('id') ?? '') || null;

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [firstMsg, setFirstMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    setError(null);
    try {
      const r = await listTickets();
      setTickets(r.tickets);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal memuat tiket.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listTickets()
      .then((r) => {
        if (!cancelled) setTickets(r.tickets);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Gagal memuat tiket.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Muat thread tiket terpilih; ?id= ikut didukung (tautan dari notifikasi).
  // Seluruh setState di dalam rantai promise (async), bukan sinkron di body.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function fetchDetail(): Promise<void> {
      setDetail(null);
      setDetailLoading(true);
      setDetailError(null);
      try {
        const r = await getTicket(selectedId as number);
        if (cancelled) return;
        setDetail(r.ticket);
        // Baru dibuka = balasan CS dianggap terbaca → refresh badge list.
        setTickets((prev) =>
          prev.map((t) => (t.id === (r.ticket as TicketDetail).id ? { ...t, hasUnread: false } : t)),
        );
      } catch (e) {
        if (!cancelled) setDetailError(e instanceof ApiError ? e.message : 'Gagal memuat tiket.');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    void fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Realtime: balasan CS masuk → tandai unread + refresh thread bila sedang dibuka.
  useLiveEvents({
    onNotification: (ev: LiveNotificationEvent) => {
      if (ev.data.kind !== 'ticket_reply') return;
      const m = ev.data.link?.match(/[?&]id=(\d+)/);
      const tid = m ? Number(m[1]) : null;
      if (!tid) {
        void loadList();
        return;
      }
      setTickets((prev) =>
        prev.map((t) =>
          t.id === tid ? { ...t, hasUnread: true, status: 'answered', updatedAt: ev.data.createdAt } : t,
        ),
      );
      if (tid === selectedId) {
        getTicket(tid)
          .then((r) => setDetail(r.ticket))
          .catch(() => {});
      }
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [detail?.messages.length]);

  function openTicket(id: number): void {
    setReply('');
    setDetailError(null);
    router.push(`/cs?id=${id}`);
  }

  function backToList(): void {
    setDetail(null);
    setDetailError(null);
    setReply('');
    router.push('/cs');
  }

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (subject.trim().length < 3) {
      toast('error', 'Judul minimal 3 karakter.');
      return;
    }
    if (!firstMsg.trim()) {
      toast('error', 'Pesan wajib diisi.');
      return;
    }
    setCreating(true);
    try {
      const r = await createTicket(subject.trim(), firstMsg.trim());
      toast('success', `Tiket #${r.ticket.id} dibuat. CS akan segera membalas.`);
      setSubject('');
      setFirstMsg('');
      setShowNew(false);
      await loadList();
      router.push(`/cs?id=${r.ticket.id}`);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Gagal membuat tiket.');
    } finally {
      setCreating(false);
    }
  }

  async function handleReply(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!detail || !reply.trim()) return;
    setSending(true);
    try {
      await replyTicket(detail.id, reply.trim());
      setReply('');
      const r = await getTicket(detail.id);
      setDetail(r.ticket);
      toast('success', 'Balasan terkirim.');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Gagal mengirim balasan.');
    } finally {
      setSending(false);
    }
  }

  async function handleClose(): Promise<void> {
    if (!detail) return;
    setClosing(true);
    try {
      await closeTicket(detail.id);
      toast('success', 'Tiket ditutup.');
      setConfirmClose(false);
      setDetail({ ...detail, status: 'closed' });
      await loadList();
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Gagal menutup tiket.');
    } finally {
      setClosing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex max-w-4xl flex-col gap-3" aria-label="Memuat tiket">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (error && tickets.length === 0) {
    return (
      <div className="max-w-4xl">
        <ErrorState message="Gagal memuat tiket." hint={error} onRetry={() => void loadList()} />
      </div>
    );
  }

  // Mobile: daftar atau thread (satu zona penuh); desktop: dua kolom.
  const showThread = selectedId !== null;

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Headset size={22} className="text-muted-foreground" />
            Hubungi CS
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Ada kendala atau pertanyaan? Buat tiket, CS kami akan membalas di sini.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={15} /> Tiket baru
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Daftar tiket */}
        <div className={cn('flex-col gap-2', showThread ? 'hidden md:flex' : 'flex')}>
          {tickets.length === 0 ? (
            <EmptyState
              title="Belum ada tiket"
              hint="Klik “Tiket baru” untuk mulai bertanya ke CS."
              action={
                <Button size="sm" onClick={() => setShowNew(true)}>
                  <Plus size={15} /> Tiket baru
                </Button>
              }
            />
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openTicket(t.id)}
                aria-current={t.id === selectedId ? 'true' : undefined}
                className={cn(
                  'flex w-full items-start gap-3 rounded-card border border-border bg-card p-3.5 text-left shadow-1 hover:bg-muted/40',
                  t.id === selectedId && 'border-primary/50',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                    t.hasUnread ? 'bg-primary' : 'bg-border',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      #{t.id} · {t.subject}
                    </span>
                    <StatusPill status={t.status} />
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {t.hasUnread ? 'Ada balasan baru dari CS · ' : ''}
                    {fullDate(t.updatedAt)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        {/* Thread */}
        <div className={cn('min-w-0 flex-col', showThread ? 'flex' : 'hidden md:flex')}>
          {!showThread ? (
            <Card title="Pilih tiket">
              <p className="text-sm leading-6 text-muted-foreground">
                Pilih tiket di kiri untuk membaca percakapan, atau buat tiket baru.
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
            <Card
              title={`#${detail.id} · ${detail.subject}`}
              action={<StatusPill status={detail.status} />}
            >
              <button
                type="button"
                onClick={backToList}
                className="mb-3 text-[13px] font-medium text-primary hover:underline md:hidden"
              >
                ← Kembali ke daftar
              </button>
              <TicketThread messages={detail.messages} />
              <div ref={bottomRef} />
              {detail.status === 'closed' ? (
                <p className="mt-4 rounded-control border border-border bg-muted/50 px-3 py-2.5 text-[13px] leading-5 text-muted-foreground">
                  Tiket ini sudah ditutup. Buat tiket baru bila masih butuh bantuan.
                </p>
              ) : (
                <form onSubmit={(e) => void handleReply(e)} className="mt-4 flex flex-col gap-2">
                  <TextArea
                    aria-label="Tulis balasan"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Tulis balasan… (Enter untuk baris baru)"
                    maxLength={2000}
                    rows={3}
                    required
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmClose(true)}
                    >
                      Tutup tiket
                    </Button>
                    <Button type="submit" size="sm" disabled={sending || !reply.trim()}>
                      <Send size={14} /> {sending ? 'Mengirim…' : 'Kirim'}
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}
        </div>
      </div>

      {showNew ? (
        <Modal title="Tiket baru" onClose={() => setShowNew(false)}>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3">
            <TextInput
              label="Judul"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Contoh: Session tidak bisa terhubung"
              maxLength={255}
              required
            />
            <TextArea
              label="Ceritakan kendalamu"
              value={firstMsg}
              onChange={(e) => setFirstMsg(e.target.value)}
              placeholder="Jelaskan sedetail mungkin: session mana, sejak kapan, pesan error apa…"
              maxLength={2000}
              rows={5}
              required
            />
            <Button type="submit" disabled={creating}>
              {creating ? 'Membuat…' : 'Kirim ke CS'}
            </Button>
          </form>
        </Modal>
      ) : null}

      {confirmClose && detail ? (
        <ConfirmDialog
          title="Tutup tiket?"
          message={
            <span>
              Tutup tiket <b>#{detail.id}</b> ({detail.subject})? Kamu tidak bisa membalas lagi
              setelah ditutup.
            </span>
          }
          confirmLabel="Ya, tutup"
          busy={closing}
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => void handleClose()}
        />
      ) : null}
    </div>
  );
}

export default function CsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex max-w-4xl flex-col gap-3" aria-label="Memuat tiket">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-16" />
        </div>
      }
    >
      <CsContent />
    </Suspense>
  );
}
