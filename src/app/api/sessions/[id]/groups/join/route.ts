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
import { extractInviteCode } from '@/lib/server/groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Gabung grup via kode invite atau link `chat.whatsapp.com/...`. */
const joinSchema = z.object({
  code: z.string().min(1).max(256).optional(),
  link: z.string().min(1).max(256).optional(),
  invite: z.string().min(1).max(256).optional(),
});

async function handleJoin(req: NextRequest, ctx: unknown, routeCtx?: RouteCtx): Promise<Response> {
  const auth = await authorizeSession(
    ctx as Parameters<typeof authorizeSession>[0],
    routeCtx,
  );
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req, joinSchema);
  if (!parsed.ok) return parsed.response;

  const raw = (parsed.data.link ?? parsed.data.invite ?? parsed.data.code ?? '').trim();
  if (!raw) return fail('Sertakan kode invite atau link grup.', 400);
  let code: string;
  try {
    code = extractInviteCode(raw);
  } catch (err) {
    return managerError('Kode/link invite tidak valid.', err);
  }

  try {
    const sock = await requireOpenSocket(auth.session.id);
    const groupJid = await sock.groupAcceptInvite(code);
    return ok({ groupJid: typeof groupJid === 'string' ? groupJid : null }, 201);
  } catch (err) {
    // Kode salah/kedaluwarsa/grup bubar → pesan spesifik, bukan pesan pairing generik.
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (/not-found|item-not-found|bad-request|invalid|gone|expired|forbidden/.test(msg)) {
      return fail('Kode invite tidak valid, kedaluwarsa, atau grup sudah tidak ada.', 404);
    }
    return managerError('Gagal bergabung ke grup.', err);
  }
}

export const POST = withAuth(handleJoin);

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handlePreflight(req) ?? fail('Metode tidak diizinkan.', 405);
}
