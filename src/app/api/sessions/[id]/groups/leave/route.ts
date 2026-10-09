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
import { assertGroupJid } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Keluar dari grup. */
const leaveSchema = z.object({
  jid: z.string().min(1, 'JID grup wajib diisi.').max(128),
  groupJid: z.string().min(1).max(128).optional(),
});

async function handleLeave(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, leaveSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const jid = assertGroupJid(parsed.data.groupJid ?? parsed.data.jid);
    const sock = await requireOpenSocket(auth.session.id);
    await sock.groupLeave(jid);
    return ok({ left: true, jid });
  } catch (err) {
    return managerError('Gagal keluar dari grup.', err);
  }
}

export const POST = withAuth(handleLeave);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
