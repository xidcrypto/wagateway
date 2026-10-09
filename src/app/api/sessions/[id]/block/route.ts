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
import { normalizeContact } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Blokir kontak: body `{ number }`. */
const blockSchema = z.object({
  number: z.string().min(1).max(64).optional(),
  phone: z.string().min(1).max(64).optional(),
  jid: z.string().min(1).max(64).optional(),
});

async function resolveTarget(data: z.infer<typeof blockSchema>): Promise<string> {
  const raw = (data.number ?? data.phone ?? data.jid ?? '').trim();
  if (!raw) throw Object.assign(new Error('Sertakan nomor kontak.'), { statusCode: 400 });
  return normalizeContact(raw).jid;
}

async function handleBlock(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, blockSchema);
  if (!parsed.ok) return parsed.response;

  let jid: string;
  try {
    jid = await resolveTarget(parsed.data);
  } catch (err) {
    return managerError('Nomor kontak tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    await sock.updateBlockStatus(jid, 'block');
    return ok({ jid, blocked: true });
  } catch (err) {
    return managerError('Gagal memblokir kontak.', err);
  }
}

export const POST = withAuth(handleBlock);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
