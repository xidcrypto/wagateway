'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Fields';
import { toast } from '@/components/ui/Toast';
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

/** Nama tampilan dari JID: nomor untuk chat pribadi, nama grup apa adanya. */
function displayName(jid: string): string {
  if (jid.endsWith('@g.us')) return jid;
  return jid.replace('@s.whatsapp.net', '').replace('@lid', '');
}

function isGroup(jid: string): boolean {
  return jid.endsWith('@g.us');
}

function statusTick(status: string | null): string {
  if (status === 'read') return '✓✓';
  if (status === 'delivered') return '✓✓';
  if (status === 'sent') return '✓';
  if (status === 'failed') return '!';
  return '';
}

function Bubble({ msg }: { msg: HistoryMessage }) {
  const out = msg.direction === 'out';
  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          out
            ? 'rounded-br-sm bg-emerald-900 text-emerald-50'
            : 'rounded-bl-sm bg-zinc-800 text-zinc-100'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {msg.textBody || `[${msg.msgType}]`}
        </p>
        <p className={`mt-1 text-right text-[11px] ${out ? 'text-emerald-300/70' : 'text-zinc-500'}`}>
          {new Date(msg.createdAt).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {out ? ` ${statusTick(msg.status)}` : ''}
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [convs, setConvs] = useState<ConversationItem[]>([]);
  const [remoteJid, setRemoteJid] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Muat daftar session sekali.
  useEffect(() => {
    let cancelled = false;
    listSessions()
      .then((r) => {
        if (cancelled) return;
        setSessions(r.sessions);
        if (r.sessions.length > 0) setSessionId(r.sessions[0].id);
      })
      .catch((e) => {
        if (!cancelled) {
          toast('error', e instanceof ApiError ? e.message : 'Gagal memuat session.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Muat kontak tiap ganti session.
  useEffect(() => {
    let cancelled = false;
    if (!sessionId) return () => {
      cancelled = true;
    };
    listConversations(sessionId)
      .then((r) => {
        if (cancelled) return;
        setConvs(r.conversations);
        // Pertahankan kontak terpilih bila masih ada.
        setRemoteJid((prev) =>
          prev && r.conversations.some((c) => c.remoteJid === prev)
            ? prev
            : (r.conversations[0]?.remoteJid ?? ''),
        );
      })
      .catch((e) => {
        if (!cancelled) {
          toast('error', e instanceof ApiError ? e.message : 'Gagal memuat kontak.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Polling riwayat tiap 3 detik (keputusan no. 7).
  useEffect(() => {
    if (!sessionId || !remoteJid) return;
    let cancelled = false;
    async function poll(): Promise<void> {
      try {
        const r = await getHistory(sessionId, remoteJid, 50);
        if (!cancelled) setMessages([...r.messages].reverse());
      } catch {
        // Abaikan error sesaat; poll berikutnya mencoba lagi.
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId, remoteJid]);

  // Scroll ke bawah tiap ada pesan baru.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: FormEvent): Promise<void> {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !sessionId || !remoteJid || sending) return;
    setSending(true);
    try {
      await sendText(sessionId, remoteJid, text);
      setDraft('');
      const r = await getHistory(sessionId, remoteJid, 50);
      setMessages([...r.messages].reverse());
    } catch (err) {
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
    setNewNumber('');
    if (!convs.some((c) => c.remoteJid === jid)) {
      setConvs((prev) => [
        {
          remoteJid: jid,
          lastMessage: {
            id: '0',
            direction: 'out',
            msgType: 'conversation',
            textBody: null,
            status: null,
            createdAt: new Date().toISOString(),
          },
          total: '0',
        },
        ...prev,
      ]);
    }
  }

  const session = sessions.find((s) => s.id === sessionId);
  const chatting = Boolean(remoteJid);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Chat</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Pilih session dan kontak, kirim teks, polling tiap 3 detik.
        </p>
      </div>

      <Select
        label="Session"
        value={sessionId}
        onChange={(e) => {
          setSessionId(e.target.value);
          setConvs([]);
          setRemoteJid('');
          setMessages([]);
        }}
      >
        {sessions.length === 0 ? <option value="">Belum ada session</option> : null}
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label} ({s.status}{s.phone ? ` · ${s.phone}` : ''})
          </option>
        ))}
      </Select>

      {session && session.status !== 'open' ? (
        <p role="alert" className="rounded-lg bg-amber-950 px-3 py-2 text-sm text-amber-300">
          Session belum open (status: {session.status}). Kirim pesan akan ditolak 409.
          Sambungkan dulu dari halaman Sessions.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {/* Daftar kontak */}
        <div className={`${chatting ? 'hidden md:block' : ''}`}>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
            <form onSubmit={handleNewChat} className="mb-3 flex gap-2">
              <div className="min-w-0 flex-1">
                <TextInput
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="Nomor baru (62812…)"
                  inputMode="tel"
                  aria-label="Nomor baru"
                />
              </div>
              <Button type="submit" variant="secondary">Chat</Button>
            </form>
            {convs.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Belum ada percakapan. Ketik nomor di atas untuk mulai chat baru.
              </p>
            ) : (
              <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
                {convs.map((c) => {
                  const active = c.remoteJid === remoteJid;
                  return (
                    <li key={c.remoteJid}>
                      <button
                        type="button"
                        onClick={() => setRemoteJid(c.remoteJid)}
                        className={`w-full rounded-lg px-3 py-2 text-left transition ${
                          active ? 'bg-emerald-950' : 'hover:bg-zinc-800'
                        }`}
                      >
                        <p className={`truncate text-sm font-medium ${active ? 'text-emerald-200' : 'text-zinc-100'}`}>
                          {isGroup(c.remoteJid) ? '👥 ' : ''}{displayName(c.remoteJid)}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {c.lastMessage.textBody || `[${c.lastMessage.msgType}]`}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Jendela chat */}
        <div className={`${chatting ? '' : 'hidden md:block'}`}>
          {!chatting ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
              Pilih kontak di samping untuk mulai chat.
            </div>
          ) : (
            <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900">
              <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <button
                  type="button"
                  aria-label="Kembali ke kontak"
                  onClick={() => setRemoteJid('')}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 md:hidden"
                >
                  <ArrowLeft size={18} />
                </button>
                <p className="truncate text-sm font-semibold text-zinc-100">
                  {displayName(remoteJid)}
                </p>
              </div>
              <div className="flex h-[50vh] flex-col gap-2 overflow-y-auto p-3">
                {messages.length === 0 ? (
                  <p className="m-auto text-sm text-zinc-500">
                    Belum ada pesan. Kirim pesan pertama di bawah.
                  </p>
                ) : (
                  messages.map((m) => <Bubble key={m.id} msg={m} />)
                )}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={(e) => void handleSend(e)} className="flex gap-2 border-t border-zinc-800 p-3">
                <div className="min-w-0 flex-1">
                  <TextInput
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ketik pesan…"
                    aria-label="Pesan"
                  />
                </div>
                <Button type="submit" disabled={sending || !draft.trim()}>
                  <span className="flex items-center gap-1">
                    <Send size={14} /> {sending ? '…' : 'Kirim'}
                  </span>
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
