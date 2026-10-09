import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import {
  buildListSections,
  listSectionSchema,
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

/** Kirim list klasik (single select): sections berisi rows. */
const listSchema = z.object({
  to: z.string().min(1, 'Nomor tujuan wajib diisi.').max(32),
  text: z.string().min(1, 'Teks wajib diisi.').max(4096),
  title: z.string().max(60).optional().nullable(),
  footer: z.string().max(1024).optional().nullable(),
  buttonText: z.string().min(1).max(60).optional().nullable(),
  button_text: z.string().min(1).max(60).optional().nullable(),
  sections: z
    .array(listSectionSchema)
    .min(1, 'Minimal 1 section.')
    .max(10, 'Maksimal 10 section.'),
});

async function handleSendList(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, listSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { jid } = normalizeTarget(parsed.data.to);
    const sock = await requireOpenSocket(auth.session.id);

    const sections = buildListSections(parsed.data.sections);
    const buttonText = (parsed.data.buttonText ?? parsed.data.button_text ?? '').trim() || 'Lihat Pilihan';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any = {
      text: parsed.data.text,
      buttonText,
      sections,
    };
    if (parsed.data.title) content.title = parsed.data.title;
    if (parsed.data.footer) content.footer = parsed.data.footer;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, content)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    const messageId = await recordOutgoing({
      sessionId: auth.session.id,
      waId,
      remoteJid: jid,
      msgType: 'listMessage',
      textBody: parsed.data.text,
      status: 'sent',
      payload: { title: parsed.data.title ?? null, footer: parsed.data.footer ?? null, buttonText, sections },
    });
    return ok({ messageId, to: jid, status: 'sent' });
  } catch (err) {
    return managerError('Gagal mengirim list.', err);
  }
}

export const POST = withAuth(handleSendList);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
