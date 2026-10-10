'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Fields';

/** Batas upload client (2 MB, sama dengan server; server tetap final). */
export const TICKET_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type PendingImage = {
  file: File;
  previewUrl: string;
};

/**
 * Composer tiket: textarea + tombol Gambar + pratinjau SEBELUM kirim.
 * Alur: pilih file → pratinjau (batal/ganti) → tekan Kirim → upload
 * dengan loading → pesan masuk thread. Tidak ada kirim otomatis.
 */
export function TicketComposer({
  placeholder,
  sending,
  uploading,
  sendLabel = 'Kirim',
  showClose,
  onCloseTicket,
  onSendText,
  onSendImage,
  onTypingPing,
}: {
  placeholder: string;
  sending: boolean;
  uploading: boolean;
  sendLabel?: string;
  showClose: boolean;
  onCloseTicket: () => void;
  onSendText: (text: string) => void | Promise<void>;
  onSendImage: (file: File, caption: string) => void | Promise<void>;
  onTypingPing?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingImage | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      setPickError('Hanya file gambar (jpg, png, webp, gif).');
      return;
    }
    if (file.size > TICKET_IMAGE_MAX_BYTES) {
      setPickError('Gambar kebesaran (maksimal 2 MB).');
      return;
    }
    setPickError(null);
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending({ file, previewUrl: URL.createObjectURL(file) });
  }

  function clearPending(): void {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pending.previewUrl}
              alt="Pratinjau lampiran"
              className="max-h-48 w-auto rounded-control border border-border object-cover"
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
            {pending.file.name} · {(pending.file.size / 1024).toFixed(0)} KB
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
        aria-label="Lampirkan gambar"
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
            aria-label="Lampirkan gambar (maks 2 MB)"
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
