'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

export default function MessageDonutInner({
  inbound,
  outbound,
  dark,
}: {
  inbound: number;
  outbound: number;
  dark: boolean;
}) {
  const total = inbound + outbound;
  const rows = [
    { name: 'Masuk', value: inbound, color: '#2DD4BF' },
    { name: 'Keluar', value: outbound, color: '#5B7CFA' },
  ];

  if (total <= 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data.</p>;
  }

  return (
    <div>
      <div className="relative h-44 w-full" role="img" aria-label="Komposisi pesan masuk dan keluar">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={76}
              paddingAngle={3}
              strokeWidth={0}
            >
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="tnum font-display text-2xl font-bold">{total.toLocaleString('id-ID')}</p>
          <p className="text-xs text-muted-foreground">pesan</p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {rows.map((r) => {
          const pct = Math.round((r.value / total) * 100);
          return (
            <li key={r.name}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                  {r.name}
                </span>
                <span className="tnum font-semibold">
                  {r.value.toLocaleString('id-ID')} · {pct}%
                </span>
              </div>
              <div
                className="mt-1 h-1.5 overflow-hidden rounded-full"
                style={{ background: dark ? 'rgba(255,255,255,.08)' : '#E3E8F0' }}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${pct}%`, background: r.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
