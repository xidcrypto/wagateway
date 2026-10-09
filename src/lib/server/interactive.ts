import 'server-only';

import { z } from 'zod';
import { MediaError, loadMedia } from './media-loader';
import { validatePublicHttpUrl } from './validators';

/**
 * Builder pesan interaktif (Fase 2, step 2.6).
 * - buttons   → nativeFlow (reply/url/copy/call), header media opsional.
 * - list      → listMessage klasik (sections + rows).
 * - carousel  → interactiveMessage carousel (tiap card wajib gambar/video).
 * - buttonv2  → buttonsMessage klasik (quick reply, maks 3).
 *
 * Buffer media TIDAK PERNAH masuk payload DB (hanya diteruskan ke Baileys).
 */

/** Satu tombol universal; `type` boleh diinfer dari key yang terisi. */
export const buttonInputSchema = z.object({
  type: z.enum(['reply', 'url', 'copy', 'call']).optional(),
  id: z.string().min(1, 'ID tombol maksimal 200 karakter.').max(200).optional(),
  text: z.string().min(1).max(30).optional(),
  buttonText: z.string().min(1).max(30).optional(),
  url: z.string().max(2048).optional(),
  copy: z.string().min(1, 'Teks salin maksimal 1024 karakter.').max(1024).optional(),
  call: z.string().max(32).optional(),
});

export type ButtonInput = z.infer<typeof buttonInputSchema>;

export type NormalizedButton =
  | { kind: 'reply'; id: string; text: string }
  | { kind: 'url'; text: string; url: string }
  | { kind: 'copy'; text: string; copy: string }
  | { kind: 'call'; text: string; call: string };

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

function buttonError(index: number, message: string): Error {
  return Object.assign(new Error(`buttons[${index}]: ${message}`), { statusCode: 400 });
}

/** Normalisasi + validasi satu tombol menjadi bentuk kanonis. */
export function normalizeButton(input: ButtonInput, index: number): NormalizedButton {
  const text = (input.text ?? input.buttonText ?? '').trim();
  if (!text) throw buttonError(index, 'Teks tombol wajib diisi (maks 30 karakter).');
  const kind =
    input.type ??
    (input.id ? 'reply' : input.url ? 'url' : input.copy ? 'copy' : input.call ? 'call' : null);
  if (!kind) {
    throw buttonError(index, 'Tentukan jenis tombol: id (reply), url, copy, atau call.');
  }
  if (kind === 'reply') {
    const id = (input.id ?? '').trim();
    if (!id) throw buttonError(index, 'Tombol reply wajib punya id.');
    return { kind, id, text };
  }
  if (kind === 'url') {
    const url = (input.url ?? '').trim();
    if (!url) throw buttonError(index, 'Tombol url wajib punya url.');
    const blocked = validatePublicHttpUrl(url);
    if (blocked) throw buttonError(index, `URL tidak valid: ${blocked}`);
    return { kind, text, url };
  }
  if (kind === 'copy') {
    const copy = (input.copy ?? '').trim();
    if (!copy) throw buttonError(index, 'Tombol copy wajib punya teks salin.');
    return { kind, text, copy };
  }
  const phone = digitsOnly(input.call ?? '');
  if (!phone || phone.length < 6 || phone.length > 15 || phone.startsWith('0')) {
    throw buttonError(index, 'Nomor call harus format internasional tanpa awalan nol.');
  }
  return { kind, text, call: phone };
}

/** Bentuk tombol untuk Baileys nativeFlow maupun templateButtons (format sama). */
export function toBaileysButton(b: NormalizedButton): unknown {
  if (b.kind === 'reply') return { id: b.id, text: b.text };
  if (b.kind === 'url') return { url: b.url, text: b.text };
  if (b.kind === 'copy') return { copy: b.copy, text: b.text };
  return { call: b.call, text: b.text };
}

