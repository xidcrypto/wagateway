'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowDown, Paperclip, Plus, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Fields';
import { SendCustomModal } from '@/components/chat/SendComposer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { useVisiblePoll } from '@/lib/client/use-poll';
import { cn } from '@/lib/client/cn';
import {
  ApiError,
  getHistory,
  listConversations,
  listSessions,
  sendText,
  type ConversationItem,
  type HistoryMessage,
  type SessionItem,
} from '@/lib/client/api';

function displayName(jid: string): string {
  if (jid.endsWith('@g.us')) return jid;
  return jid.replace('@s.whatsapp.net', '').replace('@lid', '');
}

function isGroup(jid: string): boolean {
  return jid.endsWith('@g.us');
}

function Tick({ status }: { status: string | null }) {
  if (status === 'read')
    return (
      <span className="font-bold text-status-open" aria-label="Dibaca">
        ✓✓
      </span>
    );
  if (status === 'delivered')
    return (
      <span className="text-muted-foreground" aria-label="Diterima">
        ✓✓
      </span>
    );
  if (status === 'sent')
    return (
      <span className="text-muted-foreground" aria-label="Terkirim">
        ✓
      </span>
    );
  if (status === 'failed')
    return (
      <span className="font-bold text-status-failed" aria-label="Gagal">
        !
      </span>
    );
  return null;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return 'Hari ini';
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate())
    return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

