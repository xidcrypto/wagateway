import { cn } from '@/lib/client/cn';

function orbClass(status: string): string {
  if (status === 'open') return 'orb-open';
  if (status === 'qr') return 'orb-blink';
  if (status === 'connecting' || status === 'pairing') return 'orb-spin';
  return '';
}

function orbColor(status: string): string {
  if (status === 'open') return 'var(--status-open)';
  if (status === 'qr') return 'var(--status-qr)';
  if (status === 'connecting' || status === 'pairing') return 'var(--status-connecting)';
  if (status === 'logged_out') return 'var(--status-failed)';
  return 'var(--status-closed)';
}

/**
 * Orb "Denyut Koneksi" — signature visual Pansa.
 * Ukuran: 8 (inline), 12 (daftar), 56 (kartu besar).
 */
export function StatusOrb({
  status,
  size = 12,
  label,
}: {
  status: string;
  size?: 8 | 12 | 56;
  label?: string;
}) {
  const px = size === 8 ? 'h-2 w-2' : size === 56 ? 'h-14 w-14' : 'h-3 w-3';
  const text = label ?? `Status ${status}`;
  return (
    <span
      role="img"
      aria-label={text}
      title={status}
      className={cn('orb', px, orbClass(status))}
      style={{ background: orbColor(status) }}
    />
  );
}
