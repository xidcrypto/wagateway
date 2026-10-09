import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { loadMedia } from '@/lib/server/media-loader';
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

const documentSchema = z.object({
  to: z.string().min(1, 'Nomor tujuan wajib diisi.').max(32),
  media: z.string().min(1, 'Media wajib diisi (URL, data URI, atau path lokal).').max(8_000_000),
  caption: z.string().max(65536).optional().nullable(),
  mimetype: z.string().max(127).optional().nullable(),
  filename: z.string().max(255).optional().nullable(),
  file_name: z.string().max(255).optional().nullable(),
});

async function handleSendDocument(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, documentSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { jid } = normalizeTarget(parsed.data.to);
    const sock = await requireOpenSocket(auth.session.id);
    const loaded = await loadMedia({ media: parsed.data.media });
    const mimeType = parsed.data.mimetype?.trim() || loaded.mimeType;
    const fileName = parsed.data.filename ?? parsed.data.file_name ?? 'dokumen';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any = { document: loaded.buffer, mimetype: mimeType, fileName };
    if (parsed.data.caption) content.caption = parsed.data.caption;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, content)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    const messageId = await recordOutgoing({
      sessionId: auth.session.id,
      waId,
      remoteJid: jid,
      msgType: 'documentMessage',
      textBody: parsed.data.caption ?? fileName,
      status: 'sent',
    });
    return ok({ messageId, to: jid, status: 'sent' });
  } catch (err) {
    return managerError('Gagal mengirim dokumen.', err);
  }
}

export const POST = withAuth(handleSendDocument);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
