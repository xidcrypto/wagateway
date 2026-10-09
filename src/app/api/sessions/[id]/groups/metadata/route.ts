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
import { assertGroupJid, summarizeGroup } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Metadata satu grup via query param `jid` atau body `{ jid }`. */
const metaSchema = z.object({
  jid: z.string().min(1, 'JID grup wajib diisi.').max(128),
  groupJid: z.string().min(1).max(128).optional(),
});

async function resolveJid(req: NextRequest): Promise<string | Response> {
  const url = new URL(req.url);
  const fromQuery = (url.searchParams.get('jid') ?? url.searchParams.get('groupJid') ?? '').trim();
  if (fromQuery) {
    try {
      return assertGroupJid(fromQuery);
    } catch (err) {
      return managerError('JID grup tidak valid.', err);
    }
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return fail('Sertakan jid grup (query param atau body).', 400);
  }
  const parsed = metaSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(`jid: ${first?.message ?? 'JID grup wajib diisi.'}`, 400);
  }
  try {
    return assertGroupJid(parsed.data.groupJid ?? parsed.data.jid);
  } catch (err) {
    return managerError('JID grup tidak valid.', err);
  }
}

async function handleMetadata(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;

  const jidOrRes = await resolveJid(req);
  if (typeof jidOrRes !== 'string') return jidOrRes;

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const meta = await sock.groupMetadata(jidOrRes);
    return ok({ group: summarizeGroup(meta) });
  } catch (err) {
    return managerError('Gagal mengambil metadata grup.', err);
  }
}

export const GET = withAuth(handleMetadata);
export const POST = withAuth(handleMetadata);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
