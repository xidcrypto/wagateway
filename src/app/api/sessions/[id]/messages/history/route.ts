import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { prisma } from '@/lib/server/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Riwayat pesan session.
 * Filter: remote_jid, direction (in/out), q (cari di teks),
 * limit (default 50, maks 200), offset.
 * Urutan: terbaru dulu (id desc).
 */
export const GET = withAuth(async (req: NextRequest, ctx: unknown, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const remoteJid = (url.searchParams.get('remote_jid') ?? url.searchParams.get('remoteJid') ?? '').trim();
  const direction = (url.searchParams.get('direction') ?? '').trim();
  const q = (url.searchParams.get('q') ?? '').trim();
  const limitRaw = Number(url.searchParams.get('limit') ?? '50');
  const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;

  if (direction !== '' && direction !== 'in' && direction !== 'out') {
    return fail('direction: Harus "in" atau "out".', 400);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { sessionId: auth.session.id };
    if (remoteJid) where.remoteJid = remoteJid;
    if (direction === 'in' || direction === 'out') where.direction = direction;
    if (q) where.textBody = { contains: q };

    const [total, rows] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          direction: true,
          waId: true,
          remoteJid: true,
          msgType: true,
          textBody: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    return ok({ messages: rows, total, limit, offset });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil riwayat pesan.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
