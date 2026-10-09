'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiError,
  clearToken,
  getToken,
  listSessions,
  type SessionItem,
} from '@/lib/client/api';

type MeUser = {
  username: string;
  fullName: string;
  role: 'admin' | 'user';
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [meRes, sessRes] = await Promise.all([
          fetch('/api/me', {
            headers: { Authorization: `Bearer ${getToken()}` },
          }),
          listSessions(),
        ]);
        if (!meRes.ok) {
          if (meRes.status === 401) {
            clearToken();
            router.replace('/login');
            return;
          }
          throw new ApiError('Gagal memuat profil.', meRes.status);
        }
        const meBody = (await meRes.json()) as {
          success: boolean;
          data?: { user: MeUser };
        };
        if (!cancelled) {
          setUser(meBody.data?.user ?? null);
          setSessions(sessRes.sessions);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Gagal memuat data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleLogout(): void {
    clearToken();
    router.replace('/login');
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <p className="text-zinc-400">Memuat…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">Pansa Gateway</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {user ? `Halo, ${user.fullName} (${user.role})` : 'Dashboard'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Keluar
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="font-semibold text-zinc-100">
            Session WhatsApp ({sessions.length})
          </h2>
          {sessions.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">
              Belum ada session. Buat dan kelola session dari halaman Sessions
              (Fase 5).
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{s.label}</p>
                    <p className="text-xs text-zinc-500">
                      {s.phone ?? 'belum tersambung'}
                    </p>
                  </div>
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Dashboard penuh (chat, blast, admin) dibangun di Fase 5.
        </p>
      </div>
    </main>
  );
}
