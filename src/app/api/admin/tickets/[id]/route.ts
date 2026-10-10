import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, withAuth, type AuthContext } from '@/lib/server/auth';
import {
  notifyUserTicket,
  parseTicketId,
  TICKET_STATUSES,
  type SupportRouteCtx,
} from '@/lib/server/support';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const replySchema = z.object({
  message: z.string().min(1, 'Pesan wajib diisi.').max(2000, 'Pesan maksimal 2000 karakter.'),
});

const statusSchema = z.object({
  status: z.enum(TICKET_STATUSES, { message: 'Status harus open, answered, atau closed.' }),
});

function toDetail(t: {
  id: number;
  userId: number;
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
    userId: t.userId,
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

/** Detail tiket siapa pun (admin); buka = tandai sudah dibaca admin. */
export const GET = withAuth(async (_req, ctx, routeCtx?: SupportRouteCtx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
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
    await prisma.supportTicket.update({
      where: { id },
      data: { adminLastReadAt: new Date() },
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
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  const parsed = await parseJsonBody(req, replySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data.message.trim();
  if (!body) return fail('Pesan wajib diisi.', 400);
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, userId: true, subject: true, status: true },
    });
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    const wasClosed = String(ticket.status) === 'closed';
    await prisma.$transaction([
      prisma.supportMessage.create({
        data: {
          ticketId: id,
          senderId: ctx.user.id === 0 ? null : ctx.user.id,
          fromAdmin: true,
          body,
        },
      }),
      prisma.supportTicket.update({
        where: { id },
        data: { status: 'answered', adminLastReadAt: new Date() },
      }),
    ]);
    await notifyUserTicket({
      userId: ticket.userId,
      ticketId: id,
      subject: ticket.subject,
      adminName: ctx.user.username,
      reopened: wasClosed,
    });
    return ok({ replied: true, reopened: wasClosed }, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal membalas tiket.', 500);
  }
}

/** Admin membalas tiket (otomatis jadi answered; closed ikut terbuka lagi). */
export const POST = withRateLimit(withAuth(handleReply), {
  scope: 'ticket',
  limit: rateLimitFromEnv('RATE_LIMIT_TICKET', 30),
});

async function handleStatus(
  req: NextRequest,
  ctx: AuthContext,
  routeCtx?: SupportRouteCtx,
): Promise<Response> {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const id = await parseTicketId(routeCtx);
  if (id === null) return fail('ID tiket tidak valid.', 400);
  const parsed = await parseJsonBody(req, statusSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, userId: true, subject: true, status: true },
    });
    if (!ticket) return fail('Tiket tidak ditemukan.', 404);
    const next = parsed.data.status;
    if (String(ticket.status) === next) {
      return ok({ ticket: { id: ticket.id, status: String(ticket.status) } });
    }
    await prisma.supportTicket.update({ where: { id }, data: { status: next } });
    // Beri tahu user hanya untuk tutup/buka (answered sudah ter-cover balasan).
    if (next === 'closed') {
      await notifyUserTicket({
        userId: ticket.userId,
        ticketId: id,
        subject: ticket.subject,
        adminName: ctx.user.username,
        closed: true,
      });
    } else if (next === 'open' && String(ticket.status) === 'closed') {
      await notifyUserTicket({
        userId: ticket.userId,
        ticketId: id,
        subject: ticket.subject,
        adminName: ctx.user.username,
        reopened: true,
      });
    }
    return ok({ ticket: { id, status: next } });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengubah status tiket.', 500);
  }
}

/** Admin ubah status manual (open/answered/closed). */
export const PATCH = withAuth(handleStatus);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
