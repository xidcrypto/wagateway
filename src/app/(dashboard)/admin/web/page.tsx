'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Fields';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { Switch } from '@/components/ui/Controls';
import { errMsg } from '@/components/admin/shared';
import { toast } from '@/components/ui/Toast';
import {
  clearSiteInfoCache,
  getAdminSettings,
  sendSettingsTestEmail,
  updateAdminSettings,
} from '@/lib/client/api';

type WebForm = {
  site_name: string;
  site_tagline: string;
  registration_enabled: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  mail_from: string;
  mail_from_name: string;
};

const EMPTY: WebForm = {
  site_name: '',
  site_tagline: '',
  registration_enabled: true,
  smtp_host: '',
  smtp_port: '587',
  smtp_secure: false,
  smtp_user: '',
  smtp_pass: '',
  mail_from: '',
  mail_from_name: '',
};

function isTrue(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

export default function AdminWebPage() {
  const [form, setForm] = useState<WebForm>(EMPTY);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smtpPassSet, setSmtpPassSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  function set<K extends keyof WebForm>(key: K, value: WebForm[K]): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    let cancelled = false;
    getAdminSettings()
      .then((st) => {
        if (cancelled) return;
        const s = st.settings;
        const masked = s.smtp_pass ?? '';
        setForm({
          site_name: s.site_name ?? '',
          site_tagline: s.site_tagline ?? '',
          registration_enabled: isTrue(s.registration_enabled),
          smtp_host: s.smtp_host ?? '',
          smtp_port: s.smtp_port ?? '587',
          smtp_secure: isTrue(s.smtp_secure),
          smtp_user: s.smtp_user ?? '',
          smtp_pass: '',
          mail_from: s.mail_from ?? '',
          mail_from_name: s.mail_from_name ?? '',
        });
        setSmtpPassSet(masked !== '' && masked !== '••••');
        setSmtpConfigured(st.smtpConfigured);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, 'Gagal memuat pengaturan web.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!form.site_name.trim()) {
      toast('error', 'Nama web wajib diisi.');
      return;
    }
    if (form.mail_from.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.mail_from.trim())) {
      toast('error', 'Email pengirim tidak valid.');
      return;
    }
    const portNum = Number.parseInt(form.smtp_port.trim(), 10);
    if (form.smtp_host.trim() !== '' && (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535)) {
      toast('error', 'Port SMTP harus angka 1–65535.');
      return;
    }
    setSaving(true);
    try {
      const r = await updateAdminSettings({
        site_name: form.site_name.trim(),
        site_tagline: form.site_tagline.trim(),
        registration_enabled: form.registration_enabled,
        smtp_host: form.smtp_host.trim(),
        smtp_port: form.smtp_host.trim() === '' ? 587 : Number.parseInt(form.smtp_port.trim(), 10),
        smtp_secure: form.smtp_secure,
        smtp_user: form.smtp_user.trim(),
        ...(form.smtp_pass !== '' ? { smtp_pass: form.smtp_pass } : {}),
        mail_from: form.mail_from.trim(),
        mail_from_name: form.mail_from_name.trim(),
      });
      const s = r.settings;
      const masked = s.smtp_pass ?? '';
      setForm((f) => ({
        ...f,
        site_name: s.site_name ?? f.site_name,
        site_tagline: s.site_tagline ?? '',
        smtp_pass: '',
      }));
      setSmtpPassSet(masked !== '' && masked !== '••••');
      setSmtpConfigured(r.smtpConfigured);
      clearSiteInfoCache();
      toast('success', 'Pengaturan web disimpan.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal menyimpan pengaturan web.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo.trim())) {
      toast('error', 'Isi email tujuan yang valid dulu.');
      return;
    }
    setTesting(true);
    try {
      const r = await sendSettingsTestEmail(testTo.trim());
      toast('success', r.message || 'Email tes terkirim.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengirim email tes.'));
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Memuat pengaturan web">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message="Gagal memuat pengaturan web."
        hint={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Pengaturan web"
        action={
          smtpConfigured ? (
            <span className="text-xs font-semibold text-status-open">SMTP terkonfigurasi</span>
          ) : (
            <span className="text-xs font-semibold text-status-connecting">SMTP belum dikonfigurasi</span>
          )
        }
      >
        <form onSubmit={(e) => void handleSave(e)} className="flex max-w-xl flex-col gap-3">
          <TextInput
            label="Nama web"
            value={form.site_name}
            onChange={(e) => set('site_name', e.target.value)}
            maxLength={64}
            required
            placeholder="Pansa Gateway"
          />
          <TextInput
            label="Tagline (tampil di login & judul browser)"
            value={form.site_tagline}
            onChange={(e) => set('site_tagline', e.target.value)}
            maxLength={255}
            placeholder="Gateway WhatsApp multi-user"
          />
          <div className="flex items-center justify-between gap-2 rounded-control border border-border bg-background px-3 py-2.5">
            <span className="text-sm">
              Pendaftaran user baru dibuka
            </span>
            <Switch
              checked={form.registration_enabled}
              label="Pendaftaran user baru"
              onChange={(v) => set('registration_enabled', v)}
            />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Nama web tampil di sidebar, halaman login, judul browser, dan email reset password.
          </p>
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan pengaturan web'}
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="SMTP (email reset password)"
        action={
          smtpPassSet ? (
            <span className="text-xs text-muted-foreground">Password tersimpan ••••</span>
          ) : null
        }
      >
        <form onSubmit={(e) => void handleSave(e)} className="flex max-w-xl flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <TextInput
              label="Host SMTP"
              value={form.smtp_host}
              onChange={(e) => set('smtp_host', e.target.value)}
              maxLength={255}
              placeholder="mail.contoh.id"
            />
            <TextInput
              label="Port"
              value={form.smtp_port}
              onChange={(e) => set('smtp_port', e.target.value)}
              inputMode="numeric"
              placeholder="587"
            />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-control border border-border bg-background px-3 py-2.5">
            <span className="text-sm">Koneksi aman (SSL/TLS langsung, port 465)</span>
            <Switch
              checked={form.smtp_secure}
              label="Koneksi SMTP aman"
              onChange={(v) => set('smtp_secure', v)}
            />
          </div>
          <TextInput
            label="Username SMTP"
            value={form.smtp_user}
            onChange={(e) => set('smtp_user', e.target.value)}
            maxLength={255}
            placeholder="user@contoh.id"
          />
          <TextInput
            label={smtpPassSet ? 'Password SMTP (kosongkan = tidak diubah)' : 'Password SMTP'}
            type="password"
            value={form.smtp_pass}
            onChange={(e) => set('smtp_pass', e.target.value)}
            maxLength={1024}
            autoComplete="new-password"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput
              label="Email pengirim"
              type="email"
              value={form.mail_from}
              onChange={(e) => set('mail_from', e.target.value)}
              maxLength={255}
              placeholder="noreply@contoh.id"
            />
            <TextInput
              label="Nama pengirim"
              value={form.mail_from_name}
              onChange={(e) => set('mail_from_name', e.target.value)}
              maxLength={255}
              placeholder="Pansa Gateway"
            />
          </div>
          {!smtpConfigured ? (
            <p className="text-xs leading-5 text-muted-foreground">
              SMTP belum dikonfigurasi — email reset password belum bisa dikirim. Isi host + email pengirim, lalu simpan.
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan SMTP'}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Tes email">
        <form onSubmit={(e) => void handleTest(e)} className="flex max-w-xl flex-col gap-3">
          <p className="text-xs leading-5 text-muted-foreground">
            Email tes memakai konfigurasi SMTP yang tersimpan.
          </p>
          <TextInput
            label="Kirim email tes ke"
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            maxLength={255}
            placeholder="kamu@contoh.id"
            required
          />
          <div>
            <Button type="submit" variant="secondary" disabled={testing || !smtpConfigured}>
              {testing ? 'Mengirim…' : 'Kirim email tes'}
            </Button>
          </div>
          {!smtpConfigured ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Simpan konfigurasi SMTP dulu sebelum mengirim tes.
            </p>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
