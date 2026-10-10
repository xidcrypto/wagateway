'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, getMe, getSiteInfo, getToken, register, setToken } from '@/lib/client/api';
import { TextInput } from '@/components/ui/Fields';
import { Button } from '@/components/ui/Button';
import { AuthShell } from '@/components/auth/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteName, setSiteName] = useState('Pansa Gateway');

  useEffect(() => {
    let cancelled = false;
    getSiteInfo()
      .then((info) => {
        if (!cancelled) setSiteName(info.siteName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Sudah login → langsung ke dashboard sesuai role.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) {
          router.replace(me.user.role === 'admin' ? '/admin' : '/dashboard');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setLoading(true);
    try {
      const result = await register({
        username: username.trim(),
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() === '' ? undefined : phone.trim(),
      });
      setToken(result.token);
      router.replace(result.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      siteName={siteName}
      siteTagline="Satu dasbor untuk semua nomor WhatsApp operasionalmu."
      title="Daftar Akun"
      subtitle={`Buat akun ${siteName} baru`}
      footer={
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Masuk
          </Link>
        </p>
      }
    >
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <TextInput
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
          />

          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <TextInput
            label="Nama lengkap"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />

          <TextInput
            label="Nomor HP (opsional)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />

          <TextInput
            label="Password (min. 6 karakter)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />

          <TextInput
            label="Konfirmasi password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />

          {error ? (
            <p role="alert" className="rounded-control border border-status-failed/40 bg-status-failed/10 px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? 'Memproses…' : 'Daftar'}
          </Button>
        </form>
    </AuthShell>
  );
}
