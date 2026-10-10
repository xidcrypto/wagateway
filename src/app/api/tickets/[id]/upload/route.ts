import { NextRequest } from 'next/server';
import { isAdmin, withAuth } from '@/lib/server/auth';
import { parseTicketId, type SupportRouteCtx } from '@/lib/server/support';
import { publishTicketMessage } from '@/lib/server/ticket-live';
import {
  saveSupportImage,
  sniffImage,
  SUPPORT_IMAGE_MAX_BYTES,
} from '@/lib/server/support-media';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_Caption = 500;

function toWire(m: {
  id: bigint;
  fromAdmin: boolean;
  body: string;
  mediaPath: string | null;
  mediaMime: string | null;
  createdAt: Date;
  sender: { id: number; username: string; fullName: string } | null;
}) {
  return {
    id: String(m.id),
    fromAdmin: m.fromAdmin,
    body: m.body,
    mediaUrl: m.mediaPath ? `/api/tickets/media/${m.mediaPath}` : null,
    mediaMime: m.mediaMime,
    createdAt: m.createdAt.toISOString(),
    sender: m.sender
      ? { id: m.sender.id, username: m.sender.username, fullName: m.sender.fullName }
      : null,
  };
}

/**
 * Lampiran gambar ke tiket (multipart/form-data: `image` + `caption`
 * opsional ≤500 char). Diperketat berlapis:
 * - hanya multipart, field `image` wajib ada;
 * - ukuran ≤ 2 MB (tolak 413 bila lebih);
 * - tipe dari magic bytes (jpg/png/webp/gif), bukan ekstensi;
 * - nama file acak di data/media/support/ (tak bisa ditebak);
 * - caption teks polos (tanpa HTML).
 * Tiket closed → 409 (sama seperti balas teks).
 */
async function handleUpload(
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
  if (file.size > SUPPORT_IMAGE_MAX_BYTES) {
    return fail('Gambar kebesaran (maksimal 2 MB).', 413);
  }
  if (file.size === 0) {
    return fail('File gambar kosong.', 400);
  }
  const rawCaption = form.get('caption');
  const caption =
    typeof rawCaption === 'string' ? rawCaption.trim().slice(0, MAX_Caption) : '';

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
    let ticket: { id: number; userId: number; subject: string; status: unknown } | null;
    if (admin) {
      ticket = await prisma.supportTicket.findUnique({
        where: { id },
        select: { id: true, userId: true, subject: true, status: true },
      });
    } else {
      ticket = await prisma.supportTicket.findFirst({
        where: { id, userId: ctx.user.id },
        select: { id: true, userId: true, subject: true, status: true },
      });
    }
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    if (String(ticket.status) === 'closed') {
      return fail('Tiket sudah ditutup. Buat tiket baru bila masih butuh bantuan.', 409);
    }

    const stored = await saveSupportImage(bytes, sniffed.ext);
    const created = await prisma.$transaction(async (tx) => {
      const msg = await tx.supportMessage.create({
        data: {
          ticketId: id,
          senderId: admin && ctx.user.id === 0 ? null : ctx.user.id,
          fromAdmin: admin,
          body: caption,
          mediaPath: stored,
          mediaMime: sniffed.mime,
        },
        include: { sender: { select: { id: true, username: true, fullName: true } } },
      });
      await tx.supportTicket.update({
        where: { id },
        data: {
          status: admin ? 'answered' : 'open',
          ...(admin ? { adminLastReadAt: new Date() } : { userLastReadAt: new Date() }),
        },
      });
      return msg;
    });
    const wire = toWire(created);
    publishTicketMessage(id, ticket.userId, wire);
    return ok({ message: wire }, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengunggah gambar.', 500);
  }
}

export const POST = withRateLimit(withAuth(handleUpload), {
  scope: 'ticket',
  limit: rateLimitFromEnv('RATE_LIMIT_TICKET', 10),
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
