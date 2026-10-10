'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { ThemeIconButton } from '@/components/layout/ThemeToggle';

const HIGHLIGHTS = [
  'Banyak nomor WhatsApp dalam satu dasbor',
  'Kirim 13 jenis pesan + blast massal bervariabel',
  'API + webhook siap untuk otomatisasi',
];

/** Kerangka dua kolom untuk login/register: kiri nilai produk, kanan form. */
export function AuthShell({
  siteName,
  siteTagline,
  title,
  subtitle,
  children,
  footer,
}: {
  siteName: string;
  siteTagline: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeIconButton />
      </div>
      <div className="grid w-full max-w-4xl overflow-hidden rounded-panel border border-border bg-card shadow-2 md:grid-cols-2">
        {/* Kolom kiri: nilai produk */}
        <div className="dot-grid relative hidden flex-col justify-between gap-8 bg-muted/60 p-8 md:flex">
          <div>
            <span className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-control bg-primary font-display text-xl font-bold text-primary-foreground">
                {siteName.trim().charAt(0).toUpperCase() || 'P'}
              </span>
              <span className="text-lg font-semibold tracking-tight">{siteName}</span>
            </span>
            <h2 className="font-display mt-6 text-3xl font-bold leading-tight tracking-tight">
              WhatsApp operasional, tanpa ribet.
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{siteTagline}</p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-open/15 text-status-open">
                  <Check size={13} />
                </span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
          <div className="stripe-accent h-2.5 w-24 rounded-full bg-primary" aria-hidden />
        </div>

        {/* Kolom kanan: form */}
        <div className="p-6 sm:p-8">
          <span className="mb-4 flex items-center gap-2.5 md:hidden">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-control bg-primary font-display text-xl font-bold text-primary-foreground">
              {siteName.trim().charAt(0).toUpperCase() || 'P'}
            </span>
            <span className="text-lg font-semibold tracking-tight">{siteName}</span>
          </span>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          {children}
          {footer}
        </div>
      </div>
    </main>
  );
}
