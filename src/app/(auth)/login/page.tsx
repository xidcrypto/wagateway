'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { ApiError, getMe, getSiteInfo, getToken, login, setToken } from '@/lib/client/api';
import { TextInput } from '@/components/ui/Fields';
import { Button } from '@/components/ui/Button';
import { ThemeIconButton } from '@/components/layout/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ identifier?: string; password?: string }>({});
  const [siteName, setSiteName] = useState('Pansa Gateway');
  const [siteTagline, setSiteTagline] = useState('Masuk untuk mengelola WhatsApp gateway');

  useEffect(() => {
    let cancelled = false;
    getSiteInfo()
      .then((info) => {
        if (!cancelled) {
          setSiteName(info.siteName);
          if (info.siteTagline) setSiteTagline(info.siteTagline);
        }
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
    const fe: { identifier?: string; password?: string } = {};
    if (identifier.trim().length < 3) fe.identifier = 'Isi username atau email yang valid.';
    if (password.length < 6) fe.password = 'Password minimal 6 karakter.';
    setFieldError(fe);
    if (Object.keys(fe).length > 0) return;
    setLoading(true);
    try {
      const result = await login(identifier.trim(), password);
      setToken(result.token);
      router.replace(result.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="aurora grid min-h-screen lg:grid-cols-2">
      {/* Kolom nilai produk (desktop) */}
      <div className="hidden flex-col justify-center gap-5 px-12 lg:flex">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-panel bg-gradient-to-br from-primary to-gradient-to font-display text-3xl font-bold text-white shadow-2">
            {siteName.trim().charAt(0).toUpperCase() || 'P'}
          </span>
          <h1 className="font-display mt-5 max-w-md text-4xl font-bold leading-tight">
            {siteName}
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
            {siteTagline}
          </p>
          <ul className="mt-6 flex max-w-md flex-col gap-3 text-sm text-muted-foreground">
            {[
              'Pantau semua koneksi WhatsApp dalam satu layar.',
              'Kirim pesan, kelola grup, dan jalankan blast terjadwal.',
              'Webhook real-time dengan tanda tangan HMAC.',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-status-open" />
                <span className="leading-6">{t}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Kolom form */}
      <div className="relative flex items-center justify-center px-4 py-10">
        <div className="absolute right-4 top-4">
          <ThemeIconButton />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm rounded-panel border border-border bg-card p-6 shadow-3 sm:p-7"
        >
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-card bg-gradient-to-br from-primary to-gradient-to font-display text-xl font-bold text-white">
              {siteName.trim().charAt(0).toUpperCase() || 'P'}
            </span>
            <div>
              <h1 className="font-display text-xl font-bold">{siteName}</h1>
              <p className="text-[13px] text-muted-foreground">{siteTagline}</p>
            </div>
          </div>
          <h2 className="font-display mt-1 hidden text-2xl font-bold lg:block">Masuk</h2>
          <p className="mt-1 hidden text-sm text-muted-foreground lg:block">
            Kelola gateway WhatsApp milikmu.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <div className="relative">
              <UserRound size={16} className="pointer-events-none absolute left-3 top-[38px] text-muted-foreground" />
              <div className="[&_input]:pl-9">
                <TextInput
                  label="Username atau email"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  placeholder="nama atau email"
                  error={fieldError.identifier}
                />
              </div>
            </div>

            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3 top-[38px] text-muted-foreground" />
              <div className="[&_input]:pl-9 [&_input]:pr-11">
                <TextInput
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  error={fieldError.password}
                />
              </div>
              <button
                type="button"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                onClick={() => setShowPassword((v) => !v)}
                className="pressable absolute right-2 top-[31px] rounded-control p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error ? (
              <p role="alert" className="rounded-control border border-status-failed/40 bg-status-failed/10 px-3 py-2 text-sm text-foreground">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
              Lupa password?
            </Link>
            <Link href="/register" className="font-semibold text-primary hover:text-primary-hover">
              Daftar akun
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
