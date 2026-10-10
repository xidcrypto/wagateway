'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, MoreVertical, Pencil, Play, Plus, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Fields';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { Avatar, CopyButton } from '@/components/ui/Avatar';
import { Menu, TabList } from '@/components/ui/Controls';
import { toast } from '@/components/ui/Toast';
import { useVisiblePoll } from '@/lib/client/use-poll';
import {
  ApiError,
  cancelPairingCode,
  createSession,
  deleteSession,
  getProfilePicture,
  getSessionQr,
  getSessionStatus,
  listSessions,
  requestPairingCode,
  startSession,
  stopSession,
  updateSessionLabel,
  type SessionItem,
  type SessionStatus,
} from '@/lib/client/api';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function SuccessBurst({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1000);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center gap-2 py-8"
      aria-live="polite"
    >
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-status-open/15"
      >
        <Check size={32} className="text-status-open" />
      </motion.span>
      <p className="font-display text-lg font-semibold">Terhubung!</p>
      <p className="text-sm text-muted-foreground">Perangkat berhasil ditautkan.</p>
    </motion.div>
  );
}

function LinkModal({
  session,
  onClose,
  onOpen,
}: {
  session: SessionItem;
  onClose: () => void;
  onOpen: () => void;
}) {
  const [tab, setTab] = useState<'qr' | 'pairing'>('qr');
  const [qr, setQr] = useState<string | null>(null);
  const [qrTick, setQrTick] = useState(25);
  const [phone, setPhone] = useState('');
  const [pairing, setPairing] = useState<{ code: string; phone: string; expiresIn: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useVisiblePoll(
    async () => {
      try {
        const s = await getSessionStatus(session.id);
        if (s.status === 'open') {
          setSuccess(true);
          onOpen();
          return;
        }
        if (tab === 'qr' && s.hasQr) {
          try {
            const q = await getSessionQr(session.id);
            if (q.qr && q.qr !== qr) {
              setQr(q.qr);
              setQrTick(25);
            }
          } catch {
            // QR belum siap.
          }
        }
      } catch {
        // Abaikan, coba lagi.
      }
    },
    3000,
    !success,
  );

  // Countdown refresh QR. Saat tick habis, polling mengambil QR baru dan
  // me-reset tick (lihat callback useVisiblePoll di atas); render menganggap
  // QR kedaluwarsa selama qrTick <= 0 tanpa perlu setState sinkron di sini.
  useEffect(() => {
    if (tab !== 'qr' || success || qrTick > 0) return;
    const t = window.setTimeout(() => setQrTick(25), 3000);
    return () => window.clearTimeout(t);
  }, [qrTick, tab, success]);

  async function handlePairing(e: FormEvent): Promise<void> {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (!digits || digits.startsWith('0')) {
      toast('error', 'Nomor harus format internasional tanpa awalan nol (mis. 62812…).');
      return;
    }
    setBusy(true);
    try {
      const r = await requestPairingCode(session.id, digits);
      setPairing(r.pairing);
      toast('success', 'Kode pairing diterima.');
    } catch (e2) {
      toast('error', errMsg(e2, 'Gagal meminta kode pairing.'));
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <Modal title={`Tautkan ${session.label}`} onClose={onClose}>
        <SuccessBurst onDone={onClose} />
      </Modal>
    );
  }

  return (
    <Modal title={`Tautkan perangkat — ${session.label}`} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <TabList
          tabs={[
            { value: 'qr', label: 'Scan QR' },
            { value: 'pairing', label: 'Kode pairing' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'qr' | 'pairing')}
        />

        {tab === 'qr' ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative rounded-card border border-border bg-white p-3">
              <span className="absolute left-1.5 top-1.5 h-5 w-5 rounded-tl-md border-l-[3px] border-t-[3px] border-primary" />
              <span className="absolute right-1.5 top-1.5 h-5 w-5 rounded-tr-md border-r-[3px] border-t-[3px] border-primary" />
              <span className="absolute bottom-1.5 left-1.5 h-5 w-5 rounded-bl-md border-b-[3px] border-l-[3px] border-primary" />
              <span className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded-br-md border-b-[3px] border-r-[3px] border-primary" />
              {qr && qrTick > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`Kode QR session ${session.label}`} className="h-52 w-52" />
              ) : (
                <div className="flex h-52 w-52 flex-col items-center justify-center gap-2" aria-label="Menyiapkan QR">
                  <div className="skeleton h-40 w-40" />
                </div>
              )}
              {qr && qrTick > 0 ? <div className="scanline absolute inset-x-4 top-3 h-0.5 bg-primary/70" /> : null}
            </div>
            <p className="text-[13px] text-muted-foreground">
              {qr && qrTick > 0 ? `QR segar · ganti dalam ${qrTick} dtk` : 'Menyiapkan QR…'}
            </p>
            <ol className="w-full max-w-sm list-decimal space-y-1 pl-5 text-[13px] leading-5 text-muted-foreground">
              <li>Buka WhatsApp di HP → Perangkat tertaut.</li>
              <li>Pilih Tautkan perangkat, lalu arahkan ke QR ini.</li>
              <li>Tunggu status berubah menjadi Terhubung.</li>
            </ol>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pairing ? (
              <>
                <div className="flex items-center justify-center gap-1.5" aria-live="polite">
                  {pairing.code.split('').map((ch, i) => (
                    <span
                      key={i}
                      className="flex h-12 w-9 items-center justify-center rounded-control border border-border bg-background font-mono text-xl font-bold"
                    >
                      {ch}
                    </span>
                  ))}
                  <CopyButton text={pairing.code} label="Kode pairing" />
                </div>
                <p className="text-center text-[13px] text-muted-foreground">
                  Untuk {pairing.phone} · berlaku ±{pairing.expiresIn} detik.
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-5 text-muted-foreground">
                  <li>Buka WhatsApp → Perangkat tertaut → Tautkan dengan nomor telepon.</li>
                  <li>Masukkan 8 karakter kode di atas.</li>
                  <li>Tunggu status berubah menjadi Terhubung.</li>
                </ol>
                <div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        setBusy(true);
                        try {
                          await cancelPairingCode(session.id);
                          setPairing(null);
                          toast('success', 'Kode pairing dibatalkan.');
                        } catch (e2) {
                          toast('error', errMsg(e2, 'Gagal membatalkan.'));
                        } finally {
                          setBusy(false);
                        }
                      })()
                    }
                  >
                    Batalkan kode
                  </Button>
                </div>
              </>
            ) : (
              <form onSubmit={(e) => void handlePairing(e)} className="flex flex-col gap-3">
                <TextInput
                  label="Nomor HP (format internasional, mis. 62812…)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="62812…"
                  required
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Hanya untuk session baru yang belum terdaftar. Session yang
                  sudah terhubung ditolak (409).
                </p>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Meminta…' : 'Minta kode'}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SessionCard({
  session,
  onChanged,
  onDeleted,
}: {
  session: SessionItem;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [label, setLabel] = useState(session.label);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.label);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const prevStatus = useRef(status?.status ?? session.status);

  const st = status?.status ?? session.status;

  // Foto profil WA: diambil sekali saat kartu pertama tampil dalam status
  // open; bila tidak ada (null / gagal) dipakai ikon inisial yang rapi.
  useEffect(() => {
    if (st !== 'open') return;
    let cancelled = false;
    getProfilePicture(session.id)
      .then((r) => {
        if (!cancelled) setPhotoUrl(typeof r.url === 'string' ? r.url : null);
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session.id, st]);

  useVisiblePoll(async () => {
    try {
      const s = await getSessionStatus(session.id);
      setStatus((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(s)) return s;
        return prev;
      });
      if (s.status === 'open' || s.status === 'logged_out') onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) onDeleted();
    }
  }, 3000);

  useEffect(() => {
    if (prevStatus.current !== 'open' && st === 'open') {
      toast('success', `Session "${session.label}" terhubung.`);
    }
    prevStatus.current = st;
  }, [st, session.label]);

  async function run<T>(fn: () => Promise<T>, okMsg: string): Promise<T | null> {
    setBusy(true);
    try {
      const r = await fn();
      toast('success', okMsg);
      return r;
    } catch (e) {
      toast('error', errMsg(e, 'Terjadi kesalahan.'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const needLink = st === 'qr' || st === 'pairing' || st === 'connecting' || st === 'closed';

  async function saveInlineLabel(): Promise<void> {
    if (!draft.trim()) {
      toast('error', 'Label wajib diisi.');
      return;
    }
    const r = await run(() => updateSessionLabel(session.id, draft.trim()), 'Label diubah.');
    if (r) {
      setEditing(false);
      onChanged();
    }
  }

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-1">
      <div className="flex items-start gap-4">
        <span className="relative inline-flex shrink-0">
          <Avatar name={session.label} src={st === 'open' ? photoUrl : null} size={56} />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-card">
            <StatusOrb status={st} size={12} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveInlineLabel();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={255}
                autoFocus
                aria-label="Label session"
                className="w-full rounded-control border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              />
              <Button size="sm" type="submit" disabled={busy}>
                Simpan
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-display truncate text-lg font-semibold">{session.label}</h2>
              <button
                type="button"
                aria-label="Ubah label"
                title="Ubah label"
                onClick={() => {
                  setDraft(session.label);
                  setEditing(true);
                }}
                className="pressable rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
          <p className="mt-0.5 truncate font-mono text-[13px] text-muted-foreground">
            {status?.phone ?? session.phone ?? 'belum tersambung'}
            {status?.waName ? ` · ${status.waName}` : ''}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground/70" title={session.id}>
            {session.id}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={st} />
          <Menu
            label={`Aksi session ${session.label}`}
            trigger={
              <span className="pressable inline-flex min-h-10 min-w-10 items-center justify-center rounded-control border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground">
                <MoreVertical size={17} />
              </span>
            }
            items={[
              ...(st === 'stopped' || st === 'closed' || st === 'logged_out'
                ? [
                    {
                      label: 'Mulai',
                      onClick: () =>
                        void (async () => {
                          const r = await run(() => startSession(session.id), 'Session dimulai.');
                          if (r) onChanged();
                        })(),
                    },
                  ]
                : []),
              ...(needLink ? [{ label: 'Tautkan perangkat', onClick: () => setShowLink(true) }] : []),
              ...(st !== 'logged_out'
                ? [
                    { label: 'Ubah label', onClick: () => { setLabel(session.label); setShowLabel(true); } },
                    {
                      label: 'Stop (simpan kredensial)',
                      onClick: () =>
                        void (async () => {
                          const r = await run(() => stopSession(session.id, false), 'Session dihentikan.');
                          if (r) onChanged();
                        })(),
                    },
                    { label: 'Logout & hapus', danger: true, onClick: () => setShowDelete(true) },
                  ]
                : [{ label: 'Hapus', danger: true, onClick: () => setShowDelete(true) }]),
            ]}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {st === 'stopped' || st === 'closed' || st === 'logged_out' ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void (async () => {
                const r = await run(() => startSession(session.id), 'Session dimulai.');
                if (r) onChanged();
              })()
            }
          >
            <Play size={14} /> Mulai
          </Button>
        ) : null}
        {needLink ? (
          <Button size="sm" variant="secondary" onClick={() => setShowLink(true)}>
            Tautkan perangkat
          </Button>
        ) : null}
        {st !== 'logged_out' && st === 'open' ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void (async () => {
                const r = await run(() => stopSession(session.id, false), 'Session dihentikan.');
                if (r) onChanged();
              })()
            }
          >
            <Square size={14} /> Stop
          </Button>
        ) : null}
      </div>

      {showLink ? (
        <LinkModal session={session} onClose={() => setShowLink(false)} onOpen={onChanged} />
      ) : null}

      {showLabel ? (
        <Modal title="Ubah label" onClose={() => setShowLabel(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                if (!label.trim()) {
                  toast('error', 'Label wajib diisi.');
                  return;
                }
                const r = await run(() => updateSessionLabel(session.id, label.trim()), 'Label diubah.');
                if (r) {
                  setShowLabel(false);
                  onChanged();
                }
              })();
            }}
            className="flex flex-col gap-3"
          >
            <TextInput label="Label session" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={255} required />
            <Button type="submit" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </form>
        </Modal>
      ) : null}

      {showDelete ? (
        <ConfirmDialog
          title={`Hapus session "${session.label}"?`}
          message={
            <>
              Session <b>{session.label}</b> akan di-logout dari WhatsApp dan
              dihapus permanen beserta riwayat pesannya.
            </>
          }
          confirmLabel="Ya, hapus"
          busy={busy}
          onCancel={() => setShowDelete(false)}
          onConfirm={() =>
            void (async () => {
              const r = await run(() => deleteSession(session.id), 'Session dihapus.');
              if (r) onDeleted();
            })()
          }
        />
      ) : null}
    </div>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);

  async function refresh(): Promise<void> {
    try {
      const r = await listSessions();
      setSessions(r.sessions);
    } catch (e) {
      toast('error', errMsg(e, 'Gagal memuat session.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    listSessions()
      .then((r) => {
        if (!cancelled) setSessions(r.sessions);
      })
      .catch((e) => {
        if (!cancelled) toast('error', errMsg(e, 'Gagal memuat session.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!newLabel.trim()) {
      toast('error', 'Label wajib diisi.');
      return;
    }
    setCreating(true);
    try {
      await createSession(newLabel.trim());
      toast('success', 'Session dibuat. Tautkan perangkatnya.');
      setNewLabel('');
      setShowCreate(false);
      await refresh();
    } catch (e2) {
      toast('error', errMsg(e2, 'Gagal membuat session.'));
    } finally {
      setCreating(false);
    }
  }

  function removeFromList(id: string): void {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-label="Memuat sessions">
        <Skeleton className="h-9 w-56" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Sessions</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Kelola koneksi WhatsApp. Status diperbarui otomatis tiap 3 detik,
            berhenti saat tab tidak terlihat. Maksimal 2 koneksi aktif per user.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Buat session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="Belum ada session"
          hint="Buat session pertamamu, lalu tautkan perangkat dengan scan QR atau kode pairing."
          action={<Button onClick={() => setShowCreate(true)}>Buat session pertamamu</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {sessions.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <SessionCard
                  session={s}
                  onChanged={() => void refresh()}
                  onDeleted={() => removeFromList(s.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {showCreate ? (
        <Modal title="Buat session" onClose={() => setShowCreate(false)}>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3">
            <TextInput
              label="Label session"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              maxLength={255}
              placeholder="mis. CS-1"
              required
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Maksimal 2 koneksi WhatsApp per user. Session yang di-stop (logout)
              tidak dihitung — hapus atau logout session yang tidak dipakai bila penuh.
            </p>
            <Button type="submit" disabled={creating}>
              {creating ? 'Membuat…' : 'Buat session'}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
