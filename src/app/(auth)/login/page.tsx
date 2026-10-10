'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { ApiError, getMe, getSiteInfo, getToken, login, setToken } from '@/lib/client/api';
import { TextInput } from '@/components/ui/Fields';
import { Button } from '@/components/ui/Button';
import { AuthShell } from '@/components/auth/AuthShell';

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
    <AuthShell
      siteName={siteName}
      siteTagline={siteTagline}
      title="Masuk"
      subtitle={siteTagline}
      footer={
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
            Lupa password?
          </Link>
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Daftar akun
          </Link>
        </div>
      }
    >
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
    </AuthShell>
  );
}
