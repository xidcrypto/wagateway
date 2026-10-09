'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, TextInput } from '@/components/ui/Fields';
import { toast } from '@/components/ui/Toast';
import {
  ApiError,
  listConversations,
  listSessions,
  searchMessages,
  type ConversationItem,
  type HistoryMessage,
  type SessionItem,
} from '@/lib/client/api';

const PAGE_SIZE = 20;

function shortJid(jid: string): string {
  if (jid.endsWith('@g.us')) return `Grup ${jid.slice(0, 12)}…`;
  return jid.replace('@s.whatsapp.net', '').replace('@lid', '');
}

export default function MessagesPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [contacts, setContacts] = useState<ConversationItem[]>([]);
  const [direction, setDirection] = useState<'' | 'in' | 'out'>('');
  const [remoteJid, setRemoteJid] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Session sekali.
  useEffect(() => {
    let cancelled = false;
    listSessions()
      .then((r) => {
        if (!cancelled) {
          setSessions(r.sessions);
          if (r.sessions.length > 0) setSessionId(r.sessions[0].id);
          else setLoading(false);
        }
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

  // Kontak + reset filter tiap ganti session.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    listConversations(sessionId, 200)
      .then((r) => {
        if (!cancelled) setContacts(r.conversations);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Muat pesan tiap filter berubah.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    searchMessages(sessionId, { remoteJid, direction, q, limit: PAGE_SIZE, offset })
      .then((r) => {
        if (!cancelled) {
          setMessages(r.messages);
          setTotal(r.total);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast('error', e instanceof ApiError ? e.message : 'Gagal memuat pesan.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, remoteJid, direction, q, offset]);

  function handleSessionChange(id: string): void {
    setLoading(true);
    setSessionId(id);
    setRemoteJid('');
    setDirection('');
    setQInput('');
    setQ('');
    setOffset(0);
  }

  function handleSearch(e: FormEvent): void {
    e.preventDefault();
    setQ(qInput.trim());
    setOffset(0);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Pesan</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Riwayat masuk dan keluar per session.
          {total > 0 ? ` Menampilkan ${messages.length} dari ${total}.` : ''}
        </p>
      </div>

      <Card title="Filter">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Session"
            value={sessionId}
            onChange={(e) => handleSessionChange(e.target.value)}
          >
            {sessions.length === 0 ? <option value="">Belum ada session</option> : null}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.status})
              </option>
            ))}
          </Select>
          <Select
            label="Kontak"
            value={remoteJid}
            onChange={(e) => {
              setRemoteJid(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Semua kontak</option>
            {contacts.map((c) => (
              <option key={c.remoteJid} value={c.remoteJid}>
                {shortJid(c.remoteJid)}
              </option>
            ))}
          </Select>
          <Select
            label="Arah"
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value as '' | 'in' | 'out');
              setOffset(0);
            }}
          >
            <option value="">Masuk + keluar</option>
            <option value="in">Masuk</option>
            <option value="out">Keluar</option>
          </Select>
          <form onSubmit={handleSearch} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextInput
                label="Cari teks"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="kata kunci…"
              />
            </div>
            <Button type="submit" variant="secondary" aria-label="Cari">
              <Search size={16} />
            </Button>
          </form>
        </div>
      </Card>

      {loading ? (
        <p className="text-zinc-400">Memuat…</p>
      ) : messages.length === 0 ? (
        <Card title="Tidak ada pesan">
          <p className="text-sm text-zinc-400">
            Belum ada pesan untuk filter ini.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs text-zinc-500">{shortJid(m.remoteJid)}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    m.direction === 'out'
                      ? 'bg-emerald-950 text-emerald-300'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {m.direction === 'out' ? 'keluar' : 'masuk'}
                  {m.status ? ` · ${m.status}` : ''}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-100">
                {m.textBody || `[${m.msgType}]`}
              </p>
              <p className="mt-1 text-[11px] text-zinc-600">
                {new Date(m.createdAt).toLocaleString('id-ID')}
              </p>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            <span className="flex items-center gap-1">
              <ChevronLeft size={14} /> Sebelumnya
            </span>
          </Button>
          <span className="text-sm text-zinc-400">
            {page} / {pages}
          </span>
          <Button
            variant="secondary"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            <span className="flex items-center gap-1">
              Berikutnya <ChevronRight size={14} />
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
