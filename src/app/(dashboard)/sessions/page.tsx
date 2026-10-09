'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Play, Plus, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from '@/components/ui/Toast';
import {
  ApiError,
  cancelPairingCode,
  createSession,
  deleteSession,
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
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [phone, setPhone] = useState('');
  const [pairing, setPairing] = useState<{ code: string; phone: string; expiresIn: number } | null>(null);
  const [showLabel, setShowLabel] = useState(false);
  const [label, setLabel] = useState(session.label);
  const [showDelete, setShowDelete] = useState(false);

  const st = status?.status ?? session.status;

  // Polling status + QR tiap 3 detik (sesuai keputusan no. 7), berhenti saat open/hilang.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function poll(): Promise<void> {
      try {
        const s = await getSessionStatus(session.id);
        if (cancelled) return;
        setStatus(s);
        if (s.status === 'open' || s.status === 'logged_out') {
          setQr(null);
          if (timer) clearInterval(timer);
          timer = null;
          onChanged();
          return;
        }
        if (s.hasQr) {
          try {
            const q = await getSessionQr(session.id);
            if (!cancelled && q.qr) setQr(q.qr);
          } catch {
            // QR belum siap; coba lagi di poll berikutnya.
          }
        }
      } catch (e) {
        if (cancelled) return;
        // 404 = session sudah dihapus (mis. logout dari tempat lain).
        if (e instanceof ApiError && e.status === 404) {
          if (timer) clearInterval(timer);
          timer = null;
          onDeleted();
        }
      }
    }
    void poll();
    timer = setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

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

  async function handleStart(): Promise<void> {
    const r = await run(() => startSession(session.id), 'Session dimulai.');
    if (r) onChanged();
  }

  async function handleStop(logout: boolean): Promise<void> {
    const r = await run(
      () => stopSession(session.id, logout),
      logout ? 'Session di-logout dan dihapus.' : 'Session dihentikan.',
    );
    if (r) {
      if (logout) onDeleted();
      else onChanged();
    }
  }

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
      toast('success', 'Pairing code diterima.');
    } catch (e2) {
      toast('error', errMsg(e2, 'Gagal meminta pairing code.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelPairing(): Promise<void> {
    const r = await run(() => cancelPairingCode(session.id), 'Pairing dibatalkan.');
    if (r) {
      setPairing(null);
      setShowPairing(false);
    }
  }

  async function handleLabel(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!label.trim()) {
      toast('error', 'Label wajib diisi.');
      return;
    }
    const r = await run(() => updateSessionLabel(session.id, label.trim()), 'Label diubah.');
    if (r) {
      setShowLabel(false);
      onChanged();
    }
  }

  async function handleDelete(): Promise<void> {
    const r = await run(() => deleteSession(session.id), 'Session dihapus.');
    if (r) onDeleted();
  }

  const needConnect = st === 'qr' || st === 'pairing' || st === 'connecting' || st === 'closed';

  return (
    <Card
      title={session.label}
      action={<StatusBadge status={st} />}
    >
      <p className="text-xs text-zinc-500">
        {status?.phone ?? session.phone ?? 'belum tersambung'}
        {status?.waName ? ` · ${status.waName}` : ''}
      </p>

      {/* QR */}
      {qr && st !== 'open' ? (
        <div className="mt-3 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR session ${session.label}`}
            className="h-56 w-56 rounded-xl bg-white p-2"
          />
          <p className="mt-2 text-center text-xs text-zinc-500">
            Scan dari WhatsApp → Perangkat Tertaut → Tautkan Perangkat
          </p>
        </div>
      ) : null}

      {/* Kode pairing aktif */}
      {pairing ? (
        <div className="mt-3 rounded-xl border border-amber-800 bg-amber-950 p-3 text-center">
          <p className="text-2xl font-bold tracking-widest text-amber-200">{pairing.code}</p>
          <p className="mt-1 text-xs text-amber-300/80">
            Untuk {pairing.phone} · berlaku ±{pairing.expiresIn} detik. Masukkan di HP:
            Perangkat Tertaut → Tautkan dengan nomor telepon.
          </p>
          <Button variant="secondary" className="mt-2" disabled={busy} onClick={() => void handleCancelPairing()}>
            Batalkan pairing
          </Button>
        </div>
      ) : null}

      {/* Aksi */}
      <div className="mt-3 flex flex-wrap gap-2">
        {st === 'stopped' || st === 'closed' || st === 'logged_out' ? (
          <Button disabled={busy} onClick={() => void handleStart()}>
            <span className="flex items-center gap-1"><Play size={14} /> Mulai</span>
          </Button>
        ) : null}
        {needConnect ? (
          <Button variant="secondary" disabled={busy} onClick={() => setShowPairing(true)}>
            Pairing code
          </Button>
        ) : null}
        {st !== 'logged_out' ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => { setLabel(session.label); setShowLabel(true); }}>
              <span className="flex items-center gap-1"><Pencil size={14} /> Label</span>
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void handleStop(false)}>
              <span className="flex items-center gap-1"><Square size={14} /> Stop</span>
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setShowDelete(true)}>
              <span className="flex items-center gap-1"><Trash2 size={14} /> Logout & hapus</span>
            </Button>
          </>
        ) : (
          <Button variant="danger" disabled={busy} onClick={() => setShowDelete(true)}>
            <span className="flex items-center gap-1"><Trash2 size={14} /> Hapus</span>
          </Button>
        )}
      </div>

      {/* Modal pairing */}
      {showPairing ? (
        <Modal title="Minta pairing code" onClose={() => setShowPairing(false)}>
          <form onSubmit={(e) => void handlePairing(e)} className="flex flex-col gap-3">
            <TextInput
              label="Nomor HP (format internasional, mis. 62812…)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="62812…"
              required
            />
            <p className="text-xs text-zinc-500">
              Hanya untuk session baru yang belum terdaftar. Jangan dipakai di
              session yang sudah open (ditolak 409).
            </p>
            <Button type="submit" disabled={busy}>
              {busy ? 'Meminta…' : 'Minta kode'}
            </Button>
          </form>
        </Modal>
      ) : null}

      {/* Modal label */}
      {showLabel ? (
        <Modal title="Ubah label" onClose={() => setShowLabel(false)}>
          <form onSubmit={(e) => void handleLabel(e)} className="flex flex-col gap-3">
            <TextInput
              label="Label session"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={255}
              required
            />
            <Button type="submit" disabled={busy}>Simpan</Button>
          </form>
        </Modal>
      ) : null}

      {/* Modal hapus */}
      {showDelete ? (
        <Modal title="Hapus session?" onClose={() => setShowDelete(false)}>
          <p className="text-sm text-zinc-300">
            Session <b>{session.label}</b> akan di-logout dari WhatsApp dan
            dihapus permanen beserta riwayat pesannya. Lanjutkan?
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setShowDelete(false)}>Batal</Button>
            <Button variant="danger" disabled={busy} onClick={() => void handleDelete()}>
              Ya, hapus
            </Button>
          </div>
        </Modal>
      ) : null}
    </Card>
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
      toast('success', 'Session dibuat. Scan QR-nya.');
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

  if (loading) return <p className="text-zinc-400">Memuat…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Sessions</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Kelola koneksi WhatsApp. Status diperbarui otomatis tiap 3 detik.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <span className="flex items-center gap-1"><Plus size={16} /> Buat</span>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card title="Belum ada session">
          <p className="text-sm text-zinc-400">
            Buat session pertama lalu scan QR dari WhatsApp di HP.
          </p>
        </Card>
      ) : (
        sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            onChanged={() => void refresh()}
            onDeleted={() => removeFromList(s.id)}
          />
        ))
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
            <Button type="submit" disabled={creating}>
              {creating ? 'Membuat…' : 'Buat & tampilkan QR'}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
