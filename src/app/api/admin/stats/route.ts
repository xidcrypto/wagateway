import { requireAdmin, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight } from '@/lib/server/response';
import { ok } from '@/lib/server/response';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Statistik sistem untuk dashboard admin (Fase 3, step 3.4).
 * - users: total user (+ rincian admin/user bila perlu di client).
 * - sessions: total session + yang sedang open.
 * - messages: total in/out + pesan hari ini (zona server).
 */
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const denied = requireAdmin(ctx);
  if (denied) return denied;
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      adminUsers,
      totalSessions,
      openSessions,
      totalMessagesIn,
      totalMessagesOut,
      messagesToday,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.session.count(),
      prisma.session.count({ where: { status: 'open' } }),
      prisma.message.count({ where: { direction: 'in' } }),
      prisma.message.count({ where: { direction: 'out' } }),
      prisma.message.count({ where: { createdAt: { gte: startOfDay } } }),
    ]);

    return ok({
      users: { total: totalUsers, admins: adminUsers, regular: totalUsers - adminUsers },
      sessions: { total: totalSessions, open: openSessions },
      messages: {
        total: totalMessagesIn + totalMessagesOut,
        in: totalMessagesIn,
        out: totalMessagesOut,
        today: messagesToday,
      },
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil statistik.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
