'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, forgotPassword, resetPassword } from '@/lib/client/api';

const inputClass =
  'rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-50 outline-none focus:border-emerald-500';

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
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
        <h1 className="text-center text-2xl font-bold text-zinc-50">Lupa Password</h1>
        <p className="mt-1 text-center text-sm text-zinc-400">
          {step === 1
            ? 'Masukkan email akun, kode reset 6 digit dikirim ke email'
            : 'Masukkan kode 6 digit dari email + password baru'}
        </p>

        {step === 1 ? (
          <form onSubmit={handleRequestCode} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-300">Email akun</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className={inputClass}
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}
            {info ? (
              <p role="status" className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
                {info}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? 'Mengirim…' : 'Kirim Kode'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-300">Kode 6 digit</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                inputMode="numeric"
                required
                minLength={6}
                maxLength={6}
                placeholder="123456"
                className={`${inputClass} text-center text-xl tracking-[0.5em]`}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-300">Password baru (min. 6 karakter)</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-300">Konfirmasi password baru</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                className={inputClass}
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}
            {info ? (
              <p role="status" className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
                {info}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? 'Memproses…' : 'Ubah Password'}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep(1);
                setCode('');
                setError(null);
                setInfo(null);
              }}
              className="text-sm text-zinc-400 hover:text-zinc-200"
            >
              Kirim ulang kode / ganti email
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-zinc-400">
          <Link href="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">
            Kembali ke login
          </Link>
        </p>
      </div>
    </main>
  );
}
