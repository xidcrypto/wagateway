'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { WeeklyChart } from '@/components/dashboard/WeeklyChart';
import { ADMIN_PAGE, StatCard, errMsg, formatDateTime } from '@/components/admin/shared';
import {
  getAdminStats,
  getStats,
  listAdminUsers,
  type AdminStats,
  type AdminUser,
  type StatsResponse,
} from '@/lib/client/api';

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [overview, setOverview] = useState<StatsResponse | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAdminStats(),
      getStats().catch((e) => {
        if (!cancelled) setChartError(errMsg(e, 'Gagal memuat grafik.'));
        return null;
      }),
      listAdminUsers().catch(() => ({ users: [] as AdminUser[] })),
    ])
      .then(([s, ov, u]) => {
        if (cancelled) return;
        setStats(s);
        if (ov) setOverview(ov);
        setUsers(u.users);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, 'Gagal memuat ringkasan admin.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-label="Memuat ringkasan admin">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <ErrorState
        message="Gagal memuat ringkasan admin."
        hint={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const msg = stats?.messages ?? { total: 0, in: 0, out: 0, today: 0 };
  const sessionsList = overview?.sessionsList ?? [];
  const totalSessions = stats?.sessions.total ?? sessionsList.length;
  const openCount = stats?.sessions.open ?? 0;

  const byStatus = new Map<string, number>();
  for (const s of sessionsList) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
  const statusRows = [...byStatus.entries()].sort((a, b) => b[1] - a[1]);

  const newestUsers = [...users].sort((a, b) => b.id - a.id).slice(0, 5);
  const recent = (overview?.recent ?? []).slice(0, 7);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pengguna"
          value={stats?.users.total ?? 0}
          sub={`${stats?.users.admins ?? 0} admin · ${stats?.users.regular ?? 0} user`}
        />
        <StatCard
          label="Session"
          value={stats?.sessions.total ?? 0}
          sub={`${openCount} terhubung`}
        />
        <StatCard label="Pesan" value={msg.total} sub={`${msg.in} masuk · ${msg.out} keluar`} />
        <StatCard label="Pesan hari ini" value={msg.today} sub="24 jam terakhir" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title="Pesan 7 hari terakhir"
          className="xl:col-span-2"
          action={<StatusBadge status={`${msg.total} total`} />}
        >
          {chartError && !overview ? (
            <ErrorState
              message="Gagal memuat grafik."
              hint={chartError}
              onRetry={() => window.location.reload()}
            />
          ) : overview && overview.daily.length > 0 ? (
            <WeeklyChart daily={overview.daily} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data.</p>
          )}
        </Card>

        <Card
          title="Status session"
          action={
            <Link href="/admin/sessions" className="text-sm font-semibold text-primary hover:text-primary-hover">
              Semua →
            </Link>
          }
        >
          {statusRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada session.</p>
          ) : (
            <ul className="flex flex-col">
              {statusRows.map(([status, count]) => (
                <li
                  key={status}
                  className="flex items-center gap-2.5 border-b border-border/60 py-2 last:border-0"
                >
                  <StatusOrb status={status} size={8} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <StatusBadge status={status} />
                  </span>
                  <span className="tnum text-sm font-semibold">{count.toLocaleString('id-ID')}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="tnum mt-2 text-xs text-muted-foreground">
            {openCount} dari {totalSessions} terhubung
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title={`Pengguna terbaru (${Math.min(ADMIN_PAGE, newestUsers.length)})`}
          className="xl:col-span-2"
          action={
            <Link href="/admin/users" className="text-sm font-semibold text-primary hover:text-primary-hover">
              Semua →
            </Link>
          }
        >
          {newestUsers.length === 0 ? (
            <EmptyState title="Belum ada pengguna" hint="Tambah pengguna di halaman Pengguna." />
          ) : (
            <ul className="flex flex-col">
              {newestUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2.5 border-b border-border/60 py-2 last:border-0"
                >
                  <Avatar name={u.fullName || u.username} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.username}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <StatusBadge status={u.role} />
                  <span className="tnum hidden text-xs text-muted-foreground sm:inline">
                    {formatDateTime(u.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Aktivitas terakhir"
          action={
            <Link href="/admin/audit" className="text-sm font-semibold text-primary hover:text-primary-hover">
              Semua →
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas.</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {recent.map((m) => (
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
