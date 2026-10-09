import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  managerError,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { requireOpenSocket } from '@/lib/server/send-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Daftar nomor yang diblokir session ini. */
async function handleBlocklist(_req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const list = await sock.fetchBlocklist();
    const safe = Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : [];
    return ok({ blocklist: safe, total: safe.length });
  } catch (err) {
    return managerError('Gagal mengambil blocklist.', err);
  }
}

export const GET = withAuth(handleBlocklist);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
