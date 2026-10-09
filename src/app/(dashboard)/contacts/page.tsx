'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Ban, CheckCircle2, Search, Undo2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select, TextInput } from '@/components/ui/Fields';
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
        // Session belum open → blocklist kosong, jangan spam toast tiap ganti session.
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
      toast('error', errMsg(err, 'Gagal memeriksa nomor. Session mungkin belum open.'));
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
    const target = (blockInput.trim() || number.trim());
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
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Kontak</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Cek nomor WhatsApp, lihat foto & about, kelola blocklist.
        </p>
      </div>

      <Select
        label="Session"
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

      {session && session.status !== 'open' ? (
        <p role="alert" className="rounded-lg bg-amber-950 px-3 py-2 text-sm text-amber-300">
          Session belum open (status: {session.status}). Cek nomor butuh koneksi aktif.
        </p>
      ) : null}

      <Card title="Cek nomor">
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
            <span className="flex items-center gap-1">
              <Search size={16} /> {checking ? 'Mengecek…' : 'Cek'}
            </span>
          </Button>
        </form>

        {result ? (
          <div className="mt-3 flex flex-col gap-3 rounded-xl bg-zinc-950 px-3 py-2">
            <p className="flex items-center gap-2 text-sm">
              {result.exists ? (
                <span className="flex items-center gap-1 text-emerald-300">
                  <CheckCircle2 size={16} /> Terdaftar di WhatsApp
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-300">
                  <XCircle size={16} /> Tidak terdaftar
                </span>
              )}
            </p>
            <p className="break-all text-xs text-zinc-500">{result.jid ?? '(tanpa JID)'}</p>
            {result.exists ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={photoLoading} onClick={() => void handlePhoto()}>
                  {photoLoading ? 'Memuat foto…' : 'Lihat foto'}
                </Button>
                <Button variant="secondary" disabled={aboutLoading} onClick={() => void handleAbout()}>
                  {aboutLoading ? 'Memuat…' : 'Lihat about'}
                </Button>
              </div>
            ) : null}
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt="Foto profil kontak"
                width={160}
                height={160}
                className="h-40 w-40 rounded-xl object-cover"
                unoptimized
              />
            ) : null}
            {about !== null ? (
              <p className="text-sm text-zinc-300">
                <span className="text-zinc-500">About: </span>
                {about === '' ? '(kosong)' : about}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card title={`Blocklist (${blocklist.length})`}>
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
            <span className="flex items-center gap-1"><Ban size={16} /> Blokir</span>
          </Button>
        </div>
        {blocklist.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">Tidak ada kontak diblokir.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1">
            {blocklist.map((jid) => (
              <li
                key={jid}
                className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950 px-3 py-1.5 text-sm"
              >
                <span className="min-w-0 flex-1 break-all text-zinc-200">{jid}</span>
                <Button variant="secondary" disabled={busy} onClick={() => void handleUnblock(jid)}>
                  <span className="flex items-center gap-1 text-xs"><Undo2 size={12} /> Buka</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