/** Header media opsional (buttons & buttonv2): hanya gambar. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadImageHeader(media: string): Promise<{ image: Buffer; mimetype: string }> {
  const loaded = await loadMedia({ media });
  if (!loaded.mimeType.startsWith('image/')) {
    throw new MediaError(
      `Header interaktif hanya mendukung gambar (terdeteksi: ${loaded.mimeType}).`,
      400,
    );
  }
  return { image: loaded.buffer, mimetype: loaded.mimeType };
}

/* ------------------------------- LIST ---------------------------------- */

export const listRowSchema = z.object({
  title: z.string().min(1, 'Judul baris maksimal 60 karakter.').max(60),
  description: z.string().max(300).optional().nullable(),
  id: z.string().min(1).max(200).optional(),
  rowId: z.string().min(1).max(200).optional(),
});

export const listSectionSchema = z.object({
  title: z.string().min(1).max(60).optional(),
  rows: z.array(listRowSchema).min(1, 'Setiap section minimal 1 baris.').max(10, 'Maksimal 10 baris per section.'),
});

export type ListSectionInput = z.infer<typeof listSectionSchema>;

export type BuiltListSection = {
  title: string;
  rows: { title: string; description?: string; rowId: string }[];
};

/** Bangun sections listMessage; rowId dibuat otomatis bila kosong. */
export function buildListSections(sections: ListSectionInput[]): BuiltListSection[] {
  if (sections.length > 10) {
    throw Object.assign(new Error('Maksimal 10 section per list.'), { statusCode: 400 });
  }
  return sections.map((s, si) => ({
    title: (s.title ?? '').trim() || `Pilihan ${si + 1}`,
    rows: s.rows.map((r, ri) => ({
      title: r.title.trim(),
      ...(r.description ? { description: r.description } : {}),
      rowId: (r.rowId ?? r.id ?? '').trim() || `row-${si + 1}-${ri + 1}`,
    })),
  }));
}

/* ----------------------------- CAROUSEL -------------------------------- */

export const carouselCardSchema = z.object({
  image: z.string().min(1).max(8_000_000).optional(),
  video: z.string().min(1).max(8_000_000).optional(),
  caption: z.string().max(1024).optional().nullable(),
  title: z.string().max(60).optional().nullable(),
  subtitle: z.string().max(60).optional().nullable(),
  footer: z.string().max(500).optional().nullable(),
  buttons: z.array(buttonInputSchema).min(1, 'Setiap card minimal 1 tombol.').max(10, 'Maksimal 10 tombol per card.'),
});

export type CarouselCardInput = z.infer<typeof carouselCardSchema>;

/** Bangun satu card carousel; tiap card WAJIB punya gambar atau video. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildCarouselCard(card: CarouselCardInput, index: number): Promise<any> {
  const media = card.image ?? card.video ?? null;
  if (!media) {
    throw Object.assign(new Error(`cards[${index}]: Setiap card wajib ada gambar atau video.`), {
      statusCode: 400,
    });
  }
  const loaded = await loadMedia({ media });
  const isImage = loaded.mimeType.startsWith('image/');
  const isVideo = loaded.mimeType.startsWith('video/');
  if (!isImage && !isVideo) {
    throw new MediaError(
      `cards[${index}]: Card hanya mendukung gambar atau video (terdeteksi: ${loaded.mimeType}).`,
      400,
    );
  }
  const buttons = card.buttons.map((b, bi) => toBaileysButton(normalizeButton(b, bi)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const built: any = {
    ...(isImage
      ? { image: loaded.buffer, mimetype: loaded.mimeType }
      : { video: loaded.buffer, mimetype: loaded.mimeType }),
    nativeFlow: buttons,
  };
  if (card.caption) built.caption = card.caption;
  if (card.title) built.title = card.title;
  if (card.subtitle) built.subtitle = card.subtitle;
  if (card.footer) built.footer = card.footer;
  return built;
}
