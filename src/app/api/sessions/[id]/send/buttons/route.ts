import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  buttonInputSchema,
  loadImageHeader,
  normalizeButton,
  toBaileysButton,
} from '@/lib/server/interactive';
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

/**
 * Kirim buttons (nativeFlow interaktif): reply, url, copy, call.
 * Header media opsional (hanya gambar). Teks wajib.
 */
const buttonsSchema = z.object({
  to: z.string().min(1, 'Nomor tujuan wajib diisi.').max(32),
  text: z.string().min(1, 'Teks wajib diisi.').max(4096),
  footer: z.string().max(1024).optional().nullable(),
  media: z.string().min(1).max(8_000_000).optional().nullable(),
  buttons: z
    .array(buttonInputSchema)
    .min(1, 'Minimal 1 tombol.')
    .max(10, 'Maksimal 10 tombol.'),
});

async function handleSendButtons(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, buttonsSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { jid } = normalizeTarget(parsed.data.to);
    const sock = await requireOpenSocket(auth.session.id);

    const nativeFlow = parsed.data.buttons.map((b, i) =>
      toBaileysButton(normalizeButton(b, i)),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any = {};
    if (parsed.data.media) {
      const header = await loadImageHeader(parsed.data.media);
      content.image = header.image;
      content.mimetype = header.mimetype;
      content.caption = parsed.data.text;
    } else {
      content.text = parsed.data.text;
    }
    content.nativeFlow = nativeFlow;
    if (parsed.data.footer) content.footer = parsed.data.footer;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, content)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    const messageId = await recordOutgoing({
      sessionId: auth.session.id,
      waId,
      remoteJid: jid,
      msgType: 'interactiveMessage',
      textBody: parsed.data.text,
      status: 'sent',
      payload: {
        footer: parsed.data.footer ?? null,
        hasMedia: Boolean(parsed.data.media),
        buttons: parsed.data.buttons,
      },
    });
    return ok({ messageId, to: jid, status: 'sent' });
  } catch (err) {
    return managerError('Gagal mengirim buttons.', err);
  }
}

export const POST = withAuth(handleSendButtons);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
