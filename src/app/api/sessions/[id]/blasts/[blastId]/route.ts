import { NextRequest } from 'next/server';
import { isAdmin, withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { authorizeSession, type RouteCtx } from '@/lib/server/session-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BlastCtx = RouteCtx & { params: Promise<{ id: string; blastId: string }> };

async function parseBlastId(routeCtx?: BlastCtx): Promise<number | null> {
  const raw = (await routeCtx?.params)?.blastId;
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

/**
 * Detail campaign + statistik recipient (pending/sent/failed).
 * User biasa hanya blast miliknya (cek via session owner).
 */
export const GET = withAuth(async (_req: NextRequest, ctx, routeCtx?: BlastCtx) => {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  if (!isAdmin(ctx as Parameters<typeof isAdmin>[0]) && auth.session.ownerId !== ctx.user.id) {
    return fail('Akses ditolak. Bukan blast milikmu.', 403);
  }
  const blastId = await parseBlastId(routeCtx);
  if (blastId === null) {
    return fail('ID blast tidak valid.', 400);
  }
  try {
    const blast = await prisma.blast.findFirst({
      where: { id: blastId, sessionId: auth.session.id },
      select: {
        id: true,
        sessionId: true,
        label: true,
        textBody: true,
        total: true,
        delayMin: true,
        delayMax: true,
        status: true,
        error: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    if (!blast) {
      return fail('Blast tidak ditemukan.', 404);
    }
    const [pending, sent, failed] = await Promise.all([
      prisma.blastRecipient.count({ where: { blastId, status: 'pending' } }),
      prisma.blastRecipient.count({ where: { blastId, status: 'sent' } }),
      prisma.blastRecipient.count({ where: { blastId, status: 'failed' } }),
    ]);
    return ok({ blast, stats: { pending, sent, failed, total: blast.total } });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Gagal mengambil detail blast.', 500);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
