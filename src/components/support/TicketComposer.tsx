'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Fields';
import { TICKET_IMAGE_MAX_BYTES, formatBytes } from '@/lib/client/api';
import { cn } from '@/lib/client/cn';

export type PendingImage = {
  file: File;
  previewUrl: string;
};

function maxLabel(): string {
  return formatBytes(TICKET_IMAGE_MAX_BYTES);
}

/**
 * Composer tiket: textarea + tombol Gambar + pratinjau SEBELUM kirim.
 * Alur: pilih file → pratinjau (loading shimmer → gambar, batal/ganti) →
 * tekan Kirim → progress bar persen → pesan masuk thread.
 * Tidak ada kirim otomatis; semua penolakan tampil sebagai error + toast.
 */
export function TicketComposer({
  placeholder,
  sending,
  uploading,
  progress,
  sendLabel = 'Kirim',
  showClose,
  onCloseTicket,
  onSendText,
  onSendImage,
  onTypingPing,
  onError,
}: {
  placeholder: string;
  sending: boolean;
  uploading: boolean;
  /** Persen upload 0–100 (null = tidak mengunggah). */
  progress: number | null;
  sendLabel?: string;
  showClose: boolean;
  onCloseTicket: () => void;
  onSendText: (text: string) => void | Promise<void>;
  onSendImage: (file: File, caption: string) => void | Promise<void>;
  onTypingPing?: () => void;
  onError?: (message: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingImage | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bersihkan blob URL saat unmount (anti bocor memori).
  useEffect(() => {
    return () => {
      setPending((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return prev;
      });
    };
  }, []);

  function reject(message: string): void {
    setPickError(message);
    onError?.(message);
  }

  function pickFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      reject('Hanya file gambar (jpg, png, webp, gif).');
      return;
    }
    if (file.size > TICKET_IMAGE_MAX_BYTES) {
      reject(`Gambar kebesaran (${formatBytes(file.size)}). Maksimal ${maxLabel()}.`);
      return;
    }
    if (file.size === 0) {
      reject('File gambar kosong.');
      return;
    }
    setPickError(null);
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    // Tampilkan loading pratinjau dulu (file besar butuh waktu decode).
    setPreviewLoading(true);
    const previewUrl = URL.createObjectURL(file);
    setPending({ file, previewUrl });
  }

  function clearPending(): void {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    setPreviewLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const text = draft.trim();
    // Prioritas: gambar pending dikirim dulu (dengan caption = draft).
    if (pending) {
      await onSendImage(pending.file, text.slice(0, 500));
      clearPending();
      setDraft('');
      return;
    }
    if (!text || sending || uploading) return;
    await onSendText(text);
    setDraft('');
  }

  const busy = sending || uploading;
  const canSend = Boolean(pending) || Boolean(draft.trim());

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 flex flex-col gap-2">
      {pending ? (
        <div className="rounded-control border border-border bg-background p-2.5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Pratinjau lampiran — belum terkirim. Tulis caption (opsional) lalu tekan Kirim.
          </p>
          <div className="relative inline-block">
            {previewLoading ? (
              <div
                className="skeleton h-48 w-64 max-w-full rounded-control"
                role="status"
                aria-label="Memuat pratinjau…"
              />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pending.previewUrl}
              alt="Pratinjau lampiran"
              onLoad={() => setPreviewLoading(false)}
              onError={() => {
                setPreviewLoading(false);
                reject('File tidak bisa dibaca sebagai gambar.');
                clearPending();
              }}
              className={cn(
                'max-h-48 w-auto rounded-control border border-border object-cover',
                previewLoading && 'hidden',
              )}
            />
            <button
              type="button"
              onClick={clearPending}
              aria-label="Batalkan lampiran"
              className="pressable absolute -right-2 -top-2 flex min-h-8 min-w-8 items-center justify-center rounded-full border border-border bg-card shadow-3 hover:bg-muted"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
            {pending.file.name} · {formatBytes(pending.file.size)}
          </p>
        </div>
      ) : null}
      {uploading && progress !== null ? (
        <div role="status" aria-label={`Mengunggah ${progress} persen`}>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="tnum mt-1 text-[11px] text-muted-foreground">
            Mengunggah… {Math.min(100, Math.max(0, progress))}%
          </p>
        </div>
      ) : null}
      {pickError ? (
        <p role="alert" className="text-[13px] text-status-failed">
          {pickError}
        </p>
      ) : null}
      <TextArea
        aria-label="Tulis balasan"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onTypingPing?.();
        }}
        placeholder={placeholder}
        maxLength={2000}
        rows={3}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-label={`Lampirkan gambar (maks ${maxLabel()})`}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickFile(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="flex gap-2">
          {showClose ? (
            <Button type="button" variant="secondary" size="sm" onClick={onCloseTicket}>
              Tutup tiket
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            aria-label={`Lampirkan gambar (maks ${maxLabel()})`}
          >
            <ImagePlus size={14} /> {uploading ? 'Mengunggah…' : pending ? 'Ganti' : 'Gambar'}
          </Button>
        </span>
        <Button type="submit" size="sm" disabled={busy || !canSend}>
          <Send size={14} /> {uploading ? 'Mengunggah…' : sending ? 'Mengirim…' : sendLabel}
        </Button>
      </div>
    </form>
  );
}
