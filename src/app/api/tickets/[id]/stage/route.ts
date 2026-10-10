import { NextRequest } from 'next/server';
import { isAdmin, withAuth } from '@/lib/server/auth';
import { parseTicketId, type SupportRouteCtx } from '@/lib/server/support';
import {
  deleteSupportImage,
  saveSupportImage,
  sniffImage,
  STAGED_FILE_TTL_MS,
  supportImageMaxBytes,
  supportImageMaxLabel,
} from '@/lib/server/support-media';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TAHAP 1 alur lampiran ala live-chat: pilih gambar → LANGSUNG diunggah
 * ke server (tanpa menunggu Kirim) → client dapat stagedId + pratinjau
 * URL + tampil progress persen selama upload.
 *
 * - File tersimpan di data/media/support/ (nama acak) + tercatat di
 *   support_staged_files (kadaluwarsa 1 jam bila tak dipakai).
 * - Validasi sama ketatnya: magic bytes, batas MB, guard tiket.
 * - Tiket closed → 409. Bukan pesan: tidak mengubah status tiket,
 *   tidak menyiarkan SSE, tidak notifikasi.
 * - Sweeper ringan: tiap stage sukses, hapus staged kedaluwarsa milik
 *   tiket ini (file + baris DB) agar tak menumpuk.
 */
async function handleStage(
  req: NextRequest,
  ctx: Parameters<Parameters<typeof withAuth>[0]>[1],
  routeCtx?: SupportRouteCtx,
): Promise<Response> {
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return fail('Body harus multipart/form-data (field image).', 400);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('Form tidak bisa dibaca.', 400);
  }
  const file = form.get('image');
  if (!(file instanceof File)) {
    return fail('Field image wajib diisi file gambar.', 400);
  }
  if (file.size > supportImageMaxBytes()) {
    return fail(`Gambar kebesaran (maksimal ${supportImageMaxLabel()}).`, 413);
  }
  if (file.size === 0) {
    return fail('File gambar kosong.', 400);
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await file.arrayBuffer());
  } catch {
    return fail('File gambar tidak bisa dibaca.', 400);
  }
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    return fail('File bukan gambar yang didukung (jpg, png, webp, gif).', 400);
  }

  try {
    const admin = isAdmin(ctx);
    let ticket: { id: number } | null;
    if (admin) {
      ticket = await prisma.supportTicket.findUnique({
        where: { id },
        select: { id: true },
      });
    } else {
      ticket = await prisma.supportTicket.findFirst({
        where: { id, userId: ctx.user.id },
        select: { id: true },
      });
    }
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    const status = await prisma.supportTicket.findUnique({
      where: { id },
      select: { status: true },
    });
    if (status && String(status.status) === 'closed') {
      return fail('Tiket sudah ditutup permanen dan tidak bisa dibuka lagi.', 409);
    }

    const stored = await saveSupportImage(bytes, sniffed.ext);
    const staged = await prisma.supportStagedFile.create({
      data: {
        ticketId: id,
        userId: ctx.user.id === 0 ? 1 : ctx.user.id,
        fileName: stored,
        mime: sniffed.mime,
        size: bytes.byteLength,
      },
      select: { id: true, fileName: true, mime: true, size: true },
    });

    // Sweeper ringan: buang staged kedaluwarsa milik tiket ini.
    try {
      const cutoff = new Date(Date.now() - STAGED_FILE_TTL_MS);
      const expired = await prisma.supportStagedFile.findMany({
        where: { ticketId: id, createdAt: { lt: cutoff } },
        select: { id: true, fileName: true },
      });
      for (const e of expired) {
        await deleteSupportImage(e.fileName);
        await prisma.supportStagedFile.delete({ where: { id: e.id } }).catch(() => {});
      }
    } catch {
      // Gagal bersih-bersih tak boleh menggagalkan stage.
    }

    return ok(
      {
        staged: {
          id: staged.id,
          previewUrl: `/api/tickets/media/${staged.fileName}`,
          mime: staged.mime,
          size: staged.size,
        },
      },
      201,
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengunggah gambar.', 500);
  }
}

export const POST = withRateLimit(withAuth(handleStage), {
  scope: 'ticket',
  limit: rateLimitFromEnv('RATE_LIMIT_TICKET', 10),
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
