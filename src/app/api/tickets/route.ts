import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthContext } from '@/lib/server/auth';
import { notifyAdminsTicket, excerpt } from '@/lib/server/support';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok, serializeBigInt } from '@/lib/server/response';
import { parseJsonBody } from '@/lib/server/validators';
import { rateLimitFromEnv, withRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createTicketSchema = z.object({
  subject: z.string().min(3, 'Judul minimal 3 karakter.').max(255, 'Judul maksimal 255 karakter.'),
  message: z.string().min(1, 'Pesan wajib diisi.').max(2000, 'Pesan maksimal 2000 karakter.'),
});

function toListItem(t: {
  id: number;
  subject: string;
  status: unknown;
  userLastReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{ fromAdmin: boolean; createdAt: Date }>;
}) {
  const last = t.messages[0] ?? null;
  const hasUnread =
    last !== null &&
    last.fromAdmin &&
    (t.userLastReadAt === null || last.createdAt > t.userLastReadAt);
  return {
    id: t.id,
    subject: t.subject,
    status: String(t.status),
    hasUnread,
    lastFromAdmin: last?.fromAdmin ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Daftar tiket milik sendiri (terbaru dulu) + penanda balasan baru. */
export const GET = withAuth(async (_req, ctx) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: ctx.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        subject: true,
        status: true,
        userLastReadAt: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { id: 'desc' },
          take: 1,
          select: { fromAdmin: true, createdAt: true },
        },
      },
    });
    return ok({ tickets: tickets.map(toListItem) });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil tiket.', 500);
  }
});

async function handleCreate(req: NextRequest, ctx: AuthContext): Promise<Response> {
  const parsed = await parseJsonBody(req, createTicketSchema);
  if (!parsed.ok) return parsed.response;
  const subject = parsed.data.subject.trim();
  const message = parsed.data.message.trim();
  if (!subject) return fail('Judul wajib diisi.', 400);
  if (!message) return fail('Pesan wajib diisi.', 400);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          userId: ctx.user.id,
          subject,
          status: 'open',
          userLastReadAt: new Date(),
        },
      });
      await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: ctx.user.id,
          fromAdmin: false,
          body: message,
        },
      });
      return ticket;
    });
    await notifyAdminsTicket({
      ticketId: created.id,
      subject,
      actorName: ctx.user.username,
    });
    return ok(
      {
        ticket: {
          id: created.id,
          subject: created.subject,
          status: String(created.status),
          createdAt:
            created.createdAt instanceof Date
              ? created.createdAt.toISOString()
              : String(serializeBigInt(created.createdAt)),
        },
        preview: excerpt(message),
      },
      201,
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal membuat tiket.', 500);
  }
}

export const POST = withRateLimit(withAuth(handleCreate), {
  scope: 'ticket',
  limit: rateLimitFromEnv('RATE_LIMIT_TICKET', 10),
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
