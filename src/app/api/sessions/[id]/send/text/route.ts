import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { recordOutgoing } from '@/lib/server/message-recorder';
import {
  authorizeSession,
  managerError,
  type RouteCtx,
} from '@/lib/server/session-manager';
import { normalizeTarget, requireOpenSocket } from '@/lib/server/send-helpers';
import { parseJsonBody } from '@/lib/server/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const textSchema = z.object({
  to: z.string().min(1, 'Nomor tujuan wajib diisi.').max(32),
  text: z.string().min(1, 'Teks wajib diisi.').max(65536),
  reply_to: z.string().max(255).optional().nullable(),
  replyTo: z.string().max(255).optional().nullable(),
});

async function handleSendText(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, textSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { jid } = normalizeTarget(parsed.data.to);
    const sock = await requireOpenSocket(auth.session.id);
    const quotedId = parsed.data.reply_to ?? parsed.data.replyTo ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any = { text: parsed.data.text };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {};
    if (quotedId) {
      options.quoted = {
        key: { id: quotedId, remoteJid: jid, fromMe: false },
        message: { conversation: '' },
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, content, options)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    const messageId = await recordOutgoing({
      sessionId: auth.session.id,
      waId,
      remoteJid: jid,
      msgType: 'conversation',
      textBody: parsed.data.text,
      status: 'sent',
    });
    return ok({ messageId, to: jid, status: 'sent' });
  } catch (err) {
    return managerError('Gagal mengirim pesan teks.', err);
  }
}

export const POST = withAuth(handleSendText);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
