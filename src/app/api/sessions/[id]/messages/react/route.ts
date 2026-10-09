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
import { resolveTarget } from '@/lib/server/message-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Kirim/tarik reaksi emoji pada satu pesan. */
const reactSchema = z.object({
  message_id: z.union([z.string(), z.number()]).optional(),
  messageId: z.union([z.string(), z.number()]).optional(),
  wa_id: z.string().max(255).optional(),
  waId: z.string().max(255).optional(),
  remote_jid: z.string().max(128).optional(),
  remoteJid: z.string().max(128).optional(),
  emoji: z.string().min(1, 'Emoji wajib diisi.').max(20).optional(),
  text: z.string().min(1).max(20).optional(),
});

async function handleReact(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, reactSchema);
  if (!parsed.ok) return parsed.response;

  const emoji = (parsed.data.emoji ?? parsed.data.text ?? '').trim();
  if (!emoji) return fail('emoji: Emoji wajib diisi.', 400);

  try {
    const { key } = await resolveTarget(auth.session.id, {
      message_id: parsed.data.message_id ?? parsed.data.messageId,
      wa_id: parsed.data.wa_id ?? parsed.data.waId,
      remote_jid: parsed.data.remote_jid ?? parsed.data.remoteJid,
    });
    const sock = await requireOpenSocket(auth.session.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sock.sendMessage(key.remoteJid, { react: { text: emoji, key } } as any);
    return ok({ reacted: true, to: key.remoteJid, emoji });
  } catch (err) {
    return managerError('Gagal mengirim reaksi.', err);
  }
}

export const POST = withAuth(handleReact);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
