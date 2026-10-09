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

/** Ubah nama (subject) grup. */
const nameSchema = z.object({
  jid: z.string().min(1, 'JID grup wajib diisi.').max(128),
  subject: z.string().min(1, 'Nama baru wajib diisi.').max(100).optional(),
  name: z.string().min(1).max(100).optional(),
});

async function handleName(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, nameSchema);
  if (!parsed.ok) return parsed.response;

  const subject = (parsed.data.subject ?? parsed.data.name ?? '').trim();
  if (!subject) return fail('subject: Nama baru wajib diisi.', 400);

  try {
    const jid = assertGroupJid(parsed.data.jid);
    const sock = await requireOpenSocket(auth.session.id);
    await sock.groupUpdateSubject(jid, subject);
    return ok({ updated: true, jid, subject });
  } catch (err) {
    return managerError('Gagal mengubah nama grup.', err);
  }
}

export const POST = withAuth(handleName);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
