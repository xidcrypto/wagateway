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

/** Cabut (revoke) link invite grup; mengembalikan kode baru. */
const revokeSchema = z.object({
  jid: z.string().min(1, 'JID grup wajib diisi.').max(128),
});

async function handleRevoke(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, revokeSchema);
  if (!parsed.ok) return parsed.response;

  let jid: string;
  try {
    jid = assertGroupJid(parsed.data.jid);
  } catch (err) {
    return managerError('JID grup tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    // Pastikan grup ada dulu (query ke JID tak dikenal tidak dijawab server WA → hang).
    try {
      await sock.groupMetadata(jid);
    } catch {
      return fail('Grup tidak ditemukan.', 404);
    }
    const code = await sock.groupRevokeInvite(jid);
    if (typeof code !== 'string' || !code) {
      return fail('Gagal mencabut invite grup.', 500);
    }
    return ok({ jid, code, link: `https://chat.whatsapp.com/${code}` });
  } catch (err) {
    return managerError('Gagal mencabut invite grup.', err);
  }
}

export const POST = withAuth(handleRevoke);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
