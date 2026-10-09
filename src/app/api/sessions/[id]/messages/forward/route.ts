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
import { normalizeJid, reviveBytes } from '@/lib/server/message-actions';
import { recordOutgoing } from '@/lib/server/message-recorder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Teruskan pesan. Objek pesan mentah (WebMessageInfo) wajib disertakan
 * client apa adanya — sesuai spek Fase 2.
 */
const forwardSchema = z.object({
  to: z.string().min(1, 'Tujuan wajib diisi.').max(128),
  message: z.record(z.string(), z.unknown()),
  force: z.boolean().optional(),
  forceForward: z.boolean().optional(),
});

async function handleForward(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, forwardSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const dest = normalizeJid(parsed.data.to);
    const raw = reviveBytes(parsed.data.message) as {
      key?: { id?: unknown };
      message?: unknown;
    };
    if (!raw || typeof raw !== 'object' || !raw.key?.id || !raw.message) {
      return fail('message: Objek pesan mentah tidak valid (wajib ada key.id dan message).', 400);
    }
    const sock = await requireOpenSocket(auth.session.id);

    const sent = await sock.sendMessage(dest, {
      forward: raw,
      force: parsed.data.force ?? parsed.data.forceForward ?? false,
    });
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    const fwdType =
      raw.message && typeof raw.message === 'object'
        ? (Object.keys(raw.message)[0] ?? 'forwarded')
        : 'forwarded';
    const messageId = await recordOutgoing({
      sessionId: auth.session.id,
      waId,
      remoteJid: dest,
      msgType: fwdType,
      textBody: null,
      status: 'sent',
      payload: { forwardedFrom: raw.key.id },
    });
    return ok({ messageId, to: dest, status: 'sent' });
  } catch (err) {
    return managerError('Gagal meneruskan pesan.', err);
  }
}

export const POST = withAuth(handleForward);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
