'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Smartphone, Wifi } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { WeeklyChart } from '@/components/dashboard/WeeklyChart';
import { MessageDonut } from '@/components/dashboard/MessageDonut';
import { useCountUp } from '@/lib/client/use-effects';
import { useLiveEvents } from '@/lib/client/use-live';
import {
  ApiError,
  getMe,
  getStats,
  type StatsResponse,
} from '@/lib/client/api';

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-1 transition hover:-translate-y-0.5 hover:shadow-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-control"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          {icon}
        </span>
      </div>
      <p className="tnum font-display mt-2 text-2xl font-bold tracking-tight">{shown.toLocaleString('id-ID')}</p>
      <p className="tnum mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

function statusText(status: string): string {
  switch (status) {
    case 'open':
      return 'Terhubung';
    case 'qr':
      return 'Menunggu scan QR';
    case 'pairing':
      return 'Menunggu kode pairing';
    case 'connecting':
      return 'Menghubungkan';
    case 'closed':
      return 'Terputus';
    case 'stopped':
      return 'Dihentikan';
    case 'logged_out':
      return 'Keluar';
    default:
      return status;
  }
}

export default function DashboardPage() {
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [name, setName] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setError(null);
    try {
      const me = await getMe();
      setRole(me.user.role);
      setName(me.user.fullName);
      const s = await getStats();
      setStats(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  // Live SSE-first: muat ulang statistik saat ada pesan/session berubah.
  // Tanpa interval — hemat request, data selalu segar. Fallback: tombol
  // "Muat ulang" manual bila SSE mati.
  const { connected: dashLive } = useLiveEvents({
    onSession: () => {
      void load();
    },
    onPoll: () => {
      // SSE sunyi: jangan spam reload tiap 5 dtk untuk dashboard
      // (datanya agregat berat). User pakai tombol muat ulang.
    },
    fallbackMs: 8000,
    pollMs: 30000,
    enabled: !loading,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        setRole(me.user.role);
        setName(me.user.fullName);
        const s = await getStats();
        if (!cancelled) setStats(s);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Gagal memuat data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-label="Memuat dashboard">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Skeleton className="h-72 xl:col-span-2" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <ErrorState
          message="Gagal memuat dashboard."
          hint={error}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      </div>
    );
  }

  const sessions = stats?.sessionsList ?? [];
  const totalSessions = stats?.sessions.total ?? sessions.length;
  const openCount = stats?.sessions.open ?? 0;
  const msg = stats?.messages ?? { total: 0, in: 0, out: 0, today: 0 };

  const connectedRate = totalSessions > 0 ? Math.round((openCount / totalSessions) * 100) : 0;

  const cards = [
    {
      label: role === 'admin' ? 'Session' : 'Session saya',
      value: totalSessions,
      sub: `${openCount} terhubung · ${connectedRate}%`,
      icon: <Smartphone size={16} />,
      accent: 'var(--status-qr)',
    },
    {
      label: 'Pesan hari ini',
      value: msg.today,
      sub: '24 jam terakhir',
      icon: <CalendarDays size={16} />,
      accent: 'var(--primary)',
    },
    {
      label: 'Pesan masuk',
      value: msg.in,
      sub: `dari ${totalSessions} session`,
      icon: <ArrowDownLeft size={16} />,
      accent: 'var(--status-open)',
    },
    {
      label: 'Pesan keluar',
      value: msg.out,
      sub: `dari ${totalSessions} session`,
      icon: <ArrowUpRight size={16} />,
      accent: 'var(--primary)',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] text-muted-foreground">{today}</p>
          <h1 className="font-display mt-0.5 text-2xl font-bold">
            {name ? `Selamat datang kembali, ${name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ini yang sedang terjadi: {msg.today} pesan hari ini · {openCount} dari {totalSessions} session terhubung.{' '}
            <span title={dashLive ? 'Data diperbarui real-time' : 'SSE terputus'}>
              {dashLive ? '● live' : '○ offline'}
            </span>
          </p>
        </div>
        {!dashLive && !loading ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            Muat ulang
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState message="Sebagian data gagal dimuat." hint={error} onRetry={() => void load()} />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <Reveal key={c.label} delayMs={i * 60}>
            <StatCard {...c} />
          </Reveal>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title="Pesan 7 hari terakhir"
          className="xl:col-span-2"
          action={<StatusBadge status={`${msg.total} total`} />}
        >
          {stats && stats.daily.length > 0 ? (
            <WeeklyChart daily={stats.daily} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data.</p>
          )}
        </Card>

        <Card title="Komposisi pesan">
          <MessageDonut inbound={msg.in} outbound={msg.out} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title={`Session WhatsApp (${totalSessions})`}
          className="xl:col-span-2"
          action={
            <Link href="/sessions" className="text-sm font-semibold text-primary hover:text-primary-hover">
              Kelola →
            </Link>
          }
        >
          {sessions.length === 0 ? (
            <EmptyState
              title="Belum ada session"
              hint="Buat session pertamamu, lalu tautkan perangkat dengan scan QR atau kode pairing."
              action={
                <Link href="/sessions">
                  <Button>Buat session</Button>
                </Link>
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {sessions.slice(0, 6).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-control border border-border bg-background px-3 py-2.5"
                >
                  <StatusOrb status={s.status} size={12} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {s.phone ?? 'belum tersambung'} · {statusText(s.status)}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Wifi size={14} />
            {openCount} terhubung dari {totalSessions} session
          </p>
        </Card>

        <Card
          title="Aktivitas terakhir"
          action={
            <Link href="/messages" className="text-sm font-semibold text-primary hover:text-primary-hover">
              Semua →
            </Link>
          }
        >
          {!stats || stats.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada aktivitas.
            </p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {stats.recent.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start gap-2.5 rounded-control px-2 py-1.5 hover:bg-muted/50"
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: m.direction === 'in' ? 'var(--status-open)' : 'var(--primary)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-foreground">
                      {m.textBody || `(${m.msgType})`}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {m.session?.label ?? m.sessionId} · {m.remoteJid} · {timeAgo(m.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={m.direction} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
