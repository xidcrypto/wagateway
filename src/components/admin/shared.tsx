'use client';

import { ApiError } from '@/lib/client/api';
import { useCountUp } from '@/lib/client/use-effects';

export const ADMIN_PAGE = 20;

export function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="tnum font-display mt-2 text-2xl font-bold tracking-tight">{shown.toLocaleString('id-ID')}</p>
      <p className="tnum mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
