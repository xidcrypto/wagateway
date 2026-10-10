'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Fields';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { ResponsiveTable } from '@/components/ui/Controls';
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

function useDebounce(value: string, ms: number): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function MessagesPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [contacts, setContacts] = useState<ConversationItem[]>([]);
  const [direction, setDirection] = useState<'' | 'in' | 'out'>('');
  const [remoteJid, setRemoteJid] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [qInput, setQInput] = useState('');
  const q = useDebounce(qInput, 400);
  const [offset, setOffset] = useState(0);
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<HistoryMessage | null>(null);

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

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    searchMessages(sessionId, { remoteJid, direction, q, limit: PAGE_SIZE, offset })
      .then((r) => {
        if (cancelled) return;
        let rows = r.messages;
        if (dateFrom || dateTo) {
          const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity;
          const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Infinity;
          rows = rows.filter((m) => {
            const t = new Date(m.createdAt).getTime();
            return t >= from && t <= to;
          });
        }
        setMessages(rows);
        setTotal(r.total);
      })
      .catch((e) => {
        if (!cancelled) toast('error', e instanceof ApiError ? e.message : 'Gagal memuat pesan.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, remoteJid, direction, q, offset, dateFrom, dateTo]);

  function resetFilter(id: string): void {
    setLoading(true);
    setSessionId(id);
    setRemoteJid('');
    setDirection('');
    setQInput('');
    setDateFrom('');
    setDateTo('');
    setOffset(0);
  }

  function exportCsv(): void {
    const head = 'id,arah,kontak,tipe,status,waktu,teks\n';
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const body = messages
      .map((m) =>
        [m.id, m.direction, m.remoteJid, m.msgType, m.status ?? '', m.createdAt, m.textBody ?? '']
          .map(esc)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([head + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pesan-${sessionId.slice(0, 8)}-hal${Math.floor(offset / PAGE_SIZE) + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('success', 'File CSV halaman aktif diunduh.');
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows = useMemo(
    () =>
      messages.map((m) => ({
        key: m.id,
        cells: [
          <span key="a" className={m.direction === 'out' ? 'font-semibold text-primary' : 'font-semibold text-status-open'}>
            {m.direction === 'out' ? 'Keluar' : 'Masuk'}
          </span>,
          <span key="b" className="break-all font-mono text-[13px]">{shortJid(m.remoteJid)}</span>,
          <span key="c" className="max-w-72 truncate">{m.textBody || `[${m.msgType}]`}</span>,
          <span key="d">{m.status ? <StatusBadge status={m.status} /> : <span className="text-muted-foreground">–</span>}</span>,
          <span key="e" className="whitespace-nowrap text-muted-foreground">{fmtDate(m.createdAt)}</span>,
          <span key="f">
            <Button size="sm" variant="secondary" onClick={() => setDetail(m)}>
              Detail
            </Button>
          </span>,
        ],
        card: (
          <button type="button" onClick={() => setDetail(m)} className="flex w-full flex-col gap-1 text-left">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-xs text-muted-foreground">{shortJid(m.remoteJid)}</span>
              {m.status ? <StatusBadge status={m.status} /> : null}
            </span>
            <span className="line-clamp-2 text-sm">{m.textBody || `[${m.msgType}]`}</span>
            <span className="text-xs text-muted-foreground">
              {m.direction === 'out' ? 'Keluar' : 'Masuk'} · {fmtDate(m.createdAt)}
            </span>
          </button>
        ),
      })),
    [messages],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Pesan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Riwayat masuk dan keluar per session.
            {total > 0 ? ` Menampilkan ${messages.length} dari ${total}.` : ''}
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={messages.length === 0}>
          <Download size={15} /> Ekspor CSV
        </Button>
      </div>

      <div className="rounded-card border border-border bg-card p-4 shadow-1">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Select label="Session" value={sessionId} onChange={(e) => resetFilter(e.target.value)}>
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
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="Dari tanggal"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setOffset(0);
              }}
            />
            <TextInput
              label="Sampai"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="relative sm:col-span-2 xl:col-span-1">
            <TextInput
              label="Cari teks"
              value={qInput}
              onChange={(e) => {
                setQInput(e.target.value);
                setOffset(0);
              }}
              placeholder="kata kunci… (otomatis)"
              className="pl-9"
            />
            <Search size={15} className="pointer-events-none absolute bottom-3 left-3 text-muted-foreground" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2" aria-label="Memuat pesan">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState title="Tidak ada pesan" hint="Belum ada pesan untuk filter ini. Ubah filter atau kirim pesan dulu dari halaman Chat." />
      ) : (
        <div className="rounded-card border border-border bg-card p-2 shadow-1 sm:p-3">
          <ResponsiveTable
            columns={['Arah', 'Kontak', 'Isi', 'Status', 'Waktu', '']}
            rows={rows}
          />
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
            <ChevronLeft size={14} /> Sebelumnya
          </Button>
          <span className="tnum text-sm text-muted-foreground">
            {page} / {pages}
          </span>
          <Button variant="secondary" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
            Berikutnya <ChevronRight size={14} />
          </Button>
        </div>
      ) : null}

      <Dialog.Root open={detail !== null} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
          <Dialog.Content
            aria-label="Detail pesan"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card p-4 shadow-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Detail pesan</h2>
              <Dialog.Close asChild>
                <button type="button" aria-label="Tutup detail" className="pressable inline-flex min-h-10 min-w-10 items-center justify-center rounded-control p-2 hover:bg-muted">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            {detail ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge status={detail.direction} />
                  {detail.status ? <StatusBadge status={detail.status} /> : null}
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">ID {detail.id}</p>
                <p className="break-all font-mono text-xs text-muted-foreground">{detail.remoteJid}</p>
                <p className="whitespace-pre-wrap break-words rounded-control border border-border bg-background p-3">
                  {detail.textBody || `[${detail.msgType}]`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detail.msgType} · {fmtDate(detail.createdAt)}
                </p>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
