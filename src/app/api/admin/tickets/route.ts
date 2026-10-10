import { NextRequest } from 'next/server';
import { requireAdmin, withAuth } from '@/lib/server/auth';
import { TICKET_STATUSES } from '@/lib/server/support';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Semua tiket semua user (admin): filter status + paginasi + badge belum dibaca. */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status') ?? '';
  const limitRaw = Number(url.searchParams.get('limit') ?? '20');
  const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 20;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;
  const where: { status?: (typeof TICKET_STATUSES)[number] } = {};
  if (statusParam && (TICKET_STATUSES as readonly string[]).includes(statusParam)) {
    where.status = statusParam as (typeof TICKET_STATUSES)[number];
  }
  try {
    const [total, rows] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, username: true, fullName: true } },
          messages: {
            orderBy: { id: 'desc' },
            take: 1,
            select: { fromAdmin: true, createdAt: true, body: true },
          },
        },
      }),
    ]);
    const tickets = rows.map((t) => {
      const last = t.messages[0] ?? null;
      const hasUnread =
        last !== null &&
        !last.fromAdmin &&
        (t.adminLastReadAt === null || last.createdAt > t.adminLastReadAt);
      return {
        id: t.id,
        subject: t.subject,
        status: String(t.status),
        hasUnread,
        lastFromAdmin: last?.fromAdmin ?? null,
        lastExcerpt:
          last !== null
            ? last.body.replace(/\s+/g, ' ').trim().slice(0, 120)
            : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        user: { id: t.user.id, username: t.user.username, fullName: t.user.fullName },
      };
    });
    return ok({ tickets, total, limit, offset });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil tiket.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
