'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Ban, Pause, Play, Plus, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, TextArea, TextInput } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import {
  ApiError,
  blastAction,
  createBlast,
  getBlastDetail,
  listBlasts,
  listSessions,
  type BlastDetail,
  type BlastItem,
  type SessionItem,
} from '@/lib/client/api';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

const BLAST_CLASS: Record<string, string> = {
  running: 'bg-sky-900 text-sky-200',
  queued: 'bg-zinc-800 text-zinc-300',
  paused: 'bg-amber-900 text-amber-200',
  done: 'bg-emerald-900 text-emerald-200',
  cancelled: 'bg-zinc-800 text-zinc-400',
  failed: 'bg-red-950 text-red-300',
};

function BlastBadge({ status }: { status: string }) {
  const cls = BLAST_CLASS[status] ?? 'bg-zinc-800 text-zinc-300';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function BlastDetailView({
  sessionId,
  blastId,
  onBack,
}: {
  sessionId: string;
  blastId: number;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<BlastDetail | null>(null);
  const [stats, setStats] = useState({ pending: 0, sent: 0, failed: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const r = await getBlastDetail(sessionId, blastId);
        if (!cancelled) {
          setDetail(r.blast);
          setStats(r.stats);
        }
      } catch (e) {
        if (!cancelled) toast('error', errMsg(e, 'Gagal memuat detail blast.'));
      }
    }
    void load();
    // Polling progres tiap 3 detik selama running (aturan global no. 7).
    timer.current = setInterval(() => {
      void load();
    }, 3000);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [sessionId, blastId]);

  async function handle(action: 'pause' | 'resume' | 'cancel'): Promise<void> {
    setBusy(true);
    try {
      await blastAction(sessionId, blastId, action);
      toast('success', action === 'pause' ? 'Blast dijeda.' : action === 'resume' ? 'Blast dilanjutkan.' : 'Blast dibatalkan.');
      const r = await getBlastDetail(sessionId, blastId);
      setDetail(r.blast);
      setStats(r.stats);
    } catch (e) {
      toast('error', errMsg(e, 'Gagal mengubah status blast.'));
    } finally {
      setBusy(false);
      setShowCancel(false);
    }
  }

  const pct = stats.total > 0 ? Math.round(((stats.sent + stats.failed) / stats.total) * 100) : 0;

  if (!detail) return <p className="text-zinc-400">Memuat detail…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="secondary" onClick={onBack}>
        <span className="flex items-center gap-1"><ArrowLeft size={14} /> Kembali ke daftar</span>
      </Button>

      <Card title={detail.label}>
        <div className="flex items-center gap-2">
          <BlastBadge status={detail.status} />
          <span className="text-xs text-zinc-500">
            {stats.sent}/{stats.total} terkirim{pct > 0 ? ` (${pct}%)` : ''}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex gap-3 text-xs text-zinc-400">
          <span>Pending: <b className="text-zinc-200">{stats.pending}</b></span>
          <span>Terkirim: <b className="text-emerald-300">{stats.sent}</b></span>
          <span>Gagal: <b className="text-red-300">{stats.failed}</b></span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{detail.textBody}</p>
        <p className="mt-2 text-xs text-zinc-500">
          Delay {detail.delayMin}–{detail.delayMax} ms
          {detail.error ? ` · Error: ${detail.error}` : ''}
        </p>
      </Card>

      <Card title="Aksi">
        <div className="flex flex-wrap gap-2">
          {detail.status === 'running' ? (
            <Button variant="secondary" disabled={busy} onClick={() => void handle('pause')}>
              <span className="flex items-center gap-1"><Pause size={14} /> Pause</span>
            </Button>
          ) : null}
          {detail.status === 'paused' ? (
            <Button disabled={busy} onClick={() => void handle('resume')}>
              <span className="flex items-center gap-1"><Play size={14} /> Resume</span>
            </Button>
          ) : null}
          {detail.status === 'running' || detail.status === 'paused' ? (
            <Button variant="danger" onClick={() => setShowCancel(true)}>
              <span className="flex items-center gap-1"><Ban size={14} /> Cancel</span>
            </Button>
          ) : null}
        </div>
      </Card>

      {showCancel ? (
        <Modal title="Batalkan blast?" onClose={() => setShowCancel(false)}>
          <p className="text-sm text-zinc-300">
            Batalkan <b>{detail.label}</b>? Progres {stats.sent}/{stats.total} tetap tersimpan,
            penerima pending tidak dikirim.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setShowCancel(false)}>Tidak</Button>
            <Button variant="danger" disabled={busy} onClick={() => void handle('cancel')}>
              Ya, batalkan
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export default function BlastPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [blasts, setBlasts] = useState<BlastItem[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [recipients, setRecipients] = useState('');
  const [delayMin, setDelayMin] = useState('1000');
  const [delayMax, setDelayMax] = useState('3000');
  const [creating, setCreating] = useState(false);

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
          toast('error', errMsg(e, 'Gagal memuat session.'));
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
    listBlasts(sessionId)
      .then((r) => {
        if (!cancelled) setBlasts(r.blasts);
      })
      .catch((e) => {
        if (!cancelled) {
          toast('error', errMsg(e, 'Gagal memuat blast.'));
          setBlasts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function refreshBlasts(): Promise<void> {
    if (!sessionId) return;
    try {
      const r = await listBlasts(sessionId);
      setBlasts(r.blasts);
    } catch (e) {
      toast('error', errMsg(e, 'Gagal memuat blast.'));
    }
  }

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!label.trim()) {
      toast('error', 'Label wajib diisi.');
      return;
    }
    if (!text.trim()) {
      toast('error', 'Teks template wajib diisi. Dukung {{nama}} dari vars.');
      return;
    }
    if (!recipients.trim()) {
      toast('error', 'Isi minimal 1 nomor penerima.');
      return;
    }
    const min = Number(delayMin);
    const max = Number(delayMax);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
      toast('error', 'Delay harus angka positif (ms). Minimal efektif 500 ms.');
      return;
    }
    setCreating(true);
    try {
      const r = await createBlast(sessionId, {
        label: label.trim(),
        text: text.trim(),
        recipients: recipients.trim(),
        delayMin: Math.floor(min),
        delayMax: Math.floor(max),
      });
      toast(
        'success',
        r.skipped > 0
          ? `Blast berjalan (${r.blast.total} nomor, ${r.skipped} dilewati).`
          : `Blast berjalan (${r.blast.total} nomor).`,
      );
      setLabel('');
      setText('');
      setRecipients('');
      setShowCreate(false);
      await refreshBlasts();
      setSelected(r.blast.id);
    } catch (err) {
      toast('error', errMsg(err, 'Gagal membuat blast.'));
    } finally {
      setCreating(false);
    }
  }

  const session = sessions.find((s) => s.id === sessionId);

  if (selected !== null) {
    return (
      <BlastDetailView
        sessionId={sessionId}
        blastId={selected}
        onBack={() => {
          setSelected(null);
          void refreshBlasts();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Blast</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Broadcast massal satu per satu dengan jeda acak.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={!sessionId}>
          <span className="flex items-center gap-1"><Plus size={16} /> Buat</span>
        </Button>
      </div>

      <Select
        label="Session"
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

      {session && session.status !== 'open' ? (
        <p role="alert" className="rounded-lg bg-amber-950 px-3 py-2 text-sm text-amber-300">
          Session belum open (status: {session.status}). Blast butuh koneksi aktif;
          campaign jalan akan otomatis paused.
        </p>
      ) : null}

      {loading ? (
        <p className="text-zinc-400">Memuat…</p>
      ) : blasts.length === 0 ? (
        <Card title="Belum ada blast">
          <p className="text-sm text-zinc-400">
            Buat campaign pertama dengan tombol Buat di atas.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {blasts.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setSelected(b.id)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-left transition hover:border-zinc-700"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-100">{b.label}</span>
                    <BlastBadge status={b.status} />
                  </span>
                  <span className="text-xs text-zinc-500">
                    #{b.id} · {b.total} penerima · delay {b.delayMin}–{b.delayMax} ms
                  </span>
                </span>
                {b.status === 'cancelled' || b.status === 'failed' ? (
                  <XCircle size={16} className="shrink-0 text-zinc-600" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate ? (
        <Modal title="Buat blast" onClose={() => setShowCreate(false)}>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3">
            <TextInput
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={255}
              required
            />
            <TextArea
              label="Teks template (dukung {{nama}})"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              required
            />
            <TextArea
              label="Penerima (satu nomor per baris / koma, format 62812…)"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              rows={5}
              required
            />
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <TextInput
                  label="Delay min (ms)"
                  value={delayMin}
                  onChange={(e) => setDelayMin(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="min-w-0 flex-1">
                <TextInput
                  label="Delay max (ms)"
                  value={delayMax}
                  onChange={(e) => setDelayMax(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Delay acak per pesan, minimum efektif 500 ms. Campaign langsung berjalan
              setelah dibuat.
            </p>
            <Button type="submit" disabled={creating}>
              {creating ? 'Membuat…' : 'Buat & jalankan'}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
