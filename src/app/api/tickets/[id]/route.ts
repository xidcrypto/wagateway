import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/server/auth';
import { notifyAdminsTicket, parseTicketId, type SupportRouteCtx } from '@/lib/server/support';
import { toMessageWire, type WireMessageRow } from '@/lib/server/support-wire';
import { publishTicketMessage } from '@/lib/server/ticket-live';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const replySchema = z.object({
  message: z.string().max(2000, 'Pesan maksimal 2000 karakter.').optional().default(''),
  // ID file staged (dari POST /stage). Bila ada, pesan memakai file itu.
  stagedId: z.number().int().positive().optional(),
});

function toDetail(t: {
  id: number;
  subject: string;
  status: unknown;
  adminLastReadAt: Date | null;
  userLastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: number; username: string; fullName: string };
  messages: WireMessageRow[];
}) {
  return {
    id: t.id,
    subject: t.subject,
    status: String(t.status),
    // Penanda baca DUA sisi (untuk centang biru per-bubble di client):
    // - peerReadAt = kapan ADMIN terakhir membaca (centang biru pesan user).
    // - myReadAt = kapan SAYA terakhir membaca (tak dipakai centang, untuk konsistensi).
    peerReadAt: t.adminLastReadAt ? t.adminLastReadAt.toISOString() : null,
    myReadAt: t.userLastReadAt ? t.userLastReadAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    user: { id: t.user.id, username: t.user.username, fullName: t.user.fullName },
    messages: t.messages.map(toMessageWire),
  };
}

/** Detail + thread tiket milik sendiri; buka = tandai sudah dibaca user. */
export const GET = withAuth(async (_req, ctx, routeCtx?: SupportRouteCtx) => {
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId: ctx.user.id },
      include: {
        user: { select: { id: true, username: true, fullName: true } },
        messages: {
          orderBy: { id: 'asc' },
          take: 500,
          include: { sender: { select: { id: true, username: true, fullName: true } } },
        },
      },
    });
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    // Buka thread = user sudah membaca sampai sekarang.
    await prisma.supportTicket.update({
      where: { id },
      data: { userLastReadAt: new Date() },
    });
    return ok({
      ticket: toDetail({
        ...ticket,
        adminLastReadAt: ticket.adminLastReadAt,
        userLastReadAt: new Date(),
      }),
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil tiket.', 500);
  }
});

async function handleReply(
  req: NextRequest,
  ctx: AuthContext,
  routeCtx?: SupportRouteCtx,
): Promise<Response> {
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  const parsed = await parseJsonBody(req, replySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data.message.trim();
  const stagedId = parsed.data.stagedId ?? null;
  // Teks boleh kosong BILA ada gambar staged (caption opsional).
  if (!body && stagedId === null) return fail('Pesan wajib diisi.', 400);
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId: ctx.user.id },
      select: { id: true, userId: true, subject: true, status: true },
    });
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    if (String(ticket.status) === 'closed') {
      return fail('Tiket sudah ditutup. Buat tiket baru bila masih butuh bantuan.', 409);
    }
    // Klaim staged file milik pengirim di tiket ini (sekali pakai).
    let staged: { id: number; fileName: string; mime: string } | null = null;
    if (stagedId !== null) {
      staged = await prisma.supportStagedFile.findFirst({
        where: { id: stagedId, ticketId: id, userId: ctx.user.id },
        select: { id: true, fileName: true, mime: true },
      });
      if (!staged) {
        return fail('File lampiran tidak ditemukan atau sudah dipakai. Unggah ulang.', 400);
      }
    }
    const created = await prisma.$transaction(async (tx) => {
      const msg = await tx.supportMessage.create({
        data: {
          ticketId: id,
          senderId: ctx.user.id,
          fromAdmin: false,
          body,
          mediaPath: staged ? staged.fileName : null,
          mediaMime: staged ? staged.mime : null,
        },
        include: { sender: { select: { id: true, username: true, fullName: true } } },
      });
      if (staged) {
        await tx.supportStagedFile.delete({ where: { id: staged.id } }).catch(() => {});
      }
      await tx.supportTicket.update({
        where: { id },
        data: { status: 'open', userLastReadAt: new Date() },
      });
      return msg;
    });
    publishTicketMessage(id, ticket.userId, toMessageWire(created));
    await notifyAdminsTicket({
      ticketId: id,
      subject: ticket.subject,
      actorName: ctx.user.username,
      reply: true,
    });
    return ok({ replied: true, message: toMessageWire(created) }, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal membalas tiket.', 500);
  }
}

export const POST = withRateLimit(withAuth(handleReply), {
  scope: 'ticket',
  limit: rateLimitFromEnv('RATE_LIMIT_TICKET', 10),
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
