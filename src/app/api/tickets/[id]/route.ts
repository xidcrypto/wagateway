import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/server/auth';
import { notifyAdminsTicket, parseTicketId, type SupportRouteCtx } from '@/lib/server/support';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const replySchema = z.object({
  message: z.string().min(1, 'Pesan wajib diisi.').max(2000, 'Pesan maksimal 2000 karakter.'),
});

function toDetail(t: {
  id: number;
  subject: string;
  status: unknown;
  createdAt: Date;
  updatedAt: Date;
  user: { id: number; username: string; fullName: string };
  messages: Array<{
    id: bigint;
    fromAdmin: boolean;
    body: string;
    createdAt: Date;
    sender: { id: number; username: string; fullName: string } | null;
  }>;
}) {
  return {
    id: t.id,
    subject: t.subject,
    status: String(t.status),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    user: { id: t.user.id, username: t.user.username, fullName: t.user.fullName },
    messages: t.messages.map((m) => ({
      id: String(m.id),
      fromAdmin: m.fromAdmin,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender
        ? { id: m.sender.id, username: m.sender.username, fullName: m.sender.fullName }
        : null,
    })),
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
    return ok({ ticket: toDetail(ticket) });
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
  if (!body) return fail('Pesan wajib diisi.', 400);
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId: ctx.user.id },
      select: { id: true, subject: true, status: true },
    });
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    if (String(ticket.status) === 'closed') {
      return fail('Tiket sudah ditutup. Buat tiket baru bila masih butuh bantuan.', 409);
    }
    await prisma.$transaction([
      prisma.supportMessage.create({
        data: { ticketId: id, senderId: ctx.user.id, fromAdmin: false, body },
      }),
      prisma.supportTicket.update({
        where: { id },
        data: { status: 'open', userLastReadAt: new Date() },
      }),
    ]);
    await notifyAdminsTicket({
      ticketId: id,
      subject: ticket.subject,
      actorName: ctx.user.username,
      reply: true,
    });
    return ok({ replied: true }, 201);
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
