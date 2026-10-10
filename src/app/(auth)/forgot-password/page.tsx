'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ApiError, forgotPassword, resetPassword } from '@/lib/client/api';
import { TextInput } from '@/components/ui/Fields';
import { Button } from '@/components/ui/Button';
import { ThemeIconButton } from '@/components/layout/ThemeToggle';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function fail(err: unknown): void {
    if (err instanceof ApiError) {
      setError(err.message);
    } else {
      setError('Terjadi kesalahan. Coba lagi.');
    }
  }

  async function handleRequestCode(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const result = await forgotPassword(email.trim());
      setInfo(result.message);
      setStep(2);
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password !== confirm) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setLoading(true);
    try {
      const result = await resetPassword(email.trim(), code.trim(), password);
      setInfo(`${result.message} Mengalihkan ke halaman login…`);
      setTimeout(() => router.replace('/login'), 1500);
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="aurora flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeIconButton />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm rounded-panel border border-border bg-card p-6 shadow-3"
      >
        <h1 className="font-display text-center text-2xl font-bold">Lupa Password</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {step === 1
            ? 'Masukkan email akun, kode reset 6 digit dikirim ke email'
            : 'Masukkan kode 6 digit dari email + password baru'}
        </p>

        {step === 1 ? (
          <form onSubmit={handleRequestCode} className="mt-6 flex flex-col gap-4" noValidate>
            <TextInput
              label="Email akun"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            {error ? (
              <p role="alert" className="rounded-control border border-status-failed/40 bg-status-failed/10 px-3 py-2 text-sm">
                {error}
              </p>
            ) : null}
            {info ? (
              <p role="status" className="rounded-control border border-status-open/40 bg-status-open/10 px-3 py-2 text-sm">
                {info}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? 'Mengirim…' : 'Kirim Kode'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="mt-6 flex flex-col gap-4" noValidate>
            <TextInput
              label="Kode 6 digit"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              inputMode="numeric"
              required
              minLength={6}
              maxLength={6}
              placeholder="123456"
              className="text-center font-mono text-xl tracking-[0.5em]"
            />

            <TextInput
              label="Password baru (min. 6 karakter)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />

            <TextInput
              label="Konfirmasi password baru"
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
            {info ? (
              <p role="status" className="rounded-control border border-status-open/40 bg-status-open/10 px-3 py-2 text-sm">
                {info}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? 'Memproses…' : 'Ubah Password'}
            </Button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep(1);
                setCode('');
                setError(null);
                setInfo(null);
              }}
              className="pressable text-sm text-muted-foreground hover:text-foreground"
            >
              Kirim ulang kode / ganti email
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
            Kembali ke login
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
