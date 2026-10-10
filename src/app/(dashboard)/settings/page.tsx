'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTheme } from 'next-themes';
import { Check, Copy, Dices, Eye, EyeOff, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Fields';
import { TabList } from '@/components/ui/Controls';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { toast } from '@/components/ui/Toast';
import {
  ApiError,
  changePassword,
  getMe,
  patchMe,
  updateWebhook,
  type MeUser,
} from '@/lib/client/api';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

const SETTINGS_TABS = [
  { value: 'profil', label: 'Profil' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'keamanan', label: 'Keamanan' },
  { value: 'tampilan', label: 'Tampilan' },
];

const EVENTS = [
  'qr',
  'connected',
  'disconnected',
  'logged_out',
  'stopped',
  'message',
  'message.status',
  'presence',
  'group',
  'call',
];

/** Skor 0–4 untuk indikator kekuatan password. */
function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s += 1;
  if (pw.length >= 10) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.min(s, 4);
}

const SCORE_LABEL = ['Sangat lemah', 'Lemah', 'Sedang', 'Kuat', 'Sangat kuat'];
const SCORE_CLASS = [
  'bg-status-failed',
  'bg-status-failed',
  'bg-status-connecting',
  'bg-status-open',
  'bg-status-open',
];

/** Secret acak 32 byte hex (tanpa server roundtrip). */
function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast('success', `${label} disalin.`);
  } catch {
    toast('error', `Gagal menyalin ${label.toLowerCase()}.`);
  }
}