type PendingMsg = HistoryMessage & { pending?: boolean; failed?: boolean };

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [convs, setConvs] = useState<ConversationItem[]>([]);
  const [remoteJid, setRemoteJid] = useState('');
  const [search, setSearch] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [messages, setMessages] = useState<PendingMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [stickBottom, setStickBottom] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    listSessions()
      .then((r) => {
        if (cancelled) return;
        setSessions(r.sessions);
        if (r.sessions.length > 0) setSessionId(r.sessions[0].id);
        else setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          toast('error', e instanceof ApiError ? e.message : 'Gagal memuat session.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Muat kontak saat ganti session: fetch async, setState di callback.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    listConversations(sessionId)
      .then((r) => {
        if (cancelled) return;
        setConvs(r.conversations);
        setRemoteJid((prev) =>
          prev && r.conversations.some((c) => c.remoteJid === prev)
            ? prev
            : (r.conversations[0]?.remoteJid ?? ''),
        );
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        toast('error', e instanceof ApiError ? e.message : 'Gagal memuat kontak.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useVisiblePoll(
    async () => {
      if (!sessionId || !remoteJid) return;
      try {
        const r = await getHistory(sessionId, remoteJid, 50);
        const fresh = [...r.messages].reverse();
        setMessages((prev) => {
          const pend = prev.filter((m) => m.pending);
          const prevIds = new Set(prev.filter((m) => !m.pending).map((m) => m.id));
          const freshNew = fresh.filter((m) => !prevIds.has(m.id));
          if (freshNew.length === 0 && pend.length === prev.filter((m) => m.pending).length) {
            // Data sama kecuali pending: hindari render ulang.
            if (fresh.length === prev.filter((m) => !m.pending).length) return prev;
          }
          if (!stickBottom && freshNew.length > 0) setHasNew(true);
          return [...fresh, ...pend];
        });
      } catch {
        // Abaikan sesaat.
      }
    },
    3000,
    Boolean(sessionId && remoteJid),
  );

  // Scroll mengikuti bawah hanya bila user sedang di bawah (auto-scroll cerdas).
  // hasNew dibersihkan di onScroll / tombol "Pesan baru", bukan di sini.
  useEffect(() => {
    if (stickBottom) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages.length, stickBottom]);

  function onScroll(): void {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setStickBottom(nearBottom);
    if (nearBottom) setHasNew(false);
  }

  async function handleSend(e?: FormEvent, retryText?: string): Promise<void> {
    e?.preventDefault();
    const text = (retryText ?? draft).trim();
    if (!text || !sessionId || !remoteJid || sending) return;
    setSending(true);
    pendingSeq.current += 1;
    const tempId = `pending-${pendingSeq.current}`;
    const optimistic: PendingMsg = {
      id: tempId,
      direction: 'out',
      waId: null,
      remoteJid,
      msgType: 'conversation',
      textBody: text,
      status: 'pending',
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    if (!retryText) setDraft('');
    try {
      await sendText(sessionId, remoteJid, text);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      const r = await getHistory(sessionId, remoteJid, 50);
      setMessages([...r.messages].reverse());
      setStickBottom(true);
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, failed: true, pending: false, status: 'failed' } : m)),
      );
      toast('error', err instanceof ApiError ? err.message : 'Gagal mengirim.');
    } finally {
      setSending(false);
    }
  }

  function handleNewChat(e: FormEvent): void {
    e.preventDefault();
    const digits = newNumber.replace(/\D/g, '');
    if (!digits || digits.startsWith('0')) {
      toast('error', 'Nomor harus format internasional tanpa awalan nol.');
      return;
    }
    const jid = `${digits}@s.whatsapp.net`;
    setRemoteJid(jid);
    setMessages([]);
    setNewNumber('');
    setStickBottom(true);
  }

  const session = sessions.find((s) => s.id === sessionId);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter(
      (c) =>
        displayName(c.remoteJid).toLowerCase().includes(q) ||
        (c.lastMessage.textBody ?? '').toLowerCase().includes(q),
    );
  }, [convs, search]);

  const activeConv = convs.find((c) => c.remoteJid === remoteJid);
  const chatting = Boolean(remoteJid);

  // Kelompokkan pesan per tanggal.
  const grouped: Array<{ day: string; items: PendingMsg[] }> = useMemo(() => {
    const out: Array<{ day: string; items: PendingMsg[] }> = [];
    for (const m of messages) {
      const day = dayLabel(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages]);

  if (loading && sessions.length === 0) {
    return (
      <div className="flex flex-col gap-3" aria-label="Memuat chat">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const contactList = (
    <div className="flex h-full flex-col rounded-card border border-border bg-card">
      <div className="border-b border-border p-3">
        <form onSubmit={handleNewChat} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-3 text-muted-foreground" />
            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="Nomor baru (62812…)"
              inputMode="tel"
              aria-label="Nomor baru"
              className="w-full rounded-control border border-border bg-background py-2 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" aria-label="Mulai chat baru">
            <Plus size={15} />
          </Button>
        </form>
        <div className="relative mt-2">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kontak…"
            aria-label="Cari kontak"
            className="w-full rounded-control border border-border bg-background py-2 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {convs.length === 0 ? 'Belum ada percakapan. Ketik nomor di atas untuk mulai.' : 'Tidak cocok dengan pencarian.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((c) => {
              const active = c.remoteJid === remoteJid;
              return (
                <li key={c.remoteJid}>
                  <button
                    type="button"
                    onClick={() => {
                      setRemoteJid(c.remoteJid);
                      setStickBottom(true);
                    }}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'pressable flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left',
                      active ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    <Avatar name={displayName(c.remoteJid)} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {isGroup(c.remoteJid) ? '👥 ' : ''}
                          {displayName(c.remoteJid)}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {new Date(c.lastMessage.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </span>
                      <span className="truncate text-[13px] text-muted-foreground">
                        {c.lastMessage.textBody || `[${c.lastMessage.msgType}]`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const thread = !chatting ? (
    <div className="hidden h-full items-center justify-center rounded-card border border-border bg-card md:flex">
      <EmptyState title="Pilih percakapan" hint="Pilih kontak di samping untuk mulai membaca dan membalas." />
    </div>
  ) : (
    <div className="flex h-full min-h-0 flex-col rounded-card border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          aria-label="Kembali ke kontak"
          onClick={() => setRemoteJid('')}
          className="pressable rounded-control p-2 hover:bg-muted md:hidden"
        >
          <ArrowLeft size={18} />
        </button>
        {session ? <StatusOrb status={session.status} size={8} /> : null}
        <button type="button" onClick={() => setShowInfo((v) => !v)} className="min-w-0 flex-1 text-left" aria-expanded={showInfo}>
          <p className="truncate text-sm font-semibold">{displayName(remoteJid)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {session ? `${session.label} · ${session.status}` : ''}
          </p>
        </button>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto p-3">
        {grouped.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada pesan. Kirim pesan pertama di bawah.
          </p>
        ) : (
          grouped.map((g) => (
            <div key={g.day}>
              <p className="sticky top-0 z-10 mx-auto my-2 w-fit rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                {g.day}
              </p>
              <div className="flex flex-col gap-1.5">
                {g.items.map((m) => {
                  const out = m.direction === 'out';
                  return (
                    <div key={m.id} className={cn('flex', out ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[85%] rounded-card px-3 py-2 text-sm',
                          out
                            ? 'rounded-br-[4px] bg-primary text-primary-foreground'
                            : 'rounded-bl-[4px] border border-border bg-background',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.textBody || `[${m.msgType}]`}</p>
                        <p className={cn('mt-1 flex items-center justify-end gap-1 text-[11px]', out ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                          {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {out ? <Tick status={m.failed ? 'failed' : m.status} /> : null}
                          {m.pending ? <span>mengirim…</span> : null}
                        </p>
                        {m.failed ? (
                          <button
                            type="button"
                            data-retry={m.textBody ?? ''}
                            onClick={(ev) => {
                              ev.preventDefault();
                              const t = ev.currentTarget.getAttribute('data-retry') ?? '';
                              void handleSend(undefined, t);
                            }}
                            className="pressable mt-1 rounded border border-white/40 px-2 py-0.5 text-xs font-semibold"
                          >
                            Kirim ulang
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        {hasNew ? (
          <button
            type="button"
            onClick={() => {
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
              setStickBottom(true);
              setHasNew(false);
            }}
            className="pressable sticky bottom-2 mx-auto flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-2"
          >
            <ArrowDown size={13} /> Pesan baru
          </button>
        ) : null}
      </div>
      <form
        onSubmit={(e) => void handleSend(e)}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <button
          type="button"
          aria-label="Kirim gambar, tombol, dan lainnya"
          title="Kirim gambar, tombol, dan lainnya"
          onClick={() => setCustomOpen(true)}
          disabled={!sessionId || !remoteJid}
          className="pressable flex min-h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border bg-background hover:bg-muted disabled:opacity-55"
        >
          <Paperclip size={16} />
        </button>
        <textarea
          ref={areaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const el = areaRef.current;
            if (el) {
              el.style.height = 'auto';
              el.style.height = `${Math.min(140, el.scrollHeight)}px`;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Ketik pesan… (Enter kirim, Shift+Enter baris baru)"
          aria-label="Pesan"
          rows={1}
          className="max-h-36 min-h-10 flex-1 resize-none rounded-control border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <Button type="submit" disabled={sending || !draft.trim()} aria-label="Kirim pesan">
          <Send size={15} /> {sending ? '…' : 'Kirim'}
        </Button>
      </form>
    </div>
  );

  const info = chatting ? (
    <div className={cn('rounded-card border border-border bg-card p-4', !showInfo && 'hidden xl:block')}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar name={displayName(remoteJid)} size={64} />
        <p className="break-all font-display text-base font-semibold">{displayName(remoteJid)}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">{remoteJid}</p>
        {activeConv ? (
          <p className="text-[13px] text-muted-foreground">{activeConv.total} pesan</p>
        ) : null}
        <StatusBadge status={session?.status ?? '?'} />
      </div>
    </div>
  ) : null;

  async function refreshThread(): Promise<void> {
    if (!sessionId || !remoteJid) return;
    try {
      const r = await getHistory(sessionId, remoteJid, 50);
      setMessages([...r.messages].reverse());
      setStickBottom(true);
    } catch {
      // Abaikan sesaat.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Balas percakapan langsung. Polling tiap 3 detik, berhenti saat tab disembunyikan.
          </p>
        </div>
        <div className="w-full max-w-64">
          <Select
            aria-label="Session"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            {sessions.length === 0 ? <option value="">Belum ada session</option> : null}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.status}{s.phone ? ` · ${s.phone}` : ''})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {session && session.status !== 'open' ? (
        <p role="alert" className="rounded-control border border-status-connecting/40 bg-status-connecting/10 px-3 py-2 text-sm">
          Session belum terhubung (status: {session.status}). Kirim pesan akan ditolak. Sambungkan dulu dari halaman Sessions.
        </p>
      ) : null}

      {/* Mobile: satu zona penuh */}
      <div className="h-[62vh] md:hidden">{chatting ? thread : contactList}</div>

      {/* Desktop: tiga zona */}
      <div className="hidden h-[62vh] gap-3 md:grid md:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_240px]">
        {contactList}
        {thread}
        {info}
      </div>

      <SendCustomModal
        sessionId={sessionId}
        remoteJid={remoteJid}
        sessionOpen={session?.status === 'open'}
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onSent={() => void refreshThread()}
      />
    </div>
  );
}
