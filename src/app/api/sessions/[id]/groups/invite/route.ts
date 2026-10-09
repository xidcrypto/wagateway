import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  authorizeSession,
  managerError,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { requireOpenSocket } from '@/lib/server/send-helpers';
import { assertGroupJid } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ambil kode invite grup + link `chat.whatsapp.com`. Query: `?jid=<group@g.us>`. */
async function handleInvite(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const raw = (url.searchParams.get('jid') ?? url.searchParams.get('groupJid') ?? '').trim();
  if (!raw) return fail('Sertakan jid grup (query param `jid`).', 400);
  let jid: string;
  try {
    jid = assertGroupJid(raw);
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
    const code = await sock.groupInviteCode(jid);
    if (typeof code !== 'string' || !code) {
      return fail('Gagal mengambil kode invite grup.', 500);
    }
    return ok({ jid, code, link: `https://chat.whatsapp.com/${code}` });
  } catch (err) {
    return managerError('Gagal mengambil kode invite grup.', err);
  }
}

export const GET = withAuth(handleInvite);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
