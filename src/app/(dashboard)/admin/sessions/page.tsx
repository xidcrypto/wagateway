'use client';

import { useEffect, useState } from 'react';
import { Search, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Select, TextInput } from '@/components/ui/Fields';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { ResponsiveTable } from '@/components/ui/Controls';
import { ADMIN_PAGE, errMsg, formatDateTime } from '@/components/admin/shared';
import { toast } from '@/components/ui/Toast';
import {
  forceStopSession,
  listAdminSessions,
  type AdminSession,
} from '@/lib/client/api';

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState<AdminSession | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(nextOffset = 0): Promise<void> {
    const first = nextOffset === 0 && sessions.length === 0;
    if (first) setLoading(true);
    else setSectionLoading(true);
    setError(null);
    try {
      const owner = ownerId.trim() === '' ? undefined : Number(ownerId.trim());
      if (ownerId.trim() !== '' && (!Number.isInteger(owner) || (owner as number) <= 0)) {
        toast('error', 'Filter pemilik harus berupa ID user angka positif.');
        return;
      }
      const r = await listAdminSessions({
        status: status || undefined,
        ownerId: owner,
        limit: ADMIN_PAGE,
        offset: nextOffset,
      });
      setSessions(r.sessions);
      setTotal(r.total);
      setOffset(r.offset);
    } catch (e) {
      if (first) setError(errMsg(e, 'Gagal memuat session.'));
      else toast('error', errMsg(e, 'Gagal memuat session.'));
    } finally {
      setLoading(false);
      setSectionLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listAdminSessions({ limit: ADMIN_PAGE, offset: 0 })
      .then((r) => {
        if (cancelled) return;
        setSessions(r.sessions);
        setTotal(r.total);
        setOffset(r.offset);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, 'Gagal memuat session.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleForceStop(): Promise<void> {
    if (!stopping) return;
    setBusy(true);
    try {
      await forceStopSession(stopping.id, false);
      toast('success', `Session "${stopping.label}" dihentikan (kredensial disimpan).`);
      setStopping(null);
      await load(offset);
    } catch (err) {
      toast('error', errMsg(err, 'Gagal menghentikan session.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-label="Memuat session">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <ErrorState
        message="Gagal memuat session."
        hint={error}
        onRetry={() => void load(0)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title={`Semua session (${total})`}>
        <form
          className="mb-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(0);
          }}
        >
          <div className="w-full max-w-48">
            <Select
              aria-label="Filter status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Semua status</option>
              {['open', 'qr', 'pairing', 'connecting', 'closed', 'stopped', 'logged_out'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="w-full max-w-48">
            <TextInput
              aria-label="Filter ID pemilik"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder="ID pemilik (mis. 3)"
              inputMode="numeric"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" disabled={sectionLoading}>
            <Search size={13} /> Filter
          </Button>
        </form>
        {sectionLoading ? (
          <div className="flex flex-col gap-2" aria-label="Memuat session">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <ResponsiveTable
            columns={['Session', 'Status', 'Aksi']}
            rows={sessions.map((s) => ({
              key: s.id,
              cells: [
                <span key="s" className="flex items-center gap-2.5">
                  <StatusOrb status={s.status} size={12} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {s.label}{s.phone ? ` · ${s.phone}` : ''}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {s.owner ? `@${s.owner.username}` : '(tanpa pemilik)'} · {formatDateTime(s.updatedAt)}
                    </span>
                  </span>
                </span>,
                <StatusBadge key="b" status={s.status} />,
                <span key="a">
                  {s.status !== 'stopped' && s.status !== 'logged_out' ? (
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => setStopping(s)}>
                      <Square size={13} /> Paksa stop
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </span>,
              ],
              card: (
                <div className="flex items-center gap-2.5">
                  <StatusOrb status={s.status} size={12} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {s.owner ? `@${s.owner.username}` : '(tanpa pemilik)'}{s.phone ? ` · ${s.phone}` : ''}
                    </p>
                    <p className="mt-1"><StatusBadge status={s.status} /></p>
                  </div>
                  {s.status !== 'stopped' && s.status !== 'logged_out' ? (
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => setStopping(s)} aria-label={`Paksa stop ${s.label}`}>
                      <Square size={13} />
                    </Button>
                  ) : null}
                </div>
              ),
            }))}
            empty={<EmptyState title="Tidak ada session" hint="Belum ada session yang cocok dengan filter." />}
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

      {stopping ? (
        <ConfirmDialog
          title="Paksa stop session?"
          message={
            <span>
              Hentikan session <b>{stopping.label}</b> milik {stopping.owner ? `@${stopping.owner.username}` : '(tanpa pemilik)'}?
              Kredensial disimpan sehingga bisa di-start tanpa scan ulang.
            </span>
          }
          confirmLabel="Ya, hentikan"
          busy={busy}
          onCancel={() => setStopping(null)}
          onConfirm={() => void handleForceStop()}
        />
      ) : null}
    </div>
  );
}
