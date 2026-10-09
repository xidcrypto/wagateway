import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  managerError,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { requireOpenSocket } from '@/lib/server/send-helpers';
import { parseJsonBody } from '@/lib/server/validators';
import { normalizeContact } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Buka blokir kontak: body `{ number }`. */
const unblockSchema = z.object({
  number: z.string().min(1).max(64).optional(),
  phone: z.string().min(1).max(64).optional(),
  jid: z.string().min(1).max(64).optional(),
});

async function handleUnblock(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, unblockSchema);
  if (!parsed.ok) return parsed.response;

  const raw = (parsed.data.number ?? parsed.data.phone ?? parsed.data.jid ?? '').trim();
  if (!raw) return fail('Sertakan nomor kontak.', 400);
  let jid: string;
  try {
    jid = normalizeContact(raw).jid;
  } catch (err) {
    return managerError('Nomor kontak tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    await sock.updateBlockStatus(jid, 'unblock');
    return ok({ jid, blocked: false });
  } catch (err) {
    return managerError('Gagal membuka blokir kontak.', err);
  }
}

export const POST = withAuth(handleUnblock);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
