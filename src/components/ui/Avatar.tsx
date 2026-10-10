'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/client/cn';

/** Inisial dari nama untuk fallback avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 40,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-label={name}
      className="inline-flex items-center justify-center rounded-full bg-primary/15 font-semibold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

/** Tombol salin dengan umpan balik centang. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast('success', `${label} disalin.`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('error', `Gagal menyalin ${label.toLowerCase()}.`);
    }
  }
  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={`Salin ${label}`}
      title={`Salin ${label}`}
      className={cn(
        'pressable inline-flex min-h-9 min-w-9 items-center justify-center rounded-control border border-border bg-card p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground',
        copied && 'border-status-open/50 text-status-open',
      )}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}