export default function SettingsPage() {
  const [tab, setTab] = useState('profil');
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const { theme } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(() => {
    try {
      return window.localStorage.getItem('pansa_reduce_motion') === '1';
    } catch {
      return false;
    }
  });

  function toggleReduceMotion(v: boolean): void {
    setReduceMotion(v);
    try {
      if (v) {
        window.localStorage.setItem('pansa_reduce_motion', '1');
        document.documentElement.classList.add('reduce-motion');
      } else {
        window.localStorage.removeItem('pansa_reduce_motion');
        document.documentElement.classList.remove('reduce-motion');
      }
    } catch {
      // Abaikan.
    }
  }

  async function load(): Promise<void> {
    setError(null);
    try {
      const r = await getMe();
      const u = r.user as MeUser;
      setMe(u);
      setFullName(u.fullName ?? '');
      setEmail(u.email ?? '');
      setPhone(u.phone ?? '');
      setAvatarUrl(u.avatarUrl ?? '');
      setWebhookUrl(u.webhookUrl ?? '');
    } catch (e) {
      setError(errMsg(e, 'Gagal memuat profil.'));
    } finally {
      setLoading(false);
    }
  }

  // Muat profil sekali saat mount: fetch async, setState di callback.
  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((r) => {
        if (cancelled) return;
        const u = r.user as MeUser;
        setMe(u);
        setFullName(u.fullName ?? '');
        setEmail(u.email ?? '');
        setPhone(u.phone ?? '');
        setAvatarUrl(u.avatarUrl ?? '');
        setWebhookUrl(u.webhookUrl ?? '');
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errMsg(e, 'Gagal memuat profil.'));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleProfile(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!fullName.trim()) {
      toast('error', 'Nama lengkap wajib diisi.');
      return;
    }
    if (!email.trim()) {
      toast('error', 'Email wajib diisi.');
      return;
    }
    setSavingProfile(true);
    try {
      const r = await patchMe({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() === '' ? null : phone.trim(),
        avatarUrl: avatarUrl.trim() === '' ? null : avatarUrl.trim(),
      });
      setMe(r.user);
      toast('success', 'Profil disimpan.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal menyimpan profil.'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePassword(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!oldPassword) {
      toast('error', 'Password lama wajib diisi.');
      return;
    }
    if (newPassword.length < 6) {
      toast('error', 'Password baru minimal 6 karakter.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast('success', 'Password diganti.');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengganti password.'));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleWebhook(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSavingWebhook(true);
    try {
      const r = await updateWebhook({
        url: webhookUrl.trim() === '' ? null : webhookUrl.trim(),
        // Secret kosong = tidak diubah bila sebelumnya sudah ada; null = hapus.
        secret: webhookSecret === '' ? (hasSecret ? undefined : null) : webhookSecret,
      });
      setHasSecret(r.hasSecret);
      setWebhookSecret('');
      setShowSecret(false);
      setWebhookUrl(r.webhookUrl ?? '');
      toast('success', 'Webhook disimpan.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal menyimpan webhook.'));
    } finally {
      setSavingWebhook(false);
    }
  }

  const score = passwordScore(newPassword);

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-label="Memuat pengaturan">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !me) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold">Pengaturan</h1>
        <ErrorState message="Gagal memuat profil." hint={error} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me ? `Masuk sebagai ${me.username} (${me.role}).` : 'Kelola profil, webhook, keamanan, dan tampilan.'}
        </p>
      </div>

      <TabList tabs={SETTINGS_TABS} value={tab} onChange={setTab} />

      {tab === 'profil' ? (
        <Card title="Profil">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={fullName || me?.username || '?'} src={avatarPreview ? (avatarUrl.trim() || null) : null} size={64} />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{fullName || me?.username}</p>
              <p className="tnum">{email}</p>
              <p className="mt-0.5 text-xs">Pratinjau avatar dari URL di bawah.</p>
            </div>
          </div>
          <form onSubmit={(e) => void handleProfile(e)} className="flex flex-col gap-3">
            <TextInput
              label="Nama lengkap"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={255}
              required
            />
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextInput
              label="Telepon (opsional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              maxLength={32}
            />
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <TextInput
                  label="URL avatar (opsional)"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setAvatarPreview(true);
                  }}
                  placeholder="https://…"
                  inputMode="url"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                title="Muat ulang pratinjau"
                aria-label="Muat ulang pratinjau avatar"
                onClick={() => {
                  setAvatarPreview(false);
                  window.setTimeout(() => setAvatarPreview(true), 50);
                }}
              >
                <RefreshCw size={14} />
              </Button>
            </div>
            <div>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Menyimpan…' : 'Simpan profil'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {tab === 'webhook' ? (
        <Card title="Webhook">
          <form onSubmit={(e) => void handleWebhook(e)} className="flex flex-col gap-3">
            <TextInput
              label="URL webhook (kosongkan = hapus)"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
            <div>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Secret HMAC (kosongkan = {hasSecret ? 'tetap pakai yang lama' : 'tanpa secret'})
                </span>
                <span className="flex gap-2">
                  <span className="min-w-0 flex-1">
                    <TextInput
                      type={showSecret ? 'text' : 'password'}
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                      placeholder={hasSecret ? '•••• (sudah diset)' : 'opsional'}
                      aria-label="Secret webhook"
                    />
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    title={showSecret ? 'Sembunyikan' : 'Tampilkan'}
                    aria-label={showSecret ? 'Sembunyikan secret' : 'Tampilkan secret'}
                    onClick={() => setShowSecret((v) => !v)}
                  >
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    title="Buat secret acak"
                    aria-label="Buat secret acak"
                    onClick={() => {
                      setWebhookSecret(randomSecret());
                      setShowSecret(true);
                    }}
                  >
                    <Dices size={15} />
                  </Button>
                  {webhookSecret ? (
                    <Button
                      type="button"
                      variant="secondary"
                      title="Salin secret"
                      aria-label="Salin secret"
                      onClick={() => {
                        void copyText(webhookSecret, 'Secret');
                        setCopiedSecret(true);
                        window.setTimeout(() => setCopiedSecret(false), 1500);
                      }}
                    >
                      {copiedSecret ? <Check size={15} className="text-status-open" /> : <Copy size={15} />}
                    </Button>
                  ) : null}
                </span>
              </label>
            </div>
            <div className="rounded-card border border-border bg-background p-3 text-[13px] leading-6">
              <p className="font-medium">Event yang dikirim ke URL ini:</p>
              <p className="tnum mt-1 font-mono text-xs text-muted-foreground">{EVENTS.join(' · ')}</p>
              <p className="mt-2 text-muted-foreground">
                Setiap pengiriman membawa header <code className="font-mono">x-pansa-signature</code> (HMAC-SHA256
                hex body) + <code className="font-mono">x-pansa-event</code>. URL internal ditolak (anti-SSRF).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savingWebhook}>
                {savingWebhook ? 'Menyimpan…' : 'Simpan webhook'}
              </Button>
              {webhookUrl.trim() ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void copyText(webhookUrl.trim(), 'URL webhook')}
                >
                  <Copy size={15} /> Salin URL
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      ) : null}

      {tab === 'keamanan' ? (
        <Card title="Ganti password">
          <form onSubmit={(e) => void handlePassword(e)} className="flex flex-col gap-3">
            <div className="relative">
              <TextInput
                label="Password lama"
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={showOld ? 'Sembunyikan password lama' : 'Tampilkan password lama'}
                onClick={() => setShowOld((v) => !v)}
                className="pressable absolute right-2 top-7 rounded-control p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <TextInput
                label="Password baru (min 6)"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={showNew ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
                onClick={() => setShowNew((v) => !v)}
                className="pressable absolute right-2 top-7 rounded-control p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {newPassword ? (
              <div aria-live="polite">
                <div className="flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${i < score ? SCORE_CLASS[score] : 'bg-muted'}`}
                    />
                  ))}
                </div>
                <p className="tnum mt-1 text-xs text-muted-foreground">
                  Kekuatan: {SCORE_LABEL[score]}
                </p>
              </div>
            ) : null}
            <div>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? 'Menyimpan…' : 'Ganti password'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {tab === 'tampilan' ? (
        <>
          <Card title="Tema">
            <p className="mb-3 text-sm text-muted-foreground">
              Pilih Terang, Gelap, atau mengikuti sistem. Berlaku instan di semua halaman.
            </p>
            <ThemeToggle />
            <p className="tnum mt-2 text-xs text-muted-foreground">Tema aktif: {theme ?? 'sistem'}</p>
          </Card>
          <Card title="Animasi">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium">Kurangi animasi</p>
                <p className="mt-0.5 text-muted-foreground">
                  Mematikan pulse orb dan count-up (selain preferensi sistem).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reduceMotion}
                aria-label="Kurangi animasi"
                onClick={() => toggleReduceMotion(!reduceMotion)}
                className={`pressable inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${reduceMotion ? 'bg-primary' : 'bg-muted'}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${reduceMotion ? 'translate-x-5' : ''}`}
                />
              </button>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon size={13} /> Sistem operasi juga bisa memaksa lewat “prefers-reduced-motion”.
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
