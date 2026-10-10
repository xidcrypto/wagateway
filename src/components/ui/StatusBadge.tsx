import { cn } from '@/lib/client/cn';

const STATUS_CLASS: Record<string, string> = {
  open: 'bg-status-open/15 text-status-open border-status-open/40',
  qr: 'bg-status-qr/15 text-status-qr border-status-qr/40',
  pairing: 'bg-status-connecting/15 text-status-connecting border-status-connecting/40',
  connecting: 'bg-status-connecting/15 text-status-connecting border-status-connecting/40',
  closed: 'bg-status-closed/15 text-status-closed border-status-closed/40',
  stopped: 'bg-status-closed/15 text-status-closed border-status-closed/40',
  logged_out: 'bg-status-failed/15 text-status-failed border-status-failed/40',
  sent: 'bg-status-qr/15 text-status-qr border-status-qr/40',
  delivered: 'bg-status-open/15 text-status-open border-status-open/40',
  read: 'bg-status-open/15 text-status-open border-status-open/40',
  failed: 'bg-status-failed/15 text-status-failed border-status-failed/40',
  pending: 'bg-status-connecting/15 text-status-connecting border-status-connecting/40',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASS[status] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        cls,
      )}
    >
      {status}
    </span>
  );
}
