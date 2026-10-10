'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Headset, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { TextArea, TextInput } from '@/components/ui/Fields';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { TicketThread } from '@/components/support/TicketThread';
import { TicketComposer } from '@/components/support/TicketComposer';
import { toast } from '@/components/ui/Toast';
import {
  useLiveEvents,
  type LiveNotificationEvent,
  type LiveTicketMessageEvent,
  type LiveTicketPresenceEvent,
  type LiveTicketTypingEvent,
} from '@/lib/client/use-live';
import {
  ApiError,
  closeTicket,
  createTicket,
  getTicket,
  getTicketPresence,
  listTickets,
  replyTicket,
  sendTicketTyping,
  uploadTicketImage,
  type TicketDetail,
  type TicketListItem,
  type TicketMessage,
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

function AdminOnlineDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 rounded-full',
          online ? 'bg-status-open' : 'bg-border',
        )}
      />
      {online ? 'CS online' : 'CS offline'}
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
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const typingTimer = useRef<number | null>(null);
  const typingSentAt = useRef(0);
  const selectedRef = useRef<number | null>(null);

  // Sinkron ref di effect (bukan saat render) — dipakai callback SSE.
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

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

  // Snapshot status online CS (sumber utama tetap event SSE).
  useEffect(() => {
    let cancelled = false;
    getTicketPresence()
      .then((r) => {
        if (!cancelled) setAdminOnline(r.adminOnline);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Muat thread tiket terpilih; ?id= ikut didukung (tautan dari notifikasi).
  // Seluruh setState di dalam fungsi async, bukan sinkron di body.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function fetchDetail(): Promise<void> {
      setDetail(null);
      setDetailLoading(true);
      setDetailError(null);
      setPeerTyping(false);
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

  // Hilangkan indikator typing 5 dtk setelah sinyal terakhir.
  function pokeTyping(): void {
    setPeerTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setPeerTyping(false), 5000);
  }

  const live = useLiveEvents({
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
      // Thread di-refresh via ticket.message (di bawah); fallback bila SSE
      // pesan hilang: refetch bila thread sedang dibuka.
      if (tid === selectedRef.current) {
        getTicket(tid)
          .then((r) => setDetail(r.ticket))
          .catch(() => {});
      }
    },
    onTicketMessage: (ev: LiveTicketMessageEvent) => {
      // Pesan baru masuk langsung ke thread tanpa refetch (fallback tetap ada).
      if (ev.ticketId !== selectedRef.current) return;
      const msg = ev.data as TicketMessage;
      if (!msg || !msg.id) return;
      setDetail((prev) => {
        if (!prev || prev.id !== ev.ticketId) return prev;
        if (prev.messages.some((x) => x.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
    },
    onTicketTyping: (ev: LiveTicketTypingEvent) => {
      // Hanya typing DARI cs yang ditampilkan di sisi user.
      if (ev.ticketId !== selectedRef.current || !ev.fromAdmin) return;
      pokeTyping();
    },
    onTicketPresence: (ev: LiveTicketPresenceEvent) => {
      setAdminOnline(ev.adminOnline);
    },
    onPoll: () => {
      // Fallback SSE down: refresh ringan (daftar + presence + thread).
      void loadList();
      getTicketPresence()
        .then((r) => setAdminOnline(r.adminOnline))
        .catch(() => {});
      const tid = selectedRef.current;
      if (tid) {
        getTicket(tid)
          .then((r) => setDetail(r.ticket))
          .catch(() => {});
      }
    },
  });

  // Bersihkan timer typing saat pindah tiket / unmount.
  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, []);

  function openTicket(id: number): void {
    setDetailError(null);
    setPeerTyping(false);
    router.push(`/cs?id=${id}`);
  }

  function backToList(): void {
    setDetail(null);
    setDetailError(null);
    setPeerTyping(false);
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

  /** Kirim teks (dari composer). */
  async function sendText(text: string): Promise<void> {
    if (!detail || !text || sending) return;
    setSending(true);
    try {
      const r = await replyTicket(detail.id, text);
      // Optimistic via respons (SSE ticket.message jadi dedup).
      setDetail((prev) => {
        if (!prev || prev.id !== detail.id) return prev;
        if (prev.messages.some((x) => x.id === r.message.id)) return prev;
        return { ...prev, messages: [...prev.messages, r.message] };
      });
      toast('success', 'Balasan terkirim.');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Gagal mengirim balasan.');
    } finally {
      setSending(false);
    }
  }

  /** Kirim gambar + caption (dari composer, setelah pratinjau). */
  async function sendImage(file: File, caption: string): Promise<void> {
    if (!detail || detail.status === 'closed' || uploading) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const r = await uploadTicketImage(detail.id, file, caption || undefined, (p) =>
        setUploadProgress(p),
      );
      setDetail((prev) => {
        if (!prev || prev.id !== detail.id) return prev;
        if (prev.messages.some((x) => x.id === r.message.id)) return prev;
        return { ...prev, messages: [...prev.messages, r.message] };
      });
      handleTypingPing();
      toast('success', 'Gambar terkirim.');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Gagal mengunggah gambar.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  /** Beri tahu CS "user sedang mengetik" (debounce 3 dtk, ikut mengetik gambar). */
  function handleTypingPing(): void {
    if (!selectedId || detail?.status === 'closed') return;
    const now = Date.now();
    if (now - typingSentAt.current < 3000) return;
    typingSentAt.current = now;
    sendTicketTyping(selectedId).catch(() => {});
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
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-6 text-muted-foreground">
            <span>Ada kendala atau pertanyaan? Buat tiket, CS kami akan membalas di sini.</span>
            <AdminOnlineDot online={adminOnline} />
            {!live.connected ? (
              <span className="text-[11px]">(mode polling)</span>
            ) : null}
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <AdminOnlineDot online={adminOnline} />
              </div>
              <TicketThread
                messages={detail.messages}
                peerReadAt={detail.peerReadAt}
                peerTyping={peerTyping}
                peerName="CS"
              />
              {detail.status === 'closed' ? (
                <p className="mt-4 rounded-control border border-border bg-muted/50 px-3 py-2.5 text-[13px] leading-5 text-muted-foreground">
                  Tiket ini sudah ditutup. Buat tiket baru bila masih butuh bantuan.
                </p>
              ) : (
                <TicketComposer
                  placeholder="Tulis balasan… (maks 2000 char, gambar ≤10 MB)"
                  sending={sending}
                  uploading={uploading}
                  progress={uploadProgress}
                  showClose
                  onCloseTicket={() => setConfirmClose(true)}
                  onSendText={(text) => void sendText(text)}
                  onSendImage={(file, caption) => void sendImage(file, caption)}
                  onTypingPing={handleTypingPing}
                  onError={(msg) => toast('error', msg)}
                />
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
