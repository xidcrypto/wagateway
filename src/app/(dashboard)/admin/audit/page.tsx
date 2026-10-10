'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, TextInput } from '@/components/ui/Fields';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { ResponsiveTable } from '@/components/ui/Controls';
import { ADMIN_PAGE, errMsg, formatDateTime } from '@/components/admin/shared';
import { toast } from '@/components/ui/Toast';
import {
  listAdminMessages,
  type AdminAuditMessage,
} from '@/lib/client/api';

export default function AdminAuditPage() {
  const [audit, setAudit] = useState<AdminAuditMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(nextOffset = 0, f = { q: search, direction, status }): Promise<void> {
    const first = nextOffset === 0 && audit.length === 0;
    if (first) setLoading(true);
    else setSectionLoading(true);
    try {
      const r = await listAdminMessages({
        q: f.q || undefined,
        direction: (f.direction || undefined) as '' | 'in' | 'out' | undefined,
        status: f.status || undefined,
        limit: ADMIN_PAGE,
        offset: nextOffset,
      });
      setAudit(r.messages);
      setTotal(r.total);
      setOffset(r.offset);
    } catch (e) {
      if (first) setError(errMsg(e, 'Gagal memuat audit pesan.'));
      else toast('error', errMsg(e, 'Gagal memuat audit pesan.'));
    } finally {
      setLoading(false);
      setSectionLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listAdminMessages({ limit: ADMIN_PAGE, offset: 0 })
      .then((r) => {
        if (cancelled) return;
        setAudit(r.messages);
        setTotal(r.total);
        setOffset(r.offset);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, 'Gagal memuat audit pesan.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce pencarian + muat ulang saat filter berubah (lewati fetch awal).
  // load() sengaja tidak dimasukkan ke deps (dipanggil dengan snapshot
  // agar debounce benar-benar menunda request).
  const firstFilter = useRef(true);
  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      return;
    }
    const snapshot = { q: search, direction, status };
    const t = window.setTimeout(() => {
      void load(0, snapshot);
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, direction, status]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-label="Memuat audit">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (error && audit.length === 0) {
    return (
      <ErrorState
        message="Gagal memuat audit pesan."
        hint={error}
        onRetry={() => void load(0)}
      />
    );
  }

  return (
    <Card title={`Audit pesan (${total})`}>
      <form
        className="mb-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load(0);
        }}
      >
        <div className="min-w-40 flex-1">
          <TextInput
            aria-label="Cari teks pesan"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari teks…"
          />
        </div>
        <div className="w-full max-w-36">
          <Select
            aria-label="Filter arah"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="">Semua arah</option>
            <option value="in">Masuk</option>
            <option value="out">Keluar</option>
          </Select>
        </div>
        <div className="w-full max-w-40">
          <Select
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Semua status</option>
            {['pending', 'sent', 'delivered', 'read', 'failed'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
      </form>
      {sectionLoading && audit.length === 0 ? (
        <div className="flex flex-col gap-2" aria-label="Memuat audit">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <ResponsiveTable
          columns={['Pesan', 'Arah', 'Status']}
          rows={audit.map((m) => ({
            key: m.id,
            cells: [
              <span key="m" className="block min-w-0 max-w-md">
                <span className="block truncate">{m.textBody || `(${m.msgType})`}</span>
                <span className="tnum block truncate font-mono text-xs text-muted-foreground">
                  {m.session?.label ?? m.sessionId} · {m.session?.owner ? `@${m.session.owner.username}` : ''} · {m.remoteJid} · {formatDateTime(m.createdAt)}
                </span>
              </span>,
              <StatusBadge key="d" status={m.direction} />,
              <span key="s">{m.status ? <StatusBadge status={m.status} /> : <span className="text-xs text-muted-foreground">—</span>}</span>,
            ],
            card: (
              <div className="min-w-0">
                <p className="truncate text-sm">{m.textBody || `(${m.msgType})`}</p>
                <p className="tnum truncate font-mono text-xs text-muted-foreground">
                  {m.session?.label ?? m.sessionId} · {m.remoteJid}
                </p>
                <p className="mt-1 flex items-center gap-2">
                  <StatusBadge status={m.direction} />
                  {m.status ? <StatusBadge status={m.status} /> : null}
                  <span className="tnum text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                </p>
              </div>
            ),
          }))}
          empty={<EmptyState title="Tidak ada pesan" hint="Belum ada pesan yang cocok dengan filter." />}
        />
      )}
      {total > ADMIN_PAGE ? (
        <div className="tnum mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {offset + 1}–{Math.min(offset + ADMIN_PAGE, total)} dari {total}
          </span>
          <span className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={offset === 0 || sectionLoading} onClick={() => void load(Math.max(0, offset - ADMIN_PAGE))}>
              Sebelumnya
            </Button>
            <Button variant="secondary" size="sm" disabled={offset + ADMIN_PAGE >= total || sectionLoading} onClick={() => void load(offset + ADMIN_PAGE)}>
              Berikutnya
            </Button>
          </span>
        </div>
      ) : null}
    </Card>
  );
}
