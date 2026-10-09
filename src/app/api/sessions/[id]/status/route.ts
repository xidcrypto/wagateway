import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  getStatus,
  type RouteCtx,
} from '@/lib/server/session-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, ctx, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(ctx, routeCtx);
  if (!auth.ok) return auth.response;
  try {
    return ok(await getStatus(auth.session.id));
  } catch (err) {
    const statusCode =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? Number((err as { statusCode: unknown }).statusCode) || 500
        : 500;
    return fail(err instanceof Error ? err.message : 'Gagal mengambil status.', statusCode);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
