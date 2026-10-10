'use client';

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import type { StatsDaily } from '@/lib/client/api';

const Chart = dynamic(() => import('./WeeklyChartInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 flex-col gap-2" aria-label="Memuat grafik">
      <div className="skeleton h-full w-full" />
    </div>
  ),
});

export function WeeklyChart({ daily }: { daily: StatsDaily[] }) {
  const { resolvedTheme } = useTheme();
  return <Chart daily={daily} dark={resolvedTheme !== 'light'} />;
}
