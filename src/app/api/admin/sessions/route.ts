import { requireAdmin, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Semua session semua user (Fase 3, step 3.4, admin saja).
 * Filter opsional: ?status=open&owner_id=3, limit/offset untuk paginasi.
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;

  const url = new URL(req.url);
  const statusRaw = (url.searchParams.get('status') ?? '').trim();
  const ownerRaw = (url.searchParams.get('owner_id') ?? url.searchParams.get('ownerId') ?? '').trim();
  const limitRaw = Number(url.searchParams.get('limit') ?? '50');
  const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.floor(offsetRaw), 0) : 0;

  const validStatuses = new Set([
    'connecting',
    'qr',
    'pairing',
    'open',
    'closed',
    'logged_out',
    'stopped',
  ]);
  if (statusRaw !== '' && !validStatuses.has(statusRaw)) {
    return fail('status: Nilai tidak valid.', 400);
  }
  let ownerId: number | undefined;
  if (ownerRaw !== '') {
    const n = Number.parseInt(ownerRaw, 10);
    if (!Number.isInteger(n) || n <= 0) {
      return fail('owner_id: Harus angka positif.', 400);
    }
    ownerId = n;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statusRaw) where.status = statusRaw;
    if (ownerId !== undefined) where.ownerId = ownerId;

    const [total, sessions] = await Promise.all([
      prisma.session.count({ where }),
      prisma.session.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: { owner: { select: { id: true, username: true, email: true } } },
      }),
    ]);
    return ok({ sessions, total, limit, offset });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil daftar session.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
