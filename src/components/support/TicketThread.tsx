'use client';

import type { TicketMessage } from '@/lib/client/api';
import { cn } from '@/lib/client/cn';

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'baru saja';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Thread percakapan tiket: bubble kiri (CS/admin) vs kanan (user).
 * Dipakai halaman user (/cs) dan admin (/admin/tickets).
 */
export function TicketThread({ messages }: { messages: TicketMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada pesan.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5" aria-live="polite">
      {messages.map((m) => {
        const mine = !m.fromAdmin;
        return (
          <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-card border px-3.5 py-2.5 sm:max-w-[75%]',
                mine
                  ? 'border-primary/30 bg-primary/10'
                  : 'border-border bg-card shadow-1',
              )}
            >
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {m.fromAdmin ? 'CS' : (m.sender?.fullName || m.sender?.username || 'Kamu')}
                {' · '}
                <time>{timeAgo(m.createdAt)}</time>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{m.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
