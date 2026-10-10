'use client';

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

const Donut = dynamic(() => import('./MessageDonutInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 flex-col gap-2" aria-label="Memuat komposisi pesan">
      <div className="skeleton h-full w-full" />
    </div>
  ),
});

export function MessageDonut({ inbound, outbound }: { inbound: number; outbound: number }) {
  const { resolvedTheme } = useTheme();
  return <Donut inbound={inbound} outbound={outbound} dark={resolvedTheme !== 'light'} />;
}
