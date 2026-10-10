'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Megaphone,
  Pause,
  Play,
  Plus,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, TextArea, TextInput } from '@/components/ui/Fields';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { TabList } from '@/components/ui/Controls';
import { toast } from '@/components/ui/Toast';
import { useLiveEvents } from '@/lib/client/use-live';
import {
  ApiError,
  blastAction,
  createBlast,
  getBlastDetail,
  listBlasts,
  listSessions,
  type BlastButtonsInput,
  type BlastDetail,
  type BlastItem,
  type BlastMediaInput,
  type SessionItem,
} from '@/lib/client/api';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Normalisasi nomor versi pratinjau (server tetap otoritatif saat create). */
function normalizePreview(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15 || digits.startsWith('0')) return null;
  if (/^0+$/.test(digits)) return null;
  return digits;
}

function splitRaw(raw: string): string[] {
  return raw
    .split(/[\n\r,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Ringkasan penerima client-side untuk pratinjau (server yang memutuskan). */
function summarizeRecipients(raw: string): { valid: number; duplicates: number; invalid: number } {
  const seen = new Set<string>();
  let valid = 0;
  let duplicates = 0;
  let invalid = 0;
  for (const chunk of splitRaw(raw)) {
    const phone = normalizePreview(chunk);
    if (!phone) {
      invalid += 1;
      continue;
    }
    if (seen.has(phone)) {
      duplicates += 1;
      continue;
    }
    seen.add(phone);
    valid += 1;
  }
  return { valid, duplicates, invalid };
}

/** Variabel {{nama}} yang terdeteksi di template. */
function detectVars(template: string): string[] {
  const out: string[] = [];
  const re = /{{\s*([A-Za-z0-9_.]+)\s*}}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out.slice(0, 12);
}

/** Pratinjau template dengan contoh nama Budi. */
function previewTemplate(template: string): string {
  return template.replace(/{{\s*([A-Za-z0-9_.]+)\s*}}/g, (_m, key: string) =>
    key.toLowerCase() === 'nama' ? 'Budi' : `[${key}]`,
  );
}

function formatEta(pending: number, avgDelayMs: number): string {
  if (pending <= 0) return 'selesai';
  const sec = Math.round((pending * Math.max(avgDelayMs, 500)) / 1000);
  if (sec < 60) return `±${sec} dtk`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `±${min} mnt`;
  return `±${Math.floor(min / 60)} jam ${min % 60} mnt`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function compositionSummary(d: BlastDetail): string {
  const parts: string[] = [];
  const m = d.mediaJson as BlastMediaInput | null;
  const b = d.buttonsJson as BlastButtonsInput | null;
  if (m) parts.push(`media ${m.kind}`);
  if (b) {
    parts.push(
      b.mode === 'buttons'
        ? `${b.buttons.length} tombol`
        : b.mode === 'buttonv2'
          ? `${b.buttons.length} balas cepat`
          : 'list',
    );
  }
  if (parts.length === 0) return 'teks saja';
  return parts.join(' + ');
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  async function load(silent = false): Promise<void> {
    try {
      const r = await getBlastDetail(sessionId, blastId);
      setDetail((prev) => {
        if (
          prev &&
          prev.status === r.blast.status &&
          prev.label === r.blast.label &&
          prev.error === r.blast.error
        ) {
          return prev;
        }
        return r.blast;
      });
      setStats((prev) => {
        if (
          prev.pending === r.stats.pending &&
          prev.sent === r.stats.sent &&
          prev.failed === r.stats.failed &&
          prev.total === r.stats.total
        ) {
          return prev;
        }
        return r.stats;
      });
      setError(null);
    } catch (e) {
      if (!silent) setError(errMsg(e, 'Gagal memuat detail blast.'));
    }
  }

  // Reset saat ganti blast ditangani via key remount di parent.
  useEffect(() => {
    let cancelled = false;
    getBlastDetail(sessionId, blastId)
      .then((r) => {
        if (cancelled) return;
        setDetail(r.blast);
        setStats(r.stats);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, 'Gagal memuat detail blast.'));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, blastId]);

  // Live SSE-first: progres blast di-push tiap 5 penerima + saat selesai.
  // Fallback polling 8 dtk bila SSE mati (hanya saat running).
  useLiveEvents({
    onBlast: (ev) => {
      if (ev.blastId !== blastId) return;
      setStats((prev) => {
        const next = {
          pending: ev.data.pending,
          sent: ev.data.sent,
          failed: ev.data.failed,
          total: prev.total,
        };
        if (
          prev.pending === next.pending &&
          prev.sent === next.sent &&
          prev.failed === next.failed
        ) {
          return prev;
        }
        return next;
      });
      if (ev.data.finished || ev.data.status) {
        // Status akhir berubah (done/failed/paused): sinkronkan detail penuh.
        void load(true);
      }
    },
    onPoll: () => {
      if (detail?.status === 'running') void load(true);
    },
    fallbackMs: 8000,
    pollMs: 8000,
    enabled: detail?.status === 'running',
  });

  async function handle(action: 'pause' | 'resume' | 'cancel'): Promise<void> {
    setBusy(true);
    try {
      await blastAction(sessionId, blastId, action);
      toast(
        'success',
        action === 'pause'
          ? 'Blast dijeda.'
          : action === 'resume'
            ? 'Blast dilanjutkan.'
            : 'Blast dibatalkan.',
      );
      setShowCancel(false);
      await load();
    } catch (e) {
      toast('error', errMsg(e, 'Gagal mengubah status blast.'));
    } finally {
      setBusy(false);
    }
  }

  const pct = stats.total > 0 ? Math.round(((stats.sent + stats.failed) / stats.total) * 100) : 0;
  const pctRounded = pct;
  const avgDelay = detail ? Math.round((detail.delayMin + detail.delayMax) / 2) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft size={15} /> Kembali ke daftar
        </Button>
      </div>

      {!detail && !error ? (
        <div className="flex flex-col gap-3" aria-label="Memuat detail blast">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-40" />
        </div>
      ) : null}
      {error && !detail ? (
        <ErrorState
          message="Gagal memuat detail blast."
          hint={error}
          onRetry={() => void load()}
        />
      ) : null}

      {detail ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold">{detail.label}</h1>
            <StatusBadge status={detail.status} />
          </div>
          <p className="tnum text-sm text-muted-foreground">
            #{detail.id} · dibuat {formatDateTime(detail.createdAt)}
            {detail.startedAt ? ` · mulai ${formatDateTime(detail.startedAt)}` : ''}
            {detail.finishedAt ? ` · selesai ${formatDateTime(detail.finishedAt)}` : ''}
          </p>

          <Card title="Progres pengiriman">
            <div className="flex items-baseline justify-between gap-2">
              <p className="tnum font-display text-3xl font-bold">
                {pctRounded}
                <span className="text-lg text-muted-foreground">%</span>
              </p>
              <p className="tnum text-sm text-muted-foreground">
                {stats.sent}/{stats.total} terkirim
              </p>
            </div>
            <div
              role="progressbar"
              aria-valuenow={pctRounded}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progres blast"
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
            <div className="tnum mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-control bg-background px-1 py-2 sm:px-2">
                <p className="font-display text-lg font-bold text-status-connecting sm:text-xl">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-control bg-background px-1 py-2 sm:px-2">
                <p className="font-display text-lg font-bold text-status-open sm:text-xl">{stats.sent}</p>
                <p className="text-xs text-muted-foreground">Terkirim</p>
              </div>
              <div className="rounded-control bg-background px-1 py-2 sm:px-2">
                <p className="font-display text-lg font-bold text-status-failed sm:text-xl">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Gagal</p>
              </div>
            </div>
            {detail.status === 'running' ? (
              <p className="tnum mt-2 text-[13px] text-muted-foreground">
                Estimasi sisa: {formatEta(stats.pending, avgDelay)} ({stats.pending} pending × jeda ±{avgDelay} ms antar nomor)
              </p>
            ) : null}
          </Card>

          <Card title="Pesan">
            <p className="whitespace-pre-wrap text-sm leading-6">
              {detail.textBody || <span className="text-muted-foreground">(tanpa teks — media/tombol saja)</span>}
            </p>
            <p className="tnum mt-2 text-xs text-muted-foreground">
              Komposisi: {compositionSummary(detail)} · Jeda {detail.delayMin}–{detail.delayMax} ms antar nomor
              {detail.error ? ` · Galat: ${detail.error}` : ''}
            </p>
          </Card>

          <Card title="Aksi">
            <div className="flex flex-wrap gap-2">
              {detail.status === 'running' ? (
                <Button variant="secondary" disabled={busy} onClick={() => void handle('pause')}>
                  <Pause size={15} /> Jeda
                </Button>
              ) : null}
              {detail.status === 'paused' ? (
                <Button disabled={busy} onClick={() => void handle('resume')}>
                  <Play size={15} /> Lanjutkan
                </Button>
              ) : null}
              {detail.status === 'running' || detail.status === 'paused' ? (
                <Button variant="danger" onClick={() => setShowCancel(true)}>
                  <Ban size={15} /> Batalkan
                </Button>
              ) : null}
              {detail.status !== 'running' && detail.status !== 'paused' ? (
                <p className="text-sm text-muted-foreground">
                  Campaign sudah {detail.status}. Progres tersimpan dan tidak bisa diubah lagi.
                </p>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}

      {showCancel && detail ? (
        <ConfirmDialog
          title="Batalkan blast?"
          message={
            <span>
              Batalkan <b>{detail.label}</b>? Progres {stats.sent}/{stats.total} tetap tersimpan,
              penerima pending tidak dikirim.
            </span>
          }
          confirmLabel="Ya, batalkan"
          busy={busy}
          onCancel={() => setShowCancel(false)}
          onConfirm={() => void handle('cancel')}
        />
      ) : null}
    </div>
  );
}

const WIZARD_STEPS = [
  { value: 'pesan', label: '1. Pesan' },
  { value: 'penerima', label: '2. Penerima' },
  { value: 'pengaturan', label: '3. Pengaturan' },
];

export default function BlastPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [blasts, setBlasts] = useState<BlastItem[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState('pesan');
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [recipients, setRecipients] = useState('');
  const [delayMin, setDelayMin] = useState('3000');
  const [delayMax, setDelayMax] = useState('5000');
  const [creating, setCreating] = useState(false);
  // Komposisi opsional: media + tombol.
  const [useMedia, setUseMedia] = useState(false);
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | 'audio' | 'document' | 'sticker'>('image');
  const [mediaSrc, setMediaSrc] = useState('');
  const [useButtons, setUseButtons] = useState(false);
  const [buttonsMode, setButtonsMode] = useState<'buttons' | 'buttonv2' | 'list'>('buttons');
  // Template tombol tanpa JSON: user tinggal isi field.
  const [buttonRows, setButtonRows] = useState<
    Array<{ kind: 'reply' | 'url' | 'copy' | 'call'; text: string; value: string }>
  >([{ kind: 'reply', text: '', value: '' }]);
  const [quickRows, setQuickRows] = useState<Array<{ text: string }>>([{ text: '' }]);
  const [listSections, setListSections] = useState<
    Array<{ title: string; rows: Array<{ title: string; description: string }> }>
  >([{ title: '', rows: [{ title: '', description: '' }] }]);
  const [buttonsFooter, setButtonsFooter] = useState('');

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

  async function loadBlasts(sid: string): Promise<void> {
    try {
      const r = await listBlasts(sid);
      setBlasts(r.blasts);
      setListError(null);
    } catch (e) {
      setBlasts([]);
      setListError(errMsg(e, 'Gagal memuat blast.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    listBlasts(sessionId)
      .then((r) => {
        if (cancelled) return;
        setBlasts(r.blasts);
        setListError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setBlasts([]);
        setListError(errMsg(e, 'Gagal memuat blast.'));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Polling daftar saat ada campaign berjalan (p moves → done tanpa reload).
  const hasRunning = blasts.some((b) => b.status === 'running');
  // Live SSE-first untuk daftar: status campaign berubah → muat ulang
  // (hanya bila ada yang running dan tidak sedang melihat detail).
  useLiveEvents({
    onBlast: () => {
      if (sessionId && selected === null) void loadBlasts(sessionId);
    },
    onPoll: () => {
      if (sessionId && selected === null && hasRunning) void loadBlasts(sessionId);
    },
    fallbackMs: 8000,
    pollMs: 8000,
    enabled: hasRunning && selected === null,
  });

  const summary = useMemo(() => summarizeRecipients(recipients), [recipients]);
  const vars = useMemo(() => detectVars(text), [text]);

  function canNextFromPesan(): boolean {
    if (!label.trim()) {
      toast('error', 'Isi label campaign dulu.');
      return false;
    }
    // Teks boleh kosong bila ada media/tombol (validasi akhir saat buat).
    return true;
  }

  function canNextFromPenerima(): boolean {
    if (summary.valid === 0) {
      toast('error', 'Isi minimal 1 nomor penerima yang valid (format 62812…).');
      return false;
    }
    return true;
  }

  /** Template daftar tombol → payload buttons (tanpa JSON, id reply otomatis). */
  function parseBlastButtons(): BlastButtonsInput | null {
    if (!useButtons) return null;
    const footer = buttonsFooter.trim() ? buttonsFooter.trim() : undefined;
    if (buttonsMode === 'list') {
      const sections = listSections
        .map((s, si) => ({
          title: s.title.trim() || `Pilihan ${si + 1}`,
          rows: s.rows
            .map((r) => ({
              title: r.title.trim(),
              ...(r.description.trim() ? { description: r.description.trim() } : {}),
            }))
            .filter((r) => r.title.length > 0),
        }))
        .filter((s) => s.rows.length > 0);
      if (sections.length === 0) throw new Error('Isi minimal 1 section dengan 1 baris.');
      return { mode: 'list', sections, ...(footer ? { footer } : {}) };
    }
    if (buttonsMode === 'buttonv2') {
      const filled = quickRows.map((r) => r.text.trim()).filter(Boolean);
      if (filled.length === 0) throw new Error('Isi minimal 1 tombol balas cepat.');
      if (filled.length > 3) throw new Error('Balas cepat maksimal 3 tombol.');
      const buttons = filled.map((text, i) => ({ id: `btn-${i + 1}`, text }));
      return { mode: 'buttonv2', buttons, ...(footer ? { footer } : {}) };
    }
    const filled = buttonRows
      .map((r) => ({ kind: r.kind, text: r.text.trim(), value: r.value.trim() }))
      .filter((r) => r.text.length > 0);
    if (filled.length === 0) throw new Error('Isi minimal 1 tombol.');
    if (filled.length > 10) throw new Error('Maksimal 10 tombol.');
    const buttons = filled.map((r, i) => {
      if (r.kind === 'reply') return { type: 'reply' as const, id: `btn-${i + 1}`, text: r.text };
      if (r.kind === 'url') {
        if (!r.value) throw new Error(`Tombol ${i + 1}: isi URL tujuan (https).`);
        return { type: 'url' as const, text: r.text, url: r.value };
      }
      if (r.kind === 'copy') {
        if (!r.value) throw new Error(`Tombol ${i + 1}: isi teks yang disalin.`);
        return { type: 'copy' as const, text: r.text, copy: r.value };
      }
      if (!r.value) throw new Error(`Tombol ${i + 1}: isi nomor tujuan (format 62812…).`);
      return { type: 'call' as const, text: r.text, call: r.value };
    });
    return { mode: 'buttons', buttons, ...(footer ? { footer } : {}) };
  }

  function buildMedia(): BlastMediaInput | null {
    if (!useMedia) return null;
    if (!mediaSrc.trim()) throw new Error('Isi sumber media (URL / data URI / path lokal).');
    return { kind: mediaKind, media: mediaSrc.trim() };
  }

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!canNextFromPesan() || !canNextFromPenerima()) {
      setStep(!label.trim() ? 'pesan' : 'penerima');
      return;
    }
    const min = Number(delayMin);
    const max = Number(delayMax);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0) {
      toast('error', 'Jeda harus bilangan bulat ≥ 0 (ms).');
      setStep('pengaturan');
      return;
    }
    if (max < min) {
      toast('error', 'Jeda max harus ≥ jeda min.');
      setStep('pengaturan');
      return;
    }
    let media: BlastMediaInput | null = null;
    let buttons: BlastButtonsInput | null = null;
    try {
      media = buildMedia();
      buttons = parseBlastButtons();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Komposisi tidak valid.');
      setStep('pesan');
      return;
    }
    if (!text.trim() && !media && !buttons) {
      toast('error', 'Pesan kosong: isi teks, media, atau tombol (minimal satu).');
      setStep('pesan');
      return;
    }
    setCreating(true);
    try {
      const r = await createBlast(sessionId, {
        label: label.trim(),
        text: text.trim() || undefined,
        recipients: recipients.trim(),
        delayMin: min,
        delayMax: max,
        media,
        buttons,
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
      setDelayMin('3000');
      setDelayMax('5000');
      setUseMedia(false);
      setMediaSrc('');
      setUseButtons(false);
      setButtonsMode('buttons');
      setButtonRows([{ kind: 'reply', text: '', value: '' }]);
      setQuickRows([{ text: '' }]);
      setListSections([{ title: '', rows: [{ title: '', description: '' }] }]);
      setButtonsFooter('');
      setStep('pesan');
      setShowCreate(false);
      await loadBlasts(sessionId);
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
        key={`${sessionId}:${selected}`}
        sessionId={sessionId}
        blastId={selected}
        onBack={() => {
          setSelected(null);
          if (sessionId) void loadBlasts(sessionId);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Blast</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Broadcast massal satu per satu dengan jeda antar nomor.
          </p>
        </div>
        <Button onClick={() => { setStep('pesan'); setShowCreate(true); }} disabled={!sessionId}>
          <Plus size={15} /> Buat campaign
        </Button>
      </div>

      <div className="w-full max-w-72">
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

      {session && session.status !== 'open' ? (
        <p role="alert" className="rounded-control border border-status-connecting/40 bg-status-connecting/10 px-3 py-2 text-sm">
          Session belum terhubung (status: {session.status}). Blast butuh koneksi aktif;
          campaign yang jalan otomatis dijeda.
        </p>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2" aria-label="Memuat blast">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : listError ? (
        <ErrorState
          message="Gagal memuat daftar blast."
          hint={listError}
          onRetry={() => {
            if (sessionId) {
              setLoading(true);
              void loadBlasts(sessionId);
            }
          }}
        />
      ) : blasts.length === 0 ? (
        <EmptyState
          title="Belum ada campaign blast"
          hint="Buat campaign pertamamu: tulis pesan dengan variabel {{nama}} (opsional bila ada media/tombol), tempel daftar nomor, atur jeda antar nomor, lalu jalankan."
          action={
            <Button disabled={!sessionId} onClick={() => { setStep('pesan'); setShowCreate(true); }}>
              <Plus size={15} /> Buat campaign
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {blasts.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setSelected(b.id)}
                aria-label={`Lihat ${b.label}, status ${b.status}`}
                className="pressable flex w-full items-center justify-between gap-2 rounded-card border border-border bg-card px-3 py-2.5 text-left shadow-1 hover:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Megaphone size={16} className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{b.label}</span>
                      <StatusBadge status={b.status} />
                    </span>
                    <span className="tnum mt-0.5 block text-xs text-muted-foreground">
                      #{b.id} · {b.total} penerima · jeda {b.delayMin}–{b.delayMax} ms antar nomor · {formatDateTime(b.createdAt)}
                    </span>
                  </span>
                </span>
                {b.status === 'cancelled' || b.status === 'failed' ? (
                  <XCircle size={16} className="shrink-0 text-muted-foreground" />
                ) : b.status === 'done' ? (
                  <CheckCircle2 size={16} className="shrink-0 text-status-open" />
                ) : (
                  <ArrowRight size={16} className="shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate ? (
        <Modal title="Buat campaign blast" wide onClose={() => setShowCreate(false)}>
          <TabList tabs={WIZARD_STEPS} value={step} onChange={setStep} />
          <form onSubmit={(e) => void handleCreate(e)} className="mt-4 flex flex-col gap-3">
            {step === 'pesan' ? (
              <>
                <TextInput
                  label="Label campaign"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={255}
                  required
                  placeholder="Promo Oktober"
                />
                <TextArea
                  label="Teks pesan (dukung variabel {{nama}} — boleh kosong bila ada media/tombol)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  placeholder={'Halo {{nama}}, ada promo spesial buat kamu!'}
                />
                {vars.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Variabel terdeteksi: {vars.map((v) => `{{${v}}}`).join(', ')}. Variabel yang
                    hilang saat kirim menjadi string kosong.
                  </p>
                ) : null}
                <div className="rounded-card border border-border bg-background p-3">
                  <p className="text-xs font-medium text-muted-foreground">Pratinjau langsung</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                    {text.trim() ? previewTemplate(text) : '(tanpa teks — hanya media/tombol bila diisi di bawah)'}
                  </p>
                </div>
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useMedia}
                    onChange={(e) => setUseMedia(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Sertakan media (gambar/video/audio/dokumen/stiker)
                </label>
                {useMedia ? (
                  <div className="flex flex-col gap-3 rounded-card border border-border bg-background p-3">
                    <Select
                      label="Jenis media"
                      value={mediaKind}
                      onChange={(e) => setMediaKind(e.target.value as typeof mediaKind)}
                    >
                      <option value="image">Gambar (+caption dari teks)</option>
                      <option value="video">Video (+caption dari teks)</option>
                      <option value="audio">Audio / voice note</option>
                      <option value="document">Dokumen (+caption dari teks)</option>
                      <option value="sticker">Stiker (webp, tanpa teks)</option>
                    </Select>
                    <TextInput
                      label="Sumber media (URL https, data URI, atau path lokal di server)"
                      value={mediaSrc}
                      onChange={(e) => setMediaSrc(e.target.value)}
                      placeholder="https://… / data:… / /path/lokal"
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      Variabel {`{{nama}}`} juga bisa dipakai di caption (diambil dari teks di atas).
                      Media yang digabung tombol hanya mendukung gambar + mode “Tombol”.
                    </p>
                  </div>
                ) : null}
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useButtons}
                    onChange={(e) => setUseButtons(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Sertakan tombol interaktif
                </label>
                {useButtons ? (
                  <div className="flex flex-col gap-3 rounded-card border border-border bg-background p-3">
                    <Select
                      label="Mode tombol"
                      value={buttonsMode}
                      onChange={(e) => setButtonsMode(e.target.value as typeof buttonsMode)}
                    >
                      <option value="buttons">Tombol (maks 10)</option>
                      <option value="buttonv2">Balas cepat (maks 3)</option>
                      <option value="list">List pilihan</option>
                    </Select>
                    {buttonsMode === 'buttons' ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Isi teks tombol + tujuan tiap baris. ID reply dibuat otomatis.
                        </p>
                        {buttonRows.map((row, i) => (
                          <div key={i} className="flex flex-col gap-2 rounded-control border border-border p-2">
                            <div className="flex gap-2">
                              <div className="min-w-0 flex-1">
                                <Select
                                  aria-label={`Jenis tombol ${i + 1}`}
                                  value={row.kind}
                                  onChange={(e) => {
                                    const next = [...buttonRows];
                                    next[i] = { ...row, kind: e.target.value as typeof row.kind };
                                    setButtonRows(next);
                                  }}
                                >
                                  <option value="reply">Balas</option>
                                  <option value="url">Link</option>
                                  <option value="copy">Salin</option>
                                  <option value="call">Telepon</option>
                                </Select>
                              </div>
                              <div className="min-w-0 flex-[2]">
                                <TextInput
                                  aria-label={`Teks tombol ${i + 1}`}
                                  value={row.text}
                                  onChange={(e) => {
                                    const next = [...buttonRows];
                                    next[i] = { ...row, text: e.target.value };
                                    setButtonRows(next);
                                  }}
                                  maxLength={30}
                                  placeholder="Teks tombol (maks 30)"
                                />
                              </div>
                            </div>
                            {row.kind === 'reply' ? null : (
                              <TextInput
                                aria-label={`Tujuan tombol ${i + 1}`}
                                value={row.value}
                                onChange={(e) => {
                                  const next = [...buttonRows];
                                  next[i] = { ...row, value: e.target.value };
                                  setButtonRows(next);
                                }}
                                placeholder={
                                  row.kind === 'url'
                                    ? 'https://tokomu.id/promo'
                                    : row.kind === 'copy'
                                      ? 'Teks yang disalin (mis. KODEPROMO)'
                                      : 'Nomor tujuan (62812…)'
                                }
                              />
                            )}
                            {buttonRows.length > 1 ? (
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setButtonRows(buttonRows.filter((_, j) => j !== i))}
                                >
                                  Hapus
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {buttonRows.length < 10 ? (
                          <div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setButtonRows([...buttonRows, { kind: 'reply', text: '', value: '' }])}
                            >
                              <Plus size={14} /> Tambah tombol
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {buttonsMode === 'buttonv2' ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Teks balasan cepat (maks 3). ID dibuat otomatis.
                        </p>
                        {quickRows.map((row, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <TextInput
                                aria-label={`Balasan cepat ${i + 1}`}
                                value={row.text}
                                onChange={(e) => {
                                  const next = [...quickRows];
                                  next[i] = { text: e.target.value };
                                  setQuickRows(next);
                                }}
                                maxLength={30}
                                placeholder={`Pilihan ${i + 1} (mis. Ya / Tidak)`}
                              />
                            </div>
                            {quickRows.length > 1 ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setQuickRows(quickRows.filter((_, j) => j !== i))}
                              >
                                Hapus
                              </Button>
                            ) : null}
                          </div>
                        ))}
                        {quickRows.length < 3 ? (
                          <div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setQuickRows([...quickRows, { text: '' }])}
                            >
                              <Plus size={14} /> Tambah pilihan
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {buttonsMode === 'list' ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Kelompokkan pilihan ke dalam section, tiap baris bisa punya keterangan.
                        </p>
                        {listSections.map((sec, si) => (
                          <div key={si} className="flex flex-col gap-2 rounded-control border border-border p-2">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <TextInput
                                  aria-label={`Judul section ${si + 1}`}
                                  value={sec.title}
                                  onChange={(e) => {
                                    const next = [...listSections];
                                    next[si] = { ...sec, title: e.target.value };
                                    setListSections(next);
                                  }}
                                  maxLength={60}
                                  placeholder={`Section ${si + 1} (mis. Menu)`}
                                />
                              </div>
                              {listSections.length > 1 ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setListSections(listSections.filter((_, j) => j !== si))}
                                >
                                  Hapus
                                </Button>
                              ) : null}
                            </div>
                            {sec.rows.map((row, ri) => (
                              <div key={ri} className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <TextInput
                                    aria-label={`Baris ${ri + 1} section ${si + 1}`}
                                    value={row.title}
                                    onChange={(e) => {
                                      const next = [...listSections];
                                      const rows = [...next[si].rows];
                                      rows[ri] = { ...row, title: e.target.value };
                                      next[si] = { ...next[si], rows };
                                      setListSections(next);
                                    }}
                                    maxLength={60}
                                    placeholder={`Baris ${ri + 1} (mis. Nasi goreng)`}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <TextInput
                                    aria-label={`Keterangan baris ${ri + 1} section ${si + 1}`}
                                    value={row.description}
                                    onChange={(e) => {
                                      const next = [...listSections];
                                      const rows = [...next[si].rows];
                                      rows[ri] = { ...row, description: e.target.value };
                                      next[si] = { ...next[si], rows };
                                      setListSections(next);
                                    }}
                                    maxLength={300}
                                    placeholder="Keterangan (opsional)"
                                  />
                                </div>
                                {sec.rows.length > 1 ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    aria-label={`Hapus baris ${ri + 1} section ${si + 1}`}
                                    onClick={() => {
                                      const next = [...listSections];
                                      next[si] = { ...next[si], rows: next[si].rows.filter((_, j) => j !== ri) };
                                      setListSections(next);
                                    }}
                                  >
                                    ✕
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                            {sec.rows.length < 10 ? (
                              <div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    const next = [...listSections];
                                    next[si] = { ...next[si], rows: [...next[si].rows, { title: '', description: '' }] };
                                    setListSections(next);
                                  }}
                                >
                                  <Plus size={14} /> Tambah baris
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {listSections.length < 10 ? (
                          <div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setListSections([...listSections, { title: '', rows: [{ title: '', description: '' }] }])}
                            >
                              <Plus size={14} /> Tambah section
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <TextInput
                      label="Catatan kaki tombol (opsional)"
                      value={buttonsFooter}
                      onChange={(e) => setButtonsFooter(e.target.value)}
                      maxLength={1024}
                      placeholder="mis. Berlaku s.d. akhir bulan"
                    />
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <Button type="button" onClick={() => { if (canNextFromPesan()) setStep('penerima'); }}>
                    Lanjut <ArrowRight size={15} />
                  </Button>
                </div>
              </>
            ) : null}

            {step === 'penerima' ? (
              <>
                <TextArea
                  label="Penerima (satu nomor per baris, koma, atau titik koma — format 62812…)"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  rows={6}
                  required
                  placeholder={'628121111111\n628122222222, 628123333333'}
                />
                <div className="tnum grid grid-cols-3 gap-2 text-center" aria-live="polite">
                  <div className="rounded-control bg-background px-1 py-2 sm:px-2">
                    <p className="font-display flex items-center justify-center gap-1 text-lg font-bold text-status-open sm:text-xl">
                      <Check size={15} /> {summary.valid}
                    </p>
                    <p className="text-xs text-muted-foreground">Valid</p>
                  </div>
                  <div className="rounded-control bg-background px-1 py-2 sm:px-2">
                    <p className="font-display text-lg font-bold text-status-connecting sm:text-xl">{summary.duplicates}</p>
                    <p className="text-xs text-muted-foreground">Duplikat</p>
                  </div>
                  <div className="rounded-control bg-background px-1 py-2 sm:px-2">
                    <p className="font-display text-lg font-bold text-status-failed sm:text-xl">{summary.invalid}</p>
                    <p className="text-xs text-muted-foreground">Tidak valid</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Duplikat otomatis dihapus (kemunculan pertama yang dipakai). Maksimal 50.000
                  penerima per campaign.
                </p>
                <div className="flex justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep('pesan')}>
                    <ArrowLeft size={15} /> Kembali
                  </Button>
                  <Button type="button" onClick={() => { if (canNextFromPenerima()) setStep('pengaturan'); }}>
                    Lanjut <ArrowRight size={15} />
                  </Button>
                </div>
              </>
            ) : null}

            {step === 'pengaturan' ? (
              <>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <TextInput
                      label="Jeda min (ms)"
                      value={delayMin}
                      onChange={(e) => setDelayMin(e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <TextInput
                      label="Jeda max (ms)"
                      value={delayMax}
                      onChange={(e) => setDelayMax(e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <p className="tnum text-xs leading-5 text-muted-foreground">
                  Jeda acak antar nomor (diukur dari mulai kirim ke nomor sebelumnya),
                  minimum efektif 500 ms di worker. Nomor pertama langsung dikirim tanpa jeda.
                  Estimasi durasi untuk {summary.valid} penerima: {formatEta(summary.valid, Math.round(((Number(delayMin) || 0) + (Number(delayMax) || 0)) / 2))}.
                  Campaign langsung berjalan setelah dibuat.
                </p>
                <div className="rounded-card border border-border bg-background p-3 text-sm">
                  <p className="font-medium">{label.trim() || '(tanpa label)'} · {summary.valid} penerima</p>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">
                    {text.trim() || '(tanpa teks)'}
                    {useMedia ? ` · media ${mediaKind}` : ''}
                    {useButtons ? ` · ${buttonsMode}` : ''}
                  </p>
                </div>
                <div className="flex justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep('penerima')}>
                    <ArrowLeft size={15} /> Kembali
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Membuat…' : 'Buat & jalankan'}
                  </Button>
                </div>
              </>
            ) : null}
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
