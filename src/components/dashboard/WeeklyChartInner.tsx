'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { StatsDaily } from '@/lib/client/api';

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(5);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function WeeklyChartInner({
  daily,
  dark,
}: {
  daily: StatsDaily[];
  dark: boolean;
}) {
  const grid = dark ? '#27272a' : '#e4e4e7';
  const tick = dark ? '#a1a1aa' : '#71717a';
  const data = daily.map((d) => ({ ...d, label: shortDate(d.date) }));

  return (
    <div className="h-56 w-full" role="img" aria-label="Grafik pesan 7 hari terakhir">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: dark ? '#18181b' : '#FFFFFF',
              border: dark ? '1px solid #27272a' : '1px solid #e4e4e7',
              borderRadius: 8,
              color: dark ? '#fafafa' : '#18181b',
              fontSize: 13,
            }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as StatsDaily | undefined;
              return p ? `Tanggal ${p.date}` : '';
            }}
            formatter={(value, name) => [value, name === 'in' ? 'Masuk' : name === 'out' ? 'Keluar' : name]}
          />
          <Area type="monotone" dataKey="in" name="in" stroke="#16a34a" strokeWidth={2} fill="#16a34a" fillOpacity={0.12} />
          <Area type="monotone" dataKey="out" name="out" stroke="#18181b" strokeWidth={2} fill="#18181b" fillOpacity={dark ? 0.2 : 0.06} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
