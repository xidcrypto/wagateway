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

/** Poll single choice (selectableCount selalu 1 sesuai spek Fase 2). */
const pollSchema = z.object({
  to: z.string().min(1, 'Nomor tujuan wajib diisi.').max(32),
  name: z.string().min(1, 'Pertanyaan poll wajib diisi.').max(1024).optional(),
  question: z.string().min(1, 'Pertanyaan poll wajib diisi.').max(1024).optional(),
  options: z.array(z.string().min(1).max(255)).min(2, 'Minimal 2 opsi.').max(12, 'Maksimal 12 opsi.').optional(),
  values: z.array(z.string().min(1).max(255)).min(2, 'Minimal 2 opsi.').max(12, 'Maksimal 12 opsi.').optional(),
});

async function handleSendPoll(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, pollSchema);
  if (!parsed.ok) return parsed.response;

  const name = (parsed.data.name ?? parsed.data.question ?? '').trim();
  if (!name) {
    return fail('name: Pertanyaan poll wajib diisi.', 400);
  }
  const values = parsed.data.options ?? parsed.data.values ?? [];
  if (values.length < 2) {
    return fail('options: Minimal 2 opsi.', 400);
  }

  try {
    const { jid } = normalizeTarget(parsed.data.to);
    const sock = await requireOpenSocket(auth.session.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any = {
      poll: {
        name,
        values,
        selectableCount: 1,
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, content)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    const messageId = await recordOutgoing({
      sessionId: auth.session.id,
      waId,
      remoteJid: jid,
      msgType: 'pollCreationMessage',
      textBody: `${name} (${values.join(' / ')})`,
      status: 'sent',
    });
    return ok({ messageId, to: jid, status: 'sent' });
  } catch (err) {
    return managerError('Gagal mengirim poll.', err);
  }
}

export const POST = withAuth(handleSendPoll);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
