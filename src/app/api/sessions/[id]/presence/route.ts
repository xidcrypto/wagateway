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
import { assertPresenceType, normalizeContact } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Kirim presence (status mengetik/merekam/online).
 * `to` opsional: JID chat untuk composing/recording/paused.
 */
const presenceSchema = z.object({
  type: z.string().min(1, 'Tipe presence wajib diisi.').max(16),
  to: z.string().min(1).max(64).optional(),
  jid: z.string().min(1).max(64).optional(),
});

async function handlePresence(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, presenceSchema);
  if (!parsed.ok) return parsed.response;

  let type: string;
  try {
    type = assertPresenceType(parsed.data.type);
  } catch (err) {
    return managerError('Tipe presence tidak valid.', err);
  }
  const rawTo = (parsed.data.to ?? parsed.data.jid ?? '').trim();
  let toJid: string | undefined;
  if (rawTo) {
    try {
      toJid = normalizeContact(rawTo).jid;
    } catch (err) {
      return managerError('Nomor tujuan tidak valid.', err);
    }
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    await sock.sendPresenceUpdate(type, toJid);
    return ok({ type, to: toJid ?? null });
  } catch (err) {
    return managerError('Gagal mengirim presence.', err);
  }
}

export const POST = withAuth(handlePresence);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
