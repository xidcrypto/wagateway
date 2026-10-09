import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  managerError,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { requireOpenSocket } from '@/lib/server/send-helpers';
import { normalizeContact, summarizeContactStatus } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** About/status kontak. GET `?number=628xxx`. */
async function handleAbout(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const raw = (
    url.searchParams.get('number') ??
    url.searchParams.get('phone') ??
    url.searchParams.get('jid') ??
    ''
  ).trim();
  if (!raw) return fail('Sertakan nomor (query param `number`).', 400);
  let jid: string;
  try {
    jid = normalizeContact(raw).jid;
  } catch (err) {
    return managerError('Nomor tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const results = await sock.fetchStatus(jid).catch(() => null);
    const first = Array.isArray(results) ? results[0] : null;
    return ok({ about: summarizeContactStatus(first) });
  } catch (err) {
    return managerError('Gagal mengambil status kontak.', err);
  }
}

export const GET = withAuth(handleAbout);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
