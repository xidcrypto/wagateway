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

const locationSchema = z.object({
  to: z.string().min(1, 'Nomor tujuan wajib diisi.').max(32),
  latitude: z.number().min(-90, 'Latitude harus -90 sampai 90.').max(90),
  longitude: z.number().min(-180, 'Longitude harus -180 sampai 180.').max(180),
  name: z.string().max(255).optional().nullable(),
  address: z.string().max(1024).optional().nullable(),
});

async function handleSendLocation(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, locationSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { jid } = normalizeTarget(parsed.data.to);
    const sock = await requireOpenSocket(auth.session.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any = {
      location: {
        degreesLatitude: parsed.data.latitude,
        degreesLongitude: parsed.data.longitude,
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.address ? { address: parsed.data.address } : {}),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sent = (await sock.sendMessage(jid, content)) as any;
    const waId = typeof sent?.key?.id === 'string' ? sent.key.id : `local-${Date.now()}`;
    const label = parsed.data.name ?? `${parsed.data.latitude},${parsed.data.longitude}`;
    const messageId = await recordOutgoing({
      sessionId: auth.session.id,
      waId,
      remoteJid: jid,
      msgType: 'locationMessage',
      textBody: label,
      status: 'sent',
    });
    return ok({ messageId, to: jid, status: 'sent' });
  } catch (err) {
    return managerError('Gagal mengirim lokasi.', err);
  }
}

export const POST = withAuth(handleSendLocation);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
