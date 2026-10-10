'use client';

import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ApiError, getToken } from '@/lib/client/api';
import { cn } from '@/lib/client/cn';

/**
 * Gambar lampiran tiket. Route media berauth Bearer (bukan cookie), jadi
 * <img src> mentah tidak bisa (browser tak kirim token → 401 → blank).
 * Komponen ini fetch pakai token → blob URL, dengan state loading / error
 * + tombol "Coba lagi". Klik thumbnail = lightbox ukuran penuh.
 */
export function TicketImage({ url }: { url: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seq, setSeq] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    async function fetchImage(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const token = getToken();
        const headers = new Headers();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        const res = await fetch(url, { headers });
        if (res.status === 401) {
          throw new ApiError('Sesi habis. Login ulang untuk melihat gambar.', 401);
        }
        if (!res.ok) {
          throw new ApiError(`Gambar tidak bisa dimuat (HTTP ${res.status}).`, res.status);
        }
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) {
          throw new ApiError('File bukan gambar.', 400);
        }
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(objectUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Gambar tidak bisa dimuat.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchImage();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, seq]);

  if (loading) {
    return (
      <div
        className="skeleton mb-1.5 h-36 w-56 max-w-full rounded-control"
        role="status"
        aria-label="Memuat gambar…"
      />
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="mb-1.5 flex max-w-full items-center gap-2 rounded-control border border-border bg-muted/50 px-3 py-2.5">
        <ImageOff size={16} className="shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">{error ?? 'Gambar tidak tersedia.'}</span>
        <button
          type="button"
          onClick={() => setSeq((s) => s + 1)}
          className="pressable min-h-9 shrink-0 rounded-control border border-border bg-card px-3 py-1 text-[13px] font-semibold hover:bg-muted"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setLightbox(true)}
        aria-label="Perbesar gambar"
        className={cn(
          'pressable mb-1.5 block overflow-hidden rounded-control border border-border',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={blobUrl} alt="Lampiran tiket" className="max-h-48 w-auto object-cover" />
      </button>
      {lightbox ? (
        <Modal title="Lampiran" onClose={() => setLightbox(false)} wide>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={blobUrl} alt="Lampiran tiket" className="max-h-[70vh] w-full rounded-control object-contain" />
        </Modal>
      ) : null}
    </>
  );
}
