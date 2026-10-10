import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok, serializeBigInt } from '@/lib/server/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toItem(row: {
  id: bigint;
  userId: number;
  kind: unknown;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: String(serializeBigInt(row.id)),
    userId: row.userId,
    kind: String(row.kind),
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

/** List notifikasi milik sendiri (terbaru dulu) + jumlah belum dibaca. */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit') ?? '30');
  const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 30;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;
  const unreadOnly = url.searchParams.get('unread') === '1';
  try {
    const where = unreadOnly
      ? { userId: ctx.user.id, readAt: null }
      : { userId: ctx.user.id };
    const [total, unread, rows] = await Promise.all([
      prisma.notification.count({ where: { userId: ctx.user.id } }),
      prisma.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
      prisma.notification.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);
    return ok({ notifications: rows.map(toItem), total, unread, limit, offset });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil notifikasi.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
