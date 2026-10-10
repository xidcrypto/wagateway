'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, CheckCheck } from 'lucide-react';
import type { TicketMessage } from '@/lib/client/api';
import { TicketImage } from '@/components/support/TicketImage';
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
 * Thread percakapan tiket ala chat: panel scroll tetap + auto-scroll
 * cerdas (ikut bawah hanya bila user sudah di dasar; tombol "Pesan baru"
 * bila lagi baca ke atas) + centang biru bila pesan sendiri sudah dibaca
 * lawan + thumbnail gambar (klik = lightbox).
 *
 * - `peerReadAt`: ISO kapan LAWAN terakhir membaca (untuk centang biru).
 * - `isAdminView`: true di panel admin (bubble sendiri = kiri/CS).
 * - `peerTyping`: tampilkan "… sedang mengetik" bila true.
 * - `peerName`: nama lawan untuk label typing ("CS"/"User sedang mengetik").
 */
export function TicketThread({
  messages,
  peerReadAt,
  isAdminView = false,
  peerTyping = false,
  peerName = 'CS',
}: {
  messages: TicketMessage[];
  peerReadAt: string | null;
  isAdminView?: boolean;
  peerTyping?: boolean;
  peerName?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stickBottom, setStickBottom] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const prevCount = useRef(messages.length);

  // Auto-scroll cerdas: ikut ke bawah hanya bila user sedang di dasar.
  // Deteksi pesan baru via ref (bukan setState sinkron di body effect).
  useEffect(() => {
    if (messages.length > prevCount.current && !stickBottom) {
      setHasNew(true);
    }
    prevCount.current = messages.length;
    if (stickBottom) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages.length, peerTyping, stickBottom]);

  function onScroll(): void {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setStickBottom(nearBottom);
    if (nearBottom) setHasNew(false);
  }

  function jumpBottom(): void {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    setStickBottom(true);
    setHasNew(false);
  }

  if (messages.length === 0 && !peerTyping) {
    return <p className="text-sm text-muted-foreground">Belum ada pesan.</p>;
  }

  const peerReadMs = peerReadAt ? new Date(peerReadAt).getTime() : 0;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-label="Percakapan tiket"
        aria-live="polite"
        className="flex max-h-[52vh] min-h-48 flex-col gap-2.5 overflow-y-auto rounded-control border border-border bg-background p-3"
      >
        {messages.map((m) => {
          // Bubble sendiri SELALU kanan (user & admin), lawan kiri — jadi
          // jelas siapa pengirim di kedua sisi, plus label eksplisit.
          const mine = isAdminView ? m.fromAdmin : !m.fromAdmin;
          // Centang biru: pesan sendiri yang dibuat SEBELUM lawan terakhir membaca.
          const read =
            Number.isFinite(peerReadMs) &&
            peerReadMs > 0 &&
            new Date(m.createdAt).getTime() <= peerReadMs;
          const senderLabel = m.fromAdmin
            ? 'CS'
            : (m.sender?.fullName || m.sender?.username || (isAdminView ? 'User' : 'Kamu'));
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-card border px-3.5 py-2.5',
                  mine
                    ? 'border-primary/30 bg-primary/10'
                    : 'border-border bg-card shadow-1',
                )}
              >
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                  {mine ? `Kamu${m.fromAdmin ? ' (CS)' : ''}` : senderLabel}
                  {' · '}
                  <time>{timeAgo(m.createdAt)}</time>
                </p>
                {m.mediaUrl ? <TicketImage url={m.mediaUrl} /> : null}
                {m.body ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{m.body}</p>
                ) : null}
                {mine ? (
                  <p className="mt-1 flex items-center justify-end gap-1" aria-label={read ? 'Sudah dibaca' : 'Terkirim'}>
                    {read ? (
                      <CheckCheck size={15} className="text-status-qr" aria-hidden />
                    ) : (
                      <Check size={15} className="text-muted-foreground" aria-hidden />
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
        {peerTyping ? (
          <div className="flex justify-start">
            <div
              className="typing-dots flex items-center gap-1.5 rounded-card border border-border bg-card px-3.5 py-2.5 shadow-1"
              role="status"
              aria-label={`${peerName} sedang mengetik`}
            >
              <span aria-hidden />
              <span aria-hidden />
              <span aria-hidden />
              <span className="sr-only">{peerName} sedang mengetik…</span>
            </div>
          </div>
        ) : null}
      </div>

      {hasNew ? (
        <button
          type="button"
          onClick={jumpBottom}
          className="pressable absolute bottom-3 left-1/2 flex min-h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold shadow-3 hover:bg-muted"
        >
          <ArrowDown size={13} /> Pesan baru
        </button>
      ) : null}
    </div>
  );
}
