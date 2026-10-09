const STATUS_CLASS: Record<string, string> = {
  open: 'bg-emerald-900 text-emerald-200',
  qr: 'bg-amber-900 text-amber-200',
  pairing: 'bg-amber-900 text-amber-200',
  connecting: 'bg-zinc-800 text-zinc-300',
  closed: 'bg-zinc-800 text-zinc-400',
  stopped: 'bg-zinc-800 text-zinc-400',
  logged_out: 'bg-red-950 text-red-300',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASS[status] ?? 'bg-zinc-800 text-zinc-300';
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
