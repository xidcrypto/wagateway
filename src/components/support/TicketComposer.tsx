'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Fields';
import { TicketImage } from '@/components/support/TicketImage';
import {
  TICKET_IMAGE_MAX_BYTES,
  deleteStagedImage,
  formatBytes,
  stageTicketImage,
  type StagedImage,
} from '@/lib/client/api';
import { cn } from '@/lib/client/cn';

function maxLabel(): string {
  return formatBytes(TICKET_IMAGE_MAX_BYTES);
}

type AttachedImage = {
  staged: StagedImage;
  /** Nama file lokal (tampilan saja). */
  name: string;
};

/**
 * Composer tiket ala live-chat: pilih gambar → LANGSUNG diunggah ke
 * server (progress persen + efek lazy shimmer) → chip kecil menempel di
 * bilah input + tombol X (hapus file di server juga) → Kirim mengirim
 * teks + stagedId (tanpa upload ulang).
 * Semua penolakan tampil sebagai error + toast (tidak refresh diam-diam).
 */
export function TicketComposer({
  ticketId,
  placeholder,
  sending,
  sendLabel = 'Kirim',
  showClose,
  onCloseTicket,
  onSend,
  onTypingPing,
  onError,
}: {
  ticketId: number;
  placeholder: string;
  sending: boolean;
  sendLabel?: string;
  showClose: boolean;
  onCloseTicket: () => void;
  /** Kirim teks + stagedId (null bila tanpa gambar). */
  onSend: (text: string, stagedId: number | null) => void | Promise<void>;
  onTypingPing?: () => void;
  onError?: (message: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState<AttachedImage | null>(null);
  const [staging, setStaging] = useState(false);
  const [stageProgress, setStageProgress] = useState<number | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Abort upload yang masih jalan (X saat staging) + id guard balapan.
  const abortRef = useRef<(() => void) | null>(null);
  const stageSeq = useRef(0);

  // Batalkan upload bila composer unmount / pindah tiket.
  useEffect(() => {
    return () => {
      try {
        abortRef.current?.();
      } catch {
        // Abaikan.
      }
      // Hapus staged yang tak jadi dikirim (best-effort, tanpa await).
      setAttached((prev) => {
        if (prev) {
          deleteStagedImage(prev.staged.id).catch(() => {});
        }
        return prev;
      });
    };
  }, [ticketId]);

  function reject(message: string): void {
    setPickError(message);
    onError?.(message);
  }

  function pickFile(file: File): void {
    if (staging || sending) return;
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
    const seq = (stageSeq.current += 1);
    setStaging(true);
    setStageProgress(0);
    const { promise, abort } = stageTicketImage(ticketId, file, (p) => {
      if (stageSeq.current === seq) setStageProgress(p);
    });
    abortRef.current = abort;
    promise
      .then((r) => {
        if (stageSeq.current !== seq) {
          // Sudah diganti / dibatalkan; buang hasil basi dari server.
          deleteStagedImage(r.staged.id).catch(() => {});
          return;
        }
        // Ganti lampiran lama (hapus dari server).
        setAttached((prev) => {
          if (prev) deleteStagedImage(prev.staged.id).catch(() => {});
          return { staged: r.staged, name: file.name };
        });
      })
      .catch((e: unknown) => {
        if (stageSeq.current !== seq) return;
        const msg =
          e instanceof Error ? e.message : 'Gagal mengunggah gambar.';
        // Abort oleh X bukan error (sudah ditangani di removeAttached).
        if (msg !== 'Unggahan dibatalkan.') reject(msg);
      })
      .finally(() => {
        if (stageSeq.current === seq) {
          setStaging(false);
          setStageProgress(null);
          abortRef.current = null;
        }
      });
  }

  /** Tombol X: batalkan upload jalan + hapus file staged di server. */
  function removeAttached(): void {
    // Naikkan seq agar callback basi diabaikan.
    stageSeq.current += 1;
    try {
      abortRef.current?.();
    } catch {
      // Abaikan.
    }
    abortRef.current = null;
    setAttached((prev) => {
      if (prev) deleteStagedImage(prev.staged.id).catch(() => {});
      return null;
    });
    setStaging(false);
    setStageProgress(null);
    setPickError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const text = draft.trim();
    if (staging || sending) return;
    if (!text && !attached) return;
    await onSend(text.slice(0, 500), attached ? attached.staged.id : null);
    setDraft('');
    // Staged sudah diklaim server (sekali pakai) → buang lokal tanpa DELETE.
    stageSeq.current += 1;
    setAttached(null);
  }

  const busy = sending || staging;
  const canSend = Boolean(attached) || Boolean(draft.trim());

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 flex flex-col gap-2">
      {/* Bilah lampiran kecil ala live-chat: chip + progress + tombol X. */}
      {staging || attached ? (
        <div className="flex items-center gap-2.5 rounded-control border border-border bg-background px-2.5 py-2">
          {staging ? (
            <div
              className="skeleton h-11 w-11 shrink-0 rounded-control"
              role="status"
              aria-label="Mengunggah gambar…"
            />
          ) : attached ? (
            // URL staged berauth → wajib via TicketImage (fetch Bearer),
            // <img src> mentah = 401 = blank.
            <TicketImage key={attached.staged.id} url={attached.staged.previewUrl} compact />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">
              {staging ? 'Mengunggah gambar…' : (attached?.name ?? 'Gambar')}
            </p>
            {staging && stageProgress !== null ? (
              <div className="mt-1.5" role="status" aria-label={`Mengunggah ${stageProgress} persen`}>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${Math.min(100, Math.max(0, stageProgress))}%` }}
                  />
                </div>
                <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
                  {Math.min(100, Math.max(0, stageProgress))}%
                </p>
              </div>
            ) : attached ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatBytes(attached.staged.size)} · sudah di server, tulis caption lalu Kirim
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={removeAttached}
            aria-label="Hapus lampiran"
            title="Hapus lampiran"
            className={cn(
              'pressable flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full',
              'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {staging ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <X size={14} aria-hidden />}
          </button>
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
            <ImagePlus size={14} /> {staging ? 'Mengunggah…' : attached ? 'Ganti' : 'Gambar'}
          </Button>
        </span>
        <Button type="submit" size="sm" disabled={busy || !canSend}>
          <Send size={14} /> {sending ? 'Mengirim…' : sendLabel}
        </Button>
      </div>
    </form>
  );
}
