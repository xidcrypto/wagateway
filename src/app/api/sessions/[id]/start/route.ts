import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  managerError,
  start,
  type RouteCtx,
} from '@/lib/server/session-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (_req, ctx, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(ctx, routeCtx);
  if (!auth.ok) return auth.response;
  try {
    await start(auth.session.id);
  } catch (err) {
    return managerError('Gagal memulai session.', err);
  }
  const fresh = await prisma.session.findUnique({ where: { id: auth.session.id } });
  return ok({ session: fresh });
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
