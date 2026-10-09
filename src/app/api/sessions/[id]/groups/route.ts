import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  managerError,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { requireOpenSocket } from '@/lib/server/send-helpers';
import { summarizeGroup } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Daftar semua grup yang diikuti session ini. */
export const GET = withAuth(async (_req: NextRequest, ctx: unknown, routeCtx?: RouteCtx) => {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const raw = await sock.groupFetchAllParticipating();
    const list = Array.isArray(raw) ? raw : Object.values((raw ?? {}) as Record<string, unknown>);
    return ok({ groups: list.map(summarizeGroup), total: list.length });
  } catch (err) {
    return managerError('Gagal mengambil daftar grup.', err);
  }
});

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
