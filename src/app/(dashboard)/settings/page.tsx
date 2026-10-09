'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/ui/Fields';
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

export default function SettingsPage() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((r) => {
        if (!cancelled) {
          const u = r.user as MeUser;
          setMe(u);
          setFullName(u.fullName ?? '');
          setEmail(u.email ?? '');
          setPhone(u.phone ?? '');
          setAvatarUrl(u.avatarUrl ?? '');
          setWebhookUrl(u.webhookUrl ?? '');
        }
      })
      .catch((e) => {
        if (!cancelled) toast('error', errMsg(e, 'Gagal memuat profil.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
      toast('success', 'Profil diubah.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal mengubah profil.'));
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
        // Secret kosong = tidak diubah bila sebelumnya sudah ada; null eksplisit = hapus.
        secret: webhookSecret === '' ? (hasSecret ? undefined : null) : webhookSecret,
      });
      setHasSecret(r.hasSecret);
      setWebhookSecret('');
      setWebhookUrl(r.webhookUrl ?? '');
      toast('success', 'Webhook disimpan.');
    } catch (err) {
      toast('error', errMsg(err, 'Gagal menyimpan webhook.'));
    } finally {
      setSavingWebhook(false);
    }
  }

  if (loading) return <p className="text-zinc-400">Memuat…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Pengaturan</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {me ? `Masuk sebagai ${me.username} (${me.role}).` : 'Kelola profil, password, dan webhook.'}
        </p>
      </div>

      <Card title="Profil">
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
          <TextInput
            label="URL avatar (opsional)"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? 'Menyimpan…' : 'Simpan profil'}
          </Button>
        </form>
      </Card>

      <Card title="Ganti password">
        <form onSubmit={(e) => void handlePassword(e)} className="flex flex-col gap-3">
          <TextInput
            label="Password lama"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />
          <TextInput
            label="Password baru (min 6)"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? 'Menyimpan…' : 'Ganti password'}
          </Button>
        </form>
      </Card>

      <Card title="Webhook">
        <form onSubmit={(e) => void handleWebhook(e)} className="flex flex-col gap-3">
          <TextInput
            label="URL webhook (kosongkan = hapus)"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://…"
            inputMode="url"
          />
          <TextInput
            label={`Secret HMAC (kosongkan = ${hasSecret ? 'tetap pakai yang lama' : 'tanpa secret'})`}
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={hasSecret ? '•••• (sudah diset)' : 'opsional'}
          />
          <p className="text-xs text-zinc-500">
            Event message, message.status, qr, connected, disconnected, logged_out,
            presence, group, call, stopped dikirim ke URL ini dengan header
            x-pansa-signature + x-pansa-event. URL internal ditolak (anti-SSRF).
          </p>
          <Button type="submit" disabled={savingWebhook}>
            {savingWebhook ? 'Menyimpan…' : 'Simpan webhook'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
