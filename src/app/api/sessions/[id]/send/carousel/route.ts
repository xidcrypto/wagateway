import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/server/auth';
import { fail, handlePreflight, ok } from '@/lib/server/response';
import { buildCarouselCard, carouselCardSchema } from '@/lib/server/interactive';
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

/** Kirim carousel: 1–10 card, tiap card wajib gambar atau video. */
const carouselSchema = z.object({
  to: z.string().min(1, 'Nomor tujuan wajib diisi.').max(32),
  text: z.string().max(4096).optional().nullable(),
  footer: z.string().max(1024).optional().nullable(),
  cards: z
    .array(carouselCardSchema)
    .min(1, 'Minimal 1 card.')
    .max(10, 'Maksimal 10 card.'),
});

async function handleSendCarousel(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, carouselSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { jid } = normalizeTarget(parsed.data.to);
    const sock = await requireOpenSocket(auth.session.id);

    const cards = [];
    for (let i = 0; i < parsed.data.cards.length; i += 1) {
      cards.push(await buildCarouselCard(parsed.data.cards[i]!, i));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any = { cards };
    if (parsed.data.text) content.text = parsed.data.text;
    if (parsed.data.footer) content.footer = parsed.data.footer;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, content)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    const messageId = await recordOutgoing({
      sessionId: auth.session.id,
      waId,
      remoteJid: jid,
      msgType: 'interactiveMessage',
      textBody: parsed.data.text || parsed.data.cards.map((c) => c.caption ?? c.title ?? '').filter(Boolean).join(' | ') || `${cards.length} card`,
      status: 'sent',
      payload: {
        footer: parsed.data.footer ?? null,
        // Ringkasan tanpa buffer media.
        cards: parsed.data.cards.map((c) => ({
          caption: c.caption ?? null,
          title: c.title ?? null,
          hasImage: Boolean(c.image),
          hasVideo: Boolean(c.video),
          buttons: c.buttons,
        })),
      },
    });
    return ok({ messageId, to: jid, status: 'sent' });
  } catch (err) {
    return managerError('Gagal mengirim carousel.', err);
  }
}

export const POST = withAuth(handleSendCarousel);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
