'use client';

import { useTheme } from 'next-themes';
import { Laptop, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/client/cn';

const OPTIONS = [
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
  { value: 'system', label: 'Sistem', icon: Laptop },
] as const;

/** Toggle tiga pilihan Terang/Gelap/Sistem dengan ikon animasi. */
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  const current = mounted ? (theme ?? 'system') : 'system';

  return (
    <div
      role="group"
      aria-label="Pilih tema"
      className="flex items-center gap-0.5 rounded-control border border-border bg-card p-0.5"
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.label}
            aria-label={`Tema ${o.label}`}
            aria-pressed={active}
            onClick={() => setTheme(o.value)}
            className={cn(
              'pressable flex min-h-9 items-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium transition',
              active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              compact && 'px-2',
            )}
          >
            <Icon
              size={15}
              className="transition-transform duration-300"
              style={active ? { transform: 'rotate(0deg) scale(1.1)' } : undefined}
            />
            {compact ? null : <span className="hidden sm:inline">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Versi ikon tunggal untuk tempat sempit. */
export function ThemeIconButton() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  const dark = mounted ? resolvedTheme === 'dark' : true;
  return (
    <button
      type="button"
      aria-label={dark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
      title={dark ? 'Terang' : 'Gelap'}
      onClick={() => setTheme(mounted && theme === 'system' ? (dark ? 'light' : 'dark') : dark ? 'light' : 'dark')}
      className="pressable flex min-h-10 min-w-10 items-center justify-center rounded-control border border-border bg-card text-muted-foreground transition hover:text-foreground"
    >
      <span className="transition-transform duration-300" style={{ transform: dark ? 'rotate(0deg)' : 'rotate(180deg)' }}>
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </span>
    </button>
  );
}
