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
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-control bg-primary font-display text-xl font-bold text-primary-foreground">
            {siteName.trim().charAt(0).toUpperCase() || 'P'}
          </span>
          <span className="text-lg font-semibold tracking-tight">{siteName}</span>
          <div className="absolute right-4 top-4">
            <ThemeIconButton />
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-card border border-border bg-card p-6 shadow-1"
        >
          <h1 className="text-2xl font-bold tracking-tight">Masuk</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">{siteTagline}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
            <Link href="/register" className="font-medium text-foreground hover:underline">
              Daftar akun
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
