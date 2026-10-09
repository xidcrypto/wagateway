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
import { assertEphemeralDuration, assertGroupJid } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pesan sementara (ephemeral) grup.
 * `duration`: 0 (mati), 86400 (24 jam), 604800 (7 hari), 7776000 (90 hari).
 */
const ephemeralSchema = z.object({
  jid: z.string().min(1, 'JID grup wajib diisi.').max(128),
  duration: z.number().int('Durasi harus bilangan bulat.'),
});

async function handleEphemeral(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, ephemeralSchema);
  if (!parsed.ok) return parsed.response;

  let jid: string;
  try {
    jid = assertGroupJid(parsed.data.jid);
  } catch (err) {
    return managerError('JID grup tidak valid.', err);
  }
  let duration: number;
  try {
    duration = assertEphemeralDuration(parsed.data.duration);
  } catch (err) {
    return managerError('Durasi ephemeral tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    // Pastikan grup ada dulu (query ke JID tak dikenal tidak dijawab server WA → hang).
    try {
      await sock.groupMetadata(jid);
    } catch {
      return fail('Grup tidak ditemukan.', 404);
    }
    await sock.groupToggleEphemeral(jid, duration);
    return ok({ jid, duration });
  } catch (err) {
    return managerError('Gagal mengubah ephemeral grup.', err);
  }
}

export const POST = withAuth(handleEphemeral);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
