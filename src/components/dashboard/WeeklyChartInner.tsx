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
  const grid = dark ? 'rgba(255,255,255,.08)' : '#E3E8F0';
  const tick = dark ? '#8B96AD' : '#5B6780';
  const data = daily.map((d) => ({ ...d, label: shortDate(d.date) }));

  return (
    <div className="h-56 w-full" role="img" aria-label="Grafik pesan 7 hari terakhir">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B7CFA" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#5B7CFA" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: tick, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: dark ? '#162033' : '#FFFFFF',
              border: dark ? '1px solid rgba(255,255,255,.08)' : '1px solid #E3E8F0',
              borderRadius: 12,
              color: dark ? '#E6EAF2' : '#0F172A',
              fontSize: 13,
            }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as StatsDaily | undefined;
              return p ? `Tanggal ${p.date}` : '';
            }}
            formatter={(value, name) => [value, name === 'in' ? 'Masuk' : name === 'out' ? 'Keluar' : name]}
          />
          <Area type="monotone" dataKey="in" name="in" stroke="#2DD4BF" strokeWidth={2} fill="url(#gIn)" />
          <Area type="monotone" dataKey="out" name="out" stroke="#5B7CFA" strokeWidth={2} fill="url(#gOut)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
