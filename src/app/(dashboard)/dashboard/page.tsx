'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Inbox,
  MessageSquare,
  Send,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  ApiError,
  countSessionMessages,
  getAdminStats,
  getMe,
  listSessions,
  type AdminStats,
  type SessionItem,
} from '@/lib/client/api';

type StatCard = {
  label: string;
  value: string;
  icon: React.ReactNode;
};

function StatGrid({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
        >
          <div className="flex items-center gap-2 text-zinc-400">
            {c.icon}
            <span className="text-xs">{c.label}</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-zinc-50">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [name, setName] = useState('');
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [msgIn, setMsgIn] = useState<number | null>(null);
  const [msgOut, setMsgOut] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const me = await getMe();
        if (cancelled) return;
        setRole(me.user.role);
        setName(me.user.fullName);

        const sessRes = await listSessions();
        if (cancelled) return;
        setSessions(sessRes.sessions);

        if (me.user.role === 'admin') {
          // Admin: statistik sistem langsung dari /api/admin/stats.
          const s = await getAdminStats();
          if (!cancelled) setStats(s);
        } else {
          // User biasa: agregasi total pesan masuk/keluar dari tiap session miliknya.
          let totalIn = 0;
          let totalOut = 0;
          for (const s of sessRes.sessions) {
            const [cIn, cOut] = await Promise.all([
              countSessionMessages(s.id, 'in'),
              countSessionMessages(s.id, 'out'),
            ]);
            totalIn += cIn;
            totalOut += cOut;
          }
          if (!cancelled) {
            setMsgIn(totalIn);
            setMsgOut(totalOut);
          }
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
  }, []);

  if (loading) {
    return <p className="text-zinc-400">Memuat…</p>;
  }

  const openCount = sessions.filter((s) => s.status === 'open').length;

  const cards: StatCard[] =
    role === 'admin' && stats
      ? [
          { label: 'Session', value: String(stats.sessions.total), icon: <Smartphone size={16} /> },
          { label: 'Session open', value: String(stats.sessions.open), icon: <Wifi size={16} /> },
          { label: 'Pesan masuk', value: String(stats.messages.in), icon: <Inbox size={16} /> },
          { label: 'Pesan keluar', value: String(stats.messages.out), icon: <Send size={16} /> },
          { label: 'Pesan hari ini', value: String(stats.messages.today), icon: <MessageSquare size={16} /> },
          { label: 'Pengguna', value: String(stats.users.total), icon: <Users size={16} /> },
        ]
      : [
          { label: 'Session saya', value: String(sessions.length), icon: <Smartphone size={16} /> },
          { label: 'Session open', value: String(openCount), icon: <Wifi size={16} /> },
          { label: 'Pesan masuk', value: msgIn === null ? '–' : String(msgIn), icon: <Inbox size={16} /> },
          { label: 'Pesan keluar', value: msgOut === null ? '–' : String(msgOut), icon: <Send size={16} /> },
        ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {name ? `Halo, ${name}` : 'Ringkasan gateway WhatsApp'}
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <StatGrid cards={cards} />

      <Card
        title={`Session WhatsApp (${sessions.length})`}
        action={
          <Link href="/sessions" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
            Kelola →
          </Link>
        }
      >
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Belum ada session.{' '}
            <Link href="/sessions" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Buat session pertama
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{s.label}</p>
                  <p className="text-xs text-zinc-500">
                    {s.phone ?? 'belum tersambung'}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
