'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Ban, CheckCircle2, Search, Undo2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Fields';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/States';
import { TabList } from '@/components/ui/Controls';
import { toast } from '@/components/ui/Toast';
import {
  ApiError,
  blockContact,
  checkNumber,
  getBlocklist,
  getContactAbout,
  getProfilePicture,
  listSessions,
  unblockContact,
  type CheckNumberResult,
  type SessionItem,
} from '@/lib/client/api';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function ContactsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [tab, setTab] = useState<'cek' | 'blokir'>('cek');
  const [number, setNumber] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckNumberResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [about, setAbout] = useState<string | null>(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [blockInput, setBlockInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSessions()
      .then((r) => {
        if (!cancelled) {
          setSessions(r.sessions);
          if (r.sessions.length > 0) setSessionId(r.sessions[0].id);
        }
      })
      .catch((e) => {
        if (!cancelled) toast('error', errMsg(e, 'Gagal memuat session.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    getBlocklist(sessionId)
      .then((r) => {
        if (!cancelled) setBlocklist(r.blocklist);
      })
      .catch(() => {
        if (!cancelled) setBlocklist([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function handleCheck(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!sessionId) {
      toast('error', 'Pilih session dulu.');
      return;
    }
    if (!number.trim()) {
      toast('error', 'Isi nomor dulu (format 62812…).');
      return;
    }
    setChecking(true);
    setResult(null);
    setPhotoUrl(null);
    setAbout(null);
    try {
      const r = await checkNumber(sessionId, number.trim());
      const first = r.results[0] ?? null;
      setResult(first);
      if (!first) toast('info', 'Tidak ada hasil dari WhatsApp.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal memeriksa nomor. Session mungkin belum terhubung.'));
    } finally {
      setChecking(false);
    }
  }

  async function handlePhoto(): Promise<void> {
    if (!sessionId || !number.trim()) return;
    setPhotoLoading(true);
    try {
      const r = await getProfilePicture(sessionId, number.trim());
      setPhotoUrl(r.url);
      if (!r.url) toast('info', 'Kontak tidak punya foto profil (atau disembunyikan).');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengambil foto profil.'));
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleAbout(): Promise<void> {
    if (!sessionId || !number.trim()) return;
    setAboutLoading(true);
    try {
      const r = await getContactAbout(sessionId, number.trim());
      setAbout(r.about.status);
      if (!r.about.status) toast('info', 'Kontak tidak punya about (atau disembunyikan).');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengambil about.'));
    } finally {
      setAboutLoading(false);
    }
  }

  async function refreshBlocklist(): Promise<void> {
    if (!sessionId) return;
    try {
      const r = await getBlocklist(sessionId);
      setBlocklist(r.blocklist);
    } catch (err) {
      toast('error', errMsg(err, 'Gagal memuat blocklist.'));
    }
  }

  async function handleBlock(): Promise<void> {
    if (!sessionId) {
      toast('error', 'Pilih session dulu.');
      return;
    }
    const target = blockInput.trim() || number.trim();
    if (!target) {
      toast('error', 'Isi nomor yang mau diblokir.');
      return;
    }
    setBusy(true);
    try {
      await blockContact(sessionId, target);
      toast('success', 'Kontak diblokir.');
      setBlockInput('');
      await refreshBlocklist();
    } catch (err) {
      toast('error', errMsg(err, 'Gagal memblokir kontak.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnblock(jid: string): Promise<void> {
    if (!sessionId) return;
    setBusy(true);
    try {
      await unblockContact(sessionId, jid);
      toast('success', 'Blokir dibuka.');
      await refreshBlocklist();
    } catch (err) {
      toast('error', errMsg(err, 'Gagal membuka blokir.'));
    } finally {
      setBusy(false);
    }
  }

  const session = sessions.find((s) => s.id === sessionId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Kontak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cek nomor WhatsApp, lihat foto & about, kelola blocklist.
          </p>
        </div>
        <div className="w-full max-w-64">
          <Select
            aria-label="Session"
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              setResult(null);
              setPhotoUrl(null);
              setAbout(null);
            }}
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
          Session belum terhubung (status: {session.status}). Cek nomor butuh koneksi aktif.
        </p>
      ) : null}

      <TabList
        tabs={[
          { value: 'cek', label: 'Cek nomor' },
          { value: 'blokir', label: `Blocklist (${blocklist.length})` },
        ]}
        value={tab}
        onChange={(v) => setTab(v as 'cek' | 'blokir')}
      />

      {tab === 'cek' ? (
        <div className="rounded-card border border-border bg-card p-4 shadow-1 sm:p-5">
          <form onSubmit={(e) => void handleCheck(e)} className="flex gap-2">
            <div className="min-w-0 flex-1">
              <TextInput
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="62812…"
                inputMode="tel"
                aria-label="Nomor WhatsApp"
              />
            </div>
            <Button type="submit" disabled={checking || !sessionId}>
              <Search size={15} /> {checking ? 'Mengecek…' : 'Cek'}
            </Button>
          </form>

          {result ? (
            <motion.div
              key={result.jid ?? 'n'}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="mt-4 flex flex-col items-center gap-3 rounded-card border border-border bg-background px-4 py-5 text-center"
              aria-live="polite"
            >
              {result.exists ? (
                <CheckCircle2 size={36} className="text-status-open" />
              ) : (
                <XCircle size={36} className="text-status-failed" />
              )}
              <p className="font-display text-lg font-semibold">
                {result.exists ? 'Terdaftar di WhatsApp' : 'Tidak terdaftar'}
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {result.jid ?? '(tanpa JID)'}
              </p>
              {result.exists ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar name={number} src={photoUrl} size={72} />
                    <div className="text-left text-sm">
                      <p className="text-muted-foreground">About:</p>
                      <p className="max-w-56 break-words">
                        {about === null ? '—' : about === '' ? '(kosong)' : about}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" size="sm" disabled={photoLoading} onClick={() => void handlePhoto()}>
                      {photoLoading ? 'Memuat foto…' : 'Lihat foto'}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={aboutLoading} onClick={() => void handleAbout()}>
                      {aboutLoading ? 'Memuat…' : 'Lihat about'}
                    </Button>
                  </div>
                </>
              ) : null}
            </motion.div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-card border border-border bg-card p-4 shadow-1 sm:p-5">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <TextInput
                value={blockInput}
                onChange={(e) => setBlockInput(e.target.value)}
                placeholder="62812… (kosongkan = pakai nomor di atas)"
                inputMode="tel"
                aria-label="Nomor untuk diblokir"
              />
            </div>
            <Button variant="danger" disabled={busy || !sessionId} onClick={() => void handleBlock()}>
              <Ban size={15} /> Blokir
            </Button>
          </div>
          {blocklist.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="Blocklist kosong" hint="Tidak ada kontak yang diblokir di session ini." />
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-1">
              {blocklist.map((jid) => (
                <li
                  key={jid}
                  className="flex items-center gap-2.5 rounded-control bg-background px-3 py-2 text-sm"
                >
                  <Avatar name={jid} size={30} />
                  <span className="min-w-0 flex-1 break-all font-mono text-[13px]">{jid}</span>
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleUnblock(jid)}>
                    <Undo2 size={13} /> Buka
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
